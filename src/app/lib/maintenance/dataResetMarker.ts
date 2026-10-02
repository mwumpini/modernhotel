import { prisma } from '@/app/lib/database/client'

/**
 * When a hotel's test data is cleared, the time is kept in SystemSettings.generalSettings.dataResetAt.
 * Every browser compares it with the last reset it has seen and, if it is newer, drops the copies of
 * cleared records it keeps locally — otherwise a tester's browser could push old test records back up
 * to the now-empty server (some screens copy their local list to a server that has none).
 */
const EMPTY_JSON = {} as const

export async function readDataResetAt(tenantId: string): Promise<string | null> {
  const row = await prisma.systemSettings.findUnique({ where: { tenantId }, select: { generalSettings: true } })
  const general = (row?.generalSettings as Record<string, unknown>) || {}
  return typeof general.dataResetAt === 'string' ? general.dataResetAt : null
}

export async function markDataReset(tenantId: string, at = new Date().toISOString()): Promise<string> {
  const existing = await prisma.systemSettings.findUnique({ where: { tenantId } })
  const generalSettings = { ...((existing?.generalSettings as Record<string, unknown>) || {}), dataResetAt: at }
  await prisma.systemSettings.upsert({
    where: { tenantId },
    update: { generalSettings },
    create: {
      tenantId,
      generalSettings,
      hotelSettings: EMPTY_JSON,
      roomSettings: EMPTY_JSON,
      financialSettings: EMPTY_JSON,
      clientSettings: EMPTY_JSON,
      saasSettings: EMPTY_JSON,
    },
  })
  return at
}
