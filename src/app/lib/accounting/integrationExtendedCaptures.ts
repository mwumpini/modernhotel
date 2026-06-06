'use client';

/**
 * Extended integration captures — Menish / full hotel accounting architecture.
 * Expense, AP payments, POs, inventory movements, payroll (SSNIT/PAYE), fixed assets,
 * accruals, prepayments, tax provisions. Posts to useAccountingStore (invoices, payments, JE, registers).
 */

import { useAccountingStore } from './store';
import type { Invoice, InvoiceLine, JournalEntry, Payment, FixedAsset } from './models';
import { resolveCapitalAllowancePool } from './capitalAllowance';
import type {
  PurchaseOrder,
  MenishCostCenterCode,
  SupplierExpenseType,
  InventoryAccountingTransaction,
  InventoryItemType,
  InventoryTxnType,
  PayrollLedgerEntry,
  SsnitRegisterEntry,
  PayeRegisterEntry,
  AccrualLedgerEntry,
  PrepaymentLedgerEntry,
  TaxProvisionEntry,
} from './accountingArchitectureModels';
import { computeStackedTaxLines, getEffectiveTaxConfigs, type StackedTaxLine } from './taxFromConfig';

const GL = {
  AP: '2200',
  CASH: '1000',
  BANK: '1100',
  INVENTORY: '1300',
  FB_COGS: '5110',
  PAYROLL: '5210',
  SSNIT_EXP: '5221',
  PAYE_PAY: '2210',
  SSNIT_PAY: '2220',
  ACCRUED: '2300',
  PREPAID: '1400',
  FIXED_ASSET: '1510',
  ACCUM_DEP: '1520',
  DEP_EXP: '5710',
  TAX_EXP: '5800',
} as const;

const EXPENSE_GL: Record<SupplierExpenseType, string> = {
  food: '5110',
  beverage: '5110',
  utilities: '5310',
  repairs: '5410',
  other: '5600',
};

/** Map Menish cost-center tags to existing `CostCenter.code` values in the store. */
const MENISH_TO_CC: Record<MenishCostCenterCode, string> = {
  rooms: 'FO',
  food: 'FB',
  admin: 'FO',
  events: 'FB',
};

function nowIso() {
  return new Date().toISOString();
}

