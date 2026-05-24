'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit, type ActionResult } from '@/lib/actions/_base';
import { authorizeSalesRole, isSalesAdmin } from '@/lib/rbac';
import { sanitizePostgrestTerm } from '@/lib/utils/search';
import {
  RegisterCpInputSchema,
  UpdateCpInputSchema,
  type ChannelPartner,
  type RegisterCpInput,
  type UpdateCpInput,
} from '@/lib/schemas/sales';

export type DedupResult = {
  found: boolean;
  matches: Pick<ChannelPartner, 'id' | 'canonical_name' | 'category' | 'stage' | 'mobile_primary'>[];
};

export async function checkCpDuplication(input: {
  name: string;
  mobile?: string;
  rera?: string;
}): Promise<DedupResult> {
  const supabase = createServiceClient();
  const term = sanitizePostgrestTerm(input.name);
  if (term.length < 2) return { found: false, matches: [] };

  const { data } = await supabase
    .from('channel_partners')
    .select('id, canonical_name, category, stage, mobile_primary, aliases')
    .or(`canonical_name.ilike.%${term}%,aliases.cs.{${term}}`)
    .limit(10);

  // Also check trigram similarity via rpc if direct query returns nothing
  if (!data || data.length === 0) {
    const { data: fuzzy } = await supabase.rpc('search_cp_fuzzy', { search_term: term, threshold: 0.75 });
    const matches = fuzzy ?? [];
    return { found: matches.length > 0, matches };
  }

  return { found: data.length > 0, matches: data as DedupResult['matches'] };
}

export async function searchChannelPartners(
  query: string,
  _projectId?: string
): Promise<ChannelPartner[]> {
  const member = await authorizeSalesRole();
  if (!member) return [];

  const term = sanitizePostgrestTerm(query);
  if (term.length < 2) return [];

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('channel_partners')
    .select('*')
    .or(`canonical_name.ilike.%${term}%,aliases.cs.{${term}}`)
    .eq('is_active', true)
    .order('canonical_name')
    .limit(20);

  return (data ?? []) as ChannelPartner[];
}

export async function registerChannelPartner(
  input: RegisterCpInput
): Promise<ActionResult<ChannelPartner>> {
  const member = await authorizeSalesRole();
  if (!member) return { ok: false, error: 'Forbidden — sales access required' };

  const parsed = RegisterCpInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const dedup = await checkCpDuplication({ name: parsed.data.canonical_name });
  if (dedup.found) {
    return { ok: false, error: `Similar CP already exists: ${dedup.matches[0]?.canonical_name}` };
  }

  return withAudit({
    action: 'create',
    entityType: 'channel_partner',
    entityId: 'new',
    summary: `Registered CP: ${parsed.data.canonical_name}`,
    mutation: async (actorId) => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('channel_partners')
        .insert({ ...parsed.data, created_by: actorId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as ChannelPartner;
    },
  });
}

export async function updateChannelPartner(
  id: string,
  input: UpdateCpInput
): Promise<ActionResult<ChannelPartner>> {
  const member = await authorizeSalesRole();
  if (!member) return { ok: false, error: 'Forbidden — sales access required' };

  const parsed = UpdateCpInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  return withAudit({
    action: 'update',
    entityType: 'channel_partner',
    entityId: id,
    summary: `Updated CP ${id}`,
    mutation: async (actorId) => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('channel_partners')
        .update({ ...parsed.data, updated_by: actorId, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as ChannelPartner;
    },
  });
}

export async function approveCp(id: string): Promise<ActionResult<ChannelPartner>> {
  const member = await authorizeSalesRole();
  if (!member || !isSalesAdmin(member)) {
    return { ok: false, error: 'Forbidden — sales admin access required' };
  }
  return withAudit({
    action: 'update',
    entityType: 'channel_partner',
    entityId: id,
    summary: `Approved CP ${id}`,
    mutation: async (actorId) => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('channel_partners')
        .update({ is_approved: true, updated_by: actorId, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as ChannelPartner;
    },
  });
}
