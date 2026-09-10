import type { BlockConfig, BlockTemplate, TemplateStyle } from './blocks';
import { DEFAULT_TEMPLATE_STYLE } from './blocks';
import type { PrintType } from './templates';

const NOW = '2025-01-01T00:00:00.000Z'; // fixed placeholder — built-ins aren't "updated", they ship with the app

function block(partial: Partial<BlockConfig> & Pick<BlockConfig, 'id' | 'type' | 'order'>): BlockConfig {
  return { visible: true, ...partial };
}

/**
 * Classic letterhead row — logo on the left, company name/address/contact
 * stacked in a column to its right, both on one row, with a divider below
 * separating the header from the rest of the document. Shared by
 * checkoutBillBlocks and registrationCardBlocks, which use it identically.
 */
function letterheadHeaderRow(order: number): BlockConfig {
  return block({
    id: 'company-header-row', type: 'container', order, direction: 'row', gap: 'small', dividerBelow: true, spacing: 'none',
    children: [
      block({ id: 'logo', type: 'logo', order: 0, flexWeight: 0, align: 'left' }),
      block({
        id: 'company-info-col', type: 'container', order: 1, direction: 'column', gap: 'none', flexWeight: 1,
        children: [
          block({ id: 'company-name', type: 'company-name', order: 0, align: 'left', spacing: 'none', underline: true, style: { fontSize: 'lg', bold: true } }),
          block({ id: 'company-address', type: 'company-address', order: 1, align: 'left', spacing: 'none' }),
          block({ id: 'company-contact', type: 'company-contact', order: 2, align: 'left', spacing: 'none' }),
        ],
      }),
    ],
  });
}

/**
 * Every piece as its own standalone, independently orderable/styleable line —
 * company name/address/contact, doc title/number/date, guest/stay details, and
 * each totals line (subtotal, taxes, grand total, payments, balance) in that
 * display order (matches the old combined totals-summary's row order).
 */
function standardBlocks(recipientHeading: string): BlockConfig[] {
  return [
    block({ id: 'logo', type: 'logo', order: 0 }),
    block({ id: 'company-name', type: 'company-name', order: 1 }),
    block({ id: 'company-address', type: 'company-address', order: 2 }),
    block({ id: 'company-contact', type: 'company-contact', order: 3 }),
    block({ id: 'doc-title', type: 'doc-title', order: 4 }),
    block({ id: 'doc-number', type: 'doc-number', order: 5 }),
    block({ id: 'doc-date', type: 'doc-date', order: 6 }),
    block({ id: 'guest-details', type: 'guest-details', order: 7, heading: recipientHeading }),
    block({ id: 'stay-details', type: 'stay-details', order: 8 }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 9, columns: ['qty', 'unit', 'unitPrice', 'date'] }),
    block({ id: 'totals-subtotal', type: 'totals-subtotal', order: 10 }),
    block({ id: 'totals-taxes', type: 'totals-taxes', order: 11 }),
    block({ id: 'totals-grandtotal', type: 'totals-grandtotal', order: 12 }),
    block({ id: 'totals-payments', type: 'totals-payments', order: 13 }),
    block({ id: 'totals-balance', type: 'totals-balance', order: 14 }),
    block({ id: 'notes-text', type: 'notes-text', order: 15 }),
  ];
}

/** Mirrors variantTopClassInvoice() in templates.ts — same blocks + watermark + signatures. */
function premiumBlocks(recipientHeading: string, signatures: Array<{ label: string; role?: string }>): BlockConfig[] {
  return [
    ...standardBlocks(recipientHeading),
    block({ id: 'signature-block', type: 'signature-block', order: 16, signatures }),
  ];
}

/**
 * Cover-letter style: "ATTN: <name> / Dear Sir/Madam," opening, items as a dotted-leader
 * list (each can carry a bold heading + bullet inclusions, e.g. a Conference Package),
 * numbered tax breakdown + amount in words, and a Terms & Conditions section — matches
 * how several Ghanaian hotels (e.g. Excelsa Lodge) format a conference/event invoice.
 */
function itemizedLetterBlocks(signatures: Array<{ label: string; role?: string }>): BlockConfig[] {
  return [
    block({ id: 'logo', type: 'logo', order: 0, align: 'center' }),
    block({ id: 'company-name', type: 'company-name', order: 1, align: 'center', spacing: 'small', dividerBelow: true }),
    // Date left, Our Ref right — one row, matching how the reference letterhead
    // opens (no address/contact repeated here — those belong in the footer).
    block({
      id: 'date-ref-row', type: 'container', order: 2, direction: 'row', gap: 'medium',
      children: [
        block({ id: 'doc-date', type: 'doc-date', order: 0, heading: 'Date:', flexWeight: 1 }),
        block({ id: 'doc-number', type: 'doc-number', order: 1, flexWeight: 1, align: 'right', docNumberLabel: 'Our Ref:' }),
      ],
    }),
    block({ id: 'recipient-info', type: 'recipient-info', order: 3, heading: 'Attention', recipientDisplay: 'letter' }),
    // The bold underlined section heading ("BILL INVOICE FOR …") — doc-title
    // moved here (rather than up with the header) since the letter format puts
    // it after the salutation, introducing the itemized list below.
    block({ id: 'doc-title', type: 'doc-title', order: 4, underline: true, spacing: 'small' }),
    block({ id: 'custom-text', type: 'custom-text', order: 5, indent: 'small', text: 'Please find below our invoice as per your request.' }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 6, lineItemsDisplay: 'list' }),
    // Keeps the combined totals-summary block (rather than the granular totals-*
    // ones) since the numbered "(i) (ii) …" roman-numeral format only makes sense
    // as one continuous sequence — see blocks.ts.
    block({ id: 'totals-summary', type: 'totals-summary', order: 7, totalsDisplay: 'numbered-list', showAmountInWords: true }),
    block({ id: 'notes-text', type: 'notes-text', order: 8 }),
    block({ id: 'signature-block', type: 'signature-block', order: 9, signatures }),
    block({
      id: 'terms-conditions', type: 'terms-conditions', order: 10,
      termsSections: [
        { heading: 'Fixed Booking Baseline', body: 'The initial number of reserved rooms/pax and stay dates specified are fixed upon final acceptance, unless written notice of modification is provided at least 72 hours prior to arrival.' },
        { heading: 'Prior Notice for Modifications', body: 'Any adjustments, headcount changes, or extensions require formal notice to management at least 24 hours in advance, subject to availability.' },
        { heading: 'Checkout Protocol', body: 'Standard checkout time is 12:00 PM on the departure date. Late checkouts without prior approval from management may incur additional charges.' },
        { heading: 'Payment Terms', body: 'Full settlement of the total tax inclusive amount is required prior to or upon arrival, unless an alternative corporate payment agreement is established.' },
        { heading: 'Incidentals and Extra Charges', body: 'This bill covers accommodation, conference, and catering charges and applicable statutory taxes only. Personal expenses or damages will be billed separately.' },
      ],
    }),
  ];
}

/**
 * Day-by-day matrix schedule: logo + centered company header, a boxed
 * reference number beside the ATTN line, a centered underlined title, the
 * dates-as-columns matrix table, numbered tax breakdown, and a single
 * sign-off — matches how several Ghanaian hotels (e.g. Menish Hotel) format
 * a multi-day conference/accommodation proforma.
 */
