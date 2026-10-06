import bcrypt from 'bcryptjs';
import { prisma } from '@/app/lib/database/client';
import { passwordPolicyError } from '@/app/lib/settings/passwordPolicy';
import { DEFAULT_SECURITY_POLICY } from '@/app/lib/settings/securityPolicy';
import { ensureDefaultRolesForTenant } from '@/app/lib/settings/roleRepository';
import { findUserForLogin } from '@/app/lib/auth/loginLookup';
import { addDaysISO, nextPaidUntil, onFreeTrial, parseMonthlyFee, parseTrialDays, paymentDue, readBill, readExpenses, readPayments, readTrial, todayISO } from '@/app/lib/platform/billing';
import { frontDeskOnly, normalizePaidModules, readPaidModules, type PaidModules } from '@/app/lib/platform/hotelModules';

import { OPERATOR_ROLE, PLATFORM_SUBDOMAIN } from './operatorRole';
export { OPERATOR_ROLE, PLATFORM_SUBDOMAIN, isPlatformOperator } from './operatorRole';

const RESERVED_SUBDOMAINS = new Set([
  'platform',
  'www',
  'api',
  'admin',
  'app',
  'localhost',
  'default',
]);

export type HotelHosting = 'cloud' | 'local' | 'sync';

export function hotelSubdomain(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(s)) return null;
  if (RESERVED_SUBDOMAINS.has(s)) return null;
  return s;
}

export function hostingOf(metadata: unknown): HotelHosting {
  const hosting = metadata && typeof metadata === 'object' ? (metadata as { hosting?: string }).hosting : undefined;
  if (hosting === 'local' || hosting === 'sync') return hosting;
  return 'cloud';
}

