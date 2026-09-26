import { frontOfficeStore } from './store';
import { findMainFolio, getFolioDisplayTotals } from './helpers/folio';
import { calculateStayNights } from './helpers/rates';
import { useSettingsStore } from '../settings/store';
import { hourStamp } from './operationalPolicies';
import { formatMoney } from '../format/currency';
import type { Reservation } from './types';

export type StaySortKey = 'arrival' | 'departure' | 'guest' | 'room' | 'amount';

export function dayOf(iso?: string) {
  return (iso || '').slice(0, 10);
}

export function localStayDay() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function money(n: number) {
  return `₵${formatMoney(n)}`;
}

export function shortDay(iso?: string) {
  const day = dayOf(iso);
  if (!day) return '';
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, (month || 1) - 1, date || 1).toLocaleDateString();
}

function clockOf(iso?: string) {
  if (!iso || !iso.includes('T')) return '';
  const stamp = iso.slice(11, 19);
  if (!stamp || stamp.startsWith('00:00:00')) return '';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  return when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function plannedClock(which: 'in' | 'out') {
  const state = useSettingsStore.getState();
  const policyHour = which === 'in' ? state.roomManagement?.standardCheckInHour : state.roomManagement?.standardCheckOutHour;
  const settings = state.hotelSettings;
  const stamp = typeof policyHour === 'number'
    ? hourStamp(policyHour, which === 'in' ? 14 : 11)
    : (which === 'in' ? settings?.checkInTime : settings?.checkOutTime);
  const [hour, minute] = (stamp || (which === 'in' ? '14:00' : '11:00')).split(':').map(Number);
  const when = new Date();
  when.setHours(hour || 0, minute || 0, 0, 0);
  return when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function stayClock(stay: Reservation, which: 'in' | 'out') {
  const actual = clockOf(which === 'in' ? stay.checkedInAt : stay.checkedOutAt);
  if (actual) return actual;
  const planned = clockOf(which === 'in' ? stay.arrival : stay.departure);
  return planned || plannedClock(which);
}

export function isRoomLine(charge: { description?: string; category?: string }) {
  const category = (charge.category || '').toLowerCase();
  if (category === 'room') return true;
  const description = (charge.description || '').toLowerCase();
  if (description.includes('service')) return false;
  return description.includes('room');
}

export function stayFigures(stay: Reservation) {
  const quote = frontOfficeStore.getReservationQuote(stay);
  const nights = quote.nights || calculateStayNights(stay.arrival, stay.departure) || 1;
  const nightly = quote.breakdown.map((day) => day.total || 0);
  const sameRate = nightly.length > 0 && nightly.every((total) => total === nightly[0]);
  const rate = sameRate ? nightly[0] : nights > 0 ? quote.grandTotal / nights : quote.grandTotal;
  const folio = findMainFolio(frontOfficeStore.folios, stay.id);
  const totals = folio ? getFolioDisplayTotals(folio) : null;
  const billed = (stay.status === 'checked-in' || stay.status === 'checked-out') && !!totals && totals.totalCharges > 0;
  const charges = folio?.charges || [];
  const discount = charges.reduce((sum, charge) => sum + (charge.discountAmount || 0), 0);
  const other = charges.reduce((sum, charge) => {
    if (isRoomLine(charge)) return sum;
    const net = (charge.amount || 0) + (charge.serviceCharge || 0) - (charge.discountAmount || 0);
    return sum + net + (charge.tax || 0);
  }, 0);
  const amount = billed ? totals.totalCharges : quote.grandTotal;
  const paid = totals?.totalPayments || 0;
  const balance = billed ? totals.outstandingBalance : Math.max(0, amount - paid);
  return { nights, rate, discount, other, amount, paid, balance };
}

export function deskStatus(stay: Reservation, today: string): { label: string; color: 'success' | 'warning' | 'danger' | 'primary' | 'default' } {
  if (stay.status === 'checked-out') return { label: 'Checked out', color: 'default' };
  if (stay.status !== 'checked-in') {
    return dayOf(stay.arrival) < today ? { label: 'Waiting', color: 'warning' } : { label: 'Arriving', color: 'success' };
  }
  if (dayOf(stay.departure) < today) return { label: 'Past departure', color: 'danger' };
  if (dayOf(stay.departure) === today) return { label: 'Leaving', color: 'warning' };
  return { label: 'In-house', color: 'primary' };
}

export function sortStays(stays: Reservation[], sortKey: StaySortKey, sortDir: 'asc' | 'desc') {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...stays].sort((a, b) => {
    let order = 0;
    if (sortKey === 'guest') order = a.guestName.localeCompare(b.guestName);
    else if (sortKey === 'room') order = (a.roomId || '').localeCompare(b.roomId || '', undefined, { numeric: true });
    else if (sortKey === 'departure') order = dayOf(a.departure).localeCompare(dayOf(b.departure));
    else if (sortKey === 'amount') order = stayFigures(a).amount - stayFigures(b).amount;
    else order = dayOf(a.arrival).localeCompare(dayOf(b.arrival));
    if (order === 0) order = a.guestName.localeCompare(b.guestName);
    return order * dir;
  });
}
