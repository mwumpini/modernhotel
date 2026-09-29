import { prisma } from '@/app/lib/database/client';

/**
 * Hotel-wide POS behaviour, kept with the other server-side settings (SystemSettings.generalSettings.pos)
 * so every terminal follows the same rule.
 *
 * waiterSwitch: on a shared terminal, staff tap their name and type their PIN before an order goes to the
 * kitchen, and the terminal locks again after each order. Off (the default): orders are recorded under
 * whoever is signed in, with no extra step.
 */
export type PosPolicy = { waiterSwitch: boolean };

export const DEFAULT_POS_POLICY: PosPolicy = { waiterSwitch: false };

const EMPTY_JSON = {} as const;

export function normalizePosPolicy(raw: unknown): PosPolicy {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { waiterSwitch: typeof src.waiterSwitch === 'boolean' ? src.waiterSwitch : DEFAULT_POS_POLICY.waiterSwitch };
}

export async function readTenantPos(tenantId: string): Promise<PosPolicy> {
  const row = await prisma.systemSettings.findUnique({ where: { tenantId }, select: { generalSettings: true } });
  const general = (row?.generalSettings as Record<string, unknown>) || {};
  return normalizePosPolicy(general.pos);
}

export async function saveTenantPos(tenantId: string, raw: unknown): Promise<PosPolicy> {
  const policy = normalizePosPolicy(raw);
  const existing = await prisma.systemSettings.findUnique({ where: { tenantId } });
  const generalSettings = { ...((existing?.generalSettings as Record<string, unknown>) || {}), pos: policy };
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
  });
  return policy;
}
