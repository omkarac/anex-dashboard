import { Metadata } from 'next';
import {
  getMyFollowUpTasks,
  getTaskKpis,
} from '@/lib/actions/sales/follow-up-tasks';
import { TasksClient } from './TasksClient';

export const metadata: Metadata = { title: 'My Tasks — Anex Sales' };

export default async function TasksPage() {
  const [tasks, kpis] = await Promise.all([
    getMyFollowUpTasks(),
    getTaskKpis(),
  ]);

  return (
    <div style={{ padding: 'var(--content-pad)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiCard label="Due Today"   value={kpis.dueToday}       accent="var(--anex-navy)" />
        <KpiCard label="Overdue"     value={kpis.overdue}        accent="var(--status-lost)" />
        <KpiCard label="Total Pending" value={kpis.pendingTotal} accent="var(--status-warm)" />
        <KpiCard label="Done Today"  value={kpis.completedToday} accent="var(--status-booked)" />
      </div>

      {/* Page header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--sales-txt)' }}>
          My Follow-up Tasks
        </h2>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--sales-txt3)' }}>
          Pending tasks assigned to you — sorted by due time
        </p>
      </div>

      {/* Task list */}
      <TasksClient tasks={tasks} />
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="kpi-tile" style={{ '--kpi-accent': accent } as React.CSSProperties}>
      <div className="kpi-tile-label">{label}</div>
      <div className="kpi-tile-value">{value}</div>
    </div>
  );
}
