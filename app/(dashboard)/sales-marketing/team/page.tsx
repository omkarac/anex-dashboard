import { Metadata } from 'next';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { listTeamMembers } from '@/lib/queries/team';
import { TeamPanel } from '@/components/team/team-panel';

export const metadata: Metadata = { title: 'Team — Anex' };

export default async function TeamPage() {
  const me = await getAuthenticatedMember();
  const isAdmin = me.role === 'admin';
  const members = await listTeamMembers().catch(() => []);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {members.length} member{members.length !== 1 ? 's' : ''} · new members join automatically on first login
        </p>
      </div>
      <TeamPanel members={members} currentUserId={me.id} isAdmin={isAdmin} />
    </div>
  );
}
