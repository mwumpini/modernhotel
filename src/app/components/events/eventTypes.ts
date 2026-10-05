export type SimpleEventStatus = 'quote' | 'confirmed' | 'invoiced' | 'cancelled';

export type EventInvoiceStatus = 'Draft' | 'Issued' | 'Partial' | 'Paid' | 'Overdue';

export type ReceiptMethod = 'Cash' | 'Card' | 'Bank Transfer' | 'Mobile Money' | 'Cheque';

export interface EventInvoice {
    id: string;
    eventId: string;
    eventName: string;
    clientName: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    tax: number;
    total: number;
    balance: number;
    status: EventInvoiceStatus;
    reference?: string;
    notes?: string;
    formSnapshot?: InvoiceFormSnapshot;
  }

export interface InvoiceFormSnapshot {
    eventId: string;
    eventName: string;
    clientName: string;
    startDate: string;
    endDate: string;
    dailySchedule: any[];
    particularLabels: any;
    discountEnabled: boolean;
    discountType: 'percent' | 'amount';
    discountValue: number;
    subtotal: number;
    tax: number;
    total: number;
    balance: number;
    issueDate: string;
    dueDate: string;
    status: EventInvoiceStatus;
  }

export interface EventReceipt {
    id: string;
    eventId: string;
    eventName: string;
    invoiceId?: string;
    clientName: string;
    date: string;
    amount: number;
    method: ReceiptMethod;
    reference?: string;
    checkNumber?: string;
    recordedBy: string;
    notes?: string;
    status?: 'Posted' | 'Void';
  }

export interface EventFolioEntry {
    id: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    reference?: string;
    costCenter?: string; // Cost center code for charges (debits)
    revenueCenter?: string; // Revenue center code for payments (credits)
  }

export interface EventFolio {
    id: string;
    eventId: string;
    eventName: string;
    clientName: string;
    status: 'Open' | 'Closed' | 'Void';
    openingBalance: number;
    entries: EventFolioEntry[];
    createdAt: string;
    updatedAt: string;
  }

export interface QuoteListItem {
    id: string;
    eventId?: string;
    quoteNumber: string;
    clientName: string;
    eventName: string;
    checkIn: string;
    checkOut: string;
    pax: number;
    issuedOn: string;
    total: number;
    status: string;
    statusLabel: string;
    reference: string;
    venueName: string;
    rawEvent: any;
  }

export type SortDirection = 'asc' | 'desc';

export interface TableSortState {
    column: string;
    direction: SortDirection;
  }

export interface QuoteBudgetSnapshot {
    accommodation: number;
    conference: number;
    dinner: number;
    lunch: number;
    extras: number;
    total: number;
  }

export type QuoteServiceLine = { id: string; name: string; category: string; qty: number; unitPrice: number; taxGroup: string };

export type QuoteDay = { id: string; label: string; date: string; services: QuoteServiceLine[] };

export type Package = { id: string; name: string; description: string; rateType: 'per_person_per_day'|'flat_per_day'|'flat_total'; price: number };

export type AddOn = { id: string; name: string; price: number; billing: 'per_day'|'flat_total'|'per_person_per_day' };
