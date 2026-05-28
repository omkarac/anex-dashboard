import { z } from 'zod';

// Mirrors the CHECK on eod_report_config.recipient_scope (0036_eod_report_config.sql).
export const EOD_RECIPIENT_SCOPES = ['admins_only', 'cm_team'] as const;
export const eodRecipientScopeSchema = z.enum(EOD_RECIPIENT_SCOPES);
export type EodRecipientScope = z.infer<typeof eodRecipientScopeSchema>;

export const EodReportConfigSchema = z.object({
  id: z.string().uuid(),
  recipient_scope: eodRecipientScopeSchema,
  enabled: z.boolean(),
  updated_at: z.string(),
  updated_by: z.string().uuid().nullable(),
});
export type EodReportConfig = z.infer<typeof EodReportConfigSchema>;

export const EodReportConfigUpdateSchema = z.object({
  recipient_scope: eodRecipientScopeSchema,
  enabled: z.boolean(),
});
export type EodReportConfigUpdate = z.infer<typeof EodReportConfigUpdateSchema>;

// Rendered report payload — shape passed to the email template and the preview UI.
// All counts are scoped to a single IST day window; member breakdown only includes
// CM members (department in ('cm','both')) who logged at least one action.
export const EodMemberRowSchema = z.object({
  member_id: z.string().uuid(),
  full_name: z.string(),
  updates: z.number().int(),
  status_changes: z.number().int(),
  tasks_completed: z.number().int(),
  tasks_created: z.number().int(),
  total_actions: z.number().int(),
});
export type EodMemberRow = z.infer<typeof EodMemberRowSchema>;

export const EodStatusMoveSchema = z.object({
  asset_id: z.string().uuid(),
  property_name: z.string(),
  from_status: z.string().nullable(),
  to_status: z.string(),
  changed_by: z.string(),
  changed_at: z.string(),
});
export type EodStatusMove = z.infer<typeof EodStatusMoveSchema>;

export const EodAttentionItemSchema = z.object({
  id: z.string().uuid(),
  property_name: z.string(),
  reason: z.string(),
  detail: z.string(),
});
export type EodAttentionItem = z.infer<typeof EodAttentionItemSchema>;

export const EodReportPayloadSchema = z.object({
  // ISO date string the report covers (the IST day) — e.g. "2026-05-28".
  report_date_ist: z.string(),
  // Headline pipeline KPIs (point-in-time at send).
  kpis: z.object({
    active_pipeline_cr: z.number(),
    active_count: z.number().int(),
    hot_count: z.number().int(),
    win_rate_pct: z.number().int(),
    won_this_quarter: z.number().int(),
    dropped_this_quarter: z.number().int(),
  }),
  // Today's deltas (IST day window).
  today: z.object({
    updates: z.number().int(),
    status_changes: z.number().int(),
    tasks_created: z.number().int(),
    tasks_completed: z.number().int(),
    new_assets: z.number().int(),
    won: z.number().int(),
    dropped: z.number().int(),
    active_members: z.number().int(),
  }),
  member_rows: z.array(EodMemberRowSchema),
  status_moves: z.array(EodStatusMoveSchema),
  attention: z.array(EodAttentionItemSchema),
  // Recipient summary so the preview UI can show who will receive it.
  recipients: z.object({
    scope: eodRecipientScopeSchema,
    emails: z.array(z.string()),
    excluded_count: z.number().int(),
  }),
});
export type EodReportPayload = z.infer<typeof EodReportPayloadSchema>;
