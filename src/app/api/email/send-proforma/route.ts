import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { logProformaGenerated, logProformaSent } from '@/app/lib/audit/auditLogger';

// Email configuration from environment variables
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

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
      reservationDetails 
    } = body;

    // Validate required fields
    if (!guestEmail || !guestName || !pdfBuffer) {
      return NextResponse.json(
        { error: 'Missing required fields: guestEmail, guestName, pdfBuffer' },
        { status: 400 }
      );
    }

    // Convert base64 to buffer
    const pdfAttachment = Buffer.from(pdfBuffer, 'base64');

    // Email content
    const subject = `Reservation Confirmation - ${hotelName}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Reservation Confirmation</h2>
        <p>Dear ${guestName},</p>
        
        <p>Thank you for choosing ${hotelName}! Your reservation has been confirmed.</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Reservation Details</h3>
          <p><strong>Check-in:</strong> ${reservationDetails.checkIn}</p>
          <p><strong>Check-out:</strong> ${reservationDetails.checkOut}</p>
          <p><strong>Room Type:</strong> ${reservationDetails.roomType}</p>
          <p><strong>Total Amount:</strong> ${reservationDetails.currency} ${reservationDetails.totalAmount.toFixed(2)}</p>
        </div>
        
        <p>Please find your detailed reservation proforma attached to this email.</p>
        
        <p>If you have any questions or need to make changes to your reservation, please don't hesitate to contact us.</p>
        
        <p>We look forward to welcoming you!</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">
          Best regards,<br>
          ${hotelName} Team
        </p>
      </div>
    `;

    // Log proforma generation
    logProformaGenerated(reservationId, guestEmail, {
      hotelName,
      reservationDetails,
      pdfSize: pdfAttachment.length
    });

    // Send email
    const mailOptions = {
      from: `"${hotelName}" <${process.env.SMTP_USER}>`,
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

    const result = await transporter.sendMail(mailOptions);

    // Log the email send event
    logProformaSent(reservationId, guestEmail, result.messageId, {
      hotelName,
      reservationDetails,
      pdfSize: pdfAttachment.length
    });

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
  try {
    await transporter.verify();
    return NextResponse.json({
      status: 'healthy',
      service: 'email',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      service: 'email',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
