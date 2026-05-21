'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { currentUser } from '@/lib/rbac';
import { listLogs, type LogFilters } from '@/lib/queries/logs';
import { revalidatePath } from 'next/cache';

export async function deleteActivityLog(
  logId: string,
  reason: string
): Promise<ActionResult<void>> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { ok: false, error: 'Reason is required' };

  // Audit integrity: only admins may strike a log entry from the record.
  const actor = await currentUser();
  if (actor.role !== 'admin') {
    return { ok: false, error: 'Only admins can delete audit entries' };
  }

  const result = await withAudit({
    action: 'delete',
    entityType: 'activity_log',
    entityId: logId,
    summary: `Deleted a log entry. Reason: ${trimmedReason}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('activity_logs')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          delete_reason: trimmedReason,
        })
        .eq('id', logId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) {
    revalidatePath('/audit');
    revalidatePath('/capital-markets/logs');
    revalidatePath('/sales-marketing/logs');
  }
  return result;
}

const CSV_EXPORT_CAP = 5000;

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportAuditCsv(
  filters: LogFilters
): Promise<ActionResult<string>> {
  try {
    const rows: string[] = [];
    rows.push(['Timestamp', 'Actor', 'Action', 'Entity Type', 'Asset', 'Summary', 'Deleted'].join(','));

    let page = 0;
    let fetched = 0;
    // Page through results so the export reflects the full filtered set, not one page.
    while (fetched < CSV_EXPORT_CAP) {
      const { logs, total } = await listLogs({ ...filters, page });
      if (logs.length === 0) break;
      for (const log of logs) {
        rows.push(
          [
            csvCell(log.created_at),
            csvCell(log.actor?.full_name ?? ''),
            csvCell(log.action),
            csvCell(log.entity_type),
            csvCell(log.asset?.property_name ?? ''),
            csvCell(log.summary),
            csvCell(log.deleted_at ? 'yes' : 'no'),
          ].join(',')
        );
      }
      fetched += logs.length;
      page += 1;
      if (fetched >= total) break;
    }

    return { ok: true, data: rows.join('\n') };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    return { ok: false, error: message };
  }
}
