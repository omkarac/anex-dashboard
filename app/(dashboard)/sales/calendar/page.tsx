import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  getVisitSchedules,
  getUpcomingVisitCounts,
  getProjectTeamMembers,
  getCurrentUserSalesProfile,
  type VisitScheduleRow,
} from '@/lib/actions/sales/calendar';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { CalendarClient } from './CalendarClient';

export const metadata: Metadata = { title: 'CP Calendar — Anex Sales' };

function groupByDate(rows: VisitScheduleRow[]): Map<string, VisitScheduleRow[]> {
  const map = new Map<string, VisitScheduleRow[]>();
  for (const row of rows) {
    const key = row.tentative_date;
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }
  return map;
}

function formatDateHeader(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().slice(0, 10);
}
function isFuture(dateStr: string) {
  return dateStr > new Date().toISOString().slice(0, 10);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();

  if (projects.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--sales-txt3)', fontSize: 14 }}>
        No projects assigned. Contact your administrator.
      </div>
    );
  }

  const projectId = params.project ?? projects[0].id;
  const project = projects.find(p => p.id === projectId) ?? projects[0];

  if (!project) redirect('/sales/dashboard');

  const [visits, counts, teamMembers, currentUser] = await Promise.all([
    getVisitSchedules(project.id),
    getUpcomingVisitCounts(project.id),
    getProjectTeamMembers(project.id),
    getCurrentUserSalesProfile(),
  ]);

  const grouped = groupByDate(visits);
  const dateSections = Array.from(grouped.entries()).map(([date, rows]) => ({
    date,
    label: formatDateHeader(date),
    isToday: isToday(date),
    isFuture: isFuture(date),
    visits: rows,
  }));

  return (
    <div style={{ padding: 'var(--content-pad)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiCard label="Today" value={counts.today} accent="var(--anex-navy)" />
        <KpiCard label="Confirmed" value={counts.confirmed} accent="var(--status-cold)" />
        <KpiCard label="Tentative" value={counts.tentative} accent="var(--status-warm)" />
        <KpiCard label="This Week" value={counts.thisWeek} accent="var(--anex-teal)" />
      </div>

      {/* Header + Schedule button */}
      <CalendarClient
        project={project}
        currentUserId={currentUser.id}
        teamMembers={teamMembers}
        dateSections={dateSections}
      />
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
