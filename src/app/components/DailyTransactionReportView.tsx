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

function money(n: number) {
  return `₵${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function uniqueSorted(values: (string | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort();
}

type Filters = { guest: string; staff: string; type: string; method: string; status: string; category: string };
const EMPTY_FILTERS: Filters = { guest: 'all', staff: 'all', type: 'all', method: 'all', status: 'all', category: 'all' };

export default function DailyTransactionReportView({ transactions }: { transactions: TransactionRow[] }) {
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);

  const options = React.useMemo(() => ({
    guest: uniqueSorted(transactions.map((r) => r.guestName)),
    staff: uniqueSorted(transactions.map((r) => r.cashier)),
    method: uniqueSorted(transactions.filter((r) => r.transactionType === 'payment').map((r) => r.paymentMethod)),
    status: uniqueSorted(transactions.map((r) => r.status)),
    category: uniqueSorted(transactions.map((r) => r.category)),
  }), [transactions]);

  const filteredRows = React.useMemo(() => {
    return transactions.filter((r) =>
      (filters.guest === 'all' || r.guestName === filters.guest) &&
      (filters.staff === 'all' || r.cashier === filters.staff) &&
      (filters.type === 'all' || r.transactionType === filters.type) &&
      (filters.method === 'all' || (r.transactionType === 'payment' && r.paymentMethod === filters.method)) &&
      (filters.status === 'all' || r.status === filters.status) &&
      (filters.category === 'all' || r.category === filters.category)
    );
  }, [transactions, filters]);

  const totals = React.useMemo(() => {
    let charges = 0, payments = 0;
    for (const r of filteredRows) {
      if (r.transactionType === 'charge') charges += r.amount;
      else payments += r.amount;
    }
    return { charges, payments, net: charges - payments };
  }, [filteredRows]);

  const setFilter = (key: keyof Filters) => (keys: any) => {
    setFilters((f) => ({ ...f, [key]: (Array.from(keys)[0] as string) || 'all' }));
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No transactions for the selected date.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <Select label="Guest" size="sm" selectedKeys={[filters.guest]} onSelectionChange={setFilter('guest')}>
          <SelectItem key="all">All Guests</SelectItem>
          {options.guest.map((g) => <SelectItem key={g}>{g}</SelectItem>) as any}
        </Select>
        <Select label="Staff" size="sm" selectedKeys={[filters.staff]} onSelectionChange={setFilter('staff')}>
          <SelectItem key="all">All Staff</SelectItem>
          {options.staff.map((s) => <SelectItem key={s}>{s}</SelectItem>) as any}
        </Select>
        <Select label="Type" size="sm" selectedKeys={[filters.type]} onSelectionChange={setFilter('type')}>
          <SelectItem key="all">All Types</SelectItem>
          <SelectItem key="charge">Charge</SelectItem>
          <SelectItem key="payment">Payment</SelectItem>
        </Select>
        <Select label="Payment Method" size="sm" selectedKeys={[filters.method]} onSelectionChange={setFilter('method')}>
          <SelectItem key="all">All Methods</SelectItem>
          {options.method.map((m) => <SelectItem key={m}>{m}</SelectItem>) as any}
        </Select>
        <Select label="Status" size="sm" selectedKeys={[filters.status]} onSelectionChange={setFilter('status')}>
          <SelectItem key="all">All Statuses</SelectItem>
          {options.status.map((s) => <SelectItem key={s}>{s}</SelectItem>) as any}
        </Select>
        <Select label="Category" size="sm" selectedKeys={[filters.category]} onSelectionChange={setFilter('category')}>
          <SelectItem key="all">All Categories</SelectItem>
          {options.category.map((c) => <SelectItem key={c}>{c}</SelectItem>) as any}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Chip size="sm" variant="flat">{filteredRows.length} transaction{filteredRows.length === 1 ? '' : 's'}</Chip>
        <Chip size="sm" variant="flat" color="warning">Charges {money(totals.charges)}</Chip>
        <Chip size="sm" variant="flat" color="success">Payments {money(totals.payments)}</Chip>
        <Chip size="sm" variant="flat" color={totals.net === 0 ? 'default' : totals.net > 0 ? 'danger' : 'primary'}>Net {money(totals.net)}</Chip>
      </div>

      <Table aria-label="Daily transactions">
        <TableHeader>
          <TableColumn>Time</TableColumn>
          <TableColumn>Guest</TableColumn>
          <TableColumn>Room</TableColumn>
          <TableColumn>Type</TableColumn>
          <TableColumn>Description</TableColumn>
          <TableColumn>Amount</TableColumn>
          <TableColumn>Method</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Staff</TableColumn>
        </TableHeader>
        <TableBody emptyContent="No transactions match the selected filters">
          {filteredRows.map((r) => (
            <TableRow key={r.transactionId}>
              <TableCell>{new Date(r.timestamp).toLocaleTimeString()}</TableCell>
              <TableCell>{r.guestName}</TableCell>
              <TableCell>{r.roomNumber}</TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={r.transactionType === 'payment' ? 'success' : 'warning'}>
                  {r.transactionType}
                </Chip>
              </TableCell>
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
  );
}
