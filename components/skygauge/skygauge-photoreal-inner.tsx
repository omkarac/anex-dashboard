'use client';

/**
 * Skygauge Photoreal scene (inner) — Phase 2.
 *
 * Google Photorealistic 3D Tiles (the real Google Earth city mesh) re-centred on
 * the site via ReorientationPlugin, with our OLS-ceiling surface + nearby
 * NOC/appeal buildings + the site massing overlaid in the SAME real-world ENU
 * frame (1 unit = 1 m, no exaggeration) so the constraint sits on the real city.
 *
 * Alignment knobs (if a visual check shows a mismatch):
 *   • NORTH_SIGN — flip if N/S is mirrored vs the tiles.
 *   • groundAmsl — set via the site-elevation input if the overlay floats above
 *     or sinks below the real terrain.
 * Loaded only via the ssr:false wrapper.
 */

import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { TilesPlugin, TilesRenderer, TilesAttributionOverlay } from '3d-tiles-renderer/r3f';
import { GoogleCloudAuthPlugin, ReorientationPlugin } from '3d-tiles-renderer/plugins';
import * as THREE from 'three';

import type { LatLon } from '@/skygauge/api/ols/types';
import type { NearbyAppeal, NearbyNoc } from '@/skygauge/api/empirical/types';

import {
  buildOlsHeightfield,
  projectToScene,
  REAL_FRAME,
  type OlsHeightfield,
} from './scene-geometry';
import {
  ALL_STYLES,
  buildUnitBuildings,
  buildingFootprintMeters,
  pickBuildingStyle,
  type BuildingStyle,
} from './building-geometry';

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
// Set the root URL explicitly so the renderer has the correct base from frame 1
// (the GoogleCloudAuthPlugin only sets it if null, which can race the first load).
const GOOGLE_3D_TILES_ROOT = 'https://tile.googleapis.com/v1/3dtiles/root.json';
const DEG2RAD = Math.PI / 180;
const DEFAULT_RADIUS_M = 1200;
const MIN_BUILDING_M = 3; // floor so low/below-datum permits stay visible + hoverable
const NORTH_SIGN = 1; // flip to -1 if the overlay is mirrored N/S against the tiles

// Google Elevation returns orthometric height (AMSL, above the geoid), but the
// 3D Tiles ellipsoid frame expects height above the WGS84 ellipsoid. Across the
// MMR the geoid sits ~60 m BELOW the ellipsoid (Indian Ocean geoid low), so we
// add the undulation to convert AMSL → ellipsoidal and seat the overlay on the
// real terrain. Tune if structures still float (more negative) or sink (less).
const GEOID_UNDULATION_M = -60;

const COLOR = {
  noc: '#10b981',
  nocRestricted: '#f43f5e',
  appeal: '#8b5cf6',
  site: '#f59e0b',
} as const;

interface SkygaugePhotorealInnerProps {
  site: LatLon;
  elevationM?: number;
  radiusM?: number;
  nocs?: NearbyNoc[];
  appeals?: NearbyAppeal[];
  height?: string;
}

interface Pillar {
  key: string;
  x: number;
  z: number;
  height: number;
  footprint: number;
  style: BuildingStyle;
  color: string;
  /** Permitted/approved top, m AMSL (for the hover tooltip). */
  topAmsl: number;
  kind: string;
}

interface StructureItem {
  id: string;
  lat: number | null;
  lon: number | null;
  top: number | null;
  color: string;
  kind: string;
}

/** Real-world-scale pillars (metres), aligned to the re-centred tiles. */
function toRealPillars(
  items: StructureItem[],
  site: LatLon,
  groundAmsl: number,
  radiusM: number,
): Pillar[] {
  const out: Pillar[] = [];
  for (const it of items) {
    if (it.lat === null || it.lon === null || it.top === null) continue;
    const p = projectToScene(site, it.lat, it.lon, it.top, groundAmsl, REAL_FRAME);
    if (p.distanceM > radiusM) continue;
    out.push({
      key: it.id,
      x: p.x,
      z: p.z * NORTH_SIGN,
      height: Math.max(p.y, MIN_BUILDING_M),
      footprint: buildingFootprintMeters(it.id),
      style: pickBuildingStyle(it.id, it.top - groundAmsl),
      color: it.color,
      topAmsl: it.top,
      kind: it.kind,
    });
  }
  return out;
}

