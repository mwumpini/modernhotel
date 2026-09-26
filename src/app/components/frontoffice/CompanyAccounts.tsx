'use client';

import React, { useEffect, useState } from 'react';
import { Button, Checkbox, Chip, Input, Radio, RadioGroup, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { frontOfficeStore } from '../../lib/frontoffice/store';
import {
  companyAccount,
  companyAccounts,
  companyLedger,
  companyStayWhen,
  previewCompanyAllocation,
  standingLabel,
  type BillStanding,
} from '../../lib/frontoffice/companyAccount';
import { money, shortDay } from '../../lib/frontoffice/stayWorksheet';
import type { Reservation } from '../../lib/frontoffice/types';
import { worksheetTableClassNames } from './StayWorksheetTable';

const METHODS = ['Bank Transfer', 'Check', 'Cash', 'Mobile Money'] as const;
type ReceiptMethod = (typeof METHODS)[number];

function useFrontOfficeTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => frontOfficeStore.subscribe(() => setTick((n) => n + 1)), []);
  return tick;
}

function standingColor(standing: BillStanding): 'warning' | 'success' {
  return standing === 'paid' ? 'success' : 'warning';
}

function roomLabel(roomId?: string) {
  return roomId && roomId !== 'TBD' ? roomId : 'Unassigned';
}

