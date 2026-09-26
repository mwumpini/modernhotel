/**
 * Front office certification.
 * The desk journey runs in this process only: no window, so nothing is written
 * to the open hotel or the browser. The live section only reads the demo tenant.
 *
 * Run: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/cert-frontoffice-e2e.ts
 */
(globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}), text: async () => '' });

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) console.log('ok ', name);
  else {
    failed += 1;
    console.error('FAIL', name, detail);
  }
}

function localDay(d = new Date()) {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function plusDays(iso: string, n: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + n);
  return localDay(date);
}

async function deskJourney() {
  const { frontOfficeStore } = await import('../src/app/lib/frontoffice/store');
  const { useSettingsStore } = await import('../src/app/lib/settings/store');
  const { housekeepingStore } = await import('../src/app/lib/housekeeping/store');
  const { getFolioDisplayTotals } = await import('../src/app/lib/frontoffice/helpers/folio');

  const settings = useSettingsStore.getState();
  settings.updateNestedSetting('roomManagement.requireDepositToConfirm', false);
  settings.updateNestedSetting('roomManagement.depositPolicyEnabled', false);
  settings.updateNestedSetting('roomManagement.cancellationPolicyEnabled', false);
  settings.updateNestedSetting('roomManagement.noShowPolicyEnabled', false);
  settings.updateNestedSetting('roomManagement.earlyCheckoutPolicyEnabled', false);
  settings.updateNestedSetting('roomManagement.lateCheckoutFeeEnabled', false);
  settings.updateNestedSetting('roomManagement.postFirstNightAtCheckin', true);
  settings.updateNestedSetting('roomSettings.autoAssignRooms', false);
  const roomTypes = settings.roomManagement.roomTypes || [];
  settings.updateNestedSetting('roomManagement.roomTypes', [
    ...roomTypes,
    { id: 'cert-type', name: 'Cert Room', baseRate: 200 },
    { id: 'cert-suite', name: 'Cert Suite', baseRate: 400 },
  ]);

  const today = localDay();
  const tomorrow = plusDays(today, 1);
  const dayAfter = plusDays(today, 2);

  const guest = frontOfficeStore.createGuest({
    firstName: 'Ama',
    lastName: 'Cert',
    nationality: 'Ghanaian',
    idType: 'Ghana Card',
    idNumber: 'GHA-CERT-1',
    creditLimit: 50,
  } as any);
  const secondGuest = frontOfficeStore.createGuest({
    firstName: 'Kofi',
    lastName: 'Cert',
    nationality: 'Ghanaian',
    idType: 'Ghana Card',
    idNumber: 'GHA-CERT-2',
  } as any);
  check('a new guest gets a client number', !!guest.serialNumber && guest.serialNumber !== secondGuest.serialNumber, `${guest.serialNumber} / ${secondGuest.serialNumber}`);
  check('credit stops at the guest limit', frontOfficeStore.addCreditToGuest(guest.id, 40, 'cert') === true && frontOfficeStore.addCreditToGuest(guest.id, 20, 'over') === false && frontOfficeStore.getGuestCreditBalance(guest.id) === 40);

  const book = (name: string, roomId?: string, extra: Record<string, unknown> = {}) => frontOfficeStore.createReservation({
    guestId: guest.id,
    guestName: name,
    roomTypeId: 'cert-type',
    arrival: `${today}T14:00:00`,
    departure: `${tomorrow}T11:00:00`,
    stayReason: 'personal',
    roomId,
    status: 'confirmed',
    rateBreakdown: [{ date: today, base: 200, total: 230 }],
    ...extra,
  } as any);

  const stay = book('CERT Stay', 'CERT-101');
  const other = book('CERT Other', 'CERT-202');
  check('a reservation gets its own number', !!stay.resId && stay.resId !== other.resId, `${stay.resId} / ${other.resId}`);
  check('the same room cannot be sold twice for those dates', frontOfficeStore.isRoomFreeForRange('CERT-101', `${today}T14:00:00`, `${tomorrow}T11:00:00`) === false);
  check('a different room is free', frontOfficeStore.isRoomFreeForRange('CERT-303', `${today}T14:00:00`, `${tomorrow}T11:00:00`) === true);

  const rooms = settings.roomManagement.rooms || [];
  settings.updateNestedSetting('roomManagement.rooms', [
    ...rooms,
    { id: 'CERT-101', number: 'CERT-101', typeId: 'cert-type', floor: '1', isActive: true },
    { id: 'CERT-404', number: 'CERT-404', typeId: 'cert-suite', floor: '4', isActive: true },
  ]);
  frontOfficeStore.addRoom({ id: 'CERT-101', roomTypeId: 'cert-type', floor: '1' });
  frontOfficeStore.addRoom({ id: 'CERT-404', roomTypeId: 'cert-suite', floor: '4' });
  check('housekeeping has the new room vacant for auto-assign', housekeepingStore.getRoomsByStatus('vacant').some((room) => room.roomNumber === 'CERT-404'));
  settings.updateNestedSetting('roomSettings.autoAssignRooms', true);
  const walkIn = book('CERT Walk-in');
  frontOfficeStore.reservations = frontOfficeStore.reservations.map((r) => r.id === walkIn.id ? { ...r, roomId: undefined as any, roomTypeId: 'cert-suite' } : r);
  frontOfficeStore.checkIn(walkIn.id);
  const walked = frontOfficeStore.reservations.find((r) => r.id === walkIn.id);
  check('check-in assigns a vacant room when auto-assign is on', walked?.status === 'checked-in' && walked?.roomId === 'CERT-404', `room ${walked?.roomId} status ${walked?.status}`);

  settings.updateNestedSetting('roomSettings.autoAssignRooms', false);
  const unassigned = book('CERT Unassigned');
  frontOfficeStore.reservations = frontOfficeStore.reservations.map((r) => r.id === unassigned.id ? { ...r, roomId: undefined as any } : r);
  frontOfficeStore.checkIn(unassigned.id);
  const openDesk = frontOfficeStore.reservations.find((r) => r.id === unassigned.id);
  check('check-in without a room stays TBD when auto-assign is off', openDesk?.status === 'checked-in' && (openDesk?.roomId === 'TBD' || !openDesk?.roomId), `room ${openDesk?.roomId}`);

  frontOfficeStore.checkIn(stay.id);
  const folio = frontOfficeStore.getOrCreateFolio(stay.id);
  const firstNight = (folio.charges || []).filter((c) => (c.description || '').includes('Room Charge'));
  check('check-in posts the first room night', firstNight.length === 1 && firstNight[0].amount === 200, firstNight.map((c) => c.amount).join(','));

  frontOfficeStore.addCharge(stay.id, 'Laundry', 80);
  const afterLaundry = frontOfficeStore.getOrCreateFolio(stay.id);
  const due = getFolioDisplayTotals(afterLaundry).balance;
  const payment = frontOfficeStore.addPayment(stay.id, 'Cash', due, { processedBy: 'Cert Cashier' });
  const settled = getFolioDisplayTotals(frontOfficeStore.getOrCreateFolio(stay.id));
  check('a cash payment clears the folio balance', Math.abs(settled.balance) < 0.02, `balance ${settled.balance} due was ${due}`);

  frontOfficeStore.addCharge(other.id, 'Minibar', 40);
  const minibar = (frontOfficeStore.getOrCreateFolio(other.id).charges || []).find((c) => c.description === 'Minibar');
  const moved = frontOfficeStore.transferCharge(other.id, minibar!.id, stay.id, 'guest request');
  const onStay = (frontOfficeStore.getOrCreateFolio(stay.id).charges || []).some((c) => (c.description || '').includes('Minibar') && (c.description || '').includes('Transferred'));
  const leftBehind = (frontOfficeStore.getOrCreateFolio(other.id).charges || []).some((c) => c.id === minibar!.id);
  check('a charge moves to the other folio', moved === true && onStay && !leftBehind);

  frontOfficeStore.addCharge(stay.id, 'Spa', 100);
  const spa = (frontOfficeStore.getOrCreateFolio(stay.id).charges || []).find((c) => c.description === 'Spa');
  const split = frontOfficeStore.splitCharge(stay.id, spa!.id, other.id, 30, 'shared');
  const spaLeft = (frontOfficeStore.getOrCreateFolio(stay.id).charges || []).find((c) => c.id === spa!.id);
  const spaMoved = (frontOfficeStore.getOrCreateFolio(other.id).charges || []).some((c) => (c.description || '').includes('Spa') && (c.description || '').includes('Split'));
  check('part of a charge can be split onto another folio', split === true && Math.abs((spaLeft?.amount || 0) - 70) < 0.02 && spaMoved, `left ${spaLeft?.amount}`);

  frontOfficeStore.addCharge(other.id, 'Telephone', 15);
  const phone = (frontOfficeStore.getOrCreateFolio(other.id).charges || []).find((c) => c.description === 'Telephone');
  const beforeVoid = getFolioDisplayTotals(frontOfficeStore.getOrCreateFolio(other.id)).balance;
  const voided = frontOfficeStore.voidCharge(other.id, phone!.id, 'wrong room');
  const afterVoid = getFolioDisplayTotals(frontOfficeStore.getOrCreateFolio(other.id)).balance;
  check('voiding a charge reverses it and keeps the original line', voided === true && beforeVoid - afterVoid > 14 && (frontOfficeStore.getOrCreateFolio(other.id).charges || []).some((c) => c.id === phone!.id));

  const refunded = frontOfficeStore.refundPayment(stay.id, payment.id, payment.amount, 'cert refund');
  const afterRefund = getFolioDisplayTotals(frontOfficeStore.getOrCreateFolio(stay.id)).balance;
  check('a full refund puts the amount back on the folio', refunded === true && afterRefund > due - 0.05, `balance ${afterRefund}`);

  const creditPaid = frontOfficeStore.applyCreditPayment(stay.id, 30, 'house credit');
  check('guest credit pays the folio and the credit balance drops', creditPaid === true && frontOfficeStore.getGuestCreditBalance(guest.id) === 10);

  frontOfficeStore.assignRoom(stay.id, 'CERT-404', { keepRate: true });
  const movedStay = frontOfficeStore.reservations.find((r) => r.id === stay.id);
  check('a room move can keep the quoted rate', movedStay?.roomId === 'CERT-404' && movedStay?.rateBreakdown?.[0]?.base === 200, `base ${movedStay?.rateBreakdown?.[0]?.base}`);

  const extended = frontOfficeStore.extendStay(stay.id, 1);
  check('extending a stay adds one night', extended?.departure.slice(0, 10) === dayAfter && (extended?.rateBreakdown || []).length === 2, `${extended?.departure} nights ${(extended?.rateBreakdown || []).length}`);
  const shortened = frontOfficeStore.shortenStay(stay.id, 1);
  check('shortening a stay removes that night', shortened?.departure.slice(0, 10) === tomorrow);
  check('a stay cannot be shortened to nothing', frontOfficeStore.shortenStay(stay.id, 5) === null);

  const groupId = frontOfficeStore.linkReservationsAsGroup([stay.id, other.id]);
  const leader = frontOfficeStore.reservations.find((r) => r.id === stay.id);
  const member = frontOfficeStore.reservations.find((r) => r.id === other.id);
  check('two stays can be linked as a group', !!groupId && leader?.isGroupLeader === true && member?.linkedReservationId === stay.id && member?.groupId === groupId);

  const wake = frontOfficeStore.scheduleWakeUpCall(stay.id, today, '06:30', 'airport');
  check('a wake-up call is booked for the stay', !!wake && frontOfficeStore.wakeUpCalls.some((c) => c.id === wake.id && c.time === '06:30'));
  frontOfficeStore.completeWakeUpCall(wake!.id, 'Cert');
  check('a wake-up call can be completed', frontOfficeStore.wakeUpCalls.find((c) => c.id === wake!.id)?.status === 'completed');

  const express = book('CERT Express', 'CERT-101');
  check('express check-in uses the same check-in path', frontOfficeStore.expressCheckIn(express.id) === true && frontOfficeStore.reservations.find((r) => r.id === express.id)?.status === 'checked-in');
  check('express check-in refuses a guest who is already in', frontOfficeStore.expressCheckIn(express.id) === false);

  const payer = frontOfficeStore.createBillingPerson({
    name: 'Cert Company',
    company: 'Cert Company',
    email: 'billing@cert.test',
    phone: '0200000000',
  } as any);
  check('a billing person can be recorded', !!payer?.id && frontOfficeStore.billingPersons.some((b) => b.id === payer.id));

  frontOfficeStore.setCompanyBillStatus(stay.id, 'with_company');
  check('a company bill can be marked with the company', (frontOfficeStore.reservations.find((r) => r.id === stay.id) as any)?.companyBillStatus === 'with_company');

  const removed = frontOfficeStore.removeFolioPayment(other.id, 'missing');
  check('removing a payment that is not there does nothing', removed === false);
}

