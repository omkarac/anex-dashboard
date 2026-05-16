'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateAssetFinancials } from '@/lib/actions/assets';
import { toCr, fromCr } from '@/lib/utils/formatters';
import type { Asset } from '@/lib/schemas/asset';

type NumericField = {
  key: keyof Asset;
  label: string;
  format: (v: number | null | undefined) => string;
  unit?: string;
  isCr?: boolean; // value stored in rupees, display/edit in Crore
};

const num = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('en-IN') : '—';

const FIELDS: NumericField[] = [
  { key: 'plot_size_sqm', label: 'Plot Size', format: num, unit: 'sq.m.' },
];

export function FinancialsEditor({ asset }: { asset: Asset }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => {
      const raw = asset[f.key];
      if (raw == null) return [f.key, ''];
      const display = f.isCr ? toCr(raw as number) : raw;
      return [f.key, display != null ? String(display) : ''];
    }))
  );
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setValues(Object.fromEntries(FIELDS.map((f) => {
      const raw = asset[f.key];
      if (raw == null) return [f.key, ''];
      const display = f.isCr ? toCr(raw as number) : raw;
      return [f.key, display != null ? String(display) : ''];
    })));
    setEditing(false);
    setError(null);
  }

  function save() {
    startTransition(async () => {
      const fields: Record<string, number | null> = {};
      for (const f of FIELDS) {
        const raw = values[f.key as string].trim();
        if (raw === '') { fields[f.key as string] = null; continue; }
        const parsed = parseFloat(raw);
        // Cr fields: user edits in Crore, convert back to rupees for storage
        fields[f.key as string] = f.isCr ? fromCr(parsed) : parsed;
      }
      const result = await updateAssetFinancials(asset.id, fields as Parameters<typeof updateAssetFinancials>[1]);
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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Site
        </h2>
        {!editing ? (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground" onClick={cancel} disabled={isPending}>
              <X className="h-3 w-3" />
            </Button>
            <Button size="sm" className="h-6 px-2" onClick={save} disabled={isPending}>
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive mb-2">{error}</p>
      )}

      <div className="divide-y">
        {FIELDS.map((f) => (
          <div key={f.key as string} className="grid grid-cols-2 gap-2 py-2">
            <span className="text-xs text-muted-foreground font-medium self-center">{f.label}</span>
            {editing ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={values[f.key as string]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key as string]: e.target.value }))}
                  placeholder="—"
                  className="h-7 text-xs text-right"
                />
                {f.unit && <span className="text-xs text-muted-foreground whitespace-nowrap">{f.unit}</span>}
              </div>
            ) : (
              <span className="text-sm text-right">
                {asset[f.key] != null
                  ? f.format(asset[f.key] as number)
                  : <span className="text-muted-foreground">—</span>}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
