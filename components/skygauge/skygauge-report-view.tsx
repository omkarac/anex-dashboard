'use client';

/**
 * Skygauge printable site report.
 *
 * A self-contained, browser-printable analysis for a single site: the
 * theoretical OLS ceiling, the empirical band from nearby NOCs, appellate
 * cases, and the per-NOC distance/permit list. Built as a server-rendered
 * page (`/skygauge/report?lat=&lon=&…`) opened in a new tab from the
 * workspace. The "Print / save as PDF" button triggers `window.print()`;
 * `@media print` rules (Tailwind `print:` modifier) hide the toolbar and
 * the dashboard chrome and lay the content out for paper.
 */

import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LatLon, OLSResult, SurfaceHit } from '@/skygauge/api/ols/types';
import type {
  EmpiricalBand,
  NearbyAppeal,
  NearbyNoc,
} from '@/skygauge/api/empirical/types';

import { SURFACE_META } from './surface-meta';

interface SkygaugeReportViewProps {
  site: LatLon;
  label?: string;
  groundAmsl?: number;
  radiusM: number;
  result: OLSResult;
  band: EmpiricalBand | null;
  nocs: NearbyNoc[];
  appeals: NearbyAppeal[];
}

const TODAY = new Date();

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMonthYear(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function fmtMeters(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)} m`;
}

function fmtDistance(m: number): string {
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function fmtRadius(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} km` : `${m} m`;
}

function hitContext(hit: SurfaceHit): string {
  const parts = [hit.airport_code];
  if (hit.runway_designator) parts.push(`RWY ${hit.runway_designator}`);
  if (hit.threshold_name) parts.push(`thr ${hit.threshold_name}`);
  return parts.join(' · ');
}

function deltaDescriptor(band: EmpiricalBand): { label: string; tone: 'above' | 'below' | 'level' } {
  if (band.deltaM === null) return { label: 'no comparison available', tone: 'level' };
  const abs = Math.abs(band.deltaM);
  if (abs < 2) return { label: 'tracking the OLS ceiling', tone: 'level' };
  if (band.deltaM < 0) {
    return {
      label: `approvals running ~${abs.toFixed(0)} m below the OLS ceiling`,
      tone: 'below',
    };
  }
  return {
    label: `appellate relief running ~${abs.toFixed(0)} m above the OLS ceiling`,
    tone: 'above',
  };
}

