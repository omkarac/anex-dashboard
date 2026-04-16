# Claude Code Session Prompts

> Copy-paste these into Claude Code at the start of each session. They're deliberately short — the heavy context lives in `SPEC.md` and `CLAUDE.md` in the repo.

---

## Session 0 — Bootstrap the repo

```
Read CLAUDE.md and SPEC.md (sections 1, 2, 2.1, 8, 10).

Execute Slice 0 from SPEC §10:
- Initialize Next.js 15 with TypeScript, App Router, Tailwind, ESLint
- Add shadcn/ui, install button/input/dropdown-menu/dialog/sheet/table/badge/tooltip/toast/sonner/select/checkbox/form/label/separator/tabs/card
- Install: @supabase/supabase-js, @supabase/ssr, zod, react-hook-form, @hookform/resolvers, @tanstack/react-table, lucide-react, date-fns
- Create Supabase clients per SPEC §8 directory structure
- Implement /login page per SPEC §2.1: single "Sign in with Microsoft" button + "Keep me signed in for 30 days" checkbox
- Implement /auth/callback route handler that: exchanges code, looks up team_members by email, auto-provisions as 'member' if absent, blocks if is_active=false, sets persistent cookie iff "keep signed in" was checked (30-day refresh token TTL)
- Implement middleware.ts per SPEC §2.1: guard all routes except /login and /auth/callback; redirect on missing/inactive session
- Implement AppShell (sidebar with links to /, /assets, /developers, /logs, /team; top bar with user menu including Sign out)
- Scaffold empty pages for all 5 routes
- Add .env.example with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- Write docs/AUTH_SETUP.md with the manual Azure AD + Supabase steps from SPEC §2.1 "Setup prerequisites"
- Seed script: insert team_members row for omkar.chaudhari@anexadvisory.com with role='admin', is_active=true (auth.users entry will be created on first login; seed uses a known UUID and the trigger on auth.users linking is handled on first login by an upsert in /auth/callback)

End state: I can complete Azure AD setup via the docs, log in with my @anexadvisory.com Microsoft account, see the shell, click between routes. No business data yet.

Show me the file tree, any decisions you made, and paste the contents of docs/AUTH_SETUP.md so I can follow it.
```

---

## Session 1 — Asset Registry (read-only)

```
Read CLAUDE.md. Read SPEC.md §3, §4, §5.1, §5.2, §5.3, §7.2, §9.

Execute Slice 1:
- Write migration 0001_initial: enums + team_members + assets + indexes + RLS policies per §5.3
- Add a seed script with 5 fake assets and 2 fake team_members (one admin, one member)
- Create /lib/schemas/asset.ts with Zod schemas and inferred types
- Create /lib/enums/asset.ts with values + labels + badge colors for status, temperature, asset_type
- Create /lib/queries/assets.ts with listAssets(filters) and getAssetById(id)
- Build /assets page: TanStack Table with all columns from §7.2, server-side data, filter dropdowns (NO range sliders yet — slice 2)
- Build /assets/[id] page: read-only left column from §7.3

End state: I can browse seeded assets, filter by status/temperature/type, click a row and see detail.
```

---

## Session 2 — Asset CRUD + status pipeline

```
Read CLAUDE.md. Read SPEC.md §3.2, §4.1, §5.4, §6, §7.2 (inline edits + bulk actions), §7.3 (edits).

Execute Slice 2:
- Migration 0002: add triggers (set_updated_at, validate_status_transition, log_asset_status_change, prevent_hard_delete on activity_logs)
- /lib/actions/_base.ts: withAudit wrapper per SPEC §6
- /lib/actions/assets.ts: createAsset, updateAssetField, updateAssetStatus, updateAssetTemperature, softDeleteAsset (admin only)
- Asset create form in a Sheet, triggered from /assets "+ New Asset"
- Inline edit on status/temperature/next_step in the table
- Status change dialog: requires a note
- Range slider filters for numeric fields (use shadcn Slider)
- Admin role check wired via /lib/rbac

End state: I can create an asset, change its status through valid transitions, get blocked on invalid ones, override as admin, soft-delete as admin.
```

---

## Session 3 — Tasks + Updates + History

