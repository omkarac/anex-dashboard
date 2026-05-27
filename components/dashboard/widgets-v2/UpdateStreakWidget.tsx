import type { UpdateStreak } from '@/lib/queries/dashboard-productivity';

interface Props {
  data: UpdateStreak;
}

export function UpdateStreakWidget({ data }: Props) {
  const fireColor =
    data.current_streak >= 7
      ? 'text-rose-500'
      : data.current_streak >= 3
      ? 'text-amber-500'
      : data.current_streak >= 1
      ? 'text-indigo-500'
      : 'text-muted-foreground/50';

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Update Streak
        </h2>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          best {data.longest_streak_30d}d
        </span>
      </div>

      <div className="flex items-baseline gap-2 mt-3 mb-4">
        <span className={`text-4xl font-bold tabular-nums ${fireColor}`}>
          {data.current_streak}
        </span>
        <span className="text-xs text-muted-foreground">
          day{data.current_streak !== 1 ? 's' : ''} running
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-end">
        <div className="grid grid-cols-[repeat(15,_1fr)] gap-1">
          {data.days.map((d, i) => {
            const inCurrentRun = i >= data.days.length - data.current_streak;
            const colorClass = d.active
              ? inCurrentRun && data.current_streak >= 7
                ? 'bg-rose-400 dark:bg-rose-500'
                : inCurrentRun && data.current_streak >= 3
                ? 'bg-amber-400 dark:bg-amber-500'
                : 'bg-indigo-400 dark:bg-indigo-500'
              : 'bg-muted';
            return (
              <div
                key={d.date}
                className={`aspect-square rounded-sm ${colorClass}`}
                title={`${d.date} — ${d.active ? 'active' : 'no activity'}`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">30 days ago</span>
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">today</span>
        </div>
      </div>
    </div>
  );
}
