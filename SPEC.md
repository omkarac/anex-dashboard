# Anex Dashboard — Master Specification

> **This is the single source of truth.** All code must conform to this document. If a requirement conflicts with code, the spec wins and the code changes. If reality conflicts with the spec, update the spec first, then the code.

---

## 1. Product Summary

Anex Dashboard is an internal project-management tool for Anex. It tracks real-estate opportunities ("assets") through evaluation → conversion (into Mandates / PMC-PMAS engagements) or sharing with external developers. Inspired by ClickUp but scoped tightly to Anex's actual workflow.

**Primary users:** Anex internal team only (single org). Microsoft/Outlook OAuth login via Supabase Auth, locked to the Anex Azure AD tenant. No other login method.

**First admin:** `omkar.chaudhari@anexadvisory.com` (seeded in Slice 0).

**Non-goals:**
- No external/client-facing views
- No deep customization of statuses or fields by end users
- No mobile-specific UI (responsive web is enough)
- No granular RBAC beyond `admin` / `member`
- No email/password fallback login — Azure AD is the only way in

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript | Server components = less client JS, colocated server actions |
| Styling | Tailwind CSS + shadcn/ui | Consistent, copy-paste components we own |
| Tables | TanStack Table | Handles filtering, sorting, 1000s of rows |
| Forms | react-hook-form + Zod | Same schema on client + server |
| DB | Supabase (Postgres) | RLS, realtime, one-command migrations |
| Auth | Supabase Auth + Azure AD OAuth (single-tenant) | Tenant-restricted login enforced by Microsoft |
| Hosting | Vercel | Zero-config for Next.js |
| Validation | Zod (shared schemas in `/lib/schemas/`) | One schema drives DB insert validation, form validation, and TS types |

---

## 2.1 Authentication & Session

### Provider

Supabase Auth with **Microsoft/Azure AD OAuth** as the sole provider. Configured as single-tenant against Anex's Azure AD tenant. No email/password, no magic link, no Google/GitHub.

**Consequence of single-tenant:** Microsoft itself rejects any login attempt from accounts outside `@anexadvisory.com` before the OAuth callback even hits our app. We do not need app-level domain filtering — it's enforced upstream.

### Setup prerequisites (manual, one-time)

These happen in Azure Portal + Supabase Dashboard, not in code. Document them in `docs/AUTH_SETUP.md` during Slice 0:

1. Azure AD app registration under Anex tenant, "Single tenant" option
2. Redirect URI: `https://<project>.supabase.co/auth/v1/callback`
3. API permissions: `openid`, `email`, `profile`, `User.Read`
4. Client secret generated, stored in Supabase → Auth → Providers → Azure
5. Supabase Auth: disable Email provider, enable Azure, paste tenant ID + client ID + client secret

### Login page (`/login`)

- Single "Sign in with Microsoft" button, Anex branding.
- Checkbox: **"Keep me signed in for 30 days"** (unchecked by default).
- No other fields.
- On successful OAuth callback:
  - Look up `team_members` by email.
  - If found and `is_active = true` → proceed, set session cookie.
  - If found and `is_active = false` → sign out, show "Account deactivated".
  - If not found → auto-provision as `member` with `full_name` from OAuth profile, `is_active = true`. (Admins can deactivate later.) First login by `omkar.chaudhari@anexadvisory.com` is special-cased in the seed to get `role = admin`.

### Session duration

- **Default (unchecked):** session cookie expires when browser closes. Short refresh token TTL (~1 hour JWT).
- **"Keep me signed in" checked:** persistent cookie, refresh token TTL = **30 days**. Sliding window — every request within the 30 days extends it.
- Store the "keep signed in" preference as a signed cookie read by middleware at auth time; it controls whether Supabase's session is written with a long-lived refresh token.

### Middleware

`/middleware.ts` guards all routes except `/login` and `/auth/callback`:
- If no session → redirect to `/login`.
- If session but `team_members.is_active = false` → sign out, redirect to `/login?error=deactivated`.
- If session and active → attach `user` and `team_member` context for server components via `/lib/supabase/server.ts`.

### Sign out

Sign out button in user menu → clears Supabase session + our "keep signed in" cookie → redirects to `/login`.

