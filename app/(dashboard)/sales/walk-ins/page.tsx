import { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { getUserProjects } from '@/lib/actions/sales/projects';
import type { LeadStatus } from '@/lib/schemas/sales';

export const metadata: Metadata = { title: 'Walk-ins — Anex Sales' };
export const dynamic = 'force-dynamic';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
  { value: 'booked', label: 'Booked' },
  { value: 'lost', label: 'Lost' },
] as const;

const STATUS_DOT: Record<string, string> = {
  hot: '#F97316',
  warm: '#B45309',
  cold: '#1D4ED8',
  booked: '#15803D',
  lost: '#B91C1C',
};

type WalkInRow = {
  id: string;
  status: string;
  source: string;
  configuration: string | null;
  created_at: string;
  clients: { first_name: string | null; last_name: string | null; mobile_primary: string } | null;
  channel_partners: { canonical_name: string } | null;
  sales_projects: { name: string } | null;
};

export default async function WalkInsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; project?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = createServiceClient();
  const projects = await getUserProjects().catch(() => []);

  let query = supabase
    .from('walk_ins')
    .select(`
      id, status, source, configuration, created_at,
      clients ( first_name, last_name, mobile_primary ),
      channel_partners ( canonical_name ),
      sales_projects ( name )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(200);

  if (params.status) query = query.eq('status', params.status);
  if (params.project) query = query.eq('project_id', params.project);

  const { data } = await query;
  let rows = (data ?? []) as unknown as WalkInRow[];

  if (params.q) {
    const q = params.q.toLowerCase();
    rows = rows.filter(r => {
      const name = [r.clients?.first_name, r.clients?.last_name].filter(Boolean).join(' ').toLowerCase();
      const mobile = r.clients?.mobile_primary ?? '';
      return name.includes(q) || mobile.includes(q);
    });
  }

  const activeStatus = params.status ?? '';
  const activeProject = params.project ?? '';

  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ ...params, ...overrides });
    Object.keys(overrides).forEach(k => { if (!overrides[k]) p.delete(k); });
    const s = p.toString();
    return `/sales/walk-ins${s ? `?${s}` : ''}`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

  return (
    <div style={{ padding: 'var(--content-pad)', display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--sales-txt)' }}>Walk-ins</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--sales-txt3)', marginTop: 2 }}>
            {rows.length} visit{rows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/sales/walk-ins/new"
          style={{
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 40, padding: '0 16px',
            background: 'var(--anex-navy)', color: 'white',
            borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700,
          }}
        >
          + New Walk-in
        </Link>
      </div>

      {/* Filters */}
      <div className="sales-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Status chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <Link
              key={f.value}
              href={buildHref({ status: f.value })}
              className={`filter-chip${activeStatus === f.value ? ' active' : ''}`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* Project filter */}
        {projects.length > 1 && (
          <>
            <div style={{ width: 1, height: 20, background: 'var(--sales-border)', margin: '0 4px' }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Link href={buildHref({ project: '' })} className={`filter-chip${!activeProject ? ' active' : ''}`}>All Projects</Link>
              {projects.map(p => (
                <Link key={p.id} href={buildHref({ project: p.id })} className={`filter-chip${activeProject === p.id ? ' active' : ''}`}>
                  {p.name}
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Search */}
        <form method="GET" action="/sales/walk-ins" style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
          {activeProject && <input type="hidden" name="project" value={activeProject} />}
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Search by name or mobile..."
            className="mobile-input"
            style={{ height: 36, width: 220, fontSize: 13 }}
          />
          <button
            type="submit"
            style={{
              height: 36, padding: '0 14px',
              border: '1.5px solid var(--sales-border)', borderRadius: 'var(--r)',
              background: 'white', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', color: 'var(--sales-txt2)', fontFamily: 'inherit',
            }}
          >
            Go
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="sales-card" style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--sales-border)', background: '#F8FAFC' }}>
              {['Client', 'Mobile', 'Status', 'Project', 'Source', 'CP', 'Configuration', 'Date', ''].map(h => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 700, color: 'var(--sales-txt3)',
                  textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--sales-txt3)', fontSize: 14 }}>
                  No walk-ins found.
                </td>
              </tr>
            )}
            {rows.map(r => {
              const name = [r.clients?.first_name, r.clients?.last_name].filter(Boolean).join(' ') || '—';
              const dot = STATUS_DOT[r.status] ?? '#94A3B8';
              const rowClass = `row-${r.status}`;
              return (
                <tr key={r.id} className={`wi-row ${rowClass}`} style={{ borderBottom: '1px solid var(--sales-border-light)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--sales-txt)' }}>{name}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--sales-txt2)' }}>
                    {r.clients?.mobile_primary ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`status-badge badge-${r.status}`}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', marginRight: 5 }} />
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--sales-txt2)' }}>{r.sales_projects?.name ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--sales-txt2)', textTransform: 'capitalize' }}>
                    {r.source?.replace(/_/g, ' ') ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--sales-txt2)' }}>
                    {r.channel_partners?.canonical_name ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--sales-txt2)', textTransform: 'uppercase', fontSize: 11, fontWeight: 700 }}>
                    {r.configuration ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--sales-txt3)', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {formatDate(r.created_at)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link
                      href={`/sales/walk-ins/${r.id}`}
                      style={{
                        textDecoration: 'none', fontSize: 11, fontWeight: 700,
                        padding: '4px 10px', borderRadius: 6,
                        background: 'var(--sales-bg)', border: '1.5px solid var(--sales-border)',
                        color: 'var(--sales-txt2)',
                      }}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`.wi-row:hover td { background: var(--sales-bg-hover); }`}</style>
    </div>
  );
}