function dailyScheduleBlocks(recipientHeading: string, signatures: Array<{ label: string; role?: string }>): BlockConfig[] {
  return [
    block({
      id: 'company-header-row', type: 'container', order: 0, direction: 'row', gap: 'small',
      children: [
        block({ id: 'logo', type: 'logo', order: 0, flexWeight: 0, align: 'left' }),
        block({
          id: 'company-info-col', type: 'container', order: 1, direction: 'column', gap: 'none', flexWeight: 1,
          children: [
            block({ id: 'company-name', type: 'company-name', order: 0, align: 'center', style: { fontSize: 'lg', bold: true } }),
            block({ id: 'company-address', type: 'company-address', order: 1, align: 'center' }),
            block({ id: 'company-contact', type: 'company-contact', order: 2, align: 'center' }),
          ],
        }),
      ],
    }),
    block({ id: 'doc-date', type: 'doc-date', order: 1, spacing: 'small' }),
    // ATTN on the left (2x wider), a boxed bare reference number on the right.
    block({
      id: 'attn-ref-row', type: 'container', order: 2, direction: 'row', gap: 'medium',
      children: [
        block({ id: 'guest-details', type: 'guest-details', order: 0, heading: recipientHeading, border: 'none', flexWeight: 2 }),
        block({ id: 'doc-number', type: 'doc-number', order: 1, flexWeight: 1, align: 'right', docNumberLabel: '', border: 'thin' }),
      ],
    }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', underline: true, spacing: 'medium' }),
    block({ id: 'matrix-table', type: 'matrix-table', order: 4 }),
    // Keeps the combined totals-summary block — see itemizedLetterBlocks' comment
    // on why the numbered roman-numeral format isn't split across granular blocks.
    block({ id: 'totals-summary', type: 'totals-summary', order: 5, totalsDisplay: 'numbered-list', showAmountInWords: true }),
    block({ id: 'notes-text', type: 'notes-text', order: 6 }),
    block({ id: 'signature-block', type: 'signature-block', order: 7, signatures }),
  ];
}

/**
 * Day-by-day schedule with dates as ROWS instead of columns — logo + centered
 * company header, a boxed "invoice / <number>" reference, the recipient's
 * name addressed directly with no label, a centered underlined title, a static
 * editable "Period of Performance" line, the schedule table (one row per day,
 * grouped under each line item), and a compact 3-line tax summary — matches
 * how several Ghanaian hotels (e.g. Noda Hotel) format a workshop/conference
 * proforma when the logo itself already carries the hotel's name.
 */
function nodaScheduleBlocks(signatures: Array<{ label: string; role?: string }>): BlockConfig[] {
  return [
    block({
      id: 'company-header-row', type: 'container', order: 0, direction: 'row', gap: 'small',
      children: [
        block({ id: 'logo', type: 'logo', order: 0, flexWeight: 0, align: 'left' }),
        block({
          id: 'company-info-col', type: 'container', order: 1, direction: 'column', gap: 'none', flexWeight: 1,
          children: [
            block({ id: 'company-address', type: 'company-address', order: 0, align: 'center' }),
            block({ id: 'company-contact', type: 'company-contact', order: 1, align: 'center' }),
          ],
        }),
      ],
    }),
    // Date left, boxed "invoice / <number>" reference right — one row.
    block({
      id: 'date-ref-row', type: 'container', order: 1, direction: 'row', gap: 'medium', spacing: 'medium',
      children: [
        block({ id: 'doc-date', type: 'doc-date', order: 0, flexWeight: 1 }),
        block({ id: 'doc-number', type: 'doc-number', order: 1, flexWeight: 1, align: 'right', docNumberLabel: 'invoice', border: 'thin' }),
      ],
    }),
    // No "ATTN"/"Billing Person" label — the recipient is addressed directly
    // by name (heading: '' suppresses the default label — see blocks.ts).
    block({ id: 'guest-details', type: 'guest-details', order: 2, heading: '', border: 'none', style: { bold: true } }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', underline: true, spacing: 'medium' }),
    block({
      id: 'period-line', type: 'custom-text', order: 4, underline: true, style: { bold: true },
      text: 'Period of Performance:',
    }),
    block({ id: 'schedule-table', type: 'schedule-table', order: 5, spacing: 'small' }),
    // Compact 3-line tax summary (Taxes Exclusive / Sales Taxes Incl. / Total
    // Inclusive) instead of the numbered per-tax breakdown — see blocks.ts.
    block({ id: 'totals-summary', type: 'totals-summary', order: 6, totalsDisplay: 'compact-taxes' }),
    block({ id: 'notes-text', type: 'notes-text', order: 7 }),
    block({ id: 'signature-block', type: 'signature-block', order: 8, signatureDisplay: 'box', signatures }),
  ];
}

/**
 * A guest's individual checkout bill: "Billing Person" (when a company is
 * settling for them) / guest name up top, a labeled document number, dual
 * Guest/Receptionist sign-off, and a settle-before-vacating reminder — matches
 * how several Ghanaian hotels (e.g. Noda Hotel) format a check-out bill.
 */
function checkoutBillBlocks(): BlockConfig[] {
  return [
    letterheadHeaderRow(0),
    block({ id: 'doc-title', type: 'doc-title', order: 1, align: 'center', spacing: 'medium' }),
    // Billing party on the left (2x wider), CheckOut No. on the right — a
    // Layout Container so they sit on one row without forcing an even split.
    block({
      id: 'header-row', type: 'container', order: 2, direction: 'row', gap: 'large',
      children: [
        block({ id: 'guest-details', type: 'guest-details', order: 0, flexWeight: 2, border: 'none' }),
        block({ id: 'doc-number', type: 'doc-number', order: 1, flexWeight: 1, align: 'right', docNumberLabel: 'CheckOut No.', style: { bold: true } }),
      ],
    }),
    block({ id: 'doc-date', type: 'doc-date', order: 3, align: 'right' }),
    block({ id: 'stay-details', type: 'stay-details', order: 4, border: 'thin', spacing: 'small', stayDetailsDisplay: 'grid' }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 5, lineItemsDisplay: 'simple', spacing: 'medium' }),
    // Taxes get their own box, right-aligned under the table — subtotal/net
    // total/payments/balance stay plain lines around it (matches a plain
    // hand-typed bill: only the statutory tax breakdown is boxed).
    block({
      id: 'totals-column', type: 'container', order: 6, direction: 'column', gap: 'small',
      children: [
        block({ id: 'totals-subtotal', type: 'totals-subtotal', order: 0, align: 'right' }),
        block({ id: 'totals-taxes', type: 'totals-taxes', order: 1, align: 'right', border: 'thin' }),
        block({ id: 'totals-grandtotal', type: 'totals-grandtotal', order: 2, align: 'right', heading: 'Net Total', showAmountInWords: true }),
        block({ id: 'totals-payments', type: 'totals-payments', order: 3, align: 'right' }),
        block({ id: 'totals-balance', type: 'totals-balance', order: 4, align: 'right', border: 'thin' }),
      ],
    }),
    block({ id: 'signature-block', type: 'signature-block', order: 7, spacing: 'medium', signatureDisplay: 'line', signatures: [{ label: 'Guest Sign' }, { label: 'Receptionist Sign' }] }),
    block({ id: 'phone-line', type: 'custom-text', order: 8, spacing: 'none', text: 'Phone No: _______________________' }),
    block({ id: 'notes-text', type: 'notes-text', order: 9 }),
    // custom-text (unlike notes-text) always renders, regardless of what footer
    // notes the print call supplies — right for a fixed policy reminder like this.
    block({
      id: 'settle-notice', type: 'custom-text', order: 10, align: 'center', spacing: 'small', style: { fontSize: 'sm', bold: true },
      text: 'Accounts must be settled before vacating room.\nPlease leave key with the receptionist before vacating.\n<<<<<<< Service Next to None >>>>>>>',
    }),
  ];
}

/**
 * Printed at check-in, before anything's been charged — same letterhead and
 * guest/stay-details layout as the Checkout Bill, minus the line items and
 * totals (nothing to bill yet), plus an acknowledgement line and a
 * guest/front-desk sign-off confirming the booking details are correct.
 */
function registrationCardBlocks(): BlockConfig[] {
  return [
    letterheadHeaderRow(0),
    block({ id: 'doc-title', type: 'doc-title', order: 1, align: 'center', spacing: 'medium' }),
    block({
      id: 'header-row', type: 'container', order: 2, direction: 'row', gap: 'large',
      children: [
        block({ id: 'guest-details', type: 'guest-details', order: 0, flexWeight: 2, border: 'none' }),
        block({ id: 'doc-number', type: 'doc-number', order: 1, flexWeight: 1, align: 'right', docNumberLabel: 'Reservation No.', style: { bold: true } }),
      ],
    }),
    block({ id: 'doc-date', type: 'doc-date', order: 3, align: 'right' }),
    block({ id: 'stay-details', type: 'stay-details', order: 4, border: 'thin', spacing: 'small', stayDetailsDisplay: 'grid' }),
    block({
      id: 'acknowledgement', type: 'custom-text', order: 5, spacing: 'medium',
      text: 'I confirm the above booking details are correct and agree to settle all charges upon checkout.',
    }),
    block({ id: 'signature-block', type: 'signature-block', order: 6, spacing: 'medium', signatureDisplay: 'line', signatures: [{ label: 'Guest Signature' }, { label: 'Front Desk Signature' }] }),
    block({ id: 'notes-text', type: 'notes-text', order: 7 }),
  ];
}

/**
 * Classic two-column payslip — letterhead, employee info box, Earnings and
 * Deductions tables side by side (via columnSpan:'half'), Net Pay summary
 * (with amount in words), Employer/Employee signatures, and a "system
 * generated" footer note. Matches the common Ghanaian payslip layout.
 */
function payslipGridBlocks(): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0, align: 'center', style: { fontSize: 'lg', bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 1, align: 'center' }),
    block({ id: 'doc-title', type: 'doc-title', order: 2, align: 'center', spacing: 'small' }),
    block({ id: 'employee-details', type: 'employee-details', order: 3, spacing: 'medium' }),
    block({ id: 'payslip-earnings-table', type: 'payslip-earnings-table', order: 4, columnSpan: 'half', spacing: 'medium' }),
    block({ id: 'payslip-deductions-table', type: 'payslip-deductions-table', order: 5, columnSpan: 'half', spacing: 'medium' }),
    block({ id: 'payslip-summary', type: 'payslip-summary', order: 6, showAmountInWords: true, spacing: 'medium' }),
    block({ id: 'signature-block', type: 'signature-block', order: 7, spacing: 'large', signatures: [{ label: 'Employer Signature' }, { label: 'Employee Signature' }] }),
    block({ id: 'notes-text', type: 'notes-text', order: 8, align: 'center', style: { fontSize: 'sm' }, text: 'This is a system generated payslip.' }),
  ];
}

