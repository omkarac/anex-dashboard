import Link from 'next/link';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { MyDay } from '@/lib/queries/dashboard-productivity';

const PRIORITY_DOT: Record<MyDay['tasks_due'][number]['priority'], string> = {
  low: 'bg-slate-400',
  medium: 'bg-indigo-400',
  high: 'bg-amber-500',
  urgent: 'bg-rose-500',
};

function fmtMove(from: string | null, to: string) {
  const f = from ? ASSET_STATUS_LABELS[from as keyof typeof ASSET_STATUS_LABELS] ?? from : '—';
  const t = ASSET_STATUS_LABELS[to as keyof typeof ASSET_STATUS_LABELS] ?? to;
  return `${f} → ${t}`;
}

interface Props {
  data: MyDay;
  memberName: string;
}

export function MyDayWidget({ data, memberName }: Props) {
  const tasks = data.tasks_due;
  const silent = data.silent_assets;
  const moves = data.this_week_moves;

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            My Day
          </h2>
          <p className="text-[11px] text-foreground/80 mt-0.5">
            <span className="font-semibold">{memberName.split(' ')[0]}</span>
            <span className="text-muted-foreground"> · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          </p>
        </div>
        <span className="text-[11px] font-semibold text-indigo-500 tabular-nums">
          {data.updates_today} update{data.updates_today !== 1 ? 's' : ''} today
        </span>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5 flex flex-col gap-4">
        {/* Tasks due */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Tasks due
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nothing due — clean slate.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {tasks.slice(0, 5).map((t) => (
                <Link
                  key={t.id}
                  href={`/capital-markets/assets/${t.asset_id}`}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority]}`} />
                  <span className="text-xs text-foreground truncate flex-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {t.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[100px] hidden sm:inline">
                    {t.asset_name}
                  </span>
                  {t.overdue_days > 0 && (
                    <span className="text-[10px] font-semibold text-rose-500 tabular-nums shrink-0">
                      {t.overdue_days}d late
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Silent owned assets */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Going quiet
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{silent.length}</span>
          </div>
          {silent.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">All your assets touched recently.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {silent.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  href={`/capital-markets/assets/${a.id}`}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <span className="text-xs text-foreground truncate flex-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {a.property_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{ASSET_STATUS_LABELS[a.status]}</span>
                  <span
                    className={`text-[10px] font-semibold tabular-nums shrink-0 ${
                      a.days_silent >= 14 ? 'text-rose-500' : a.days_silent >= 7 ? 'text-amber-500' : 'text-muted-foreground'
                    }`}
                  >
                    {a.days_silent}d
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* This-week moves */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              You moved this week
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{moves.length}</span>
          </div>
          {moves.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">No stage transitions yet this week.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {moves.slice(0, 3).map((m, idx) => (
                <Link
                  key={`${m.asset_id}-${idx}`}
                  href={`/capital-markets/assets/${m.asset_id}`}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <span className="text-xs text-foreground truncate flex-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {m.property_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {fmtMove(m.from_status, m.to_status)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
