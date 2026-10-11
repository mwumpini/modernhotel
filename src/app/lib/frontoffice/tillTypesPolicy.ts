import { prisma } from '../database/client'
import { normalizeTillTypes, type TillType } from './tillTypes'

function cashierBag(general: Record<string, unknown>) {
  return (general.cashier as Record<string, unknown>) || {}
}

export async function readTillTypes(tenantId: string): Promise<TillType[]> {
  const row = await prisma.systemSettings.findUnique({ where: { tenantId }, select: { generalSettings: true } })
  const general = (row?.generalSettings as Record<string, unknown>) || {}
  const cashier = cashierBag(general)
  const momoSpend = cashier.momoPetty !== false
  return normalizeTillTypes(cashier.tills, momoSpend)
}

export async function saveTillTypes(tenantId: string, raw: unknown): Promise<TillType[]> {
  const existing = await prisma.systemSettings.findUnique({ where: { tenantId } })
  const general = (existing?.generalSettings as Record<string, unknown>) || {}
  const cashier = cashierBag(general)
  const tills = normalizeTillTypes(raw, cashier.momoPetty !== false)
  const momoPetty = tills.some((till) => till.kind === 'momo' && till.active && till.spend)
  const generalSettings = { ...general, cashier: { ...cashier, tills, momoPetty } }
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
  return tills
}
