import { NextRequest, NextResponse } from 'next/server';
import { sendHotelMail } from '@/app/lib/platform/sendHotelMail';

/** A staff member chose to email one document. Checkout and payment do not call this. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  try {
    const result = await sendHotelMail({
      to: String(body.to || ''),
      subject: String(body.subject || ''),
      html: String(body.html || ''),
      pdf: String(body.pdf || ''),
      filename: String(body.filename || 'document.pdf'),
    });
    if ('error' in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }
    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not send the email.' },
      { status: 500 },
    );
  }
}
