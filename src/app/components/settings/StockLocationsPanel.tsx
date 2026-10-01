'use client';

import React, { useCallback, useEffect, useState } from 'react';
import HeadingInfo from '../HeadingInfo';
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import { useSettingsStore } from '../../lib/settings/store';

type StockLocationRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  department: string | null;
  isActive: boolean;
};

const LOCATION_TYPES = [
  { key: 'central', label: 'Central store' },
  { key: 'cold', label: 'Cold / fridge' },
  { key: 'dry', label: 'Dry store' },
  { key: 'outlet', label: 'Outlet store' },
  { key: 'department', label: 'Department floor' },
] as const;

const DEPARTMENTS = [
  { key: '', label: 'Shared (all areas)' },
  { key: 'restaurant', label: 'Restaurant & Bar' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'housekeeping', label: 'Housekeeping' },
] as const;

function headers() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

function typeLabel(type: string) {
  return LOCATION_TYPES.find((entry) => entry.key === type)?.label || type;
}

function departmentLabel(department: string | null) {
  if (!department) return 'Shared';
  return DEPARTMENTS.find((entry) => entry.key === department)?.label || department;
}

const emptyForm = {
  id: '',
  code: '',
  name: '',
  type: 'central',
  department: '',
  isActive: true,
};

/**
 * Hotel-owned stock places (Main Store, Fridge 1, Restaurant & Bar, …).
 * Seeded with defaults; rename/add/deactivate here. Stores, Kitchen, Restaurant,
 * and Housekeeping all read from this list.
 */
export default function StockLocationsPanel() {
  const canManage = useSettingsStore(
    (s) => s.hasPermission('settings.manage-stock-locations') || s.hasPermission('settings.*') || s.hasPermission('*'),
  );
  const [locations, setLocations] = useState<StockLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetch('/api/inventory/stock-locations', { headers: headers() })
      .then((r) => (r.ok ? r.json() : { locations: [] }))
      .then((data) => setLocations(data.locations || []))
      .catch(() => setLocations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, id: `loc-${Date.now()}` });
    setFormOpen(true);
  };

  const openEdit = (row: StockLocationRow) => {
    setEditingId(row.id);
    setForm({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type || 'central',
      department: row.department || '',
      isActive: row.isActive,
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!canManage || !form.name.trim()) return;
    setSaving(true);
    const code =
      form.code.trim() ||
      form.name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 24);
    const res = await fetch('/api/inventory/stock-locations', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        id: form.id,
        code,
        name: form.name.trim(),
        type: form.type,
        department: form.department || null,
        isActive: form.isActive,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Could not save location');
      return;
    }
    setFormOpen(false);
    reload();
  };

  const toggleActive = async (row: StockLocationRow) => {
    if (!canManage) return;
    if (row.isActive) {
      const res = await fetch(`/api/inventory/stock-locations?id=${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!res.ok) {
        alert('Could not deactivate location');
        return;
      }
    } else {
      const res = await fetch('/api/inventory/stock-locations', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          id: row.id,
          code: row.code,
          name: row.name,
          type: row.type,
          department: row.department,
          isActive: true,
        }),
      });
      if (!res.ok) {
        alert('Could not reactivate location');
        return;
      }
    }
    reload();
  };

  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-lg font-semibold">Stock Locations</h3>
            <HeadingInfo label="About stock locations">
              Shared list for Stores, Kitchen, Restaurant &amp; Bar, and Housekeeping. Defaults are seeded for each hotel — rename them, add Fridge 2 or Warehouse 1, and deactivate places you do not use.
            </HeadingInfo>
          </div>
          <p className="mt-0.5 text-xs text-gray-600">
            Stock counts, transfers, and item home location pick from this list.
          </p>
        </div>
        <Button
          size="sm"
          color="primary"
          className="bg-ghana-green text-white"
          onPress={openCreate}
          isDisabled={!canManage}
        >
          + Add Location
        </Button>
      </div>

      <Table
        aria-label="Stock locations"
        removeWrapper
        classNames={{
          base: 'overflow-x-auto',
          table: '!min-w-[48rem] !w-max !table-auto',
        }}
      >
        <TableHeader>
          <TableColumn>Code</TableColumn>
          <TableColumn>Name</TableColumn>
          <TableColumn>Type</TableColumn>
          <TableColumn>Department</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Actions</TableColumn>
        </TableHeader>
        <TableBody emptyContent={loading ? 'Loading…' : 'No locations yet.'}>
          {locations.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-sm">{row.code}</TableCell>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>{typeLabel(row.type)}</TableCell>
              <TableCell>{departmentLabel(row.department)}</TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={row.isActive ? 'success' : 'default'}>
                  {row.isActive ? 'Active' : 'Inactive'}
                </Chip>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="flat" onPress={() => openEdit(row)} isDisabled={!canManage}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    color={row.isActive ? 'warning' : 'success'}
                    onPress={() => toggleActive(row)}
                    isDisabled={!canManage}
                  >
                    {row.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} size="lg">
        <ModalContent>
          <ModalHeader>{editingId ? 'Edit location' : 'Add location'}</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Name"
                placeholder="e.g. Fridge 3"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                isRequired
                className="sm:col-span-2"
              />
              <Input
                label="Code"
                placeholder="Auto from name if blank"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                description="Unique per hotel"
                classNames={{ input: 'font-mono' }}
              />
              <Select
                label="Type"
                selectedKeys={[form.type]}
                onSelectionChange={(keys) => setForm({ ...form, type: (Array.from(keys)[0] as string) || 'central' })}
              >
                {LOCATION_TYPES.map((entry) => (
                  <SelectItem key={entry.key}>{entry.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Department"
                selectedKeys={[form.department || '']}
                onSelectionChange={(keys) => setForm({ ...form, department: (Array.from(keys)[0] as string) || '' })}
                description="Shared locations are available hotel-wide"
                className="sm:col-span-2"
              >
                {DEPARTMENTS.map((entry) => (
                  <SelectItem key={entry.key}>{entry.label}</SelectItem>
                ))}
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              onPress={save}
              isLoading={saving}
              isDisabled={!form.name.trim()}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
