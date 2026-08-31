'use client';

/**
 * Front Office Folio helpers
 *
 * These pure functions operate on a "store-like" object (the frontOfficeStore instance)
 * to keep logic testable and decoupled from the class file. They manage folios,
 * balances, charges, payments and inter-folio movements, and bridge to accounting
 * and audit modules. No UI concerns live here.
 * 
 * ACCOUNTING (simple flow):
 * Folio holds charges and payments during the stay. Sales invoices, receipts, and
 * GL journal entries are posted once at checkout via generateAccountingInvoiceForReservation.
 * Other modules (e.g. events) still use accounting/integration.ts directly.
 */

import { trackEvent } from '../../analytics/trackEvent';
import { logAudit } from '../../analytics/auditLogStore';
import type { Folio, FolioPayment } from '../types';
import { computeSalesTaxTotal, getCanonicalTaxRates } from '../../tax/engine';
import { useSettingsStore } from '../../settings/store';

type StoreLike = any;

const SERVICE_CHARGE_KEYWORDS = [
	'service', 'swimming', 'laundry', 'pool', 'spa', 'gym', 'restaurant', 'bar',
	'room service', 'minibar', 'parking', 'wifi', 'internet', 'breakfast', 'lunch',
	'dinner', 'snack', 'beverage', 'drink', 'food', 'meal',
];

export { calculateStayNights } from './rates';

function isRoomCharge(description?: string) {
	return (description || '').toLowerCase().includes('room');
}

/** Map folio charge to GL revenue account at checkout (simpleFlow). */
export function folioChargeGlCode(charge: { description?: string; category?: string }): string {
	const cat = (charge.category || '').toLowerCase();
	if (isRoomCharge(charge.description) || cat === 'room') return '4100';
	if (cat === 'f&b' || cat === 'fb' || isServiceCharge(charge.description)) return '4200';
	if (cat === 'conference' || (charge.description || '').toLowerCase().includes('conference')) return '4300';
	return '4300';
}

function isServiceCharge(description?: string) {
	const desc = (description || '').toLowerCase();
	return SERVICE_CHARGE_KEYWORDS.some((k) => desc.includes(k));
}

/** Canonical folio totals for tables, modals, and billing screens. */
export function getFolioDisplayTotals(folio: Folio) {
	const charges = folio.charges || [];
	const payments = folio.payments || [];
	const subtotal = charges.reduce((s, c) => s + (c.amount || 0), 0);
	const taxTotal = charges.reduce((s, c) => s + (c.tax || 0), 0);
	const totalCharges = subtotal + taxTotal;
	const totalPayments = payments
		.filter((p) => p.status === 'completed')
		.reduce((s, p) => s + (p.amount || 0), 0);
	const balance = totalCharges - totalPayments;
	const outstandingBalance = Math.max(0, balance);
	// Room charges are net (excl. tax); all levy amounts roll up into taxTotal.
	const roomCharges = charges
		.filter((c) => isRoomCharge(c.description))
		.reduce((s, c) => s + (c.amount || 0), 0);
	const serviceCharges = charges
		.filter((c) => isServiceCharge(c.description))
		.reduce((s, c) => s + (c.amount || 0), 0);
	const otherCharges = charges
		.filter((c) => !isRoomCharge(c.description) && !isServiceCharge(c.description))
		.reduce((s, c) => s + (c.amount || 0), 0);
	const gross = (c: { amount?: number; tax?: number }) => (c.amount || 0) + (c.tax || 0);
	const roomChargesInclusive = charges
		.filter((c) => isRoomCharge(c.description))
		.reduce((s, c) => s + gross(c), 0);
	const serviceChargesInclusive = charges
		.filter((c) => isServiceCharge(c.description))
		.reduce((s, c) => s + gross(c), 0);
	return {
		subtotal,
		taxTotal,
		totalCharges,
		totalPayments,
		balance,
		outstandingBalance,
		roomCharges,
		serviceCharges,
		otherCharges,
		roomChargesInclusive,
		serviceChargesInclusive,
	};
}

