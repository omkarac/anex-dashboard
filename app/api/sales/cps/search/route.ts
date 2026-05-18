import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  if (q.length < 2) return NextResponse.json([]);

  const service = createServiceClient();
  const term = q.trim();

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
