import Link from 'next/link';
import { formatDate } from '@/lib/utils/formatters';
import type { ShareWithDetails } from '@/lib/queries/developers';

const OUTCOME_COLORS: Record<string, string> = {
  interested: 'bg-green-50 text-green-700 border-green-200',
  pursuing: 'bg-blue-50 text-blue-700 border-blue-200',
  passed: 'bg-gray-100 text-gray-500 border-gray-200',
  won: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function SharesView({ shares }: { shares: ShareWithDetails[] }) {
  if (shares.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No shares recorded yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {['Asset', 'Developer', 'Shared By', 'Shared On', 'Outcome'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shares.map((s) => (
            <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/capital-markets/assets/${s.asset_id}`}
                  className="font-medium hover:underline underline-offset-2 max-w-48 line-clamp-1 block"
                >
                  {s.asset_name}
                </Link>
              </td>
              <td className="px-4 py-3 font-medium">{s.developer_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.shared_by_name}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(s.shared_at)}</td>
              <td className="px-4 py-3">
                {s.outcome ? (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${OUTCOME_COLORS[s.outcome] ?? 'bg-muted text-muted-foreground border-border'}`}>
                    {s.outcome}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">Pending</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
