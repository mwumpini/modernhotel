'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Select, SelectItem, Chip, Input, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Checkbox } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { usePayrollStore } from '@/app/lib/hr/payrollStore';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { amountToWordsGhana, generatePaymentAdvicePDF } from '@/app/lib/hr/payrollPdf';
import { useSettingsStore } from '@/app/lib/settings/store';
import type { PayrollRecord } from '@/app/lib/hr/models';

// Shared by both the on-screen Payment Advice summary and the downloadable PDF/XLS — one
// implementation so a payment channel is never classified differently between what the
// preparer sees on screen and what actually prints on the bank instruction.
function resolvePaymentChannel(emp: any, rec: PayrollRecord | undefined): string {
  const bankNameRaw = emp?.bankAccount?.bankName || '';
  // Cast to string, not narrowed to PayrollRecord['paymentMethod'] -- the 'momo' check below
  // is defensive against data that predates/falls outside that type's current 3 values.
  const payMethod = String(rec?.paymentMethod || '');
  const lowerIncludes = (s: string | undefined, term: string) => (s || '').toLowerCase().includes(term);
  if (payMethod === 'cash') return 'Cash';
  if (
    lowerIncludes(bankNameRaw, 'momo') || lowerIncludes(bankNameRaw, 'mobile') ||
    lowerIncludes(bankNameRaw, 'mtn') || lowerIncludes(bankNameRaw, 'vodafone') ||
    lowerIncludes(bankNameRaw, 'airtel') || payMethod === 'momo'
  ) return 'MoMo';
  if (bankNameRaw) return bankNameRaw;
  return 'Cash';
}

