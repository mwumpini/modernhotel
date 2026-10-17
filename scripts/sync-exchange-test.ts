/**
 * Two databases, one playing the cloud and one the hotel computer.
 * Run: npx tsx scripts/sync-exchange-test.ts
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { alignTenantId, backfill, exchangeWith, logLocalWrite, serializeRow, type SyncEntry } from '../src/app/lib/sync/engine'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agm-sync-'))
const tenantId = 'tenant-sync-test'
const cloudNode = 'cloud'
const premisesNode = 'premises-test'

function fileUrl(name: string): string {
  return `file:${path.join(dir, name).replace(/\\/g, '/')}`
}

function push(url: string) {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'prisma', 'build', 'index.js'),
    'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', path.join(root, 'prisma', 'schema.prisma'),
  ], {
    cwd: root,
    env: { ...process.env, SQLITE_DATABASE_URL: url, CI: '1' },
    stdio: 'inherit',
  })
}

function fail(message: string): never {
  console.error(`FAIL ${message}`)
  process.exit(1)
}

async function guestName(db: PrismaClient, id: string): Promise<string | null> {
  const row = await db.guest.findUnique({ where: { id } })
  return row?.name ?? null
}

async function logGuest(db: PrismaClient, nodeId: string, guest: { id: string; name: string; phone?: string | null }, at: string) {
  const row = await db.guest.upsert({
    where: { id: guest.id },
    create: {
      id: guest.id,
      tenantId,
      serialNumber: guest.id,
      name: guest.name,
      phone: guest.phone ?? null,
    },
    update: { name: guest.name, phone: guest.phone ?? null },
  })
  const entry: SyncEntry = {
    id: `${nodeId}:${guest.id}:${at}`,
    tenantId,
    nodeId,
    model: 'Guest',
    recordId: guest.id,
    op: 'upsert',
    at,
    payload: { ...serializeRow(row), name: guest.name, phone: guest.phone ?? null },
  }
  await logLocalWrite(db, entry)
}

async function main() {
  const cloudUrl = fileUrl('cloud.db')
  const premisesUrl = fileUrl('premises.db')
  push(cloudUrl)
  push(premisesUrl)
  const cloud = new PrismaClient({ datasourceUrl: cloudUrl })
  const premises = new PrismaClient({ datasourceUrl: premisesUrl })
  const tenant = {
    id: tenantId,
    name: 'Sync Hotel',
    subdomain: 'sync-hotel',
    features: {},
    metadata: {},
  }
  await cloud.tenant.create({ data: tenant })
  await premises.tenant.create({ data: tenant })

  await logGuest(cloud, cloudNode, { id: 'guest-ama', name: 'Ama Mensah', phone: '0244000001' }, '2026-10-17T10:00:00.000Z')
  await logGuest(premises, premisesNode, { id: 'guest-kojo', name: 'Kojo Boateng', phone: '0244000002' }, '2026-10-17T10:05:00.000Z')

  let cursor = (await exchangeWith(premises, cloud, tenantId, premisesNode, cloudNode, null)).cursor
  if (await guestName(cloud, 'guest-kojo') !== 'Kojo Boateng') fail('cloud did not receive the premises guest')
  if (await guestName(premises, 'guest-ama') !== 'Ama Mensah') fail('premises did not receive the cloud guest')

  await logGuest(premises, premisesNode, { id: 'guest-ama', name: 'Ama Mensah', phone: '0555000009' }, '2026-10-17T11:00:00.000Z')
  cursor = (await exchangeWith(premises, cloud, tenantId, premisesNode, cloudNode, cursor)).cursor
  const amaOnCloud = await cloud.guest.findUnique({ where: { id: 'guest-ama' } })
  if (amaOnCloud?.phone !== '0555000009') fail('a premises edit did not reach the cloud')

  await cloud.guest.delete({ where: { id: 'guest-kojo' } })
  await logLocalWrite(cloud, {
    id: 'cloud:delete:kojo',
    tenantId,
    nodeId: cloudNode,
    model: 'Guest',
    recordId: 'guest-kojo',
    op: 'delete',
    at: '2026-10-17T12:00:00.000Z',
    payload: null,
  })
  cursor = (await exchangeWith(premises, cloud, tenantId, premisesNode, cloudNode, cursor)).cursor
  if (await premises.guest.findUnique({ where: { id: 'guest-kojo' } })) fail('a cloud delete did not reach the premises')
  if (await cloud.guest.findUnique({ where: { id: 'guest-kojo' } })) fail('the cloud delete did not remove the guest')

  await logGuest(cloud, cloudNode, { id: 'guest-ama', name: 'Ama From Home', phone: '0555000009' }, '2026-10-17T13:00:00.000Z')
  await logGuest(premises, premisesNode, { id: 'guest-ama', name: 'Ama From Desk', phone: '0555000009' }, '2026-10-17T12:30:00.000Z')
  cursor = (await exchangeWith(premises, cloud, tenantId, premisesNode, cloudNode, cursor)).cursor
  if (await guestName(premises, 'guest-ama') !== 'Ama From Home') fail('the later home change did not win')
  if (await guestName(cloud, 'guest-ama') !== 'Ama From Home') fail('the cloud lost the later home change')

  await premises.guest.create({
    data: { id: 'guest-efua', tenantId, serialNumber: 'guest-efua', name: 'Efua Darko' },
  })
  const filled = await backfill(premises, tenantId, premisesNode)
  if (filled < 1) fail('existing premises records were not prepared for the first link')
  cursor = (await exchangeWith(premises, cloud, tenantId, premisesNode, cloudNode, cursor)).cursor
  if (await guestName(cloud, 'guest-efua') !== 'Efua Darko') fail('an existing premises guest did not reach the cloud')

  const again = await exchangeWith(premises, cloud, tenantId, premisesNode, cloudNode, cursor)
  if (again.pulled !== 0) fail('a repeated sync applied changes that were already shared')

  const stayGuest = await premises.guest.create({
    data: { id: 'guest-stay', tenantId, serialNumber: 'guest-stay', name: 'Stay Guest' },
  })
  await logLocalWrite(premises, {
    id: 'premises:guest-stay',
    tenantId,
    nodeId: premisesNode,
    model: 'Guest',
    recordId: stayGuest.id,
    op: 'upsert',
    at: '2026-10-17T14:00:00.000Z',
    payload: serializeRow(stayGuest),
  })
  await premises.reservation.create({
    data: {
      id: 'res-stay',
      tenantId,
      guestId: stayGuest.id,
      status: 'confirmed',
      checkInDate: new Date('2026-10-20T00:00:00.000Z'),
      checkOutDate: new Date('2026-10-22T00:00:00.000Z'),
    },
  })
  const stay = await premises.reservation.findUnique({ where: { id: 'res-stay' } })
  if (!stay) fail('could not create the premises reservation')
  await logLocalWrite(premises, {
    id: 'premises:res-stay',
    tenantId,
    nodeId: premisesNode,
    model: 'Reservation',
    recordId: stay.id,
    op: 'upsert',
    at: '2026-10-17T14:01:00.000Z',
    payload: serializeRow(stay),
  })
  cursor = (await exchangeWith(premises, cloud, tenantId, premisesNode, cloudNode, cursor)).cursor
  const cloudStay = await cloud.reservation.findUnique({ where: { id: 'res-stay' } })
  if (!cloudStay || cloudStay.guestId !== 'guest-stay') fail('a premises reservation did not reach the cloud')

  const other = new PrismaClient({ datasourceUrl: premisesUrl })
  const oldId = 'tenant-old-local'
  await other.tenant.create({ data: { id: oldId, name: 'Old', subdomain: 'old-local', features: {}, metadata: {} } })
  await other.guest.create({ data: { id: 'guest-old', tenantId: oldId, serialNumber: 'guest-old', name: 'Old Guest' } })
  await alignTenantId(other, oldId, 'tenant-aligned')
  const alignedGuest = await other.guest.findUnique({ where: { id: 'guest-old' } })
  const alignedTenant = await other.tenant.findUnique({ where: { id: 'tenant-aligned' } })
  if (alignedGuest?.tenantId !== 'tenant-aligned' || !alignedTenant) fail('the hotel computer did not take the cloud hotel id')
  await other.$disconnect()

  await cloud.$disconnect()
  await premises.$disconnect()
  console.log('PASS premises and cloud share the same guests, both ways, and the later change wins')
  console.log(dir)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
