import { Metadata } from 'next';
import Link from 'next/link';
import { listLogs, getLogFilterOptions } from '@/lib/queries/logs';

export const metadata: Metadata = { title: 'Activity Logs — Anex Sales' };
export const dynamic = 'force-dynamic';

const ACTION_COLORS: Record<string, string> = {
  create: '#15803D',
  update: '#1D4ED8',
  delete: '#B91C1C',
  status_change: '#B45309',
  share: '#7C3AED',
};

export default async function SalesLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const page = Math.max(0, parseInt(params.page ?? '0', 10) || 0);
  const PAGE_SIZE = 50;

  const filters = {
    q: params.q || undefined,
    actor_id: params.actor_id || undefined,
    action: params.action || undefined,
    entity_type: params.entity_type || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    show_deleted: params.deleted === '1',
    page,
    vertical: 'sales_marketing' as const,
  };

  const [{ logs, total }, filterOptions] = await Promise.all([
    listLogs(filters).catch(() => ({ logs: [], total: 0, page: 0 })),
    getLogFilterOptions('sales_marketing').catch(() => ({ actors: [], actions: [], entityTypes: [] })),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ ...params, ...overrides });
    Object.keys(overrides).forEach(k => { if (!overrides[k]) p.delete(k); });
    const s = p.toString();
    return `/sales/logs${s ? `?${s}` : ''}`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    });

  return (
    <div style={{ padding: 'var(--content-pad)', display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--sales-txt)' }}>Activity Logs</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--sales-txt3)', marginTop: 2 }}>
          Sales audit trail — {total.toLocaleString()} record{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <form method="GET" action="/sales/logs" className="sales-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search summary…"
          className="mobile-input"
          style={{ height: 36, width: 200, fontSize: 13 }}
        />

        {filterOptions.actors.length > 0 && (
          <select name="actor_id" defaultValue={params.actor_id ?? ''} style={selectStyle}>
            <option value="">All Users</option>
            {filterOptions.actors.map(a => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
        )}

        {filterOptions.actions.length > 0 && (
          <select name="action" defaultValue={params.action ?? ''} style={selectStyle}>
            <option value="">All Actions</option>
            {filterOptions.actions.map(a => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>
        )}

        {filterOptions.entityTypes.length > 0 && (
          <select name="entity_type" defaultValue={params.entity_type ?? ''} style={selectStyle}>
            <option value="">All Types</option>
            {filterOptions.entityTypes.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        )}

        <input name="from" type="date" defaultValue={params.from ?? ''} style={{ ...selectStyle, width: 140 }} />
        <input name="to" type="date" defaultValue={params.to ?? ''} style={{ ...selectStyle, width: 140 }} />

        <button type="submit" style={{
          height: 36, padding: '0 14px',
          border: '1.5px solid var(--sales-border)', borderRadius: 'var(--r)',
          background: 'white', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', color: 'var(--sales-txt2)', fontFamily: 'inherit',
        }}>Filter</button>

        {Object.keys(params).some(k => !['page'].includes(k) && params[k]) && (
          <Link href="/sales/logs" style={{ fontSize: 13, color: 'var(--sales-txt3)', textDecoration: 'underline' }}>Clear</Link>
        )}
      </form>

      {/* Table */}
      <div className="sales-card" style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--sales-border)', background: '#F8FAFC' }}>
              {['When', 'Who', 'Action', 'Type', 'Summary'].map(h => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 700, color: 'var(--sales-txt3)',
                  textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--sales-txt3)', fontSize: 14 }}>
                  No logs found.
                </td>
              </tr>
            )}
            {logs.map(log => (
              <tr key={log.id} className="log-row" style={{ borderBottom: '1px solid var(--sales-border-light)' }}>
                <td style={{ padding: '10px 16px', color: 'var(--sales-txt3)', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {formatDate(log.created_at)}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--sales-txt2)', whiteSpace: 'nowrap' }}>
                  {log.actor?.full_name ?? '—'}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                    fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                    background: `${ACTION_COLORS[log.action] ?? '#94A3B8'}18`,
                    color: ACTION_COLORS[log.action] ?? '#64748B',
                  }}>
                    {log.action.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--sales-txt2)', fontSize: 12, textTransform: 'capitalize' }}>
                  {log.entity_type.replace(/_/g, ' ')}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--sales-txt)', maxWidth: 400 }}>
                  {log.summary}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          {page > 0 && (
            <Link href={buildHref({ page: String(page - 1) })} style={paginationBtn}>← Prev</Link>
          )}
          <span style={{ fontSize: 13, color: 'var(--sales-txt2)' }}>
            Page {page + 1} of {totalPages}
          </span>
          {page < totalPages - 1 && (
            <Link href={buildHref({ page: String(page + 1) })} style={paginationBtn}>Next →</Link>
          )}
        </div>
      )}

      <style>{`.log-row:hover td { background: var(--sales-bg-hover); }`}</style>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  height: 36, fontSize: 13, padding: '0 8px', borderRadius: 'var(--r)',
  border: '1.5px solid var(--sales-border)', background: 'white',
  color: 'var(--sales-txt)', fontFamily: 'inherit', cursor: 'pointer',
};

const paginationBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 14px',
  border: '1.5px solid var(--sales-border)', borderRadius: 'var(--r)',
  background: 'white', fontSize: 13, fontWeight: 600,
  textDecoration: 'none', color: 'var(--sales-txt2)',
};