/**
 * Single-column, borderless payslip — Earnings and Deductions stack full-width
 * one after the other as plain dotted-leader lines instead of a bordered grid.
 * Matches the alternate minimal "List" layout some hotels prefer.
 */
function payslipListBlocks(): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0, align: 'center', style: { fontSize: 'lg', bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 1, align: 'center' }),
    block({ id: 'doc-title', type: 'doc-title', order: 2, align: 'center', spacing: 'small' }),
    block({ id: 'employee-details', type: 'employee-details', order: 3, spacing: 'medium', border: 'none' }),
    block({ id: 'payslip-earnings-table', type: 'payslip-earnings-table', order: 4, spacing: 'medium', payslipItemsDisplay: 'list' }),
    block({ id: 'payslip-deductions-table', type: 'payslip-deductions-table', order: 5, spacing: 'medium', payslipItemsDisplay: 'list' }),
    block({ id: 'payslip-summary', type: 'payslip-summary', order: 6, showAmountInWords: true, spacing: 'medium' }),
    block({ id: 'signature-block', type: 'signature-block', order: 7, spacing: 'large', signatureDisplay: 'line', signatures: [{ label: 'Employer Signature' }, { label: 'Employee Signature' }] }),
    block({ id: 'notes-text', type: 'notes-text', order: 8, align: 'center', style: { fontSize: 'sm' }, text: 'This is a system generated payslip.' }),
  ];
}

/**
 * Logo + watermark + bank transfer details, otherwise the same side-by-side
 * Earnings/Deductions layout as Grid — mirrors this app's Standard/Premium
 * convention already used for invoices, receipts, and vouchers.
 */
function payslipPremiumBlocks(): BlockConfig[] {
  return [
    block({ id: 'logo', type: 'logo', order: 0, align: 'center' }),
    block({ id: 'company-name', type: 'company-name', order: 1, align: 'center', style: { fontSize: 'lg', bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 2, align: 'center' }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', spacing: 'small' }),
    block({ id: 'employee-details', type: 'employee-details', order: 4, spacing: 'medium' }),
    block({ id: 'payslip-earnings-table', type: 'payslip-earnings-table', order: 5, columnSpan: 'half', spacing: 'medium' }),
    block({ id: 'payslip-deductions-table', type: 'payslip-deductions-table', order: 6, columnSpan: 'half', spacing: 'medium' }),
    block({ id: 'payslip-summary', type: 'payslip-summary', order: 7, showAmountInWords: true, spacing: 'medium' }),
    block({ id: 'bank-details', type: 'bank-details', order: 8, heading: 'Payment Account', spacing: 'medium' }),
    block({ id: 'signature-block', type: 'signature-block', order: 9, spacing: 'large', signatures: [{ label: 'Employer Signature' }, { label: 'Employee Signature' }] }),
    block({ id: 'notes-text', type: 'notes-text', order: 10, align: 'center', style: { fontSize: 'sm' }, text: 'This is a system generated payslip.' }),
  ];
}

/**
 * Lean, ink-saving payslip for printing many at once — no boxes anywhere,
 * small type, plain-line signatures, employee info as compact stacked lines
 * instead of a bordered card.
 */
function payslipCompactBlocks(): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0, style: { bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 1, dividerBelow: true, spacing: 'none' }),
    block({ id: 'doc-title', type: 'doc-title', order: 2, spacing: 'small', style: { fontSize: 'sm' } }),
    block({ id: 'employee-details', type: 'employee-details', order: 3, spacing: 'small', border: 'none' }),
    block({ id: 'payslip-earnings-table', type: 'payslip-earnings-table', order: 4, columnSpan: 'half', spacing: 'small' }),
    block({ id: 'payslip-deductions-table', type: 'payslip-deductions-table', order: 5, columnSpan: 'half', spacing: 'small' }),
    block({ id: 'payslip-summary', type: 'payslip-summary', order: 6, spacing: 'small' }),
    block({ id: 'signature-block', type: 'signature-block', order: 7, spacing: 'medium', signatureDisplay: 'line', signatures: [{ label: 'Employer' }, { label: 'Employee' }] }),
  ];
}

