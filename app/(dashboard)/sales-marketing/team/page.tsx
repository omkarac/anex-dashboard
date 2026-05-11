import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { listTeamMembers } from '@/lib/queries/team';
import { MemberRow } from '@/components/team/member-row';

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
  const active = members.filter((m) => m.is_active);
  const inactive = members.filter((m) => !m.is_active);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Team</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {members.length} member{members.length !== 1 ? 's' : ''} · new members join automatically on first login
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">Role</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Open Tasks</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">SPOC Assets</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Status</th>
                <th className="px-4 py-2.5 w-28" />
              </tr>
            </thead>
            <tbody>
              {active.map((m) => (
                <MemberRow key={m.id} member={m} currentUserId={currentUserId} isCurrentUserAdmin={isAdmin} />
              ))}
            </tbody>
          </table>
        </div>

        {inactive.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <div className="px-4 py-2 bg-muted/30 border-b">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Inactive Members
              </h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {inactive.map((m) => (
                  <MemberRow key={m.id} member={m} currentUserId={currentUserId} isCurrentUserAdmin={isAdmin} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
