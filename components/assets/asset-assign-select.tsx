'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircle2 } from 'lucide-react';
import { assignAsset } from '@/lib/actions/assets';
import type { TeamMemberOption } from '@/lib/queries/tasks';

type Props = {
  assetId: string;
  assignedTo: string | null | undefined;
  teamMembers: TeamMemberOption[];
  variant?: 'table' | 'detail';
};

export function AssetAssignSelect({ assetId, assignedTo, teamMembers, variant = 'table' }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const current = teamMembers.find((m) => m.id === assignedTo);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    startTransition(async () => {
      await assignAsset(assetId, val === '' ? null : val);
      router.refresh();
    });
  }

  if (variant === 'detail') {
    return (
      <div className="flex items-center gap-2">
        <UserCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <select
          value={assignedTo ?? ''}
          disabled={isPending}
          onChange={handleChange}
          className="flex-1 h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        >
          <option value="">Unassigned</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>
      </div>
    );
  }

  // table variant — compact
  return (
    <select
      value={assignedTo ?? ''}
      disabled={isPending}
      onChange={handleChange}
      className="h-7 max-w-[130px] rounded-full border px-2.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer text-muted-foreground"
      title={current ? `Assigned to ${current.full_name}` : 'Unassigned'}
    >
      <option value="">— Unassigned</option>
      {teamMembers.map((m) => (
        <option key={m.id} value={m.id}>{m.full_name}</option>
      ))}
    </select>
  );
}
