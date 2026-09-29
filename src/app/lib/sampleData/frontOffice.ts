import { SampleCtx, prisma, seedRows, bySampleId, dayOffset, dayString, round2 } from './common'

// Ghana's stacked levies on a room rate (VAT + NHIL + GETFund + tourism levy), as the app posts them.
const TAX_RATE = 0.219

const SAMPLE_ROOM_TYPES = [
  { key: 'standard', name: 'Standard Room', baseRate: 350, capacity: 2, category: 'standard', description: 'Comfortable room with a queen bed', amenities: ['wifi', 'air_conditioning', 'tv'] },
  { key: 'deluxe', name: 'Deluxe Room', baseRate: 550, capacity: 2, category: 'deluxe', description: 'Larger room with a king bed and a view', amenities: ['wifi', 'air_conditioning', 'tv', 'minibar'] },
  { key: 'suite', name: 'Executive Suite', baseRate: 850, capacity: 4, category: 'suite', description: 'Suite with a separate lounge', amenities: ['wifi', 'air_conditioning', 'tv', 'minibar', 'balcony'] },
]
const SAMPLE_ROOM_NUMBERS: Array<[string, string, string]> = [
  ['101', 'standard', '1'], ['102', 'standard', '1'], ['103', 'standard', '1'],
  ['201', 'deluxe', '2'], ['202', 'deluxe', '2'], ['203', 'deluxe', '2'],
  ['301', 'suite', '3'], ['302', 'suite', '3'], ['303', 'suite', '3'],
]

// key, name, email, phone, nationality, source
const GUESTS: Array<[string, string, string, string, string, string]> = [
  ['g1', 'Kwame Boateng', 'kwame.boateng@sample.hotel', '+233 24 700 0001', 'Ghanaian', 'walkin'],
  ['g2', 'Sarah Thompson', 'sarah.thompson@sample.hotel', '+44 7700 900002', 'British', 'online'],
  ['g3', 'Adwoa Frimpong', 'adwoa.frimpong@sample.hotel', '+233 20 700 0003', 'Ghanaian', 'corporate'],
  ['g4', 'Michael Osei', 'michael.osei@sample.hotel', '+233 26 700 0004', 'Ghanaian', 'referral'],
  ['g5', 'Fatima Abdullah', 'fatima.abdullah@sample.hotel', '+233 24 700 0005', 'Ghanaian', 'online'],
  ['g6', 'Daniel Mensah', 'daniel.mensah@sample.hotel', '+233 27 700 0006', 'Ghanaian', 'online'],
  ['g7', 'Grace Owusu-Ansah', 'grace.owusuansah@sample.hotel', '+233 24 700 0007', 'Ghanaian', 'friend'],
  ['g8', 'Peter Nkrumah', 'peter.nkrumah@sample.hotel', '+233 50 700 0008', 'Ghanaian', 'walkin'],
]

type Stay = {
  key: string; guest: string; typeIndex: number; arrive: number; depart: number
  status: 'checked-in' | 'confirmed' | 'checked-out'; adults: number; source: string
  guaranteed?: boolean; company?: string; requests?: string
  deposit?: { method: string; amount: number }
  extras?: Array<{ offset: number; description: string; category: string; amount: number }>
  settle?: string // payment method used to settle a checked-out folio in full
}
const STAYS: Stay[] = [
  { key: 'r1', guest: 'g1', typeIndex: 0, arrive: -2, depart: 1, status: 'checked-in', adults: 2, source: 'WALK IN', deposit: { method: 'Cash', amount: 500 }, extras: [{ offset: -1, description: 'Restaurant - Dinner', category: 'f&b', amount: 190 }] },
  { key: 'r2', guest: 'g2', typeIndex: 1, arrive: -1, depart: 3, status: 'checked-in', adults: 1, source: 'Booking.com', deposit: { method: 'Card', amount: 600 }, requests: 'Late check-out if possible' },
  { key: 'r3', guest: 'g3', typeIndex: 2, arrive: -1, depart: 2, status: 'checked-in', adults: 2, source: 'Corporate', company: 'Sample Mining Ltd' },
  { key: 'r4', guest: 'g4', typeIndex: 1, arrive: 0, depart: 2, status: 'confirmed', adults: 2, source: 'Direct', guaranteed: true, requests: 'High floor, quiet room' },
  { key: 'r5', guest: 'g5', typeIndex: 0, arrive: 0, depart: 1, status: 'confirmed', adults: 1, source: 'Booking.com' },
  { key: 'r6', guest: 'g6', typeIndex: 0, arrive: 3, depart: 5, status: 'confirmed', adults: 2, source: 'Direct' },
  { key: 'r7', guest: 'g7', typeIndex: 1, arrive: -6, depart: -3, status: 'checked-out', adults: 2, source: 'Direct', settle: 'Mobile Money' },
  { key: 'r8', guest: 'g8', typeIndex: 0, arrive: -4, depart: -1, status: 'checked-out', adults: 1, source: 'WALK IN', settle: 'Cash' },
]

