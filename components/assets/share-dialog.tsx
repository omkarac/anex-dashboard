'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { shareWithDeveloper } from '@/lib/actions/developers';
import type { DeveloperOption } from '@/lib/queries/developers';

type Props = {
  assetId: string;
  developers: DeveloperOption[];
};

export function ShareDialog({ assetId, developers }: Props) {
  const [open, setOpen] = useState(false);
  const [developerId, setDeveloperId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!developerId) { setError('Please select a developer'); return; }
    setError(null);
    startTransition(async () => {
      const result = await shareWithDeveloper(assetId, developerId, notes);
      if (result.ok) {
        setOpen(false);
        setDeveloperId('');
        setNotes('');
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="mr-1.5 h-4 w-4" />
        Share with Developer
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Share with Developer</SheetTitle>
            <SheetDescription>Send this asset to a developer for evaluation.</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="developer">Developer *</Label>
              {developers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No developers yet — add one on the Developers page first.</p>
              ) : (
                <select
                  id="developer"
                  value={developerId}
                  onChange={(e) => setDeveloperId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— Select developer —</option>
                  {developers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any context for this share..."
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <SheetFooter className="p-0 mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={isPending || !developerId}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Share
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
