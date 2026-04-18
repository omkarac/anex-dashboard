import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/shared/app-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: dbMember } = await supabase
    .from('team_members')
    .select('id, full_name, email, role, is_active, created_at')
    .eq('id', user.id)
    .single();

  if (!dbMember || !dbMember.is_active) redirect('/login');

  const member = dbMember;

  return <AppShell member={member}>{children}</AppShell>;
}
