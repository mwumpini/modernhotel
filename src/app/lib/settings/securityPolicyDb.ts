import { prisma } from '@/app/lib/database/client';
import { normalizeSecurityPolicy, securityFromGeneral, type SecurityPolicy } from './securityPolicy';

const EMPTY_JSON = {} as const;

export async function readTenantSecurity(tenantId: string): Promise<{ configured: boolean; policy: SecurityPolicy }> {
  const row = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { generalSettings: true },
  });
  return securityFromGeneral(row?.generalSettings);
}

export async function saveTenantSecurity(tenantId: string, raw: unknown): Promise<SecurityPolicy> {
  const policy = normalizeSecurityPolicy(raw);
  const existing = await prisma.systemSettings.findUnique({ where: { tenantId } });
  const generalSettings = {
    ...((existing?.generalSettings as Record<string, unknown>) || {}),
    security: policy,
  };
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
