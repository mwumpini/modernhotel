'use client';

import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
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
import { useComplianceSummary } from '@/app/hooks/useCalculateTax';
import { useFilingSnapshots } from '@/app/hooks/useFilingSnapshots';
import { getCountryDisplayName } from '@/app/lib/compliance/config';
import {
  dueDateLabel,
  formatDueDateForSchedule,
  getDaysUntilDueForSchedule,
  scheduleInputFromRule as scheduleInput,
} from '@/app/lib/compliance/dueDates';
import ComplianceHospitalityReference from './ComplianceHospitalityReference';

export default function ComplianceReports() {
  const country = useComplianceStore((s) => s.country);
  const reportingRulesAll = useComplianceStore((s) => s.reportingRules);
  const reports = useComplianceStore((s) => s.reports);
  const reportingRules = useMemo(
    () => reportingRulesAll.filter((r) => r.countryCode === country && r.isActive !== false),
    [reportingRulesAll, country]
  );
  const summary = useComplianceSummary();
  const filingSnapshots = useFilingSnapshots();
  const [viewTab, setViewTab] = useState<'schedule' | 'reference'>('schedule');
  const [selectedRule, setSelectedRule] = useState<(typeof reportingRulesAll)[number] | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Jump straight to where this filing actually gets recorded -- the same "record remittance"
  // flow (Accounting > Bank & Cash > Taxes) that syncs into the `reports` list below, rather
  // than leaving "Prepare" as a dead button with no defined destination.
  const goPrepareFiling = () => {
    try {
      localStorage.setItem('accounting.tab', 'taxes');
      localStorage.setItem('nav.section', 'accounting');
      window.dispatchEvent(new CustomEvent('app.navigate', { detail: { section: 'accounting' } }));
      window.dispatchEvent(new CustomEvent('accounting-navigate'));
    } catch {}
  };

  const openRuleDetail = (rule: (typeof reportingRulesAll)[number]) => {
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

  const getStatusColor = (frequency: string) => {
    switch (frequency) {
      case 'Monthly':
        return 'primary';
      case 'Quarterly':
        return 'secondary';
      case 'Annually':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getReportIcon = (reportType: string) => {
    switch (reportType) {
      case 'VAT':
        return '🧾';
      case 'NHIL':
        return '🏥';
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
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Filing schedules for <span className="font-medium text-ghana-black">{countryLabel}</span>
        </p>
        <Tabs
          size="sm"
          selectedKey={viewTab}
          onSelectionChange={(key) => setViewTab(key as 'schedule' | 'reference')}
          aria-label="Reports view"
        >
          <Tab key="schedule" title="Filing schedule" />
          <Tab key="reference" title="Hospitality reference" />
        </Tabs>
      </div>

      {viewTab === 'reference' ? (
        <ComplianceHospitalityReference countryCode={country} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-lg">
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Compliance Score</p>
                    <p className="text-2xl font-bold text-ghana-green">{summary.complianceScore}%</p>
                  </div>
                  <Progress
                    value={summary.complianceScore}
                    className="w-16"
                    color={
                      summary.complianceScore >= 80 ? 'success' : summary.complianceScore >= 60 ? 'warning' : 'danger'
                    }
                  />
                </div>
              </CardBody>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardBody className="p-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Active Rules</p>
                  <p className="text-2xl font-bold text-ghana-black">{summary.activeTaxRules}</p>
                </div>
              </CardBody>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardBody className="p-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Filing schedules</p>
                  <p className="text-2xl font-bold text-ghana-black">{summary.activeReportingSchedules}</p>
                </div>
              </CardBody>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardBody className="p-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Submitted</p>
                  <p className="text-2xl font-bold text-ghana-green">{summary.submittedReports}</p>
                </div>
              </CardBody>
            </Card>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <h2 className="text-xl font-bold text-ghana-black">Active reporting requirements</h2>
            </CardHeader>
            <CardBody>
              {reportingRules.length === 0 ? (
                <p className="text-sm text-gray-600 py-4 text-center">
                  No filing schedules for {countryLabel}. Check Compliance → Tax Management country sync or reload data.
                </p>
              ) : (
                <Table aria-label="Reporting requirements table">
                  <TableHeader>
                    <TableColumn>Report type</TableColumn>
                    <TableColumn>Frequency</TableColumn>
                    <TableColumn>Due rule</TableColumn>
                    <TableColumn>Suggested (GHS)</TableColumn>
                    <TableColumn>Next due</TableColumn>
                    <TableColumn>Days left</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {reportingRules.map((rule) => {
                      const input = scheduleInput(rule);
                      const daysUntilDue = getDaysUntilDueForSchedule(input);
                      const nextDueDate = formatDueDateForSchedule(input);
                      const snapshot = filingSnapshots.get(rule.id);

                      return (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{getReportIcon(rule.reportType)}</span>
                              <div>
                                <span className="font-medium">{rule.reportType}</span>
                                {rule.description ? (
                                  <p className="text-xs text-gray-500 max-w-xs">{rule.description}</p>
                                ) : null}
                                {snapshot?.detail ? (
                                  <p className="text-xs text-gray-400 max-w-xs">{snapshot.detail}</p>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip color={getStatusColor(rule.frequency) as 'primary' | 'secondary' | 'warning' | 'default'} variant="flat" size="sm">
                              {rule.frequency}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-600">{dueDateLabel(input)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {snapshot && snapshot.suggestedAmount > 0
                                ? snapshot.suggestedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                                : '—'}
                            </span>
                            {snapshot?.source && snapshot.source !== 'none' ? (
                              <p className="text-[10px] text-gray-400 capitalize">from {snapshot.source}</p>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{nextDueDate}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`font-bold ${
                                  daysUntilDue <= 7
                                    ? 'text-ghana-red'
                                    : daysUntilDue <= 14
                                      ? 'text-ghana-gold'
                                      : 'text-ghana-green'
                                }`}
                              >
                                {daysUntilDue}
                              </span>
                              <span className="text-xs text-gray-500">days</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              color={daysUntilDue <= 7 ? 'danger' : daysUntilDue <= 14 ? 'warning' : 'success'}
                              variant="flat"
                            >
                              {daysUntilDue <= 7 ? 'Urgent' : daysUntilDue <= 14 ? 'Due soon' : 'On track'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
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
              )}
            </CardBody>
          </Card>

          {reportingRules.length > 0 ? (
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <h3 className="text-lg font-semibold text-ghana-black">Required fields summary</h3>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reportingRules.map((rule) => (
                    <div key={rule.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="text-lg">{getReportIcon(rule.reportType)}</span>
                        <h4 className="font-semibold">{rule.reportType}</h4>
                      </div>
                      <div className="space-y-1">
                        {rule.fieldsRequired.map((field) => (
                          <div key={field} className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-ghana-green rounded-full" />
                            <span className="text-sm text-gray-600">{field}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}
        </>
      )}

      <Modal isOpen={isOpen} onOpenChange={onClose} size="2xl">
        <ModalContent>
          {selectedRule && (
            <>
              <ModalHeader className="flex items-center gap-2">
                <span className="text-lg">{getReportIcon(selectedRule.reportType)}</span>
                {selectedRule.reportType} filing schedule
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
                    <p className="font-medium font-mono">{formatDueDateForSchedule(scheduleInput(selectedRule))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Days left</p>
                    <p className="font-medium">{getDaysUntilDueForSchedule(scheduleInput(selectedRule))} days</p>
                  </div>
                </div>
                {selectedRule.description && (
                  <p className="text-sm text-gray-600 mt-3">{selectedRule.description}</p>
                )}

                {(() => {
                  const snapshot = filingSnapshots.get(selectedRule.id);
                  if (!snapshot || snapshot.suggestedAmount <= 0) return null;
                  return (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm">
                      <p className="text-gray-500">Suggested amount</p>
                      <p className="font-mono font-semibold">
                        GHS {snapshot.suggestedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      {snapshot.source && snapshot.source !== 'none' && (
                        <p className="text-xs text-gray-400 capitalize">from {snapshot.source}{snapshot.detail ? ` — ${snapshot.detail}` : ''}</p>
                      )}
                    </div>
                  );
                })()}

                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Required fields</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRule.fieldsRequired.map((field: string) => (
                      <Chip key={field} size="sm" variant="flat">{field}</Chip>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Filing history</p>
                  {selectedRuleFilings.length === 0 ? (
                    <p className="text-sm text-gray-500">No filings recorded yet for {selectedRule.reportType}.</p>
                  ) : (
                    <Table removeWrapper aria-label="Filing history" className="text-sm">
                      <TableHeader>
                        <TableColumn>Period</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn>Amount</TableColumn>
                        <TableColumn>Submitted</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {selectedRuleFilings.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell>{f.period || '—'}</TableCell>
                            <TableCell>
                              <Chip
                                size="sm"
                                variant="flat"
                                color={f.status === 'submitted' || f.status === 'approved' ? 'success' : f.status === 'pending' ? 'warning' : 'default'}
                              >
                                {f.status}
                              </Chip>
                            </TableCell>
                            <TableCell className="font-mono">{f.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>{f.submittedDate ? new Date(f.submittedDate).toLocaleDateString() : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Close</Button>
                <Button color="primary" onPress={() => { goPrepareFiling(); onClose(); }}>Prepare this filing</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
