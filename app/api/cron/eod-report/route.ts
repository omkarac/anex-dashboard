import { NextResponse } from 'next/server';
import { sendEodReport } from '@/lib/actions/eod-report';

// Vercel Cron fires this route on the schedule in vercel.json (Mon–Sat 21:00 IST).
// It sends `Authorization: Bearer ${CRON_SECRET}` automatically when CRON_SECRET
// is set in the project's environment — we reject anything else so the endpoint
// can't be triggered by random traffic.
//
// Marked dynamic + no-store so the report is regenerated on every fire.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const result = await sendEodReport({ triggeredBy: 'cron' });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message_id: result.data.message_id,
    recipients: result.data.recipient_count,
    date: result.data.report_date_ist,
  });
}