export async function loadFrontOffice(ctx: SampleCtx): Promise<string[]> {
  const { p, tenantId } = ctx
  const notes: string[] = []

  // ---- rooms: use the hotel's own; add a sample set only if it has none configured ----
  const settings = await prisma.systemSettings.findUnique({ where: { tenantId } })
  if (!settings) return ['Front Office sample data was skipped: this hotel has no settings record yet — finish setup first.']
  const rs = { ...((settings.roomSettings as Record<string, any>) || {}) }
  const objects = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && x.id) : [])
  let roomTypes: any[] = objects(rs.roomTypes)
  let rooms: any[] = objects(rs.rooms)
  let ratePlans: any[] = objects(rs.ratePlans)
  if (roomTypes.length === 0 || rooms.length === 0) {
    const typeId = (key: string) => `${p}rt_${key}`
    roomTypes = [...roomTypes, ...SAMPLE_ROOM_TYPES.map((t) => ({
      id: typeId(t.key), name: t.name, baseRate: t.baseRate, capacity: t.capacity, amenities: t.amenities, isActive: true, category: t.category, description: t.description, images: [],
      policies: { cancellation: '24 hours before arrival', deposit: false, smoking: false, pets: false },
    }))]
    rooms = [...rooms, ...SAMPLE_ROOM_NUMBERS.map(([number, key, floor]) => ({
      id: `${p}rm_${number}`, number, typeId: typeId(key), floor, status: 'available', isActive: true, notes: '', features: [], maintenance: { lastInspection: '', nextInspection: '', issues: [] },
    }))]
    ratePlans = [...ratePlans, ...SAMPLE_ROOM_TYPES.map((t) => ({
      id: `${p}rp_${t.key}`, name: `BAR - ${t.name}`, roomTypeId: typeId(t.key), basePrice: t.baseRate, isActive: true, marketSegment: 'leisure', mealPlan: 'bed_breakfast', rateType: 'standard',
      restrictions: { minStay: 1, maxStay: 30, advanceBooking: 0, cancellationPolicy: '24 hours before arrival' }, seasonalRates: [], dayOfWeekRates: [],
    }))]
    await prisma.systemSettings.update({ where: { tenantId }, data: { roomSettings: { ...rs, roomTypes, rooms, ratePlans } as any } })
    notes.push('This hotel had no rooms configured, so a sample set of 3 room types and 9 rooms was added.')
  }

  // ---- pick rooms: three types, rooms not currently held by a real stay ----
  const busy = new Set((await prisma.reservation.findMany({
    where: { tenantId, status: 'checked-in', NOT: { id: { startsWith: p } } }, select: { roomId: true },
  })).map((r) => r.roomId))
  const activeTypes = roomTypes.filter((t) => t.isActive !== false).slice(0, 3)
  const roomFor = new Map<string, any>()
  const taken = new Set<string>()
  // Only stays that are in the house or arriving today must avoid rooms a real guest holds right now;
  // past and future stays don't clash with tonight's occupancy. Sample stays never share a room.
  const pickRoom = (stay: Stay) => {
    const type = activeTypes[stay.typeIndex % Math.max(activeTypes.length, 1)]
    const needsFreeNow = stay.status === 'checked-in' || stay.arrive === 0
    const free = (r: any) => r.isActive !== false && !taken.has(r.number) && !(needsFreeNow && busy.has(r.number))
    const candidate = rooms.find((r) => r.typeId === type?.id && free(r)) || rooms.find(free)
    if (candidate) taken.add(candidate.number)
    roomFor.set(stay.key, { type, room: candidate })
  }
  STAYS.forEach(pickRoom)

  // ---- guests ----
  const tag = tenantId.slice(-4).toUpperCase()
  await seedRows(prisma.guest, GUESTS.map(([key, name, email, phone, nationality, source], i) => {
    const [first, ...rest] = name.split(' ')
    return { id: `${p}${key}`, tenantId, serialNumber: `SMP${tag}-${String(i + 1).padStart(3, '0')}`, name, firstName: first, lastName: rest.join(' '), email, phone, nationality, source, isActive: true }
  }))

  // ---- reservations and folios ----
  const reservationRows: Array<Record<string, any>> = []
  const folioRows: Array<Record<string, any>> = []
  STAYS.forEach((stay, i) => {
    const { type, room } = roomFor.get(stay.key)!
    const rate = Number(type?.baseRate || 350)
    const plan = ratePlans.find((rp) => rp.roomTypeId === type?.id)
    const nights = stay.depart - stay.arrive
    const rateBreakdown = Array.from({ length: nights }, (_, n) => ({ date: dayString(ctx, stay.arrive + n), base: rate, total: round2(rate * (1 + TAX_RATE)) }))
    const paidStatus = stay.settle ? 'paid' : stay.deposit ? 'partial' : 'unpaid'
    reservationRows.push({
      id: `${p}${stay.key}`, tenantId, guestId: `${p}${stay.guest}`, resId: `RES-SMP-${String(i + 1).padStart(3, '0')}`,
      roomType: type?.id, ratePlanId: plan?.id, roomId: room?.number, status: stay.status, source: stay.source,
      checkInDate: dayOffset(ctx, stay.arrive), checkOutDate: dayOffset(ctx, stay.depart), adults: stay.adults, children: 0,
      specialRequests: stay.requests, stayReason: stay.company ? 'business' : 'leisure', isGuaranteed: !!stay.guaranteed, companyName: stay.company,
      checkedInAt: stay.status === 'confirmed' ? null : new Date(dayOffset(ctx, stay.arrive).getTime() + 14 * 3_600_000 + 20 * 60_000),
      checkedOutAt: stay.status === 'checked-out' ? new Date(dayOffset(ctx, stay.depart).getTime() + 10 * 3_600_000 + 40 * 60_000) : null,
      details: { guestName: GUESTS.find((g) => g[0] === stay.guest)![1], roomTypeId: type?.id, marketCodes: [stay.source === 'WALK IN' ? 'WALK IN' : stay.source.toUpperCase()], rateBreakdown, paymentStatus: paidStatus, ...(stay.deposit ? { deposit: { amount: stay.deposit.amount, method: stay.deposit.method } } : {}) },
    })
    if (stay.status === 'confirmed') return // nothing is billed before arrival

    // One room charge per night that has been through night audit (the last night of an in-house stay isn't over yet).
    const lastBilledNight = stay.status === 'checked-in' ? -1 : stay.depart - 1
    const charges: Array<Record<string, any>> = []
    for (let night = stay.arrive; night <= lastBilledNight; night++) {
      charges.push({ id: `C-${p}${stay.key}-n${night}`, date: `${dayString(ctx, night)}T02:00:00.000Z`, description: 'Room Charge', category: 'room', amount: rate, tax: round2(rate * TAX_RATE) })
    }
    for (const extra of stay.extras || []) {
      charges.push({ id: `C-${p}${stay.key}-x${extra.offset}`, date: `${dayString(ctx, extra.offset)}T20:00:00.000Z`, description: extra.description, category: extra.category, amount: extra.amount, tax: round2(extra.amount * TAX_RATE) })
    }
    const totalCharges = round2(charges.reduce((s, c) => s + c.amount + c.tax, 0))
    const payments: Array<Record<string, any>> = []
    if (stay.deposit) payments.push({ id: `P-${p}${stay.key}-dep`, date: `${dayString(ctx, stay.arrive)}T15:00:00.000Z`, method: stay.deposit.method, amount: stay.deposit.amount, status: 'completed', processedBy: 'Sample Front Desk' })
    if (stay.settle) payments.push({ id: `P-${p}${stay.key}-set`, date: `${dayString(ctx, stay.depart)}T10:30:00.000Z`, method: stay.settle, amount: totalCharges, status: 'completed', processedBy: 'Sample Front Desk' })
    const totalPayments = round2(payments.reduce((s, x) => s + x.amount, 0))
    folioRows.push({
      id: `FOL-S${tag}-${String(i + 1).padStart(3, '0')}`, tenantId, reservationId: `${p}${stay.key}`, currency: 'GHS', status: stay.status === 'checked-out' ? 'closed' : 'active',
      totalCharges, totalPayments, balance: round2(totalCharges - totalPayments), charges, payments,
    })
  })
  await seedRows(prisma.reservation, reservationRows)
  await seedRows(prisma.guestFolio, folioRows)

  // ---- night audit history: the last three business days, one with a no-show ----
  await seedRows(prisma.nightAuditLog, [3, 2, 1].map((back) => ({
    id: `${p}na_${back}`, tenantId, businessDate: dayString(ctx, -back), source: back === 1 ? 'manual' : 'scheduled', status: 'completed',
    roomChargesPosted: STAYS.filter((s) => s.status !== 'confirmed' && s.arrive <= -back && s.depart > -back).length, noShowsMarked: back === 2 ? 1 : 0,
    runBy: back === 1 ? 'Ibrahim Mahama (sample)' : 'System', runAt: new Date(dayOffset(ctx, -back + 1).getTime() + 2 * 3_600_000),
  })))

  // ---- yesterday's front desk till, closed and counted ----
  const takenYesterday = folioRows.flatMap((f) => f.payments as any[]).filter((x) => x.date.startsWith(dayString(ctx, -1)))
  const sumBy = (re: RegExp) => round2(takenYesterday.filter((x) => re.test(x.method)).reduce((s, x) => s + x.amount, 0))
  const cash = sumBy(/cash/i)
  await seedRows(prisma.cashierShift, [{
    id: `${p}till_fo`, tenantId, outlet: 'frontoffice', businessDate: dayString(ctx, -1), cashierUserId: 'sample-cashier', cashierName: 'Akosua Mensah (sample)',
    openingFloat: 500, openedAt: new Date(dayOffset(ctx, -1).getTime() + 7 * 3_600_000), closedAt: new Date(dayOffset(ctx, -1).getTime() + 15 * 3_600_000),
    expectedCash: round2(500 + cash), closingCount: round2(500 + cash), variance: 0, totalCash: cash, totalCard: sumBy(/card/i), totalMobileMoney: sumBy(/mobile/i), totalOther: 0,
    status: 'closed', transferTo: 'accounts', transferToName: 'Abena Danso', transferAmount: cash, transferredAt: new Date(dayOffset(ctx, -1).getTime() + 15 * 3_600_000 + 20 * 60_000),
  }])

  // ---- guest services and what in-house guests have asked for ----
  const SERVICES: Array<[string, string, string, number, string]> = [
    ['airport', 'Airport pick-up', 'transport', 250, 'Hotel shuttle'], ['laundry', 'Laundry & pressing', 'laundry', 60, 'In-house laundry'],
    ['spa', 'Massage (60 min)', 'wellness', 350, 'Serenity Spa'], ['tour', 'Accra city tour', 'tours', 400, 'Gold Coast Tours'], ['wakeup', 'Wake-up call', 'concierge', 0, 'Front desk'],
  ]
  await seedRows(prisma.guestService, SERVICES.map(([key, name, category, price, provider]) => ({ id: `${p}svc_${key}`, tenantId, name, category, price, provider, status: 'available', description: `${name} — sample service` })))
  const inHouse = (key: string) => {
    const stay = STAYS.find((s) => s.key === key)!
    return { guestId: `${p}${stay.guest}`, reservationId: `${p}${key}`, clientName: GUESTS.find((g) => g[0] === stay.guest)![1], roomNumber: roomFor.get(key)?.room?.number }
  }
  await seedRows(prisma.serviceRequest, [
    { id: `${p}sreq_1`, tenantId, serviceId: `${p}svc_airport`, ...inHouse('r2'), requestDate: dayOffset(ctx, 3), status: 'pending', priority: 'high', notes: 'Flight BA078 departs 22:40 — pick up from room at 19:00' },
    { id: `${p}sreq_2`, tenantId, serviceId: `${p}svc_laundry`, ...inHouse('r1'), requestDate: dayOffset(ctx, 0), status: 'in_progress', priority: 'medium', notes: '3 shirts, 2 trousers — same-day' },
    { id: `${p}sreq_3`, tenantId, serviceId: `${p}svc_spa`, ...inHouse('r3'), requestDate: dayOffset(ctx, -1), status: 'completed', priority: 'low' },
    { id: `${p}sreq_4`, tenantId, serviceId: `${p}svc_wakeup`, ...inHouse('r2'), requestDate: dayOffset(ctx, 1), status: 'pending', priority: 'medium', notes: 'Wake-up at 05:30' },
  ])
  return notes
}

