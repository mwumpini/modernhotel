'use client';

import React from 'react';
import { Tooltip, Card, CardHeader, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Select, SelectItem, Chip, Input, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Checkbox, Tabs, Tab, Pagination } from '@heroui/react';
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
import { approvedOvertimeFor, buildPayrollJournal, monthYearOf, prepareBuilderForRun, readAdjustments, readEmployerContribution, recalculateStaffLine, runMonthlyPayroll } from '@/app/lib/payroll/monthlyRun';
import { notifyError, notifySuccess } from '@/app/lib/notifications/notify';
import ExportButtons from '@/app/components/ExportButtons';
import type { PayrollPeriod, PayrollRecord } from '@/app/lib/hr/models';
import type { ExportFormat } from '@/app/lib/frontoffice/reportExportFormat';
import { formatGhs, formatMoney } from '@/app/lib/format/currency';
import { printDetailSheet, printSimpleReport } from '@/app/lib/print/simpleReport';
import { DESK_PAGE_SIZE, useDeskPagination } from '../dashboard/deskTableUi';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from '../dashboard/deskTabsUi';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailField, DetailGrid } from '../frontoffice/detailView';
import { readDebtRepayments, useStaffDebtStore } from '@/app/lib/hr/staffDebtStore';

type PayrollColKey =
  | 'idNo' | 'staffNo' | 'name' | 'department' | 'position' | 'residencyClass' | 'status' | 'type' | 'secondEmployment'
  | 'basicSalary' | 'allowances' | 'overtime' | 'gross' | 'incomeTax' | 'socialSecurity' | 'tier2' | 'tier3' | 'other'
  | 'net' | 'payStatus' | 'paidOn';

const payrollDefaultWidths: Record<PayrollColKey, number> = {
  idNo: 100, staffNo: 88, name: 148, department: 120, position: 120, residencyClass: 140, status: 110, type: 80,
  secondEmployment: 96, basicSalary: 104, allowances: 104, overtime: 112, gross: 104, incomeTax: 96, socialSecurity: 96,
  tier2: 96, tier3: 96, other: 104, net: 104, payStatus: 128, paidOn: 100,
};

type HistorySortKey = 'month' | 'staff' | 'gross' | 'deductions' | 'net' | 'processed' | 'approved' | 'payment';
const historyColWidths: Record<HistorySortKey, number> = {
  month: 140, staff: 72, gross: 104, deductions: 104, net: 104, processed: 140, approved: 140, payment: 120,
};