### What we never do

- Store OAuth tokens in JS-accessible storage (always httpOnly cookies via `@supabase/ssr`).
- Expose the Azure client secret to the browser.
- Check domain at the app level — that's Azure AD's job (and we trust it).
- Allow the auto-provisioning code to grant `admin` role to anyone other than the seeded first admin.

---

## 3. Core Domain Model

### 3.1 Entities

```
User (auth.users) ── 1 ── TeamMember
                              │
                              ├─ creates ──> Asset
                              ├─ assigned ──> Task
                              ├─ shares ──> DeveloperShare
                              └─ actor ──> ActivityLog

Asset ── 1:N ──> StatusHistory
      ── 1:N ──> Task
      ── 1:N ──> Update (comments/notes)
      ── 1:N ──> DeveloperShare
      ── 1:1 ──> Engagement  (only if converted)

Developer ── 1:N ──> DeveloperShare

ActivityLog ── polymorphic ──> any entity
```

### 3.2 The Conversion Rule (critical)

When an asset's status moves to `Won`:
- The asset record itself **stays the same asset** (one row, full history preserved).
- An `engagement` record is created (kind = `Mandate` or `PMC_PMAS`, chosen at conversion time).
- The asset gets `converted_to_engagement_id` set.
- The asset's status shows as `Won` AND it's linked to an engagement — both are true simultaneously.

There is no duplicate asset. There is no separate "Mandates table that forgets where it came from."

---

## 4. Canonical Enums

These are locked. The UI never shows anything outside these. Import layer normalizes Excel variants to these.

### 4.1 AssetStatus (pipeline)

| Value | Meaning |
|---|---|
| `new` | Just entered, not yet touched |
| `initial_assessment` | One-pager / first look being done |
| `evaluating` | Full feasibility in progress |
| `evaluated` | Feasibility complete, decision pending |
| `shared_with_developer` | Passed to external developer for pursuit |
| `on_hold` | Paused, to be revived later (maps "Slow Cooking", "To be revived", "Feasibility Done On HOLD") |
| `won` | Converted — has an engagement record |
| `dropped` | Not pursuing (maps "Dropped", "Droppped", "Closed", "Not Active") |

**Pipeline rules (enforced for `member`, overridable by `admin`):**

```
new → initial_assessment → evaluating → evaluated
                                           ├→ shared_with_developer → won | dropped | on_hold
                                           ├→ won
                                           ├→ dropped
                                           └→ on_hold

on_hold ↔ any non-terminal status (admins can revive to any state)
dropped → any status  (admin only, for reviving dropped opportunities)
won → any status      (admin only, for unwinding a conversion)
```

### 4.2 AssetTemperature (separate from status)

| Value | Meaning |
|---|---|
| `hot` | Actively being pushed, high priority |
| `warm` | Live, normal attention |
| `cold` | Low activity, monitored |
| `none` | Not classified (default for dropped/won) |

Temperature is orthogonal to status. Any active asset can be Hot/Warm/Cold.

### 4.3 AssetType

`redevelopment`, `outright`, `jv_jd`, `sra`, `mhada_redevelopment`, `open_land`, `funding`, `other`

(Maps all the "Outright / JV", "JV/JD", "Redevelopment ", "Property Outright", etc. variants.)

### 4.4 EngagementKind

`mandate`, `pmc_pmas`

### 4.5 TaskStatus

`todo`, `in_progress`, `blocked`, `done`, `cancelled`

### 4.6 TaskPriority

`low`, `medium`, `high`, `urgent`

### 4.7 Regulation (dropdown, curated list)

From Excel analysis, proposed canonical list:
`33(5)`, `33(7)`, `33(7B)`, `33(9)`, `33(10)`, `33(11)`, `33(12B)`, `33(19)`, `33(20B)`, `30(A)`, `17(1)`, `AR`, `UDCPR`, `UDCPR_plotted`, `to_be_evaluated`, `other`

Stored as a **multi-select** (array) because many assets use combinations (e.g., "33(7B)+33(20B)+33(12B)"). Free-text notes field for edge cases.

### 4.8 Role

`admin`, `member`

---

## 5. Database Schema

### 5.1 Tables

