import { createClient } from '@supabase/supabase-js';

// Bypasses RLS — only use in server-side code, never expose to client
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