/**
 * The guest's own folio for a reservation — excludes the auto-created 'split'
 * "Company Folio" that corporate reservations get alongside their main one.
 * A corporate reservation has TWO Folio rows sharing the same reservationId
 * (main + split), so any plain `folios.find(f => f.reservationId === id)`
 * is a coin-flip between them once the split folio exists (it did until this
 * fix — the split is unshifted to index 0, so the guest's real folio was
 * silently unreachable by id-only lookup after its first creation). Every
 * call site that wants "the guest's folio" (as opposed to explicitly the
 * company-billed split) should go through this instead of a raw `.find`.
 */
export function findMainFolio(folios: Folio[] | undefined, reservationId: string): Folio | undefined {
	const candidates = (folios || []).filter((f: any) => f.reservationId === reservationId && f.type !== 'split');
	if (candidates.length <= 1) return candidates[0];
	// A hydration race (getOrCreateFolio called client-side before the async GET
	// /api/folios pull resolves) can leave several folio rows for the same
	// reservation — the real one plus empty duplicates created and persisted
	// before the server's copy was known locally. Prefer whichever actually has
	// charges/payments over an empty placeholder so old data isn't shadowed by
	// a duplicate that happens to sit earlier in the array.
	return (
		candidates.find((f: any) => (f.charges?.length || 0) > 0 || (f.payments?.length || 0) > 0) || candidates[0]
	);
}

/**
 * Get existing folio for a reservation or create a new active folio.
 * Notifies the store when a new folio is created.
 */
export function getOrCreateFolio(self: StoreLike, reservationId: string): Folio {
	let f = findMainFolio(self.folios, reservationId);
	if (!f) {
		f = {
			id: useSettingsStore.getState().getNextModuleNumber('frontOffice', 'folio'),
			reservationId,
			charges: [],
			payments: [],
			currency: 'GHS',
			status: 'active'
		};
		self.folios.unshift(f);

		updateFolioBalances(self, f);
		self.notify();
	}
	return f as Folio;
}

/**
 * Fetch folio by internal folio id.
 */
export function getFolioById(self: StoreLike, folioId: string): Folio | undefined {
	return self.folios.find((f: any) => f.id === folioId) as Folio | undefined;
}

/**
 * Recompute folio totals and propagate credit usage to guest profile when needed.
 * Safe to call after any folio mutation.
 */
export function updateFolioBalances(self: StoreLike, folio: Folio) {
	const totalCharges = folio.charges.reduce((sum, charge) => sum + charge.amount + (charge.tax || 0), 0);
	const totalPayments = (folio.payments || [])
		.filter((p: any) => p.status === 'completed')
		.reduce((sum: number, payment: any) => sum + payment.amount, 0);
	const balance = totalCharges - totalPayments;

	folio.totalCharges = totalCharges;
	folio.totalPayments = totalPayments;
	folio.balance = balance;

	const creditUsed = (folio.payments || [])
		.filter((p: any) => p.method === 'Credit' && p.status === 'completed')
		.reduce((sum: number, payment: any) => sum + (payment.creditApplied || 0), 0);
	const prevCreditDeducted = folio._creditDeducted || 0;
	if (creditUsed !== prevCreditDeducted) {
		const reservation = self.reservations.find((r: any) => r.id === folio.reservationId);
		if (reservation) {
			const guest = self.guests.find((g: any) => g.id === reservation.guestId);
			if (guest) {
				guest.creditBalance = (guest.creditBalance || 0) - (creditUsed - prevCreditDeducted);
				guest.lastCreditUpdate = new Date().toISOString();
			}
		}
		folio._creditDeducted = creditUsed;
	}

	// Single write-through chokepoint: every folio mutation recomputes balances,
	// so persisting here keeps the database row authoritative without wiring each
	// individual helper (charge, payment, transfer, split, void, refund, close).
	//
	// Skip persisting a folio that's still completely empty. getOrCreateFolio
	// creates one synchronously whenever a reservation's real folio hasn't been
	// pulled from the server yet (the GET /api/folios hydration is async), so an
	// empty folio here doesn't mean "this reservation has no charges" — it can
	// just mean "the real one hasn't loaded yet." Persisting it anyway created a
	// second, empty DB row per race, and findMainFolio's `.find()` could then
	// return that empty duplicate instead of the real one. Nothing is lost by
	// waiting: the moment this folio gets an actual charge/payment, this same
	// function runs again and persists then.
	if ((folio.charges?.length || 0) === 0 && (folio.payments?.length || 0) === 0) return;
	try { self.persistFolio?.(folio); } catch {}
}

