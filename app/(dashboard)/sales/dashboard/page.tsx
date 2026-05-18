import type { Metadata } from 'next';
import { getUserProjects } from '@/lib/actions/sales/projects';
import {
  getDashboardKpis,
  getSmPerformance,
  getConfigBreakdown,
  getCpPerformance,
  getLostAnalysis,
  getMonthlyTrend,
} from '@/lib/actions/sales/analytics';
import { BarFunnel } from '@/components/sales/BarFunnel';
import { CpCategoryBadge } from '@/components/sales/CpCategoryBadge';

export const metadata: Metadata = { title: 'Dashboard — Anex Sales' };

const LOST_LABELS: Record<string, string> = {
  not_responding:       'Not Responding',
  budget:               'Budget',
  booked_elsewhere:     'Booked Elsewhere',
  plan_dropped:         'Plan Dropped',
  didnt_like_project:   "Didn't Like Project",
  layout_issue:         'Layout Issue',
  requirement_mismatch: 'Requirement Mismatch',
  not_interested:       'Not Interested',
  general_enquiry:      'General Enquiry',
  location_issue:       'Location Issue',
  floor_issue:          'Floor Issue',
  possession_timeline:  'Possession Timeline',
  vaastu_issue:         'Vaastu Issue',
  view_issue:           'View Issue',
  other:                'Other',
};

const CONFIG_LABELS: Record<string, string> = {
  '1bhk': '1 BHK', '2bhk': '2 BHK', '3bhk': '3 BHK',
  '2bhk_jodi': '2 BHK Jodi', 'duplex': 'Duplex',
  '2_3bhk': '2/3 BHK', 'commercial': 'Commercial',
};

