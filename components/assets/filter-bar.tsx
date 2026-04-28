'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';
import { MultiSelect } from '@/components/shared/multi-select';
import { RangeSlider } from '@/components/ui/range-slider';
import { ASSET_STATUS_LABELS, ASSET_TEMPERATURE_LABELS, ASSET_TYPE_LABELS, REGULATION_OPTIONS } from '@/lib/enums/asset';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, ArrowUpDown } from 'lucide-react';
import { AssetSearchInput } from '@/components/assets/asset-search-input';
import type { AssetStatus, AssetTemperature, AssetType } from '@/lib/schemas/asset';
import type { SortOption } from '@/lib/queries/assets';

type FilterBarProps = {
  spocOptions: string[];
  toplineBound: number;
  invBound: number;
  plotBound: number;
};

const STATUS_OPTIONS = (Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map((v) => ({
  value: v, label: ASSET_STATUS_LABELS[v],
}));

const TEMPERATURE_OPTIONS = (['hot', 'warm', 'cold', 'none'] as AssetTemperature[]).map((v) => ({
  value: v, label: ASSET_TEMPERATURE_LABELS[v],
}));

const TYPE_OPTIONS = (Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((v) => ({
  value: v, label: ASSET_TYPE_LABELS[v],
}));

const REGULATION_OPTS = REGULATION_OPTIONS.map((v) => ({ value: v, label: v }));

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'updated_desc', label: 'Updated (newest)' },
  { value: 'name_asc',     label: 'Name A → Z' },
  { value: 'name_desc',    label: 'Name Z → A' },
  { value: 'topline_desc', label: 'Topline ↓' },
  { value: 'topline_asc',  label: 'Topline ↑' },
];

function NumericRangeFilter({
  label,
  unit,
  paramMin,
  paramMax,
  bound,
  onCommit,
}: {
  label: string;
  unit?: string;
  paramMin: string;
  paramMax: string;
  bound: number;
  onCommit: (key: string, val: string) => void;
}) {
  const searchParams = useSearchParams();

  const initMin = () => Math.max(0, Number(searchParams.get(paramMin) ?? 0));
  const initMax = () => Math.min(bound, Number(searchParams.get(paramMax) ?? bound));

  const [sliderMin, setSliderMin] = useState(initMin);
  const [sliderMax, setSliderMax] = useState(initMax);
  const [inputMin, setInputMin] = useState(String(initMin()));
  const [inputMax, setInputMax] = useState(String(initMax()));

  // Sync if URL changes externally (e.g. clear)
  useEffect(() => {
    const urlMin = Math.max(0, Number(searchParams.get(paramMin) ?? 0));
    const urlMax = Math.min(bound, Number(searchParams.get(paramMax) ?? bound));
    setSliderMin(urlMin);
    setSliderMax(urlMax);
    setInputMin(String(urlMin));
    setInputMax(String(urlMax));
  }, [searchParams, paramMin, paramMax, bound]);

  function commitMin(v: number) {
    const clamped = Math.min(v, sliderMax);
    setSliderMin(clamped);
    setInputMin(String(clamped));
    onCommit(paramMin, clamped === 0 ? '' : String(clamped));
  }

  function commitMax(v: number) {
    const clamped = Math.max(v, sliderMin);
    setSliderMax(clamped);
    setInputMax(String(clamped));
    onCommit(paramMax, clamped === bound ? '' : String(clamped));
  }

  function handleInputMin(raw: string) {
    setInputMin(raw);
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= 0 && v <= sliderMax) commitMin(v);
  }

  function handleInputMax(raw: string) {
    setInputMax(raw);
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= sliderMin && v <= bound) commitMax(v);
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[220px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}{unit ? ` (${unit})` : ''}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {sliderMin} – {sliderMax}
        </span>
      </div>
      <RangeSlider
        min={0}
        max={bound}
        step={1}
        valueMin={sliderMin}
        valueMax={sliderMax}
        onChangeMin={commitMin}
        onChangeMax={commitMax}
      />
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={0}
          max={sliderMax}
          value={inputMin}
          onChange={(e) => handleInputMin(e.target.value)}
          onBlur={() => handleInputMin(inputMin)}
          className="h-7 w-20 text-xs text-center"
          placeholder="Min"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="number"
          min={sliderMin}
          max={bound}
          value={inputMax}
          onChange={(e) => handleInputMax(e.target.value)}
          onBlur={() => handleInputMax(inputMax)}
          className="h-7 w-20 text-xs text-center"
          placeholder="Max"
        />
      </div>
    </div>
  );
}

export function FilterBar({ spocOptions, toplineBound, invBound, plotBound }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function getParam(key: string): string[] {
    const v = searchParams.get(key);
    return v ? v.split(',').filter(Boolean) : [];
  }

  const setFilter = useCallback(
    (key: string, values: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (values.length > 0) params.set(key, values.join(','));
      else params.delete(key);
      params.delete('page');
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  function setParam(key: string, val: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (val) params.set(key, val);
    else params.delete(key);
    params.delete('page');
    router.push(`?${params.toString()}`);
  }

  const currentSort = (searchParams.get('sort') ?? 'updated_desc') as SortOption;

  const hasFilters = ['q', 'status', 'temperature', 'asset_type', 'regulation', 'spoc_agent',
    'topline_min', 'topline_max', 'inv_min', 'inv_max', 'plot_min', 'plot_max'].some((k) => searchParams.has(k));

  function clearAll() {
    const params = new URLSearchParams();
    const sort = searchParams.get('sort');
    if (sort && sort !== 'updated_desc') params.set('sort', sort);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Row 0: search */}
      <AssetSearchInput />

      {/* Row 1: categorical filters + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          options={STATUS_OPTIONS}
          value={getParam('status')}
          onChange={(v) => setFilter('status', v)}
          placeholder="Status"
          className="w-44"
        />
        <MultiSelect
          options={TEMPERATURE_OPTIONS}
          value={getParam('temperature')}
          onChange={(v) => setFilter('temperature', v)}
          placeholder="Temperature"
          className="w-36"
        />
        <MultiSelect
          options={TYPE_OPTIONS}
          value={getParam('asset_type')}
          onChange={(v) => setFilter('asset_type', v)}
          placeholder="Type"
          className="w-44"
        />
        <MultiSelect
          options={REGULATION_OPTS}
          value={getParam('regulation')}
          onChange={(v) => setFilter('regulation', v)}
          placeholder="Regulation"
          className="w-36"
        />
        <MultiSelect
          options={spocOptions.map((s) => ({ value: s, label: s }))}
          value={getParam('spoc_agent')}
          onChange={(v) => setFilter('spoc_agent', v)}
          placeholder="SPOC"
          className="w-36"
        />

        <div className="flex items-center gap-1.5 ml-auto">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <select
            value={currentSort}
            onChange={(e) => setParam('sort', e.target.value === 'updated_desc' ? '' : e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-2 text-muted-foreground">
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Row 2: numeric range sliders */}
      <div className="flex flex-wrap gap-6">
        <NumericRangeFilter
          label="Topline"
          unit="Cr"
          paramMin="topline_min"
          paramMax="topline_max"
          bound={toplineBound}
          onCommit={setParam}
        />
        <NumericRangeFilter
          label="Initial Investment"
          unit="Cr"
          paramMin="inv_min"
          paramMax="inv_max"
          bound={invBound}
          onCommit={setParam}
        />
        <NumericRangeFilter
          label="Plot Size"
          unit="sq.m."
          paramMin="plot_min"
          paramMax="plot_max"
          bound={plotBound}
          onCommit={setParam}
        />
      </div>
    </div>
  );
}
