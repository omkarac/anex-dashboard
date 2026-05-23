'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAudit, type ActionResult } from '@/lib/actions/_base';
import { LostReasonSchema, type LostReason } from '@/lib/schemas/sales';
import { istTodayISO } from '@/lib/utils/formatters';
import { z } from 'zod';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CallQueueItem = {
  taskId: string;
  dueAt: string;
  taskType: string;
  notes: string | null;
  lead: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    mobile: string | null;
    stage: string;
    projectId: string;
    projectName: string | null;
  };
  consecutiveNotConnected: number;
};

// ── Get today's call queue ────────────────────────────────────────────────────

export async function getCallQueue(): Promise<ActionResult<CallQueueItem[]>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Not authenticated' };

    const service = createServiceClient();
    const today = istTodayISO();

    const { data: tasks, error: tasksError } = await service
      .from('follow_up_tasks')
      .select('id, due_at, task_type, notes, lead_id')
      .eq('assigned_to', user.id)
      .eq('status', 'pending')
      .lte('due_at', `${today}T23:59:59+05:30`)
      .not('lead_id', 'is', null)
      .order('due_at', { ascending: true });

    if (tasksError) return { ok: false, error: tasksError.message };
    if (!tasks || tasks.length === 0) return { ok: true, data: [] };

    const leadIds = tasks.map(t => t.lead_id as string);

    const { data: leads, error: leadsError } = await service
      .from('leads')
      .select('id, first_name, last_name, mobile_primary, stage, project_id')
      .in('id', leadIds)
      .eq('is_active', true);

    if (leadsError) return { ok: false, error: leadsError.message };

    const leadMap = new Map((leads ?? []).map(l => [l.id, l]));

    const projectIds = [...new Set((leads ?? []).map(l => l.project_id))];
    const { data: projects } = await service
      .from('sales_projects')
      .select('id, name')
      .in('id', projectIds);
    const projectMap = new Map((projects ?? []).map(p => [p.id, p.name as string]));

    // Last 5 calls per lead to compute consecutive not-connected streak
    const { data: activities } = await service
      .from('lead_activities')
      .select('lead_id, call_status')
      .in('lead_id', leadIds)
      .eq('activity_type', 'call')
      .order('created_at', { ascending: false })
      .limit(leadIds.length * 5);

    const consecutiveCounts: Record<string, number> = {};
    for (const leadId of leadIds) {
      const calls = (activities ?? []).filter(a => a.lead_id === leadId);
      let count = 0;
      for (const call of calls) {
        if (['not_answering', 'busy', 'not_reachable', 'wrong_number'].includes(call.call_status ?? '')) {
          count++;
        } else {
          break;
        }
      }
      consecutiveCounts[leadId] = count;
    }

    const items: CallQueueItem[] = tasks
      .filter(t => leadMap.has(t.lead_id as string))
      .map(t => {
        const lead = leadMap.get(t.lead_id as string)!;
        return {
          taskId: t.id,
          dueAt: t.due_at,
          taskType: t.task_type,
          notes: t.notes,
          lead: {
            id: lead.id,
            firstName: lead.first_name,
            lastName: lead.last_name,
            mobile: lead.mobile_primary,
            stage: lead.stage,
            projectId: lead.project_id,
            projectName: projectMap.get(lead.project_id) ?? null,
          },
          consecutiveNotConnected: consecutiveCounts[t.lead_id as string] ?? 0,
        };
      });

    return { ok: true, data: items };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load call queue' };
  }
}

// ── Log call + complete task ──────────────────────────────────────────────────

const LogCallServerSchema = z.object({
  lead_id: z.string().uuid(),
  call_status: z.enum(['connected', 'not_answering', 'busy', 'wrong_number', 'not_reachable']),
  outcome: z.enum(['interested', 'not_interested', 'callback', 'site_visit_confirmed', 'lost']).optional(),
  remarks: z.string().min(1, 'Remarks are required'),
  next_followup_date: z.string().optional(),
  task_id_to_complete: z.string().uuid().optional(),
}).refine(
  d => d.call_status !== 'connected' || d.next_followup_date !== undefined,
  { message: 'Follow-up date is required for connected calls', path: ['next_followup_date'] }
);

export type LogCallServerInput = z.input<typeof LogCallServerSchema>;

export async function logCallAndCompleteTask(
  input: LogCallServerInput
): Promise<ActionResult<{ activityId: string }>> {
  const parsed = LogCallServerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }
  const d = parsed.data;

  return withAudit({
    action: 'create',
    entityType: 'lead_activity',
    entityId: d.lead_id,
    summary: `Call logged: ${d.call_status}${d.outcome ? ` → ${d.outcome}` : ''}`,
    mutation: async (actorId) => {
      const service = createServiceClient();

      const { data: activity, error: actError } = await service
        .from('lead_activities')
        .insert({
          lead_id: d.lead_id,
          sm_id: actorId,
          activity_type: 'call',
          call_status: d.call_status,
          outcome: d.outcome ?? null,
          remarks: d.remarks,
          next_followup_date: d.next_followup_date ? `${d.next_followup_date}T09:00:00` : null,
          created_by: actorId,
        })
        .select('id')
        .single();

      if (actError) throw new Error(actError.message);

      if (d.call_status === 'connected') {
        const stageMap: Record<string, string> = {
          interested: 'interested',
          site_visit_confirmed: 'site_visit_scheduled',
          callback: 'called',
          not_interested: 'called',
        };
        const newStage = d.outcome ? (stageMap[d.outcome] ?? 'called') : 'called';
        await service
          .from('leads')
          .update({
            stage: newStage,
            next_followup_date: d.next_followup_date ? `${d.next_followup_date}T09:00:00` : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', d.lead_id);
      }

      if (d.task_id_to_complete) {
        await service
          .from('follow_up_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: actorId,
          })
          .eq('id', d.task_id_to_complete);
      }

      if (d.next_followup_date) {
        await service
          .from('follow_up_tasks')
          .insert({
            lead_id: d.lead_id,
            assigned_to: actorId,
            due_at: `${d.next_followup_date}T09:00:00`,
            task_type: 'follow_up_call',
            created_by: actorId,
          });
      }

      return { activityId: activity.id };
    },
  });
}

// ── Mark lead lost ────────────────────────────────────────────────────────────

const MarkLeadLostSchema = z.object({
  lead_id: z.string().uuid(),
  lost_reason: LostReasonSchema,
  task_id_to_complete: z.string().uuid().optional(),
});

export async function markLeadLost(
  input: z.input<typeof MarkLeadLostSchema>
): Promise<ActionResult<{ leadId: string }>> {
  const parsed = MarkLeadLostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }
  const d = parsed.data;

  return withAudit({
    action: 'status_change',
    entityType: 'lead',
    entityId: d.lead_id,
    summary: `Lead marked lost: ${d.lost_reason}`,
    mutation: async (actorId) => {
      const service = createServiceClient();

      await service
        .from('leads')
        .update({
          stage: 'lost',
          lost_reason: d.lost_reason,
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', d.lead_id);

      if (d.task_id_to_complete) {
        await service
          .from('follow_up_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: actorId,
          })
          .eq('id', d.task_id_to_complete);
      }

      return { leadId: d.lead_id };
    },
  });
}
