'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Pagination } from '@heroui/react';
import { useEmployeeChangesStore, type EmployeeChange } from '@/app/lib/hr/employeeChangesStore';
import { printDetailSheet } from '@/app/lib/print/simpleReport';
import { SortLabel, unifiedTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailGrid, DetailField } from '../frontoffice/detailView';
import { useDeskPagination } from '../dashboard/deskTableUi';

type ChangeSortKey = 'date' | 'employee' | 'type' | 'field' | 'from' | 'to';

const defaultColumnWidths: Record<ChangeSortKey, number> = {
  date: 160,
  employee: 160,
  type: 140,
  field: 120,
  from: 120,
  to: 120,
};

export default function EmployeeChangesPanel() {
  const getRecentChanges = useEmployeeChangesStore((s) => s.getRecentChanges);

  const [days, setDays] = React.useState(30);
  const [q, setQ] = React.useState('');
  const [sortKey, setSortKey] = React.useState<ChangeSortKey>('date');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [viewing, setViewing] = React.useState<EmployeeChange | null>(null);
  const cols = useResizableColumns<ChangeSortKey>(defaultColumnWidths);

  const recent = React.useMemo(() => {
    const rows = getRecentChanges(days).filter((c) => (c.employeeName || '').toLowerCase().includes(q.toLowerCase()));
    const value = (c: (typeof rows)[number]): string | number => {
      switch (sortKey) {
        case 'date': return new Date(c.timestamp).getTime();
        case 'employee': return (c.employeeName || c.employeeId || '').toLowerCase();
        case 'type': return c.type || '';
        case 'field': return c.field || '';
        case 'from': return String(c.previousValue ?? '');
        case 'to': return String(c.newValue ?? '');
        default: return '';
      }
    };
    const sorted = [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [getRecentChanges, days, q, sortKey, sortDir]);

  const { page, setPage, pages, paged } = useDeskPagination(recent, [days, q, sortKey, sortDir]);

  const onSort = (key: ChangeSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const column = (key: ChangeSortKey, label: string) => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const colorFor = (
    type: string
  ): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' => {
    switch (type) {
      case 'promotion':
      case 'salary_change':
        return 'success';
      case 'transfer':
      case 'department_change':
      case 'position_change':
        return 'primary';
      case 'status_change':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Employee Changes</div>
          <div className="flex items-center gap-2">
            <Input size="sm" placeholder="Filter by name" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-56" />
            <Select size="sm" selectedKeys={[String(days)]} onSelectionChange={(k) => setDays(parseInt(Array.from(k)[0] as string, 10))} className="w-32" variant="bordered" aria-label="Period">
              <SelectItem key="7">7 days</SelectItem>
              <SelectItem key="14">14 days</SelectItem>
              <SelectItem key="30">30 days</SelectItem>
              <SelectItem key="60">60 days</SelectItem>
              <SelectItem key="90">90 days</SelectItem>
            </Select>
          </div>
        </CardHeader>
        <CardBody>
          <div ref={cols.frameRef} style={cols.frameStyle}>
          <Table
            aria-label="employee-changes"
            removeWrapper
            classNames={{
              ...unifiedTableClassNames,
              table: 'table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none',
              th: `${unifiedTableClassNames.th} relative`,
              td: `${unifiedTableClassNames.td} overflow-hidden`,
            }}
          >
            <TableHeader>
              {column('date', 'Date')}
              {column('employee', 'Employee')}
              {column('type', 'Type')}
              {column('field', 'Field')}
              {column('from', 'From')}
              {column('to', 'To')}
            </TableHeader>
            <TableBody emptyContent="No employee changes in this period.">
              {paged.map((c) => (
                <TableRow
                  key={c.id}
                  className={rowClassNames(viewing?.id === c.id)}
                  onClick={() => setViewing(c)}
                >
                  <TableCell className="text-gray-600">{new Date(c.timestamp).toLocaleString()}</TableCell>
                  <TableCell className="font-semibold text-ghana-black">
                    <span className="block truncate" title={c.employeeName || c.employeeId}>{c.employeeName || c.employeeId}</span>
                  </TableCell>
                  <TableCell><Chip size="sm" variant="flat" color={colorFor(c.type)}>{c.type}</Chip></TableCell>
                  <TableCell>
                    <span className="block truncate" title={c.field || '-'}>{c.field || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block truncate" title={String(c.previousValue ?? '-')}>{String(c.previousValue ?? '-')}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block truncate" title={String(c.newValue ?? '-')}>{String(c.newValue ?? '-')}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={!!viewing} onOpenChange={(open) => !open && setViewing(null)} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Change detail</ModalHeader>
              <ModalBody>
                {viewing && (
                  <DetailGrid>
                    <DetailField label="Date" value={new Date(viewing.timestamp).toLocaleString()} />
                    <DetailField label="Employee" value={viewing.employeeName || viewing.employeeId} />
                    <DetailField
                      label="Type"
                      value={<Chip size="sm" variant="flat" color={colorFor(viewing.type)}>{viewing.type}</Chip>}
                    />
                    <DetailField label="Field" value={viewing.field || '—'} />
                    <DetailField label="From" value={String(viewing.previousValue ?? '—')} />
                    <DetailField label="To" value={String(viewing.newValue ?? '—')} />
                    <DetailField label="Changed by" value={viewing.changedBy || '—'} />
                    <DetailField label="Notes" value={viewing.notes || '—'} full />
                  </DetailGrid>
                )}
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setViewing(null)}>Close</Button>
                {viewing && (
                  <Button
                    variant="bordered"
                    onPress={() => printDetailSheet('Change detail', [
                      { label: 'Date', value: new Date(viewing.timestamp).toLocaleString() },
                      { label: 'Employee', value: viewing.employeeName || viewing.employeeId },
                      { label: 'Type', value: viewing.type },
                      { label: 'Field', value: viewing.field || '—' },
                      { label: 'From', value: String(viewing.previousValue ?? '—') },
                      { label: 'To', value: String(viewing.newValue ?? '—') },
                      { label: 'Changed by', value: viewing.changedBy || '—' },
                      { label: 'Notes', value: viewing.notes || '—' },
                    ])}
                  >
                    Print
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
