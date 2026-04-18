import { z } from 'zod';

export const EngagementKindEnum = z.enum(['mandate', 'pmc_pmas']);
export type EngagementKind = z.infer<typeof EngagementKindEnum>;

export const EngagementSchema = z.object({
  id: z.string().uuid(),
  asset_id: z.string().uuid(),
  kind: EngagementKindEnum,
  started_at: z.string(),
  ended_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid(),
});
export type Engagement = z.infer<typeof EngagementSchema>;

export const EngagementCreateSchema = z.object({
  kind: EngagementKindEnum,
  started_at: z.string().min(1, 'Start date is required'),
  notes: z.string().optional(),
});
export type EngagementCreate = z.infer<typeof EngagementCreateSchema>;
