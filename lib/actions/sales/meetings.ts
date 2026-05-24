'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit, type ActionResult } from '@/lib/actions/_base';
import { authorizeSalesRole, canAccessProject } from '@/lib/rbac';
import {
  CreateMeetingInputSchema,
  CreateEodInputSchema,
  type CpMeeting,
  type CreateMeetingInput,
  type CreateEodInput,
} from '@/lib/schemas/sales';
import { istTodayISO } from '@/lib/utils/formatters';

async function computeMeetingCategory(
  cpId: string,
  smId: string,
  projectId: string,
  meetingDate: string,
  meetingType: 'obm' | 'ibm'
): Promise<'unique' | 'repeat'> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from('cp_meetings')
    .select('id', { count: 'exact', head: true })
    .eq('cp_id', cpId)
    .eq('sm_id', smId)
    .eq('project_id', projectId)
    .eq('meeting_type', meetingType)
    .gte('meeting_date', meetingDate.slice(0, 7) + '-01')
    .lt('meeting_date', (() => {
      const d = new Date(meetingDate);
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().slice(0, 7) + '-01';
    })());

  return (count ?? 0) === 0 ? 'unique' : 'repeat';
}

export async function createCpMeeting(
  input: CreateMeetingInput
): Promise<ActionResult<CpMeeting>> {
  const parsed = CreateMeetingInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const member = await authorizeSalesRole();
  if (!member) return { ok: false, error: 'Forbidden — sales access required' };
  if (!(await canAccessProject(member, parsed.data.project_id))) {
    return { ok: false, error: 'Forbidden — not assigned to this project' };
  }

  return withAudit({
    action: 'create',
    entityType: 'cp_meeting',
    entityId: 'new',
    summary: `Logged ${parsed.data.meeting_type.toUpperCase()} meeting with CP ${parsed.data.cp_id}`,
    mutation: async (actorId) => {
      const meeting_category = await computeMeetingCategory(
        parsed.data.cp_id,
        actorId,
        parsed.data.project_id,
        parsed.data.meeting_date,
        parsed.data.meeting_type
      );

      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('cp_meetings')
        .insert({
          ...parsed.data,
          meeting_category,
          sm_id: actorId,
          created_by: actorId,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as CpMeeting;
    },
  });
}

export async function createEodReport(
  input: CreateEodInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateEodInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const member = await authorizeSalesRole();
  if (!member) return { ok: false, error: 'Forbidden — sales access required' };
  if (!(await canAccessProject(member, parsed.data.project_id))) {
    return { ok: false, error: 'Forbidden — not assigned to this project' };
  }

  return withAudit({
    action: 'create',
    entityType: 'eod_report',
    entityId: 'new',
    summary: `EOD report for ${parsed.data.report_date}`,
    mutation: async (actorId) => {
      const supabase = createServiceClient();
      const date = parsed.data.report_date;
      const projectId = parsed.data.project_id;

      // Compute meeting counts from cp_meetings
      const { data: meetings } = await supabase
        .from('cp_meetings')
        .select('meeting_type, meeting_category')
        .eq('sm_id', actorId)
        .eq('project_id', projectId)
        .eq('meeting_date', date);

      const rows = meetings ?? [];
      const obm_count        = rows.filter(r => r.meeting_type === 'obm').length;
      const ibm_count        = rows.filter(r => r.meeting_type === 'ibm').length;
      const unique_obm_count = rows.filter(r => r.meeting_type === 'obm' && r.meeting_category === 'unique').length;
      const repeat_obm_count = rows.filter(r => r.meeting_type === 'obm' && r.meeting_category === 'repeat').length;
      const unique_ibm_count = rows.filter(r => r.meeting_type === 'ibm' && r.meeting_category === 'unique').length;
      const repeat_ibm_count = rows.filter(r => r.meeting_type === 'ibm' && r.meeting_category === 'repeat').length;

      const { data, error } = await supabase
        .from('eod_reports')
        .upsert(
          {
            project_id: projectId,
            sm_id: actorId,
            report_date: date,
            obm_count, ibm_count, unique_obm_count, repeat_obm_count, unique_ibm_count, repeat_ibm_count,
            calls_dialled: parsed.data.calls_dialled,
            calls_connected: parsed.data.calls_connected,
            notes: parsed.data.notes ?? null,
          },
          { onConflict: 'sm_id,project_id,report_date' }
        )
        .select('id')
        .single();

      if (error) throw new Error(error.message);
      return data as { id: string };
    },
  });
}

export async function getTodayMeetingCounts(projectId: string): Promise<{
  obm: number; ibm: number; unique_obm: number; repeat_obm: number; unique_ibm: number; repeat_ibm: number;
}> {
  const ZERO = { obm: 0, ibm: 0, unique_obm: 0, repeat_obm: 0, unique_ibm: 0, repeat_ibm: 0 };
  const member = await authorizeSalesRole();
  if (!member || !(await canAccessProject(member, projectId))) return ZERO;

  const supabase = createServiceClient();
  const today = istTodayISO();
  const { data } = await supabase
    .from('cp_meetings')
    .select('meeting_type, meeting_category')
    .eq('project_id', projectId)
    .eq('meeting_date', today);

  const rows = data ?? [];
  return {
    obm: rows.filter(r => r.meeting_type === 'obm').length,
    ibm: rows.filter(r => r.meeting_type === 'ibm').length,
    unique_obm: rows.filter(r => r.meeting_type === 'obm' && r.meeting_category === 'unique').length,
    repeat_obm: rows.filter(r => r.meeting_type === 'obm' && r.meeting_category === 'repeat').length,
    unique_ibm: rows.filter(r => r.meeting_type === 'ibm' && r.meeting_category === 'unique').length,
    repeat_ibm: rows.filter(r => r.meeting_type === 'ibm' && r.meeting_category === 'repeat').length,
  };
}
