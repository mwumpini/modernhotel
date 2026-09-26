/**
 * Front Office money: folio lines, cash rounding, stay nights, and room-night identity.
 * Run: npx tsx scripts/test-folio-arithmetic.ts
 */
import {
  chargeGross,
  chargeNet,
  isPostedRoomCharge,
  lineOnBusinessDate,
  recomputeFolioTotals,
  roundFolioTotal,
} from '../src/app/lib/frontoffice/folioLedger'
import { calculateStayNights } from '../src/app/lib/frontoffice/helpers/rates'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

// F&B bill-to-room must equal the POS total: subtotal − discount + service + tax.
{
  const line = { id: 'FB-1', amount: 100, tax: 20, serviceCharge: 5, discountAmount: 10 }
  assert(chargeNet(line) === 95, `net ${chargeNet(line)}`)
  assert(chargeGross(line) === 115, `gross ${chargeGross(line)}`)
}

// Cash rounding matches Settings default (nearest ₵0.50). 121.90 settles at 122.00.
{
  assert(roundFolioTotal(121.9) === 122, `121.90 -> ${roundFolioTotal(121.9)}`)
  assert(roundFolioTotal(102.85) === 103, `102.85 -> ${roundFolioTotal(102.85)}`)
  assert(roundFolioTotal(115) === 115, 'exact 0.50 stays')
  const totals = recomputeFolioTotals(
    [{ id: 'C1', amount: 100, tax: 21.9 }],
    [{ id: 'P1', amount: 122, status: 'completed' }],
  )
  assert(totals.totalCharges === 122, `charges ${totals.totalCharges}`)
  assert(totals.balance === 0, `balance ${totals.balance}`)
}

// A payment with no status still counts. A refund does not.
{
  const totals = recomputeFolioTotals(
    [{ id: 'C1', amount: 10, tax: 0 }],
    [
      { id: 'P1', amount: 10 },
      { id: 'P2', amount: 10, status: 'refunded' },
    ],
    { increment: 0, rule: 'nearest' },
  )
  assert(totals.totalPayments === 10, `payments ${totals.totalPayments}`)
  assert(totals.balance === 0, `unrefunded balance ${totals.balance}`)
}

// Room service must not block or replace the room-night charge.
{
  const businessDate = '2026-09-24'
  const lines = [
    { id: 'RS', description: 'Room Service — dinner', category: 'F&B', date: businessDate, amount: 40 },
    { id: 'RM', description: 'Room Charge', category: 'room', date: `${businessDate}T12:00:00.000Z`, amount: 200 },
  ]
  assert(!isPostedRoomCharge(lines[0]), 'room service is not a room night')
  assert(isPostedRoomCharge(lines[1]), 'room charge is a room night')
  const posted = lines.some((c) => isPostedRoomCharge(c) && lineOnBusinessDate(c, businessDate))
  assert(posted, 'existing room night is detected for that date')
}

// Departure day is not a night, including when the value is a full timestamp.
{
  assert(calculateStayNights('2026-09-24', '2026-09-26') === 2, 'two calendar nights')
  assert(calculateStayNights('2026-09-24T00:00:00.000Z', '2026-09-26T22:00:00.000Z') === 2, 'timestamps use the calendar date')
  assert(calculateStayNights('2026-09-30', '2026-10-02') === 2, 'month boundary')
  assert(calculateStayNights('2026-09-24', '2026-09-24') === 0, 'same-day stay is zero nights')
}

console.log('folio arithmetic ok')
