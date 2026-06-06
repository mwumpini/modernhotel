import { NextResponse } from 'next/server';

/**
 * External cron hook (e.g. Vercel Cron at 01:00).
 *
 * Front-office night audit runs in the browser store; this endpoint validates
 * the cron secret and returns guidance. Keep a logged-in front-desk session
 * overnight for the in-app NightAuditScheduler, or run manually from Night Audit.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.json({
    ok: true,
    message:
      'Night audit auto-run is handled by NightAuditScheduler when the app is open (1:00am local, if nightAuditAutoRun is enabled).',
    settings: {
      postFirstNightAtCheckin: 'roomManagement.postFirstNightAtCheckin (default false)',
      nightAuditAutoRun: 'roomManagement.nightAuditAutoRun (default true)',
    },
  });
}