function jeNumber() {
  return `JE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
}

function lineId() {
  return `JL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function purchaseInvoiceTaxBreakdown(
  taxable: number,
  lines: StackedTaxLine[]
): NonNullable<Invoice['taxBreakdown']> {
  const tb: NonNullable<Invoice['taxBreakdown']> = { taxableAmount: taxable };
  for (const l of lines) {
    const code = l.taxCode.toUpperCase();
    if (code === 'VAT') tb.vat = l.amount;
    else if (code === 'NHIL') tb.nhil = l.amount;
    else if (code === 'GETFUND') tb.getfund = l.amount;
    else if (code === 'TOURISM') tb.tourism = l.amount;
    else if (code === 'COVID19') tb.covid = (tb.covid || 0) + l.amount;
    else tb.other = (tb.other || 0) + l.amount;
  }
  return tb;
}

/**
 * Dr expense (net) + Dr each input tax per active `TaxConfig` (rates + `glAccountCode`), Cr AP (gross).
 * - `taxAmount === 0` → no tax lines.
 * - `taxAmount` omitted → full stack from tax settings (NHIL, GETFund, Tourism, … then VAT on net+pre-VAT).
 * - `taxAmount > 0` → amounts scaled so components sum to the supplier’s total tax.
 */
export function captureExpense(input: {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  /** Tax-exclusive net. Omit `taxAmount` to apply standard Ghana purchase tax stack on this net. */
  taxAmount?: number;
  expenseType: SupplierExpenseType;
  costCenter: MenishCostCenterCode;
  description?: string;
  currency?: string;
  poId?: string;
}): { invoiceId: string; journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const invId = `PINV-${Date.now()}`;
  const jeId = `JE-EXP-${Date.now()}`;
  const expenseGl = EXPENSE_GL[input.expenseType];
  const cur = input.currency || 'GHS';

  const taxCfgs = getEffectiveTaxConfigs(store.taxConfigs);
  const { lines: purchaseTaxLines, totalTax, gross: grossPayable } =
    input.taxAmount === 0
      ? { lines: [] as StackedTaxLine[], totalTax: 0, gross: input.amount }
      : computeStackedTaxLines(
          input.amount,
          taxCfgs,
          'purchase',
          input.taxAmount != null && input.taxAmount > 0 ? input.taxAmount : undefined
        );

  const invLine: InvoiceLine = {
    id: `IL-${Date.now()}`,
    invoiceId: invId,
    description: input.description || `Supplier expense (${input.expenseType})`,
    quantity: 1,
    unitPrice: input.amount,
    amount: input.amount,
    taxCode: totalTax > 0 ? 'GH_STANDARD' : undefined,
    taxAmount: totalTax,
    glAccountCode: expenseGl,
    costCenter: input.costCenter,
  };

  const invoice: Invoice = {
    id: invId,
    invoiceNumber: input.invoiceNumber,
    type: 'Purchase',
    date: input.invoiceDate,
    dueDate: input.dueDate,
    businessPartnerId: input.supplierId,
    reference: input.poId,
    description: input.description || `Supplier invoice ${input.invoiceNumber}`,
    subtotal: input.amount,
    taxAmount: totalTax,
    total: grossPayable,
    currency: cur,
    status: 'Posted',
    paidAmount: 0,
    journalEntryId: jeId,
    createdAt: now,
    updatedAt: now,
    lines: [invLine],
    poNumber: input.poId,
    workflowStatus: 'Approved',
    sourceModule: 'integration_extended_expense',
    taxScheme: totalTax > 0 ? 'GH_STANDARD' : 'NONE',
    taxBreakdown: purchaseInvoiceTaxBreakdown(input.amount, purchaseTaxLines),
  };

  const jeLines: JournalEntry['lines'] = [
    {
      id: lineId(),
      journalEntryId: jeId,
      accountCode: expenseGl,
      description: invLine.description,
      debit: input.amount,
      credit: 0,
      currency: cur,
      costCenter: input.costCenter,
    },
  ];
  for (const tl of purchaseTaxLines) {
    jeLines.push({
      id: lineId(),
      journalEntryId: jeId,
      accountCode: tl.glAccountCode,
      description: `${tl.name} on purchase (input / recoverable)`,
      debit: tl.amount,
      credit: 0,
      currency: cur,
      costCenter: input.costCenter,
    });
  }
  jeLines.push({
    id: lineId(),
    journalEntryId: jeId,
    accountCode: GL.AP,
    description: `Accounts payable — ${input.supplierId}`,
    debit: 0,
    credit: grossPayable,
    currency: cur,
    costCenter: input.costCenter,
  });

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.invoiceDate,
    reference: input.invoiceNumber,
    description: `AP: Supplier invoice ${input.invoiceNumber}`,
    totalDebit: grossPayable,
    totalCredit: grossPayable,
    currency: cur,
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'integration_extended_expense',
    sourceTransactionId: invId,
    lines: jeLines,
  };

  try {
    store.addInvoice(invoice);
    store.addJournalEntry(je as any);
    store.recordExpense(MENISH_TO_CC[input.costCenter] || 'FO', grossPayable);
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'integrationExtendedCaptures',
      recordId: invId,
      action: 'Create',
      newValues: {
        type: 'captureExpense',
        invoiceId: invId,
        journalEntryId: jeId,
        grossPayable,
        taxLines: purchaseTaxLines.map((l) => ({ code: l.taxCode, amount: l.amount, gl: l.glAccountCode })),
      },
      userId: 'system',
      timestamp: now,
    });
    return { invoiceId: invId, journalEntryId: jeId };
  } catch (e) {
    console.error('[integrationExtendedCaptures] captureExpense', e);
    return null;
  }
}

