import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAsset } from '@/lib/queries/assets';
import { getUpdatesForAsset, getStatusHistoryForAsset, getActivityLogsForAsset } from '@/lib/queries/updates';
import { getTasksForAsset, getTeamMembers } from '@/lib/queries/tasks';
import { StatusBadge } from '@/components/assets/status-badge';
import { TemperatureBadge } from '@/components/assets/temperature-badge';
import { DetailPanels } from '@/components/assets/detail-panels';
import { ShareDialog } from '@/components/assets/share-dialog';
import { getSharesForAsset, getDeveloperOptions } from '@/lib/queries/developers';
import { getEngagementForAsset } from '@/lib/queries/engagements';
import { ASSET_TYPE_LABELS } from '@/lib/enums/asset';
import { ENGAGEMENT_KIND_LABELS } from '@/lib/enums/engagement';
import { formatSqm, formatPsf, formatDate, toCr } from '@/lib/utils/formatters';
import { ConvertDialog } from '@/components/assets/convert-dialog';
import { FinancialsEditor } from '@/components/assets/financials-editor';
import { NextStepEditor } from '@/components/assets/next-step-editor';
import { AssetAssignSelect } from '@/components/assets/asset-assign-select';
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

  // .catch(() => []) / null ensures a missing table never 500s the page
  const [asset, updates, tasks, history, activity, shares, developers, engagement, teamMembers] = await Promise.all([
    getAsset(id),
    getUpdatesForAsset(id).catch(() => []),
    getTasksForAsset(id).catch(() => []),
    getStatusHistoryForAsset(id).catch(() => []),
    getActivityLogsForAsset(id).catch(() => []),
    getSharesForAsset(id).catch(() => []),
    getDeveloperOptions().catch(() => []),
    getEngagementForAsset(id).catch(() => null),
    getTeamMembers().catch(() => []),
  ]);

  if (!asset) notFound();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <Link
          href="/assets"
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
          <div className="flex items-center gap-2 shrink-0">
            {asset.status === 'won' && !asset.converted_to_engagement_id && (
              <ConvertDialog assetId={id} />
            )}
            <ShareDialog assetId={id} developers={developers} />
            <StatusBadge status={asset.status} />
            <TemperatureBadge temperature={asset.temperature} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — core facts */}
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

            <FinancialsEditor asset={asset} />

            {(asset.regulations.length > 0 || asset.regulation_notes) && (
              <section className="rounded-lg border p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Regulations
                </h2>
                {asset.regulations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {asset.regulations.map((r) => (
                      <span key={r} className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{r}</span>
                    ))}
                  </div>
                )}
                {asset.regulation_notes && (
                  <p className="text-xs text-muted-foreground">{asset.regulation_notes}</p>
                )}
              </section>
            )}

            <NextStepEditor assetId={id} initialValue={asset.next_step} />

            {engagement && (
              <section className="rounded-lg border border-green-200 bg-green-50/50 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-green-700 mb-3">
                  Engagement
                </h2>
                <Field label="Type" value={ENGAGEMENT_KIND_LABELS[engagement.kind]} />
                <Field label="Started" value={formatDate(engagement.started_at)} />
                {engagement.ended_at && <Field label="Ended" value={formatDate(engagement.ended_at)} />}
                {engagement.notes && <Field label="Notes" value={engagement.notes} />}
                <Field label="By" value={engagement.actor?.full_name ?? 'Unknown'} />
              </section>
            )}

            <section className="rounded-lg border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Meta
              </h2>
              <Field label="Created" value={formatDate(asset.created_at)} />
              <Field label="Last Updated" value={formatDate(asset.updated_at)} />
            </section>
          </div>

          {/* Right 2/3 — bento panels */}
          <div className="lg:col-span-2">
            <DetailPanels
              assetId={id}
              currentUserId={currentUserId}
              updates={updates}
              tasks={tasks}
              history={history}
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