/**
 * Classic corporate letterhead — logo on the left, company name/address/
 * contact stacked beside it (reusing the same header row invoices' Checkout
 * Bill / Registration Card use), a divider under it, then the usual Grid
 * earnings/deductions body. For hotels whose branding is built around a
 * fixed letterhead rather than a centered title block.
 */
function payslipLetterheadBlocks(): BlockConfig[] {
  return [
    letterheadHeaderRow(0),
    block({ id: 'doc-title', type: 'doc-title', order: 1, align: 'center', spacing: 'medium' }),
    block({ id: 'employee-details', type: 'employee-details', order: 2, spacing: 'medium' }),
    block({ id: 'payslip-earnings-table', type: 'payslip-earnings-table', order: 3, columnSpan: 'half', spacing: 'medium' }),
    block({ id: 'payslip-deductions-table', type: 'payslip-deductions-table', order: 4, columnSpan: 'half', spacing: 'medium' }),
    block({ id: 'payslip-summary', type: 'payslip-summary', order: 5, showAmountInWords: true, spacing: 'medium' }),
    block({ id: 'signature-block', type: 'signature-block', order: 6, spacing: 'large', signatures: [{ label: 'Employer Signature' }, { label: 'Employee Signature' }] }),
    block({ id: 'notes-text', type: 'notes-text', order: 7, align: 'center', style: { fontSize: 'sm' }, text: 'This is a system generated payslip.' }),
  ];
}

/**
 * Formal, document-style payslip — serif type, thicker borders, itemized
 * dotted-leader Earnings/Deductions (one after the other, not side by side)
 * under a boxed employee card — reads more like a signed formal letter than
 * a quick pay stub.
 */
function payslipFormalBlocks(): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0, align: 'center', style: { fontSize: 'lg', bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 1, align: 'center' }),
    block({ id: 'company-contact', type: 'company-contact', order: 2, align: 'center', dividerBelow: true, spacing: 'small' }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', underline: true, spacing: 'medium' }),
    block({ id: 'employee-details', type: 'employee-details', order: 4, spacing: 'medium', border: 'thick' }),
    block({ id: 'payslip-earnings-table', type: 'payslip-earnings-table', order: 5, spacing: 'medium', payslipItemsDisplay: 'list' }),
    block({ id: 'payslip-deductions-table', type: 'payslip-deductions-table', order: 6, spacing: 'medium', payslipItemsDisplay: 'list' }),
    block({ id: 'payslip-summary', type: 'payslip-summary', order: 7, showAmountInWords: true, spacing: 'medium' }),
    block({ id: 'signature-block', type: 'signature-block', order: 8, spacing: 'large', signatures: [{ label: 'Employer Signature' }, { label: 'Employee Signature' }] }),
    block({ id: 'notes-text', type: 'notes-text', order: 9, align: 'center', style: { fontSize: 'sm' }, text: 'This is a system generated payslip.' }),
  ];
}

/**
 * Premium's branding (logo, watermark, bank details) combined with List's
 * borderless dotted-leader tables instead of Grid's bordered ones — for a
 * hotel that wants the logo/watermark treatment without a boxed-table look.
 */
function payslipBrandedListBlocks(): BlockConfig[] {
  return [
    block({ id: 'logo', type: 'logo', order: 0, align: 'center' }),
    block({ id: 'company-name', type: 'company-name', order: 1, align: 'center', style: { fontSize: 'lg', bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 2, align: 'center' }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', spacing: 'small' }),
    block({ id: 'employee-details', type: 'employee-details', order: 4, spacing: 'medium', border: 'none' }),
    block({ id: 'payslip-earnings-table', type: 'payslip-earnings-table', order: 5, spacing: 'medium', payslipItemsDisplay: 'list' }),
    block({ id: 'payslip-deductions-table', type: 'payslip-deductions-table', order: 6, spacing: 'medium', payslipItemsDisplay: 'list' }),
    block({ id: 'payslip-summary', type: 'payslip-summary', order: 7, showAmountInWords: true, spacing: 'medium' }),
    block({ id: 'bank-details', type: 'bank-details', order: 8, heading: 'Payment Account', spacing: 'medium' }),
    block({ id: 'signature-block', type: 'signature-block', order: 9, spacing: 'large', signatureDisplay: 'line', signatures: [{ label: 'Employer Signature' }, { label: 'Employee Signature' }] }),
    block({ id: 'notes-text', type: 'notes-text', order: 10, align: 'center', style: { fontSize: 'sm' }, text: 'This is a system generated payslip.' }),
  ];
}

/**
 * Logo on the right instead of centered/left — a company-info column (flex 1)
 * paired with the logo (flex 0) at the end of the same row, mirroring
 * letterheadHeaderRow's logo-first arrangement. Otherwise the same Grid body.
 */
function payslipLogoRightBlocks(): BlockConfig[] {
  return [
    block({
      id: 'company-header-row', type: 'container', order: 0, direction: 'row', gap: 'small', dividerBelow: true, spacing: 'none',
      children: [
        block({
          id: 'company-info-col', type: 'container', order: 0, direction: 'column', gap: 'none', flexWeight: 1,
          children: [
            block({ id: 'company-name', type: 'company-name', order: 0, align: 'right', spacing: 'none', style: { fontSize: 'lg', bold: true } }),
            block({ id: 'company-address', type: 'company-address', order: 1, align: 'right', spacing: 'none' }),
            block({ id: 'company-contact', type: 'company-contact', order: 2, align: 'right', spacing: 'none' }),
          ],
        }),
        block({ id: 'logo', type: 'logo', order: 1, flexWeight: 0, align: 'right' }),
      ],
    }),
    block({ id: 'doc-title', type: 'doc-title', order: 1, align: 'center', spacing: 'medium' }),
    block({ id: 'employee-details', type: 'employee-details', order: 2, spacing: 'medium' }),
    block({ id: 'payslip-earnings-table', type: 'payslip-earnings-table', order: 3, columnSpan: 'half', spacing: 'medium' }),
    block({ id: 'payslip-deductions-table', type: 'payslip-deductions-table', order: 4, columnSpan: 'half', spacing: 'medium' }),
    block({ id: 'payslip-summary', type: 'payslip-summary', order: 5, showAmountInWords: true, spacing: 'medium' }),
    block({ id: 'signature-block', type: 'signature-block', order: 6, spacing: 'large', signatures: [{ label: 'Employer Signature' }, { label: 'Employee Signature' }] }),
    block({ id: 'notes-text', type: 'notes-text', order: 7, align: 'center', style: { fontSize: 'sm' }, text: 'This is a system generated payslip.' }),
  ];
}

/** Payee / line items / totals / approval-chain signatures / notes — the part
 *  every Payment Voucher layout shares, only ever differing in how the header
 *  above it is arranged. `order` is the starting order for this block run. */
function paymentVoucherApprovalTail(order: number, opts?: { signatureDisplay?: 'box' | 'line'; showAmountInWords?: boolean; extra?: BlockConfig[] }): BlockConfig[] {
  const extra = opts?.extra || [];
  return [
    block({ id: 'guest-details', type: 'guest-details', order, heading: 'Payee' }),
    ...extra,
    // Payment Vouchers render as a Debit/Credit table, which only the combined
    // totals-summary block knows how to detect and switch to — see its
    // `debitCreditLines` branch in blockRenderer.ts.
    block({ id: 'line-items-table', type: 'line-items-table', order: order + 1 + extra.length }),
    block({ id: 'totals-summary', type: 'totals-summary', order: order + 2 + extra.length, showAmountInWords: opts?.showAmountInWords }),
    block({
      id: 'signature-block', type: 'signature-block', order: order + 3 + extra.length, signatureDisplay: opts?.signatureDisplay,
      signatures: [
        { label: 'Prepared By' }, { label: 'Approved By' }, { label: 'Recorded By' }, { label: 'Received By', role: 'Payee' },
      ],
    }),
    block({ id: 'notes-text', type: 'notes-text', order: order + 4 + extra.length }),
  ];
}

function paymentVoucherStandardBlocks(): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0 }),
    block({ id: 'company-address', type: 'company-address', order: 1 }),
    block({ id: 'company-contact', type: 'company-contact', order: 2 }),
    block({ id: 'doc-title', type: 'doc-title', order: 3 }),
    block({ id: 'doc-number', type: 'doc-number', order: 4 }),
    block({ id: 'doc-date', type: 'doc-date', order: 5 }),
    ...paymentVoucherApprovalTail(6),
  ];
}

