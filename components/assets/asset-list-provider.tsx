'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  searchAssetsForTable,
  getAssetEnrichment,
  type AssetSearchTableInput,
} from '@/lib/actions/assets';
import type { Asset } from '@/lib/schemas/asset';
import type { SortOption } from '@/lib/queries/assets';
import type { LatestUpdateSummary } from '@/lib/queries/updates';
import type { AssetOpenTask } from '@/lib/queries/developers';

type LiveData = {
  assets: Asset[];
  count: number;
  pageCount: number;
  latestUpdates: Map<string, LatestUpdateSummary>;
  openTasks: AssetOpenTask[];
};

type Ctx = {
  data: LiveData;
  runSearch: (q: string) => void;
  isSearching: boolean;
};

const AssetSearchContext = createContext<Ctx | null>(null);

export function useAssetSearchContext(): Ctx | null {
  return useContext(AssetSearchContext);
}

type ProviderProps = {
  children: ReactNode;
  initialAssets: Asset[];
  initialCount: number;
  initialPageCount: number;
  initialLatestUpdates: Map<string, LatestUpdateSummary>;
  initialOpenTasks: AssetOpenTask[];
};

export function AssetListProvider({
  children,
  initialAssets,
  initialCount,
  initialPageCount,
  initialLatestUpdates,
  initialOpenTasks,
}: ProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<LiveData>({
    assets: initialAssets,
    count: initialCount,
    pageCount: initialPageCount,
    latestUpdates: initialLatestUpdates,
    openTasks: initialOpenTasks,
  });
  const [isPending, startTransition] = useTransition();

  // When the parent re-renders with fresh server data (a non-search URL change
  // — e.g. status filter, pagination, sort), adopt that as the new baseline.
  useEffect(() => {
    setData({
      assets: initialAssets,
      count: initialCount,
      pageCount: initialPageCount,
      latestUpdates: initialLatestUpdates,
      openTasks: initialOpenTasks,
    });
  }, [
    initialAssets,
    initialCount,
    initialPageCount,
    initialLatestUpdates,
    initialOpenTasks,
  ]);

  const runSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = q.trim();
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      params.delete('page');

      // Keep the URL in sync for shareability, but skip the RSC navigation
      // (router.replace would trigger a full page re-render).
      const url = params.toString() ? `${pathname}?${params}` : pathname;
      window.history.replaceState(window.history.state, '', url);

      const input: AssetSearchTableInput = {
        q: trimmed || undefined,
        status: parseList(params, 'status'),
        temperature: parseList(params, 'temperature'),
        asset_type: parseList(params, 'asset_type'),
        regulation: parseList(params, 'regulation'),
        spoc_agent: parseList(params, 'spoc_agent'),
        sort: (params.get('sort') as SortOption | null) ?? 'updated_desc',
        topline_min: parseNum(params, 'topline_min'),
        topline_max: parseNum(params, 'topline_max'),
        inv_min: parseNum(params, 'inv_min'),
        inv_max: parseNum(params, 'inv_max'),
        plot_min: parseNum(params, 'plot_min'),
        plot_max: parseNum(params, 'plot_max'),
        has_open_tasks: params.get('has_open_tasks') === '1',
      };

      // Stage 1 — fast asset query (target ~20ms server-side). Swap in the new
      // rows immediately; keep the existing latestUpdates/openTasks so columns
      // for overlapping assets stay populated until enrichment lands.
      startTransition(async () => {
        try {
          const result = await searchAssetsForTable(input);
          setData((prev) => ({
            ...prev,
            assets: result.assets,
            count: result.returned,
            pageCount: 1,
          }));

          // Stage 2 — enrichment, fire-and-forget so it doesn't keep the
          // pending spinner up. Empty enrichment maps stay rendered until
          // this returns.
          if (result.assets.length > 0) {
            getAssetEnrichment(result.assets.map((a) => a.id))
              .then((enr) => {
                setData((prev) => ({
                  ...prev,
                  latestUpdates: new Map(enr.latestUpdates),
                  openTasks: enr.openTasks,
                }));
              })
              .catch(() => {
                // Leave whatever enrichment is on screen.
              });
          }
        } catch {
          // Leave existing data on screen; the spinner will stop on its own.
        }
      });
    },
    [searchParams, pathname]
  );

  const value = useMemo<Ctx>(
    () => ({ data, runSearch, isSearching: isPending }),
    [data, runSearch, isPending]
  );

  return (
    <AssetSearchContext.Provider value={value}>
      {children}
    </AssetSearchContext.Provider>
  );
}

function parseList(p: URLSearchParams, k: string): string[] {
  const v = p.get(k);
  return v ? v.split(',').filter(Boolean) : [];
}

function parseNum(p: URLSearchParams, k: string): number | undefined {
  const raw = p.get(k);
  if (!raw) return undefined;
  const v = parseFloat(raw);
  return isNaN(v) ? undefined : v;
}