```sql
-- Users are in auth.users (Supabase). team_members extends them.
team_members (
  id              uuid primary key references auth.users(id),
  full_name       text not null,
  email           text not null unique,
  role            role_enum not null default 'member',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
)

developers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  contact_person  text,
  contact_email   text,
  contact_phone   text,
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid references team_members(id)
)

assets (
  id                          uuid primary key default gen_random_uuid(),
  -- Identity
  property_name               text not null,
  location                    text,
  -- Classification
  status                      asset_status_enum not null default 'new',
  temperature                 asset_temperature_enum not null default 'none',
  asset_type                  asset_type_enum,
  -- Sourcing
  spoc_agent                  text,             -- free text for now (messy names)
  resource                    text,             -- maps "Rescource" column
  handover_notes              text,             -- maps "Handover" column
  -- Feasibility numbers
  plot_size_sqm               numeric(14,2),
  fsi_potential               numeric(8,3),
  regulations                 text[] default '{}',  -- canonical values from §4.7
  regulation_notes            text,
  development_potential_sqm   numeric(14,2),
  rehab_area_sqm              numeric(14,2),
  sale_area_sqm               numeric(14,2),
  sale_rate_psf               numeric(14,2),
  initial_investment_cr       numeric(14,2),   -- in crores
  profit_cr                   numeric(14,2),
  topline_cr                  numeric(14,2),
  -- Workflow
  next_step                   text,
  -- Conversion (only set when status = 'won')
  converted_to_engagement_id  uuid references engagements(id),
  -- Meta
  created_at                  timestamptz not null default now(),
  created_by                  uuid not null references team_members(id),
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references team_members(id),
  deleted_at                  timestamptz,      -- soft delete
  deleted_by                  uuid references team_members(id)
)

engagements (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references assets(id),
  kind            engagement_kind_enum not null,  -- mandate | pmc_pmas
  started_at      date not null default current_date,
  ended_at        date,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid not null references team_members(id)
)

status_history (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references assets(id),
  from_status     asset_status_enum,
  to_status       asset_status_enum not null,
  from_temperature asset_temperature_enum,
  to_temperature   asset_temperature_enum,
  note            text,
  changed_by      uuid not null references team_members(id),
  changed_at      timestamptz not null default now()
)

tasks (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references assets(id),
  title           text not null,
  description     text,
  status          task_status_enum not null default 'todo',
  priority        task_priority_enum not null default 'medium',
  assigned_to     uuid references team_members(id),
  due_date        date,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid not null references team_members(id),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  deleted_by      uuid references team_members(id)
)

updates (
  -- per-asset timeline comments (the "Latest update" column, one row each)
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references assets(id),
  body            text not null,
  created_at      timestamptz not null default now(),
  created_by      uuid not null references team_members(id),
  deleted_at      timestamptz,
  deleted_by      uuid references team_members(id)
)

developer_shares (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references assets(id),
  developer_id    uuid not null references developers(id),
  shared_at       timestamptz not null default now(),
  shared_by       uuid not null references team_members(id),
  outcome         text,  -- free text: "interested", "passed", "pursuing", etc. (v2 can enum)
  outcome_at      timestamptz,
  notes           text,
  deleted_at      timestamptz,
  deleted_by      uuid references team_members(id),
  unique (asset_id, developer_id)  -- can't share same asset with same dev twice while active
)

activity_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references team_members(id),  -- null if system
  action          text not null,            -- 'create' | 'update' | 'delete' | 'status_change' | 'share' | ...
  entity_type     text not null,            -- 'asset' | 'task' | 'developer_share' | ...
  entity_id       uuid not null,
  summary         text not null,            -- human-readable: "Status changed from Evaluating to Won"
  diff            jsonb,                    -- { before: {...}, after: {...} } for field changes
  created_at      timestamptz not null default now(),
  -- Soft delete of the LOG ENTRY itself
  deleted_at      timestamptz,
  deleted_by      uuid references team_members(id),
  delete_reason   text
)
```

### 5.2 Indexes