/** Dr AP, Cr Bank/Cash — supplier payment. */
export function captureSupplierPayment(input: {
  supplierId: string;
  amount: number;
  date?: string;
  reference?: string;
  description?: string;
  purchaseInvoiceId?: string;
  paymentMethod?: 'Bank' | 'Cash';
  currency?: string;
}): { paymentId: string; journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const d = input.date || now;
  const payId = `SPAY-${Date.now()}`;
  const jeId = `JE-SPAY-${Date.now()}`;
  const method = input.paymentMethod || 'Bank';
  const creditGl = method === 'Cash' ? GL.CASH : GL.BANK;

  const payment: Payment = {
    id: payId,
    paymentNumber: `PV-${Date.now().toString().slice(-8)}`,
    date: d,
    type: 'Payment',
    businessPartnerId: input.supplierId,
    invoiceId: input.purchaseInvoiceId,
    reference: input.reference,
    description: input.description || `Supplier payment ${input.reference || ''}`,
    amount: input.amount,
    currency: input.currency || 'GHS',
    paymentMethod: method,
    status: 'Posted',
    journalEntryId: jeId,
    createdAt: now,
    updatedAt: now,
  };

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: d,
    reference: payment.paymentNumber,
    description: payment.description,
    totalDebit: input.amount,
    totalCredit: input.amount,
    currency: input.currency || 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'integration_extended_supplier_payment',
    sourceTransactionId: payId,
    lines: [
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: GL.AP,
        description: 'Reduce AP',
        debit: input.amount,
        credit: 0,
        currency: input.currency || 'GHS',
      },
      {
        id: lineId(),
        journalEntryId: jeId,
        accountCode: creditGl,
        description: `${method} out`,
        debit: 0,
        credit: input.amount,
        currency: input.currency || 'GHS',
      },
    ],
  };

  try {
    store.addPayment(payment);
    store.addJournalEntry(je as any);
    if (input.purchaseInvoiceId) {
      const inv = store.invoices.find((i) => i.id === input.purchaseInvoiceId);
      if (inv && inv.type === 'Purchase') {
        const paid = (inv.paidAmount || 0) + input.amount;
        store.updateInvoice(inv.id, {
          paidAmount: paid,
          status: paid >= inv.total ? 'Paid' : inv.status,
          paidDate: paid >= inv.total ? now : inv.paidDate,
          updatedAt: now,
        } as any);
      }
    }
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'integrationExtendedCaptures',
      recordId: payId,
      action: 'Create',
      newValues: { type: 'captureSupplierPayment', paymentId: payId, amount: input.amount },
      userId: 'system',
      timestamp: now,
    });
    return { paymentId: payId, journalEntryId: jeId };
  } catch (e) {
    console.error('[integrationExtendedCaptures] captureSupplierPayment', e);
    return null;
  }
}

export function capturePurchaseOrder(input: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: PurchaseOrder['status'] }): PurchaseOrder | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const po: PurchaseOrder = {
    ...input,
    id: `PO-${Date.now()}`,
    status: input.status || 'draft',
    createdAt: now,
    updatedAt: now,
  };
  try {
    store.addPurchaseOrder(po);
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'integrationExtendedCaptures',
      recordId: po.id,
      action: 'Create',
      newValues: { type: 'capturePurchaseOrder', poId: po.id },
      userId: 'system',
      timestamp: now,
    });
    return po;
  } catch (e) {
    console.error('[integrationExtendedCaptures] capturePurchaseOrder', e);
    return null;
  }
}