export function SkygaugeReportView({
  site,
  label,
  groundAmsl,
  radiusM,
  result,
  band,
  nocs,
  appeals,
}: SkygaugeReportViewProps) {
  const binding = result.binding;
  const aglHeadroom = result.max_height_agl_m;
  const generated = TODAY.toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <div
      className={cn(
        // Full-bleed page on screen and on paper. `print:fixed inset-0 z-50`
        // covers the dashboard chrome when printing so the user gets a clean
        // page without us having to modify the route layout.
        'min-h-full overflow-y-auto bg-muted/30 print:fixed print:inset-0 print:z-50 print:overflow-visible print:bg-white print:text-black',
      )}
    >
      <div className="mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-0">
        {/* ── Toolbar (screen only) ─────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <a
            href="/skygauge"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back to Skygauge
          </a>
          <Button size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="size-3.5" aria-hidden />
            Print / save as PDF
          </Button>
        </div>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <header className="mb-6 rounded-lg border bg-card p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Anex Skygauge · Pre-NOCAS Site Analysis
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground print:text-black">
                {label ?? 'Site analysis'}
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {site.lat.toFixed(5)}°, {site.lon.toFixed(5)}°
              </p>
            </div>
            <div className="text-right text-[10px] text-muted-foreground">
              <p>Generated</p>
              <p className="mt-0.5 font-medium text-foreground print:text-black">{generated}</p>
            </div>
          </div>
        </header>

        {/* ── Site context ───────────────────────────────────────────────── */}
        <section className="mb-5 rounded-lg border bg-card p-5 print:break-inside-avoid print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Site
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <Row k="Coordinates" v={`${site.lat.toFixed(5)}°, ${site.lon.toFixed(5)}°`} />
            <Row k="Ground elevation" v={fmtMeters(groundAmsl)} suffix=" AMSL" />
            <Row k="Search radius" v={fmtRadius(radiusM)} />
            <Row k="Region" v="Mumbai Metropolitan Region" />
          </dl>
        </section>

        {/* ── Theoretical OLS ───────────────────────────────────────────── */}
        <section className="mb-5 rounded-lg border bg-card p-5 print:break-inside-avoid print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Theoretical OLS Ceiling
            <span className="ml-2 font-normal text-muted-foreground">
              (ICAO Annex 14, all MMR airports)
            </span>
          </h2>

          {binding === null ? (
            <p className="text-sm text-muted-foreground">
              No OLS surface constrains this point — the site sits outside every airport&apos;s
              footprint. NOC isn&apos;t required from a surface-protection standpoint, but other
              regulations (DGCA, local planning) still apply.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <Row
                  k="Binding surface"
                  v={
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block size-2 rounded-sm"
                        style={{ background: SURFACE_META[binding.surface].color }}
                        aria-hidden
                      />
                      <span className="font-medium text-foreground print:text-black">
                        {SURFACE_META[binding.surface].label}
                      </span>
                    </span>
                  }
                />
                <Row k="Reference" v={hitContext(binding)} />
                <Row
                  k="Max permissible top"
                  v={fmtMeters(result.max_top_amsl_m)}
                  suffix=" AMSL"
                />
                <Row k="AGL headroom" v={fmtMeters(aglHeadroom, 1)} />
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                {SURFACE_META[binding.surface].blurb}.
              </p>

              {result.all_hits.length > 1 && (
                <>
                  <h3 className="mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Other surfaces overhead
                  </h3>
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium">Surface</th>
                        <th className="text-left font-medium">Reference</th>
                        <th className="text-right font-medium">Max top</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {result.all_hits.slice(1).map((hit, idx) => (
                        <tr key={`${hit.surface}-${hit.airport_code}-${idx}`}>
                          <td className="py-1">{SURFACE_META[hit.surface].label}</td>
                          <td className="py-1 text-muted-foreground">{hitContext(hit)}</td>
                          <td className="py-1 text-right font-mono">
                            {fmtMeters(hit.max_top_amsl_m)} AMSL
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </section>

        {/* ── Empirical band ─────────────────────────────────────────────── */}
        <section className="mb-5 rounded-lg border bg-card p-5 print:break-inside-avoid print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Empirical Band
            <span className="ml-2 font-normal text-muted-foreground">
              (real AAI approvals within {fmtRadius(radiusM)})
            </span>
          </h2>

          {band === null || band.sampleCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              No issued NOCs in this radius. Try widening the search on the workspace.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <Row k="Sample size" v={`${band.sampleCount} NOC${band.sampleCount === 1 ? '' : 's'}`} />
                <Row
                  k="Median permissible top"
                  v={fmtMeters(band.median)}
                  suffix={
                    band.medianBasis === 'recent_5y'
                      ? ' AMSL (last 5y)'
                      : ' AMSL (all-time)'
                  }
                />
                <Row
                  k="Range"
                  v={`${fmtMeters(band.min)} – ${fmtMeters(band.max)} AMSL`}
                />
                <Row
                  k="Restricted share"
                  v={
                    band.restrictedShare === null
                      ? '—'
                      : `${(band.restrictedShare * 100).toFixed(0)}%`
                  }
                />
                <Row k="Most recent issue" v={fmtMonthYear(band.mostRecentIssue)} />
                <Row k="Nearby appellate cases" v={`${band.appealCount}`} />
              </dl>

              {band.deltaM !== null && band.theoreticalAmsl !== null && (
                <div
                  className={cn(
                    'mt-4 rounded-md border-l-4 bg-muted/40 px-3 py-2 text-sm print:bg-transparent print:border-l',
                    deltaDescriptor(band).tone === 'below'
                      ? 'border-emerald-500 text-emerald-900 dark:text-emerald-100 print:text-emerald-900'
                      : deltaDescriptor(band).tone === 'above'
                        ? 'border-amber-500 text-amber-900 dark:text-amber-100 print:text-amber-900'
                        : 'border-slate-400 text-slate-900 dark:text-slate-100 print:text-slate-900',
                  )}
                >
                  <p className="font-medium">
                    Δ Empirical vs Theoretical: {band.deltaM > 0 ? '+' : ''}
                    {band.deltaM.toFixed(0)} m
                  </p>
                  <p className="mt-0.5 text-xs opacity-90">
                    {deltaDescriptor(band).label}.
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Appellate cases ────────────────────────────────────────────── */}
        {appeals.length > 0 && (
          <section className="mb-5 rounded-lg border bg-card p-5 print:break-inside-avoid print:rounded-none print:border-0 print:p-0 print:shadow-none">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Appellate Cases ({appeals.length})
              <span className="ml-2 font-normal text-muted-foreground">
                AAI Appellate Committee decisions — overrides to standard OLS
              </span>
            </h2>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1.5 text-left font-medium">Meeting</th>
                  <th className="py-1.5 text-left font-medium">NOC ID</th>
                  <th className="py-1.5 text-right font-medium">Approved Top</th>
                  <th className="py-1.5 text-right font-medium">Distance</th>
                  <th className="py-1.5 text-right font-medium print:hidden">Minutes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {appeals.map((a, idx) => (
                  <tr key={`${a.noc_id ?? 'appeal'}-${a.meeting_date ?? idx}-${idx}`}>
                    <td className="py-1">{fmtDate(a.meeting_date)}</td>
                    <td className="py-1 font-mono">{a.noc_id ?? '—'}</td>
                    <td className="py-1 text-right font-mono">
                      {a.approved_top_m === null ? '—' : `${a.approved_top_m.toFixed(1)} m AMSL`}
                    </td>
                    <td className="py-1 text-right font-mono">{fmtDistance(a.distance_m)}</td>
                    <td className="py-1 text-right print:hidden">
                      {a.pdf_url ? (
                        <a
                          href={a.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          PDF
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Nearby NOCs ───────────────────────────────────────────────── */}
        <section className="mb-5 rounded-lg border bg-card p-5 print:break-inside-avoid print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Nearby NOCs ({nocs.length})
            <span className="ml-2 font-normal text-muted-foreground">
              sorted by distance
            </span>
          </h2>
          {nocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issued NOCs in this radius.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1.5 text-left font-medium">NOC ID</th>
                  <th className="py-1.5 text-right font-medium">Permissible Top</th>
                  <th className="py-1.5 text-right font-medium">Distance</th>
                  <th className="py-1.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {nocs.slice(0, 50).map((n, idx) => (
                  <tr key={`${n.noc_id ?? 'noc'}-${idx}`}>
                    <td className="py-1 font-mono">{n.noc_id ?? '—'}</td>
                    <td className="py-1 text-right font-mono">
                      {n.permissible_top_m === null
                        ? '—'
                        : `${n.permissible_top_m.toFixed(1)} m AMSL`}
                    </td>
                    <td className="py-1 text-right font-mono">{fmtDistance(n.distance_m)}</td>
                    <td className="py-1">
                      {n.is_restricted ? (
                        <span className="text-rose-700 dark:text-rose-300 print:text-rose-700">
                          Restricted
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-300 print:text-emerald-700">
                          Issued
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {nocs.length > 50 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Showing the 50 closest of {nocs.length} matched NOCs.
            </p>
          )}
        </section>

        {/* ── Disclaimer ────────────────────────────────────────────────── */}
        <footer className="rounded-md border border-dashed bg-muted/30 p-4 text-[11px] leading-relaxed text-muted-foreground print:break-inside-avoid print:rounded-none print:border-0 print:bg-transparent print:p-0">
          <p className="font-semibold text-foreground print:text-black">Indicative only</p>
          <p className="mt-0.5">
            This report is a pre-NOCAS estimate built from public ICAO Annex 14 OLS geometry and
            AAI&apos;s published NOC records. It is not a substitute for formal sanction by AAI
            through NOCAS. Actual approval may differ based on aeronautical study, restricted
            conditions, or appellate-committee deviations.
          </p>
          <p className="mt-1.5">
            © Anex Advisory · Skygauge · {TODAY.getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  suffix,
}: {
  k: string;
  v: React.ReactNode;
  suffix?: string;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-foreground print:text-black">
        {v}
        {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
      </dd>
    </>
  );
}