export default function PayrollProcessingPanel() {
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const positions = useEmployeeStore((s) => s.positions);
  const getDepartment = useEmployeeStore((s) => s.getDepartment);
  const getPosition = useEmployeeStore((s) => s.getPosition);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);
  const taxRules = useComplianceStore((s) => s.taxRules);
  const hotelName = useSettingsStore((s) => s.hotelSettings.hotelName) || 'Hotel';

  // Tier 1/2/3 are separate, independently-renameable rules (different institutions) — the
  // column labels and pre-run estimate rates below read the live rule so a rename in
  // Settings → Tax Rate Builder (or a rate change) shows up here without a code change.
  const findGhRule = (tag: string) =>
    taxRules.find((r) => r.countryCode === 'GH' && r.domain === 'payroll' && (r.appliesTo || []).includes(tag));
  const tier1Rule = findGhRule('TIER1');
  const tier2Rule = findGhRule('TIER2');
  const tier3Rule = findGhRule('TIER3_RELIEF_CAP');
  const tier1Label = tier1Rule?.name || 'Tier 1';
  const tier2Label = tier2Rule?.name || 'Tier 2';
  const tier3Label = tier3Rule?.name || 'Tier 3';

  React.useEffect(() => {
    // This panel can be reached directly (HR & Payroll → Payroll Management → Payroll
    // Processing) without ever visiting Compliance & Reports first, which is otherwise the
    // only place the compliance store gets hydrated — without this, taxRules is silently
    // empty and every Tier 1/2/3 label/rate below falls back to defaults instead of the
    // live (possibly renamed/rate-changed) rule.
    void useComplianceStore.getState().syncCountryFromSetup();
  }, []);

  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [deptFilter, setDeptFilter] = React.useState<string>('all');
  const [q, setQ] = React.useState<string>('');
  const allColumnKeys = [
    'idNo','staffNo','name','department','position','residencyClass','status','type','basicSalary','allowances','secondEmployment','incomeTax','socialSecurity','tier2','tier3','actions'
  ];
  const [showColumns, setShowColumns] = React.useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(new Set(allColumnKeys));
  const toggleColumn = (key: string, checked: boolean) => {
    setVisibleColumns(prev => { const next = new Set(prev); if (checked) next.add(key); else next.delete(key); return next; });
  };

  // Payment Advice detail modal state
  const [adviceOpen, setAdviceOpen] = React.useState<boolean>(false);
  const [adviceLabel, setAdviceLabel] = React.useState<string | null>(null);
  const [signerName, setSignerName] = React.useState<string>('');
  const [signerPosition, setSignerPosition] = React.useState<string>('');

  // Employee payroll detail modal state (Staff Payroll table's "View" action)
  const [detailEmployee, setDetailEmployee] = React.useState<any | null>(null);

  const handleOpenAdvice = (label: string) => {
    setAdviceLabel(label);
    setAdviceOpen(true);
  };

  // One lookup, reused everywhere "the most recent thing we actually paid this employee"
  // is needed — the Payment Advice below (both the on-screen summary and the PDF/XLS) must
  // never disagree with each other about which record is "latest" for a given employee.
  const latestPaidRecordByEmployee = React.useMemo(() => {
    const map: Record<string, PayrollRecord> = {};
    payrollRecords
      .filter((r) => r.status === 'paid')
      .sort((a, b) => (b.paidAt?.getTime() || 0) - (a.paidAt?.getTime() || 0))
      .forEach((r) => { if (!map[r.employeeId]) map[r.employeeId] = r; });
    return map;
  }, [payrollRecords]);

  const buildAdviceForLabel = (label: string) => {
    const latestByEmp = latestPaidRecordByEmployee;
    type Row = { employeeName: string; accountNumber: string; net: number; paidAt?: Date };
    const rows: Row[] = [];
    (employees || []).forEach((emp: any) => {
      const rec = latestByEmp[emp.id];
      // No real paid payroll record for this employee -- there is no accurate net pay to
      // instruct a bank/MoMo payment with, so they're left off the advice entirely rather
      // than filled in with a guessed figure (previously a flat 15.5%-of-gross estimate).
      if (!rec) return;
      const channel = resolvePaymentChannel(emp, rec);
      if (channel !== label) return;

      const net = rec.netPay;
      const accountNumber = label === 'MoMo' ? (emp.phone || emp?.bankAccount?.accountNumber || '') : (label === 'Cash' ? '-' : (emp?.bankAccount?.accountNumber || ''));
      rows.push({ employeeName: `${emp.firstName} ${emp.lastName}`, accountNumber, net, paidAt: rec.paidAt });
    });
    const total = rows.reduce((s, r) => s + (r.net || 0), 0);
    const paidDates = rows.map(r => r.paidAt?.getTime() || 0).filter(Boolean).sort((a, b) => b - a);
    const baseDate = paidDates.length ? new Date(paidDates[0]) : new Date();
    const monthLabel = baseDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return { rows, total, monthLabel };
  };

  const handleDownloadAdvicePdf = async (label: string) => {
    const { rows, monthLabel } = buildAdviceForLabel(label);
    const companyLogoUrl = '/logo.png';
    const bankLogoUrl = (() => {
      const l = (label || '').toLowerCase();
      if (l.includes('zenith')) return '/logos/banks/zenith.png';
      if (l.includes('gcb')) return '/logos/banks/gcb.png';
      if (l.includes('ecobank')) return '/logos/banks/ecobank.png';
      if (l.includes('fidelity')) return '/logos/banks/fidelity.png';
      if (l.includes('access')) return '/logos/banks/access.png';
      if (l.includes('absa')) return '/logos/banks/absa.png';
      if (l.includes('mtn')) return '/logos/momo/mtn.png';
      if (l.includes('vodafone')) return '/logos/momo/vodafone.png';
      if (l.includes('airtel')) return '/logos/momo/airtel.png';
      if (l.includes('momo') || l.includes('mobile')) return '/logos/momo/momo.png';
      return undefined;
    })();
    await generatePaymentAdvicePDF({
      hotelName,
      monthLabel,
      bankOrChannel: label,
      rows,
      signerName: signerName || 'Authorized Signatory',
      signerPosition: signerPosition || 'Finance Manager',
      companyLogoUrl,
      bankLogoUrl,
      fileName: `Salary_Payment_Advice_${label.replace(/\s+/g,'_')}_${monthLabel.replace(/\s+/g,'_')}.pdf`,
    });
  };

  const handleDownloadAdviceXls = (label: string) => {
    const { rows, monthLabel, total } = buildAdviceForLabel(label);
    const printed = new Date().toLocaleString('en-GB');
    const words = amountToWordsGhana(total);
    const companyLogoUrl = '/logo.png';
    const bankLogoUrl = (() => {
      const l = (label || '').toLowerCase();
      if (l.includes('zenith')) return '/logos/banks/zenith.png';
      if (l.includes('gcb')) return '/logos/banks/gcb.png';
      if (l.includes('ecobank')) return '/logos/banks/ecobank.png';
      if (l.includes('fidelity')) return '/logos/banks/fidelity.png';
      if (l.includes('access')) return '/logos/banks/access.png';
      if (l.includes('absa')) return '/logos/banks/absa.png';
      if (l.includes('mtn')) return '/logos/momo/mtn.png';
      if (l.includes('vodafone')) return '/logos/momo/vodafone.png';
      if (l.includes('airtel')) return '/logos/momo/airtel.png';
      if (l.includes('momo') || l.includes('mobile')) return '/logos/momo/momo.png';
      return '';
    })();
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  table { border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 4px 6px; }
  th.left, td.left { text-align: left; }
  th.right, td.right { text-align: right; }
  th.center, td.center { text-align: center; }
  caption, .meta { text-align: left; margin-bottom: 6px; }
  .meta b { display: inline-block; width: 140px; }
  .title { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 6px; }
  .subtitle { text-align: center; font-size: 12px; margin-bottom: 8px; }
  .intro { margin: 8px 0 10px 0; }
  .logos { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .logos img { height: 28px; }
</style>
</head><body>
  <div class="logos">
    <img src="${companyLogoUrl}" alt="Company" onerror="this.style.display='none'" />
    <img src="${bankLogoUrl}" alt="Bank" onerror="this.style.display='none'" />
  </div>
  <div class="title">${hotelName}</div>
  <div class="subtitle">Salary Payment Advice - ${label}</div>
  <div class="subtitle">${monthLabel}</div>
  <div class="meta"><b>Signer Name:</b> ${signerName || 'Authorized Signatory'}</div>
  <div class="meta"><b>Signer Position:</b> ${signerPosition || 'Finance Manager'}</div>
  <div class="meta"><b>Date Printed:</b> ${printed}</div>
  <div class="intro">Please pay the underlisted staff of ${hotelName} their net salaries via ${label} for ${monthLabel}. The total amount is GHS ${total.toFixed(2)} (${words}).</div>
  <table>
    <colgroup>
      <col style="width: 12%" />
      <col style="width: 40%" />
      <col style="width: 30%" />
      <col style="width: 18%" />
    </colgroup>
    <thead>
      <tr>
        <th class="center">No.</th>
        <th class="left">Name</th>
        <th class="left">Account / Wallet</th>
        <th class="right">Net Salary (GHS)</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((r, i) => `<tr><td class="center">${i + 1}</td><td class="left">${(r.employeeName || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td><td class="left">${(r.accountNumber || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td><td class="right">${(r.net || 0).toFixed(2)}</td></tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td></td>
        <td><b>Total</b></td>
        <td></td>
        <td class="right"><b>${total.toFixed(2)}</b></td>
      </tr>
    </tfoot>
  </table>
  <div class="meta" style="margin-top:8px;"><b>Amount in words:</b> ${words}</div>
</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Salary_Payment_Advice_${label.replace(/\s+/g,'_')}_${monthLabel.replace(/\s+/g,'_')}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = employees.filter((e) => {
    const sOk = statusFilter === 'all' || e.status === statusFilter;
    const dOk = deptFilter === 'all' || e.departmentId === deptFilter;
    const qOk = !q || (`${e.firstName} ${e.lastName}`.toLowerCase().includes(q.toLowerCase()) || (e.employeeNumber || '').toLowerCase().includes(q.toLowerCase()));
    return sOk && dOk && qOk;
  });

  const fmtCurrency = (n: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(n || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Staff Payroll</div>
          <div className="flex items-center gap-2">
            <Select
              size="sm"
              selectedKeys={[deptFilter]}
              onSelectionChange={(k) => setDeptFilter(Array.from(k)[0] as string)}
              className="w-48"
              variant="bordered"
              aria-label="Department"
              items={[{ id: 'all', name: 'All Departments' }, ...departments.map((d) => ({ id: d.id, name: d.name }))]}
            >
              {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
            </Select>
            <Select size="sm" selectedKeys={[statusFilter]} onSelectionChange={(k) => setStatusFilter(Array.from(k)[0] as string)} className="w-40" variant="bordered" aria-label="Status">
              <SelectItem key="all">All Status</SelectItem>
              <SelectItem key="active">Active</SelectItem>
              <SelectItem key="inactive">Inactive</SelectItem>
              <SelectItem key="on_leave">On Leave</SelectItem>
              <SelectItem key="terminated">Terminated</SelectItem>
            </Select>
            <Input size="sm" variant="bordered" placeholder="Search staff no./name" className="w-56" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button size="sm" variant="flat" onPress={() => setShowColumns(true)}>Columns</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="staff-payroll" className="overflow-x-auto">
            <TableHeader>
              <TableColumn className={visibleColumns.has('idNo') ? '' : 'hidden'}>ID NO.</TableColumn>
              <TableColumn className={visibleColumns.has('staffNo') ? '' : 'hidden'}>STAFF NO.</TableColumn>
              <TableColumn className={visibleColumns.has('name') ? '' : 'hidden'}>NAME</TableColumn>
              <TableColumn className={visibleColumns.has('department') ? '' : 'hidden'}>DEPARTMENT</TableColumn>
              <TableColumn className={visibleColumns.has('position') ? '' : 'hidden'}>POSITION</TableColumn>
              <TableColumn className={visibleColumns.has('residencyClass') ? '' : 'hidden'}>RESIDENCY / CLASS</TableColumn>
              <TableColumn className={visibleColumns.has('status') ? '' : 'hidden'}>STATUS</TableColumn>
              <TableColumn className={visibleColumns.has('type') ? '' : 'hidden'}>TYPE</TableColumn>
              <TableColumn className={visibleColumns.has('basicSalary') ? '' : 'hidden'}>BASIC SALARY</TableColumn>
              <TableColumn className={visibleColumns.has('allowances') ? '' : 'hidden'}>ALLOWANCES</TableColumn>
              <TableColumn className={visibleColumns.has('secondEmployment') ? '' : 'hidden'}>SECOND EMPLOY</TableColumn>
              <TableColumn className={visibleColumns.has('incomeTax') ? '' : 'hidden'}>INCOME TAX</TableColumn>
              <TableColumn className={visibleColumns.has('socialSecurity') ? '' : 'hidden'}>{tier1Label}</TableColumn>
              <TableColumn className={visibleColumns.has('tier2') ? '' : 'hidden'}>{tier2Label}</TableColumn>
              <TableColumn className={visibleColumns.has('tier3') ? '' : 'hidden'}>{tier3Label}</TableColumn>
              <TableColumn className={visibleColumns.has('actions') ? '' : 'hidden'}>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const dept = getDepartment(e.departmentId);
                const pos = getPosition(e.positionId);
                const salary = (e as any).salary ?? (e as any).baseSalary ?? 0;
                const basicSalary = (e as any).basicSalary ?? salary;
                const allowances = (e as any).allowances ?? 0;
                const grossPay = basicSalary + allowances;

                const latestPayrollRecord = latestPaidRecordByEmployee[e.id];

                // Tier 1's base is basic salary only (allowances/bonus/overtime excluded per
                // its insurable-earnings definition) — the pre-run estimate below uses
                // basicSalary, not grossPay, and the live employee rate from Settings →
                // Tax Rate Builder rather than a hardcoded percentage. Computed before the
                // income tax estimate below, which needs it (Tier 1 is a pre-tax deduction).
                const ssnitEnrolled = (e as any).ssnitEnrolled === true;
                const ssnitAmount = latestPayrollRecord?.deductions?.socialSecurity || 0;
                const ssnitDisplayAmount = ssnitEnrolled ? (ssnitAmount > 0 ? ssnitAmount : (basicSalary * ((tier1Rule?.rate ?? 5.5) / 100))) : 0;

                // Income tax estimate: same "use the real rule, not a guessed flat rate"
                // standard as the SSNIT/Tier2 estimates above -- previously a flat 10% of
                // gross regardless of income level, inconsistent with those. Runs the same
                // live PAYE rule through the same compliance engine invoices/folios use,
                // on taxable pay (gross less the pre-tax Tier 1 contribution).
                const incomeTaxEnrolled = (e as any).payeEnrolled !== false;
                const incomeTaxAmount = latestPayrollRecord?.deductions?.tax || 0;
                const payeTaxableEstimate = Math.max(0, grossPay - ssnitDisplayAmount);
                const payeEstimate = useComplianceStore
                  .getState()
                  .calculateTax(payeTaxableEstimate, 'PAYE', { domain: 'payroll', operation: 'internal' })
                  .taxes.reduce((s, t) => s + t.amount, 0);
                const incomeTaxDisplayAmount = incomeTaxEnrolled ? (incomeTaxAmount > 0 ? incomeTaxAmount : payeEstimate) : 0;

                // Tier 2 is its own separate, fully-employer-funded rule (0% employee rate
                // by default) — deductions.pension carries the real amount from the payroll
                // engine once a record exists (see PayrollBuilderPanel.tsx).
                const tier2Enrolled = (e as any).tier2Enrolled === true;
                const tier2Amount = latestPayrollRecord?.deductions?.pension || 0;
                const tier2DisplayAmount = tier2Enrolled ? (tier2Amount > 0 ? tier2Amount : (basicSalary * ((tier2Rule?.rate ?? 0) / 100))) : 0;

                // Tier 3 is a real, employee-elected voluntary deduction. Before any payroll
                // run exists there's no historical record to read, so estimate from the
                // employee's own configured contribution rate rather than a guessed flat rate.
                const tier3Enrolled = (e as any).tier3Enrolled === true;
                const tier3Pct = Number((e as any).tier3ContributionPct || 0);
                const tier3EstimatedAmount = grossPay * (tier3Pct / 100);
                const tier3DisplayAmount = tier3Enrolled ? tier3EstimatedAmount : 0;

                return (
                  <TableRow key={e.id}>
                    <TableCell className={visibleColumns.has('idNo') ? '' : 'hidden'}>{(e as any).governmentIds?.nationalId || '-'}</TableCell>
                    <TableCell className={visibleColumns.has('staffNo') ? '' : 'hidden'}>{e.employeeNumber}</TableCell>
                    <TableCell className={visibleColumns.has('name') ? '' : 'hidden'}>{e.firstName} {e.lastName}</TableCell>
                    <TableCell className={visibleColumns.has('department') ? '' : 'hidden'}>{dept?.name || '-'}</TableCell>
                    <TableCell className={visibleColumns.has('position') ? '' : 'hidden'}>{pos?.title || '-'}</TableCell>
                    <TableCell className={visibleColumns.has('residencyClass') ? '' : 'hidden'}>{((e as any).residencyStatus || 'resident').replace('_', ' ')} / {((e as any).employmentClass || 'regular').replace('_', ' ')}</TableCell>
                    <TableCell className={visibleColumns.has('status') ? '' : 'hidden'}><Chip size="sm" variant="flat" color={e.status === 'active' ? 'success' : e.status === 'on_leave' ? 'warning' : 'default'}>{e.status}</Chip></TableCell>
                    <TableCell className={visibleColumns.has('type') ? '' : 'hidden'}>{e.employmentType}</TableCell>
                    <TableCell className={visibleColumns.has('basicSalary') ? '' : 'hidden'}>{(e as any).basicSalary ?? salary}</TableCell>
                    <TableCell className={visibleColumns.has('allowances') ? '' : 'hidden'}>{(e as any).allowances ?? 0}</TableCell>
                    <TableCell className={visibleColumns.has('secondEmployment') ? '' : 'hidden'}>{(e as any).secondEmployment ? 'Y' : 'N'}</TableCell>
                    <TableCell className={visibleColumns.has('incomeTax') ? '' : 'hidden'}>{fmtCurrency(incomeTaxDisplayAmount)}</TableCell>
                    <TableCell className={visibleColumns.has('socialSecurity') ? '' : 'hidden'}>{fmtCurrency(ssnitDisplayAmount)}</TableCell>
                    <TableCell className={visibleColumns.has('tier2') ? '' : 'hidden'}>{fmtCurrency(tier2DisplayAmount)}</TableCell>
                    <TableCell className={visibleColumns.has('tier3') ? '' : 'hidden'}>{fmtCurrency(tier3DisplayAmount)}</TableCell>
                    <TableCell className={visibleColumns.has('actions') ? '' : 'hidden'}>
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => setDetailEmployee({
                          employee: e,
                          deptName: dept?.name,
                          posTitle: pos?.title,
                          latestPayrollRecord,
                          grossPay,
                          incomeTaxEnrolled,
                          incomeTaxDisplayAmount,
                          ssnitEnrolled,
                          ssnitDisplayAmount,
                          tier2Enrolled,
                          tier2DisplayAmount,
                          tier3Enrolled,
                          tier3DisplayAmount,
                        })}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Payment Advice (Summary)</div>
        </CardHeader>
        <CardBody>
          {(() => {
            type GroupRow = { label: string; count: number; total: number };
            const groups: Record<string, GroupRow> = {};
            const ensure = (key: string, label?: string) => { if (!groups[key]) groups[key] = { label: label || key, count: 0, total: 0 }; return groups[key]; };
            (employees || []).forEach((emp: any) => {
              const rec = latestPaidRecordByEmployee[emp.id];
              // Same "no real record, no fabricated figure" rule as buildAdviceForLabel --
              // this summary must match what the actual advice document shows.
              if (!rec) return;
              const channel = resolvePaymentChannel(emp, rec);
              const g = ensure(channel);
              g.count += 1; g.total += rec.netPay;
            });
            const rows = Object.values(groups).sort((a, b) => a.label.localeCompare(b.label));
            const grand = rows.reduce((s, r) => s + r.total, 0);
            return (
              <Table aria-label="payment-advice-summary" className="overflow-x-auto">
                <TableHeader>
                  <TableColumn>PAYEE / CHANNEL</TableColumn>
                  <TableColumn>NO. OF STAFF</TableColumn>
                  <TableColumn>TOTAL AMOUNT (GHS)</TableColumn>
                  <TableColumn>AMOUNT IN WORDS</TableColumn>
                </TableHeader>
                <TableBody>
                  {[
                    ...rows.map((r) => (
                      <TableRow key={r.label} className="cursor-pointer hover:bg-gray-50" onClick={() => handleOpenAdvice(r.label)}>
                        <TableCell>{r.label}</TableCell>
                        <TableCell>{r.count}</TableCell>
                        <TableCell>{fmtCurrency(r.total)}</TableCell>
                        <TableCell>{amountToWordsGhana(r.total)}</TableCell>
                      </TableRow>
                    )),
                    <TableRow key="__total">
                      <TableCell><strong>TOTAL</strong></TableCell>
                      <TableCell><strong>{rows.reduce((s, r) => s + r.count, 0)}</strong></TableCell>
                      <TableCell><strong>{fmtCurrency(grand)}</strong></TableCell>
                      <TableCell><strong>{amountToWordsGhana(grand)}</strong></TableCell>
                    </TableRow>,
                  ]}
                </TableBody>
              </Table>
            );
          })()}
        </CardBody>
      </Card>

      {/* Column visibility modal */}
      <Modal isOpen={showColumns} onOpenChange={setShowColumns} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Show / Hide Columns</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    { key: 'idNo', label: 'ID No.' },
                    { key: 'staffNo', label: 'Staff No.' },
                    { key: 'name', label: 'Name' },
                    { key: 'department', label: 'Department' },
                    { key: 'position', label: 'Position' },
                    { key: 'residencyClass', label: 'Residency / Class' },
                    { key: 'status', label: 'Status' },
                    { key: 'type', label: 'Type' },
                    { key: 'basicSalary', label: 'Basic Salary' },
                    { key: 'allowances', label: 'Allowances' },
                    { key: 'secondEmployment', label: 'Second Employ' },
                    { key: 'incomeTax', label: 'Income Tax' },
                    { key: 'socialSecurity', label: 'Social Security' },
                    { key: 'tier2', label: 'Tier 2' },
                    { key: 'tier3', label: 'Tier 3' },
                    { key: 'actions', label: 'Actions' },
                  ].map(col => (
                    <Checkbox key={col.key} isSelected={visibleColumns.has(col.key)} onValueChange={(checked) => toggleColumn(col.key, checked)}>
                      {col.label}
                    </Checkbox>
                  ))}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setShowColumns(false)}>Close</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Payment Advice detail modal */}
      <Modal isOpen={adviceOpen} onOpenChange={setAdviceOpen} size="2xl">
        <ModalContent className="max-w-[550px] h-[85vh]">
          {() => {
            const label = adviceLabel || '';
            const { rows, total, monthLabel } = label ? buildAdviceForLabel(label) : { rows: [], total: 0, monthLabel: '' } as any;
            return (
              <>
                <ModalHeader>Salary Payment Advice - {label}</ModalHeader>
                <ModalBody>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div><strong>Month:</strong> {monthLabel}</div>
                    <div><strong>Bank/Channel:</strong> {label}</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    <Input label="Signer Name" size="sm" value={signerName} onChange={(e) => setSignerName(e.target.value)} variant="bordered" />
                    <Input label="Signer Position" size="sm" value={signerPosition} onChange={(e) => setSignerPosition(e.target.value)} variant="bordered" />
                  </div>
                  <div className="text-sm text-gray-700 mt-3">
                    Please pay the underlisted staff of {hotelName} their net salaries via {label} for {monthLabel}.
                  </div>
                  <div className="mt-3 max-h-[75vh] overflow-y-auto">
                    <Table aria-label="payment-advice-detail">
                      <TableHeader>
                        <TableColumn className="w-[12%] text-center">NO.</TableColumn>
                        <TableColumn className="w-[40%] pr-8">NAME</TableColumn>
                        <TableColumn className="w-[30%]">ACCOUNT / WALLET</TableColumn>
                        <TableColumn className="w-[18%] text-right">NET (GHS)</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="w-[12%] text-center">{idx + 1}</TableCell>
                            <TableCell className="w-[40%] pr-8">{r.employeeName}</TableCell>
                            <TableCell className="w-[30%]">{r.accountNumber}</TableCell>
                            <TableCell className="w-[18%] text-right">{fmtCurrency(r.net)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell>{' '}</TableCell>
                          <TableCell><strong>Total</strong></TableCell>
                          <TableCell>{' '}</TableCell>
                          <TableCell className="text-right"><strong>{fmtCurrency(total)}</strong></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={4}><em>Amount in words: {amountToWordsGhana(total)}</em></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <div className="flex items-center gap-2">
                    <Button variant="flat" onPress={() => setAdviceOpen(false)}>Close</Button>
                    {label && (
                      <>
                        <Button variant="flat" onPress={() => handleDownloadAdvicePdf(label)}>Download PDF</Button>
                        <Button variant="flat" onPress={() => handleDownloadAdviceXls(label)}>Download XLS</Button>
                      </>
                    )}
                  </div>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>

      {/* Employee payroll detail modal (Staff Payroll table's "View" action) */}
      <Modal isOpen={!!detailEmployee} onOpenChange={(open) => { if (!open) setDetailEmployee(null); }} size="2xl">
        <ModalContent>
          {detailEmployee && (() => {
            const { employee: e, deptName, posTitle, latestPayrollRecord: rec } = detailEmployee;
            return (
              <>
                <ModalHeader>{e.firstName} {e.lastName} — Payroll</ModalHeader>
                <ModalBody>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500">Staff No.</p><p className="font-medium">{e.employeeNumber}</p></div>
                    <div><p className="text-gray-500">Department / Position</p><p className="font-medium">{deptName || '-'} / {posTitle || '-'}</p></div>
                    <div><p className="text-gray-500">Basic salary</p><p className="font-medium">{fmtCurrency((e as any).basicSalary ?? (e as any).salary ?? 0)}</p></div>
                    <div><p className="text-gray-500">Allowances</p><p className="font-medium">{fmtCurrency((e as any).allowances ?? 0)}</p></div>
                  </div>

                  {rec ? (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                        Last paid run{rec.paidAt ? ` — ${new Date(rec.paidAt).toLocaleDateString()}` : ''}
                      </p>
                      <Table removeWrapper aria-label="Latest payroll record" className="text-sm">
                        <TableHeader>
                          <TableColumn>Item</TableColumn>
                          <TableColumn className="text-right">Amount (GHS)</TableColumn>
                        </TableHeader>
                        <TableBody>
                          <TableRow><TableCell>Gross pay</TableCell><TableCell className="text-right">{fmtCurrency(rec.grossPay)}</TableCell></TableRow>
                          <TableRow><TableCell>Income tax</TableCell><TableCell className="text-right">{fmtCurrency(rec.deductions?.tax || 0)}</TableCell></TableRow>
                          <TableRow><TableCell>{tier1Label}</TableCell><TableCell className="text-right">{fmtCurrency(rec.deductions?.socialSecurity || 0)}</TableCell></TableRow>
                          <TableRow><TableCell>{tier2Label}</TableCell><TableCell className="text-right">{fmtCurrency(rec.deductions?.pension || 0)}</TableCell></TableRow>
                          <TableRow><TableCell>{tier3Label}</TableCell><TableCell className="text-right">{fmtCurrency(rec.deductions?.tier3 || 0)}</TableCell></TableRow>
                          <TableRow><TableCell>Other deductions</TableCell><TableCell className="text-right">{fmtCurrency(rec.deductions?.other || 0)}</TableCell></TableRow>
                          <TableRow className="font-semibold"><TableCell>Net pay</TableCell><TableCell className="text-right">{fmtCurrency(rec.netPay)}</TableCell></TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      No paid payroll run recorded yet for this employee. The Income Tax / {tier1Label} / {tier2Label} figures shown in the
                      Staff Payroll table are pre-run estimates from live rates, not an actual calculated result.
                    </div>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={() => setDetailEmployee(null)}>Close</Button>
                </ModalFooter>
              </>
            );
          })()}
        </ModalContent>
      </Modal>
    </div>
  );
}



