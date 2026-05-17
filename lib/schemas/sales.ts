// lib/schemas/sales.ts
// All Zod schemas for the Sales & Marketing vertical
// These are the SINGLE SOURCE OF TRUTH for validation.
// DB types, form validation, and server action inputs all use these.

import { z } from 'zod'

// ── Enum schemas (match DB enums exactly) ────────────────────────────────────

export const LeadStatusSchema = z.enum(['hot', 'warm', 'cold', 'lost', 'booked'])
export const LeadSourceSchema = z.enum(['cp', 'direct'])
export const MeetingTypeSchema = z.enum(['obm', 'ibm'])
export const MeetingCatSchema = z.enum(['unique', 'repeat'])
export const ConfigSchema = z.enum(['1bhk', '2bhk', '3bhk', '2bhk_jodi', 'duplex', '2_3bhk', 'commercial'])
export const CpCategorySchema = z.enum(['icp', 'rcp', 'cp'])
export const CpStageSchema = z.enum(['prospect', 'active', 'inactive'])
export const CpSubStageSchema = z.enum(['high_potential', 'low_potential', 'walkin_active', 'sourcing_active', 'inactive'])
export const LostReasonSchema = z.enum([
  'not_responding', 'budget', 'booked_elsewhere', 'plan_dropped', 'didnt_like_project',
  'layout_issue', 'requirement_mismatch', 'not_interested', 'general_enquiry',
  'location_issue', 'floor_issue', 'possession_timeline', 'vaastu_issue', 'view_issue', 'other'
])
export const AgeBracketSchema = z.enum(['below_25', '25_30', '31_40', '41_50', '51_60', 'above_60'])
export const PurposeSchema = z.enum(['self_use', 'investment', 'both'])
export const EmploymentSchema = z.enum(['salaried', 'self_employed', 'business_owner', 'retired', 'student', 'other'])
export const VisitTypeSchema = z.enum(['site_visit', 'home_visit', 'video_call', 'office_visit'])
export const CpFirmTypeSchema = z.enum(['individual', 'private_limited', 'public_limited', 'partnership', 'llp', 'proprietorship'])
export const ZoneSchema = z.enum(['kdmc', 'thane', 'central', 'navi_mumbai', 'south_mumbai', 'western_suburbs', 'eastern_suburbs', 'other'])

// ── Utility schemas ──────────────────────────────────────────────────────────

// Mobile must be 10 digits after normalization
export const MobileSchema = z.string()
  .transform(v => v.replace(/\D/g, ''))
  .refine(v => {
    if (v.length === 12 && v.startsWith('91')) return true
    if (v.length === 11 && v.startsWith('0')) return true
    if (v.length === 10) return true
    return false
  }, 'Invalid mobile number')
  .transform(v => {
    if (v.length === 12) return v.slice(2)
    if (v.length === 11) return v.slice(1)
    return v
  })

// ── Sales Projects ────────────────────────────────────────────────────────────

export const SalesProjectSchema = z.object({
  id: z.string().uuid(),
  asset_id: z.string().uuid().nullable(),
  name: z.string().min(1),
  location: z.string().nullable(),
  developer_name: z.string().nullable(),
  launch_date: z.string().nullable(),
  available_configs: z.array(ConfigSchema),
  price_min: z.number().nullable(),
  price_max: z.number().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  created_by: z.string().uuid(),
})

export const CreateProjectInputSchema = z.object({
  asset_id: z.string().uuid().optional(),
  name: z.string().min(1, 'Project name is required'),
  location: z.string().optional(),
  developer_name: z.string().optional(),
  launch_date: z.string().optional(),
  available_configs: z.array(ConfigSchema).default([]),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
})

// ── Channel Partners ──────────────────────────────────────────────────────────

export const ChannelPartnerSchema = z.object({
  id: z.string().uuid(),
  canonical_name: z.string(),
  aliases: z.array(z.string()),
  rera_number: z.string().nullable(),
  pan_number: z.string().nullable(),
  gst_number: z.string().nullable(),
  mobile_primary: z.string().nullable(),
  mobile_alternate: z.string().nullable(),
  email: z.string().nullable(),
  firm_type: CpFirmTypeSchema,
  category: CpCategorySchema,
  zone: ZoneSchema.nullable(),
  sub_zone: z.string().nullable(),
  micromarket: z.string().nullable(),
  business_model: z.array(z.string()),
  team_size: z.number().int().nullable(),
  other_developers: z.string().nullable(),
  rera_cert_url: z.string().nullable(),
  pan_url: z.string().nullable(),
  gst_url: z.string().nullable(),
  rera_competency_url: z.string().nullable(),
  is_rera_verified: z.boolean(),
  is_pan_verified: z.boolean(),
  is_active: z.boolean(),
  is_approved: z.boolean(),
  stage: CpStageSchema,
  created_at: z.string(),
  created_by: z.string().uuid(),
  updated_at: z.string(),
  updated_by: z.string().uuid().nullable(),
})

