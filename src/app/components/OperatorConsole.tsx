'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { DEFAULT_MONTHLY_FEE, todayISO } from '@/app/lib/platform/billing';
import { allPaidModulesOn, frontDeskOnly, PAID_MODULES, type PaidModules } from '@/app/lib/platform/hotelModules';

type Hosting = 'cloud' | 'local' | 'sync';
type DeskTab = 'overview' | 'payments' | 'reports';

const HOSTING_OPTIONS: { value: Hosting; label: string; hint: string }[] = [
  { value: 'cloud', label: 'Cloud', hint: 'Staff sign in here. Every screen needs the internet.' },
  { value: 'local', label: 'On a PC in the hotel', hint: 'The desk runs on a computer in the hotel. This screen only records that choice.' },
  { value: 'sync', label: 'PC and cloud', hint: 'The desk runs on a computer in the hotel. When the internet is up, changes copy to the cloud so someone can open the hotel from outside.' },
];

function hostingLabel(hosting: Hosting) {
  return HOSTING_OPTIONS.find((option) => option.value === hosting)?.label ?? 'Cloud';
}

type Hotel = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  hosting: Hosting;
  monthlyFee: number | null;
  paidUntil: string | null;
  paymentDue: boolean;
  trialDays: number | null;
  trialEndsOn: string | null;
  onTrial: boolean;
  payments?: FeePayment[];
  modules: PaidModules;
  createdAt: string;
};

type FeePayment = { paidOn: string; amount: number; paidUntil: string };

type HotelDetail = Hotel & {
  adminName: string | null;
  adminEmail: string | null;
  lastLoginAt: string | null;
  payments: FeePayment[];
  counts: { staff: number; rooms: number; guests: number; reservations: number };
};

function formatDay(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Has not signed in';
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function cedis(amount: number) {
  return `₵${amount.toLocaleString('en-GH')}`;
}

function standing(hotel: Hotel) {
  if (hotel.status === 'suspended') return { label: 'Suspended', tone: 'bg-gray-200 text-gray-700' };
  if (hotel.onTrial) return { label: 'Free trial', tone: 'bg-amber-50 text-amber-800' };
  if (hotel.paymentDue) return { label: 'Payment due', tone: 'bg-red-50 text-red-700' };
  return { label: 'Active', tone: 'bg-emerald-50 text-emerald-800' };
}

function coverageLine(hotel: Hotel) {
  if (hotel.onTrial && hotel.trialEndsOn) return `Free trial until ${formatDay(hotel.trialEndsOn)}`;
  if (hotel.monthlyFee == null) return 'No payment date';
  if (hotel.paidUntil && !hotel.paymentDue) return `Paid until ${formatDay(hotel.paidUntil)}`;
  return 'Payment due';
}

const fieldClass = {
  input: 'text-ghana-black',
  label: 'text-ghana-black font-medium',
  inputWrapper: 'border-gray-300 bg-white',
};

const TABS: { id: DeskTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'payments', label: 'Payments' },
  { id: 'reports', label: 'Reports' },
];

