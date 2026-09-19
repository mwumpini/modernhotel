'use client';

import React from 'react';
import { Tooltip, Card, CardHeader, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Select, SelectItem, Chip, Input, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Checkbox, Tabs, Tab } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { usePayrollStore, payrollRecordLabels } from '@/app/lib/hr/payrollStore';
import { todayKey } from '@/app/lib/hr/leaveDates';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { amountToWordsGhana, generatePaymentAdvicePDF } from '@/app/lib/hr/payrollPdf';
import { useSettingsStore } from '@/app/lib/settings/store';
import { useSectionExport } from '@/app/lib/export/useSectionExport';
import { useCurrentUserName } from '@/app/lib/auth/useCurrentUserName';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { useLeaveAttendanceStore } from '@/app/lib/hr/leaveAttendanceStore';
import UniversalPayrollBuilder from '@/app/lib/payroll/builder';
import { prepareBuilderForRun, runMonthlyPayroll } from '@/app/lib/payroll/monthlyRun';
import { notifyError, notifySuccess } from '@/app/lib/notifications/notify';
import ExportButtons from '@/app/components/ExportButtons';
import type { PayrollPeriod, PayrollRecord } from '@/app/lib/hr/models';
import type { ExportFormat } from '@/app/lib/frontoffice/reportExportFormat';

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

// Shared by the PDF and XLS payment advice so both show the same bank/MoMo logo.
function bankLogoUrlFor(label: string): string | undefined {
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
}

