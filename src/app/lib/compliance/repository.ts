import { prisma } from '../database/client'

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
