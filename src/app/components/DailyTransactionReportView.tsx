'use client';

import React from 'react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Select, SelectItem, Chip } from '@heroui/react';

export interface TransactionRow {
  transactionId: string;
  guestName: string;
  roomNumber: string;
  transactionType: 'charge' | 'payment';
  amount: number;
  description: string;
  timestamp: string;
  cashier: string;
  paymentMethod: string;
  folioNumber: string;
  category: string;
  status: string;
}

type GroupBy = 'none' | 'guest' | 'staff' | 'method' | 'status' | 'category';

const GROUP_LABELS: Record<Exclude<GroupBy, 'none'>, string> = {
  guest: 'Guest',
  staff: 'Staff',
  method: 'Payment Method',
  status: 'Status',
  category: 'Category',
};

function money(n: number) {
  return `₵${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function groupKeyFor(row: TransactionRow, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'guest': return row.guestName;
    case 'staff': return row.cashier;
    case 'method': return row.transactionType === 'payment' ? row.paymentMethod : '—';
    case 'status': return row.status;
    case 'category': return row.category;
    default: return '';
  }
}

/** Sums charges/payments per key — used for all 5 summary breakdowns. */
function summarize(rows: TransactionRow[], keyFor: (r: TransactionRow) => string) {
  const totals = new Map<string, { charges: number; payments: number; count: number }>();
  for (const r of rows) {
    const key = keyFor(r);
    if (!key) continue;
    const entry = totals.get(key) || { charges: 0, payments: 0, count: 0 };
    if (r.transactionType === 'charge') entry.charges += r.amount;
    else entry.payments += r.amount;
    entry.count += 1;
    totals.set(key, entry);
  }
  return Array.from(totals.entries())
    .map(([key, v]) => ({ key, ...v, net: v.charges - v.payments }))
    .sort((a, b) => (b.charges + b.payments) - (a.charges + a.payments));
}

function SummaryTable({ title, rows }: { title: string; rows: ReturnType<typeof summarize> }) {
  return (
    <div>
      <h5 className="text-xs font-semibold text-gray-500 uppercase mb-1">{title}</h5>
      <Table aria-label={title} removeWrapper isCompact>
        <TableHeader>
          <TableColumn>{title}</TableColumn>
          <TableColumn>Charges</TableColumn>
          <TableColumn>Payments</TableColumn>
          <TableColumn>Count</TableColumn>
        </TableHeader>
        <TableBody emptyContent="No data">
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.key}</TableCell>
              <TableCell>{money(r.charges)}</TableCell>
              <TableCell>{money(r.payments)}</TableCell>
              <TableCell>{r.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function DailyTransactionReportView({ transactions }: { transactions: TransactionRow[] }) {
  const [groupBy, setGroupBy] = React.useState<GroupBy>('none');

  const byGuest = React.useMemo(() => summarize(transactions, (r) => r.guestName), [transactions]);
  const byStaff = React.useMemo(() => summarize(transactions, (r) => r.cashier), [transactions]);
  const byMethod = React.useMemo(
    () => summarize(transactions.filter((r) => r.transactionType === 'payment'), (r) => r.paymentMethod),
    [transactions]
  );
  const byStatus = React.useMemo(() => summarize(transactions, (r) => r.status), [transactions]);
  const byCategory = React.useMemo(() => summarize(transactions, (r) => r.category), [transactions]);

  const sortedRows = React.useMemo(() => {
    if (groupBy === 'none') return transactions;
    return [...transactions].sort((a, b) => groupKeyFor(a, groupBy).localeCompare(groupKeyFor(b, groupBy)));
  }, [transactions, groupBy]);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No transactions for the selected date.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SummaryTable title="By Guest" rows={byGuest} />
        <SummaryTable title="By Staff" rows={byStaff} />
        <SummaryTable title="By Payment Method" rows={byMethod} />
        <SummaryTable title="By Status" rows={byStatus} />
        <SummaryTable title="By Category" rows={byCategory} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-sm font-semibold">Transaction Detail</h5>
          <Select
            label="Group by"
            className="w-48"
            size="sm"
            selectedKeys={[groupBy]}
            onSelectionChange={(keys) => setGroupBy((Array.from(keys)[0] as GroupBy) || 'none')}
          >
            <SelectItem key="none">None</SelectItem>
            <SelectItem key="guest">Guest</SelectItem>
            <SelectItem key="staff">Staff</SelectItem>
            <SelectItem key="method">Payment Method</SelectItem>
            <SelectItem key="status">Status</SelectItem>
            <SelectItem key="category">Category</SelectItem>
          </Select>
        </div>
        <Table aria-label="Daily transactions">
          <TableHeader>
            <TableColumn>Time</TableColumn>
            <TableColumn>Guest</TableColumn>
            <TableColumn>Room</TableColumn>
            <TableColumn>Type</TableColumn>
            <TableColumn>{groupBy === 'none' ? 'Group' : GROUP_LABELS[groupBy]}</TableColumn>
            <TableColumn>Description</TableColumn>
            <TableColumn>Amount</TableColumn>
            <TableColumn>Method</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Staff</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No transactions">
            {sortedRows.map((r) => (
              <TableRow key={r.transactionId}>
                <TableCell>{new Date(r.timestamp).toLocaleTimeString()}</TableCell>
                <TableCell>{r.guestName}</TableCell>
                <TableCell>{r.roomNumber}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={r.transactionType === 'payment' ? 'success' : 'warning'}>
                    {r.transactionType}
                  </Chip>
                </TableCell>
                <TableCell>{groupBy === 'none' ? '—' : groupKeyFor(r, groupBy)}</TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell>{money(r.amount)}</TableCell>
                <TableCell>{r.transactionType === 'payment' ? r.paymentMethod : '—'}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={r.status === 'completed' || r.status === 'posted' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}>
                    {r.status}
                  </Chip>
                </TableCell>
                <TableCell>{r.cashier}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
