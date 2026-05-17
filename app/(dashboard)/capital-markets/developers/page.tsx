import { Metadata } from 'next';
import { listDevelopers, getUnassignedTasks, getMyTasks } from '@/lib/queries/developers';

export const dynamic = 'force-dynamic';
import { getActiveTeamMembers } from '@/lib/queries/team';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { DevelopersView } from '@/components/developers/developers-view';

export const metadata: Metadata = { title: 'Developers — Anex' };

export default async function DevelopersPage() {
  const me = await getAuthenticatedMember();
  const [developers, unassignedTasks, myTasks, members] = await Promise.all([
    listDevelopers().catch(() => []),
    getUnassignedTasks().catch(() => []),
    getMyTasks(me.id).catch(() => []),
    getActiveTeamMembers().catch(() => []),
  ]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Developers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          External developers and their engagement across your assets
        </p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <DevelopersView
          developers={developers}
          unassignedTasks={unassignedTasks}
          myTasks={myTasks}
          members={members}
        />
      </div>
    </div>
  );
}
