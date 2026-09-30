'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Card,
  CardBody,
  Button,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Alert,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
  Pagination,
} from '@heroui/react';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { useBankReconStore } from '@/app/lib/accounting/bankReconStore';
import {
  computeReconciliation,
  itemsForSide,
  bookSideItemsNeedingJournal,
} from '@/app/lib/accounting/bankRecon/calculations';
import {
  linkCashbookToLedger,
  navigateToBankReconciliation,
  BANK_SIDE_TYPES,
  BOOK_SIDE_TYPES,
  RECON_ITEM_TYPES,
  defaultOffsetGlForType,
} from '@/app/lib/accounting/bankRecon/ledgerSync';
import type { ReconcilingItem, ReconcilingItemType, ReconSide } from '@/app/lib/accounting/bankRecon/types';
import type { BankTransaction } from '@/app/lib/accounting/models';
import { formatAccountingCurrency } from '@/app/lib/accounting/tenantAccountingConfig';
import { openPrintPreview, generatePdfHtml } from '@/app/lib/accounting/helpers/exportHelpers';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';

// formatAccountingCurrency always shows a magnitude, so the sign is reattached in front
// of it here (reconciling items can be negative adjustments).
const fmt = (n: number) => (n < 0 ? '-' : '') + formatAccountingCurrency(n);

const fmtSigned = (n: number, deduct = false) => {
  if (Math.abs(n) < 0.01) return '—';
  const prefix = deduct ? '(' : '';
  const suffix = deduct ? ')' : '';
  return `${prefix}${fmt(n)}${suffix}`;
};

type Line = { label: string; amount: number; deduct?: boolean; emphasis?: boolean; divider?: boolean };

function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip placement="top" classNames={{ content: 'max-w-sm p-3 text-sm leading-snug' }} content={children}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-default-300 text-[10px] font-semibold text-default-600 hover:bg-default-100"
      >
        i
      </button>
    </Tooltip>
  );
}

