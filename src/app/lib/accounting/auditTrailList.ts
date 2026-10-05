import { prisma } from '@/app/lib/database/client';
import type { AuditTrail } from './models';

const ENTITIES = ['JournalEntry', 'Invoice', 'Payment'];

function trailAction(action: string): AuditTrail['action'] {
  const a = action.toUpperCase();
  if (a.includes('VOID')) return 'Void';
  if (a.includes('DELETE')) return 'Delete';
  if (a.includes('POST') || a === 'JOURNAL_ENTRY_CREATED') return 'Post';
  return a.includes('CREATE') ? 'Create' : 'Update';
}

/** Recent accounting audit rows for one hotel. Capped so opening the books stays quick. */
export async function listAccountingAuditTrail(tenantId: string): Promise<AuditTrail[]> {
  const logs = await prisma.auditLog.findMany({
    where: { tenantId, entity: { in: ENTITIES } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const userIds = [...new Set(logs.map((l) => l.userId).filter((id): id is string => !!id))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const names = new Map(users.map((u) => [u.id, u.name || u.email || u.id]));

  return logs.map((log) => {
    let newValues: Record<string, unknown> | undefined;
    if (log.newValues) {
      try { newValues = JSON.parse(log.newValues); } catch { newValues = { detail: log.newValues }; }
    }
    return {
      id: log.id,
      tableName: log.entity,
      recordId: log.entityId || '',
      action: trailAction(log.action),
      newValues: { event: log.action, ...(newValues || {}) },
      userId: (log.userId && names.get(log.userId)) || log.userId || 'system',
      timestamp: log.createdAt.toISOString(),
      ipAddress: log.ipAddress || undefined,
    };
  });
}
