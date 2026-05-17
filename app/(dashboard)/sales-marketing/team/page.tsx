import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { listTeamMembers } from '@/lib/queries/team';
import { TeamPanel } from '@/components/team/team-panel';

export const metadata: Metadata = { title: 'Team — Anex' };

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user.id ?? '';

  const { data: me } = await supabase
    .from('team_members')
    .select('role')
    .eq('id', currentUserId)
    .single();

  const isAdmin = me?.role === 'admin';
  const members = await listTeamMembers().catch(() => []);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {members.length} member{members.length !== 1 ? 's' : ''} · new members join automatically on first login
        </p>
      </div>
      <TeamPanel members={members} currentUserId={currentUserId} isAdmin={isAdmin} />
    </div>
  );
}
