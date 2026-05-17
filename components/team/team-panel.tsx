import { MemberRow } from '@/components/team/member-row';
import type { TeamMemberWithWorkload } from '@/lib/queries/team';

type Props = {
  members: TeamMemberWithWorkload[];
  currentUserId: string;
  isAdmin: boolean;
};

const TABLE_HEADER = (
  <tr className="border-b bg-muted/30">
    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</th>
    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">Role</th>
    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-40">Department</th>
    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Open Tasks</th>
    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">SPOC Assets</th>
    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Status</th>
    <th className="px-4 py-2.5 w-28" />
  </tr>
);

function Section({
  label,
  accent,
  rows,
  currentUserId,
  isAdmin,
}: {
  label: string;
  accent: string;
  rows: TeamMemberWithWorkload[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className={`px-4 py-2 border-b flex items-center gap-2 ${accent}`}>
        <h2 className="text-xs font-semibold uppercase tracking-wider">
          {label}
        </h2>
        <span className="text-xs text-muted-foreground font-normal">
          {rows.length} member{rows.length !== 1 ? 's' : ''}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>{TABLE_HEADER}</thead>
        <tbody>
          {rows.map((m) => (
            <MemberRow key={m.id} member={m} currentUserId={currentUserId} isCurrentUserAdmin={isAdmin} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TeamPanel({ members, currentUserId, isAdmin }: Props) {
  const active = members.filter((m) => m.is_active);
  const inactive = members.filter((m) => !m.is_active);

  const admins = active.filter((m) => m.role === 'admin');
  const nonAdmins = active.filter((m) => m.role !== 'admin');

  const cm = nonAdmins.filter((m) => m.department === 'cm' || m.department === 'both');
  const sm = nonAdmins.filter((m) => m.department === 'sm' || m.department === 'both');
  const unassigned = nonAdmins.filter((m) => !m.department);

  return (
    <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
      <Section
        label="Admins"
        accent="bg-amber-50/60"
        rows={admins}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
      <Section
        label="Capital Markets"
        accent="bg-blue-50/60"
        rows={cm}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
      <Section
        label="Sales & Marketing"
        accent="bg-violet-50/60"
        rows={sm}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
      {unassigned.length > 0 && (
        <Section
          label="Unassigned"
          accent="bg-muted/30"
          rows={unassigned}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      )}
      {inactive.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Inactive Members
            </h2>
            <span className="text-xs text-muted-foreground">
              {inactive.length} member{inactive.length !== 1 ? 's' : ''}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>{TABLE_HEADER}</thead>
            <tbody>
              {inactive.map((m) => (
                <MemberRow key={m.id} member={m} currentUserId={currentUserId} isCurrentUserAdmin={isAdmin} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
