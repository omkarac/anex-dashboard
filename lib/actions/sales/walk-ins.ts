'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { authorizeSalesRole, canAccessProject } from '@/lib/rbac';
import { withAudit, type ActionResult } from '@/lib/actions/_base';
import {
  WalkInIntakeInputSchema,
  UpdateWalkInStatusInputSchema,
  SiteVisitFeedbackInputSchema,
  type WalkIn,
  type WalkInIntakeInput,
  type UpdateWalkInStatusInput,
  type SiteVisitFeedbackInput,
} from '@/lib/schemas/sales';
import { istTodayISO } from '@/lib/utils/formatters';
import { upsertClient } from './clients';

export type WalkInIntakeResult = {
  scenario: number;
  clientId: string;
  walkInId: string;
  siteVisitId: string;
  visitNumber: number;
  isNewClient: boolean;
};

export async function processWalkInIntake(
  input: WalkInIntakeInput
): Promise<ActionResult<WalkInIntakeResult>> {
  const parsed = WalkInIntakeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const data = parsed.data;

  const member = await authorizeSalesRole();
  if (!member) return { ok: false, error: 'Forbidden — sales access required' };
  if (!(await canAccessProject(member, data.project_id))) {
    return { ok: false, error: 'Forbidden — not assigned to this project' };
  }

  // Step 1: upsert client
  const clientResult = await upsertClient({
    mobile_primary: data.mobile,
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email,
    age_bracket: data.age_bracket,
    occupation: data.occupation,
    employment_type: data.employment_type,
    ethnicity: data.ethnicity,
  });

  if (!clientResult.ok) return { ok: false, error: clientResult.error };
  const client = clientResult.data;
  const isNewClient = client.isNew;

  return withAudit({
    action: 'create',
    entityType: 'walk_in',
    entityId: 'new',
    summary: `Walk-in intake for client ${client.id} at project ${data.project_id}`,
    mutation: async (actorId) => {
      const supabase = createServiceClient();

      // Step 2: find existing active walk_in for this client+project
      const { data: existingWi } = await supabase
        .from('walk_ins')
        .select('id, is_active, status')
        .eq('client_id', client.id)
        .eq('project_id', data.project_id)
        .single();

      let walkInId: string;
      let scenario: number;

      if (!existingWi || !existingWi.is_active) {
        // Scenario 2 (new client, no walk_in) or Scenario 5 (inactive walk_in)
        scenario = existingWi ? 5 : (isNewClient ? 2 : 2);
        const { data: newWi, error: wiErr } = await supabase
          .from('walk_ins')
          .insert({
            project_id: data.project_id,
            client_id: client.id,
            source: data.source,
            sub_source: data.sub_source ?? null,
            cp_id: data.cp_id ?? null,
            referrer_name: data.referrer_name ?? null,
            closing_sm_id: data.assigned_sm_id ?? actorId,
            configuration: data.configuration ?? null,
            budget: data.budget ?? null,
            purpose: data.purpose ?? null,
            possession_timeframe: data.possession_timeframe ?? null,
            status: 'cold',
            created_by: actorId,
          })
          .select('id')
          .single();
        if (wiErr) throw new Error(wiErr.message);
        walkInId = newWi.id;
      } else {
        walkInId = existingWi.id;

        // Count existing site_visits
        const { count } = await supabase
          .from('site_visits')
          .select('id', { count: 'exact', head: true })
          .eq('walk_in_id', walkInId);

        scenario = (count ?? 0) === 0 ? 3 : 4;
      }

      // Count site_visits to determine visit_number
      const { count: svCount } = await supabase
        .from('site_visits')
        .select('id', { count: 'exact', head: true })
        .eq('walk_in_id', walkInId);

      const visitNumber = (svCount ?? 0) + 1;

      const { data: sv, error: svErr } = await supabase
        .from('site_visits')
        .insert({
          walk_in_id: walkInId,
          client_id: client.id,
          project_id: data.project_id,
          visit_number: visitNumber,
          visit_type: data.visit_type,
          accompanied_by: data.accompanied_by ?? null,
          assigned_sm_id: data.assigned_sm_id ?? actorId,
          gre_remarks: data.gre_remarks ?? null,
          created_by: actorId,
        })
        .select('id')
        .single();
      if (svErr) throw new Error(svErr.message);

      return {
        scenario,
        clientId: client.id,
        walkInId,
        siteVisitId: sv.id,
        visitNumber,
        isNewClient,
      };
    },
  });
}

export async function updateWalkInStatus(
  input: UpdateWalkInStatusInput
): Promise<ActionResult<WalkIn>> {
  const parsed = UpdateWalkInStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const member = await authorizeSalesRole();
  if (!member) return { ok: false, error: 'Forbidden — sales access required' };
  {
    const service = createServiceClient();
    const { data: wi } = await service
      .from('walk_ins')
      .select('project_id')
      .eq('id', parsed.data.walk_in_id)
      .single();
    if (!wi) return { ok: false, error: 'Walk-in not found' };
    if (!(await canAccessProject(member, wi.project_id))) {
      return { ok: false, error: 'Forbidden — not assigned to this project' };
    }
  }

  return withAudit({
    action: 'status_change',
    entityType: 'walk_in',
    entityId: parsed.data.walk_in_id,
    summary: `Status changed to ${parsed.data.status}`,
    mutation: async (actorId) => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('walk_ins')
        .update({
          status: parsed.data.status,
          latest_remark: parsed.data.remark,
          latest_remark_date: istTodayISO(),
          lost_reason: parsed.data.lost_reason ?? null,
          updated_by: actorId,
        })
        .eq('id', parsed.data.walk_in_id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as WalkIn;
    },
  });
}

export async function addSiteVisitFeedback(
  input: SiteVisitFeedbackInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = SiteVisitFeedbackInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const { visit_id, ...rest } = parsed.data;

  const member = await authorizeSalesRole();
  if (!member) return { ok: false, error: 'Forbidden — sales access required' };
  {
    const service = createServiceClient();
    const { data: sv } = await service
      .from('site_visits')
      .select('project_id')
      .eq('id', visit_id)
      .single();
    if (!sv) return { ok: false, error: 'Site visit not found' };
    if (!(await canAccessProject(member, sv.project_id))) {
      return { ok: false, error: 'Forbidden — not assigned to this project' };
    }
  }

  return withAudit({
    action: 'update',
    entityType: 'site_visit',
    entityId: visit_id,
    summary: `Updated site visit feedback`,
    mutation: async (_actorId) => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('site_visits')
        .update(rest)
        .eq('id', visit_id)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return data as { id: string };
    },
  });
}
