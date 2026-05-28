import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/rbac';
import { computeOLSLimit } from '@/skygauge/api/ols/engine';
import { buildEmpiricalBand } from '@/skygauge/api/empirical/band';
import { getNearbyAppeals, getNearbyNocs, getNeighborhoodStats } from '@/lib/queries/skygauge';

import { SkygaugeReportView } from '@/components/skygauge/skygauge-report-view';

export const metadata: Metadata = {
  title: 'Skygauge — Site Report',
  description: 'Printable Skygauge analysis for a selected site.',
};

export const dynamic = 'force-dynamic';

const QUERY_HELP =
  'Open this page with ?lat=…&lon=…&elev=…&radius=… to render a report. ' +
  'Use the "Open report" button on the Skygauge workspace to pre-fill the URL.';

interface ReportSearchParams {
  lat?: string;
  lon?: string;
  elev?: string;
  radius?: string;
  label?: string;
}

function parseNumber(value: string | undefined, opts: { min: number; max: number }): number | null {
  if (value === undefined) return null;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return null;
  if (n < opts.min || n > opts.max) return null;
  return n;
}

export default async function SkygaugeReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  // Match the main /skygauge page's gating — same admin-only audience.
  await requireAdmin();

  const params = await searchParams;
  const lat = parseNumber(params.lat, { min: -90, max: 90 });
  const lon = parseNumber(params.lon, { min: -180, max: 180 });
  const elev = parseNumber(params.elev ?? undefined, { min: -500, max: 9000 }) ?? undefined;
  const radius = parseNumber(params.radius ?? undefined, { min: 100, max: 5000 }) ?? 1000;
  const label = params.label ?? undefined;

  if (lat === null || lon === null) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-8">
        <div className="max-w-md space-y-2 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Missing site coordinates</p>
          <p>{QUERY_HELP}</p>
        </div>
      </div>
    );
  }

  // Run the engine + empirical layer for this site at request time. All three
  // RPCs in parallel — they're independent spatial reads against the same
  // (lat, lon, radius).
  const olsResult = computeOLSLimit({ lat, lon, elevation_m: elev });
  const [stats, nocs, appeals] = await Promise.all([
    getNeighborhoodStats(lat, lon, radius),
    getNearbyNocs(lat, lon, radius),
    getNearbyAppeals(lat, lon, radius),
  ]);
  const band = stats ? buildEmpiricalBand(stats, olsResult.max_top_amsl_m) : null;

  return (
    <SkygaugeReportView
      site={{ lat, lon }}
      label={label}
      groundAmsl={elev}
      radiusM={radius}
      result={olsResult}
      band={band}
      nocs={nocs}
      appeals={appeals}
    />
  );
}
