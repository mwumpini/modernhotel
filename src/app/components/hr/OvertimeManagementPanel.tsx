'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardBody, CardHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip, Select, SelectItem, Button, Input } from '@heroui/react';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useSettingsStore } from '@/app/lib/settings/store';

export default function OvertimeManagementPanel() {
  const { data: session } = useSession();
  const approverName = (session?.user as any)?.name || (session?.user as any)?.email || 'HR Manager';

  const attendances = useLeaveAttendanceStore((s) => s.attendances);
  const employees = useEmployeeStore((s) => s.employees);
  const updateOvertimeHours = useLeaveAttendanceStore((s) => s.updateOvertimeHours);
  const approveOvertime = useLeaveAttendanceStore((s) => s.approveOvertime);
  const logManualOvertime = useLeaveAttendanceStore((s) => s.logManualOvertime);

  // An overtime entry at/above this many hours needs director sign-off (see
  // Settings > Approvals) — Payroll/HR can still click Approve, but the server
  // silently won't apply it unless they also hold hr.approve-overtime.
  const requireDirectorApproval = useSettingsStore((s) => s.financialSettings.requireApprovalForOvertime);
  const directorThreshold = useSettingsStore((s) => s.financialSettings.overtimeApprovalThreshold);
  const canApproveAsDirector = useSettingsStore((s) => s.hasPermission('hr.approve-overtime'));
  const canLogOvertime = useSettingsStore((s) => s.hasPermission('hr.log-overtime'));
  const needsDirector = (hours: number) => requireDirectorApproval && hours >= directorThreshold;

  const [filter, setFilter] = React.useState<'all' | 'pending' | 'approved'>('all');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [approvingId, setApprovingId] = React.useState<string | null>(null);

  const [showManualForm, setShowManualForm] = React.useState(false);
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
    if (mins <= 0) mins += 24 * 60; // overnight shift
    return mins / 60;
  }, [manualStartTime, manualEndTime]);

  const rows = attendances
    .filter((a) => (a.overtimeHours || 0) > 0)
    .filter((a) => {
      if (filter === 'pending') return !a.approvedAt;
      if (filter === 'approved') return !!a.approvedAt;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSaveEdit = (id: string) => {
    const hours = parseFloat(editValue);
    if (!isNaN(hours)) updateOvertimeHours(id, hours);
    setEditingId(null);
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
    setManualEmployeeId('');
    setManualStartTime('');
    setManualEndTime('');
    setManualNotes('');
    setShowManualForm(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Overtime Management</div>
          <div className="flex items-center gap-2">
            <Select size="sm" selectedKeys={[filter]} onSelectionChange={(k) => setFilter(Array.from(k)[0] as any)} className="w-40" variant="bordered">
              <SelectItem key="all">All</SelectItem>
              <SelectItem key="pending">Pending Approval</SelectItem>
              <SelectItem key="approved">Approved</SelectItem>
            </Select>
            {canLogOvertime && (
              <Button size="sm" color="primary" variant="flat" onPress={() => setShowManualForm((v) => !v)}>
                + Log Overtime
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {showManualForm && (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-4 p-3 border border-gray-200 rounded-lg">
              <Select label="Employee" selectedKeys={manualEmployeeId ? [manualEmployeeId] : []} onSelectionChange={(k) => setManualEmployeeId(Array.from(k)[0] as string)} variant="bordered" className="md:col-span-2">
                {employees.map((e) => (
                  <SelectItem key={e.id}>{e.firstName} {e.lastName}</SelectItem>
                ))}
              </Select>
              <Input label="Date" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} variant="bordered" />
              <Input label="Start Time" type="time" value={manualStartTime} onChange={(e) => setManualStartTime(e.target.value)} variant="bordered" />
              <Input label="End Time" type="time" value={manualEndTime} onChange={(e) => setManualEndTime(e.target.value)} variant="bordered" />
              <Input label="Notes (optional)" value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} variant="bordered" />
              {manualPreviewHours !== null && (
                <p className="md:col-span-6 text-sm text-gray-600">= {manualPreviewHours.toFixed(2)} hour{manualPreviewHours === 1 ? '' : 's'}{manualPreviewHours > 12 ? ' (crosses midnight)' : ''}</p>
              )}
              <div className="md:col-span-6 flex justify-end gap-2">
                <Button size="sm" variant="light" onPress={() => setShowManualForm(false)}>Cancel</Button>
                <Button size="sm" color="primary" onPress={handleLogManual} isDisabled={!manualEmployeeId || !manualStartTime || !manualEndTime}>Save</Button>
              </div>
            </div>
          )}
          <Table aria-label="overtime">
            <TableHeader>
              <TableColumn>EMPLOYEE</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>HOURS</TableColumn>
              <TableColumn>OVERTIME</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No overtime recorded">
              {rows.map((a) => {
                const emp = employees.find(e => e.id === a.employeeId);
                const name = emp ? `${emp.firstName} ${emp.lastName}` : a.employeeId;
                const isApproved = !!a.approvedAt;
                const isEditing = editingId === a.id;
                const escalated = !isApproved && needsDirector(a.overtimeHours || 0);
                return (
                  <TableRow key={a.id}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                    <TableCell>{(a.totalHours || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          size="sm"
                          type="number"
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(a.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(a.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="w-24"
                        />
                      ) : (
                        <span
                          className={isApproved ? '' : 'cursor-pointer underline decoration-dotted'}
                          onClick={() => { if (!isApproved) { setEditingId(a.id); setEditValue(String(a.overtimeHours || 0)); } }}
                          title={isApproved ? undefined : 'Click to adjust'}
                        >
                          {(a.overtimeHours || 0).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isApproved ? (
                        <Chip size="sm" variant="flat" color="success">
                          Approved by {a.approvedBy}
                        </Chip>
                      ) : escalated ? (
                        <Chip size="sm" variant="flat" color="danger">Needs Director Approval</Chip>
                      ) : (
                        <Chip size="sm" variant="flat" color="warning">Pending</Chip>
                      )}
                    </TableCell>
                    <TableCell>
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
        </CardBody>
      </Card>
    </div>
  );
}
