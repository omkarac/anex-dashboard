'use client';

/**
 * Skygauge 3D scene (inner).
 *
 * React Three Fiber view of a site's airspace constraint: the colour-coded
 * OLS-ceiling heightfield, the site's buildable massing, and the *real nearby
 * structures* — issued NOCs and appellate cases — rendered as procedural
 * building massings (varied architectural styles) at their true ENU positions
 * via the shared `projectToScene`, with apex height = approved top AMSL.
 * Distances between structures and the site match the source coordinates.
 * Loaded only via the ssr:false wrapper.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  Html,
  Instance,
  Instances,
  OrbitControls,
} from '@react-three/drei';
import * as THREE from 'three';

import type { LatLon, OLSResult } from '@/skygauge/api/ols/types';
import type { NearbyAppeal, NearbyNoc } from '@/skygauge/api/empirical/types';

import { buildOlsHeightfield, projectToScene, type OlsHeightfield } from './scene-geometry';
import {
  ALL_STYLES,
  buildUnitBuildings,
  buildingFootprintUnits,
  pickBuildingStyle,
  type BuildingStyle,
} from './building-geometry';
import { SURFACE_META } from './surface-meta';

interface SkygaugeSceneInnerProps {
  site: LatLon;
  result: OLSResult | null;
  elevationM?: number;
  radiusM?: number;
  nocs?: NearbyNoc[];
  appeals?: NearbyAppeal[];
  height?: string;
}

const SITE_FOOTPRINT_UNITS = 0.8;

const COLOR = {
  noc: '#10b981',
  nocRestricted: '#f43f5e',
  appeal: '#8b5cf6',
  site: '#f59e0b',
} as const;

interface Pillar {
  key: string;
  x: number;
  z: number;
  /** Height in scene units (ground 0 → apex). */
  height: number;
  /** Footprint half-width in scene units. */
  footprint: number;
  style: BuildingStyle;
  color: string;
  /** Display label for the hover tooltip. */
  label: string;
  /** Permitted top in metres AMSL (un-projected) — for the tooltip. */
  topAmsl: number;
}

interface StructureItem {
  id: string;
  lat: number | null;
  lon: number | null;
  top: number | null;
  color: string;
  label: string;
}

/** Project structures into the scene frame, clip to the footprint, drop null tops. */
function toPillars(
  items: StructureItem[],
  site: LatLon,
  groundAmsl: number,
  radiusM: number,
): Pillar[] {
  const out: Pillar[] = [];
  for (const it of items) {
    if (it.lat === null || it.lon === null || it.top === null) continue;
    const p = projectToScene(site, it.lat, it.lon, it.top, groundAmsl);
    if (p.distanceM > radiusM) continue;
    if (p.y <= 0.01) continue; // apex at or below the ground datum
    out.push({
      key: it.id,
      x: p.x,
      z: p.z,
      height: p.y,
      footprint: buildingFootprintUnits(it.id),
      style: pickBuildingStyle(it.id, it.top - groundAmsl),
      color: it.color,
      label: it.label,
      topAmsl: it.top,
    });
  }
  return out;
}

