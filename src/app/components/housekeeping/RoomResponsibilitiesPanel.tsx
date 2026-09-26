'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Textarea,
} from '@heroui/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import type { DepartmentStaffMember } from '../../lib/hr/useDepartmentStaff';
import {
  RESPONSIBILITY_SHIFTS,
  findShiftRoomConflicts,
  formatRoomList,
  parseRoomListInput,
  type ResponsibilityShift,
  type RoomResponsibility,
} from '../../lib/housekeeping/roomResponsibilities';
import { frontOfficeStore } from '../../lib/frontoffice/store';

function hkHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

const emptyForm = {
  id: '',
  label: '',
  staffId: '',
  shift: 'morning' as ResponsibilityShift,
  roomsText: '',
  notes: '',
};

/**
 * Who is responsible for which rooms on which shift.
 * Reassign or clear anytime (resignations, coverage swaps) — not locked forever.
 */
export default function RoomResponsibilitiesPanel({ staff }: { staff: DepartmentStaffMember[] }) {
  const [rows, setRows] = useState<RoomResponsibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [shiftFilter, setShiftFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/housekeeping/room-responsibilities?active=1', {
        headers: hkHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Could not load responsibilities');
      const data = await res.json();
      setRows(data.responsibilities || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hotelRooms = useMemo(() => {
    try {
      return (frontOfficeStore.rooms || []) as Array<{ roomNumber: string }>;
    } catch {
      return [] as Array<{ roomNumber: string }>;
    }
  }, []);

  const filtered = useMemo(() => {
    if (shiftFilter === 'all') return rows;
    return rows.filter((r) => r.shift === shiftFilter);
  }, [rows, shiftFilter]);

  const parsedRooms = useMemo(() => parseRoomListInput(form.roomsText), [form.roomsText]);
  const conflicts = useMemo(
    () => findShiftRoomConflicts(rows, form.shift, parsedRooms, form.id || undefined),
    [rows, form.shift, parsedRooms, form.id]
  );

  const openCreate = () => {
    setForm({
      ...emptyForm,
      staffId: staff[0]?.id || '',
    });
    setModalOpen(true);
  };

  const openEdit = (r: RoomResponsibility) => {
    setForm({
      id: r.id,
      label: r.label || '',
      staffId: r.staffId,
      shift: (r.shift as ResponsibilityShift) || 'morning',
      roomsText: (r.rooms || []).join(', '),
      notes: r.notes || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    const member = staff.find((s) => s.id === form.staffId);
    if (!member) {
      setError('Pick a staff member');
      return;
    }
    if (parsedRooms.length === 0) {
      setError('Enter at least one room (e.g. 1-10 or 101,102)');
      return;
    }
    if (conflicts.length > 0) {
      setError(
        `Overlap on ${form.shift}: ${conflicts
          .slice(0, 3)
          .map((c) => `${c.room} → ${c.staffName}`)
          .join('; ')}. Clear or edit that row first, or pick another shift.`
      );
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/housekeeping/room-responsibilities', {
        method: 'POST',
        headers: hkHeaders(),
        body: JSON.stringify({
          id: form.id || undefined,
          label: form.label || undefined,
          staffId: member.id,
          staffName: member.name,
          shift: form.shift,
          rooms: parsedRooms,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Save failed');
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const clearResponsibility = async (id: string) => {
    if (!confirm('Clear this responsibility? You can assign someone else afterward.')) return;
    setError('');
    try {
      const res = await fetch(`/api/housekeeping/room-responsibilities?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: hkHeaders(),
      });
      if (!res.ok) throw new Error('Could not clear');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Clear failed');
    }
  };

  const shiftLabel = (key: string) => RESPONSIBILITY_SHIFTS.find((s) => s.key === key)?.label || key;

  const fillRangeHint = () => {
    if (hotelRooms.length === 0) return;
    const nums = hotelRooms
      .map((r) => r.roomNumber)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (nums.length) setForm((f) => ({ ...f, roomsText: f.roomsText || `${nums[0]}-${nums[nums.length - 1]}` }));
  };

  return (
    <div className="pt-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-500 max-w-2xl">
          Set who is <span className="font-medium text-slate-700">responsible for</span> which rooms on
          each shift — so you know who to call. Reassign or clear anytime when someone resigns or
          coverage changes. Same rooms can have different people on different shifts.
        </p>
        <div className="flex gap-2 shrink-0">
          <Select
            aria-label="Filter by shift"
            size="sm"
            className="w-40"
            selectedKeys={[shiftFilter]}
            onSelectionChange={(keys) => setShiftFilter((Array.from(keys)[0] as string) || 'all')}
          >
            <SelectItem key="all">All shifts</SelectItem>
            {RESPONSIBILITY_SHIFTS.map((s) => (
              <SelectItem key={s.key}>{s.label}</SelectItem>
            ))}
          </Select>
          <Button size="sm" color="primary" onPress={openCreate} isDisabled={staff.length === 0}>
            Assign rooms
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {staff.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          No Housekeeping staff in HR yet — add them under Staff List / HR first, then assign rooms here.
        </p>
      )}

      <Table aria-label="Room responsibilities">
        <TableHeader>
          <TableColumn>RESPONSIBLE</TableColumn>
          <TableColumn>SHIFT</TableColumn>
          <TableColumn>ROOMS</TableColumn>
          <TableColumn>LABEL</TableColumn>
          <TableColumn>ACTIONS</TableColumn>
        </TableHeader>
        <TableBody emptyContent={loading ? 'Loading…' : 'No room responsibilities yet. Assign who covers which rooms.'}>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <p className="font-medium text-ghana-black">{r.staffName}</p>
              </TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color="primary">
                  {shiftLabel(r.shift)}
                </Chip>
              </TableCell>
              <TableCell>
                <span className="text-sm">{formatRoomList(r.rooms || [])}</span>
                <span className="text-xs text-slate-400 ml-1">({(r.rooms || []).length})</span>
              </TableCell>
              <TableCell>{r.label || '—'}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" variant="flat" onPress={() => openEdit(r)}>
                    Reassign
                  </Button>
                  <Button size="sm" variant="light" color="danger" onPress={() => clearResponsibility(r.id)}>
                    Clear
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} size="lg">
        <ModalContent>
          <ModalHeader>{form.id ? 'Reassign room responsibility' : 'Who is responsible for these rooms?'}</ModalHeader>
          <ModalBody className="gap-3">
            <Select
              label="Staff member"
              selectedKeys={form.staffId ? [form.staffId] : []}
              onSelectionChange={(keys) => {
                const id = Array.from(keys)[0] as string;
                if (id) setForm((f) => ({ ...f, staffId: id }));
              }}
              isRequired
            >
              {staff.map((s) => (
                <SelectItem key={s.id}>{s.name}</SelectItem>
              ))}
            </Select>
            <Select
              label="Shift"
              selectedKeys={[form.shift]}
              onSelectionChange={(keys) => {
                const v = Array.from(keys)[0] as ResponsibilityShift;
                if (v) setForm((f) => ({ ...f, shift: v }));
              }}
              isRequired
            >
              {RESPONSIBILITY_SHIFTS.map((s) => (
                <SelectItem key={s.key} textValue={s.label}>
                  {s.label} <span className="text-slate-400 text-xs">({s.hint})</span>
                </SelectItem>
              ))}
            </Select>
            <div>
              <Input
                label="Rooms"
                placeholder="e.g. 1-10 or 101, 102, 105-108"
                value={form.roomsText}
                onChange={(e) => setForm((f) => ({ ...f, roomsText: e.target.value }))}
                description={
                  parsedRooms.length
                    ? `${parsedRooms.length} room${parsedRooms.length === 1 ? '' : 's'}: ${formatRoomList(parsedRooms, 8)}`
                    : 'Type a range or list. Same rooms OK on a different shift.'
                }
                isRequired
              />
              {hotelRooms.length > 0 && (
                <Button size="sm" variant="light" className="mt-1" onPress={fillRangeHint}>
                  Suggest full hotel range
                </Button>
              )}
            </div>
            {conflicts.length > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                Already covered on this shift:{' '}
                {conflicts.slice(0, 5).map((c) => `${c.room} (${c.staffName})`).join(', ')}
                {conflicts.length > 5 ? ` +${conflicts.length - 5}` : ''}. Edit that row or change shift.
              </p>
            )}
            <Input
              label="Label (optional)"
              placeholder="e.g. Wing A, Floor 2"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
            <Textarea
              label="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              minRows={2}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={save} isLoading={saving}>
              {form.id ? 'Save changes' : 'Assign'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
