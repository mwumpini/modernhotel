/**
 * Live front-desk certification for Operational Policies.
 * Uses the real FrontOfficeStore methods (check-in, checkout, no-show, cancel, night audit).
 * No window, so nothing is written to the hotel database or the open browser.
 * Run: npx tsx scripts/cert-operational-policies-live.ts
 */
import { frontOfficeStore } from '../src/app/lib/frontoffice/store'
import { useSettingsStore } from '../src/app/lib/settings/store'
import { useAccountingStore } from '../src/app/lib/accounting/store'
import { runNightAudit } from '../src/app/lib/frontoffice/nightAudit'
import { canMarkNoShow } from '../src/app/lib/frontoffice/arrivals'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`  ok  ${msg}`)
}

function localDay(d = new Date()) {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function plusDays(iso: string, n: number) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  date.setDate(date.getDate() + n)
  return localDay(date)
}

const today = localDay()
const tomorrow = plusDays(today, 1)
const later = plusDays(today, 10)
const settings = useSettingsStore.getState()

settings.updateNestedSetting('roomManagement.postFirstNightAtCheckin', true)
settings.updateNestedSetting('roomManagement.lateCheckoutFeeEnabled', true)
settings.updateNestedSetting('roomManagement.standardCheckOutHour', 0)
settings.updateNestedSetting('roomManagement.lateCheckoutGraceMinutes', 0)
settings.updateNestedSetting('roomManagement.lateCheckoutFeeType', 'flat')
settings.updateNestedSetting('roomManagement.lateCheckoutFeeValue', 40)
settings.updateNestedSetting('roomManagement.earlyCheckoutPolicyEnabled', true)
settings.updateNestedSetting('roomManagement.earlyCheckoutCutoffHour', 24)
settings.updateNestedSetting('roomManagement.earlyCheckoutAdvancedEnabled', true)
settings.updateNestedSetting('roomManagement.earlyCheckoutRefundType', 'percent_penalty')
settings.updateNestedSetting('roomManagement.earlyCheckoutPenaltyPercent', 25)
settings.updateNestedSetting('roomManagement.earlyCheckoutNote', 'Cert note')
settings.updateNestedSetting('roomManagement.noShowPolicyEnabled', true)
settings.updateNestedSetting('roomManagement.noShowChargeType', 'flat')
settings.updateNestedSetting('roomManagement.noShowChargeValue', 75)
settings.updateNestedSetting('roomManagement.noShowCutoffHour', 18)
settings.updateNestedSetting('roomManagement.cancellationPolicyEnabled', true)
settings.updateNestedSetting('roomManagement.freeCancellationHours', 24)
settings.updateNestedSetting('roomManagement.lateCancellationFeeType', 'flat')
settings.updateNestedSetting('roomManagement.lateCancellationFeeValue', 60)
settings.updateNestedSetting('roomManagement.depositPolicyEnabled', true)
settings.updateNestedSetting('roomManagement.depositType', 'flat')
settings.updateNestedSetting('roomManagement.depositValue', 100)
settings.updateNestedSetting('roomManagement.requireDepositToConfirm', true)
settings.updateNestedSetting('roomManagement.defaultCreditTermsDays', 21)
settings.updateNestedSetting('roomManagement.payLaterPolicy', 'both')
settings.updateNestedSetting('roomManagement.requireCorporateReference', true)

const nights = (start: string, end: string) => [
  { date: start, base: 200, total: 230 },
  { date: end, base: 200, total: 230 },
]

function book(name: string, arrival: string, departure: string, extra: Record<string, unknown> = {}) {
  return frontOfficeStore.createReservation({
    guestId: `guest-${name}`,
    guestName: name,
    roomTypeId: 'cert-type',
    arrival,
    departure,
    stayReason: 'personal',
    roomId: 'CERT-101',
    status: 'confirmed',
    rateBreakdown: nights(arrival.slice(0, 10), plusDays(arrival.slice(0, 10), 1)),
    ...extra,
  } as any)
}

console.log('Check-in posts the first night')
{
  const stay = book('CERT Check-in', `${today}T14:00:00`, `${tomorrow}T11:00:00`)
  frontOfficeStore.checkIn(stay.id)
  const folio = frontOfficeStore.getOrCreateFolio(stay.id)
  const room = (folio.charges || []).filter((c) => (c.description || '').includes('Room Charge'))
  assert(frontOfficeStore.reservations.find((r) => r.id === stay.id)?.status === 'checked-in', 'status is checked-in')
  assert(room.length === 1 && room[0].amount === 200, `first night ₵200 is on the folio, got ${room.map((c) => c.amount).join(',')}`)
  assert((room[0].date || '').slice(0, 10) === today, 'first night is dated today')
}

