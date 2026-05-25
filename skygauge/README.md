# Skygauge

A pre-NOCAS height permissibility tool for the Mumbai Metropolitan Region.

> *Measure the sky before you build into it.*

Given a coordinate or locality, the engine returns:
- The **theoretical** maximum permissible top elevation derived from ICAO Annex 14 Obstacle Limitation Surfaces (OLS) for CSMIA, Juhu, and Navi Mumbai airports
- The **empirical** band of recently approved NOCs in the neighborhood (median, range, recency-weighted)
- The delta between the two — the actionable insight
- Nearby issued NOCs and appellate-committee cases with deep-links to the original AAI PDFs
- 2D map, 3D scene, and ground-level Street View renderings of the constraint at that location
- A downloadable PDF report

The tool is indicative only. Formal sanction is issued by AAI through the NOCAS portal.

## Architecture

Three tiers plus an offline ingestion pipeline:

- **Frontend** (Vercel) — React + Next.js, Leaflet 2D map, Three.js 3D scene, Google Street View Embed for POV, Google Places Autocomplete for search
- **Backend** (Supabase Edge Functions, TypeScript/Deno) — `/analyze` endpoint that fans out OLS calculation + empirical analysis + report assembly
- **Data** (Supabase Postgres + PostGIS) — issued NOCs, appeal cases, airport metadata, scrape logs; GIST spatial indexes for sub-50ms neighborhood queries
- **Ingestion** (GitHub Actions cron, Python) — daily NOCAS scraper hitting AAI's public endpoint, monthly Appellate Committee Meeting PDF parser

Everything in the v1 stack is on free tiers. Cost ramps only when traffic or storage justify it.

## Repo layout

```
skygauge/
├── db/
│   ├── schema.sql           # PostgreSQL+PostGIS DDL
│   └── seed_airports.sql    # MMR airport configuration (ARP, runways, elevation)
├── scraper/
│   ├── nocas_scraper.py     # AAI NOCAS daily scraper
│   ├── appeals_parser.py    # Monthly Appellate Committee PDF parser (stub for now)
│   ├── requirements.txt
│   └── .github/
│       └── workflows/
│           └── scrape.yml   # GitHub Actions cron schedule
├── api/                     # Supabase Edge Functions (week 2)
├── web/                     # React frontend (week 3)
└── docs/
    └── architecture.md
```

## Current status — Week 1

- [x] DB schema + airport seed data
- [x] AAI NOCAS scraper (Python)
- [x] Output writers: Excel (.xlsx), CSV, Supabase — pick via `--output` flag
- [x] Manual refresh trigger: scrape_log tracking, GitHub workflow_dispatch, edge function, admin HTML panel
- [x] Project Maitree backfill scraper (richer snapshot: elevation + PDF URLs)
- [x] Full historical backfill via Maitree (11,578 NOCs seeded with elevation + PDFs)
- [x] OLS calculation engine (theoretical layer; all six ICAO Annex 14 surfaces)
- [x] 2D map wired to the engine — search (Google Places / lat-lon paste), click-to-analyze, result panel (binding surface, max top AMSL, AGL headroom from manual site elevation), AAI disclaimer
- [x] NOCs loaded into Supabase PostGIS (11,578 records; migration `0033`, GIST spatial index)
- [x] Empirical-analysis layer — neighborhood median permissible top (recency-weighted), range, % restricted, and the theoretical-vs-empirical delta, surfaced in the result panel with a radius toggle
- [x] Appellate cases — 727 historical committee cases seeded (`appeal_case`); nearby cases shown in the panel with deep-links to AAI minutes PDFs
- [x] 3D scene (React Three Fiber) — engine-driven OLS-ceiling heightfield, the site's buildable massing, and nearby NOC/appeal structures as procedural buildings; surfaces colour-coded by binding type
- [x] Street View companion — Google Maps Embed panorama of the site (view mode), aimed at the binding airport
- [x] Photorealistic 3D Tiles overlay — Google Earth city mesh re-centred on the site (`3d-tiles-renderer`), with the OLS ceiling + structures at real-world scale (4th view mode); pending an in-browser alignment check
- [ ] Live monthly appellate PDF cron parser (`appeals_parser.py`) — historical seed is in; this keeps it fresh
- [ ] Per-NOC PDF letter extraction (owner / address / detailed coords)
- [x] Auto site elevation via Google Elevation API (client-side ElevationService); auto-fills AGL headroom, manual override retained
- [ ] Edge function for `/analyze`
- [ ] PDF report generation

## Maitree backfill — the fastest path to a complete dataset

AAI's public listing endpoint silently drops `SiteElevation` and the PDF URL
for every record. Project Maitree's `/heightnoc` page server-renders an older
snapshot of the same AAI data with both fields populated — so we use Maitree
once for the historical bulk seed, then `nocas_scraper.py` for incremental
daily deltas going forward. The Excel writer dedupes on `noc_id`, so the
two sources merge cleanly.

