'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Table2, Clock, BarChart3, ShieldAlert } from 'lucide-react';

export type AuditView = 'table' | 'timeline' | 'analytics' | 'flags';

const VIEWS: { id: AuditView; label: string; icon: React.ElementType }[] = [
  { id: 'table', label: 'Events', icon: Table2 },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'flags', label: 'Needs attention', icon: ShieldAlert },
];

export function AuditTabs({ active, flagCount }: { active: AuditView; flagCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(view: AuditView) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 border-b">
      {VIEWS.map((v) => {
        const isActive = v.id === active;
        return (
          <button
            key={v.id}
            onClick={() => go(v.id)}
            className={`relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <v.icon className="h-4 w-4" />
            {v.label}
            {v.id === 'flags' && flagCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold h-4 min-w-4 px-1">
                {flagCount}
              </span>
            )}
            {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}
