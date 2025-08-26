'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Badge, Progress } from "@heroui/react";
import DashboardWrapper from './DashboardWrapper';
import { trackEvent } from '../lib/analytics/trackEvent';

export default function HRPayrollDashboard() {
  const stats = [
    { label: 'Total Employees', value: '128', change: '+3', changeType: 'positive', icon: '👥' },
    { label: 'Active Shifts', value: '42', change: '+4', changeType: 'positive', icon: '⏰' },
    { label: 'Payroll Due (This Month)', value: '₵186,450', change: '+5%', changeType: 'negative', icon: '💳' },
    { label: 'Overtime Hours (7d)', value: '312h', change: '-8%', changeType: 'positive', icon: '⚡' },
  ] as const;

  const quickActions = [
    { title: 'New Hire', icon: '➕', color: 'bg-purple-600', href: '#' },
    { title: 'Run Payroll', icon: '💸', color: 'bg-ghana-green', href: '#' },
    { title: 'Approve Timesheets', icon: '✅', color: 'bg-ghana-gold', href: '#' },
    { title: 'Generate Payslips', icon: '🧾', color: 'bg-indigo-600', href: '#' },
    { title: 'Leave Request', icon: '🌴', color: 'bg-blue-500', href: '#' },
    { title: 'Training Record', icon: '🎓', color: 'bg-rose-500', href: '#' },
  ] as const;

  const staffRows = [
    { id: 'EMP-001', name: 'Ama Osei', dept: 'Frontdesk', role: 'Supervisor', status: 'Active' },
    { id: 'EMP-014', name: 'Kwame Mensah', dept: 'Housekeeping', role: 'Attendant', status: 'Active' },
    { id: 'EMP-022', name: 'Efua Boateng', dept: 'F&B', role: 'Chef', status: 'On Leave' },
    { id: 'EMP-037', name: 'Yaw Owusu', dept: 'Security', role: 'Guard', status: 'Active' },
  ];

  const payrollRuns = [
    { period: 'Jan 2025', runOn: '31 Jan 2025', gross: '₵192,340', net: '₵158,220', status: 'Completed' },
    { period: 'Dec 2024', runOn: '31 Dec 2024', gross: '₵185,910', net: '₵152,480', status: 'Completed' },
    { period: 'Nov 2024', runOn: '30 Nov 2024', gross: '₵179,670', net: '₵147,120', status: 'Completed' },
  ];

  const compliance = {
    paye: { label: 'PAYE', value: 78 },
    ssnit: { label: 'SSNIT', value: 92 },
    tier2: { label: 'Tier 2', value: 88 },
    tier3: { label: 'Tier 3', value: 64 },
  } as const;

  return (
    <DashboardWrapper
      title="HR & Payroll"
      subtitle="Manage people, time, and payroll with Ghana-specific compliance"
      icon="👥"
      stats={stats as any}
      quickActions={quickActions as any}
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2"><h3 className="text-lg font-semibold text-ghana-black">👤 Staff Directory</h3></CardHeader>
            <CardBody>
              <Table aria-label="Staff Directory">
                <TableHeader>
                  <TableColumn>ID</TableColumn>
                  <TableColumn>Name</TableColumn>
                  <TableColumn>Department</TableColumn>
                  <TableColumn>Role</TableColumn>
                  <TableColumn>Status</TableColumn>
                </TableHeader>
                <TableBody>
                  {staffRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.dept}</TableCell>
                      <TableCell>{row.role}</TableCell>
                      <TableCell>
                        <Badge color={row.status === 'Active' ? 'success' : 'warning'} variant="flat" size="sm">
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2"><h3 className="text-lg font-semibold text-ghana-black">🗓️ Shift Scheduling</h3></CardHeader>
            <CardBody>
              <Table aria-label="Shift Scheduling">
                <TableHeader>
                  <TableColumn>Employee</TableColumn>
                  <TableColumn>Shift</TableColumn>
                  <TableColumn>Date</TableColumn>
                  <TableColumn>Location</TableColumn>
                  <TableColumn>Approval</TableColumn>
                </TableHeader>
                <TableBody>
                  <TableRow key="1">
                    <TableCell>Ama Osei</TableCell>
                    <TableCell>Morning (07:00 - 15:00)</TableCell>
                    <TableCell>Today</TableCell>
                    <TableCell>Frontdesk</TableCell>
                    <TableCell><Button size="sm" variant="flat" className="bg-ghana-green text-white">Approve</Button></TableCell>
                  </TableRow>
                  <TableRow key="2">
                    <TableCell>Yaw Owusu</TableCell>
                    <TableCell>Night (22:00 - 06:00)</TableCell>
                    <TableCell>Today</TableCell>
                    <TableCell>Perimeter</TableCell>
                    <TableCell><Button size="sm" variant="flat" className="bg-ghana-gold text-white">Pending</Button></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2"><h3 className="text-lg font-semibold text-ghana-black">💸 Recent Payroll Runs</h3></CardHeader>
            <CardBody>
              <Table aria-label="Payroll Runs">
                <TableHeader>
                  <TableColumn>Period</TableColumn>
                  <TableColumn>Run On</TableColumn>
                  <TableColumn>Gross</TableColumn>
                  <TableColumn>Net</TableColumn>
                  <TableColumn>Status</TableColumn>
                </TableHeader>
                <TableBody>
                  {payrollRuns.map((r) => (
                    <TableRow key={r.period}>
                      <TableCell>{r.period}</TableCell>
                      <TableCell>{r.runOn}</TableCell>
                      <TableCell>{r.gross}</TableCell>
                      <TableCell>{r.net}</TableCell>
                      <TableCell>
                        <Badge color="success" variant="flat" size="sm">{r.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex gap-3">
                <Button className="bg-ghana-green text-white" variant="flat" onClick={() => trackEvent('Payroll.RunRequested', { period: 'current' }, { sourceModule: 'HR' })}>Run Monthly Payroll</Button>
                <Button className="bg-indigo-600 text-white" variant="flat" onClick={() => trackEvent('Payroll.PayslipsExported', { period: 'current' }, { sourceModule: 'HR' })}>Export Payslips</Button>
              </div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2"><h3 className="text-lg font-semibold text-ghana-black">📑 Ghana Compliance</h3></CardHeader>
            <CardBody>
              <div className="space-y-4">
                {Object.values(compliance).map((c) => (
                  <div key={c.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{c.label} Filing Readiness</span>
                      <Badge size="sm" variant="flat" color={c.value >= 85 ? 'success' : c.value >= 70 ? 'warning' : 'danger'}>
                        {c.value}%
                      </Badge>
                    </div>
                    <Progress value={c.value} className="h-2" color={c.value >= 85 ? 'success' : c.value >= 70 ? 'warning' : 'danger'} aria-label={`${c.label} progress`} />
                  </div>
                ))}
                <div className="pt-2 flex gap-2">
                  <Button size="sm" className="bg-ghana-green text-white" variant="flat" onClick={() => trackEvent('Report.Opened', { name: 'PAYE Schedule' }, { sourceModule: 'HR' })}>Prepare PAYE</Button>
                  <Button size="sm" className="bg-ghana-gold text-white" variant="flat" onClick={() => trackEvent('Report.Opened', { name: 'SSNIT Schedule' }, { sourceModule: 'HR' })}>SSNIT Schedule</Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </DashboardWrapper>
  );
}


