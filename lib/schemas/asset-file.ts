import { z } from 'zod';

export const AssetFileSchema = z.object({
  id: z.string().uuid(),
  asset_id: z.string().uuid(),
  url: z.string().url(),
  title: z.string(),
  sort_order: z.number().int(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().uuid().nullable(),
});

export type AssetFile = z.infer<typeof AssetFileSchema>;

export const AddAssetFileSchema = z.object({
  assetId: z.string().uuid(),
  url: z.string().url('Please enter a valid URL'),
  title: z.string().optional(),
});

export type AddAssetFileInput = z.infer<typeof AddAssetFileSchema>;
