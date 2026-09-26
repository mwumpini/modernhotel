/**
 * Operational Policies: each saved rule changes the stay, invoice, or no-show decision.
 * Run: npx tsx scripts/test-operational-policies.ts
 */
import { isLateCheckoutNow } from '../src/app/lib/frontoffice/lateCheckout'
import {
  creditTermDays,
  depositBlocksConfirm,
  noShowCutoffReached,
  pickOperationalPolicy,
  planEarlyCheckout,
  requiredDeposit,
} from '../src/app/lib/frontoffice/operationalPolicies'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const at = (hour: number, minute = 0) => new Date(2026, 8, 26, hour, minute, 0)

// Late checkout uses the standard hour plus grace minutes.
{
  const policy = { lateCheckoutFeeEnabled: true, standardCheckOutHour: 11, lateCheckoutGraceMinutes: 30 }
  assert(isLateCheckoutNow(policy, at(11, 20)) === false, 'inside grace is not late')
  assert(isLateCheckoutNow(policy, at(11, 31)) === true, 'past grace is late')
  assert(isLateCheckoutNow({ ...policy, lateCheckoutFeeEnabled: false }, at(15)) === false, 'fee off never charges')
}

// Early checkout drops unused nights. Before the cutoff, today is unused too.
{
  const charges = [
    { description: 'Room Charge', category: 'room', date: '2026-09-25', amount: 100 },
    { description: 'Room Charge', category: 'room', date: '2026-09-26', amount: 100 },
    { description: 'Room Charge', category: 'room', date: '2026-09-27', amount: 100 },
    { description: 'Minibar', category: 'fb', date: '2026-09-27', amount: 20 },
  ]
  const open = planEarlyCheckout(charges, { earlyCheckoutPolicyEnabled: true, earlyCheckoutCutoffHour: 11 }, at(8))
  assert(open.remove.length === 2, `before cutoff removes today and tomorrow, got ${open.remove.length}`)
  assert(open.keep.some((c) => c.description === 'Minibar'), 'minibar stays')
  const after = planEarlyCheckout(charges, { earlyCheckoutPolicyEnabled: true, earlyCheckoutCutoffHour: 11 }, at(12))
  assert(after.remove.length === 1 && after.remove[0].date === '2026-09-27', 'after cutoff only future nights go')
  const held = planEarlyCheckout(charges, {
    earlyCheckoutPolicyEnabled: true,
    earlyCheckoutAdvancedEnabled: true,
    earlyCheckoutRefundType: 'none',
  }, at(8))
  assert(held.remove.length === 0, 'no-refund mode keeps the remaining nights')
  const penalized = planEarlyCheckout(charges, {
    earlyCheckoutPolicyEnabled: true,
    earlyCheckoutAdvancedEnabled: true,
    earlyCheckoutRefundType: 'percent_penalty',
    earlyCheckoutPenaltyPercent: 50,
    earlyCheckoutCutoffHour: 11,
  }, at(12))
  assert(penalized.penalty === 50, `50% of the removed night is ₵50, got ${penalized.penalty}`)
  const off = planEarlyCheckout(charges, { earlyCheckoutPolicyEnabled: false }, at(8))
  assert(off.remove.length === 0, 'policy off leaves the folio alone')
}

// No-show cutoff is an hour on the arrival day. The next morning has already passed it.
{
  assert(noShowCutoffReached('2026-09-26', 18, at(17)) === false, 'before cutoff cannot mark no-show')
  assert(noShowCutoffReached('2026-09-26', 18, at(18)) === true, 'at the cutoff hour a no-show can be marked')
  assert(noShowCutoffReached('2026-09-25', 23, at(1)) === true, 'the morning after arrival the cutoff has passed')
}

// Deposit required to confirm, and company credit terms.
{
  assert(requiredDeposit(400, { depositPolicyEnabled: true, depositType: 'percent', depositValue: 50 }) === 200, '50% of 400')
  assert(requiredDeposit(400, { depositPolicyEnabled: true, depositType: 'flat', depositValue: 80 }) === 80, 'flat 80')
  assert(requiredDeposit(400, { depositPolicyEnabled: false, depositValue: 80 }) === 0, 'deposit off')
  const policy = { depositPolicyEnabled: true, requireDepositToConfirm: true, depositType: 'flat' as const, depositValue: 100 }
  assert(depositBlocksConfirm(40, 100, policy) === true, 'short deposit cannot confirm')
  assert(depositBlocksConfirm(100, 100, policy) === false, 'full deposit can confirm')
  assert(creditTermDays({ defaultCreditTermsDays: 21 }, undefined, 30) === 21, 'operational default when the company has none')
  assert(creditTermDays({ defaultCreditTermsDays: 21 }, 'Net 45', 30) === 45, 'company terms win')
  assert(creditTermDays({ defaultCreditTermsDays: 21 }, 'Immediate', 30) === 0, 'immediate is zero days')
}

// Only known policy fields are stored, and a bad enum is dropped.
{
  const picked = pickOperationalPolicy({
    payLaterPolicy: 'corporate',
    noShowCutoffHour: 30,
    lateCheckoutFeeType: 'bogus',
    defaultCreditTermsDays: 14,
    roomTypes: [],
  })
  assert(picked.payLaterPolicy === 'corporate', 'pay later is kept')
  assert(picked.noShowCutoffHour === 23, `cutoff clamps to 23, got ${picked.noShowCutoffHour}`)
  assert(picked.lateCheckoutFeeType == null, 'bad fee type is dropped')
  assert(picked.defaultCreditTermsDays === 14, 'credit days are kept')
  assert(!('roomTypes' in picked), 'room lists are not policy fields')
}

console.log('operational policies ok')
