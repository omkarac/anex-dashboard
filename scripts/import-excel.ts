/**
 * Excel importer — run with:
 *   npx tsx scripts/import-excel.ts --user-id <your-supabase-user-uuid>
 *   npx tsx scripts/import-excel.ts --user-id <uuid> --dry-run
 *
 * Sources:
 *   supabase/List of Properties - Combined.xlsx
 *     - "Data Dump"             → assets
 *     - "PMC-PMA "              → assets (won) + engagements
 *     - "Proposal Tracker"      → developer_shares
 *     - "List of Active Developers " → developers
 */

import * as path from 'path';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const userIdArg = args[args.indexOf('--user-id') + 1];

if (!userIdArg) {
  console.error('Usage: npx tsx scripts/import-excel.ts --user-id <uuid> [--dry-run]');
  process.exit(1);
}

const ACTOR_ID = userIdArg;
const XLSX_PATH = path.resolve(process.cwd(), 'supabase/List of Properties - Combined.xlsx');

// ─── Supabase ─────────────────────────────────────────────────────────────────

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Enum mappings ────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  'active': 'evaluating',
  'closed': 'dropped',
  'cold': 'open',
  'dropped': 'dropped',
  'dropped by us in the past': 'dropped',
  'droppped': 'dropped',
  'evaluated': 'screened',
  'ff': 'open',
  'feasibility done': 'screened',
  'feasibility done on hold': 'open',
  'feasibility in process': 'evaluating',
  'initial assessment': 'evaluating',
  'not active': 'dropped',
  'pending': 'open',
  'project status to be understood': 'open',
  'revive': 'open',
  'slow cooking': 'open',
  'slow cooking ': 'open',
  'to be evaluated': 'open',
  'to be figured': 'open',
  'to be revived': 'open',
  'to be understood if feasibility done previously': 'open',
  'wip': 'evaluating',
  'won': 'won',
};

const TEMPERATURE_MAP: Record<string, string> = {
  'cold': 'cold',
  // others default to 'none'
};

const TYPE_MAP: Record<string, string> = {
  '-': '',
  'dm': '',
  'dropped': '',
  'factory': 'other',
  'funding': 'funding',
  'jv': 'jv_jd',
  'jv / outright': 'jv_jd',
  'jv/jd': 'jv_jd',
  'jv/jd or funding': 'jv_jd',
  'll wants options from anex, outright': 'outright',
  'land': 'open_land',
  'land outright': 'open_land',
  'mhada redevelopment': 'mhada_redevelopment',
  'open land': 'open_land',
  'outright': 'outright',
  'outright / jv': 'outright',
  'outright land + structure': 'outright',
  'outright sell': 'outright',
  'outright society': 'outright',
  'outright land': 'open_land',
  'outright/jv': 'outright',
  'outright/redevelopment': 'outright',
  'property outright': 'outright',
  'redevelopement': 'redevelopment',
  'redevelopment': 'redevelopment',
  'redevelopment & sra': 'sra',
  'redevelopment + sra': 'sra',
  'redevelopment/ outright': 'redevelopment',
  'sra': 'sra',
  'outright/': 'outright',
};

const CANONICAL_REGS = new Set([
  '33(5)', '33(7)', '33(7b)', '33(9)', '33(10)', '33(11)',
  '33(12b)', '33(19)', '33(20b)', '30(a)', '17(1)',
  'ar', 'udcpr', 'udcpr_plotted', 'to_be_evaluated', 'other',
]);

