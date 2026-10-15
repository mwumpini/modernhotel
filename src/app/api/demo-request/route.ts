import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { prisma } from '@/app/lib/database/client';

/**
 * Demo requests from the agmsync.com website. Public (no sign-in): every request is
 * saved, then emailed to the AGM Sync inbox when SMTP is configured (SMTP_HOST,
 * SMTP_PORT, SMTP_USER, SMTP_PASS; DEMO_REQUEST_TO overrides the recipient).
 */

const RECENT = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (RECENT.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  RECENT.set(ip, hits);
  return hits.length > MAX_PER_WINDOW;
}

const clean = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

async function notify(row: { name: string; hotelName: string; email: string | null; whatsapp: string | null; rooms: number | null; city: string | null; message: string | null }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const lines = [
    `Name: ${row.name}`,
    `Business: ${row.hotelName}`,
    `Rooms: ${row.rooms ?? '-'}`,
    `City: ${row.city || '-'}`,
    `Email: ${row.email || '-'}`,
    `WhatsApp: ${row.whatsapp || '-'}`,
    '',
    row.message || '(no message)',
  ];
  await transporter.sendMail({
    from: `"AGM Sync website" <${process.env.SMTP_USER}>`,
    to: process.env.DEMO_REQUEST_TO || 'info@agmsync.com',
    replyTo: row.email || undefined,
    subject: `Demo request: ${row.hotelName} (${row.name})`,
    text: lines.join('\n'),
  });
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    // Bots fill every field; people never see this one.
    if (clean(body.website, 200)) return NextResponse.json({ ok: true });

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    if (tooMany(ip)) {
      return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes, or message us on WhatsApp.' }, { status: 429 });
    }

    const name = clean(body.name, 120);
    const hotelName = clean(body.hotelName, 160);
    const email = clean(body.email, 160) || null;
    const whatsapp = clean(body.whatsapp, 40) || null;
    const city = clean(body.city, 80) || null;
    const facilityType = clean(body.facilityType, 60);
    const note = String(body.message ?? '').trim().slice(0, 2000);
    const message = [facilityType && `Type of business: ${facilityType}`, note].filter(Boolean).join('\n\n') || null;
    const roomsNumber = Number(body.rooms);
    const rooms = Number.isFinite(roomsNumber) && roomsNumber > 0 ? Math.min(Math.round(roomsNumber), 10_000) : null;

    if (!name || !hotelName) {
      return NextResponse.json({ error: 'Please give your name and your business’s name.' }, { status: 400 });
    }
    if (!email && !whatsapp) {
      return NextResponse.json({ error: 'Please give an email address or a WhatsApp number so we can reach you.' }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'That email address doesn’t look right.' }, { status: 400 });
    }

    const row = await prisma.demoRequest.create({
      data: { name, hotelName, email, whatsapp, rooms, city, message, source: clean(body.source, 40) || null, ip },
    });

    let emailed = false;
    try {
      emailed = await notify(row);
    } catch (error) {
      console.error('[demo-request] email failed (request is saved)', error);
    }

    return NextResponse.json({ ok: true, id: row.id, emailed }, { status: 201 });
  } catch (error) {
    console.error('[demo-request][POST] error', error);
    return NextResponse.json({ error: 'Something went wrong. Please message us on WhatsApp instead.' }, { status: 500 });
  }
}
