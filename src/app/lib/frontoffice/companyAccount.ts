import { frontOfficeStore } from './store';
import { findMainFolio } from './helpers/folio';
import { isCorporateGuest } from './helpers/guests';
import { shortDay, stayFigures } from './stayWorksheet';
import type { GuestProfile, Reservation } from './types';

export type BillStanding = 'paid' | 'pending';

export type CompanyStayLine = {
  reservation: Reservation;
  companyName: string;
  key: string;
  amount: number;
  balance: number;
  paid: number;
  standing: BillStanding;
};

export type CompanyAccount = {
  key: string;
  name: string;
  stays: CompanyStayLine[];
  guestNames: string[];
  billed: number;
  paid: number;
  pending: number;
};

export type CompanyAllocation = {
  reservationId: string;
  guestName: string;
  resId: string;
  applied: number;
  remaining: number;
  overpay: number;
};

export type CompanyLedgerEntry = {
  id: string;
  date: string;
  method: string;
  reference: string;
  amount: number;
  splits: Array<{ guestName: string; resId: string; amount: number }>;
};

const OPEN = 0.005;

export function companyKeyOf(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Company this stay is billed to. A company on the guest profile alone does not attach a private stay. */
export function stayCompanyName(res: Reservation, guest?: GuestProfile | null): string | null {
  const onStay = (res.companyName || '').trim();
  if (onStay) return onStay;
  const onGuest = (guest?.companyName || '').trim();
  if (isCorporateGuest(guest)) return onGuest || (guest?.name || '').trim() || null;
  if ((res.billingPersonName || res.billingPersonId) && onGuest) return onGuest;
  return null;
}

/** Name used to open a company record from a guest, including a profile company that this stay is not billed to. */
export function lookupCompanyName(res: Reservation, guest?: GuestProfile | null): string | null {
  return stayCompanyName(res, guest) || (guest?.companyName || '').trim() || null;
}

export function billStanding(_res: Reservation, balance: number, _companyName: string | null): BillStanding {
  return balance <= OPEN ? 'paid' : 'pending';
}

export function standingLabel(standing: BillStanding) {
  return standing === 'paid' ? 'Paid' : 'Pending';
}

function preferredName(names: string[]) {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] || '';
}

export function companyStayLines(matches?: (reservation: Reservation) => boolean): CompanyStayLine[] {
  return frontOfficeStore.reservations.flatMap((reservation) => {
    if (matches && !matches(reservation)) return [];
    const guest = frontOfficeStore.guests.find((item) => item.id === reservation.guestId);
    const companyName = stayCompanyName(reservation, guest);
    if (!companyName) return [];
    const figures = stayFigures(reservation);
    return [{
      reservation,
      companyName,
      key: companyKeyOf(companyName),
      amount: figures.amount,
      balance: figures.balance,
      paid: figures.paid,
      standing: billStanding(reservation, figures.balance, companyName),
    }];
  });
}

