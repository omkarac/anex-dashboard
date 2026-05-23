'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { convertToEngagement } from '@/lib/actions/engagements';
import { istTodayISO } from '@/lib/utils/formatters';
import { ENGAGEMENT_KIND_LABELS } from '@/lib/enums/engagement';
import type { EngagementKind } from '@/lib/schemas/engagement';

const KIND_OPTIONS: EngagementKind[] = ['mandate', 'pmc_pmas'];

type Props = { assetId: string };

export function ConvertDialog({ assetId }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EngagementKind>('mandate');
  const [startedAt, setStartedAt] = useState(() => istTodayISO());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startedAt) { setError('Start date is required'); return; }
    setError(null);
    startTransition(async () => {
      const result = await convertToEngagement(assetId, kind, startedAt, notes);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="default" onClick={() => setOpen(true)}>
        <ArrowRightCircle className="mr-1.5 h-4 w-4" />
        Convert to Engagement
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Convert to Engagement</SheetTitle>
            <SheetDescription>Mark this asset as won and create an engagement record.</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kind">Engagement Type *</Label>
              <select
                id="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as EngagementKind)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {KIND_OPTIONS.map((k) => (
                  <option key={k} value={k}>{ENGAGEMENT_KIND_LABELS[k]}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="started_at">Start Date *</Label>
              <input
                id="started_at"
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any context for this engagement..."
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <SheetFooter className="p-0 mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={isPending || !startedAt}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Convert
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
