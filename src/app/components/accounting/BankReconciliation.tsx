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
} from '@/app/lib/accounting/bankRecon/ledgerSync';
import type { ReconcilingItem, ReconcilingItemType, ReconSide } from '@/app/lib/accounting/bankRecon/types';

const fmt = (n: number) =>
  `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtSigned = (n: number, deduct = false) => {
  if (Math.abs(n) < 0.01) return '—';
  const prefix = deduct ? '(' : '';
  const suffix = deduct ? ')' : '';
  return `${prefix}${fmt(n)}${suffix}`;
};

type Line = { label: string; amount: number; deduct?: boolean; emphasis?: boolean; divider?: boolean };

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
  offsetGlCode: '4300',
};

type Props = {
  embedded?: boolean;
  initialAccountId?: string;
};

export default function BankReconciliation({ embedded, initialAccountId }: Props) {
  const { bankAccounts, journalEntries, chartOfAccounts, initializeAccounting } = useAccountingStore();
  const {
    openReconciliation,
    getReconciliation,
    getItems,
    updateReconciliation,
    syncCashbookFromLedger,
    addItem,
    deleteItem,
    markChequeCleared,
    postBookSideToLedger,
    completeReconciliation,
    approveReconciliation,
    error,
    clearError,
  } = useBankReconStore();

  const activeAccounts = useMemo(() => bankAccounts.filter((b) => b.isActive), [bankAccounts]);

  const [accountId, setAccountId] = useState(initialAccountId || activeAccounts[0]?.id || '');
  const [periodEndDate, setPeriodEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statementInput, setStatementInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(defaultItemForm);
  const [addSide, setAddSide] = useState<ReconSide>('bank');
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    initializeAccounting().catch(() => {});
  }, [initializeAccounting]);

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

  const reconciliations = useBankReconStore((s) => s.reconciliations);

  useEffect(() => {
    if (accountId && periodEndDate) {
      openReconciliation(accountId, periodEndDate);
    }
  }, [accountId, periodEndDate, openReconciliation]);

  const recon = useMemo(() => {
    if (!accountId || !periodEndDate) return undefined;
    return getReconciliation(accountId, periodEndDate);
  }, [accountId, periodEndDate, getReconciliation, reconciliations]);

  const items = useMemo(() => (recon ? getItems(recon.id) : []), [recon, getItems]);

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
      transactionDate: periodEndDate,
    });
    onOpen();
  };

  const handleSaveItem = () => {
    if (!recon) return;
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
    if (completeReconciliation(recon.id)) {
      setNotice('Reconciliation marked complete.');
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
          <h1 className="text-2xl font-bold text-gray-900">Bank Reconciliation</h1>
          <p className="text-sm text-gray-600 mt-1">
            Two-block format — adjusted bank balance must equal adjusted cashbook balance.
          </p>
        </div>
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
              label="Period end"
              value={periodEndDate}
              onValueChange={setPeriodEndDate}
              isDisabled={isReadOnly}
            />
            <Input
              type="number"
              label="Statement balance"
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
            {recon?.status === 'Draft' && computed?.isBalanced && (
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
            />
            <ItemsPanel
              title="Book-side items"
              side="book"
              items={itemsForSide(items, 'book')}
              isReadOnly={!!isReadOnly}
              onAdd={() => openAddItem('book')}
              onDelete={deleteItem}
              onClearCheque={markChequeCleared}
            />
          </div>
        </>
      )}

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Add {addSide === 'bank' ? 'bank-side' : 'book-side'} item</ModalHeader>
          <ModalBody className="gap-3">
            <Select
              label="Type"
              selectedKeys={[itemForm.itemType]}
              onSelectionChange={(k) => setItemForm({ ...itemForm, itemType: Array.from(k)[0] as ReconcilingItemType })}
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
            <Input
              label="Description"
              value={itemForm.description}
              onValueChange={(v) => setItemForm({ ...itemForm, description: v })}
            />
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
            <Input
              type="number"
              label="Amount (always positive)"
              value={itemForm.amount}
              onValueChange={(v) => setItemForm({ ...itemForm, amount: v })}
              startContent={<span className="text-gray-400 text-sm">₵</span>}
            />
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
}: {
  title: string;
  side: ReconSide;
  items: ReconcilingItem[];
  isReadOnly: boolean;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onClearCheque: (id: string, date: string) => void;
}) {
  const meta = (type: ReconcilingItemType) => RECON_ITEM_TYPES.find((t) => t.type === type);

  return (
    <Card className="shadow-sm border border-slate-200">
      <CardBody className="p-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {!isReadOnly && (
            <Button size="sm" variant="flat" color="primary" onPress={onAdd}>
              Add
            </Button>
          )}
        </div>
        <Table removeWrapper aria-label={title} classNames={{ th: 'text-xs' }}>
          <TableHeader>
            <TableColumn>TYPE</TableColumn>
            <TableColumn>DESCRIPTION</TableColumn>
            <TableColumn className="text-right">AMOUNT</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn>ACTIONS</TableColumn>
          </TableHeader>
          <TableBody emptyContent={`No ${side}-side items.`}>
            {items.map((item) => {
              const m = meta(item.itemType);
              const deduct = m?.effect === 'deduct';
              return (
                <TableRow key={item.id}>
                  <TableCell className="text-xs">{m?.label || item.itemType}</TableCell>
                  <TableCell>
                    <div className="text-sm">{item.description}</div>
                    {item.reference && <div className="text-xs font-mono text-gray-400">{item.reference}</div>}
                    {item.carriedFromItemId && (
                      <Chip size="sm" variant="flat" className="mt-1">
                        Carried forward
                      </Chip>
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-sm ${deduct ? 'text-red-700' : ''}`}>
                    {fmtSigned(item.amount, deduct)}
                  </TableCell>
                  <TableCell>
                    {item.journalEntryId ? (
                      <Chip size="sm" color="success" variant="flat">
                        Posted {item.journalEntryId.slice(-6)}
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
                  <TableCell>
                    {isReadOnly ? (
                      <span className="text-gray-300 text-xs">—</span>
                    ) : (
                      <div className="flex gap-1">
                        {item.itemType === 'OUTSTANDING_CHEQUE' && !item.isCleared && (
                          <Button
                            size="sm"
                            variant="light"
                            onPress={() => onClearCheque(item.id, new Date().toISOString().slice(0, 10))}
                          >
                            Clear
                          </Button>
                        )}
                        <Button size="sm" variant="light" color="danger" onPress={() => onDelete(item.id)}>
                          Del
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}