export function companyAccounts(matches?: (reservation: Reservation) => boolean): CompanyAccount[] {
  const groups = new Map<string, CompanyStayLine[]>();
  for (const line of companyStayLines(matches)) {
    const rows = groups.get(line.key) || [];
    rows.push(line);
    groups.set(line.key, rows);
  }
  return [...groups.entries()].map(([key, stays]) => {
    const guestNames = [...new Set(stays.map((line) => line.reservation.guestName))].sort((a, b) => a.localeCompare(b));
    return {
      key,
      name: preferredName(stays.map((line) => line.companyName)),
      stays: stays.sort((a, b) => (a.reservation.arrival || '').localeCompare(b.reservation.arrival || '')),
      guestNames,
      billed: stays.reduce((sum, line) => sum + line.amount, 0),
      paid: stays.reduce((sum, line) => sum + line.paid, 0),
      pending: stays.filter((line) => line.standing === 'pending').reduce((sum, line) => sum + line.balance, 0),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function companyAccount(key: string, matches?: (reservation: Reservation) => boolean) {
  return companyAccounts(matches).find((account) => account.key === key) || null;
}

export function guestEarlierStays(guestId: string, excludeReservationId: string) {
  if (!guestId) return [];
  return frontOfficeStore.reservations.flatMap((reservation) => {
    if (reservation.guestId !== guestId || reservation.id === excludeReservationId) return [];
    const guest = frontOfficeStore.guests.find((item) => item.id === reservation.guestId);
    const companyName = stayCompanyName(reservation, guest);
    const figures = stayFigures(reservation);
    if (figures.balance <= OPEN) return [];
    return [{
      reservation,
      companyName,
      balance: figures.balance,
      standing: billStanding(reservation, figures.balance, companyName),
    }];
  });
}

/** One company receipt, with the amount that landed on each stay. Payments that share a reference are one lump sum. */
export function companyLedger(key: string, matches?: (reservation: Reservation) => boolean): CompanyLedgerEntry[] {
  const lines = companyStayLines(matches).filter((line) => line.key === key);
  const groups = new Map<string, CompanyLedgerEntry>();
  for (const line of lines) {
    const folio = findMainFolio(frontOfficeStore.folios, line.reservation.id);
    for (const payment of folio?.payments || []) {
      if ((payment.status || 'completed') !== 'completed') continue;
      const reference = (payment.ref || '').trim();
      const groupId = reference ? `ref:${reference}` : payment.id;
      const existing = groups.get(groupId);
      const split = {
        guestName: line.reservation.guestName,
        resId: line.reservation.resId || line.reservation.id,
        amount: payment.amount || 0,
      };
      if (existing) {
        existing.amount += split.amount;
        existing.splits.push(split);
        if (payment.date > existing.date) existing.date = payment.date;
      } else {
        groups.set(groupId, {
          id: groupId,
          date: payment.date,
          method: payment.method,
          reference,
          amount: split.amount,
          splits: [split],
        });
      }
    }
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Checked stays, oldest first. Any amount past those balances goes on the stay chosen for the extra. */
export function previewCompanyAllocation(key: string, amount: number, selectedIds?: string[], extraOnId?: string | null, matches?: (reservation: Reservation) => boolean) {
  const account = companyAccount(key, matches);
  const tendered = Math.max(0, amount || 0);
  const ordered = [...(account?.stays || [])].sort((a, b) => (
    (a.reservation.arrival || '').localeCompare(b.reservation.arrival || '')
    || (a.reservation.resId || '').localeCompare(b.reservation.resId || '')
  ));
  const chosenIds = selectedIds ?? ordered.filter((line) => line.balance > OPEN).map((line) => line.reservation.id);
  const picked = ordered.filter((line) => chosenIds.includes(line.reservation.id));
  let remaining = tendered;
  const lines: CompanyAllocation[] = [];
  for (const line of picked) {
    if (remaining <= OPEN || line.balance <= OPEN) continue;
    const applied = Math.min(remaining, line.balance);
    lines.push({
      reservationId: line.reservation.id,
      guestName: line.reservation.guestName,
      resId: line.reservation.resId || line.reservation.id,
      applied,
      remaining: line.balance - applied,
      overpay: 0,
    });
    remaining -= applied;
  }
  const spare = Math.max(0, remaining);
  const extraOn = spare > OPEN && picked.length > 0
    ? (extraOnId && picked.some((line) => line.reservation.id === extraOnId) ? extraOnId : picked[0].reservation.id)
    : null;
  if (spare > OPEN && extraOn) {
    const stay = picked.find((line) => line.reservation.id === extraOn);
    const existing = lines.find((line) => line.reservationId === extraOn);
    if (existing) {
      existing.applied += spare;
      existing.overpay += spare;
      existing.remaining = 0;
    } else if (stay) {
      lines.push({
        reservationId: extraOn,
        guestName: stay.reservation.guestName,
        resId: stay.reservation.resId || stay.reservation.id,
        applied: spare,
        remaining: 0,
        overpay: spare,
      });
    }
  }
  const applied = lines.reduce((sum, line) => sum + line.applied, 0);
  const towardBills = lines.reduce((sum, line) => sum + (line.applied - line.overpay), 0);
  return { lines, applied, extra: extraOn ? spare : 0, extraOn, towardBills };
}

export function companyStayWhen(reservation: Reservation) {
  return `${shortDay(reservation.arrival)} – ${shortDay(reservation.departure)}`;
}
