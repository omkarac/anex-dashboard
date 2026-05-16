'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Star, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createScenario,
  updateScenarioValues,
  renameScenario,
  setPrimaryScenario,
  deleteScenario,
} from '@/lib/actions/asset-scenarios';
import { toCr, fromCr } from '@/lib/utils/formatters';
import type { AssetScenario, ScenarioValues } from '@/lib/schemas/asset-scenario';

type Field = {
  key: keyof ScenarioValues;
  label: string;
  unit?: string;
  isCr?: boolean;
  decimals?: number;
};

const FIELDS: Field[] = [
  { key: 'fsi_potential',               label: 'FSI Potential',         decimals: 3 },
  { key: 'development_potential_sqm',   label: 'Dev. Potential',        unit: 'sq.m.' },
  { key: 'rehab_area_sqm',              label: 'Rehab Area',            unit: 'sq.m.' },
  { key: 'sale_area_sqm',               label: 'Sale Area',             unit: 'sq.m.' },
  { key: 'sale_rate_psf',               label: 'Sale Rate',             unit: '/sq.ft.' },
  { key: 'initial_investment_cr',       label: 'Initial Investment',    unit: 'Cr', isCr: true },
  { key: 'topline_cr',                  label: 'Topline',               unit: 'Cr', isCr: true },
  { key: 'profit_cr',                   label: 'Profit',                unit: 'Cr', isCr: true },
];

function displayValue(field: Field, scenario: AssetScenario): string {
  const raw = scenario[field.key as keyof AssetScenario] as number | null;
  if (raw == null) return '—';
  if (field.isCr) {
    const cr = toCr(raw);
    return cr != null ? cr.toLocaleString('en-IN') : '—';
  }
  if (field.decimals) return raw.toFixed(field.decimals);
  return raw.toLocaleString('en-IN');
}

function editDefault(field: Field, scenario: AssetScenario): string {
  const raw = scenario[field.key as keyof AssetScenario] as number | null;
  if (raw == null) return '';
  if (field.isCr) return String(toCr(raw) ?? '');
  return String(raw);
}

function parseField(field: Field, raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const val = parseFloat(trimmed);
  if (Number.isNaN(val)) return null;
  return field.isCr ? fromCr(val) : val;
}

// ─── Single scenario view ─────────────────────────────────────────────────────

