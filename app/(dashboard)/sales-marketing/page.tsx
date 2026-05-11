import { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sales & Marketing — Anex' };

export default function SalesMarketingPage() {
  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Sales &amp; Marketing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Sales &amp; Marketing vertical — coming soon.</p>
      </div>

      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No widgets yet. More coming soon.
      </div>
    </div>
  );
}
