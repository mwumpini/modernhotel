'use client';

import React from 'react';
import { Select, SelectItem, Autocomplete, AutocompleteItem, Chip } from '@heroui/react';
import { SortableReportTable } from './reports/SortableReportTable';

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

/** A stay-day charge is stored as YYYY-MM-DD. Parsing that as UTC midnight paints a clock time the posting never had. */
function formatWhen(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-GH');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GH');
}

function uniqueSorted(values: (string | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort();
}

type Filters = { guest: string; staff: string; type: string; method: string; status: string; category: string };
const EMPTY_FILTERS: Filters = { guest: 'all', staff: 'all', type: 'all', method: 'all', status: 'all', category: 'all' };

export default function DailyTransactionReportView({
  transactions,
  showFilters = true,
  visibleColumns,
}: {
  transactions: TransactionRow[];
  showFilters?: boolean;
  visibleColumns?: string[];
}) {
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

  const setFilter = (key: keyof Filters) => (keys: any) => {
    setFilters((f) => ({ ...f, [key]: (Array.from(keys)[0] as string) || 'all' }));
  };
  const columns = [
    ['timestamp', 'Date / Time'],
    ['transactionId', 'Reference'],
    ['folioNumber', 'Folio'],
    ['guestName', 'Guest'],
    ['roomNumber', 'Room'],
    ['transactionType', 'Type'],
    ['category', 'Category'],
    ['description', 'Description'],
    ['amount', 'Amount'],
    ['paymentMethod', 'Method'],
    ['status', 'Status'],
    ['cashier', 'Staff'],
  ].filter(([key]) => !visibleColumns || visibleColumns.includes(key));

  const renderCell = (row: TransactionRow, key: string) => {
    if (key === 'timestamp') return formatWhen(row.timestamp);
    if (key === 'amount') return money(row.amount);
    if (key === 'paymentMethod') return row.transactionType === 'payment' ? row.paymentMethod : '—';
    if (key === 'transactionType') {
      return <Chip size="sm" variant="flat" color={row.transactionType === 'payment' ? 'success' : 'warning'}>{row.transactionType}</Chip>;
    }
    if (key === 'status') {
      return (
        <Chip size="sm" variant="flat" color={row.status === 'completed' || row.status === 'posted' ? 'success' : row.status === 'pending' ? 'warning' : 'danger'}>
          {row.status}
        </Chip>
      );
    }
    return String(row[key as keyof TransactionRow] ?? '—');
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
      {showFilters && <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <Autocomplete
          label="Guest"
          size="sm"
          selectedKey={filters.guest}
          onSelectionChange={(key) => setFilters((f) => ({ ...f, guest: (key as string) || 'all' }))}
        >
          <AutocompleteItem key="all">All Guests</AutocompleteItem>
          {options.guest.map((g) => <AutocompleteItem key={g}>{g}</AutocompleteItem>) as any}
        </Autocomplete>
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
      </div>}

      <SortableReportTable
        ariaLabel="Daily transactions"
        columns={columns.map(([key, label]) => ({ key, label }))}
        rows={filteredRows as unknown as Record<string, unknown>[]}
        renderCell={(row, column) => renderCell(row as unknown as TransactionRow, column.key)}
      />
    </div>
  );
}
