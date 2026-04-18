import { z } from 'zod';

export const TaskStatusEnum = z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TaskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof TaskPriorityEnum>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  asset_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: TaskStatusEnum,
  priority: TaskPriorityEnum,
  assigned_to: z.string().uuid().nullable(),
  due_date: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().uuid().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  priority: TaskPriorityEnum.optional().default('medium'),
  due_date: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
});
export type TaskCreate = z.infer<typeof TaskCreateSchema>;
