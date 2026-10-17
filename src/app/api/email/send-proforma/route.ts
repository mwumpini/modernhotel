import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth/auth';
import { prisma } from '@/app/lib/database/client';
import { readHotelMail, type HotelMail } from '@/app/lib/platform/hotelMail';
import { mailNote } from '@/app/lib/platform/mailNote';

async function mailboxForSender(): Promise<HotelMail | null> {
  const session = await getServerSession(authOptions);
  const tenantId = session?.user?.tenantId;
  if (!tenantId) return null;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { metadata: true } });
  return tenant ? readHotelMail(tenant.metadata) : null;
}

interface SendProformaRequest {
  reservationId: string;
  guestEmail: string;
  guestName: string;
  pdfBuffer: string; // Base64 encoded PDF
  hotelName: string;
  reservationDetails: {
    checkIn: string;
    checkOut: string;
    roomType: string;
    totalAmount: number;
    currency: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SendProformaRequest = await request.json();
    const { 
      reservationId, 
      guestEmail, 
      guestName, 
      pdfBuffer, 
      hotelName,
    } = body;

    // Validate required fields
    if (!guestEmail || !guestName || !pdfBuffer) {
      return NextResponse.json(
        { error: 'Missing required fields: guestEmail, guestName, pdfBuffer' },
        { status: 400 }
      );
    }

    const mailbox = await mailboxForSender();
    if (!mailbox) {
      return NextResponse.json(
        { error: 'This hotel has no outgoing mailbox yet. Add it when the hotel is opened in the platform.' },
        { status: 400 },
      );
    }

    // Convert base64 to buffer
    const pdfAttachment = Buffer.from(pdfBuffer, 'base64');

    // Email content
    const subject = `Reservation Confirmation - ${hotelName}`;
    const htmlContent = mailNote({
      name: guestName,
      documentName: 'reservation confirmation',
      facility: hotelName,
    });


    // Send email
    const mailOptions = {
      from: `"${hotelName}" <${mailbox.user}>`,
      to: guestEmail,
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: `reservation-${reservationId}-proforma.pdf`,
          content: pdfAttachment,
          contentType: 'application/pdf',
        },
      ],
    };

    const transporter = nodemailer.createTransport({
      host: mailbox.host,
      port: mailbox.port,
      secure: mailbox.port === 465,
      auth: { user: mailbox.user, pass: mailbox.pass },
    });
    const result = await transporter.sendMail(mailOptions);


    console.log('Proforma email sent successfully:', {
      reservationId,
      guestEmail,
      messageId: result.messageId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'Proforma sent successfully',
    });

  } catch (error) {
    console.error('Error sending proforma email:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to send proforma email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check for email service
export async function GET() {
  const mailbox = await mailboxForSender();
  if (!mailbox) {
    return NextResponse.json({ status: 'unconfigured', service: 'email' }, { status: 404 });
  }
  return NextResponse.json({ status: 'configured', service: 'email', from: mailbox.user });
}
