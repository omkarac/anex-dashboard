import Link from 'next/link';
import { Users, UserMinus } from 'lucide-react';
import type { CollabGraph } from '@/lib/queries/dashboard-productivity';

interface Props {
  data: CollabGraph;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = (parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '');
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[9px] font-bold text-foreground/70 shrink-0 ring-1 ring-border">
      {initials.toUpperCase()}
    </span>
  );
}

export function CollabGraphWidget({ data }: Props) {
  const loneCount = data.lone_wolf_assets.length;
  const sharedCount = data.shared_assets.length;
  const lonePct = data.total_active_assets > 0 ? Math.round((loneCount / data.total_active_assets) * 100) : 0;

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Collaboration Graph
          </h2>
          <p className="text-[11px] text-foreground/80 mt-0.5 tabular-nums">
            <span className="font-semibold">{lonePct}%</span>
            <span className="text-muted-foreground"> assets touched by one person · 30d</span>
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5 flex flex-col gap-4">
        {/* Lone-wolf */}
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <UserMinus className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">
              Lone-wolf assets ({loneCount})
            </span>
          </div>
          {loneCount === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Every active asset has 2+ contributors.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {data.lone_wolf_assets.slice(0, 4).map((a) => (
                <Link
                  key={a.asset_id}
                  href={`/capital-markets/assets/${a.asset_id}`}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <Initials name={a.contributors[0].name} />
                  <span className="text-xs text-foreground truncate flex-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {a.property_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {a.contributors[0].updates} update{a.contributors[0].updates !== 1 ? 's' : ''}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Shared */}
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
              Well-shared assets ({sharedCount})
            </span>
          </div>
          {sharedCount === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">No assets have 3+ contributors yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {data.shared_assets.slice(0, 4).map((a) => (
                <Link
                  key={a.asset_id}
                  href={`/capital-markets/assets/${a.asset_id}`}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <div className="flex -space-x-1.5 shrink-0">
                    {a.contributors.slice(0, 3).map((c) => (
                      <Initials key={c.member_id} name={c.name} />
                    ))}
                  </div>
                  <span className="text-xs text-foreground truncate flex-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {a.property_name}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-500 tabular-nums shrink-0">
                    {a.contributor_count}
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
