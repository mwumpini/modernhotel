import { prisma } from '@/app/lib/database/client';
import { computeTaxStack } from '@/app/lib/compliance/calcEngine';
import { listTaxRules } from '@/app/lib/compliance/repository';
import type { TaxRule } from '@/app/lib/models';
import { createGuestRow, createReservationRow } from '@/app/lib/frontoffice/repository';
import { hotelSignInOpen } from '@/app/lib/platform/billing';
import { tenantForBookingKey } from './websiteApiKey';

const ACTIVE = ['pending', 'confirmed', 'checked-in'] as const;
const MAX_NIGHTS = 30;

type RoomRow = {
  id: string;
  number: string;
  typeId: string;
  status: string;
  isActive: boolean;
};

type TypeRow = { id: string; name: string; baseRate: number; capacity: number; isActive: boolean };

type StatusRow = { id: string; canBook?: boolean };

export type WebsiteRoomOffer = {
  id: string;
  number: string;
  type: string;
  typeName: string;
  nightlyRate: number;
  nightlyTotal: number;
  stayTotal: number;
  guests: number;
  taxes: { name: string; amount: number }[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseDay(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return value;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nightsBetween(arrival: string, departure: string): number {
  const ms = new Date(`${departure}T00:00:00.000Z`).getTime() - new Date(`${arrival}T00:00:00.000Z`).getTime();
  return Math.round(ms / 86_400_000);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readInventory(roomSettings: unknown): { rooms: RoomRow[]; types: TypeRow[]; statuses: StatusRow[] } {
  const settings = asRecord(roomSettings);
  const types = (Array.isArray(settings.roomTypes) ? settings.roomTypes : []).flatMap((row) => {
    const item = asRecord(row);
    const id = typeof item.id === 'string' ? item.id : '';
    const baseRate = typeof item.baseRate === 'number' ? item.baseRate : Number(item.baseRate);
    if (!id || !Number.isFinite(baseRate) || baseRate < 0) return [];
    return [{
      id,
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : id,
      baseRate,
      capacity: typeof item.capacity === 'number' && item.capacity > 0 ? Math.floor(item.capacity) : 2,
      isActive: item.isActive !== false,
    }];
  });
  const rooms = (Array.isArray(settings.rooms) ? settings.rooms : []).flatMap((row) => {
    const item = asRecord(row);
    const id = typeof item.id === 'string' ? item.id : '';
    const number = item.number == null ? '' : String(item.number).trim();
    const typeId = typeof item.typeId === 'string' ? item.typeId : '';
    if (!id || !number || !typeId) return [];
    return [{
      id,
      number,
      typeId,
      status: typeof item.status === 'string' ? item.status : 'vacant',
      isActive: item.isActive !== false,
    }];
  });
  const statuses = (Array.isArray(settings.roomStatuses) ? settings.roomStatuses : []).flatMap((row) => {
    const item = asRecord(row);
    const id = typeof item.id === 'string' ? item.id : '';
    if (!id) return [];
    return [{ id, ...(typeof item.canBook === 'boolean' ? { canBook: item.canBook } : {}) }];
  });
  return { rooms, types, statuses };
}

function canSell(status: string, statuses: StatusRow[]): boolean {
  const row = statuses.find((item) => item.id === status);
  if (row && typeof row.canBook === 'boolean') return row.canBook;
  return status !== 'occupied' && status !== 'dirty' && status !== 'ooo';
}

function quoteStay(rules: TaxRule[], nightlyExclusive: number, nights: number) {
  const exclusive = round2(nightlyExclusive * nights);
  const quoted = computeTaxStack(rules, exclusive, 'HOTEL', { domain: 'sales', operation: 'external' });
  const stayTotal = round2(quoted.total);
  const each = nights > 0 ? round2(stayTotal / nights) : stayTotal;
  const shares = Array.from({ length: nights }, () => each);
  if (nights > 0) {
    const drift = round2(stayTotal - each * nights);
    shares[nights - 1] = round2(shares[nights - 1] + drift);
  }
  return {
    nightlyTotal: nights > 0 ? round2(stayTotal / nights) : stayTotal,
    stayTotal,
    shares,
    taxes: quoted.taxes.map((line) => ({ name: line.name, amount: round2(line.amount) })),
  };
}

export function readApiKey(request: Request): string {
  const header = request.headers.get('authorization') || '';
  const bearer = header.match(/^Bearer\s+(\S+)\s*$/i);
  if (bearer) return bearer[1];
  return (request.headers.get('x-api-key') || '').trim();
}

export async function hotelForRequest(request: Request) {
  const hotel = await tenantForBookingKey(readApiKey(request));
  if (!hotel) return { error: 'That booking key was not recognized.' as const, status: 401 as const };
  if (!hotelSignInOpen(hotel.status, hotel.metadata)) {
    return { error: 'This hotel is not taking website bookings.' as const, status: 403 as const };
  }
  return { hotel };
}

export function stayWindow(arrivalRaw: unknown, departureRaw: unknown): { arrival: string; departure: string; nights: number } | { error: string } {
  const arrival = parseDay(arrivalRaw);
  const departure = parseDay(departureRaw);
  if (!arrival || !departure) return { error: 'Send arrival and departure as YYYY-MM-DD.' };
  if (arrival < todayUTC()) return { error: 'Arrival cannot be before today.' };
  const nights = nightsBetween(arrival, departure);
  if (nights < 1) return { error: 'Departure must be after arrival.' };
  if (nights > MAX_NIGHTS) return { error: `A website booking can be at most ${MAX_NIGHTS} nights.` };
  return { arrival, departure, nights };
}

export async function listWebsiteRooms(
  tenantId: string,
  arrival: string,
  departure: string,
  guests = 1,
): Promise<{ currency: string; rooms: WebsiteRoomOffer[] }> {
  const settings = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { roomSettings: true, financialSettings: true },
  });
  const inventory = readInventory(settings?.roomSettings);
  const currencyRaw = asRecord(settings?.financialSettings).defaultCurrency;
  const currency = typeof currencyRaw === 'string' && currencyRaw.trim() ? currencyRaw.trim() : 'GHS';
  const types = new Map(inventory.types.filter((type) => type.isActive).map((type) => [type.id, type]));
  const sellable = inventory.rooms.filter((room) => room.isActive && types.has(room.typeId) && canSell(room.status, inventory.statuses));

  const overlapping = await prisma.reservation.findMany({
    where: {
      tenantId,
      status: { in: [...ACTIVE] },
      checkInDate: { lt: new Date(`${departure}T00:00:00.000Z`) },
      checkOutDate: { gt: new Date(`${arrival}T00:00:00.000Z`) },
    },
    select: { roomId: true, roomType: true },
  });

  const held = new Set<string>();
  const looseByType = new Map<string, number>();
  for (const row of overlapping) {
    const match = sellable.find((room) => row.roomId && (row.roomId === room.id || row.roomId === room.number));
    if (match) held.add(match.id);
    else {
      const typeKey = row.roomType || '';
      looseByType.set(typeKey, (looseByType.get(typeKey) || 0) + 1);
    }
  }

  const rules = (await listTaxRules(tenantId, 'GH')) as TaxRule[];
  const nights = nightsBetween(arrival, departure);
  const byType = new Map<string, RoomRow[]>();
  for (const room of sellable) {
    if (held.has(room.id)) continue;
    const type = types.get(room.typeId);
    if (!type || guests > type.capacity) continue;
    const list = byType.get(room.typeId) || [];
    list.push(room);
    byType.set(room.typeId, list);
  }

  const offered: WebsiteRoomOffer[] = [];
  for (const [typeId, rooms] of byType) {
    const type = types.get(typeId);
    if (!type) continue;
    const loose = (looseByType.get(typeId) || 0) + (type.name !== typeId ? looseByType.get(type.name) || 0 : 0);
    const free = [...rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    const visible = free.slice(0, Math.max(0, free.length - loose));
    const quote = quoteStay(rules, type.baseRate, nights);
    for (const room of visible) {
      offered.push({
        id: room.id,
        number: room.number,
        type: type.id,
        typeName: type.name,
        nightlyRate: round2(type.baseRate),
        nightlyTotal: quote.nightlyTotal,
        stayTotal: quote.stayTotal,
        guests: type.capacity,
        taxes: quote.taxes,
      });
    }
  }

  offered.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  return { currency, rooms: offered };
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) return null;
  return name;
}

export async function createWebsiteBooking(
  tenantId: string,
  input: {
    arrival: string;
    departure: string;
    nights: number;
    roomId: unknown;
    guestName: unknown;
    phone: unknown;
    email: unknown;
    adults: unknown;
    children: unknown;
    notes: unknown;
  },
) {
  const roomId = typeof input.roomId === 'string' ? input.roomId.trim() : '';
  if (!roomId) return { error: 'Send the room id from the availability list.' as const, status: 400 as const };
  const guestName = cleanName(input.guestName);
  if (!guestName) return { error: 'Enter the guest name.' as const, status: 400 as const };
  const phone = typeof input.phone === 'string' ? input.phone.trim().slice(0, 40) : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase().slice(0, 120) : '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email, or leave it blank.' as const, status: 400 as const };
  if (!phone && !email) return { error: 'Send a phone number or an email so the hotel can reach the guest.' as const, status: 400 as const };
  const adults = input.adults == null || input.adults === '' ? 1 : Number(input.adults);
  const children = input.children == null || input.children === '' ? 0 : Number(input.children);
  if (!Number.isInteger(adults) || adults < 1 || adults > 10) return { error: 'Adults must be a whole number from 1 to 10.' as const, status: 400 as const };
  if (!Number.isInteger(children) || children < 0 || children > 10) return { error: 'Children must be a whole number from 0 to 10.' as const, status: 400 as const };
  const notes = typeof input.notes === 'string' ? input.notes.trim().slice(0, 400) : '';

  const offered = await listWebsiteRooms(tenantId, input.arrival, input.departure, adults + children);
  const room = offered.rooms.find((item) => item.id === roomId);
  if (!room) return { error: 'That room is not free for those dates.' as const, status: 409 as const };

  const [firstName, ...rest] = guestName.split(' ');
  const guest = await createGuestRow(tenantId, {
    name: guestName,
    firstName,
    lastName: rest.join(' '),
    phone: phone || undefined,
    email: email || undefined,
    source: 'online',
    notes: 'Booked from the hotel website.',
  });

  const dates = Array.from({ length: input.nights }, (_, index) => addDays(input.arrival, index));
  const settings = await prisma.systemSettings.findUnique({ where: { tenantId }, select: { roomSettings: true } });
  const type = readInventory(settings?.roomSettings).types.find((item) => item.id === room.type);
  const rules = (await listTaxRules(tenantId, 'GH')) as TaxRule[];
  const quote = quoteStay(rules, type?.baseRate ?? room.nightlyRate, input.nights);
  const rateBreakdown = dates.map((date, index) => ({
    date,
    base: round2(type?.baseRate ?? room.nightlyRate),
    total: quote.shares[index] ?? quote.nightlyTotal,
    roomId: room.id,
  }));

  const reservation = await createReservationRow(tenantId, guest.id, {
    resId: `W${Date.now().toString(36).toUpperCase()}`,
    guestName,
    guestPhone: phone || undefined,
    guestEmail: email || undefined,
    roomId: room.id,
    roomTypeId: room.type,
    arrival: `${input.arrival}T00:00:00.000Z`,
    departure: `${input.departure}T00:00:00.000Z`,
    adults,
    children,
    status: 'confirmed',
    source: 'Website',
    isGuaranteed: false,
    paymentStatus: 'pending',
    remarksToGuest: notes || undefined,
    internalNotes: 'Booked from the hotel website. The hotel collects payment.',
    rateBreakdown,
  });
  await prisma.reservation.update({ where: { id: reservation.id }, data: { totalAmount: quote.stayTotal } });

  return {
    booking: {
      reservationId: reservation.resId || reservation.id,
      status: 'confirmed',
      payment: 'unpaid',
      roomId: room.id,
      roomNumber: room.number,
      typeName: room.typeName,
      arrival: input.arrival,
      departure: input.departure,
      nights: input.nights,
      guestName,
      currency: offered.currency,
      total: quote.stayTotal,
      taxes: quote.taxes,
      note: 'The hotel collects this amount. Nothing was charged here.',
    },
  };
}
