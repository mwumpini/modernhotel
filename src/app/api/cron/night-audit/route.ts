import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/app/lib/database/client'
import { resolveTaxConfigs, type PrismaTaxRow } from '@/app/lib/tax/resolveConfigs'
import { computeStackedTaxLines } from '@/app/lib/accounting/taxFromConfig'
import { createNightAuditLog } from '@/app/lib/frontoffice/nightAuditLogRepository'

/**
 * Server-side Night Audit — runs at 01:00 daily via Vercel Cron or manual trigger.
 * Server-side equivalent of the client-side scheduler in nightAuditScheduler.ts —
 * same POST_NIGHTLY_VIA_AUDIT policy, just reliable without a browser tab open.
 *
 * What it does:
 * 1. For every open guest folio, post a nightly room charge (folio only — no GL yet)
 * 2. Flag no-show reservations (confirmed/pending but past arrival date); if the
 *    tenant has a no-show policy configured (see /api/settings/room-management),
 *    post the penalty charge + GL entry (and auto-collect a guaranteed card), same
 *    as the client-side markNoShow() in frontoffice/store.ts
 * 3. Return a summary of what was processed
 *
 * GL for a normal guest stay is posted once, at checkout (see
 * frontoffice/helpers/invoice.ts generateAccountingInvoiceForReservation →
 * accounting/simpleFlow.ts) — posting a GL entry here too would double-count room
 * revenue when the stay is later invoiced. No-shows never reach checkout, so their
 * penalty GL entry posts immediately here instead.
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
  const errors: string[] = []

  try {
    // Get all active tenants
    const tenants = await prisma.tenant.findMany({ where: { status: 'active' } })

    for (const tenant of tenants) {
      const tenantId = tenant.id
      let tenantCharges = 0
      const tenantErrors: string[] = []

      // Resolve this tenant's real configured tax rates once (falls back to the
      // Ghana template if the tenant has no active taxes configured yet) instead of
      // a hardcoded ~21% that silently diverges from taxes charged elsewhere on the folio.
      const tenantTaxRows = await prisma.tax.findMany({ where: { tenantId, isActive: true } })
      const tenantTaxConfigs = resolveTaxConfigs({
        countryCode: 'GH',
        prismaTaxes: tenantTaxRows as unknown as PrismaTaxRow[],
      })

      // Same no-show policy a manual no-show configures via Settings (see
      // /api/settings/room-management) — defaults to disabled, matching the
      // client-side default, so tenants who never configured it see no change.
      const tenantSettings = await prisma.systemSettings.findUnique({
        where: { tenantId },
        select: { roomSettings: true },
      })
      const rs = (tenantSettings?.roomSettings as Record<string, any>) || {}
      const noShowPolicy = {
        enabled: !!rs.noShowPolicyEnabled,
        chargeType: (rs.noShowChargeType as 'first_night' | 'percent_reservation' | 'flat') || 'first_night',
        chargeValue: Number(rs.noShowChargeValue) || 0,
      }

      // ── 1. Post nightly room charges for all checked-in guests ────────────
      // GuestFolio rows are created with status 'active' (see frontoffice/helpers/folio.ts
      // getOrCreateFolio) and moved to 'closed' at checkout — never 'open'.
      const checkedInFolios = await prisma.guestFolio.findMany({
        where: { tenantId, status: 'active' },
      })

      for (const folio of checkedInFolios) {
        try {
          // Get reservation to find room rate
          const reservation = folio.reservationId
            ? await prisma.reservation.findFirst({ where: { id: folio.reservationId, tenantId } })
            : null

          // Per-night rate lives in details.rateBreakdown (set client-side by
          // ensureReservationRates/calculateRateBreakdown at booking time — see
          // frontoffice/repository.ts toDbReservationData/toStoreReservation).
          // reservation.totalAmount is never actually populated by the booking flow,
          // so it is not a usable fallback here.
          const breakdown = (reservation?.details as { rateBreakdown?: Array<{ date: string; base: number }> } | null)
            ?.rateBreakdown || []
          const nightlyRate = breakdown.find((d) => d.date === todayIso)?.base ?? breakdown[0]?.base ?? 0
          if (nightlyRate <= 0) continue

          // Real tenant-configured tax stack (VAT/NHIL/GETFund/Tourism/etc.), not a
          // hardcoded flat rate — matches what a manually-added folio charge would compute.
          const { totalTax: taxAmount } = computeStackedTaxLines(nightlyRate, tenantTaxConfigs, 'sales')
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

          // Re-read the folio and re-check "already posted today" INSIDE a serializable
          // transaction, right before writing — closes the race window where two
          // overlapping invocations (a Cron retry + a manual trigger) both pass the
          // stale in-memory `alreadyPosted` check and both append the room charge.
          const posted = await prisma.$transaction(async (tx) => {
            const fresh = await tx.guestFolio.findUnique({ where: { id: folio.id } })
            if (!fresh) return false
            const freshCharges = (fresh.charges as any[]) || []
            const alreadyPosted = freshCharges.some(
              (c: any) => c.category === 'room' && c.date?.startsWith(todayIso)
            )
            if (alreadyPosted) return false

            freshCharges.push(newCharge)
            const totalCharges = freshCharges.reduce((s: number, c: any) => s + c.amount + (c.tax || 0), 0)
            const totalPayments = ((fresh.payments as any[]) || [])
              .filter((p: any) => p.status === 'completed')
              .reduce((s: number, p: any) => s + p.amount, 0)

            await tx.guestFolio.update({
              where: { id: folio.id },
              data: {
                charges: freshCharges as any,
                totalCharges,
                totalPayments,
                balance: totalCharges - totalPayments,
              },
            })
            return true
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

          if (!posted) continue

          tenantCharges++
        } catch (folioErr) {
          const msg = `Folio ${folio.id}: ${folioErr}`
          errors.push(msg)
          tenantErrors.push(msg)
        }
      }

      // ── 2. Mark no-show reservations ──────────────────────────────────────
      const noShows = await prisma.reservation.findMany({
        where: {
          tenantId,
          status: { in: ['confirmed', 'pending'] },
          checkInDate: { lt: today },
        },
      })

      for (const res of noShows) {
        try {
          // Same details.rateBreakdown source as the room-charge posting above —
          // reservation.totalAmount/details.rateAmount are never populated by the
          // booking flow (see frontoffice/repository.ts toDbReservationData).
          const resBreakdown = (res.details as { rateBreakdown?: Array<{ date: string; base: number }> } | null)
            ?.rateBreakdown || []
          const nightlyNet = resBreakdown[0]?.base ?? 0
          const stayNetTotal = resBreakdown.reduce((s, d) => s + (d.base || 0), 0)

          let charge = 0
          if (noShowPolicy.enabled) {
            if (noShowPolicy.chargeType === 'first_night') {
              charge = nightlyNet
            } else if (noShowPolicy.chargeType === 'percent_reservation') {
              charge = Math.max(0, (noShowPolicy.chargeValue / 100) * stayNetTotal)
            } else {
              charge = Math.max(0, noShowPolicy.chargeValue)
            }
          }

          const chargeId = `C-NS-${res.id.slice(-8)}`
          const { totalTax: taxAmount, lines: taxLines } =
            charge > 0 ? computeStackedTaxLines(charge, tenantTaxConfigs, 'sales') : { totalTax: 0, lines: [] }
          const total = charge + taxAmount
          const cardCollected = charge > 0 && res.isGuaranteed

          // Whole outcome (status flip, folio, charge, GL) commits together — if this
          // throws partway through, the reservation stays 'confirmed'/'pending' so the
          // next cron run picks it up again instead of silently losing the penalty.
          await prisma.$transaction(async (tx) => {
            await tx.reservation.update({ where: { id: res.id }, data: { status: 'no-show' } })

            let folio = await tx.guestFolio.findFirst({ where: { reservationId: res.id, tenantId } })
            if (!folio) {
              folio = await tx.guestFolio.create({
                data: {
                  id: `F-NS-${res.id.slice(-8)}`,
                  tenantId,
                  reservationId: res.id,
                  charges: [],
                  payments: [],
                  currency: 'GHS',
                  status: 'active',
                },
              })
            }

            if (charge > 0) {
              const existingCharges = (folio.charges as any[]) || []
              if (!existingCharges.some((c: any) => c.id === chargeId)) {
                const newCharges = [
                  ...existingCharges,
                  { id: chargeId, date: new Date().toISOString(), description: 'No-Show Charge', amount: charge, tax: taxAmount, category: 'room' },
                ]
                let newPayments = (folio.payments as any[]) || []
                if (cardCollected) {
                  newPayments = [
                    ...newPayments,
                    { id: `P-NS-${res.id.slice(-8)}`, date: new Date().toISOString(), method: 'Card', amount: total, status: 'completed', notes: 'No-show penalty — card guarantee' },
                  ]
                }
                const totalCharges = newCharges.reduce((s: number, c: any) => s + c.amount + (c.tax || 0), 0)
                const totalPayments = newPayments.filter((p: any) => p.status === 'completed').reduce((s: number, p: any) => s + p.amount, 0)

                await tx.guestFolio.update({
                  where: { id: folio.id },
                  data: { charges: newCharges, payments: newPayments, totalCharges, totalPayments, balance: totalCharges - totalPayments, status: 'closed' },
                })

                const existingJe = await tx.journalEntry.findFirst({ where: { tenantId, sourceTransactionId: chargeId } })
                if (!existingJe) {
                  await tx.journalEntry.create({
                    data: {
                      tenantId,
                      entryNumber: `JE-${new Date().getFullYear()}-NS${Date.now().toString().slice(-5)}`,
                      date: today,
                      description: `No-show penalty — ${res.resId || res.id}`,
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
                          { tenantId, accountCode: '1200', description: `AR — No-show ${res.resId || res.id}`, debit: total, credit: 0, currency: 'GHS' },
                          { tenantId, accountCode: '4100', description: 'No-show penalty revenue', debit: 0, credit: charge, currency: 'GHS' },
                          ...taxLines
                            .filter((tl) => tl.amount > 0)
                            .map((tl) => ({ tenantId, accountCode: tl.glAccountCode, description: `${tl.name} — No-show`, debit: 0, credit: tl.amount, currency: 'GHS' })),
                        ],
                      },
                    } as any,
                  })
                }

                if (cardCollected) {
                  const payChargeId = `${chargeId}-pay`
                  const existingPayJe = await tx.journalEntry.findFirst({ where: { tenantId, sourceTransactionId: payChargeId } })
                  if (!existingPayJe) {
                    await tx.journalEntry.create({
                      data: {
                        tenantId,
                        entryNumber: `JE-${new Date().getFullYear()}-NSR${Date.now().toString().slice(-5)}`,
                        date: today,
                        description: `No-show card charge — ${res.resId || res.id}`,
                        totalDebit: total,
                        totalCredit: total,
                        currency: 'GHS',
                        status: 'Posted',
                        postedBy: 'night-audit',
                        postedAt: new Date(),
                        sourceModule: 'night-audit',
                        sourceTransactionId: payChargeId,
                        lines: {
                          create: [
                            { tenantId, accountCode: '1100', description: 'Card — no-show guarantee', debit: total, credit: 0, currency: 'GHS' },
                            { tenantId, accountCode: '1200', description: `Clear AR — No-show ${res.resId || res.id}`, debit: 0, credit: total, currency: 'GHS' },
                          ],
                        },
                      } as any,
                    })
                  }
                }
              }
            } else if (folio.status !== 'closed') {
              await tx.guestFolio.update({ where: { id: folio.id }, data: { status: 'closed' } })
            }
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

          totalNoShowsMarked++
        } catch (nsErr) {
          const msg = `No-show ${res.id}: ${nsErr}`
          errors.push(msg)
          tenantErrors.push(msg)
        }
      }

      totalRoomChargesPosted += tenantCharges

      results[tenant.subdomain] = {
        roomChargesPosted: tenantCharges,
        noShowsMarked: noShows.length,
      }

      // Best-effort — a logging failure shouldn't fail the audit run itself.
      try {
        await createNightAuditLog(tenantId, {
          businessDate: todayIso,
          source: 'cron',
          status: tenantErrors.length > 0 ? 'failed' : 'completed',
          roomChargesPosted: tenantCharges,
          noShowsMarked: noShows.length,
          errors: tenantErrors,
        })
      } catch (logErr) {
        console.error('[night-audit] failed to write NightAuditLog', logErr)
      }
    }

    return NextResponse.json({
      ok: true,
      date: todayIso,
      summary: {
        totalRoomChargesPosted,
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