const REG_NORMALIZE: Record<string, string> = {
  '33(5)': '33(5)', '33(7)': '33(7)', '33(7b)': '33(7B)', '33(9)': '33(9)',
  '33(10)': '33(10)', '33(11)': '33(11)', '33(12b)': '33(12B)', '33(19)': '33(19)',
  '33(20b)': '33(20B)', '30(a)': '30(A)', '17(1)': '17(1)', '17': '17(1)',
  '17(a)': '17(1)', '20(b)': '33(20B)',
  'ar': 'AR', 'udcpr': 'UDCPR', 'udcpr_plotted': 'UDCPR_plotted',
  'to_be_evaluated': 'to_be_evaluated', 'other': 'other',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clean(v: unknown): string {
  return String(v ?? '').trim().replace(/\s+/g, ' ');
}

function parseNum(v: unknown): number | null {
  const s = clean(v).replace(/,/g, '');
  if (!s || s === '0' || s === '-') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function mapStatus(raw: string): string {
  const key = raw.toLowerCase().trim();
  return STATUS_MAP[key] ?? 'open';
}

function mapType(raw: string): string | null {
  const key = raw.toLowerCase().trim();
  const val = TYPE_MAP[key];
  if (val === undefined) return raw ? 'other' : null;
  return val || null;
}

function parseRegulations(raw: string): string[] {
  if (!raw || raw.trim() === '-') return [];
  // Split on + and commas
  const parts = raw.split(/[+,]/).map(s => {
    const n = s.replace(/\s/g, '').toLowerCase();
    return REG_NORMALIZE[n] ?? null;
  });
  const valid = [...new Set(parts.filter(Boolean))] as string[];
  const notes = raw.trim();
  // If nothing mapped but there's content, log it
  if (valid.length === 0 && notes && notes !== '-') return ['other'];
  return valid;
}

function makeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function log(tag: string, msg: string) {
  console.log(`  [${tag}] ${msg}`);
}

// ─── Phase 0: Ensure actor exists in team_members ─────────────────────────────

async function ensureActor() {
  const { data } = await service.from('team_members').select('id').eq('id', ACTOR_ID).single();
  if (!data) {
    console.error(`team_members row not found for user ${ACTOR_ID}. Log in to the app first to create it.`);
    process.exit(1);
  }
  console.log(`Actor confirmed: ${ACTOR_ID}`);
}

// ─── Phase 1: Developers ─────────────────────────────────────────────────────

async function importDevelopers(wb: XLSX.WorkBook): Promise<Map<string, string>> {
  console.log('\n=== Phase 1: Developers ===');
  const ws = wb.Sheets['List of Active Developers '];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false });

  const names: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const name = clean(rows[i][1]);
    if (name && name !== 'List of Developers') names.push(name);
  }

  console.log(`  Found ${names.length} developers`);

  const nameToId = new Map<string, string>();

  if (isDryRun) {
    names.forEach((n, i) => log('DRY', `Would insert developer: ${n}`));
    // Assign fake IDs for downstream use
    names.forEach(n => nameToId.set(n.toLowerCase(), crypto.randomUUID()));
    return nameToId;
  }

  for (const name of names) {
    // Check if exists
    const { data: existing } = await service
      .from('developers')
      .select('id')
      .ilike('name', name)
      .limit(1)
      .single();

    if (existing) {
      log('SKIP', `Developer already exists: ${name}`);
      nameToId.set(name.toLowerCase(), existing.id);
    } else {
      const { data, error } = await service
        .from('developers')
        .insert({ name, is_active: true, created_by: ACTOR_ID })
        .select('id')
        .single();
      if (error) {
        log('ERR', `Developer insert failed: ${name} — ${error.message}`);
      } else {
        log('OK', `Inserted developer: ${name} (${data.id})`);
        nameToId.set(name.toLowerCase(), data.id);
      }
    }
  }

  return nameToId;
}

// ─── Phase 2: Assets from Data Dump ──────────────────────────────────────────

async function importDataDump(wb: XLSX.WorkBook): Promise<Map<string, string>> {
  console.log('\n=== Phase 2: Assets from Data Dump ===');
  const ws = wb.Sheets['Data Dump'];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false });
  // Header row is index 3
  const HEADER_ROW = 3;
  const DATA_START = 4;

  const nameToId = new Map<string, string>();
  let inserted = 0, skipped = 0, errored = 0;

  const dataRows: unknown[][] = [];
  for (let i = DATA_START; i < rows.length; i++) {
    const r = rows[i] as string[];
    const name = clean(r[1]);
    if (!name || name === '0') continue;
    dataRows.push(r);
  }

  console.log(`  Found ${dataRows.length} asset rows`);

  for (const row of dataRows) {
    const r = row as string[];
    const rawName = clean(r[1]);
    const rawLoc = clean(r[2]);
    const rawStatus = clean(r[6]);
    const rawType = clean(r[8]);

    const status = mapStatus(rawStatus);
    const temperature = TEMPERATURE_MAP[rawStatus.toLowerCase().trim()] ?? 'none';
    const asset_type = mapType(rawType);
    const regulations = parseRegulations(clean(r[12]));
    const regulation_notes = '';

    const payload = {
      property_name: rawName,
      location: rawLoc || null,
      status,
      temperature,
      asset_type: asset_type || null,
      spoc_agent: clean(r[7]) || null,
      resource: clean(r[4]) || null,
      handover_notes: clean(r[3]) || null,
      plot_size_sqm: parseNum(r[10]),
      fsi_potential: parseNum(r[11]),
      regulations,
      regulation_notes: null,
      development_potential_sqm: parseNum(r[13]),
      rehab_area_sqm: parseNum(r[14]),
      sale_area_sqm: parseNum(r[15]),
      sale_rate_psf: parseNum(r[16]),
      initial_investment_cr: parseNum(r[17]),
      profit_cr: parseNum(r[18]),
      topline_cr: parseNum(r[19]),
      next_step: clean(r[20]) || null,
      created_by: ACTOR_ID,
      updated_by: ACTOR_ID,
    };

    if (isDryRun) {
      log('DRY', `${rawName} | ${rawStatus} → ${status} | ${rawType} → ${asset_type}`);
      nameToId.set(makeSlug(rawName), crypto.randomUUID());
      inserted++;
      continue;
    }

    // Dedup by name (case-insensitive)
    const { data: existing } = await service
      .from('assets')
      .select('id')
      .ilike('property_name', rawName)
      .is('deleted_at', null)
      .limit(1)
      .single();

    if (existing) {
      skipped++;
      nameToId.set(makeSlug(rawName), existing.id);
      continue;
    }

    const { data, error } = await service
      .from('assets')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      log('ERR', `${rawName}: ${error.message}`);
      errored++;
    } else {
      nameToId.set(makeSlug(rawName), data.id);
      inserted++;
    }

    // Insert the "Latest update" as an update entry if present
    const latestUpdate = clean(r[21]);
    if (data && latestUpdate && latestUpdate !== '0') {
      await service.from('updates').insert({
        asset_id: data.id,
        body: latestUpdate,
        created_by: ACTOR_ID,
      });
    }
  }

  console.log(`  Done: ${inserted} inserted, ${skipped} skipped, ${errored} errors`);
  return nameToId;
}

