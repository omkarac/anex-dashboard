import { Metadata } from 'next';
import { Suspense } from 'react';
import { listAssets, getDistinctSpocAgents } from '@/lib/queries/assets';
import { AssetTable } from '@/components/assets/asset-table';
import { FilterBar } from '@/components/assets/filter-bar';
import { AssetCreateSheet } from '@/components/assets/asset-create-sheet';

export const metadata: Metadata = { title: 'Assets — Anex' };

function parseParam(params: Record<string, string>, key: string): string[] {
  return params[key] ? params[key].split(',').filter(Boolean) : [];
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? '1', 10);

  const filters = {
    status: parseParam(params, 'status'),
    temperature: parseParam(params, 'temperature'),
    asset_type: parseParam(params, 'asset_type'),
    regulation: parseParam(params, 'regulation'),
    spoc_agent: parseParam(params, 'spoc_agent'),
    page,
  };

  const [{ assets, count, pageCount }, spocOptions] = await Promise.all([
    listAssets(filters),
    getDistinctSpocAgents(),
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
          <AssetCreateSheet />
        </div>
        <div className="mt-3">
          <Suspense>
            <FilterBar spocOptions={spocOptions} />
          </Suspense>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Suspense>
          <AssetTable data={assets} count={count} pageCount={pageCount} page={page} />
        </Suspense>
      </div>
    </div>
  );
}
