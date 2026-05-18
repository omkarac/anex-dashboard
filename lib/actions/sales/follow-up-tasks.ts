'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { withAudit, type ActionResult } from '@/lib/actions/_base';
import {
  CreateFollowUpTaskInputSchema,
  SnoozeFollowUpTaskInputSchema,
  EscalateFollowUpTaskInputSchema,
  type FollowUpTask,
  type CreateFollowUpTaskInput,
  type SnoozeFollowUpTaskInput,
  type EscalateFollowUpTaskInput,
} from '@/lib/schemas/sales-calendar';

// ── Row type returned by queries (with joined data) ────────────────────────────

export type FollowUpTaskRow = {
  id: string;
  lead_id: string | null;
  walk_in_id: string | null;
  assigned_to: string;
  due_at: string;
  task_type: string;
  notes: string | null;
  status: string;
  completed_at: string | null;
  snoozed_until: string | null;
  snooze_count: number;
  escalated_at: string | null;
  escalated_to: string | null;
  escalation_reason: string | null;
  created_at: string;
  // joined
  client_name: string | null;
  client_mobile: string | null;
  cp_name: string | null;
  walk_in_status: string | null;
  project_id: string | null;
};

export async function getMyFollowUpTasks(): Promise<FollowUpTaskRow[]> {
  const member = await getAuthenticatedMember();
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('follow_up_tasks')
    .select(`
      id, lead_id, walk_in_id, assigned_to, due_at, task_type, notes,
      status, completed_at, snoozed_until, snooze_count,
      escalated_at, escalated_to, escalation_reason, created_at,
      walk_ins (
        id, status, project_id,
        clients ( first_name, last_name, mobile_primary ),
        channel_partners ( canonical_name )
      ),
      leads (
        id, first_name, last_name, mobile_primary, project_id,
        channel_partners ( canonical_name )
      )
    `)
    .eq('assigned_to', member.id)
    .in('status', ['pending', 'missed', 'snoozed'])
    .order('due_at', { ascending: true });

  return (data ?? []).map((r) => {
    let client_name: string | null = null;
    let client_mobile: string | null = null;
    let cp_name: string | null = null;
    let walk_in_status: string | null = null;
    let project_id: string | null = null;

    const wi = r.walk_ins as unknown as {
      id: string; status: string; project_id: string;
      clients: { first_name: string | null; last_name: string | null; mobile_primary: string } | null;
      channel_partners: { canonical_name: string } | null;
    } | null;

    const lead = r.leads as unknown as {
      id: string; first_name: string | null; last_name: string | null;
      mobile_primary: string | null; project_id: string;
      channel_partners: { canonical_name: string } | null;
    } | null;

    if (wi) {
      const c = wi.clients;
      client_name = c ? [c.first_name, c.last_name].filter(Boolean).join(' ') || null : null;
      client_mobile = c?.mobile_primary ?? null;
      cp_name = wi.channel_partners?.canonical_name ?? null;
      walk_in_status = wi.status;
      project_id = wi.project_id;
    } else if (lead) {
      client_name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null;
      client_mobile = lead.mobile_primary;
      cp_name = lead.channel_partners?.canonical_name ?? null;
      project_id = lead.project_id;
    }

    return {
      id: r.id,
      lead_id: r.lead_id,
      walk_in_id: r.walk_in_id,
      assigned_to: r.assigned_to,
      due_at: r.due_at,
      task_type: r.task_type,
      notes: r.notes,
      status: r.status,
      completed_at: r.completed_at,
      snoozed_until: r.snoozed_until,
      snooze_count: r.snooze_count ?? 0,
      escalated_at: r.escalated_at,
      escalated_to: r.escalated_to,
      escalation_reason: r.escalation_reason,
      created_at: r.created_at,
      client_name,
      client_mobile,
      cp_name,
      walk_in_status,
      project_id,
    };
  });
}