export function convertPOToExpense(
  poId: string,
  expenseOverrides?: Partial<{
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    taxAmount: number;
    expenseType: SupplierExpenseType;
  }>
): { invoiceId: string; journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const po = store.purchaseOrders.find((p) => p.id === poId);
  if (!po) return null;
  const invNo = expenseOverrides?.invoiceNumber || `INV-PO-${po.orderNumber}`;
  const res = captureExpense({
    supplierId: po.supplierId,
    invoiceNumber: invNo,
    invoiceDate: expenseOverrides?.invoiceDate || nowIso().slice(0, 10),
    dueDate: expenseOverrides?.dueDate || nowIso().slice(0, 10),
    amount: po.subtotal,
    taxAmount: expenseOverrides?.taxAmount ?? po.taxAmount,
    expenseType: expenseOverrides?.expenseType || 'other',
    costCenter: po.costCenter || 'admin',
    description: `Receipt against PO ${po.orderNumber}`,
    poId,
  });
  if (res) {
    store.updatePurchaseOrder(poId, { status: 'received', updatedAt: nowIso() });
  }
  return res;
}

export function captureStockReceipt(input: {
  itemId: string;
  itemType: InventoryItemType;
  quantity: number;
  unitCost: number;
  date?: string;
  referenceId: string;
  costCenter: string;
}): { id: string; journalEntryId: string } | null {
  return postInventoryMovement({
    ...input,
    transactionType: 'receipt',
    date: input.date || nowIso().slice(0, 10),
  });
}

export function captureStockUsage(input: {
  itemId: string;
  itemType: InventoryItemType;
  quantity: number;
  unitCost: number;
  date?: string;
  referenceId: string;
  costCenter: string;
}): { id: string; journalEntryId: string } | null {
  return postInventoryMovement({
    ...input,
    transactionType: 'usage',
    date: input.date || nowIso().slice(0, 10),
  });
}

export function captureStockAdjustment(input: {
  itemId: string;
  itemType: InventoryItemType;
  quantity: number;
  unitCost: number;
  date?: string;
  referenceId: string;
  costCenter: string;
}): { id: string; journalEntryId: string } | null {
  return postInventoryMovement({
    ...input,
    transactionType: 'adjustment',
    date: input.date || nowIso().slice(0, 10),
  });
}

export function captureStockCount(input: {
  itemId: string;
  itemType: InventoryItemType;
  quantity: number;
  unitCost: number;
  date?: string;
  referenceId: string;
  costCenter: string;
}): { id: string; journalEntryId: string } | null {
  return postInventoryMovement({
    ...input,
    transactionType: 'count',
    date: input.date || nowIso().slice(0, 10),
  });
}

function postInventoryMovement(input: {
  itemId: string;
  itemType: InventoryItemType;
  transactionType: InventoryTxnType;
  quantity: number;
  unitCost: number;
  date: string;
  referenceId: string;
  costCenter: string;
}): { id: string; journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const total = Math.abs(input.quantity * input.unitCost);
  if (total <= 0) return null;
  const id = `IAT-${Date.now()}`;
  const jeId = `JE-INV-${Date.now()}`;
  const isIncrease =
    input.transactionType === 'receipt' ||
    ((input.transactionType === 'count' || input.transactionType === 'adjustment') && input.quantity > 0);

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.date,
    reference: input.referenceId,
    description: `Inventory ${input.transactionType} — ${input.itemId}`,
    totalDebit: total,
    totalCredit: total,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'integration_extended_inventory',
    sourceTransactionId: id,
    lines: isIncrease
      ? [
          { id: lineId(), journalEntryId: jeId, accountCode: GL.INVENTORY, description: 'Inventory increase', debit: total, credit: 0, currency: 'GHS', costCenter: input.costCenter },
          { id: lineId(), journalEntryId: jeId, accountCode: GL.AP, description: 'GRNI / AP (simplified)', debit: 0, credit: total, currency: 'GHS', costCenter: input.costCenter },
        ]
      : [
          { id: lineId(), journalEntryId: jeId, accountCode: GL.FB_COGS, description: 'COGS / usage', debit: total, credit: 0, currency: 'GHS', costCenter: input.costCenter },
          { id: lineId(), journalEntryId: jeId, accountCode: GL.INVENTORY, description: 'Inventory decrease', debit: 0, credit: total, currency: 'GHS', costCenter: input.costCenter },
        ],
  };

  const row: InventoryAccountingTransaction = {
    id,
    itemId: input.itemId,
    itemType: input.itemType,
    transactionType: input.transactionType,
    quantity: input.quantity,
    unitCost: input.unitCost,
    totalValue: total,
    date: input.date,
    referenceId: input.referenceId,
    journalEntryId: jeId,
    costCenter: input.costCenter,
    createdAt: now,
  };

  try {
    store.addJournalEntry(je as any);
    store.addInventoryAccountingTransaction(row);
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'integrationExtendedCaptures',
      recordId: id,
      action: 'Create',
      newValues: { type: 'inventory', transactionType: input.transactionType, total },
      userId: 'system',
      timestamp: now,
    });
    return { id, journalEntryId: jeId };
  } catch (e) {
    console.error('[integrationExtendedCaptures] inventory', e);
    return null;
  }
}