export async function removeFrontOffice(ctx: SampleCtx) {
  await prisma.guestService.deleteMany({ where: bySampleId(ctx) }) // its requests go with it
  await prisma.serviceRequest.deleteMany({ where: bySampleId(ctx) })
  await prisma.cashierShift.deleteMany({ where: bySampleId(ctx) })
  await prisma.nightAuditLog.deleteMany({ where: bySampleId(ctx) })
  const guests = await prisma.guest.findMany({ where: bySampleId(ctx), select: { id: true } })
  // Every stay of a sample guest (including ones a tester added) goes with them, along with its folios.
  const reservations = await prisma.reservation.findMany({
    where: { tenantId: ctx.tenantId, OR: [{ id: { startsWith: ctx.p } }, { guestId: { in: guests.map((g) => g.id) } }] }, select: { id: true },
  })
  const reservationIds = reservations.map((r) => r.id)
  await prisma.guestFolio.deleteMany({ where: { tenantId: ctx.tenantId, reservationId: { in: reservationIds } } })
  await prisma.reservation.deleteMany({ where: { tenantId: ctx.tenantId, id: { in: reservationIds } } })
  await prisma.guest.deleteMany({ where: bySampleId(ctx) })

  // Sample room types / rooms / rate plans live inside the settings JSON.
  const settings = await prisma.systemSettings.findUnique({ where: { tenantId: ctx.tenantId } })
  if (settings) {
    const rs = { ...((settings.roomSettings as Record<string, any>) || {}) }
    let changed = false
    for (const key of ['roomTypes', 'rooms', 'ratePlans']) {
      if (!Array.isArray(rs[key])) continue
      const kept = rs[key].filter((x: any) => !(x && typeof x.id === 'string' && x.id.startsWith(ctx.p)))
      if (kept.length !== rs[key].length) { rs[key] = kept; changed = true }
    }
    if (changed) await prisma.systemSettings.update({ where: { tenantId: ctx.tenantId }, data: { roomSettings: rs as any } })
  }
}

export async function countFrontOffice(ctx: SampleCtx) {
  return {
    guests: await prisma.guest.count({ where: bySampleId(ctx) }),
    reservations: await prisma.reservation.count({ where: bySampleId(ctx) }),
  }
}
