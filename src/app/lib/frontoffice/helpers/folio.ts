'use client';

/**
 * Front Office Folio helpers
 *
 * These pure functions operate on a "store-like" object (the frontOfficeStore instance)
 * to keep logic testable and decoupled from the class file. They manage folios,
 * balances, charges, payments and inter-folio movements, and bridge to accounting
 * and audit modules. No UI concerns live here.
 * 
 * ACCOUNTING INTEGRATION:
 * All revenue and payment transactions are automatically captured by the accounting
 * system, creating Sales Invoices, Receipts, and GL journal entries.
 */

import { trackEvent } from '../../analytics/trackEvent';
import { logAudit } from '../../analytics/auditLogStore';
import { postRoomRevenue, postPayment } from '../../accounting/journal';
import { captureRevenue, capturePayment } from '../../accounting/integration';
import type { Folio, FolioPayment } from '../types';
import { useSettingsStore } from '../../settings/store';

type StoreLike = any;

/**
 * Get existing folio for a reservation or create a new active folio.
 * Notifies the store when a new folio is created.
 */
export function getOrCreateFolio(self: StoreLike, reservationId: string): Folio {
	let f = self.folios.find((x: any) => x.reservationId === reservationId);
	if (!f) {
		f = {
			id: `F-${Date.now().toString().slice(-6)}`,
			reservationId,
			charges: [],
			payments: [],
			currency: 'GHS',
			status: 'active'
		};
		self.folios.unshift(f);

		// Auto-create split folio for corporate payer to hold company-billable charges
		try {
			const res = self.reservations?.find((r: any) => r.id === reservationId);
			const isCorporate = !!(res?.companyName || res?.billingPersonName);
			if (isCorporate) {
				const existingSplit = self.folios.find((x: any) => x.reservationId === reservationId && x.type === 'split');
				if (!existingSplit) {
					const split: Folio = {
						id: `F-${Date.now().toString().slice(-6)}-C`,
						reservationId,
						charges: [],
						payments: [],
						currency: 'GHS',
						status: 'active',
						type: 'split',
						description: 'Company Folio',
						responsibleParty: res.companyName || res.billingPersonName
					};
					self.folios.unshift(split);
				}
			}
		} catch {}

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
	folio.balance = Math.max(0, balance);

	const creditUsed = (folio.payments || [])
		.filter((p: any) => p.method === 'Credit' && p.status === 'completed')
		.reduce((sum: number, payment: any) => sum + (payment.creditApplied || 0), 0);

	if (creditUsed > 0) {
		const reservation = self.reservations.find((r: any) => r.id === folio.reservationId);
		if (reservation) {
			const guest = self.guests.find((g: any) => g.id === reservation.guestId);
			if (guest) {
				guest.creditBalance = (guest.creditBalance || 0) - creditUsed;
				guest.lastCreditUpdate = new Date().toISOString();
			}
		}
	}
}

/**
 * Add a single charge to a folio, auto-computing tax from persisted tax rates
 * when not specified. Emits tracking and accounting signals for room revenue.
 * 
 * ACCOUNTING INTEGRATION:
 * Automatically captures revenue to AR, creates Sales Invoice, and posts GL entries.
 */
export function addFolioCharge(self: StoreLike, folioId: string, charge: { id: string; description: string; amount: number; date?: string; tax?: number; category?: string; reference?: string }) {
	const folio = getFolioById(self, folioId);
	if (!folio) return;
	
	// Layered Ghana computation sourced from Settings compliance
	const tax = typeof charge.tax === 'number' ? charge.tax : layeredTaxFromSettings(charge.amount);
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
	
	// Get reservation details for accounting
	const reservation = self.reservations?.find((r: any) => r.id === folio.reservationId);
	const guestName = reservation?.guestName || 'Walk-in Guest';
	const guestEmail = reservation?.guestEmail || reservation?.email;
	const guestPhone = reservation?.guestPhone || reservation?.phone;
	
	trackEvent('FO.Folio.ChargePosted', { reservationId: folio.reservationId, description: charge.description, amount: charge.amount, tax, category: charge.category, reference: charge.reference });
	
	// ===== ACCOUNTING INTEGRATION =====
	// Auto-capture revenue to AR, Sales Invoice, and GL
	try {
		const result = captureRevenue({
			id: charge.id,
			source: 'front_office',
			customerId: reservation?.guestId || folio.reservationId,
			customerName: guestName,
			customerEmail: guestEmail,
			customerPhone: guestPhone,
			reference: folio.reservationId,
			description: `${charge.description} - Room ${reservation?.roomId || reservation?.roomNumber || 'N/A'}`,
			items: [{
				description: charge.description,
				quantity: 1,
				unitPrice: charge.amount,
				taxPercent: tax > 0 ? (tax / charge.amount) * 100 : 0,
			}],
			subtotal: charge.amount,
			taxAmount: tax,
			total: charge.amount + tax,
			date: charge.date,
		});
		
		if (result) {
			console.log(`[FO.Folio] ✅ Accounting captured - Invoice: ${result.invoiceId}, JE: ${result.journalEntryId}`);
		}
	} catch (err) {
		console.error('[FO.Folio] ❌ Accounting integration error:', err);
	}
	
	// Legacy room revenue posting (kept for backward compatibility)
	if ((charge.description || '').toLowerCase().includes('room')) {
		postRoomRevenue(folio.reservationId, charge.amount, tax);
	}
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
 * Record a refund as negative payment and a matching negative revenue entry.
 */
export function refundPayment(self: StoreLike, reservationId: string, paymentId: string, amount: number, reason?: string) {
	const folio = getOrCreateFolio(self, reservationId);
	const payment = folio.payments.find(p => p.id === paymentId) as any;
	if (!payment) return false;
	const val = Math.min(amount || payment.amount, payment.amount);
	folio.payments.push({ id: `P-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), method: payment.method, amount: -Math.abs(val), status: 'completed', notes: `Refund: ${reason || ''}` } as any);
	folio.charges.push({ id: `C-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), description: `Refund issued${reason ? ` - ${reason}` : ''}`, amount: -Math.abs(val), tax: 0 } as any);
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
 * Read tax rates from storage with safe defaults.
 */
export function getTaxRates(self: StoreLike) {
    try {
        const settings = useSettingsStore.getState?.();
        const compliance = settings?.getCurrentCountryCompliance?.();
        const tr = (compliance?.taxRates || {}) as any;
        return { 
            vat: Number(tr.vat || 0), 
            nhil: Number(tr.nhil || 0), 
            levy: Number(tr.tourismLevy || 0),
            getfund: Number(tr.getfundLevy || 0),
            covid: Number(tr.covid19Levy || 0)
        } as any;
    } catch {
        return { vat: 12.5, nhil: 2.5, levy: 1.0 } as any;
    }
}

function layeredTaxFromSettings(amount: number): number {
    try {
        const rates = getTaxRates({});
        const subtotal = amount || 0;
        const nhilAmt = subtotal * (Number(rates.nhil || 0) / 100);
        const getfundAmt = subtotal * (Number((rates as any).getfund || 0) / 100);
        const covidAmt = subtotal * (Number((rates as any).covid || 0) / 100);
        const leviesTotal = nhilAmt + getfundAmt + covidAmt;
        const vatAmt = (subtotal + leviesTotal) * (Number(rates.vat || 0) / 100);
        const tourismAmt = subtotal * (Number(rates.levy || 0) / 100);
        return Math.max(0, nhilAmt + getfundAmt + covidAmt + vatAmt + tourismAmt);
    } catch {
        const { vat, nhil, levy } = { vat: 12.5, nhil: 2.5, levy: 1.0 } as any;
        return amount * ((vat + nhil + levy) / 100);
    }
}

/**
 * Convenience: add a simple charge to a reservation’s folio and emit events.
 */
export function addCharge(self: StoreLike, reservationId: string, description: string, amount: number) {
	const f = getOrCreateFolio(self, reservationId);
	const tax = layeredTaxFromSettings(amount);
	f.charges.push({ id: `C-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), description, amount, tax } as any);
	self.notify();
	trackEvent('FO.Folio.ChargePosted', { reservationId, description, amount, tax });
	if (description.toLowerCase().includes('room')) {
		postRoomRevenue(reservationId, amount, tax);
	}
}

/**
 * Post a payment to folio, update balances, and mirror to accounting journal.
 * 
 * ACCOUNTING INTEGRATION:
 * Automatically creates Receipt, updates AR invoice, and posts GL entries.
 */
export function addPayment(self: StoreLike, reservationId: string, method: 'Cash'|'Card'|'Mobile Money'|'Credit'|'Corporate Account'|'Bank Transfer'|'Check', amount: number, options?: {
	invoiceId?: string;
	creditApplied?: number;
	notes?: string;
	processedBy?: string;
	ref?: string;
}) {
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
	
	// Get reservation details for accounting
	const reservation = self.reservations?.find((r: any) => r.id === reservationId);
	const guestName = reservation?.guestName || 'Walk-in Guest';
	
	trackEvent('FO.Folio.PaymentReceived', { reservationId, method, amount, invoiceId: options?.invoiceId });
	
	// ===== ACCOUNTING INTEGRATION =====
	// Auto-capture payment to Receipt and GL
	try {
		// Map payment method to accounting-compatible method
		const accountingMethod = method === 'Credit' || method === 'Corporate Account' 
			? 'Bank Transfer' 
			: method === 'Check' 
				? 'Cheque' 
				: method;
		
		const result = capturePayment({
			id: paymentId,
			invoiceId: options?.invoiceId,
			customerId: reservation?.guestId || reservationId,
			customerName: guestName,
			amount: amount,
			paymentMethod: accountingMethod as any,
			reference: options?.ref || reservationId,
			description: options?.notes || `Payment from ${guestName}`,
		}, 'front_office');
		
		if (result) {
			console.log(`[FO.Folio] ✅ Payment captured - Receipt: ${result.receiptId}, JE: ${result.journalEntryId}`);
		}
	} catch (err) {
		console.error('[FO.Folio] ❌ Payment integration error:', err);
	}
	
	// Legacy payment posting (kept for backward compatibility)
	const legacyMethod = method === 'Credit' || method === 'Corporate Account' || method === 'Bank Transfer' || method === 'Check'
		? 'Cash' : method;
	postPayment(reservationId, legacyMethod as 'Cash'|'Card'|'Mobile Money', amount);
}


