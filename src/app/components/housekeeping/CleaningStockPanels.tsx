'use client';

import React, { useEffect, useState } from 'react';
import { Button, Card, CardBody, Input, Select, SelectItem } from '@heroui/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import { housekeepingStore } from '../../lib/housekeeping/store';
import type { CleaningKits, KitLine } from '../../lib/housekeeping/cleaningKits';
import { emptyRoomKit } from '../../lib/housekeeping/cleaningKits';
import { useSettingsStore } from '../../lib/settings/store';

function hkHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

type CatalogItem = { id: string; name: string; unit: string };

function KitLines({
  title,
  hint,
  lines,
  items,
  disabled,
  onChange,
}: {
  title: string;
  hint: string;
  lines: KitLine[];
  items: CatalogItem[];
  disabled: boolean;
  onChange: (lines: KitLine[]) => void;
}) {
  const add = () => {
    const first = items.find((item) => !lines.some((line) => line.itemId === item.id));
    if (!first) return;
    onChange([...lines, { itemId: first.id, quantity: 1 }]);
  };
  return (
    <div className="space-y-2">
      <div>
        <h4 className="font-medium text-ghana-black">{title}</h4>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>
      {lines.length === 0 && <p className="text-sm text-gray-500">No items in this kit.</p>}
      {lines.map((line, index) => (
        <div key={`${line.itemId}-${index}`} className="grid grid-cols-[1fr,88px,auto] gap-2 items-center">
          <Select
            aria-label="Supply"
            size="sm"
            selectedKeys={line.itemId ? [line.itemId] : []}
            isDisabled={disabled}
            onSelectionChange={(keys) => {
              const itemId = String(Array.from(keys)[0] || '');
              if (!itemId) return;
              onChange(lines.map((row, i) => (i === index ? { ...row, itemId } : row)));
            }}
          >
            {items.map((item) => (
              <SelectItem key={item.id}>{item.name}</SelectItem>
            ))}
          </Select>
          <Input
            aria-label="Quantity"
            type="number"
            size="sm"
            min={1}
            value={String(line.quantity)}
            isDisabled={disabled}
            onChange={(e) => {
              const quantity = Math.max(1, Math.floor(Number(e.target.value) || 1));
              onChange(lines.map((row, i) => (i === index ? { ...row, quantity } : row)));
            }}
          />
          <Button size="sm" variant="light" isDisabled={disabled} onPress={() => onChange(lines.filter((_, i) => i !== index))}>
            Remove
          </Button>
        </div>
      ))}
      <Button size="sm" variant="flat" isDisabled={disabled || items.length === 0} onPress={add}>
        Add item
      </Button>
    </div>
  );
}