```sql
create index on assets (status) where deleted_at is null;
create index on assets (temperature) where deleted_at is null;
create index on assets (created_by);
create index on assets (converted_to_engagement_id);
create index on tasks (assigned_to) where deleted_at is null;
create index on tasks (asset_id) where deleted_at is null;
create index on status_history (asset_id, changed_at desc);
create index on updates (asset_id, created_at desc) where deleted_at is null;
create index on developer_shares (asset_id) where deleted_at is null;
create index on developer_shares (developer_id) where deleted_at is null;
create index on activity_logs (entity_type, entity_id, created_at desc);
create index on activity_logs (actor_id, created_at desc);
create index on activity_logs (created_at desc) where deleted_at is null;
```

### 5.3 Row Level Security

**Principle:** All reads/writes by authenticated team members. Admins can do everything. Members can do everything except: (a) delete assets, (b) override pipeline transitions, (c) hard-delete anything, (d) delete logs authored by others.

```sql
-- Enable RLS on all tables
-- Policies (pseudocode; implement in migrations):

-- team_members: everyone reads, only admins insert/update
-- assets: all active members read non-deleted; insert by any member; update by any member;
--         DELETE (soft) by admin only; hard DELETE forbidden always (even admins go via soft delete)
-- tasks: read all; write if assigned_to = auth.uid() OR created_by = auth.uid() OR admin
-- status_history: read all; insert via server action only (no direct writes from client)
-- activity_logs: read all non-deleted; delete (soft) = set deleted_at, deleted_by, delete_reason
```

### 5.4 Triggers & Functions

- **`set_updated_at`** — before update on `assets`, `tasks`: set `updated_at = now()`, `updated_by = auth.uid()`.
- **`log_asset_status_change`** — after update on `assets` when `status` or `temperature` changed: insert into `status_history` and `activity_logs`.
- **`prevent_hard_delete`** — trigger on `activity_logs` that blocks real DELETE. Soft delete only.
- **`validate_status_transition`** — before update on `assets`: check the pipeline rules in §4.1. Raises if violated and actor is not admin. Admins bypass with a claim.

---

## 6. Logging Discipline (the thing that makes this NOT messy)

**Every mutation flows through a single server action pattern.** No client-side writes to Supabase for audited entities.

Pattern (`/lib/actions/_base.ts`):

```ts
async function withAudit<T>(params: {
  action: 'create' | 'update' | 'delete' | ...;
  entityType: string;
  entityId: string;
  summary: string;          // human-readable
  diff?: { before: any; after: any };
  mutation: () => Promise<T>;
}): Promise<T>
```

All server actions that write to `assets`, `tasks`, `developer_shares`, `engagements`, `updates` MUST wrap their mutation in `withAudit`. No exceptions. This is enforced by: (a) lint rule, (b) code review, (c) PR checklist.

---

## 7. Pages / Screens

### 7.1 `/` — Dashboard (home)

**Widgets (server-rendered, cached 30s):**
- Totals: # assets total, # active (not dropped/won), # evaluated this month, # won this quarter
- Temperature breakdown: Hot / Warm / Cold counts with links
- Pipeline funnel: bar chart by status
- Shared with developer: count + top 5 developers by share count
- Team workload: per team member, count of open tasks + count of assets they SPOC for
- Recent activity: last 10 non-deleted `activity_logs`

### 7.2 `/assets` — Asset Registry

**Default view:** TanStack Table, server-paginated, 50 rows/page.

**Columns (visible by default):**
Property name · Location · Status (dropdown, inline editable) · Temperature (dropdown, inline editable) · Type · SPOC · Topline (Cr) · Plot size · Next step · Updated

**Columns (toggle-able):** all other numeric fields.

**Inline editability (member-allowed):** status, temperature, next_step. Everything else opens row detail.

**Filters:**
- Status: multi-select dropdown (from canonical enum)
- Temperature: multi-select dropdown
- Type: multi-select dropdown
- Regulation: multi-select dropdown (matches any)
- SPOC/Agent: multi-select dropdown (auto-populated from data)
- Plot size (sq.m.): **range slider** (min/max from data)
- FSI Potential: range slider
- Development Potential: range slider
- Topline (Cr): range slider
- Initial Investment (Cr): range slider
- Profit (Cr): range slider
- Created date: date range picker

**Bulk actions (admin only):** change status, change temperature, share with developer, soft-delete.

