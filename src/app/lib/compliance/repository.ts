import { prisma } from '../database/client'
import { ComplianceDB } from './db'
import { getSeedTaxes, getSeedReports } from './config'

function toStoreReport(row: any) {
  return {
    id: row.id,
    countryCode: row.countryCode,
    reportType: row.reportType,
    period: row.period,
    dueDate: row.dueDate,
    status: row.status,
    amount: row.amount ?? 0,
    currency: row.currency,
    submittedDate: row.submittedDate ?? undefined,
    notes: row.notes ?? undefined,
    attachments: row.attachments ?? undefined,
  }
}

export async function listComplianceReportFilings(tenantId: string, countryCode?: string) {
  const rows = await prisma.complianceReport.findMany({
    where: { tenantId, countryCode: countryCode || undefined },
    orderBy: { period: 'desc' },
  })
  return rows.map(toStoreReport)
}

/**
 * Find-by-(tenant, country, reportType, period) then update-or-create -- mirrors the
 * in-memory store's upsertReport(), used by payroll's PAYE/SSNIT sync and tax remittance's
 * filing sync (see remittanceLedgerSync.ts / payrollSync.ts).
 */
export async function upsertComplianceReportFilingByKey(tenantId: string, report: {
  countryCode: string
  reportType: string
  period: string
  dueDate: string
  status?: string
  amount?: number
  currency?: string
  submittedDate?: string
  notes?: string
  attachments?: string[]
}) {
  const data = {
    dueDate: report.dueDate,
    status: report.status,
    amount: report.amount,
    currency: report.currency,
    submittedDate: report.submittedDate,
    notes: report.notes,
    attachments: report.attachments,
  }
  const row = await prisma.complianceReport.upsert({
    where: {
      tenantId_countryCode_reportType_period: {
        tenantId,
        countryCode: report.countryCode,
        reportType: report.reportType,
        period: report.period,
      },
    },
    update: data,
    create: {
      tenantId,
      countryCode: report.countryCode,
      reportType: report.reportType,
      period: report.period,
      dueDate: report.dueDate,
      status: report.status || 'pending',
      amount: report.amount ?? 0,
      currency: report.currency || 'GHS',
      submittedDate: report.submittedDate,
      notes: report.notes,
      attachments: report.attachments,
    },
  })
  return toStoreReport(row)
}

/** Direct id-based update -- used by ComplianceReportsPanel.tsx's Submit/Approve buttons,
 * which only have the row's id and a status patch, not its natural key. */
export async function updateComplianceReportFilingById(tenantId: string, id: string, updates: Record<string, any>) {
  const existing = await prisma.complianceReport.findFirst({ where: { id, tenantId } })
  if (!existing) return null
  const row = await prisma.complianceReport.update({
    where: { id },
    data: {
      status: updates.status,
      amount: updates.amount,
      currency: updates.currency,
      submittedDate: updates.submittedDate,
      notes: updates.notes,
      attachments: updates.attachments,
      dueDate: updates.dueDate,
    },
  })
  return toStoreReport(row)
}

// ---------------------------------------------------------------------------
// Tax rules / tax types / reporting-schedule reference data -- tenant-scoped
// replacement for ComplianceDB's shared, non-tenant-scoped JSON files. Each
// row's full shape lives in `data` (a JSON blob matching the store's
// TaxRule/TaxType/ReportingRule types exactly -- rate, glCode, tiers, scope,
// condition, etc.); `code` is the stable client-facing id (e.g. "gh-vat")
// used for upsert/reference/typeId-linking, kept separate from the DB's own
// `id` so a tenant's row and another tenant's row can both use the same
// semantic code without colliding.
// ---------------------------------------------------------------------------

function toStoreTaxRule(row: any) {
  return { ...(row.data as Record<string, any>), id: row.code }
}

/** First-visit-per-(tenant, country) seed only -- mirrors resolveChartOfAccounts's rule
 * elsewhere in this codebase: "first visit loads the prebuilt set; after that, the tenant's
 * own rows (including any they've since deleted) are left alone." If the old shared JSON
 * file already has rows for this country, those are migrated in as this tenant's starting
 * set (preserves whatever was actually configured before this model existed); otherwise
 * falls back to the static seed. */
