import { z } from 'zod';

export const AssetStatusEnum = z.enum([
  'evaluating',
  'evaluated',
  'won',
  'dropped',
]);
export type AssetStatus = z.infer<typeof AssetStatusEnum>;

export const AssetTemperatureEnum = z.enum(['hot', 'warm', 'cold', 'none']);
export type AssetTemperature = z.infer<typeof AssetTemperatureEnum>;

export const AssetTypeEnum = z.enum([
  'redevelopment',
  'outright',
  'jv_jd',
  'sra',
  'mhada_redevelopment',
  'open_land',
  'funding',
  'other',
]);
export type AssetType = z.infer<typeof AssetTypeEnum>;

export const AssetSchema = z.object({
  id: z.string().uuid(),
  property_name: z.string(),
  location: z.string().nullable(),
  status: AssetStatusEnum,
  temperature: AssetTemperatureEnum,
  asset_type: AssetTypeEnum.nullable(),
  spoc_agent: z.string().nullable(),
  resource: z.string().nullable(),
  handover_notes: z.string().nullable(),
  plot_size_sqm: z.number().nullable(),
  fsi_potential: z.number().nullable(),
  regulations: z.array(z.string()),
  regulation_notes: z.string().nullable(),
  development_potential_sqm: z.number().nullable(),
  rehab_area_sqm: z.number().nullable(),
  sale_area_sqm: z.number().nullable(),
  sale_rate_psf: z.number().nullable(),
  initial_investment_cr: z.number().nullable(),
  profit_cr: z.number().nullable(),
  topline_cr: z.number().nullable(),
  next_step: z.string().nullable(),
  converted_to_engagement_id: z.string().uuid().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid(),
  updated_at: z.string(),
  updated_by: z.string().uuid().nullable(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().uuid().nullable(),
  assigned_to: z.string().uuid().nullable().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const AssetCreateSchema = AssetSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  updated_by: true,
  deleted_at: true,
  deleted_by: true,
  converted_to_engagement_id: true,
}).partial({
  location: true,
  temperature: true,
  asset_type: true,
  spoc_agent: true,
  resource: true,
  handover_notes: true,
  plot_size_sqm: true,
  fsi_potential: true,
  regulations: true,
  regulation_notes: true,
  development_potential_sqm: true,
  rehab_area_sqm: true,
  sale_area_sqm: true,
  sale_rate_psf: true,
  initial_investment_cr: true,
  profit_cr: true,
  topline_cr: true,
  next_step: true,
});
export type AssetCreate = z.infer<typeof AssetCreateSchema>;
