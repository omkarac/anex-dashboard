import { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { CpCategoryBadge } from '@/components/sales/CpCategoryBadge';
import { CpStagePill } from '@/components/sales/CpStagePill';
import type { CpCategory, CpStage } from '@/lib/schemas/sales';

export const metadata: Metadata = { title: 'Channel Partners — Anex Sales' };

const CATEGORY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'icp', label: 'ICP' },
  { value: 'rcp', label: 'RCP' },
  { value: 'cp', label: 'CP' },
] as const;

const STAGE_FILTERS = [
  { value: '', label: 'All Stages' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export default async function SalesCpRegistryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; stage?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from('channel_partners')
    .select('id, canonical_name, category, stage, mobile_primary, zone, is_approved, is_active, created_at')
    .eq('is_active', true)
    .order('canonical_name');

  if (params.category) query = query.eq('category', params.category);
  if (params.stage) query = query.eq('stage', params.stage);
  if (params.q) query = query.ilike('canonical_name', `%${params.q}%`);

  const { data: cps } = await query.limit(300);
  const rows = cps ?? [];

  const activeCat = params.category ?? '';
  const activeStage = params.stage ?? '';
  const buildHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ ...params, ...overrides });
    Object.keys(overrides).forEach(k => { if (!overrides[k]) p.delete(k); });
    const s = p.toString();
    return `/sales/channel-partners${s ? `?${s}` : ''}`;
  };

  return (
    <div className="page-scroll">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--sales-txt)' }}>Channel Partners</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--sales-txt3)', marginTop: 2 }}>
            {rows.length} partner{rows.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <Link
          href="/sales/channel-partners/new"
          style={{
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 44, padding: '0 18px',
            background: 'var(--anex-navy)', color: 'white',
            borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
          }}
        >
          + Register CP
        </Link>
      </div>

      {/* Filters + Search */}
      <div className="sales-card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Category + Stage chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORY_FILTERS.map(f => (
              <Link key={f.value} href={buildHref({ category: f.value })} className={`filter-chip${activeCat === f.value ? ' active' : ''}`}>
                {f.label}
              </Link>
            ))}
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--sales-border)', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STAGE_FILTERS.map(f => (
              <Link key={f.value} href={buildHref({ stage: f.value })} className={`filter-chip${activeStage === f.value ? ' active' : ''}`}>
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Search — full width on mobile */}
        <form method="GET" action="/sales/channel-partners" style={{ display: 'flex', gap: 6 }}>
          {activeCat && <input type="hidden" name="category" value={activeCat} />}
          {activeStage && <input type="hidden" name="stage" value={activeStage} />}
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Search by name..."
            className="mobile-input"
            style={{ height: 40, flex: 1, fontSize: 13 }}
          />
          <button
            type="submit"
            style={{
              height: 40, padding: '0 16px',
              border: '1.5px solid var(--sales-border)', borderRadius: 'var(--r)',
              background: 'white', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', color: 'var(--sales-txt2)', fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Table — non-critical columns hidden on mobile */}
      <div className="sales-card" style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--sales-border)', background: '#F8FAFC' }}>
              <th style={thS}>Name</th>
              <th style={thS}>Category</th>
              <th style={thS}>Stage</th>
              <th style={thS} data-mobile="hide">Mobile</th>
              <th style={thS} data-mobile="hide">Zone</th>
              <th style={thS} data-mobile="hide">Approved</th>
              <th style={thS}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--sales-txt3)', fontSize: 14 }}>
                  No channel partners found.
                </td>
              </tr>
            )}
            {rows.map(cp => (
              <tr key={cp.id} style={{ borderBottom: '1px solid var(--sales-border-light)' }} className="cp-row">
                <td style={{ padding: '12px 12px' }}>
                  <Link href={`/sales/channel-partners/${cp.id}`} style={{ color: 'var(--sales-txt)', fontWeight: 600, textDecoration: 'none' }}>
                    {cp.canonical_name}
                  </Link>
                </td>
                <td style={{ padding: '12px 12px' }}>
                  <CpCategoryBadge category={cp.category as CpCategory} />
                </td>
                <td style={{ padding: '12px 12px' }}>
                  <CpStagePill stage={cp.stage as CpStage} />
                </td>
                <td style={{ padding: '12px 12px', color: 'var(--sales-txt2)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }} data-mobile="hide">
                  {cp.mobile_primary ?? '—'}
                </td>
                <td style={{ padding: '12px 12px', color: 'var(--sales-txt2)', textTransform: 'capitalize', whiteSpace: 'nowrap' }} data-mobile="hide">
                  {cp.zone?.replace(/_/g, ' ') ?? '—'}
                </td>
                <td style={{ padding: '12px 12px', textAlign: 'center' }} data-mobile="hide">
                  {cp.is_approved
                    ? <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: 13 }}>✓</span>
                    : <span style={{ color: 'var(--sales-txt3)', fontSize: 12 }}>Pending</span>
                  }
                </td>
                <td style={{ padding: '12px 10px' }}>
                  <Link
                    href={`/sales/meetings/new?cp=${cp.id}`}
                    style={{
                      textDecoration: 'none', fontSize: 11, fontWeight: 700,
                      padding: '5px 10px', borderRadius: 6,
                      background: 'var(--sales-bg)', border: '1.5px solid var(--sales-border)',
                      color: 'var(--sales-txt2)', whiteSpace: 'nowrap', display: 'inline-block',
                    }}
                  >
                    + DAR
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`.cp-row:hover td { background: var(--sales-bg-hover); }`}</style>
    </div>
  );
}

const thS: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: 'var(--sales-txt3)',
  textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap',
};
