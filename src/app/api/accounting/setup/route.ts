import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { prisma } from '@/app/lib/database/client'

const CHART_OF_ACCOUNTS = [
  { code: '1000', name: 'Current Assets', type: 'Asset', category: 'Current Assets', level: 1 },
  { code: '1100', name: 'Cash and Cash Equivalents', type: 'Asset', category: 'Current Assets', level: 2 },
  { code: '1110', name: 'Cash in Hand', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1120', name: 'Bank Accounts', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1200', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets', level: 2 },
  { code: '1210', name: 'Guest Accounts Receivable', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1220', name: 'Other Receivables', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1230', name: 'WHT Receivable', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1240', name: 'WHT-VAT Receivable', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1300', name: 'Inventory', type: 'Asset', category: 'Current Assets', level: 2 },
  { code: '1310', name: 'Food and Beverage Inventory', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1320', name: 'Housekeeping Supplies', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1330', name: 'Operating Supplies', type: 'Asset', category: 'Current Assets', level: 3 },
  { code: '1400', name: 'Prepaid Expenses', type: 'Asset', category: 'Current Assets', level: 2 },
  { code: '1500', name: 'Fixed Assets', type: 'Asset', category: 'Fixed Assets', level: 1 },
  { code: '1510', name: 'Property and Equipment', type: 'Asset', category: 'Fixed Assets', level: 2 },
  { code: '1520', name: 'Accumulated Depreciation', type: 'Asset', category: 'Fixed Assets', level: 2 },
  { code: '2000', name: 'Current Liabilities', type: 'Liability', category: 'Current Liabilities', level: 1 },
  { code: '2100', name: 'Tax Payables', type: 'Liability', category: 'Current Liabilities', level: 2 },
  { code: '2110', name: 'VAT Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2120', name: 'NHIL Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2130', name: 'GETFund Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2140', name: 'COVID-19 Levy Payable (legacy)', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2150', name: 'Tourism Levy Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2160', name: 'Withholding Tax Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2200', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities', level: 2 },
  { code: '2210', name: 'PAYE Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2220', name: 'SSNIT & Tier-1 Contributions Payable', type: 'Liability', category: 'Current Liabilities', level: 3 },
  { code: '2300', name: 'Accrued Expenses', type: 'Liability', category: 'Current Liabilities', level: 2 },
  { code: '2400', name: 'Deferred Revenue', type: 'Liability', category: 'Current Liabilities', level: 2 },
  { code: '3000', name: "Owner's Equity", type: 'Equity', category: 'Equity', level: 1 },
  { code: '3100', name: 'Share Capital', type: 'Equity', category: 'Equity', level: 2 },
  { code: '3200', name: 'Retained Earnings', type: 'Equity', category: 'Equity', level: 2 },
  { code: '3300', name: 'Current Year Earnings', type: 'Equity', category: 'Equity', level: 2 },
  { code: '4000', name: 'Operating Revenue', type: 'Revenue', category: 'Revenue', level: 1 },
  { code: '4100', name: 'Room Revenue', type: 'Revenue', category: 'Revenue', level: 2 },
  { code: '4200', name: 'Food and Beverage Revenue', type: 'Revenue', category: 'Revenue', level: 2 },
  { code: '4300', name: 'Other Revenue', type: 'Revenue', category: 'Revenue', level: 2 },
  { code: '4400', name: 'Service Charges', type: 'Revenue', category: 'Revenue', level: 2 },
  { code: '4500', name: 'Miscellaneous Revenue', type: 'Revenue', category: 'Revenue', level: 2 },
  { code: '5000', name: 'Operating Expenses', type: 'Expense', category: 'Expenses', level: 1 },
  { code: '5100', name: 'Cost of Goods Sold', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5110', name: 'Food and Beverage Cost', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5200', name: 'Payroll Expenses', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5210', name: 'Salaries and Wages', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5220', name: 'Employee Benefits', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5300', name: 'Utilities', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5400', name: 'Maintenance and Repairs', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5500', name: 'Marketing and Advertising', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5600', name: 'Administrative Expenses', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5700', name: 'Depreciation Expense', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '5710', name: 'Depreciation - Property & Equipment', type: 'Expense', category: 'Expenses', level: 3 },
  { code: '5800', name: 'Tax Expenses', type: 'Expense', category: 'Expenses', level: 2 },
  { code: '6000', name: 'General Expenses', type: 'Expense', category: 'Expenses', level: 2 },
]

const GHANA_TAXES = [
  { code: 'VAT', name: 'Value Added Tax', rate: 15.0, type: 'VAT', isInclusive: false },
  { code: 'NHIL', name: 'National Health Insurance Levy', rate: 2.5, type: 'NHIL', isInclusive: false },
  { code: 'GETFUND', name: 'Ghana Education Trust Fund', rate: 2.5, type: 'GETFund', isInclusive: false },
  { code: 'TOURISM', name: 'Tourism Development Levy', rate: 1.0, type: 'Tourism', isInclusive: false },
  { code: 'WITHHOLDING', name: 'Withholding Tax', rate: 5.0, type: 'Withholding', isInclusive: false },
]

const PAYMENT_METHODS = [
  { code: 'CASH', name: 'Cash' },
  { code: 'CARD', name: 'Credit/Debit Card' },
  { code: 'MOMO', name: 'Mobile Money' },
  { code: 'BANK', name: 'Bank Transfer' },
  { code: 'CHEQUE', name: 'Cheque' },
  { code: 'CREDIT', name: 'Credit (Guest Account)' },
  { code: 'CORP', name: 'Corporate Billing' },
]

// POST /api/accounting/setup — idempotent, safe to call multiple times
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { tenantId } = ctx

    // Seed Chart of Accounts
    for (const account of CHART_OF_ACCOUNTS) {
      await prisma.account.upsert({
        where: { tenantId_code: { tenantId, code: account.code } },
        update: { name: account.name },
        create: { tenantId, ...account, isActive: true },
      })
    }

    // Seed Tax Configs
    for (const tax of GHANA_TAXES) {
      await prisma.tax.upsert({
        where: { tenantId_code: { tenantId, code: tax.code } },
        update: { rate: tax.rate, isActive: true },
        create: { tenantId, ...tax, isActive: true },
      })
    }

    // Seed Payment Methods
    for (const pm of PAYMENT_METHODS) {
      await prisma.paymentMethod.upsert({
        where: { tenantId_code: { tenantId, code: pm.code } },
        update: {},
        create: { tenantId, ...pm, isActive: true },
      })
    }

    const accountCount = await prisma.account.count({ where: { tenantId } })
    const taxCount = await prisma.tax.count({ where: { tenantId } })

    return NextResponse.json({
      success: true,
      message: 'Accounting setup complete',
      accounts: accountCount,
      taxes: taxCount,
    })
  } catch (error) {
    console.error('[accounting/setup] error', error)
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 })
  }
}

// GET /api/accounting/setup — check if setup has been done
export async function GET(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { tenantId } = ctx
    const accountCount = await prisma.account.count({ where: { tenantId } })
    const taxCount = await prisma.tax.count({ where: { tenantId } })

    return NextResponse.json({
      initialized: accountCount > 0,
      accounts: accountCount,
      taxes: taxCount,
    })
  } catch (error) {
    console.error('[accounting/setup] GET error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
