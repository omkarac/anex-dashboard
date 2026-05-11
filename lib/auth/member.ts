import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function getAuthenticatedMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const service = createServiceClient();

  let { data: member } = await service
    .from('team_members')
    .select('id, full_name, email, role, is_active, avatar_url, created_at')
    .eq('id', user.id)
    .single();

  if (!member) {
    const { data: inserted } = await service
      .from('team_members')
      .insert({
        id: user.id,
        full_name: user.email!.split('@')[0],
        email: user.email!,
        role: 'member',
        is_active: true,
      })
      .select('id, full_name, email, role, is_active, avatar_url, created_at')
      .single();

    member = inserted;
  }

  if (!member || !member.is_active) redirect('/login');

  return member;
}
