'use client';

import React from 'react';
import { DEFAULT_BAD_DEBT_BANDS, normaliseBands, type BadDebtBand } from '@/app/lib/accounting/badDebt';
import { Button, Switch } from '@heroui/react';
import { BookOpen, Building2, CalendarClock, CalendarX2, Clock, Coins, Moon, Smartphone, type LucideIcon } from 'lucide-react';
import { useSettingsStore } from '../../lib/settings/store';
import { normalizeGuestPaymentService } from '../../lib/payments/guestCollection';
import { hourStamp } from '../../lib/frontoffice/operationalPolicies';
import CompanyYearPanel from './CompanyYearPanel';
import CurrenciesPolicy from './CurrenciesPolicy';

const policyInput = 'mt-1 w-full h-10 rounded-lg border border-default-300 bg-transparent px-3 text-sm transition-colors focus:border-ghana-green focus:outline-none focus:ring-2 focus:ring-ghana-green/20';
const policyLabel = 'text-xs font-medium text-gray-500';

const SECTIONS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'policy-posting', label: 'Posting dates', icon: CalendarClock },
  { id: 'policy-checkin', label: 'Check-in & checkout', icon: Clock },
  { id: 'policy-company', label: 'Company accounts', icon: Building2 },
  { id: 'policy-doubtful', label: 'Doubtful debts', icon: BookOpen },
  { id: 'policy-booking', label: 'Booking changes', icon: CalendarX2 },
  { id: 'policy-audit', label: 'Night audit & billing', icon: Moon },
  { id: 'policy-currencies', label: 'Currencies', icon: Coins },
  { id: 'policy-payments', label: 'Payments', icon: Smartphone },
  { id: 'policy-year', label: 'Accounting year', icon: BookOpen },
];

function SectionNav() {
  return (
    <nav aria-label="Policy sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      {SECTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-default-200 bg-[var(--card-background,white)] px-3 py-1.5 text-xs font-medium text-default-700 transition-colors hover:border-ghana-green hover:text-ghana-green"
        >
          <Icon size={14} aria-hidden />
          {label}
        </button>
      ))}
    </nav>
  );
}

