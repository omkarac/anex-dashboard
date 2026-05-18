interface Props { priority: 1 | 2 | 3 | 4 | 5 | number; className?: string; }

export function CpPriorityBadge({ priority, className }: Props) {
  const p = Math.max(1, Math.min(5, Math.round(priority)));
  return (
    <div
      className={`priority-circle priority-${p} ${className ?? ''}`}
      title={`Priority ${p}`}
    >
      P{p}
    </div>
  );
}
