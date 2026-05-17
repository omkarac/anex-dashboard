import Link from 'next/link';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { PipelineBoard, BoardDeal, BoardStage } from '@/lib/queries/dashboard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCr(v: number): string {
  if (v === 0) return '—';
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K Cr`;
  return `₹${Math.round(v)} Cr`;
}

function daysLabel(d: number): string {
  if (d === 0) return 'today';
  if (d === 1) return '1d';
  return `${d}d`;
}

// ─── Temperature dot ──────────────────────────────────────────────────────────

function TempDot({ temp }: { temp: string }) {
  const cls =
    temp === 'hot'  ? 'bg-rose-500' :
    temp === 'warm' ? 'bg-amber-400' :
    temp === 'cold' ? 'bg-sky-400' :
    'bg-muted-foreground/30';
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 mt-0.5 ${cls}`} />;
}

// ─── Warning badge ────────────────────────────────────────────────────────────

function WarningBadge({ deal }: { deal: BoardDeal }) {
  if (deal.temperature === 'hot' && deal.is_unassigned)
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">NO OWNER</span>;
  if (deal.is_hot_silent)
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">SILENT</span>;
  return null;
}

// ─── Days chip ────────────────────────────────────────────────────────────────

function DaysChip({ days }: { days: number }) {
  const cls =
    days >= 14 ? 'text-rose-500 dark:text-rose-400' :
    days >= 7  ? 'text-amber-500 dark:text-amber-400' :
    'text-muted-foreground';
  return <span className={`text-[11px] tabular-nums font-medium ${cls}`}>{daysLabel(days)}</span>;
}

// ─── Deal card ────────────────────────────────────────────────────────────────

function DealCard({ deal }: { deal: BoardDeal }) {
  const isUrgent = (deal.temperature === 'hot' && deal.is_unassigned) || deal.is_hot_silent;

  return (
    <Link
      href={`/capital-markets/assets/${deal.id}`}
      className={`group block rounded-lg border p-3 transition-all hover:shadow-sm ${
        isUrgent
          ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-300 dark:hover:border-rose-800'
          : 'border-border bg-card hover:bg-muted/20'
      }`}
    >
      {/* Row 1: dot + name */}
      <div className="flex items-start gap-2 mb-1.5">
        <TempDot temp={deal.temperature} />
        <p className="text-xs font-semibold text-foreground group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors leading-snug line-clamp-1 flex-1">
          {deal.property_name}
        </p>
      </div>

      {/* Row 2: owner · days | value + warning */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] text-muted-foreground truncate">
            {deal.owner ?? <span className="italic text-muted-foreground/60">Unassigned</span>}
          </span>
          <span className="text-border text-[11px]">·</span>
          <DaysChip days={deal.days_since_activity} />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <WarningBadge deal={deal} />
          {deal.topline_cr > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums">{formatCr(deal.topline_cr)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Stage column ─────────────────────────────────────────────────────────────

const STAGE_ACCENT: Record<string, string> = {
  open:       'text-slate-500 dark:text-slate-400',
  evaluating: 'text-indigo-600 dark:text-indigo-400',
  screened:   'text-violet-600 dark:text-violet-400',
};

const STAGE_COUNT_BG: Record<string, string> = {
  open:       'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  evaluating: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300',
  screened:   'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300',
};

function StageColumn({ stage }: { stage: BoardStage }) {
  const accentClass = STAGE_ACCENT[stage.status] ?? 'text-muted-foreground';
  const countBgClass = STAGE_COUNT_BG[stage.status] ?? 'bg-muted text-muted-foreground';

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Column header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${accentClass}`}>
            {ASSET_STATUS_LABELS[stage.status]}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${countBgClass}`}>
            {stage.count}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">{formatCr(stage.value)}</span>
      </div>

      {/* Deal cards */}
      {stage.top.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-[11px] text-muted-foreground/60">No deals here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {stage.top.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}

      {/* Overflow */}
      {stage.overflow > 0 && (
        <Link
          href={`/capital-markets/assets?status=${stage.status}`}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-medium text-center py-1"
        >
          +{stage.overflow} more →
        </Link>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PipelineBoardWidget({ board }: { board: PipelineBoard }) {
  const { stages, exits } = board;

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Pipeline
          </h2>
          <span className="text-[10px] text-muted-foreground/60">
            {stages.reduce((s, st) => s + st.count, 0)} active
            <span className="mx-1.5">·</span>
            {formatCr(stages.reduce((s, st) => s + st.value, 0))}
          </span>
        </div>
        <Link
          href="/capital-markets/assets"
          className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          View all →
        </Link>
      </div>

      {/* Three-column board */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border p-0">
        {stages.map((stage) => (
          <div key={stage.status} className="p-5">
            <StageColumn stage={stage} />
          </div>
        ))}
      </div>

      {/* Exit footer */}
      <div className="border-t border-dashed border-border px-5 py-3 bg-muted/20 flex items-center gap-6 flex-wrap">
        {[
          { key: 'won',     label: 'Won',     dot: 'bg-emerald-400', data: exits.won },
          { key: 'dropped', label: 'Dropped', dot: 'bg-muted-foreground/30', data: exits.dropped },
        ].map(({ key, label, dot, data }) => (
          <Link
            key={key}
            href={`/capital-markets/assets?status=${key}`}
            className="flex items-center gap-2 group"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
              {label}
            </span>
            <span className="text-[11px] font-semibold tabular-nums text-foreground/70">
              {data.count}
            </span>
            {data.value > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                · {formatCr(data.value)}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
