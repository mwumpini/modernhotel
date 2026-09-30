'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { Card, CardBody } from '@heroui/react';
import CustomizeViewControl, { HideCardButton } from '../dashboard/CustomizeViewControl';
import {
  useDashboardVisibility,
  type DashboardSectionDef,
} from '../../lib/dashboard/useDashboardVisibility';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from '../dashboard/deskTabsUi';

export { deskBookTabsClassNames, deskBookTabPanelClassName };

export const AR_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'ar.totalInvoiced', label: 'Total Invoiced' },
  { id: 'ar.outstanding', label: 'Outstanding AR' },
  { id: 'ar.receipts', label: 'Total Receipts' },
  { id: 'ar.whtCredits', label: 'WHT Credits' },
];

export const AP_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'ap.totalPayables', label: 'Total Payables' },
  { id: 'ap.overdue', label: 'Overdue' },
  { id: 'ap.totalInvoices', label: 'Total Invoices' },
  { id: 'ap.totalPayments', label: 'Total Payments' },
];

export const BANK_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'bank.totalBalance', label: 'Total Bank Balance' },
  { id: 'bank.totalCash', label: 'Total Cash' },
  { id: 'bank.netCashFlow', label: 'Net Cash Flow' },
];

export const PPE_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'ppe.totalCost', label: 'Total cost' },
  { id: 'ppe.accumDep', label: 'Depreciation so far' },
  { id: 'ppe.nbv', label: 'Book value' },
  { id: 'ppe.graWdv', label: 'GRA written-down value' },
  { id: 'ppe.graCa', label: 'GRA allowance this year' },
];

export const TAX_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'tax.output', label: 'Output Tax Collected' },
  { id: 'tax.withholding', label: 'Withholding' },
  { id: 'tax.input', label: 'Input Tax Offset' },
  { id: 'tax.payroll', label: 'Payroll Withheld' },
  { id: 'tax.remitted', label: 'Remitted' },
  { id: 'tax.net', label: 'Net Tax Position' },
];

export const CRC_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'crc.spendBudget', label: 'Spending budget' },
  { id: 'crc.spent', label: 'Spent so far' },
  { id: 'crc.incomeTarget', label: 'Income target' },
  { id: 'crc.earned', label: 'Earned so far' },
];

export const COA_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'coa.main', label: 'Main accounts' },
  { id: 'coa.all', label: 'All accounts' },
  { id: 'coa.withBalance', label: 'With a balance' },
];

export const JOURNAL_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'journal.entries', label: 'Entries' },
  { id: 'journal.debits', label: 'Debits' },
  { id: 'journal.credits', label: 'Credits' },
];

export const AUDIT_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'audit.total', label: 'Entries' },
  { id: 'audit.create', label: 'Added' },
  { id: 'audit.update', label: 'Changed' },
];

export const ALL_BOOKS_KPI_SECTIONS: DashboardSectionDef[] = [
  ...AR_KPI_SECTIONS,
  ...AP_KPI_SECTIONS,
  ...BANK_KPI_SECTIONS,
  ...PPE_KPI_SECTIONS,
  ...TAX_KPI_SECTIONS,
  ...CRC_KPI_SECTIONS,
  ...COA_KPI_SECTIONS,
  ...JOURNAL_KPI_SECTIONS,
  ...AUDIT_KPI_SECTIONS,
];

export const BOOK_KPI_SECTIONS_BY_TAB: Record<string, DashboardSectionDef[]> = {
  receivables: AR_KPI_SECTIONS,
  payables: AP_KPI_SECTIONS,
  banking: BANK_KPI_SECTIONS,
  assets: PPE_KPI_SECTIONS,
  taxes: TAX_KPI_SECTIONS,
  'cost-centers': CRC_KPI_SECTIONS,
  accounts: COA_KPI_SECTIONS,
  journal: JOURNAL_KPI_SECTIONS,
  audit: AUDIT_KPI_SECTIONS,
};

export type DeskVisibilityApi = {
  isHidden: (id: string) => boolean;
  hide: (id: string) => void;
  show: (id: string) => void;
  toggle: (id: string) => void;
  showAll: () => void;
  hiddenCount: number;
};

const DeskVisibilityContext = createContext<DeskVisibilityApi | null>(null);

export function AccountingDeskVisibilityProvider({
  value,
  children,
}: {
  value: DeskVisibilityApi;
  children: React.ReactNode;
}) {
  return (
    <DeskVisibilityContext.Provider value={value}>
      {children}
    </DeskVisibilityContext.Provider>
  );
}

/** Prefer dashboard-provided visibility so ✕ and header Customize share state. */
export function useAccountingDeskVisibility(
  fallbackSections: DashboardSectionDef[] = ALL_BOOKS_KPI_SECTIONS,
  fallbackKey = 'dashboard.hidden.accounting',
): DeskVisibilityApi {
  const ctx = useContext(DeskVisibilityContext);
  const local = useDashboardVisibility(fallbackKey, fallbackSections);
  return ctx ?? local;
}

export type DeskKpiItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  tone?: string;
};

export function DeskKpiStrip({
  items,
  className = 'mb-3',
}: {
  items: DeskKpiItem[];
  className?: string;
}) {
  const { isHidden, hide } = useAccountingDeskVisibility();
  const visible = items.filter((item) => !isHidden(item.id));
  if (visible.length === 0) return null;

  return (
    <div className={`grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-7 ${className}`}>
      {visible.map((item) => (
        <Card key={item.id} className="relative border border-gray-200 shadow-none">
          <CardBody className="px-2 py-1.5 text-center">
            <div className="absolute right-1 top-0.5">
              <HideCardButton size="sm" onHide={() => hide(item.id)} label={item.label} />
            </div>
            <div className={`text-base font-semibold tabular-nums ${item.tone || 'text-gray-900'}`}>
              {item.value}
            </div>
            <div className="text-xs leading-tight text-gray-500">{item.label}</div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

/** Tab-scoped Customize for the Accounting header (or a book header fallback). */
export function DeskKpiCustomize({
  sections,
  className,
}: {
  sections: DashboardSectionDef[];
  className?: string;
}) {
  const { isHidden, show, toggle, showAll } = useAccountingDeskVisibility();
  const hiddenCount = useMemo(
    () => sections.filter((s) => isHidden(s.id)).length,
    [sections, isHidden],
  );

  const showAllInScope = () => {
    if (hiddenCount === 0) {
      showAll();
      return;
    }
    sections.forEach((s) => {
      if (isHidden(s.id)) show(s.id);
    });
  };

  return (
    <CustomizeViewControl
      sections={sections}
      isHidden={isHidden}
      toggle={toggle}
      showAll={showAllInScope}
      hiddenCount={hiddenCount}
      className={className}
    />
  );
}
