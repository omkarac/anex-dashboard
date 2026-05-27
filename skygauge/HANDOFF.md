# Skygauge — session handoff

> Drop this into the next Claude session via `@skygauge/HANDOFF.md` to pick up where the last one left off. Pair with `skygauge/README.md` and `skygauge/SPEC.md` (if/when it exists) for full context.

## Where we are

Seven slices' worth of work complete. In Supabase (PostGIS): 11,578 NOCs **and** 727 appellate-committee cases. Every analyzed point shows — in 2D and now 3D — the theoretical OLS ceiling, the empirical neighborhood band of real AAI approvals (with the delta called out), and a deep-linked list of nearby appellate cases. The tool delivers its core value end-to-end. Remaining: the *live* monthly appellate PDF cron (the historical seed is in), and richer per-NOC PDF extraction (Slice 18).

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
### Slice 12 — Appellate data (historical seed done; live cron is follow-up)

- **Migration `0034_skygauge_appeals_unique.sql`** — unique index on `appeal_case (noc_id, meeting_date, item_no)` so the seed upserts idempotently. Applied via SQL Editor.
- **`skygauge/scripts/import_appeals_to_supabase.py`** — seeds the **727** historical cases from `data/skygauge_nocs_appeals.csv` (the Maitree `appealCases` extract). Date parse is DD/MM/YY (`10/12/25` → 2025-12-10, confirmed against the PDF filenames); 0 skips.
- **`lib/queries/skygauge.ts` `getNearbyAppeals`** → the `nearby_appeals` RPC; the neighborhood route now returns `{ stats, appeals }` (parallel). The result panel renders an "Appellate cases nearby" list (committee-approved top, meeting month/year, distance, deep-link to the AAI minutes PDF). `appeal_count_within_1km` is now real (e.g. 6 near Chembur, 52 near Juhu).
- **Still open:** the *live* monthly PDF parser (`appeals_parser.py`) that fetches + parses new minutes from `nocas2.aai.aero/.../AppealProceeding/` on a cron. Deferred because it depends on AAI's flaky endpoint + PDF structures that can't be verified offline. The schema, RPC, importer pattern, and UI are all ready for it.

### Slice 4 — 3D scene (done)

- **Approach:** an *engine-driven OLS-ceiling heightfield* rather than an airport panorama. `components/skygauge/scene-geometry.ts` samples `computeOLSLimit` over a 29×29 grid (±1.2 km) around the site and emits typed arrays (positions, per-vertex colours by binding surface, indices) for a `THREE.BufferGeometry`. Reuses the engine — no re-derived surface math.
- **Render:** `skygauge-scene-inner.tsx` (R3F) draws the coloured ceiling surface, the site's buildable massing box, a reference grid, `OrbitControls`, an orientation gizmo, a legend, and an AMSL label. `skygauge-scene.tsx` is the `dynamic(ssr:false)` wrapper so three/R3F never touch SSR or the 2D path.
- **Nearby structures:** issued NOCs (`nearby_nocs` RPC, capped 120) and appellate cases (`nearby_appeals`) are rendered as **procedural building massings** at their true positions — apex height = permissible/approved top AMSL, colour-coded (issued / restricted / appeal). Both the heightfield and the structures go through the single `projectToScene` ENU projection, so distances are calibrated to the coordinates (verified: projection distance == PostGIS `st_distance` to 0.00 m). The neighborhood route returns `{ stats, appeals, nocs }`; the radius toggle controls the scene footprint + which structures are in frame.
- **Building styles:** `components/skygauge/building-geometry.ts` builds 5 unit massings (flat, setback/tiered, tapered, hip-roof low-rise, cylindrical-with-spire) as merged THREE geometries, normalised to base y=0 / apex y=1 for instancing. Style is deterministic per `noc_id` (stable across renders) and height-biased — permits < 22 m get low-rise forms, taller ones get towers. Instanced per style (one `<Instances>` per style, shared material, per-instance scale + colour) so the whole neighbourhood is ~5 draw calls.

### Realism via Google — Phase 1 (Street View) + Phase 2 (3D Tiles) both built

