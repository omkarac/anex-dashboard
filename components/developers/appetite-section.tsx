'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, X, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { upsertDeveloperPreferences } from '@/lib/actions/developers';
import { MICRO_MARKETS, microMarketsByZone, getMicroMarketLabel } from '@/lib/enums/micro-markets';
import { LocationMap } from '@/components/developers/location-map';
import { ASSET_TYPE_LABELS, REGULATION_OPTIONS } from '@/lib/enums/asset';
import type { DeveloperPreferences } from '@/lib/schemas/developer';

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  preferred_micro_markets: string[];
  preferred_asset_types: string[];
  preferred_regulations: string[];
  plot_size_min: string;
  plot_size_max: string;
  topline_min: string;
  topline_max: string;
  initial_investment_min: string;
  initial_investment_max: string;
  development_potential_min: string;
  development_potential_max: string;
  appetite_notes: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prefsToForm(prefs: DeveloperPreferences | null): FormState {
  return {
    preferred_micro_markets: prefs?.preferred_micro_markets ?? [],
    preferred_asset_types: prefs?.preferred_asset_types ?? [],
    preferred_regulations: prefs?.preferred_regulations ?? [],
    plot_size_min: prefs?.plot_size_min_sqm?.toString() ?? '',
    plot_size_max: prefs?.plot_size_max_sqm?.toString() ?? '',
    topline_min: prefs?.topline_min_cr?.toString() ?? '',
    topline_max: prefs?.topline_max_cr?.toString() ?? '',
    initial_investment_min: prefs?.initial_investment_min_cr?.toString() ?? '',
    initial_investment_max: prefs?.initial_investment_max_cr?.toString() ?? '',
    development_potential_min: prefs?.development_potential_min_sqm?.toString() ?? '',
    development_potential_max: prefs?.development_potential_max_sqm?.toString() ?? '',
    appetite_notes: prefs?.appetite_notes ?? '',
  };
}

function formToUpsert(form: FormState) {
  const n = (s: string) => (s.trim() ? parseFloat(s) : null);
  return {
    preferred_micro_markets: form.preferred_micro_markets,
    preferred_asset_types: form.preferred_asset_types,
    preferred_regulations: form.preferred_regulations,
    plot_size_min_sqm: n(form.plot_size_min),
    plot_size_max_sqm: n(form.plot_size_max),
    topline_min_cr: n(form.topline_min),
    topline_max_cr: n(form.topline_max),
    initial_investment_min_cr: n(form.initial_investment_min),
    initial_investment_max_cr: n(form.initial_investment_max),
    development_potential_min_sqm: n(form.development_potential_min),
    development_potential_max_sqm: n(form.development_potential_max),
    appetite_notes: form.appetite_notes.trim() || null,
  };
}

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function hasAnyPreference(prefs: DeveloperPreferences | null): boolean {
  if (!prefs) return false;
  return (
    prefs.preferred_micro_markets.length > 0 ||
    prefs.preferred_asset_types.length > 0 ||
    prefs.preferred_regulations.length > 0 ||
    prefs.plot_size_min_sqm != null ||
    prefs.plot_size_max_sqm != null ||
    prefs.topline_min_cr != null ||
    prefs.topline_max_cr != null ||
    prefs.initial_investment_min_cr != null ||
    prefs.initial_investment_max_cr != null ||
    prefs.development_potential_min_sqm != null ||
    prefs.development_potential_max_sqm != null ||
    (prefs.appetite_notes ?? '').length > 0
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
      muted ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground'
    }`}>
      {label}
    </span>
  );
}

function ToggleChip({ value, label, selected, onToggle }: {
  value: string; label: string; selected: boolean; onToggle: (v: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(value)}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        selected
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
      }`}
    >
      {label}
    </button>
  );
}

function RangeDisplay({ min, max, unit }: { min: number | null; max: number | null; unit: string }) {
  if (min == null && max == null) return <span className="text-xs text-muted-foreground">Not specified</span>;
  const fmt = (v: number) => v.toLocaleString('en-IN');
  if (min != null && max != null) return <span className="text-sm font-semibold tabular-nums">{fmt(min)} – {fmt(max)} <span className="text-xs font-normal text-muted-foreground">{unit}</span></span>;
  if (min != null) return <span className="text-sm font-semibold tabular-nums">≥ {fmt(min)} <span className="text-xs font-normal text-muted-foreground">{unit}</span></span>;
  return <span className="text-sm font-semibold tabular-nums">≤ {fmt(max!)} <span className="text-xs font-normal text-muted-foreground">{unit}</span></span>;
}

