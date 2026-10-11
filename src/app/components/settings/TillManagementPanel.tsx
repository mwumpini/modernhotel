'use client';

import React from 'react';
import { Button, Input } from '@heroui/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import { CASH_TILL_ID, type TillType } from '../../lib/frontoffice/tillTypes';
import { useSettingsStore } from '../../lib/settings/store';

function headers() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

function nextTillName(rows: TillType[]) {
  const highest = rows.reduce((max, row) => {
    const match = /^till\s+(\d+)$/i.exec(row.name.trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 1);
  return `Till ${highest + 1}`;
}

function blankTill(rows: TillType[]): TillType {
  return {
    id: `till-${Date.now().toString(36)}`,
    name: nextTillName(rows),
    kind: 'momo',
    active: true,
    spend: true,
    threshold: null,
  };
}

export default function TillManagementPanel() {
  const canEdit = useSettingsStore((s) => {
    const roleId = s.sessionRoleId ?? s.currentUser?.roleId;
    return roleId === 'admin' || roleId === 'manager' || s.hasPermission('settings.*') || s.hasPermission('*');
  });
  const [tills, setTills] = React.useState<TillType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    let cancel = false;
    fetch('/api/frontoffice/till-types', { headers: headers() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancel && Array.isArray(data?.tills)) setTills(data.tills);
      })
      .catch(() => { if (!cancel) setError('Could not load the tills.'); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  const patch = (id: string, next: Partial<TillType>) => {
    setSaved(false);
    setTills((rows) => rows.map((row) => (row.id === id ? { ...row, ...next } : row)));
  };

  const save = async () => {
    if (tills.some((row) => !row.name.trim())) {
      setError('Name each till.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/frontoffice/till-types', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ tills }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Could not save the tills.');
      } else if (Array.isArray(data?.tills)) {
        setTills(data.tills);
        setSaved(true);
      }
    } catch {
      setError('Could not save the tills.');
    }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl space-y-4 py-2">
      <div>
        <h3 className="text-base font-semibold text-ghana-black">Front office till management</h3>
        <p className="text-sm text-gray-500">
          Cash stays first. Name the other tills yourself. In use tills are opened and closed together. Can spend is separate for each till, including cash, so one till can pay expenses and another cannot. If none can spend, petty expenses stay hidden. Threshold is the most one expense can take.
        </p>
      </div>
      {loading ? <p className="text-sm text-gray-500">Loading tills…</p> : (
        <div className="space-y-3">
          {tills.map((till) => (
            <div key={till.id} className="grid grid-cols-1 gap-3 rounded-lg border border-default-200 bg-white p-3 md:grid-cols-4">
              <Input
                label="Till"
                size="sm"
                value={till.name}
                isDisabled={!canEdit || till.id === CASH_TILL_ID}
                onValueChange={(name) => patch(till.id, { name })}
              />
              <Input
                label="Type"
                size="sm"
                value={till.kind === 'cash' ? 'Cash drawer' : 'MoMo'}
                isReadOnly
              />
              <Input
                label="Threshold (GH₵)"
                size="sm"
                type="number"
                min={0}
                step="0.01"
                placeholder="No limit"
                value={till.threshold == null ? '' : String(till.threshold)}
                isDisabled={!canEdit}
                onValueChange={(value) => patch(till.id, { threshold: value === '' ? null : Number(value) })}
              />
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {till.id !== CASH_TILL_ID && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={till.active}
                      disabled={!canEdit}
                      onChange={(e) => patch(till.id, { active: e.target.checked })}
                    />
                    In use
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={till.spend}
                    disabled={!canEdit}
                    onChange={(e) => patch(till.id, { spend: e.target.checked })}
                  />
                  Can spend
                </label>
                {till.id !== CASH_TILL_ID && canEdit && (
                  <button
                    type="button"
                    className="text-danger"
                    onClick={() => { setSaved(false); setTills((rows) => rows.filter((row) => row.id !== till.id)); }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-success">Saved. The next till that opens uses this list.</p>}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="flat" onPress={() => { setSaved(false); setTills((rows) => [...rows, blankTill(rows)]); }}>Add till</Button>
          <Button color="primary" isLoading={saving} onPress={() => { void save(); }}>Save tills</Button>
        </div>
      )}
    </div>
  );
}