async function ensureTaxRulesSeeded(tenantId: string, countryCode: string) {
  const existing = await prisma.complianceTaxRule.count({ where: { tenantId, countryCode } })
  if (existing > 0) return
  const legacy = ComplianceDB.getTaxes(countryCode) as Array<Record<string, any>>
  const source = legacy.length > 0 ? legacy : getSeedTaxes().filter((t) => t.countryCode === countryCode)
  if (!source.length) return
  await prisma.complianceTaxRule.createMany({
    data: source.map((t) => ({ tenantId, countryCode, code: String(t.id), data: t })),
  })
}

const ACT_1151_VAT_NOTE = 'VAT 15% of the same taxable value as NHIL and GETFund. Not calculated on top of those levies (Act 1151).'

/** Ghana Act 1151 (1 Jan 2026) for hotels seeded before it: VAT no longer compounds on the
 * levies, NHIL/GETFund become claimable, Tourism is not, and rent WHT splits into 15%
 * commercial + 8% residential. Mirrors the file-side migration in db.ts. Each row is touched
 * once (marked `act1151`), so a hotel's later edits are never overwritten. */
function act1151Patch(data: Record<string, any>): Record<string, any> | null {
  if (data.act1151) return null
  const id = String(data.id || '')
  if (id === 'gh-vat' && (data.calculationBase === 'subtotal_plus_applied' || data.stacking === 'compound')) {
    return { calculationBase: 'subtotal', stacking: 'additive', isRecoverable: true, description: ACT_1151_VAT_NOTE }
  }
  if ((id === 'gh-nhil' || id === 'gh-getfund') && data.isRecoverable !== true) return { isRecoverable: true }
  if (id === 'gh-tourism' && data.isRecoverable === true) return { isRecoverable: false }
  if (id === 'gh-wht-rent' && Number(data.rate) === 8) {
    return {
      name: 'Withholding Tax (Rent — commercial)',
      rate: 15,
      description: 'Resident WHT on rent of non-residential business premises — 15%. Final tax. Residential rent is the separate 8% rule.',
    }
  }
  return null
}

async function migrateAct1151(tenantId: string, countryCode: string, rows: any[]) {
  if (countryCode !== 'GH') return rows
  let changed = false
  let addResidential = false
  for (const row of rows) {
    const data = { ...(row.data as Record<string, any>), id: row.code }
    const patch = act1151Patch(data)
    if (!patch) continue
    if (row.code === 'gh-wht-rent') addResidential = true
    await prisma.complianceTaxRule.update({ where: { id: row.id }, data: { data: { ...data, ...patch, act1151: true } } })
    changed = true
  }
  if (addResidential && !rows.some((r) => r.code === 'gh-wht-rent-residential')) {
    const seed = getSeedTaxes().find((t) => t.id === 'gh-wht-rent-residential')
    if (seed) {
      await prisma.complianceTaxRule.create({ data: { tenantId, countryCode, code: 'gh-wht-rent-residential', data: seed as any } })
      changed = true
    }
  }
  return changed ? prisma.complianceTaxRule.findMany({ where: { tenantId, countryCode } }) : rows
}

export async function listTaxRules(tenantId: string, countryCode: string) {
  await ensureTaxRulesSeeded(tenantId, countryCode)
  const rows = await prisma.complianceTaxRule.findMany({ where: { tenantId, countryCode } })
  return (await migrateAct1151(tenantId, countryCode, rows)).map(toStoreTaxRule)
}

export async function upsertTaxRule(tenantId: string, rule: Record<string, any>) {
  const countryCode = String(rule.countryCode)
  const code = rule.id ? String(rule.id) : `${Date.now()}`
  // Merge into the existing row's data rather than replacing it outright -- matches the old
  // ComplianceDB.upsertTax's `{ ...existing, ...patch }` semantics, which PayrollTaxRatesEditor.tsx
  // relies on: it intentionally PUTs a partial `Partial<TaxRule> & { id }` patch (just the one
  // changed field), not the full rule, so a naive replace would silently drop every other field
  // (appliesTo, enabled, domain, tiers, ...) on every payroll-tax-rate save.
  const existing = await prisma.complianceTaxRule.findUnique({ where: { tenantId_code: { tenantId, code } } })
  const data = existing ? { ...(existing.data as Record<string, any>), ...rule, id: code } : { ...rule, id: code }
  const row = await prisma.complianceTaxRule.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { countryCode, data },
    create: { tenantId, countryCode, code, data },
  })
  return toStoreTaxRule(row)
}

