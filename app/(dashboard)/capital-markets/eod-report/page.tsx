import { Metadata } from 'next';
import { requireAdmin } from '@/lib/rbac';
import { createServiceClient } from '@/lib/supabase/service';
import { getEodReportConfig, getEodReportData } from '@/lib/queries/eod-report';
import { EodReportAdmin } from '@/components/audit/eod-report-admin';

export const metadata: Metadata = { title: 'EOD Report — Anex' };
export const dynamic = 'force-dynamic';

export default async function EodReportSettingsPage() {
  await requireAdmin();

  const service = createServiceClient();
  const config = await getEodReportConfig();

  const [{ data: cmMembers }, previewPayload] = await Promise.all([
    service
      .from('team_members')
      .select('id, full_name, email')
      .in('department', ['cm', 'both'])
      .eq('is_active', true)
      .eq('status', 'active')
      .order('full_name'),
    getEodReportData(new Date(), config.recipient_scope),
  ]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Capital Markets — EOD Report</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Daily activity digest. Auto-sends Mon–Sat at 21:00 IST · last updated{' '}
          {new Date(config.updated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <EodReportAdmin
          initialConfig={{
            recipient_scope: config.recipient_scope,
            enabled: config.enabled,
            updated_at: config.updated_at,
          }}
          optOutIds={config.opt_outs.map((o) => o.member_id)}
          cmMembers={cmMembers ?? []}
          previewPayload={previewPayload}
        />
      </div>
    </div>
  );
}