export default function PayrollProcessingPanel() {
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const positions = useEmployeeStore((s) => s.positions);
  const getDepartment = useEmployeeStore((s) => s.getDepartment);
  const getPosition = useEmployeeStore((s) => s.getPosition);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);
  const payrollPeriods = usePayrollStore((s) => s.payrollPeriods);
  const approvePeriod = usePayrollStore((s) => s.approvePeriod);
  const markRecordsPaid = usePayrollStore((s) => s.markRecordsPaid);
  const canApprovePayroll = useSettingsStore((s) => s.hasPermission('hr.approve-payroll'));
  const currentUserName = useCurrentUserName();
  // Each tab has its own month. '' means "the default": Staff Payroll opens on the first month
  // still awaiting approval, Payment Advice on the oldest approved month still to be paid.
  const [workKey, setWorkKey] = React.useState<string>('');
  const [adviceKey, setAdviceKey] = React.useState<string>('');
  const [historyKey, setHistoryKey] = React.useState<string>('');
  const [confirm, setConfirm] = React.useState<null | 'approve'>(null);
  // Which batch is being marked paid: one payment channel, or every channel at once.
  const [payTarget, setPayTarget] = React.useState<null | 'all' | string>(null);
  const [payDate, setPayDate] = React.useState<string>('');
  const [prepOpen, setPrepOpen] = React.useState(false);
  const [prepMonth, setPrepMonth] = React.useState<number>(new Date().getMonth() + 1);
  const [prepYear, setPrepYear] = React.useState<number>(new Date().getFullYear());
  const [prepError, setPrepError] = React.useState('');
  const taxRules = useComplianceStore((s) => s.taxRules);
  const hotelName = useSettingsStore((s) => s.hotelSettings.hotelName) || 'Hotel';
  const exportFile = useSectionExport();
  const [activeTab, setActiveTab] = React.useState<string>('staff');

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
    // Preparing a month pulls in the HR-approved overtime, which lives in the attendance store.
    void useLeaveAttendanceStore.getState().hydrateFromApi();
  }, []);

  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [deptFilter, setDeptFilter] = React.useState<string>('all');
  const [q, setQ] = React.useState<string>('');
  const defaultColumns = ['staffNo', 'name', 'department', 'position', 'basicSalary', 'allowances', 'overtime', 'gross', 'incomeTax', 'socialSecurity', 'tier2', 'tier3', 'net', 'payStatus', 'actions'];
  const [showColumns, setShowColumns] = React.useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(new Set(defaultColumns));
  const toggleColumn = (key: string, checked: boolean) => {
    setVisibleColumns(prev => { const next = new Set(prev); if (checked) next.add(key); else next.delete(key); return next; });
  };

  // Payment Advice detail modal state
  const [adviceOpen, setAdviceOpen] = React.useState<boolean>(false);
  const [adviceLabel, setAdviceLabel] = React.useState<string | null>(null);
  const [signerName, setSignerName] = React.useState<string>('');
  const [signerPosition, setSignerPosition] = React.useState<string>('');

  // Employee payroll detail modal state (Staff Payroll table's "View" action)
  const [detailRow, setDetailRow] = React.useState<any | null>(null);

  const handleOpenAdvice = (label: string) => {
    setAdviceLabel(label);
    setAdviceOpen(true);
  };

  const buildAdviceForLabel = (label: string) => {
    type Row = { employeeName: string; accountNumber: string; net: number; paidAt?: Date };
    const rows: Row[] = [];
    // A staff member with no record in the chosen month has no accurate net pay to instruct a
    // bank/MoMo payment with, so they're simply not listed — never filled in with a guess.
    adviceRecords.forEach((rec) => {
      if (channelOf(rec) !== label) return;
      const emp: any = empById.get(rec.employeeId);
      const accountNumber = label === 'MoMo'
        ? (emp?.phone || emp?.bankAccount?.accountNumber || rec.bankAccount || '')
        : label === 'Cash' ? '-' : (emp?.bankAccount?.accountNumber || rec.bankAccount || '');
      rows.push({ employeeName: rec.employeeName, accountNumber, net: rec.netPay, paidAt: rec.paidAt });
    });
    rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    const total = rows.reduce((sum, r) => sum + (r.net || 0), 0);
    return { rows, total, monthLabel: advicePeriod ? periodMonth(advicePeriod) : '' };
  };

  const handleDownloadAdvicePdf = async (label: string) => {
    const { rows, monthLabel } = buildAdviceForLabel(label);
    const companyLogoUrl = '/logo.png';
    const bankLogoUrl = bankLogoUrlFor(label);
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
    const bankLogoUrl = bankLogoUrlFor(label) ?? '';
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

  const fmtCurrency = (n: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(n || 0);
  const fmtDay = (d?: Date | string) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

  // ---- Months ----
  const periodMonth = (p: PayrollPeriod) => {
    const m = /(\d{4})-(\d{2})/.exec(p.periodNumber);
    return m
      ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : new Date(p.startDate).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  };
  const periodStage = (p: PayrollPeriod): 'paid' | 'approved' | 'awaiting' | 'draft' =>
    p.status === 'paid' || p.status === 'closed' ? 'paid' : p.status === 'approved' ? 'approved' : p.status === 'draft' ? 'draft' : 'awaiting';
  const STAGE_LABEL = { paid: 'Paid', approved: 'Approved, not yet paid', awaiting: 'Awaiting approval', draft: 'Draft' } as const;
  const sortedPeriods = [...payrollPeriods].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  // Where a month lives: being prepared → Staff Payroll; approved → Payment Advice (to pay) and History.
  const inProgress = sortedPeriods.filter((p) => periodStage(p) === 'awaiting' || periodStage(p) === 'draft');
  const approvedPeriods = sortedPeriods.filter((p) => periodStage(p) === 'approved' || periodStage(p) === 'paid');
  const empById = new Map(employees.map((e) => [e.id, e]));

  const workSelected = workKey || inProgress[0]?.id || 'estimate';
  const workPeriod = inProgress.find((p) => p.id === workSelected);
  // Advice opens on the oldest month still waiting to be paid, else the latest one.
  const adviceDefault = [...approvedPeriods].reverse().find((p) => periodStage(p) === 'approved') ?? approvedPeriods[0];
  const adviceSelected = adviceKey || adviceDefault?.id || '';
  const advicePeriod = approvedPeriods.find((p) => p.id === adviceSelected);
  const historyPeriod = approvedPeriods.find((p) => p.id === historyKey);

  // ---- One row per person: real figures for a processed month, estimates otherwise ----
  type PayStatus = 'estimate' | 'pending' | 'processed' | 'approved' | 'paid' | 'failed';
  interface Row {
    key: string; e?: (typeof employees)[number]; staffNo: string; name: string; deptName: string; posTitle: string;
    basic: number; allowances: number; overtime: number; gross: number;
    tax: number; tier1: number; tier2: number; tier3: number; other: number; net: number;
    pay: PayStatus; paidAt?: Date; record?: PayrollRecord;
  }

  const buildRows = (p?: PayrollPeriod): Row[] => {
    if (p) {
      const st = periodStage(p);
      return payrollRecords.filter((r) => r.payrollPeriodId === p.id).map((r) => {
        const e = empById.get(r.employeeId);
        const labels = payrollRecordLabels(r);
        const pay: PayStatus = r.status === 'paid' ? 'paid' : r.status === 'failed' ? 'failed' : r.status === 'pending' ? 'pending' : st === 'approved' || st === 'paid' ? 'approved' : 'processed';
        return {
          key: r.id, e, staffNo: r.employeeNumber, name: r.employeeName, deptName: labels.department, posTitle: labels.position,
          basic: r.basicSalary, allowances: r.allowances, overtime: r.overtimePay + (r.bonuses || 0), gross: r.grossPay,
          tax: r.deductions.tax, tier1: r.deductions.socialSecurity, tier2: r.deductions.pension, tier3: r.deductions.tier3 || 0,
          other: (r.deductions.other || 0) + (r.deductions.healthInsurance || 0), net: r.netPay,
          pay, paidAt: r.paidAt, record: r,
        };
      });
    }
    return employees.map((e) => {
      const salary = (e as any).salary ?? (e as any).baseSalary ?? 0;
      const basic = (e as any).basicSalary ?? salary;
      const allowances = (e as any).allowances ?? 0;
      const gross = basic + allowances;
      // Tier 1's base is basic salary only (allowances/bonus/overtime excluded per its
      // insurable-earnings definition), at the live rate from Settings → Tax Rate Builder.
      // It is a pre-tax deduction, so it comes off before PAYE is estimated.
      const tier1 = (e as any).ssnitEnrolled === true ? basic * ((tier1Rule?.rate ?? 5.5) / 100) : 0;
      // PAYE runs the same live rule through the same compliance engine the payroll run uses.
      const tax = (e as any).payeEnrolled !== false
        ? useComplianceStore.getState().calculateTax(Math.max(0, gross - tier1), 'PAYE', { domain: 'payroll', operation: 'internal' }).taxes.reduce((s, t) => s + t.amount, 0)
        : 0;
      // Tier 2 is a separate, fully employer-funded rule (0% employee rate by default).
      const tier2 = (e as any).tier2Enrolled === true ? basic * ((tier2Rule?.rate ?? 0) / 100) : 0;
      // Tier 3 is the employee's own voluntary rate.
      const tier3 = (e as any).tier3Enrolled === true ? gross * (Number((e as any).tier3ContributionPct || 0) / 100) : 0;
      return {
        key: e.id, e, staffNo: e.employeeNumber, name: `${e.firstName} ${e.lastName}`, deptName: getDepartment(e.departmentId)?.name || '-', posTitle: getPosition(e.positionId)?.title || '-',
        basic, allowances, overtime: 0, gross, tax, tier1, tier2, tier3, other: 0, net: gross - tax - tier1 - tier2 - tier3,
        pay: 'estimate' as PayStatus,
      };
    });
  };
  const applyFilters = (rows: Row[]) => rows.filter((r) => {
    const sOk = statusFilter === 'all' || r.e?.status === statusFilter;
    const dOk = deptFilter === 'all' || r.e?.departmentId === deptFilter;
    const qOk = !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.staffNo || '').toLowerCase().includes(q.toLowerCase());
    return sOk && dOk && qOk;
  });

  const PAY_CHIP: Record<PayStatus, { label: string; color: 'default' | 'success' | 'warning' | 'danger' | 'primary' }> = {
    paid: { label: 'Paid', color: 'success' },
    approved: { label: 'Approved', color: 'primary' },
    processed: { label: 'Awaiting approval', color: 'warning' },
    pending: { label: 'Pending', color: 'default' },
    failed: { label: 'Failed', color: 'danger' },
    estimate: { label: 'Estimate', color: 'default' },
  };

  // `value` is the plain figure used for export; `render` (optional) is how the table shows it.
  const columns: Array<{ key: string; label: string; money?: boolean; value: (r: Row) => string | number; render?: (r: Row) => React.ReactNode }> = [
    { key: 'idNo', label: 'ID No.', value: (r) => (r.e as any)?.governmentIds?.nationalId || '-' },
    { key: 'staffNo', label: 'Staff No.', value: (r) => r.staffNo },
    { key: 'name', label: 'Name', value: (r) => r.name },
    { key: 'department', label: 'Department', value: (r) => r.deptName },
    { key: 'position', label: 'Position', value: (r) => r.posTitle },
    { key: 'residencyClass', label: 'Residency / Class', value: (r) => (r.e ? `${((r.e as any).residencyStatus || 'resident').replace('_', ' ')} / ${((r.e as any).employmentClass || 'regular').replace('_', ' ')}` : '-') },
    { key: 'status', label: 'Employee status', value: (r) => r.e?.status || '-', render: (r) => (r.e ? <Chip size="sm" variant="flat" color={r.e.status === 'active' ? 'success' : r.e.status === 'on_leave' ? 'warning' : 'default'}>{r.e.status}</Chip> : '-') },
    { key: 'type', label: 'Type', value: (r) => r.e?.employmentType || '-' },
    { key: 'secondEmployment', label: 'Second Employ', value: (r) => ((r.e as any)?.secondEmployment ? 'Y' : 'N') },
    { key: 'basicSalary', label: 'Basic Salary', money: true, value: (r) => r.basic, render: (r) => fmtCurrency(r.basic) },
    { key: 'allowances', label: 'Allowances', money: true, value: (r) => r.allowances, render: (r) => fmtCurrency(r.allowances) },
    { key: 'overtime', label: 'Overtime & bonus', money: true, value: (r) => r.overtime, render: (r) => fmtCurrency(r.overtime) },
    { key: 'gross', label: 'Gross pay', money: true, value: (r) => r.gross, render: (r) => fmtCurrency(r.gross) },
    { key: 'incomeTax', label: 'Income Tax', money: true, value: (r) => r.tax, render: (r) => fmtCurrency(r.tax) },
    { key: 'socialSecurity', label: tier1Label, money: true, value: (r) => r.tier1, render: (r) => fmtCurrency(r.tier1) },
    { key: 'tier2', label: tier2Label, money: true, value: (r) => r.tier2, render: (r) => fmtCurrency(r.tier2) },
    { key: 'tier3', label: tier3Label, money: true, value: (r) => r.tier3, render: (r) => fmtCurrency(r.tier3) },
    { key: 'other', label: 'Other deductions', money: true, value: (r) => r.other, render: (r) => fmtCurrency(r.other) },
    { key: 'net', label: 'Net pay', money: true, value: (r) => r.net, render: (r) => <span className="font-semibold text-green-700">{fmtCurrency(r.net)}</span> },
    { key: 'payStatus', label: 'Payment status', value: (r) => PAY_CHIP[r.pay].label, render: (r) => <Chip size="sm" variant="flat" color={PAY_CHIP[r.pay].color}>{PAY_CHIP[r.pay].label}</Chip> },
    { key: 'paidOn', label: 'Paid on', value: (r) => fmtDay(r.paidAt) || '-' },
  ];
  const shownColumns = columns.filter((c) => visibleColumns.has(c.key));
  const showActions = visibleColumns.has('actions');
  const total = (rows: Row[], key: string) => rows.reduce((s, r) => s + ((columns.find((c) => c.key === key)?.value(r) as number) || 0), 0);

  const paidOnOf = (rows: Row[]) => {
    const t = rows.map((r) => r.paidAt).filter(Boolean).map((d) => new Date(d as Date).getTime());
    return t.length ? new Date(Math.max(...t)) : undefined;
  };
  const statusNoteFor = (p: PayrollPeriod | undefined, rows: Row[]) => {
    if (!p) return 'Estimate at current rates — not yet processed';
    const paid = paidOnOf(rows);
    return `${STAGE_LABEL[periodStage(p)]}${p.approvedBy ? ` · approved by ${p.approvedBy}${p.approvedAt ? ` on ${fmtDay(p.approvedAt)}` : ''}` : ''}${paid ? ` · paid ${fmtDay(paid)}` : ''}`;
  };

  // Exports exactly what's on screen: the month, the current filters and the visible columns,
  // with a totals row and the approval / payment status in the header line.
  const exportStaff = (format: ExportFormat, p: PayrollPeriod | undefined, allRows: Row[]) => {
    const rows = applyFilters(allRows);
    const label = p ? periodMonth(p) : 'Estimate';
    return exportFile(format, `Staff Payroll ${label}`, {
      title: `Staff Payroll — ${label}`,
      columns: shownColumns.map((c) => (c.money ? `${c.label} (GHS)` : c.label)),
      rows: [
        ...rows.map((r) => shownColumns.map((c) => {
          const v = c.value(r);
          return c.money && typeof v === 'number' ? Number(v.toFixed(2)) : v;
        })),
        ...(rows.length > 0 ? [shownColumns.map((c, i) => (c.money ? Number(total(rows, c.key).toFixed(2)) : i === 0 ? 'TOTAL' : ''))] : []),
      ],
    }, statusNoteFor(p, allRows));
  };

  const Step = ({ done, label, detail }: { done: boolean; label: string; detail?: string }) => (
    <div className="flex items-center gap-2">
      <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold ${done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{done ? '✓' : '·'}</span>
      <div className="leading-tight">
        <div className={`text-sm font-medium ${done ? '' : 'text-gray-400'}`}>{label}</div>
        {detail && <div className="text-xs text-gray-500">{detail}</div>}
      </div>
    </div>
  );

  // Processed → Approved → Paid, with who/when, and the month's totals.
  const renderBanner = (p: PayrollPeriod, allRows: Row[], actions?: React.ReactNode) => {
    const st = periodStage(p);
    const gross = allRows.reduce((s, r) => s + r.gross, 0);
    const net = allRows.reduce((s, r) => s + r.net, 0);
    const paidRows = allRows.filter((r) => r.pay === 'paid').length;
    const paid = paidOnOf(allRows);
    return (
      <div className="rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <div className="text-lg font-semibold">{periodMonth(p)}</div>
          <div className="text-xs text-gray-500">{p.periodNumber} · {allRows.length} staff</div>
        </div>
        <Step done label="Processed" detail={[p.processedBy, fmtDay(p.processedAt)].filter(Boolean).join(' · ') || undefined} />
        <Step done={st === 'approved' || st === 'paid'} label={st === 'approved' || st === 'paid' ? 'Approved' : 'Awaiting approval'}
          detail={st === 'approved' || st === 'paid' ? [p.approvedBy, fmtDay(p.approvedAt)].filter(Boolean).join(' · ') || undefined : undefined} />
        <Step done={st === 'paid'} label={st === 'paid' ? 'Paid' : paidRows > 0 ? `Part paid (${paidRows}/${allRows.length})` : 'Not paid'} detail={st === 'paid' ? fmtDay(paid) || undefined : undefined} />
        <div className="flex gap-6 text-sm ml-auto">
          <div><div className="text-xs text-gray-500">Gross pay</div><div className="font-medium">{fmtCurrency(gross)}</div></div>
          <div><div className="text-xs text-gray-500">Deductions</div><div className="font-medium">{fmtCurrency(gross - net)}</div></div>
          <div><div className="text-xs text-gray-500">Net pay</div><div className="text-lg font-semibold text-green-700">{fmtCurrency(net)}</div></div>
        </div>
        {actions}
      </div>
    );
  };

  // The per-person table, shared by Staff Payroll (month being prepared) and History (a past month).
  const renderTable = (allRows: Row[], p: PayrollPeriod | undefined) => {
    const rows = applyFilters(allRows);
    const label = p ? periodMonth(p) : 'Estimate';
    return (
      <Table aria-label="staff-payroll" className="overflow-x-auto">
        <TableHeader>
          {[
            ...shownColumns.map((c) => <TableColumn key={c.key}>{c.label.toUpperCase()}</TableColumn>),
            ...(showActions ? [<TableColumn key="actions">ACTIONS</TableColumn>] : []),
          ]}
        </TableHeader>
        <TableBody emptyContent={p ? 'No payroll records for these filters.' : 'No staff match these filters.'}>
          {[
            ...rows.map((r) => (
              <TableRow key={r.key}>
                {[
                  ...shownColumns.map((c) => <TableCell key={c.key}>{c.render ? c.render(r) : c.value(r)}</TableCell>),
                  ...(showActions ? [(
                    <TableCell key="actions">
                      <Button size="sm" variant="flat" onPress={() => setDetailRow({ ...r, month: label })}>View</Button>
                    </TableCell>
                  )] : []),
                ]}
              </TableRow>
            )),
            ...(rows.length > 0 ? [(
              <TableRow key="__total" className="bg-gray-50">
                {[
                  ...shownColumns.map((c, i) => (
                    <TableCell key={c.key}>
                      {c.money ? <strong className={c.key === 'net' ? 'text-green-700' : ''}>{fmtCurrency(total(rows, c.key))}</strong> : i === 0 ? <strong>TOTAL</strong> : ''}
                    </TableCell>
                  )),
                  ...(showActions ? [<TableCell key="actions">{''}</TableCell>] : []),
                ]}
              </TableRow>
            )] : []),
          ]}
        </TableBody>
      </Table>
    );
  };

  const filterBar = (
    <div className="flex items-center gap-2 flex-wrap">
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
  );

  const monthSelect = (
    items: Array<{ id: string; name: string }>, selected: string, onChange: (id: string) => void, className = 'w-72',
  ) => (
    <Select size="sm" aria-label="Payroll month" className={className} variant="bordered" selectedKeys={selected ? [selected] : []} onSelectionChange={(k) => onChange((Array.from(k)[0] as string) || '')} items={items}>
      {(item: any) => <SelectItem key={item.id} textValue={item.name}>{item.name}</SelectItem>}
    </Select>
  );

  // ================= Staff Payroll: the month being prepared =================
  const workRows = buildRows(workPeriod);
  const workItems = [
    ...inProgress.map((p) => ({ id: p.id, name: `${periodMonth(p)} — ${STAGE_LABEL[periodStage(p)]}` })),
    { id: 'estimate', name: 'Preview at current rates (not prepared)' },
  ];

  const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString('en-GB', { month: 'long' }));
  const openPrepare = () => {
    const latest = sortedPeriods[0];
    const m = /(\d{4})-(\d{2})/.exec(latest?.periodNumber || '');
    const next = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]), 1)) : new Date();
    setPrepMonth(m ? next.getUTCMonth() + 1 : next.getMonth() + 1);
    setPrepYear(m ? next.getUTCFullYear() : next.getFullYear());
    setPrepError('');
    setPrepOpen(true);
  };
  const prepNumber = `PP-${prepYear}-${String(prepMonth).padStart(2, '0')}`;
  const prepExisting = payrollPeriods.find((p) => p.periodNumber === prepNumber);
  const activeStaff = employees.filter((e) => e.status === 'active').length;
  const doPrepare = () => {
    setPrepError('');
    try {
      const builder = new UniversalPayrollBuilder();
      const country = useComplianceStore.getState().country;
      const runtimeId = prepareBuilderForRun(builder, country);
      const result = runMonthlyPayroll({ builder, runtimeId, employees, periods: payrollPeriods, month: prepMonth, year: prepYear, userName: currentUserName, complianceCountry: country });
      if (!result.ok) { setPrepError(result.error); return; }
      setPrepOpen(false);
      setActiveTab('staff');
      setWorkKey(result.periodId);
      notifySuccess(`${MONTHS[prepMonth - 1]} ${prepYear} payroll prepared for ${result.employeeCount} staff — review it, then approve.`, 'Payroll prepared');
      if (result.warning) notifyError(result.warning, 'Ledger entry');
    } catch (e: any) {
      console.error('[Payroll] Prepare failed', e);
      setPrepError(e?.message || 'Could not prepare payroll for that month.');
    }
  };

  // Approving is what posts this run's ledger entry — so only once the server has accepted the
  // approval (it can refuse: no permission, or you processed the run yourself). An approved
  // month leaves this screen: it is paid from Payment Advice and kept in History.
  const doApprove = async () => {
    if (!workPeriod) return;
    const p = workPeriod;
    setConfirm(null);
    const approved = await approvePeriod(p.id, currentUserName);
    if (!approved) return;
    try {
      await useAccountingStore.getState().postJournalEntry(`JE-PAYROLL-${p.id}`);
      notifySuccess(`${periodMonth(p)} payroll approved and posted to the ledger — pay it from Payment Advice.`, 'Payroll approved');
    } catch (e) {
      console.warn('[Payroll] Ledger post failed after approval:', e);
      notifyError(`${periodMonth(p)} payroll was approved, but posting it to the ledger failed. Please tell accounting.`, 'Ledger not posted');
    }
    setWorkKey('');
    setAdviceKey(p.id);
    setActiveTab('advice');
  };
  const processedByMe = !!workPeriod?.processedBy && workPeriod.processedBy.trim().toLowerCase() === currentUserName.trim().toLowerCase();

  // ================= Payment Advice: pay the approved month, one bank/MoMo/cash batch at a time =================
  const adviceRecords = advicePeriod ? payrollRecords.filter((r) => r.payrollPeriodId === advicePeriod.id && r.status !== 'failed') : [];
  const channelOf = (rec: PayrollRecord) => resolvePaymentChannel(empById.get(rec.employeeId), rec);
  interface AdviceGroup { label: string; records: PayrollRecord[]; total: number; paid: number; unpaidIds: string[]; paidAt?: Date }
  const adviceGroups: AdviceGroup[] = (() => {
    const groups: Record<string, AdviceGroup> = {};
    adviceRecords.forEach((rec) => {
      const label = channelOf(rec);
      const g = (groups[label] ||= { label, records: [], total: 0, paid: 0, unpaidIds: [] });
      g.records.push(rec);
      g.total += rec.netPay;
      if (rec.status === 'paid') {
        g.paid += 1;
        if (rec.paidAt && (!g.paidAt || new Date(rec.paidAt) > g.paidAt)) g.paidAt = new Date(rec.paidAt);
      } else g.unpaidIds.push(rec.id);
    });
    return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label));
  })();
  const adviceTotal = adviceGroups.reduce((s, g) => s + g.total, 0);
  const adviceCount = adviceGroups.reduce((s, g) => s + g.records.length, 0);
  const adviceUnpaidIds = adviceGroups.flatMap((g) => g.unpaidIds);
  const adviceRows = buildRows(advicePeriod);
  const adviceItems = approvedPeriods.map((p) => ({ id: p.id, name: `${periodMonth(p)} — ${STAGE_LABEL[periodStage(p)]}` }));

  const payGroup = payTarget === 'all' ? undefined : adviceGroups.find((g) => g.label === payTarget);
  const payIds = payTarget === 'all' ? adviceUnpaidIds : payGroup?.unpaidIds ?? [];
  const payAmount = payTarget === 'all'
    ? adviceRecords.filter((r) => r.status !== 'paid').reduce((s, r) => s + r.netPay, 0)
    : adviceRecords.filter((r) => payIds.includes(r.id)).reduce((s, r) => s + r.netPay, 0);
  const doPay = async () => {
    if (!advicePeriod || !payTarget || !payDate || payIds.length === 0) return;
    const p = advicePeriod;
    const n = payIds.length;
    const where = payTarget === 'all' ? 'all channels' : payTarget;
    setPayTarget(null);
    const ok = await markRecordsPaid(p.id, payIds, new Date(`${payDate}T00:00:00`));
    if (ok) notifySuccess(`${n} staff marked as paid (${where}) for ${periodMonth(p)}.`, 'Marked as paid');
  };

  const exportAdviceSummary = (format: ExportFormat) =>
    exportFile(format, `Payment Advice Summary ${advicePeriod ? periodMonth(advicePeriod) : ''}`.trim(), {
      title: `Payment Advice Summary — ${advicePeriod ? periodMonth(advicePeriod) : ''}`,
      columns: ['Payee / Channel', 'No. of Staff', 'Total Amount (GHS)', 'Amount in Words', 'Payment'],
      rows: [
        ...adviceGroups.map((g) => [g.label, g.records.length, Number(g.total.toFixed(2)), amountToWordsGhana(g.total), g.paid === g.records.length ? `Paid ${fmtDay(g.paidAt)}` : g.paid > 0 ? `Part paid (${g.paid}/${g.records.length})` : 'Not paid']),
        ['TOTAL', adviceCount, Number(adviceTotal.toFixed(2)), amountToWordsGhana(adviceTotal), ''],
      ],
    }, advicePeriod ? statusNoteFor(advicePeriod, adviceRows) : undefined);

  // ================= History: every approved month, for looking back =================
  const historyStats = (p: PayrollRecord['payrollPeriodId']) => {
    const recs = payrollRecords.filter((r) => r.payrollPeriodId === p && r.status !== 'failed');
    const paidRecs = recs.filter((r) => r.status === 'paid');
    const paidTimes = paidRecs.map((r) => r.paidAt).filter(Boolean).map((d) => new Date(d as Date).getTime());
    return {
      staff: recs.length,
      gross: recs.reduce((s, r) => s + r.grossPay, 0),
      net: recs.reduce((s, r) => s + r.netPay, 0),
      paid: paidRecs.length,
      paidOn: paidTimes.length ? new Date(Math.max(...paidTimes)) : undefined,
    };
  };
  const exportHistory = (format: ExportFormat) =>
    exportFile(format, 'Payroll History', {
      title: 'Payroll History',
      columns: ['Month', 'Staff', 'Gross pay (GHS)', 'Deductions (GHS)', 'Net pay (GHS)', 'Processed by', 'Approved by', 'Approved on', 'Payment'],
      rows: approvedPeriods.map((p) => {
        const st = historyStats(p.id);
        return [periodMonth(p), st.staff, Number(st.gross.toFixed(2)), Number((st.gross - st.net).toFixed(2)), Number(st.net.toFixed(2)), p.processedBy || '', p.approvedBy || '', fmtDay(p.approvedAt), st.paid === st.staff && st.staff > 0 ? `Paid ${fmtDay(st.paidOn)}` : st.paid > 0 ? `Part paid (${st.paid}/${st.staff})` : 'Not paid'];
      }),
    });
  const historyRows = buildRows(historyPeriod);

  const approveButton = workPeriod && (
    <Tooltip content="Needs the payroll-approval permission" isDisabled={canApprovePayroll}>
      <span><Button color="primary" isDisabled={!canApprovePayroll} onPress={() => setConfirm('approve')}>Approve payroll</Button></span>
    </Tooltip>
  );

  return (
    <div className="space-y-4">
      <Tabs aria-label="Payroll processing views" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(String(k))}>
        {/* ---------- Staff Payroll ---------- */}
        <Tab key="staff" title="👥 Staff Payroll">
          <Card>
            <CardHeader className="justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="font-medium">Staff Payroll</div>
                {monthSelect(workItems, workSelected, (id) => setWorkKey(id))}
                <Button size="sm" color="primary" onPress={openPrepare}>+ Prepare payroll for a month</Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {filterBar}
                <ExportButtons onDownload={(f) => exportStaff(f, workPeriod, workRows)} />
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {workPeriod ? (
                <>
                  {renderBanner(workPeriod, workRows, approveButton)}
                  {processedByMe && (
                    <div className="text-xs text-gray-500">You processed this run, so a different user with payroll-approval permission needs to approve it. Once approved it moves to Payment Advice (to pay) and History.</div>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-center justify-between gap-3 flex-wrap">
                  <span>
                    {inProgress.length === 0
                      ? 'No payroll is waiting for approval. Choose the month you are preparing salaries for; this table is only a preview at today’s rates.'
                      : 'Preview at today’s rates — not a prepared payroll. Pick a month above, or prepare a new one.'}
                  </span>
                  <Button size="sm" color="primary" variant="flat" onPress={openPrepare}>Prepare payroll for a month</Button>
                </div>
              )}
              {renderTable(workRows, workPeriod)}
            </CardBody>
          </Card>
        </Tab>

        {/* ---------- Payment Advice ---------- */}
        <Tab key="advice" title="🏦 Payment Advice">
          <Card>
            <CardHeader className="justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="font-medium">Payment Advice</div>
                {monthSelect(adviceItems, advicePeriod?.id || '', (id) => setAdviceKey(id))}
              </div>
              <ExportButtons onDownload={exportAdviceSummary} />
            </CardHeader>
            <CardBody className="space-y-3">
              {!advicePeriod ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {approvedPeriods.length === 0
                    ? 'Nothing to pay yet. Payment advice is issued from approved payroll — prepare a month and approve it under Staff Payroll first.'
                    : 'Pick an approved month above.'}
                </div>
              ) : (
                <>
                  {renderBanner(advicePeriod, adviceRows, adviceUnpaidIds.length > 0 && (
                    <Tooltip content="Needs the payroll-approval permission" isDisabled={canApprovePayroll}>
                      <span><Button color="success" isDisabled={!canApprovePayroll} onPress={() => { setPayDate(todayKey()); setPayTarget('all'); }}>Mark all as paid</Button></span>
                    </Tooltip>
                  ))}
                  <Table aria-label="payment-advice-summary" className="overflow-x-auto">
                    <TableHeader>
                      <TableColumn>PAYEE / CHANNEL</TableColumn>
                      <TableColumn>NO. OF STAFF</TableColumn>
                      <TableColumn>TOTAL AMOUNT (GHS)</TableColumn>
                      <TableColumn>AMOUNT IN WORDS</TableColumn>
                      <TableColumn>PAYMENT</TableColumn>
                      <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No payroll records for this month.">
                      {[
                        ...adviceGroups.map((g) => (
                          <TableRow key={g.label}>
                            <TableCell className="font-medium">{g.label}</TableCell>
                            <TableCell>{g.records.length}</TableCell>
                            <TableCell>{fmtCurrency(g.total)}</TableCell>
                            <TableCell>{amountToWordsGhana(g.total)}</TableCell>
                            <TableCell>
                              {g.paid === g.records.length
                                ? <Chip size="sm" variant="flat" color="success">Paid {fmtDay(g.paidAt)}</Chip>
                                : g.paid > 0
                                  ? <Chip size="sm" variant="flat" color="warning">Part paid ({g.paid}/{g.records.length})</Chip>
                                  : <Chip size="sm" variant="flat">Not paid</Chip>}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="flat" onPress={() => handleOpenAdvice(g.label)}>View list</Button>
                                {g.unpaidIds.length > 0 && (
                                  <Button size="sm" color="success" variant="flat" isDisabled={!canApprovePayroll} onPress={() => { setPayDate(todayKey()); setPayTarget(g.label); }}>Mark as paid</Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )),
                        ...(adviceGroups.length > 0 ? [(
                          <TableRow key="__total" className="bg-gray-50">
                            <TableCell><strong>TOTAL</strong></TableCell>
                            <TableCell><strong>{adviceCount}</strong></TableCell>
                            <TableCell><strong>{fmtCurrency(adviceTotal)}</strong></TableCell>
                            <TableCell><strong>{amountToWordsGhana(adviceTotal)}</strong></TableCell>
                            <TableCell>{''}</TableCell>
                            <TableCell>{''}</TableCell>
                          </TableRow>
                        )] : []),
                      ]}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-gray-500">Pay one bank, MoMo or cash batch at a time — one click marks every staff member in it as paid. “View list” opens the per-staff list to send to the bank (PDF and Excel).</p>
                </>
              )}
            </CardBody>
          </Card>
        </Tab>

        {/* ---------- History ---------- */}
        <Tab key="history" title="🗂 History">
          {historyPeriod ? (
            <Card>
              <CardHeader className="justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button size="sm" variant="flat" onPress={() => setHistoryKey('')}>← All months</Button>
                  <div className="font-medium">{periodMonth(historyPeriod)}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {filterBar}
                  <ExportButtons onDownload={(f) => exportStaff(f, historyPeriod, historyRows)} />
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                {renderBanner(historyPeriod, historyRows)}
                {renderTable(historyRows, historyPeriod)}
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader className="justify-between gap-2 flex-wrap">
                <div className="font-medium">Payroll History</div>
                <ExportButtons onDownload={exportHistory} />
              </CardHeader>
              <CardBody>
                <Table aria-label="payroll-history" className="overflow-x-auto">
                  <TableHeader>
                    <TableColumn>MONTH</TableColumn>
                    <TableColumn>STAFF</TableColumn>
                    <TableColumn>GROSS PAY</TableColumn>
                    <TableColumn>DEDUCTIONS</TableColumn>
                    <TableColumn>NET PAY</TableColumn>
                    <TableColumn>PROCESSED</TableColumn>
                    <TableColumn>APPROVED</TableColumn>
                    <TableColumn>PAYMENT</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No approved payroll yet. Once a month is approved it is kept here for reference.">
                    {approvedPeriods.map((p) => {
                      const st = historyStats(p.id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{periodMonth(p)}</TableCell>
                          <TableCell>{st.staff}</TableCell>
                          <TableCell>{fmtCurrency(st.gross)}</TableCell>
                          <TableCell>{fmtCurrency(st.gross - st.net)}</TableCell>
                          <TableCell><span className="font-semibold text-green-700">{fmtCurrency(st.net)}</span></TableCell>
                          <TableCell><div className="text-sm">{p.processedBy || '—'}</div><div className="text-xs text-gray-500">{fmtDay(p.processedAt)}</div></TableCell>
                          <TableCell><div className="text-sm">{p.approvedBy || '—'}</div><div className="text-xs text-gray-500">{fmtDay(p.approvedAt)}</div></TableCell>
                          <TableCell>
                            {st.paid === st.staff && st.staff > 0
                              ? <Chip size="sm" variant="flat" color="success">Paid {fmtDay(st.paidOn)}</Chip>
                              : st.paid > 0
                                ? <Chip size="sm" variant="flat" color="warning">Part paid ({st.paid}/{st.staff})</Chip>
                                : <Chip size="sm" variant="flat">Not paid</Chip>}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="flat" onPress={() => setHistoryKey(p.id)}>View</Button>
                              {periodStage(p) === 'approved' && <Button size="sm" variant="flat" color="success" onPress={() => { setAdviceKey(p.id); setActiveTab('advice'); }}>Pay</Button>}
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
        </Tab>
      </Tabs>

      {/* Column visibility modal */}
      <Modal isOpen={showColumns} onOpenChange={setShowColumns} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Show / Hide Columns</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[...columns, { key: 'actions', label: 'Actions' }].map((col) => (
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
            const { rows, total: listTotal, monthLabel } = label ? buildAdviceForLabel(label) : { rows: [], total: 0, monthLabel: '' } as any;
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
                        {[
                          ...rows.map((r: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="w-[12%] text-center">{idx + 1}</TableCell>
                              <TableCell className="w-[40%] pr-8">{r.employeeName}</TableCell>
                              <TableCell className="w-[30%]">{r.accountNumber}</TableCell>
                              <TableCell className="w-[18%] text-right">{fmtCurrency(r.net)}</TableCell>
                            </TableRow>
                          )),
                          <TableRow key="__total">
                            <TableCell>{' '}</TableCell>
                            <TableCell><strong>Total</strong></TableCell>
                            <TableCell>{' '}</TableCell>
                            <TableCell className="text-right"><strong>{fmtCurrency(listTotal)}</strong></TableCell>
                          </TableRow>,
                          <TableRow key="__words">
                            <TableCell colSpan={4}><em>Amount in words: {amountToWordsGhana(listTotal)}</em></TableCell>
                          </TableRow>,
                        ]}
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

      {/* Row detail (the staff table's "View" action) */}
      <Modal isOpen={!!detailRow} onOpenChange={(open) => { if (!open) setDetailRow(null); }} size="2xl">
        <ModalContent>
          {detailRow && (() => {
            const r = detailRow as any;
            const lines: Array<[string, number, boolean?]> = [
              ['Basic salary', r.basic], ['Allowances', r.allowances], ['Overtime & bonus', r.overtime], ['Gross pay', r.gross, true],
              ['Income tax', r.tax], [tier1Label, r.tier1], [tier2Label, r.tier2], [tier3Label, r.tier3], ['Other deductions', r.other], ['Net pay', r.net, true],
            ];
            return (
              <>
                <ModalHeader>{r.name} — {r.month}</ModalHeader>
                <ModalBody>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-gray-500">Staff No.</p><p className="font-medium">{r.staffNo}</p></div>
                    <div><p className="text-gray-500">Department / Position</p><p className="font-medium">{r.deptName || '-'} / {r.posTitle || '-'}</p></div>
                    <div><p className="text-gray-500">Payment status</p><Chip size="sm" variant="flat" color={PAY_CHIP[r.pay as PayStatus].color}>{PAY_CHIP[r.pay as PayStatus].label}</Chip>{r.paidAt ? <span className="ml-2 text-xs text-gray-500">{fmtDay(r.paidAt)}</span> : null}</div>
                    <div><p className="text-gray-500">Pay to</p><p className="font-medium">{r.record ? `${r.record.paymentMethod.replace('_', ' ')}${r.record.bankAccount ? ` · ${r.record.bankAccount}` : ''}` : '-'}</p></div>
                  </div>
                  <Table removeWrapper aria-label="Pay breakdown" className="text-sm mt-2">
                    <TableHeader><TableColumn>Item</TableColumn><TableColumn className="text-right">Amount (GHS)</TableColumn></TableHeader>
                    <TableBody>
                      {lines.map(([label, amount, bold]) => (
                        <TableRow key={label} className={bold ? 'font-semibold' : ''}>
                          <TableCell>{label}</TableCell>
                          <TableCell className={`text-right ${label === 'Net pay' ? 'text-green-700' : ''}`}>{fmtCurrency(amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {r.pay === 'estimate' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      These are estimates from today&apos;s rates, not a processed payroll. Prepare a month to get the actual figures.
                    </div>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={() => setDetailRow(null)}>Close</Button>
                </ModalFooter>
              </>
            );
          })()}
        </ModalContent>
      </Modal>

      {/* Prepare payroll for a chosen month */}
      <Modal isOpen={prepOpen} onOpenChange={setPrepOpen} size="md">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Prepare payroll</ModalHeader>
              <ModalBody>
                <p className="text-sm text-gray-600">Choose the month you are preparing salaries for. Every active staff member is calculated with the current rates, and HR-approved overtime for that month is included.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Month" selectedKeys={[String(prepMonth)]} onSelectionChange={(k) => setPrepMonth(Number(Array.from(k)[0]) || 1)} variant="bordered">
                    {MONTHS.map((m, i) => <SelectItem key={String(i + 1)}>{m}</SelectItem>)}
                  </Select>
                  <Input label="Year" type="number" value={String(prepYear)} onChange={(e) => setPrepYear(Number(e.target.value) || new Date().getFullYear())} variant="bordered" />
                </div>
                <p className="text-sm"><strong>{MONTHS[prepMonth - 1]} {prepYear}</strong> · {activeStaff} active staff</p>
                {prepExisting && (
                  <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                    {MONTHS[prepMonth - 1]} {prepYear} has already been prepared ({STAGE_LABEL[periodStage(prepExisting)].toLowerCase()}). {periodStage(prepExisting) === 'awaiting' ? 'Pick it from the month list instead.' : 'See History.'}
                  </div>
                )}
                {prepError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{prepError}</div>}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setPrepOpen(false)}>Cancel</Button>
                <Button color="primary" onPress={doPrepare} isDisabled={!!prepExisting || activeStaff === 0}>Process payroll</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Approve confirmation */}
      <Modal isOpen={confirm === 'approve'} onOpenChange={(open) => { if (!open) setConfirm(null); }} size="md">
        <ModalContent>
          {workPeriod && (
            <>
              <ModalHeader>Approve {periodMonth(workPeriod)} payroll?</ModalHeader>
              <ModalBody>
                <p className="text-sm">{workRows.length} staff · Gross {fmtCurrency(workRows.reduce((s, r) => s + r.gross, 0))} · Net pay <strong className="text-green-700">{fmtCurrency(workRows.reduce((s, r) => s + r.net, 0))}</strong></p>
                <p className="text-xs text-gray-600">Approving confirms these figures are correct and posts this payroll to the ledger. It is recorded under your name ({currentUserName}) and can&apos;t be undone here. The month then moves to Payment Advice, where it is paid, and to History.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setConfirm(null)}>Cancel</Button>
                <Button color="primary" onPress={doApprove}>Approve payroll</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Mark a bank/MoMo/cash batch (or everything) as paid */}
      <Modal isOpen={payTarget !== null} onOpenChange={(open) => { if (!open) setPayTarget(null); }} size="md">
        <ModalContent>
          {advicePeriod && payTarget && (
            <>
              <ModalHeader>Mark {payTarget === 'all' ? 'all channels' : payTarget} as paid?</ModalHeader>
              <ModalBody>
                <p className="text-sm">{advicePeriod && periodMonth(advicePeriod)} · <strong>{payIds.length}</strong> staff · <strong className="text-green-700">{fmtCurrency(payAmount)}</strong></p>
                <Input label="Date paid" type="date" max={todayKey()} value={payDate} onChange={(e) => setPayDate(e.target.value)} variant="bordered" />
                <p className="text-xs text-gray-600">This marks every staff member in {payTarget === 'all' ? 'the month' : 'this batch'} as paid in one go. Do it once the bank or MoMo transfer has actually gone out.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setPayTarget(null)}>Cancel</Button>
                <Button color="success" onPress={doPay} isDisabled={!payDate || payDate > todayKey() || payIds.length === 0}>Mark as paid</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