export async function deleteTaxRule(tenantId: string, code: string) {
  const existing = await prisma.complianceTaxRule.findUnique({ where: { tenantId_code: { tenantId, code } } })
  if (!existing) return { deleted: code }
  await prisma.complianceTaxRule.delete({ where: { tenantId_code: { tenantId, code } } })
  return { deleted: code }
}

function toStoreTaxType(row: any) {
  return { ...(row.data as Record<string, any>), id: row.code }
}

async function ensureTaxTypesSeeded(tenantId: string, countryCode: string) {
  const existing = await prisma.complianceTaxType.count({ where: { tenantId, countryCode } })
  if (existing > 0) return
  const legacy = ComplianceDB.getTaxTypes(countryCode) as Array<Record<string, any>>
  if (!legacy.length) return
  await prisma.complianceTaxType.createMany({
    data: legacy.map((t) => ({ tenantId, countryCode, code: String(t.id), data: t })),
  })
}

export async function listTaxTypes(tenantId: string, countryCode: string) {
  await ensureTaxTypesSeeded(tenantId, countryCode)
  const rows = await prisma.complianceTaxType.findMany({ where: { tenantId, countryCode } })
  return rows.map(toStoreTaxType)
}

function normalizeTypeName(s: unknown): string {
  return String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function templateTagsFrom(data: Record<string, any>): string[] {
  return (Array.isArray(data.tags) ? data.tags : []).filter(
    (x: unknown) => typeof x === 'string' && x.startsWith('template:')
  ) as string[]
}

export async function upsertTaxType(tenantId: string, type: Record<string, any>) {
  const countryCode = String(type.countryCode)

  if (type.id) {
    const code = String(type.id)
    // Merge into the existing row rather than replacing outright -- same reasoning as
    // upsertTaxRule above.
    const existing = await prisma.complianceTaxType.findUnique({ where: { tenantId_code: { tenantId, code } } })
    const data = existing ? { ...(existing.data as Record<string, any>), ...type, id: code } : { ...type, id: code }
    const row = await prisma.complianceTaxType.upsert({
      where: { tenantId_code: { tenantId, code } },
      update: { countryCode, data },
      create: { tenantId, countryCode, code, data },
    })
    return toStoreTaxType(row)
  }

  // No id given -- same dedupe-on-create the old ComplianceDB.upsertTaxType did: merge into
  // an existing type in this country that shares a template tag, or (failing that) the same
  // normalized name, instead of creating a near-duplicate every time a template gets applied.
  const incomingTags = templateTagsFrom(type)
  const nameKey = normalizeTypeName(type.name)
  const existingRows = await prisma.complianceTaxType.findMany({ where: { tenantId, countryCode } })
  const dup = existingRows.find((row) => {
    const data = row.data as Record<string, any>
    if (incomingTags.length > 0) {
      const existingTags = templateTagsFrom(data)
      return existingTags.some((tg) => incomingTags.includes(tg))
    }
    return normalizeTypeName(data.name) === nameKey
  })

  if (dup) {
    const dupData = dup.data as Record<string, any>
    const merged = {
      ...dupData,
      ...type,
      id: dup.code,
      tags: Array.from(new Set([...(Array.isArray(dupData.tags) ? dupData.tags : []), ...(Array.isArray(type.tags) ? type.tags : [])])),
    }
    const row = await prisma.complianceTaxType.update({ where: { id: dup.id }, data: { data: merged } })
    return toStoreTaxType(row)
  }

  const code = `${Date.now()}`
  const row = await prisma.complianceTaxType.create({
    data: { tenantId, countryCode, code, data: { ...type, id: code } },
  })
  return toStoreTaxType(row)
}

export async function deleteTaxType(tenantId: string, code: string) {
  const existing = await prisma.complianceTaxType.findUnique({ where: { tenantId_code: { tenantId, code } } })
  if (!existing) return { deleted: code }
  await prisma.complianceTaxType.delete({ where: { tenantId_code: { tenantId, code } } })
  return { deleted: code }
}

/** Tenant-scoped port of the old ComplianceDB.dedupeTaxTypesForCountry -- merges duplicate
 * tax types within one tenant+country (grouped by shared template tag, else normalized
 * name), re-pointing any tax rule's typeId from a removed "loser" type to the surviving
 * "keeper" before deleting the losers. */
export async function dedupeTaxTypesForTenant(tenantId: string, countryCode: string) {
  const typeRows = await prisma.complianceTaxType.findMany({ where: { tenantId, countryCode } })
  const ruleRows = await prisma.complianceTaxRule.findMany({ where: { tenantId, countryCode } })

  const groupKey = (data: Record<string, any>) => {
    const tags = templateTagsFrom(data)
    if (tags.length) return `tag:${[...tags].sort().join('|')}`
    return `name:${normalizeTypeName(data.name)}`
  }
  const ruleCountForType = (typeCode: string) =>
    ruleRows.filter((r) => String((r.data as Record<string, any>).typeId || '') === typeCode).length

  const byKey = new Map<string, typeof typeRows>()
  for (const t of typeRows) {
    const k = groupKey(t.data as Record<string, any>)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k)!.push(t)
  }

  const removedCodes: string[] = []
  for (const [, group] of byKey) {
    if (group.length <= 1) continue
    group.sort((a, b) => {
      const ca = ruleCountForType(a.code)
      const cb = ruleCountForType(b.code)
      if (cb !== ca) return cb - ca
      return a.code.localeCompare(b.code)
    })
    const keeper = group[0]
    for (let i = 1; i < group.length; i++) {
      const loser = group[i]
      removedCodes.push(loser.code)
      const affectedRules = ruleRows.filter((r) => String((r.data as Record<string, any>).typeId || '') === loser.code)
      for (const r of affectedRules) {
        const newData = { ...(r.data as Record<string, any>), typeId: keeper.code }
        await prisma.complianceTaxRule.update({ where: { id: r.id }, data: { data: newData } })
      }
    }
  }

  if (!removedCodes.length) return { removed: 0, removedIds: [] }
  await prisma.complianceTaxType.deleteMany({ where: { tenantId, code: { in: removedCodes } } })
  return { removed: removedCodes.length, removedIds: removedCodes }
}

