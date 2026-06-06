import { NextRequest, NextResponse } from 'next/server';
import { auditLogger } from '@/app/lib/audit/auditLogger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params;
    
    if (!reservationId) {
      return NextResponse.json(
        { error: 'Reservation ID is required' },
        { status: 400 }
      );
    }

    // Get all audit logs for this reservation
    const logs = auditLogger.getLogs('reservation', reservationId);
    
    // Filter for proforma-related logs
    const proformaLogs = logs.filter(log => 
      log.action.includes('proforma')
    );

    return NextResponse.json({
      success: true,
      reservationId,
      totalLogs: logs.length,
      proformaLogs: proformaLogs.length,
      logs: proformaLogs
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch audit logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get all audit logs (for admin purposes)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity, entityId, action } = body;

    const logs = auditLogger.getLogs(entity, entityId);
    
    let filteredLogs = logs;
    
    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }

    return NextResponse.json({
      success: true,
      totalLogs: filteredLogs.length,
      logs: filteredLogs
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch audit logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
