import { prisma } from '../database/client'

export interface NightAuditLogDTO {
  id: string
  businessDate: string
  source: 'cron' | 'manual'
  status: 'completed' | 'failed'
  roomChargesPosted: number
  noShowsMarked: number
  errors?: string[]
  runBy?: string
  runAt: string
}

function toDTO(row: any): NightAuditLogDTO {
  return {
    id: row.id,
    businessDate: row.businessDate,
    source: row.source,
    status: row.status,
    roomChargesPosted: row.roomChargesPosted,
    noShowsMarked: row.noShowsMarked,
    errors: Array.isArray(row.errors) ? row.errors : undefined,
    runBy: row.runBy ?? undefined,
    runAt: row.runAt.toISOString(),
  }
}

export async function listNightAuditLogs(tenantId: string, limit = 60): Promise<NightAuditLogDTO[]> {
  const rows = await prisma.nightAuditLog.findMany({
    where: { tenantId },
    orderBy: { runAt: 'desc' },
    take: limit,
  })
  return rows.map(toDTO)
}

export async function createNightAuditLog(
  tenantId: string,
  data: {
    businessDate: string
    source: 'cron' | 'manual'
    status?: 'completed' | 'failed'
    roomChargesPosted: number
    noShowsMarked: number
    errors?: string[]
    runBy?: string
  },
): Promise<NightAuditLogDTO> {
  const row = await prisma.nightAuditLog.create({
    data: {
      tenantId,
      businessDate: data.businessDate,
      source: data.source,
      status: data.status || 'completed',
      roomChargesPosted: data.roomChargesPosted,
      noShowsMarked: data.noShowsMarked,
      errors: data.errors && data.errors.length > 0 ? data.errors : undefined,
      runBy: data.runBy || undefined,
    },
  })
  return toDTO(row)
}