/**
 * Lean, ink-saving voucher — no boxes, small type, doc number/date sharing a
 * row, plain-line approval signatures instead of boxed ones.
 */
function paymentVoucherCompactBlocks(): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0, style: { bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 1, dividerBelow: true, spacing: 'none' }),
    block({ id: 'doc-title', type: 'doc-title', order: 2, spacing: 'small', style: { fontSize: 'sm' } }),
    block({ id: 'doc-number', type: 'doc-number', order: 3, columnSpan: 'half' }),
    block({ id: 'doc-date', type: 'doc-date', order: 4, columnSpan: 'half' }),
    ...paymentVoucherApprovalTail(5, { signatureDisplay: 'line' }),
  ];
}

/**
 * Classic corporate letterhead — logo left, company info stacked beside it
 * (same header row invoices' Checkout Bill / payslip's Letterhead reuse),
 * doc number/date sharing a row underneath.
 */
function paymentVoucherLetterheadBlocks(): BlockConfig[] {
  return [
    letterheadHeaderRow(0),
    block({ id: 'doc-title', type: 'doc-title', order: 1, align: 'center', spacing: 'medium' }),
    block({
      id: 'meta-row', type: 'container', order: 2, direction: 'row', gap: 'medium',
      children: [
        block({ id: 'doc-number', type: 'doc-number', order: 0, flexWeight: 1 }),
        block({ id: 'doc-date', type: 'doc-date', order: 1, flexWeight: 1, align: 'right' }),
      ],
    }),
    ...paymentVoucherApprovalTail(3),
  ];
}

/**
 * Formal, document-style voucher — centered header, underlined title, a
 * thick-bordered Payee card — reads like a signed formal authorization
 * letter rather than a quick internal form.
 */
function paymentVoucherFormalBlocks(): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0, align: 'center', style: { fontSize: 'lg', bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 1, align: 'center' }),
    block({ id: 'company-contact', type: 'company-contact', order: 2, align: 'center', dividerBelow: true, spacing: 'small' }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', underline: true, spacing: 'medium' }),
    block({ id: 'doc-number', type: 'doc-number', order: 4, align: 'center' }),
    block({ id: 'doc-date', type: 'doc-date', order: 5, align: 'center' }),
    block({ id: 'guest-details', type: 'guest-details', order: 6, heading: 'Payee', border: 'thick' }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 7 }),
    block({ id: 'totals-summary', type: 'totals-summary', order: 8, showAmountInWords: true }),
    block({
      id: 'signature-block', type: 'signature-block', order: 9,
      signatures: [
        { label: 'Prepared By' }, { label: 'Approved By' }, { label: 'Recorded By' }, { label: 'Received By', role: 'Payee' },
      ],
    }),
    block({ id: 'notes-text', type: 'notes-text', order: 10 }),
  ];
}

/**
 * Logo + watermark like Premium, plus a "Pay From" bank-details block naming
 * the account the payment is drawn from — for hotels that pay vendors by
 * bank/mobile-money transfer and want that reference on the voucher itself.
 */
function paymentVoucherBankTransferBlocks(): BlockConfig[] {
  return [
    block({ id: 'logo', type: 'logo', order: 0 }),
    block({ id: 'company-name', type: 'company-name', order: 1 }),
    block({ id: 'company-address', type: 'company-address', order: 2 }),
    block({ id: 'doc-title', type: 'doc-title', order: 3 }),
    block({ id: 'doc-number', type: 'doc-number', order: 4 }),
    block({ id: 'doc-date', type: 'doc-date', order: 5 }),
    ...paymentVoucherApprovalTail(6, {
      showAmountInWords: true,
      extra: [block({ id: 'bank-details', type: 'bank-details', order: 7, heading: 'Pay From (Bank Account)' })],
    }),
  ];
}

/**
 * A dark colored banner behind the logo/company name (using the new
 * block-level `background` — see blocks.ts) instead of a plain header row,
 * doc-title/number/date underneath on the normal page background so its own
 * brand-colored text never fights the banner's contrast. A modern, SaaS-
 * invoice-style look distinct from every bordered/letterhead variant above.
 */
function modernBannerBlocks(recipientHeading: string): BlockConfig[] {
  return [
    block({
      id: 'banner', type: 'container', order: 0, direction: 'row', gap: 'medium', spacing: 'none',
      background: '#0F172A', backgroundTextColor: '#ffffff',
      children: [
        block({ id: 'logo', type: 'logo', order: 0, flexWeight: 0 }),
        block({ id: 'company-name', type: 'company-name', order: 1, flexWeight: 1, style: { fontSize: 'lg', bold: true } }),
      ],
    }),
    block({ id: 'company-address', type: 'company-address', order: 1, spacing: 'small' }),
    block({ id: 'company-contact', type: 'company-contact', order: 2 }),
    block({
      id: 'title-row', type: 'container', order: 3, direction: 'row', gap: 'medium', spacing: 'medium',
      children: [
        block({ id: 'doc-title', type: 'doc-title', order: 0, flexWeight: 1 }),
        block({
          id: 'meta-col', type: 'container', order: 1, direction: 'column', gap: 'none', flexWeight: 1,
          children: [
            block({ id: 'doc-number', type: 'doc-number', order: 0, align: 'right' }),
            block({ id: 'doc-date', type: 'doc-date', order: 1, align: 'right' }),
          ],
        }),
      ],
    }),
    block({ id: 'guest-details', type: 'guest-details', order: 4, heading: recipientHeading }),
    block({ id: 'stay-details', type: 'stay-details', order: 5 }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 6, columns: ['qty', 'unit', 'unitPrice', 'date'] }),
    block({ id: 'totals-summary', type: 'totals-summary', order: 7, showAmountInWords: true }),
    block({ id: 'notes-text', type: 'notes-text', order: 8 }),
  ];
}

/**
 * Consolidated account-statement look — centered letterhead, itemized dotted-
 * leader list instead of a bordered grid, compact 3-line tax summary. For
 * billing a corporate client one running account rather than a single stay.
 */
