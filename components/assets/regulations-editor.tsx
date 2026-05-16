'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { updateAssetRegulations } from '@/lib/actions/assets';
import { REGULATION_OPTIONS } from '@/lib/enums/asset';

type Props = {
  assetId: string;
  regulations: string[];
  regulationNotes: string | null;
};

export function RegulationsEditor({ assetId, regulations, regulationNotes }: Props) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(regulations);
  const [notes, setNotes] = useState(regulationNotes ?? '');
  const [customInput, setCustomInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function cancel() {
    setSelected(regulations);
    setNotes(regulationNotes ?? '');
    setCustomInput('');
    setError(null);
    setEditing(false);
  }

  function toggleRegulation(r: string) {
    setSelected((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  }

  function addCustom() {
    const val = customInput.trim();
    if (!val || selected.includes(val)) { setCustomInput(''); return; }
    setSelected((prev) => [...prev, val]);
    setCustomInput('');
  }

  function save() {
    startTransition(async () => {
      const result = await updateAssetRegulations(
        assetId,
        selected,
        notes.trim() || null,
      );
      if (result.ok) { setError(null); setEditing(false); router.refresh(); }
      else setError(result.error);
    });
  }

  const isEmpty = regulations.length === 0 && !regulationNotes;

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Regulations
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
            <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground" onClick={cancel}>
              <X className="h-3 w-3" />
            </Button>
            <Button size="sm" className="h-6 px-2" onClick={save}>
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive mb-2">{error}</p>}

      {editing ? (
        <div className="flex flex-col gap-3">
          {/* Predefined options grid */}
          <div className="flex flex-wrap gap-1.5">
            {REGULATION_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => toggleRegulation(r)}
                className={`rounded px-2 py-0.5 text-xs font-mono border transition-colors ${
                  selected.includes(r)
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Custom regulation input */}
          <div className="flex items-center gap-1.5">
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
              placeholder="Add custom…"
              className="h-7 flex-1 rounded border border-input bg-background px-2 text-xs outline-none focus:border-foreground"
            />
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={addCustom}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Notes */}
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Regulation notes (optional)…"
            rows={2}
            className="text-xs resize-none"
          />
        </div>
      ) : isEmpty ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <div className="flex flex-col gap-2">
          {regulations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {regulations.map((r) => (
                <span
                  key={r}
                  className="rounded bg-muted px-2 py-0.5 text-xs font-mono"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
          {regulationNotes && (
            <p className="text-xs text-muted-foreground">{regulationNotes}</p>
          )}
        </div>
      )}
    </section>
  );
}
