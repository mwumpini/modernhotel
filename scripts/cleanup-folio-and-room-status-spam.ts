/**
 * One-off cleanup for two runaway client-side write loops (both fixed in code):
 *
 * 1. Duplicate GuestFolio rows — frontoffice/store.ts posted a first-night Room
 *    Charge on a phantom folio before /api/folios had loaded, then persisted it:
 *    one extra row per checked-in reservation per page load. Every render also
 *    re-PUT every folio unchanged, writing a FOLIO_UPSERTED audit row each time.
 * 2. "Reconciled: guest already checked in" RoomStatusLog rows — housekeeping/
 *    store.ts compared against a Settings-seeded 'vacant' default instead of the
 *    persisted status, so it re-logged every in-house room on every page load
 *    (plus a paired ROOM_STATUS_CHANGED audit row).
 *
 * Only removes rows that carry no information the kept rows don't already have:
 *   - GuestFolio: per reservation (main and 'split' folios grouped separately)
 *     keep the row the app itself reads — most charges+payments, tie → most
 *     recently updated (frontoffice/helpers/folio.ts findMainFolio over a list
 *     ordered by updatedAt desc; server-side findMainGuestFolio agrees). Another
 *     row is deleted only if every charge/payment on it is already on the kept
 *     row (matched by content, not id — each phantom minted fresh line ids) and
 *     no FBOrder.folioId points at it. Anything else is left alone and listed.
 *   - RoomStatusLog: a "Reconciled" row is deleted when that room's previous log
 *     already said 'occupied' (not a real status change).
 *   - AuditLog: FOLIO_UPSERTED rows for deleted folios, or repeating the previous
 *     FOLIO_UPSERTED snapshot (status + balance) for the same folio; and the
 *     ROOM_STATUS_CHANGED row written alongside each deleted reconcile log.
 *
 * Dry run by default (prints counts, changes nothing):
 *   npx tsx scripts/cleanup-folio-and-room-status-spam.ts [--db path/to/test.db]
 * Apply (copies the database to <db>.bak-<timestamp> first):
 *   npx tsx scripts/cleanup-folio-and-room-status-spam.ts --apply [--vacuum] [--db ...]
 *
 * Stop dev servers still running the old code first, or they'll keep re-adding rows.
 */
import { PrismaClient } from '@prisma/client';
import { copyFileSync, existsSync } from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VACUUM = args.includes('--vacuum');
const dbArg = args[args.indexOf('--db') + 1];
const dbPath = path.resolve(args.includes('--db') && dbArg ? dbArg : path.join(__dirname, '..', 'prisma', 'test.db'));
if (!existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);

const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

type Line = Record<string, any>;
const lines = (x: unknown): Line[] => (Array.isArray(x) ? (x as Line[]) : []);
const day = (d: unknown) => String(d || '').slice(0, 10);
const chargeKey = (c: Line) => JSON.stringify(['C', c.description, day(c.date), Number(c.amount) || 0, Number(c.tax) || 0]);
const paymentKey = (p: Line) => JSON.stringify(['P', p.method, Number(p.amount) || 0, day(p.date), p.status || 'completed']);
const weight = (f: { charges: unknown; payments: unknown }) => lines(f.charges).length + lines(f.payments).length;

async function planFolios() {
  const folios = await prisma.guestFolio.findMany({
    select: { id: true, tenantId: true, reservationId: true, type: true, charges: true, payments: true, updatedAt: true },
  });
  const referenced = new Set(
    (await prisma.fBOrder.findMany({ where: { folioId: { not: null } }, select: { folioId: true } })).map((o) => o.folioId as string),
  );
  const groups = new Map<string, typeof folios>();
  for (const f of folios) {
    const key = [f.tenantId, f.reservationId, f.type === 'split' ? 'split' : 'main'].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  const deleteIds: string[] = [];
  const kept: Array<{ reservationId: string; kind: string; keep: string; deleting: number; leftAlone: string[] }> = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    group.sort((a, b) => weight(b) - weight(a) || b.updatedAt.getTime() - a.updatedAt.getTime());
    const [keep, ...rest] = group;
    const keepKeys = new Set([...lines(keep.charges).map(chargeKey), ...lines(keep.payments).map(paymentKey)]);
    const leftAlone: string[] = [];
    let deleting = 0;
    for (const f of rest) {
      const redundant = [...lines(f.charges).map(chargeKey), ...lines(f.payments).map(paymentKey)].every((k) => keepKeys.has(k));
      if (redundant && !referenced.has(f.id)) { deleteIds.push(f.id); deleting++; }
      else leftAlone.push(f.id + (referenced.has(f.id) ? ' (F&B order)' : ` (${weight(f)} lines not on ${keep.id})`));
    }
    const [, reservationId, kind] = key.split('|');
    kept.push({ reservationId, kind, keep: keep.id, deleting, leftAlone });
  }
  return { total: folios.length, deleteIds, kept };
}