// ─── Phase 3: PMC-PMA engagements ────────────────────────────────────────────

async function importPmcPma(wb: XLSX.WorkBook, assetNameMap: Map<string, string>) {
  console.log('\n=== Phase 3: PMC-PMA Engagements ===');
  const ws = wb.Sheets['PMC-PMA '];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false });

  // Row 0 is header, data starts at row 1
  let inserted = 0, linked = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawName = clean(r[1]);
    const loc = clean(r[2]);
    const plotSize = parseNum(r[4]);
    const rawReg = clean(r[5]);
    const rawKind = clean(r[6]);

    if (!rawName) continue;

    const kind = rawKind.toLowerCase().includes('pma') ? 'pmc_pmas' : 'mandate';
    // In our schema, pmc = pmc_pmas; both PMC and PMA map to 'pmc_pmas'
    const engKind = 'pmc_pmas';

    const regulations = parseRegulations(rawReg);

    if (isDryRun) {
      log('DRY', `${rawName} → engagement: ${engKind} (${rawKind})`);
      inserted++;
      continue;
    }

    // Find or create the asset
    const slug = makeSlug(rawName);
    let assetId = assetNameMap.get(slug);

    if (!assetId) {
      // Try partial match
      for (const [key, val] of assetNameMap) {
        if (key.includes(rawName.toLowerCase().replace(/\s+/g, ' ').trim()) ||
            rawName.toLowerCase().includes(key.split(' ')[0])) {
          assetId = val;
          break;
        }
      }
    }

    if (!assetId) {
      // Create new asset for this PMC/PMA entry
      const { data, error } = await service
        .from('assets')
        .insert({
          property_name: rawName,
          location: loc || null,
          status: 'won',
          temperature: 'none',
          plot_size_sqm: plotSize,
          regulations,
          created_by: ACTOR_ID,
          updated_by: ACTOR_ID,
        })
        .select('id')
        .single();

      if (error || !data) {
        log('ERR', `Could not create asset for ${rawName}: ${error?.message}`);
        continue;
      }
      assetId = data.id as string;
      assetNameMap.set(slug, assetId);
      log('NEW', `Created asset for PMC: ${rawName}`);
    }

    // Check if engagement already exists
    const { data: existingEng } = await service
      .from('engagements')
      .select('id')
      .eq('asset_id', assetId)
      .limit(1)
      .single();

    if (existingEng) {
      log('SKIP', `Engagement already exists for ${rawName}`);
      continue;
    }

    const { data: eng, error: engErr } = await service
      .from('engagements')
      .insert({
        asset_id: assetId,
        kind: engKind,
        started_at: new Date().toISOString().slice(0, 10),
        notes: rawKind || null,
        created_by: ACTOR_ID,
      })
      .select('id')
      .single();

    if (engErr || !eng) {
      log('ERR', `Engagement insert failed for ${rawName}: ${engErr?.message}`);
      continue;
    }

    // Link engagement to asset + set status = won
    await service
      .from('assets')
      .update({ converted_to_engagement_id: eng.id, status: 'won', updated_by: ACTOR_ID })
      .eq('id', assetId);

    log('OK', `${rawName} → engagement ${engKind}`);
    inserted++;
  }

  console.log(`  Done: ${inserted} engagements created`);
}

