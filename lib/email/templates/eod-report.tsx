import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';
import { render } from '@react-email/render';
import type { EodReportPayload } from '@/lib/schemas/eod-report';

// Anex palette — kept in inline styles because most email clients strip <style>.
const NAVY = '#1B2A4A';
const GOLD = '#C9A961';
const INK = '#0B1320';
const SUBTLE = '#6B7280';
const BORDER = '#E5E7EB';
const SURFACE = '#F8FAFC';
const SUCCESS = '#15803D';
const DANGER = '#B91C1C';
const WARM = '#B45309';

const fontStack =
  '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

function formatCrore(value: number): string {
  if (!value) return '₹0';
  if (value >= 100) return `₹${(value / 100).toFixed(2)} Cr+`;
  return `₹${value.toFixed(2)} Cr`;
}

function formatDateLong(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function statusLabel(s: string | null): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusColor(s: string): string {
  if (s === 'won') return SUCCESS;
  if (s === 'dropped') return DANGER;
  if (s === 'screened') return GOLD;
  if (s === 'evaluating') return NAVY;
  return SUBTLE;
}

type KpiTileProps = { label: string; value: string; accent?: string };
function KpiTile({ label, value, accent = NAVY }: KpiTileProps) {
  return (
    <Column
      style={{
        background: '#fff',
        borderTop: `3px solid ${accent}`,
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        padding: '14px 16px',
        width: '25%',
      }}
    >
      <Text style={{ margin: 0, fontSize: 11, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
    </Column>
  );
}

type TodayTileProps = { label: string; value: number };
function TodayTile({ label, value }: TodayTileProps) {
  return (
    <Column
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        padding: '10px 12px',
        width: '25%',
      }}
    >
      <Text style={{ margin: 0, fontSize: 10, color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
    </Column>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: '24px 0 10px',
        fontSize: 13,
        fontWeight: 700,
        color: NAVY,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      {children}
    </Text>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ margin: '8px 0', fontSize: 13, color: SUBTLE, fontStyle: 'italic' }}>
      {children}
    </Text>
  );
}

export type EodReportEmailProps = {
  payload: EodReportPayload;
  dashboardUrl: string;
};

export function EodReportEmail({ payload, dashboardUrl }: EodReportEmailProps) {
  const { kpis, today, member_rows, status_moves, attention } = payload;
  const dateLong = formatDateLong(payload.report_date_ist);
  const previewLine = `Anex Capital Markets — EOD: ${today.status_changes} stage moves, ${today.updates} updates, ${today.tasks_completed} tasks closed`;

  return (
    <Html>
      <Head />
      <Preview>{previewLine}</Preview>
      <Body style={{ background: SURFACE, fontFamily: fontStack, color: INK, margin: 0, padding: '24px 0' }}>
        <Container style={{ maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
          {/* Header */}
          <Section style={{ background: NAVY, padding: '20px 24px' }}>
            <Text style={{ margin: 0, color: GOLD, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Anex Advisory — Capital Markets
            </Text>
            <Heading
              as="h1"
              style={{ margin: '4px 0 0', color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: -0.2 }}
            >
              End-of-Day Report
            </Heading>
            <Text style={{ margin: '4px 0 0', color: '#CBD5E1', fontSize: 13 }}>{dateLong}</Text>
          </Section>

          <Container style={{ padding: '20px 24px' }}>
            {/* Pipeline KPIs */}
            <SectionTitle>Pipeline snapshot</SectionTitle>
            <Row style={{ borderCollapse: 'separate', borderSpacing: '8px 0' }}>
              <KpiTile label="Pipeline" value={formatCrore(kpis.active_pipeline_cr)} accent={NAVY} />
              <KpiTile label="Active deals" value={String(kpis.active_count)} accent={GOLD} />
              <KpiTile label="Hot" value={String(kpis.hot_count)} accent={WARM} />
              <KpiTile label="Win rate" value={`${kpis.win_rate_pct}%`} accent={SUCCESS} />
            </Row>
            <Text style={{ margin: '8px 0 0', fontSize: 12, color: SUBTLE }}>
              Quarter to date: {kpis.won_this_quarter} won · {kpis.dropped_this_quarter} dropped
            </Text>

            {/* Today's activity */}
            <SectionTitle>Today&apos;s activity</SectionTitle>
            <Row style={{ borderCollapse: 'separate', borderSpacing: '6px 0' }}>
              <TodayTile label="Stage moves" value={today.status_changes} />
              <TodayTile label="Updates" value={today.updates} />
              <TodayTile label="Tasks closed" value={today.tasks_completed} />
              <TodayTile label="New assets" value={today.new_assets} />
            </Row>
            <Row style={{ borderCollapse: 'separate', borderSpacing: '6px 0', marginTop: 8 }}>
              <TodayTile label="Tasks created" value={today.tasks_created} />
              <TodayTile label="Won" value={today.won} />
              <TodayTile label="Dropped" value={today.dropped} />
              <TodayTile label="Active members" value={today.active_members} />
            </Row>

            {/* Status transitions */}
            <SectionTitle>Status transitions today</SectionTitle>
            {status_moves.length === 0 ? (
              <EmptyNote>No status changes today.</EmptyNote>
            ) : (
              <table
                cellPadding={0}
                cellSpacing={0}
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
              >
                <thead>
                  <tr style={{ background: SURFACE }}>
                    <th align="left" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: SUBTLE, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Asset
                    </th>
                    <th align="left" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: SUBTLE, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Move
                    </th>
                    <th align="left" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: SUBTLE, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {status_moves.map((m, i) => (
                    <tr key={`${m.asset_id}-${i}`}>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: INK }}>
                        {m.property_name}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}>
                        <span style={{ color: SUBTLE }}>{statusLabel(m.from_status)}</span>
                        <span style={{ color: SUBTLE }}> → </span>
                        <span style={{ color: statusColor(m.to_status), fontWeight: 600 }}>{statusLabel(m.to_status)}</span>
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: SUBTLE }}>
                        {m.changed_by}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Per-member activity */}
            <SectionTitle>Per-member activity</SectionTitle>
            {member_rows.length === 0 ? (
              <EmptyNote>No CM activity logged today.</EmptyNote>
            ) : (
              <table
                cellPadding={0}
                cellSpacing={0}
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
              >
                <thead>
                  <tr style={{ background: SURFACE }}>
                    <th align="left" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: SUBTLE, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Member
                    </th>
                    <th align="right" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: SUBTLE, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Updates
                    </th>
                    <th align="right" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: SUBTLE, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Moves
                    </th>
                    <th align="right" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: SUBTLE, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Tasks done
                    </th>
                    <th align="right" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: SUBTLE, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Tasks new
                    </th>
                    <th align="right" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: SUBTLE, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {member_rows.map((m) => (
                    <tr key={m.member_id}>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: INK, fontWeight: 500 }}>
                        {m.full_name}
                      </td>
                      <td align="right" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                        {m.updates}
                      </td>
                      <td align="right" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                        {m.status_changes}
                      </td>
                      <td align="right" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                        {m.tasks_completed}
                      </td>
                      <td align="right" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                        {m.tasks_created}
                      </td>
                      <td align="right" style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: NAVY, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {m.total_actions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Needs attention */}
            <SectionTitle>Needs attention</SectionTitle>
            {attention.length === 0 ? (
              <EmptyNote>All clear — no hot/silent assets and no orphaned work.</EmptyNote>
            ) : (
              <table
                cellPadding={0}
                cellSpacing={0}
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
              >
                <tbody>
                  {attention.map((a, i) => (
                    <tr key={`${a.id}-${i}`}>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: INK, fontWeight: 500 }}>
                        {a.property_name}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: WARM, fontWeight: 600 }}>
                        {a.reason}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: SUBTLE }}>
                        {a.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <Hr style={{ borderColor: BORDER, margin: '24px 0 12px' }} />
            <Text style={{ margin: 0, fontSize: 12, color: SUBTLE }}>
              Open the dashboard:{' '}
              <a href={dashboardUrl} style={{ color: NAVY, textDecoration: 'underline' }}>
                {dashboardUrl}
              </a>
            </Text>
            <Text style={{ margin: '6px 0 0', fontSize: 11, color: SUBTLE }}>
              Generated automatically for the Capital Markets team. To adjust recipients or pause this digest, ask an admin to visit the EOD Report settings page.
            </Text>
          </Container>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderEodReportEmail(props: EodReportEmailProps): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(<EodReportEmail {...props} />),
    render(<EodReportEmail {...props} />, { plainText: true }),
  ]);
  return { html, text };
}
