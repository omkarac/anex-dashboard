import { Metadata } from 'next';
import Link from 'next/link';
import { TrendingUp, Megaphone, ArrowRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Anex Dashboard' };

export default function VerticalSelectorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Anex Dashboard</h1>
        <p className="text-muted-foreground mt-2 text-sm">Select a vertical to continue</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-xl">
        <Link
          href="/capital-markets"
          className="group relative flex flex-col gap-4 rounded-xl border bg-card p-7 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Capital Markets</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-snug">
              Asset pipeline, developer relationships, and deal tracking.
            </p>
          </div>
        </Link>

        <Link
          href="/sales-marketing"
          className="group relative flex flex-col gap-4 rounded-xl border bg-card p-7 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Megaphone className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Sales &amp; Marketing</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-snug">
              EOD reports, site visits, and outreach tracking.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
