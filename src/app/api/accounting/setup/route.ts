import { NextRequest, NextResponse } from 'next/server'
import { AccountType } from '@prisma/client'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { buildPrebuiltChartOfAccounts } from '@/app/lib/accounting/prebuiltChartOfAccounts'
import { seedChartOfAccountsForTenant } from '@/app/lib/accounting/seedChartOfAccounts'
import { bootstrapTaxConfigsForCountry } from '@/app/lib/accounting/taxFromConfig'
import { prisma } from '@/app/lib/database/client'

const ACCOUNT_TYPE_MAP: Record<string, AccountType> = {
  Asset: AccountType.ASSET,
  Liability: AccountType.LIABILITY,
  Equity: AccountType.EQUITY,
  Revenue: AccountType.REVENUE,
  Expense: AccountType.EXPENSE,
  'Cost of Sales': AccountType.EXPENSE,
  'Operating Expense': AccountType.EXPENSE,
  Contra: AccountType.ASSET,
}

/** Resolve the tenant's ISO country code from metadata; defaults to Ghana until
 * onboarding captures it explicitly for every tenant. */
function resolveTenantCountryCode(tenant: any): string {
  const meta = (tenant?.metadata ?? {}) as Record<string, unknown>
  const raw = meta.countryCode ?? meta.country
  if (typeof raw === 'string' && raw.trim()) {
    const code = raw.trim().toUpperCase()
    // Legacy demo tenants store a free-text region like "ghana" rather than an ISO code.
    return code === 'GHANA' ? 'GH' : code
  }
  return 'GH'
}

const PAYMENT_METHODS = [
  { code: 'CASH', name: 'Cash', type: 'cash' },
  { code: 'CARD', name: 'Credit/Debit Card', type: 'card' },
  { code: 'MOMO', name: 'Mobile Money', type: 'mobile_money' },
  { code: 'BANK', name: 'Bank Transfer', type: 'bank_transfer' },
  { code: 'CHEQUE', name: 'Cheque', type: 'cheque' },
  { code: 'CREDIT', name: 'Credit (Guest Account)', type: 'credit' },
  { code: 'CORP', name: 'Corporate Billing', type: 'corporate' },
]

// POST /api/accounting/setup — idempotent, safe to call multiple times
export async function POST(request: NextRequest) {
  try {
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { tenantId } = ctx
    const countryCode = resolveTenantCountryCode(ctx.tenant)

    const prebuilt = buildPrebuiltChartOfAccounts(countryCode)
    await seedChartOfAccountsForTenant(
      prisma,
      tenantId,
      prebuilt.map((a) => ({
        code: a.code,
        name: a.name,
        type: a.type,
        level: a.level,
        category: a.category,
        parentId: a.parentId,
        position: a.position,
      })),
      ACCOUNT_TYPE_MAP
    )

    // Seed Tax Configs — country-aware; unsupported countries get no taxes seeded
    // here rather than silently inheriting Ghana's rates.
    const taxConfigs = bootstrapTaxConfigsForCountry(countryCode)
    for (const tax of taxConfigs) {
      await prisma.tax.upsert({
        where: { tenantId_code: { tenantId, code: tax.code } },
        update: { rate: tax.rate, isActive: tax.isActive },
        create: {
          tenantId,
          code: tax.code,
          name: tax.name,
          rate: tax.rate,
          type: tax.type,
          isInclusive: false,
          isActive: tax.isActive,
        },
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
