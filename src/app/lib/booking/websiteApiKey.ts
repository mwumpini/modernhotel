import { randomBytes, timingSafeEqual } from 'crypto';
import { prisma } from '@/app/lib/database/client';
import { PLATFORM_SUBDOMAIN } from '@/app/lib/platform/operatorRole';

/** A key the operator can hand to the person building that hotel's website. */
export function newBookingApiKey(): string {
  return `bk_${randomBytes(24).toString('base64url')}`;
}

export function readBookingApiKey(metadata: unknown): string | null {
  const key = metadata && typeof metadata === 'object' ? (metadata as { bookingApiKey?: unknown }).bookingApiKey : undefined;
  return typeof key === 'string' && key.startsWith('bk_') && key.length >= 20 && key.length <= 80 ? key : null;
}

function sameKey(stored: string, given: string): boolean {
  const left = Buffer.from(stored);
  const right = Buffer.from(given);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Hotels opened before this existed get a key the first time the operator opens them. */
export async function ensureBookingApiKey(id: string): Promise<string> {
  const hotel = await prisma.tenant.findUnique({ where: { id }, select: { metadata: true, subdomain: true } });
  if (!hotel || hotel.subdomain === PLATFORM_SUBDOMAIN) throw new Error('Hotel not found.');
  const existing = readBookingApiKey(hotel.metadata);
  if (existing) return existing;
  const bookingApiKey = newBookingApiKey();
  const meta = hotel.metadata && typeof hotel.metadata === 'object' ? (hotel.metadata as Record<string, unknown>) : {};
  await prisma.tenant.update({ where: { id }, data: { metadata: { ...meta, bookingApiKey } } });
  return bookingApiKey;
}

export async function tenantForBookingKey(key: string) {
  const given = key.trim();
  if (!readBookingApiKey({ bookingApiKey: given })) return null;
  const rows = await prisma.tenant.findMany({
    where: { subdomain: { not: PLATFORM_SUBDOMAIN } },
    select: { id: true, name: true, subdomain: true, status: true, metadata: true },
  });
  return rows.find((row) => {
    const stored = readBookingApiKey(row.metadata);
    return stored != null && sameKey(stored, given);
  }) ?? null;
}
