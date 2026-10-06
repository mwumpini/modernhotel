import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/database/client';
import { calendarDay, postingDateError } from '@/app/lib/frontoffice/backdate';

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
  const error = postingDateError(value, allow);
  if (!error) return null;
  return NextResponse.json({ error }, { status: 400 });
}
