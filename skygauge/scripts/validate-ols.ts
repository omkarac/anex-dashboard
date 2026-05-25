/**
 * Validate the OLS engine against the historical NOC dataset.
 *
 * Reads `data/skygauge_nocs.xlsx`, evaluates the engine at each record's
 * lat/lon, and compares the theoretical max-top elevation against the actual
 * permissible_top_m granted by AAI.
 *
 * Expected behaviour
 * ------------------
 *   - UNRESTRICTED NOCs: theoretical should approximate the actual permissible
 *     top (since AAI derives the limit from the same surfaces). A small bias
 *     and ~few-metre RMS error is normal, mostly from threshold coord
 *     imprecision in the seed data.
 *   - RESTRICTED NOCs: theoretical should be HIGHER than (or equal to) the
 *     actual limit — AAI restricted those NOCs below the geometric OLS for
 *     other reasons (instrument approach procedures, controlled airspace,
 *     etc.) not captured in our pure-OLS engine.
 *
 * Usage:
 *     cd skygauge
 *     npm run validate                  # 500-record sample
 *     npm run validate -- --all         # full workbook
 *     npm run validate -- --sample 100  # custom sample size
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { read, utils, type WorkBook } from "xlsx";

import { computeOLSLimit } from "../api/ols/engine.ts";
import type { SurfaceKind } from "../api/ols/types.ts";

interface NocRow {
  noc_id: string;
  airport_code: string;
  lat: number;
  lon: number;
  site_elevation_m: number | null;
  permissible_top_m: number | null;
  is_restricted: boolean;
  structure_type: string;
}

function readWorkbook(path: string): NocRow[] {
  const buf = readFileSync(path);
  const wb: WorkBook = read(buf, { type: "buffer" });
  const ws = wb.Sheets["nocs"];
  if (!ws) throw new Error(`No 'nocs' sheet in ${path}`);
  const raw = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  const rows: NocRow[] = [];
  for (const r of raw) {
    const lat = num(r["lat"]);
    const lon = num(r["lon"]);
    const top = num(r["permissible_top_m"]);
    if (lat === null || lon === null || top === null) continue;
    rows.push({
      noc_id: String(r["noc_id"] ?? ""),
      airport_code: String(r["airport_code"] ?? ""),
      lat,
      lon,
      site_elevation_m: num(r["site_elevation_m"]),
      permissible_top_m: top,
      is_restricted: r["is_restricted"] === true || r["is_restricted"] === "True",
      structure_type: String(r["structure_type"] ?? ""),
    });
  }
  return rows;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function shuffle<T>(arr: T[], seed = 42): T[] {
  // Simple LCG for deterministic sampling.
  let s = seed;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return NaN;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ---------------------------------------------------------------------------

interface CompareRow {
  noc_id: string;
  airport_code: string;
  is_restricted: boolean;
  actual_m: number;
  theoretical_m: number | null;
  binding_surface: SurfaceKind | null;
  binding_airport: string | null;
  delta_m: number | null; // theoretical - actual
}

function compareOne(row: NocRow): CompareRow {
  const result = computeOLSLimit({
    lat: row.lat,
    lon: row.lon,
    elevation_m: row.site_elevation_m ?? undefined,
  });
  const theoretical_m = result.max_top_amsl_m;
  return {
    noc_id: row.noc_id,
    airport_code: row.airport_code,
    is_restricted: row.is_restricted,
    actual_m: row.permissible_top_m!,
    theoretical_m,
    binding_surface: result.binding?.surface ?? null,
    binding_airport: result.binding?.airport_code ?? null,
    delta_m: theoretical_m === null ? null : theoretical_m - row.permissible_top_m!,
  };
}

function summarize(label: string, rows: CompareRow[]): void {
  const evaluated = rows.filter((r) => r.theoretical_m !== null);
  const unconstrained = rows.length - evaluated.length;
  const deltas = evaluated.map((r) => r.delta_m!).sort((a, b) => a - b);
  const absDeltas = [...deltas].map(Math.abs).sort((a, b) => a - b);
  const surfaceCounts: Record<string, number> = {};
  const airportCounts: Record<string, number> = {};
  for (const r of evaluated) {
    if (r.binding_surface) surfaceCounts[r.binding_surface] = (surfaceCounts[r.binding_surface] ?? 0) + 1;
    if (r.binding_airport) airportCounts[r.binding_airport] = (airportCounts[r.binding_airport] ?? 0) + 1;
  }
  const bias = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);

  console.log(`\n── ${label} (n=${rows.length}) ─────────────────────────────`);
  if (rows.length === 0) {
    console.log("  (no rows)");
    return;
  }
  console.log(`  evaluated:       ${evaluated.length}`);
  if (unconstrained > 0) {
    console.log(`  no constraint:   ${unconstrained} (outside every airport's OHS)`);
  }
  if (deltas.length > 0) {
    console.log(`  delta (theoretical − actual), metres:`);
    console.log(`     bias (mean):  ${bias.toFixed(1)} m`);
    console.log(`     median:       ${median(deltas).toFixed(1)} m`);
    console.log(`     p10 / p90:    ${percentile(deltas, 10).toFixed(1)} / ${percentile(deltas, 90).toFixed(1)} m`);
    console.log(`     p25 / p75:    ${percentile(deltas, 25).toFixed(1)} / ${percentile(deltas, 75).toFixed(1)} m`);
    console.log(`     |delta| p50:  ${median(absDeltas).toFixed(1)} m`);
    console.log(`     |delta| p90:  ${percentile(absDeltas, 90).toFixed(1)} m`);
  }
  console.log(`  binding surface mix:`);
  Object.entries(surfaceCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`     ${k.padEnd(20)} ${v}  (${((v / evaluated.length) * 100).toFixed(0)}%)`));
  console.log(`  binding airport mix:`);
  Object.entries(airportCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`     ${k.padEnd(8)} ${v}  (${((v / evaluated.length) * 100).toFixed(0)}%)`));
}

function printWorstCases(rows: CompareRow[], n = 5): void {
  console.log(`\n── Worst-case discrepancies (theoretical too LOW) ──`);
  const tooLow = rows
    .filter((r) => r.theoretical_m !== null && !r.is_restricted)
    .filter((r) => r.delta_m! < 0)
    .sort((a, b) => a.delta_m! - b.delta_m!)
    .slice(0, n);
  for (const r of tooLow) {
    console.log(
      `  ${r.noc_id.padEnd(35)} ${r.airport_code}  actual=${r.actual_m.toFixed(1)}m  ` +
        `theoretical=${r.theoretical_m!.toFixed(1)}m  Δ=${r.delta_m!.toFixed(1)}m  (${r.binding_surface})`,
    );
  }
  console.log(`\n── Worst-case discrepancies (theoretical too HIGH on unrestricted NOCs) ──`);
  const tooHigh = rows
    .filter((r) => r.theoretical_m !== null && !r.is_restricted)
    .filter((r) => r.delta_m! > 0)
    .sort((a, b) => b.delta_m! - a.delta_m!)
    .slice(0, n);
  for (const r of tooHigh) {
    console.log(
      `  ${r.noc_id.padEnd(35)} ${r.airport_code}  actual=${r.actual_m.toFixed(1)}m  ` +
        `theoretical=${r.theoretical_m!.toFixed(1)}m  Δ=${r.delta_m!.toFixed(1)}m  (${r.binding_surface})`,
    );
  }
}

// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      file: { type: "string", default: "data/skygauge_nocs.xlsx" },
      sample: { type: "string", default: "500" },
      all: { type: "boolean", default: false },
      seed: { type: "string", default: "42" },
    },
    allowPositionals: false,
  });

  const path = resolve(values.file!);
  if (!existsSync(path)) {
    console.error(`Workbook not found: ${path}`);
    console.error(`(run the maitree scraper first to populate the workbook)`);
    return 1;
  }
  console.log(`Reading: ${path}`);
  const allRows = readWorkbook(path);
  console.log(`  ↳ ${allRows.length} usable NOCs`);

  const sampleSize = values.all ? allRows.length : Number(values.sample);
  const sample = shuffle(allRows, Number(values.seed)).slice(0, sampleSize);
  console.log(`Validating ${sample.length} of ${allRows.length} NOCs (${values.all ? "ALL" : "sample"})…`);

  const t0 = Date.now();
  const compared: CompareRow[] = sample.map(compareOne);
  const elapsed = (Date.now() - t0) / 1000;
  console.log(`  ↳ ${compared.length} evaluated in ${elapsed.toFixed(1)}s (${(compared.length / elapsed).toFixed(0)}/s)`);

  const unrestricted = compared.filter((r) => !r.is_restricted);
  const restricted = compared.filter((r) => r.is_restricted);

  summarize("All NOCs",                  compared);
  summarize("Unrestricted NOCs only",    unrestricted);
  summarize("Restricted NOCs only",      restricted);

  printWorstCases(compared, 5);

  // Soundness check: for restricted NOCs, theoretical should generally be ≥ actual.
  // Report what fraction obey this.
  const restrEval = restricted.filter((r) => r.theoretical_m !== null);
  const conservative = restrEval.filter((r) => r.delta_m! >= -2).length; // 2 m tolerance for noise
  console.log(
    `\nSanity: ${conservative}/${restrEval.length} restricted NOCs satisfy ` +
      `theoretical ≥ actual − 2 m (${((conservative / Math.max(1, restrEval.length)) * 100).toFixed(0)}%)`,
  );

  return 0;
}

const code = await main();
process.exit(code);
