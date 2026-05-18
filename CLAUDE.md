# CLAUDE.md — Rules for Claude Code in this repo

> Read this file at the start of every session. Read `SPEC.md` only when the task needs it (most slices do). Do not read the Excel file directly — data migration is slice 8 and has its own script.

## What this project is

Anex Dashboard — internal PM tool for real-estate opportunities. Next.js 15 + Supabase + Tailwind + shadcn. Full product spec is in `SPEC.md`. It is the source of truth.

## Absolute rules — do not violate

1. **Follow the spec.** If the spec and the request conflict, stop and ask. Don't "improve" silently.
2. **One Zod schema per entity.** Never hand-write a TS type for a domain entity. Always `z.infer`.
3. **All writes go through server actions** in `/lib/actions/`. Client components never call `supabase.from(...).insert/update/delete`.
4. **Every mutation wraps `withAudit`.** No exceptions for "quick" or "internal" mutations.
5. **No enum string literals in JSX.** Import from `/lib/enums` and use the label/color helpers.
6. **No hard deletes.** Soft delete with `deleted_at`, `deleted_by`.
7. **No `any`. No `@ts-ignore`.** If typing is hard, ask — usually means the schema needs fixing.
8. **Server actions return `{ ok: true, data } | { ok: false, error: string }`.** Never throw across the boundary.
9. **Migrations are additive and numbered.** Never edit a migration after it's been applied to a shared DB. Write a new one.
10. **Do not read or write files outside this repo** unless explicitly instructed.
11. **Login is email magic-link only in v1, locked to `@anexadvisory.com`.** Domain check runs both client-side (before send) and server-side (in `/auth/callback`). Do NOT add password login, Google, GitHub, or any other provider. Azure AD OAuth is the planned v2 switch — keep the auth layer modular so swapping providers is a single-file change.

## Directory conventions

- Pages: `/app/(dashboard)/<route>/page.tsx` — server components by default; mark client with `'use client'` only when needed.
- Components: `/components/<domain>/<Component>.tsx` — PascalCase.
- Server actions: `/lib/actions/<entity>.ts` — named exports, verbEntity naming.
- Queries (reads): `/lib/queries/<entity>.ts` — typed, return plain data.
- Schemas: `/lib/schemas/<entity>.ts` — Zod + inferred types.
- Enums: `/lib/enums/<entity>.ts` — values, labels, colors.
- RBAC: `/lib/rbac/` — `requireAdmin()`, `currentUser()`, etc.

## Code style

- No default exports except Next.js pages/layouts.
- File names: kebab-case. Component names inside: PascalCase.
- Prefer server components. Add `'use client'` only for interactivity.
- Tailwind first. No inline styles. No CSS files except globals.
- shadcn/ui for primitives; don't reinvent buttons/dialogs/dropdowns.
- Forms: react-hook-form + `zodResolver`.

## When asked to build a feature

1. Check SPEC.md for the feature's details.
2. State which slice (§10 in SPEC) this belongs to. If it's out of sequence, say so.
3. List files you'll create/modify before writing code. Keep the list minimal.
4. Write the schema first, then migration (if any), then query/action, then UI.
5. At the end: summarize what was changed and what to test manually.

## When asked to fix a bug

1. Reproduce via a failing minimal assertion or a described repro.
2. Identify the layer (schema / migration / query / action / UI).
3. Fix at the root, not the symptom.
4. Add a regression check (a runtime assertion, a stricter type, or a test if tests exist).

## Ask before doing

- Adding a new dependency (npm package).
- Changing a migration that already exists.
- Renaming or moving files that are imported from many places.
- Introducing a new pattern not in this file or SPEC.md.
- Anything that touches auth, RLS policies, or `withAudit`.

## Token hygiene (important)

- Don't dump whole files you haven't touched.
- Don't restate SPEC.md in responses — reference section numbers (e.g. "per SPEC §4.1").
- Keep diffs focused. One slice per session when possible.
- If a task feels too big, stop and propose splitting it.

## Current slice

> Update this line at the start of each session.

**Active slice:** _(not started — begin with Slice 0 from SPEC §10)_
# CLAUDE.md — Sales V2 Addendum

> APPEND this entire section to the existing CLAUDE.md.

---

## Sales & Marketing Vertical V2 — Non-Negotiable Rules

### Visual Design — Must Match HTML Demo

Every component in the Sales vertical must visually match `anex-sales-crm.html`.

