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
