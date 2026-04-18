import type { DashboardTotals } from '@/lib/queries/dashboard';

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function StatTiles({ totals }: { totals: DashboardTotals }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Tile label="Total Assets" value={totals.total} />
      <Tile label="Active" value={totals.active} sub="not won or dropped" />
      <Tile label="Evaluated" value={totals.evaluatedThisMonth} sub="this month" />
      <Tile label="Won" value={totals.wonThisQuarter} sub="this quarter" />
    </div>
  );
}
