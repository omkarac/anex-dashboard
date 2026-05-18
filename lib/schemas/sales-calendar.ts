import { z } from 'zod'

// ── Visit Schedules ────────────────────────────────────────────────────────────

export const VisitScheduleStatusSchema = z.enum([
  'tentative', 'confirmed', 'reminder_sent', 'visited',
  'rescheduled', 'cancelled', 'no_show',
])

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
  rescheduled_from_id: z.string().uuid().nullable(),
  reschedule_reason: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
  attribution_locked: z.boolean(),
  outcome: z.string().nullable(),
  outcome_notes: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid(),
})

export const CreateVisitScheduleInputSchema = z.object({
  project_id: z.string().uuid(),
  client_name: z.string().min(1, 'Client name is required'),
  client_mobile: z.string().optional(),
  client_id: z.string().uuid().optional(),
  walk_in_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  cp_id: z.string().uuid().optional(),
  closing_sm_id: z.string().uuid().optional(),
  tentative_date: z.string().min(1, 'Date is required'),
  tentative_time: z.string().optional(),
  outcome_notes: z.string().max(1000).optional(),
})

export const UpdateVisitScheduleStatusInputSchema = z.object({
  visit_id: z.string().uuid(),
  status: VisitScheduleStatusSchema,
  reason: z.string().optional(),
  outcome_notes: z.string().optional(),
})

// ── Follow-up Tasks ────────────────────────────────────────────────────────────

export const FollowUpTaskTypeSchema = z.enum([
  'follow_up_call', 'revisit_reminder', 'pre_visit_confirmation',
  'post_visit_update', 'custom',
])

export const FollowUpTaskStatusSchema = z.enum([
  'pending', 'completed', 'missed', 'snoozed', 'cancelled',
])

export const FollowUpTaskSchema = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid().nullable(),
  walk_in_id: z.string().uuid().nullable(),
  assigned_to: z.string().uuid(),
  due_at: z.string(),
  task_type: FollowUpTaskTypeSchema,
  notes: z.string().nullable(),
  status: FollowUpTaskStatusSchema,
  completed_at: z.string().nullable(),
  completed_by: z.string().uuid().nullable(),
  snoozed_until: z.string().nullable(),
  snooze_count: z.number().int(),
  escalated_at: z.string().nullable(),
  escalated_to: z.string().uuid().nullable(),
  escalation_reason: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid(),
})

export const CreateFollowUpTaskInputSchema = z.object({
  walk_in_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid(),
  due_at: z.string().min(1, 'Due time is required'),
  task_type: FollowUpTaskTypeSchema.default('follow_up_call'),
  notes: z.string().max(500).optional(),
}).refine(
  d => d.walk_in_id !== undefined || d.lead_id !== undefined,
  { message: 'Either walk_in_id or lead_id is required', path: ['walk_in_id'] }
)

export const SnoozeFollowUpTaskInputSchema = z.object({
  task_id: z.string().uuid(),
  snoozed_until: z.string().min(1, 'Snooze time is required'),
})

export const EscalateFollowUpTaskInputSchema = z.object({
  task_id: z.string().uuid(),
  escalate_to_id: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required'),
})

// ── Inferred types ─────────────────────────────────────────────────────────────

export type VisitScheduleStatus = z.infer<typeof VisitScheduleStatusSchema>
export type VisitSchedule = z.infer<typeof VisitScheduleSchema>
export type CreateVisitScheduleInput = z.input<typeof CreateVisitScheduleInputSchema>
export type UpdateVisitScheduleStatusInput = z.infer<typeof UpdateVisitScheduleStatusInputSchema>

export type FollowUpTaskType = z.infer<typeof FollowUpTaskTypeSchema>
export type FollowUpTaskStatus = z.infer<typeof FollowUpTaskStatusSchema>
export type FollowUpTask = z.infer<typeof FollowUpTaskSchema>
export type CreateFollowUpTaskInput = z.input<typeof CreateFollowUpTaskInputSchema>
export type SnoozeFollowUpTaskInput = z.infer<typeof SnoozeFollowUpTaskInputSchema>
export type EscalateFollowUpTaskInput = z.infer<typeof EscalateFollowUpTaskInputSchema>
