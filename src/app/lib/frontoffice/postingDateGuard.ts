import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/database/client';
import { arrivalFloor, businessToday, calendarDay, isManualPosting, postingDateError } from '@/app/lib/frontoffice/backdate';

export { isManualPosting };
import { getFrontOfficeBusinessDate } from '@/app/lib/frontoffice/folioServer';

const DATE_FIELDS = {
  supplierInvoice: 'invoiceDate',
  purchaseOrder: 'orderDate',
  requisition: 'requestedDate',
  stockTransfer: 'transferDate',
  stockCount: 'startDate',
  goodsIssue: 'issueDate',
  goodsReceiptNote: 'receiptDate',
  cashierShift: 'businessDate',
  reconcilingItem: 'transactionDate',
  accountingInvoice: 'date',
  accountingPayment: 'date',
  journalEntry: 'date',
  hrStaffDebt: 'issuedDate',
  reservation: 'checkInDate',
} as const;

export type PostingRecord = keyof typeof DATE_FIELDS;

type Finder = {
  findFirst: (args: {
    where: { id: string; tenantId: string };
    select: Record<string, boolean>;
  }) => Promise<Record<string, unknown> | null>;
};

/**
 * Reject a posting date earlier than today when Allow backdating is off.
 * An update that keeps the date already stored is allowed.
 */
export async function rejectIfBackdated(
  tenantId: string,
  value: unknown,
  record?: { model: PostingRecord; id?: string | null },
  today = businessToday(),
): Promise<NextResponse | null> {
  const id = record?.id ? String(record.id) : '';
  if (record && id) {
    const field = DATE_FIELDS[record.model];
    const delegate = (prisma as unknown as Record<string, Finder>)[record.model];
    const row = await delegate.findFirst({
      where: { id, tenantId },
      select: { [field]: true },
    });
    const previous = row?.[field];
    if (calendarDay(previous) && calendarDay(previous) === calendarDay(value)) return null;
  }

  const settings = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { roomSettings: true },
  });
  const allow = (settings?.roomSettings as { allowBackdating?: boolean } | null)?.allowBackdating === true;
  const error = postingDateError(value, allow, today);
  if (!error) return null;
  return NextResponse.json({ error }, { status: 400 });
}

export async function rejectIfManualBackdated(
  tenantId: string,
  body: { date?: unknown; sourceModule?: unknown },
  record?: { model: PostingRecord; id?: string | null },
): Promise<NextResponse | null> {
  if (!isManualPosting(body.sourceModule) || body.date === undefined) return null;
  return rejectIfBackdated(tenantId, body.date, record);
}

/** A stay may not arrive before the front desk's business date (it lags the calendar until night audit). */
export async function rejectIfArrivalBackdated(
  tenantId: string,
  arrival: unknown,
  record?: { id?: string | null },
): Promise<NextResponse | null> {
  if (arrival === undefined) return null;
  const businessDate = await getFrontOfficeBusinessDate(tenantId).catch(() => businessToday());
  return rejectIfBackdated(tenantId, arrival, record ? { model: 'reservation', id: record.id } : undefined, arrivalFloor(businessDate));
}

/** An edit that moves a manual posting's date earlier than today (keeping its stored date is fine). */
export async function rejectIfManualBackdatedEdit(
  tenantId: string,
  body: { date?: unknown; sourceModule?: unknown },
  model: 'accountingInvoice' | 'journalEntry' | 'accountingPayment',
  id: string,
): Promise<NextResponse | null> {
  if (body.date === undefined) return null;
  let source = body.sourceModule;
  if (source === undefined && model !== 'accountingPayment') {
    const delegate = (prisma as unknown as Record<string, Finder>)[model];
    const row = await delegate.findFirst({ where: { id, tenantId }, select: { sourceModule: true } });
    source = row?.sourceModule;
  }
  if (!isManualPosting(source)) return null;
  return rejectIfBackdated(tenantId, body.date, { model, id });
}
