# Skygauge — session handoff

> Drop this into the next Claude session via `@skygauge/HANDOFF.md` to pick up where the last one left off. Pair with `skygauge/README.md` and `skygauge/SPEC.md` (if/when it exists) for full context.

## Where we are

Five slices complete. The NOCs are now in Supabase (PostGIS), the theoretical OLS engine is wired into the 2D map, **and** the empirical layer is live — every analyzed point shows the theoretical OLS ceiling alongside the neighborhood band of real AAI approvals, with the delta between them called out. The tool delivers its core value end-to-end. Remaining work is the appellate-override data (Slice 12), the 3D scene (Slice 4), and richer per-NOC PDF extraction (Slice 18).

### Slice 1 — Data ingestion (done)

- `skygauge/scraper/nocas_scraper.py` hits AAI's public `Service.svc/GetNOCASStatusReports` endpoint, handles DMS coordinate parsing, tolerates 503s with tenacity backoff. Pluggable output via `--output excel|csv|supabase`.
- `skygauge/scraper/maitree_scraper.py` pulls Project Maitree's `/heightnoc` page, extracts the inline `locations` (20,820) and `appealCases` (769) JS globals, and writes them through the same `ExcelWriter` for idempotent dedupe.
- `skygauge/data/skygauge_nocs.xlsx` currently holds **11,578 NOCs** with 92 % PDF URL coverage, 90 % permissible-top coverage, 78 % site-elevation coverage. `data/skygauge_nocs_appeals.csv` has 727 appellate cases.
- Schema in `skygauge/db/schema.sql`; airport seed in `skygauge/db/seed_airports.sql`. Supabase not yet provisioned.

### Slice 2 — OLS calculation engine (done)

- TypeScript ES module at `skygauge/api/ols/`. Zero deps. Runs in Deno / Node / browser.
- `types.ts`, `geo.ts`, `ols-config.ts`, `airports.ts`, `surfaces.ts`, `engine.ts`, `footprints.ts`.
- All six ICAO Annex 14 surfaces implemented: Inner Horizontal, Conical, Outer Horizontal, Approach, Take-off Climb, Transitional.
- `computeOLSLimit({lat, lon, elevation_m})` → `{ binding, max_top_amsl_m, max_height_agl_m, all_hits }`.
- 60 unit tests pass (`npm test` in `skygauge/`).
- `npm run validate` benchmarks the engine against ~2 k random NOCs from the workbook; median delta vs. AAI restricted NOCs is ~15 m, vs. unrestricted ~24 m. Worst-case deltas (~±150 m) trace to tall-building approvals above OHS and instrument-procedure restrictions below — not engine bugs. The empirical layer (Slice 14) is what closes that gap.

### Slice 3 — 2D map (done)

- `app/(dashboard)/skygauge/page.tsx` — server-component shell.
- `components/skygauge/skygauge-map.tsx` — dynamic-import wrapper (`ssr: false`).
- `components/skygauge/skygauge-map-inner.tsx` — Leaflet map. Carto tiles, theme-aware. ARP markers, runway centerlines drawn along the canonical `runway.true_bearing` (not threshold-pair geodesic — AIP coords are precise to ±10 m which compounds to ~13° bearing error over 3 km). Approach + take-off trapezoids toggleable via top-right panel. Click handler logs coords.
- Nav entry added to Capital Markets vertical in `components/shared/app-shell.tsx`.
- `tsconfig.json` updated: narrowed the `skygauge` exclude so `skygauge/api/ols/**` is visible, added `allowImportingTsExtensions: true`.

### Slice 5 — Wire engine to map (done)

- `components/skygauge/skygauge-workspace.tsx` — client shell owning the shared state (`site`, place `label`, manual `elevation`). Recomputes `computeOLSLimit` in a memo on any change; map click and Places select feed the same state.
- `components/skygauge/skygauge-search.tsx` — search bar. Google Places Autocomplete (MMR bbox + `strictBounds` + `country: in`) when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set; otherwise falls back to lat/lon paste. Coordinate paste works in both modes. Minimal local typings — no `@types/google.maps` dependency.
- `components/skygauge/skygauge-result-panel.tsx` — binding surface (colour-coded), max top AMSL, manual site-elevation input, AGL headroom, and the next 3–4 most restrictive surfaces with `+Δm` deltas. Handles empty and unconstrained (outside all footprints) states.
- `components/skygauge/skygauge-disclaimer.tsx` — bottom banner citing AAI/NOCAS as the formal source.
- `components/skygauge/surface-meta.ts` — `SurfaceKind` → label/blurb/accent map; accents match the map footprint palette.
- `components/skygauge/skygauge-map-inner.tsx` — selected point is now controlled (`selectedPoint`/`onSelectPoint`); flies to a selection only when it lands off-screen; zoom control moved to bottom-right so the result panel doesn't cover it. Layer toggles unchanged.
- **Elevation is manual-input only in v1.** Bhuvan SRTM DEM lookup is deferred to v2 (see open questions below).