function RangeInput({ label, unit, minVal, maxVal, onMin, onMax }: {
  label: string; unit: string; minVal: string; maxVal: string;
  onMin: (v: string) => void; onMax: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label} <span className="text-muted-foreground/60">({unit})</span></Label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={minVal}
          onChange={(e) => onMin(e.target.value)}
          placeholder="Min"
          min={0}
          className="h-8 w-full rounded-md border bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground shrink-0">–</span>
        <input
          type="number"
          value={maxVal}
          onChange={(e) => onMax(e.target.value)}
          placeholder="Max"
          min={0}
          className="h-8 w-full rounded-md border bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}

// ─── View mode ────────────────────────────────────────────────────────────────

function AppetiteView({
  prefs,
  onEdit,
  sharedMarkets,
  interestedMarkets,
}: {
  prefs: DeveloperPreferences | null;
  onEdit: () => void;
  sharedMarkets: string[];
  interestedMarkets: string[];
}) {
  const filled = hasAnyPreference(prefs);
  const zoneMap = microMarketsByZone();

  if (!filled) {
    return (
      <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed text-muted-foreground">
        <Target className="h-7 w-7 mb-2 opacity-20" />
        <p className="text-sm">No appetite profile set yet</p>
        <Button size="sm" variant="ghost" className="mt-3 h-7 px-3 text-xs" onClick={onEdit}>
          + Add appetite profile
        </Button>
      </div>
    );
  }

  const marketsBySelectedZone = new Map<string, string[]>();
  for (const m of prefs!.preferred_micro_markets) {
    const market = MICRO_MARKETS.find((x) => x.value === m);
    if (!market) continue;
    const arr = marketsBySelectedZone.get(market.zone) ?? [];
    arr.push(market.label);
    marketsBySelectedZone.set(market.zone, arr);
  }

  return (
    <div className="flex flex-col gap-5">
      {prefs!.preferred_micro_markets.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Location Coverage</p>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {prefs!.preferred_micro_markets.length} micro-markets
            </span>
          </div>
          <LocationMap
            appetiteMarkets={prefs!.preferred_micro_markets}
            sharedMarkets={sharedMarkets}
            interestedMarkets={interestedMarkets}
          />
          {/* Zone breakdown below the map */}
          <div className="mt-3 flex flex-col gap-1.5">
            {[...marketsBySelectedZone.entries()].map(([zone, labels]) => (
              <div key={zone} className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50 shrink-0 w-28">{zone}</span>
                {labels.map((l) => <Chip key={l} label={l} />)}
              </div>
            ))}
          </div>
        </div>
      )}

      {prefs!.preferred_asset_types.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Asset Types</p>
          <div className="flex flex-wrap gap-1.5">
            {prefs!.preferred_asset_types.map((t) => (
              <Chip key={t} label={ASSET_TYPE_LABELS[t as keyof typeof ASSET_TYPE_LABELS] ?? t} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {(prefs!.plot_size_min_sqm != null || prefs!.plot_size_max_sqm != null) && (
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Plot Size</p>
            <RangeDisplay min={prefs!.plot_size_min_sqm} max={prefs!.plot_size_max_sqm} unit="sqm" />
          </div>
        )}
        {(prefs!.development_potential_min_sqm != null || prefs!.development_potential_max_sqm != null) && (
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Dev Potential</p>
            <RangeDisplay min={prefs!.development_potential_min_sqm} max={prefs!.development_potential_max_sqm} unit="sqm" />
          </div>
        )}
        {(prefs!.topline_min_cr != null || prefs!.topline_max_cr != null) && (
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Topline</p>
            <RangeDisplay min={prefs!.topline_min_cr} max={prefs!.topline_max_cr} unit="Cr" />
          </div>
        )}
        {(prefs!.initial_investment_min_cr != null || prefs!.initial_investment_max_cr != null) && (
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Initial Investment</p>
            <RangeDisplay min={prefs!.initial_investment_min_cr} max={prefs!.initial_investment_max_cr} unit="Cr" />
          </div>
        )}
      </div>

      {prefs!.preferred_regulations.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Regulations</p>
          <div className="flex flex-wrap gap-1.5">
            {prefs!.preferred_regulations.map((r) => <Chip key={r} label={r} />)}
          </div>
        </div>
      )}

      {prefs!.appetite_notes && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Notes</p>
          <p className="text-sm text-muted-foreground">{prefs!.appetite_notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── Edit mode ────────────────────────────────────────────────────────────────

function AppetiteForm({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const zoneMap = microMarketsByZone();
  const assetTypes = Object.entries(ASSET_TYPE_LABELS) as [string, string][];

  return (
    <div className="flex flex-col gap-6">
      {/* Micro-markets */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Preferred Micro-Markets</Label>
        <div className="max-h-56 overflow-y-auto rounded-lg border p-3 flex flex-col gap-3">
          {[...zoneMap.entries()].map(([zone, markets]) => (
            <div key={zone}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">{zone}</p>
              <div className="flex flex-wrap gap-1.5">
                {markets.map((m) => (
                  <ToggleChip
                    key={m.value}
                    value={m.value}
                    label={m.label}
                    selected={form.preferred_micro_markets.includes(m.value)}
                    onToggle={(v) => setForm((f) => ({ ...f, preferred_micro_markets: toggle(f.preferred_micro_markets, v) }))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {form.preferred_micro_markets.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {form.preferred_micro_markets.length} selected
          </p>
        )}
      </div>

      {/* Asset types */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Asset Types</Label>
        <div className="flex flex-wrap gap-1.5">
          {assetTypes.map(([value, label]) => (
            <ToggleChip
              key={value}
              value={value}
              label={label}
              selected={form.preferred_asset_types.includes(value)}
              onToggle={(v) => setForm((f) => ({ ...f, preferred_asset_types: toggle(f.preferred_asset_types, v) }))}
            />
          ))}
        </div>
      </div>

      {/* Numeric ranges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RangeInput
          label="Plot Size" unit="sqm"
          minVal={form.plot_size_min} maxVal={form.plot_size_max}
          onMin={(v) => setForm((f) => ({ ...f, plot_size_min: v }))}
          onMax={(v) => setForm((f) => ({ ...f, plot_size_max: v }))}
        />
        <RangeInput
          label="Development Potential" unit="sqm"
          minVal={form.development_potential_min} maxVal={form.development_potential_max}
          onMin={(v) => setForm((f) => ({ ...f, development_potential_min: v }))}
          onMax={(v) => setForm((f) => ({ ...f, development_potential_max: v }))}
        />
        <RangeInput
          label="Topline" unit="Cr"
          minVal={form.topline_min} maxVal={form.topline_max}
          onMin={(v) => setForm((f) => ({ ...f, topline_min: v }))}
          onMax={(v) => setForm((f) => ({ ...f, topline_max: v }))}
        />
        <RangeInput
          label="Initial Investment" unit="Cr"
          minVal={form.initial_investment_min} maxVal={form.initial_investment_max}
          onMin={(v) => setForm((f) => ({ ...f, initial_investment_min: v }))}
          onMax={(v) => setForm((f) => ({ ...f, initial_investment_max: v }))}
        />
      </div>

      {/* Regulations */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Regulations</Label>
        <div className="flex flex-wrap gap-1.5">
          {REGULATION_OPTIONS.map((r) => (
            <ToggleChip
              key={r}
              value={r}
              label={r}
              selected={form.preferred_regulations.includes(r)}
              onToggle={(v) => setForm((f) => ({ ...f, preferred_regulations: toggle(f.preferred_regulations, v) }))}
            />
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Appetite Notes</Label>
        <Textarea
          value={form.appetite_notes}
          onChange={(e) => setForm((f) => ({ ...f, appetite_notes: e.target.value }))}
          placeholder="Focused on SRA in Western suburbs, prefers clear title, minimum 10 floors FSI…"
          className="text-sm resize-none min-h-[80px]"
        />
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AppetiteSection({
  developerId,
  preferences,
  sharedMarkets = [],
  interestedMarkets = [],
}: {
  developerId: string;
  preferences: DeveloperPreferences | null;
  sharedMarkets?: string[];
  interestedMarkets?: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => prefsToForm(preferences));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit() {
    setForm(prefsToForm(preferences));
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setForm(prefsToForm(preferences));
    setError(null);
    setEditing(false);
  }

  function save() {
    startTransition(async () => {
      const result = await upsertDeveloperPreferences(developerId, formToUpsert(form));
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
    <section className="rounded-xl border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investment Appetite</p>
        </div>
        {!editing ? (
          <Button size="sm" variant="ghost" className="h-7 px-2.5 text-muted-foreground hover:text-foreground" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
          </Button>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEdit} disabled={isPending}>
              <X className="h-3.5 w-3.5 mr-1" />Cancel
            </Button>
            <Button size="sm" className="h-7 px-3" onClick={save} disabled={isPending}>
              <Check className="h-3.5 w-3.5 mr-1" />Save
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive mb-3">{error}</p>}

      {editing ? (
        <AppetiteForm form={form} setForm={setForm} />
      ) : (
        <AppetiteView
          prefs={preferences}
          onEdit={startEdit}
          sharedMarkets={sharedMarkets}
          interestedMarkets={interestedMarkets}
        />
      )}
    </section>
  );
}
