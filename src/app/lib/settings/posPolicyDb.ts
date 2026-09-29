import { prisma } from '@/app/lib/database/client';

/**
 * Hotel-wide POS behaviour, kept with the other server-side settings (SystemSettings.generalSettings.pos)
 * so every terminal follows the same rule.
 *
 * waiterSwitch: on a shared terminal, staff tap their name and type their PIN before an order goes to the
 *   kitchen, and the terminal locks again after each order. Off (the default): orders are recorded under
 *   whoever is signed in, with no extra step.
 * showMenuImages: menu cards show the item's photo (where one was uploaded in Menu & Inventory).
 *   Off (the default): every card shows the plain food / drink icon.
 */
export type PosPolicy = { waiterSwitch: boolean; showMenuImages: boolean };

export const DEFAULT_POS_POLICY: PosPolicy = { waiterSwitch: false, showMenuImages: false };

const EMPTY_JSON = {} as const;

export function normalizePosPolicy(raw: unknown, base: PosPolicy = DEFAULT_POS_POLICY): PosPolicy {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const flag = (key: keyof PosPolicy) => (typeof src[key] === 'boolean' ? (src[key] as boolean) : base[key]);
  return { waiterSwitch: flag('waiterSwitch'), showMenuImages: flag('showMenuImages') };
}

export async function readTenantPos(tenantId: string): Promise<PosPolicy> {
  const row = await prisma.systemSettings.findUnique({ where: { tenantId }, select: { generalSettings: true } });
  const general = (row?.generalSettings as Record<string, unknown>) || {};
  return normalizePosPolicy(general.pos);
}

/** Saves only the switches present in `raw`; the others keep their current value. */
export async function saveTenantPos(tenantId: string, raw: unknown): Promise<PosPolicy> {
  const existing = await prisma.systemSettings.findUnique({ where: { tenantId } });
  const general = (existing?.generalSettings as Record<string, unknown>) || {};
  const policy = normalizePosPolicy(raw, normalizePosPolicy(general.pos));
  const generalSettings = { ...general, pos: policy };
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
