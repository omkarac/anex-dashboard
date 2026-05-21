import type { AuditVertical } from '@/lib/queries/logs';
import type { FlagKind } from '@/lib/queries/audit';

export const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status',
  share: 'Shared',
  convert: 'Converted',
  delete_log: 'Log Deleted',
};

// Tailwind class triples (bg / text / border) per action for badges.
export const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  status_change: 'bg-amber-50 text-amber-700 border-amber-200',
  share: 'bg-purple-50 text-purple-700 border-purple-200',
  convert: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  delete_log: 'bg-red-50 text-red-700 border-red-200',
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function actionColor(action: string): string {
  return ACTION_COLORS[action] ?? 'bg-muted text-muted-foreground border-border';
}

export const VERTICAL_LABELS: Record<AuditVertical | 'other', string> = {
  all: 'All Verticals',
  capital_markets: 'Capital Markets',
  sales_marketing: 'Sales & Marketing',
  other: 'Other',
};

export const VERTICAL_SHORT: Record<AuditVertical | 'other', string> = {
  all: 'All',
  capital_markets: 'CM',
  sales_marketing: 'S&M',
  other: '—',
};

export const VERTICAL_COLORS: Record<AuditVertical | 'other', string> = {
  all: 'bg-muted text-muted-foreground border-border',
  capital_markets: 'bg-sky-50 text-sky-700 border-sky-200',
  sales_marketing: 'bg-orange-50 text-orange-700 border-orange-200',
  other: 'bg-muted text-muted-foreground border-border',
};

export const FLAG_LABELS: Record<FlagKind, string> = {
  deletion: 'Deletion',
  status_reversal: 'Status reversal',
  after_hours: 'After hours',
  bulk: 'Bulk action',
};

export const FLAG_COLORS: Record<FlagKind, string> = {
  deletion: 'bg-red-50 text-red-700 border-red-200',
  status_reversal: 'bg-amber-50 text-amber-700 border-amber-200',
  after_hours: 'bg-violet-50 text-violet-700 border-violet-200',
  bulk: 'bg-rose-50 text-rose-700 border-rose-200',
};
