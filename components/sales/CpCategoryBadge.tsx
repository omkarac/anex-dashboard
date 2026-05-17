import { cn } from '@/lib/utils';
import type { CpCategory } from '@/lib/schemas/sales';

const CONFIG: Record<CpCategory, { label: string; classes: string }> = {
  icp: { label: 'ICP', classes: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200' },
  rcp: { label: 'RCP', classes: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200' },
  cp:  { label: 'CP',  classes: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300' },
};

export function CpCategoryBadge({ category, className }: { category: CpCategory; className?: string }) {
  const c = CONFIG[category] ?? CONFIG.cp;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', c.classes, className)}>
      {c.label}
    </span>
  );
}