export default async function SalesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();

  if (projects.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--sales-txt3)' }}>
        No projects assigned. Contact your administrator.
      </div>
    );
  }

  const projectId = params.project ?? projects[0].id;
  const project = projects.find(p => p.id === projectId) ?? projects[0];

  const [kpis, smPerf, configBreakdown, cpPerf, lostAnalysis, monthlyTrend] = await Promise.all([
    getDashboardKpis(project.id),
    getSmPerformance(project.id),
    getConfigBreakdown(project.id),
    getCpPerformance(project.id),
    getLostAnalysis(project.id),
    getMonthlyTrend(project.id),
  ]);

  const p1 = cpPerf.filter(c => c.computed_priority === 'p1').length;
  const p2 = cpPerf.filter(c => c.computed_priority === 'p2').length;
  const p3 = cpPerf.filter(c => c.computed_priority === 'p3').length;

  const lostFunnelItems = lostAnalysis.slice(0, 6).map(r => ({
    label: LOST_LABELS[r.lost_reason ?? ''] ?? r.lost_reason ?? '—',
    value: r.total_lost,
    color: 'red' as const,
  }));

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── KPI Row ──────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12,
      }}>
        <KpiTile
          label="Total Walk-ins"
          value={kpis.totalWalkins}
          sub={`${kpis.cpWalkins} CP · ${kpis.directWalkins} Direct`}
          accent="var(--anex-navy)"
        />
        <KpiTile
          label="Bookings"
          value={kpis.booked}
          sub={`${kpis.convPct}% conv. rate`}
          accent="var(--status-booked)"
        />
        <KpiTile
          label="Warm Leads"
          value={kpis.warm}
          sub="Actively following up"
          accent="var(--status-warm)"
        />
        <KpiTile
          label="Lost"
          value={kpis.lost}
          sub="Total lost leads"
          accent="var(--status-lost)"
        />
        <KpiTile
          label="Unique OBMs"
          value={kpis.uniqueObms}
          sub={`${kpis.totalIbms} IBMs total`}
          accent="var(--anex-teal)"
        />
        <KpiTile
          label="CP Walk-ins"
          value={kpis.cpWalkins}
          sub={`${kpis.totalMeetings} total meetings`}
          accent="var(--anex-gold-dim)"
        />
      </div>

      {/* ── Row 2: SM Performance + Config Demand ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* SM Performance */}
        <div className="sales-card">
          <div className="sales-card-header">
            <div>
              <div className="sales-card-title">SM Performance</div>
              <div className="sales-card-sub">{project.name}</div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--sales-border-light)', background: 'var(--sales-bg)' }}>
                  <Th left>SM</Th>
                  <Th>WI</Th>
                  <Th>Bkd</Th>
                  <Th>Warm</Th>
                  <Th>Lost</Th>
                  <Th>Conv%</Th>
                  <Th>Mtgs</Th>
                </tr>
              </thead>
              <tbody>
                {smPerf.length === 0 && (
                  <tr><td colSpan={7} style={emptyTd}>No data yet</td></tr>
                )}
                {smPerf.map(sm => (
                  <tr key={sm.sm_id} style={{ borderBottom: '1px solid var(--sales-border-light)' }}>
                    <td style={{ ...tdBase, fontWeight: 600, color: 'var(--sales-txt)' }}>{sm.full_name}</td>
                    <td style={{ ...tdRight, fontWeight: 700 }}>{sm.total_walkins}</td>
                    <td style={{ ...tdRight, color: 'var(--status-booked)', fontWeight: 700 }}>{sm.booked}</td>
                    <td style={{ ...tdRight, color: 'var(--status-warm)' }}>{sm.warm}</td>
                    <td style={{ ...tdRight, color: 'var(--status-lost)' }}>{sm.lost}</td>
                    <td style={{ ...tdRight, fontWeight: 600 }}>{sm.conversion_pct ?? 0}%</td>
                    <td style={{ ...tdRight, color: 'var(--sales-txt2)' }}>{sm.total_meetings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Configuration Demand */}
        <div className="sales-card">
          <div className="sales-card-header">
            <div>
              <div className="sales-card-title">Configuration Demand</div>
              <div className="sales-card-sub">Walk-in requirements</div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--sales-border-light)', background: 'var(--sales-bg)' }}>
                  <Th left>Config</Th>
                  <Th>Total</Th>
                  <Th>Bkd</Th>
                  <Th>Conv%</Th>
                  <Th>% Total</Th>
                </tr>
              </thead>
              <tbody>
                {configBreakdown.length === 0 && (
                  <tr><td colSpan={5} style={emptyTd}>No data yet</td></tr>
                )}
                {configBreakdown.map(c => (
                  <tr key={c.configuration ?? 'null'} style={{ borderBottom: '1px solid var(--sales-border-light)' }}>
                    <td style={{ ...tdBase, fontWeight: 600, color: 'var(--sales-txt)' }}>
                      {CONFIG_LABELS[c.configuration ?? ''] ?? c.configuration ?? '—'}
                    </td>
                    <td style={{ ...tdRight, fontWeight: 700 }}>{c.total}</td>
                    <td style={{ ...tdRight, color: 'var(--status-booked)', fontWeight: 700 }}>{c.booked}</td>
                    <td style={tdRight}>{c.conversion_pct ?? 0}%</td>
                    <td style={{ ...tdRight, color: 'var(--sales-txt2)' }}>{c.pct_of_total ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Row 3: CP Priority + Lost Analysis ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* CP Priority */}
        <div className="sales-card">
          <div className="sales-card-header">
            <div className="sales-card-title">CP Priority Breakdown</div>
          </div>
          <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'P1 — 10+ walk-ins', count: p1, color: 'var(--anex-gold)', bg: '#FFFBEB', border: '#FDE68A' },
              { label: 'P2 — 5–9 walk-ins', count: p2, color: 'var(--status-cold)', bg: '#DBEAFE', border: '#BFDBFE' },
              { label: 'P3 — 1–4 walk-ins', count: p3, color: 'var(--sales-txt3)', bg: 'var(--sales-bg)', border: 'var(--sales-border)' },
            ].map(tier => (
              <div key={tier.label} style={{
                padding: '12px 8px', borderRadius: 8, textAlign: 'center',
                background: tier.bg, border: `1.5px solid ${tier.border}`,
              }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: tier.color, fontVariantNumeric: 'tabular-nums' }}>
                  {tier.count}
                </div>
                <div style={{ fontSize: 10, color: 'var(--sales-txt2)', fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>
                  {tier.label}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 18px 14px' }}>
            <a href={`/sales-marketing/cp-review?project=${project.id}`}
              style={{ fontSize: 12, color: 'var(--anex-teal)', textDecoration: 'none', fontWeight: 600 }}>
              View full CP review →
            </a>
          </div>
        </div>

        {/* Top Lost Reasons */}
        <div className="sales-card">
          <div className="sales-card-header">
            <div>
              <div className="sales-card-title">Top Lost Reasons</div>
              <div className="sales-card-sub">{lostAnalysis.reduce((s, r) => s + r.total_lost, 0)} total lost</div>
            </div>
          </div>
          <div style={{ padding: '14px 18px' }}>
            {lostFunnelItems.length === 0
              ? <div style={{ color: 'var(--sales-txt3)', fontSize: 13 }}>No lost data yet</div>
              : <BarFunnel items={lostFunnelItems} />
            }
          </div>
        </div>
      </div>

      {/* ── Row 4: Monthly Trend ───────────────────────────────── */}
      <div className="sales-card">
        <div className="sales-card-header">
          <div className="sales-card-title">Monthly Trend</div>
          <div className="sales-card-sub" style={{ fontSize: 11, color: 'var(--sales-txt3)' }}>
            Walk-ins &amp; bookings by month
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sales-border-light)', background: 'var(--sales-bg)' }}>
                <Th left>Month</Th>
                <Th>Total WI</Th>
                <Th>CP WI</Th>
                <Th>Direct WI</Th>
                <Th>Bookings</Th>
              </tr>
            </thead>
            <tbody>
              {monthlyTrend.length === 0 && (
                <tr><td colSpan={5} style={emptyTd}>No monthly data yet</td></tr>
              )}
              {monthlyTrend.map(m => (
                <tr key={m.month_sort} style={{ borderBottom: '1px solid var(--sales-border-light)' }}>
                  <td style={{ ...tdBase, fontWeight: 600, color: 'var(--sales-txt)' }}>{m.month_label}</td>
                  <td style={{ ...tdRight, fontWeight: 700 }}>{m.total_walkins}</td>
                  <td style={tdRight}>{m.cp_walkins}</td>
                  <td style={tdRight}>{m.direct_walkins}</td>
                  <td style={{ ...tdRight, color: 'var(--status-booked)', fontWeight: 800 }}>{m.bookings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Row 5: Top CP Performance ─────────────────────────── */}
      <div className="sales-card">
        <div className="sales-card-header">
          <div className="sales-card-title">Top CP Performance</div>
          <a href={`/sales-marketing/cp-review?project=${project.id}`}
            style={{ fontSize: 12, color: 'var(--anex-teal)', textDecoration: 'none', fontWeight: 600 }}>
            Full table →
          </a>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sales-border-light)', background: 'var(--sales-bg)' }}>
                <Th left style={{ width: 28 }}>#</Th>
                <Th left>CP Firm</Th>
                <Th left>Cat</Th>
                <Th>WI</Th>
                <Th>Bkd</Th>
                <Th>1BHK</Th>
                <Th>2BHK</Th>
                <Th>3BHK</Th>
                <Th>Conv%</Th>
                <Th>Priority</Th>
              </tr>
            </thead>
            <tbody>
              {cpPerf.length === 0 && (
                <tr><td colSpan={10} style={emptyTd}>No CP data yet</td></tr>
              )}
              {cpPerf.slice(0, 20).map((cp, i) => (
                <tr key={cp.cp_id} style={{ borderBottom: '1px solid var(--sales-border-light)' }}>
                  <td style={{ ...tdBase, color: 'var(--sales-txt3)' }}>{i + 1}</td>
                  <td style={{ ...tdBase, fontWeight: 600, color: 'var(--sales-txt)' }}>
                    <a href={`/sales-marketing/channel-partners/${cp.cp_id}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                      className="hover-underline">
                      {cp.canonical_name}
                    </a>
                  </td>
                  <td style={tdBase}>
                    <CpCategoryBadge category={cp.category as 'icp' | 'rcp' | 'cp'} />
                  </td>
                  <td style={{ ...tdRight, fontWeight: 700 }}>{cp.total_walkins}</td>
                  <td style={{ ...tdRight, color: 'var(--status-booked)', fontWeight: 700 }}>{cp.booked}</td>
                  <td style={tdRight}>{cp.bhk_1}</td>
                  <td style={tdRight}>{cp.bhk_2}</td>
                  <td style={tdRight}>{cp.bhk_3}</td>
                  <td style={tdRight}>{cp.conversion_pct ?? 0}%</td>
                  <td style={{ ...tdRight }}>
                    {cp.computed_priority && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        color: cp.computed_priority === 'p1' ? 'var(--anex-gold-dim)'
                          : cp.computed_priority === 'p2' ? 'var(--status-cold)'
                          : 'var(--sales-txt3)',
                      }}>
                        {cp.computed_priority}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

/* ── Small inline components ─────────────────────────────────────────────── */

function KpiTile({ label, value, sub, accent }: {
  label: string;
  value: number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="kpi-tile" style={{ '--kpi-accent': accent } as React.CSSProperties}>
      <div className="kpi-tile-label">{label}</div>
      <div className="kpi-tile-value">{value}</div>
      {sub && <div className="kpi-tile-sub">{sub}</div>}
    </div>
  );
}

function Th({
  children,
  left,
  style,
}: {
  children?: React.ReactNode;
  left?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <th style={{
      padding: '8px 10px',
      textAlign: left ? 'left' : 'right',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--sales-txt3)',
      textTransform: 'uppercase',
      letterSpacing: '.4px',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </th>
  );
}

const tdBase: React.CSSProperties = {
  padding: '9px 10px',
  color: 'var(--sales-txt2)',
  verticalAlign: 'middle',
};

const tdRight: React.CSSProperties = {
  ...tdBase,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const emptyTd: React.CSSProperties = {
  padding: '24px 10px',
  textAlign: 'center',
  color: 'var(--sales-txt3)',
  fontSize: 13,
};