**Row click:** navigates to `/assets/[id]`.

**Create:** `+ New Asset` button opens side sheet with form.

### 7.3 `/assets/[id]` — Asset Detail

Three-column layout on desktop, stacked on mobile.

**Left column (30%):** Core facts — property, location, status, temperature, type, SPOC, all numeric feasibility fields. Each field inline-editable with save-on-blur. Status change requires a note.

**Middle column (45%):** Tabs:
1. **Updates** — timeline of `updates` entries. Add new at top. Soft delete by author or admin.
2. **Tasks** — list with quick-add. Columns: title, assignee, due, status, priority. Click to expand.
3. **Developer shares** — who we shared with, outcome.
4. **History** — `status_history` timeline.
5. **Activity** — filtered `activity_logs` for this asset.

**Right column (25%):** Meta — created by/at, updated by/at, engagement info if converted (kind, started, notes), danger zone (soft delete, admin only).

**Actions:**
- Convert to Mandate / PMC-PMAS button (visible when status is `won` or being moved to `won`)
  - Opens dialog: pick kind (Mandate/PMC_PMAS), start date, notes
  - Creates `engagement`, sets `converted_to_engagement_id`, logs it
- Share with developer: opens dialog, pick developer, write note

### 7.4 `/developers` — Developer Tracker

Two views toggleable:

**List view:** developers table with: name, contact, # active shares, # won from shares, last share date.

**Share view:** table of `developer_shares` — asset, developer, shared by, shared at, outcome. Filters: developer, outcome, date range.

**Create developer:** `+ New Developer` in list view.

**Click developer:** drawer with all shares + their outcomes + ability to add notes.

### 7.5 `/logs` — Activity Logs

Paginated table (50/page), sorted by `created_at desc`.

**Columns:** when, who (actor), action, entity type, entity (linked), summary.

**Filters:** actor (multi-select), action (multi-select), entity type (multi-select), date range, search (in summary).

**Row action:** "Delete log" button (soft delete). Opens confirm dialog asking for reason. Soft-deleted logs hidden by default; toggle "Show deleted" (admin only) to view them.

**Meta-log:** deleting a log creates another log entry: `action=delete_log`, entity_type=activity_log, entity_id=the-deleted-log-id, summary="<actor> deleted a log entry. Reason: <reason>".

### 7.6 `/team` — Team (admin only)

List of team members. Add/deactivate. Change role. View per-person workload.

### 7.7 `/settings` (later)

Not v1.

---

## 8. File & Folder Structure

```
/app
  /(dashboard)
    layout.tsx          # sidebar + top nav, auth guard
    page.tsx            # /
    /assets
      page.tsx          # /assets
      /[id]/page.tsx    # /assets/[id]
    /developers
      page.tsx
    /logs
      page.tsx
    /team
      page.tsx
  /(auth)
    /login/page.tsx
  api/                  # only if absolutely needed; prefer server actions

/components
  /ui                   # shadcn primitives
  /assets               # AssetTable, AssetForm, AssetRow, StatusBadge, TemperatureBadge, FilterBar
  /tasks                # TaskList, TaskForm
  /logs                 # LogTable, LogRow
  /shared               # AppShell, Sidebar, DataTable (generic), RangeSliderFilter

/lib
  /supabase             # client, server, service-role clients
  /schemas              # Zod schemas (ONE per entity; infers TS types)
    asset.ts
    task.ts
    developer.ts
    ...
  /enums                # canonical enums (values + display labels + colors)
  /actions              # server actions (ONE file per entity)
    _base.ts            # withAudit wrapper
    assets.ts
    tasks.ts
    engagements.ts
    shares.ts
    logs.ts
  /queries              # typed read queries (one file per entity)
    assets.ts
    ...
  /rbac                 # role checks
  /utils                # dates, numbers, formatters

/supabase
  /migrations           # SQL migrations, numbered
  /seed                 # seed scripts
```

**Naming rules (enforced):**
- Files: `kebab-case`, components: `PascalCase` inside.
- Server actions always named `verbEntity` (e.g., `updateAssetStatus`, `createAsset`).
- Every server action returns `{ ok: true, data } | { ok: false, error }`.
- No default exports except Next.js pages/layouts.