/**
 * Add a single charge to a folio, auto-computing tax from persisted tax rates
 * when not specified. GL revenue is recognised at guest checkout, not on each charge.
 */
export function addFolioCharge(self: StoreLike, folioId: string, charge: { id: string; description: string; amount: number; date?: string; tax?: number; category?: string; reference?: string; staffId?: string; staffName?: string; }) {
	const folio = getFolioById(self, folioId);
	if (!folio) return;
	if (folio.status === 'closed') {
		console.warn(`[folio] Attempted to add charge to closed folio ${folioId} — rejected`);
		return;
	}
	
	// Layered Ghana computation sourced from Settings compliance
	const tax = typeof charge.tax === 'number' ? charge.tax : computeSalesTaxTotal(charge.amount);
	folio.charges.push({
		id: charge.id,
		date: charge.date || new Date().toISOString(),
		description: charge.description,
		amount: charge.amount,
		tax,
		category: charge.category,
		reference: charge.reference
	});
	updateFolioBalances(self, folio);
	self.notify();
	trackEvent('FO.Folio.ChargePosted', { reservationId: folio.reservationId, description: charge.description, amount: charge.amount, tax, category: charge.category, reference: charge.reference });
}

/**
 * Close a folio and optionally generate an accounting invoice.
 */
export function closeFolio(self: StoreLike, reservationId: string, options?: { postInvoice?: boolean }) {
	const folio = getOrCreateFolio(self, reservationId);
	if (folio.status === 'closed') return folio;
	folio.status = 'closed';
	updateFolioBalances(self, folio);
	self.notify();
	try { trackEvent('FO.Folio.Closed' as any, { reservationId, totalCharges: folio.totalCharges, totalPayments: folio.totalPayments, balance: folio.balance }); } catch {}
	if (options?.postInvoice !== false) {
		try { self.generateAccountingInvoiceForReservation(reservationId); } catch (e) { console.warn('FO: closeFolio invoice post failed', e); }
	}
	return folio;
}

/**
 * Move an entire charge from one folio to another, preserving auditability.
 */
export function transferCharge(self: StoreLike, fromReservationId: string, chargeId: string, toReservationId: string, note?: string) {
	const fromFolio = getOrCreateFolio(self, fromReservationId);
	const toFolio = getOrCreateFolio(self, toReservationId);
	const idx = fromFolio.charges.findIndex(c => c.id === chargeId);
	if (idx === -1) return false;
	const charge = fromFolio.charges[idx];
	fromFolio.charges.splice(idx, 1);
	toFolio.charges.push({ ...charge, id: `C-${Date.now().toString().slice(-6)}`, description: `${charge.description} (Transferred${note ? `: ${note}` : ''})` } as any);
	updateFolioBalances(self, fromFolio);
	updateFolioBalances(self, toFolio);
	self.notify();
	trackEvent('FO.Folio.ChargeTransferred', { fromReservationId, toReservationId, amount: charge.amount });
	try { logAudit({ area: 'frontdesk', action: 'update', entity: 'Folio', entityId: fromReservationId, details: `Transferred charge ${chargeId} to ${toReservationId}`, severity: 'medium' }); } catch {}
	return true;
}

/**
 * Split part of a charge to another folio, keeping proportional tax allocation.
 */
