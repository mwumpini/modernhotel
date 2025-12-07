'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Select, SelectItem, Chip, Input, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Checkbox } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { usePayrollStore } from '@/app/lib/hr/payrollStore';
import { amountToWordsGhana, generatePaymentAdvicePDF } from '@/app/lib/hr/payrollPdf';

export default function PayrollProcessingPanel() {
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const positions = useEmployeeStore((s) => s.positions);
  const getDepartment = useEmployeeStore((s) => s.getDepartment);
  const getPosition = useEmployeeStore((s) => s.getPosition);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);

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

  const handleOpenAdvice = (label: string) => {
    setAdviceLabel(label);
    setAdviceOpen(true);
  };

  const buildAdviceForLabel = (label: string) => {
    const latestByEmp: Record<string, any> = {};
    payrollRecords
      .filter(r => r.status === 'paid')
      .sort((a, b) => (b.paidAt?.getTime() || 0) - (a.paidAt?.getTime() || 0))
      .forEach((r) => { if (!latestByEmp[r.employeeId]) latestByEmp[r.employeeId] = r; });

    const lowerIncludes = (s: string | undefined, term: string) => (s || '').toLowerCase().includes(term);
    type Row = { employeeName: string; accountNumber: string; net: number; paidAt?: Date };
    const rows: Row[] = [];
    (employees || []).forEach((emp: any) => {
      const rec = latestByEmp[emp.id];
      const bankNameRaw = emp?.bankAccount?.bankName || '';
      const payMethod = rec?.paymentMethod || '';
      let channel = '';
      if (payMethod === 'cash') channel = 'Cash';
      else if (lowerIncludes(bankNameRaw, 'momo') || lowerIncludes(bankNameRaw, 'mobile') || lowerIncludes(bankNameRaw, 'mtn') || lowerIncludes(bankNameRaw, 'vodafone') || lowerIncludes(bankNameRaw, 'airtel') || payMethod === 'momo') channel = 'MoMo';
      else if (bankNameRaw) channel = bankNameRaw;
      else channel = 'Cash';
      if (channel !== label) return;

      const gross = (emp.basicSalary ?? emp.salary ?? 0) + (emp.allowances ?? 0);
      const net = typeof rec?.netPay === 'number' ? rec.netPay : Math.max(gross - (gross * 0.155), 0);
      const accountNumber = label === 'MoMo' ? (emp.phone || emp?.bankAccount?.accountNumber || '') : (label === 'Cash' ? '-' : (emp?.bankAccount?.accountNumber || ''));
      rows.push({ employeeName: `${emp.firstName} ${emp.lastName}`, accountNumber, net, paidAt: rec?.paidAt });
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
      hotelName: 'Noda Hotel Ltd.',
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
  <div class="title">Noda Hotel Ltd.</div>
  <div class="subtitle">Salary Payment Advice - ${label}</div>
  <div class="subtitle">${monthLabel}</div>
  <div class="meta"><b>Signer Name:</b> ${signerName || 'Authorized Signatory'}</div>
  <div class="meta"><b>Signer Position:</b> ${signerPosition || 'Finance Manager'}</div>
  <div class="meta"><b>Date Printed:</b> ${printed}</div>
  <div class="intro">Please pay the underlisted staff of Noda Hotel Ltd. their net salaries via ${label} for ${monthLabel}. The total amount is GHS ${total.toFixed(2)} (${words}).</div>
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
              <TableColumn className={visibleColumns.has('socialSecurity') ? '' : 'hidden'}>Social Security</TableColumn>
              <TableColumn className={visibleColumns.has('tier2') ? '' : 'hidden'}>TIER 2</TableColumn>
              <TableColumn className={visibleColumns.has('tier3') ? '' : 'hidden'}>TIER 3</TableColumn>
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

                const latestPayrollRecord = payrollRecords
                  .filter(r => r.employeeId === e.id && r.status === 'paid')
                  .sort((a, b) => (b.paidAt?.getTime() || 0) - (a.paidAt?.getTime() || 0))[0];

                const incomeTaxEnrolled = (e as any).payeEnrolled !== false;
                const incomeTaxAmount = latestPayrollRecord?.deductions?.tax || 0;
                const incomeTaxDisplayAmount = incomeTaxEnrolled ? (incomeTaxAmount > 0 ? incomeTaxAmount : (grossPay * 0.1)) : 0;

                const ssnitEnrolled = (e as any).ssnitEnrolled === true;
                const ssnitAmount = latestPayrollRecord?.deductions?.socialSecurity || 0;
                const ssnitDisplayAmount = ssnitEnrolled ? (ssnitAmount > 0 ? ssnitAmount : (grossPay * 0.055)) : 0;

                const tier2Enrolled = (e as any).tier2Enrolled === true;
                const tier2Amount = latestPayrollRecord?.deductions?.pension || 0;
                const tier2DisplayAmount = tier2Enrolled ? (tier2Amount > 0 ? tier2Amount : (grossPay * 0.05)) : 0;

                const tier3Enrolled = (e as any).tier3Enrolled === true;
                const tier3AmountValue = latestPayrollRecord?.deductions?.other || 0;
                const tier3DisplayAmount = tier3Enrolled ? (tier3AmountValue > 0 ? tier3AmountValue : 0) : 0;

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
                      <Button size="sm" variant="flat" isDisabled>View</Button>
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
            const latestByEmp: Record<string, any> = {};
            payrollRecords
              .filter(r => r.status === 'paid')
              .sort((a, b) => (b.paidAt?.getTime() || 0) - (a.paidAt?.getTime() || 0))
              .forEach((r) => { if (!latestByEmp[r.employeeId]) latestByEmp[r.employeeId] = r; });
            type GroupRow = { label: string; count: number; total: number };
            const groups: Record<string, GroupRow> = {};
            const ensure = (key: string, label?: string) => { if (!groups[key]) groups[key] = { label: label || key, count: 0, total: 0 }; return groups[key]; };
            const lowerIncludes = (s: string | undefined, term: string) => (s || '').toLowerCase().includes(term);
            (employees || []).forEach((emp: any) => {
              const rec = latestByEmp[emp.id];
              const bankNameRaw = emp?.bankAccount?.bankName || '';
              const payMethod = rec?.paymentMethod || '';
              let channel = '';
              if (payMethod === 'cash') channel = 'Cash';
              else if (lowerIncludes(bankNameRaw, 'momo') || lowerIncludes(bankNameRaw, 'mobile') || lowerIncludes(bankNameRaw, 'mtn') || lowerIncludes(bankNameRaw, 'vodafone') || lowerIncludes(bankNameRaw, 'airtel') || payMethod === 'momo') channel = 'MoMo';
              else if (bankNameRaw) channel = bankNameRaw;
              else channel = 'Cash';
              const gross = (emp.basicSalary ?? emp.salary ?? 0) + (emp.allowances ?? 0);
              const net = typeof rec?.netPay === 'number' ? rec.netPay : Math.max(gross - (gross * 0.155), 0);
              const g = ensure(channel);
              g.count += 1; g.total += net;
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
                  {rows.map((r) => (
                    <TableRow key={r.label} className="cursor-pointer hover:bg-gray-50" onClick={() => handleOpenAdvice(r.label)}>
                      <TableCell>{r.label}</TableCell>
                      <TableCell>{r.count}</TableCell>
                      <TableCell>{fmtCurrency(r.total)}</TableCell>
                      <TableCell>{amountToWordsGhana(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell><strong>TOTAL</strong></TableCell>
                    <TableCell><strong>{rows.reduce((s, r) => s + r.count, 0)}</strong></TableCell>
                    <TableCell><strong>{fmtCurrency(grand)}</strong></TableCell>
                    <TableCell><strong>{amountToWordsGhana(grand)}</strong></TableCell>
                  </TableRow>
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
                    Please pay the underlisted staff of Noda Hotel Ltd. their net salaries via {label} for {monthLabel}.
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
                        {rows.map((r, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="w-[12%] text-center">{idx + 1}</TableCell>
                            <TableCell className="w-[40%] pr-8">{r.employeeName}</TableCell>
                            <TableCell className="w-[30%]">{r.accountNumber}</TableCell>
                            <TableCell className="w-[18%] text-right">{fmtCurrency(r.net)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell></TableCell>
                          <TableCell><strong>Total</strong></TableCell>
                          <TableCell></TableCell>
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
    </div>
  );
}



