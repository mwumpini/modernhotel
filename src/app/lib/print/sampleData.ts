import type { PrintData, PrintOrgInfo, PrintType } from './templates';

/** Shown on template samples when the hotel has not uploaded its own logo. */
export const SAMPLE_LOGO_URL = '/brand/agm-sync-icon.svg';

const placeholderOrg: PrintOrgInfo = {
  name: 'Golden Palm Hotel',
  address: '12 Independence Ave, Accra, Ghana',
  phone: '+233 20 123 4567',
  email: 'frontdesk@goldenpalmhotel.com',
  taxId: 'C0012345678',
  logoUrl: SAMPLE_LOGO_URL,
};

const sampleBankDetails = {
  bankName: 'GCB Bank PLC',
  accountName: 'Golden Palm Hotel',
  accountNumber: '1011223344556',
  branch: 'Accra Main',
  mobileMoneyNumber: '020 123 4567',
};

const BANK_SAMPLE_TYPES = new Set<PrintType>([
  'invoice',
  'proforma',
  'receipt',
  'accommodation-proforma',
  'accommodation-invoice',
  'accommodation-receipt',
  'event-proforma',
  'event-invoice',
  'event-receipt',
  'payment-voucher',
  'payslip',
]);

/**
 * Realistic sample data per document type — used by the builder's live preview.
 * `org` defaults to a placeholder hotel so the preview works before setup, but the
 * builder passes the tenant's real profile (via buildOrgProfile) so what you see —
 * including the uploaded logo — matches what actually prints.
 */
export function getSampleData(docType: PrintType, org: PrintOrgInfo = placeholderOrg): PrintData {
  const branded: PrintOrgInfo = { ...org, logoUrl: org.logoUrl || SAMPLE_LOGO_URL };
  const data = sampleDocument(docType, branded);
  if (BANK_SAMPLE_TYPES.has(docType) && !data.bankDetails) {
    return { ...data, bankDetails: { ...sampleBankDetails, accountName: org.name || sampleBankDetails.accountName } };
  }
  return data;
}

function sampleDocument(docType: PrintType, org: PrintOrgInfo): PrintData {
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
        totals: { subTotal: 5900, taxes: { nhil: 295, vat: 885, levy: 59 }, grandTotal: 7139 },
        footerNotes: ['This is a proforma invoice — not a demand for payment. Valid for 14 days.'],
        currency: '₵',
      };
    case 'receipt':
      return {
        org: sampleOrg,
        guest: {
          name: 'Kwame Mensah',
          company: 'Sample Company Ltd',
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
        totals: { subTotal: 5250, taxes: { nhil: 262.5, vat: 787.5, levy: 52.5 }, grandTotal: 6352.5 },
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
        totals: { subTotal: 5250, taxes: { nhil: 262.5, vat: 787.5, levy: 52.5 }, payments: 3000, balance: 3352.5, grandTotal: 6352.5 },
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
        guest: { name: 'Kwame Asante', company: 'Sample Company Ltd', address: 'P.O. Box 123\nAccra' },
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
        totals: { subTotal: 5900, taxes: { nhil: 295, vat: 885, levy: 59 }, grandTotal: 7139 },
        footerNotes: ['This is a proforma invoice — not a demand for payment. Valid for 14 days.'],
        currency: '₵',
      };
    case 'event-invoice':
      return {
        org: sampleOrg,
        guest: { name: 'Kwame Asante', company: 'Sample Company Ltd', address: 'P.O. Box 123\nAccra' },
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
        totals: { subTotal: 5900, taxes: { nhil: 295, vat: 885, levy: 59 }, payments: 4000, balance: 3139, grandTotal: 7139 },
        footerNotes: ['Generated via Events & Conferences workflow.'],
        currency: '₵',
      };
    case 'event-contract':
      return {
        org: sampleOrg,
        guest: { name: 'Ama Adjei', company: 'Adjei Family', address: '020 000 0000\nevents@sample.hotel' },
        docDate: new Date().toISOString(),
        title: 'Event Services Contract',
        items: [
          { description: 'Accommodation', unit: 'per night', unitPrice: 200, amount: 200 },
          { description: 'Conference', unit: 'per person', unitPrice: 300, amount: 300 },
          { description: 'Catering', unit: 'per person', unitPrice: 50, amount: 50 },
        ],
        totals: { subTotal: 0, grandTotal: 0 },
        event: { summary: 'Adjei Family Naming Ceremony\n3 October 2026\nOforwaa Hall (200 seats)\n60 guests · Day event' },
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
    case 'fb-receipt':
      return {
        org: sampleOrg,
        guest: { name: 'Kofi Mensah', company: 'Sample Company Ltd', roomNumber: '204' },
        docNumber: 'RB-10021',
        docDate: new Date().toISOString(),
        title: 'Restaurant Bill',
        tableNumber: '04',
        items: [
          { description: 'Special Fried Rice', qty: 2, unitPrice: 60, amount: 120 },
          { description: 'Pineapple Juice', qty: 1, unitPrice: 25, amount: 25 },
        ],
        totals: {
          subTotal: 145,
          taxes: { nhil: 3.63, gefl: 3.63, levy: 1.45, vat: 21.75 },
          grandTotal: 175.46,
          payments: 175.46,
          balance: 0,
        },
        footerNotes: ['Table 04 · Attendant Abena'],
        currency: '₵',
        attendantName: 'Abena',
        tender: {
          method: 'Card',
          brand: 'Visa Debit',
          amount: 175.46,
          aid: 'A0000000031010',
          authCode: '036782',
          terminalId: '282901',
          verification: 'No Cardholder Verification',
        },
      };
    case 'registration-card':
      return {
        org: sampleOrg,
        guest: {
          name: 'Kwame Mensah',
          company: 'Sample Company Ltd',
          address: 'P.O. Box 123\nAccra',
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
    case 'payslip':
      return {
        org: sampleOrg,
        guest: { name: 'Sally Harley' },
        employee: {
          name: 'Sally Harley',
          employeeNumber: 'EMP-0042',
          position: 'Marketing Executive',
          department: 'Marketing',
          payPeriod: 'August 2026',
          dateOfJoining: '2018-06-23',
          workedDays: 26,
        },
        docDate: new Date().toISOString(),
        title: 'Payslip',
        items: [],
        totals: { subTotal: 0 },
        earningsItems: [
          { description: 'Basic Salary', amount: 10000 },
          { description: 'Incentive Pay', amount: 1000 },
          { description: 'House Rent Allowance', amount: 400 },
          { description: 'Meal Allowance', amount: 200 },
        ],
        deductionsItems: [
          { description: 'SSNIT (Tier 1)', amount: 605 },
          { description: 'PAYE (Income Tax)', amount: 1495 },
          { description: 'Provident Fund (Tier 3)', amount: 400 },
        ],
        currency: '₵',
      };
    case 'invoice':
    default:
      return {
        org: sampleOrg,
        guest: {
          name: 'Kwame Mensah',
          company: 'Sample Company Ltd',
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
        totals: { subTotal: 620, taxes: { nhil: 31, vat: 93, levy: 6.2 }, payments: 0, balance: 750.2, grandTotal: 750.2 },
        footerNotes: ['Thank you for staying with us.'],
        currency: '₵',
      };
  }
}