function ReconBlock({
  title,
  lines,
  adjustedLabel,
  adjustedAmount,
}: {
  title: string;
  lines: Line[];
  adjustedLabel: string;
  adjustedAmount: number;
}) {
  return (
    <Card className="shadow-sm border border-slate-200 h-full">
      <CardBody className="p-0">
        <div className="px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold">{title}</div>
        <div className="divide-y divide-slate-100">
          {lines.map((line) => (
            <div
              key={line.label}
              className={`flex justify-between items-center px-4 py-2 text-sm ${
                line.divider ? 'border-t-2 border-slate-200' : ''
              } ${line.emphasis ? 'font-semibold bg-slate-50' : ''}`}
            >
              <span className="text-gray-700 pr-4">{line.label}</span>
              <span className={`font-mono tabular-nums ${line.deduct ? 'text-red-700' : 'text-gray-900'}`}>
                {fmtSigned(line.amount, line.deduct)}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 border-t-2 border-emerald-200">
            <span className="font-semibold text-emerald-900">{adjustedLabel}</span>
            <span className="font-mono font-bold text-emerald-900 tabular-nums">{fmt(adjustedAmount)}</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

const defaultItemForm = {
  itemType: 'DEPOSIT_IN_TRANSIT' as ReconcilingItemType,
  description: '',
  reference: '',
  transactionDate: '',
  amount: '',
  offsetGlCode: '4330',
};

type Props = {
  embedded?: boolean;
  initialAccountId?: string;
};

export default function BankReconciliation({ embedded, initialAccountId }: Props) {
  const {
    bankAccounts,
    bankTransactions,
    journalEntries,
    chartOfAccounts,
    initializeAccounting,
    markBankTransactionCleared,
  } = useAccountingStore();
  const {
    getReconciliation,
    updateReconciliation,
    syncCashbookFromLedger,
    addItem,
    deleteItem,
    markChequeCleared,
    postBookSideToLedger,
    completeReconciliation,
    approveReconciliation,
    hydrateFromApi,
    error,
    clearError,
  } = useBankReconStore();

  const activeAccounts = useMemo(() => bankAccounts.filter((b) => b.isActive), [bankAccounts]);

  const [accountId, setAccountId] = useState(initialAccountId || activeAccounts[0]?.id || '');
  const [periodEndDate, setPeriodEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statementInput, setStatementInput] = useState('');
  const [statementTouched, setStatementTouched] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(defaultItemForm);
  const [itemFormErrors, setItemFormErrors] = useState<Record<string, string>>({});
  const [addSide, setAddSide] = useState<ReconSide>('bank');
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('bankRecon.accountId');
      if (stored) {
        setAccountId(stored);
        localStorage.removeItem('bankRecon.accountId');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (initialAccountId) setAccountId(initialAccountId);
  }, [initialAccountId]);

  useEffect(() => {
    hydrateFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reconciliations = useBankReconStore((s) => s.reconciliations);
  const allItems = useBankReconStore((s) => s.items);

  useEffect(() => {
    if (!accountId && activeAccounts[0]?.id) {
      setAccountId(activeAccounts[0].id);
    }
  }, [accountId, activeAccounts]);

  useEffect(() => {
    if (accountId && periodEndDate) {
      useBankReconStore.getState().openReconciliation(accountId, periodEndDate);
    }
  }, [accountId, periodEndDate]);

  const recon = useMemo(() => {
    if (!accountId || !periodEndDate) return undefined;
    return getReconciliation(accountId, periodEndDate);
  }, [accountId, periodEndDate, getReconciliation, reconciliations]);

  // Keyed on the store's raw `items` array (not just `recon`) so adding/deleting/clearing an
  // item re-renders immediately — `recon` itself doesn't change when only items are mutated.
  const items = useMemo(
    () => (recon ? allItems.filter((i) => i.reconciliationId === recon.id) : []),
    [recon, allItems]
  );

  const bankAccount = useMemo(
    () => activeAccounts.find((b) => b.id === accountId),
    [activeAccounts, accountId]
  );

  const ledgerLink = useMemo(() => {
    if (!bankAccount || !periodEndDate) return null;
    return linkCashbookToLedger(bankAccount, journalEntries, chartOfAccounts, periodEndDate);
  }, [bankAccount, journalEntries, chartOfAccounts, periodEndDate]);

  const isReadOnly = recon?.status === 'Approved' || recon?.status === 'Completed';
  const pendingBookPosts = useMemo(() => bookSideItemsNeedingJournal(items).length, [items]);

  const effectiveRecon = useMemo(() => {
    if (!recon) return null;
    if (recon.status === 'Draft' && ledgerLink) {
      return { ...recon, cashbookBalance: ledgerLink.glBalance };
    }
    return recon;
  }, [recon, ledgerLink]);

  const computed = useMemo(() => {
    if (!effectiveRecon) return null;
    return computeReconciliation(effectiveRecon, items);
  }, [effectiveRecon, items]);

  const handleStatementBlur = () => {
    if (!recon || isReadOnly) return;
    setStatementTouched(true);
    const val = parseFloat(statementInput) || 0;
    updateReconciliation(recon.id, { statementBalance: val });
  };

  useEffect(() => {
    if (recon) {
      setStatementInput(String(recon.statementBalance ?? ''));
      // New drafts default to 0 — don't treat that as "user entered a statement".
      setStatementTouched((recon.statementBalance ?? 0) !== 0 || recon.status !== 'Draft');
    }
  }, [recon?.id]);

  useEffect(() => {
    if (recon && (recon.statementBalance ?? 0) !== 0) {
      setStatementTouched(true);
    }
  }, [recon?.statementBalance, recon?.id]);

  const handleSyncCashbook = async () => {
    if (!recon) return;
    syncCashbookFromLedger(recon.id);
    await initializeAccounting();
    setNotice('Cashbook balance refreshed from GL.');
  };

  const openAddItem = (side: ReconSide) => {
    setAddSide(side);
    const types = side === 'bank' ? BANK_SIDE_TYPES : BOOK_SIDE_TYPES;
    setItemForm({
      ...defaultItemForm,
      itemType: types[0].type,
      offsetGlCode: defaultOffsetGlForType(types[0].type),
      transactionDate: periodEndDate,
    });
    setItemFormErrors({});
    onOpen();
  };

  const validateItemForm = (form: typeof itemForm) => {
    const errs: Record<string, string> = {};
    if (!form.description.trim()) errs.description = 'Description is required';
    const amt = parseFloat(form.amount);
    if (!form.amount || Number.isNaN(amt) || amt <= 0) errs.amount = 'Amount must be greater than zero';
    setItemFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveItem = () => {
    if (!recon) return;
    if (!validateItemForm(itemForm)) return;
    const created = addItem({
      reconciliationId: recon.id,
      itemType: itemForm.itemType,
      description: itemForm.description.trim(),
      reference: itemForm.reference.trim() || undefined,
      transactionDate: itemForm.transactionDate || periodEndDate,
      amount: parseFloat(itemForm.amount) || 0,
      isCleared: false,
      offsetGlCode: itemForm.offsetGlCode || undefined,
    });
    if (created) {
      setNotice('Item added.');
      onClose();
    }
  };

  const handlePostBookSide = async () => {
    if (!recon) return;
    const result = postBookSideToLedger(recon.id);
    await initializeAccounting();
    if (result.posted) {
      setNotice(`Posted ${result.posted} journal entr${result.posted === 1 ? 'y' : 'ies'} to the ledger.`);
    }
    if (result.errors.length) {
      setNotice(result.errors.join(' · '));
    }
  };

  const handleComplete = () => {
    if (!recon) return;
    const marked = completeReconciliation(recon.id);
    if (marked !== false) {
      setNotice(
        marked > 0
          ? `Reconciliation complete. ${marked} register transaction(s) through ${periodEndDate} marked reconciled.`
          : 'Reconciliation marked complete.'
      );
    }
  };

  const handleApprove = () => {
    if (!recon) return;
    if (approveReconciliation(recon.id)) {
      setNotice('Reconciliation approved and locked.');
    }
  };

  const downloadCsv = useCallback(() => {
    if (!recon || !computed || !bankAccount) return;
    const rows = [
      ['Bank Reconciliation', bankAccount.accountName, periodEndDate],
      [],
      ['BANK SIDE', 'Amount'],
      ['Statement balance', computed.statementBalance.toFixed(2)],
      ['Deposits in transit', computed.depositsInTransit.toFixed(2)],
      ['Outstanding cheques', (-computed.outstandingCheques).toFixed(2)],
      ['Bank errors (add)', computed.bankErrorsAdd.toFixed(2)],
      ['Bank errors (deduct)', (-computed.bankErrorsDeduct).toFixed(2)],
      ['Adjusted bank balance', computed.adjustedBankBalance.toFixed(2)],
      [],
      ['BOOK SIDE', 'Amount'],
      ['Cashbook balance (GL)', computed.cashbookBalance.toFixed(2)],
      ['Bank credits not in book', computed.bankCreditsNotInBook.toFixed(2)],
      ['Bank charges not in book', (-computed.bankChargesNotInBook).toFixed(2)],
      ['Book errors (add)', computed.bookErrorsAdd.toFixed(2)],
      ['Book errors (deduct)', (-computed.bookErrorsDeduct).toFixed(2)],
      ['Adjusted cashbook balance', computed.adjustedCashbookBalance.toFixed(2)],
      [],
      ['Difference', computed.difference.toFixed(2)],
      ['Status', computed.status],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bank_recon_${bankAccount.accountNumber}_${periodEndDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [recon, computed, bankAccount, periodEndDate]);

  const printReconciliationPDF = useCallback(() => {
    if (!recon || !computed || !bankAccount) return;
    const row = (label: string, amount: number, opts?: { emphasis?: boolean; deduct?: boolean }) => `
      <tr class="${opts?.emphasis ? 'total-row' : ''}">
        <td>${label}</td>
        <td class="amount">${opts?.deduct ? '(' : ''}${fmt(amount)}${opts?.deduct ? ')' : ''}</td>
      </tr>`;
    const content = `
      <div class="header">
        <h1>🏦 Bank Reconciliation Statement</h1>
        <div class="subtitle">${bankAccount.accountName} · ${bankAccount.accountNumber} — Period end ${periodEndDate}</div>
      </div>
      <div class="meta">
        <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value">${recon.status}</div></div>
        <div class="meta-item"><div class="meta-label">Result</div><div class="meta-value">${computed.isBalanced ? 'Balanced' : `Unbalanced (${fmt(Math.abs(computed.difference))})`}</div></div>
      </div>
      <div class="section">
        <div class="section-title">Bank side</div>
        <table><tbody>
          ${row('Balance per bank statement', computed.statementBalance, { emphasis: true })}
          ${row('Add: Deposits in transit', computed.depositsInTransit)}
          ${row('Less: Outstanding cheques', computed.outstandingCheques, { deduct: true })}
          ${row('Add: Bank errors', computed.bankErrorsAdd)}
          ${row('Less: Bank errors', computed.bankErrorsDeduct, { deduct: true })}
          ${row('Adjusted bank balance', computed.adjustedBankBalance, { emphasis: true })}
        </tbody></table>
      </div>
      <div class="section">
        <div class="section-title">Cashbook side</div>
        <table><tbody>
          ${row('Balance per cashbook (GL)', computed.cashbookBalance, { emphasis: true })}
          ${row('Add: Bank credits not in cashbook', computed.bankCreditsNotInBook)}
          ${row('Less: Bank charges not in cashbook', computed.bankChargesNotInBook, { deduct: true })}
          ${row('Add: Cashbook errors', computed.bookErrorsAdd)}
          ${row('Less: Cashbook errors', computed.bookErrorsDeduct, { deduct: true })}
          ${row('Adjusted cashbook balance', computed.adjustedCashbookBalance, { emphasis: true })}
        </tbody></table>
      </div>
    `;
    const html = generatePdfHtml('Bank Reconciliation Statement', content, 'Bank & Cash Management');
    openPrintPreview(html);
  }, [recon, computed, bankAccount, periodEndDate]);

  const bankLines: Line[] = computed
    ? [
        { label: 'What the bank statement shows', amount: computed.statementBalance, emphasis: true },
        { label: 'Add deposits not yet on the statement', amount: computed.depositsInTransit },
        { label: 'Less cheques not yet cleared by the bank', amount: computed.outstandingCheques, deduct: true },
        { label: 'Add bank errors (in our favour)', amount: computed.bankErrorsAdd },
        { label: 'Less bank errors (against us)', amount: computed.bankErrorsDeduct, deduct: true },
      ]
    : [];

  const bookLines: Line[] = computed
    ? [
        { label: 'What your books show (GL)', amount: computed.cashbookBalance, emphasis: true },
        { label: 'Add bank credits not yet in books', amount: computed.bankCreditsNotInBook },
        { label: 'Less bank charges not yet in books', amount: computed.bankChargesNotInBook, deduct: true },
        { label: 'Add book errors', amount: computed.bookErrorsAdd },
        { label: 'Less book errors', amount: computed.bookErrorsDeduct, deduct: true },
      ]
    : [];

  const hasStatement = statementTouched || items.length > 0;

  const nextAction = (() => {
    if (recon?.status === 'Approved') {
      return {
        tone: 'success' as const,
        title: 'This period is locked',
        body: 'No further changes. Download a copy if you need a record.',
        cta: null as null | { label: string; onPress: () => void; color?: 'primary' | 'secondary' | 'success' },
      };
    }
    if (recon?.status === 'Completed') {
      return {
        tone: 'success' as const,
        title: 'Ready to lock',
        body: 'Optional final step: approve to lock this reconciliation permanently.',
        cta: { label: 'Approve & lock', onPress: handleApprove, color: 'success' as const },
      };
    }
    if (!hasStatement) {
      return {
        tone: 'primary' as const,
        title: 'Start here',
        body: 'Enter the closing balance from your paper or PDF bank statement for this date, then tab out of the field.',
        cta: null as null | { label: string; onPress: () => void; color?: 'primary' | 'secondary' | 'success' },
      };
    }
    if (computed && !computed.isBalanced) {
      return {
        tone: 'warning' as const,
        title: `Still ${fmt(Math.abs(computed.difference))} apart`,
        body: 'Explain why: deposits/cheques the bank has not shown yet, or fees/credits on the statement not in your books yet.',
        cta: {
          label: 'Explain a difference',
          onPress: () =>
            openAddItem(
              Math.abs(computed.adjustedBankBalance - computed.statementBalance) >=
                Math.abs(computed.adjustedCashbookBalance - computed.cashbookBalance)
                ? 'bank'
                : 'book'
            ),
          color: 'primary' as const,
        },
      };
    }
    if (pendingBookPosts > 0) {
      return {
        tone: 'secondary' as const,
        title: 'Post book entries next',
        body: `${pendingBookPosts} item${pendingBookPosts === 1 ? '' : 's'} from the statement still need to hit the ledger before you can finish.`,
        cta: {
          label: `Post ${pendingBookPosts} to GL`,
          onPress: () => {
            void handlePostBookSide();
          },
          color: 'secondary' as const,
        },
      };
    }
    if (recon?.status === 'Draft' && computed?.isBalanced) {
      return {
        tone: 'success' as const,
        title: 'They match',
        body: 'Bank statement and books agree for this date. Mark the period complete when you are happy with the review.',
        cta: { label: 'Mark complete', onPress: handleComplete, color: 'primary' as const },
      };
    }
    return {
      tone: 'primary' as const,
      title: 'Set up this period',
      body: 'Choose the account and period end, then enter the statement balance.',
      cta: null,
    };
  })();

  const itemTypesForModal = addSide === 'bank' ? BANK_SIDE_TYPES : BOOK_SIDE_TYPES;

  const registerTxns = useMemo(() => {
    if (!accountId || !periodEndDate) return [] as BankTransaction[];
    const end = new Date(periodEndDate);
    end.setHours(23, 59, 59, 999);
    return bankTransactions
      .filter((t) => t.bankAccountId === accountId)
      .filter((t) => new Date(t.transactionDate) <= end)
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }, [bankTransactions, accountId, periodEndDate]);

  const unreconciledRegisterCount = useMemo(
    () => registerTxns.filter((t) => t.status !== 'Reconciled').length,
    [registerTxns]
  );

  if (!activeAccounts.length) {
    return (
      <Alert color="warning" title="No bank accounts">
        Add a bank account under Bank & Cash first.
      </Alert>
    );
  }

  return (
    <div className={embedded ? '' : 'p-4 md:p-6 max-w-[1200px] mx-auto'}>
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className={`${embedded ? 'text-base' : 'text-2xl'} font-bold text-gray-900`}>
                {embedded ? 'Match statement to books' : 'Match bank statement'}
              </h1>
              <InfoTip label="About matching the statement">
                <div className="space-y-2">
                  <p>
                    Make the closing balance on your bank statement agree with what your hotel books
                    show for the same date.
                  </p>
                  <p>
                    You only explain the differences — everyday receipts still go through Transactions
                    or AR/AP.
                  </p>
                </div>
              </InfoTip>
            </div>
          </div>
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="bordered">
                Download
              </Button>
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem key="csv" onPress={downloadCsv}>
                CSV
              </DropdownItem>
              <DropdownItem key="pdf" onPress={printReconciliationPDF}>
                Print PDF
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      {(notice || error) && (
        <Alert
          color={error ? 'danger' : 'success'}
          className="mb-4"
          onClose={() => {
            setNotice(null);
            clearError();
          }}
        >
          {error || notice}
        </Alert>
      )}

      <Card className="shadow-sm mb-4 border border-slate-200">
        <CardBody className="gap-4 p-3 md:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">1 · Which period?</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select
                size="sm"
                label="Bank account"
                selectedKeys={accountId ? [accountId] : []}
                onSelectionChange={(k) => setAccountId(Array.from(k)[0] as string)}
                isDisabled={isReadOnly}
              >
                {activeAccounts.map((a) => (
                  <SelectItem key={a.id} textValue={a.accountName}>
                    {a.accountName} · {a.glAccountCode}
                  </SelectItem>
                ))}
              </Select>
              <Input
                size="sm"
                type="date"
                label="As of date"
                description="Usually month-end"
                value={periodEndDate}
                onValueChange={setPeriodEndDate}
                isDisabled={isReadOnly}
              />
              <Input
                size="sm"
                type="number"
                label="Closing balance on bank statement"
                description="Copy from paper/PDF statement"
                value={statementInput}
                onValueChange={(v) => {
                  setStatementInput(v);
                  setStatementTouched(true);
                }}
                onBlur={handleStatementBlur}
                isDisabled={isReadOnly}
                startContent={<span className="text-gray-400 text-sm">₵</span>}
                classNames={{
                  inputWrapper: !hasStatement && !isReadOnly ? 'ring-2 ring-primary/40' : undefined,
                }}
              />
            </div>
          </div>

          {computed && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">2 · Do they match?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <div className="text-xs text-slate-500">Bank statement says</div>
                  <div className="text-lg font-semibold tabular-nums text-slate-900 mt-0.5">
                    {hasStatement ? fmt(computed.adjustedBankBalance) : '—'}
                  </div>
                  {hasStatement && Math.abs(computed.adjustedBankBalance - computed.statementBalance) > 0.009 && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      Statement {fmt(computed.statementBalance)} ± timing items
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                  <div className="text-xs text-slate-500">Your books say</div>
                  <div className="text-lg font-semibold tabular-nums text-slate-900 mt-0.5">
                    {fmt(computed.adjustedCashbookBalance)}
                  </div>
                  {Math.abs(computed.adjustedCashbookBalance - computed.cashbookBalance) > 0.009 && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      GL {fmt(computed.cashbookBalance)} ± book items
                    </div>
                  )}
                </div>
                <div
                  className={`rounded-lg border px-3 py-3 ${
                    !hasStatement
                      ? 'border-slate-200 bg-slate-50'
                      : computed.isBalanced
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="text-xs text-slate-500">Difference</div>
                  <div
                    className={`text-lg font-semibold tabular-nums mt-0.5 ${
                      !hasStatement
                        ? 'text-slate-400'
                        : computed.isBalanced
                          ? 'text-emerald-800'
                          : 'text-amber-800'
                    }`}
                  >
                    {!hasStatement ? 'Enter statement first' : computed.isBalanced ? 'Matched' : fmt(Math.abs(computed.difference))}
                  </div>
                  {recon && (
                    <div className="mt-1">
                      <Chip
                        size="sm"
                        variant="flat"
                        color={
                          recon.status === 'Approved'
                            ? 'success'
                            : recon.status === 'Completed'
                              ? 'primary'
                              : 'default'
                        }
                      >
                        {recon.status}
                      </Chip>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div
            className={`rounded-lg border px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
              nextAction.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : nextAction.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : nextAction.tone === 'secondary'
                    ? 'border-violet-200 bg-violet-50'
                    : 'border-blue-200 bg-blue-50'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">What to do next</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{nextAction.title}</p>
              <p className="text-sm text-slate-600 mt-0.5">{nextAction.body}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {nextAction.cta && (
                <Button size="sm" color={nextAction.cta.color || 'primary'} onPress={nextAction.cta.onPress}>
                  {nextAction.cta.label}
                </Button>
              )}
              {hasStatement && !isReadOnly && (
                <>
                  <Button size="sm" variant="flat" onPress={() => openAddItem('bank')}>
                    Bank timing…
                  </Button>
                  <Button size="sm" variant="flat" onPress={() => openAddItem('book')}>
                    Statement item not in books…
                  </Button>
                </>
              )}
              {!isReadOnly && (
                <Button size="sm" variant="light" onPress={handleSyncCashbook}>
                  Refresh books from GL
                </Button>
              )}
            </div>
          </div>

          {ledgerLink && bankAccount && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>
                Linked GL {bankAccount.glAccountCode}: {fmt(ledgerLink.glBalance)}
              </span>
              {!ledgerLink.inSync && (
                <span className="text-amber-700">
                  Register balance differs from GL by {fmt(Math.abs(ledgerLink.gap))}
                </span>
              )}
              {!embedded && (
                <Button
                  size="sm"
                  variant="light"
                  className="h-6 min-w-0 px-1"
                  onPress={() => navigateToBankReconciliation(accountId, 'banking')}
                >
                  Open in Bank & Cash
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {computed && hasStatement && (
        <>
          <details
            className="mb-4 group rounded-lg border border-slate-200 bg-white open:shadow-sm"
            open={calcOpen}
            onToggle={(e) => setCalcOpen(e.currentTarget.open)}
          >
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2 select-none">
              <div>
                <p className="text-sm font-semibold text-slate-900">How the totals were calculated</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Optional math worksheet — most people only need the three numbers above.
                </p>
              </div>
              <span className="text-xs text-slate-400 group-open:hidden">Show</span>
              <span className="text-xs text-slate-400 hidden group-open:inline">Hide</span>
            </summary>
            <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ReconBlock
                title="From the bank statement"
                lines={bankLines}
                adjustedLabel="Adjusted to match books"
                adjustedAmount={computed.adjustedBankBalance}
              />
              <ReconBlock
                title="From your books"
                lines={bookLines}
                adjustedLabel="Adjusted to match statement"
                adjustedAmount={computed.adjustedCashbookBalance}
              />
            </div>
          </details>

          {!computed.isBalanced && items.length === 0 && !isReadOnly && (
            <Card className="shadow-sm border border-amber-200 bg-amber-50/60 mb-4">
              <CardBody className="gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-amber-950">Why don’t they match?</p>
                  <p className="text-sm text-amber-900/80 mt-1">
                    Pick the situation that matches what you see on the statement. You only add an
                    explanation when something is missing on one side — empty lists mean you have not
                    explained anything yet.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => openAddItem('bank')}
                    className="text-left rounded-lg border border-amber-200 bg-white px-3 py-3 hover:border-amber-400 transition-colors"
                  >
                    <p className="text-sm font-semibold text-slate-900">In our books, not on the statement yet</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Example: a deposit you recorded yesterday that the bank has not shown, or a cheque
                      that has not cleared.
                    </p>
                    <p className="text-xs font-medium text-primary mt-2">Add this kind of difference →</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddItem('book')}
                    className="text-left rounded-lg border border-amber-200 bg-white px-3 py-3 hover:border-amber-400 transition-colors"
                  >
                    <p className="text-sm font-semibold text-slate-900">On the statement, not in our books yet</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Example: a bank fee or interest credit printed on the statement that nobody has
                      booked in the hotel yet.
                    </p>
                    <p className="text-xs font-medium text-primary mt-2">Add this kind of difference →</p>
                  </button>
                </div>
              </CardBody>
            </Card>
          )}

          {items.length > 0 && (
            <div className="mb-4">
              <div className="mb-2">
                <p className="text-sm font-semibold text-slate-900">Differences you explained</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  These close the gap between the statement and the books. Remove one if it was added by
                  mistake.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ItemsPanel
                  title="In books, not on statement yet"
                  side="bank"
                  items={itemsForSide(items, 'bank')}
                  isReadOnly={!!isReadOnly}
                  onAdd={() => openAddItem('bank')}
                  onDelete={deleteItem}
                  onClearCheque={markChequeCleared}
                  emptyHint="None yet — only add if a deposit/cheque is in the books but missing from the statement."
                  infoTip="Use when the hotel already recorded money the bank has not shown yet."
                />
                <ItemsPanel
                  title="On statement, not in books yet"
                  side="book"
                  items={itemsForSide(items, 'book')}
                  isReadOnly={!!isReadOnly}
                  onAdd={() => openAddItem('book')}
                  onDelete={deleteItem}
                  onClearCheque={markChequeCleared}
                  emptyHint="None yet — only add if the statement shows a fee/credit the hotel has not booked."
                  infoTip="Use when the statement shows a fee or credit that still needs to post to the ledger."
                />
              </div>
            </div>
          )}

          <RegisterTransactionsPanel
            transactions={registerTxns}
            unreconciledCount={unreconciledRegisterCount}
            isReadOnly={!!isReadOnly}
            onMarkCleared={markBankTransactionCleared}
          />
        </>
      )}

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>
            {addSide === 'bank' ? 'Explain a bank timing difference' : 'Record something from the statement'}
          </ModalHeader>
          <ModalBody className="gap-3">
            <p className="text-sm text-slate-600">
              {addSide === 'bank'
                ? 'Use this when your books already know about money the bank has not shown yet.'
                : 'Use this when the statement shows a fee or credit that is not in your books yet. It will post to the ledger.'}
            </p>
            <Select
              label="What kind of difference?"
              selectedKeys={[itemForm.itemType]}
              onSelectionChange={(k) => {
                const nextType = Array.from(k)[0] as ReconcilingItemType;
                setItemForm({ ...itemForm, itemType: nextType, offsetGlCode: defaultOffsetGlForType(nextType) });
              }}
            >
              {itemTypesForModal.map((t) => (
                <SelectItem key={t.type} textValue={t.label}>
                  {t.label}
                </SelectItem>
              ))}
            </Select>
            <p className="text-xs text-gray-500">
              {RECON_ITEM_TYPES.find((t) => t.type === itemForm.itemType)?.hint}
            </p>
            <div>
              <Input
                label="Description"
                isRequired
                isInvalid={!!itemFormErrors.description}
                value={itemForm.description}
                onValueChange={(v) => setItemForm({ ...itemForm, description: v })}
              />
              {itemFormErrors.description && (
                <div className="text-xs text-danger mt-1">{itemFormErrors.description}</div>
              )}
            </div>
            <Input
              label="Reference"
              value={itemForm.reference}
              onValueChange={(v) => setItemForm({ ...itemForm, reference: v })}
            />
            <Input
              type="date"
              label="Date"
              value={itemForm.transactionDate}
              onValueChange={(v) => setItemForm({ ...itemForm, transactionDate: v })}
            />
            <div>
              <Input
                type="number"
                min="0"
                step="0.01"
                label="Amount (always positive)"
                isRequired
                isInvalid={!!itemFormErrors.amount}
                value={itemForm.amount}
                onValueChange={(v) => setItemForm({ ...itemForm, amount: v })}
                startContent={<span className="text-gray-400 text-sm">₵</span>}
              />
              {itemFormErrors.amount && (
                <div className="text-xs text-danger mt-1">{itemFormErrors.amount}</div>
              )}
            </div>
            {addSide === 'book' && (
              <Input
                label="Offset GL code"
                value={itemForm.offsetGlCode}
                onValueChange={(v) => setItemForm({ ...itemForm, offsetGlCode: v })}
                description="Income or expense account paired with bank GL"
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleSaveItem}>
              Add explanation
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function ItemsPanel({
  title,
  side,
  items,
  isReadOnly,
  onAdd,
  onDelete,
  onClearCheque,
  infoTip,
  emptyHint,
}: {
  title: string;
  side: ReconSide;
  items: ReconcilingItem[];
  isReadOnly: boolean;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onClearCheque: (id: string, date: string) => void;
  infoTip?: string;
  emptyHint?: string;
}) {
  type ItemSortKey = 'type' | 'description' | 'amount' | 'status';
  const meta = (type: ReconcilingItemType) => RECON_ITEM_TYPES.find((t) => t.type === type);
  const [sortKey, setSortKey] = useState<ItemSortKey>('type');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewItem, setViewItem] = useState<ReconcilingItem | null>(null);
  const cols = useResizableColumns<ItemSortKey>({
    type: 140, description: 240, amount: 110, status: 128,
  });

  const sorted = useMemo(() => {
    const value = (item: ReconcilingItem): string | number => {
      switch (sortKey) {
        case 'type': return (meta(item.itemType)?.label || item.itemType).toLowerCase();
        case 'description': return (item.description || '').toLowerCase();
        case 'amount': return item.amount;
        case 'status': return item.journalEntryId ? 'posted' : item.isCleared ? 'cleared' : 'open';
        default: return '';
      }
    };
    const next = [...items].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'asc' ? next : next.reverse();
  }, [items, sortKey, sortDir]);

  const { page, setPage, pages, paged } = useDeskPagination(sorted, [items, sortKey, sortDir, side]);

  const onSort = (key: ItemSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'amount' ? 'desc' : 'asc');
    }
  };

  const column = (key: ItemSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  return (
    <Card className="shadow-sm border border-slate-200">
      <CardBody className="p-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            {title}
            <Chip size="sm" variant="flat">{items.length}</Chip>
            {infoTip && (
              <InfoTip label={title}>{infoTip}</InfoTip>
            )}
          </span>
          {!isReadOnly && (
            <Button size="sm" variant="flat" color="primary" onPress={onAdd}>
              Add
            </Button>
          )}
        </div>
        <div className="px-2 pb-2">
          <div ref={cols.frameRef} style={cols.frameStyle}>
            <Table removeWrapper aria-label={title} classNames={deskResizableTableClassNames()}>
              <TableHeader>
                {column('type', 'Type')}
                {column('description', 'Description')}
                {column('amount', 'Amount', 'right')}
                {column('status', 'Status')}
              </TableHeader>
              <TableBody emptyContent={emptyHint || (side === 'bank' ? 'No timing differences yet.' : 'No statement-only items yet.')}>
                {paged.map((item) => {
                  const m = meta(item.itemType);
                  const deduct = m?.effect === 'deduct';
                  return (
                    <TableRow key={item.id} className={rowClassNames(viewItem?.id === item.id)} onClick={() => setViewItem(item)}>
                      <TableCell className="text-xs truncate text-blue-600 hover:underline">{m?.label || item.itemType}</TableCell>
                      <TableCell>
                        <div className="text-sm truncate">{item.description}</div>
                        {item.reference && <div className="text-xs font-mono text-gray-400 truncate">{item.reference}</div>}
                        {item.carriedFromItemId && (
                          <Chip size="sm" variant="flat" className="mt-1">
                            Carried forward
                          </Chip>
                        )}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums text-sm ${deduct ? 'text-red-700' : ''}`}>
                        {fmtSigned(item.amount, deduct)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {item.journalEntryId ? (
                          <Chip size="sm" color="success" variant="flat">
                            Posted {item.journalEntryId.slice(-6)}
                          </Chip>
                        ) : item.itemType === 'OUTSTANDING_CHEQUE' && !item.isCleared && !isReadOnly ? (
                          <Chip
                            size="sm"
                            color="warning"
                            variant="flat"
                            className="cursor-pointer"
                            onClick={() => onClearCheque(item.id, new Date().toISOString().slice(0, 10))}
                          >
                            Outstanding · Clear
                          </Chip>
                        ) : item.itemType === 'OUTSTANDING_CHEQUE' ? (
                          <Chip size="sm" color={item.isCleared ? 'success' : 'warning'} variant="flat">
                            {item.isCleared ? 'Cleared' : 'Outstanding'}
                          </Chip>
                        ) : (
                          <Chip size="sm" variant="flat">
                            Open
                          </Chip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </div>
      </CardBody>

      <Modal isOpen={!!viewItem} onOpenChange={(open) => { if (!open) setViewItem(null); }} size="lg">
        <ModalContent>
          {(onClose) => {
            if (!viewItem) return null;
            const m = meta(viewItem.itemType);
            const deduct = m?.effect === 'deduct';
            return (
              <>
                <ModalHeader className="border-b bg-white px-6 py-4">
                  <div className="pr-6">
                    <h3 className="text-xl font-bold text-gray-900">RECONCILING ITEM</h3>
                    <p className="text-lg text-gray-800">{m?.label || viewItem.itemType}</p>
                  </div>
                </ModalHeader>
                <ModalBody className="p-6 bg-white text-sm space-y-2">
                  <div><span className="text-gray-500">Description:</span> <span className="font-medium">{viewItem.description || '—'}</span></div>
                  <div><span className="text-gray-500">Reference:</span> <span className="font-mono text-xs">{viewItem.reference || '—'}</span></div>
                  <div><span className="text-gray-500">Amount:</span> <span className={`tabular-nums font-semibold ${deduct ? 'text-red-700' : ''}`}>{fmtSigned(viewItem.amount, deduct)}</span></div>
                </ModalBody>
                <ModalFooter className="border-t bg-white">
                  <Button variant="flat" onPress={onClose}>Close</Button>
                  {!isReadOnly && viewItem.itemType === 'OUTSTANDING_CHEQUE' && !viewItem.isCleared && (
                    <Button color="primary" variant="flat" onPress={() => { onClearCheque(viewItem.id, new Date().toISOString().slice(0, 10)); setViewItem(null); }}>Clear cheque</Button>
                  )}
                  {!isReadOnly && (
                    <Button
                      color="danger"
                      variant="flat"
                      onPress={() => {
                        if (!window.confirm(`Delete reconciling item "${viewItem.description || viewItem.itemType}"? This cannot be undone.`)) return;
                        onDelete(viewItem.id);
                        setViewItem(null);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </Card>
  );
}

function RegisterTransactionsPanel({
  transactions,
  unreconciledCount,
  isReadOnly,
  onMarkCleared,
}: {
  transactions: BankTransaction[];
  unreconciledCount: number;
  isReadOnly: boolean;
  onMarkCleared: (id: string) => void;
}) {
  type TxnSortKey = 'date' | 'reference' | 'type' | 'amount' | 'status';
  const [sortKey, setSortKey] = useState<TxnSortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewTxn, setViewTxn] = useState<BankTransaction | null>(null);
  const cols = useResizableColumns<TxnSortKey>({
    date: 100, reference: 140, type: 100, amount: 110, status: 140,
  });

  const sorted = useMemo(() => {
    const value = (txn: BankTransaction): string | number => {
      switch (sortKey) {
        case 'date': return new Date(txn.transactionDate).getTime();
        case 'reference': return (txn.reference || '').toLowerCase();
        case 'type': return (txn.type || '').toLowerCase();
        case 'amount': return txn.amount ?? 0;
        case 'status': return (txn.status || '').toLowerCase();
        default: return '';
      }
    };
    const next = [...transactions].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'asc' ? next : next.reverse();
  }, [transactions, sortKey, sortDir]);

  const { page, setPage, pages, paged } = useDeskPagination(sorted, [transactions, sortKey, sortDir]);

  const onSort = (key: TxnSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'date' || key === 'amount' ? 'desc' : 'asc');
    }
  };

  const column = (key: TxnSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const statusColor = (status: string) =>
    status === 'Reconciled' ? 'success' : status === 'Cleared' ? 'primary' : 'warning';

  return (
    <details className="mt-4 group rounded-lg border border-slate-200 bg-white open:shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3 flex flex-wrap items-center justify-between gap-2 select-none border-b border-transparent group-open:border-slate-100 group-open:bg-slate-50">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Optional · Hotel bank register
            {transactions.length > 0 && (
              <span className="ml-2 font-normal text-slate-500">({transactions.length})</span>
            )}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Skip this if the statement already matches. This is only a checklist of movements already
            recorded under Bank & Cash → Transactions — not where you fix the difference above.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unreconciledCount > 0 && (
            <Chip size="sm" color="warning" variant="flat">
              {unreconciledCount} not marked reconciled
            </Chip>
          )}
          <span className="text-xs text-slate-400 group-open:hidden">Show</span>
          <span className="text-xs text-slate-400 hidden group-open:inline">Hide</span>
        </div>
      </summary>

      {transactions.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-600">
          No hotel bank movements for this account through the as-of date. That is fine — finish matching
          the statement balance first. When staff later record deposits or payments here, they will appear
          in this list and get marked reconciled when you complete the period.
        </div>
      ) : (
        <div className="px-2 pb-2 pt-2">
          <div ref={cols.frameRef} style={cols.frameStyle}>
            <Table removeWrapper aria-label="Hotel bank register" classNames={deskResizableTableClassNames()}>
              <TableHeader>
                {column('date', 'Date')}
                {column('reference', 'Reference')}
                {column('type', 'Type')}
                {column('amount', 'Amount', 'right')}
                {column('status', 'Status')}
              </TableHeader>
              <TableBody>
                {paged.map((txn) => (
                  <TableRow
                    key={txn.id}
                    className={rowClassNames(viewTxn?.id === txn.id)}
                    onClick={() => setViewTxn(txn)}
                  >
                    <TableCell className="text-sm text-blue-600 hover:underline">
                      {new Date(txn.transactionDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs truncate">{txn.reference}</TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat">
                        {txn.type}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{fmt(txn.amount ?? 0)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {!isReadOnly && txn.status === 'Pending' ? (
                        <Chip
                          size="sm"
                          color="warning"
                          variant="flat"
                          className="cursor-pointer"
                          onClick={() => onMarkCleared(txn.id)}
                        >
                          Pending · Clear
                        </Chip>
                      ) : (
                        <Chip size="sm" variant="flat" color={statusColor(txn.status) as any}>
                          {txn.status}
                        </Chip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </div>
      )}

      <Modal isOpen={!!viewTxn} onOpenChange={(open) => { if (!open) setViewTxn(null); }} size="lg">
        <ModalContent>
          {(onClose) => {
            if (!viewTxn) return null;
            return (
              <>
                <ModalHeader className="border-b bg-white px-6 py-4">
                  <div className="pr-6">
                    <h3 className="text-xl font-bold text-gray-900">BANK REGISTER LINE</h3>
                    <p className="text-lg text-gray-800 font-mono">{viewTxn.reference || viewTxn.id}</p>
                  </div>
                </ModalHeader>
                <ModalBody className="p-6 bg-white text-sm space-y-2">
                  <div>
                    <span className="text-gray-500">Date:</span>{' '}
                    <span className="font-medium">{new Date(viewTxn.transactionDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span> <span className="font-medium">{viewTxn.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount:</span>{' '}
                    <span className="tabular-nums font-semibold">{fmt(viewTxn.amount ?? 0)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>{' '}
                    <Chip size="sm" variant="flat" color={statusColor(viewTxn.status) as any}>
                      {viewTxn.status}
                    </Chip>
                  </div>
                  {viewTxn.description && (
                    <div>
                      <span className="text-gray-500">Description:</span>{' '}
                      <span className="font-medium">{viewTxn.description}</span>
                    </div>
                  )}
                </ModalBody>
                <ModalFooter className="border-t bg-white">
                  <Button variant="flat" onPress={onClose}>
                    Close
                  </Button>
                  {!isReadOnly && viewTxn.status === 'Pending' && (
                    <Button
                      color="primary"
                      variant="flat"
                      onPress={() => {
                        onMarkCleared(viewTxn.id);
                        setViewTxn(null);
                      }}
                    >
                      Mark cleared
                    </Button>
                  )}
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </details>
  );
}