console.log('Corporate checkout is blocked until a reference is present, then early and late rules hit the folio')
{
  const soon = new Date(Date.now() + 2 * 60 * 60 * 1000)
  const stay = book('CERT Checkout', soon.toISOString(), `${plusDays(localDay(soon), 2)}T11:00:00`, { companyName: 'CERT Company' })
  frontOfficeStore.checkIn(stay.id)
  const blocked = frontOfficeStore.processCheckout(stay.id)
  assert(blocked === null, 'checkout without a company reference is refused')
  assert(frontOfficeStore.reservations.find((r) => r.id === stay.id)?.status === 'checked-in', 'the stay stays checked-in')

  const open = frontOfficeStore.reservations.find((r) => r.id === stay.id)!
  ;(open as any).poNumber = 'PO-CERT'
  const folio = frontOfficeStore.getOrCreateFolio(stay.id)
  frontOfficeStore.addFolioCharge(folio.id, {
    id: 'CERT-FUTURE',
    description: 'Room Charge',
    amount: 200,
    category: 'room',
    date: plusDays(stay.arrival.slice(0, 10), 1),
  })
  const done = frontOfficeStore.processCheckout(stay.id)
  assert(!!done && done.status === 'checked-out', 'checkout completes once the reference is on the stay')
  const lines = frontOfficeStore.getOrCreateFolio(stay.id).charges || []
  const describe = lines.map((c) => `${c.description}:${c.amount}`).join(' | ')
  assert(lines.some((c) => c.description === 'Late Checkout Fee' && c.amount === 40), `late fee ₵40 is on the folio (${describe})`)
  assert(!lines.some((c) => (c.description || '').includes('Room Charge')), `unused room nights were removed (${describe})`)
  assert(lines.some((c) => c.description === 'Early Checkout Penalty' && c.amount === 100), `25% penalty on ₵400 removed is ₵100 (${describe})`)

  const invoice = useAccountingStore.getState().invoices.find((inv) => inv.reference === stay.resId)
  assert(!!invoice, 'checkout raised an invoice')
  const dueInDays = Math.round((new Date(invoice!.dueDate).getTime() - Date.now()) / 86400000)
  assert(dueInDays === 21, `company invoice is due in 21 days, got ${dueInDays}`)
}

console.log('A short deposit cannot confirm the reservation')
{
  const stay = book('CERT Deposit', `${later}T14:00:00`, `${plusDays(later, 1)}T11:00:00`)
  assert(stay.status === 'pending', `confirmed booking without the deposit stays pending, got ${stay.status}`)
  frontOfficeStore.addDeposit(stay.id, 100, 'Cash')
  const after = frontOfficeStore.reservations.find((r) => r.id === stay.id)
  assert(after?.status === 'confirmed', 'paying the ₵100 deposit confirms the stay')
  assert(after?.isGuaranteed === true, 'the stay is guaranteed')
}

console.log('No-show posts the policy charge, and the button waits for the cutoff')
{
  const stay = book('CERT No-show', `${today}T14:00:00`, `${tomorrow}T11:00:00`)
  const now = new Date()
  assert(canMarkNoShow(stay, today, { now, cutoffHour: 18 }) === (now.getHours() >= 18), 'the no-show button follows the cutoff hour')
  frontOfficeStore.markNoShow(stay.id)
  const folio = frontOfficeStore.getOrCreateFolio(stay.id)
  const line = (folio.charges || []).find((c) => c.description === 'No-Show Charge')
  assert(frontOfficeStore.reservations.find((r) => r.id === stay.id)?.status === 'no-show', 'status is no-show')
  assert(line?.amount === 75, `no-show charge is ₵75, got ${line?.amount}`)
  assert(folio.status === 'closed', 'the no-show folio is closed')
}

console.log('A late cancellation posts the fee')
{
  const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const stay = book('CERT Cancel', soon, `${plusDays(soon.slice(0, 10), 1)}T11:00:00`)
  frontOfficeStore.cancelReservation(stay.id)
  const folio = frontOfficeStore.getOrCreateFolio(stay.id)
  const line = (folio.charges || []).find((c) => c.description === 'Cancellation Penalty')
  assert(frontOfficeStore.reservations.find((r) => r.id === stay.id)?.status === 'cancelled', 'status is cancelled')
  assert(line?.amount === 60, `cancellation fee is ₵60, got ${line?.amount}`)
}

console.log('Night audit posts the room night and marks an arrival whose cutoff has passed')
{
  settings.updateNestedSetting('roomManagement.postFirstNightAtCheckin', false)
  settings.updateNestedSetting('roomManagement.noShowCutoffHour', 0)
  const businessDate = frontOfficeStore.businessDate
  const inHouse = book('CERT Audit stay', `${businessDate}T14:00:00`, `${plusDays(businessDate, 1)}T11:00:00`)
  frontOfficeStore.checkIn(inHouse.id)
  const before = frontOfficeStore.getOrCreateFolio(inHouse.id).charges || []
  assert(!before.some((c) => (c.description || '').includes('Room Charge')), 'with first-night posting off, check-in leaves the folio empty')
  const expected = book('CERT Audit arrival', `${businessDate}T15:00:00`, `${plusDays(businessDate, 1)}T11:00:00`)
  const run = runNightAudit(frontOfficeStore as any)
  const after = frontOfficeStore.getOrCreateFolio(inHouse.id).charges || []
  const room = after.filter((c) => (c.description || '').includes('Room Charge') && (c.date || '').slice(0, 10) === businessDate)
  assert(run.status === 'completed', `night audit completed (${run.error || 'no error'})`)
  assert(room.length === 1 && room[0].amount === 200, `night audit posted ₵200 for ${businessDate}`)
  assert(frontOfficeStore.reservations.find((r) => r.id === expected.id)?.status === 'no-show', 'the expected arrival was marked no-show')
  assert(frontOfficeStore.businessDate === plusDays(businessDate, 1), 'the business date rolled forward')
  const deposit = frontOfficeStore.reservations.find((r) => r.guestName === 'CERT Deposit')
  assert(deposit?.status === 'confirmed', 'a future stay was not touched by the audit')
}

console.log('operational policies live certification passed')
process.exit(0)
