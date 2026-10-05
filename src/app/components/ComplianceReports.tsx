'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure,
} from '@heroui/react';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { useFilingSnapshots } from '@/app/hooks/useFilingSnapshots';
import { getCountryDisplayName } from '@/app/lib/compliance/config';
import {
  dueDateLabel,
  formatDueDateForSchedule,
  getDaysUntilDueForSchedule,
  getNextDueDateForSchedule,
  scheduleInputFromRule as scheduleInput,
  toIsoDateLocal,
  type DueRule,
} from '@/app/lib/compliance/dueDates';
import { syncOpenSalesTaxFilings } from '@/app/lib/compliance/salesFilingSync';
import { getClientTenantSubdomain } from '@/app/lib/api/clientTenant';
import { normalizeTenantSubdomain } from '@/app/lib/api/tenantSubdomain';
import { worksheetTableClassNames } from './frontoffice/StayWorksheetTable';
import { deskBookTabsClassNames } from './dashboard/deskTabsUi';
import ComplianceHospitalityReference from './ComplianceHospitalityReference';
import type { ComplianceReport, ReportingRule } from '@/app/lib/models';

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function latestFilingForRule(reports: ComplianceReport[], rule: ReportingRule): ComplianceReport | undefined {
  return reports
    .filter((r) => r.countryCode === rule.countryCode && r.reportType === rule.reportType)
    .sort((a, b) => (b.period || '').localeCompare(a.period || ''))[0];
}

function filingHeaders(): HeadersInit {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  return { 'x-tenant-subdomain': sub, 'x-tenant-id': sub, 'Content-Type': 'application/json' };
}

type DueKind = DueRule['type'];

function dueKindOf(rule: ReportingRule): DueKind {
  const kind = rule.dueRule?.type as DueKind | undefined;
  if (kind) return kind;
  return 'dayOfFollowingMonth';
}

function buildDueRule(
  kind: DueKind,
  day: number,
  days: number,
  months: number,
  datesText: string,
): { rule: DueRule } | { error: string } {
  if (kind === 'lastWorkingDayOfNextMonth') return { rule: { type: 'lastWorkingDayOfNextMonth' } };
  if (kind === 'dayOfFollowingMonth') {
    if (day < 1 || day > 28) return { error: 'Use a day from 1 to 28.' };
    return { rule: { type: 'dayOfFollowingMonth', day } };
  }
  if (kind === 'daysAfterPeriodEnd') {
    if (days < 1) return { error: 'Enter how many days after the period ends.' };
    return { rule: { type: 'daysAfterPeriodEnd', days } };
  }
  if (kind === 'monthsAfterYearEnd') {
    if (months < 1) return { error: 'Enter how many months after the year ends.' };
    return { rule: { type: 'monthsAfterYearEnd', months } };
  }
  if (kind === 'quarterEndOfAccountingYear') return { rule: { type: 'quarterEndOfAccountingYear' } };
  const dates = datesText.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  if (!dates.length || dates.some((d) => !/^\d{2}-\d{2}$/.test(d))) {
    return { error: 'Dates look like 03-31, 06-30, 09-30, 12-31.' };
  }
  return { rule: { type: 'fixedCalendarDates', dates } };
}

function filingStatusChip(filing: ComplianceReport | undefined, daysUntilDue: number) {
  if (filing?.status === 'approved') return { label: 'Approved', color: 'success' as const };
  if (filing?.status === 'submitted') return { label: 'Submitted', color: 'primary' as const };
  if (filing?.status === 'pending') return { label: 'Pending', color: 'warning' as const };
  if (daysUntilDue <= 7) return { label: 'Due soon', color: 'danger' as const };
  if (daysUntilDue <= 14) return { label: 'Upcoming', color: 'warning' as const };
  return { label: 'Not started', color: 'default' as const };
}

function reportIcon(reportType: string) {
  switch (reportType) {
    case 'VAT':
      return '🧾';
    case 'NHIL':
      return '🏥';
    case 'GETFund':
      return '🎓';
    case 'Tourism':
      return '🏖️';
    case 'SSNIT':
      return '👥';
    case 'PAYE':
      return '💰';
    case 'WHT':
      return '📤';
    case 'CIT':
      return '🏢';
    case 'GSL':
      return '📈';
    case 'IncomeTax':
      return '📊';
    case 'Sales Tax':
      return '🛒';
    case 'Hotel Tax':
      return '🏨';
    default:
      return '📋';
  }
}