export function capturePayroll(input: {
  period: string;
  grossSalary: number;
  ssnitEmployer: number;
  ssnitEmployee: number;
  payeWithheld: number;
  staffWelfare?: number;
  netPay: number;
  paymentDate: string;
}): { payrollId: string; journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const pid = `PAY-${Date.now()}`;
  const jeId = `JE-PAYROLL-${Date.now()}`;
  const welfare = input.staffWelfare || 0;
  const debitTotal = input.grossSalary + input.ssnitEmployer + welfare;
  const creditTotal =
    input.payeWithheld +
    input.ssnitEmployee +
    input.ssnitEmployer +
    input.netPay +
    welfare;

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.paymentDate,
    reference: pid,
    description: `Payroll ${input.period}`,
    totalDebit: debitTotal,
    totalCredit: creditTotal,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'integration_extended_payroll',
    sourceTransactionId: pid,
    lines: [
      { id: lineId(), journalEntryId: jeId, accountCode: GL.PAYROLL, description: 'Gross salaries', debit: input.grossSalary, credit: 0, currency: 'GHS' },
      { id: lineId(), journalEntryId: jeId, accountCode: GL.SSNIT_EXP, description: 'Employer SSNIT', debit: input.ssnitEmployer, credit: 0, currency: 'GHS' },
      ...(welfare > 0
        ? [{ id: lineId(), journalEntryId: jeId, accountCode: '5220', description: 'Staff welfare expense', debit: welfare, credit: 0, currency: 'GHS' }]
        : []),
      { id: lineId(), journalEntryId: jeId, accountCode: GL.PAYE_PAY, description: 'PAYE withheld', debit: 0, credit: input.payeWithheld, currency: 'GHS' },
      { id: lineId(), journalEntryId: jeId, accountCode: GL.SSNIT_PAY, description: 'SSNIT payable', debit: 0, credit: input.ssnitEmployee + input.ssnitEmployer, currency: 'GHS' },
      { id: lineId(), journalEntryId: jeId, accountCode: GL.BANK, description: 'Net pay', debit: 0, credit: input.netPay, currency: 'GHS' },
      ...(welfare > 0
        ? [{ id: lineId(), journalEntryId: jeId, accountCode: GL.ACCRUED, description: 'Welfare / benefits payable', debit: 0, credit: welfare, currency: 'GHS' }]
        : []),
    ],
  };

  const entry: PayrollLedgerEntry = {
    id: pid,
    period: input.period,
    grossSalary: input.grossSalary,
    ssnitEmployer: input.ssnitEmployer,
    ssnitEmployee: input.ssnitEmployee,
    payeWithheld: input.payeWithheld,
    staffWelfare: welfare,
    netPay: input.netPay,
    paymentDate: input.paymentDate,
    journalEntryId: jeId,
    createdAt: now,
  };

  const ssnit: SsnitRegisterEntry = {
    id: `SSNIT-${Date.now()}`,
    payrollEntryId: pid,
    period: input.period,
    employerAmount: input.ssnitEmployer,
    employeeAmount: input.ssnitEmployee,
    journalEntryId: jeId,
    createdAt: now,
  };

  const paye: PayeRegisterEntry = {
    id: `PAYE-${Date.now()}`,
    payrollEntryId: pid,
    period: input.period,
    amount: input.payeWithheld,
    journalEntryId: jeId,
    createdAt: now,
  };

  try {
    store.addJournalEntry(je as any);
    store.addPayrollLedgerEntry(entry);
    store.addSsnitRegisterEntry(ssnit);
    store.addPayeRegisterEntry(paye);
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'integrationExtendedCaptures',
      recordId: pid,
      action: 'Create',
      newValues: { type: 'capturePayroll', period: input.period },
      userId: 'system',
      timestamp: now,
    });
    return { payrollId: pid, journalEntryId: jeId };
  } catch (e) {
    console.error('[integrationExtendedCaptures] capturePayroll', e);
    return null;
  }
}