export default function SkygaugeSceneInner({
  site,
  result,
  elevationM,
  radiusM,
  nocs = [],
  appeals = [],
  height = '100%',
}: SkygaugeSceneInnerProps) {
  const groundAmsl = elevationM ?? 0;
  const hf = useMemo(
    () => buildOlsHeightfield(site, groundAmsl, radiusM),
    [site, groundAmsl, radiusM],
  );
  const effectiveRadius = hf.radiusM;

  const nocPillars = useMemo(
    () =>
      toPillars(
        nocs.map((n, i) => ({
          id: `noc-${n.noc_id ?? i}`,
          lat: n.lat,
          lon: n.lon,
          top: n.permissible_top_m,
          color: n.is_restricted ? COLOR.nocRestricted : COLOR.noc,
          label: n.is_restricted ? 'Restricted NOC' : 'Issued NOC',
        })),
        site,
        groundAmsl,
        effectiveRadius,
      ),
    [nocs, site, groundAmsl, effectiveRadius],
  );

  const appealPillars = useMemo(
    () =>
      toPillars(
        appeals.map((a, i) => ({
          id: `appeal-${a.noc_id ?? i}-${a.meeting_date ?? i}`,
          lat: a.lat,
          lon: a.lon,
          top: a.approved_top_m,
          color: COLOR.appeal,
          label: 'Appellate case',
        })),
        site,
        groundAmsl,
        effectiveRadius,
      ),
    [appeals, site, groundAmsl, effectiveRadius],
  );

  // One merged unit geometry per architectural style + a shared building material.
  const unitGeoms = useMemo(() => buildUnitBuildings(), []);
  const buildingMat = useMemo(
    () => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.72, metalness: 0.04 }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(unitGeoms).forEach((g) => g.dispose());
      buildingMat.dispose();
    },
    [unitGeoms, buildingMat],
  );

  const byStyle = useMemo(() => {
    const groups: Record<BuildingStyle, Pillar[]> = {
      flat: [],
      setback: [],
      taper: [],
      pitched: [],
      cylinder: [],
    };
    for (const p of [...nocPillars, ...appealPillars]) groups[p.style].push(p);
    return groups;
  }, [nocPillars, appealPillars]);

  const span = hf.spanUnits;
  const targetY = hf.siteCeilingY !== null ? hf.siteCeilingY * 0.5 : span * 0.15;
  const bindingColor = result?.binding ? SURFACE_META[result.binding.surface].color : '#64748b';

  // Hover state for the height tooltip. Either a real structure (Pillar) or
  // the user's own site massing (a synthetic Pillar-shaped record).
  const [hovered, setHovered] = useState<Pillar | null>(null);

  const handleEnter = useCallback((p: Pillar) => {
    setHovered(p);
    if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
  }, []);
  const handleLeave = useCallback(() => {
    setHovered(null);
    if (typeof document !== 'undefined') document.body.style.cursor = 'default';
  }, []);

  return (
    <div
      style={{ height }}
      className="relative bg-gradient-to-b from-sky-100 to-slate-200 dark:from-slate-900 dark:to-slate-950"
    >
      <Canvas camera={{ position: [span * 1.25, span * 0.95, span * 1.25], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[span, span * 2, span * 0.5]} intensity={1.25} />
        <directionalLight position={[-span, span, -span]} intensity={0.35} />

        <Grid
          args={[span * 4, span * 4]}
          cellSize={1}
          sectionSize={5}
          infiniteGrid
          fadeDistance={span * 4}
          fadeStrength={1.5}
          cellColor="#94a3b8"
          sectionColor="#64748b"
          position={[0, 0.005, 0]}
        />

        {hf.hasData && <CeilingMesh hf={hf} />}

        {/* Nearby structures (NOCs + appeals) as procedural buildings, instanced per style */}
        {ALL_STYLES.map((style) => {
          const list = byStyle[style];
          if (list.length === 0) return null;
          return (
            <Instances
              key={style}
              geometry={unitGeoms[style]}
              material={buildingMat}
              limit={list.length}
              range={list.length}
            >
              {list.map((p) => (
                <Instance
                  key={p.key}
                  position={[p.x, 0, p.z]}
                  scale={[p.footprint, p.height, p.footprint]}
                  color={p.color}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    handleEnter(p);
                  }}
                  onPointerOut={handleLeave}
                />
              ))}
            </Instances>
          );
        })}

        {/* Buildable massing at the site */}
        {hf.siteCeilingY !== null && hf.siteCeilingY > 0.01 && (
          <>
            <mesh
              position={[0, hf.siteCeilingY / 2, 0]}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (hf.siteCeilingAmsl === null) return;
                handleEnter({
                  key: 'site-massing',
                  x: 0,
                  z: 0,
                  height: hf.siteCeilingY ?? 0,
                  footprint: SITE_FOOTPRINT_UNITS,
                  style: 'flat',
                  color: COLOR.site,
                  label: 'Buildable site massing',
                  topAmsl: hf.siteCeilingAmsl,
                });
              }}
              onPointerOut={handleLeave}
            >
              <boxGeometry args={[SITE_FOOTPRINT_UNITS, hf.siteCeilingY, SITE_FOOTPRINT_UNITS]} />
              <meshStandardMaterial color={COLOR.site} transparent opacity={0.5} />
            </mesh>
            <Html position={[0, hf.siteCeilingY + span * 0.06, 0]} center distanceFactor={span * 2.4}>
              <div className="whitespace-nowrap rounded-md bg-slate-900/85 px-2 py-1 text-[11px] font-medium text-white shadow-lg">
                site · {hf.siteCeilingAmsl !== null ? `${hf.siteCeilingAmsl.toFixed(0)} m AMSL` : '—'}
              </div>
            </Html>
          </>
        )}

        {/* Hover tooltip — anchored at the hovered structure's apex */}
        {hovered && (
          <Html
            position={[hovered.x, hovered.height + span * 0.04, hovered.z]}
            center
            distanceFactor={span * 2.4}
            zIndexRange={[100, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded-md bg-slate-900/90 px-2.5 py-1.5 text-[11px] text-white shadow-lg">
              <div className="font-semibold">{hovered.label}</div>
              <div>{hovered.topAmsl.toFixed(1)} m AMSL</div>
              <div className="text-white/70">
                ~{Math.max(0, hovered.topAmsl - groundAmsl).toFixed(0)} m above ground
              </div>
            </div>
          </Html>
        )}

        {/* Site ground marker */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[SITE_FOOTPRINT_UNITS * 0.7, 24]} />
          <meshBasicMaterial color={bindingColor} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>

        <OrbitControls
          target={[0, targetY, 0]}
          enableDamping
          minDistance={4}
          maxDistance={span * 5}
          maxPolarAngle={Math.PI / 2.05}
        />
        <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
          <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
        </GizmoHelper>
      </Canvas>

      {!hf.hasData && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg bg-card/90 px-4 py-2 text-sm text-muted-foreground shadow">
            No OLS constraint here — nothing to visualise in 3D.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 space-y-1.5 rounded-md bg-card/90 px-3 py-2 text-[11px] shadow backdrop-blur-sm">
        <div>
          <div className="mb-1 font-semibold text-foreground">
            Structures{' '}
            <span className="font-normal text-muted-foreground">
              ({nocPillars.length} NOCs · {appealPillars.length} appeals)
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <LegendDot color={COLOR.noc} label="Issued NOC" />
            <LegendDot color={COLOR.nocRestricted} label="Restricted" />
            <LegendDot color={COLOR.appeal} label="Appeal" />
            <LegendDot color={COLOR.site} label="Your site" />
          </div>
        </div>
        <div className="border-t pt-1">
          <div className="mb-1 font-semibold text-foreground">OLS ceiling · binding surface</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {Object.entries(SURFACE_META).map(([kind, meta]) => (
              <LegendDot key={kind} color={meta.color} label={meta.label} />
            ))}
          </div>
        </div>
        <div className="text-muted-foreground">
          Building heights = approved top · vertical exaggeration ×4
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2 rounded-sm" style={{ background: color }} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function CeilingMesh({ hf }: { hf: OlsHeightfield }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(hf.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(hf.colors, 3));
    g.setIndex(new THREE.BufferAttribute(hf.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [hf]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={0.78}
        side={THREE.DoubleSide}
        metalness={0.05}
        roughness={0.85}
      />
    </mesh>
  );
}
