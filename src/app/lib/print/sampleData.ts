import type { PrintData, PrintOrgInfo, PrintType } from './templates';

const placeholderOrg: PrintOrgInfo = {
  name: 'Golden Palm Hotel',
  address: '12 Independence Ave, Accra, Ghana',
  phone: '+233 20 123 4567',
  email: 'frontdesk@goldenpalmhotel.com',
  taxId: 'C0012345678',
};

/**
 * Realistic sample data per document type — used by the builder's live preview.
 * `org` defaults to a placeholder hotel so the preview works before setup, but the
 * builder passes the tenant's real profile (via buildOrgProfile) so what you see —
 * including the uploaded logo — matches what actually prints.
 */
export function getSampleData(docType: PrintType, org: PrintOrgInfo = placeholderOrg): PrintData {
  const sampleOrg = org;
  switch (docType) {
    case 'payment-voucher':
      return {
        org: sampleOrg,
        guest: { name: 'Accra Fresh Produce Ltd' },
        docNumber: 'PV-2026-0014',
        docDate: new Date().toISOString(),
        title: 'Payment Voucher',
        items: [],
        totals: { subTotal: 0 },
        debitCreditLines: [
          { accountName: 'Kitchen Supplies', details: 'Weekly produce order', debit: 1250, credit: 0 },
          { accountName: 'Cash / Bank', debit: 0, credit: 1250 },
        ],
        signatures: [
          { label: 'Prepared By', name: 'Ama Owusu', signedDate: new Date().toISOString() },
          { label: 'Approved By', name: 'Kofi Adjei', signedDate: new Date().toISOString() },
          { label: 'Recorded By' },
          { label: 'Received By', role: 'Payee' },
        ],
        currency: '₵',
      };
    case 'proforma':
      return {
        org: sampleOrg,
        guest: { name: 'Nana Yaa Events', company: 'Corporate Client' },
        docNumber: 'PRO-2026-0032',
        docDate: new Date().toISOString(),
        title: 'Proforma Invoice',
        items: [
          { description: 'Conference Hall (Full Day)', qty: 1, unit: 'day', unitPrice: 2500, amount: 2500 },
          { description: 'Lunch Package', qty: 40, unit: 'pax', unitPrice: 85, amount: 3400 },
        ],
        totals: { subTotal: 5900, taxes: { vat: 1180, nhil: 147.5, levy: 59 }, grandTotal: 7286.5 },
        footerNotes: ['This is a proforma invoice — not a demand for payment. Valid for 14 days.'],
        currency: '₵',
      };
    case 'receipt':
      return {
        org: sampleOrg,
        guest: {
          name: 'Kwame Mensah',
          company: 'World Vision Ghana',
          roomNumber: '101',
          roomType: 'Deluxe',
          roomRate: 500,
          arrivalDate: new Date().toISOString(),
          departureDate: new Date(Date.now() + 86400000).toISOString(),
          nights: 1,
        },
        docNumber: 'RCP-2026-0201',
        docDate: new Date().toISOString(),
        title: 'Receipt',
        items: [{ description: 'Payment (Mobile Money)', amount: 596.25, date: new Date().toISOString() }],
        totals: { subTotal: 596.25, payments: 596.25, balance: 0, grandTotal: 596.25 },
        currency: '₵',
      };
    case 'accommodation-proforma':
      return {
        org: sampleOrg,
        guest: { name: 'Nana Yaa Events', company: 'Corporate Client', arrivalDate: new Date().toISOString(), departureDate: new Date(Date.now() + 2 * 86400000).toISOString(), nights: 2 },
        docNumber: 'PRO-2026-0032-ACC',
        docDate: new Date().toISOString(),
        title: 'Quotation — Accommodation',
        items: [
          { description: 'Standard Rooms', qty: 15, unit: 'rooms', unitPrice: 350, amount: 5250, date: new Date().toISOString() },
        ],
        totals: { subTotal: 5250, taxes: { vat: 1050, nhil: 131.25, levy: 52.5 }, grandTotal: 6483.75 },
        footerNotes: ['This is a proforma invoice — not a demand for payment. Valid for 14 days.'],
        currency: '₵',
      };
    case 'accommodation-invoice':
      return {
        org: sampleOrg,
        guest: { name: 'Nana Yaa Events', company: 'Corporate Client', arrivalDate: new Date().toISOString(), departureDate: new Date(Date.now() + 2 * 86400000).toISOString(), nights: 2 },
        docNumber: 'INV-2026-0108-ACC',
        docDate: new Date().toISOString(),
        title: 'Invoice — Accommodation',
        items: [
          { description: 'Standard Rooms', qty: 15, unit: 'rooms', unitPrice: 350, amount: 5250, date: new Date().toISOString() },
        ],
        totals: { subTotal: 5250, taxes: { vat: 1050, nhil: 131.25, levy: 52.5 }, payments: 3000, balance: 3483.75, grandTotal: 6483.75 },
        footerNotes: ['Generated via Events & Conferences workflow.'],
        currency: '₵',
      };
    case 'accommodation-receipt':
      return {
        org: sampleOrg,
        guest: { name: 'Nana Yaa Events', company: 'Corporate Client' },
        docNumber: 'RCP-2026-0201-ACC',
        docDate: new Date().toISOString(),
        title: 'Receipt — Accommodation',
        items: [{ description: 'Payment (Bank Transfer)', amount: 3000, date: new Date().toISOString() }],
        totals: { subTotal: 3000, payments: 3000, balance: 0, grandTotal: 3000 },
        currency: '₵',
      };
    case 'event-proforma':
      return {
        org: sampleOrg,
        guest: { name: 'Evans Aboagye', company: 'World Vision Ghana', address: 'Effiduase ADP\nAshanti Region' },
        docNumber: 'PRO-2026-0032-CE',
        docDate: new Date().toISOString(),
        title: 'Quotation — Conference & Events',
        items: [
          {
            description: '10pax @ ₵125.00 x 5 days',
            heading: 'Conference Package',
            bullets: ['2 Coffee breaks', 'Buffet Lunch', 'Conference hall, Projector', 'Folder, Pens & Mints', 'Bottles of mineral water'],
            qty: 40, unit: 'day', unitPrice: 2500, amount: 2500,
          },
          { description: 'Lunch Package', qty: 40, unit: 'pax', unitPrice: 85, amount: 3400 },
        ],
        // Also feeds the matrix-table block (e.g. the "Daily Schedule" built-in)
        // so it previews correctly in the Document Templates builder.
        matrixTable: {
          columns: [
            { key: '2026-03-09', label: 'Mon', sublabel: '9-Mar' },
            { key: '2026-03-10', label: 'Tue', sublabel: '10-Mar' },
            { key: '2026-03-11', label: 'Wed', sublabel: '11-Mar' },
          ],
          rows: [
            {
              label: 'Conference Package', rate: 250, cells: { '2026-03-09': 40, '2026-03-10': 40, '2026-03-11': 40 }, totalCount: 120, subtotal: 30000,
              bullets: ['Pen, Pad & Folder', '2 x 500ml Water', 'Flip Chart, Markers', 'Use of Projector', '1st & 2nd Coffee Break'],
            },
            { label: 'Lunch Pax', rate: 85, cells: { '2026-03-09': 40, '2026-03-10': 40, '2026-03-11': 40 }, totalCount: 120, subtotal: 10200 },
          ],
        },
        // Also feeds the schedule-table block (e.g. the "Daily Schedule (dates as
        // rows)" built-in) so it previews correctly in the Document Templates
        // builder — sums to the same 5,900 subtotal as `items`/`matrixTable` above
        // so all three previews (sharing this one `totals`) stay consistent.
        scheduleTable: {
          groups: [
            {
              description: 'Lodging (breakfast included)',
              entries: [
                { day: 'Day 1', date: '2026-03-09', qty: 2, unitPrice: 500, total: 1000 },
                { day: 'Day 2', date: '2026-03-10', qty: 2, unitPrice: 500, total: 1000 },
              ],
            },
            {
              description: 'Dinner Buffet with water and dessert',
              entries: [{ day: 'Arrival', date: '2026-03-09', qty: 2, unitPrice: 150, total: 300 }],
            },
            {
              description: 'Conference Package including: Pen, Pad & Folder, 2 x 500ml Water, Flip Chart, Markers, Mints, Use of Projector, Wifi, Buffet Lunch',
              entries: [
                { day: 'Day 1', date: '2026-03-09', qty: 10, unitPrice: 180, total: 1800 },
                { day: 'Day 2', date: '2026-03-10', qty: 10, unitPrice: 180, total: 1800 },
              ],
            },
          ],
        },
        totals: { subTotal: 5900, taxes: { vat: 1180, nhil: 147.5, levy: 59 }, grandTotal: 7286.5 },
        footerNotes: ['This is a proforma invoice — not a demand for payment. Valid for 14 days.'],
        currency: '₵',
      };
    case 'event-invoice':
      return {
        org: sampleOrg,
        guest: { name: 'Evans Aboagye', company: 'World Vision Ghana', address: 'Effiduase ADP\nAshanti Region' },
        docNumber: 'INV-2026-0108-CE',
        docDate: new Date().toISOString(),
        title: 'Invoice — Conference & Events',
        items: [
          {
            description: '10pax @ ₵125.00 x 5 days',
            heading: 'Conference Package',
            bullets: ['2 Coffee breaks', 'Buffet Lunch', 'Conference hall, Projector', 'Folder, Pens & Mints', 'Bottles of mineral water'],
            qty: 40, unit: 'day', unitPrice: 2500, amount: 2500,
          },
          { description: 'Lunch Package', qty: 40, unit: 'pax', unitPrice: 85, amount: 3400 },
        ],
        totals: { subTotal: 5900, taxes: { vat: 1180, nhil: 147.5, levy: 59 }, payments: 4000, balance: 3286.5, grandTotal: 7286.5 },
        footerNotes: ['Generated via Events & Conferences workflow.'],
        currency: '₵',
      };
    case 'event-receipt':
      return {
        org: sampleOrg,
        guest: { name: 'Nana Yaa Events', company: 'Corporate Client' },
        docNumber: 'RCP-2026-0201-CE',
        docDate: new Date().toISOString(),
        title: 'Receipt — Conference & Events',
        items: [{ description: 'Payment (Bank Transfer)', amount: 4000, date: new Date().toISOString() }],
        totals: { subTotal: 4000, payments: 4000, balance: 0, grandTotal: 4000 },
        currency: '₵',
      };
    case 'registration-card':
      return {
        org: sampleOrg,
        guest: {
          name: 'Kwame Mensah',
          company: 'World Vision Ghana',
          address: 'Effiduase ADP\nAshanti Region',
          roomNumber: '101',
          roomType: 'Deluxe',
          roomRate: 500,
          arrivalDate: new Date().toISOString(),
          departureDate: new Date(Date.now() + 86400000).toISOString(),
          nights: 1,
        },
        docNumber: 'RES-2026-0108',
        docDate: new Date().toISOString(),
        title: 'Registration Card',
        items: [],
        totals: { subTotal: 0 },
        footerNotes: ['Welcome — please let the front desk know if you need anything during your stay.'],
        currency: '₵',
      };
    case 'invoice':
    default:
      return {
        org: sampleOrg,
        guest: {
          name: 'Kwame Mensah',
          company: 'World Vision Ghana',
          roomNumber: '101',
          roomType: 'Deluxe',
          roomRate: 500,
          arrivalDate: new Date().toISOString(),
          departureDate: new Date(Date.now() + 86400000).toISOString(),
          nights: 1,
        },
        docNumber: 'INV-2026-0108',
        docDate: new Date().toISOString(),
        title: 'Invoice',
        items: [
          { description: 'Room Charge', qty: 1, unit: 'night', unitPrice: 500, amount: 500, date: new Date().toISOString() },
          { description: 'Restaurant', amount: 120, date: new Date().toISOString() },
        ],
        totals: { subTotal: 620, taxes: { vat: 97.65, nhil: 15.5, levy: 6.2 }, payments: 0, balance: 739.35, grandTotal: 739.35 },
        footerNotes: ['Thank you for staying with us.'],
        currency: '₵',
      };
  }
}