export default function OperatorConsole({ onLogout }: { onLogout: () => void }) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState<'hotels' | 'financials'>('hotels');
  const [detail, setDetail] = useState<HotelDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState<DeskTab>('overview');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [hosting, setHosting] = useState<Hosting>('cloud');
  const [fee, setFee] = useState(String(DEFAULT_MONTHLY_FEE.cloud));
  const [feeTouched, setFeeTouched] = useState(false);
  const [trialDays, setTrialDays] = useState('14');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modules, setModules] = useState<PaidModules>(frontDeskOnly);

  const load = async () => {
    setError('');
    const res = await fetch('/api/platform/tenants', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Could not load hotels.');
      setLoading(false);
      return;
    }
    setHotels(Array.isArray(data.hotels) ? data.hotels : []);
    setLoading(false);
  };

  const openHotelCard = async (id: string) => {
    setSelectedId(id);
    setTab('overview');
    setDeleteOpen(false);
    setDeleteText('');
    setDetail(null);
    setDetailLoading(true);
    setError('');
    const res = await fetch(`/api/platform/tenants/${id}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    setDetailLoading(false);
    if (!res.ok) {
      setError(data.error || 'Could not open this hotel.');
      return;
    }
    setDetail(data);
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return hotels;
    return hotels.filter((hotel) => `${hotel.name} ${hotel.subdomain}`.toLowerCase().includes(needle));
  }, [hotels, query]);

  const dueCount = hotels.filter((hotel) => hotel.paymentDue).length;
  const suspendedCount = hotels.filter((hotel) => hotel.status === 'suspended').length;
  const billed = hotels.filter((hotel) => hotel.monthlyFee != null);
  const monthlyFees = billed.reduce((sum, hotel) => sum + (hotel.monthlyFee ?? 0), 0);
  const collected = hotels.reduce((sum, hotel) => sum + (hotel.payments ?? []).reduce((inner, payment) => inner + payment.amount, 0), 0);
  const outstanding = hotels.filter((hotel) => hotel.paymentDue).reduce((sum, hotel) => sum + (hotel.monthlyFee ?? 0), 0);
  const recentPayments = hotels
    .flatMap((hotel) => (hotel.payments ?? []).map((payment) => ({ ...payment, hotel: hotel.name })))
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn));

  const resetForm = () => {
    setName('');
    setSubdomain('');
    setAdminName('');
    setAdminEmail('');
    setPassword('');
    setHosting('cloud');
    setFee(String(DEFAULT_MONTHLY_FEE.cloud));
    setFeeTouched(false);
    setTrialDays('14');
    setModules(frontDeskOnly());
  };

  const createHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    const monthlyFee = Number(fee);
    const days = Number(trialDays);
    if (!fee.trim() || !Number.isFinite(monthlyFee)) {
      setError('Enter a monthly fee in cedis.');
      setSaving(false);
      return;
    }
    if (!trialDays.trim() || !Number.isInteger(days)) {
      setError('Enter the free trial in whole days.');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch('/api/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subdomain, hosting, monthlyFee, trialDays: days, adminName, adminEmail, password, modules }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not open this hotel.');
        return;
      }
      setNotice(
        data.onTrial && data.trialEndsOn
          ? `${data.name} is open on a free trial until ${formatDay(data.trialEndsOn)}. The admin signs in with Tenant ID “${data.subdomain}” and ${data.adminEmail}.`
          : `${data.name} is open with no free trial. Record a payment for them to keep signing in. The admin signs in with Tenant ID “${data.subdomain}” and ${data.adminEmail}.`,
      );
      resetForm();
      setCreating(false);
      await load();
      if (data.id) await openHotelCard(data.id);
    } finally {
      setSaving(false);
    }
  };

  const refreshSelected = async (id: string) => {
    const res = await fetch(`/api/platform/tenants/${id}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setDetail(data);
  };

  const setStatus = async (hotel: Hotel, status: 'active' | 'suspended') => {
    setError('');
    setBusy('status');
    try {
      const res = await fetch(`/api/platform/tenants/${hotel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not update this hotel.');
        return;
      }
      setHotels((rows) => rows.map((row) => (row.id === hotel.id ? { ...row, ...data } : row)));
      await refreshSelected(hotel.id);
    } finally {
      setBusy('');
    }
  };

  const setTrial = async (hotel: Hotel, days: number) => {
    setError('');
    setBusy('trial');
    try {
      const res = await fetch(`/api/platform/tenants/${hotel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialDays: days }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not set the free trial.');
        return;
      }
      setHotels((rows) => rows.map((row) => (row.id === hotel.id ? { ...row, ...data } : row)));
      await refreshSelected(hotel.id);
    } finally {
      setBusy('');
    }
  };
  const markPaid = async (hotel: Hotel) => {
    setError('');
    setBusy('paid');
    try {
      const res = await fetch(`/api/platform/tenants/${hotel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not record this payment.');
        return;
      }
      setHotels((rows) => rows.map((row) => (row.id === hotel.id ? { ...row, ...data } : row)));
      await refreshSelected(hotel.id);
    } finally {
      setBusy('');
    }
  };

  const deleteHotel = async (hotel: Hotel) => {
    setError('');
    setBusy('delete');
    try {
      const res = await fetch(`/api/platform/tenants/${hotel.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not delete this hotel.');
        return;
      }
      setHotels((rows) => rows.filter((row) => row.id !== hotel.id));
      setSelectedId(null);
      setDetail(null);
      setNotice(`${hotel.name} has been deleted.`);
    } finally {
      setBusy('');
    }
  };

  const saveModules = async (hotel: Hotel, next: PaidModules) => {
    setError('');
    setBusy('modules');
    try {
      const res = await fetch(`/api/platform/tenants/${hotel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not update the modules.');
        return;
      }
      setHotels((rows) => rows.map((row) => (row.id === hotel.id ? { ...row, ...data } : row)));
      await refreshSelected(hotel.id);
    } finally {
      setBusy('');
    }
  };

  const chooseHosting = (value: Hosting) => {
    setHosting(value);
    if (!feeTouched) setFee(String(DEFAULT_MONTHLY_FEE[value]));
  };

  return (
    <div className="min-h-screen bg-[#f6f7f4]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ghana-green">Operator</p>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => { setPage('hotels'); setSelectedId(null); setDetail(null); }}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${page === 'hotels' ? 'bg-ghana-green text-white' : 'text-ghana-black'}`}
              >
                Hotels
              </button>
              <button
                type="button"
                onClick={() => { setPage('financials'); setSelectedId(null); setDetail(null); setNotice(''); }}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${page === 'financials' ? 'bg-ghana-green text-white' : 'text-ghana-black'}`}
              >
                Financials
              </button>
            </div>
          </div>
          <Button variant="bordered" onPress={onLogout}>Sign out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && !selectedId && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

        {selectedId ? (
          <HotelDesk
            detail={detail}
            loading={detailLoading}
            tab={tab}
            busy={busy}
            notice={notice}
            deleteOpen={deleteOpen}
            deleteText={deleteText}
            onTab={setTab}
            onBack={() => {
              setSelectedId(null);
              setDetail(null);
              setNotice('');
              setDeleteOpen(false);
              setDeleteText('');
            }}
            onStatus={setStatus}
            onPaid={markPaid}
            onSetTrial={setTrial}
            onModules={saveModules}
            onDeleteAsk={() => setDeleteOpen(true)}
            onDeleteText={setDeleteText}
            onDelete={deleteHotel}
          />
        ) : page === 'financials' ? (
          <CompanyFinancials
            loading={loading}
            hotelCount={billed.length}
            monthlyFees={monthlyFees}
            collected={collected}
            outstanding={outstanding}
            hotels={billed}
            payments={recentPayments}
          />
        ) : (
          <>
            {!loading && (
              <section className="grid gap-3 sm:grid-cols-3">
                <Stat label="Hotels" value={String(hotels.length)} />
                <Stat label="Payment due" value={String(dueCount)} warn={dueCount > 0} />
                <Stat label="Suspended" value={String(suspendedCount)} />
              </section>
            )}

            <div className="flex flex-wrap items-end justify-between gap-3">
              <Input
                label="Find a hotel"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                variant="bordered"
                className="max-w-sm"
                classNames={fieldClass}
              />
              <Button className="bg-ghana-green text-white" onPress={() => { setError(''); setCreating(true); }}>Open a hotel</Button>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Loading hotels…</p>
            ) : visible.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm text-gray-500">
                {hotels.length === 0 ? 'No hotels yet. Open the first one.' : 'No hotel matches that search.'}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {visible.map((hotel) => (
                  <li key={hotel.id}>
                    <HotelCard hotel={hotel} onOpen={() => void openHotelCard(hotel.id)} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <Modal isOpen={creating} onOpenChange={setCreating} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="text-ghana-black">Open a hotel</ModalHeader>
          <ModalBody>
            <form id="open-hotel" onSubmit={createHotel} className="space-y-4 pb-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Hotel name" value={name} onChange={(e) => setName(e.target.value)} isRequired variant="bordered" classNames={fieldClass} />
                <Input label="Tenant ID" description="What they type at sign-in, such as sunrise" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} isRequired variant="bordered" classNames={fieldClass} />
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ghana-black">Where it runs</legend>
                <div className="flex flex-wrap gap-2">
                  {HOSTING_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => chooseHosting(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${hosting === option.value ? 'border-ghana-green bg-ghana-green text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">{HOSTING_OPTIONS.find((option) => option.value === hosting)?.hint}</p>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ghana-black">Modules they are paying for</legend>
                <div className="flex flex-wrap gap-2">
                  {PAID_MODULES.map((mod) => {
                    const on = modules[mod.key];
                    return (
                      <button
                        key={mod.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setModules((current) => ({ ...current, [mod.key]: !current[mod.key] }))}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium ${on ? 'border-ghana-green bg-ghana-green text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                      >
                        {mod.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">Front desk starts on. A restaurant with no rooms can turn the front desk off and leave Restaurant & bar on.</p>
              </fieldset>
              <Input
                type="number"
                label="Monthly fee (₵)"
                description="What they pay each month after the free trial."
                value={fee}
                min={0}
                onChange={(e) => {
                  setFeeTouched(true);
                  setFee(e.target.value);
                }}
                isRequired
                variant="bordered"
                classNames={fieldClass}
              />
              <Input
                type="number"
                label="Free trial (days)"
                description="How long they can sign in before the first payment. 0 means no free trial."
                value={trialDays}
                min={0}
                max={365}
                onChange={(e) => setTrialDays(e.target.value)}
                isRequired
                variant="bordered"
                classNames={fieldClass}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="First admin name" value={adminName} onChange={(e) => setAdminName(e.target.value)} isRequired variant="bordered" classNames={fieldClass} />
                <Input type="email" label="First admin email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} isRequired variant="bordered" classNames={fieldClass} />
              </div>
              <Input
                type="password"
                label="First admin password"
                description="At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a special character."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                isRequired
                variant="bordered"
                classNames={fieldClass}
              />
            </form>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" form="open-hotel" isLoading={saving} className="bg-ghana-green text-white">Open hotel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

type FinanceTab = 'fees' | 'received' | 'infrastructure';
type CompanyExpense = { id: string; paidOn: string; amount: number; kind: 'cloud' | 'infrastructure'; detail: string };

const FINANCE_TABS: { id: FinanceTab; label: string }[] = [
  { id: 'fees', label: 'Hotels on a fee' },
  { id: 'received', label: 'Payments received' },
  { id: 'infrastructure', label: 'Infrastructure' },
];

function CompanyFinancials({
  loading,
  hotelCount,
  monthlyFees,
  collected,
  outstanding,
  hotels,
  payments,
}: {
  loading: boolean;
  hotelCount: number;
  monthlyFees: number;
  collected: number;
  outstanding: number;
  hotels: Hotel[];
  payments: Array<FeePayment & { hotel: string }>;
}) {
  const [sheet, setSheet] = useState<FinanceTab>('fees');
  const [expenses, setExpenses] = useState<CompanyExpense[]>([]);
  const [expenseError, setExpenseError] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [paidOn, setPaidOn] = useState(todayISO());
  const [kind, setKind] = useState<'cloud' | 'infrastructure'>('cloud');
  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/platform/expenses', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
      })
      .catch(() => {
        if (!cancelled) setExpenseError('Could not load infrastructure payments.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');
    setSavingExpense(true);
    try {
      const res = await fetch('/api/platform/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidOn, amount: Number(amount), kind, detail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExpenseError(data.error || 'Could not record this payment.');
        return;
      }
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
      setDetail('');
      setAmount('');
      setPaidOn(todayISO());
    } finally {
      setSavingExpense(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading financials…</p>;
  const infrastructureTotal = expenses.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-ghana-black">Company financials</h2>
        <p className="mt-1 text-sm text-gray-600">Fees the hotels pay this company, and what the company pays for cloud and other infrastructure.</p>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Monthly fees" value={cedis(monthlyFees)} />
        <Stat label="Collected" value={cedis(collected)} />
        <Stat label="Still to collect" value={cedis(outstanding)} warn={outstanding > 0} />
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Company financials">
        {FINANCE_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={sheet === item.id}
            onClick={() => setSheet(item.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${sheet === item.id ? 'bg-ghana-green text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}
          >
            {item.label}{item.id === 'fees' ? ` · ${hotelCount}` : ''}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {sheet === 'fees' && (
          <MoneyTable
            columns={['Hotel', 'Tenant ID', 'Monthly fee', 'Paid until', 'Standing']}
            empty="No hotel is on a monthly fee yet."
            rows={hotels.map((hotel) => ({
              warn: hotel.paymentDue,
              cells: [
                cell(hotel.name),
                cell(hotel.subdomain),
                cell(cedis(hotel.monthlyFee ?? 0), hotel.monthlyFee ?? 0),
                cell(hotel.onTrial && hotel.trialEndsOn ? `Trial until ${formatDay(hotel.trialEndsOn)}` : hotel.paidUntil ? formatDay(hotel.paidUntil) : 'No date', hotel.paidUntil ?? ''),
                cell(hotel.onTrial ? 'Free trial' : hotel.paymentDue ? 'Payment due' : 'Paid'),
              ],
            }))}
          />
        )}
        {sheet === 'received' && (
          <MoneyTable
            columns={['Date', 'Hotel', 'Amount', 'Covers until']}
            empty="No fee has been recorded yet."
            rows={payments.map((payment) => ({
              cells: [
                cell(formatDay(payment.paidOn), payment.paidOn),
                cell(payment.hotel),
                cell(cedis(payment.amount), payment.amount),
                cell(formatDay(payment.paidUntil), payment.paidUntil),
              ],
            }))}
          />
        )}
        {sheet === 'infrastructure' && (
          <div>
            <form onSubmit={recordExpense} className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
              <Input type="date" label="Date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} isRequired variant="bordered" classNames={fieldClass} />
              <fieldset className="sm:col-span-2 lg:col-span-1">
                <legend className="mb-2 text-sm font-medium text-ghana-black">What</legend>
                <div className="flex flex-wrap gap-2">
                  {([['cloud', 'Cloud'], ['infrastructure', 'Other']] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setKind(value)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${kind === value ? 'border-ghana-green bg-ghana-green text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Input label="What it was" value={detail} onChange={(e) => setDetail(e.target.value)} isRequired variant="bordered" classNames={fieldClass} />
              <Input type="number" label="Amount (₵)" value={amount} min={1} onChange={(e) => setAmount(e.target.value)} isRequired variant="bordered" classNames={fieldClass} />
              <Button type="submit" isLoading={savingExpense} className="bg-ghana-green text-white">Record payment</Button>
            </form>
            {expenseError && <p className="px-4 pt-3 text-sm text-red-600">{expenseError}</p>}
            <p className="px-4 pt-3 text-sm text-gray-600">Spent so far {cedis(infrastructureTotal)}</p>
            <MoneyTable
              columns={['Date', 'Kind', 'What it was', 'Amount']}
              empty="No cloud or infrastructure payment yet."
              rows={expenses.map((row) => ({
                cells: [
                  cell(formatDay(row.paidOn), row.paidOn),
                  cell(row.kind === 'cloud' ? 'Cloud' : 'Other infrastructure'),
                  cell(row.detail),
                  cell(cedis(row.amount), row.amount),
                ],
              }))}
            />
          </div>
        )}
      </section>
    </div>
  );
}

type MoneyCell = { text: string; sort: string | number };
type MoneyRow = { cells: MoneyCell[]; warn?: boolean };

function cell(text: string, sort: string | number = text.toLowerCase()): MoneyCell {
  return { text, sort };
}

function MoneyTable({ columns, rows, empty }: { columns: string[]; rows: MoneyRow[]; empty: string }) {
  const [query, setQuery] = useState('');
  const [sortIndex, setSortIndex] = useState(0);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const needle = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const filtered = needle
      ? rows.filter((row) => row.cells.some((item) => item.text.toLowerCase().includes(needle)))
      : rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = a.cells[sortIndex]?.sort ?? '';
      const right = b.cells[sortIndex]?.sort ?? '';
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * dir;
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * dir;
    });
  }, [rows, needle, sortIndex, sortDir]);

  const sortBy = (index: number) => {
    if (sortIndex === index) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortIndex(index);
      setSortDir('asc');
    }
  };

  return (
    <div>
      <div className="border-b border-gray-100 px-4 py-3">
        <Input
          label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          variant="bordered"
          className="max-w-sm"
          classNames={fieldClass}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {columns.map((column, index) => (
                <th key={column} className="px-4 py-3 font-medium" aria-sort={sortIndex === index ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => sortBy(index)} className="inline-flex items-center gap-1 uppercase tracking-wide">
                    {column}
                    <span aria-hidden="true">{sortIndex === index ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-gray-500">
                  {rows.length === 0 ? empty : 'Nothing matches that search.'}
                </td>
              </tr>
            ) : shown.map((row, index) => (
              <tr key={index} className="border-b border-gray-100 last:border-0">
                {row.cells.map((item, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-4 py-3 text-ghana-black ${cellIndex === 0 ? 'font-medium' : ''} ${row.warn && cellIndex === row.cells.length - 1 ? 'font-medium text-red-600' : ''}`}
                  >
                    {item.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${warn ? 'text-red-700' : 'text-ghana-black'}`}>{value}</p>
    </div>
  );
}

function HotelCard({ hotel, onOpen }: { hotel: Hotel; onOpen: () => void }) {
  const badge = standing(hotel);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-ghana-green hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-tight text-ghana-black">{hotel.name}</h2>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium leading-tight ${badge.tone}`}>{badge.label}</span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{hotel.subdomain}</p>
      <dl className="mt-2.5 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-gray-500">Runs</dt>
          <dd className="font-medium leading-tight text-ghana-black">{hostingLabel(hotel.hosting)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Fee</dt>
          <dd className="font-medium leading-tight text-ghana-black">{hotel.monthlyFee == null ? 'Not billed' : cedis(hotel.monthlyFee)}</dd>
        </div>
      </dl>
      <p className={`mt-2 text-sm leading-tight ${hotel.paymentDue ? 'font-medium text-red-600' : 'text-gray-600'}`}>
        {coverageLine(hotel)}
      </p>
      <span className="mt-2 text-sm font-semibold text-ghana-green">Open</span>
    </button>
  );
}

function HotelDesk({
  detail,
  loading,
  tab,
  busy,
  notice,
  deleteOpen,
  deleteText,
  onTab,
  onBack,
  onStatus,
  onPaid,
  onSetTrial,
  onModules,
  onDeleteAsk,
  onDeleteText,
  onDelete,
}: {
  detail: HotelDetail | null;
  loading: boolean;
  tab: DeskTab;
  busy: string;
  notice: string;
  deleteOpen: boolean;
  deleteText: string;
  onTab: (tab: DeskTab) => void;
  onBack: () => void;
  onStatus: (hotel: Hotel, status: 'active' | 'suspended') => void;
  onPaid: (hotel: Hotel) => void;
  onSetTrial: (hotel: Hotel, days: number) => void;
  onModules: (hotel: Hotel, modules: PaidModules) => void;
  onDeleteAsk: () => void;
  onDeleteText: (value: string) => void;
  onDelete: (hotel: Hotel) => void;
}) {
  const [trialInput, setTrialInput] = useState('14');
  useEffect(() => {
    if (!detail) return;
    setTrialInput(String(detail.trialDays ?? 0));
  }, [detail]);

  if (loading || !detail) {
    return (
      <div>
        <button type="button" onClick={onBack} className="text-sm font-medium text-ghana-green">All hotels</button>
        <p className="mt-6 text-sm text-gray-500">Opening hotel…</p>
      </div>
    );
  }

  const badge = standing(detail);
  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-sm font-medium text-ghana-green">All hotels</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold text-ghana-black">{detail.name}</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.tone}`}>{badge.label}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{detail.subdomain} · {hostingLabel(detail.hosting)}</p>
        </div>
      </div>
      {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Hotel sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => onTab(item.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === item.id ? 'bg-ghana-green text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Fact label="Tenant ID" value={detail.subdomain} />
            <Fact label="Where it runs" value={hostingLabel(detail.hosting)} />
            <Fact label="Opened" value={formatDay(detail.createdAt)} />
            <Fact label="First admin" value={detail.adminName ? `${detail.adminName}${detail.adminEmail ? ` · ${detail.adminEmail}` : ''}` : 'No admin on file'} />
            <Fact label="Last sign-in" value={detail.lastLoginAt ? formatWhen(detail.lastLoginAt) : 'Has not signed in'} />
            <Fact label="Monthly fee" value={detail.monthlyFee == null ? 'Not billed' : cedis(detail.monthlyFee)} />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-ghana-black">Modules</h3>
            <p className="mt-1 text-xs text-gray-500">What this hotel has paid for. The hotel cannot turn these on.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PAID_MODULES.map((mod) => {
                const current = detail.modules ?? allPaidModulesOn();
                const on = current[mod.key] === true;
                return (
                  <button
                    key={mod.key}
                    type="button"
                    aria-pressed={on}
                    disabled={busy === 'modules'}
                    onClick={() => onModules(detail, { ...current, [mod.key]: !on })}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${on ? 'border-ghana-green bg-ghana-green text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                  >
                    {mod.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.status === 'suspended' ? (
              <Button variant="flat" isLoading={busy === 'status'} onPress={() => onStatus(detail, 'active')}>Activate</Button>
            ) : (
              <Button variant="flat" color="danger" isLoading={busy === 'status'} onPress={() => onStatus(detail, 'suspended')}>Suspend</Button>
            )}
            <Button variant="bordered" color="danger" onPress={onDeleteAsk}>Delete</Button>
          </div>
          {deleteOpen && (
            <div className="max-w-md space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">This removes the hotel and everything inside it. Type <span className="font-semibold">{detail.subdomain}</span> to confirm.</p>
              <Input label="Tenant ID" value={deleteText} onChange={(e) => onDeleteText(e.target.value)} variant="bordered" classNames={fieldClass} />
              <Button color="danger" isLoading={busy === 'delete'} isDisabled={deleteText.trim().toLowerCase() !== detail.subdomain} onPress={() => onDelete(detail)}>Delete hotel</Button>
            </div>
          )}
        </section>
      )}

      {tab === 'payments' && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact label="Monthly fee" value={detail.monthlyFee == null ? 'Not billed' : cedis(detail.monthlyFee)} />
            <Fact label={detail.onTrial ? 'Free trial until' : 'Paid until'} value={detail.paidUntil ? formatDay(detail.paidUntil) : 'No date'} />
            <Fact label="Standing" value={detail.onTrial ? 'Free trial' : detail.paymentDue ? 'Payment due' : detail.monthlyFee == null ? 'Not billed' : 'Paid'} />
          </div>
          {detail.payments.length === 0 && (
            <form
              className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4"
              onSubmit={(e) => {
                e.preventDefault();
                const days = Number(trialInput);
                if (!trialInput.trim() || !Number.isInteger(days)) return;
                onSetTrial(detail, days);
              }}
            >
              <Input
                type="number"
                label="Free trial (days)"
                description="Change it before the first payment. 0 removes the free trial."
                value={trialInput}
                min={0}
                max={365}
                onChange={(e) => setTrialInput(e.target.value)}
                variant="bordered"
                classNames={fieldClass}
                className="w-56"
              />
              <Button type="submit" variant="flat" isLoading={busy === 'trial'}>Set free trial</Button>
            </form>
          )}
          {detail.monthlyFee != null && (
            <Button className="bg-ghana-green text-white" isLoading={busy === 'paid'} onPress={() => onPaid(detail)}>Mark paid</Button>
          )}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-ghana-black">Payments</h3>
            {detail.payments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500">No payments recorded.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {[...detail.payments].reverse().map((payment, index) => (
                  <li key={`${payment.paidOn}-${payment.paidUntil}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="text-ghana-black">{formatDay(payment.paidOn)}</span>
                    <span className="font-medium text-ghana-black">{cedis(payment.amount)}</span>
                    <span className="text-gray-500">Covers until {formatDay(payment.paidUntil)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === 'reports' && (
        <section className="space-y-3">
          <p className="text-sm text-gray-600">A count of what this hotel has in the system. Guest names and bills stay inside the hotel.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Rooms" value={String(detail.counts.rooms)} />
            <Stat label="Staff" value={String(detail.counts.staff)} />
            <Stat label="Guests" value={String(detail.counts.guests)} />
            <Stat label="Reservations" value={String(detail.counts.reservations)} />
          </div>
        </section>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-ghana-black">{value}</p>
    </div>
  );
}
