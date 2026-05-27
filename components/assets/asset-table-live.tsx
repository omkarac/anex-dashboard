'use client';

import { AssetTable } from './asset-table';
import { useAssetSearchContext } from './asset-list-provider';
import type { Asset } from '@/lib/schemas/asset';
import type { LatestUpdateSummary } from '@/lib/queries/updates';
import type { AssetOpenTask, UnassignedTask, MyTask } from '@/lib/queries/developers';
import type { TeamMemberOption } from '@/lib/queries/tasks';

type Props = {
  page: number;
  teamMembers: TeamMemberOption[];
  unassignedTasks: UnassignedTask[];
  myTasks: MyTask[];
  initialAssets: Asset[];
  initialCount: number;
  initialPageCount: number;
  initialLatestUpdates: Map<string, LatestUpdateSummary>;
  initialOpenTasks: AssetOpenTask[];
};

export function AssetTableLive({
  page,
  teamMembers,
  unassignedTasks,
  myTasks,
  initialAssets,
  initialCount,
  initialPageCount,
  initialLatestUpdates,
  initialOpenTasks,
}: Props) {
  const ctx = useAssetSearchContext();
  const d = ctx?.data ?? {
    assets: initialAssets,
    count: initialCount,
    pageCount: initialPageCount,
    latestUpdates: initialLatestUpdates,
    openTasks: initialOpenTasks,
  };

  return (
    <AssetTable
      data={d.assets}
      count={d.count}
      pageCount={d.pageCount}
      page={page}
      teamMembers={teamMembers}
      latestUpdates={d.latestUpdates}
      unassignedTasks={unassignedTasks}
      openTasks={d.openTasks}
      myTasks={myTasks}
    />
  );
}
