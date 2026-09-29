'use client';

import React from 'react';
import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@heroui/react';
import type { Employee } from '@/app/lib/hr/models';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useEmployeeChangesStore } from '@/app/lib/hr/employeeChangesStore';
import { useSettingsStore } from '@/app/lib/settings/store';
import { downloadEmployeeProfilePdf } from '@/app/lib/hr/employeeProfilePdf';
import { formatGhs } from '@/app/lib/format/currency';
import { useStaffDebtStore } from '@/app/lib/hr/staffDebtStore';
import { DetailGrid, DetailField } from '../frontoffice/detailView';

function money(n?: number | null) {
  return formatGhs(n);
}

function pretty(value?: string | null) {
  if (!value) return '—';
  return String(value).replace(/_/g, ' ');
}

function day(value?: Date | string | null) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Read-only staff profile opened by row-click on HR employee tables.
 * Edit / Print PDF / Terminate (and any extra actions) live in the footer.
 */
export default function EmployeeProfileModal({
  employee,
  isOpen,
  onClose,
  onEdit,
  extraActions,
}: {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (employee: Employee) => void;
  extraActions?: React.ReactNode;
}) {
  const getDepartment = useEmployeeStore((s) => s.getDepartment);
  const getPosition = useEmployeeStore((s) => s.getPosition);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);
  const employees = useEmployeeStore((s) => s.employees);
  const logChange = useEmployeeChangesStore((s) => s.logChange);
  const hotelName = useSettingsStore((s) => s.hotelSettings?.hotelName || 'Hotel');
  const owedByEmployee = useStaffDebtStore((s) => s.owedByEmployee);

  const [printing, setPrinting] = React.useState(false);
  const [confirmTerminate, setConfirmTerminate] = React.useState(false);
  const [effectiveDate, setEffectiveDate] = React.useState(todayIso());
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Keep confirm form fresh each time the profile opens / switches employee.
  React.useEffect(() => {
    if (!isOpen) {
      setConfirmTerminate(false);
      setReason('');
      setEffectiveDate(todayIso());
      setSaving(false);
    }
  }, [isOpen, employee?.id]);

  const printPdf = async () => {
    if (!employee || printing) return;
    setPrinting(true);
    try {
      const dept = getDepartment(employee.departmentId);
      const pos = getPosition(employee.positionId);
      const manager = employee.managerId ? employees.find((e) => e.id === employee.managerId) : undefined;
      await downloadEmployeeProfilePdf({
        employee,
        departmentName: dept?.name,
        positionTitle: pos?.title,
        managerName: manager ? `${manager.firstName} ${manager.lastName}` : undefined,
        hotelName,
      });
    } catch (err) {
      console.error('[HR] Staff profile PDF failed', err);
      alert('Could not generate the PDF. Please try again.');
    } finally {
      setPrinting(false);
    }
  };

  const confirmTermination = () => {
    if (!employee || saving) return;
    if (!effectiveDate) {
      alert('Please choose an effective date.');
      return;
    }
    setSaving(true);
    try {
      const prevStatus = employee.status;
      updateEmployee(employee.id, {
        status: 'terminated',
        terminationDate: new Date(effectiveDate),
      });
      logChange({
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        type: 'status_change',
        field: 'status',
        previousValue: prevStatus,
        newValue: 'terminated',
        notes: reason.trim()
          ? `Terminated effective ${effectiveDate}. ${reason.trim()}`
          : `Terminated effective ${effectiveDate}.`,
        timestamp: new Date(),
      });
      setConfirmTerminate(false);
      setReason('');
    } finally {
      setSaving(false);
    }
  };

  const reactivate = () => {
    if (!employee || saving || employee.status !== 'terminated') return;
    setSaving(true);
    try {
      updateEmployee(employee.id, {
        status: 'active',
        terminationDate: undefined,
      });
      logChange({
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        type: 'status_change',
        field: 'status',
        previousValue: 'terminated',
        newValue: 'active',
        notes: 'Reactivated from terminated status.',
        timestamp: new Date(),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!employee) {
    return (
      <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Staff profile</ModalHeader>
          <ModalBody><p className="text-sm text-gray-500">Employee not found.</p></ModalBody>
          <ModalFooter><Button variant="flat" onPress={onClose}>Close</Button></ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  // Prefer live store row so Terminate / Reactivate reflect immediately in this modal.
  const live = employees.find((e) => e.id === employee.id) || employee;
  const dept = getDepartment(live.departmentId);
  const pos = getPosition(live.positionId);
  const manager = live.managerId ? employees.find((e) => e.id === live.managerId) : undefined;
  const fullName = `${live.firstName} ${live.lastName}`.trim();
  const isTerminated = live.status === 'terminated';
  const owed = owedByEmployee(live.id);
  const statusColor =
    live.status === 'active' ? 'success' : live.status === 'on_leave' ? 'warning' : live.status === 'terminated' || live.status === 'suspended' ? 'danger' : 'default';

  return (
    <>
      <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="3xl" scrollBehavior="inside">
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span>Staff profile</span>
                <span className="text-sm font-normal text-gray-500">{live.employeeNumber}</span>
              </ModalHeader>
              <ModalBody className="space-y-6">
                <div className="flex items-start gap-4">
                  {live.photo ? (
                    <img
                      src={live.photo}
                      alt={fullName}
                      className="h-20 w-20 shrink-0 rounded-lg object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-lg font-semibold text-gray-400">
                      {(live.firstName?.[0] || '').toUpperCase()}
                      {(live.lastName?.[0] || '').toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-xl font-semibold text-ghana-black truncate" title={fullName}>{fullName}</h3>
                    <p className="text-sm text-gray-600 truncate">{pos?.title || '—'} · {dept?.name || '—'}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip size="sm" variant="flat" color={statusColor as any}>{pretty(live.status)}</Chip>
                      {owed > 0 && <Chip size="sm" variant="flat" color="warning">Owes {formatGhs(owed)}</Chip>}
                      {isTerminated && (
                        <span className="text-xs text-gray-500">Effective {day(live.terminationDate)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <section>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Personal</h4>
                  <DetailGrid>
                    <DetailField label="Email" value={live.email} />
                    <DetailField label="Phone" value={live.phone} />
                    <DetailField label="Date of birth" value={day(live.dateOfBirth)} />
                    <DetailField label="Gender" value={pretty(live.gender)} />
                    <DetailField label="Nationality" value={live.nationality} />
                    <DetailField label="Marital status" value={pretty(live.maritalStatus)} />
                  </DetailGrid>
                </section>

                <section>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Employment</h4>
                  <DetailGrid>
                    <DetailField label="Hire date" value={day(live.hireDate)} />
                    <DetailField label="Termination date" value={day(live.terminationDate)} />
                    <DetailField label="Department" value={dept?.name} />
                    <DetailField label="Position" value={pos?.title} />
                    <DetailField label="Manager" value={manager ? `${manager.firstName} ${manager.lastName}` : '—'} />
                    <DetailField label="Employment type" value={pretty(live.employmentType)} />
                    <DetailField label="Work location" value={live.workLocation} />
                    <DetailField label="Residency" value={pretty(live.residencyStatus)} />
                    <DetailField label="Class" value={pretty(live.employmentClass)} />
                    <DetailField label="Second employment" value={live.secondEmployment ? 'Yes' : 'No'} />
                    <DetailField label="Contract end" value={day(live.contractEndDate)} />
                  </DetailGrid>
                </section>

                <section>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Compensation</h4>
                  <DetailGrid>
                    <DetailField label="Type" value={pretty(live.compensationType || (live.hourlyRate ? 'hourly' : 'monthly'))} />
                    <DetailField label="Basic salary" value={money(live.basicSalary ?? live.salary)} />
                    <DetailField label="Allowances" value={money(live.allowances)} />
                    <DetailField label="Hourly rate" value={live.hourlyRate != null ? money(live.hourlyRate) : '—'} />
                    <DetailField label="Payment frequency" value={pretty(live.paymentFrequency)} />
                    <DetailField label="Vehicle benefit" value={money(live.vehicleBenefit)} />
                    <DetailField label="Housing benefit" value={money(live.housingBenefit)} />
                    <DetailField label="Other non-cash" value={money(live.otherNonCashBenefits)} />
                    {owed > 0 && <DetailField label="Owes hotel" value={formatGhs(owed)} />}
                  </DetailGrid>
                </section>

                <section>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">IDs & compliance</h4>
                  <DetailGrid>
                    <DetailField label="TIN" value={live.taxWithholding?.tin} />
                    <DetailField label="National ID" value={live.governmentIds?.nationalId} />
                    <DetailField label="Ghana Card" value={live.ghanaCardNumber} />
                    <DetailField label="SSNIT number" value={live.ssnitNumber} />
                    <DetailField label="SSNIT (Tier 1)" value={live.ssnitEnrolled ? 'Enrolled' : 'Not enrolled'} />
                    <DetailField label="Tier 2" value={live.tier2Enrolled ? 'Enrolled' : 'Not enrolled'} />
                    <DetailField label="Tier 3" value={live.tier3Enrolled ? `Enrolled (${live.tier3ContributionPct ?? 0}%)` : 'Not enrolled'} />
                    <DetailField label="Work permit expiry" value={day(live.workPermitExpiryDate)} />
                  </DetailGrid>
                </section>

                <section>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Contact & bank</h4>
                  <DetailGrid>
                    <DetailField
                      label="Address"
                      full
                      value={[live.address?.street, live.address?.city, live.address?.state, live.address?.postalCode, live.address?.country].filter(Boolean).join(', ') || '—'}
                    />
                    <DetailField label="Emergency contact" value={live.emergencyContact?.name ? `${live.emergencyContact.name} (${pretty(live.emergencyContact.relationship)}) · ${live.emergencyContact.phone}` : '—'} full />
                    <DetailField label="Next of kin" value={live.nextOfKin?.name ? `${live.nextOfKin.name} (${pretty(live.nextOfKin.relationship)}) · ${live.nextOfKin.phone}` : '—'} full />
                    <DetailField label="Bank" value={live.bankAccount?.bankName} />
                    <DetailField label="Account" value={live.bankAccount?.accountNumber} />
                    <DetailField label="Branch" value={live.bankAccount?.branchCode} />
                  </DetailGrid>
                </section>

                {live.notes ? (
                  <section>
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</h4>
                    <DetailGrid>
                      <DetailField label="Notes" value={live.notes} full />
                    </DetailGrid>
                  </section>
                ) : null}
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="flat" onPress={onClose}>Close</Button>
                  {isTerminated ? (
                    <Button color="success" variant="flat" isLoading={saving} onPress={reactivate}>
                      Reactivate
                    </Button>
                  ) : (
                    <Button color="danger" variant="flat" onPress={() => setConfirmTerminate(true)}>
                      Terminate
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {extraActions}
                  <Button variant="bordered" isLoading={printing} onPress={() => { void printPdf(); }}>
                    Print PDF
                  </Button>
                  {onEdit && (
                    <Button color="primary" onPress={() => onEdit(live)}>
                      Edit
                    </Button>
                  )}
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={confirmTerminate} onOpenChange={setConfirmTerminate} size="md">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Terminate {fullName}?</ModalHeader>
              <ModalBody className="space-y-3">
                <p className="text-sm text-gray-600">
                  This keeps the staff record for payroll and audit history. They will drop out of active
                  rosters (leave, shifts, time) until reactivated.
                </p>
                <Input
                  type="date"
                  label="Effective date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  variant="bordered"
                  isRequired
                />
                <Textarea
                  label="Reason (optional)"
                  placeholder="e.g. End of contract, resignation, redundancy…"
                  value={reason}
                  onValueChange={setReason}
                  variant="bordered"
                  minRows={3}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setConfirmTerminate(false)}>Cancel</Button>
                <Button color="danger" isLoading={saving} onPress={confirmTermination}>
                  Confirm terminate
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
