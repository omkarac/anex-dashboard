import { Activity, CalendarDays, Users, Trash2, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuditStats } from '@/lib/queries/audit';

function Tile({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-1" style={{ borderTopWidth: 3, borderTopColor: accent }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function AuditKpiStrip({ stats }: { stats: AuditStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <Tile label="Today" value={String(stats.today)} hint="events logged" icon={Activity} accent="#15803D" />
      <Tile label="Last 7 days" value={String(stats.last7)} hint="events logged" icon={CalendarDays} accent="#1D4ED8" />
      <Tile label="Active users" value={String(stats.activeUsers)} hint="in current view" icon={Users} accent="#7C3AED" />
      <Tile label="Deletions" value={String(stats.deletions)} hint="soft deletes" icon={Trash2} accent="#B91C1C" />
      <Tile
        label="Top entity"
        value={stats.topEntity ? stats.topEntity.type : '—'}
        hint={stats.topEntity ? `${stats.topEntity.count} events` : 'no activity'}
        icon={Layers}
        accent="#B45309"
      />
    </div>
  );
}
