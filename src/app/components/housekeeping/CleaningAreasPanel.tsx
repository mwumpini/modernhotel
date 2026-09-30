'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
} from '@heroui/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import type { CleaningArea } from '../../lib/housekeeping/cleaningAreas';
import { sizedTableClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, SortHeader, toggleColumnSort, DESK_PAGE_SIZE, type ColumnSort } from '../dashboard/deskTableUi';

function hkHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

const emptyForm = { id: '', name: '', sortOrder: 0, notes: '', isActive: true };

/**
 * Configure hotel cleaning locations (lobby, corridors, F&B outlets, …).
 * New Task → Public / other area reads this list.
 */
export default function CleaningAreasPanel() {
  const [areas, setAreas] = useState<CleaningArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showInactive, setShowInactive] = useState(false);
  const [sort, setSort] = useState<ColumnSort>({ column: 'sort', direction: 'asc' });
  const [page, setPage] = useState(1);
  const cols = useResizableColumns({
    sort: 72,
    name: 220,
    status: 100,
    notes: 200,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/housekeeping/cleaning-areas?active=${showInactive ? '0' : '1'}`, {
        headers: hkHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load cleaning areas');
      const data = await res.json();
      setAreas(data.areas || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setAreas([]);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...areas].sort((a, b) => {
      switch (sort.column) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'status':
          return (Number(a.isActive) - Number(b.isActive)) * dir;
        case 'notes':
          return String(a.notes || '').localeCompare(String(b.notes || '')) * dir;
        case 'sort':
        default:
          return (a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)) * dir;
      }
    });
  }, [areas, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / DESK_PAGE_SIZE));
  const pageSafe = Math.min(page, pages);
  const paged = sorted.slice((pageSafe - 1) * DESK_PAGE_SIZE, pageSafe * DESK_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [showInactive, areas.length]);

  const openCreate = () => {
    setForm({
      ...emptyForm,
      sortOrder: areas.reduce((m, a) => Math.max(m, a.sortOrder), -1) + 1,
    });
    setModalOpen(true);
  };

  const openEdit = (area: CleaningArea) => {
    setForm({
      id: area.id,
      name: area.name,
      sortOrder: area.sortOrder,
      notes: area.notes || '',
      isActive: area.isActive,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/housekeeping/cleaning-areas', {
        method: 'POST',
        headers: hkHeaders(),
        body: JSON.stringify({
          id: form.id || undefined,
          name: form.name.trim(),
          sortOrder: form.sortOrder,
          notes: form.notes.trim() || null,
          isActive: form.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: string) => {
    setError('');
    try {
      const res = await fetch(`/api/housekeeping/cleaning-areas?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: hkHeaders(),
      });
      if (!res.ok) throw new Error('Could not deactivate');
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Deactivate failed');
    }
  };

  return (
    <div className="space-y-3">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-ghana-black shrink-0">Cleaning areas</h3>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="flat" className="min-h-10" onPress={() => setShowInactive((v) => !v)}>
            {showInactive ? 'Hide inactive' : 'Show inactive'}
          </Button>
          <Button size="sm" color="primary" className="min-h-10 bg-ghana-green text-white" onPress={openCreate}>
            + Add area
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Card className={deskTableCardClassName}>
        <CardBody className={deskTableCardBodyClassName}>
          <div ref={cols.frameRef} style={cols.frameStyle}>
            <Table
              aria-label="Cleaning areas"
              removeWrapper
              classNames={sizedTableClassNames(deskTableClassNames)}
            >
              <TableHeader>
                <TableColumn className="relative" style={cols.style('sort')}>
                  {<SortHeader label="#" column="sort" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}
                  {cols.sizer('sort', '#')}
                </TableColumn>
                <TableColumn className="relative" style={cols.style('name')}>
                  {<SortHeader label="Area" column="name" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}
                  {cols.sizer('name', 'Area')}
                </TableColumn>
                <TableColumn className="relative" style={cols.style('status')}>
                  {<SortHeader label="Status" column="status" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}
                  {cols.sizer('status', 'Status')}
                </TableColumn>
                <TableColumn className="relative" style={cols.style('notes')}>
                  {<SortHeader label="Notes" column="notes" sort={sort} onSort={(c) => setSort((p) => toggleColumnSort(p, c))} />}
                  {cols.sizer('notes', 'Notes')}
                </TableColumn>
              </TableHeader>
              <TableBody emptyContent={loading ? 'Loading…' : 'No cleaning areas yet — add one.'}>
                {paged.map((area) => (
                  <TableRow
                    key={area.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openEdit(area)}
                  >
                    <TableCell className="tabular-nums text-gray-500">{area.sortOrder}</TableCell>
                    <TableCell>
                      <span className="font-medium text-ghana-black">{area.name}</span>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={area.isActive ? 'success' : 'default'}>
                        {area.isActive ? 'Active' : 'Inactive'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="truncate block text-sm text-gray-600" title={area.notes || ''}>
                        {area.notes || '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={pageSafe} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} size="md" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{form.id ? 'Edit cleaning area' : 'Add cleaning area'}</ModalHeader>
          <ModalBody className="gap-3">
            <Input
              label="Name"
              size="sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Banquet foyer"
              isRequired
            />
            <Input
              label="Sort order"
              size="sm"
              type="number"
              value={String(form.sortOrder)}
              onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
              description="Lower numbers appear first in the New Task dropdown."
            />
            <Textarea
              label="Notes"
              size="sm"
              minRows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional — wing, building, schedule hint"
            />
            {form.id && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active (show in New Task)
              </label>
            )}
          </ModalBody>
          <ModalFooter className="justify-between">
            <div>
              {form.id && form.isActive && (
                <Button size="sm" color="danger" variant="flat" onPress={() => void deactivate(form.id)}>
                  Deactivate
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="flat" onPress={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button color="primary" isLoading={saving} onPress={save}>
                Save
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
