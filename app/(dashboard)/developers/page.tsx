import { Metadata } from 'next';
import { listDevelopers, listAllShares } from '@/lib/queries/developers';
import { DeveloperTable } from '@/components/developers/developer-table';
import { DeveloperCreateSheet } from '@/components/developers/developer-create-sheet';
import { SharesView } from '@/components/developers/shares-view';
import { ViewToggle } from '@/components/developers/view-toggle';

export const metadata: Metadata = { title: 'Developers — Anex' };

export default async function DevelopersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const view = params.view === 'shares' ? 'shares' : 'list';

  const [developers, shares] = await Promise.all([
    listDevelopers().catch(() => []),
    view === 'shares' ? listAllShares().catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Developers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              External developers we share assets with
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle active={view} />
            {view === 'list' && <DeveloperCreateSheet />}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {view === 'list' ? (
          <DeveloperTable developers={developers} />
        ) : (
          <SharesView shares={shares} />
        )}
      </div>
    </div>
  );
}
