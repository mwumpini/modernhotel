'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Progress, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useOnboardingStore } from '@/app/lib/hr/onboardingStore';
import { SortLabel, unifiedTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';
import EmployeeProfileModal from './EmployeeProfileModal';

type HireSortKey = 'number' | 'name' | 'hired' | 'department' | 'position' | 'onboarding';

const defaultColumnWidths: Record<HireSortKey, number> = {
  number: 120,
  name: 160,
  hired: 110,
  department: 140,
  position: 140,
  onboarding: 160,
};

export default function NewHiresPanel() {
  const employees = useEmployeeStore((s) => s.employees);
  const getDepartment = useEmployeeStore((s) => s.getDepartment);
  const getPosition = useEmployeeStore((s) => s.getPosition);

  const checklists = useOnboardingStore((s) => s.checklists);
  const startOnboarding = useOnboardingStore((s) => s.startOnboarding);
  const toggleTask = useOnboardingStore((s) => s.toggleTask);

  const [days, setDays] = React.useState(30);
  const [q, setQ] = React.useState('');
  const [viewingId, setViewingId] = React.useState<string | null>(null);
  const [activeEmployeeId, setActiveEmployeeId] = React.useState<string | null>(null);
  const [sortKey, setSortKey] = React.useState<HireSortKey>('hired');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const cols = useResizableColumns<HireSortKey>(defaultColumnWidths);

  const hires = React.useMemo(() => {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = employees
      .filter((e) => new Date(e.hireDate).getTime() >= since)
      .filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(q.toLowerCase()) || e.employeeNumber.toLowerCase().includes(q.toLowerCase()));

    const value = (e: (typeof rows)[number]): string | number => {
      switch (sortKey) {
        case 'number': return e.employeeNumber || '';
        case 'name': return `${e.firstName} ${e.lastName}`.trim().toLowerCase();
        case 'hired': return new Date(e.hireDate).getTime();
        case 'department': return getDepartment(e.departmentId)?.name || '';
        case 'position': return getPosition(e.positionId)?.title || '';
        case 'onboarding': {
          const checklist = checklists[e.id];
          if (!checklist) return -1;
          const done = checklist.tasks.filter((t) => t.completed).length;
          return checklist.tasks.length ? done / checklist.tasks.length : 0;
        }
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
  }, [employees, days, q, sortKey, sortDir, getDepartment, getPosition, checklists]);

  const { page, setPage, pages, paged } = useDeskPagination(hires, [days, q, sortKey, sortDir]);

  const onSort = (key: HireSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const column = (key: HireSortKey, label: string) => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const openChecklist = (id: string) => {
    setViewingId(null);
    if (!checklists[id]) startOnboarding(id);
    setActiveEmployeeId(id);
  };

  const viewingEmployee = viewingId ? employees.find((e) => e.id === viewingId) || null : null;
  const viewingChecklist = viewingId ? checklists[viewingId] : undefined;
  const viewingDone = viewingChecklist ? viewingChecklist.tasks.filter((t) => t.completed).length : 0;
  const viewingTotal = viewingChecklist ? viewingChecklist.tasks.length : 0;
  const viewingComplete = !!(viewingChecklist && viewingDone === viewingTotal && viewingTotal > 0);

  const activeEmployee = activeEmployeeId ? employees.find((e) => e.id === activeEmployeeId) : undefined;
  const activeChecklist = activeEmployeeId ? checklists[activeEmployeeId] : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">New Hires</div>
          <div className="flex items-center gap-2">
            <Input size="sm" placeholder="Search name/number" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-56" />
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
            aria-label="new-hires"
            removeWrapper
            classNames={{
              ...unifiedTableClassNames,
              table: 'table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none',
              th: `${unifiedTableClassNames.th} relative`,
              td: `${unifiedTableClassNames.td} overflow-hidden`,
            }}
          >
            <TableHeader>
              {column('number', 'Number')}
              {column('name', 'Name')}
              {column('hired', 'Hired')}
              {column('department', 'Department')}
              {column('position', 'Position')}
              {column('onboarding', 'Onboarding')}
            </TableHeader>
            <TableBody emptyContent="No new hires in this period.">
              {paged.map((e) => {
                const dept = getDepartment(e.departmentId);
                const pos = getPosition(e.positionId);
                const checklist = checklists[e.id];
                const done = checklist ? checklist.tasks.filter((t) => t.completed).length : 0;
                const total = checklist ? checklist.tasks.length : 0;
                const complete = checklist && done === total && total > 0;
                return (
                  <TableRow
                    key={e.id}
                    className={rowClassNames(viewingId === e.id || activeEmployeeId === e.id)}
                    onClick={() => setViewingId(e.id)}
                  >
                    <TableCell className="text-gray-600">{e.employeeNumber}</TableCell>
                    <TableCell className="font-semibold text-ghana-black">
                      <span className="block truncate" title={`${e.firstName} ${e.lastName}`}>{e.firstName} {e.lastName}</span>
                    </TableCell>
                    <TableCell>{new Date(e.hireDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className="block truncate" title={dept?.name || '-'}>{dept?.name || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block truncate" title={pos?.title || '-'}>{pos?.title || '-'}</span>
                    </TableCell>
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <Button
                        size="sm"
                        color={complete ? 'success' : 'primary'}
                        variant={complete ? 'flat' : 'solid'}
                        onPress={() => openChecklist(e.id)}
                      >
                        {complete ? '✓ Onboarded' : checklist ? `Onboarding: ${done}/${total}` : 'Start Onboarding'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>

      <EmployeeProfileModal
        employee={viewingEmployee}
        isOpen={!!viewingId}
        onClose={() => setViewingId(null)}
        extraActions={
          viewingId ? (
            <Button
              color={viewingComplete ? 'success' : 'primary'}
              variant={viewingComplete ? 'flat' : 'solid'}
              onPress={() => openChecklist(viewingId)}
            >
              {viewingComplete ? '✓ Onboarded' : viewingChecklist ? `Onboarding: ${viewingDone}/${viewingTotal}` : 'Start Onboarding'}
            </Button>
          ) : null
        }
      />

      <Modal isOpen={!!activeEmployeeId} onOpenChange={(open) => !open && setActiveEmployeeId(null)} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                Onboarding — {activeEmployee ? `${activeEmployee.firstName} ${activeEmployee.lastName}` : ''}
              </ModalHeader>
              <ModalBody>
                {activeChecklist && (
                  <div className="space-y-4">
                    <Progress
                      aria-label="Onboarding progress"
                      value={activeChecklist.tasks.length ? (activeChecklist.tasks.filter((t) => t.completed).length / activeChecklist.tasks.length) * 100 : 0}
                      color={activeChecklist.tasks.every((t) => t.completed) ? 'success' : 'primary'}
                    />
                    <div className="space-y-2">
                      {activeChecklist.tasks.map((t) => (
                        <label key={t.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={t.completed}
                            onChange={() => toggleTask(activeChecklist.employeeId, t.key)}
                            className="w-4 h-4"
                          />
                          <span className={t.completed ? 'line-through text-gray-400' : ''}>{t.label}</span>
                          {t.completed && t.completedAt && (
                            <Chip size="sm" variant="flat" color="success" className="ml-auto">
                              {new Date(t.completedAt).toLocaleDateString()}
                            </Chip>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setActiveEmployeeId(null)}>Close</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
