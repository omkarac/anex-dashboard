import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';

// One-shot diagnostic: shows which env vars the running Node runtime can see.
// Admin-gated. Never logs values for secrets — only presence + length so we can
// tell apart "missing" from "empty string" from "stray whitespace".
//
// Delete this route once the env setup is confirmed working.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function inspect(name: string): { present: boolean; length: number; trimmedLength: number } {
  const v = process.env[name];
  if (v === undefined) return { present: false, length: 0, trimmedLength: 0 };
  return { present: true, length: v.length, trimmedLength: v.trim().length };
}

export async function GET() {
  await requireAdmin();

  return NextResponse.json({
    runtime: {
      vercel_env: process.env.VERCEL_ENV ?? null,
      vercel_url: process.env.VERCEL_URL ?? null,
      vercel_git_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      node_env: process.env.NODE_ENV,
    },
    eod_report_vars: {
      RESEND_API_KEY: inspect('RESEND_API_KEY'),
      EMAIL_FROM: inspect('EMAIL_FROM'),
      CRON_SECRET: inspect('CRON_SECRET'),
      NEXT_PUBLIC_APP_URL: inspect('NEXT_PUBLIC_APP_URL'),
    },
    supabase_vars: {
      NEXT_PUBLIC_SUPABASE_URL: inspect('NEXT_PUBLIC_SUPABASE_URL'),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: inspect('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      SUPABASE_SERVICE_ROLE_KEY: inspect('SUPABASE_SERVICE_ROLE_KEY'),
    },
    // Sanity check: which env-var NAMES start with EMAIL or RESEND. Catches
    // typos like EMAIL FROM, EMAILFROM, RESEND_KEY, etc. without leaking values.
    matching_names: Object.keys(process.env)
      .filter((k) => k.startsWith('EMAIL') || k.startsWith('RESEND'))
      .sort(),
  });
}