---

## 9. Type & Schema Discipline

**One Zod schema per entity. DB type + form type + API type all derive from it.**

```ts
// /lib/schemas/asset.ts
import { z } from 'zod';
export const AssetStatusEnum = z.enum([
  'new','initial_assessment','evaluating','evaluated',
  'shared_with_developer','on_hold','won','dropped'
]);
export const AssetSchema = z.object({ ... });
export type Asset = z.infer<typeof AssetSchema>;
export const AssetCreateSchema = AssetSchema.omit({ id: true, created_at: true, ... });
export type AssetCreate = z.infer<typeof AssetCreateSchema>;
```

**Rule:** never define a type for a domain entity by hand. Always `z.infer`.

---

## 10. Build Order (vertical slices)

Each slice is shippable on its own. Each is a separate Claude Code session to keep token use tight.

**Slice 0 — Foundation** (½ day)
- Next.js + Tailwind + shadcn init
- Supabase project + env vars
- Auth (login page, session middleware, logout)
- `AppShell` with sidebar + top nav
- Empty pages: `/`, `/assets`, `/developers`, `/logs`, `/team`

**Slice 1 — Asset Registry read-only** (1 day)
- Migrations: `team_members`, `assets`, enums
- Seed 5 fake assets
- `/assets` page with TanStack Table, all columns, filters (dropdowns first — sliders in slice 2)
- `/assets/[id]` read-only with left column populated

**Slice 2 — Asset CRUD + status pipeline** (1 day)
- Create asset form (side sheet)
- Inline edit: status, temperature, next_step
- `validate_status_transition` trigger + admin override
- `withAudit` wrapper + `status_history` trigger
- Range slider filters
- Soft delete (admin only)

**Slice 3 — Tasks + Updates + History tabs** (1 day)
- Migrations: `tasks`, `updates`, `status_history` (if not done)
- Detail page middle column: all 5 tabs
- Create/edit/delete task; quick-add update

**Slice 4 — Developers + Shares** (½ day)
- Migrations: `developers`, `developer_shares`
- `/developers` both views
- "Share with developer" dialog on asset detail

**Slice 5 — Engagements (conversion)** (½ day)
- Migrations: `engagements`, `converted_to_engagement_id` FK
- Conversion dialog
- Engagement info on asset detail right column
- Dashboard widget: won/engagements this quarter

**Slice 6 — Activity Logs page** (½ day)
- `/logs` page with filters + pagination
- Soft-delete log with reason + meta-log

**Slice 7 — Dashboard widgets** (1 day)
- All widgets listed in §7.1, server-rendered

**Slice 8 — Excel import** (½ day, when you're ready)
- CLI-only importer that maps Excel → canonical enums
- Dry-run mode prints proposed inserts
- Run against real Excel

**Slice 9 — Team management** (½ day)
- `/team` page, invite flow

---

## 11. Out of Scope for v1

- Notifications (email/in-app) — add in v2
- File attachments on assets/tasks — v2
- @mentions in updates — v2
- Full-text search across assets — v2 (Postgres FTS)
- Webhooks / integrations — later
- Mobile app — never
- Public / client portal — out of scope

---

## 12. Definition of Done (per slice)

A slice is done when:
1. All listed features work end-to-end locally
2. Migrations apply cleanly against a fresh DB
3. RLS policies tested (member & admin scenarios)
4. No TypeScript errors, no ESLint errors
5. Every mutation creates the correct activity log entry
6. Deployed to Vercel preview and smoke-tested

---

## 13. What We Will NOT Do Again (lessons from the previous codebase)

1. **No ad-hoc types.** Zod schemas drive everything. No `any`. No parallel type definitions.
2. **No direct client writes** to audited tables. Everything goes through server actions.
3. **No scattered logging.** `withAudit` or it didn't happen.
4. **No enum strings in the UI.** Labels and colors come from `/lib/enums`, always.
5. **No hard deletes** for audited entities. Ever.
6. **No business logic in components.** Components render; actions mutate; queries read.
7. **No feature flags or hidden toggles.** Ship or don't.
8. **No work started without the spec reviewed.** Update SPEC.md first, then code.
