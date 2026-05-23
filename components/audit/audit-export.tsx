'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportAuditCsv } from '@/lib/actions/logs';
import { istTodayISO } from '@/lib/utils/formatters';
import type { AuditVertical, LogFilters } from '@/lib/queries/logs';

export function AuditExport() {
  const searchParams = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);

  function currentFilters(): LogFilters {
    const vertical = (searchParams.get('vertical') as AuditVertical) || 'all';
    return {
      q: searchParams.get('q') || undefined,
      actor_id: searchParams.get('actor_id') || undefined,
      action: searchParams.get('action') || undefined,
      entity_type: searchParams.get('entity_type') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      show_deleted: searchParams.get('deleted') === '1',
      vertical,
    };
  }

  async function handleCsv() {
    setIsExporting(true);
    try {
      const result = await exportAuditCsv(currentFilters());
      if (!result.ok) return;
      const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${istTodayISO()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleCsv} disabled={isExporting}>
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export CSV
      </Button>
      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Print / PDF
      </Button>
    </div>
  );
}
