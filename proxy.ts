import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Exclude /api/cron/* — Vercel Cron fires these unauthenticated; the route
    // verifies its own Authorization: Bearer ${CRON_SECRET} header. If we let
    // the auth middleware run, it 307s the cron caller to /login and the
    // scheduled work never executes.
    '/((?!api/cron/|_next/static|_next/image|favicon.ico|logo-|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