### Slice 14 — Empirical layer (done)

- **Data in Supabase.** `supabase/migrations/0033_skygauge_nocas.sql` provisions PostGIS + the five skygauge tables + three RPCs (`nearby_nocs`, `nearby_appeals`, `noc_neighborhood_stats`) + RLS public-read + the airport seed. Applied to the shared dashboard project (ref `tpjnmvbbyuoivpomdkrh`) via the SQL Editor. Three deliberate changes vs. `db/schema.sql`: `site_elevation_m`/`permissible_top_raw` made NULLABLE (backfill lacks them), trigger namespaced `skygauge_set_updated_at()`, PostGIS schema-qualified to `extensions.*`.
- **Import.** `skygauge/scripts/import_workbook_to_supabase.py` upserts all **11,578 NOCs** from the workbook over PostgREST (idempotent on `noc_id`, batched 500, preserves NULL elevations — unlike the scraper's `SupabaseWriter` which coerced them to 0).
- **Query + API.** `lib/queries/skygauge.ts` (`getNeighborhoodStats`, service client in dev demo / anon+RLS in prod) → `app/api/skygauge/neighborhood/route.ts` (GET, Zod-validated, clamps radius 100–5000 m).
- **Domain logic.** `skygauge/api/empirical/{types,band}.ts` — pure `buildEmpiricalBand(stats, theoreticalAmsl)` computes the recency-weighted median + theoretical-vs-empirical delta.
- **UI.** Result panel gains the blue "Empirical · nearby NOCs" block: median permissible top (m AMSL), sample count, range, % restricted, latest issue, a 500 m / 1 km / 2 km radius toggle, and a colour-coded delta callout (approvals running above/below the OLS ceiling). Warm RPC queries ≈35 ms via the GIST index.
- **Note:** `appeal_count_within_1km` is wired but reads 0 everywhere until Slice 12 populates `appeal_case`.

## What's NOT done (suggested ordering)

| Slice | Description | Why it matters |
|---|---|---|
| 12 | Appellate Committee PDF parser (monthly cron) → populate `appeal_case` | Catches the cases that overrule the standard OLS, and lights up the already-wired `appeal_count` in the empirical panel. The `appeal_case` table + `nearby_appeals` RPC already exist. |
| 4 | Three.js 3D scene showing OLS surfaces around a site | Visual polish; not on the critical path. |
| 18 | Per-NOC PDF letter extraction (owner / address / detailed coords) | Only 7.9 % of records have owner+address today. Phase 2. |

## Recommended next prompt

Paste this into your next Claude Code session:

```
Read @skygauge/HANDOFF.md and @skygauge/README.md, then start Slice 12: the
Appellate Committee PDF parser. Concretely:

1. Build skygauge/scraper/appeals_parser.py — fetch the monthly Appellate
   Committee Meeting Minutes PDFs from nocas2.aai.aero/nocas/AppealProceeding/,
   extract per-case rows (meeting_date, item_no, lat/lon, approved top, decision
   text, pdf_url) into the appeal_case shape. The Maitree backfill already gives
   ~727 historical cases in data/skygauge_nocs_appeals.csv — seed from that first.
2. Import appeal_case rows into Supabase (table + nearby_appeals RPC already
   exist from migration 0033). Mirror import_workbook_to_supabase.py.
3. The empirical panel already reads appeal_count_within_1km — once appeal_case
   has rows it lights up automatically. Optionally surface the nearest few
   appeal cases in the result panel.

State the file list before writing code. Don't touch the OLS engine.
```

## Local dev setup

```bash
cd ~/anex-dashboard-1
npm install                     # if not already done
npm run dev                     # visit http://localhost:3000/skygauge

cd ~/anex-dashboard-1/skygauge
npm install                     # standalone deps for the engine + validator
npm test                        # 60 unit tests
npm run validate                # benchmark engine vs. real NOCs
```

## Open architectural questions

- **Empirical layer location — resolved.** It lives in Supabase PostGIS. Migration `0033` is applied to the shared dashboard project and all 11,578 NOCs are imported. The skygauge tables are namespaced/additive and use RLS public-read (the AAI data is public); they do not touch any dashboard table. If skygauge ever needs isolation from the dashboard DB, the query layer (`lib/queries/skygauge.ts`) is the single swap point.
- **Threshold coordinate refinement.** The AIP-derived thresholds in `db/seed_airports.sql` give bearings 5-15° off from the published `true_bearing`. The engine works around this by anchoring on `true_bearing`, but the seed coords should still be refined against the latest AIP charts before going to production.
- **DEM source for site elevation.** Slice 5 shipped with a manual site-elevation input as the v1 fallback (drives the AGL headroom readout). The automated lookup — Bhuvan India 30 m or NASA SRTM global — is still open and is now a v2 follow-up. Either needs a small server-side proxy because the public Bhuvan API is unreliable from the browser.
