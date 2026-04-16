# Anex Dashboard — Planning Bundle

This folder contains four documents that together let you build the dashboard with Claude Code without context drift or token waste.

## The four files

| File | Purpose | Who reads it |
|---|---|---|
| **SPEC.md** | Full product & technical specification. The source of truth. | You (for decisions) + Claude Code (when building a slice) |
| **CLAUDE.md** | Short rule-book for Claude Code. Goes in the repo root. | Claude Code, every session |
| **ENUM_MAPPING.md** | How Excel values map to canonical enums. Locks data normalization. | You (to review) + Claude Code (during Slice 8 import) |
| **SESSION_PROMPTS.md** | Copy-paste prompts for each slice. Minimum tokens per session. | You |

## How to use this

1. **Review SPEC.md end to end.** Push back on anything you disagree with BEFORE we start coding.
2. **Review ENUM_MAPPING.md** — especially the Status table. These mappings are your call, not mine. If "FF" means something specific, tell me.
3. **Create the repo.** `npx create-next-app@latest anex-dashboard --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"`
4. **Copy `CLAUDE.md` and `SPEC.md` into the repo root.** Commit them before any code.
5. **Start Claude Code in the repo.** Paste "Session 0 — Bootstrap" from `SESSION_PROMPTS.md`.
6. **One slice per session.** When a slice is done, commit, close the session, open a new one for the next slice. This keeps each Claude Code context fresh and cheap.

## Token optimization — how this bundle saves money

- **SPEC.md is referenced by section, not pasted.** Prompts say "Read SPEC §4.1" not "Here are the rules: ...".
- **CLAUDE.md loads once per session** and is short (~100 lines). Establishes non-negotiables that would otherwise need to be re-explained.
- **Vertical slices bound the scope.** Each session touches 5-15 files, not 100.
- **Schemas drive types.** Claude Code doesn't regenerate type definitions from memory each session — it reads the Zod schema.
- **No chat-based context rebuilding.** Everything Claude Code needs is in `/` or `SPEC.md`. No "remember when we decided..." prompts.

## Locked settings

- **Hosting region:** Supabase `ap-south-1` (Mumbai)
- **Domain:** free Vercel subdomain for v1; custom domain TBD (no code impact, just a Vercel + DNS step when ready)
- **First admin:** `omkar.chaudhari@anexadvisory.com`
- **Login:** Microsoft/Azure AD OAuth only, single-tenant against Anex AD, "Keep me signed in" = 30-day session

## Manual one-time setup before Slice 0 runs to completion

Slice 0 will generate `docs/AUTH_SETUP.md` inside the repo with step-by-step instructions for:
1. Creating the Azure AD app registration (single-tenant)
2. Wiring it into Supabase Auth → Providers → Azure
3. Setting redirect URIs

You'll do those two clicks-heavy steps by hand (they can't be automated through code). Everything else is code.
