'use client';

/**
 * Tenant-level accounting runtime flags and locale helpers.
 * Designed for multi-country SaaS: country comes from Setup / compliance,
 * not from hard-coded Ghana assumptions in UI code.
 */

import { getChartTemplate, resolveAccountingCountryCode } from './chartOfAccountsTemplates';

/** Demo/sample transactions (events, room flows, fictional partners). Off in production. */
export function isAccountingDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

/**
 * Legacy lodge UI: hides COA, bank, reports, PPE from nav.
 * Default is full finance module (lean off). Prefer role-based views long term.
 */
export function isLeanAccountingUI(): boolean {
  return process.env.NEXT_PUBLIC_LEAN_MODE === 'true';
}

export function getTenantAccountingCountryCode(): string {
  return resolveAccountingCountryCode();
}

export function getTenantAccountingCurrency(): string {
  return getChartTemplate(getTenantAccountingCountryCode()).currency;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GHS: '₵',
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  KES: 'KSh',
  ZAR: 'R',
};

export function formatAccountingCurrency(amount: number, currency?: string): string {
  const code = (currency ?? getTenantAccountingCurrency()).toUpperCase();
  const sym = CURRENCY_SYMBOLS[code] ?? code;
  return `${sym}${Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
