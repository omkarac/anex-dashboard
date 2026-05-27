import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ClosingLoop } from '@/lib/queries/dashboard-productivity';

interface Props {
  data: ClosingLoop;
}

export function ClosingLoopWidget({ data }: Props) {
  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Closing the Loop
        </h2>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5 flex flex-col gap-4">
        {/* Ball in your court */}
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowLeft className="w-3 h-3 text-rose-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">
              Your move ({data.ball_in_your_court.length})
            </span>
          </div>
          {data.ball_in_your_court.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nothing waiting on you.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {data.ball_in_your_court.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  href={`/capital-markets/assets/${a.id}`}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md border border-rose-100 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/10 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                >
                  <span className="text-xs text-foreground truncate flex-1 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                    {a.property_name}
                  </span>
                  <span className="text-[10px] font-semibold tabular-nums text-rose-500">
                    {a.days_waiting}d
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Waiting on others */}
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Waiting on others ({data.waiting_on_others.length})
            </span>
          </div>
          {data.waiting_on_others.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Not waiting on anyone.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {data.waiting_on_others.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  href={`/capital-markets/assets/${a.id}`}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <span className="text-xs text-foreground truncate flex-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {a.property_name}
                  </span>
                  {a.assignee && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                      → {a.assignee.split(' ')[0]}
                    </span>
                  )}
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground shrink-0">
                    {a.days_waiting}d
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
