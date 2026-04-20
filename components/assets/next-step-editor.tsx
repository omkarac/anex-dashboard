'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { updateAssetNextStep } from '@/lib/actions/assets';

export function NextStepEditor({
  assetId,
  initialValue,
}: {
  assetId: string;
  initialValue: string | null | undefined;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setValue(initialValue ?? '');
    setEditing(false);
    setError(null);
  }

  function save() {
    startTransition(async () => {
      const result = await updateAssetNextStep(assetId, value.trim());
      if (result.ok) {
        setEditing(false);
        setError(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Next Step
        </h2>
        {!editing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-muted-foreground"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-muted-foreground"
              onClick={cancel}
              disabled={isPending}
            >
              <X className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              className="h-6 px-2"
              onClick={save}
              disabled={isPending}
            >
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive mb-2">{error}</p>}

      {editing ? (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Describe the next step..."
          className="text-sm min-h-[80px] resize-none"
          autoFocus
        />
      ) : value ? (
        <p className="text-sm whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </section>
  );
}
