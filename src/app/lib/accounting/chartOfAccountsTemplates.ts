'use client';

/**
 * Country-keyed chart-of-accounts templates for multi-tenant / multi-country SaaS.
 * Ghana is the default; additional countries register here as compliance expands.
 */

import { GHANA_CHART_OF_ACCOUNTS } from './models';
import type { ChartOfAccounts } from './models';

export type CoaTemplateRow = (typeof GHANA_CHART_OF_ACCOUNTS)[number];

export type CountryChartTemplate = {
  countryCode: string;
  currency: string;
  rows: CoaTemplateRow[];
};

const CHART_TEMPLATES: Record<string, CountryChartTemplate> = {
  GH: {
    countryCode: 'GH',
    currency: 'GHS',
    rows: GHANA_CHART_OF_ACCOUNTS,
  },
};

const DEFAULT_COUNTRY = 'GH';

/** Resolve ISO country from Setup wizard (via compliance resolver). */
export function resolveAccountingCountryCode(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim().toUpperCase();
  try {
    // Lazy require avoids circular imports with settings/compliance on server.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveComplianceCountry } = require('../compliance/resolveCountry') as {
      resolveComplianceCountry: () => string;
    };
    const code = resolveComplianceCountry();
    if (code) return code.toUpperCase();
  } catch {
    /* settings not ready */
  }
  return DEFAULT_COUNTRY;
}

export function getChartTemplate(countryCode?: string): CountryChartTemplate {
  const code = (countryCode ?? resolveAccountingCountryCode()).toUpperCase();
  return CHART_TEMPLATES[code] ?? CHART_TEMPLATES[DEFAULT_COUNTRY];
}

export function listSupportedAccountingCountries(): string[] {
  return Object.keys(CHART_TEMPLATES);
}

function mapCoaType(raw: string): ChartOfAccounts['type'] {
  if (raw === 'Asset') return 'Asset';
  if (raw === 'Liability') return 'Liability';
  if (raw === 'Equity') return 'Equity';
  if (raw === 'Revenue') return 'Revenue';
  return 'Expense';
}

/** Build store-ready COA rows for the tenant's country. */
export function buildChartOfAccountsFromTemplate(countryCode?: string): ChartOfAccounts[] {
  const tpl = getChartTemplate(countryCode);
  const ts = new Date().toISOString();
  return tpl.rows.map((account, index) => ({
    id: `${tpl.countryCode}-coa-${index + 1}`,
    code: account.code,
    name: account.name,
    type: mapCoaType(account.type),
    category: account.category,
    level: account.level,
    currency: tpl.currency,
    isActive: true,
    createdAt: ts,
    updatedAt: ts,
  }));
}
