'use client';

import type {
  JournalEntry,
  Invoice,
  Payment,
  WHTCertificate,
  BusinessPartner,
  BankAccount,
  BankTransaction,
  AuditTrail,
} from './models';

export type DemoTransactionSeed = {
  journalEntries: JournalEntry[];
  invoices: Invoice[];
  payments: Payment[];
  whtCertificates: WHTCertificate[];
  businessPartners: BusinessPartner[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  auditTrail: AuditTrail[];
};

/** Fictional flows for demos only — never loaded when NEXT_PUBLIC_DEMO_MODE is false. */
export function buildDemoTransactionSeed(): DemoTransactionSeed {
      const sampleJournalEntries: JournalEntry[] = [
        {
          id: '1',
          entryNumber: 'JE-2024-001',
          date: new Date().toISOString(),
          reference: 'INV-001',
          description: 'Sales invoice posting',
          totalDebit: 1500.00,
          totalCredit: 1500.00,
          currency: 'GHS',
          status: 'Posted',
          postedBy: 'admin',
          postedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lines: [
            {
              id: '1',
              journalEntryId: 'je-sample-1',
              accountCode: '1100',
              description: 'Guest receivable',
              debit: 1500.00,
              credit: 0.00,
              currency: 'GHS'
            },
            {
              id: '2',
              journalEntryId: 'je-sample-1',
              accountCode: '4000',
              description: 'Room revenue',
              debit: 0.00,
              credit: 1500.00,
              currency: 'GHS'
            }
          ]
        }
      ];

             // ============================================================
       // SAMPLE DATA - Complete Transaction Flows
       // ============================================================
       const now = new Date().toISOString();
       const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
       const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
       const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
       const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
       const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
       const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
       const dueIn30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
       const dueIn14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
       const dueIn7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
       const overdue5Days = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
       const overdue10Days = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
       
       const sampleInvoices: Invoice[] = [
         // ============================================================
         // CONFERENCE/EVENTS - Complete Flow Examples
         // ============================================================
         
         // FLOW 1: Event Proforma → Invoice → FULL PAYMENT ✓
         {
           id: 'PRO-EVT-001',
           invoiceNumber: 'PRO-EVT-2024-001',
           type: 'Sales',
           isProforma: true,
           date: twoWeeksAgo,
           dueDate: oneWeekAgo,
           businessPartnerId: 'CUST-001',
           reference: 'EVT-CORP-001',
           description: 'Corporate Training Workshop - Proforma',
           subtotal: 5000.00,
           taxAmount: 1050.00,
           total: 6050.00,
           currency: 'GHS',
           status: 'Converted',
           paidAmount: 0,
           createdAt: twoWeeksAgo,
           updatedAt: oneWeekAgo,
           sourceModule: 'conference',
           customerName: 'Accra Business School',
           customerEmail: 'events@abs.edu.gh',
           customerPhone: '+233 30 277 1234',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
           eventId: 'EVT-CORP-001',
           pax: 50,
           venue: 'Training Room A',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 125.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 125.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 800.00 },
           ],
           items: [
             { description: 'Training Room - Full Day', quantity: 1, unitPrice: 2000.00 },
             { description: 'Catering (50 pax)', quantity: 50, unitPrice: 60.00 },
           ],
           lines: []
         } as any,
         {
           id: 'INV-EVT-001',
           invoiceNumber: 'INV-EVT-2024-001',
           type: 'Sales',
           date: oneWeekAgo,
           dueDate: threeDaysAgo,
           businessPartnerId: 'CUST-001',
           reference: 'EVT-CORP-001',
           description: 'Corporate Training Workshop - PAID ✓',
           subtotal: 5000.00,
           taxAmount: 1050.00,
           total: 6050.00,
           currency: 'GHS',
           status: 'Paid',
           paidAmount: 6050.00,
           paidDate: fiveDaysAgo,
           createdAt: oneWeekAgo,
           updatedAt: fiveDaysAgo,
           sourceModule: 'conference',
           customerName: 'Accra Business School',
           customerEmail: 'events@abs.edu.gh',
           customerPhone: '+233 30 277 1234',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
           eventId: 'EVT-CORP-001',
           pax: 50,
           venue: 'Training Room A',
           proformaId: 'PRO-EVT-001',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 125.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 125.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 800.00 },
           ],
           items: [
             { description: 'Training Room - Full Day', quantity: 1, unitPrice: 2000.00 },
             { description: 'Catering (50 pax)', quantity: 50, unitPrice: 60.00 },
           ],
           lines: [
             { id: 'IL-EVT-001', invoiceId: 'INV-EVT-001', description: 'Training Package', quantity: 1, unitPrice: 5000.00, amount: 5000.00, taxAmount: 1050.00, glAccountCode: '4300' }
           ]
         } as any,
         
         // FLOW 2: Event Proforma → Invoice → PART PAYMENT (50%)
         {
           id: 'PRO-EVT-002',
           invoiceNumber: 'PRO-EVT-2024-002',
           type: 'Sales',
           isProforma: true,
           date: oneWeekAgo,
           dueDate: fiveDaysAgo,
           businessPartnerId: 'CUST-002',
           reference: 'EVT-WEDDING-002',
           description: 'Wedding Reception - Proforma',
           subtotal: 15000.00,
           taxAmount: 3150.00,
           total: 18150.00,
           currency: 'GHS',
           status: 'Converted',
           paidAmount: 0,
           createdAt: oneWeekAgo,
           updatedAt: fiveDaysAgo,
           sourceModule: 'conference',
           customerName: 'Mensah Family',
           customerEmail: 'kofi.mensah@email.com',
           customerPhone: '+233 24 555 1234',
           staffName: 'Abena Serwaa',
           staffId: 'EVT-002',
           staffRole: 'Events Manager',
           eventId: 'EVT-WEDDING-002',
           pax: 200,
           venue: 'Grand Ballroom',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 375.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 375.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 2400.00 },
           ],
           items: [
             { description: 'Grand Ballroom Venue', quantity: 1, unitPrice: 5000.00 },
             { description: 'Wedding Catering (200 pax)', quantity: 200, unitPrice: 50.00 },
           ],
           lines: []
         } as any,
         {
           id: 'INV-EVT-002',
           invoiceNumber: 'INV-EVT-2024-002',
           type: 'Sales',
           date: fiveDaysAgo,
           dueDate: dueIn7Days,
           businessPartnerId: 'CUST-002',
           reference: 'EVT-WEDDING-002',
           description: 'Wedding Reception - 50% DEPOSIT PAID',
           subtotal: 15000.00,
           taxAmount: 3150.00,
           total: 18150.00,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 9075.00,
           createdAt: fiveDaysAgo,
           updatedAt: threeDaysAgo,
           sourceModule: 'conference',
           customerName: 'Mensah Family',
           customerEmail: 'kofi.mensah@email.com',
           customerPhone: '+233 24 555 1234',
           staffName: 'Abena Serwaa',
           staffId: 'EVT-002',
           staffRole: 'Events Manager',
           eventId: 'EVT-WEDDING-002',
           pax: 200,
           venue: 'Grand Ballroom',
           proformaId: 'PRO-EVT-002',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 375.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 375.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 2400.00 },
           ],
           items: [
             { description: 'Grand Ballroom Venue', quantity: 1, unitPrice: 5000.00 },
             { description: 'Wedding Catering (200 pax)', quantity: 200, unitPrice: 50.00 },
           ],
           lines: [
             { id: 'IL-EVT-002', invoiceId: 'INV-EVT-002', description: 'Wedding Package', quantity: 1, unitPrice: 15000.00, amount: 15000.00, taxAmount: 3150.00, glAccountCode: '4300' }
           ]
         } as any,
         
         // FLOW 3: Event Proforma → Invoice → ZERO PAYMENT (Awaiting)
         {
           id: 'PRO-EVT-003',
           invoiceNumber: 'PRO-EVT-2024-003',
           type: 'Sales',
           isProforma: true,
           date: threeDaysAgo,
           dueDate: yesterday,
           businessPartnerId: 'CUST-003',
           reference: 'EVT-SEMINAR-003',
           description: 'Tech Seminar - Proforma',
           subtotal: 8000.00,
           taxAmount: 1680.00,
           total: 9680.00,
           currency: 'GHS',
           status: 'Converted',
           paidAmount: 0,
           createdAt: threeDaysAgo,
           updatedAt: yesterday,
           sourceModule: 'conference',
           customerName: 'Ghana Tech Hub',
           customerEmail: 'info@ghanatechhub.com',
           customerPhone: '+233 30 288 4567',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
           eventId: 'EVT-SEMINAR-003',
           pax: 80,
           venue: 'Conference Hall B',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 200.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 200.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 1280.00 },
           ],
           items: [
             { description: 'Conference Hall B', quantity: 1, unitPrice: 3000.00 },
             { description: 'AV Equipment', quantity: 1, unitPrice: 1000.00 },
             { description: 'Catering (80 pax)', quantity: 80, unitPrice: 50.00 },
           ],
           lines: []
         } as any,
         {
           id: 'INV-EVT-003',
           invoiceNumber: 'INV-EVT-2024-003',
           type: 'Sales',
           date: yesterday,
           dueDate: dueIn14Days,
           businessPartnerId: 'CUST-003',
           reference: 'EVT-SEMINAR-003',
           description: 'Tech Seminar - AWAITING PAYMENT',
           subtotal: 8000.00,
           taxAmount: 1680.00,
           total: 9680.00,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 0,
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'conference',
           customerName: 'Ghana Tech Hub',
           customerEmail: 'info@ghanatechhub.com',
           customerPhone: '+233 30 288 4567',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
           eventId: 'EVT-SEMINAR-003',
           pax: 80,
           venue: 'Conference Hall B',
           proformaId: 'PRO-EVT-003',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 200.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 200.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 1280.00 },
           ],
           items: [
             { description: 'Conference Hall B', quantity: 1, unitPrice: 3000.00 },
             { description: 'AV Equipment', quantity: 1, unitPrice: 1000.00 },
             { description: 'Catering (80 pax)', quantity: 80, unitPrice: 50.00 },
           ],
           lines: [
             { id: 'IL-EVT-003', invoiceId: 'INV-EVT-003', description: 'Seminar Package', quantity: 1, unitPrice: 8000.00, amount: 8000.00, taxAmount: 1680.00, glAccountCode: '4300' }
           ]
         } as any,
         
         // FLOW 4: Event Proforma → Invoice → OVERDUE ⚠️
         {
           id: 'PRO-EVT-004',
           invoiceNumber: 'PRO-EVT-2024-004',
           type: 'Sales',
           isProforma: true,
           date: twoWeeksAgo,
           dueDate: twoWeeksAgo,
           businessPartnerId: 'CUST-004',
           reference: 'EVT-PARTY-004',
           description: 'Birthday Party - Proforma',
           subtotal: 3500.00,
           taxAmount: 735.00,
           total: 4235.00,
           currency: 'GHS',
           status: 'Converted',
           paidAmount: 0,
           createdAt: twoWeeksAgo,
           updatedAt: oneWeekAgo,
           sourceModule: 'conference',
           customerName: 'Nana Ama Owusu',
           customerEmail: 'nana.owusu@gmail.com',
           customerPhone: '+233 24 999 8888',
           staffName: 'Abena Serwaa',
           staffId: 'EVT-002',
           staffRole: 'Events Manager',
           eventId: 'EVT-PARTY-004',
           pax: 40,
           venue: 'Garden Terrace',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 87.50 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 87.50 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 560.00 },
           ],
           items: [
             { description: 'Garden Terrace Venue', quantity: 1, unitPrice: 1500.00 },
             { description: 'Party Catering (40 pax)', quantity: 40, unitPrice: 50.00 },
           ],
           lines: []
         } as any,
         {
           id: 'INV-EVT-004',
           invoiceNumber: 'INV-EVT-2024-004',
           type: 'Sales',
           date: oneWeekAgo,
           dueDate: overdue5Days,
           businessPartnerId: 'CUST-004',
           reference: 'EVT-PARTY-004',
           description: 'Birthday Party - OVERDUE ⚠️',
           subtotal: 3500.00,
           taxAmount: 735.00,
           total: 4235.00,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 0,
           createdAt: oneWeekAgo,
           updatedAt: oneWeekAgo,
           sourceModule: 'conference',
           customerName: 'Nana Ama Owusu',
           customerEmail: 'nana.owusu@gmail.com',
           customerPhone: '+233 24 999 8888',
           staffName: 'Abena Serwaa',
           staffId: 'EVT-002',
           staffRole: 'Events Manager',
           eventId: 'EVT-PARTY-004',
           pax: 40,
           venue: 'Garden Terrace',
           proformaId: 'PRO-EVT-004',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 87.50 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 87.50 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 560.00 },
           ],
           items: [
             { description: 'Garden Terrace Venue', quantity: 1, unitPrice: 1500.00 },
             { description: 'Party Catering (40 pax)', quantity: 40, unitPrice: 50.00 },
           ],
           lines: [
             { id: 'IL-EVT-004', invoiceId: 'INV-EVT-004', description: 'Birthday Party', quantity: 1, unitPrice: 3500.00, amount: 3500.00, taxAmount: 735.00, glAccountCode: '4300' }
           ]
         } as any,
         
         // FLOW 5: Event Proforma (Pending - Not Yet Converted)
         {
           id: 'PRO-EVT-005',
           invoiceNumber: 'PRO-EVT-2024-005',
           type: 'Sales',
           isProforma: true,
           date: now,
           dueDate: dueIn7Days,
           businessPartnerId: 'CUST-005',
           reference: 'EVT-CONF-005',
           description: 'Annual General Meeting - PENDING PROFORMA',
           subtotal: 12000.00,
           taxAmount: 2520.00,
           total: 14520.00,
           currency: 'GHS',
           status: 'Draft',
           paidAmount: 0,
           createdAt: now,
           updatedAt: now,
           sourceModule: 'conference',
           customerName: 'Ghana Chamber of Commerce',
           customerEmail: 'events@ghanachamber.org',
           customerPhone: '+233 30 266 7890',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
           eventId: 'EVT-CONF-005',
           pax: 150,
           checkIn: dueIn14Days,
           checkOut: dueIn14Days,
           venue: 'Grand Ballroom',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 300.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 300.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 1920.00 },
           ],
           items: [
             { description: 'Grand Ballroom - Full Day', quantity: 1, unitPrice: 5000.00 },
             { description: 'Conference Catering (150 pax)', quantity: 150, unitPrice: 40.00 },
             { description: 'AV & Staging', quantity: 1, unitPrice: 1000.00 },
           ],
           lines: []
         } as any,
         
         // ============================================================
         // ACCOMMODATION (Front Office) - Flow Examples
         // ============================================================
         
         // Accommodation: Full Payment
         {
           id: 'INV-FO-001',
           invoiceNumber: 'INV-FO-2024-001',
           type: 'Sales',
           date: threeDaysAgo,
           dueDate: dueIn30Days,
           businessPartnerId: 'CUST-006',
           reference: 'RES-2024-001',
           description: 'Deluxe Room 301 - 3 Nights - PAID ✓',
           subtotal: 1200.00,
           taxAmount: 252.00,
           total: 1452.00,
           currency: 'GHS',
           status: 'Paid',
           paidAmount: 1452.00,
           paidDate: yesterday,
           createdAt: threeDaysAgo,
           updatedAt: yesterday,
           sourceModule: 'front_office',
           customerName: 'Kwame Asante',
           customerEmail: 'kwame.asante@email.com',
           customerPhone: '+233 24 123 4567',
           staffName: 'Mary Mensah',
           staffId: 'FO-001',
           staffRole: 'Front Desk Agent',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 30.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 30.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 192.00 },
           ],
           items: [
             { description: 'Deluxe Room', quantity: 3, unitPrice: 400.00 },
           ],
           lines: [
             { id: 'IL-FO-001', invoiceId: 'INV-FO-001', description: 'Deluxe Room - 3 Nights', quantity: 3, unitPrice: 400.00, amount: 1200.00, taxAmount: 252.00, glAccountCode: '4100' }
           ]
         } as any,
         
         // Accommodation: Partial Payment (Deposit)
         {
           id: 'INV-FO-002',
           invoiceNumber: 'INV-FO-2024-002',
           type: 'Sales',
           date: yesterday,
           dueDate: dueIn7Days,
           businessPartnerId: 'CUST-007',
           reference: 'RES-2024-015',
           description: 'Executive Suite 501 - 5 Nights - DEPOSIT PAID',
           subtotal: 3000.00,
           taxAmount: 630.00,
           total: 3630.00,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 1815.00,
           createdAt: yesterday,
           updatedAt: now,
           sourceModule: 'front_office',
           customerName: 'Dr. Ama Boateng',
           customerEmail: 'dr.boateng@hospital.gh',
           customerPhone: '+233 20 111 2222',
           staffName: 'Joseph Owusu',
           staffId: 'FO-002',
           staffRole: 'Front Desk Supervisor',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 75.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 75.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 480.00 },
           ],
           items: [
             { description: 'Executive Suite', quantity: 5, unitPrice: 600.00 },
           ],
           lines: [
             { id: 'IL-FO-002', invoiceId: 'INV-FO-002', description: 'Executive Suite - 5 Nights', quantity: 5, unitPrice: 600.00, amount: 3000.00, taxAmount: 630.00, glAccountCode: '4100' }
           ]
         } as any,
         
         // ============================================================
         // RESTAURANT - Flow Examples
         // ============================================================
         
         // Restaurant: Full Payment (Cash)
         {
           id: 'INV-REST-001',
           invoiceNumber: 'INV-REST-2024-001',
           type: 'Sales',
           date: yesterday,
           dueDate: yesterday,
           businessPartnerId: 'CUST-WALK',
           reference: 'TBL-08-001',
           description: 'Table 8 - Lunch - PAID (Cash) ✓',
           subtotal: 285.00,
           taxAmount: 59.85,
           total: 344.85,
           currency: 'GHS',
           status: 'Paid',
           paidAmount: 344.85,
           paidDate: yesterday,
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'restaurant',
           customerName: 'Walk-in Customer',
           staffName: 'Grace Adjei',
           staffId: 'FB-003',
           staffRole: 'Waiter',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 7.13 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 7.13 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 45.60 },
           ],
           items: [
             { description: 'Jollof Rice with Chicken', quantity: 2, unitPrice: 85.00 },
             { description: 'Grilled Tilapia', quantity: 1, unitPrice: 95.00 },
             { description: 'Fresh Juice', quantity: 1, unitPrice: 20.00 },
           ],
           lines: [
             { id: 'IL-REST-001', invoiceId: 'INV-REST-001', description: 'Food & Beverage', quantity: 1, unitPrice: 285.00, amount: 285.00, taxAmount: 59.85, glAccountCode: '4200' }
           ]
         } as any,
         
         // Restaurant: Full Payment (Card)
         {
           id: 'INV-REST-002',
           invoiceNumber: 'INV-REST-2024-002',
           type: 'Sales',
           date: now,
           dueDate: now,
           businessPartnerId: 'CUST-006',
           reference: 'TBL-12-001',
           description: 'Table 12 - Dinner - PAID (Card) ✓',
           subtotal: 450.00,
           taxAmount: 94.50,
           total: 544.50,
           currency: 'GHS',
           status: 'Paid',
           paidAmount: 544.50,
           paidDate: now,
           createdAt: now,
           updatedAt: now,
           sourceModule: 'restaurant',
           customerName: 'Kwame Asante',
           customerEmail: 'kwame.asante@email.com',
           staffName: 'Samuel Boateng',
           staffId: 'FB-005',
           staffRole: 'Waiter',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 11.25 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 11.25 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 72.00 },
           ],
           items: [
             { description: 'Seafood Platter', quantity: 2, unitPrice: 180.00 },
             { description: 'Red Wine (Bottle)', quantity: 1, unitPrice: 90.00 },
           ],
           lines: [
             { id: 'IL-REST-002', invoiceId: 'INV-REST-002', description: 'Dinner Service', quantity: 1, unitPrice: 450.00, amount: 450.00, taxAmount: 94.50, glAccountCode: '4200' }
           ]
         } as any,
         
         // ============================================================
         // ROOM SERVICE - Flow Examples
         // ============================================================
         
         // Room Service: Charged to Room (Posted to Folio)
         {
           id: 'INV-RS-001',
           invoiceNumber: 'INV-RS-2024-001',
           type: 'Sales',
           date: yesterday,
           dueDate: dueIn7Days,
           businessPartnerId: 'CUST-006',
           reference: 'RS-301-001',
           description: 'Room Service - Room 301 - CHARGED TO ROOM',
           subtotal: 120.00,
           taxAmount: 25.20,
           total: 145.20,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 0,
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'room_service',
           customerName: 'Kwame Asante (Room 301)',
           staffName: 'Kofi Mensah',
           staffId: 'FB-010',
           staffRole: 'Room Service Attendant',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 3.00 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 3.00 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 19.20 },
           ],
           items: [
             { description: 'Continental Breakfast', quantity: 2, unitPrice: 45.00 },
             { description: 'Fresh Orange Juice', quantity: 2, unitPrice: 15.00 },
           ],
           lines: [
             { id: 'IL-RS-001', invoiceId: 'INV-RS-001', description: 'Room Service', quantity: 1, unitPrice: 120.00, amount: 120.00, taxAmount: 25.20, glAccountCode: '4201' }
           ]
         } as any,
         
         // ============================================================
         // MANUAL ENTRY
         // ============================================================
         {
           id: 'INV-MAN-001',
           invoiceNumber: 'INV-MAN-2024-001',
           type: 'Sales',
           date: twoDaysAgo,
           dueDate: dueIn30Days,
           businessPartnerId: 'CUST-008',
           reference: 'MAN-2024-001',
           description: 'Miscellaneous Services - Manual Entry',
           subtotal: 500.00,
           taxAmount: 105.00,
           total: 605.00,
           currency: 'GHS',
           status: 'Posted',
           paidAmount: 605.00,
           paidDate: yesterday,
           createdAt: twoDaysAgo,
           updatedAt: yesterday,
           sourceModule: 'other',
           customerName: 'ABC Company Ltd',
           customerEmail: 'accounts@abccompany.gh',
           customerPhone: '+233 30 255 1234',
           staffName: 'Admin User',
           staffId: 'ADM-001',
           staffRole: 'Accountant',
           taxBreakdown: [
             { code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 12.50 },
             { code: 'GETFUND', name: 'GETFund Levy', rate: 2.5, amount: 12.50 },
             { code: 'VAT', name: 'VAT', rate: 15.0, amount: 80.00 },
           ],
           items: [
             { description: 'Consulting Services', quantity: 1, unitPrice: 500.00 },
           ],
           lines: [
             { id: 'IL-MAN-001', invoiceId: 'INV-MAN-001', description: 'Miscellaneous', quantity: 1, unitPrice: 500.00, amount: 500.00, taxAmount: 105.00, glAccountCode: '4900' }
           ]
         } as any,
       ];

             // ============================================================
       // RECEIPTS - Linked to Invoices
       // ============================================================
       const samplePayments: Payment[] = [
         // Event 1: Full Payment
         {
           id: 'RCP-EVT-001',
           paymentNumber: 'RCP-EVT-2024-001',
           date: fiveDaysAgo,
           type: 'Receipt',
           businessPartnerId: 'CUST-001',
           invoiceId: 'INV-EVT-001',
           reference: 'EVT-CORP-001',
           description: 'Full Payment - Corporate Training',
           amount: 6050.00,
           currency: 'GHS',
           paymentMethod: 'Bank Transfer',
           status: 'Posted',
           createdAt: fiveDaysAgo,
           updatedAt: fiveDaysAgo,
           sourceModule: 'conference',
           customerName: 'Accra Business School',
           staffName: 'Emmanuel Tetteh',
           staffId: 'EVT-001',
           staffRole: 'Events Coordinator',
         } as any,
         
         // Event 2: 50% Deposit
         {
           id: 'RCP-EVT-002',
           paymentNumber: 'RCP-EVT-2024-002',
           date: threeDaysAgo,
           type: 'Receipt',
           businessPartnerId: 'CUST-002',
           invoiceId: 'INV-EVT-002',
           reference: 'EVT-WEDDING-002',
           description: '50% Deposit - Wedding Reception',
           amount: 9075.00,
           currency: 'GHS',
           paymentMethod: 'Mobile Money',
           status: 'Posted',
           createdAt: threeDaysAgo,
           updatedAt: threeDaysAgo,
           sourceModule: 'conference',
           customerName: 'Mensah Family',
           staffName: 'Abena Serwaa',
           staffId: 'EVT-002',
           staffRole: 'Events Manager',
         } as any,
         
         // Accommodation 1: Full Payment
         {
           id: 'RCP-FO-001',
           paymentNumber: 'RCP-FO-2024-001',
           date: yesterday,
           type: 'Receipt',
           businessPartnerId: 'CUST-006',
           invoiceId: 'INV-FO-001',
           reference: 'RES-2024-001',
           description: 'Full Payment - Room 301',
           amount: 1452.00,
           currency: 'GHS',
           paymentMethod: 'Card',
           status: 'Posted',
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'front_office',
           customerName: 'Kwame Asante',
           staffName: 'Mary Mensah',
           staffId: 'FO-001',
           staffRole: 'Front Desk Agent',
         } as any,
         
         // Accommodation 2: Deposit
         {
           id: 'RCP-FO-002',
           paymentNumber: 'RCP-FO-2024-002',
           date: now,
           type: 'Receipt',
           businessPartnerId: 'CUST-007',
           invoiceId: 'INV-FO-002',
           reference: 'RES-2024-015',
           description: '50% Deposit - Executive Suite',
           amount: 1815.00,
           currency: 'GHS',
           paymentMethod: 'Bank Transfer',
           status: 'Posted',
           createdAt: now,
           updatedAt: now,
           sourceModule: 'front_office',
           customerName: 'Dr. Ama Boateng',
           staffName: 'Joseph Owusu',
           staffId: 'FO-002',
           staffRole: 'Front Desk Supervisor',
         } as any,
         
         // Restaurant 1: Cash
         {
           id: 'RCP-REST-001',
           paymentNumber: 'RCP-REST-2024-001',
           date: yesterday,
           type: 'Receipt',
           businessPartnerId: 'CUST-WALK',
           invoiceId: 'INV-REST-001',
           reference: 'TBL-08-001',
           description: 'Cash Payment - Table 8',
           amount: 344.85,
           currency: 'GHS',
           paymentMethod: 'Cash',
           status: 'Posted',
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'restaurant',
           customerName: 'Walk-in Customer',
           staffName: 'Grace Adjei',
           staffId: 'FB-003',
           staffRole: 'Waiter',
         } as any,
         
         // Restaurant 2: Card
         {
           id: 'RCP-REST-002',
           paymentNumber: 'RCP-REST-2024-002',
           date: now,
           type: 'Receipt',
           businessPartnerId: 'CUST-006',
           invoiceId: 'INV-REST-002',
           reference: 'TBL-12-001',
           description: 'Card Payment - Table 12',
           amount: 544.50,
           currency: 'GHS',
           paymentMethod: 'Card',
           status: 'Posted',
           createdAt: now,
           updatedAt: now,
           sourceModule: 'restaurant',
           customerName: 'Kwame Asante',
           staffName: 'Samuel Boateng',
           staffId: 'FB-005',
           staffRole: 'Waiter',
         } as any,
         
         // Manual Entry Payment
         {
           id: 'RCP-MAN-001',
           paymentNumber: 'RCP-MAN-2024-001',
           date: yesterday,
           type: 'Receipt',
           businessPartnerId: 'CUST-008',
           invoiceId: 'INV-MAN-001',
           reference: 'MAN-2024-001',
           description: 'Manual Payment - ABC Company',
           amount: 605.00,
           currency: 'GHS',
           paymentMethod: 'Cheque',
           status: 'Posted',
           createdAt: yesterday,
           updatedAt: yesterday,
           sourceModule: 'other',
           customerName: 'ABC Company Ltd',
           staffName: 'Admin User',
           staffId: 'ADM-001',
           staffRole: 'Accountant',
         } as any,
       ];

      // Initialize sample business partners
      const samplePartners: BusinessPartner[] = [
        // Event Customers
        {
          id: 'CUST-001',
          code: 'CUST-001',
          name: 'Accra Business School',
          type: 'Customer',
          taxNumber: 'TIN-E001',
          address: 'Ring Road Central, Accra',
          phone: '+233 30 277 1234',
          email: 'events@abs.edu.gh',
          contactPerson: 'Events Department',
          creditLimit: 20000,
          paymentTerms: 14,
          glAccountCode: '1210',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-002',
          code: 'CUST-002',
          name: 'Mensah Family',
          type: 'Customer',
          taxNumber: '',
          address: 'Tema, Greater Accra',
          phone: '+233 24 555 1234',
          email: 'kofi.mensah@email.com',
          contactPerson: 'Kofi Mensah',
          creditLimit: 25000,
          paymentTerms: 14,
          glAccountCode: '1210',
          currency: 'GHS',
          balance: 9075.00,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-003',
          code: 'CUST-003',
          name: 'Ghana Tech Hub',
          type: 'Customer',
          taxNumber: 'TIN-E003',
          address: 'Osu, Accra',
          phone: '+233 30 288 4567',
          email: 'info@ghanatechhub.com',
          contactPerson: 'Operations',
          creditLimit: 15000,
          paymentTerms: 14,
          glAccountCode: '1210',
          currency: 'GHS',
          balance: 9680.00,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-004',
          code: 'CUST-004',
          name: 'Nana Ama Owusu',
          type: 'Customer',
          taxNumber: '',
          address: 'East Legon, Accra',
          phone: '+233 24 999 8888',
          email: 'nana.owusu@gmail.com',
          contactPerson: 'Nana Ama Owusu',
          creditLimit: 10000,
          paymentTerms: 7,
          glAccountCode: '1210',
          currency: 'GHS',
          balance: 4235.00,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-005',
          code: 'CUST-005',
          name: 'Ghana Chamber of Commerce',
          type: 'Customer',
          taxNumber: 'TIN-E005',
          address: 'Independence Avenue, Accra',
          phone: '+233 30 266 7890',
          email: 'events@ghanachamber.org',
          contactPerson: 'Events Committee',
          creditLimit: 50000,
          paymentTerms: 30,
          glAccountCode: '1210',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        // Front Office Customers
        {
          id: 'CUST-006',
          code: 'CUST-006',
          name: 'Kwame Asante',
          type: 'Customer',
          taxNumber: '',
          address: 'Osu, Accra',
          phone: '+233 24 123 4567',
          email: 'kwame.asante@email.com',
          contactPerson: 'Kwame Asante',
          creditLimit: 5000,
          paymentTerms: 7,
          glAccountCode: '1210',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-007',
          code: 'CUST-007',
          name: 'Dr. Ama Boateng',
          type: 'Customer',
          taxNumber: '',
          address: 'Cantonments, Accra',
          phone: '+233 20 111 2222',
          email: 'dr.boateng@hospital.gh',
          contactPerson: 'Dr. Ama Boateng',
          creditLimit: 10000,
          paymentTerms: 14,
          glAccountCode: '1210',
          currency: 'GHS',
          balance: 1815.00,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-008',
          code: 'CUST-008',
          name: 'ABC Company Ltd',
          type: 'Customer',
          taxNumber: 'TIN-C008',
          address: 'Industrial Area, Accra',
          phone: '+233 30 255 1234',
          email: 'accounts@abccompany.gh',
          contactPerson: 'Finance Department',
          creditLimit: 20000,
          paymentTerms: 30,
          glAccountCode: '1210',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'CUST-WALK',
          code: 'WALK-001',
          name: 'Walk-in Customer',
          type: 'Customer',
          taxNumber: '',
          address: '',
          phone: '',
          email: '',
          contactPerson: '',
          creditLimit: 0,
          paymentTerms: 0,
          glAccountCode: '1210',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'SUP-001',
          code: 'SUP-001',
          name: 'Local Supplier Ltd',
          type: 'Supplier',
          taxNumber: 'TIN-S1001',
          address: 'Kumasi',
          phone: '+233 200 000 010',
          email: 'sales@supplier.com',
          contactPerson: 'Sales',
          creditLimit: 0,
          paymentTerms: 14,
          glAccountCode: '2200',
          currency: 'GHS',
          balance: 0,
          isActive: true,
          countryCode: 'GH',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Initialize sample bank accounts
      const sampleBankAccounts: BankAccount[] = [
        {
          id: '1',
          accountNumber: '001-0001',
          accountName: 'Cash in Hand',
          bankName: 'Petty Cash',
          currency: 'GHS',
          glAccountCode: '1110',
          openingBalance: 5000,
          currentBalance: 7500,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          accountNumber: '233-0002',
          accountName: 'Main Bank Account',
          bankName: 'GCB Bank',
          currency: 'GHS',
          glAccountCode: '1120',
          openingBalance: 20000,
          currentBalance: 19500,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Initialize sample bank transactions
      const sampleBankTxns: BankTransaction[] = [
        {
          id: 'BT-1',
          bankAccountId: '2',
          transactionDate: new Date().toISOString(),
          reference: 'DEP-1001',
          description: 'Guest receipts deposit',
          amount: 5000,
          type: 'Deposit',
          currency: 'GHS',
          balance: 24500,
          status: 'Cleared',
          createdAt: new Date().toISOString()
        },
        {
          id: 'BT-2',
          bankAccountId: '2',
          transactionDate: new Date().toISOString(),
          reference: 'WDR-1002',
          description: 'Supplier payment',
          amount: -4500,
          type: 'Withdrawal',
          currency: 'GHS',
          balance: 20000,
          status: 'Reconciled',
          reconciledAt: new Date().toISOString(),
          reconciledBy: 'admin',
          createdAt: new Date().toISOString()
        }
      ];

      const sampleAudit: AuditTrail[] = [
        { id: 'AT-1', tableName: 'JournalEntry', recordId: '1', action: 'Post', userId: 'admin', timestamp: new Date().toISOString() },
        { id: 'AT-2', tableName: 'Invoice', recordId: '1', action: 'Create', userId: 'admin', timestamp: new Date().toISOString() },
        { id: 'AT-3', tableName: 'Payment', recordId: '1', action: 'Post', userId: 'admin', timestamp: new Date().toISOString() }
       ];

      // Initialize sample WHT certificates (Withholding Tax Credits)
      const sampleWHTCertificates: WHTCertificate[] = [
        // WHT Certificate 1: Corporate customer with full certificate received
        {
          id: 'WHT-001',
          certificateNumber: 'GRA-WHT-2024-001234',
          date: yesterday,
          receivedDate: now,
          withholdingAgentName: 'Ghana Ports & Harbours Authority',
          withholdingAgentTIN: 'C0003456789',
          taxPeriod: 'January 2026',
          invoiceId: 'INV-EVT-001',
          invoiceNumber: 'INV-EVT-2024-001',
          grossAmount: 6050.00,
          whtRate: 5,
          whtAmount: 250.00,  // 5% of 5000 subtotal
          whtVatRate: 7,
          whtVatAmount: 73.50,  // 7% of 1050 VAT
          totalWithheld: 323.50,
          status: 'Verified',
          taxCreditAccountCode: '1230',
          taxCreditUsedAmount: 0,
          taxCreditBalance: 323.50,
          verifiedBy: 'Kofi Asante',
          verifiedDate: now,
          createdAt: yesterday,
          updatedAt: now,
        },
        // WHT Certificate 2: Government ministry - pending certificate
        {
          id: 'WHT-002',
          certificateNumber: 'PENDING-20240108-002',
          date: now,
          receivedDate: '',
          withholdingAgentName: 'Ministry of Tourism',
          withholdingAgentTIN: 'G0001234567',
          taxPeriod: 'January 2026',
          invoiceId: 'INV-EVT-003',
          invoiceNumber: 'INV-EVT-2024-003',
          grossAmount: 24200.00,
          whtRate: 5,
          whtAmount: 1000.00,  // 5% of 20000 subtotal
          whtVatRate: 7,
          whtVatAmount: 294.00,  // 7% of 4200 VAT
          totalWithheld: 1294.00,
          status: 'Pending',
          taxCreditAccountCode: '1230',
          taxCreditUsedAmount: 0,
          taxCreditBalance: 1294.00,
          notes: 'Awaiting certificate from GRA - follow up in 2 weeks',
          createdAt: now,
          updatedAt: now,
        },
        // WHT Certificate 3: University - received but not verified
        {
          id: 'WHT-003',
          certificateNumber: 'GRA-WHT-2024-002567',
          date: oneWeekAgo,
          receivedDate: yesterday,
          withholdingAgentName: 'University of Ghana',
          withholdingAgentTIN: 'E0007891234',
          taxPeriod: 'December 2025',
          invoiceId: 'INV-CONF-001',
          invoiceNumber: 'INV-CONF-2024-001',
          grossAmount: 12100.00,
          whtRate: 5,
          whtAmount: 500.00,
          whtVatRate: 7,
          whtVatAmount: 147.00,
          totalWithheld: 647.00,
          status: 'Received',
          taxCreditAccountCode: '1230',
          taxCreditUsedAmount: 0,
          taxCreditBalance: 647.00,
          createdAt: oneWeekAgo,
          updatedAt: yesterday,
        }
       ];

  return {
    journalEntries: sampleJournalEntries,
    invoices: sampleInvoices,
    payments: samplePayments,
    whtCertificates: sampleWHTCertificates,
    businessPartners: samplePartners,
    bankAccounts: sampleBankAccounts,
    bankTransactions: sampleBankTxns,
    auditTrail: sampleAudit,
  };
}
