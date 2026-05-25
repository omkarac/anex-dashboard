'use client';

/**
 * Skygauge result panel.
 *
 * Renders the binding OLS constraint at the selected site (theoretical layer):
 * most restrictive surface, max permissible top AMSL, AGL headroom, and the next
 * few surfaces. Alongside it shows the empirical band — what AAI is actually
 * approving nearby — and the theoretical-vs-empirical delta, the actionable
 * insight. Elevation is a manual input in v1 (Bhuvan SRTM DEM is a v2 follow-up).
 */

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { LatLon, OLSResult, SurfaceHit } from '@/skygauge/api/ols/types';
import type { EmpiricalBand } from '@/skygauge/api/empirical/types';

import { SURFACE_META } from './surface-meta';

export type EmpiricalStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EmpiricalPanelData {
  status: EmpiricalStatus;
  band: EmpiricalBand | null;
  radiusM: number;
  onRadiusChange: (radiusM: number) => void;
}

interface SkygaugeResultPanelProps {
  site: LatLon | null;
  label?: string;
  result: OLSResult | null;
  /** Raw elevation field value (string, so the input can be cleared). */
  elevationStr: string;
  onElevationChange: (value: string) => void;
  empirical: EmpiricalPanelData;
  className?: string;
}

const PANEL_SHELL =
  'flex max-h-full flex-col overflow-y-auto rounded-xl border bg-card/95 shadow-lg backdrop-blur-sm';

const RADIUS_OPTIONS = [500, 1000, 2000] as const;

function fmtCoords({ lat, lon }: LatLon): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function fmtRadius(m: number): string {
  return m >= 1000 ? `${m / 1000} km` : `${m} m`;
}

function fmtMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** Describe which runway end / airport a hit belongs to. */
function hitContext(hit: SurfaceHit): string {
  const parts = [hit.airport_code];
  if (hit.runway_designator) parts.push(`RWY ${hit.runway_designator}`);
  if (hit.threshold_name) parts.push(`thr ${hit.threshold_name}`);
  return parts.join(' · ');
}

