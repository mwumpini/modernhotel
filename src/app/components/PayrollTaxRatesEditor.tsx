'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Button, Input, Tooltip } from '@heroui/react';
import { useComplianceStore } from '@/app/lib/compliance/store';
import type { TaxRule } from '@/app/lib/models';
import { getClientTenantSubdomain } from '@/app/lib/api/clientTenant';
import { normalizeTenantSubdomain } from '@/app/lib/api/tenantSubdomain';

/**
 * Dedicated, simplified editor for Ghana's payroll tax rules (PAYE, Tier 1, Tier 2,
 * Tier 3) — same underlying rules/store/API as the generic Tax Rate Builder (Settings →
 * Compliance & Reports → Tax Management), just without its domain/centre filters,
 * horizontally-scrolled table, and sales-tax-shaped fields that don't apply to payroll.
 * Every rule here is visible and editable in place, no navigation required.
 */

type TierTag = 'PAYE' | 'TIER1' | 'TIER2' | 'TIER3_RELIEF_CAP';

function findRule(taxRules: TaxRule[], tag: TierTag): TaxRule | undefined {
  return taxRules.find(
    (r) => r.countryCode === 'GH' && r.domain === 'payroll' && (r.appliesTo || []).includes(tag)
  );
}

async function saveRule(patch: Partial<TaxRule> & { id: string }) {
  const sub = normalizeTenantSubdomain(getClientTenantSubdomain());
  const res = await fetch('/api/compliance/taxes/manage', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-tenant-subdomain': sub, 'x-tenant-id': sub },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save');
  }
  const saved: TaxRule = await res.json();
  // Patch the one changed rule directly into the shared store instead of a full
  // setCountry() refresh — every other screen (payslips, payroll records, preview tables)
  // reads the same store so still picks this up immediately, but a full refresh also
  // re-triggers every other mounted component's own effects on this store (e.g. the
  // generic Tax Rate Builder tab, which stays mounted alongside this one under the same
  // Tabs component) — unnecessary here, and was found to amplify a pre-existing race in
  // that tab's auto-template-apply effect into repeated duplicate rule creation.
  useComplianceStore.setState((s) => ({
    taxRules: s.taxRules.map((r) => (r.id === saved.id ? saved : r)),
  }));
}

function NameEditor({ rule, onSaved }: { rule: TaxRule; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(rule.name);
  const [busy, setBusy] = useState(false);
  const committingRef = React.useRef(false);

  // Deliberately no "sync value from rule.name when editing flips false" effect here — that
  // pattern raced: the parent's re-render carrying the freshly-saved `rule` prop isn't
  // guaranteed to land before this component's own re-render from `setEditing(false)`, so
  // the effect could fire against the STALE pre-save `rule.name` and silently revert the
  // just-saved value in the UI (the server-side save itself was fine — only the displayed
  // value flipped back). Each transition below sets `value` explicitly instead.

  const startEditing = () => { setValue(rule.name); setEditing(true); };

  const commit = async () => {
    // Both Enter (onKeyDown) and losing focus (onBlur) can fire in the same interaction —
    // pressing Enter often blurs the input as part of its own default handling, which
    // would otherwise call commit() a second time concurrently. Guard so only the first
    // call actually runs.
    if (committingRef.current) return;
    const trimmed = value.trim();
    if (!trimmed || trimmed === rule.name) { setEditing(false); return; }
    committingRef.current = true;
    setBusy(true);
    try {
      await saveRule({ ...rule, name: trimmed });
      onSaved();
      setEditing(false);
      // value already holds `trimmed`, the value just confirmed saved — leave it as-is
      // rather than deriving it from `rule.name`, which may not have re-rendered in yet.
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Rename failed');
      setValue(rule.name);
    } finally {
      committingRef.current = false;
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <Input
        autoFocus
        size="sm"
        value={value}
        isDisabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Call commit() directly rather than trying to trigger it via .blur() — HeroUI's
          // Input wraps the native element, and e.target here isn't reliably the actual
          // focused node, so a programmatic blur() call can silently do nothing. The
          // committingRef guard above covers the case where this AND a genuine onBlur both
          // fire for the same interaction.
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setValue(rule.name); setEditing(false); }
        }}
        variant="bordered"
        className="max-w-xs"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="group flex items-center gap-2 text-left"
      title="Click to rename"
    >
      <h5 className="font-semibold text-base">{rule.name}</h5>
      <span className="opacity-0 group-hover:opacity-60 text-xs">✏️ rename</span>
    </button>
  );
}

function NumberField({
  label, value, onChange, tooltip, suffix = '%',
}: {
  label: string; value: number; onChange: (v: number) => void; tooltip?: string; suffix?: string;
}) {
  const field = (
    <Input
      type="number"
      step="0.01"
      size="sm"
      label={label}
      value={String(value)}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      variant="bordered"
      endContent={<span className="text-xs text-gray-400">{suffix}</span>}
    />
  );
  if (!tooltip) return field;
  return (
    <Tooltip content={tooltip}>
      <div>{field}</div>
    </Tooltip>
  );
}