// ─── Phase 4: Developer shares from Proposal Tracker ─────────────────────────

const OUTCOME_MAP: Record<string, string | null> = {
  'x': 'passed',
  'X': 'passed',
  'Declined ': 'passed',
  'o': null,   // Sent — pending
  'Sent ': null,
  '☑': 'interested',
  'EOI Rec.': 'interested',
  'i': 'interested',
  'interested': 'interested',
  'S': null,   // To be sent — skip
  'To be Sent': null,
};

async function importProposalTracker(
  wb: XLSX.WorkBook,
  assetNameMap: Map<string, string>,
  developerNameMap: Map<string, string>
) {
  console.log('\n=== Phase 4: Developer Shares from Proposal Tracker ===');
  const ws = wb.Sheets['Proposal Tracker'];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false });

  // Row 3 has developer names starting at col 5
  const headerRow = rows[3];
  const DEV_START_COL = 5;

  const devCols: Array<{ col: number; name: string; devId: string | null }> = [];
  for (let col = DEV_START_COL; col < headerRow.length; col++) {
    const devName = clean(headerRow[col]);
    if (!devName) continue;
    const devId = developerNameMap.get(devName.toLowerCase()) ?? null;
    devCols.push({ col, name: devName, devId });
  }

  let inserted = 0, skipped = 0;

  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    const rawName = clean(r[2]);
    if (!rawName) continue;

    const slug = makeSlug(rawName);
    let assetId = assetNameMap.get(slug);

    if (!assetId) {
      // Fuzzy match — find closest key
      for (const [key, val] of assetNameMap) {
        const rawSlug = rawName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
        if (key.startsWith(rawSlug.substring(0, 6)) || rawSlug.startsWith(key.substring(0, 6))) {
          assetId = val;
          break;
        }
      }
    }

    if (!assetId) {
      log('MISS', `Asset not found in registry: ${rawName}`);
      continue;
    }

    for (const { col, name: devName, devId } of devCols) {
      const symbol = clean(r[col]);
      if (!symbol || symbol === 'S' || symbol.toLowerCase() === 'to be sent') continue;

      const outcome = OUTCOME_MAP[symbol] ?? null;
      // Only import if actually shared (o, ☑, i, x) — skip S (to be sent)
      if (symbol.toLowerCase() === 's') continue;

      if (isDryRun) {
        log('DRY', `Share: ${rawName} → ${devName} (${symbol} → outcome: ${outcome ?? 'pending'})`);
        inserted++;
        continue;
      }

      if (!devId) {
        log('WARN', `Developer not found: ${devName}`);
        continue;
      }

      // Check if share already exists
      const { data: existing } = await service
        .from('developer_shares')
        .select('id')
        .eq('asset_id', assetId)
        .eq('developer_id', devId)
        .limit(1)
        .single();

      if (existing) { skipped++; continue; }

      const { error } = await service.from('developer_shares').insert({
        asset_id: assetId,
        developer_id: devId,
        shared_by: ACTOR_ID,
        outcome: outcome ?? null,
        notes: `Imported from Proposal Tracker`,
      });

      if (error) {
        log('ERR', `Share ${rawName} → ${devName}: ${error.message}`);
      } else {
        inserted++;
      }
    }
  }

  console.log(`  Done: ${inserted} shares inserted, ${skipped} skipped`);
}

// ─── Activity log ─────────────────────────────────────────────────────────────

async function writeImportLog(assetCount: number) {
  if (isDryRun) return;
  await service.from('activity_logs').insert({
    actor_id: ACTOR_ID,
    action: 'create',
    entity_type: 'import',
    entity_id: ACTOR_ID,
    summary: `Imported ${assetCount} assets from Excel (List of Properties - Combined.xlsx)`,
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nAnex Excel Importer${isDryRun ? ' [DRY RUN — no writes]' : ' [LIVE]'}`);
  console.log(`Actor: ${ACTOR_ID}`);
  console.log(`File:  ${XLSX_PATH}\n`);

  const wb = XLSX.readFile(XLSX_PATH);

  if (!isDryRun) await ensureActor();

  const developerMap = await importDevelopers(wb);
  const assetMap = await importDataDump(wb);
  await importPmcPma(wb, assetMap);
  await importProposalTracker(wb, assetMap, developerMap);
  await writeImportLog(assetMap.size);

  console.log('\n✓ Import complete.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
