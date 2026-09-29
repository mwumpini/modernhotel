'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import {
  Card, CardBody, CardHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip, Select, SelectItem,
  Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Pagination,
} from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useSettingsStore } from '@/app/lib/settings/store';
import { formatMoney } from '@/app/lib/format/currency';
import { printDetailSheet } from '@/app/lib/print/simpleReport';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailGrid, DetailField } from '../frontoffice/detailView';
import { useDeskPagination } from '../dashboard/deskTableUi';

type OvertimeSortKey = 'timesheet' | 'employee' | 'date' | 'start' | 'end' | 'hours' | 'overtime' | 'status';

const defaultColumnWidths: Record<OvertimeSortKey, number> = {
  timesheet: 120,
  employee: 160,
  date: 110,
  start: 80,
  end: 80,
  hours: 88,
  overtime: 96,
  status: 160,
};

const fmtHours = (n: number) => formatMoney(Number(n || 0));
const fmtTime = (d?: Date | string) => (d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '—');

export default function OvertimeManagementPanel() {
  const { data: session } = useSession();
  const approverName = (session?.user as { name?: string; email?: string })?.name || (session?.user as { name?: string; email?: string })?.email || 'HR Manager';

  const attendances = useLeaveAttendanceStore((s) => s.attendances);
  const employees = useEmployeeStore((s) => s.employees);
  const updateOvertimeHours = useLeaveAttendanceStore((s) => s.updateOvertimeHours);
  const approveOvertime = useLeaveAttendanceStore((s) => s.approveOvertime);
  const logManualOvertime = useLeaveAttendanceStore((s) => s.logManualOvertime);

  const requireDirectorApproval = useSettingsStore((s) => s.financialSettings.requireApprovalForOvertime);
  const directorThreshold = useSettingsStore((s) => s.financialSettings.overtimeApprovalThreshold);
  const canApproveAsDirector = useSettingsStore((s) => s.hasPermission('hr.approve-overtime'));
  const canLogOvertime = useSettingsStore((s) => s.hasPermission('hr.log-overtime'));
  const needsDirector = (hours: number) => requireDirectorApproval && hours >= directorThreshold;

  const [filter, setFilter] = React.useState<'all' | 'pending' | 'approved'>('all');
  const [q, setQ] = React.useState('');
  const [sortKey, setSortKey] = React.useState<OvertimeSortKey>('date');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const cols = useResizableColumns<OvertimeSortKey>(defaultColumnWidths);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [viewing, setViewing] = React.useState<(typeof attendances)[number] | null>(null);

  const [logOpen, setLogOpen] = React.useState(false);
  const [manualEmployeeId, setManualEmployeeId] = React.useState('');
  const [manualDate, setManualDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [manualStartTime, setManualStartTime] = React.useState('');
  const [manualEndTime, setManualEndTime] = React.useState('');
  const [manualNotes, setManualNotes] = React.useState('');

  const manualPreviewHours = React.useMemo(() => {
    if (!manualStartTime || !manualEndTime) return null;
    const [sh, sm] = manualStartTime.split(':').map(Number);
    const [eh, em] = manualEndTime.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    return mins / 60;
  }, [manualStartTime, manualEndTime]);

  const rows = React.useMemo(() => {
    const filtered = attendances
      .filter((a) => (a.overtimeHours || 0) > 0)
      .filter((a) => {
        if (filter === 'pending') return !a.approvedAt;
        if (filter === 'approved') return !!a.approvedAt;
        return true;
      })
      .filter((a) => {
        if (!q.trim()) return true;
        const emp = employees.find((e) => e.id === a.employeeId);
        const name = emp ? `${emp.firstName} ${emp.lastName}` : a.employeeId;
        const needle = q.trim().toLowerCase();
        return name.toLowerCase().includes(needle) || a.id.toLowerCase().includes(needle);
      });

    const value = (a: (typeof filtered)[number]): string | number => {
      const emp = employees.find((e) => e.id === a.employeeId);
      const name = emp ? `${emp.firstName} ${emp.lastName}` : a.employeeId;
      switch (sortKey) {
        case 'timesheet': return a.id;
        case 'employee': return name.toLowerCase();
        case 'date': return new Date(a.date).getTime();
        case 'start': return a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        case 'end': return a.checkOutTime ? new Date(a.checkOutTime).getTime() : 0;
        case 'hours': return Number(a.totalHours || 0);
        case 'overtime': return Number(a.overtimeHours || 0);
        case 'status': return a.approvedAt ? 'approved' : 'pending';
        default: return '';
      }
    };

    const sorted = [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [attendances, filter, q, sortKey, sortDir, employees]);

  const { page, setPage, pages, paged } = useDeskPagination(rows, [q, filter, sortKey, sortDir]);

  const nameOf = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : id;
  };

  const statusLabel = (a: (typeof attendances)[number]) => {
    if (a.approvedAt) return `Approved by ${a.approvedBy}`;
    if (needsDirector(a.overtimeHours || 0)) return 'Needs director approval';
    return 'Pending';
  };

  const handleSaveEdit = (id: string) => {
    const hours = parseFloat(editValue);
    if (!isNaN(hours)) updateOvertimeHours(id, hours);
    setEditingId(null);
  };

  const openLogForm = () => {
    setManualEmployeeId(employees.find((e) => e.status === 'active')?.id || employees[0]?.id || '');
    setManualDate(new Date().toISOString().slice(0, 10));
    setManualStartTime('');
    setManualEndTime('');
    setManualNotes('');
    setLogOpen(true);
  };

  const handleLogManual = () => {
    if (!manualEmployeeId || !manualStartTime || !manualEndTime || !manualPreviewHours || manualPreviewHours <= 0) return;
    logManualOvertime(
      manualEmployeeId,
      new Date(`${manualDate}T00:00:00`),
      new Date(`${manualDate}T${manualStartTime}:00`),
      new Date(`${manualDate}T${manualEndTime}:00`),
      manualNotes || undefined
    );
    setLogOpen(false);
    setManualEmployeeId('');
    setManualStartTime('');
    setManualEndTime('');
    setManualNotes('');
  };

  const onSort = (key: OvertimeSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const column = (key: OvertimeSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  return (
    <>
      <Card>
        <CardHeader className="justify-between gap-2 flex-wrap">
          <div className="font-medium">Overtime management</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input size="sm" placeholder="Search employee or timesheet" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-52" />
            <Select size="sm" selectedKeys={[filter]} onSelectionChange={(k) => setFilter(Array.from(k)[0] as typeof filter)} className="w-40" variant="bordered" aria-label="Status">
              <SelectItem key="all">All</SelectItem>
              <SelectItem key="pending">Pending approval</SelectItem>
              <SelectItem key="approved">Approved</SelectItem>
            </Select>
            {canLogOvertime && (
              <Button color="primary" onPress={openLogForm}>+ Log overtime</Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          <div ref={cols.frameRef} style={cols.frameStyle}>
          <Table aria-label="overtime" removeWrapper classNames={deskResizableTableClassNames()}>
            <TableHeader>
              {column('timesheet', 'Timesheet')}
              {column('employee', 'Employee')}
              {column('date', 'Date')}
              {column('start', 'Start')}
              {column('end', 'End')}
              {column('hours', 'Hours', 'right')}
              {column('overtime', 'Overtime', 'right')}
              {column('status', 'Status')}
              <TableColumn className="relative w-[140px] min-w-[140px]">Actions</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No overtime recorded">
              {paged.map((a) => {
                const name = nameOf(a.employeeId);
                const isApproved = !!a.approvedAt;
                const isEditing = editingId === a.id;
                const escalated = !isApproved && needsDirector(a.overtimeHours || 0);
                return (
                  <TableRow key={a.id} className={rowClassNames(viewing?.id === a.id)} onClick={() => setViewing(a)}>
                    <TableCell className="font-mono text-xs">
                      <span className="block truncate" title={a.id}>{a.id}</span>
                    </TableCell>
                    <TableCell className="font-semibold text-ghana-black">
                      <span className="block truncate" title={name}>{name}</span>
                    </TableCell>
                    <TableCell>{new Date(a.date).toLocaleDateString('en-GB')}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{fmtTime(a.checkInTime)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{fmtTime(a.checkOutTime)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(a.totalHours || 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isEditing ? (
                        <Input
                          size="sm"
                          type="number"
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(a.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(a.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="w-24 ml-auto"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={isApproved ? '' : 'cursor-pointer underline decoration-dotted'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isApproved) { setEditingId(a.id); setEditValue(String(a.overtimeHours || 0)); }
                          }}
                          title={isApproved ? undefined : 'Click to adjust'}
                        >
                          {fmtHours(a.overtimeHours || 0)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isApproved ? (
                        <Chip size="sm" variant="flat" color="success">
                          Approved by {a.approvedBy}
                        </Chip>
                      ) : escalated ? (
                        <Chip size="sm" variant="flat" color="danger">Needs director approval</Chip>
                      ) : (
                        <Chip size="sm" variant="flat" color="warning">Pending</Chip>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {!isApproved && (escalated && !canApproveAsDirector ? (
                        <span className="text-xs text-gray-500">Awaiting director sign-off</span>
                      ) : (
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          isLoading={approvingId === a.id}
                          onPress={async () => {
                            setApprovingId(a.id);
                            await approveOvertime(a.id, approverName);
                            setApprovingId(null);
                          }}
                        >
                          Approve
                        </Button>
                      ))}
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

      <Modal isOpen={!!viewing} onOpenChange={(open) => !open && setViewing(null)} size="lg">
        <ModalContent>
          {() => {
            if (!viewing) return null;
            const isApproved = !!viewing.approvedAt;
            const escalated = !isApproved && needsDirector(viewing.overtimeHours || 0);
            return (
              <>
                <ModalHeader>Overtime record</ModalHeader>
                <ModalBody>
                  <DetailGrid>
                    <DetailField label="Timesheet" value={viewing.id} />
                    <DetailField label="Employee" value={nameOf(viewing.employeeId)} />
                    <DetailField label="Date" value={new Date(viewing.date).toLocaleDateString('en-GB')} />
                    <DetailField label="Start" value={fmtTime(viewing.checkInTime)} />
                    <DetailField label="End" value={fmtTime(viewing.checkOutTime)} />
                    <DetailField label="Hours" value={fmtHours(viewing.totalHours || 0)} />
                    <DetailField label="Overtime" value={fmtHours(viewing.overtimeHours || 0)} />
                    <DetailField label="Status" value={statusLabel(viewing)} />
                  </DetailGrid>
                </ModalBody>
                <ModalFooter className="flex flex-wrap justify-between gap-2">
                  <Button variant="flat" onPress={() => setViewing(null)}>Close</Button>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="bordered"
                      onPress={() => printDetailSheet('Overtime record', [
                        { label: 'Timesheet', value: viewing.id },
                        { label: 'Employee', value: nameOf(viewing.employeeId) },
                        { label: 'Date', value: new Date(viewing.date).toLocaleDateString('en-GB') },
                        { label: 'Start', value: fmtTime(viewing.checkInTime) },
                        { label: 'End', value: fmtTime(viewing.checkOutTime) },
                        { label: 'Hours', value: fmtHours(viewing.totalHours || 0) },
                        { label: 'Overtime', value: fmtHours(viewing.overtimeHours || 0) },
                        { label: 'Status', value: statusLabel(viewing) },
                      ])}
                    >
                      Print
                    </Button>
                    {!isApproved && !(escalated && !canApproveAsDirector) && (
                      <Button
                        color="primary"
                        isLoading={approvingId === viewing.id}
                        onPress={async () => {
                          setApprovingId(viewing.id);
                          await approveOvertime(viewing.id, approverName);
                          setApprovingId(null);
                          setViewing(null);
                        }}
                      >
                        Approve
                      </Button>
                    )}
                  </div>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>

      <Modal isOpen={logOpen} onOpenChange={setLogOpen} size="3xl" scrollBehavior="inside">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Log overtime</ModalHeader>
              <ModalBody className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select
                    className="md:col-span-2"
                    label="Employee"
                    selectedKeys={manualEmployeeId ? [manualEmployeeId] : []}
                    onSelectionChange={(k) => setManualEmployeeId((Array.from(k)[0] as string) || '')}
                    variant="bordered"
                  >
                    {employees.map((e) => (
                      <SelectItem key={e.id} textValue={`${e.firstName} ${e.lastName}`}>{e.firstName} {e.lastName}</SelectItem>
                    ))}
                  </Select>
                  <Input label="Date" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} variant="bordered" />
                  <Input label="Notes (optional)" value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} variant="bordered" />
                  <Input label="Start time" type="time" value={manualStartTime} onChange={(e) => setManualStartTime(e.target.value)} variant="bordered" />
                  <Input label="End time" type="time" value={manualEndTime} onChange={(e) => setManualEndTime(e.target.value)} variant="bordered" />
                </div>
                {manualPreviewHours !== null && (
                  <p className="text-sm text-gray-600">
                    = {fmtHours(manualPreviewHours)} hour{manualPreviewHours === 1 ? '' : 's'}
                    {manualPreviewHours > 12 ? ' (crosses midnight)' : ''}
                  </p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setLogOpen(false)}>Cancel</Button>
                <Button
                  color="primary"
                  onPress={handleLogManual}
                  isDisabled={!manualEmployeeId || !manualStartTime || !manualEndTime || !manualPreviewHours || manualPreviewHours <= 0}
                >
                  Save
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