```
Read CLAUDE.md. Read SPEC.md §5.1 (tasks, updates, status_history), §7.3 (tabs 1-5).

Execute Slice 3:
- Migration 0003: tasks, updates, status_history (if not in 0001)
- Schemas, enums, queries, actions for tasks and updates (all with withAudit)
- /assets/[id] middle column with 5 tabs (Updates, Tasks, Shares placeholder, History, Activity)
- Tasks tab: inline create + list + toggle status + assign to team member
- Updates tab: textarea add + timeline list + soft delete by author or admin
- History tab: read status_history for this asset
- Activity tab: read activity_logs filtered to this asset

End state: full asset detail page works except Shares tab (next slice).
```

---

## Session 4 — Developers + Shares

```
Read CLAUDE.md. Read SPEC.md §5.1 (developers, developer_shares), §7.4.

Execute Slice 4:
- Migration 0004: developers, developer_shares
- Schemas, queries, actions (with withAudit)
- /developers page with List view + Share view toggle
- Create developer form
- "Share with developer" dialog on asset detail → creates developer_share + sets asset status to shared_with_developer
- Shares tab on asset detail populated

End state: I can add developers, share assets, see shares per developer and per asset.
```

---

## Session 5 — Engagements (conversion)

```
Read CLAUDE.md. Read SPEC.md §3.2, §5.1 (engagements), §7.3 (conversion dialog).

Execute Slice 5:
- Migration 0005: engagements table + converted_to_engagement_id FK on assets
- Schemas, queries, actions (with withAudit)
- "Convert to Mandate / PMC-PMAS" button on asset detail, visible when moving to won
- Conversion dialog: kind, started_at, notes → creates engagement + sets asset.status=won + sets converted_to_engagement_id
- Right column on asset detail shows engagement info when present
- Unwind conversion (admin only): sets converted_to_engagement_id=null, ends engagement with ended_at

End state: I can convert won assets into Mandates or PMC engagements, see them linked, and unwind as admin.
```

---

## Session 6 — Activity Logs page

```
Read CLAUDE.md. Read SPEC.md §5.1 (activity_logs), §5.4 (prevent_hard_delete), §7.5.

Execute Slice 6:
- /logs page with filters from §7.5, paginated
- softDeleteLog action: sets deleted_at, deleted_by, delete_reason; also creates a new log with action='delete_log' pointing at the deleted log
- "Show deleted" toggle (admin only)

End state: logs are browsable, filterable, and I can soft-delete with a reason; a meta-log records that.
```

---

## Session 7 — Dashboard widgets

```
Read CLAUDE.md. Read SPEC.md §7.1.

Execute Slice 7:
- Home page with all widgets from §7.1
- Each widget is its own server component with its own query
- Use shadcn Card primitives; recharts for the funnel bar chart
- 30s cache via Next revalidate

End state: the homepage gives me a real-time-ish view of the whole pipeline.
```

---

## Session 8 — Excel import

```
Read CLAUDE.md. Read SPEC.md §10 Slice 8 + all of ENUM_MAPPING.md.

Execute Slice 8:
- Install sheetjs (xlsx)
- Create scripts/import-assets.ts:
  - Reads --file arg (xlsx path)
  - Reads "Data Dump" sheet with header row 3
  - Applies ALL mappings from ENUM_MAPPING.md
  - --dry-run writes import-report.json, creates nothing
  - Real run: inserts in a single transaction, writes one bulk_import activity log
- Create import_staging table migration for flagged rows
- npm script: "import:assets": "tsx scripts/import-assets.ts"

Run the dry run against the provided Excel. Show me the import-report.json summary before I greenlight the real import.
```

---

## Session 9 — Team management

```
Read CLAUDE.md. Read SPEC.md §7.6.

Execute Slice 9:
- /team page (admin only guard)
- List team_members with role, is_active, workload (count of open tasks + assets they SPOC for)
- Invite flow: create team_member with email, send Supabase magic link
- Change role, deactivate

End state: admin can invite the rest of the team.
```

---

## Generic bug-fix session

```
Read CLAUDE.md.

Bug: <describe>
Expected: <what should happen>
Actual: <what happens>
Repro: <minimal steps>

Follow the bug-fix rules in CLAUDE.md "When asked to fix a bug". Root cause, not symptom. Show me the diagnosis before the fix if the root cause is unclear.
```