function statementBlocks(recipientHeading: string): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0, align: 'center', style: { fontSize: 'lg', bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 1, align: 'center' }),
    block({ id: 'company-contact', type: 'company-contact', order: 2, align: 'center', dividerBelow: true, spacing: 'small' }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', spacing: 'medium' }),
    block({
      id: 'meta-row', type: 'container', order: 4, direction: 'row', gap: 'medium',
      children: [
        block({ id: 'doc-number', type: 'doc-number', order: 0, flexWeight: 1 }),
        block({ id: 'doc-date', type: 'doc-date', order: 1, flexWeight: 1, align: 'right' }),
      ],
    }),
    block({ id: 'guest-details', type: 'guest-details', order: 5, heading: recipientHeading, border: 'none' }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 6, lineItemsDisplay: 'list' }),
    block({ id: 'totals-summary', type: 'totals-summary', order: 7, totalsDisplay: 'compact-taxes', showAmountInWords: true }),
    block({ id: 'notes-text', type: 'notes-text', order: 8 }),
  ];
}

/**
 * GRA-facing tax invoice — centered underlined "TAX INVOICE" title, a thick-
 * bordered Client card and thick-bordered tax breakdown so the statutory
 * numbers (TIN, VAT/NHIL/GETFund) read as the document's real focus.
 */
function taxInvoiceBlocks(recipientHeading: string): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0, align: 'center', style: { fontSize: 'lg', bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 1, align: 'center' }),
    block({ id: 'company-contact', type: 'company-contact', order: 2, align: 'center', dividerBelow: true, spacing: 'small' }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', underline: true, spacing: 'medium' }),
    block({
      id: 'meta-row', type: 'container', order: 4, direction: 'row', gap: 'medium',
      children: [
        block({ id: 'doc-number', type: 'doc-number', order: 0, flexWeight: 1, docNumberLabel: 'Invoice No.' }),
        block({ id: 'doc-date', type: 'doc-date', order: 1, flexWeight: 1, align: 'right' }),
      ],
    }),
    block({ id: 'guest-details', type: 'guest-details', order: 5, heading: recipientHeading, border: 'thick' }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 6, columns: ['qty', 'unit', 'unitPrice', 'date'] }),
    block({ id: 'totals-subtotal', type: 'totals-subtotal', order: 7 }),
    block({ id: 'totals-taxes', type: 'totals-taxes', order: 8, border: 'thick' }),
    block({ id: 'totals-grandtotal', type: 'totals-grandtotal', order: 9, showAmountInWords: true }),
    block({ id: 'totals-payments', type: 'totals-payments', order: 10 }),
    block({ id: 'totals-balance', type: 'totals-balance', order: 11 }),
    block({ id: 'notes-text', type: 'notes-text', order: 12 }),
  ];
}

/**
 * 80mm thermal/POS-printer format (see TemplateStyle.pageWidth) — narrow,
 * monospace, minimal, no logo — matches a front-desk receipt printer instead
 * of a full A4 page.
 */
function thermalReceiptBlocks(recipientHeading: string): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0, align: 'center', style: { bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 1, align: 'center', style: { fontSize: 'sm' } }),
    block({ id: 'company-contact', type: 'company-contact', order: 2, align: 'center', style: { fontSize: 'sm' }, dividerBelow: true }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', spacing: 'small' }),
    block({ id: 'doc-number', type: 'doc-number', order: 4, align: 'center' }),
    block({ id: 'doc-date', type: 'doc-date', order: 5, align: 'center', dividerBelow: true, spacing: 'small' }),
    block({ id: 'guest-details', type: 'guest-details', order: 6, heading: recipientHeading, border: 'none' }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 7, lineItemsDisplay: 'simple' }),
    block({ id: 'totals-summary', type: 'totals-summary', order: 8, totalsDisplay: 'compact-taxes' }),
    block({ id: 'notes-text', type: 'notes-text', order: 9, align: 'center' }),
  ];
}

/**
 * Warm sign-off receipt — green accent, a big faint "PAID" watermark instead
 * of the document-type text, and a personal thank-you line. For the guest's
 * last touchpoint at checkout rather than a plain accounting record.
 */
function thankYouReceiptBlocks(recipientHeading: string): BlockConfig[] {
  return [
    block({ id: 'logo', type: 'logo', order: 0, align: 'center' }),
    block({ id: 'company-name', type: 'company-name', order: 1, align: 'center', style: { fontSize: 'lg', bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 2, align: 'center' }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', spacing: 'medium' }),
    block({ id: 'doc-number', type: 'doc-number', order: 4, align: 'center' }),
    block({ id: 'doc-date', type: 'doc-date', order: 5, align: 'center' }),
    block({ id: 'guest-details', type: 'guest-details', order: 6, heading: recipientHeading }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 7 }),
    block({ id: 'totals-summary', type: 'totals-summary', order: 8, showAmountInWords: true }),
    block({
      id: 'thank-you-note', type: 'custom-text', order: 9, align: 'center', spacing: 'medium', style: { bold: true },
      text: 'Thank you for staying with us — we hope to welcome you again soon!',
    }),
    block({ id: 'notes-text', type: 'notes-text', order: 10, align: 'center' }),
  ];
}

/**
 * Formal receipt for a guest who needs it for their own company's expense
 * report — serif type, thick borders, TIN/contact prominent.
 */
function corporateReceiptBlocks(recipientHeading: string): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0, align: 'center', style: { fontSize: 'lg', bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 1, align: 'center' }),
    block({ id: 'company-contact', type: 'company-contact', order: 2, align: 'center', dividerBelow: true, spacing: 'small' }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', underline: true, spacing: 'medium' }),
    block({
      id: 'meta-row', type: 'container', order: 4, direction: 'row', gap: 'medium',
      children: [
        block({ id: 'doc-number', type: 'doc-number', order: 0, flexWeight: 1 }),
        block({ id: 'doc-date', type: 'doc-date', order: 1, flexWeight: 1, align: 'right' }),
      ],
    }),
    block({ id: 'guest-details', type: 'guest-details', order: 5, heading: recipientHeading, border: 'thick' }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 6 }),
    block({ id: 'totals-summary', type: 'totals-summary', order: 7, showAmountInWords: true }),
    block({ id: 'notes-text', type: 'notes-text', order: 8 }),
  ];
}

/**
 * Sales-oriented quotation — the same dark banner header as Modern Banner,
 * plus a highlighted "offer" callout box (background color on a plain text
 * block) stressing the quote's validity window, styled to read as a pitch
 * rather than an accounting document.
 */
