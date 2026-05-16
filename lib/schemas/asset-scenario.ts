import { z } from 'zod';

export const AssetScenarioSchema = z.object({
  id: z.string().uuid(),
  asset_id: z.string().uuid(),
  name: z.string(),
  sort_order: z.number(),
  is_primary: z.boolean(),
  fsi_potential: z.number().nullable(),
  development_potential_sqm: z.number().nullable(),
  rehab_area_sqm: z.number().nullable(),
  sale_area_sqm: z.number().nullable(),
  sale_rate_psf: z.number().nullable(),
  initial_investment_cr: z.number().nullable(),
  topline_cr: z.number().nullable(),
  profit_cr: z.number().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().uuid().nullable(),
});
export type AssetScenario = z.infer<typeof AssetScenarioSchema>;

export const ScenarioValuesSchema = z.object({
  fsi_potential: z.number().nullable(),
  development_potential_sqm: z.number().nullable(),
  rehab_area_sqm: z.number().nullable(),
  sale_area_sqm: z.number().nullable(),
  sale_rate_psf: z.number().nullable(),
  initial_investment_cr: z.number().nullable(),
  topline_cr: z.number().nullable(),
  profit_cr: z.number().nullable(),
});
export type ScenarioValues = z.infer<typeof ScenarioValuesSchema>;
