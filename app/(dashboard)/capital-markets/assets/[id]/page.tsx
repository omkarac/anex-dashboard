import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAsset } from '@/lib/queries/assets';
import { getUpdatesForAsset, getActivityLogsForAsset } from '@/lib/queries/updates';
import { getTasksForAsset, getTeamMembers } from '@/lib/queries/tasks';
import { StatusBadge } from '@/components/assets/status-badge';
import { TemperatureBadge } from '@/components/assets/temperature-badge';
import { DetailPanels } from '@/components/assets/detail-panels';
import { ShareDialog } from '@/components/assets/share-dialog';
import { getSharesForAsset, getDeveloperOptions } from '@/lib/queries/developers';
import { getFilesForAsset } from '@/lib/queries/asset-files';
import { getScenariosForAsset } from '@/lib/queries/asset-scenarios';
import { ScenariosPanel } from '@/components/assets/scenarios-panel';
import { ASSET_TYPE_LABELS } from '@/lib/enums/asset';
import { formatDate } from '@/lib/utils/formatters';
import { AssetAssignSelect } from '@/components/assets/asset-assign-select';
import { FileDrawer } from '@/components/assets/file-drawer';
import { RegulationsEditor } from '@/components/assets/regulations-editor';
import { ChevronLeft } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const asset = await getAsset(id);
  return { title: asset ? `${asset.property_name} — Anex` : 'Asset — Anex' };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="text-sm text-right">{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? '';

  const [asset, updates, tasks, activity, shares, developers, files, teamMembers, scenarios] = await Promise.all([
    getAsset(id),
    getUpdatesForAsset(id).catch(() => []),
    getTasksForAsset(id).catch(() => []),
    getActivityLogsForAsset(id).catch(() => []),
    getSharesForAsset(id).catch(() => []),
    getDeveloperOptions().catch(() => []),
    getFilesForAsset(id).catch(() => []),
    getTeamMembers().catch(() => []),
    getScenariosForAsset(id).catch(() => []),
  ]);

  if (!asset) notFound();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <Link
          href="/capital-markets/assets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Asset Registry
        </Link>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight truncate">
              {asset.property_name}
            </h1>
            {asset.location && (
              <p className="text-sm text-muted-foreground mt-0.5">{asset.location}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <ShareDialog assetId={id} developers={developers} />
            {shares.length > 0 && (
              <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 border-purple-200">
                Shared w/ {shares.length} Developer{shares.length !== 1 ? 's' : ''}
              </span>
            )}
            <StatusBadge status={asset.status} />
            <TemperatureBadge temperature={asset.temperature} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <section className="rounded-lg border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Assigned To
              </h2>
              <AssetAssignSelect
                assetId={id}
                assignedTo={asset.assigned_to ?? null}
                teamMembers={teamMembers}
                variant="detail"
              />
            </section>

            <section className="rounded-lg border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Classification
              </h2>
              <Field label="Type" value={asset.asset_type ? ASSET_TYPE_LABELS[asset.asset_type] : null} />
              <Field label="SPOC / Agent" value={asset.spoc_agent} />
              <Field label="Resource" value={asset.resource} />
              {asset.handover_notes && <Field label="Handover Notes" value={asset.handover_notes} />}
            </section>

            <ScenariosPanel assetId={id} initialScenarios={scenarios} plotSizeSqm={asset.plot_size_sqm} />

            <RegulationsEditor
              assetId={id}
              regulations={asset.regulations}
              regulationNotes={asset.regulation_notes}
            />

            <FileDrawer assetId={id} initialFiles={files} />

            <section className="rounded-lg border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Meta
              </h2>
              <Field label="Created" value={formatDate(asset.created_at)} />
              <Field label="Last Updated" value={formatDate(asset.updated_at)} />
            </section>
          </div>

          <div className="lg:col-span-2">
            <DetailPanels
              assetId={id}
              currentUserId={currentUserId}
              updates={updates}
              tasks={tasks}
              activity={activity}
              shares={shares}
              teamMembers={teamMembers}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
