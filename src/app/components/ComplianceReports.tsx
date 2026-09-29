'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
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
  scheduleInputFromRule as scheduleInput,
} from '@/app/lib/compliance/dueDates';
import { syncOpenSalesTaxFilings } from '@/app/lib/compliance/salesFilingSync';
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
    setSelectedRule(rule);
    onOpen();
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
            <Table aria-label="Filing schedule" removeWrapper classNames={worksheetTableClassNames}>
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
                            View
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
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Frequency</p>
                    <p className="font-medium">{selectedRule.frequency}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Due rule</p>
                    <p className="font-medium">{dueDateLabel(scheduleInput(selectedRule))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Next due</p>
                    <p className="font-medium font-mono">
                      {formatDueDateForSchedule(scheduleInput(selectedRule))}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Days left</p>
                    <p className="font-medium">
                      {getDaysUntilDueForSchedule(scheduleInput(selectedRule))} days
                    </p>
                  </div>
                </div>
                {selectedRule.description && (
                  <p className="mt-3 text-sm text-gray-600">{selectedRule.description}</p>
                )}

                {(() => {
                  const snapshot = filingSnapshots.get(selectedRule.id);
                  const filing = latestFilingForRule(reports, selectedRule);
                  const amount =
                    filing && filing.amount > 0
                      ? filing.amount
                      : snapshot && snapshot.suggestedAmount > 0
                        ? snapshot.suggestedAmount
                        : 0;
                  if (amount <= 0) return null;
                  return (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="text-gray-500">Amount</p>
                      <p className="font-mono font-semibold">GHS {money(amount)}</p>
                      {filing?.period && (
                        <p className="text-xs text-gray-400">Period {filing.period} · {filing.status}</p>
                      )}
                      {!filing && snapshot?.source && snapshot.source !== 'none' && (
                        <p className="text-xs text-gray-400 capitalize">
                          Suggested from {snapshot.source}
                          {snapshot.detail ? ` — ${snapshot.detail}` : ''}
                        </p>
                      )}
                    </div>
                  );
                })()}

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
                <Button variant="light" onPress={onClose}>
                  Close
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
