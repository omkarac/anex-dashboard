import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/rbac';
import { SkygaugeWorkspace } from '@/components/skygauge/skygauge-workspace';

export const metadata: Metadata = {
  title: 'Skygauge — Anex',
  description: 'Pre-NOCAS height permissibility for the Mumbai Metropolitan Region.',
};

export const dynamic = 'force-dynamic';

export default async function SkygaugePage() {
  // Admin-only tool: non-admins are redirected to '/'. The nav entry is also
  // gated (adminOnly) so it's only visible from an admin's dashboard.
  await requireAdmin();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="border-b bg-card shrink-0 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-foreground tracking-tight">
            Skygauge
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
            Pre-NOCAS height permissibility · MMR
          </p>
        </div>
        <div className="text-[11px] text-muted-foreground font-medium">
          Indicative only · formal sanction by AAI through NOCAS
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <SkygaugeWorkspace />
      </div>
    </div>
  );
}
