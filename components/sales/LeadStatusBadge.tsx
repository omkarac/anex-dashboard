import { cn } from '@/lib/utils';
import type { LeadStatus } from '@/lib/schemas/sales';

const STATUS_CONFIG: Record<LeadStatus, { label: string; classes: string }> = {
  hot:    { label: 'Hot',    classes: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300' },
  warm:   { label: 'Warm',   classes: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300' },
  cold:   { label: 'Cold',   classes: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300' },
  lost:   { label: 'Lost',   classes: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300' },
  booked: { label: 'Booked', classes: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300' },
};

interface LeadStatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, classes: 'bg-gray-100 text-gray-700' };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export function getStatusRowClass(status: LeadStatus): string {
  return {
    booked: 'bg-green-50/60 dark:bg-green-950/20',
    warm:   'bg-yellow-50/60 dark:bg-yellow-950/20',
    cold:   'bg-blue-50/30 dark:bg-blue-950/10',
    lost:   'bg-red-50/40 dark:bg-red-950/15',
    hot:    'bg-orange-50/50 dark:bg-orange-950/20',
  }[status] ?? '';
}
