import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { AppShell } from '@/components/shared/app-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const service = createServiceClient();

  let { data: member } = await service
    .from('team_members')
    .select('id, full_name, email, role, is_active, created_at')
    .eq('id', user.id)
    .single();

  // Safety net: provision row if callback insert was missed
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
      .select('id, full_name, email, role, is_active, created_at')
      .single();

    member = inserted;
  }

  if (!member || !member.is_active) redirect('/login');

  return <AppShell member={member}>{children}</AppShell>;
}
