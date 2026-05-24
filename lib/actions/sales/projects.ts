'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { authorizeSalesRole, isSalesHead } from '@/lib/rbac';
import { withAudit, type ActionResult } from '@/lib/actions/_base';
import { CreateProjectInputSchema, type SalesProject } from '@/lib/schemas/sales';

export async function getUserProjects(): Promise<SalesProject[]> {
  const member = await getAuthenticatedMember();
  const service = createServiceClient();

  const isSalesAdmin = ['admin', 'sales_admin', 'sales_head'].includes(member.role);

  if (isSalesAdmin) {
    const { data } = await service
      .from('sales_projects')
      .select('*')
      .eq('is_active', true)
      .order('name');
    return (data ?? []) as SalesProject[];
  }

  // Sales managers see only their assigned projects
  const { data } = await service
    .from('project_sm_assignments')
    .select('sales_projects(*)')
    .eq('sm_id', member.id)
    .eq('is_active', true);

  return (data?.flatMap(d => (d.sales_projects ? [d.sales_projects] : [])) ?? []) as unknown as SalesProject[];
}

export async function createSalesProject(
  input: unknown
): Promise<ActionResult<SalesProject>> {
  const member = await authorizeSalesRole();
  if (!member || !isSalesHead(member)) {
    return { ok: false, error: 'Forbidden — sales admin access required' };
  }

  const parsed = CreateProjectInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  return withAudit({
    action: 'create',
    entityType: 'sales_project',
    entityId: 'new',
    summary: `Created project: ${parsed.data.name}`,
    mutation: async (actorId) => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('sales_projects')
        .insert({ ...parsed.data, created_by: actorId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as SalesProject;
    },
  });
}

export async function assignSmToProject(
  projectId: string,
  smId: string,
  role: string = 'both'
): Promise<ActionResult<{ id: string }>> {
  const member = await authorizeSalesRole();
  if (!member || !isSalesHead(member)) {
    return { ok: false, error: 'Forbidden — sales admin access required' };
  }
  return withAudit({
    action: 'update',
    entityType: 'project_sm_assignment',
    entityId: `${projectId}:${smId}`,
    summary: `Assigned SM ${smId} to project ${projectId}`,
    mutation: async (actorId) => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('project_sm_assignments')
        .upsert(
          { project_id: projectId, sm_id: smId, sm_role: role, assigned_by: actorId, is_active: true },
          { onConflict: 'project_id,sm_id' }
        )
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return data as { id: string };
    },
  });
}