export function captureSSNIT(input: Omit<SsnitRegisterEntry, 'id' | 'createdAt'>): SsnitRegisterEntry | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const row: SsnitRegisterEntry = { ...input, id: `SSNIT-ST-${Date.now()}`, createdAt: now };
  try {
    store.addSsnitRegisterEntry(row);
    return row;
  } catch {
    return null;
  }
}

export function capturePAYE(input: Omit<PayeRegisterEntry, 'id' | 'createdAt'>): PayeRegisterEntry | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const row: PayeRegisterEntry = { ...input, id: `PAYE-ST-${Date.now()}`, createdAt: now };
  try {
    store.addPayeRegisterEntry(row);
    return row;
  } catch {
    return null;
  }
}

export function captureStaffWelfare(input: { period: string; amount: number; paymentDate: string; reference?: string }): { journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const jeId = `JE-WELF-${Date.now()}`;
  const amt = input.amount;
  if (amt <= 0) return null;
  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.paymentDate,
    reference: input.reference || input.period,
    description: `Staff welfare — ${input.period}`,
    totalDebit: amt,
    totalCredit: amt,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'integration_extended_welfare',
    sourceTransactionId: jeId,
    lines: [
      { id: lineId(), journalEntryId: jeId, accountCode: '5220', description: 'Staff welfare', debit: amt, credit: 0, currency: 'GHS' },
      { id: lineId(), journalEntryId: jeId, accountCode: GL.ACCRUED, description: 'Welfare payable', debit: 0, credit: amt, currency: 'GHS' },
    ],
  };
  try {
    store.addJournalEntry(je as any);
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'integrationExtendedCaptures',
      recordId: jeId,
      action: 'Create',
      newValues: { type: 'captureStaffWelfare', amount: amt },
      userId: 'system',
      timestamp: now,
    });
    return { journalEntryId: jeId };
  } catch {
    return null;
  }
}

