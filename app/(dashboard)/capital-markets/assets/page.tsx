import { Metadata } from 'next';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';
import { listAssets, getDistinctSpocAgents, getAssetNumericBounds } from '@/lib/queries/assets';
import { getLatestUpdatesForAssets } from '@/lib/queries/updates';
import { getTeamMembers } from '@/lib/queries/tasks';
import { getUnassignedTasks, getMyTasks, getOpenTasksForAssets, getAssetIdsWithOpenTasks } from '@/lib/queries/developers';
import { getAuthenticatedMember } from '@/lib/auth/member';
import type { SortOption } from '@/lib/queries/assets';
import { AssetTable } from '@/components/assets/asset-table';
import { FilterBar } from '@/components/assets/filter-bar';
import { AssetCreateSheet } from '@/components/assets/asset-create-sheet';

export const metadata: Metadata = { title: 'Assets — Anex' };

const VALID_SORTS: SortOption[] = ['updated_desc', 'name_asc', 'name_desc', 'topline_asc', 'topline_desc'];

function parseParam(params: Record<string, string>, key: string): string[] {
  return params[key] ? params[key].split(',').filter(Boolean) : [];
}

function parseNum(params: Record<string, string>, key: string): number | undefined {
  const v = parseFloat(params[key]);
  return isNaN(v) ? undefined : v;
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? '1', 10);
  const sort = VALID_SORTS.includes(params.sort as SortOption) ? (params.sort as SortOption) : 'updated_desc';

  const hasOpenTasksFilter = params.has_open_tasks === '1';

  const me = await getAuthenticatedMember();
  const [openTaskAssetIdFilter, spocOptions, bounds, teamMembers, unassignedTasks, myTasks] = await Promise.all([
    hasOpenTasksFilter ? getAssetIdsWithOpenTasks().catch(() => []) : Promise.resolve(undefined),
    getDistinctSpocAgents(),
    getAssetNumericBounds(),
    getTeamMembers().catch(() => []),
    getUnassignedTasks().catch(() => []),
    getMyTasks(me.id).catch(() => []),
  ]);

  const filters = {
    q: params.q?.trim() || undefined,
    status: parseParam(params, 'status'),
    temperature: parseParam(params, 'temperature'),
    asset_type: parseParam(params, 'asset_type'),
    regulation: parseParam(params, 'regulation'),
    spoc_agent: parseParam(params, 'spoc_agent'),
    sort,
    topline_min: parseNum(params, 'topline_min'),
    topline_max: parseNum(params, 'topline_max'),
    inv_min: parseNum(params, 'inv_min'),
    inv_max: parseNum(params, 'inv_max'),
    plot_min: parseNum(params, 'plot_min'),
    plot_max: parseNum(params, 'plot_max'),
    page,
    asset_ids: openTaskAssetIdFilter,
  };

  const { assets, count, pageCount } = await listAssets(filters);

  const assetIds = assets.map((a) => a.id);
  const unassignedAssetIds = [...new Set(unassignedTasks.map((t) => t.asset_id))];
  const openTaskAssetIds = [...new Set([...assetIds, ...unassignedAssetIds])];
  const [latestUpdates, openTasks] = await Promise.all([
    getLatestUpdatesForAssets(assetIds),
    getOpenTasksForAssets(openTaskAssetIds).catch(() => []),
  ]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Asset Registry</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All real-estate opportunities tracked by Anex
            </p>
          </div>
          <AssetCreateSheet teamMembers={teamMembers} />
        </div>
        <div className="mt-3">
          <Suspense>
            <FilterBar spocOptions={spocOptions} toplineBound={bounds.topline_max} invBound={bounds.inv_max} plotBound={bounds.plot_max} />
          </Suspense>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Suspense>
          <AssetTable data={assets} count={count} pageCount={pageCount} page={page} teamMembers={teamMembers} latestUpdates={latestUpdates} unassignedTasks={unassignedTasks} openTasks={openTasks} myTasks={myTasks} />
        </Suspense>
      </div>
    </div>
  );
}