**Typography:** Plus Jakarta Sans (from next/font/google). DM Mono for numbers and codes.
Never use Inter, Roboto, or system fonts in the Sales vertical.

**Colors — use CSS variables from `styles/anex-sales.css`, not hardcoded hex:**
- Sidebar background: `var(--anex-navy)` (#1B2A4A)
- Page background: `var(--sales-bg)` (#EEF2F7)
- Card background: `var(--sales-card)` (#FFFFFF)
- KPI tile top border: 3px colored per metric type
- Booked = green (#15803D), Warm = amber (#B45309), Cold = blue (#1D4ED8), Lost = red (#B91C1C)

**Component style rules:**
- KpiTile: white card, 3px top border, 28px value, tabular-nums
- Status badges: pill shape (border-radius 20px), dot prefix, border + bg + text all set
- Table rows: color-coded background by status (row-booked/warm/cold/lost classes)
- All buttons: minimum 44px height for mobile tap targets
- Mobile forms: single column, large button groups (not dropdowns) for categorical fields

**When in doubt:** look at the HTML demo file. Reproduce it, don't invent.

### PWA Rules

**Service worker registration:**
The sw.js is in `/public/sw.js`. Register it in the root layout client component.
Never register the service worker from a page component — only from the root layout.

**PWA meta tags:**
Use the salesPwaMeta object from `app/pwa-meta.tsx` in the root metadata export.
Do not create a second manifest.json — there is only one at `/public/manifest.json`.

**Offline page:**
Create `app/offline/page.tsx` — a simple page shown when offline.
The offline page must work without any JavaScript (static HTML fallback).

**Icon generation:**
The PWA requires icons at: 72, 96, 128, 144, 192, 512px.
Generate them programmatically in the Foundation session using canvas/sharp.
The AN logo mark (navy background, gold "AN" text) is the icon design.

### Mobile Form Rules

The three replacement forms for Google Forms must be built mobile-first:

**DAR Form** (`/sales/meetings/new`):
- Single column, full-width inputs
- Meeting Type: large OBM/IBM button group (not a dropdown), minimum 56px height
- CP selection: CpSearchCombobox (never a text input)
- KMs: numeric keyboard (inputMode="numeric")
- Meeting Category: NEVER a user input — computed server-side
- SM: NEVER a user input — read from auth.uid()
- Submit must complete in under 90 seconds on mobile

**Walk-in Form** (`/sales/walk-ins/new`):
- 7-step wizard using useReducer (not URL-based steps)
- Mobile search as step 1 — large input, auto-focus, numeric keyboard
- Returning visitor: auto-skip to Step 3, show "Returning — Visit #N" banner
- Button groups for: Visit Type, Source (CP/Direct), HWCL, Configuration, Purpose
- Dropdowns only where there are >6 options
- Lost Reason appears (required) when HWCL = Lost
- Next Follow-up Date appears (required) when HWCL = Warm or Cold
- Submit button: sticky at bottom of viewport on mobile

**Tele-calling Form** (`/sales/leads/call`):
- Call queue auto-loads from follow_up_tasks due today for auth user
- Connected/Not Connected: two full-width button options, 64px height
- If connected: three outcomes (Interested/Not Interested/Callback) as large buttons
- Follow-up date: required before submit if connected
- "Mark Lost" only available after 3 consecutive Not Connected calls

### Data Rules (unchanged from V1, restated for V2 clarity)

- Mobile: always normalize before DB touch (strip non-digits, 10 digits)
- CP: always use UUID from channel_partners — never a text string
- Meeting Category: computed server-side from cp_meetings count in current month
- Status 'booked': immutable by sales_manager — DB trigger + server action guard
- All writes go through lib/actions/sales/ — no direct supabase.from() in components
- Every mutation calls withAudit()
- All server action inputs validated with Zod before DB operation

### Parallel Agent Rules

If you are Agent A, B, C, or D:
- Only create/modify files in YOUR agent's file ownership list (see PARALLEL_BUILD_GUIDE.md)
- Import shared components from their Foundation-created paths — do not recreate them
- If a shared component you need doesn't exist, stop and note it — don't create it elsewhere
- Never modify lib/schemas/sales.ts — it was created by Foundation and is read-only for agents
- Never modify supabase/migrations/ — all migrations were run by Foundation

### What NOT to Build (V2 still excludes)

- Inventory/pricing/booking management (developer's system)
- Post-sales: loan, registration, milestones, collection, possession
- CTI/telephony integration
- WhatsApp bot (noted for V3 — do not stub it in V2)
- Financial calculations
