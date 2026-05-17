/**
 * Import Sher E Sales Intelligence Dashboard data into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-shere-excel.ts
 *   npx tsx scripts/import-shere-excel.ts --dry-run
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const isDryRun = process.argv.includes('--dry-run');
const EXCEL_PATH = path.resolve(process.cwd(), 'Sher E Sales_Intelligence_Dashboard_v2.xlsx');
const ACTOR_ID = '00000000-0000-0000-0000-000000000001';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normMobile(raw: unknown): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

function excelDate(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'number') {
    // Excel serial → JS date
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  const s = String(raw).trim();
  // e.g. "03-Jan-2026"
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

function mapAgeBracket(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const low = parseInt(s.split(/[-+]/)[0], 10);
  if (isNaN(low)) return null;
  if (low < 25) return 'below_25';
  if (low < 31) return '25_30';
  if (low < 41) return '31_40';
  if (low < 51) return '41_50';
  if (low < 61) return '51_60';
  return 'above_60';
}

function mapEmployment(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('salaried') || s === 'salaried') return 'salaried';
  if (s.includes('business')) return 'business_owner';
  if (s.includes('professional') || s.includes('proffessional')) return 'self_employed';
  if (s.includes('retired')) return 'retired';
  if (s.includes('home') || s.includes('house')) return 'other';
  return 'other';
}

function mapConfig(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s || s === 'unknown') return null;
  if (s.includes('jodi') || s.includes('jodi')) return '2bhk_jodi';
  if (s.startsWith('1 bhk') || s === '1bhk') return '1bhk';
  if (s.startsWith('2 bhk') || s === '2bhk') return '2bhk';
  if (s.startsWith('3 bhk') || s === '3bhk') return '3bhk';
  if (s.includes('commercial')) return 'commercial';
  if (s.includes('duplex')) return 'duplex';
  // multi-config → take the first
  if (s.startsWith('2 bhk, 3')) return '2bhk';
  if (s.startsWith('1 bhk, 2')) return '1bhk';
  if (s.startsWith('2 bhk, 3 bhk, 1')) return '2bhk';
  if (s.startsWith('1 bhk, 2 bhk, 3')) return '1bhk';
  if (s.startsWith('1 bhk, 3')) return '1bhk';
  return null;
}

function mapStatus(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'booked') return 'booked';
  if (s === 'hot') return 'hot';
  if (s === 'warm') return 'warm';
  if (s === 'lost') return 'lost';
  return 'cold';
}

function mapLostReason(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('not respond') || s.includes('not reach') || s.includes('ringing') || s.includes('mobile number') || s.includes('wrong number') || s.includes('incorrect')) return 'not_responding';
  if (s.includes('budget') || s.includes('funds') || s.includes('payment') || s.includes('low budget') || s.includes('pricing')) return 'budget';
  if (s.includes('booked else') || s.includes('purchased else') || s.includes('already purchase') || s.includes('cancelled booking')) return 'booked_elsewhere';
  if (s.includes('plan drop') || s.includes('plan postpon') || s.includes('plan drop')) return 'plan_dropped';
  if (s.includes('not interest') || s.includes('not intrested')) return 'not_interested';
  if (s.includes('location')) return 'location_issue';
  if (s.includes('requirement') || s.includes('requirem')) return 'requirement_mismatch';
  if (s.includes('layout')) return 'layout_issue';
  if (s.includes('vaastu') || s.includes('vastu')) return 'vaastu_issue';
  if (s.includes('general enquiry') || s.includes('enquiry purpose')) return 'general_enquiry';
  if (s.includes('rent')) return 'other';
  if (s.includes('possession')) return 'possession_timeline';
  if (s.includes('view') || s.includes('direction') || s.includes('south')) return 'view_issue';
  if (s.includes('floor')) return 'floor_issue';
  if (s.includes('jain') || s.includes('looking for big') || s.includes('amenities') || s.includes('personal')) return 'other';
  return 'other';
}

function mapPurpose(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('invest')) return 'investment';
  if (s.includes('self') || s.includes('own')) return 'self_use';
  if (s.includes('both')) return 'both';
  return null;
}

function mapCpCategory(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'ICP') return 'icp';
  if (s === 'RCP') return 'rcp';
  return 'cp';
}

function str(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

function log(msg: string) { process.stdout.write(msg + '\n'); }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(isDryRun ? '🔍 DRY RUN — no writes' : '🚀 Importing Sher E data...');

  const wb = XLSX.readFile(EXCEL_PATH);

  // ── 0. Resolve actor ID — use first team_member or insert demo stub ────────
  const { data: members } = await db.from('team_members').select('id').limit(1);
  const actorId: string = members?.[0]?.id ?? ACTOR_ID;

  // Ensure the demo stub exists if nothing else is in team_members
  if (!members?.length) {
    await db.from('team_members').upsert({
      id: ACTOR_ID,
      full_name: 'Demo User',
      email: 'demo@anexadvisory.com',
      role: 'admin',
      is_active: true,
    }, { onConflict: 'id', ignoreDuplicates: true });
  }

  // ── Find Sher E Punjab project ────────────────────────────────────────────
  const { data: projects } = await db.from('sales_projects').select('id, name');
  const shereProject = projects?.find(p =>
    p.name.toLowerCase().includes('sher') || p.name.toLowerCase().includes('andheri')
  );
  if (!shereProject) {
    log('❌ Could not find Sher E Punjab project in sales_projects. Run the SQL migration first.');
    process.exit(1);
  }
  log(`✅ Project: ${shereProject.name} (${shereProject.id})`);

  // ── 1. Import Channel Partners from CP Master List ─────────────────────────
  const cpSheet = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['CP Master List'], { header: 1 });
  // Row index 3 = header row, data starts at 4
  const cpHeaderIdx = cpSheet.findIndex((r: unknown[]) => String(r[0]).trim() === 'Sr No');
  const cpDataRows = cpSheet.slice(cpHeaderIdx + 1).filter((r: unknown[]) => r[0] && typeof r[0] === 'number');

  log(`\n📋 CP Master List: ${cpDataRows.length} rows`);

  const cpInserts: Record<string, unknown>[] = cpDataRows.map((r: unknown[]) => ({
    canonical_name: str(r[2]) ?? str(r[1]) ?? 'Unknown', // firm name first, then personal name
    aliases: str(r[1]) ? [str(r[1])!] : [],              // CP personal name as alias
    category: mapCpCategory(r[3]),
    stage: 'active',
    created_by: actorId,
    updated_at: new Date().toISOString(),
  }));

  // Deduplicate by canonical_name
  const cpByName = new Map<string, Record<string, unknown>>();
  for (const cp of cpInserts) cpByName.set(cp.canonical_name as string, cp);
  const cpUnique = Array.from(cpByName.values());

  log(`   Unique CPs: ${cpUnique.length}`);

  if (!isDryRun) {
    const { error } = await db.from('channel_partners').upsert(cpUnique, {
      onConflict: 'canonical_name',
      ignoreDuplicates: true,
    });
    if (error) log(`   ⚠️  CP upsert error: ${error.message}`);
    else log(`   ✅ CPs upserted`);
  }

  // Build CP lookup: firm name → id
  const { data: cpRows } = await db.from('channel_partners').select('id, canonical_name');
  const cpIdByName = new Map(cpRows?.map(r => [r.canonical_name.toLowerCase(), r.id]) ?? []);

  // ── 2. Import ML_Data (Master Lead Tracker — CP walk-ins) ─────────────────
  const mlSheet = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['ML_Data'], { header: 1 });
  const mlHeaderIdx = mlSheet.findIndex((r: unknown[]) => String(r[0]).trim() === 'Sr. No');
  const mlDataRows = mlSheet.slice(mlHeaderIdx + 1).filter((r: unknown[]) => r[0] && typeof r[0] === 'number');
  log(`\n📋 ML_Data: ${mlDataRows.length} rows`);

  // ── 3. Import DV_Data (Direct Visits) ─────────────────────────────────────
  const dvSheet = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['DV_Data'], { header: 1 });
  const dvHeaderIdx = dvSheet.findIndex((r: unknown[]) => String(r[0]).trim() === 'Sr. No');
  const dvDataRows = dvSheet.slice(dvHeaderIdx + 1).filter((r: unknown[]) => r[0] && typeof r[0] === 'number');
  log(`📋 DV_Data: ${dvDataRows.length} rows`);

  // Build unified lead rows
  type LeadRow = {
    date: string | null;
    firstName: string | null;
    lastName: string | null;
    mobile: string | null;
    email: string | null;
    ageBracket: string | null;
    employment: string | null;
    config: string | null;
    budget: string | null;
    carpetArea: number | null;
    purpose: string | null;
    sourcingManager: string | null;
    closingManager: string | null;
    source: string;
    subSource: string | null;
    cpFirmName: string | null;
    cpName: string | null;
    status: string;
    latestRemark: string | null;
    latestRemarkDate: string | null;
    lostReason: string | null;
  };

  const mlLeads: LeadRow[] = mlDataRows.map((r: unknown[]) => ({
    date: excelDate(r[1]),
    firstName: str(r[3]),
    lastName: str(r[4]),
    mobile: normMobile(r[5]),
    email: str(r[6]),
    ageBracket: mapAgeBracket(r[8]),
    employment: mapEmployment(r[12]),
    config: mapConfig(r[14]),
    budget: str(r[15]),
    carpetArea: r[16] ? Number(r[16]) : null,
    purpose: mapPurpose(r[18]),
    sourcingManager: str(r[19]),
    closingManager: str(r[27]),
    source: 'cp',
    subSource: str(r[20]),
    cpFirmName: str(r[22]),
    cpName: str(r[23]),
    status: mapStatus(r[28]),
    latestRemark: str(r[30]),
    latestRemarkDate: null,
    lostReason: String(r[28] ?? '').trim().toLowerCase() === 'lost' ? mapLostReason(r[32]) : null,
  }));

  const dvLeads: LeadRow[] = dvDataRows.map((r: unknown[]) => ({
    date: excelDate(r[1]),
    firstName: str(r[3]),
    lastName: str(r[4]),
    mobile: normMobile(r[5]),
    email: str(r[6]),
    ageBracket: mapAgeBracket(r[8]),
    employment: mapEmployment(r[12]),
    config: mapConfig(r[14]),
    budget: str(r[15]),
    carpetArea: r[16] ? Number(r[16]) : null,
    purpose: mapPurpose(r[18]),
    sourcingManager: str(r[19]),
    closingManager: str(r[22]),
    source: 'direct',
    subSource: str(r[21]),
    cpFirmName: null,
    cpName: null,
    status: mapStatus(r[23]),
    latestRemark: str(r[25]),
    latestRemarkDate: null,
    lostReason: String(r[23] ?? '').trim().toLowerCase() === 'lost' ? mapLostReason(r[27]) : null,
  }));

  const allLeads = [...mlLeads, ...dvLeads].filter(l => l.mobile);

  // ── 4. Upsert clients (dedup by mobile) ───────────────────────────────────
  const clientsByMobile = new Map<string, LeadRow>();
  for (const l of allLeads) {
    if (l.mobile && !clientsByMobile.has(l.mobile)) clientsByMobile.set(l.mobile, l);
  }

  const clientInserts = Array.from(clientsByMobile.values()).map(l => ({
    mobile_primary: l.mobile!,
    first_name: l.firstName,
    last_name: l.lastName,
    email: l.email,
    age_bracket: l.ageBracket,
    employment_type: l.employment,
  }));

  log(`\n👥 Clients to upsert: ${clientInserts.length}`);

  if (!isDryRun) {
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < clientInserts.length; i += BATCH) {
      const { error } = await db.from('clients').upsert(clientInserts.slice(i, i + BATCH), {
        onConflict: 'mobile_primary',
        ignoreDuplicates: true,
      });
      if (error) log(`   ⚠️  client batch ${i}: ${error.message}`);
      else inserted += Math.min(BATCH, clientInserts.length - i);
    }
    log(`   ✅ ${inserted} clients upserted`);
  }

  // Build client mobile → id lookup
  const { data: clientRows } = await db.from('clients').select('id, mobile_primary');
  const clientIdByMobile = new Map(clientRows?.map(r => [r.mobile_primary, r.id]) ?? []);

  // ── 5. Upsert walk-ins ────────────────────────────────────────────────────
  const walkInInserts = allLeads
    .filter(l => l.mobile && clientIdByMobile.has(l.mobile!))
    .map(l => {
      const cpFirmLower = l.cpFirmName?.toLowerCase() ?? '';
      const cpId = cpFirmLower ? (cpIdByName.get(cpFirmLower) ?? null) : null;
      return {
        project_id: shereProject.id,
        client_id: clientIdByMobile.get(l.mobile!)!,
        source: l.source as 'cp' | 'direct',
        sub_source: l.subSource,
        cp_id: cpId,
        configuration: l.config as string | null,
        budget: l.budget,
        carpet_area: l.carpetArea,
        purpose: l.purpose as string | null,
        status: l.status as string,
        latest_remark: l.latestRemark,
        lost_reason: l.lostReason as string | null,
        is_active: true,
        created_at: l.date ? new Date(l.date).toISOString() : new Date().toISOString(),
        created_by: actorId,
        // Legacy NOT NULL columns from early partial migration — safe defaults
        sm_id: actorId,
        client_name: [l.firstName, l.lastName].filter(Boolean).join(' ') || 'Unknown',
        visit_date: l.date ?? new Date().toISOString().split('T')[0],
        visit_type: 'site_visit',
      };
    });

  // Deduplicate by (client_id, project_id) — keep the latest (last occurrence wins)
  const walkInMap = new Map<string, (typeof walkInInserts)[0]>();
  for (const wi of walkInInserts) {
    walkInMap.set(`${wi.client_id}:${wi.project_id}`, wi);
  }
  const walkInDeduped = Array.from(walkInMap.values());

  log(`\n🚶 Walk-ins to upsert: ${walkInDeduped.length} (deduplicated from ${walkInInserts.length})`);

  if (!isDryRun) {
    const BATCH = 100;
    let inserted = 0;
    let skipped = 0;
    for (let i = 0; i < walkInDeduped.length; i += BATCH) {
      const { error } = await db.from('walk_ins').upsert(walkInDeduped.slice(i, i + BATCH), {
        onConflict: 'client_id,project_id',
        ignoreDuplicates: false,
      });
      if (error) {
        log(`   ⚠️  walk-in batch ${i}: ${error.message}`);
        skipped += Math.min(BATCH, walkInDeduped.length - i);
      } else inserted += Math.min(BATCH, walkInDeduped.length - i);
    }
    log(`   ✅ ${inserted} walk-ins upserted, ${skipped} skipped`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  log('\n─────────────────────────────────────────');
  log(`Project  : ${shereProject.name}`);
  log(`CPs      : ${cpUnique.length}`);
  log(`Clients  : ${clientInserts.length}`);
  log(`Walk-ins : ${walkInInserts.length}`);
  log(isDryRun ? '\n✅ Dry run complete — nothing written' : '\n✅ Import complete');
}

main().catch(err => { console.error(err); process.exit(1); });
