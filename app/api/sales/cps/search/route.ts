import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sanitizePostgrestTerm } from '@/lib/utils/search';

export async function GET(req: NextRequest) {
  // Defense in depth: require an authenticated session in the handler itself,
  // not only at the proxy/middleware layer. A middleware bypass must not expose
  // channel-partner PII.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const q = req.nextUrl.searchParams.get('q') ?? '';
  // Sanitize before interpolating into the PostgREST .or() filter expression.
  const term = sanitizePostgrestTerm(q);
  if (term.length < 2) return NextResponse.json([]);

  const service = createServiceClient();

  const { data, error } = await service
    .from('channel_partners')
    .select('id, canonical_name, aliases, category, zone, mobile_primary')
    .or(`canonical_name.ilike.%${term}%,aliases.cs.{${term}}`)
    .eq('is_active', true)
    .order('canonical_name')
    .limit(20);

  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data ?? []);
}