export const RegisterCpInputSchema = z.object({
  canonical_name: z.string().min(2, 'Name must be at least 2 characters'),
  aliases: z.array(z.string()).default([]),
  rera_number: z.string().optional(),
  pan_number: z.string().optional(),
  gst_number: z.string().optional(),
  mobile_primary: MobileSchema.optional(),
  mobile_alternate: MobileSchema.optional(),
  email: z.string().email().optional(),
  firm_type: CpFirmTypeSchema.default('individual'),
  category: CpCategorySchema.default('cp'),
  zone: ZoneSchema.optional(),
  sub_zone: z.string().optional(),
  micromarket: z.string().optional(),
  business_model: z.array(z.string()).default([]),
})

export const UpdateCpInputSchema = RegisterCpInputSchema.partial()

// ── CP Meetings ───────────────────────────────────────────────────────────────

export const CpMeetingSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  cp_id: z.string().uuid(),
  sm_id: z.string().uuid(),
  meeting_date: z.string(),
  meeting_type: MeetingTypeSchema,
  meeting_category: MeetingCatSchema,
  place_from: z.string().nullable(),
  place_to: z.string().nullable(),
  travel_mode: z.string().nullable(),
  km_travelled: z.number().nullable(),
  is_interested: z.boolean().nullable(),
  nri_lead: z.boolean(),
  rating: z.number().int().min(1).max(5).nullable(),
  feedback: z.string().nullable(),
  cp_stage_updated_to: CpStageSchema.nullable(),
  created_at: z.string(),
  created_by: z.string().uuid(),
})

export const CreateMeetingInputSchema = z.object({
  project_id: z.string().uuid(),
  cp_id: z.string().uuid('Please select a CP from the list'),
  meeting_date: z.string().default(() => new Date().toISOString().split('T')[0]),
  meeting_type: MeetingTypeSchema,
  // meeting_category is NOT here — computed server-side
  place_from: z.string().optional(),
  place_to: z.string().optional(),
  travel_mode: z.string().optional(),
  km_travelled: z.number().positive().optional(),
  is_interested: z.boolean().optional(),
  nri_lead: z.boolean().default(false),
  rating: z.number().int().min(1).max(5).optional(),
  feedback: z.string().max(2000).optional(),
  cp_stage_updated_to: CpStageSchema.optional(),
})

// ── EOD Reports ───────────────────────────────────────────────────────────────

export const CreateEodInputSchema = z.object({
  project_id: z.string().uuid(),
  report_date: z.string().default(() => new Date().toISOString().split('T')[0]),
  calls_dialled: z.number().int().min(0).default(0),
  calls_connected: z.number().int().min(0).default(0),
  notes: z.string().max(1000).optional(),
  // meeting counts are NOT here — computed server-side from cp_meetings
})

// ── Clients ───────────────────────────────────────────────────────────────────

export const ClientSchema = z.object({
  id: z.string().uuid(),
  mobile_primary: z.string(),
  mobile_alternate: z.string().nullable(),
  salutation: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().nullable(),
  alternate_email: z.string().nullable(),
  age_bracket: AgeBracketSchema.nullable(),
  gender: z.string().nullable(),
  occupation: z.string().nullable(),
  employment_type: EmploymentSchema.nullable(),
  designation: z.string().nullable(),
  marital_status: z.string().nullable(),
  family_size: z.number().int().nullable(),
  household_income: z.string().nullable(),
  highest_education: z.string().nullable(),
  ethnicity: z.string().nullable(),
  residential_address: z.record(z.string(), z.unknown()).nullable(),
  office_address: z.record(z.string(), z.unknown()).nullable(),
  company_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const UpsertClientInputSchema = z.object({
  mobile_primary: MobileSchema,
  mobile_alternate: MobileSchema.optional(),
  salutation: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  alternate_email: z.string().email().optional(),
  age_bracket: AgeBracketSchema.optional(),
  gender: z.string().optional(),
  occupation: z.string().optional(),
  employment_type: EmploymentSchema.optional(),
  ethnicity: z.string().optional(),
  residential_address: z.object({
    flat_no: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pin: z.string().optional(),
    locality: z.string().optional(),
  }).optional(),
  company_name: z.string().optional(),
})

// ── Walk-ins ──────────────────────────────────────────────────────────────────

export const WalkInSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  client_id: z.string().uuid(),
  source: LeadSourceSchema,
  sub_source: z.string().nullable(),
  cp_id: z.string().uuid().nullable(),
  referrer_name: z.string().nullable(),
  sourcing_sm_id: z.string().uuid().nullable(),
  closing_sm_id: z.string().uuid().nullable(),
  configuration: ConfigSchema.nullable(),
  budget: z.string().nullable(),
  carpet_area: z.number().nullable(),
  construction_status_pref: z.string().nullable(),
  purpose: PurposeSchema.nullable(),
  possession_timeframe: z.string().nullable(),
  current_residence_status: z.string().nullable(),
  status: LeadStatusSchema,
  latest_remark: z.string().nullable(),
  latest_remark_date: z.string().nullable(),
  lost_reason: LostReasonSchema.nullable(),
  tele_caller_remark: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  created_by: z.string().uuid(),
  updated_at: z.string(),
  updated_by: z.string().uuid().nullable(),
})

