import { cn } from '@/lib/utils';

type KpiColor = 'navy' | 'green' | 'teal' | 'red' | 'gold' | 'purple' | 'slate';

const COLOR_MAP: Record<KpiColor, { bar: string; value: string; bg: string }> = {
  navy:   { bar: 'bg-slate-800 dark:bg-slate-200',   value: 'text-slate-800 dark:text-slate-100',  bg: 'bg-slate-50 dark:bg-slate-900' },
  green:  { bar: 'bg-emerald-600 dark:bg-emerald-400', value: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950' },
  teal:   { bar: 'bg-teal-600 dark:bg-teal-400',    value: 'text-teal-700 dark:text-teal-300',    bg: 'bg-teal-50 dark:bg-teal-950' },
  red:    { bar: 'bg-red-600 dark:bg-red-400',       value: 'text-red-700 dark:text-red-300',       bg: 'bg-red-50 dark:bg-red-950' },
  gold:   { bar: 'bg-amber-500 dark:bg-amber-400',   value: 'text-amber-700 dark:text-amber-300',   bg: 'bg-amber-50 dark:bg-amber-950' },
  purple: { bar: 'bg-purple-600 dark:bg-purple-400', value: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-950' },
  slate:  { bar: 'bg-slate-500 dark:bg-slate-400',   value: 'text-slate-700 dark:text-slate-300',   bg: 'bg-slate-50 dark:bg-slate-800' },
};

interface KpiTileProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: KpiColor;
  className?: string;
}

export function KpiTile({ label, value, subtitle, color = 'navy', className }: KpiTileProps) {
  const c = COLOR_MAP[color];
  return (
    <div className={cn('rounded-lg border overflow-hidden', c.bg, className)}>
      <div className={cn('px-3 py-1.5 text-xs font-semibold tracking-wide text-white', c.bar)}>
        {label}
      </div>
      <div className="px-4 py-3">
        <div className={cn('text-3xl font-bold tabular-nums', c.value)}>{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}