export function CleaningKitsPanel() {
  const roomTypes = useSettingsStore((s) => s.roomManagement.roomTypes);
  const canEdit = useSettingsStore((s) => s.hasPermission('housekeeping.manage-supplies'));
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [kits, setKits] = useState<CleaningKits>({});
  const [roomTypeId, setRoomTypeId] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/housekeeping/cleaning-kits', { headers: hkHeaders() })
      .then((r) => (r.ok ? r.json() : { kits: {}, items: [] }))
      .then((data) => {
        setKits(data.kits || {});
        setItems(data.items || []);
      })
      .catch(() => setError('Could not load room kits.'));
  }, []);

  useEffect(() => {
    if (!roomTypeId && roomTypes[0]?.id) setRoomTypeId(roomTypes[0].id);
  }, [roomTypeId, roomTypes]);

  const kit = kits[roomTypeId] || emptyRoomKit();
  const setKit = (next: { turnover?: KitLine[]; stayover?: KitLine[] }) => {
    setSaved(false);
    setKits((current) => ({
      ...current,
      [roomTypeId]: { ...emptyRoomKit(), ...current[roomTypeId], ...next },
    }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/housekeeping/cleaning-kits', {
        method: 'PUT',
        headers: hkHeaders(),
        body: JSON.stringify({ kits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save the kits.');
        return;
      }
      setKits(data.kits || kits);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border border-gray-200 shadow-none">
      <CardBody className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-ghana-black">Room kits</h3>
          <p className="text-sm text-gray-600">
            A checkout takes the turnover kit. A room that still has a guest takes the stayover kit. The attendant does not type these quantities.
          </p>
        </div>
        {roomTypes.length === 0 ? (
          <p className="text-sm text-gray-500">Add a room type before setting a kit.</p>
        ) : (
          <>
            <Select
              label="Room type"
              selectedKeys={roomTypeId ? [roomTypeId] : []}
              onSelectionChange={(keys) => setRoomTypeId(String(Array.from(keys)[0] || ''))}
              className="max-w-xs"
            >
              {roomTypes.map((type) => (
                <SelectItem key={type.id}>{type.name}</SelectItem>
              ))}
            </Select>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <KitLines
                title="Turnover"
                hint="After a guest checks out."
                lines={kit.turnover}
                items={items}
                disabled={!canEdit}
                onChange={(turnover) => setKit({ turnover })}
              />
              <KitLines
                title="Stayover"
                hint="While the guest is still in the room."
                lines={kit.stayover}
                items={items}
                disabled={!canEdit}
                onChange={(stayover) => setKit({ stayover })}
              />
            </div>
          </>
        )}
        {items.length === 0 && <p className="text-sm text-gray-500">No inventory items yet. Add them in Stores first.</p>}
        {!canEdit && <p className="text-sm text-gray-500">A supervisor sets the kits. You can read them here.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && <p className="text-sm text-success">Kits saved.</p>}
        {canEdit && (
          <div className="flex justify-end">
            <Button color="primary" onPress={save} isLoading={saving}>Save kits</Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

type TaskStockRow = {
  id: string;
  roomNumber?: string;
  details?: {
    suppliesUsed?: { itemId: string; itemName: string; quantity: number }[];
    kitReturned?: boolean;
    extraReturned?: boolean;
    extraRequest?: { status?: string; items?: { itemId: string; itemName: string; quantity: number }[] };
  };
};

export function ExtraSupplyRequestsPanel() {
  const canReview = useSettingsStore((s) => s.hasPermission('housekeeping.manage-supplies'));
  const [rows, setRows] = useState<{ id: string; roomNumber: string; items: { itemName: string; quantity: number }[] }[]>([]);
  const [kits, setKits] = useState<{ id: string; roomNumber: string; items: { itemName: string; quantity: number }[] }[]>([]);
  const [extras, setExtras] = useState<{ id: string; roomNumber: string; items: { itemName: string; quantity: number }[] }[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = () => {
    fetch('/api/housekeeping/tasks', { headers: hkHeaders() })
      .then((r) => (r.ok ? r.json() : { tasks: [] }))
      .then((data) => {
        const tasks = (data.tasks || []) as TaskStockRow[];
        setRows(tasks.flatMap((task) => {
          const request = task.details?.extraRequest;
          if (!request || request.status !== 'pending') return [];
          return [{ id: task.id, roomNumber: task.roomNumber || '', items: request.items || [] }];
        }));
        setKits(tasks.flatMap((task) => {
          const items = (task.details?.suppliesUsed || []).filter((line) => line.quantity > 0);
          if (task.details?.kitReturned || items.length === 0) return [];
          return [{ id: task.id, roomNumber: task.roomNumber || '', items }];
        }));
        setExtras(tasks.flatMap((task) => {
          const request = task.details?.extraRequest;
          if (task.details?.extraReturned || !request || request.status !== 'approved') return [];
          return [{ id: task.id, roomNumber: task.roomNumber || '', items: request.items || [] }];
        }));
      })
      .catch(() => {
        setRows([]);
        setKits([]);
        setExtras([]);
      });
  };

  useEffect(() => { load(); }, []);

  const sendBack = async (id: string, part: 'kit' | 'extra') => {
    setBusyId(`${part}:${id}`);
    setError('');
    try {
      const res = await fetch(`/api/housekeeping/tasks/${encodeURIComponent(id)}/return`, {
        method: 'POST',
        headers: hkHeaders(),
        body: JSON.stringify({ part }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not return the stock.');
        return;
      }
      await housekeepingStore.hydrateFromApi();
      load();
    } finally {
      setBusyId('');
    }
  };

  const review = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/housekeeping/tasks/${encodeURIComponent(id)}/extra`, {
        method: 'POST',
        headers: hkHeaders(),
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not update the request.');
        return;
      }
      await housekeepingStore.hydrateFromApi();
      load();
    } finally {
      setBusyId('');
    }
  };

  return (
    <Card className="border border-gray-200 shadow-none">
      <CardBody className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-ghana-black">Extra supplies</h3>
          <p className="text-sm text-gray-600">
            Anything above the room kit waits here. Stock moves only when a supervisor approves it.
          </p>
        </div>
        {rows.length === 0 && <p className="text-sm text-gray-500">No extra requests waiting.</p>}
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border rounded-lg px-3 py-2">
            <div>
              <p className="font-medium">Room {row.roomNumber}</p>
              <p className="text-sm text-gray-600">{row.items.map((item) => `${item.itemName} × ${item.quantity}`).join(', ')}</p>
            </div>
            {canReview && (
              <div className="flex gap-2">
                <Button size="sm" color="success" variant="flat" isLoading={busyId === row.id} onPress={() => review(row.id, 'approve')}>Approve</Button>
                <Button size="sm" color="danger" variant="flat" isDisabled={busyId === row.id} onPress={() => review(row.id, 'reject')}>Reject</Button>
              </div>
            )}
          </div>
        ))}
        {!canReview && rows.length > 0 && <p className="text-sm text-gray-500">A supervisor has to approve these before stock moves.</p>}
        <div className="pt-2">
          <h3 className="text-lg font-semibold text-ghana-black">Return stock</h3>
          <p className="text-sm text-gray-600">
            Return puts back the exact lines that left. Returning a kit also cancels a request that is still waiting. An extra you already approved stays out until you return that too.
          </p>
        </div>
        {kits.length === 0 && extras.length === 0 && <p className="text-sm text-gray-500">Nothing to return.</p>}
        {kits.map((row) => (
          <div key={`kit-${row.id}`} className="flex flex-wrap items-center justify-between gap-3 border rounded-lg px-3 py-2">
            <div>
              <p className="font-medium">Room {row.roomNumber} kit</p>
              <p className="text-sm text-gray-600">{row.items.map((item) => `${item.itemName} × ${item.quantity}`).join(', ')}</p>
            </div>
            {canReview && (
              <Button size="sm" variant="flat" isLoading={busyId === `kit:${row.id}`} onPress={() => sendBack(row.id, 'kit')}>Return kit</Button>
            )}
          </div>
        ))}
        {extras.map((row) => (
          <div key={`extra-${row.id}`} className="flex flex-wrap items-center justify-between gap-3 border rounded-lg px-3 py-2">
            <div>
              <p className="font-medium">Room {row.roomNumber} extra</p>
              <p className="text-sm text-gray-600">{row.items.map((item) => `${item.itemName} × ${item.quantity}`).join(', ')}</p>
            </div>
            {canReview && (
              <Button size="sm" variant="flat" isLoading={busyId === `extra:${row.id}`} onPress={() => sendBack(row.id, 'extra')}>Return extra</Button>
            )}
          </div>
        ))}
        {error && <p className="text-sm text-danger">{error}</p>}
      </CardBody>
    </Card>
  );
}
