'use client';

import React, { useEffect, useState } from 'react';
import { Button, Input, Switch } from '@heroui/react';
import { useSettingsStore } from '../../lib/settings/store';
import { pinLengthError } from '../../lib/auth/posPin';
import { managerPinIsSet, saveManagerPin as saveManagerPinOnServer } from '../../lib/settings/managerPin';
import PosWaiterSwitchSetting from './PosWaiterSwitchSetting';

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, Math.trunc(n)));
    onCommit(next);
    setDraft(String(next));
  };

  return (
    <Input
      type="number"
      size="sm"
      label={label}
      value={draft}
      min={min}
      max={max}
      isDisabled={disabled}
      onValueChange={setDraft}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="max-w-[140px]"
    />
  );
}

function ToggleTile({
  title,
  hint,
  selected,
  disabled,
  onChange,
}: {
  title: string;
  hint: string;
  selected: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      role="group"
      aria-label={title}
      onClick={() => { if (!disabled) onChange(!selected); }}
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${selected ? 'border-ghana-green bg-green-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
    >
      <span>
        <span className="block text-sm font-semibold text-ghana-black">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      </span>
      <Switch
        size="sm"
        isSelected={selected}
        isDisabled={disabled}
        onValueChange={onChange}
        onClick={(e) => e.stopPropagation()}
        aria-label={title}
      />
    </div>
  );
}

function passwordSummary(policy: {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expiryDays: number;
}): string {
  const needs = [
    policy.requireUppercase ? 'an uppercase letter' : '',
    policy.requireLowercase ? 'a lowercase letter' : '',
    policy.requireNumbers ? 'a number' : '',
    policy.requireSpecialChars ? 'a special character' : '',
  ].filter(Boolean);
  const listed = needs.length < 2
    ? needs.join('')
    : `${needs.slice(0, -1).join(', ')} and ${needs[needs.length - 1]}`;
  const complexity = needs.length ? `, including ${listed}` : '';
  const expiry = policy.expiryDays > 0 ? ` Staff change it every ${policy.expiryDays} days.` : ' Passwords do not expire.';
  return `A password needs at least ${policy.minLength} characters${complexity}.${expiry}`;
}

export default function SecurityPolicyPanel({
  onOpenSetup,
  onOpenTax,
}: {
  onOpenSetup: () => void;
  onOpenTax: () => void;
}) {
  const security = useSettingsStore((s) => s.security);
  // The manager PIN is kept hashed on the server for the whole hotel.
  const [pinIsSet, setPinIsSet] = React.useState<boolean | null>(null);
  React.useEffect(() => { void managerPinIsSet().then(setPinIsSet); }, []);
  const updateNestedSetting = useSettingsStore((s) => s.updateNestedSetting);
  const canManage2fa = useSettingsStore((s) => s.hasPermission('settings.manage-2fa'));
  const canManage = useSettingsStore((s) => s.hasPermission('settings.manage-security-policy'));
  const policy = security.passwordPolicy;
  const pin = security.pinPolicy;

  const [nextPin, setNextPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const setPinLength = (key: 'minLength' | 'maxLength', value: number) => {
    const minLength = key === 'minLength' ? value : pin.minLength;
    const maxLength = key === 'maxLength' ? value : pin.maxLength;
    updateNestedSetting('security.pinPolicy.minLength', Math.min(minLength, maxLength));
    updateNestedSetting('security.pinPolicy.maxLength', Math.max(minLength, maxLength));
  };

  const saveManagerPin = async () => {
    const error = pinLengthError(nextPin, pin);
    if (error) {
      setPinMessage({ tone: 'error', text: error });
      return;
    }
    if (nextPin !== confirmPin) {
      setPinMessage({ tone: 'error', text: 'The two PINs do not match.' });
      return;
    }
    const saved = await saveManagerPinOnServer(nextPin);
    if (!saved.ok) {
      setPinMessage({ tone: 'error', text: saved.error || 'The PIN could not be saved. Try again.' });
      return;
    }
    setNextPin('');
    setConfirmPin('');
    setPinIsSet(true);
    setPinMessage({ tone: 'ok', text: 'Manager PIN saved for the whole hotel. Every POS uses it before an order is deleted.' });
  };

  return (
    <div className="mt-3 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3">
        <p className="text-sm font-semibold text-ghana-black">Staff sign-in rules</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Password, session, and PIN rules apply to every staff account. Company name, country, and currency are in{' '}
          <Button size="sm" variant="light" className="inline h-auto min-h-0 p-0 align-baseline text-xs text-ghana-green" onPress={onOpenSetup}>
            System Setup
          </Button>
          . Tax rates are in{' '}
          <Button size="sm" variant="light" className="inline h-auto min-h-0 p-0 align-baseline text-xs text-ghana-green" onPress={onOpenTax}>
            Compliance → Tax rules
          </Button>
          .
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-ghana-black">Sign-in</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <ToggleTile
            title="Two-factor authentication"
            hint="Every staff member enters a code from an authenticator app."
            selected={security.twoFactorAuth}
            disabled={!canManage2fa}
            onChange={(v) => updateNestedSetting('security.twoFactorAuth', v)}
          />
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-ghana-black">Session timeout</p>
              <p className="mt-0.5 text-xs text-slate-500">Minutes with no activity before sign-out. 0 keeps the session open.</p>
            </div>
            <NumberField
              label="Minutes"
              value={security.sessionTimeout}
              min={0}
              max={24 * 60}
              disabled={!canManage}
              onCommit={(n) => updateNestedSetting('security.sessionTimeout', n)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-ghana-black">Password</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          <NumberField
            label="Minimum length"
            value={policy.minLength}
            min={1}
            max={128}
            disabled={!canManage}
            onCommit={(n) => updateNestedSetting('security.passwordPolicy.minLength', n)}
          />
          <NumberField
            label="Expires after (days)"
            value={policy.expiryDays}
            min={0}
            max={3650}
            disabled={!canManage}
            onCommit={(n) => updateNestedSetting('security.passwordPolicy.expiryDays', n)}
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ToggleTile title="Uppercase letter" hint="At least one A–Z." selected={policy.requireUppercase} disabled={!canManage} onChange={(v) => updateNestedSetting('security.passwordPolicy.requireUppercase', v)} />
          <ToggleTile title="Lowercase letter" hint="At least one a–z." selected={policy.requireLowercase} disabled={!canManage} onChange={(v) => updateNestedSetting('security.passwordPolicy.requireLowercase', v)} />
          <ToggleTile title="Number" hint="At least one digit." selected={policy.requireNumbers} disabled={!canManage} onChange={(v) => updateNestedSetting('security.passwordPolicy.requireNumbers', v)} />
          <ToggleTile title="Special character" hint="At least one symbol, such as ! or @." selected={policy.requireSpecialChars} disabled={!canManage} onChange={(v) => updateNestedSetting('security.passwordPolicy.requireSpecialChars', v)} />
        </div>
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">{passwordSummary(policy)}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-ghana-black">PIN</h3>
        <p className="mt-1 text-xs text-slate-500">
          Staff PINs are digits. Each person&apos;s PIN is set under Users → Edit. The manager PIN is what the POS asks before an order is deleted.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <NumberField label="Shortest PIN" value={pin.minLength} min={4} max={8} disabled={!canManage} onCommit={(n) => setPinLength('minLength', n)} />
          <NumberField label="Longest PIN" value={pin.maxLength} min={4} max={8} disabled={!canManage} onCommit={(n) => setPinLength('maxLength', n)} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {pin.minLength === pin.maxLength ? `Every PIN is ${pin.minLength} digits.` : `A PIN is ${pin.minLength} to ${pin.maxLength} digits.`}
          {pinIsSet === false ? ' The manager PIN is still the starter 1234.' : pinIsSet ? ' A manager PIN is set for the hotel.' : ''}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Input
            size="sm"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            label="New manager PIN"
            value={nextPin}
            isDisabled={!canManage}
            onValueChange={(v) => setNextPin(v.replace(/\D/g, '').slice(0, pin.maxLength))}
            className="w-40"
          />
          <Input
            size="sm"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            label="Confirm PIN"
            value={confirmPin}
            isDisabled={!canManage}
            onValueChange={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, pin.maxLength))}
            className="w-40"
          />
          <Button size="sm" className="bg-ghana-green text-white" isDisabled={!canManage || !nextPin} onPress={saveManagerPin}>
            Save manager PIN
          </Button>
        </div>
        {pinMessage && (
          <p className={`mt-2 text-xs ${pinMessage.tone === 'ok' ? 'text-green-700' : 'text-red-600'}`} role="status">{pinMessage.text}</p>
        )}
        <div className="mt-4 space-y-2">
          <PosWaiterSwitchSetting isDisabled={!canManage} />
        </div>
      </section>
    </div>
  );
}
