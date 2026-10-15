import { prisma } from '@/app/lib/database/client';
import { listReportingRules, listTaxRules, listTaxTypes } from '@/app/lib/compliance/repository';
import { ensureDefaultPaymentAccounts, ensureMobileMoneyGlAccount } from '@/app/lib/accounting/repository';
import { planStandardDepartments } from '@/app/lib/hr/standardDepartments';
import { applyPaidModules, readPaidModules } from '@/app/lib/platform/hotelModules';
import type { ModuleSettings } from '@/app/lib/settings/store';

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

/** Loads Ghana's compliance pack and the starter rooms. */
export async function provisionGhanaHotel(tenantId: string, hotelName: string, options?: { replaceIfUnused?: boolean }) {
  await listTaxRules(tenantId, GHANA_COUNTRY);
  await listTaxTypes(tenantId, GHANA_COUNTRY);
  await listReportingRules(tenantId, GHANA_COUNTRY);
  await ensureMobileMoneyGlAccount(tenantId);
  await ensureDefaultPaymentAccounts(tenantId);
  await installStarterRooms(tenantId, hotelName, options?.replaceIfUnused === true);
  await ensureStandardDepartments(tenantId);
}

/** Departments and jobs for the modules this hotel has. Ones already there are left as they are. */
export async function ensureStandardDepartments(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { subdomain: true, metadata: true } });
  if (!tenant) return;
  const paid = readPaidModules(tenant.metadata);
  const modules: ModuleSettings = applyPaidModules({
    frontOffice: true,
    housekeeping: true,
    foodBeverage: true,
    inventory: true,
    accounting: true,
    hr: true,
    security: true,
    compliance: true,
    maintenance: true,
    analytics: true,
    kitchenTerminal: true,
  }, paid);
  const [departments, positions] = await Promise.all([
    prisma.hrDepartment.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.hrPosition.findMany({ where: { tenantId }, select: { title: true, departmentId: true } }),
  ]);
  const plan = planStandardDepartments({ tenant: tenant.subdomain, modules, departments, positions });
  if (plan.departments.length) {
    await prisma.hrDepartment.createMany({
      data: plan.departments.map((d) => ({
        id: d.id, tenantId, name: d.name, code: d.code, description: d.description, budget: 0, location: '', isActive: true, status: 'active',
      })),
    });
  }
  if (plan.positions.length) {
    await prisma.hrPosition.createMany({
      data: plan.positions.map((p) => ({
        id: p.id, tenantId, title: p.title, code: p.code, departmentId: p.departmentId, description: p.description, isActive: true, status: 'active',
      })),
    });
  }
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