function toStoreReportingRule(row: any) {
  return { ...(row.data as Record<string, any>), id: row.code }
}

async function ensureReportingRulesSeeded(tenantId: string, countryCode: string) {
  const existing = await prisma.complianceReportingRule.findMany({
    where: { tenantId, countryCode },
    select: { code: true },
  })
  const have = new Set(existing.map((r) => r.code))
  const legacy = existing.length === 0 ? (ComplianceDB.getReports(countryCode) as Array<Record<string, any>>) : []
  const source = (legacy.length > 0 ? legacy : getSeedReports().filter((r) => r.countryCode === countryCode))
    .filter((r) => !have.has(String(r.id)))
  if (!source.length) return
  await prisma.complianceReportingRule.createMany({
    data: source.map((r) => ({ tenantId, countryCode, code: String(r.id), data: r })),
  })
}

export async function listReportingRules(tenantId: string, countryCode: string) {
  await ensureReportingRulesSeeded(tenantId, countryCode)
  const rows = await prisma.complianceReportingRule.findMany({ where: { tenantId, countryCode } })
  return rows.map(toStoreReportingRule)
}

export async function upsertReportingRule(tenantId: string, rule: Record<string, any>) {
  const countryCode = String(rule.countryCode || '')
  const code = String(rule.id || '')
  if (!countryCode || !code) throw new Error('countryCode and id are required')
  const existing = await prisma.complianceReportingRule.findUnique({ where: { tenantId_code: { tenantId, code } } })
  const data = existing ? { ...(existing.data as Record<string, any>), ...rule, id: code } : { ...rule, id: code }
  const row = await prisma.complianceReportingRule.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { countryCode, data },
    create: { tenantId, countryCode, code, data },
  })
  return toStoreReportingRule(row)
}