export function captureFixedAsset(input: {
  name: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  currency: string;
  usefulLife: number;
  salvageValue: number;
  depreciationMethod?: FixedAsset['depreciationMethod'];
  depreciationRate?: number;
  description?: string;
  location?: string;
  department?: string;
  glAccountCode?: string;
  assetNumber?: string;
  accumulatedDepreciation?: number;
  capitalAllowancePool?: import('./capitalAllowance').CapitalAllowancePool;
  paymentGlCode?: string;
}): { assetId: string; journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const jeId = `JE-FA-${Date.now()}`;
  const assetId = `FA-${Date.now()}`;
  const cost = input.purchaseCost;
  const accum = input.accumulatedDepreciation ?? 0;
  const nbv = cost - accum;
  const method = input.depreciationMethod || 'Straight Line';
  const rate = input.depreciationRate ?? (input.usefulLife > 0 ? 100 / input.usefulLife : 10);
  const caPool = input.capitalAllowancePool || resolveCapitalAllowancePool(input.category);
  const creditGl = input.paymentGlCode || GL.AP;

  const asset: FixedAsset = {
    id: assetId,
    assetNumber: input.assetNumber || assetId,
    name: input.name,
    description: input.description,
    category: input.category,
    purchaseDate: input.purchaseDate,
    purchaseCost: cost,
    currency: input.currency,
    usefulLife: input.usefulLife,
    salvageValue: input.salvageValue,
    depreciationMethod: method,
    depreciationRate: rate,
    accumulatedDepreciation: accum,
    netBookValue: nbv,
    capitalAllowancePool: caPool,
    accumulatedCapitalAllowance: 0,
    location: input.location,
    department: input.department,
    status: 'Active',
    glAccountCode: input.glAccountCode || GL.FIXED_ASSET,
    capitalizationJournalEntryId: jeId,
    createdAt: now,
    updatedAt: now,
  };

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.purchaseDate,
    reference: asset.assetNumber,
    description: `Capitalize fixed asset — ${input.name}`,
    totalDebit: cost,
    totalCredit: cost,
    currency: input.currency,
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'integration_extended_fixed_asset',
    sourceTransactionId: assetId,
    lines: [
      { id: lineId(), journalEntryId: jeId, accountCode: asset.glAccountCode, description: 'Asset cost', debit: cost, credit: 0, currency: input.currency },
      { id: lineId(), journalEntryId: jeId, accountCode: creditGl, description: creditGl === GL.AP ? 'AP / supplier payable' : 'Cash / bank payment', debit: 0, credit: cost, currency: input.currency },
    ],
  };

  try {
    store.addFixedAsset(asset);
    store.addJournalEntry(je as any);
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'integrationExtendedCaptures',
      recordId: assetId,
      action: 'Create',
      newValues: { type: 'captureFixedAsset', cost },
      userId: 'system',
      timestamp: now,
    });
    return { assetId, journalEntryId: jeId };
  } catch (e) {
    console.error('[integrationExtendedCaptures] captureFixedAsset', e);
    return null;
  }
}

export function captureDepreciation(input: { assetId: string; period: string; amount: number; date?: string }): { scheduleId: string; journalEntryId: string } | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const asset = store.fixedAssets.find((a) => a.id === input.assetId);
  if (!asset) return null;
  const jeId = `JE-DEP-${Date.now()}`;
  const schedId = `DEP-${Date.now()}`;
  const d = input.date || nowIso().slice(0, 10);
  const newAccum = asset.accumulatedDepreciation + input.amount;
  const newNbv = asset.purchaseCost - newAccum;

  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: d,
    reference: schedId,
    description: `Depreciation ${input.period} — ${asset.name}`,
    totalDebit: input.amount,
    totalCredit: input.amount,
    currency: asset.currency,
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'integration_extended_depreciation',
    sourceTransactionId: schedId,
    lines: [
      { id: lineId(), journalEntryId: jeId, accountCode: GL.DEP_EXP, description: 'Depreciation expense', debit: input.amount, credit: 0, currency: asset.currency },
      { id: lineId(), journalEntryId: jeId, accountCode: GL.ACCUM_DEP, description: 'Accumulated depreciation', debit: 0, credit: input.amount, currency: asset.currency },
    ],
  };

  try {
    store.addJournalEntry(je as any);
    store.setDepreciationSchedules([
      ...store.depreciationSchedules,
      {
        id: schedId,
        assetId: input.assetId,
        period: input.period,
        depreciationAmount: input.amount,
        accumulatedDepreciation: newAccum,
        netBookValue: newNbv,
        isPosted: true,
        journalEntryId: jeId,
        createdAt: now,
      },
    ]);
    store.updateFixedAsset(input.assetId, {
      accumulatedDepreciation: newAccum,
      netBookValue: newNbv,
      updatedAt: now,
    });
    store.addAuditTrail({
      id: `AT-${Date.now()}`,
      tableName: 'integrationExtendedCaptures',
      recordId: schedId,
      action: 'Post',
      newValues: { type: 'captureDepreciation', amount: input.amount },
      userId: 'system',
      timestamp: now,
    });
    return { scheduleId: schedId, journalEntryId: jeId };
  } catch (e) {
    console.error('[integrationExtendedCaptures] captureDepreciation', e);
    return null;
  }
}

