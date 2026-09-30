'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
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
  Select,
  SelectItem,
  Tooltip,
} from '@heroui/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';
import type { CleaningArea } from '../../lib/housekeeping/cleaningAreas';
import { AREA_ROOM_TYPE_ID } from '../../lib/housekeeping/cleaningAreas';
import { housekeepingStore } from '../../lib/housekeeping/store';
import { trackEvent } from '../../lib/analytics/trackEvent';

function hkHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

type SpaceStatus = 'clean' | 'dirty' | 'in-progress' | 'inspected' | 'maintenance';

function statusIcon(status: string) {
  switch (status) {
    case 'dirty': return '🟡';
    case 'in-progress': return '🔄';
    case 'inspected': return '🟣';
    case 'maintenance': return '🟠';
    case 'clean':
    default: return '🟢';
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'dirty': return 'warning';
    case 'in-progress': return 'primary';
    case 'inspected': return 'secondary';
    case 'maintenance': return 'danger';
    case 'clean':
    default: return 'success';
  }
}

function statusLabel(status: string) {
  if (status === 'in-progress') return 'In progress';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Floor → Public spaces: compact status cards (same density as Rooms),
 * sourced from Work → Cleaning areas setup.
 */
export default function PublicSpacesStatusGrid() {
  const [areas, setAreas] = useState<CleaningArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<CleaningArea | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<SpaceStatus>('clean');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/housekeeping/cleaning-areas?active=1', {
        headers: hkHeaders(),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({ areas: [] }));
      setAreas(data.areas || []);
    } catch {
      setAreas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return areas.filter((a) => {
      if (statusFilter !== 'all' && (a.status || 'clean') !== statusFilter) return false;
      if (q && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [areas, searchTerm, statusFilter]);

  const openArea = (area: CleaningArea) => {
    setSelected(area);
    setNextStatus((area.status as SpaceStatus) || 'clean');
    setModalOpen(true);
  };

  const setQuickStatus = async (area: CleaningArea, status: SpaceStatus) => {
    try {
      const res = await fetch('/api/housekeeping/cleaning-areas', {
        method: 'POST',
        headers: hkHeaders(),
        body: JSON.stringify({ id: area.id, status }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.area) {
        setAreas((prev) => prev.map((a) => (a.id === area.id ? { ...a, ...data.area } : a)));
      }

      if (status === 'dirty') {
        housekeepingStore.ensureOpenCleaningTask({
          location: area.name,
          roomTypeId: AREA_ROOM_TYPE_ID,
          taskType: 'daily',
          priority: 'medium',
          estimatedMinutes: 40,
          notes: `Auto-created when ${area.name} marked dirty`,
        });
        trackEvent('HK.PublicSpace.DirtyTask', { areaId: area.id, name: area.name });
      }

      if (status === 'in-progress') {
        let task = housekeepingStore.getOpenCleaningTask(area.name);
        if (!task) {
          task = housekeepingStore.ensureOpenCleaningTask({
            location: area.name,
            roomTypeId: AREA_ROOM_TYPE_ID,
            taskType: 'daily',
            notes: `Auto-created when cleaning started on ${area.name}`,
          });
        }
        if (task.status === 'pending') {
          housekeepingStore.updateTaskStatus(task.id, 'in-progress');
        }
      }
    } catch {
      /* ignore */
    }
  };

  const saveStatus = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch('/api/housekeeping/cleaning-areas', {
        method: 'POST',
        headers: hkHeaders(),
        body: JSON.stringify({ id: selected.id, status: nextStatus }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.area) {
        setAreas((prev) => prev.map((a) => (a.id === selected.id ? { ...a, ...data.area } : a)));
      }
      if (nextStatus === 'dirty') {
        housekeepingStore.ensureOpenCleaningTask({
          location: selected.name,
          roomTypeId: AREA_ROOM_TYPE_ID,
          taskType: 'daily',
          priority: 'medium',
          estimatedMinutes: 40,
          notes: `Auto-created when ${selected.name} marked dirty`,
        });
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        <Input
          size="sm"
          placeholder="Search public spaces..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startContent={<span className="text-gray-400">🔍</span>}
          className="w-full max-w-full sm:w-52 sm:max-w-[13rem] shrink-0"
        />
        <Select
          size="sm"
          placeholder="Filter by status"
          selectedKeys={[statusFilter]}
          onSelectionChange={(keys) => setStatusFilter((Array.from(keys)[0] as string) || 'all')}
          className="w-full max-w-full sm:w-44 sm:max-w-[11rem] shrink-0"
        >
          <SelectItem key="all">All statuses</SelectItem>
          <SelectItem key="clean">🟢 Clean</SelectItem>
          <SelectItem key="dirty">🟡 Dirty</SelectItem>
          <SelectItem key="in-progress">🔄 In progress</SelectItem>
          <SelectItem key="inspected">🟣 Inspected</SelectItem>
          <SelectItem key="maintenance">🟠 Maintenance</SelectItem>
        </Select>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-600">Filtered:</span>
          <Badge color="primary" variant="flat">{filtered.length}</Badge>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading public spaces…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">
          No public spaces yet. Add them under Work → Cleaning areas.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10.5rem),1fr))] gap-2.5">
          {filtered.map((area) => {
            const status = area.status || 'clean';
            return (
              <Card
                key={area.id}
                className={`border shadow-none cursor-pointer transition-colors hover:border-ghana-gold ${
                  status === 'dirty' ? 'border-yellow-200' :
                  status === 'maintenance' ? 'border-orange-200' :
                  status === 'in-progress' ? 'border-blue-200' :
                  status === 'inspected' ? 'border-purple-200' :
                  'border-green-200'
                }`}
                onClick={() => openArea(area)}
              >
                <CardBody className="gap-2 overflow-hidden p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ghana-black leading-tight" title={area.name}>
                      {area.name}
                    </p>
                    <p className="truncate text-xs text-gray-500 leading-tight">Public space</p>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base leading-none shrink-0" aria-hidden>{statusIcon(status)}</span>
                    <Chip
                      color={statusColor(status) as any}
                      size="sm"
                      variant="flat"
                      className="h-6 max-w-full min-w-0"
                      classNames={{ content: 'truncate px-1 text-xs' }}
                    >
                      {statusLabel(status)}
                    </Chip>
                  </div>

                  <div className="mt-auto flex flex-col gap-1.5 pt-1">
                    <span className="text-[11px] tabular-nums text-gray-400">
                      {area.updatedAt
                        ? new Date(area.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </span>
                    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                      <Tooltip content="Mark dirty">
                        <Button
                          size="sm"
                          color="warning"
                          variant="flat"
                          isIconOnly
                          className="min-w-7 w-7 h-7"
                          onPress={() => void setQuickStatus(area, 'dirty')}
                        >
                          🧹
                        </Button>
                      </Tooltip>
                      <Tooltip content="In progress">
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          isIconOnly
                          className="min-w-7 w-7 h-7"
                          onPress={() => void setQuickStatus(area, 'in-progress')}
                        >
                          🔄
                        </Button>
                      </Tooltip>
                      <Tooltip content="Mark clean">
                        <Button
                          size="sm"
                          color="success"
                          variant="flat"
                          isIconOnly
                          className="min-w-7 w-7 h-7"
                          onPress={() => void setQuickStatus(area, 'clean')}
                        >
                          ✅
                        </Button>
                      </Tooltip>
                      <Tooltip content="Mark inspected">
                        <Button
                          size="sm"
                          color="secondary"
                          variant="flat"
                          isIconOnly
                          className="min-w-7 w-7 h-7"
                          onPress={() => void setQuickStatus(area, 'inspected')}
                        >
                          🔍
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} size="md">
        <ModalContent>
          <ModalHeader>{selected?.name || 'Public space'}</ModalHeader>
          <ModalBody className="gap-3">
            <Select
              label="Status"
              size="sm"
              selectedKeys={[nextStatus]}
              onSelectionChange={(keys) => {
                const v = Array.from(keys)[0] as SpaceStatus;
                if (v) setNextStatus(v);
              }}
            >
              <SelectItem key="clean">🟢 Clean</SelectItem>
              <SelectItem key="dirty">🟡 Dirty</SelectItem>
              <SelectItem key="in-progress">🔄 In progress</SelectItem>
              <SelectItem key="inspected">🟣 Inspected</SelectItem>
              <SelectItem key="maintenance">🟠 Maintenance</SelectItem>
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setModalOpen(false)}>Cancel</Button>
            <Button color="primary" isLoading={saving} onPress={saveStatus}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
