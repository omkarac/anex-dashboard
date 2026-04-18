'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { MultiSelect } from '@/components/shared/multi-select';
import { ASSET_STATUS_LABELS, ASSET_TEMPERATURE_LABELS, ASSET_TYPE_LABELS, REGULATION_OPTIONS } from '@/lib/enums/asset';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { AssetStatus, AssetTemperature, AssetType } from '@/lib/schemas/asset';

type FilterBarProps = {
  spocOptions: string[];
};

const STATUS_OPTIONS = (Object.keys(ASSET_STATUS_LABELS) as AssetStatus[]).map((v) => ({
  value: v,
  label: ASSET_STATUS_LABELS[v],
}));

const TEMPERATURE_OPTIONS = (['hot', 'warm', 'cold', 'none'] as AssetTemperature[]).map((v) => ({
  value: v,
  label: ASSET_TEMPERATURE_LABELS[v],
}));

const TYPE_OPTIONS = (Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((v) => ({
  value: v,
  label: ASSET_TYPE_LABELS[v],
}));

const REGULATION_OPTS = REGULATION_OPTIONS.map((v) => ({ value: v, label: v }));

export function FilterBar({ spocOptions }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function getParam(key: string): string[] {
    const v = searchParams.get(key);
    return v ? v.split(',').filter(Boolean) : [];
  }

  const setFilter = useCallback(
    (key: string, values: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (values.length > 0) {
        params.set(key, values.join(','));
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const hasFilters = ['status', 'temperature', 'asset_type', 'regulation', 'spoc_agent'].some(
    (k) => searchParams.has(k)
  );

  function clearAll() {
    router.push('?');
  }

  return (
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
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-2 text-muted-foreground">
          <X className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