export function captureAccrual(input: Omit<AccrualLedgerEntry, 'id' | 'journalEntryId' | 'createdAt'>): AccrualLedgerEntry | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const id = `ACC-${Date.now()}`;
  const jeId = `JE-ACC-${Date.now()}`;
  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.accrualDate,
    reference: id,
    description: input.description,
    totalDebit: input.amount,
    totalCredit: input.amount,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'integration_extended_accrual',
    sourceTransactionId: id,
    lines: [
      { id: lineId(), journalEntryId: jeId, accountCode: input.expenseGlCode, description: input.description, debit: input.amount, credit: 0, currency: 'GHS', costCenter: input.costCenter },
      { id: lineId(), journalEntryId: jeId, accountCode: GL.ACCRUED, description: 'Accrued liability', debit: 0, credit: input.amount, currency: 'GHS', costCenter: input.costCenter },
    ],
  };
  const row: AccrualLedgerEntry = { ...input, id, journalEntryId: jeId, createdAt: now };
  try {
    store.addJournalEntry(je as any);
    store.addAccrualLedgerEntry(row);
    return row;
  } catch {
    return null;
  }
}

export function capturePrepayment(input: Omit<PrepaymentLedgerEntry, 'id' | 'journalEntryId' | 'createdAt'>): PrepaymentLedgerEntry | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const id = `PRE-${Date.now()}`;
  const jeId = `JE-PRE-${Date.now()}`;
  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: input.paymentDate,
    reference: id,
    description: input.description,
    totalDebit: input.amount,
    totalCredit: input.amount,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'integration_extended_prepayment',
    sourceTransactionId: id,
    lines: [
      { id: lineId(), journalEntryId: jeId, accountCode: input.prepaidGlCode, description: 'Prepaid asset', debit: input.amount, credit: 0, currency: 'GHS' },
      { id: lineId(), journalEntryId: jeId, accountCode: GL.BANK, description: 'Payment', debit: 0, credit: input.amount, currency: 'GHS' },
    ],
  };
  const row: PrepaymentLedgerEntry = { ...input, id, journalEntryId: jeId, createdAt: now };
  try {
    store.addJournalEntry(je as any);
    store.addPrepaymentLedgerEntry(row);
    return row;
  } catch {
    return null;
  }
}

export function captureTaxAdjustment(input: Omit<TaxProvisionEntry, 'id' | 'journalEntryId' | 'createdAt'>): TaxProvisionEntry | null {
  const store = useAccountingStore.getState();
  const now = nowIso();
  const id = `TAX-${Date.now()}`;
  const jeId = `JE-TAX-${Date.now()}`;
  const je: JournalEntry = {
    id: jeId,
    entryNumber: jeNumber(),
    date: nowIso().slice(0, 10),
    reference: id,
    description: input.description,
    totalDebit: input.amount,
    totalCredit: input.amount,
    currency: 'GHS',
    status: 'Posted',
    postedBy: 'system',
    postedAt: now,
    createdAt: now,
    updatedAt: now,
    sourceModule: 'integration_extended_tax',
    sourceTransactionId: id,
    lines: [
      { id: lineId(), journalEntryId: jeId, accountCode: input.taxExpenseGl, description: input.description, debit: input.amount, credit: 0, currency: 'GHS' },
      { id: lineId(), journalEntryId: jeId, accountCode: input.taxPayableGl, description: 'Tax payable', debit: 0, credit: input.amount, currency: 'GHS' },
    ],
  };
  const row: TaxProvisionEntry = { ...input, id, journalEntryId: jeId, createdAt: now };
  try {
    store.addJournalEntry(je as any);
    store.addTaxRegisterEntry(row);
    return row;
  } catch {
    return null;
  }
}
