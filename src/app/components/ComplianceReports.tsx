'use client';

import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Progress,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
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
  const reportingRules = useMemo(
    () => reportingRulesAll.filter((r) => r.countryCode === country && r.isActive !== false),
    [reportingRulesAll, country]
  );
  const summary = useComplianceSummary();
  const filingSnapshots = useFilingSnapshots();
  const [viewTab, setViewTab] = useState<'schedule' | 'reference'>('schedule');

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
                              <Button size="sm" color="primary" variant="flat">
                                Prepare
                              </Button>
                              <Button size="sm" variant="light">
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
    </div>
  );
}
