import { prisma } from '@/app/lib/database/client';
import { listReportingRules, listTaxRules, listTaxTypes } from '@/app/lib/compliance/repository';

const GHANA_COUNTRY = 'GH';

/**
 * Starter rooms for a new Ghana hotel. Nightly amounts are before tax;
 * the compliance engine adds the tax when a stay is quoted.
 * Standard ₵200, Deluxe ₵350, Executive ₵600 — five rooms of each.
 */
const STARTER_TYPES = [
  { key: 'standard', name: 'Standard', baseRate: 200, capacity: 2, floor: '1', from: 101 },
  { key: 'deluxe', name: 'Deluxe', baseRate: 350, capacity: 2, floor: '2', from: 201 },
  { key: 'executive', name: 'Executive', baseRate: 600, capacity: 3, floor: '3', from: 301 },
] as const;

const ROOMS_PER_TYPE = 5;

function starterRooms() {
  const roomTypes = STARTER_TYPES.map((type) => ({
    id: `rt_${type.key}`,
    name: type.name,
    baseRate: type.baseRate,
    capacity: type.capacity,
    amenities: ['wifi', 'air_conditioning', 'tv'],
    isActive: true,
    category: type.key,
    description: '',
    images: [],
    policies: { cancellation: '24 hours before arrival', deposit: false, smoking: false, pets: false },
  }));
  const rooms = STARTER_TYPES.flatMap((type) =>
    Array.from({ length: ROOMS_PER_TYPE }, (_, index) => {
      const number = String(type.from + index);
      return {
        id: `rm_${number}`,
        number,
        typeId: `rt_${type.key}`,
        floor: type.floor,
        status: 'vacant',
        isActive: true,
        notes: '',
        features: [],
        maintenance: { lastInspection: '', nextInspection: '', issues: [] },
      };
    }),
  );
  const ratePlans = STARTER_TYPES.map((type) => ({
    id: `rp_${type.key}`,
    name: type.name,
    roomTypeId: `rt_${type.key}`,
    basePrice: type.baseRate,
    isActive: true,
    marketSegment: 'leisure',
    mealPlan: 'room_only',
    rateType: 'standard',
    restrictions: { minStay: 1, maxStay: 30, advanceBooking: 0, cancellationPolicy: '24 hours before arrival' },
    seasonalRates: [],
    dayOfWeekRates: [],
  }));
  return { roomTypes, rooms, ratePlans };
}

const STARTER_STATUSES = [
  { id: 'vacant', name: 'Vacant', color: '#22c55e', description: 'Ready to sell', isActive: true, canBook: true, requiresAction: false },
  { id: 'occupied', name: 'Occupied', color: '#3b82f6', description: 'Guest in room', isActive: true, canBook: false, requiresAction: false },
  { id: 'dirty', name: 'Dirty', color: '#f59e0b', description: 'Needs cleaning', isActive: true, canBook: false, requiresAction: true },
  { id: 'ooo', name: 'Out of Order', color: '#ef4444', description: 'Maintenance required', isActive: true, canBook: false, requiresAction: true },
];

function taxTypeOf(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('withholding')) return 'Withholding';
  if (n.includes('vat')) return 'VAT';
  if (n.includes('nhil')) return 'NHIL';
  if (n.includes('getfund') || n.includes('get fund')) return 'GETFund';
  if (n.includes('tourism')) return 'Tourism';
  return 'Other';
}