function salesQuoteBlocks(recipientHeading: string, signatures: Array<{ label: string; role?: string }>): BlockConfig[] {
  return [
    block({
      id: 'banner', type: 'container', order: 0, direction: 'row', gap: 'medium', spacing: 'none',
      background: '#0F172A', backgroundTextColor: '#ffffff',
      children: [
        block({ id: 'logo', type: 'logo', order: 0, flexWeight: 0 }),
        block({ id: 'company-name', type: 'company-name', order: 1, flexWeight: 1, style: { fontSize: 'lg', bold: true } }),
      ],
    }),
    block({ id: 'company-address', type: 'company-address', order: 1, spacing: 'small' }),
    block({ id: 'doc-title', type: 'doc-title', order: 2, spacing: 'medium', style: { fontSize: 'lg' } }),
    block({ id: 'doc-number', type: 'doc-number', order: 3, columnSpan: 'half' }),
    block({ id: 'doc-date', type: 'doc-date', order: 4, columnSpan: 'half' }),
    block({ id: 'guest-details', type: 'guest-details', order: 5, heading: recipientHeading }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 6, columns: ['qty', 'unit', 'unitPrice', 'date'] }),
    block({
      id: 'validity-callout', type: 'custom-text', order: 7, align: 'center', spacing: 'medium', style: { bold: true },
      background: '#FFF3B0',
      text: 'This quotation is valid for 14 days from the date above. Contact us to confirm your booking.',
    }),
    block({ id: 'totals-summary', type: 'totals-summary', order: 8, showAmountInWords: true }),
    block({ id: 'signature-block', type: 'signature-block', order: 9, signatures }),
    block({ id: 'notes-text', type: 'notes-text', order: 10 }),
  ];
}

/**
 * Formal request-for-quote response — centered underlined title, thick-
 * bordered Client card, serif type (paired with the styleOverrides below).
 */
function corporateRfqBlocks(recipientHeading: string, signatures: Array<{ label: string; role?: string }>): BlockConfig[] {
  return [
    block({ id: 'company-name', type: 'company-name', order: 0, align: 'center', style: { fontSize: 'lg', bold: true } }),
    block({ id: 'company-address', type: 'company-address', order: 1, align: 'center' }),
    block({ id: 'company-contact', type: 'company-contact', order: 2, align: 'center', dividerBelow: true, spacing: 'small' }),
    block({ id: 'doc-title', type: 'doc-title', order: 3, align: 'center', underline: true, spacing: 'medium' }),
    block({
      id: 'meta-row', type: 'container', order: 4, direction: 'row', gap: 'medium',
      children: [
        block({ id: 'doc-number', type: 'doc-number', order: 0, flexWeight: 1, docNumberLabel: 'Quote No.' }),
        block({ id: 'doc-date', type: 'doc-date', order: 1, flexWeight: 1, align: 'right' }),
      ],
    }),
    block({ id: 'guest-details', type: 'guest-details', order: 5, heading: recipientHeading, border: 'thick' }),
    block({ id: 'line-items-table', type: 'line-items-table', order: 6, columns: ['qty', 'unit', 'unitPrice', 'date'] }),
    block({ id: 'totals-summary', type: 'totals-summary', order: 7, showAmountInWords: true }),
    block({ id: 'signature-block', type: 'signature-block', order: 8, signatures }),
    block({ id: 'notes-text', type: 'notes-text', order: 9 }),
  ];
}

