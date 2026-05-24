'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { authorizeSalesRole, canAccessProject } from '@/lib/rbac';

export type DashboardKpis = {
  totalWalkins: number;
  cpWalkins: number;
  directWalkins: number;
  booked: number;
  warm: number;
  cold: number;
  lost: number;
  convPct: number;
  totalMeetings: number;
  uniqueObms: number;
  totalIbms: number;
};

export type CpPerformanceRow = {
  cp_id: string;
  canonical_name: string;
  category: string;
  stage: string;
  project_id: string | null;
  total_walkins: number;
  booked: number;
  warm: number;
  cold: number;
  lost: number;
  bhk_1: number;
  bhk_2: number;
  bhk_3: number;
  bhk_2_jodi: number;
  revisit_count: number;
  dar_meetings: number;
  obm_count: number;
  unique_obms: number;
  ibm_count: number;
  conversion_pct: number | null;
  computed_priority: string | null;
};

export type SmPerformanceRow = {
  sm_id: string;
  full_name: string;
  project_id: string | null;
  total_walkins: number;
  booked: number;
  warm: number;
  cold: number;
  lost: number;
  cp_walkins: number;
  direct_walkins: number;
  conversion_pct: number | null;
  total_meetings: number;
  total_obms: number;
  unique_obms: number;
  repeat_obms: number;
  total_ibms: number;
  unique_ibms: number;
};

export type MonthlyTrendRow = {
  project_id: string;
  month_start: string;
  month_label: string;
  month_sort: number;
  total_walkins: number;
  cp_walkins: number;
  direct_walkins: number;
  bookings: number;
};

export type LostAnalysisRow = {
  project_id: string;
  lost_reason: string | null;
  total_lost: number;
  cp_lost: number;
  direct_lost: number;
  bhk_1: number;
  bhk_2: number;
  bhk_3: number;
  bhk_2_jodi: number;
  pct_of_lost: number | null;
};

export type ConfigBreakdownRow = {
  project_id: string;
  configuration: string | null;
  total: number;
  cp_count: number;
  direct_count: number;
  booked: number;
  conversion_pct: number | null;
  pct_of_total: number | null;
};

export type PriorityLeadRow = {
  walk_in_id: string;
  project_id: string;
  first_name: string | null;
  last_name: string | null;
  mobile_primary: string;
  source: string;
  configuration: string | null;
  budget: string | null;
  cp_name: string | null;
  closing_sm: string | null;
  status: string;
  latest_remark: string | null;
  latest_remark_date: string | null;
  last_visit_date: string | null;
  visit_number: number | null;
  last_sm_comment: string | null;
  proposed_revisit_date: string | null;
  priority_score: number;
};

// Project-scope gate for all analytics reads — prevents cross-project data
// leakage (a member could otherwise read any project's analytics by id).
async function assertProjectAccess(projectId: string): Promise<boolean> {
  const member = await authorizeSalesRole();
  return !!member && (await canAccessProject(member, projectId));
}

const EMPTY_KPIS: DashboardKpis = {
  totalWalkins: 0, cpWalkins: 0, directWalkins: 0, booked: 0, warm: 0, cold: 0,
  lost: 0, convPct: 0, totalMeetings: 0, uniqueObms: 0, totalIbms: 0,
};

export async function getDashboardKpis(projectId: string): Promise<DashboardKpis> {
  if (!(await assertProjectAccess(projectId))) return EMPTY_KPIS;

  const supabase = createServiceClient();

  const [{ data: walkins }, { data: meetings }] = await Promise.all([
    supabase
      .from('walk_ins')
      .select('id, status, source')
      .eq('project_id', projectId)
      .eq('is_active', true),
    supabase
      .from('cp_meetings')
      .select('id, meeting_type, meeting_category')
      .eq('project_id', projectId),
  ]);

  const rows = walkins ?? [];
  const mtgs = meetings ?? [];

  const totalWalkins  = rows.length;
  const cpWalkins     = rows.filter(r => r.source === 'cp').length;
  const directWalkins = rows.filter(r => r.source === 'direct').length;
  const booked        = rows.filter(r => r.status === 'booked').length;
  const warm          = rows.filter(r => r.status === 'warm').length;
  const cold          = rows.filter(r => r.status === 'cold').length;
  const lost          = rows.filter(r => r.status === 'lost').length;
  const convPct       = totalWalkins > 0 ? Math.round((booked / totalWalkins) * 1000) / 10 : 0;
  const totalMeetings = mtgs.length;
  const uniqueObms    = mtgs.filter(m => m.meeting_type === 'obm' && m.meeting_category === 'unique').length;
  const totalIbms     = mtgs.filter(m => m.meeting_type === 'ibm').length;

  return { totalWalkins, cpWalkins, directWalkins, booked, warm, cold, lost, convPct, totalMeetings, uniqueObms, totalIbms };
}

export async function getCpPerformance(projectId: string): Promise<CpPerformanceRow[]> {
  if (!(await assertProjectAccess(projectId))) return [];
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('v_cp_performance')
    .select('*')
    .eq('project_id', projectId)
    .order('total_walkins', { ascending: false });
  return (data ?? []) as CpPerformanceRow[];
}

export async function getSmPerformance(projectId: string): Promise<SmPerformanceRow[]> {
  if (!(await assertProjectAccess(projectId))) return [];
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('v_sm_performance')
    .select('*')
    .eq('project_id', projectId);
  return (data ?? []) as SmPerformanceRow[];
}

export async function getMonthlyTrend(projectId: string): Promise<MonthlyTrendRow[]> {
  if (!(await assertProjectAccess(projectId))) return [];
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('v_monthly_trend')
    .select('*')
    .eq('project_id', projectId)
    .order('month_sort');
  return (data ?? []) as MonthlyTrendRow[];
}

export async function getLostAnalysis(projectId: string): Promise<LostAnalysisRow[]> {
  if (!(await assertProjectAccess(projectId))) return [];
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('v_lost_analysis')
    .select('*')
    .eq('project_id', projectId);
  return (data ?? []) as LostAnalysisRow[];
}

export async function getConfigBreakdown(projectId: string): Promise<ConfigBreakdownRow[]> {
  if (!(await assertProjectAccess(projectId))) return [];
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('v_config_breakdown')
    .select('*')
    .eq('project_id', projectId);
  return (data ?? []) as ConfigBreakdownRow[];
}

export async function getPriorityLeads(projectId: string): Promise<PriorityLeadRow[]> {
  if (!(await assertProjectAccess(projectId))) return [];
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('v_priority_leads')
    .select('*')
    .eq('project_id', projectId);
  return (data ?? []) as PriorityLeadRow[];
}
