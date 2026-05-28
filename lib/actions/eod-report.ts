'use server';

import { revalidatePath } from 'next/cache';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { authorizeAdmin } from '@/lib/rbac';
import { createServiceClient } from '@/lib/supabase/service';
import {
  EodReportConfigUpdateSchema,
  type EodRecipientScope,
} from '@/lib/schemas/eod-report';
import { getEodReportData, getEodReportConfig } from '@/lib/queries/eod-report';
import { renderEodReportEmail } from '@/lib/email/templates/eod-report';
import { sendEmail } from '@/lib/email/resend-client';

const FORBIDDEN = 'Forbidden — admin access required' as const;
const CONFIG_ID = '00000000-0000-0000-0000-000000000001';

function dashboardUrl(): string {
  // Vercel sets VERCEL_URL automatically; allow override for prod custom domain.
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function revalidateEodPaths() {
  revalidatePath('/audit/eod-report');
}

export type EodSendResult = {
  message_id: string;
  recipient_count: number;
  report_date_ist: string;
};

/**
 * Render and send the EOD report. Used by both the cron route (no actor) and
 * the admin "Send now" button (admin actor). When called from cron the actor
 * is the first active admin so audit trail still attributes a human.
 */
export async function sendEodReport(opts?: {
  reference?: Date;
  scopeOverride?: EodRecipientScope;
  triggeredBy?: 'cron' | 'manual';
}): Promise<ActionResult<EodSendResult>> {
  const service = createServiceClient();
  const config = await getEodReportConfig();

  if (!config.enabled && opts?.triggeredBy !== 'manual') {
    return { ok: false, error: 'EOD report is disabled' };
  }

  const scope = opts?.scopeOverride ?? config.recipient_scope;
  const reference = opts?.reference ?? new Date();
  const payload = await getEodReportData(reference, scope);

  if (payload.recipients.emails.length === 0) {
    return { ok: false, error: 'No active recipients for the selected scope' };
  }

  const { html, text } = await renderEodReportEmail({
    payload,
    dashboardUrl: dashboardUrl(),
  });

  const subject = `Anex Capital Markets — EOD ${payload.report_date_ist} · ${payload.today.status_changes} moves · ${payload.today.updates} updates`;

  const sendResult = await sendEmail({
    to: payload.recipients.emails,
    subject,
    html,
    text,
  });
  if (!sendResult.ok) return sendResult;

  // Attribute audit to an admin actor — for manual sends we have one from
  // authorizeAdmin in the caller; for cron we look one up so the log is never
  // orphaned. If no admin exists at all, withAudit will fail open (the audit
  // row stays unwritten) but the email already shipped.
  let actorId: string | null = null;
  if (opts?.triggeredBy === 'manual') {
    const admin = await authorizeAdmin();
    actorId = admin?.id ?? null;
  }
  if (!actorId) {
    const { data: anyAdmin } = await service
      .from('team_members')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    actorId = anyAdmin?.id ?? null;
  }

  // Direct activity_logs insert (not withAudit) — withAudit requires a Supabase
  // auth user, but the cron path runs with no session. We've already validated
  // permission upstream (authorizeAdmin for manual, CRON_SECRET for cron).
  await service.from('activity_logs').insert({
    actor_id: actorId,
    action: 'create',
    entity_type: 'eod_report',
    entity_id: actorId ?? CONFIG_ID,
    summary: `EOD report sent to ${payload.recipients.emails.length} recipients (${scope}) — ${opts?.triggeredBy ?? 'manual'}`,
  });

  return {
    ok: true,
    data: {
      message_id: sendResult.data.id,
      recipient_count: payload.recipients.emails.length,
      report_date_ist: payload.report_date_ist,
    },
  };
}

export async function sendEodReportNow(): Promise<ActionResult<EodSendResult>> {
  const actor = await authorizeAdmin();
  if (!actor) return { ok: false, error: FORBIDDEN };
  const result = await sendEodReport({ triggeredBy: 'manual' });
  if (result.ok) revalidateEodPaths();
  return result;
}

export async function updateEodReportConfig(input: {
  recipient_scope: string;
  enabled: boolean;
}): Promise<ActionResult<void>> {
  const actor = await authorizeAdmin();
  if (!actor) return { ok: false, error: FORBIDDEN };

  const parsed = EodReportConfigUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const result = await withAudit({
    action: 'update',
    entityType: 'eod_report_config',
    entityId: CONFIG_ID,
    summary: `EOD config: scope=${parsed.data.recipient_scope}, enabled=${parsed.data.enabled}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('eod_report_config')
        .update({
          recipient_scope: parsed.data.recipient_scope,
          enabled: parsed.data.enabled,
          updated_at: new Date().toISOString(),
          updated_by: actorId,
        })
        .eq('id', CONFIG_ID);
      if (error) throw new Error(error.message);
    },
  });
  if (result.ok) revalidateEodPaths();
  return result;
}

export async function setEodOptOut(
  memberId: string,
  optedOut: boolean
): Promise<ActionResult<void>> {
  const actor = await authorizeAdmin();
  if (!actor) return { ok: false, error: FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'eod_report_config',
    entityId: memberId,
    summary: optedOut ? `Excluded member from EOD report` : `Re-included member in EOD report`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      if (optedOut) {
        const { error } = await service
          .from('eod_report_opt_outs')
          .upsert({ member_id: memberId, opted_out_by: actorId }, { onConflict: 'member_id' });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await service
          .from('eod_report_opt_outs')
          .delete()
          .eq('member_id', memberId);
        if (error) throw new Error(error.message);
      }
    },
  });
  if (result.ok) revalidateEodPaths();
  return result;
}
