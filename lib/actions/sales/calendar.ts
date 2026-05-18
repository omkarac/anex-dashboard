'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { withAudit, type ActionResult } from '@/lib/actions/_base';
import {
  CreateVisitScheduleInputSchema,
  UpdateVisitScheduleStatusInputSchema,
  type VisitSchedule,
  type CreateVisitScheduleInput,
  type UpdateVisitScheduleStatusInput,
} from '@/lib/schemas/sales-calendar';

// ── Row type returned by queries (with joined data) ────────────────────────────

export type VisitScheduleRow = {
  id: string;
  project_id: string;
  client_name: string | null;
  client_mobile: string | null;
  client_id: string | null;
  walk_in_id: string | null;
  lead_id: string | null;
  tentative_date: string;
  tentative_time: string | null;
  status: string;
  cp_name: string | null;
  sourcing_sm_name: string | null;
  closing_sm_name: string | null;
  outcome_notes: string | null;
  created_at: string;
  cp_id: string | null;
  sourcing_sm_id: string;
  closing_sm_id: string | null;
};

export async function getVisitSchedules(
  projectId: string,
  startDate?: string,
  endDate?: string
): Promise<VisitScheduleRow[]> {
  const supabase = createServiceClient();

  const start = startDate ?? new Date().toISOString().slice(0, 10);
  const d = new Date();
  d.setDate(d.getDate() + 60);
  const end = endDate ?? d.toISOString().slice(0, 10);

  const { data } = await supabase
    .from('visit_schedules')
    .select(`
      id, project_id, client_name, client_mobile, client_id, walk_in_id, lead_id,
      tentative_date, tentative_time, status, outcome_notes, created_at,
      cp_id, sourcing_sm_id, closing_sm_id,
      channel_partners ( canonical_name ),
      sourcing_sm:team_members!visit_schedules_sourcing_sm_id_fkey ( full_name ),
      closing_sm:team_members!visit_schedules_closing_sm_id_fkey ( full_name )
    `)
    .eq('project_id', projectId)
    .gte('tentative_date', start)
    .lte('tentative_date', end)
    .not('status', 'in', '("cancelled","rescheduled")')
    .order('tentative_date', { ascending: true })
    .order('tentative_time', { ascending: true, nullsFirst: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    project_id: r.project_id,
    client_name: r.client_name,
    client_mobile: r.client_mobile,
    client_id: r.client_id,
    walk_in_id: r.walk_in_id,
    lead_id: r.lead_id,
    tentative_date: r.tentative_date,
    tentative_time: r.tentative_time,
    status: r.status,
    outcome_notes: r.outcome_notes,
    created_at: r.created_at,
    cp_id: r.cp_id,
    sourcing_sm_id: r.sourcing_sm_id,
    closing_sm_id: r.closing_sm_id,
    cp_name: (r.channel_partners as unknown as { canonical_name: string } | null)?.canonical_name ?? null,
    sourcing_sm_name: (r.sourcing_sm as unknown as { full_name: string } | null)?.full_name ?? null,
    closing_sm_name: (r.closing_sm as unknown as { full_name: string } | null)?.full_name ?? null,
  }));
}

export async function createVisitSchedule(
  input: CreateVisitScheduleInput
): Promise<ActionResult<VisitSchedule>> {
  const parsed = CreateVisitScheduleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  return withAudit({
    action: 'create',
    entityType: 'visit_schedule',
    entityId: 'new',
    summary: `Scheduled visit for ${parsed.data.client_name} on ${parsed.data.tentative_date}`,
    mutation: async (actorId) => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('visit_schedules')
        .insert({
          project_id: parsed.data.project_id,
          client_name: parsed.data.client_name,
          client_mobile: parsed.data.client_mobile ?? null,
          client_id: parsed.data.client_id ?? null,
          walk_in_id: parsed.data.walk_in_id ?? null,
          lead_id: parsed.data.lead_id ?? null,
          cp_id: parsed.data.cp_id ?? null,
          closing_sm_id: parsed.data.closing_sm_id ?? null,
          tentative_date: parsed.data.tentative_date,
          tentative_time: parsed.data.tentative_time ?? null,
          outcome_notes: parsed.data.outcome_notes ?? null,
          sourcing_sm_id: actorId,
          created_by: actorId,
          status: 'tentative',
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as VisitSchedule;
    },
  });
}

export async function updateVisitScheduleStatus(
  input: UpdateVisitScheduleStatusInput
): Promise<ActionResult<VisitSchedule>> {
  const parsed = UpdateVisitScheduleStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const { visit_id, status, reason, outcome_notes } = parsed.data;

  return withAudit({
    action: 'status_change',
    entityType: 'visit_schedule',
    entityId: visit_id,
    summary: `Visit schedule status → ${status}`,
    mutation: async (actorId) => {
      const supabase = createServiceClient();

      const patch: Record<string, unknown> = { status };

      if (status === 'confirmed') {
        patch.confirmed_at = new Date().toISOString();
        patch.confirmed_by = actorId;
      }
      if (status === 'cancelled') {
        patch.cancelled_at = new Date().toISOString();
        patch.cancellation_reason = reason ?? null;
      }
      if (status === 'rescheduled') {
        patch.reschedule_reason = reason ?? null;
      }
      if (status === 'visited' || status === 'no_show') {
        patch.outcome_notes = outcome_notes ?? null;
      }

      const { data, error } = await supabase
        .from('visit_schedules')
        .update(patch)
        .eq('id', visit_id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as VisitSchedule;
    },
  });
}

export async function getUpcomingVisitCounts(projectId: string): Promise<{
  today: number;
  confirmed: number;
  tentative: number;
  thisWeek: number;
}> {
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const { data } = await supabase
    .from('visit_schedules')
    .select('tentative_date, status')
    .eq('project_id', projectId)
    .gte('tentative_date', today)
    .lte('tentative_date', weekEndStr)
    .not('status', 'in', '("cancelled","rescheduled","visited","no_show")');

  const rows = data ?? [];
  return {
    today: rows.filter(r => r.tentative_date === today).length,
    confirmed: rows.filter(r => r.status === 'confirmed').length,
    tentative: rows.filter(r => r.status === 'tentative').length,
    thisWeek: rows.length,
  };
}

export async function getProjectTeamMembers(
  projectId: string
): Promise<{ id: string; full_name: string }[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('project_sm_assignments')
    .select('team_members(id, full_name)')
    .eq('project_id', projectId)
    .eq('is_active', true);

  return (data ?? []).flatMap(
    d => (d.team_members ? [d.team_members as unknown as { id: string; full_name: string }] : [])
  );
}

export async function getCurrentUserSalesProfile(): Promise<{ id: string; full_name: string }> {
  const member = await getAuthenticatedMember();
  return { id: member.id, full_name: member.full_name };
}
