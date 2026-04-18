import { z } from 'zod';

export const DeveloperSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  contact_person: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  notes: z.string().nullable(),
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
});
export type DeveloperCreate = z.infer<typeof DeveloperCreateSchema>;

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
