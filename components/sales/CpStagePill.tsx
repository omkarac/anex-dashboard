import { cn } from '@/lib/utils';
import type { CpStage } from '@/lib/schemas/sales';

const CONFIG: Record<CpStage, { label: string; classes: string }> = {
  prospect: { label: 'Prospect', classes: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  active:   { label: 'Active',   classes: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  inactive: { label: 'Inactive', classes: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

export function CpStagePill({ stage, className }: { stage: CpStage; className?: string }) {
  const c = CONFIG[stage] ?? CONFIG.prospect;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', c.classes, className)}>
      {c.label}
    </span>
  );
}
