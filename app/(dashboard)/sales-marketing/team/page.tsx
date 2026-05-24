import { Metadata } from 'next';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { listTeamMembers, getActiveTeamMembers } from '@/lib/queries/team';
import { getOrphanedWork } from '@/lib/queries/orphaned';
import { TeamPanel } from '@/components/team/team-panel';
import { OrphanedWorkPanel } from '@/components/team/orphaned-work-panel';

export const metadata: Metadata = { title: 'Team — Anex' };
export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const me = await getAuthenticatedMember();
  // Member management (role/department/status/approval) is strict admin-only,
  // matching the server-side guards in lib/actions/team.ts.
  const isAdmin = me.role === 'admin';
  const [members, orphaned, activeMembers] = await Promise.all([
    listTeamMembers().catch(() => []),
    getOrphanedWork().catch(() => []),
    getActiveTeamMembers().catch(() => []),
  ]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {members.length} member{members.length !== 1 ? 's' : ''} · new members wait for admin approval before they can sign in
        </p>
      </div>
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        <OrphanedWorkPanel
          items={orphaned}
          activeMembers={activeMembers}
          currentUserId={me.id}
          isAdmin={isAdmin}
        />
        <TeamPanel members={members} currentUserId={me.id} isAdmin={isAdmin} embedded />
      </div>
    </div>
  );
}