export function splitCharge(self: StoreLike, reservationId: string, chargeId: string, targetReservationId: string, amountToMove: number, note?: string) {
	const source = getOrCreateFolio(self, reservationId);
	const idx = source.charges.findIndex(c => c.id === chargeId);
	if (idx === -1) return false;
	const charge = source.charges[idx];
	const move = Math.max(0, Math.min(amountToMove, charge.amount));
	if (move === 0) return false;
	const tax = charge.tax || 0;
	const taxMove = tax * (move / (charge.amount || 1));
	source.charges[idx] = { ...charge, amount: charge.amount - move, tax: Math.max(0, (tax as number) - taxMove) } as any;
	const target = getOrCreateFolio(self, targetReservationId);
	target.charges.push({ id: `C-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), description: `${charge.description} (Split${note ? `: ${note}` : ''})`, amount: move, tax: taxMove } as any);
	updateFolioBalances(self, source);
	updateFolioBalances(self, target);
	self.notify();
	trackEvent('FO.Folio.ChargeSplit', { reservationId, targetReservationId, move });
	try { logAudit({ area: 'frontdesk', action: 'update', entity: 'Folio', entityId: reservationId, details: `Split charge ${chargeId}, moved ₵${move} to ${targetReservationId}`, severity: 'medium' }); } catch {}
	return true;
}

/**
 * Post a reversing charge to void a prior charge, keeping originals for audit.
 */
export function voidCharge(self: StoreLike, reservationId: string, chargeId: string, reason: string) {
	const folio = getOrCreateFolio(self, reservationId);
	const ch = folio.charges.find(c => c.id === chargeId);
	if (!ch) return false;
	folio.charges.push({ id: `C-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), description: `VOID ${ch.description} - ${reason}`, amount: -Math.abs(ch.amount), tax: -(ch.tax || 0) } as any);
	updateFolioBalances(self, folio);
	self.notify();
	trackEvent('FO.Folio.ChargeVoided', { reservationId, amount: ch.amount });
	try { logAudit({ area: 'frontdesk', action: 'void', entity: 'Folio', entityId: reservationId, details: `Voided charge ${chargeId}: ${reason}`, severity: 'high' }); } catch {}
	return true;
}

/**
 * Refund a payment (fully or partially) by excluding the refunded amount from
 * totalPayments — the guest again owes it, and the original charge is untouched.
 * Mirrors updateFolioBalances' `status === 'completed'` filter: a 'refunded'
 * payment simply drops out of the total instead of needing an offsetting charge.
 */
export function refundPayment(self: StoreLike, reservationId: string, paymentId: string, amount: number, reason?: string) {
	const folio = getOrCreateFolio(self, reservationId);
	const payment = folio.payments.find(p => p.id === paymentId) as any;
	if (!payment || payment.status === 'refunded') return false;
	const val = Math.min(amount || payment.amount, payment.amount);
	if (val >= payment.amount) {
		payment.status = 'refunded';
	} else {
		payment.amount -= val;
		folio.payments.push({ id: `P-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), method: payment.method, amount: val, status: 'refunded', notes: `Refund: ${reason || ''}` } as any);
	}
	updateFolioBalances(self, folio);
	self.notify();
	trackEvent('FO.Folio.PaymentRefunded', { reservationId, amount: val });
	try { logAudit({ area: 'frontdesk', action: 'refund', entity: 'Folio', entityId: reservationId, details: `Refunded ₵${val}: ${reason || ''}`, severity: 'high' }); } catch {}
	return true;
}

/**
 * Allocate a single corporate receipt across multiple folios, highest balance first.
 */
export function postCorporateReceipt(self: StoreLike, payer: string, reservationIds: string[], totalAmount: number, reference?: string) {
	let remaining = totalAmount || 0;
	const allocations: Array<{ reservationId: string; applied: number }> = [];
	const ordered = [...reservationIds]
		.map(id => ({ id, bal: (getOrCreateFolio(self, id).balance || 0) }))
		.sort((a, b) => b.bal - a.bal)
		.map(x => x.id);

	for (const id of ordered) {
		if (remaining <= 0) break;
		const folio = getOrCreateFolio(self, id);
		updateFolioBalances(self, folio);
		const bal = Math.max(0, folio.balance || 0);
		if (bal <= 0) continue;
		const apply = Math.min(remaining, bal);
		if (apply > 0) {
			addPayment(self, id, 'Corporate Account', apply, {
				notes: `Corporate receipt from ${payer}${reference ? ` (${reference})` : ''}`,
				processedBy: 'Front Desk',
				ref: reference
			});
			allocations.push({ reservationId: id, applied: apply });
			remaining -= apply;
		}
	}

	self.notify();
	trackEvent('FO.Folio.CorporateReceiptAllocated', { payer, totalAmount, remaining, allocations: allocations.length });
	try {
		logAudit({
			area: 'frontdesk',
			action: 'create',
			entity: 'Payment',
			entityId: `CORP-${Date.now().toString().slice(-6)}`,
			details: `Corporate receipt ₵${totalAmount} from ${payer} allocated to ${allocations.length} folios` ,
			severity: 'medium',
			meta: { allocations, reference, remaining }
		});
	} catch {}

	return { allocations, remaining };
}

/**
 * Canonical tax rates from accounting TaxConfig (synced from compliance TaxRateBuilder).
 * Replaces the old settings.countryCompliance.taxRates path.
 */
export function getTaxRates(_self: StoreLike) {
    const r = getCanonicalTaxRates();
    return {
        vat: r.vat,
        nhil: r.nhil,
        getfund: r.getfund,
        levy: r.tourismLevy,
        covid: 0,
    };
}

/**
 * Convenience: add a simple charge to a reservation’s folio and emit events.
 */
export function addCharge(self: StoreLike, reservationId: string, description: string, amount: number) {
	const f = getOrCreateFolio(self, reservationId);
	const tax = computeSalesTaxTotal(amount);
	f.charges.push({ id: `C-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), description, amount, tax } as any);
	updateFolioBalances(self, f);
	self.notify();
	trackEvent('FO.Folio.ChargePosted', { reservationId, description, amount, tax });
}