type AdviceSortKey = 'channel' | 'count' | 'amount' | 'words' | 'payment';
const adviceColWidths: Record<AdviceSortKey, number> = {
  channel: 160, count: 88, amount: 120, words: 200, payment: 120,
};

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
  const deletePayrollPeriod = usePayrollStore((s) => s.deletePayrollPeriod);
  const canProcessPayroll = useSettingsStore((s) => s.hasPermission('hr.process-payroll'));
  const canApprovePayroll = useSettingsStore((s) => s.hasPermission('hr.approve-payroll'));
  const requireApprovalForPayroll = useSettingsStore((s) => s.financialSettings.requireApprovalForPayroll !== false);
  const currentUserName = useCurrentUserName();
  // Each tab has its own month. '' means "the default": Staff Payroll opens on a prepared month;
  // Payment Advice prefers awaiting approval, else the oldest approved month still to be paid.
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
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  // The staff line being edited, and its form (kept as text so a field can be cleared while typing).
  const [editRow, setEditRow] = React.useState<any | null>(null);
  const [editForm, setEditForm] = React.useState({ allowances: '', overtimeHours: '', bonus: '', otherDeduction: '', reason: '' });
  const [editError, setEditError] = React.useState('');
  const taxRules = useComplianceStore((s) => s.taxRules);
  const hotelName = useSettingsStore((s) => s.hotelSettings.hotelName) || 'Hotel';
  const exportFile = useSectionExport();
  const owedByEmployee = useStaffDebtStore((s) => s.owedByEmployee);
  const [activeTab, setActiveTab] = React.useState<string>('staff');
  const staffCols = useResizableColumns<PayrollColKey>(payrollDefaultWidths);
  const historyCols = useResizableColumns<HistorySortKey>(historyColWidths);
  const adviceCols = useResizableColumns<AdviceSortKey>(adviceColWidths);
  const [staffSortKey, setStaffSortKey] = React.useState<string>('name');
  const [staffSortDir, setStaffSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [historySortKey, setHistorySortKey] = React.useState<HistorySortKey>('month');
  const [historySortDir, setHistorySortDir] = React.useState<'asc' | 'desc'>('desc');
  const [adviceSortKey, setAdviceSortKey] = React.useState<AdviceSortKey>('channel');
  const [adviceSortDir, setAdviceSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [staffPage, setStaffPage] = React.useState(1);

  // Deep-link from Executive Approvals → open this month on Payment Advice.
  React.useEffect(() => {
    const apply = () => {
      try {
        const id = localStorage.getItem('payroll.advicePeriodId');
        if (!id) return;
        setAdviceKey(id);
        setActiveTab('advice');
        localStorage.removeItem('payroll.advicePeriodId');
      } catch {
        /* ignore */
      }
    };
    apply();
    window.addEventListener('payroll-navigate', apply);
    return () => window.removeEventListener('payroll-navigate', apply);
  }, []);

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
  const defaultColumns = ['staffNo', 'name', 'department', 'position', 'basicSalary', 'allowances', 'overtime', 'gross', 'incomeTax', 'socialSecurity', 'tier2', 'tier3', 'net', 'payStatus'];
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
  // Staff Payroll = prepare/review lines. Payment Advice = approve (if required) then pay. History = approved/paid.
  const inProgress = sortedPeriods.filter((p) => periodStage(p) === 'awaiting' || periodStage(p) === 'draft');
  const approvedPeriods = sortedPeriods.filter((p) => periodStage(p) === 'approved' || periodStage(p) === 'paid');
  const empById = new Map(employees.map((e) => [e.id, e]));

  const workSelected = workKey || inProgress[0]?.id || 'estimate';
  const workPeriod = inProgress.find((p) => p.id === workSelected);
  // Advice: awaiting (for Approve) + approved/paid (for Mark paid / review).
  const adviceEligible = sortedPeriods.filter((p) => {
    const st = periodStage(p);
    return st === 'awaiting' || st === 'draft' || st === 'approved' || st === 'paid';
  });
  const adviceDefault =
    [...adviceEligible].reverse().find((p) => periodStage(p) === 'awaiting' || periodStage(p) === 'draft')
    ?? [...adviceEligible].reverse().find((p) => periodStage(p) === 'approved')
    ?? adviceEligible[0];
  const adviceSelected = adviceKey || adviceDefault?.id || '';
  const advicePeriod = adviceEligible.find((p) => p.id === adviceSelected);
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
    { key: 'name', label: 'Name', value: (r) => r.name, render: (r) => {
      const owed = r.e ? owedByEmployee(r.e.id) : 0;
      const debtOnSlip = r.record ? readDebtRepayments(r.record.notes).reduce((s, l) => s + l.amount, 0) : 0;
      return (
        <div className="min-w-0">
          <span className="block truncate font-semibold text-ghana-black" title={r.name}>{r.name}</span>
          {(owed > 0 || debtOnSlip > 0) && (
            <Chip size="sm" variant="flat" color="warning" className="mt-0.5">
              {debtOnSlip > 0 ? `Debt ${formatMoney(debtOnSlip)}` : `Owes ${formatMoney(owed)}`}
            </Chip>
          )}
        </div>
      );
    } },
    { key: 'department', label: 'Department', value: (r) => r.deptName },
    { key: 'position', label: 'Position', value: (r) => r.posTitle },
    { key: 'residencyClass', label: 'Residency / Class', value: (r) => (r.e ? `${((r.e as any).residencyStatus || 'resident').replace('_', ' ')} / ${((r.e as any).employmentClass || 'regular').replace('_', ' ')}` : '-') },
    { key: 'status', label: 'Employee status', value: (r) => r.e?.status || '-', render: (r) => (r.e ? <Chip size="sm" variant="flat" color={r.e.status === 'active' ? 'success' : r.e.status === 'on_leave' ? 'warning' : 'default'}>{r.e.status}</Chip> : '-') },
    { key: 'type', label: 'Type', value: (r) => r.e?.employmentType || '-' },
    { key: 'secondEmployment', label: 'Second Employ', value: (r) => ((r.e as any)?.secondEmployment ? 'Y' : 'N') },
    { key: 'basicSalary', label: 'Basic Salary', money: true, value: (r) => r.basic, render: (r) => <span className="tabular-nums">{formatMoney(r.basic)}</span> },
    { key: 'allowances', label: 'Allowances', money: true, value: (r) => r.allowances, render: (r) => <span className="tabular-nums">{formatMoney(r.allowances)}</span> },
    { key: 'overtime', label: 'Overtime & bonus', money: true, value: (r) => r.overtime, render: (r) => <span className="tabular-nums">{formatMoney(r.overtime)}</span> },
    { key: 'gross', label: 'Gross pay', money: true, value: (r) => r.gross, render: (r) => <span className="tabular-nums">{formatMoney(r.gross)}</span> },
    { key: 'incomeTax', label: 'Income Tax', money: true, value: (r) => r.tax, render: (r) => <span className="tabular-nums">{formatMoney(r.tax)}</span> },
    { key: 'socialSecurity', label: tier1Label, money: true, value: (r) => r.tier1, render: (r) => <span className="tabular-nums">{formatMoney(r.tier1)}</span> },
    { key: 'tier2', label: tier2Label, money: true, value: (r) => r.tier2, render: (r) => <span className="tabular-nums">{formatMoney(r.tier2)}</span> },
    { key: 'tier3', label: tier3Label, money: true, value: (r) => r.tier3, render: (r) => <span className="tabular-nums">{formatMoney(r.tier3)}</span> },
    { key: 'other', label: 'Other deductions', money: true, value: (r) => r.other, render: (r) => <span className="tabular-nums">{formatMoney(r.other)}</span> },
    { key: 'net', label: 'Net pay', money: true, value: (r) => r.net, render: (r) => <span className="font-semibold text-green-700 tabular-nums">{formatMoney(r.net)}</span> },
    { key: 'payStatus', label: 'Payment status', value: (r) => PAY_CHIP[r.pay].label, render: (r) => <Chip size="sm" variant="flat" color={PAY_CHIP[r.pay].color}>{PAY_CHIP[r.pay].label}</Chip> },
    { key: 'paidOn', label: 'Paid on', value: (r) => fmtDay(r.paidAt) || '-' },
  ];
  const shownColumns = columns.filter((c) => visibleColumns.has(c.key));
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
  // Slim strip for Staff Payroll / Advice — month, count, net, one chip, actions. No timeline.
  const renderSlimBanner = (p: PayrollPeriod, allRows: Row[], actions?: React.ReactNode) => {
    const st = periodStage(p);
    const net = allRows.reduce((s, r) => s + r.net, 0);
    const statusLabel =
      st === 'paid' ? 'Paid'
        : st === 'approved' ? 'Approved — ready to pay'
          : 'Awaiting approval';
    const statusColor = st === 'paid' ? 'success' : st === 'approved' ? 'primary' : 'warning';
    return (
      <div
        data-payroll-banner="slim"
        className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2"
      >
        <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-ghana-black">{periodMonth(p)}</span>
          <span className="text-xs text-gray-500">{allRows.length} staff · Net {formatGhs(net)}</span>
        </div>
        <Chip size="sm" variant="flat" color={statusColor as 'success' | 'primary' | 'warning'}>{statusLabel}</Chip>
        <div className="flex items-center gap-2 ml-auto">{actions}</div>
      </div>
    );
  };

  // Full timeline kept for History drill-down only.
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
          <div><div className="text-xs text-gray-500">Gross pay</div><div className="font-medium">{formatGhs(gross)}</div></div>
          <div><div className="text-xs text-gray-500">Deductions</div><div className="font-medium">{formatGhs(gross - net)}</div></div>
          <div><div className="text-xs text-gray-500">Net pay</div><div className="text-lg font-semibold text-green-700">{formatGhs(net)}</div></div>
        </div>
        {actions}
      </div>
    );
  };

  const onStaffSort = (key: string) => {
    if (staffSortKey === key) setStaffSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setStaffSortKey(key);
      setStaffSortDir('asc');
    }
  };

  // The per-person table, shared by Staff Payroll (month being prepared) and History (a past month).
  const renderTable = (allRows: Row[], p: PayrollPeriod | undefined) => {
    const rows = applyFilters(allRows);
    const colDef = columns.find((c) => c.key === staffSortKey);
    const sorted = [...rows].sort((a, b) => {
      const av = colDef ? colDef.value(a) : a.name;
      const bv = colDef ? colDef.value(b) : b.name;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return -1;
      if (as > bs) return 1;
      return 0;
    });
    const displayRows = staffSortDir === 'asc' ? sorted : sorted.reverse();
    const pages = Math.max(1, Math.ceil(displayRows.length / DESK_PAGE_SIZE));
    const pageSafe = Math.min(staffPage, pages);
    const paged = displayRows.slice((pageSafe - 1) * DESK_PAGE_SIZE, pageSafe * DESK_PAGE_SIZE);
    const label = p ? periodMonth(p) : 'Estimate';
    return (
      <div>
        <div ref={staffCols.frameRef} style={staffCols.frameStyle}>
          <Table aria-label="staff-payroll" removeWrapper classNames={deskResizableTableClassNames()}>
            <TableHeader>
              {shownColumns.map((c) => (
                <TableColumn key={c.key} className="relative" style={staffCols.style(c.key as PayrollColKey)}>
                  <SortLabel active={staffSortKey === c.key} dir={staffSortDir} align={c.money ? 'right' : 'left'} onPress={() => onStaffSort(c.key)}>{c.label}</SortLabel>
                  {staffCols.sizer(c.key as PayrollColKey, c.label)}
                </TableColumn>
              ))}
            </TableHeader>
            <TableBody emptyContent={p ? 'No payroll records for these filters.' : 'No staff match these filters.'}>
              {[
                ...paged.map((r) => (
                  <TableRow
                    key={r.key}
                    className={rowClassNames(detailRow?.key === r.key)}
                    onClick={() => setDetailRow({ ...r, month: label })}
                  >
                    {shownColumns.map((c) => (
                      <TableCell key={c.key} className={c.money ? 'text-right' : undefined}>
                        {c.render ? c.render(r) : c.value(r)}
                      </TableCell>
                    ))}
                  </TableRow>
                )),
                ...(displayRows.length > 0 ? [(
                  <TableRow key="__total" className="bg-gray-50">
                    {shownColumns.map((c, i) => (
                      <TableCell key={c.key} className={c.money ? 'text-right tabular-nums' : undefined}>
                        {c.money ? <strong className={c.key === 'net' ? 'text-green-700' : ''}>{formatMoney(total(displayRows, c.key))}</strong> : i === 0 ? <strong>TOTAL</strong> : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                )] : []),
              ]}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex justify-end">
          <Pagination page={pageSafe} total={pages} onChange={setStaffPage} showControls size="sm" />
        </div>
      </div>
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
  const doPrepare = async () => {
    setPrepError('');
    try {
      const builder = new UniversalPayrollBuilder();
      const country = useComplianceStore.getState().country;
      const runtimeId = prepareBuilderForRun(builder, country);
      const result = runMonthlyPayroll({ builder, runtimeId, employees, periods: payrollPeriods, month: prepMonth, year: prepYear, userName: currentUserName, complianceCountry: country });
      if (!result.ok) { setPrepError(result.error); return; }
      setPrepOpen(false);
      // Auto-approved months still need the ledger entry that Approve normally posts.
      if (result.autoApproved) {
        try {
          const period = usePayrollStore.getState().payrollPeriods.find((x) => x.id === result.periodId);
          const accounting = useAccountingStore.getState();
          const jeId = `JE-PAYROLL-${result.periodId}`;
          const entry = period && readEmployerContribution(period) !== undefined
            ? buildPayrollJournal(period, usePayrollStore.getState().payrollRecords.filter((r) => r.payrollPeriodId === result.periodId))
            : undefined;
          if (entry) accounting.addJournalEntry(entry);
          await accounting.postJournalEntry(jeId);
        } catch (e) {
          console.warn('[Payroll] Ledger post failed after auto-approve:', e);
          notifyError(`${MONTHS[prepMonth - 1]} ${prepYear} is ready to pay, but posting to the ledger failed.`, 'Ledger not posted');
        }
        setAdviceKey(result.periodId);
        setActiveTab('advice');
        notifySuccess(`${MONTHS[prepMonth - 1]} ${prepYear} prepared for ${result.employeeCount} staff — ready to pay from Payment Advice.`, 'Payroll prepared');
      } else {
        setWorkKey(result.periodId);
        setActiveTab('staff');
        notifySuccess(`${MONTHS[prepMonth - 1]} ${prepYear} prepared for ${result.employeeCount} staff — review the lines, then approve on Payment Advice.`, 'Payroll prepared');
      }
      if (result.warning) notifyError(result.warning, 'Ledger entry');
    } catch (e: any) {
      console.error('[Payroll] Prepare failed', e);
      setPrepError(e?.message || 'Could not prepare payroll for that month.');
    }
  };

  // Approving posts this run's ledger entry. Lives on Payment Advice (management summary).
  const doApprove = async (period?: PayrollPeriod | null) => {
    const p = period || advicePeriod || workPeriod;
    if (!p) return;
    setConfirm(null);
    const approved = await approvePeriod(p.id, currentUserName);
    if (!approved) return;
    try {
      const accounting = useAccountingStore.getState();
      const jeId = `JE-PAYROLL-${p.id}`;
      const entry = readEmployerContribution(p) !== undefined ? buildPayrollJournal(p, payrollRecords.filter((r) => r.payrollPeriodId === p.id)) : undefined;
      if (entry) accounting.addJournalEntry(entry);
      await accounting.postJournalEntry(jeId);
      notifySuccess(`${periodMonth(p)} payroll approved and posted to the ledger — mark staff as paid below.`, 'Payroll approved');
    } catch (e) {
      console.warn('[Payroll] Ledger post failed after approval:', e);
      notifyError(`${periodMonth(p)} payroll was approved, but posting it to the ledger failed. Please tell accounting.`, 'Ledger not posted');
    }
    setAdviceKey(p.id);
    setActiveTab('advice');
  };
  const doDelete = async () => {
    if (!workPeriod) return;
    const p = workPeriod;
    setDeleteOpen(false);
    const ok = await deletePayrollPeriod(p.id);
    if (!ok) return;
    useAccountingStore.getState().deleteJournalEntry(`JE-PAYROLL-${p.id}`); // drop any stale draft held in memory
    setWorkKey('');
    notifySuccess(`${periodMonth(p)} payroll deleted — you can prepare it again.`, 'Payroll deleted');
  };

  const openEdit = (r: Row) => {
    if (!workPeriod || !r.record) return;
    const my = monthYearOf(workPeriod);
    const adj = readAdjustments(r.record.notes);
    setEditForm({
      allowances: String(adj.allowances ?? r.record.allowances ?? 0),
      overtimeHours: String(adj.overtimeHours ?? (my ? approvedOvertimeFor(r.record.employeeId, my.month, my.year) : 0)),
      bonus: String(adj.bonus ?? r.record.bonuses ?? 0),
      otherDeduction: String(adj.otherDeduction ?? 0),
      reason: '',
    });
    setEditError('');
    setEditRow(r);
  };
  const doEditSave = () => {
    if (!workPeriod || !editRow?.record) return;
    const num = (v: string) => (v.trim() === '' ? 0 : Number(v));
    const values = { allowances: num(editForm.allowances), overtimeHours: num(editForm.overtimeHours), bonus: num(editForm.bonus), otherDeduction: num(editForm.otherDeduction) };
    if (Object.values(values).some((v) => !Number.isFinite(v) || v < 0)) { setEditError('Amounts and hours must be numbers, zero or more.'); return; }
    if (!editForm.reason.trim()) { setEditError('Say why the line is being changed — it is kept with the record.'); return; }
    try {
      const builder = new UniversalPayrollBuilder();
      const country = useComplianceStore.getState().country;
      const runtimeId = prepareBuilderForRun(builder, country);
      const result = recalculateStaffLine({
        builder, runtimeId, period: workPeriod, record: editRow.record, employee: empById.get(editRow.record.employeeId),
        adjustments: { ...values, reason: editForm.reason.trim(), editedBy: currentUserName }, complianceCountry: country,
      });
      if (!result.ok) { setEditError(result.error); return; }
      setEditRow(null);
      notifySuccess(`${editRow.name}: net pay ${formatGhs(result.before)} → ${formatGhs(result.after)}`, 'Line recalculated');
    } catch (e: any) {
      console.error('[Payroll] Edit failed', e);
      setEditError(e?.message || 'Could not recalculate this line.');
    }
  };
  const canEditLines = !!workPeriod && canProcessPayroll;

  // ================= Payment Advice: approve awaiting months, then pay by bank/MoMo/cash =================
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
  const adviceItems = adviceEligible.map((p) => ({ id: p.id, name: `${periodMonth(p)} — ${STAGE_LABEL[periodStage(p)]}` }));
  const adviceStage = advicePeriod ? periodStage(advicePeriod) : null;
  const adviceAwaiting = adviceStage === 'awaiting' || adviceStage === 'draft';
  const adviceCanPay = adviceStage === 'approved';
  const adviceProcessedByMe = !!advicePeriod?.processedBy
    && advicePeriod.processedBy.trim().toLowerCase() === currentUserName.trim().toLowerCase();

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

  const onAdviceSort = (key: AdviceSortKey) => {
    if (adviceSortKey === key) setAdviceSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setAdviceSortKey(key);
      setAdviceSortDir('asc');
    }
  };
  const onHistorySort = (key: HistorySortKey) => {
    if (historySortKey === key) setHistorySortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setHistorySortKey(key);
      setHistorySortDir('asc');
    }
  };

  const sortedAdviceGroups = React.useMemo(() => {
    const sorted = [...adviceGroups].sort((a, b) => {
      const val = (g: AdviceGroup): string | number => {
        switch (adviceSortKey) {
          case 'channel': return g.label.toLowerCase();
          case 'count': return g.records.length;
          case 'amount': return g.total;
          case 'words': return amountToWordsGhana(g.total);
          case 'payment': return g.paid;
          default: return '';
        }
      };
      const av = val(a);
      const bv = val(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return -1;
      if (as > bs) return 1;
      return 0;
    });
    return adviceSortDir === 'asc' ? sorted : sorted.reverse();
  }, [adviceGroups, adviceSortKey, adviceSortDir]);

  const advicePaging = useDeskPagination(sortedAdviceGroups, [adviceSortKey, adviceSortDir, advicePeriod?.id]);
  React.useEffect(() => { setStaffPage(1); }, [deptFilter, statusFilter, q, staffSortKey, staffSortDir, workSelected, historyKey, activeTab]);

  const sortedApprovedPeriods = React.useMemo(() => {
    const sorted = [...approvedPeriods].sort((a, b) => {
      const stA = historyStats(a.id);
      const stB = historyStats(b.id);
      const val = (p: PayrollPeriod, st: ReturnType<typeof historyStats>): string | number => {
        switch (historySortKey) {
          case 'month': return new Date(p.startDate).getTime();
          case 'staff': return st.staff;
          case 'gross': return st.gross;
          case 'deductions': return st.gross - st.net;
          case 'net': return st.net;
          case 'processed': return new Date(p.processedAt || 0).getTime();
          case 'approved': return new Date(p.approvedAt || 0).getTime();
          case 'payment': return st.paid;
          default: return '';
        }
      };
      const av = val(a, stA);
      const bv = val(b, stB);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return -1;
      if (as > bs) return 1;
      return 0;
    });
    return historySortDir === 'asc' ? sorted : sorted.reverse();
  }, [approvedPeriods, historySortKey, historySortDir, payrollRecords]);

  const historyPaging = useDeskPagination(sortedApprovedPeriods, [historySortKey, historySortDir]);

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

  const staffBannerActions = workPeriod && (
    <Tooltip content="Needs the payroll-processing permission" isDisabled={canProcessPayroll}>
      <span><Button color="danger" variant="flat" size="sm" isDisabled={!canProcessPayroll} onPress={() => setDeleteOpen(true)}>Delete month</Button></span>
    </Tooltip>
  );

  const adviceBannerActions = advicePeriod && (
    <div className="flex items-center gap-2">
      {adviceAwaiting && (
        <Tooltip content="Needs the payroll-approval permission" isDisabled={canApprovePayroll}>
          <span><Button color="primary" size="sm" isDisabled={!canApprovePayroll} onPress={() => setConfirm('approve')}>Approve payroll</Button></span>
        </Tooltip>
      )}
      {adviceCanPay && adviceUnpaidIds.length > 0 && (
        <Tooltip content="Needs the payroll-approval permission" isDisabled={canApprovePayroll}>
          <span><Button color="success" size="sm" isDisabled={!canApprovePayroll} onPress={() => { setPayDate(todayKey()); setPayTarget('all'); }}>Mark all as paid</Button></span>
        </Tooltip>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <Tabs aria-label="Payroll processing views" size="sm" variant="solid" className="w-full" classNames={deskBookTabsClassNames} selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(String(k))}>
        {/* ---------- Staff Payroll ---------- */}
        <Tab key="staff" title="Staff Payroll">
          <div className={deskBookTabPanelClassName}>
          <Card className="shadow-sm">
            <CardHeader className="px-3 py-2 flex items-center gap-3 flex-wrap">
              <div className="text-sm font-semibold text-gray-800">Staff Payroll</div>
              {monthSelect(workItems, workSelected, (id) => setWorkKey(id))}
              <Button size="sm" color="primary" onPress={openPrepare}>+ Prepare</Button>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {filterBar}
                <ExportButtons onDownload={(f) => exportStaff(f, workPeriod, workRows)} />
              </div>
              {workPeriod ? (
                renderSlimBanner(workPeriod, workRows, staffBannerActions)
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-center justify-between gap-3 flex-wrap">
                  <span>
                    {inProgress.length === 0
                      ? requireApprovalForPayroll
                        ? 'No prepared month yet. Prepare a month here, then approve it on Payment Advice before paying.'
                        : 'No prepared month yet. Prepare a month here — it will be ready to pay on Payment Advice.'
                      : 'Preview at today’s rates — not a prepared payroll. Pick a month above, or prepare a new one.'}
                  </span>
                  <Button size="sm" color="primary" variant="flat" onPress={openPrepare}>Prepare payroll for a month</Button>
                </div>
              )}
              {renderTable(workRows, workPeriod)}
            </CardBody>
          </Card>
          </div>
        </Tab>

        {/* ---------- Payment Advice ---------- */}
        <Tab key="advice" title="Payment Advice">
          <div className={deskBookTabPanelClassName}>
          <Card className="shadow-sm">
            <CardHeader className="px-3 py-2 justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-sm font-semibold text-gray-800">Payment Advice</div>
                {monthSelect(adviceItems, advicePeriod?.id || '', (id) => setAdviceKey(id))}
              </div>
              <ExportButtons onDownload={exportAdviceSummary} />
            </CardHeader>
            <CardBody className="space-y-3">
              {!advicePeriod ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Prepare a month under Staff Payroll first.
                </div>
              ) : (
                <>
                  {renderSlimBanner(advicePeriod, adviceRows, adviceBannerActions)}
                  {adviceAwaiting && adviceProcessedByMe && (
                    <div className="text-xs text-gray-500">You prepared this run — another user with payroll-approval permission needs to approve it before it can be paid.</div>
                  )}
                  <div ref={adviceCols.frameRef} style={adviceCols.frameStyle}>
                    <Table aria-label="payment-advice-summary" removeWrapper classNames={deskResizableTableClassNames()}>
                      <TableHeader>
                        <TableColumn key="channel" className="relative" style={adviceCols.style('channel')}>
                          <SortLabel active={adviceSortKey === 'channel'} dir={adviceSortDir} onPress={() => onAdviceSort('channel')}>Payee / channel</SortLabel>
                          {adviceCols.sizer('channel', 'Payee / channel')}
                        </TableColumn>
                        <TableColumn key="count" className="relative" style={adviceCols.style('count')}>
                          <SortLabel active={adviceSortKey === 'count'} dir={adviceSortDir} align="center" onPress={() => onAdviceSort('count')}>Staff</SortLabel>
                          {adviceCols.sizer('count', 'Staff')}
                        </TableColumn>
                        <TableColumn key="amount" className="relative" style={adviceCols.style('amount')}>
                          <SortLabel active={adviceSortKey === 'amount'} dir={adviceSortDir} align="right" onPress={() => onAdviceSort('amount')}>Total amount</SortLabel>
                          {adviceCols.sizer('amount', 'Total amount')}
                        </TableColumn>
                        <TableColumn key="words" className="relative" style={adviceCols.style('words')}>
                          <SortLabel active={adviceSortKey === 'words'} dir={adviceSortDir} onPress={() => onAdviceSort('words')}>Amount in words</SortLabel>
                          {adviceCols.sizer('words', 'Amount in words')}
                        </TableColumn>
                        <TableColumn key="payment" className="relative" style={adviceCols.style('payment')}>
                          <SortLabel active={adviceSortKey === 'payment'} dir={adviceSortDir} onPress={() => onAdviceSort('payment')}>Payment</SortLabel>
                          {adviceCols.sizer('payment', 'Payment')}
                        </TableColumn>
                        <TableColumn key="actions">Actions</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="No payroll records for this month.">
                        {[
                          ...advicePaging.paged.map((g) => (
                            <TableRow
                              key={g.label}
                              className={rowClassNames(adviceLabel === g.label && adviceOpen)}
                              onClick={() => handleOpenAdvice(g.label)}
                            >
                              <TableCell className="font-medium"><span className="block truncate" title={g.label}>{g.label}</span></TableCell>
                              <TableCell className="text-center tabular-nums">{g.records.length}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatMoney(g.total)}</TableCell>
                              <TableCell><span className="block truncate" title={amountToWordsGhana(g.total)}>{amountToWordsGhana(g.total)}</span></TableCell>
                              <TableCell>
                                {adviceAwaiting
                                  ? <Chip size="sm" variant="flat" color="warning">Awaiting approval</Chip>
                                  : g.paid === g.records.length
                                    ? <Chip size="sm" variant="flat" color="success">Paid {fmtDay(g.paidAt)}</Chip>
                                    : g.paid > 0
                                      ? <Chip size="sm" variant="flat" color="warning">Part paid ({g.paid}/{g.records.length})</Chip>
                                      : <Chip size="sm" variant="flat">Not paid</Chip>}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                                  <Button size="sm" variant="flat" onPress={() => handleOpenAdvice(g.label)}>View list</Button>
                                  {adviceCanPay && g.unpaidIds.length > 0 && (
                                    <Button size="sm" color="success" variant="flat" isDisabled={!canApprovePayroll} onPress={() => { setPayDate(todayKey()); setPayTarget(g.label); }}>Mark as paid</Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )),
                          ...(sortedAdviceGroups.length > 0 ? [(
                            <TableRow key="__total" className="bg-gray-50">
                              <TableCell><strong>TOTAL</strong></TableCell>
                              <TableCell className="text-center"><strong>{adviceCount}</strong></TableCell>
                              <TableCell className="text-right tabular-nums"><strong>{formatMoney(adviceTotal)}</strong></TableCell>
                              <TableCell><strong>{amountToWordsGhana(adviceTotal)}</strong></TableCell>
                              <TableCell>{''}</TableCell>
                              <TableCell>{''}</TableCell>
                            </TableRow>
                          )] : []),
                        ]}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Pagination page={advicePaging.page} total={advicePaging.pages} onChange={advicePaging.setPage} showControls size="sm" />
                  </div>
                  <p className="text-xs text-gray-500">
                    {adviceAwaiting
                      ? 'Review the payee / channel summary, then Approve payroll. Mark as paid unlocks after approval.'
                      : 'Pay one bank, MoMo or cash batch at a time — one click marks every staff member in it as paid. Click a row or “View list” to open the per-staff list (Print, PDF, Excel).'}
                  </p>
                </>
              )}
            </CardBody>
          </Card>
          </div>
        </Tab>

        {/* ---------- History ---------- */}
        <Tab key="history" title="History">
          <div className={deskBookTabPanelClassName}>
          {historyPeriod ? (
            <Card className="shadow-sm">
              <CardHeader className="px-3 py-2 justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button size="sm" variant="flat" onPress={() => setHistoryKey('')}>← All months</Button>
                  <div className="text-sm font-semibold text-gray-800">{periodMonth(historyPeriod)}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {filterBar}
                  <ExportButtons onDownload={(f) => exportStaff(f, historyPeriod, historyRows)} />
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                {renderBanner(historyPeriod, historyRows)}
                {renderTable(historyRows, historyPeriod)}
              </CardBody>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardHeader className="px-3 py-2 justify-between gap-2 flex-wrap">
                <div className="text-sm font-semibold text-gray-800">Payroll History</div>
                <ExportButtons onDownload={exportHistory} />
              </CardHeader>
              <CardBody>
                <div ref={historyCols.frameRef} style={historyCols.frameStyle}>
                  <Table aria-label="payroll-history" removeWrapper classNames={deskResizableTableClassNames()}>
                    <TableHeader>
                      {[
                        ...(['month', 'staff', 'gross', 'deductions', 'net', 'processed', 'approved', 'payment'] as HistorySortKey[]).map((key) => {
                          const labels: Record<HistorySortKey, string> = {
                            month: 'Month', staff: 'Staff', gross: 'Gross pay', deductions: 'Deductions', net: 'Net pay',
                            processed: 'Processed', approved: 'Approved', payment: 'Payment',
                          };
                          const align = key === 'staff' ? 'center' : (key === 'gross' || key === 'deductions' || key === 'net') ? 'right' : 'left';
                          return (
                            <TableColumn key={key} className="relative" style={historyCols.style(key)}>
                              <SortLabel active={historySortKey === key} dir={historySortDir} align={align} onPress={() => onHistorySort(key)}>{labels[key]}</SortLabel>
                              {historyCols.sizer(key, labels[key])}
                            </TableColumn>
                          );
                        }),
                        <TableColumn key="actions">Actions</TableColumn>,
                      ]}
                    </TableHeader>
                    <TableBody emptyContent="No approved payroll yet. Once a month is approved it is kept here for reference.">
                      {historyPaging.paged.map((p) => {
                        const st = historyStats(p.id);
                        return (
                          <TableRow key={p.id} className={rowClassNames(historyKey === p.id)} onClick={() => setHistoryKey(p.id)}>
                            <TableCell className="font-semibold text-ghana-black">{periodMonth(p)}</TableCell>
                            <TableCell className="text-center tabular-nums">{st.staff}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(st.gross)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(st.gross - st.net)}</TableCell>
                            <TableCell className="text-right tabular-nums"><span className="font-semibold text-green-700">{formatMoney(st.net)}</span></TableCell>
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
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                                <Button size="sm" variant="flat" onPress={() => setHistoryKey(p.id)}>View</Button>
                                {periodStage(p) === 'approved' && <Button size="sm" variant="flat" color="success" onPress={() => { setAdviceKey(p.id); setActiveTab('advice'); }}>Pay</Button>}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 flex justify-end">
                  <Pagination page={historyPaging.page} total={historyPaging.pages} onChange={historyPaging.setPage} showControls size="sm" />
                </div>
              </CardBody>
            </Card>
          )}
          </div>
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
                  {[...columns].map((col) => (
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
            const printAdvice = () => printSimpleReport(
              `Salary Payment Advice — ${label}`,
              `${hotelName} · ${monthLabel}`,
              ['No.', 'Name', 'Account / wallet', 'Net (GHS)'],
              [
                ...rows.map((r: any, idx: number) => [idx + 1, r.employeeName, r.accountNumber, formatMoney(r.net)]),
                ['', 'TOTAL', '', formatMoney(listTotal)],
                ['', `Amount in words: ${amountToWordsGhana(listTotal)}`, '', ''],
              ],
            );
            return (
              <>
                <ModalHeader>Salary Payment Advice - {label}</ModalHeader>
                <ModalBody>
                  <DetailGrid>
                    <DetailField label="Month" value={monthLabel || '—'} />
                    <DetailField label="Bank / channel" value={label || '—'} />
                  </DetailGrid>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    <Input label="Signer Name" size="sm" value={signerName} onChange={(e) => setSignerName(e.target.value)} variant="bordered" />
                    <Input label="Signer Position" size="sm" value={signerPosition} onChange={(e) => setSignerPosition(e.target.value)} variant="bordered" />
                  </div>
                  <div className="text-sm text-gray-700 mt-3">
                    Please pay the underlisted staff of {hotelName} their net salaries via {label} for {monthLabel}.
                  </div>
                  <div className="mt-3 max-h-[50vh] overflow-y-auto">
                    <Table aria-label="payment-advice-detail" removeWrapper classNames={deskResizableTableClassNames()}>
                      <TableHeader>
                        <TableColumn className="w-[12%] text-center">No.</TableColumn>
                        <TableColumn className="w-[40%]">Name</TableColumn>
                        <TableColumn className="w-[30%]">Account / wallet</TableColumn>
                        <TableColumn className="w-[18%] text-right">Net</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {[
                          ...rows.map((r: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="text-center tabular-nums">{idx + 1}</TableCell>
                              <TableCell className="font-semibold text-ghana-black">{r.employeeName}</TableCell>
                              <TableCell>{r.accountNumber}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatMoney(r.net)}</TableCell>
                            </TableRow>
                          )),
                          <TableRow key="__total" className="bg-gray-50">
                            <TableCell>{' '}</TableCell>
                            <TableCell><strong>Total</strong></TableCell>
                            <TableCell>{' '}</TableCell>
                            <TableCell className="text-right tabular-nums"><strong>{formatMoney(listTotal)}</strong></TableCell>
                          </TableRow>,
                          <TableRow key="__words">
                            <TableCell colSpan={4}><em>Amount in words: {amountToWordsGhana(listTotal)}</em></TableCell>
                          </TableRow>,
                        ]}
                      </TableBody>
                    </Table>
                  </div>
                </ModalBody>
                <ModalFooter className="flex flex-wrap justify-between gap-2">
                  <Button variant="flat" onPress={() => setAdviceOpen(false)}>Close</Button>
                  {label && (
                    <div className="flex items-center gap-2">
                      <Button variant="bordered" onPress={printAdvice}>Print</Button>
                      <Button variant="flat" onPress={() => handleDownloadAdvicePdf(label)}>PDF</Button>
                      <Button variant="flat" onPress={() => handleDownloadAdviceXls(label)}>Excel</Button>
                    </div>
                  )}
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>

      {/* Row detail (the staff table's "View" action) */}
      <Modal
        isOpen={!!detailRow}
        onOpenChange={(open) => { if (!open) setDetailRow(null); }}
        size="lg"
        scrollBehavior="inside"
        classNames={{ body: 'gap-2 py-1', header: 'py-2', footer: 'py-2' }}
      >
        <ModalContent>
          {detailRow && (() => {
            const r = detailRow as any;
            const debtLines = readDebtRepayments(r.record?.notes);
            const debtTotal = debtLines.reduce((s, l) => s + l.amount, 0);
            const lines: Array<[string, number, boolean?]> = [
              ['Basic salary', r.basic], ['Allowances', r.allowances], ['Overtime & bonus', r.overtime], ['Gross pay', r.gross, true],
              ['Income tax', r.tax], [tier1Label, r.tier1], [tier2Label, r.tier2], [tier3Label, r.tier3], ['Other deductions', r.other], ['Net pay', r.net, true],
            ];
            const printPayslip = () => printDetailSheet(
              `${r.name} — ${r.month}`,
              [
                { label: 'Staff No.', value: r.staffNo || '—' },
                { label: 'Department', value: r.deptName || '—' },
                { label: 'Position', value: r.posTitle || '—' },
                { label: 'Payment status', value: PAY_CHIP[r.pay as PayStatus]?.label || r.pay },
                { label: 'Paid on', value: r.paidAt ? fmtDay(r.paidAt) : '—' },
                ...lines.map(([label, amount]) => ({ label, value: formatMoney(amount) })),
                ...debtLines.map((l) => ({ label: `Debt repayment (${l.type})`, value: formatMoney(l.amount) })),
              ],
              'Staff payroll detail',
            );
            return (
              <>
                <ModalHeader className="text-base">{r.name} — {r.month}</ModalHeader>
                <ModalBody>
                  <DetailGrid className="!gap-x-5 !gap-y-3">
                    <DetailField dense label="Staff No." value={r.staffNo || '—'} />
                    <DetailField dense label="Department / Position" value={`${r.deptName || '—'} / ${r.posTitle || '—'}`} />
                    <DetailField dense label="Payment status" value={<><Chip size="sm" variant="flat" color={PAY_CHIP[r.pay as PayStatus].color}>{PAY_CHIP[r.pay as PayStatus].label}</Chip>{r.paidAt ? <span className="ml-2 text-xs text-gray-500">{fmtDay(r.paidAt)}</span> : null}</>} />
                    <DetailField dense label="Pay to" value={r.record ? `${r.record.paymentMethod.replace('_', ' ')}${r.record.bankAccount ? ` · ${r.record.bankAccount}` : ''}` : '—'} />
                    {debtTotal > 0 && <DetailField dense label="Staff debt this month" value={formatGhs(debtTotal)} />}
                  </DetailGrid>
                  <Table isCompact removeWrapper aria-label="Pay breakdown" classNames={deskResizableTableClassNames()} className="text-sm mt-1">
                    <TableHeader><TableColumn>Item</TableColumn><TableColumn className="text-right">Amount</TableColumn></TableHeader>
                    <TableBody>
                      {[
                        ...lines.map(([label, amount, bold]) => (
                          <TableRow key={label} className={bold ? 'font-semibold' : ''}>
                            <TableCell className="py-1">{label}</TableCell>
                            <TableCell className={`py-1 text-right tabular-nums ${label === 'Net pay' ? 'text-green-700' : ''}`}>{formatMoney(amount)}</TableCell>
                          </TableRow>
                        )),
                        ...debtLines.map((l) => (
                          <TableRow key={l.debtId}>
                            <TableCell className="py-1 text-amber-800">Debt repayment ({l.type}{l.reason ? ` — ${l.reason}` : ''})</TableCell>
                            <TableCell className="py-1 text-right tabular-nums">{formatMoney(l.amount)}</TableCell>
                          </TableRow>
                        )),
                      ]}
                    </TableBody>
                  </Table>
                  {(() => {
                    const adj = readAdjustments(r.record?.notes);
                    return adj.reason ? <div className="px-2.5 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 mt-1">Adjusted{adj.editedBy ? ` by ${adj.editedBy}` : ''}: {adj.reason}</div> : null;
                  })()}
                  {r.pay === 'estimate' && (
                    <div className="px-2.5 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mt-1">
                      These are estimates from today&apos;s rates, not a processed payroll. Prepare a month to get the actual figures.
                    </div>
                  )}
                </ModalBody>
                <ModalFooter className="flex flex-wrap justify-between gap-2">
                  <Button size="sm" variant="flat" onPress={() => setDetailRow(null)}>Close</Button>
                  <div className="flex items-center gap-2">
                    {canEditLines && r.record && workPeriod && r.record.payrollPeriodId === workPeriod.id && (
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        onPress={() => {
                          const row = r as Row;
                          setDetailRow(null);
                          openEdit(row);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    <Button size="sm" variant="bordered" onPress={printPayslip}>Print</Button>
                  </div>
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
                <p className="text-sm text-gray-600">
                  Choose the month you are preparing salaries for. Every active staff member is calculated with the current rates, and HR-approved overtime for that month is included.
                  {requireApprovalForPayroll
                    ? ' After prepare, approve the month on Payment Advice before paying.'
                    : ' Approval is off in Settings — the month will be ready to pay on Payment Advice.'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Month" selectedKeys={[String(prepMonth)]} onSelectionChange={(k) => setPrepMonth(Number(Array.from(k)[0]) || 1)} variant="bordered">
                    {MONTHS.map((m, i) => <SelectItem key={String(i + 1)}>{m}</SelectItem>)}
                  </Select>
                  <Input label="Year" type="number" value={String(prepYear)} onChange={(e) => setPrepYear(Number(e.target.value) || new Date().getFullYear())} variant="bordered" />
                </div>
                <p className="text-sm"><strong>{MONTHS[prepMonth - 1]} {prepYear}</strong> · {activeStaff} active staff</p>
                {prepExisting && (
                  <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                    {MONTHS[prepMonth - 1]} {prepYear} has already been prepared ({STAGE_LABEL[periodStage(prepExisting)].toLowerCase()}). {periodStage(prepExisting) === 'awaiting' || periodStage(prepExisting) === 'draft' ? 'Open it under Staff Payroll or approve it on Payment Advice.' : 'See Payment Advice or History.'}
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

      {/* Approve confirmation (from Payment Advice) */}
      <Modal isOpen={confirm === 'approve'} onOpenChange={(open) => { if (!open) setConfirm(null); }} size="md">
        <ModalContent>
          {advicePeriod && adviceAwaiting && (
            <>
              <ModalHeader>Approve {periodMonth(advicePeriod)} payroll?</ModalHeader>
              <ModalBody>
                <p className="text-sm">{adviceRows.length} staff · Gross {formatGhs(adviceRows.reduce((s, r) => s + r.gross, 0))} · Net pay <strong className="text-green-700">{formatGhs(adviceRows.reduce((s, r) => s + r.net, 0))}</strong></p>
                <p className="text-xs text-gray-600">Approving confirms these figures are correct and posts this payroll to the ledger. It is recorded under your name ({currentUserName}) and can&apos;t be undone here. You can then mark staff as paid on this screen.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setConfirm(null)}>Cancel</Button>
                <Button color="primary" onPress={() => { void doApprove(advicePeriod); }}>Approve payroll</Button>
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
                <p className="text-sm">{advicePeriod && periodMonth(advicePeriod)} · <strong>{payIds.length}</strong> staff · <strong className="text-green-700">{formatGhs(payAmount)}</strong></p>
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

      {/* Edit one staff line (before approval) */}
      <Modal isOpen={!!editRow} onOpenChange={(open) => { if (!open) setEditRow(null); }} size="lg">
        <ModalContent>
          {editRow && (
            <>
              <ModalHeader>Edit {editRow.name} — {workPeriod ? periodMonth(workPeriod) : ''}</ModalHeader>
              <ModalBody>
                <p className="text-sm text-gray-600">Saving recalculates this person&apos;s income tax and contributions with today&apos;s rates, then updates the month&apos;s totals. Currently: gross {formatGhs(editRow.gross)}, net <strong className="text-green-700">{formatGhs(editRow.net)}</strong>.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Allowances (GHS)" type="number" min={0} value={editForm.allowances} onChange={(e) => setEditForm({ ...editForm, allowances: e.target.value })} variant="bordered" />
                  <Input label="Overtime hours" type="number" min={0} value={editForm.overtimeHours} onChange={(e) => setEditForm({ ...editForm, overtimeHours: e.target.value })} variant="bordered" description="Starts from the HR-approved hours" />
                  <Input label="Bonus (GHS, taxable)" type="number" min={0} value={editForm.bonus} onChange={(e) => setEditForm({ ...editForm, bonus: e.target.value })} variant="bordered" />
                  <Input label="Other deduction (GHS, after tax)" type="number" min={0} value={editForm.otherDeduction} onChange={(e) => setEditForm({ ...editForm, otherDeduction: e.target.value })} variant="bordered" description="Loan repayment, salary advance…" />
                </div>
                <Input label="Reason for the change" isRequired value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} variant="bordered" />
                {editError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{editError}</div>}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setEditRow(null)}>Cancel</Button>
                <Button color="primary" onPress={doEditSave}>Save and recalculate</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete a prepared month */}
      <Modal isOpen={deleteOpen} onOpenChange={setDeleteOpen} size="md">
        <ModalContent>
          {workPeriod && (
            <>
              <ModalHeader>Delete {periodMonth(workPeriod)} payroll?</ModalHeader>
              <ModalBody>
                <p className="text-sm">This removes the prepared payroll for {workRows.length} staff, its draft ledger entry and its PAYE/SSNIT filing hints. Nothing has been approved or paid, so no money records are affected.</p>
                <p className="text-xs text-gray-600">You can prepare {periodMonth(workPeriod)} again afterwards. This can&apos;t be undone.</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setDeleteOpen(false)}>Cancel</Button>
                <Button color="danger" onPress={doDelete}>Delete month</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