async function planRoomStatus() {
  const logs = await prisma.roomStatusLog.findMany({
    select: { id: true, tenantId: true, roomNumber: true, toStatus: true, reason: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const lastStatus = new Map<string, string>();
  const deleteLogs: typeof logs = [];
  for (const log of logs) {
    const room = `${log.tenantId}|${log.roomNumber}`;
    const redundant = log.reason === 'Reconciled: guest already checked in' && lastStatus.get(room) === 'occupied';
    if (redundant) deleteLogs.push(log);
    else lastStatus.set(room, log.toStatus);
  }

  // Each room-status POST wrote a ROOM_STATUS_CHANGED audit row a few ms after
  // its log row (entityId is null — no Room table), so pair them by time.
  const audits = await prisma.auditLog.findMany({
    where: { action: 'ROOM_STATUS_CHANGED', oldValues: '{"status":"vacant"}', newValues: '{"status":"occupied"}' },
    select: { id: true, tenantId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  const auditDeleteIds: string[] = [];
  const used = new Set<string>();
  let i = 0;
  for (const log of deleteLogs) {
    const t = log.createdAt.getTime();
    while (i < audits.length && audits[i].createdAt.getTime() < t - 50) i++;
    for (let j = i; j < audits.length && audits[j].createdAt.getTime() <= t + 2000; j++) {
      if (!used.has(audits[j].id) && audits[j].tenantId === log.tenantId) {
        used.add(audits[j].id);
        auditDeleteIds.push(audits[j].id);
        break;
      }
    }
  }
  return { total: logs.length, deleteIds: deleteLogs.map((l) => l.id), auditDeleteIds };
}

async function planFolioAudits(deletedFolioIds: Set<string>) {
  const rows = await prisma.auditLog.findMany({
    where: { action: 'FOLIO_UPSERTED' },
    select: { id: true, entityId: true, newValues: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const previous = new Map<string, string | null>();
  const forDeletedFolio: string[] = [];
  const repeats: string[] = [];
  for (const row of rows) {
    const folioId = row.entityId || '';
    if (deletedFolioIds.has(folioId)) { forDeletedFolio.push(row.id); continue; }
    if (previous.has(folioId) && previous.get(folioId) === row.newValues) repeats.push(row.id);
    else previous.set(folioId, row.newValues);
  }
  return { total: rows.length, forDeletedFolio, repeats };
}

async function deleteInChunks(ids: string[], del: (chunk: string[]) => Promise<{ count: number }>) {
  let count = 0;
  for (let i = 0; i < ids.length; i += 500) count += (await del(ids.slice(i, i + 500))).count;
  return count;
}

async function main() {
  console.log(`Database: ${dbPath}`);
  console.log(APPLY ? 'Mode: APPLY\n' : 'Mode: dry run (pass --apply to delete)\n');

  const folios = await planFolios();
  const status = await planRoomStatus();
  const folioAudits = await planFolioAudits(new Set(folios.deleteIds));

  console.log('GuestFolio');
  for (const g of folios.kept) {
    console.log(`  ${g.reservationId} [${g.kind}] keep ${g.keep}, delete ${g.deleting}` +
      (g.leftAlone.length ? `, left alone ${g.leftAlone.length}: ${g.leftAlone.join(', ')}` : ''));
  }
  console.log(`  total ${folios.total} → delete ${folios.deleteIds.length}, remaining ${folios.total - folios.deleteIds.length}\n`);
  console.log('RoomStatusLog');
  console.log(`  total ${status.total} → delete ${status.deleteIds.length} redundant "Reconciled" rows, remaining ${status.total - status.deleteIds.length}\n`);
  console.log('AuditLog');
  console.log(`  FOLIO_UPSERTED total ${folioAudits.total} → delete ${folioAudits.forDeletedFolio.length} (deleted folios) + ${folioAudits.repeats.length} (repeat snapshots), remaining ${folioAudits.total - folioAudits.forDeletedFolio.length - folioAudits.repeats.length}`);
  console.log(`  ROOM_STATUS_CHANGED paired with deleted reconcile logs → delete ${status.auditDeleteIds.length}\n`);

  if (!APPLY) return;

  const backup = `${dbPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  await prisma.$disconnect();
  copyFileSync(dbPath, backup);
  console.log(`Backup written: ${backup}`);

  const auditIds = [...folioAudits.forDeletedFolio, ...folioAudits.repeats, ...status.auditDeleteIds];
  const done = {
    guestFolio: await deleteInChunks(folios.deleteIds, (ids) => prisma.guestFolio.deleteMany({ where: { id: { in: ids } } })),
    roomStatusLog: await deleteInChunks(status.deleteIds, (ids) => prisma.roomStatusLog.deleteMany({ where: { id: { in: ids } } })),
    auditLog: await deleteInChunks(auditIds, (ids) => prisma.auditLog.deleteMany({ where: { id: { in: ids } } })),
  };
  console.log('Deleted:', done);
  if (VACUUM) {
    await prisma.$executeRawUnsafe('VACUUM');
    console.log('VACUUM done');
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