/** Creates the landlord tenant and its sign-in, once. Re-running does not reset the password. */
export async function ensurePlatformOperator() {
  const isProd = process.env.NODE_ENV === 'production';
  const password = process.env.PLATFORM_OPERATOR_PASSWORD || (isProd ? '' : 'password123');
  if (!password) return null;
  const email = (process.env.PLATFORM_OPERATOR_EMAIL || 'operator@platform.local').trim().toLowerCase();

  const tenant = await prisma.tenant.upsert({
    where: { subdomain: PLATFORM_SUBDOMAIN },
    update: {},
    create: {
      name: 'Platform',
      subdomain: PLATFORM_SUBDOMAIN,
      plan: 'operator',
      status: 'active',
      maxUsers: 1,
      maxRooms: 0,
      maxProperties: 0,
      features: {},
      metadata: { kind: 'operator' },
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: {},
    create: {
      tenantId: tenant.id,
      email,
      name: 'Operator',
      password: await bcrypt.hash(password, 12),
      role: OPERATOR_ROLE,
      permissions: [],
      isActive: true,
    },
  });

  return tenant;
}

export async function resolveLoginTenant(subdomain: string) {
  let tenant = await prisma.tenant.findUnique({ where: { subdomain } });
  if (!tenant && subdomain === PLATFORM_SUBDOMAIN && process.env.NODE_ENV !== 'production') {
    await ensurePlatformOperator();
    tenant = await prisma.tenant.findUnique({ where: { subdomain } });
  }
  return tenant;
}

/** The operator can sign in even when the hotel box is left on another hotel. */
export async function operatorSignIn(login: string, password: string) {
  const tenant = await resolveLoginTenant(PLATFORM_SUBDOMAIN);
  if (!tenant || tenant.status !== 'active') return null;
  const user = await findUserForLogin(tenant.id, login);
  if (!user || user.role !== OPERATOR_ROLE || !user.isActive || !user.password) return null;
  if (!(await bcrypt.compare(password, user.password))) return null;
  return { tenant, user };
}

function presentHotel(row: { id: string; name: string; subdomain: string; status: string; metadata: unknown; createdAt: Date }) {
  const bill = readBill(row.metadata);
  return {
    id: row.id,
    name: row.name,
    subdomain: row.subdomain,
    status: row.status,
    hosting: hostingOf(row.metadata),
    monthlyFee: bill.monthlyFee,
    paidUntil: bill.paidUntil,
    paymentDue: paymentDue(bill.paidUntil),
    trialDays: readTrial(row.metadata).days,
    trialEndsOn: readTrial(row.metadata).endsOn,
    onTrial: onFreeTrial(row.metadata),
    payments: readPayments(row.metadata),
    modules: readPaidModules(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listHotels() {
  const rows = await prisma.tenant.findMany({
    where: { subdomain: { not: PLATFORM_SUBDOMAIN } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, subdomain: true, status: true, metadata: true, createdAt: true },
  });
  return rows.map(presentHotel);
}

export async function openHotel(input: {
  name: string;
  subdomain: string;
  hosting: HotelHosting;
  monthlyFee: unknown;
  trialDays: unknown;
  adminName: string;
  adminEmail: string;
  password: string;
  modules?: unknown;
}) {
  const subdomain = hotelSubdomain(input.subdomain);
  if (!subdomain) {
    return { error: 'Tenant ID uses letters, numbers, and hyphens.' };
  }
  const name = input.name.trim();
  const adminName = input.adminName.trim();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  if (name.length < 2) return { error: 'Enter the hotel name.' };
  if (adminName.length < 2) return { error: 'Enter the first admin’s name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return { error: 'Enter a valid admin email.' };
  const passwordError = passwordPolicyError(input.password, DEFAULT_SECURITY_POLICY.passwordPolicy);
  if (passwordError) return { error: passwordError };
  if (input.hosting !== 'cloud' && input.hosting !== 'local' && input.hosting !== 'sync') return { error: 'Choose where this hotel runs.' };
  const monthlyFee = parseMonthlyFee(input.monthlyFee);
  if (monthlyFee == null) return { error: 'Enter a monthly fee in cedis.' };
  const trialDays = parseTrialDays(input.trialDays);
  if (trialDays == null) return { error: 'Enter the free trial in whole days, from 0 to 365.' };

  const taken = await prisma.tenant.findUnique({ where: { subdomain }, select: { id: true } });
  if (taken) return { error: 'That Tenant ID is already used.' };

  const today = todayISO();
  const trialEndsOn = trialDays > 0 ? addDaysISO(today, trialDays) : null;
  const paidUntil = trialEndsOn ?? today;
  const hotel = await prisma.tenant.create({
    data: {
      name,
      subdomain,
      plan: 'starter',
      status: 'active',
      maxUsers: 5,
      maxRooms: 20,
      maxProperties: 1,
      features: {},
      metadata: {
        hosting: input.hosting,
        monthlyFee,
        paidUntil,
        payments: [],
        ...(trialDays > 0 ? { trialDays, trialEndsOn } : {}),
        region: 'ghana',
        industry: 'hospitality',
        modules: input.modules == null ? frontDeskOnly() : normalizePaidModules(input.modules),
      },
    },
  });

  await prisma.user.create({
    data: {
      tenantId: hotel.id,
      email: adminEmail,
      name: adminName,
      password: await bcrypt.hash(input.password, 12),
      role: 'admin',
      permissions: ['*'],
      isActive: true,
      preferences: { passwordChangedAt: new Date().toISOString() },
    },
  });

  await prisma.systemSettings.create({
    data: {
      tenantId: hotel.id,
      generalSettings: {},
      hotelSettings: {},
      roomSettings: {},
      financialSettings: {},
      clientSettings: {},
      saasSettings: {},
    },
  });

  await ensureDefaultRolesForTenant(hotel.id);

  return {
    hotel: { ...presentHotel(hotel), adminEmail },
  };
}

export async function setHotelStatus(id: string, status: 'active' | 'suspended') {
  const hotel = await prisma.tenant.findUnique({ where: { id }, select: { id: true, subdomain: true } });
  if (!hotel || hotel.subdomain === PLATFORM_SUBDOMAIN) return { error: 'Hotel not found.' };
  const updated = await prisma.tenant.update({
    where: { id },
    data: { status },
    select: { id: true, name: true, subdomain: true, status: true, metadata: true, createdAt: true },
  });
  return { hotel: presentHotel(updated) };
}

export async function setHotelModules(id: string, raw: unknown) {
  const hotel = await prisma.tenant.findUnique({ where: { id } });
  if (!hotel || hotel.subdomain === PLATFORM_SUBDOMAIN) return { error: 'Hotel not found.' as const };
  const modules: PaidModules = normalizePaidModules(raw);
  const meta = hotel.metadata && typeof hotel.metadata === 'object' && !Array.isArray(hotel.metadata)
    ? (hotel.metadata as Record<string, unknown>)
    : {};
  const updated = await prisma.tenant.update({
    where: { id },
    data: { metadata: { ...meta, modules } },
  });
  return { hotel: presentHotel(updated) };
}

export async function setHotelTrial(id: string, rawDays: unknown) {
  const hotel = await prisma.tenant.findUnique({ where: { id } });
  if (!hotel || hotel.subdomain === PLATFORM_SUBDOMAIN) return { error: 'Hotel not found.' };
  const trialDays = parseTrialDays(rawDays);
  if (trialDays == null) return { error: 'Enter the free trial in whole days, from 0 to 365.' };
  const meta = hotel.metadata && typeof hotel.metadata === 'object' && !Array.isArray(hotel.metadata)
    ? (hotel.metadata as Record<string, unknown>)
    : {};
  if (readPayments(meta).length > 0) return { error: 'This hotel has already paid. Record the next month instead of a free trial.' };
  const today = todayISO();
  const trialEndsOn = trialDays > 0 ? addDaysISO(today, trialDays) : null;
  const paidUntil = trialEndsOn ?? today;
  const { trialDays: _oldDays, trialEndsOn: _oldEnd, ...rest } = meta;
  const updated = await prisma.tenant.update({
    where: { id },
    data: { metadata: trialDays > 0 ? { ...rest, paidUntil, trialDays, trialEndsOn } : { ...rest, paidUntil } },
  });
  return { hotel: presentHotel(updated) };
}

export async function markHotelPaid(id: string) {
  const hotel = await prisma.tenant.findUnique({ where: { id } });
  if (!hotel || hotel.subdomain === PLATFORM_SUBDOMAIN) return { error: 'Hotel not found.' };
  const meta = hotel.metadata && typeof hotel.metadata === 'object' ? (hotel.metadata as Record<string, unknown>) : {};
  const bill = readBill(meta);
  if (bill.monthlyFee == null) return { error: 'This hotel has no monthly fee.' };
  const paidUntil = nextPaidUntil(bill.paidUntil);
  const payments = [...readPayments(meta), { paidOn: todayISO(), amount: bill.monthlyFee, paidUntil }];
  const updated = await prisma.tenant.update({
    where: { id },
    data: { metadata: { ...meta, paidUntil, payments } },
  });
  return { hotel: presentHotel(updated) };
}

export async function getHotel(id: string) {
  const hotel = await prisma.tenant.findUnique({ where: { id } });
  if (!hotel || hotel.subdomain === PLATFORM_SUBDOMAIN) return { error: 'Hotel not found.' as const };
  const [admin, staff, rooms, guests, reservations] = await Promise.all([
    prisma.user.findFirst({
      where: { tenantId: id, role: 'admin' },
      orderBy: { createdAt: 'asc' },
      select: { name: true, email: true, lastLoginAt: true },
    }),
    prisma.user.count({ where: { tenantId: id } }),
    prisma.room.count({ where: { tenantId: id } }),
    prisma.guest.count({ where: { tenantId: id } }),
    prisma.reservation.count({ where: { tenantId: id } }),
  ]);
  return {
    hotel: {
      ...presentHotel(hotel),
      adminName: admin?.name ?? null,
      adminEmail: admin?.email ?? null,
      lastLoginAt: admin?.lastLoginAt ? admin.lastLoginAt.toISOString() : null,
      payments: readPayments(hotel.metadata),
      counts: { staff, rooms, guests, reservations },
    },
  };
}

export async function removeHotel(id: string) {
  const hotel = await prisma.tenant.findUnique({ where: { id }, select: { id: true, subdomain: true } });
  if (!hotel || hotel.subdomain === PLATFORM_SUBDOMAIN) return { error: 'Hotel not found.' as const };
  await prisma.tenant.delete({ where: { id } });
  return { ok: true as const };
}

export async function listCompanyExpenses() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: PLATFORM_SUBDOMAIN }, select: { metadata: true } });
  if (!tenant) return [];
  return readExpenses(tenant.metadata).sort((a, b) => b.paidOn.localeCompare(a.paidOn));
}

export async function addCompanyExpense(input: { paidOn: string; amount: unknown; kind: string; detail: string }) {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: PLATFORM_SUBDOMAIN } });
  if (!tenant) return { error: 'Company record is missing.' as const };
  const amount = parseMonthlyFee(input.amount);
  if (amount == null || amount <= 0) return { error: 'Enter an amount in cedis.' as const };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) return { error: 'Enter the date.' as const };
  const kind = input.kind === 'cloud' || input.kind === 'infrastructure' ? input.kind : null;
  if (!kind) return { error: 'Choose cloud or other infrastructure.' as const };
  const detail = input.detail.trim();
  if (detail.length < 2 || detail.length > 80) return { error: 'Say what this payment was for.' as const };
  const meta = tenant.metadata && typeof tenant.metadata === 'object' && !Array.isArray(tenant.metadata)
    ? (tenant.metadata as Record<string, unknown>)
    : {};
  const expenses = [...readExpenses(meta), { id: crypto.randomUUID(), paidOn: input.paidOn, amount, kind, detail }];
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { metadata: { ...meta, expenses } },
  });
  return { expenses: expenses.sort((a, b) => b.paidOn.localeCompare(a.paidOn)) };
}
