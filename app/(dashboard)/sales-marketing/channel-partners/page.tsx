import { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { CpCategoryBadge } from '@/components/sales/CpCategoryBadge';
import { CpStagePill } from '@/components/sales/CpStagePill';

export const metadata: Metadata = { title: 'Channel Partners — Anex Sales' };

export default async function ChannelPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; category?: string; stage?: string; q?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();
  const projectId = params.project ?? projects[0]?.id ?? '';

  const supabase = await createClient();

  // Fetch CP data joined with performance view
  let query = supabase
    .from('channel_partners')
    .select('id, canonical_name, category, stage, mobile_primary, zone, is_approved, is_active, created_at')
    .eq('is_active', true)
    .order('canonical_name');

  if (params.category) query = query.eq('category', params.category);
  if (params.stage) query = query.eq('stage', params.stage);
  if (params.q) query = query.ilike('canonical_name', `%${params.q}%`);

  const { data: cps } = await query.limit(200);

  const rows = cps ?? [];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Channel Partners</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rows.length} partners</p>
        </div>
        <Link
          href={`/sales-marketing/channel-partners/new?project=${projectId}`}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-transparent bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Register CP
        </Link>
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3 flex gap-3 text-sm shrink-0 flex-wrap">
        {(['', 'icp', 'rcp', 'cp'] as const).map(cat => (
          <Link
            key={cat}
            href={`/sales-marketing/channel-partners?project=${projectId}${cat ? `&category=${cat}` : ''}${params.stage ? `&stage=${params.stage}` : ''}`}
            className={`px-3 py-1 rounded-full border transition-colors ${
              (params.category ?? '') === cat
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {cat ? cat.toUpperCase() : 'All'}
          </Link>
        ))}
        <div className="ml-auto">
          <form method="GET" action="/sales-marketing/channel-partners" className="flex gap-2">
            <input type="hidden" name="project" value={projectId} />
            {params.category && <input type="hidden" name="category" value={params.category} />}
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Search by name..."
              className="h-7 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button type="submit" className="text-xs px-2 py-1 rounded border hover:bg-accent">Go</button>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr className="border-b">
              <th className="text-left px-4 py-3 font-medium">Canonical Name</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Stage</th>
              <th className="text-left px-4 py-3 font-medium">Mobile</th>
              <th className="text-left px-4 py-3 font-medium">Zone</th>
              <th className="text-center px-4 py-3 font-medium">Approved</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  No channel partners found.
                </td>
              </tr>
            )}
            {rows.map(cp => (
              <tr key={cp.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/sales-marketing/channel-partners/${cp.id}?project=${projectId}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {cp.canonical_name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <CpCategoryBadge category={cp.category as 'icp' | 'rcp' | 'cp'} />
                </td>
                <td className="px-4 py-3">
                  <CpStagePill stage={cp.stage as 'prospect' | 'active' | 'inactive'} />
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {cp.mobile_primary ?? '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">
                  {cp.zone?.replace(/_/g, ' ') ?? '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {cp.is_approved ? (
                    <span className="text-emerald-600 font-semibold text-xs">✓</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Pending</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