function ScenarioView({
  scenario,
  assetId,
  canDelete,
  onSetPrimary,
  onDelete,
}: {
  scenario: AssetScenario;
  assetId: string;
  canDelete: boolean;
  onSetPrimary: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [renamingInline, setRenamingInline] = useState(false);
  const [nameDraft, setNameDraft] = useState(scenario.name);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, editDefault(f, scenario)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValues(Object.fromEntries(FIELDS.map((f) => [f.key, editDefault(f, scenario)])));
    setNameDraft(scenario.name);
  }, [scenario]);

  useEffect(() => {
    if (renamingInline) nameRef.current?.focus();
  }, [renamingInline]);

  function saveValues() {
    const parsed: Partial<ScenarioValues> = {};
    for (const f of FIELDS) {
      parsed[f.key] = parseField(f, values[f.key] ?? '');
    }
    startTransition(async () => {
      const result = await updateScenarioValues(scenario.id, assetId, parsed as ScenarioValues);
      if (result.ok) { setEditing(false); setError(null); router.refresh(); }
      else setError(result.error);
    });
  }

  function saveName() {
    const name = nameDraft.trim();
    if (!name || name === scenario.name) { setRenamingInline(false); return; }
    startTransition(async () => {
      await renameScenario(scenario.id, assetId, name);
      setRenamingInline(false);
      router.refresh();
    });
  }

  return (
    <div>
      {/* Scenario-level actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/10">
        {renamingInline ? (
          <div className="flex items-center gap-1.5 flex-1 mr-2">
            <input
              ref={nameRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setRenamingInline(false); setNameDraft(scenario.name); } }}
              className="h-6 flex-1 rounded border border-slate-300 px-2 text-xs outline-none focus:border-slate-500"
            />
            <button onClick={saveName} className="text-green-600 hover:text-green-800"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => { setRenamingInline(false); setNameDraft(scenario.name); }} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button
            onClick={() => setRenamingInline(true)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 group transition-colors"
            title="Click to rename"
          >
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            Rename
          </button>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {!scenario.is_primary && (
            <button
              onClick={onSetPrimary}
              className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 transition-colors font-medium"
              title="Make this the primary scenario (syncs to dashboard)"
            >
              <Star className="h-3 w-3" />
              Set Primary
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              className="text-slate-300 hover:text-rose-500 transition-colors"
              title="Delete scenario"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {!editing ? (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3 mr-1" />Edit
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => { setEditing(false); setError(null); setValues(Object.fromEntries(FIELDS.map((f) => [f.key, editDefault(f, scenario)]))); }}><X className="h-3 w-3" /></Button>
              <Button size="sm" className="h-6 px-2 text-xs" onClick={saveValues}><Check className="h-3 w-3 mr-1" />Save</Button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-destructive px-4 pt-2">{error}</p>}

      <div className="divide-y px-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="grid grid-cols-2 gap-2 py-2">
            <span className="text-xs text-muted-foreground font-medium self-center">{f.label}</span>
            {editing ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder="—"
                  className="h-7 text-xs text-right"
                />
                {f.unit && <span className="text-xs text-muted-foreground whitespace-nowrap">{f.unit}</span>}
              </div>
            ) : (
              <span className="text-sm text-right">
                {scenario[f.key as keyof AssetScenario] != null
                  ? (
                    <span>{displayValue(f, scenario)}{f.unit ? <span className="text-xs text-muted-foreground ml-1">{f.unit}</span> : null}</span>
                  )
                  : <span className="text-muted-foreground">—</span>}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function ScenariosPanel({
  assetId,
  initialScenarios,
}: {
  assetId: string;
  initialScenarios: AssetScenario[];
}) {
  const [activeId, setActiveId] = useState<string | null>(
    () => initialScenarios.find((s) => s.is_primary)?.id ?? initialScenarios[0]?.id ?? null,
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Keep activeId valid after refreshes
  useEffect(() => {
    if (!initialScenarios.find((s) => s.id === activeId)) {
      setActiveId(initialScenarios.find((s) => s.is_primary)?.id ?? initialScenarios[0]?.id ?? null);
    }
  }, [initialScenarios, activeId]);

  const scenarios = initialScenarios;
  const active = scenarios.find((s) => s.id === activeId);

  function submitCreate() {
    const name = newName.trim() || `Scenario ${scenarios.length + 1}`;
    setCreating(false);
    setNewName('');
    startTransition(async () => {
      const result = await createScenario(assetId, name);
      if (result.ok && result.data) {
        setActiveId(result.data.id);
        router.refresh();
      }
    });
  }

  function handleSetPrimary(scenarioId: string) {
    startTransition(async () => {
      await setPrimaryScenario(scenarioId, assetId);
      router.refresh();
    });
  }

  function handleDelete(scenarioId: string) {
    startTransition(async () => {
      await deleteScenario(scenarioId, assetId);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Feasibility Scenarios
        </h2>
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
              placeholder={`Scenario ${scenarios.length + 1}`}
              className="h-6 w-32 rounded border border-slate-300 px-2 text-xs outline-none focus:border-slate-500"
            />
            <button onClick={submitCreate} className="text-green-600 hover:text-green-800"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => { setCreating(false); setNewName(''); }} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      {scenarios.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 px-4">
          <p className="text-sm text-muted-foreground text-center">
            No feasibility scenarios yet.
          </p>
          <Button size="sm" onClick={() => setCreating(true)} className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add First Scenario
          </Button>
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex border-b overflow-x-auto">
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                  s.id === activeId
                    ? 'border-foreground text-foreground font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.name}
                {s.is_primary && (
                  <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-400" />
                )}
              </button>
            ))}
          </div>

          {/* Active scenario body */}
          {active && (
            <ScenarioView
              key={active.id}
              scenario={active}
              assetId={assetId}
              canDelete={scenarios.length > 1}
              onSetPrimary={() => handleSetPrimary(active.id)}
              onDelete={() => handleDelete(active.id)}
            />
          )}
        </>
      )}
    </section>
  );
}