export async function getTaskKpis(): Promise<{
  dueToday: number;
  overdue: number;
  pendingTotal: number;
  completedToday: number;
}> {
  const member = await getAuthenticatedMember();
  const supabase = createServiceClient();
  const now = new Date();
  const todayStart = now.toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const todayEnd = now.toISOString().slice(0, 10) + 'T23:59:59.999Z';

  const [{ data: pending }, { data: completedToday }] = await Promise.all([
    supabase
      .from('follow_up_tasks')
      .select('id, due_at, status')
      .eq('assigned_to', member.id)
      .in('status', ['pending', 'missed', 'snoozed']),
    supabase
      .from('follow_up_tasks')
      .select('id')
      .eq('assigned_to', member.id)
      .eq('status', 'completed')
      .gte('completed_at', todayStart)
      .lte('completed_at', todayEnd),
  ]);

  const rows = pending ?? [];
  const todayStr = now.toISOString().slice(0, 10);
  const dueToday = rows.filter(r => r.due_at.slice(0, 10) === todayStr && r.status === 'pending').length;
  const overdue = rows.filter(r => r.due_at < now.toISOString() && r.status !== 'snoozed').length;

  return {
    dueToday,
    overdue,
    pendingTotal: rows.length,
    completedToday: (completedToday ?? []).length,
  };
}

export async function createFollowUpTask(
  input: CreateFollowUpTaskInput
): Promise<ActionResult<FollowUpTask>> {
  const parsed = CreateFollowUpTaskInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  return withAudit({
    action: 'create',
    entityType: 'follow_up_task',
    entityId: 'new',
    summary: `Created ${parsed.data.task_type} task due ${parsed.data.due_at}`,
    mutation: async (actorId) => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('follow_up_tasks')
        .insert({
          walk_in_id: parsed.data.walk_in_id ?? null,
          lead_id: parsed.data.lead_id ?? null,
          assigned_to: parsed.data.assigned_to,
          due_at: parsed.data.due_at,
          task_type: parsed.data.task_type,
          notes: parsed.data.notes ?? null,
          status: 'pending',
          created_by: actorId,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as FollowUpTask;
    },
  });
}

export async function completeFollowUpTask(
  taskId: string,
  notes?: string
): Promise<ActionResult<FollowUpTask>> {
  return withAudit({
    action: 'update',
    entityType: 'follow_up_task',
    entityId: taskId,
    summary: 'Task marked as completed',
    mutation: async (actorId) => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('follow_up_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: actorId,
          notes: notes ?? undefined,
        })
        .eq('id', taskId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as FollowUpTask;
    },
  });
}

export async function snoozeFollowUpTask(
  input: SnoozeFollowUpTaskInput
): Promise<ActionResult<FollowUpTask>> {
  const parsed = SnoozeFollowUpTaskInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  return withAudit({
    action: 'update',
    entityType: 'follow_up_task',
    entityId: parsed.data.task_id,
    summary: `Task snoozed until ${parsed.data.snoozed_until}`,
    mutation: async (_actorId) => {
      const supabase = createServiceClient();

      // Read current snooze_count first
      const { data: existing } = await supabase
        .from('follow_up_tasks')
        .select('snooze_count')
        .eq('id', parsed.data.task_id)
        .single();

      const { data, error } = await supabase
        .from('follow_up_tasks')
        .update({
          status: 'snoozed',
          snoozed_until: parsed.data.snoozed_until,
          snooze_count: ((existing?.snooze_count ?? 0) + 1),
        })
        .eq('id', parsed.data.task_id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as FollowUpTask;
    },
  });
}

export async function escalateFollowUpTask(
  input: EscalateFollowUpTaskInput
): Promise<ActionResult<FollowUpTask>> {
  const parsed = EscalateFollowUpTaskInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  return withAudit({
    action: 'update',
    entityType: 'follow_up_task',
    entityId: parsed.data.task_id,
    summary: `Task escalated to ${parsed.data.escalate_to_id}`,
    mutation: async (_actorId) => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('follow_up_tasks')
        .update({
          escalated_at: new Date().toISOString(),
          escalated_to: parsed.data.escalate_to_id,
          escalation_reason: parsed.data.reason,
        })
        .eq('id', parsed.data.task_id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as FollowUpTask;
    },
  });
}