export function SkygaugeResultPanel({
  site,
  label,
  result,
  elevationStr,
  onElevationChange,
  empirical,
  className,
}: SkygaugeResultPanelProps) {
  // ── Empty state ───────────────────────────────────────────────────────────
  if (!site || !result) {
    return (
      <aside className={cn(PANEL_SHELL, className)}>
        <div className="p-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Height permissibility
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Search a locality or click anywhere on the map to compare the theoretical
            OLS ceiling against what AAI is actually approving nearby.
          </p>
        </div>
      </aside>
    );
  }

  const { binding } = result;

  // ── Unconstrained (outside every airport's outer-horizontal footprint) ─────
  if (!binding || result.max_top_amsl_m === null) {
    return (
      <aside className={cn(PANEL_SHELL, className)}>
        <div className="space-y-3 p-4">
          <SiteHeading label={label} site={site} />
          <div className="rounded-lg border border-dashed bg-muted/40 p-3">
            <p className="text-sm font-medium text-foreground">No OLS constraint</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              This point falls outside every MMR airport&rsquo;s obstacle limitation
              surfaces. Standard local building-height limits apply instead.
            </p>
          </div>
          <EmpiricalBlock empirical={empirical} />
        </div>
      </aside>
    );
  }

  const bindingMeta = SURFACE_META[binding.surface];
  const others = result.all_hits.slice(1, 5); // next 3–4 most restrictive
  const aglKnown = result.max_height_agl_m !== undefined;

  return (
    <aside className={cn(PANEL_SHELL, className)}>
      {/* Accent bar — colour-coded to the binding surface */}
      <div className="h-1 shrink-0 rounded-t-xl" style={{ background: bindingMeta.color }} />

      <div className="space-y-4 p-4">
        <SiteHeading label={label} site={site} />

        {/* Headline metric — theoretical max permissible top, AMSL */}
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {result.max_top_amsl_m.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-muted-foreground">m AMSL</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Theoretical max top (OLS ceiling)
          </p>
        </div>

        {/* Binding surface */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Binding surface
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: `${bindingMeta.color}1a`, color: bindingMeta.color }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: bindingMeta.color }}
                aria-hidden
              />
              {bindingMeta.label}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-foreground">{hitContext(binding)}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {bindingMeta.blurb}
          </p>
        </div>

        {/* Empirical comparison — the actionable insight */}
        <EmpiricalBlock empirical={empirical} />

        {/* Elevation + AGL headroom */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="skygauge-elevation"
              className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Site elevation
            </label>
            <div className="mt-1 flex items-center gap-1">
              <Input
                id="skygauge-elevation"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={elevationStr}
                onChange={(e) => onElevationChange(e.target.value)}
                placeholder="—"
                className="h-8 font-mono tabular-nums"
              />
              <span className="text-xs text-muted-foreground">m</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              AGL headroom
            </span>
            <div className="mt-1 flex h-8 items-baseline gap-1">
              {aglKnown ? (
                <>
                  <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                    {result.max_height_agl_m!.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">m</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Enter elevation</span>
              )}
            </div>
          </div>
        </div>

        {/* Next most restrictive surfaces */}
        {others.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Next most restrictive
            </h3>
            <ul className="space-y-1">
              {others.map((hit, i) => {
                const meta = SURFACE_META[hit.surface];
                const delta = hit.max_top_amsl_m - binding.max_top_amsl_m;
                return (
                  <li
                    key={`${hit.surface}-${hit.airport_code}-${hit.runway_designator ?? ''}-${hit.threshold_name ?? ''}-${i}`}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-muted/50"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: meta.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-foreground">{meta.label}</span>
                      <span className="text-muted-foreground"> · {hitContext(hit)}</span>
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                      {hit.max_top_amsl_m.toFixed(0)} m
                    </span>
                    <span className="w-12 shrink-0 text-right font-mono tabular-nums text-[11px] text-emerald-600 dark:text-emerald-400">
                      +{delta.toFixed(0)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Empirical block ──────────────────────────────────────────────────────────

function EmpiricalBlock({ empirical }: { empirical: EmpiricalPanelData }) {
  const { status, band, radiusM, onRadiusChange } = empirical;

  return (
    <div className="rounded-lg border border-sky-200/70 bg-sky-50/50 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Empirical · nearby NOCs
        </span>
        <div className="flex items-center gap-0.5 rounded-md bg-background/60 p-0.5">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRadiusChange(r)}
              aria-pressed={r === radiusM}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-colors',
                r === radiusM
                  ? 'bg-sky-600 text-white'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {fmtRadius(r)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2">
        {status === 'loading' && (
          <p className="text-xs text-muted-foreground">Checking the neighborhood…</p>
        )}
        {status === 'error' && (
          <p className="text-xs text-muted-foreground">
            Couldn&rsquo;t load nearby NOCs. The data layer may not be live yet.
          </p>
        )}
        {status === 'idle' && (
          <p className="text-xs text-muted-foreground">Select a site to compare.</p>
        )}
        {status === 'ready' && band && <EmpiricalBody band={band} radiusM={radiusM} />}
      </div>
    </div>
  );
}

function EmpiricalBody({ band, radiusM }: { band: EmpiricalBand; radiusM: number }) {
  if (band.sampleCount === 0 || band.median === null) {
    return (
      <p className="text-xs text-muted-foreground">
        No issued NOCs within {fmtRadius(radiusM)} of this point.
      </p>
    );
  }

  const basisLabel = band.medianBasis === 'recent_5y' ? 'last 5 yrs' : 'all-time';
  const mostRecent = fmtMonthYear(band.mostRecentIssue);
  const restrictedPct =
    band.restrictedShare !== null ? Math.round(band.restrictedShare * 100) : null;

  return (
    <div className="space-y-2">
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {band.median.toFixed(1)}
          </span>
          <span className="text-xs font-medium text-muted-foreground">m AMSL median</span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {band.sampleCount} NOC{band.sampleCount === 1 ? '' : 's'} within {fmtRadius(radiusM)} · {basisLabel}
          {band.min !== null && band.max !== null && (
            <> · range {band.min.toFixed(0)}–{band.max.toFixed(0)} m</>
          )}
        </p>
      </div>

      <DeltaCallout deltaM={band.deltaM} />

      {(restrictedPct !== null || mostRecent || band.appealCount > 0) && (
        <p className="text-[11px] text-muted-foreground">
          {restrictedPct !== null && <>{restrictedPct}% restricted</>}
          {mostRecent && <> · latest {mostRecent}</>}
          {band.appealCount > 0 && (
            <> · {band.appealCount} appeal{band.appealCount === 1 ? '' : 's'} ≤1 km</>
          )}
        </p>
      )}
    </div>
  );
}

function DeltaCallout({ deltaM }: { deltaM: number | null }) {
  if (deltaM === null) return null;

  const rounded = Math.round(deltaM);
  // Within ±2 m: treat as in line with the theoretical ceiling.
  if (Math.abs(deltaM) < 2) {
    return (
      <p className="rounded-md bg-muted/60 px-2 py-1 text-[11px] font-medium text-foreground">
        Nearby approvals are in line with the OLS ceiling.
      </p>
    );
  }

  const below = deltaM < 0;
  return (
    <p
      className={cn(
        'rounded-md px-2 py-1 text-[11px] font-medium',
        below
          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
          : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
      )}
    >
      Nearby approvals run{' '}
      <span className="font-mono tabular-nums">{Math.abs(rounded)} m</span>{' '}
      {below ? 'below' : 'above'} the OLS ceiling
      {below
        ? ' — instrument or procedural limits likely cap real heights lower.'
        : ' — case-by-case relief has been granted above the geometric surface.'}
    </p>
  );
}

function SiteHeading({ label, site }: { label?: string; site: LatLon }) {
  return (
    <div>
      {label ? (
        <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
          {label}
        </h2>
      ) : (
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Selected site
        </h2>
      )}
      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{fmtCoords(site)}</p>
    </div>
  );
}