export default function ComplianceReports() {
  const country = useComplianceStore((s) => s.country);
  const reportingRulesAll = useComplianceStore((s) => s.reportingRules);
  const reports = useComplianceStore((s) => s.reports);
  const hydrateReportFilingsFromApi = useComplianceStore((s) => s.hydrateReportFilingsFromApi);
  const updateReportingRule = useComplianceStore((s) => s.updateReportingRule);
  const upsertReport = useComplianceStore((s) => s.upsertReport);
  const updateReport = useComplianceStore((s) => s.updateReport);

  useEffect(() => {
    void hydrateReportFilingsFromApi().then(() => {
      try {
        syncOpenSalesTaxFilings();
      } catch {
        // ledger may still be loading
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reportingRules = useMemo(
    () => reportingRulesAll.filter((r) => r.countryCode === country && r.isActive !== false),
    [reportingRulesAll, country]
  );
  const filingSnapshots = useFilingSnapshots();
  const [viewTab, setViewTab] = useState<'schedule' | 'reference'>('schedule');
  const [selectedRule, setSelectedRule] = useState<ReportingRule | null>(null);
  const [editFrequency, setEditFrequency] = useState<ReportingRule['frequency']>('Monthly');
  const [editDueKind, setEditDueKind] = useState<DueKind>('lastWorkingDayOfNextMonth');
  const [editDay, setEditDay] = useState('15');
  const [editDays, setEditDays] = useState('30');
  const [editMonths, setEditMonths] = useState('4');
  const [editDates, setEditDates] = useState('03-31, 06-30, 09-30, 12-31');
  const [editAmount, setEditAmount] = useState('');
  const [editStatus, setEditStatus] = useState<ComplianceReport['status']>('pending');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();

  const goPrepareFiling = () => {
    try {
      localStorage.setItem('accounting.tab', 'taxes');
      localStorage.setItem('nav.section', 'accounting');
      window.dispatchEvent(new CustomEvent('app.navigate', { detail: { section: 'accounting' } }));
      window.dispatchEvent(new CustomEvent('accounting-navigate'));
    } catch {
      // ignore
    }
  };

  const openRuleDetail = (rule: ReportingRule) => {
    const filing = latestFilingForRule(reports, rule);
    const snapshot = filingSnapshots.get(rule.id);
    const amount =
      filing && filing.amount > 0
        ? filing.amount
        : snapshot && snapshot.suggestedAmount > 0
          ? snapshot.suggestedAmount
          : 0;
    const ruleDates = rule.dueRule?.dates;
    setSelectedRule(rule);
    setEditFrequency(rule.frequency);
    setEditDueKind(dueKindOf(rule));
    setEditDay(String(rule.dueRule?.day || rule.dueDay || 15));
    setEditDays(String(rule.dueRule?.days || 30));
    setEditMonths(String(rule.dueRule?.months || 4));
    setEditDates(Array.isArray(ruleDates) && ruleDates.length ? ruleDates.join(', ') : '03-31, 06-30, 09-30, 12-31');
    setEditAmount(amount > 0 ? String(amount) : '');
    setEditStatus(filing?.status || 'pending');
    setSaveError('');
    onOpen();
  };

  const saveRule = async () => {
    if (!selectedRule) return;
    const built = buildDueRule(
      editDueKind,
      Number(editDay),
      Number(editDays),
      Number(editMonths),
      editDates,
    );
    if ('error' in built) {
      setSaveError(built.error);
      return;
    }
    setSaving(true);
    setSaveError('');
    const nextRule: ReportingRule = {
      ...selectedRule,
      frequency: editFrequency,
      dueRule: built.rule,
      dueDay: built.rule.type === 'dayOfFollowingMonth' ? built.rule.day : selectedRule.dueDay,
      lastUpdated: new Date().toISOString(),
    };
    try {
      const res = await fetch('/api/compliance/reports', {
        method: 'PUT',
        headers: filingHeaders(),
        body: JSON.stringify(nextRule),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Could not save this schedule');
      }
      const saved = (await res.json()) as ReportingRule;
      updateReportingRule(saved);

      const filing = latestFilingForRule(reports, selectedRule);
      const snapshot = filingSnapshots.get(selectedRule.id);
      const shownAmount =
        filing && filing.amount > 0
          ? filing.amount
          : snapshot && snapshot.suggestedAmount > 0
            ? snapshot.suggestedAmount
            : 0;
      const nextAmount = editAmount.trim() === '' ? 0 : Number(editAmount);
      const amountChanged = Number.isFinite(nextAmount) && Math.abs(nextAmount - shownAmount) > 0.001;
      const statusChanged = editStatus !== (filing?.status || 'pending');
      if (amountChanged || statusChanged) {
        const period = filing?.period || snapshot?.period || new Date().toISOString().slice(0, 7);
        const dueDate = filing?.dueDate || toIsoDateLocal(getNextDueDateForSchedule(scheduleInput(saved)));
        if (filing) {
          updateReport(filing.id, { amount: nextAmount, status: editStatus, dueDate });
        } else {
          upsertReport({
            countryCode: selectedRule.countryCode,
            reportType: selectedRule.reportType,
            period,
            dueDate,
            status: editStatus,
            amount: nextAmount,
            currency: 'GHS',
          });
        }
      }
      setSelectedRule(saved);
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save this schedule');
    } finally {
      setSaving(false);
    }
  };

  const selectedRuleFilings = useMemo(() => {
    if (!selectedRule) return [];
    return reports
      .filter((r) => r.countryCode === selectedRule.countryCode && r.reportType === selectedRule.reportType)
      .sort((a, b) => (b.period || '').localeCompare(a.period || ''));
  }, [reports, selectedRule]);

  const countryLabel = useMemo(() => getCountryDisplayName(country), [country]);

  const frequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'Monthly':
        return 'primary' as const;
      case 'Quarterly':
        return 'secondary' as const;
      case 'Annually':
        return 'warning' as const;
      default:
        return 'default' as const;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Live filing schedule · <span className="font-medium text-ghana-black">{countryLabel}</span>
        </p>
        <Tabs
          size="sm"
          variant="solid"
          selectedKey={viewTab}
          onSelectionChange={(key) => setViewTab(key as 'schedule' | 'reference')}
          aria-label="Reports view"
          classNames={deskBookTabsClassNames}
        >
          <Tab key="schedule" title="Filing schedule" />
          <Tab key="reference" title="Hospitality reference" />
        </Tabs>
      </div>

      {viewTab === 'reference' ? (
        <ComplianceHospitalityReference countryCode={country} />
      ) : reportingRules.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-600">
          No filing schedules for {countryLabel}. Sync Tax rules for this country, then reload.
        </p>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardBody className="px-2 py-3">
            <Table
              aria-label="Filing schedule"
              removeWrapper
              classNames={{
                ...worksheetTableClassNames,
                table: '!min-w-[72rem] !w-max !table-auto',
              }}
            >
              <TableHeader>
                <TableColumn>Report</TableColumn>
                <TableColumn>Frequency</TableColumn>
                <TableColumn>Due rule</TableColumn>
                <TableColumn>Period</TableColumn>
                <TableColumn>Amount (GHS)</TableColumn>
                <TableColumn>Next due</TableColumn>
                <TableColumn>Days left</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No schedules">
                {reportingRules.map((rule) => {
                  const input = scheduleInput(rule);
                  const daysUntilDue = getDaysUntilDueForSchedule(input);
                  const nextDueDate = formatDueDateForSchedule(input);
                  const snapshot = filingSnapshots.get(rule.id);
                  const filing = latestFilingForRule(reports, rule);
                  const status = filingStatusChip(filing, daysUntilDue);
                  const amount =
                    filing && filing.amount > 0
                      ? filing.amount
                      : snapshot && snapshot.suggestedAmount > 0
                        ? snapshot.suggestedAmount
                        : 0;
                  const amountSource = filing && filing.amount > 0
                    ? 'filing'
                    : snapshot && snapshot.suggestedAmount > 0
                      ? snapshot.source
                      : 'none';
                  const period = filing?.period || snapshot?.period || '—';

                  return (
                    <TableRow key={rule.id} className="cursor-pointer" onClick={() => openRuleDetail(rule)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span aria-hidden>{reportIcon(rule.reportType)}</span>
                          <span className="font-medium text-ghana-black">{rule.reportType}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip color={frequencyColor(rule.frequency)} variant="flat" size="sm">
                          {rule.frequency}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-600 whitespace-normal max-w-[14rem] block">
                          {dueDateLabel(input)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm tabular-nums">{period}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-mono text-sm tabular-nums">
                            {amount > 0 ? money(amount) : '—'}
                          </span>
                          {amountSource !== 'none' && (
                            <p className="text-[10px] text-gray-400 capitalize">from {amountSource}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm tabular-nums">{nextDueDate}</span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold tabular-nums ${
                            daysUntilDue <= 7
                              ? 'text-ghana-red'
                              : daysUntilDue <= 14
                                ? 'text-ghana-gold'
                                : 'text-ghana-green'
                          }`}
                        >
                          {daysUntilDue}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat" color={status.color}>
                          {status.label}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" color="primary" variant="flat" onPress={goPrepareFiling}>
                            Prepare
                          </Button>
                          <Button size="sm" variant="light" onPress={() => openRuleDetail(rule)}>
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <Modal isOpen={isOpen} onOpenChange={onClose} size="2xl">
        <ModalContent>
          {selectedRule && (
            <>
              <ModalHeader className="flex items-center gap-2">
                <span aria-hidden>{reportIcon(selectedRule.reportType)}</span>
                {selectedRule.reportType} filing
              </ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Frequency"
                    selectedKeys={[editFrequency]}
                    onSelectionChange={(keys) => {
                      const value = String(Array.from(keys)[0] || '');
                      if (value === 'Monthly' || value === 'Quarterly' || value === 'Annually') setEditFrequency(value);
                    }}
                    variant="bordered"
                  >
                    <SelectItem key="Monthly">Monthly</SelectItem>
                    <SelectItem key="Quarterly">Quarterly</SelectItem>
                    <SelectItem key="Annually">Annually</SelectItem>
                  </Select>
                  <Select
                    label="Due rule"
                    selectedKeys={[editDueKind]}
                    onSelectionChange={(keys) => {
                      const value = String(Array.from(keys)[0] || '') as DueKind;
                      if (value) setEditDueKind(value);
                    }}
                    variant="bordered"
                  >
                    <SelectItem key="lastWorkingDayOfNextMonth">Last working day of next month</SelectItem>
                    <SelectItem key="dayOfFollowingMonth">A day of the following month</SelectItem>
                    <SelectItem key="daysAfterPeriodEnd">Days after the period ends</SelectItem>
                    <SelectItem key="quarterEndOfAccountingYear">End of each accounting quarter</SelectItem>
                    <SelectItem key="monthsAfterYearEnd">Months after the year ends</SelectItem>
                    <SelectItem key="fixedCalendarDates">Fixed dates each year</SelectItem>
                  </Select>
                  {editDueKind === 'dayOfFollowingMonth' && (
                    <Input
                      type="number"
                      label="Day of the following month"
                      value={editDay}
                      onChange={(e) => setEditDay(e.target.value)}
                      variant="bordered"
                    />
                  )}
                  {editDueKind === 'daysAfterPeriodEnd' && (
                    <Input
                      type="number"
                      label="Days after the period ends"
                      value={editDays}
                      onChange={(e) => setEditDays(e.target.value)}
                      variant="bordered"
                    />
                  )}
                  {editDueKind === 'monthsAfterYearEnd' && (
                    <Input
                      type="number"
                      label="Months after the year ends"
                      value={editMonths}
                      onChange={(e) => setEditMonths(e.target.value)}
                      variant="bordered"
                    />
                  )}
                  {editDueKind === 'fixedCalendarDates' && (
                    <Input
                      className="sm:col-span-2"
                      label="Dates (month-day)"
                      value={editDates}
                      onChange={(e) => setEditDates(e.target.value)}
                      variant="bordered"
                    />
                  )}
                  <Input
                    type="number"
                    label="Amount (GHS)"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    variant="bordered"
                  />
                  <Select
                    label="Status"
                    selectedKeys={[editStatus]}
                    onSelectionChange={(keys) => {
                      const value = String(Array.from(keys)[0] || '') as ComplianceReport['status'];
                      if (value) setEditStatus(value);
                    }}
                    variant="bordered"
                  >
                    <SelectItem key="pending">Pending</SelectItem>
                    <SelectItem key="submitted">Submitted</SelectItem>
                    <SelectItem key="approved">Approved</SelectItem>
                    <SelectItem key="rejected">Rejected</SelectItem>
                  </Select>
                </div>
                <p className="text-xs text-gray-500">
                  Next due and days left follow the due rule. The report name stays.
                </p>
                {saveError && <p className="text-sm text-danger-600">{saveError}</p>}
                {selectedRule.description && (
                  <p className="mt-3 text-sm text-gray-600">{selectedRule.description}</p>
                )}

                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase text-gray-500">Required fields</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRule.fieldsRequired.map((field: string) => (
                      <Chip key={field} size="sm" variant="flat">
                        {field}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase text-gray-500">Filing history</p>
                  {selectedRuleFilings.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No filings recorded yet for {selectedRule.reportType}.
                    </p>
                  ) : (
                    <Table removeWrapper aria-label="Filing history" classNames={worksheetTableClassNames}>
                      <TableHeader>
                        <TableColumn>Period</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn>Amount</TableColumn>
                        <TableColumn>Submitted</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {selectedRuleFilings.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="font-mono text-sm">{f.period || '—'}</TableCell>
                            <TableCell>
                              <Chip
                                size="sm"
                                variant="flat"
                                color={
                                  f.status === 'submitted' || f.status === 'approved'
                                    ? 'success'
                                    : f.status === 'pending'
                                      ? 'warning'
                                      : 'default'
                                }
                              >
                                {f.status}
                              </Chip>
                            </TableCell>
                            <TableCell className="font-mono text-sm tabular-nums">
                              {money(f.amount)}
                            </TableCell>
                            <TableCell>
                              {f.submittedDate ? new Date(f.submittedDate).toLocaleDateString() : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={saving}>
                  Cancel
                </Button>
                <Button className="bg-ghana-green text-white" onPress={saveRule} isLoading={saving}>
                  Save
                </Button>
                <Button
                  color="primary"
                  onPress={() => {
                    goPrepareFiling();
                    onClose();
                  }}
                >
                  Prepare this filing
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