export const WalkInIntakeInputSchema = z.object({
  project_id: z.string().uuid(),
  // Step 1 — client
  mobile: MobileSchema,
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  accompanied_by: z.enum(['alone', 'family', 'friends']).optional(),
  // Step 3 — source
  source: LeadSourceSchema,
  sub_source: z.string().optional(),
  cp_id: z.string().uuid().optional(),  // required if source = 'cp'
  referrer_name: z.string().optional(),
  // Step 4 — requirements
  configuration: ConfigSchema.optional(),
  budget: z.string().optional(),
  purpose: PurposeSchema.optional(),
  possession_timeframe: z.string().optional(),
  current_residence_status: z.string().optional(),
  // Step 5 — demographics
  age_bracket: AgeBracketSchema.optional(),
  occupation: z.string().optional(),
  employment_type: EmploymentSchema.optional(),
  ethnicity: z.string().optional(),
  // Step 6 — visit
  visit_type: VisitTypeSchema.default('site_visit'),
  assigned_sm_id: z.string().uuid().optional(),
  gre_remarks: z.string().optional(),
}).refine(
  data => data.source !== 'cp' || data.cp_id !== undefined,
  { message: 'CP is required when source is CP', path: ['cp_id'] }
)

export const UpdateWalkInStatusInputSchema = z.object({
  walk_in_id: z.string().uuid(),
  status: LeadStatusSchema,
  remark: z.string().min(1, 'Please add a remark when updating status'),
  lost_reason: LostReasonSchema.optional(),
}).refine(
  data => data.status !== 'lost' || data.lost_reason !== undefined,
  { message: 'Lost reason is required when marking as lost', path: ['lost_reason'] }
)

export const SiteVisitFeedbackInputSchema = z.object({
  visit_id: z.string().uuid(),
  checklist_show_flat: z.boolean().optional(),
  checklist_sample_flat: z.boolean().optional(),
  checklist_av_video: z.boolean().optional(),
  checklist_unit_plan: z.boolean().optional(),
  checklist_pricing_discussion: z.boolean().optional(),
  checklist_site_tour: z.boolean().optional(),
  opportunity_stage: z.string().optional(),
  opportunity_sub_stage: z.string().optional(),
  sub_stage_reason: z.string().optional(),
  next_followup_date: z.string().optional(),
  proposed_revisit_date: z.string().optional(),
  comments: z.string().max(3000).optional(),
})

// ── Types inferred from schemas ───────────────────────────────────────────────
export type LeadStatus = z.infer<typeof LeadStatusSchema>
export type LeadSource = z.infer<typeof LeadSourceSchema>
export type MeetingType = z.infer<typeof MeetingTypeSchema>
export type MeetingCategory = z.infer<typeof MeetingCatSchema>
export type Config = z.infer<typeof ConfigSchema>
export type CpCategory = z.infer<typeof CpCategorySchema>
export type CpStage = z.infer<typeof CpStageSchema>
export type LostReason = z.infer<typeof LostReasonSchema>
export type Purpose = z.infer<typeof PurposeSchema>
export type CpFirmType = z.infer<typeof CpFirmTypeSchema>
export type Zone = z.infer<typeof ZoneSchema>
export type SalesProject = z.infer<typeof SalesProjectSchema>
export type ChannelPartner = z.infer<typeof ChannelPartnerSchema>
// Use z.input<> so fields with .default() are optional in form calls
export type RegisterCpInput = z.input<typeof RegisterCpInputSchema>
export type UpdateCpInput = z.input<typeof UpdateCpInputSchema>
export type CpMeeting = z.infer<typeof CpMeetingSchema>
export type CreateMeetingInput = z.input<typeof CreateMeetingInputSchema>
export type CreateEodInput = z.input<typeof CreateEodInputSchema>
export type Client = z.infer<typeof ClientSchema>
export type UpsertClientInput = z.input<typeof UpsertClientInputSchema>
export type WalkIn = z.infer<typeof WalkInSchema>
export type WalkInIntakeInput = z.input<typeof WalkInIntakeInputSchema>
export type UpdateWalkInStatusInput = z.infer<typeof UpdateWalkInStatusInputSchema>
export type SiteVisitFeedbackInput = z.infer<typeof SiteVisitFeedbackInputSchema>
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>