```bash
cd ~/anex-dashboard-1/skygauge
python3 -m venv .venv && source .venv/bin/activate    # if not already done
pip install -r scraper/requirements.txt

# One-shot: fetch Maitree's ~8.7 MB page, extract both arrays, write to Excel.
# Expect ~11,500 NOCs (JUHU + SNCR; no NMIA yet) + ~770 appeal cases.
# Runtime: ~10-20s total (one HTTPS request + local parse).
python scraper/maitree_scraper.py \
  --output excel:./data/skygauge_nocs.xlsx \
  --verbose
```

Outputs land in two places:

- `./data/skygauge_nocs.xlsx` — same workbook the AAI scraper writes to.
  New records get `trigger_source = "maitree_seed"` in the `scrape_log`
  sheet so you can tell the bulk seed apart from later daily deltas.
- `./data/skygauge_nocs_appeals.csv` — appellate cases sidecar (writer
  protocol doesn't yet support an appeals sheet directly; folded in later).

After this seeds the workbook, run `nocas_scraper.py` from the last
Maitree snapshot date forward — it'll pick up new NOCs without
re-downloading the historical batch:

```bash
python scraper/nocas_scraper.py \
  --all-mmr \
  --from $(date -v-180d +%Y-%m-%d) --to $(date +%Y-%m-%d) \
  --output excel:./data/skygauge_nocs.xlsx \
  --trigger-source delta \
  --delay 5 --verbose
```

## Local backfill to Excel — recommended first run

No Supabase setup needed. The scraper writes a multi-sheet `.xlsx` file you can
open in Excel/Numbers and pivot immediately.

```bash
cd ~/anex-dashboard-1/skygauge
python3 -m venv .venv && source .venv/bin/activate
pip install -r scraper/requirements.txt

# Smoke test — single airport, single quarter, single structure type.
# Should land ~50-200 records and prove the AAI response shape matches our parser.
python scraper/nocas_scraper.py \
  --airport 15 --structure B \
  --from 2024-10-01 --to 2024-12-31 \
  --output excel:./data/skygauge_nocs.xlsx \
  --verbose

# If smoke test looks clean, run the full MMR backfill from earliest available.
# Expect ~18,000-22,000 records, ~60-120 minutes wall-clock at 5s delay.
python scraper/nocas_scraper.py \
  --all-mmr \
  --from 2016-01-01 --to $(date +%Y-%m-%d) \
  --output excel:./data/skygauge_nocs.xlsx \
  --trigger-source backfill \
  --delay 5 --verbose
```

The workbook has three sheets:

- **nocs** — every issued NOC (noc_id, airport_code, lat/lon, site_elevation,
  permissible_top, is_restricted, structure_type, issue_date, pdf_url, ...)
- **scrape_log** — one row per (airport × structure × window) with timing,
  records added, and status. Filter by `status = 'failed'` to find windows
  worth re-running.
- **airports** — MMR airport reference (ARP coordinates, elevation, AAI ID).

The file is **idempotent** — re-running the same scrape will skip records
already present (deduped by `noc_id`), so it's safe to interrupt and resume.

When you're ready to move from Excel to Supabase, run Supabase's CSV Import
in the Table Editor for `nocs`, or use the schema's `--output supabase` mode
from then on. The column names match the table schema 1:1 for a clean import.

### Other output modes

```bash
# Plain CSV (no scrape_log, no airports sheet, just nocs as a single file)
python scraper/nocas_scraper.py --all-mmr --output csv:./data/skygauge_nocs.csv ...

# Supabase (production target). Requires SUPABASE_URL + SUPABASE_KEY env vars.
export SUPABASE_URL='https://your-project.supabase.co'
export SUPABASE_KEY='your-service-role-key'
python scraper/nocas_scraper.py --all-mmr --output supabase ...

# Auto (default if --output omitted): Supabase if env vars set, else Excel.
python scraper/nocas_scraper.py --all-mmr ...
```

## Manual refresh — how the Refresh button works

Same scraper, same workflow, same database — just a different trigger path.

```
admin panel  →  POST /functions/v1/admin-trigger-scrape   (with X-Admin-Token)
            →  edge function generates tracking_id (UUID)
            →  edge function POSTs to GitHub workflow_dispatch with inputs
                { mode, tracking_id, from_date?, to_date?, airport? }
            →  GitHub Actions runs scrape.yml — same workflow as the cron
            →  scraper runs with --tracking-id <UUID> --trigger-source manual_*
            →  every (airport × structure × window) → one scrape_log row
                tagged with that tracking_id
            →  admin panel subscribes to Supabase Realtime on scrape_log
                filtered by tracking_id and shows rows appearing live
```

### Setup

1. Create a fine-grained GitHub Personal Access Token scoped to this repo with `actions:write` permission only.
2. Deploy the edge function:
   ```
   supabase functions deploy admin-trigger-scrape
   supabase secrets set \
       GITHUB_TOKEN=<your_pat> \
       GITHUB_OWNER=<your_username_or_org> \
       GITHUB_REPO=mmr-height-estimator \
       GITHUB_WORKFLOW_FILE=scrape.yml \
       ADMIN_TOKEN=<generate_a_random_secret>
   ```
3. Open `web/admin/refresh.html` (host it on Vercel or open as a local file). In the connection-settings card, paste your Supabase URL, anon key, edge function URL, and the admin token you set above. Save.
4. Pick a mode (Quick / Standard / Deep / Custom) and click **Refresh now**.

### What you see

- The button dispatches the workflow and shows a tracking ID.
- The progress card subscribes via Supabase Realtime; each (airport × structure × window) row appears as the scraper completes it, with the record count and duration.
- When all rows finish, the freshness card refreshes — per-airport "X min ago" stamps with a fresh / recent / stale badge.
- The recent-runs table logs your last 10 manual refreshes for audit.

### Modes

| Mode             | Date window       | Typical duration | When to use |
|------------------|-------------------|------------------|-------------|
| Quick            | Last 30 days      | ~10 min          | After spotting stale data on the live UI |
| Standard         | Last 90 days      | ~25 min          | Catch-up after a missed cron night |
| Deep             | Last 365 days     | ~60 min          | After AAI fixes their endpoint following an outage |
| Custom           | Picked date range | varies           | Investigating a specific historical gap or single-airport sync |

Manual runs are tagged `trigger_source = manual_*` in `scrape_log` so the admin dashboard can separate them from the daily/weekly cron runs.

## OLS engine — the theoretical layer

`api/ols/` is a zero-dependency TypeScript module that, given a (lat, lon,
site_elev) tuple, returns the maximum permissible top elevation derived from
ICAO Annex 14 obstacle limitation surfaces across CSMIA, Juhu, and NMIA.

```typescript
import { computeOLSLimit } from "./api/ols/engine.ts";

const r = computeOLSLimit({ lat: 19.066, lon: 72.868, elevation_m: 8.5 });
// → { binding: { surface: "approach", airport_code: "VABB", … },
//     max_top_amsl_m: 67.8, max_height_agl_m: 59.3, all_hits: [...] }
```

The engine evaluates six surfaces per airport — Inner Horizontal, Conical,
Outer Horizontal, Approach (×2 per runway), Take-off Climb (×2), Transitional —
and returns the binding (lowest) constraint. Pure functions, runs in Deno /
Node / browser without modification.

```bash
cd ~/anex-dashboard-1/skygauge
npm install
npm test          # 53 unit tests covering geo helpers + each surface + engine
npm run validate  # benchmark against 500 random NOCs from skygauge_nocs.xlsx
```

### What the validator tells us

Running `npm run validate -- --sample 2000` against the historical workbook
shows the engine matches AAI's actual NOCs to within `|Δ| ≈ 15 m` median for
restricted NOCs, and `|Δ| ≈ 24 m` for unrestricted. The biggest deltas come
from two well-understood causes that are *not* engine bugs:

1. **Tall buildings approved above OHS** (Δ ≈ −150 m). AAI grants relief
   above the geometric OLS ceiling on a case-by-case basis for high-rises
   (World One, etc.). Our engine correctly says "OHS would cap at 161 m" —
   the case-by-case approval is invisible to a pure-OLS calculation.
2. **Sites restricted below OLS by instrument procedures** (Δ ≈ +130 m).
   Some NOCs are capped well below the surfaces would suggest, because of
   approach procedure obstacle assessments not encoded in Annex 14 shapes.

Both are exactly what the *empirical* layer (median permissible top by
neighborhood, built from the 11.5k historical NOCs) is meant to surface.
The engine gives the theoretical ceiling; the empirical band gives the
actual operating reality; the delta between them is the actionable insight.

## Quick start (local dev)

1. Create a Supabase project at https://supabase.com (free tier)
2. In the SQL editor, run `db/schema.sql` then `db/seed_airports.sql`
3. Copy your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from project settings
4. Install scraper deps: `pip install -r scraper/requirements.txt`
5. Run a small test scrape:
   ```bash
   export SUPABASE_URL=https://your-project.supabase.co
   export SUPABASE_KEY=your-service-role-key
   python scraper/nocas_scraper.py --airport 15 --from 2024-01-01 --to 2024-03-31 --structure B
   ```
6. Confirm rows appear in `noc_issued` table via Supabase Table Editor

## Data sources

- **AAI NOCAS issued NOCs**: `POST https://nocas.aai.aero/nocas/Services/Service.svc/GetNOCASStatusReports`
- **AAI Appellate Committee proceedings**: monthly PDFs at `https://nocas2.aai.aero/nocas/AppealProceeding/`
- **DEM** for site elevation: Bhuvan SRTM-derived raster (India) or NASA SRTM 30m global

## Legal note

All ingested data is public. The tool is an aggregation and analysis layer over publicly published AAI records, with attribution and links back to the source documents. We do not republish raw datasets; we surface derived insights. Per AAI's own disclaimer, the formal sanction is issued through the NOCAS portal — this tool is for pre-application planning.
