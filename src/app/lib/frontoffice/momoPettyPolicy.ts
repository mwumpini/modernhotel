import { prisma } from '../database/client'

/** Hotel-wide. On: a petty expense can be paid from the MoMo device. Off: cash drawer only. */
export async function readMomoPetty(tenantId: string): Promise<boolean> {
  const row = await prisma.systemSettings.findUnique({ where: { tenantId }, select: { generalSettings: true } })
  const general = (row?.generalSettings as Record<string, unknown>) || {}
  const cashier = general.cashier as Record<string, unknown> | undefined
  return cashier?.momoPetty !== false
}

export async function saveMomoPetty(tenantId: string, enabled: boolean): Promise<boolean> {
  const existing = await prisma.systemSettings.findUnique({ where: { tenantId } })
  const general = (existing?.generalSettings as Record<string, unknown>) || {}
  const cashier = (general.cashier as Record<string, unknown>) || {}
  const generalSettings = { ...general, cashier: { ...cashier, momoPetty: enabled } }
  await prisma.systemSettings.upsert({
    where: { tenantId },
    update: { generalSettings },
    create: {
      tenantId,
      generalSettings,
      hotelSettings: {},
      roomSettings: {},
      financialSettings: {},
      clientSettings: {},
      saasSettings: {},
    },
  })
  return enabled
}
