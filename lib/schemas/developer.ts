import { z } from 'zod';

export const DeveloperSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  contact_person: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  notes: z.string().nullable(),
  logo_url: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
});
export type Developer = z.infer<typeof DeveloperSchema>;

export const DeveloperCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional().nullable(),
  contact_email: z.string().optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  logo_url: z.string().optional().nullable(),
});
export type DeveloperCreate = z.infer<typeof DeveloperCreateSchema>;

export const DeveloperPreferencesSchema = z.object({
  developer_id: z.string().uuid(),
  preferred_micro_markets: z.array(z.string()).default([]),
  preferred_asset_types: z.array(z.string()).default([]),
  preferred_regulations: z.array(z.string()).default([]),
  plot_size_min_sqm: z.number().nullable(),
  plot_size_max_sqm: z.number().nullable(),
  topline_min_cr: z.number().nullable(),
  topline_max_cr: z.number().nullable(),
  initial_investment_min_cr: z.number().nullable(),
  initial_investment_max_cr: z.number().nullable(),
  development_potential_min_sqm: z.number().nullable(),
  development_potential_max_sqm: z.number().nullable(),
  appetite_notes: z.string().nullable(),
  updated_at: z.string(),
  updated_by: z.string().uuid().nullable(),
});
export type DeveloperPreferences = z.infer<typeof DeveloperPreferencesSchema>;

export const DeveloperPreferencesUpsertSchema = z.object({
  preferred_micro_markets: z.array(z.string()).default([]),
  preferred_asset_types: z.array(z.string()).default([]),
  preferred_regulations: z.array(z.string()).default([]),
  plot_size_min_sqm: z.number().nullable().optional(),
  plot_size_max_sqm: z.number().nullable().optional(),
  topline_min_cr: z.number().nullable().optional(),
  topline_max_cr: z.number().nullable().optional(),
  initial_investment_min_cr: z.number().nullable().optional(),
  initial_investment_max_cr: z.number().nullable().optional(),
  development_potential_min_sqm: z.number().nullable().optional(),
  development_potential_max_sqm: z.number().nullable().optional(),
  appetite_notes: z.string().nullable().optional(),
});
export type DeveloperPreferencesUpsert = z.infer<typeof DeveloperPreferencesUpsertSchema>;

export const DeveloperShareSchema = z.object({
  id: z.string().uuid(),
  asset_id: z.string().uuid(),
  developer_id: z.string().uuid(),
  shared_at: z.string(),
  shared_by: z.string().uuid(),
  outcome: z.string().nullable(),
  outcome_at: z.string().nullable(),
  notes: z.string().nullable(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().uuid().nullable(),
});
export type DeveloperShare = z.infer<typeof DeveloperShareSchema>;
