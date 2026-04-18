# Auth Setup — Anex Dashboard (v1: Email Magic-Link)

## Overview

v1 uses Supabase Auth with **email magic-link**. No passwords. Login is restricted to `@anexadvisory.com` emails.

---

## Step 1: Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Name: `anex-dashboard`
3. Region: **ap-south-1 (Mumbai)**
4. Save the generated database password somewhere safe

---

## Step 2: Configure Auth settings

In the Supabase dashboard → **Authentication → Settings**:

- **Site URL**: `http://localhost:3000` (for dev); update to Vercel URL for prod
- **Redirect URLs**: Add `http://localhost:3000/auth/callback` and your Vercel URL `/auth/callback`
- **Email OTP expiry**: 3600 (1 hour) — adjust as needed
- Disable everything except **Email** provider

---

## Step 3: Get your env vars

Supabase dashboard → **Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Copy `.env.local.example` to `.env.local` and fill in these values.

---

## Step 4: Run the migration

```bash
# Install Supabase CLI if not installed
brew install supabase/tap/supabase

# Login
supabase login

# Link to your project (get project ref from dashboard URL)
supabase link --project-ref <project-ref>

# Push migration
supabase db push
```

Or paste the contents of `supabase/migrations/0001_initial_schema.sql` directly into the Supabase SQL editor.

---

## Step 5: Seed the first admin

1. Start the dev server: `npm run dev`
2. Go to `http://localhost:3000/login`
3. Enter `omkar.chaudhari@anexadvisory.com` and click "Send me a sign-in link"
4. Check your email and click the link
5. You will be auto-provisioned as a `member`
6. In Supabase dashboard → SQL editor, run:
   ```sql
   UPDATE team_members
   SET role = 'admin'
   WHERE email = 'omkar.chaudhari@anexadvisory.com';
   ```
7. You now have admin access

---

## v2 Migration path to Azure AD

When ready:
1. In Supabase → Authentication → Providers → Azure → enable, add tenant ID + client secret
2. Update `/app/(auth)/login/page.tsx` and `LoginForm` to use `signInWithOAuth({ provider: 'azure' })`
3. Remove the magic-link flow
4. The domain check in `/app/auth/callback/route.ts` stays as a safety net

Estimated time: ~15 minutes.
