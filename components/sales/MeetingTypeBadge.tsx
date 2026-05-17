import { cn } from '@/lib/utils';
import type { MeetingType, MeetingCategory } from '@/lib/schemas/sales';

export function MeetingTypeBadge({
  type,
  category,
  className,
}: {
  type: MeetingType;
  category?: MeetingCategory;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-semibold',
          type === 'obm'
            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200'
            : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200'
        )}
      >
        {type.toUpperCase()}
      </span>
      {category && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-xs',
            category === 'unique'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          )}
        >
          {category.charAt(0).toUpperCase() + category.slice(1)}
        </span>
      )}
    </span>
  );
}
