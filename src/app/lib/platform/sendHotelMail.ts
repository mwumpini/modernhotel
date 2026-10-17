import nodemailer from 'nodemailer';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth/auth';
import { prisma } from '@/app/lib/database/client';
import { readHotelMail } from '@/app/lib/platform/hotelMail';

function pdfName(filename: string) {
  const cleaned = filename.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'document';
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

/** Sends one message from the signed-in hotel's mailbox. Nothing is sent unless a screen asks. */
export async function sendHotelMail(input: {
  to: string;
  subject: string;
  html: string;
  pdf?: string;
  filename?: string;
}) {
  const to = input.to.trim();
  const subject = input.subject.trim();
  const html = input.html;
  const pdf = (input.pdf || '').replace(/\s/g, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: 'Enter an email address.', status: 400 };
  if (!subject || subject.length > 160) return { error: 'Enter a subject.', status: 400 };
  if (!html || html.length > 20_000) return { error: 'This note is too long to email.', status: 400 };
  if (!pdf || pdf.length > 12_000_000 || !/^[A-Za-z0-9+/=]+$/.test(pdf)) {
    return { error: 'The PDF could not be attached.', status: 400 };
  }

  const session = await getServerSession(authOptions);
  const tenantId = session?.user?.tenantId;
  if (!tenantId) return { error: 'Sign in again before sending mail.', status: 401 };
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { metadata: true, name: true } });
  const mailbox = tenant ? readHotelMail(tenant.metadata) : null;
  if (!mailbox) return { error: 'This hotel has no outgoing mailbox yet. Add it in the platform.', status: 400 };

  const transporter = nodemailer.createTransport({
    host: mailbox.host,
    port: mailbox.port,
    secure: mailbox.port === 465,
    auth: { user: mailbox.user, pass: mailbox.pass },
  });
  const result = await transporter.sendMail({
    from: `"${tenant?.name || 'Hotel'}" <${mailbox.user}>`,
    to,
    subject,
    html,
    attachments: [{
      filename: pdfName(input.filename || 'document.pdf'),
      content: Buffer.from(pdf, 'base64'),
      contentType: 'application/pdf',
    }],
  });
  return { messageId: result.messageId, from: mailbox.user };
}