async function liveHotel() {
  const { prisma } = await import('../src/app/lib/database/client');
  const { getFrontOfficeBusinessDate, getPropertyCalendarDate, loadFolioRounding } = await import('../src/app/lib/frontoffice/folioServer');
  const { recomputeFolioTotals, isPostedRoomCharge, isMainFolioRow } = await import('../src/app/lib/frontoffice/folioLedger');

  const tenant = await prisma.tenant.findFirst({ where: { subdomain: 'demo' } });
  if (!tenant) {
    check('demo hotel is in the database', false);
    await prisma.$disconnect();
    return;
  }

  const openDate = await getFrontOfficeBusinessDate(tenant.id);
  const calendar = await getPropertyCalendarDate(tenant.id);
  check('the open hotel day matches the calendar', openDate === calendar, `${openDate} vs ${calendar}`);

  const elapsed = ['2026-09-23', '2026-09-24', '2026-09-25'];
  const logs = await prisma.nightAuditLog.findMany({
    where: { tenantId: tenant.id, businessDate: { in: elapsed }, status: 'completed' },
  });
  const closed = new Set(logs.map((row) => row.businessDate));
  check('23, 24 and 25 September each have a completed night audit', elapsed.every((day) => closed.has(day)), [...closed].join(','));

  const rounding = await loadFolioRounding(tenant.id);
  const folios = await prisma.guestFolio.findMany({ where: { tenantId: tenant.id } });
  const mismatches: string[] = [];
  const duplicateNights: string[] = [];
  for (const folio of folios) {
    if (!isMainFolioRow(folio)) continue;
    const charges = Array.isArray(folio.charges) ? folio.charges as any[] : [];
    const payments = Array.isArray(folio.payments) ? folio.payments as any[] : [];
    const exactCharges = charges.reduce((sum, line) => sum + Number(line.amount || 0) + Number(line.tax || 0) + Number(line.serviceCharge || 0) - Number(line.discountAmount || 0), 0);
    const exactPayments = payments
      .filter((line) => (line.status || 'completed') === 'completed')
      .reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const exactBalance = exactCharges - exactPayments;
    const settled = recomputeFolioTotals(charges, payments, rounding);
    const storedCharges = Number(folio.totalCharges);
    const storedBalance = Number(folio.balance);
    const matchesExact = Math.abs(storedCharges - exactCharges) <= 0.02 && Math.abs(storedBalance - exactBalance) <= 0.02;
    const matchesSettled = Math.abs(storedCharges - settled.totalCharges) <= 0.02 && Math.abs(storedBalance - settled.balance) <= 0.02;
    if (!matchesExact && !matchesSettled) {
      mismatches.push(`${folio.id} stored ${storedBalance} lines ${exactBalance.toFixed(2)} settle ${settled.balance}`);
    }
    const nights = new Map<string, number>();
    for (const line of charges) {
      if (!isPostedRoomCharge(line)) continue;
      const id = String(line.id || '');
      if (!id.startsWith('ROOM-')) continue;
      const date = String(line.date || '').slice(0, 10);
      nights.set(date, (nights.get(date) || 0) + 1);
    }
    for (const [date, count] of nights) {
      if (count > 1) duplicateNights.push(`${folio.reservationId} ${date} x${count}`);
    }
  }
  check('every guest folio balance matches its charges and payments', mismatches.length === 0, mismatches.slice(0, 5).join('; '));
  check('no folio has two room nights on the same date', duplicateNights.length === 0, duplicateNights.slice(0, 5).join('; '));

  const active = await prisma.reservation.findMany({
    where: { tenantId: tenant.id, status: { in: ['confirmed', 'checked-in'] } },
    select: { id: true, resId: true, roomId: true, status: true, checkInDate: true, checkOutDate: true },
  });
  const overlaps: string[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (!a.roomId || a.roomId === 'TBD' || a.roomId !== b.roomId) continue;
      if (a.checkInDate < b.checkOutDate && b.checkInDate < a.checkOutDate) overlaps.push(`${a.roomId}: ${a.resId || a.id} and ${b.resId || b.id}`);
    }
  }
  check('no two active stays share a room on the same dates', overlaps.length === 0, overlaps.slice(0, 5).join('; '));

  const numbers = active.map((row) => row.resId).filter(Boolean) as string[];
  check('active stays do not share a reservation number', new Set(numbers).size === numbers.length, `${numbers.length - new Set(numbers).size} duplicates`);

  const inHouse = active.filter((row) => row.status === 'checked-in');
  const pastDeparture = inHouse.filter((row) => row.checkOutDate.toISOString().slice(0, 10) < openDate);
  console.log(`note ${inHouse.length} guests are checked in; ${pastDeparture.length} of them are past their departure date`);

  const shifts = await prisma.cashierShift.findMany({ where: { tenantId: tenant.id, status: 'closed' } });
  const badVariance = shifts.filter((shift) => {
    if (shift.closingCount == null || shift.expectedCash == null || shift.variance == null) return false;
    return Math.abs(Number(shift.variance) - (Number(shift.closingCount) - Number(shift.expectedCash))) > 0.02;
  });
  check('closed cashier shifts store variance as counted cash minus expected cash', badVariance.length === 0, `${badVariance.length} shifts`);

  await prisma.$disconnect();
}

async function main() {
  await deskJourney();
  await liveHotel();
  if (failed > 0) {
    console.error(`FO_CERT_FAIL ${failed}`);
    process.exit(1);
  }
  console.log('FO_CERT_PASS');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
