'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit, type ActionResult } from '@/lib/actions/_base';
import { UpsertClientInputSchema, type Client, type UpsertClientInput } from '@/lib/schemas/sales';

function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 10) return digits;
  throw new Error(`Invalid mobile number: ${raw}`);
}

export async function upsertClient(
  input: UpsertClientInput
): Promise<ActionResult<Client & { isNew: boolean }>> {
  const parsed = UpsertClientInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation error' };
  }

  const mobile = parsed.data.mobile_primary;

  return withAudit({
    action: 'create',
    entityType: 'client',
    entityId: mobile,
    summary: `Upserted client with mobile ${mobile}`,
    mutation: async (_actorId) => {
      const supabase = createServiceClient();

      const { data: existing } = await supabase
        .from('clients')
        .select('*')
        .eq('mobile_primary', mobile)
        .single();

      if (existing) {
        // Update non-null fields
        const updates: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(parsed.data)) {
          if (k !== 'mobile_primary' && v !== undefined && v !== null) updates[k] = v;
        }
        if (Object.keys(updates).length > 0) {
          const { data: updated, error } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw new Error(error.message);
          return { ...(updated as Client), isNew: false };
        }
        return { ...(existing as Client), isNew: false };
      }

      const { data: created, error } = await supabase
        .from('clients')
        .insert(parsed.data)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { ...(created as Client), isNew: true };
    },
  });
}

export async function lookupClientByMobile(mobile: string): Promise<Client | null> {
  const supabase = createServiceClient();
  let normalized: string;
  try {
    normalized = normalizeMobile(mobile);
  } catch {
    return null;
  }

  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('mobile_primary', normalized)
    .single();

  return data as Client | null;
}