- **Street View companion:** `components/skygauge/skygauge-street-view.tsx` — embeds the Google Maps Embed API panorama at the site, aimed toward the binding airport via `initialBearingDeg`. Free API, graceful fallback when no key. Ground-level only.
- **Photoreal (3D Tiles):** `skygauge-photoreal-inner.tsx` (+ `skygauge-photoreal.tsx` ssr:false wrapper). Built on Google's native **`Map3DElement`** (the `maps3d` library on the Maps JS API, `v=beta`) — Google's own web component for Photorealistic 3D Tiles. Tile streaming, camera, gestures, and AMSL altitudes all live inside Google's code; the React layer just (1) mounts `<gmp-map-3d>` once, (2) recomputes polygon descriptors when site/elevation/data change, and (3) replaces overlay children imperatively. **No third-party tile renderer**, no `.internal` race conditions, no geoid hack — altitudes go in as native AMSL via `altitudeMode = "ABSOLUTE"`.
- **Overlays:** descriptors come from `components/skygauge/photoreal-overlays.ts` (pure, no DOM): a 12×12 OLS-ceiling heightfield as tilted-quad `Polygon3D` cells coloured by binding surface, NOC/appeal pillars as **extruded** `Polygon3D` squares anchored at their permitted top, and a site-massing square at the site's OLS ceiling. Camera `flyCameraTo` on site change keeps the tile cache warm.
- **View toggle is now 4-way:** `2D map / 3D scene / Photoreal / Street view`.
- **Density:** `getNearbyNocs` caps at 400 (Bandra has ~274 within 1 km), `getNearbyAppeals` at 50; photoreal clips structures to the panel radius. Pillar labels (top AMSL) render through `Marker3DElement`.
- **Key + APIs:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local` (gitignored). Enable: **Maps JavaScript API + Places API** (search), **Maps Embed API** (Street View), **Map Tiles API** (+ billing, Photoreal). Browser key → restrict by HTTP referrer + API.
- **Toggle:** a 2D/3D segmented control (top-centre) in `skygauge-workspace.tsx` swaps map ↔ scene; the result panel overlays both. Vertical exaggeration ×4 (labelled) so tens-of-metres height reads against the km footprint.
- **Deps added:** `three`, `@react-three/fiber@9`, `@react-three/drei@10`, `@types/three`.
- **⚠ Gotcha (important for future work):** R3F v9 augments the global `JSX.IntrinsicElements` with three elements (no `className`). Any app component typed as the loose `React.ElementType` and rendered with `className` then collapses to `className: never`. This surfaced 6 pre-existing icon props (app-shell, audit ×2, profile, file-drawer) which were tightened from `React.ElementType` → `LucideIcon`. **If you add a new component prop for an icon/dynamic element, type it as `LucideIcon`/`ComponentType<…>`, not `React.ElementType`.**

## What's NOT done (suggested ordering)

| Slice | Description | Why it matters |
|---|---|---|
| 4-tiles-verify | Visually verify + tune the Photoreal 3D Tiles overlay alignment (NORTH_SIGN, ground datum) | Built but unverified-by-eye. First real-browser pass to confirm tiles load + overlay lines up. |
| 12-live | Live monthly appellate PDF cron parser → keep `appeal_case` fresh | Historical seed is in; this keeps it current. Needs the AAI PDF endpoint. |
| 18 | Per-NOC PDF letter extraction (owner / address / detailed coords) | Only 7.9 % of records have owner+address today. Phase 2. |
| — | PDF report generation | Noted earlier; nice-to-have once the above land. |

## Recommended next prompt

Paste this into your next Claude Code session:

```
Read @skygauge/HANDOFF.md and @skygauge/README.md, then start Slice 18: per-NOC
PDF letter extraction. Concretely:

1. Build skygauge/scraper/noc_pdf_parser.py — for NOCs whose pdf_url is set but
   owner_name/site_address are empty (~92% of records), fetch the AAI NOC letter
   PDF and extract owner, address, and detailed coordinates.
2. Backfill noc_issued.owner_name / site_address / sacfa_id via an idempotent
   updater (mirror import_workbook_to_supabase.py; update-by-noc_id).
3. Surface owner/address in the result panel's nearby-NOC context where present.

Be resilient to missing/garbled PDFs (log + skip). State the file list first.
Don't touch the OLS engine or the 3D scene.
```

(Alternatively, knock out **Slice 12-live** — the monthly appellate cron — first;
the schema/RPC/UI are already in place for it.)

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
- **Site elevation — resolved (Google Elevation API).** Auto-fetched on site select via the client-side `google.maps.ElevationService` (`getGoogleElevation` in `components/skygauge/google-maps-loader.ts`), which populates the elevation field and the AGL headroom. The manual input remains as an override (the panel badges the source: `auto · Google` / `manual` / `fetching…`). Client-side service is used (not the web service) so it survives HTTP-referrer key restriction. Bhuvan/NASA SRTM no longer needed.
