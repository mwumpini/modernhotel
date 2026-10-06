'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Switch } from '@heroui/react';
import { useSettingsStore } from '../../lib/settings/store';
import { normalizeGuestPaymentService } from '../../lib/payments/guestCollection';
import { hourStamp } from '../../lib/frontoffice/operationalPolicies';

const policyInput = 'mt-1 w-full h-9 rounded-lg border border-gray-300 px-3 text-sm';
const policyLabel = 'text-xs font-medium text-gray-500';

function PolicyGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-ghana-black">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function PolicyCard({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Card className={`border-0 shadow-md ${wide ? 'xl:col-span-2' : ''}`}>
      <CardHeader className="pb-1">
        <h4 className="text-sm font-semibold text-ghana-black">{title}</h4>
      </CardHeader>
      <CardBody className="pt-0">{children}</CardBody>
    </Card>
  );
}

function PolicyRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 border-b border-gray-200 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-[10rem] flex-1 sm:pr-4">
        <div className="text-sm font-medium text-ghana-black">{label}</div>
        {hint ? <p className="text-xs text-gray-500 mt-0.5">{hint}</p> : null}
      </div>
      <div className="w-full shrink-0 sm:w-64">{children}</div>
    </div>
  );
}

export default function OperationalPoliciesPanel() {
  const settingsStore = useSettingsStore();
  const roleId = settingsStore.sessionRoleId ?? settingsStore.currentUser?.roleId;
  const canAllowBackdating = roleId === 'admin' || roleId === 'manager';
  return (
<div className="space-y-8">
  <p className="text-sm text-gray-500">Front desk rules for arrival, departure, booking changes, company accounts, night audit, and whether a posting can use an earlier date. Each change saves immediately.</p>
  <PolicyGroup title="Posting dates" description="Payments, charges, journals, bills, goods received, and stock movements. Guest details, bookings, and report ranges stay free.">
    <PolicyCard title="Backdating" wide>
      <PolicyRow
        label="Allow backdating"
        hint={canAllowBackdating
          ? 'Off: a new posting uses today or a later date. On: those same forms accept an earlier date. Turn it off again after the correction.'
          : 'Only an admin or a manager can change this. While it is off, a new posting cannot be dated before today.'}
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
  <PolicyGroup title="Check-in and checkout" description="Standard arrival and departure times, and what happens when a guest leaves early or stays past checkout.">
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

    <PolicyCard title="Late checkout">
      <PolicyRow label="Late checkout fee" hint="Charge a guest who stays past the grace period.">
        <Switch
          isSelected={!!settingsStore.roomManagement.lateCheckoutFeeEnabled}
          onValueChange={(v) => settingsStore.updateNestedSetting('roomManagement.lateCheckoutFeeEnabled', v)}
        >
          {settingsStore.roomManagement.lateCheckoutFeeEnabled ? 'Enabled' : 'Disabled'}
        </Switch>
      </PolicyRow>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
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
      </div>
    </PolicyCard>

    <PolicyCard title="Early checkout" wide>
      <PolicyRow label="Remove unused nights" hint="When on, unused nights come off the folio if the guest leaves before the scheduled departure. No extra charge is added.">
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
                <option value="nightly_prorate">Prorate unused nights</option>
                <option value="none">No refund (charge remaining)</option>
                <option value="percent_penalty">% penalty on remaining</option>
              </select>
            </div>
            <div>
              <label className={policyLabel}>Penalty %</label>
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

  <PolicyGroup title="Company accounts" description="Who can leave without paying immediately, and the terms written on a corporate invoice.">
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

  <PolicyGroup title="Booking changes" description="What the hotel charges when a guest does not arrive, cancels late, or must put down a deposit.">
    <PolicyCard title="No-show">
      <PolicyRow label="No-show charge" hint="Applied when the guest has not arrived by the cutoff.">
        <Switch isSelected={!!settingsStore.roomManagement.noShowPolicyEnabled} onValueChange={(v)=> settingsStore.updateNestedSetting('roomManagement.noShowPolicyEnabled', v)}>
          {settingsStore.roomManagement.noShowPolicyEnabled ? 'Enabled' : 'Disabled'}
        </Switch>
      </PolicyRow>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
        <div>
          <label className={policyLabel}>Charge type</label>
          <select className={policyInput} value={settingsStore.roomManagement.noShowChargeType || 'first_night'} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.noShowChargeType', e.target.value)}>
            <option value="first_night">First night</option>
            <option value="percent_reservation">% of reservation</option>
            <option value="flat">Flat amount</option>
          </select>
        </div>
        <div>
          <label className={policyLabel}>Charge value</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.noShowChargeValue ?? 0).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.noShowChargeValue', Math.max(0, Number(e.target.value||'0')))} />
        </div>
        <div>
          <label className={policyLabel}>Cutoff hour (24h)</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.noShowCutoffHour ?? 23).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.noShowCutoffHour', Math.max(0, Math.min(23, Number(e.target.value||'0'))))} />
        </div>
      </div>
    </PolicyCard>

    <PolicyCard title="Cancellation">
      <PolicyRow label="Cancellation fee" hint="Free until the hours-before-arrival window closes, then the late fee applies.">
        <Switch isSelected={!!settingsStore.roomManagement.cancellationPolicyEnabled} onValueChange={(v)=> settingsStore.updateNestedSetting('roomManagement.cancellationPolicyEnabled', v)}>
          {settingsStore.roomManagement.cancellationPolicyEnabled ? 'Enabled' : 'Disabled'}
        </Switch>
      </PolicyRow>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
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
          </select>
        </div>
        <div>
          <label className={policyLabel}>Late fee value</label>
          <input type="number" className={policyInput} value={(settingsStore.roomManagement.lateCancellationFeeValue ?? 0).toString()} onChange={(e)=> settingsStore.updateNestedSetting('roomManagement.lateCancellationFeeValue', Math.max(0, Number(e.target.value||'0')))} />
        </div>
      </div>
    </PolicyCard>

    <PolicyCard title="Deposit" wide>
      <PolicyRow label="Require a deposit" hint="How much is collected to hold the reservation.">
        <Switch isSelected={!!settingsStore.roomManagement.depositPolicyEnabled} onValueChange={(v)=> settingsStore.updateNestedSetting('roomManagement.depositPolicyEnabled', v)}>
          {settingsStore.roomManagement.depositPolicyEnabled ? 'Enabled' : 'Disabled'}
        </Switch>
      </PolicyRow>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
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
      </div>
    </PolicyCard>
  </PolicyGroup>

  <PolicyGroup title="Night audit and billing" description="When room charges post, and how invoice totals are rounded.">
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
              className="h-9 flex-1 rounded-lg border border-gray-300 px-3 text-sm"
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
              className="h-9 w-24 rounded-lg border border-gray-300 px-3 text-sm"
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

  <PolicyGroup title="Phone and card payments" description="Cash and mobile money stay on the desk. A payments service can be connected later so the guest approves on their phone and the amount posts to the folio.">
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
</div>
  );
}