function template(id: string, docType: PrintType, name: string, blocks: BlockConfig[], styleOverrides?: Partial<TemplateStyle>): BlockTemplate {
  return {
    id,
    docType,
    name,
    isBuiltIn: true,
    blocks,
    style: { ...DEFAULT_TEMPLATE_STYLE, ...styleOverrides },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

export const builtInTemplates: Record<PrintType, BlockTemplate[]> = {
  invoice: [
    template('builtin-invoice-standard', 'invoice', 'Standard', standardBlocks('Guest / Client')),
    template('builtin-invoice-premium', 'invoice', 'Premium', premiumBlocks('Guest / Client', [
      { label: 'Guest Signature' }, { label: 'Cashier Signature' },
    ]), { showWatermark: true, watermarkText: 'INVOICE' }),
    template('builtin-invoice-checkout-bill', 'invoice', 'Checkout Bill', checkoutBillBlocks()),
    template('builtin-invoice-modern-banner', 'invoice', 'Modern Banner', modernBannerBlocks('Guest / Client')),
    template('builtin-invoice-statement', 'invoice', 'Statement (corporate account)', statementBlocks('Guest / Client')),
    template('builtin-invoice-tax-invoice', 'invoice', 'Tax Invoice (GRA compliance)', taxInvoiceBlocks('Guest / Client'), { fontFamily: 'serif', borderWidth: 'thick' }),
  ],
  receipt: [
    template('builtin-receipt-standard', 'receipt', 'Standard', standardBlocks('Guest / Client')),
    template('builtin-receipt-premium', 'receipt', 'Premium', premiumBlocks('Guest / Client', [
      { label: 'Guest Signature' }, { label: 'Cashier Signature' },
    ]), { showWatermark: true, watermarkText: 'RECEIPT' }),
    template('builtin-receipt-checkout-bill', 'receipt', 'Checkout Bill', checkoutBillBlocks()),
    template('builtin-receipt-thermal', 'receipt', 'Thermal / POS Slip (80mm)', thermalReceiptBlocks('Guest / Client'), { fontFamily: 'mono', pageWidth: 'narrow', pageMargin: 'compact', bodyFontSize: 'sm' }),
    template('builtin-receipt-thank-you', 'receipt', 'Thank You', thankYouReceiptBlocks('Guest / Client'), { showWatermark: true, watermarkText: 'PAID', primaryColor: '#0A7D34' }),
    template('builtin-receipt-corporate', 'receipt', 'Corporate (for expense reports)', corporateReceiptBlocks('Guest / Client'), { fontFamily: 'serif', borderWidth: 'thick' }),
  ],
  proforma: [
    template('builtin-proforma-standard', 'proforma', 'Standard', standardBlocks('Client')),
    template('builtin-proforma-premium', 'proforma', 'Premium', premiumBlocks('Client', [
      { label: 'Prepared By' }, { label: 'Client Acceptance' },
    ]), { showWatermark: true, watermarkText: 'PROFORMA' }),
    template('builtin-proforma-itemized-letter', 'proforma', 'Itemized List (Letter Style)', itemizedLetterBlocks([
      { label: 'Prepared By' }, { label: 'Client Acceptance' },
    ])),
    template('builtin-proforma-sales-quote', 'proforma', 'Sales Quote', salesQuoteBlocks('Client', [
      { label: 'Prepared By' }, { label: 'Client Acceptance' },
    ])),
    template('builtin-proforma-corporate-rfq', 'proforma', 'Corporate RFQ Response', corporateRfqBlocks('Client', [
      { label: 'Prepared By' }, { label: 'Client Acceptance' },
    ]), { fontFamily: 'serif', borderWidth: 'thick' }),
  ],
  // Events & Conferences — Accommodation leg. Kept as its own document type
  // (rather than the generic invoice/receipt/proforma above) so editing this
  // template can never bleed into front-desk or Conference/Event documents.
  'accommodation-proforma': [
    template('builtin-accommodation-proforma-standard', 'accommodation-proforma', 'Standard', standardBlocks('Client')),
    template('builtin-accommodation-proforma-premium', 'accommodation-proforma', 'Premium', premiumBlocks('Client', [
      { label: 'Prepared By' }, { label: 'Client Acceptance' },
    ]), { showWatermark: true, watermarkText: 'PROFORMA' }),
  ],
  'accommodation-invoice': [
    template('builtin-accommodation-invoice-standard', 'accommodation-invoice', 'Standard', standardBlocks('Guest / Client')),
    template('builtin-accommodation-invoice-premium', 'accommodation-invoice', 'Premium', premiumBlocks('Guest / Client', [
      { label: 'Guest Signature' }, { label: 'Cashier Signature' },
    ]), { showWatermark: true, watermarkText: 'INVOICE' }),
  ],
  'accommodation-receipt': [
    template('builtin-accommodation-receipt-standard', 'accommodation-receipt', 'Standard', standardBlocks('Guest / Client')),
    template('builtin-accommodation-receipt-premium', 'accommodation-receipt', 'Premium', premiumBlocks('Guest / Client', [
      { label: 'Guest Signature' }, { label: 'Cashier Signature' },
    ]), { showWatermark: true, watermarkText: 'RECEIPT' }),
  ],
  // Events & Conferences — Conference/Catering leg.
  'event-proforma': [
    template('builtin-event-proforma-standard', 'event-proforma', 'Standard', standardBlocks('Client')),
    template('builtin-event-proforma-premium', 'event-proforma', 'Premium', premiumBlocks('Client', [
      { label: 'Prepared By' }, { label: 'Client Acceptance' },
    ]), { showWatermark: true, watermarkText: 'PROFORMA' }),
    template('builtin-event-proforma-daily-schedule', 'event-proforma', 'Daily Schedule (dates as columns)',
      dailyScheduleBlocks('ATTN', [{ label: 'General Manager' }])),
    template('builtin-event-proforma-daily-schedule-rows', 'event-proforma', 'Daily Schedule (dates as rows)',
      nodaScheduleBlocks([{ label: 'Accounts Officer' }])),
    template('builtin-event-proforma-itemized-letter', 'event-proforma', 'Itemized List (Letter Style)', itemizedLetterBlocks([
      { label: 'Prepared By' }, { label: 'Client Acceptance' },
    ])),
  ],
  'event-invoice': [
    template('builtin-event-invoice-standard', 'event-invoice', 'Standard', standardBlocks('Guest / Client')),
    template('builtin-event-invoice-premium', 'event-invoice', 'Premium', premiumBlocks('Guest / Client', [
      { label: 'Guest Signature' }, { label: 'Cashier Signature' },
    ]), { showWatermark: true, watermarkText: 'INVOICE' }),
    template('builtin-event-invoice-itemized-letter', 'event-invoice', 'Itemized List (Letter Style)', itemizedLetterBlocks([
      { label: 'Guest Signature' }, { label: 'Cashier Signature' },
    ])),
  ],
  'event-receipt': [
    template('builtin-event-receipt-standard', 'event-receipt', 'Standard', standardBlocks('Guest / Client')),
    template('builtin-event-receipt-premium', 'event-receipt', 'Premium', premiumBlocks('Guest / Client', [
      { label: 'Guest Signature' }, { label: 'Cashier Signature' },
    ]), { showWatermark: true, watermarkText: 'RECEIPT' }),
  ],
  'payment-voucher': [
    template('builtin-payment-voucher-standard', 'payment-voucher', 'Standard', paymentVoucherStandardBlocks()),
    template('builtin-payment-voucher-premium', 'payment-voucher', 'Premium', [
      block({ id: 'logo', type: 'logo', order: 0 }),
      block({ id: 'company-name', type: 'company-name', order: 1 }),
      block({ id: 'company-address', type: 'company-address', order: 2 }),
      block({ id: 'company-contact', type: 'company-contact', order: 3 }),
      block({ id: 'doc-title', type: 'doc-title', order: 4 }),
      block({ id: 'doc-number', type: 'doc-number', order: 5 }),
      block({ id: 'doc-date', type: 'doc-date', order: 6 }),
      block({ id: 'guest-details', type: 'guest-details', order: 7, heading: 'Payee' }),
      block({ id: 'line-items-table', type: 'line-items-table', order: 8 }),
      block({ id: 'totals-summary', type: 'totals-summary', order: 9 }),
      block({
        id: 'signature-block', type: 'signature-block', order: 10,
        signatures: [
          { label: 'Prepared By' }, { label: 'Approved By' }, { label: 'Recorded By' }, { label: 'Received By', role: 'Payee' },
        ],
      }),
      block({ id: 'notes-text', type: 'notes-text', order: 11 }),
    ], { showWatermark: true, watermarkText: 'PAYMENT VOUCHER' }),
    template('builtin-payment-voucher-compact', 'payment-voucher', 'Compact (lean, ink-saving)', paymentVoucherCompactBlocks(), { bodyFontSize: 'sm', pageMargin: 'compact' }),
    template('builtin-payment-voucher-letterhead', 'payment-voucher', 'Letterhead (logo-left header)', paymentVoucherLetterheadBlocks()),
    template('builtin-payment-voucher-formal', 'payment-voucher', 'Formal (serif, itemized)', paymentVoucherFormalBlocks(), { fontFamily: 'serif', borderWidth: 'thick' }),
    template('builtin-payment-voucher-bank-transfer', 'payment-voucher', 'Bank Transfer (pay-from account)', paymentVoucherBankTransferBlocks(), { showWatermark: true, watermarkText: 'PAYMENT VOUCHER' }),
    template('builtin-payment-voucher-ghana-colors', 'payment-voucher', 'Ghana Colors', paymentVoucherStandardBlocks(), { primaryColor: '#006B3F', borderColor: '#CE1126' }),
    template('builtin-payment-voucher-register', 'payment-voucher', 'Register (monospace)', paymentVoucherStandardBlocks(), { fontFamily: 'mono', borderWidth: 'thick' }),
  ],
  'registration-card': [
    template('builtin-registration-card-standard', 'registration-card', 'Standard', registrationCardBlocks()),
  ],
  payslip: [
    template('builtin-payslip-grid', 'payslip', 'Grid (Earnings / Deductions side by side)', payslipGridBlocks()),
    template('builtin-payslip-list', 'payslip', 'List (borderless, stacked)', payslipListBlocks()),
    template('builtin-payslip-premium', 'payslip', 'Premium (logo, watermark, bank details)', payslipPremiumBlocks(), { showWatermark: true, watermarkText: 'PAYSLIP' }),
    template('builtin-payslip-compact', 'payslip', 'Compact (lean, ink-saving)', payslipCompactBlocks(), { bodyFontSize: 'sm', pageMargin: 'compact' }),
    template('builtin-payslip-letterhead', 'payslip', 'Letterhead (logo-left header)', payslipLetterheadBlocks()),
    template('builtin-payslip-formal', 'payslip', 'Formal (serif, itemized)', payslipFormalBlocks(), { fontFamily: 'serif', borderWidth: 'thick' }),
    template('builtin-payslip-branded-list', 'payslip', 'Branded List (logo, watermark, borderless)', payslipBrandedListBlocks(), { showWatermark: true, watermarkText: 'PAYSLIP' }),
    template('builtin-payslip-logo-right', 'payslip', 'Logo Right', payslipLogoRightBlocks()),
    template('builtin-payslip-ghana-colors', 'payslip', 'Ghana Colors', payslipGridBlocks(), { primaryColor: '#006B3F', borderColor: '#CE1126' }),
    template('builtin-payslip-register', 'payslip', 'Register (monospace)', payslipGridBlocks(), { fontFamily: 'mono', borderWidth: 'thick' }),
  ],
};

export function getBuiltInTemplate(id: string): BlockTemplate | undefined {
  for (const list of Object.values(builtInTemplates)) {
    const found = list.find(t => t.id === id);
    if (found) return found;
  }
  return undefined;
}

export function listBuiltInTemplates(docType: PrintType): BlockTemplate[] {
  return builtInTemplates[docType] || [];
}
