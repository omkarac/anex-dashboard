import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getNearbyAppeals, getNearbyNocs, getNeighborhoodStats } from '@/lib/queries/skygauge';

// lat/lon required; radius optional, clamped to a sane window. `?? undefined`
// turns missing params into `undefined` so coercion yields NaN (→ validation
// error) rather than silently coercing null to 0.
const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(5000).default(1000),
});

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const parsed = QuerySchema.safeParse({
    lat: params.get('lat') ?? undefined,
    lon: params.get('lon') ?? undefined,
    radius: params.get('radius') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  try {
    const { lat, lon, radius } = parsed.data;
    const [stats, appeals, nocs] = await Promise.all([
      getNeighborhoodStats(lat, lon, radius),
      getNearbyAppeals(lat, lon, radius),
      getNearbyNocs(lat, lon, radius),
    ]);
    return NextResponse.json({ stats, appeals, nocs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Neighborhood lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