function TierCard({ rule, onSaved, kind }: { rule: TaxRule; onSaved: () => void; kind: 'contribution' | 'reliefCap' }) {
  const [rate, setRate] = useState(rule.rate);
  const [employerRate, setEmployerRate] = useState(rule.employerRate ?? 0);
  const [ceiling, setCeiling] = useState(rule.ceiling ?? 0);
  const [floor, setFloor] = useState(rule.floor ?? 0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRate(rule.rate); setEmployerRate(rule.employerRate ?? 0);
    setCeiling(rule.ceiling ?? 0); setFloor(rule.floor ?? 0);
    setDirty(false);
  }, [rule.rate, rule.employerRate, rule.ceiling, rule.floor]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      await saveRule({
        ...rule,
        rate,
        ...(kind === 'contribution' ? { employerRate, ceiling, floor } : {}),
      });
      setDirty(false);
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border border-gray-200">
      <CardHeader className="flex items-center justify-between pb-2">
        <NameEditor rule={rule} onSaved={onSaved} />
      </CardHeader>
      <CardBody className="space-y-3">
        {kind === 'contribution' ? (
          <>
            <NumberField label="Employee Rate" value={rate} onChange={markDirty(setRate)} tooltip="% of basic salary deducted from the employee." />
            <NumberField label="Employer Rate" value={employerRate} onChange={markDirty(setEmployerRate)} tooltip="% of basic salary the employer contributes on top — not deducted from the employee." />
            <NumberField label="Ceiling" value={ceiling} onChange={markDirty(setCeiling)} suffix="GHS" tooltip="Maximum basic salary this rate applies to." />
            <NumberField label="Floor" value={floor} onChange={markDirty(setFloor)} suffix="GHS" tooltip="Minimum insurable earnings — an employee paid below this still contributes as if they earned it." />
          </>
        ) : (
          <NumberField label="Relief Cap" value={rate} onChange={markDirty(setRate)} tooltip="Tax-relief ceiling as % of basic salary. Tier 3 itself is a voluntary, employee-elected contribution — set per employee, not here." />
        )}
        <Button size="sm" color="primary" isDisabled={!dirty} isLoading={saving} onPress={save} className="w-full">
          {dirty ? 'Save Changes' : 'Saved'}
        </Button>
      </CardBody>
    </Card>
  );
}

function PayeCard({ rule, onSaved }: { rule: TaxRule; onSaved: () => void }) {
  const [tiers, setTiers] = useState(rule.tiers || []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setTiers(rule.tiers || []); setDirty(false); }, [rule.tiers]);

  const updateTier = (idx: number, field: 'upto' | 'rate', value: number | undefined) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
    setDirty(true);
  };
  const removeTier = (idx: number) => {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };
  const addTier = () => {
    // New band inserted before the open-ended last one, so the last row always stays
    // the one with no width — i.e. always the top, uncapped band.
    setTiers((prev) => {
      const next = [...prev];
      next.splice(Math.max(next.length - 1, 0), 0, { upto: 0, rate: 0 });
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveRule({ ...rule, tiers });
      setDirty(false);
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border border-gray-200">
      <CardHeader className="flex items-center justify-between pb-2">
        <NameEditor rule={rule} onSaved={onSaved} />
      </CardHeader>
      <CardBody>
        <div className="text-xs text-gray-500 mb-3">
          Progressive monthly bands. Each row taxes the next slice of income at its rate; the last row (no width) applies to everything above the bands before it — it&apos;s intentionally open-ended.
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-gray-500 px-1">
            <span>Width (GHS)</span>
            <span>Rate %</span>
            <span></span>
          </div>
          {tiers.map((t, idx) => {
            const isLast = idx === tiers.length - 1;
            return (
              <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                {isLast ? (
                  <div className="text-xs text-gray-400 italic px-2">everything above</div>
                ) : (
                  <Input
                    type="number" size="sm" variant="bordered"
                    value={String(t.upto ?? '')}
                    onChange={(e) => updateTier(idx, 'upto', parseFloat(e.target.value) || 0)}
                  />
                )}
                <Input
                  type="number" size="sm" variant="bordered"
                  value={String(t.rate ?? '')}
                  onChange={(e) => updateTier(idx, 'rate', parseFloat(e.target.value) || 0)}
                  endContent={<span className="text-xs text-gray-400">%</span>}
                />
                <Button size="sm" variant="flat" color="danger" isIconOnly onPress={() => removeTier(idx)}>✕</Button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="flat" onPress={addTier}>+ Add Band</Button>
          <Button size="sm" color="primary" isDisabled={!dirty} isLoading={saving} onPress={save} className="flex-1">
            {dirty ? 'Save Changes' : 'Saved'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default function PayrollTaxRatesEditor() {
  const taxRules = useComplianceStore((s) => s.taxRules);
  const [, forceRefresh] = useState(0);
  const bump = () => forceRefresh((n) => n + 1);

  const payeRule = findRule(taxRules, 'PAYE');
  const tier1Rule = findRule(taxRules, 'TIER1');
  const tier2Rule = findRule(taxRules, 'TIER2');
  const tier3Rule = findRule(taxRules, 'TIER3_RELIEF_CAP');

  if (!payeRule && !tier1Rule && !tier2Rule && !tier3Rule) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-gray-500">
            No payroll tax rules are loaded yet for Ghana. Visit Settings → Compliance & Reports once to load the
            defaults, then come back here.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold">Payroll Tax Rates</h4>
        <p className="text-xs text-gray-500">
          Rename or adjust any rate below — changes apply to every future payroll run immediately, and to payslips,
          payroll records, and reports across the app. This edits the exact same rules as Settings → Compliance &amp;
          Reports → Tax rules, just without the sales-tax-oriented filters.
        </p>
      </div>
      {payeRule && <PayeCard rule={payeRule} onSaved={bump} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tier1Rule && <TierCard rule={tier1Rule} onSaved={bump} kind="contribution" />}
        {tier2Rule && <TierCard rule={tier2Rule} onSaved={bump} kind="contribution" />}
        {tier3Rule && <TierCard rule={tier3Rule} onSaved={bump} kind="reliefCap" />}
      </div>
    </div>
  );
}