/**
 * Post a payment to folio and update balances. Cash/bank and AR are posted at checkout.
 */
export function addPayment(self: StoreLike, reservationId: string, method: 'Cash'|'Card'|'Mobile Money'|'Credit'|'Corporate Account'|'Bank Transfer'|'Check', amount: number, options?: {
	invoiceId?: string;
	creditApplied?: number;
	notes?: string;
	processedBy?: string;
	staffId?: string;
	ref?: string;
}): import('../types').FolioPayment {
	const f = getOrCreateFolio(self, reservationId);
	const paymentId = `P-${Date.now().toString().slice(-6)}`;
	const payment: FolioPayment = {
		id: paymentId,
		date: new Date().toISOString(),
		method,
		amount,
		status: 'completed',
		processedBy: options?.processedBy || 'Front Desk',
		...options
	};
	f.payments.push(payment);
	updateFolioBalances(self, f);
	self.notify();
	trackEvent('FO.Folio.PaymentReceived', { reservationId, method, amount, invoiceId: options?.invoiceId });
	return payment;
}

export function updateFolioPayment(
	self: StoreLike,
	reservationId: string,
	paymentId: string,
	patch: {
		amount?: number;
		method?: FolioPayment['method'];
		notes?: string;
		ref?: string;
	},
) {
	const f = findMainFolio(self.folios, reservationId);
	if (!f) return false;
	const payment = f.payments.find((p: FolioPayment) => p.id === paymentId);
	if (!payment || payment.status === 'refunded') return false;
	if (patch.amount != null) payment.amount = patch.amount;
	if (patch.method) payment.method = patch.method;
	if (patch.notes !== undefined) payment.notes = patch.notes;
	if (patch.ref !== undefined) payment.ref = patch.ref;
	updateFolioBalances(self, f);
	self.notify();
	return true;
}

export function removeFolioPayment(self: StoreLike, reservationId: string, paymentId: string) {
	const f = findMainFolio(self.folios, reservationId);
	if (!f) return false;
	const idx = f.payments.findIndex((p: FolioPayment) => p.id === paymentId);
	if (idx < 0) return false;
	f.payments.splice(idx, 1);
	updateFolioBalances(self, f);
	self.notify();
	return true;
}


