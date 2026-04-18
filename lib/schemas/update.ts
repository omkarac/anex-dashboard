import { z } from 'zod';

export const UpdateSchema = z.object({
  id: z.string().uuid(),
  asset_id: z.string().uuid(),
  body: z.string().min(1),
  created_at: z.string(),
  created_by: z.string().uuid(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().uuid().nullable(),
});
export type Update = z.infer<typeof UpdateSchema>;