/** Two names fit the column. The rest stay on the ledger, counted here. */
function guestSummary(names: string[]) {
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

export function CompanyStatement({ companyKey, matches }: { companyKey: string; matches?: (reservation: Reservation) => boolean }) {
  const tick = useFrontOfficeTick();
  const account = companyAccount(companyKey, matches);
  const ledger = companyLedger(companyKey, matches);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState<ReceiptMethod>('Bank Transfer');
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [extraOn, setExtraOn] = useState<string | null>(null);
  void tick;

  useEffect(() => {
    setPicked(null);
    setExtraOn(null);
  }, [companyKey]);

  const defaultIds = (account?.stays || []).filter((line) => line.balance > 0.005).map((line) => line.reservation.id);
  const selectedIds = (picked ?? defaultIds).filter((id) => account?.stays.some((line) => line.reservation.id === id));
  const tendered = Number(amount);
  const preview = previewCompanyAllocation(
    companyKey,
    Number.isFinite(tendered) ? tendered : 0,
    selectedIds,
    extraOn,
    matches,
  );

  const toggleStay = (id: string, on: boolean) => {
    const next = on ? [...selectedIds, id] : selectedIds.filter((item) => item !== id);
    setPicked([...new Set(next)]);
    if (!on && extraOn === id) setExtraOn(null);
  };

  if (!account) {
    return (
      <p className="text-sm text-gray-600">
        No stay is billed to this company yet. Put the company name on the reservation, then leave that stay&apos;s balance on account. Each guest&apos;s bill stays on that guest.
      </p>
    );
  }

  const applyReceipt = () => {
    if (preview.applied <= 0 || busy) return;
    setBusy(true);
    try {
      const ref = reference.trim() || `REC-${Date.now().toString(36).toUpperCase()}`;
      frontOfficeStore.postCompanyReceipt(
        account.name,
        preview.lines.filter((line) => line.applied > 0).map((line) => ({ reservationId: line.reservationId, amount: line.applied })),
        ref,
        method,
      );
      setAmount('');
      setReference('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Each stay keeps its own bill. Tick who a payment from {account.name} is for. If the cheque is more than those stays, choose which one keeps the extra.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
          <div className="text-base font-semibold tabular-nums text-ghana-black">{money(account.billed)}</div>
          <div className="text-xs text-gray-500">Billed</div>
        </div>
        <div className="rounded-lg bg-green-50 px-3 py-2 text-center">
          <div className="text-base font-semibold tabular-nums text-green-700">{money(account.paid)}</div>
          <div className="text-xs text-green-600">Paid</div>
        </div>
        <div className="rounded-lg bg-orange-50 px-3 py-2 text-center">
          <div className="text-base font-semibold tabular-nums text-orange-700">{money(account.pending)}</div>
          <div className="text-xs text-orange-600">Outstanding</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_6.5rem] gap-3 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          <span>Stay</span>
          <span className="text-right">Billed</span>
          <span className="text-right">Paid</span>
          <span className="text-right">Outstanding</span>
        </div>
        <div className="divide-y divide-gray-100">
          {account.stays.map((line) => (
            <div key={line.reservation.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_6.5rem] items-start gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ghana-black">{line.reservation.guestName}</p>
                <p className="text-sm text-gray-500">
                  {line.reservation.resId || line.reservation.id} · Room {roomLabel(line.reservation.roomId)} · {companyStayWhen(line.reservation)}
                </p>
              </div>
              <span className="pt-0.5 text-right text-sm tabular-nums text-gray-700">{money(line.amount)}</span>
              <span className="pt-0.5 text-right text-sm tabular-nums text-gray-700">{money(line.paid)}</span>
              <div className="flex flex-col items-end gap-1">
                <span className="font-semibold tabular-nums text-ghana-black">{money(line.balance)}</span>
                <Chip size="sm" variant="flat" color={standingColor(line.standing)}>{standingLabel(line.standing)}</Chip>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-ghana-black">Ledger</h4>
        {ledger.length === 0 ? (
          <p className="text-sm text-gray-500">No payment on this ledger yet.</p>
        ) : (
          <div className="space-y-2">
            {ledger.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-gray-200 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm text-gray-600">
                    {shortDay(entry.date)} · {entry.method}{entry.reference ? ` · ${entry.reference}` : ''}
                  </p>
                  <span className="shrink-0 font-semibold tabular-nums">{money(entry.amount)}</span>
                </div>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gray-400">Paid for</p>
                <div className="mt-1 space-y-0.5">
                  {entry.splits.map((split) => (
                    <p key={`${entry.id}-${split.resId}`} className="flex justify-between gap-3 text-sm text-gray-600">
                      <span className="min-w-0 truncate">{split.guestName} · {split.resId}</span>
                      <span className="shrink-0 tabular-nums">{money(split.amount)}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {account.pending > 0.005 && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-semibold text-ghana-black">Record a lump sum</h4>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              label="Amount"
              size="sm"
              type="number"
              min={0}
              value={amount}
              onValueChange={setAmount}
              startContent={<span className="text-sm text-gray-400">₵</span>}
            />
            <Input
              label="Reference"
              size="sm"
              value={reference}
              onValueChange={setReference}
              placeholder="Transfer or cheque"
            />
            <Select
              label="Method"
              size="sm"
              selectedKeys={new Set([method])}
              onSelectionChange={(keys) => {
                const value = Array.from(keys as Set<string>)[0] as ReceiptMethod | undefined;
                if (value) setMethod(value);
              }}
            >
              {METHODS.map((item) => (
                <SelectItem key={item}>{item}</SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Pays for</p>
            {account.stays.map((stay) => {
              const id = stay.reservation.id;
              const line = preview.lines.find((item) => item.reservationId === id);
              const resId = stay.reservation.resId || id;
              return (
                <div key={id} className="flex items-start justify-between gap-3">
                  <Checkbox
                    size="sm"
                    isSelected={selectedIds.includes(id)}
                    onValueChange={(on) => toggleStay(id, on)}
                    classNames={{ label: 'text-sm text-gray-700' }}
                  >
                    {stay.reservation.guestName} · {resId}
                  </Checkbox>
                  {line && line.applied > 0.005 && (
                    <span className="shrink-0 pt-0.5 text-right tabular-nums">
                      <span className="font-semibold">{money(line.applied)}</span>
                      {line.remaining > 0.005 && (
                        <span className="block text-xs text-orange-700">still {money(line.remaining)}</span>
                      )}
                      {line.overpay > 0.005 && (
                        <span className="block text-xs text-green-700">credit {money(line.overpay)}</span>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
            {preview.extra > 0.005 && selectedIds.length > 1 && (
              <RadioGroup
                label={`Put the extra ${money(preview.extra)} on`}
                size="sm"
                value={preview.extraOn || ''}
                onValueChange={setExtraOn}
                classNames={{ label: 'text-xs text-gray-500' }}
              >
                {account.stays.filter((stay) => selectedIds.includes(stay.reservation.id)).map((stay) => (
                  <Radio key={stay.reservation.id} value={stay.reservation.id} classNames={{ label: 'text-sm' }}>
                    {stay.reservation.guestName} · {stay.reservation.resId || stay.reservation.id}
                  </Radio>
                ))}
              </RadioGroup>
            )}
            {tendered > 0 && (
              <p className="text-xs text-gray-500">
                Company still outstanding {money(Math.max(0, account.pending - preview.towardBills))}.
              </p>
            )}
          </div>
          <Button
            color="success"
            className="bg-green-600 font-semibold text-white"
            isDisabled={preview.applied <= 0}
            isLoading={busy}
            onPress={applyReceipt}
          >
            Apply to stays
          </Button>
        </div>
      )}
    </div>
  );
}

function accountStanding(account: ReturnType<typeof companyAccounts>[number]): BillStanding {
  return account.pending > 0.005 ? 'pending' : 'paid';
}

function companyMatchesStatus(account: ReturnType<typeof companyAccounts>[number], status: string) {
  if (status === 'all') return true;
  return accountStanding(account) === status;
}

export default function CompanyAccounts({
  onOpen,
  matches,
  filtered,
  query = '',
  status = 'all',
}: {
  onOpen: (key: string, name: string) => void;
  matches?: (reservation: Reservation) => boolean;
  filtered?: boolean;
  query?: string;
  status?: string;
}) {
  const tick = useFrontOfficeTick();
  const needle = query.trim().toLowerCase();
  const accounts = companyAccounts(matches).filter((account) => {
    if (!companyMatchesStatus(account, status)) return false;
    if (!needle) return true;
    const hay = `${account.name} ${account.guestNames.join(' ')} ${account.stays.map((line) => line.reservation.resId || '').join(' ')}`.toLowerCase();
    return hay.includes(needle);
  });
  void tick;

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        {filtered
          ? 'No company matches these filters.'
          : 'No company account yet. A stay appears here when its reservation has a company name. Each guest keeps their own balance.'}
      </p>
    );
  }

  return (
    <Table aria-label="Company ledgers" removeWrapper classNames={worksheetTableClassNames}>
      <TableHeader>
        <TableColumn>Company</TableColumn>
        <TableColumn>Guests</TableColumn>
        <TableColumn className="w-[4.5rem] text-right">Stays</TableColumn>
        <TableColumn className="w-[7rem] text-right">Billed</TableColumn>
        <TableColumn className="w-[7rem] text-right">Paid</TableColumn>
        <TableColumn className="w-[8rem] text-right">Outstanding</TableColumn>
        <TableColumn className="w-[6.5rem]">Status</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No company account yet.">
        {accounts.map((account) => (
          <TableRow key={account.key} className="cursor-pointer" onClick={() => onOpen(account.key, account.name)}>
            <TableCell><span className="font-semibold">{account.name}</span></TableCell>
            <TableCell>
              <span className="block max-w-[18rem] truncate" title={account.guestNames.join(', ')}>
                {guestSummary(account.guestNames)}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">{account.stays.length}</TableCell>
            <TableCell className="text-right tabular-nums">{money(account.billed)}</TableCell>
            <TableCell className="text-right tabular-nums">{money(account.paid)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{money(account.pending)}</TableCell>
            <TableCell>
              <Chip size="sm" variant="flat" color={standingColor(accountStanding(account))}>
                {standingLabel(accountStanding(account))}
              </Chip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
