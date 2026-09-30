'use client';

/**
 * Production-safe operational structure (cost / revenue centers).
 * Seeded for every tenant regardless of demo mode — required for folio checkout and departmental GL.
 */

import type { CostCenter, RevenueCenter } from './models';
import { getChartTemplate } from './chartOfAccountsTemplates';

/** GL revenue codes — Ghana hotel template; extend per country template when adding markets. */
const REVENUE_GL_BY_COUNTRY: Record<string, Record<string, string>> = {
  GH: {
    rooms: '4100',
    restaurant: '4210',
    bar: '4220',
    roomService: '4230',
    conference: '4320',
    service: '4400',
  },
};

function revenueGl(countryCode: string, key: keyof (typeof REVENUE_GL_BY_COUNTRY)['GH']): string {
  const map = REVENUE_GL_BY_COUNTRY[countryCode.toUpperCase()] ?? REVENUE_GL_BY_COUNTRY.GH;
  return map[key];
}

export type OperationalAccountingSeed = {
  costCenters: CostCenter[];
  revenueCenters: RevenueCenter[];
};

export function buildOperationalAccountingSeed(countryCode?: string): OperationalAccountingSeed {
  const tpl = getChartTemplate(countryCode);
  const cc = tpl.countryCode;
  const ts = new Date().toISOString();

  const costCenters: CostCenter[] = [
    { id: 'CC-FO', code: 'FO', name: 'Front Office', description: 'Front desk and guest services', type: 'department', department: 'front_office', budget: 0, actualExpenses: 0, isActive: true, createdAt: ts, updatedAt: ts },
    { id: 'CC-HK', code: 'HK', name: 'Housekeeping', description: 'Housekeeping operations', type: 'department', department: 'housekeeping', budget: 0, actualExpenses: 0, isActive: true, createdAt: ts, updatedAt: ts },
    { id: 'CC-FB', code: 'FB', name: 'Food & Beverage', description: 'Restaurant and bar', type: 'department', department: 'food_beverage', budget: 0, actualExpenses: 0, isActive: true, createdAt: ts, updatedAt: ts },
    { id: 'CC-KT', code: 'KT', name: 'Kitchen', description: 'Kitchen operations', type: 'department', department: 'kitchen', budget: 0, actualExpenses: 0, isActive: true, createdAt: ts, updatedAt: ts },
    { id: 'CC-MT', code: 'MT', name: 'Maintenance', description: 'Engineering and maintenance', type: 'department', department: 'maintenance', budget: 0, actualExpenses: 0, isActive: true, createdAt: ts, updatedAt: ts },
    { id: 'CC-AC', code: 'AC', name: 'Accounting', description: 'Finance and accounting', type: 'support', department: 'accounting', budget: 0, actualExpenses: 0, isActive: true, createdAt: ts, updatedAt: ts },
  ];

  const revenueCenters: RevenueCenter[] = [
    { id: 'RC-RM', code: 'RM', name: 'Room Revenue', description: 'Accommodation revenue', type: 'rooms', department: 'front_office', glAccountCode: revenueGl(cc, 'rooms'), budget: 0, actualRevenue: 0, isActive: true, createdAt: ts, updatedAt: ts },
    { id: 'RC-REST', code: 'REST', name: 'Restaurant Revenue', description: 'Restaurant revenue', type: 'food_beverage', department: 'restaurant', glAccountCode: revenueGl(cc, 'restaurant'), budget: 0, actualRevenue: 0, isActive: true, createdAt: ts, updatedAt: ts },
    { id: 'RC-BAR', code: 'BAR', name: 'Bar Revenue', description: 'Bar revenue', type: 'food_beverage', department: 'bar', glAccountCode: revenueGl(cc, 'bar'), budget: 0, actualRevenue: 0, isActive: true, createdAt: ts, updatedAt: ts },
    { id: 'RC-RS', code: 'RS', name: 'Room Service', description: 'Room service revenue', type: 'services', department: 'room_service', glAccountCode: revenueGl(cc, 'roomService'), budget: 0, actualRevenue: 0, isActive: true, createdAt: ts, updatedAt: ts },
    { id: 'RC-CF', code: 'CF', name: 'Conference Revenue', description: 'Conference and events', type: 'conferences', department: 'conference', glAccountCode: revenueGl(cc, 'conference'), budget: 0, actualRevenue: 0, isActive: true, createdAt: ts, updatedAt: ts },
    { id: 'RC-SC', code: 'SC', name: 'Service Charges', description: 'Service charges', type: 'services', department: 'other', glAccountCode: revenueGl(cc, 'service'), budget: 0, actualRevenue: 0, isActive: true, createdAt: ts, updatedAt: ts },
  ];

  return { costCenters, revenueCenters };
}

/** Empty transaction registers for production tenants. */
export const EMPTY_TRANSACTION_SEED = {
  journalEntries: [] as import('./models').JournalEntry[],
  invoices: [] as import('./models').Invoice[],
  payments: [] as import('./models').Payment[],
  whtCertificates: [] as import('./models').WHTCertificate[],
  businessPartners: [] as import('./models').BusinessPartner[],
  bankAccounts: [] as import('./models').BankAccount[],
  bankTransactions: [] as import('./models').BankTransaction[],
  auditTrail: [] as import('./models').AuditTrail[],
};
