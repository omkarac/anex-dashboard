'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { updateMemberRole, setMemberActive, updateMemberName, updateMemberDepartment } from '@/lib/actions/team';
import type { TeamMemberWithWorkload, MemberDepartment } from '@/lib/queries/team';

type Props = {
  member: TeamMemberWithWorkload;
  currentUserId: string;
  isCurrentUserAdmin: boolean;
};

const DEPARTMENT_LABELS: Record<NonNullable<MemberDepartment>, string> = {
  cm: 'Capital Markets',
  sm: 'Sales & Marketing',
  both: 'Both',
};

const DEPARTMENT_BADGE: Record<NonNullable<MemberDepartment>, string> = {
  cm: 'bg-blue-50 text-blue-700 border border-blue-200',
  sm: 'bg-violet-50 text-violet-700 border border-violet-200',
  both: 'bg-teal-50 text-teal-700 border border-teal-200',
};

export function MemberRow({ member, currentUserId, isCurrentUserAdmin }: Props) {
  const [isPending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(member.full_name);
  const router = useRouter();

  const isSelf = member.id === currentUserId;
  const canEdit = isCurrentUserAdmin || isSelf;

  function saveRole(role: 'admin' | 'member') {
    startTransition(async () => {
      await updateMemberRole(member.id, role);
      router.refresh();
    });
  }

  function saveDepartment(department: MemberDepartment) {
    startTransition(async () => {
      await updateMemberDepartment(member.id, department);
      router.refresh();
    });
  }

  function toggleActive(active: boolean) {
    startTransition(async () => {
      await setMemberActive(member.id, active);
      router.refresh();
    });
  }

  function saveName() {
    if (nameValue.trim() === member.full_name) { setEditingName(false); return; }
    startTransition(async () => {
      const result = await updateMemberName(member.id, nameValue);
      if (result.ok) router.refresh();
      setEditingName(false);
    });
  }

  return (
    <tr className={`group border-b last:border-0 transition-colors hover:bg-muted/20 ${!member.is_active ? 'opacity-50' : ''}`}>
      {/* Avatar + Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
            {member.full_name[0]?.toUpperCase()}
          </div>
          <div>
            {editingName && canEdit ? (
              <div className="flex items-center gap-1.5">
                <Input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="h-7 text-sm w-40 px-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') { setEditingName(false); setNameValue(member.full_name); }
                  }}
                  onBlur={saveName}
                />
              </div>
            ) : (
              <p
                className={`text-sm font-medium ${canEdit ? 'cursor-text hover:underline decoration-dotted' : ''}`}
                onClick={() => canEdit && setEditingName(true)}
              >
                {member.full_name}
                {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        {isCurrentUserAdmin && !isSelf ? (
          <select
            value={member.role}
            onChange={(e) => saveRole(e.target.value as 'admin' | 'member')}
            disabled={isPending}
            className="h-7 rounded border border-input bg-background px-2 text-xs disabled:opacity-50"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        ) : (
          <span className="text-xs capitalize">{member.role}</span>
        )}
      </td>

      {/* Department */}
      <td className="px-4 py-3">
        {isCurrentUserAdmin && !isSelf ? (
          <select
            value={member.department ?? ''}
            onChange={(e) => saveDepartment((e.target.value || null) as MemberDepartment)}
            disabled={isPending}
            className="h-7 rounded border border-input bg-background px-2 text-xs disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            <option value="cm">Capital Markets</option>
            <option value="sm">Sales & Marketing</option>
            <option value="both">Both</option>
          </select>
        ) : member.department ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DEPARTMENT_BADGE[member.department]}`}>
            {DEPARTMENT_LABELS[member.department]}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Workload */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm tabular-nums">{member.open_tasks}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm tabular-nums">{member.spoc_assets}</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        {isCurrentUserAdmin && !isSelf ? (
          <select
            value={member.is_active ? 'active' : 'inactive'}
            onChange={(e) => toggleActive(e.target.value === 'active')}
            disabled={isPending}
            className="h-7 rounded border border-input bg-background px-2 text-xs disabled:opacity-50"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            member.is_active
              ? 'bg-green-50 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {member.is_active ? 'Active' : 'Inactive'}
          </span>
        )}
      </td>

      {/* Actions — empty, controls are inline */}
      <td className="px-4 py-3" />
    </tr>
  );
}
