import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { prisma } from '@/app/lib/database/client'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Pull GL entries related to tax accounts for this tenant and date range
    const taxAccounts = ['2110', '2120', '2130', '2150', '2160']
    const taxLines = await prisma.journalEntryLine.findMany({
      where: {
        tenantId: ctx.tenantId,
        accountCode: { in: taxAccounts },
        journalEntry: {
          status: 'Posted',
          ...(from || to ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          } : {}),
        },
      },
      include: {
        journalEntry: { select: { date: true, entryNumber: true, description: true } },
      },
      orderBy: { journalEntry: { date: 'asc' } },
    })

    // Aggregate by tax account
    const summary: Record<string, { accountCode: string; totalOutput: number; totalInput: number; net: number }> = {}
    for (const line of taxLines) {
      if (!summary[line.accountCode]) {
        summary[line.accountCode] = { accountCode: line.accountCode, totalOutput: 0, totalInput: 0, net: 0 }
      }
      summary[line.accountCode].totalOutput += Number(line.credit ?? 0)
      summary[line.accountCode].totalInput += Number(line.debit ?? 0)
    }

    for (const key of Object.keys(summary)) {
      summary[key].net = summary[key].totalOutput - summary[key].totalInput
    }

    return NextResponse.json({
      period: { from, to },
      taxSummary: Object.values(summary),
      lineCount: taxLines.length,
    })
  } catch (error) {
    console.error('[compliance/reports][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
