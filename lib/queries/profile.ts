import { createServiceClient } from '@/lib/supabase/service';

export type ProfileData = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  title: string | null;
  phone: string | null;
  avatar_url: string | null;
  banner_color: string | null;
  created_at: string;
};

export type ProfileAsset = {
  id: string;
  property_name: string;
  location: string | null;
  status: string;
  updated_at: string;
};

export type ProfileTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  asset_id: string;
  asset_name: string;
};

export type ProfileStats = {
  assigned_assets: number;
  open_tasks: number;
  activity_this_month: number;
};

export async function getProfileData(userId: string): Promise<ProfileData | null> {
  const service = createServiceClient();
  const { data } = await service
    .from('team_members')
    .select('*')
    .eq('id', userId)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    role: data.role,
    title: (data as Record<string, unknown>).title as string | null ?? null,
    phone: (data as Record<string, unknown>).phone as string | null ?? null,
    avatar_url: (data as Record<string, unknown>).avatar_url as string | null ?? null,
    banner_color: (data as Record<string, unknown>).banner_color as string | null ?? null,
    created_at: data.created_at,
  };
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const service = createServiceClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [assets, tasks, activity] = await Promise.all([
    service.from('assets').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).is('deleted_at', null),
    service.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).is('completed_at', null).is('deleted_at', null),
    service.from('activity_logs').select('id', { count: 'exact', head: true }).eq('actor_id', userId).gte('created_at', monthStart.toISOString()),
  ]);

  return {
    assigned_assets: assets.count ?? 0,
    open_tasks: tasks.count ?? 0,
    activity_this_month: activity.count ?? 0,
  };
}

export async function getMyAssets(userId: string): Promise<ProfileAsset[]> {
  const service = createServiceClient();
  const { data } = await service
    .from('assets')
    .select('id, property_name, location, status, updated_at')
    .eq('assigned_to', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(8);
  return (data ?? []) as ProfileAsset[];
}

export async function getMyTasks(userId: string): Promise<ProfileTask[]> {
  const service = createServiceClient();
  const { data } = await service
    .from('tasks')
    .select('id, title, status, priority, due_date, asset_id, assets(property_name)')
    .eq('assigned_to', userId)
    .is('completed_at', null)
    .is('deleted_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(10);

  return ((data ?? []) as unknown[]).map((r: unknown) => {
    const row = r as { id: string; title: string; status: string; priority: string; due_date: string | null; asset_id: string; assets: { property_name: string } | null };
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      due_date: row.due_date,
      asset_id: row.asset_id,
      asset_name: row.assets?.property_name ?? 'Unknown',
    };
  });
}
