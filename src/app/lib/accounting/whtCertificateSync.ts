/**
 * WHT certificates are stored on the linked WHT payment's `details` JSON
 * (field `whtCertificateData`) so they survive DB hydration without a separate table.
 */

import type { Payment, WHTCertificate } from './models';

export function whtCertificatesFromPayments(payments: Payment[]): WHTCertificate[] {
  const byId = new Map<string, WHTCertificate>();
  for (const p of payments) {
    if (!p.isWHTCertificate) continue;
    const cert = p.whtCertificateData;
    if (cert?.id) byId.set(cert.id, cert);
  }
  return Array.from(byId.values());
}

export function mergeWhtCertificateLists(
  existing: WHTCertificate[],
  fromPayments: WHTCertificate[],
): WHTCertificate[] {
  const byId = new Map<string, WHTCertificate>();
  for (const c of existing) byId.set(c.id, c);
  for (const c of fromPayments) {
    const prev = byId.get(c.id);
    byId.set(c.id, prev ? { ...prev, ...c, updatedAt: c.updatedAt || prev.updatedAt } : c);
  }
  return Array.from(byId.values());
}

export function paymentWithWhtCertificateData(
  payment: Payment,
  cert: WHTCertificate,
): Payment {
  return { ...payment, whtCertificateId: cert.id, whtCertificateData: cert };
}

export function patchForWhtCertificatePayment(
  cert: WHTCertificate,
): Partial<Payment> {
  return {
    reference: cert.certificateNumber,
    description: `WHT/VAT withheld on ${cert.invoiceNumber}${cert.certificateNumber.startsWith('PENDING-') ? ' (pending certificate)' : ` - Cert: ${cert.certificateNumber}`}`,
    whtCertificateData: cert,
    whtAmount: cert.whtAmount,
    whtVatAmount: cert.whtVatAmount,
    updatedAt: cert.updatedAt,
  };
}
