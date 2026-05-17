/**
 * Import 7 Folds Sales Intelligence Report into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-7folds-excel.ts
 *   npx tsx scripts/import-7folds-excel.ts --dry-run
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const isDryRun = process.argv.includes('--dry-run');
const EXCEL_PATH = path.resolve(process.cwd(), '7Folds_Sales_Intelligence_Report.xlsx');
const ACTOR_ID = '00000000-0000-0000-0000-000000000001';
const PROJECT_NAME = '7 Folds';

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

function parseDate(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'number') {
    // Excel serial
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  const s = String(raw).trim();
  if (!s) return null;
  // Handle "29-May-25" and "2025-05-22 00:00:00" and "25-May-25 11:58"
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
}

function mapConfig(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('jodi')) return '2bhk_jodi';
  if (s === '1bhk' || s === '1 bhk') return '1bhk';
  if (s === '2bhk' || s === '2 bhk') return '2bhk';
  if (s === '3bhk' || s === '3 bhk') return '3bhk';
  if (s.includes('duplex')) return 'duplex';
  if (s.includes('commercial')) return 'commercial';
  if (s.includes('2/3') || s.includes('2 / 3')) return '2bhk';
  return null;
}

function mapStatus(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'booked') return 'booked';
  if (s === 'warm') return 'warm';
  if (s === 'hot') return 'hot';
  if (s === 'lost') return 'lost';
  return 'cold';
}

function mapLostReason(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  // Strip leading "lost-", "cold-", etc.
  const clean = s.replace(/^(lost[-:\s]+|cold[-:\s]+)/i, '').trim();
  if (!clean) return null;
  if (clean.includes('not respond') || clean.includes('ringing') || clean.includes('wrong number') ||
      clean.includes('not answering') || clean.includes('always ringing') || clean.includes('switched off') ||
      clean.includes('not reachable') || clean.includes('not contactable') || clean.includes('incoming calls')) return 'not_responding';
  if (clean.includes('budget') || clean.includes('pricing') || clean.includes('rate is too high') ||
      clean.includes('funds') || clean.includes('payment') || clean.includes('1.5cr') || clean.includes('1.6cr') ||
      clean.includes('1.7cr') || clean.includes('low budget')) return 'budget';
  if (clean.includes('booked else') || clean.includes('purchased else') || clean.includes('bought') ||
      clean.includes('booked in') || clean.includes('booked at') || clean.includes('booked somewhere') ||
      clean.includes('has done') || clean.includes('resale')) return 'booked_elsewhere';
  if (clean.includes('plan drop') || clean.includes('plan pospond') || clean.includes('postpone') ||
      clean.includes('plan on hold') || clean.includes('dropped plan') || clean.includes('dropped his plan') ||
      clean.includes('dropped her plan') || clean.includes('dropped their plan')) return 'plan_dropped';
  if (clean.includes('not interest') || clean.includes('not intrested') || clean.includes('not much keen') ||
      clean.includes('not keen') || clean.includes('not interested') || clean.includes('denied')) return 'not_interested';
  if (clean.includes('location') || clean.includes('prefer') || clean.includes('goregaon') ||
      clean.includes('east location') || clean.includes('west location')) return 'location_issue';
  if (clean.includes('requirement') || clean.includes('requirem') || clean.includes('mismatch') ||
      clean.includes('jodi flat') || clean.includes('need jodi') || clean.includes('higher floor') ||
      clean.includes('big carpet') || clean.includes('bigger carpet') || clean.includes('1300') ||
      clean.includes('1500') || clean.includes('1100') || clean.includes('inventory')) return 'requirement_mismatch';
  if (clean.includes('layout') || clean.includes('didn\'t liked') || clean.includes('didnt liked') ||
      clean.includes('not liking') || clean.includes('not like') || clean.includes('washroom')) return 'layout_issue';
  if (clean.includes('vaastu') || clean.includes('vastu')) return 'vaastu_issue';
  if (clean.includes('general enquiry') || clean.includes('enquiry') || clean.includes('commercial')) return 'general_enquiry';
  if (clean.includes('floor')) return 'floor_issue';
  if (clean.includes('view') || clean.includes('facing') || clean.includes('front road') ||
      clean.includes('dixit road')) return 'view_issue';
  if (clean.includes('possession') || clean.includes('under cons') || clean.includes('rtmi') ||
      clean.includes('ready to move')) return 'possession_timeline';
  return 'other';
}

function mapPurpose(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('invest')) return 'investment';
  if (s.includes('self') || s.includes('own use')) return 'self_use';
  if (s.includes('both')) return 'both';
  return null;
}

function mapMeetingType(raw: unknown): 'obm' | 'ibm' {
  return String(raw ?? '').trim().toLowerCase() === 'ibm' ? 'ibm' : 'obm';
}

function mapMeetingCategory(raw: unknown): 'unique' | 'repeat' {
  return String(raw ?? '').trim().toLowerCase() === 'repeat' ? 'repeat' : 'unique';
}

function str(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s || null;
}

function log(msg: string) { process.stdout.write(msg + '\n'); }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(isDryRun ? '🔍 DRY RUN — no writes' : `🚀 Importing ${PROJECT_NAME} data...`);

  const wb = XLSX.readFile(EXCEL_PATH);
  const today = new Date().toISOString().split('T')[0];

  // ── 0. Resolve actor ───────────────────────────────────────────────────────
  const { data: members } = await db.from('team_members').select('id').limit(1);
  const actorId: string = members?.[0]?.id ?? ACTOR_ID;
  if (!members?.length) {
    await db.from('team_members').upsert({
      id: ACTOR_ID, full_name: 'Import Bot', email: 'import@anexadvisory.com',
      role: 'admin', is_active: true,
    }, { onConflict: 'id' });
    log('  Inserted demo team_member stub');
  }
  log(`  Actor: ${actorId}`);

  // ── 1. Ensure 7 Folds project exists ──────────────────────────────────────
  let { data: project } = await db
    .from('sales_projects')
    .select('id, name')
    .ilike('name', '%7%fold%')
    .single();

  if (!project) {
    log(`  Creating project: ${PROJECT_NAME}`);
    if (!isDryRun) {
      const { data: created, error } = await db
        .from('sales_projects')
        .insert({
          name: PROJECT_NAME,
          developer_name: '7 Folds Developer',
          location: 'Vile Parle East, Mumbai',
          is_active: true,
          created_by: actorId,
        })
        .select('id, name')
        .single();
      if (error) { log(`  ERROR creating project: ${error.message}`); process.exit(1); }
      project = created;
    } else {
      project = { id: 'DRY-RUN-ID', name: PROJECT_NAME };
    }
  }
  log(`  Project: ${project!.name} (${project!.id})`);
  const projectId = project!.id;

  // ── 2. Load CP canonical map from CP Name Master ────────────────────────────
  const cpMasterSheet = wb.Sheets['🔑 CP Name Master'];
  const cpMasterRows = XLSX.utils.sheet_to_json<unknown[]>(cpMasterSheet, { header: 1 });
  // header at index 2, data starts at 3
  const canonicalMap = new Map<string, string>(); // raw → canonical
  for (let i = 3; i < cpMasterRows.length; i++) {
    const r = cpMasterRows[i] as unknown[];
    if (!r || !r[0]) continue;
    const raw = str(r[0]); const canonical = str(r[1]);
    if (raw && canonical) canonicalMap.set(raw.toLowerCase(), canonical);
  }
  log(`  Canonical CP map: ${canonicalMap.size} entries`);

  // ── 3. Parse walk-in data ──────────────────────────────────────────────────
  const wiSheet = wb.Sheets['🚶 Walk-in Data'];
  // header at row 2 (index 2), data starts at row 3 (index 3)
  const wiRows = XLSX.utils.sheet_to_json<unknown[]>(wiSheet, { header: 1 });

  interface WiRow {
    date: string | null;
    visitType: string;
    firstName: string | null;
    lastName: string | null;
    mobile: string | null;
    config: string | null;
    budget: string | null;
    purpose: string | null;
    sourcingMgr: string | null;
    source: string;
    subSource: string | null;
    cpFirmRaw: string | null;
    cpCanonical: string | null;
    closingMgr: string | null;
    status: string;
    latestRemark: string | null;
    lostReason: string | null;
  }

  const wiParsed: WiRow[] = [];
  for (let i = 3; i < wiRows.length; i++) {
    const r = wiRows[i] as unknown[];
    if (!r || !r[3]) continue; // skip rows without first name

    const mobile = normMobile(r[5]);
    if (!mobile) continue; // must have a valid mobile

    const rawSource = str(r[17]) ?? '';
    const source = rawSource.toLowerCase().includes('cp') ? 'cp' : 'direct';
    const cpFirmRaw = str(r[19]);
    const cpCanonicalRaw = str(r[28]);
    const cpCanonical = cpCanonicalRaw && !cpCanonicalRaw.toLowerCase().includes('unknown')
      ? cpCanonicalRaw
      : cpFirmRaw
        ? (canonicalMap.get(cpFirmRaw.toLowerCase()) ?? cpFirmRaw)
        : null;

    const rawLost1 = str(r[25]);
    const rawLost2 = str(r[26]);
    const lostRaw = rawLost1 ?? rawLost2;

    wiParsed.push({
      date: parseDate(r[1]),
      visitType: String(r[2] ?? 'Fresh').trim(),
      firstName: str(r[3]),
      lastName: str(r[4]),
      mobile,
      config: mapConfig(r[11]),
      budget: str(r[12]),
      purpose: mapPurpose(r[15]),
      sourcingMgr: str(r[16]),
      source,
      subSource: str(r[18]),
      cpFirmRaw,
      cpCanonical: source === 'cp' ? cpCanonical : null,
      closingMgr: str(r[21]),
      status: mapStatus(r[22]),
      latestRemark: str(r[24]),
      lostReason: mapLostReason(lostRaw),
    });
  }
  log(`  Parsed ${wiParsed.length} walk-in rows`);

  // ── 4. Extract unique CP firms ─────────────────────────────────────────────
  const cpFirmsNeeded = new Set<string>();
  for (const w of wiParsed) {
    if (w.source === 'cp' && w.cpCanonical) cpFirmsNeeded.add(w.cpCanonical);
  }

  // CP DAR sheet for additional CP firms from meetings
  const darSheet = wb.Sheets['📋 CP DAR'];
  const darRows = XLSX.utils.sheet_to_json<unknown[]>(darSheet, { header: 1 });
  for (let i = 3; i < darRows.length; i++) {
    const r = darRows[i] as unknown[];
    if (!r || !r[12]) continue;
    const canonical = str(r[12]);
    if (canonical && !canonical.toLowerCase().includes('unknown')) cpFirmsNeeded.add(canonical);
  }
  log(`  Unique CP firms: ${cpFirmsNeeded.size}`);

  // ── 5. Upsert channel partners ─────────────────────────────────────────────
  log('  Upserting channel partners...');
  const cpInserts = [...cpFirmsNeeded].map(name => ({
    canonical_name: name,
    category: 'cp',
    is_active: true,
    created_by: actorId,
  }));

  const cpIdMap = new Map<string, string>(); // canonical → DB id
  if (!isDryRun && cpInserts.length > 0) {
    const { data: inserted, error } = await db
      .from('channel_partners')
      .upsert(cpInserts, { onConflict: 'canonical_name', ignoreDuplicates: false })
      .select('id, canonical_name');
    if (error) log(`  WARN CP upsert: ${error.message}`);
    for (const cp of inserted ?? []) cpIdMap.set(cp.canonical_name, cp.id);

    // Fetch any that weren't returned (already existed)
    const missing = [...cpFirmsNeeded].filter(n => !cpIdMap.has(n));
    if (missing.length > 0) {
      const { data: existing } = await db
        .from('channel_partners')
        .select('id, canonical_name')
        .in('canonical_name', missing);
      for (const cp of existing ?? []) cpIdMap.set(cp.canonical_name, cp.id);
    }
  } else {
    for (const name of cpFirmsNeeded) cpIdMap.set(name, `DRY-${name}`);
  }
  log(`  CP id map: ${cpIdMap.size} entries`);

  // ── 6. Upsert clients ──────────────────────────────────────────────────────
  log('  Upserting clients...');
  const seenMobiles = new Map<string, string>(); // mobile → client id
  // clients schema: mobile_primary, first_name, last_name, email — no is_active, no created_by
  const clientInserts = wiParsed
    .filter(w => w.mobile)
    .map(w => ({
      mobile_primary: w.mobile!,
      first_name: w.firstName ?? 'Unknown',
      last_name: w.lastName ?? null,
    }));

  // Deduplicate by mobile
  const uniqueClients = [...new Map(clientInserts.map(c => [c.mobile_primary, c])).values()];
  log(`  Unique clients: ${uniqueClients.length}`);

  if (!isDryRun) {
    const BATCH = 100;
    for (let i = 0; i < uniqueClients.length; i += BATCH) {
      const batch = uniqueClients.slice(i, i + BATCH);
      const { data, error } = await db
        .from('clients')
        .upsert(batch, { onConflict: 'mobile_primary', ignoreDuplicates: false })
        .select('id, mobile_primary');
      if (error) log(`  WARN client batch ${i}: ${error.message}`);
      for (const c of data ?? []) seenMobiles.set(c.mobile_primary, c.id);
    }

    // Fetch any that weren't returned
    const missing = uniqueClients.map(c => c.mobile_primary).filter(m => !seenMobiles.has(m));
    if (missing.length > 0) {
      const { data: existing } = await db
        .from('clients')
        .select('id, mobile_primary')
        .in('mobile_primary', missing);
      for (const c of existing ?? []) seenMobiles.set(c.mobile_primary, c.id);
    }
  } else {
    uniqueClients.forEach((c, i) => seenMobiles.set(c.mobile_primary, `DRY-${i}`));
  }
  log(`  Clients resolved: ${seenMobiles.size}`);

  // ── 7. Upsert walk-ins ─────────────────────────────────────────────────────
  log('  Upserting walk-ins...');

  // Build walk-in inserts, deduped by (client_id, project_id)
  const wiMap = new Map<string, Record<string, unknown>>();
  for (const w of wiParsed) {
    if (!w.mobile) continue;
    const clientId = seenMobiles.get(w.mobile);
    if (!clientId) continue;
    const cpId = w.cpCanonical ? (cpIdMap.get(w.cpCanonical) ?? null) : null;
    const key = `${clientId}:${projectId}`;
    wiMap.set(key, {
      client_id: clientId,
      project_id: projectId,
      cp_id: cpId,
      source: w.source,
      status: w.status,
      configuration: w.config,
      budget: w.budget,
      purpose: w.purpose,
      latest_remark: w.latestRemark,
      lost_reason: w.status === 'lost' ? w.lostReason : null,
      is_active: true,
      created_by: actorId,
      // Legacy NOT NULL columns
      sm_id: actorId,
      client_name: [w.firstName, w.lastName].filter(Boolean).join(' ') || 'Unknown',
      visit_date: w.date ?? today,
      visit_type: 'site_visit',
    });
  }
  log(`  Deduped walk-ins: ${wiMap.size}`);

  let wiOk = 0, wiSkipped = 0;
  if (!isDryRun) {
    const walkIns = [...wiMap.values()];
    const BATCH = 100;
    for (let i = 0; i < walkIns.length; i += BATCH) {
      const batch = walkIns.slice(i, i + BATCH);
      const { error } = await db
        .from('walk_ins')
        .upsert(batch, { onConflict: 'client_id,project_id', ignoreDuplicates: false });
      if (error) {
        log(`  WARN walk-in batch ${i}: ${error.message}`);
        wiSkipped += batch.length;
      } else {
        wiOk += batch.length;
      }
    }
  } else {
    wiOk = wiMap.size;
  }
  log(`  Walk-ins: ${wiOk} ok, ${wiSkipped} skipped`);

  // ── 8. Import CP meetings from DAR sheet ──────────────────────────────────
  log('  Importing CP meetings (DAR)...');

  // Build SM name → team_member id map
  const { data: allMembers } = await db
    .from('team_members')
    .select('id, full_name');
  const smNameMap = new Map<string, string>(); // partial name → id
  for (const m of allMembers ?? []) {
    smNameMap.set(m.full_name.toLowerCase(), m.id);
    // also map first name + last initial e.g. "Swati M" → swati
    const parts = m.full_name.trim().split(' ');
    if (parts[0]) smNameMap.set(parts[0].toLowerCase(), m.id);
  }

  const meetingInserts: Record<string, unknown>[] = [];
  for (let i = 3; i < darRows.length; i++) {
    const r = darRows[i] as unknown[];
    if (!r || !r[1]) continue;

    const meetingDate = parseDate(r[1]);
    if (!meetingDate) continue;

    const smRaw = str(r[10]);
    const cpCanonicalRaw = str(r[12]);
    if (!smRaw && !cpCanonicalRaw) continue;

    // Resolve SM id from name — try "Swati M" style partial match
    let smId: string | null = null;
    if (smRaw) {
      const key = smRaw.toLowerCase();
      smId = smNameMap.get(key) ?? null;
      if (!smId) {
        // Try first name only
        const firstName = key.split(/\s+/)[0];
        smId = smNameMap.get(firstName) ?? null;
      }
      // Fall back to actor
      if (!smId) smId = actorId;
    } else {
      smId = actorId;
    }

    const cpId = cpCanonicalRaw ? (cpIdMap.get(cpCanonicalRaw) ?? null) : null;

    meetingInserts.push({
      project_id: projectId,
      sm_id: smId,
      cp_id: cpId,
      meeting_date: meetingDate,
      meeting_type: mapMeetingType(r[9]),
      meeting_category: mapMeetingCategory(r[8]),
      feedback: str(r[23]), // cp_meetings uses 'feedback' not 'notes'
      created_by: actorId,
    });
  }
  log(`  Meeting rows to insert: ${meetingInserts.length}`);

  const validMeetings = meetingInserts.filter(m => m.cp_id !== null);
  log(`  Meetings with resolved CP: ${validMeetings.length} (skipping ${meetingInserts.length - validMeetings.length} without CP)`);

  let meetOk = 0, meetSkip = 0;
  if (!isDryRun && validMeetings.length > 0) {
    const BATCH = 100;
    for (let i = 0; i < validMeetings.length; i += BATCH) {
      const batch = validMeetings.slice(i, i + BATCH);
      const { error } = await db
        .from('cp_meetings')
        .insert(batch);
      if (error) {
        log(`  WARN meeting batch ${i}: ${error.message}`);
        meetSkip += batch.length;
      } else {
        meetOk += batch.length;
      }
    }
  } else {
    meetOk = meetingInserts.length;
  }
  log(`  Meetings: ${meetOk} ok, ${meetSkip} skipped`);

  log('');
  log('✅ Import complete');
  log(`   Project  : ${project!.name}`);
  log(`   CPs      : ${cpIdMap.size}`);
  log(`   Clients  : ${seenMobiles.size}`);
  log(`   Walk-ins : ${wiOk}`);
  log(`   Meetings : ${meetOk}`);
}

main().catch(err => { log(`FATAL: ${err.message}`); process.exit(1); });