export default function SkygaugePhotorealInner({
  site,
  elevationM,
  radiusM = DEFAULT_RADIUS_M,
  nocs = [],
  appeals = [],
  height = '100%',
}: SkygaugePhotorealInnerProps) {
  const groundAmsl = elevationM ?? 0;
  const [hovered, setHovered] = useState<Pillar | null>(null);

  const hf = useMemo(
    () => buildOlsHeightfield(site, groundAmsl, radiusM, REAL_FRAME),
    [site, groundAmsl, radiusM],
  );

  const pillars = useMemo(() => {
    const nocItems: StructureItem[] = nocs.map((n, i) => ({
      id: `noc-${n.noc_id ?? i}`,
      lat: n.lat,
      lon: n.lon,
      top: n.permissible_top_m,
      color: n.is_restricted ? COLOR.nocRestricted : COLOR.noc,
      kind: n.is_restricted ? 'Restricted NOC' : 'Issued NOC',
    }));
    const appealItems: StructureItem[] = appeals.map((a, i) => ({
      id: `appeal-${a.noc_id ?? i}-${a.meeting_date ?? i}`,
      lat: a.lat,
      lon: a.lon,
      top: a.approved_top_m,
      color: COLOR.appeal,
      kind: 'Appellate case',
    }));
    return toRealPillars([...nocItems, ...appealItems], site, groundAmsl, radiusM);
  }, [nocs, appeals, site, groundAmsl, radiusM]);

  const byStyle = useMemo(() => {
    const groups: Record<BuildingStyle, Pillar[]> = {
      flat: [],
      setback: [],
      taper: [],
      pitched: [],
      cylinder: [],
    };
    for (const p of pillars) groups[p.style].push(p);
    return groups;
  }, [pillars]);

  const unitGeoms = useMemo(() => buildUnitBuildings(), []);
  useEffect(
    () => () => {
      Object.values(unitGeoms).forEach((g) => g.dispose());
    },
    [unitGeoms],
  );

  if (!GOOGLE_KEY) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-muted/30 px-6 text-center"
      >
        <p className="max-w-sm text-sm text-muted-foreground">
          Photoreal view needs a Google key with the{' '}
          <span className="font-medium">Map Tiles API</span> enabled (+ billing). Set{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>.
        </p>
      </div>
    );
  }

  const siteCeilingY = hf.siteCeilingY ?? 0;
  const orbitTarget: [number, number, number] = [0, Math.max(siteCeilingY * 0.5, 40), 0];

  return (
    <div style={{ height }} className="relative bg-slate-200 dark:bg-slate-900">
      <Canvas camera={{ position: [600, 450, 600], near: 1, far: 4_000_000, fov: 55 }} dpr={[1, 2]}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[800, 1600, 600]} intensity={1.1} />

        <TilesRenderer url={GOOGLE_3D_TILES_ROOT}>
          <TilesPlugin
            plugin={GoogleCloudAuthPlugin}
            args={[{ apiToken: GOOGLE_KEY, autoRefreshToken: true }]}
          />
          <TilesPlugin
            plugin={ReorientationPlugin}
            args={[
              {
                up: '+y',
                recenter: true,
                lat: site.lat * DEG2RAD,
                lon: site.lon * DEG2RAD,
                // AMSL → ellipsoidal so the origin (overlay base) lands on terrain.
                height: groundAmsl + GEOID_UNDULATION_M,
              },
            ]}
          />
          <TilesAttributionOverlay />
        </TilesRenderer>

        {/* OLS ceiling surface — translucent so the real city shows through */}
        {hf.hasData && <CeilingMesh hf={hf} northSign={NORTH_SIGN} />}

        {/* Nearby structures as buildings, grouped by style; hover for height */}
        {ALL_STYLES.map((style) => {
          const list = byStyle[style];
          if (list.length === 0) return null;
          return (
            <BuildingGroup key={style} unit={unitGeoms[style]} list={list} onHover={setHovered} />
          );
        })}

        {hovered && (
          <Html
            position={[hovered.x, hovered.height + 6, hovered.z]}
            center
            zIndexRange={[100, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[11px] text-white shadow-lg">
              <div className="font-semibold">{hovered.kind}</div>
              <div>Permitted top: {hovered.topAmsl.toFixed(0)} m AMSL</div>
              <div className="text-white/70">≈ {hovered.height.toFixed(0)} m above site datum</div>
            </div>
          </Html>
        )}

        {/* Site buildable massing */}
        {siteCeilingY > 0.5 && (
          <mesh position={[0, siteCeilingY / 2, 0]}>
            <boxGeometry args={[34, siteCeilingY, 34]} />
            <meshStandardMaterial color={COLOR.site} transparent opacity={0.5} />
          </mesh>
        )}

        <OrbitControls target={orbitTarget} enableDamping minDistance={60} maxDistance={3500} maxPolarAngle={Math.PI / 2.02} />
      </Canvas>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 space-y-1 rounded-md bg-card/90 px-3 py-2 text-[11px] shadow backdrop-blur-sm">
        <div className="font-semibold text-foreground">
          Photoreal · real-world scale{' '}
          <span className="font-normal text-muted-foreground">({pillars.length} structures)</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <LegendDot color={COLOR.noc} label="Issued NOC" />
          <LegendDot color={COLOR.nocRestricted} label="Restricted" />
          <LegendDot color={COLOR.appeal} label="Appeal" />
          <LegendDot color={COLOR.site} label="Your site" />
        </div>
        <div className="text-muted-foreground">Hover a building for its permitted height · imagery © Google</div>
      </div>
    </div>
  );
}

function BuildingGroup({
  unit,
  list,
  onHover,
}: {
  unit: THREE.BufferGeometry;
  list: Pillar[];
  onHover: (p: Pillar | null) => void;
}) {
  // Plain per-structure meshes sharing one geometry, each with its own colour
  // material + pointer handlers for the height tooltip.
  return (
    <group>
      {list.map((p) => (
        <mesh
          key={p.key}
          geometry={unit}
          position={[p.x, 0, p.z]}
          scale={[p.footprint, p.height, p.footprint]}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(p);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            onHover(null);
            document.body.style.cursor = 'default';
          }}
        >
          <meshStandardMaterial color={p.color} flatShading roughness={0.7} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

function CeilingMesh({ hf, northSign }: { hf: OlsHeightfield; northSign: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos =
      northSign === 1 ? hf.positions : flipZ(hf.positions);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(hf.colors, 3));
    g.setIndex(new THREE.BufferAttribute(hf.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [hf, northSign]);

  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={0.45}
        side={THREE.DoubleSide}
        depthWrite={false}
        metalness={0.05}
        roughness={0.9}
      />
    </mesh>
  );
}

function flipZ(src: Float32Array): Float32Array {
  const out = Float32Array.from(src);
  for (let i = 2; i < out.length; i += 3) out[i] = -out[i];
  return out;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2 rounded-sm" style={{ background: color }} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
