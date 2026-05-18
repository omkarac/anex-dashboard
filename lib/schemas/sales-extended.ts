// lib/schemas/sales-extended.ts
// V2 Zod schemas: leads, lead_activities, visit_schedules, follow_up_tasks
// These complement lib/schemas/sales.ts (V1). Never duplicate from sales.ts.

import { z } from 'zod'
import { MobileSchema, LeadSourceSchema, LostReasonSchema } from './sales'

// ── Lead enums ─────────────────────────────────────────────────────────────────
export const LeadStageSchema = z.enum(['new', 'called', 'interested', 'site_visit_scheduled', 'converted', 'lost'])
export const CallStatusSchema = z.enum(['connected', 'not_answering', 'busy', 'wrong_number', 'not_reachable'])
export const ActivityTypeSchema = z.enum(['call', 'whatsapp', 'email', 'note'])
export const ActivityOutcomeSchema = z.enum(['interested', 'not_interested', 'callback', 'site_visit_confirmed', 'lost'])
export const VisitScheduleStatusSchema = z.enum(['tentative', 'confirmed', 'reminder_sent', 'visited', 'rescheduled', 'cancelled', 'no_show'])
export const TaskTypeSchema = z.enum(['follow_up_call', 'revisit_reminder', 'pre_visit_confirmation', 'post_visit_update', 'custom'])
export const TaskStatusSchema = z.enum(['pending', 'completed', 'missed', 'snoozed', 'cancelled'])

// ── Leads ──────────────────────────────────────────────────────────────────────
export const LeadSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  client_id: z.string().uuid().nullable(),
  mobile_primary: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().nullable(),
  source: LeadSourceSchema,
  sub_source: z.string().nullable(),
  cp_id: z.string().uuid().nullable(),
  assigned_presales_id: z.string().uuid().nullable(),
  assigned_at: z.string().nullable(),
  stage: LeadStageSchema,
  lost_reason: LostReasonSchema.nullable(),
  next_followup_date: z.string().nullable(),
  is_duplicate: z.boolean(),
  converted_walk_in_id: z.string().uuid().nullable(),
  converted_at: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  created_by: z.string().uuid(),
  updated_at: z.string(),
})

export const CreateLeadInputSchema = z.object({
  project_id: z.string().uuid(),
  mobile_primary: MobileSchema,
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  source: LeadSourceSchema.default('direct'),
  sub_source: z.string().optional(),
  cp_id: z.string().uuid().optional(),
})

// ── Lead Activities ────────────────────────────────────────────────────────────
export const LeadActivitySchema = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  walk_in_id: z.string().uuid().nullable(),
  sm_id: z.string().uuid(),
  activity_type: ActivityTypeSchema,
  call_status: CallStatusSchema.nullable(),
  call_duration_sec: z.number().int().nullable(),
  outcome: ActivityOutcomeSchema.nullable(),
  remarks: z.string(),
  next_followup_date: z.string().nullable(),
  next_followup_type: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid(),
})

export const LogCallInputSchema = z.object({
  lead_id: z.string().uuid(),
  activity_type: ActivityTypeSchema.default('call'),
  call_status: CallStatusSchema,
  outcome: ActivityOutcomeSchema.optional(),
  remarks: z.string().min(1, 'Remarks are required'),
  call_duration_sec: z.number().int().positive().optional(),
  // BR-009: next_followup_date required when connected
  next_followup_date: z.string().optional(),
}).refine(
  data => data.call_status !== 'connected' || data.next_followup_date !== undefined,
  { message: 'Follow-up date is required for connected calls', path: ['next_followup_date'] }
)

// ── Visit Schedules ────────────────────────────────────────────────────────────
export const VisitScheduleSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable(),
  walk_in_id: z.string().uuid().nullable(),
  client_id: z.string().uuid().nullable(),
  client_name: z.string().nullable(),
  client_mobile: z.string().nullable(),
  cp_id: z.string().uuid().nullable(),
  sourcing_sm_id: z.string().uuid(),
  closing_sm_id: z.string().uuid().nullable(),
  tentative_date: z.string(),
  tentative_time: z.string().nullable(),
  status: VisitScheduleStatusSchema,
  confirmed_at: z.string().nullable(),
  confirmed_by: z.string().uuid().nullable(),
  attribution_locked: z.boolean(),
  outcome: z.string().nullable(),
  outcome_notes: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid(),
})

export const CreateVisitScheduleInputSchema = z.object({
  project_id: z.string().uuid(),
  lead_id: z.string().uuid().optional(),
  walk_in_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  client_name: z.string().optional(),
  client_mobile: MobileSchema.optional(),
  cp_id: z.string().uuid().optional(),
  tentative_date: z.string(),
  tentative_time: z.string().optional(),
})

// ── Follow-up Tasks ────────────────────────────────────────────────────────────
export const FollowUpTaskSchema = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid().nullable(),
  walk_in_id: z.string().uuid().nullable(),
  assigned_to: z.string().uuid(),
  due_at: z.string(),
  task_type: TaskTypeSchema,
  notes: z.string().nullable(),
  status: TaskStatusSchema,
  completed_at: z.string().nullable(),
  completed_by: z.string().uuid().nullable(),
  snoozed_until: z.string().nullable(),
  snooze_count: z.number().int(),
  escalated_at: z.string().nullable(),
  escalated_to: z.string().uuid().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid(),
})

export const CreateFollowUpTaskInputSchema = z.object({
  lead_id: z.string().uuid().optional(),
  walk_in_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid(),
  due_at: z.string(),
  task_type: TaskTypeSchema.default('follow_up_call'),
  notes: z.string().optional(),
}).refine(
  data => data.lead_id !== undefined || data.walk_in_id !== undefined,
  { message: 'Either lead_id or walk_in_id is required', path: ['lead_id'] }
)

export const SnoozeTaskInputSchema = z.object({
  task_id: z.string().uuid(),
  snooze_until: z.string(),
})

export const CompleteTaskInputSchema = z.object({
  task_id: z.string().uuid(),
  notes: z.string().optional(),
})

// ── Push Subscriptions ─────────────────────────────────────────────────────────
export const CreatePushSubscriptionInputSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
  user_agent: z.string().optional(),
})

// ── Types ─────────────────────────────────────────────────────────────────────
export type LeadStage = z.infer<typeof LeadStageSchema>
export type CallStatus = z.infer<typeof CallStatusSchema>
export type ActivityType = z.infer<typeof ActivityTypeSchema>
export type ActivityOutcome = z.infer<typeof ActivityOutcomeSchema>
export type VisitScheduleStatus = z.infer<typeof VisitScheduleStatusSchema>
export type TaskType = z.infer<typeof TaskTypeSchema>
export type TaskStatus = z.infer<typeof TaskStatusSchema>
export type Lead = z.infer<typeof LeadSchema>
export type LeadActivity = z.infer<typeof LeadActivitySchema>
export type VisitSchedule = z.infer<typeof VisitScheduleSchema>
export type FollowUpTask = z.infer<typeof FollowUpTaskSchema>
export type CreateLeadInput = z.infer<typeof CreateLeadInputSchema>
export type LogCallInput = z.infer<typeof LogCallInputSchema>
export type CreateVisitScheduleInput = z.infer<typeof CreateVisitScheduleInputSchema>
export type CreateFollowUpTaskInput = z.infer<typeof CreateFollowUpTaskInputSchema>
export type SnoozeTaskInput = z.infer<typeof SnoozeTaskInputSchema>
export type CompleteTaskInput = z.infer<typeof CompleteTaskInputSchema>
