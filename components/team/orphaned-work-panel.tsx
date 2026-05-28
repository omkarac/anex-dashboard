'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reassignOrphanedItem } from '@/lib/actions/handover';
import type { OrphanedItem, OrphanedKind } from '@/lib/queries/orphaned';

type MemberOption = { id: string; full_name: string };

type Props = {
  items: OrphanedItem[];
  activeMembers: MemberOption[];
  currentUserId: string;
  isAdmin: boolean;
};

const KIND_LABELS: Record<OrphanedKind, string> = {
  task: 'Task',
  asset: 'Asset',
  follow_up: 'Follow-up',
  lead: 'Lead',
};

const KIND_BADGE: Record<OrphanedKind, string> = {
  task: 'bg-blue-50 text-blue-700 border border-blue-200',
  asset: 'bg-teal-50 text-teal-700 border border-teal-200',
  follow_up: 'bg-violet-50 text-violet-700 border border-violet-200',
  lead: 'bg-amber-50 text-amber-700 border border-amber-200',
};

function ItemRow({
  item,
  activeMembers,
  currentUserId,
  isAdmin,
}: {
  item: OrphanedItem;
  activeMembers: MemberOption[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function act(toMemberId: string) {
    if (!toMemberId) return;
    setError(null);
    startTransition(async () => {
      const res = await reassignOrphanedItem({
        kind: item.kind,
        id: item.id,
        toMemberId,
        projectId: item.projectId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${KIND_BADGE[item.kind]}`}>
            {KIND_LABELS[item.kind]}
          </span>
          {item.href ? (
            <a href={item.href} className="text-sm font-medium truncate hover:underline">
              {item.title}
            </a>
          ) : (
            <span className="text-sm font-medium truncate">{item.title}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {item.subtitle ? `${item.subtitle} · ` : ''}was {item.formerOwnerName}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {error && <span className="text-[11px] text-[#B91C1C] max-w-[160px] text-right">{error}</span>}
        <button
          type="button"
          onClick={() => act(currentUserId)}
          disabled={isPending}
          className="h-7 rounded-md border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40"
        >
          {isPending ? '…' : 'Claim'}
        </button>
        {isAdmin && (
          <select
            defaultValue=""
            onChange={(e) => act(e.target.value)}
            disabled={isPending}
            className="h-7 rounded border border-input bg-background px-2 text-xs disabled:opacity-50"
          >
            <option value="" disabled>
              Reassign to…
            </option>
            {activeMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export function OrphanedWorkPanel({ items, activeMembers, currentUserId, isAdmin }: Props) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-[#B91C1C]/30 overflow-hidden">
      <div className="px-4 py-2 bg-[#B91C1C]/10 border-b border-[#B91C1C]/20 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#B91C1C]">
          Orphaned Work
        </h2>
        <span className="text-xs text-muted-foreground">
          {items.length} item{items.length !== 1 ? 's' : ''} from offboarded members · claim or reassign
        </span>
      </div>
      <div className="scroll-visible max-h-60 overflow-y-scroll">
        {items.map((it) => (
          <ItemRow
            key={`${it.kind}:${it.id}`}
            item={it}
            activeMembers={activeMembers}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  );
}
