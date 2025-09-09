// Server-safe audit logger - no client-side dependencies

export interface AuditLogEntry {
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: string;
  id?: string;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private logs: AuditLogEntry[] = [];

  private constructor() {}

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  public log(entry: AuditLogEntry): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      ...entry,
      timestamp,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Store in memory (in production, this would be stored in database)
    this.logs.push(logEntry);

    // Server-side logging only - no client-side analytics

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 Audit Log:', logEntry);
    }
  }

  public getLogs(entity?: string, entityId?: string): AuditLogEntry[] {
    let filteredLogs = this.logs;

    if (entity) {
      filteredLogs = filteredLogs.filter(log => log.entity === entity);
    }

    if (entityId) {
      filteredLogs = filteredLogs.filter(log => log.entityId === entityId);
    }

    return filteredLogs.sort((a, b) => 
      new Date(b.timestamp || '').getTime() - new Date(a.timestamp || '').getTime()
    );
  }

  public getProformaLogs(reservationId: string): AuditLogEntry[] {
    return this.getLogs('reservation', reservationId)
      .filter(log => log.action.includes('proforma'));
  }

  public clearLogs(): void {
    this.logs = [];
  }
}

// Convenience functions
export const auditLogger = AuditLogger.getInstance();

export const logProformaGenerated = (reservationId: string, guestEmail: string, details?: Record<string, any>) => {
  auditLogger.log({
    action: 'proforma_generated',
    entity: 'reservation',
    entityId: reservationId,
    details: {
      guestEmail,
      generatedAt: new Date().toISOString(),
      ...details
    }
  });
};

export const logProformaSent = (reservationId: string, guestEmail: string, messageId?: string, details?: Record<string, any>) => {
  auditLogger.log({
    action: 'proforma_sent',
    entity: 'reservation',
    entityId: reservationId,
    details: {
      guestEmail,
      messageId,
      sentAt: new Date().toISOString(),
      ...details
    }
  });
};

export const logProformaDownloaded = (reservationId: string, details?: Record<string, any>) => {
  auditLogger.log({
    action: 'proforma_downloaded',
    entity: 'reservation',
    entityId: reservationId,
    details: {
      downloadedAt: new Date().toISOString(),
      ...details
    }
  });
};

export const logProformaPrinted = (reservationId: string, details?: Record<string, any>) => {
  auditLogger.log({
    action: 'proforma_printed',
    entity: 'reservation',
    entityId: reservationId,
    details: {
      printedAt: new Date().toISOString(),
      ...details
    }
  });
};
