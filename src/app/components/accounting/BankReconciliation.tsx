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
    const val = parseFloat(statementInput) || 0;
    updateReconciliation(recon.id, { statementBalance: val });
  };

  useEffect(() => {
    if (recon) {
      setStatementInput(String(recon.statementBalance ?? ''));
    }
  }, [recon?.id, recon?.statementBalance]);

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
        { label: 'Balance per bank statement', amount: computed.statementBalance, emphasis: true },
        { label: 'Add: Deposits in transit', amount: computed.depositsInTransit },
        { label: 'Less: Outstanding cheques', amount: computed.outstandingCheques, deduct: true },
        { label: 'Add: Bank errors', amount: computed.bankErrorsAdd },
        { label: 'Less: Bank errors', amount: computed.bankErrorsDeduct, deduct: true },
      ]
    : [];

  const bookLines: Line[] = computed
    ? [
        { label: 'Balance per cashbook (GL)', amount: computed.cashbookBalance, emphasis: true },
        { label: 'Add: Bank credits not in cashbook', amount: computed.bankCreditsNotInBook },
        { label: 'Less: Bank charges not in cashbook', amount: computed.bankChargesNotInBook, deduct: true },
        { label: 'Add: Cashbook errors', amount: computed.bookErrorsAdd },
        { label: 'Less: Cashbook errors', amount: computed.bookErrorsDeduct, deduct: true },
      ]
    : [];

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
      {!embedded && (
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Bank Reconciliation</h1>
            <InfoTip label="About bank reconciliation">
              <div className="space-y-2">
                <p>Prove the <strong>bank statement</strong> agrees with your <strong>books</strong> at period end.</p>
                <p><strong>Bank side</strong> — start from statement balance; adjust for timing (deposits in transit, outstanding cheques).</p>
                <p><strong>Book side</strong> — start from GL/cashbook; adjust for items on the statement not yet in books (charges, credits).</p>
                <p>When both adjusted balances match, mark complete. This is not where you record everyday receipts — use Transactions or AR/AP first.</p>
              </div>
            </InfoTip>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Adjusted bank balance must equal adjusted cashbook balance.
          </p>
        </div>
      )}

      {embedded && (
        <Alert color="primary" variant="flat" className="mb-4" title="Reconciliation workflow">
          <ol className="list-decimal list-inside text-sm space-y-1 mt-1">
            <li>Enter <strong>statement balance</strong> from the bank for the period end date.</li>
            <li>Review register transactions below; clear or explain differences.</li>
            <li>Add <strong>bank-side</strong> or <strong>book-side</strong> items until both blocks balance.</li>
            <li>Post book-side items to GL, then <strong>Mark complete</strong> (locks register lines as reconciled).</li>
          </ol>
        </Alert>
      )}

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

      <Card className="shadow-sm mb-4">
        <CardBody className="gap-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select
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
              type="date"
              label={
                <span className="inline-flex items-center gap-1">
                  Period end
                  <InfoTip label="Period end date">
                    Last date covered by this reconciliation (usually month-end). Register transactions on or before this date can be marked reconciled when you complete.
                  </InfoTip>
                </span>
              }
              value={periodEndDate}
              onValueChange={setPeriodEndDate}
              isDisabled={isReadOnly}
            />
            <Input
              type="number"
              label={
                <span className="inline-flex items-center gap-1">
                  Statement balance
                  <InfoTip label="Statement balance">
                    Closing balance on the bank statement for this period end. This is the starting point for the bank side — not the same as opening balance on the account setup screen.
                  </InfoTip>
                </span>
              }
              value={statementInput}
              onValueChange={setStatementInput}
              onBlur={handleStatementBlur}
              isDisabled={isReadOnly}
              startContent={<span className="text-gray-400 text-sm">₵</span>}
            />
            <div className="flex items-end gap-2">
              <Button size="sm" variant="bordered" className="flex-1" onPress={handleSyncCashbook} isDisabled={isReadOnly}>
                Sync cashbook from GL
              </Button>
              <InfoTip label="Sync cashbook from GL">
                Refreshes the book-side starting balance from posted journal entries on the linked GL account ({bankAccount?.glAccountCode || '—'}). Use after posting book-side reconciling items.
              </InfoTip>
            </div>
          </div>

          {ledgerLink && bankAccount && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Chip size="sm" variant="flat" color={ledgerLink.inSync ? 'success' : 'warning'}>
                GL {bankAccount.glAccountCode}: {fmt(ledgerLink.glBalance)}
              </Chip>
              <Chip size="sm" variant="flat">
                Bank record: {fmt(ledgerLink.bankRecordBalance)}
              </Chip>
              {!ledgerLink.inSync && (
                <span className="text-amber-700">Register vs GL gap {fmt(Math.abs(ledgerLink.gap))}</span>
              )}
              {recon && (
                <Chip size="sm" variant="flat" color={recon.status === 'Approved' ? 'success' : recon.status === 'Completed' ? 'primary' : 'default'}>
                  {recon.status}
                </Chip>
              )}
              {computed && (
                <Chip size="sm" variant="flat" color={computed.isBalanced ? 'success' : 'danger'}>
                  {computed.isBalanced ? 'Balanced' : `Diff ${fmt(Math.abs(computed.difference))}`}
                </Chip>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {pendingBookPosts > 0 && !isReadOnly && (
              <Button size="sm" color="secondary" onPress={handlePostBookSide}>
                Post {pendingBookPosts} book-side item{pendingBookPosts > 1 ? 's' : ''} to GL
              </Button>
            )}
            {recon?.status === 'Draft' && computed?.isBalanced && pendingBookPosts === 0 && (
              <Button size="sm" color="primary" onPress={handleComplete}>
                Mark complete
              </Button>
            )}
            {recon?.status === 'Completed' && (
              <Button size="sm" color="success" onPress={handleApprove}>
                Approve & lock
              </Button>
            )}
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
                  📑 Print PDF
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            {!embedded && (
              <Button
                size="sm"
                variant="light"
                onPress={() => navigateToBankReconciliation(accountId, 'banking')}
              >
                Open in Bank & Cash
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {computed && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <ReconBlock
              title="Bank side"
              lines={bankLines}
              adjustedLabel="Adjusted bank balance"
              adjustedAmount={computed.adjustedBankBalance}
            />
            <ReconBlock
              title="Cashbook side"
              lines={bookLines}
              adjustedLabel="Adjusted cashbook balance"
              adjustedAmount={computed.adjustedCashbookBalance}
            />
          </div>

          {!computed.isBalanced && (
            <Alert color="warning" className="mb-4" title="Not yet balanced">
              Adjusted balances differ by {fmt(Math.abs(computed.difference))}. Add reconciling items until both sides
              match.
            </Alert>
          )}

          {computed.isBalanced && recon?.status === 'Draft' && (
            <Alert color="success" className="mb-4" title="Ready to complete">
              Adjusted bank and cashbook balances match. Mark complete when reviewed.
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ItemsPanel
              title="Bank-side items"
              side="bank"
              items={itemsForSide(items, 'bank')}
              isReadOnly={!!isReadOnly}
              onAdd={() => openAddItem('bank')}
              onDelete={deleteItem}
              onClearCheque={markChequeCleared}
              infoTip="Timing differences on the statement: deposits not yet credited, cheques not yet cleared, bank errors."
            />
            <ItemsPanel
              title="Book-side items"
              side="book"
              items={itemsForSide(items, 'book')}
              isReadOnly={!!isReadOnly}
              onAdd={() => openAddItem('book')}
              onDelete={deleteItem}
              onClearCheque={markChequeCleared}
              infoTip="Items on the statement not yet in your books: bank charges, interest credits, or cashbook errors. Post to GL before completing."
            />
          </div>

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
          <ModalHeader>Add {addSide === 'bank' ? 'bank-side' : 'book-side'} item</ModalHeader>
          <ModalBody className="gap-3">
            <Select
              label="Type"
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
              Add
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
}: {
  title: string;
  side: ReconSide;
  items: ReconcilingItem[];
  isReadOnly: boolean;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onClearCheque: (id: string, date: string) => void;
  infoTip?: string;
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
              <TableBody emptyContent={`No ${side}-side items.`}>
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
                    <Button color="danger" variant="flat" onPress={() => { onDelete(viewItem.id); setViewItem(null); }}>🗑️ Delete</Button>
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
    <Card className="shadow-sm border border-slate-200 mt-4">
      <CardBody className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            Register transactions (through period end)
            <InfoTip label="Register transactions">
              Movements from Bank & Cash → Transactions for this account through the period end date.
              Completing reconciliation marks them Reconciled. Mark cleared for pending items on the statement.
            </InfoTip>
          </span>
          {unreconciledCount > 0 && (
            <Chip size="sm" color="warning" variant="flat">
              {unreconciledCount} not yet reconciled
            </Chip>
          )}
        </div>
        <div className="px-2 pb-2">
          <div ref={cols.frameRef} style={cols.frameStyle}>
            <Table removeWrapper aria-label="Register transactions" classNames={deskResizableTableClassNames()}>
              <TableHeader>
                {column('date', 'Date')}
                {column('reference', 'Reference')}
                {column('type', 'Type')}
                {column('amount', 'Amount', 'right')}
                {column('status', 'Status')}
              </TableHeader>
              <TableBody emptyContent="No register transactions in this period.">
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
                    <TableCell><Chip size="sm" variant="flat">{txn.type}</Chip></TableCell>
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
      </CardBody>

      <Modal isOpen={!!viewTxn} onOpenChange={(open) => { if (!open) setViewTxn(null); }} size="lg">
        <ModalContent>
          {(onClose) => {
            if (!viewTxn) return null;
            return (
              <>
                <ModalHeader className="border-b bg-white px-6 py-4">
                  <div className="pr-6">
                    <h3 className="text-xl font-bold text-gray-900">REGISTER TRANSACTION</h3>
                    <p className="text-lg text-gray-800 font-mono">{viewTxn.reference || viewTxn.id}</p>
                  </div>
                </ModalHeader>
                <ModalBody className="p-6 bg-white text-sm space-y-2">
                  <div><span className="text-gray-500">Date:</span> <span className="font-medium">{new Date(viewTxn.transactionDate).toLocaleDateString()}</span></div>
                  <div><span className="text-gray-500">Type:</span> <span className="font-medium">{viewTxn.type}</span></div>
                  <div><span className="text-gray-500">Amount:</span> <span className="tabular-nums font-semibold">{fmt(viewTxn.amount ?? 0)}</span></div>
                  <div><span className="text-gray-500">Status:</span>{' '}
                    <Chip size="sm" variant="flat" color={statusColor(viewTxn.status) as any}>{viewTxn.status}</Chip>
                  </div>
                  {viewTxn.description && (
                    <div><span className="text-gray-500">Description:</span> <span className="font-medium">{viewTxn.description}</span></div>
                  )}
                </ModalBody>
                <ModalFooter className="border-t bg-white">
                  <Button variant="flat" onPress={onClose}>Close</Button>
                  {!isReadOnly && viewTxn.status === 'Pending' && (
                    <Button
                      color="primary"
                      variant="flat"
                      onPress={() => { onMarkCleared(viewTxn.id); setViewTxn(null); }}
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
    </Card>
  );
}