/** Copy the loaded Ghana sales rules into the tax table night audit and the restaurant read. Rates stay in the compliance seed. */
async function mirrorComplianceTaxes(tenantId: string) {
  const rules = await listTaxRules(tenantId, GHANA_COUNTRY);
  const sales = rules.filter((rule) => {
    const row = rule as { domain?: string; rate?: unknown; id?: string; name?: string };
    return row.domain === 'sales' && typeof row.rate === 'number' && Number.isFinite(row.rate) && row.id && row.name;
  });
  for (const rule of sales) {
    const row = rule as { id: string; name: string; rate: number; enabled?: boolean };
    await prisma.tax.upsert({
      where: { tenantId_code: { tenantId, code: row.id } },
      update: { name: row.name, rate: row.rate, type: taxTypeOf(row.name), isActive: row.enabled !== false },
      create: {
        tenantId,
        code: row.id,
        name: row.name,
        rate: row.rate,
        type: taxTypeOf(row.name),
        isInclusive: false,
        isActive: row.enabled !== false,
      },
    });
  }
  const live = new Set(sales.map((rule) => String((rule as { id: string }).id)));
  if (live.size === 0) return;
  await prisma.tax.updateMany({
    where: { tenantId, code: { in: ['VAT', 'NHIL', 'GETFUND', 'TOURISM', 'WITHHOLDING'] }, NOT: { code: { in: [...live] } } },
    data: { isActive: false },
  });
}

/** Loads Ghana's compliance pack from the tax seed (not copied rates) and the starter rooms. */
export async function provisionGhanaHotel(tenantId: string, hotelName: string, options?: { replaceIfUnused?: boolean }) {
  await listTaxRules(tenantId, GHANA_COUNTRY);
  await listTaxTypes(tenantId, GHANA_COUNTRY);
  await listReportingRules(tenantId, GHANA_COUNTRY);
  await mirrorComplianceTaxes(tenantId);
  await installStarterRooms(tenantId, hotelName, options?.replaceIfUnused === true);
}

async function installStarterRooms(tenantId: string, hotelName: string, replaceIfUnused: boolean) {
  const settings = await prisma.systemSettings.findUnique({ where: { tenantId } });
  if (!settings) return;
  const roomSettings = (settings.roomSettings as Record<string, unknown>) || {};
  const existingTypes = Array.isArray(roomSettings.roomTypes)
    ? roomSettings.roomTypes.filter((row) => row && typeof row === 'object' && (row as { id?: string }).id)
    : [];
  const hotelSettings = (settings.hotelSettings as Record<string, unknown>) || {};
  const financialSettings = (settings.financialSettings as Record<string, unknown>) || {};
  const stays = await prisma.reservation.count({ where: { tenantId } });
  const unused = stays === 0;
  const writeRooms = unused && (existingTypes.length === 0 || replaceIfUnused);

  if (!writeRooms) {
    if (!hotelSettings.hotelName) {
      await prisma.systemSettings.update({
        where: { tenantId },
        data: { hotelSettings: { ...hotelSettings, hotelName } },
      });
    }
    return;
  }

  const starter = starterRooms();
  const existingStatuses = Array.isArray(roomSettings.roomStatuses) ? roomSettings.roomStatuses : [];
  await prisma.systemSettings.update({
    where: { tenantId },
    data: {
      hotelSettings: { ...hotelSettings, hotelName: hotelSettings.hotelName || hotelName },
      financialSettings: {
        ...financialSettings,
        defaultCurrency: 'GHS',
        supportedCurrencies: ['GHS'],
        taxInclusive: false,
      },
      roomSettings: {
        ...roomSettings,
        ...starter,
        roomStatuses: existingStatuses.length > 0 && !replaceIfUnused ? existingStatuses : STARTER_STATUSES,
      },
    },
  });

  if (unused) await prisma.room.deleteMany({ where: { tenantId } });
  const roomCount = await prisma.room.count({ where: { tenantId } });
  if (roomCount > 0) return;

  let property = await prisma.property.findFirst({ where: { tenantId } });
  if (!property) {
    property = await prisma.property.create({
      data: {
        tenantId,
        name: hotelName,
        address: '',
        city: '',
        state: '',
        country: 'Ghana',
        timezone: 'Africa/Accra',
        currency: 'GHS',
      },
    });
  }
  await prisma.room.createMany({
    data: starter.rooms.map((room) => ({
      tenantId,
      propertyId: property.id,
      roomNumber: room.number,
      roomType: STARTER_TYPES.find((type) => `rt_${type.key}` === room.typeId)?.name || room.typeId,
      floor: Number(room.floor),
      features: [],
      status: 'clean',
    })),
  });
}