function PolicyGroup({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  const Icon = SECTIONS.find((s) => s.id === id)?.icon ?? CalendarClock;
  return (
    <section id={id} className="scroll-mt-16 rounded-2xl border border-default-200 bg-[var(--card-background,white)] p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ghana-green/10 text-ghana-green">
          <Icon size={18} aria-hidden />
        </span>
        <div>
          <h3 className="text-base font-semibold text-ghana-black">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{children}</div>
    </section>
  );
}

function PolicyCard({ title, children, wide, on }: { title: string; children: React.ReactNode; wide?: boolean; on?: boolean }) {
  return (
    <div className={`rounded-xl border border-default-200 p-4 ${wide ? 'xl:col-span-2' : ''}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ghana-black">{title}</h4>
        {on !== undefined && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? 'bg-ghana-green/10 text-ghana-green' : 'bg-default-100 text-default-500'}`}>
            {on ? 'On' : 'Off'}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** Fields that only matter while their rule is on: still editable, but dimmed when off. */
function RuleFields({ active, children, className = '' }: { active: boolean; children: React.ReactNode; className?: string }) {
  return <div className={`transition-opacity ${active ? '' : 'opacity-60'} ${className}`}>{children}</div>;
}

function PolicyRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 border-b border-default-200 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-[10rem] flex-1 sm:pr-4">
        <div className="text-sm font-medium text-ghana-black">{label}</div>
        {hint ? <p className="text-xs text-gray-500 mt-0.5">{hint}</p> : null}
      </div>
      <div className="w-full shrink-0 sm:w-64">{children}</div>
    </div>
  );
}

/** What the value box means for each fee type. */
function valueLabel(type?: string) {
  if (type === 'percent_reservation') return 'Percent of the stay (%)';
  if (type === 'flat') return 'Amount (before tax)';
  return 'Value (not used for this type)';
}

export default function OperationalPoliciesPanel() {
  const badDebtRows = normaliseBands(useSettingsStore((st) => st.roomManagement.badDebtBands));
  const saveBadDebtRows = (rows: BadDebtBand[]) => useSettingsStore.getState().updateNestedSetting('roomManagement.badDebtBands', normaliseBands(rows));
  const setBadDebtRow = (i: number, patch: Partial<BadDebtBand>) => saveBadDebtRows(badDebtRows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const settingsStore = useSettingsStore();
  const roleId = settingsStore.sessionRoleId ?? settingsStore.currentUser?.roleId;
  const canAllowBackdating = roleId === 'admin' || roleId === 'manager';
  return (
<div className="space-y-5">
  <p className="text-sm text-gray-500">The hotel's house rules. Each change saves immediately.</p>
  <SectionNav />
  <PolicyGroup id="policy-posting" title="Posting dates" description="Whether payments, charges, journals, stock, payroll and new bookings can use a date before today. Report date ranges are never limited.">
    <PolicyCard title="Backdating" wide on={settingsStore.roomManagement.allowBackdating === true}>
      <PolicyRow
        label="Allow backdating"
        hint={canAllowBackdating
          ? 'Off: nothing new can be dated before today (arrivals may still use yesterday until night audit closes). On: earlier dates are allowed. Turn it off again once the correction is done.'
          : 'Only an admin or a manager can change this. While it is off, nothing new can be dated before today.'}
      >
        <Switch
          isSelected={settingsStore.roomManagement.allowBackdating === true}
          isDisabled={!canAllowBackdating}
          onValueChange={(v) => settingsStore.updateNestedSetting('roomManagement.allowBackdating', v)}
        >
          {settingsStore.roomManagement.allowBackdating === true ? 'On' : 'Off'}
        </Switch>
      </PolicyRow>
    </PolicyCard>
  </PolicyGroup>
  <PolicyGroup id="policy-checkin" title="Check-in and checkout" description="Standard arrival and departure times, whether checkout sends the room to housekeeping, and what happens when a guest leaves early or stays past checkout.">
    <PolicyCard title="Standard times">
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div>
          <label className={policyLabel}>Check-in hour (24h)</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.standardCheckInHour ?? 14).toString()} onChange={(e)=> { const hour = Math.max(0, Math.min(23, Number(e.target.value||'0'))); settingsStore.updateNestedSetting('roomManagement.standardCheckInHour', hour); settingsStore.updateNestedSetting('hotelSettings.checkInTime', hourStamp(hour, 14)); }} />
        </div>
        <div>
          <label className={policyLabel}>Check-out hour (24h)</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.standardCheckOutHour ?? 11).toString()} onChange={(e)=> { const hour = Math.max(0, Math.min(23, Number(e.target.value||'0'))); settingsStore.updateNestedSetting('roomManagement.standardCheckOutHour', hour); settingsStore.updateNestedSetting('hotelSettings.checkOutTime', hourStamp(hour, 11)); }} />
        </div>
      </div>
    </PolicyCard>

    <PolicyCard title="After checkout" on={settingsStore.roomManagement.markRoomDirtyOnCheckout !== false}>
      <PolicyRow label="Mark the room dirty" hint="On: checkout sends the room to housekeeping, and it cannot be sold until it is clean. Off: the room is free to sell as soon as the guest leaves. Turn this off when the facility has no housekeeping. A voided stay and a room move follow the same choice.">
        <Switch
          isSelected={settingsStore.roomManagement.markRoomDirtyOnCheckout !== false}
          onValueChange={(v) => settingsStore.updateNestedSetting('roomManagement.markRoomDirtyOnCheckout', v)}
        >
          {settingsStore.roomManagement.markRoomDirtyOnCheckout !== false ? 'On' : 'Off'}
        </Switch>
      </PolicyRow>
    </PolicyCard>

    <PolicyCard title="Late checkout" on={!!settingsStore.roomManagement.lateCheckoutFeeEnabled}>
      <PolicyRow label="Late checkout fee" hint="Charge a guest who stays past the grace period.">
        <Switch
          isSelected={!!settingsStore.roomManagement.lateCheckoutFeeEnabled}
          onValueChange={(v) => settingsStore.updateNestedSetting('roomManagement.lateCheckoutFeeEnabled', v)}
        >
          {settingsStore.roomManagement.lateCheckoutFeeEnabled ? 'Enabled' : 'Disabled'}
        </Switch>
      </PolicyRow>
      <RuleFields active={!!settingsStore.roomManagement.lateCheckoutFeeEnabled} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
        <div>
          <label className={policyLabel}>Grace minutes</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.lateCheckoutGraceMinutes ?? 0).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.lateCheckoutGraceMinutes', Math.max(0, parseInt(e.target.value||'0')))} />
        </div>
        <div>
          <label className={policyLabel}>Fee type</label>
          <select className={policyInput} value={settingsStore.roomManagement.lateCheckoutFeeType || 'flat'} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.lateCheckoutFeeType', e.target.value)}>
            <option value="flat">Flat amount (₵)</option>
            <option value="percent_of_nightly">% of nightly rate</option>
          </select>
        </div>
        <div>
          <label className={policyLabel}>Fee value</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.lateCheckoutFeeValue ?? 0).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.lateCheckoutFeeValue', Math.max(0, Number(e.target.value||'0')))} />
        </div>
      </RuleFields>
    </PolicyCard>

    <PolicyCard title="Early checkout" wide on={!!settingsStore.roomManagement.earlyCheckoutPolicyEnabled}>
      <PolicyRow label="Early checkout rule" hint="When on, a guest who leaves before the booked departure is billed by the rule below. Off: the bill is left as it is. Without Advanced, the guest pays only the nights stayed.">
        <Switch
          isSelected={!!settingsStore.roomManagement.earlyCheckoutPolicyEnabled}
          onValueChange={(v) => settingsStore.updateNestedSetting('roomManagement.earlyCheckoutPolicyEnabled', v)}
        >
          {settingsStore.roomManagement.earlyCheckoutPolicyEnabled ? 'On' : 'Off'}
        </Switch>
      </PolicyRow>
      <div className="max-w-xs pt-3">
        <label className={policyLabel}>Cutoff hour (24h)</label>
        <input type="number" className={policyInput} value={(settingsStore.roomManagement.earlyCheckoutCutoffHour ?? 11).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.earlyCheckoutCutoffHour', Math.max(0, Math.min(23, Number(e.target.value||'0'))))} />
      </div>
      <div className="pt-3 mt-3 border-t border-gray-200">
        <label className="flex items-center gap-2 text-sm text-ghana-black">
          <input type="checkbox" className="accent-ghana-green" checked={!!settingsStore.roomManagement.earlyCheckoutAdvancedEnabled} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.earlyCheckoutAdvancedEnabled', e.target.checked)} />
          Advanced refund and penalty
        </label>
        {settingsStore.roomManagement.earlyCheckoutAdvancedEnabled && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={policyLabel}>Refund or penalty</label>
              <select className={policyInput} value={settingsStore.roomManagement.earlyCheckoutRefundType || 'nightly_prorate'} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.earlyCheckoutRefundType', e.target.value)}>
                <option value="nightly_prorate">Pay only the nights stayed</option>
                <option value="none">No refund: charge the whole booking</option>
                <option value="percent_penalty">Nights stayed + % of the unused nights</option>
              </select>
            </div>
            <div>
              <label className={policyLabel}>Penalty % (of the unused nights)</label>
              <input type="number" className={policyInput} value={(settingsStore.roomManagement.earlyCheckoutPenaltyPercent ?? 0).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.earlyCheckoutPenaltyPercent', Math.max(0, Number(e.target.value||'0')))} />
            </div>
            <div>
              <label className={policyLabel}>Note</label>
              <input type="text" className={policyInput} placeholder="How early checkout is handled" value={settingsStore.roomManagement.earlyCheckoutNote || ''} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.earlyCheckoutNote', e.target.value)} />
            </div>
          </div>
        )}
      </div>
    </PolicyCard>
  </PolicyGroup>

  <PolicyGroup id="policy-company" title="Company accounts" description="Who can leave without paying immediately, and the terms written on a corporate invoice.">
    <PolicyCard title="Pay later and credit" wide>
      <PolicyRow label="Who can pay later" hint="Guests allowed to check out without immediate payment.">
        <select
          className={policyInput}
          value={settingsStore.roomManagement.payLaterPolicy || 'both'}
          onChange={(e) => settingsStore.updateNestedSetting('roomManagement.payLaterPolicy', e.target.value)}
        >
          <option value="both">Corporate and individual</option>
          <option value="corporate">Corporate only</option>
          <option value="individual">Individual only</option>
        </select>
      </PolicyRow>
      <PolicyRow label="Default credit terms" hint="Days given on a corporate invoice unless the account says otherwise.">
        <input
          type="number"
          className={policyInput}
          value={(settingsStore.roomManagement.defaultCreditTermsDays ?? 30).toString()}
          onChange={(e) => settingsStore.updateNestedSetting('roomManagement.defaultCreditTermsDays', Math.max(0, parseInt(e.target.value || '0')))}
        />
      </PolicyRow>
      <PolicyRow label="Corporate reference" hint="Purchase order, project, or cost center on a corporate pay-later stay.">
        <Switch
          isSelected={!!settingsStore.roomManagement.requireCorporateReference}
          onValueChange={(v) => settingsStore.updateNestedSetting('roomManagement.requireCorporateReference', v)}
        >
          {settingsStore.roomManagement.requireCorporateReference ? 'Required' : 'Optional'}
        </Switch>
      </PolicyRow>
    </PolicyCard>
  </PolicyGroup>

  <PolicyGroup id="policy-doubtful" title="Doubtful debts" description="How much of what customers owe is set aside as unlikely to be paid (IFRS 9). Used by Accounts Receivable → Doubtful debts.">
    <PolicyCard title="Allowance by age" wide>
      <p className="text-xs text-gray-500">Each open invoice falls in a band by days past its due date. Invoices not yet due count in the first band. The last band covers everything older.</p>
      <div className="space-y-2 pt-1">
        {badDebtRows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <div>
              <label className={policyLabel}>{i === badDebtRows.length - 1 ? 'Older than the bands above' : 'Up to days past due'}</label>
              {i === badDebtRows.length - 1 ? (
                <div className={`${policyInput} bg-gray-50 text-gray-500`}>Everything older</div>
              ) : (
                <input type="number" className={policyInput} value={row.upToDays ?? 0} onChange={(e) => setBadDebtRow(i, { upToDays: Math.max(0, Number(e.target.value || 0)) })} />
              )}
            </div>
            <div>
              <label className={policyLabel}>Allowance %</label>
              <input type="number" className={policyInput} value={row.percent} onChange={(e) => setBadDebtRow(i, { percent: Math.max(0, Math.min(100, Number(e.target.value || 0))) })} />
            </div>
            {i < badDebtRows.length - 1 && badDebtRows.length > 2 ? (
              <Button size="sm" variant="light" color="danger" onPress={() => saveBadDebtRows(badDebtRows.filter((_, j) => j !== i))}>Remove</Button>
            ) : <span className="w-[68px]" />}
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="flat" isDisabled={badDebtRows.length >= 8} onPress={() => {
            const bounded = badDebtRows.slice(0, -1);
            const lastDays = bounded.length ? Number(bounded[bounded.length - 1].upToDays || 0) : 0;
            saveBadDebtRows([...bounded, { upToDays: lastDays + 30, percent: 0 }, badDebtRows[badDebtRows.length - 1]]);
          }}>+ Add band</Button>
          <Button size="sm" variant="light" onPress={() => saveBadDebtRows(DEFAULT_BAD_DEBT_BANDS)}>Use the defaults</Button>
        </div>
      </div>
    </PolicyCard>
  </PolicyGroup>

  <PolicyGroup id="policy-booking" title="Booking changes" description="What the hotel charges when a guest does not arrive, cancels late, or must put down a deposit.">
    <PolicyCard title="No-show" on={!!settingsStore.roomManagement.noShowPolicyEnabled}>
      <PolicyRow label="No-show charge" hint="Applied when the guest has not arrived by the cutoff.">
        <Switch isSelected={!!settingsStore.roomManagement.noShowPolicyEnabled} onValueChange={(v)=> settingsStore.updateNestedSetting('roomManagement.noShowPolicyEnabled', v)}>
          {settingsStore.roomManagement.noShowPolicyEnabled ? 'Enabled' : 'Disabled'}
        </Switch>
      </PolicyRow>
      <RuleFields active={!!settingsStore.roomManagement.noShowPolicyEnabled} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
        <div>
          <label className={policyLabel}>Charge type</label>
          <select className={policyInput} value={settingsStore.roomManagement.noShowChargeType || 'first_night'} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.noShowChargeType', e.target.value)}>
            <option value="first_night">First night</option>
            <option value="percent_reservation">% of reservation</option>
            <option value="flat">Flat amount</option>
            <option value="keep_deposit">Keep the whole deposit</option>
          </select>
        </div>
        <div>
          <label className={policyLabel}>{valueLabel(settingsStore.roomManagement.noShowChargeType)}</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.noShowChargeValue ?? 0).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.noShowChargeValue', Math.max(0, Number(e.target.value||'0')))} />
        </div>
        <div>
          <label className={policyLabel}>Cutoff hour (24h)</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.noShowCutoffHour ?? 23).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.noShowCutoffHour', Math.max(0, Math.min(23, Number(e.target.value||'0'))))} />
        </div>
      </RuleFields>
    </PolicyCard>

    <PolicyCard title="Cancellation" on={!!settingsStore.roomManagement.cancellationPolicyEnabled}>
      <PolicyRow label="Cancellation fee" hint="Free until the hours-before-arrival window closes, then the late fee applies.">
        <Switch isSelected={!!settingsStore.roomManagement.cancellationPolicyEnabled} onValueChange={(v)=> settingsStore.updateNestedSetting('roomManagement.cancellationPolicyEnabled', v)}>
          {settingsStore.roomManagement.cancellationPolicyEnabled ? 'Enabled' : 'Disabled'}
        </Switch>
      </PolicyRow>
      <RuleFields active={!!settingsStore.roomManagement.cancellationPolicyEnabled} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
        <div>
          <label className={policyLabel}>Free window (hours before arrival)</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.freeCancellationHours ?? 24).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.freeCancellationHours', Math.max(0, Number(e.target.value||'0')))} />
        </div>
        <div>
          <label className={policyLabel}>Late fee type</label>
          <select className={policyInput} value={settingsStore.roomManagement.lateCancellationFeeType || 'first_night'} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.lateCancellationFeeType', e.target.value)}>
            <option value="first_night">First night</option>
            <option value="percent_reservation">% of reservation</option>
            <option value="flat">Flat amount</option>
            <option value="keep_deposit">Keep the whole deposit</option>
          </select>
        </div>
        <div>
          <label className={policyLabel}>{valueLabel(settingsStore.roomManagement.lateCancellationFeeType)}</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.lateCancellationFeeValue ?? 0).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.lateCancellationFeeValue', Math.max(0, Number(e.target.value||'0')))} />
        </div>
      </RuleFields>
    </PolicyCard>

    <PolicyCard title="Fees and deposits" wide>
      <p className="text-xs text-gray-500">
        A no-show or late cancellation fee is taken from the guest's deposit first. Whatever is left of the deposit
        shows as a refund due on the booking until staff pay it back; nothing is refunded automatically.
      </p>
      <PolicyRow label="Taxes on these fees" hint="VAT, NHIL, GETFund and Tourism Levy on no-show and cancellation fees.">
        <Switch isSelected={settingsStore.roomManagement.bookingFeesTaxable !== false} onValueChange={(v)=> settingsStore.updateNestedSetting('roomManagement.bookingFeesTaxable', v)}>
          {settingsStore.roomManagement.bookingFeesTaxable !== false ? 'Charged' : 'Not charged'}
        </Switch>
      </PolicyRow>
      <PolicyRow label="Fee bigger than the deposit" hint="Bill the guest for the rest (a guaranteed card is charged for a no-show), or only ever keep what was paid.">
        <Switch isSelected={!!settingsStore.roomManagement.bookingFeesDepositOnly} onValueChange={(v)=> settingsStore.updateNestedSetting('roomManagement.bookingFeesDepositOnly', v)}>
          {settingsStore.roomManagement.bookingFeesDepositOnly ? 'Only keep the deposit' : 'Bill the rest'}
        </Switch>
      </PolicyRow>
    </PolicyCard>

    <PolicyCard title="Deposit" wide on={!!settingsStore.roomManagement.depositPolicyEnabled}>
      <PolicyRow label="Require a deposit" hint="How much is collected to hold the reservation.">
        <Switch isSelected={!!settingsStore.roomManagement.depositPolicyEnabled} onValueChange={(v)=> settingsStore.updateNestedSetting('roomManagement.depositPolicyEnabled', v)}>
          {settingsStore.roomManagement.depositPolicyEnabled ? 'Enabled' : 'Disabled'}
        </Switch>
      </PolicyRow>
      <RuleFields active={!!settingsStore.roomManagement.depositPolicyEnabled} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
        <div>
          <label className={policyLabel}>Deposit type</label>
          <select className={policyInput} value={settingsStore.roomManagement.depositType || 'percent'} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.depositType', e.target.value)}>
            <option value="percent">% of reservation</option>
            <option value="flat">Flat amount</option>
          </select>
        </div>
        <div>
          <label className={policyLabel}>Deposit value</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.depositValue ?? 0).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.depositValue', Math.max(0, Number(e.target.value||'0')))} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-ghana-black">
            <input type="checkbox" className="accent-ghana-green" checked={!!settingsStore.roomManagement.requireDepositToConfirm} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.requireDepositToConfirm', e.target.checked)} />
            Required to confirm
          </label>
        </div>
      </RuleFields>
    </PolicyCard>
  </PolicyGroup>

  <PolicyGroup id="policy-audit" title="Night audit and billing" description="When room charges post, and how invoice totals are rounded.">
    <PolicyCard title="Room charges">
      <PolicyRow label="Post the first night at check-in" hint="The folio shows the first night right away. Night audit will not post that night a second time.">
        <Switch
          isSelected={!!settingsStore.roomManagement.postFirstNightAtCheckin}
          onValueChange={(v) => settingsStore.updateNestedSetting('roomManagement.postFirstNightAtCheckin', v)}
        >
          {settingsStore.roomManagement.postFirstNightAtCheckin ? 'On' : 'Off'}
        </Switch>
      </PolicyRow>
      <PolicyRow label="Run night audit at 1:00am" hint="Runs while the app is open. A failure notifies the Night Manager role.">
        <Switch
          isSelected={settingsStore.roomManagement.nightAuditAutoRun !== false}
          onValueChange={(v) => settingsStore.updateNestedSetting('roomManagement.nightAuditAutoRun', v)}
        >
          {settingsStore.roomManagement.nightAuditAutoRun !== false ? 'On' : 'Off'}
        </Switch>
      </PolicyRow>
    </PolicyCard>

    <PolicyCard title="Rounding">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={policyLabel}>Line and tax rounding</label>
          <select
            className={policyInput}
            value={settingsStore.financialSettings.roundingRule || 'nearest'}
            onChange={(e) => settingsStore.updateNestedSetting('financialSettings.roundingRule', e.target.value)}
          >
            <option value="nearest">Nearest pesewa</option>
            <option value="up">Round up</option>
            <option value="down">Round down</option>
          </select>
        </div>
        <div>
          <label className={policyLabel}>Round the amount due to</label>
          <div className="mt-1 flex gap-2">
            <select
              className="h-10 flex-1 rounded-lg border border-default-300 bg-transparent px-3 text-sm focus:border-ghana-green focus:outline-none focus:ring-2 focus:ring-ghana-green/20"
              value={(() => {
                const presets: Array<[string, number]> = [['0', 0], ['0.01', 0.01], ['0.05', 0.05], ['0.10', 0.1], ['0.50', 0.5], ['1.00', 1]];
                const current = Number(settingsStore.financialSettings.roundToNearest ?? 0.5);
                const match = presets.find(([, amount]) => Math.abs(amount - current) < 0.0001);
                return match ? match[0] : 'custom';
              })()}
              onChange={(e) => {
                if (e.target.value === 'custom') return;
                settingsStore.updateNestedSetting('financialSettings.roundToNearest', Number(e.target.value));
              }}
            >
              <option value="0">Off (exact pesewa)</option>
              <option value="0.01">₵0.01</option>
              <option value="0.05">₵0.05</option>
              <option value="0.10">₵0.10</option>
              <option value="0.50">₵0.50</option>
              <option value="1.00">₵1.00</option>
              <option value="custom">Custom…</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              className="h-10 w-24 rounded-lg border border-default-300 bg-transparent px-3 text-sm focus:border-ghana-green focus:outline-none focus:ring-2 focus:ring-ghana-green/20"
              value={settingsStore.financialSettings.roundToNearest ?? 0.5}
              onChange={(e) => settingsStore.updateNestedSetting('financialSettings.roundToNearest', Math.max(0, Number(e.target.value || '0')))}
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Line rounding applies to taxes and line items on invoices, folios, and POS. Rounding the amount due nudges the total to a cash figure, and the difference posts as a Rounding Adjustment (GL 4900) at checkout. The same values are used in Setup.
      </p>
    </PolicyCard>
  </PolicyGroup>

  <PolicyGroup id="policy-currencies" title="Currencies" description="Add a currency and switch it on while you are taking it. Switch it off to take cedis again. A bank account and a cash account are opened for each currency you add.">
    <CurrenciesPolicy />
  </PolicyGroup>

  <PolicyGroup id="policy-payments" title="Phone and card payments" description="Cash and mobile money stay on the desk. A payments service can be connected later so the guest approves on their phone and the amount posts to the folio.">
    <PolicyCard title="Ghana payments service" wide>
      <PolicyRow label="Service" hint="Saved for later. Staff still record card and mobile money by hand.">
        <select
          className={policyInput}
          value={settingsStore.financialSettings.guestCollection?.service ?? 'none'}
          onChange={(e) => settingsStore.updateNestedSetting('financialSettings.guestCollection.service', normalizeGuestPaymentService(e.target.value))}
        >
          <option value="none">Not connected</option>
          <option value="hubtel">Hubtel</option>
          <option value="paystack">Paystack</option>
        </select>
      </PolicyRow>
    </PolicyCard>
  </PolicyGroup>

  <PolicyGroup id="policy-year" title="Accounting year" description="The day the books open each year. Reports, quarters, and filings due after the year ends follow it.">
    <PolicyCard title="Opening day" wide>
      <CompanyYearPanel bare />
    </PolicyCard>
  </PolicyGroup>
</div>
  );
}
