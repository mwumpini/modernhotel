import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/database/client'

/**
 * Server-side Night Audit — runs at 01:00 daily via Vercel Cron or manual trigger.
 *
 * What it does:
 * 1. For every checked-in guest, post a nightly room charge to their folio
 * 2. Create a GL journal entry: Dr Guest AR → Cr Room Revenue
 * 3. Flag no-show reservations (confirmed but past arrival date)
 * 4. Return a summary of what was processed
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString().split('T')[0]

  const results: Record<string, any> = {}
  let totalRoomChargesPosted = 0
  let totalNoShowsMarked = 0
  let totalGLEntriesCreated = 0
  const errors: string[] = []

  try {
    // Get all active tenants
    const tenants = await prisma.tenant.findMany({ where: { status: 'active' } })

    for (const tenant of tenants) {
      const tenantId = tenant.id
      let tenantCharges = 0
      let tenantGLEntries = 0

      // ── 1. Post nightly room charges for all checked-in guests ────────────
      const checkedInFolios = await prisma.guestFolio.findMany({
        where: { tenantId, status: 'open' },
      })

      for (const folio of checkedInFolios) {
        try {
          const charges = (folio.charges as any[]) || []

          // Skip if room charge already posted for today
          const alreadyPosted = charges.some(
            (c: any) => c.category === 'room' && c.date?.startsWith(todayIso)
          )
          if (alreadyPosted) continue

          // Get reservation to find room rate
          const reservation = folio.reservationId
            ? await prisma.reservation.findFirst({ where: { id: folio.reservationId, tenantId } })
            : null

          const nightlyRate = reservation ? Number(reservation.rateAmount ?? 0) : 0
          if (nightlyRate <= 0) continue

          // Compute Ghana taxes on room rate (~21% composite)
          const taxAmount = Math.round(nightlyRate * 0.21 * 100) / 100
          const chargeId = `ROOM-${todayIso}-${folio.id.slice(-6)}`

          const newCharge = {
            id: chargeId,
            date: new Date().toISOString(),
            description: `Room Charge — ${todayIso}`,
            amount: nightlyRate,
            tax: taxAmount,
            category: 'room',
            glAccountCode: '4100',
          }

          charges.push(newCharge)
          const totalCharges = charges.reduce((s: number, c: any) => s + c.amount + (c.tax || 0), 0)
          const totalPayments = ((folio.payments as any[]) || [])
            .filter((p: any) => p.status === 'completed')
            .reduce((s: number, p: any) => s + p.amount, 0)

          await prisma.guestFolio.update({
            where: { id: folio.id },
            data: {
              charges: charges as any,
              totalCharges,
              totalPayments,
              balance: totalCharges - totalPayments,
            },
          })

          tenantCharges++

          // ── 2. Post GL entry: Dr AR (1210) Cr Room Revenue (4100) ─────────
          const total = nightlyRate + taxAmount
          const entryNumber = `NA-${todayIso}-${folio.id.slice(-6)}`

          // Only create if not already exists for this folio+date
          const existingJE = await prisma.journalEntry.findFirst({
            where: { tenantId, sourceTransactionId: chargeId },
          })

          if (!existingJE) {
            await prisma.journalEntry.create({
              data: {
                tenantId,
                entryNumber,
                date: today,
                description: `Night Audit Room Charge — ${todayIso}`,
                totalDebit: total,
                totalCredit: total,
                currency: 'GHS',
                status: 'Posted',
                postedBy: 'night-audit',
                postedAt: new Date(),
                sourceModule: 'night-audit',
                sourceTransactionId: chargeId,
                lines: {
                  create: [
                    {
                      tenantId,
                      accountCode: '1210',
                      description: `Guest AR — Room Charge ${todayIso}`,
                      debit: total,
                      credit: 0,
                      currency: 'GHS',
                    },
                    {
                      tenantId,
                      accountCode: '4100',
                      description: `Room Revenue — Night Audit ${todayIso}`,
                      debit: 0,
                      credit: nightlyRate,
                      currency: 'GHS',
                      taxCode: 'COMPOSITE',
                    },
                    {
                      tenantId,
                      accountCode: '2110',
                      description: `Output Tax — Room ${todayIso}`,
                      debit: 0,
                      credit: taxAmount,
                      currency: 'GHS',
                      taxCode: 'VAT',
                    },
                  ],
                },
              } as any,
            })
            tenantGLEntries++
          }
        } catch (folioErr) {
          errors.push(`Folio ${folio.id}: ${folioErr}`)
        }
      }

      // ── 3. Mark no-show reservations ──────────────────────────────────────
      const noShows = await prisma.reservation.findMany({
        where: {
          tenantId,
          status: 'confirmed',
          checkInDate: { lt: today },
        },
      })

      for (const res of noShows) {
        try {
          await prisma.reservation.update({
            where: { id: res.id },
            data: { status: 'no-show' },
          })
          totalNoShowsMarked++
        } catch (nsErr) {
          errors.push(`No-show ${res.id}: ${nsErr}`)
        }
      }

      totalRoomChargesPosted += tenantCharges
      totalGLEntriesCreated += tenantGLEntries

      results[tenant.subdomain] = {
        roomChargesPosted: tenantCharges,
        glEntriesCreated: tenantGLEntries,
        noShowsMarked: noShows.length,
      }
    }

    return NextResponse.json({
      ok: true,
      date: todayIso,
      summary: {
        totalRoomChargesPosted,
        totalGLEntriesCreated,
        totalNoShowsMarked,
        tenantsProcessed: tenants.length,
      },
      byTenant: results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[night-audit] error', error)
    return NextResponse.json({ ok: false, error: 'Night audit failed', details: String(error) }, { status: 500 })
  }
}
