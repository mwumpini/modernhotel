# GRA E-VAT: plan for AGM Sync

Noted 2026-10-15. Not started; first step is contacting GRA.

## What GRA requires

- Every VAT document is sent to GRA's system (the VSDC) before the customer gets it. GRA checks it,
  signs it, and returns a **signature, QR code, GRA invoice number and timestamp** that must be
  printed on the document.
- Covers invoices, receipts, refunds, credit and debit notes, and for hotels a **statement of
  account** (all charges for a stay in one document; our checkout bill).
- Legal basis: VAT Act 2025 (Act 1151), in force 1 January 2026. Rollout is **phased**: a hotel's
  obligation starts with its own GRA selection notice and go-live date. After that, manual or
  ordinary computer invoices are non-compliant.
- Operating rules: log in to GRA at least daily for an access token; tell GRA within 24 hours of
  an outage; changes to invoicing software need GRA approval.
- Rates: 15% VAT + 2.5% NHIL + 2.5% GETFund (COVID levy gone). Tourism Levy is separate.
- Routes: free GRA invoicing app, direct API integration (our route), or certified third-party
  software. No official public vendor list or API specification found; both come from GRA.

## How AGM Sync would do it

1. **E-VAT settings per hotel**: GRA TIN, API credentials stored securely server-side, test/live switch.
2. **Automatic sending** when an invoice, receipt, POS bill, refund or checkout statement is
   finalised; save GRA's signature, QR code and number on the document.
3. **Never block the desk**: send in the background; mark "awaiting GRA" and retry when GRA or the
   internet is down; a screen lists pending or rejected documents.
4. **E-VAT template block** printing the QR code, GRA number and signature on the Noda bill,
   receipts and POS slips.
5. **Refunds and voids** become GRA credit notes automatically.
6. **Clean data before sending**: customer TIN for companies, item codes and tax categories on
   menu and service items, and validation.
7. **Daily login and outage reminders** for the 24-hour rule.

## What it takes

- From GRA (gating): API specification, sandbox account, and either accreditation of AGM Sync as an
  integration provider or each hotel's own credentials. Needs a registered business behind AGM Sync.
- Build: about 2-4 weeks once the specification is in hand, then about 4 weeks of joint testing
  with GRA before go-live.
- Selling point: "E-VAT ready" across front desk, restaurant and checkout statement.

## Next step

Write to GRA's E-VAT unit asking for the developer specification, sandbox access, and the
accreditation process for software providers. Meanwhile the system side can be prepared (data
fields and the E-VAT print block).

## Sources

- Fonoa: https://www.fonoa.com/resources/blog/ghana-e-vat-e-invoicing-2026
- ClearTax: https://www.cleartax.com/gh/e-invoicing-ghana
- DDD Invoices: https://dddinvoices.com/learn/e-invoicing-in-ghana
- VATupdate: https://www.vatupdate.com/2026/01/29/briefing-document-podcast-e-invoicing-and-e-reporting-in-ghana/
- Powersoft: https://www.powersoftsystem.com/post/ghana-e-vat-guide-2026
- Deloitte Ghana: https://www.deloitte.com/gh/en/services/tax/perspectives/electronic-invoicing-regime-update-on-implementation.html
