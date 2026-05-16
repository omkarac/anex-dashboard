'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import { ScenarioValuesSchema } from '@/lib/schemas/asset-scenario';
import type { ActionResult } from '@/lib/actions/_base';
import type { ScenarioValues } from '@/lib/schemas/asset-scenario';
import { revalidatePath } from 'next/cache';

function revalidate(assetId: string) {
  revalidatePath(`/capital-markets/assets/${assetId}`);
}

export async function createScenario(
  assetId: string,
  name: string,
): Promise<ActionResult<{ id: string }>> {
  const safeName = name.trim() || 'New Scenario';

  const result = await withAudit({
    action: 'create',
    entityType: 'asset_scenario',
    entityId: assetId,
    assetId,
    summary: `Added scenario "${safeName}"`,
    mutation: async (actorId) => {
      const service = createServiceClient();

      // Find the current max sort_order for this asset's scenarios
      const { data: existing } = await service
        .from('asset_scenarios')
        .select('sort_order, is_primary')
        .eq('asset_id', assetId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
      const isFirst = !existing || existing.length === 0;

      const { data, error } = await service
        .from('asset_scenarios')
        .insert({
          asset_id: assetId,
          name: safeName,
          sort_order: nextOrder,
          is_primary: isFirst,
          created_by: actorId,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);
      return data as { id: string };
    },
  });

  if (result.ok) revalidate(assetId);
  return result as ActionResult<{ id: string }>;
}

export async function updateScenarioValues(
  scenarioId: string,
  assetId: string,
  values: ScenarioValues,
): Promise<ActionResult<void>> {
  const parsed = ScenarioValuesSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };

  const result = await withAudit({
    action: 'update',
    entityType: 'asset_scenario',
    entityId: scenarioId,
    assetId,
    summary: 'Scenario numbers updated',
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('asset_scenarios')
        .update(parsed.data)
        .eq('id', scenarioId);

      if (error) throw new Error(error.message);

      // If this is the primary scenario, sync rollup fields to assets
      const { data: scenario } = await service
        .from('asset_scenarios')
        .select('is_primary')
        .eq('id', scenarioId)
        .single();

      if (scenario?.is_primary) {
        await service
          .from('assets')
          .update({
            topline_cr: parsed.data.topline_cr,
            initial_investment_cr: parsed.data.initial_investment_cr,
          })
          .eq('id', assetId);
      }
    },
  });

  if (result.ok) revalidate(assetId);
  return result;
}

export async function renameScenario(
  scenarioId: string,
  assetId: string,
  name: string,
): Promise<ActionResult<void>> {
  const safeName = name.trim();
  if (!safeName) return { ok: false, error: 'Scenario name cannot be empty' };

  const result = await withAudit({
    action: 'update',
    entityType: 'asset_scenario',
    entityId: scenarioId,
    assetId,
    summary: `Scenario renamed to "${safeName}"`,
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('asset_scenarios')
        .update({ name: safeName })
        .eq('id', scenarioId);

      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidate(assetId);
  return result;
}

export async function setPrimaryScenario(
  scenarioId: string,
  assetId: string,
): Promise<ActionResult<void>> {
  const result = await withAudit({
    action: 'update',
    entityType: 'asset_scenario',
    entityId: scenarioId,
    assetId,
    summary: 'Primary scenario changed',
    mutation: async () => {
      const service = createServiceClient();

      // Demote all existing primary scenarios for this asset
      await service
        .from('asset_scenarios')
        .update({ is_primary: false })
        .eq('asset_id', assetId)
        .eq('is_primary', true);

      // Promote the selected scenario
      const { data: scenario, error } = await service
        .from('asset_scenarios')
        .update({ is_primary: true })
        .eq('id', scenarioId)
        .select('topline_cr, initial_investment_cr')
        .single();

      if (error) throw new Error(error.message);

      // Sync rollup fields to assets so dashboard + filters stay accurate
      await service
        .from('assets')
        .update({
          topline_cr: scenario.topline_cr,
          initial_investment_cr: scenario.initial_investment_cr,
        })
        .eq('id', assetId);
    },
  });

  if (result.ok) revalidate(assetId);
  return result;
}

export async function deleteScenario(
  scenarioId: string,
  assetId: string,
): Promise<ActionResult<void>> {
  const result = await withAudit({
    action: 'delete',
    entityType: 'asset_scenario',
    entityId: scenarioId,
    assetId,
    summary: 'Scenario deleted',
    mutation: async (actorId) => {
      const service = createServiceClient();

      // Check if this is the primary — if so, promote the next oldest scenario
      const { data: target } = await service
        .from('asset_scenarios')
        .select('is_primary')
        .eq('id', scenarioId)
        .single();

      const { error } = await service
        .from('asset_scenarios')
        .update({ deleted_at: new Date().toISOString(), deleted_by: actorId })
        .eq('id', scenarioId);

      if (error) throw new Error(error.message);

      if (target?.is_primary) {
        // Promote the earliest remaining scenario to primary
        const { data: next } = await service
          .from('asset_scenarios')
          .select('id, topline_cr, initial_investment_cr')
          .eq('asset_id', assetId)
          .is('deleted_at', null)
          .order('sort_order', { ascending: true })
          .limit(1)
          .single();

        if (next) {
          await service
            .from('asset_scenarios')
            .update({ is_primary: true })
            .eq('id', next.id);

          await service
            .from('assets')
            .update({
              topline_cr: next.topline_cr,
              initial_investment_cr: next.initial_investment_cr,
            })
            .eq('id', assetId);
        } else {
          // No remaining scenarios — null out the rollup fields
          await service
            .from('assets')
            .update({ topline_cr: null, initial_investment_cr: null })
            .eq('id', assetId);
        }
      }
    },
  });

  if (result.ok) revalidate(assetId);
  return result;
}
