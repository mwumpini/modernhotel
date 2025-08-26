'use client';

import React, { useEffect, useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Badge, 
  Button, 
  Progress,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip
} from "@heroui/react";
import { useComplianceStore } from '@/app/lib/compliance/store';
import { useComplianceSummary } from '@/app/hooks/useCalculateTax';

export default function ComplianceReports() {
  const { reportingRules, country } = useComplianceStore();
  const getComplianceSummary = useComplianceSummary();
  const [summary, setSummary] = useState(getComplianceSummary());

  useEffect(() => {
    setSummary(getComplianceSummary());
  }, [reportingRules, country]);

  const getStatusColor = (frequency: string) => {
    switch (frequency) {
      case 'Monthly': return 'primary';
      case 'Quarterly': return 'secondary';
      case 'Annually': return 'warning';
      default: return 'default';
    }
  };

  const getReportIcon = (reportType: string) => {
    switch (reportType) {
      case 'VAT': return '🧾';
      case 'NHIL': return '🏥';
      case 'Tourism': return '🏖️';
      case 'SSNIT': return '👥';
      case 'PAYE': return '💰';
      case 'IncomeTax': return '📊';
      case 'Sales Tax': return '🛒';
      case 'Hotel Tax': return '🏨';
      default: return '📋';
    }
  };

  const getNextDueDate = (frequency: string, dueDay: number) => {
    const now = new Date();
    let nextDue = new Date();
    
    switch (frequency) {
      case 'Monthly':
        nextDue.setDate(dueDay);
        if (nextDue <= now) {
          nextDue.setMonth(nextDue.getMonth() + 1);
        }
        break;
      case 'Quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        nextDue.setMonth(quarter * 3 + 2, dueDay);
        if (nextDue <= now) {
          nextDue.setMonth(nextDue.getMonth() + 3);
        }
        break;
      case 'Annually':
        nextDue.setMonth(11, dueDay);
        if (nextDue <= now) {
          nextDue.setFullYear(nextDue.getFullYear() + 1);
        }
        break;
    }
    
    return nextDue.toLocaleDateString();
  };

  const getDaysUntilDue = (frequency: string, dueDay: number) => {
    const now = new Date();
    let nextDue = new Date();
    
    switch (frequency) {
      case 'Monthly':
        nextDue.setDate(dueDay);
        if (nextDue <= now) {
          nextDue.setMonth(nextDue.getMonth() + 1);
        }
        break;
      case 'Quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        nextDue.setMonth(quarter * 3 + 2, dueDay);
        if (nextDue <= now) {
          nextDue.setMonth(nextDue.getMonth() + 3);
        }
        break;
      case 'Annually':
        nextDue.setMonth(11, dueDay);
        if (nextDue <= now) {
          nextDue.setFullYear(nextDue.getFullYear() + 1);
        }
        break;
    }
    
    const diffTime = nextDue.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6">
      {/* Compliance Summary */}
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
                color={summary.complianceScore >= 80 ? 'success' : summary.complianceScore >= 60 ? 'warning' : 'danger'}
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
              <p className="text-sm text-gray-600">Pending Reports</p>
              <p className="text-2xl font-bold text-ghana-red">{summary.pendingReports}</p>
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

      {/* Active Reporting Requirements */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <h2 className="text-xl font-bold text-ghana-black">Active Reporting Requirements</h2>
        </CardHeader>
        <CardBody>
          <Table aria-label="Reporting requirements table">
            <TableHeader>
              <TableColumn>Report Type</TableColumn>
              <TableColumn>Frequency</TableColumn>
              <TableColumn>Next Due</TableColumn>
              <TableColumn>Days Left</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {reportingRules.map((rule) => {
                const daysUntilDue = getDaysUntilDue(rule.frequency, rule.dueDay);
                const nextDueDate = getNextDueDate(rule.frequency, rule.dueDay);
                
                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getReportIcon(rule.reportType)}</span>
                        <span className="font-medium">{rule.reportType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        color={getStatusColor(rule.frequency) as any}
                        variant="flat"
                        size="sm"
                      >
                        {rule.frequency}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{nextDueDate}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className={`font-bold ${
                          daysUntilDue <= 7 ? 'text-ghana-red' : 
                          daysUntilDue <= 14 ? 'text-ghana-gold' : 'text-ghana-green'
                        }`}>
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
                        {daysUntilDue <= 7 ? 'Urgent' : daysUntilDue <= 14 ? 'Due Soon' : 'On Track'}
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
        </CardBody>
      </Card>

      {/* Required Fields Summary */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <h3 className="text-lg font-semibold text-ghana-black">Required Fields Summary</h3>
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
                  {rule.fieldsRequired.map((field, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-ghana-green rounded-full"></div>
                      <span className="text-sm text-gray-600">{field}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
