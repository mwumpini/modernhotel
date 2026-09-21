'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardBody, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@heroui/react';
import { useSettingsStore } from '../../lib/settings/store';
import { notifyError, notifySuccess } from '../../lib/notifications/notify';

type Status = {
  loaded: boolean;
  counts: { staff: number; departments: number; guests: number; reservations: number; stockItems: number; suppliers: number; housekeepingTasks: number; events: number; recipes: number };
  notes?: string[];
  kept?: string[];
};

const INCLUDED: Array<[string, string]> = [
  ['Front Office', '8 guests and 8 reservations — arriving today, in the house, upcoming and checked out — with folios whose charges and payments add up.'],
  ['HR & Payroll', '5 departments, 9 positions and 10 staff on real salaries, plus leave requests, a week of attendance, this week’s roster, training and performance entries. Payroll is left for you to prepare.'],
  ['Inventory & Kitchen', '4 suppliers, 16 stock items (three below their reorder level so alerts show), purchase orders, requisitions and 4 recipes.'],
  ['Housekeeping, Maintenance & Events', 'Cleaning tasks, maintenance requests, 3 event halls, catering items and 3 event bookings.'],
  ['Restaurant', '8 tables and 4 regular customers. Menu items are already there.'],
];

export default function SampleDataPanel() {
  const canManage = useSettingsStore((s) => s.hasPermission('settings.manage-sample-data'));
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<'load' | 'remove' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/sample-data');
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // The server is now clean, but this browser still remembers the sample rooms and guests. Left alone it would
  // show them, and even push the rooms back up (the app copies a browser's room set to a server that has none).
  const forgetSampleLocally = () => {
    const isSample = (x: { id?: string }) => typeof x?.id === 'string' && x.id.startsWith('smp_');
    const state = useSettingsStore.getState();
    const rm = state.roomManagement;
    useSettingsStore.setState({
      roomManagement: { ...rm, roomTypes: rm.roomTypes.filter((x) => !isSample(x)), rooms: rm.rooms.filter((x) => !isSample(x)), ratePlans: rm.ratePlans.filter((x) => !isSample(x)) },
    });
    state.saveSettings();
    for (const storage of [localStorage, sessionStorage]) {
      try {
        const raw = storage.getItem('fo.guests');
        const guests = raw ? JSON.parse(raw) : null;
        if (Array.isArray(guests)) storage.setItem('fo.guests', JSON.stringify(guests.filter((g) => !isSample(g))));
      } catch {}
    }
  };

  // Every screen keeps its own copy of the data, so after a change the app reloads (and comes back to this tab)
  // to show it everywhere.
  const reloadHere = () => {
    try {
      localStorage.setItem('nav.section', 'settings');
      localStorage.setItem('settings.tab', 'sample-data');
    } catch {}
    window.setTimeout(() => window.location.reload(), 1800);
  };

  const run = async (action: 'load' | 'remove') => {
    setBusy(action);
    try {
      const res = await fetch('/api/settings/sample-data', { method: action === 'load' ? 'POST' : 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifyError(body?.error || 'Something went wrong — nothing was changed that you can’t retry.', action === 'load' ? 'Sample data not loaded' : 'Sample data not removed');
        return;
      }
      setStatus(body);
      if (action === 'remove') forgetSampleLocally();
      const extra = [...(body.notes || []), ...(body.kept?.length ? [`Kept because other records depend on them: ${body.kept.join(', ')}.`] : [])].join(' ');
      notifySuccess(`${action === 'load' ? 'Sample data loaded.' : 'Sample data removed.'} ${extra} Reloading to show it everywhere…`.trim(), action === 'load' ? 'Sample data loaded' : 'Sample data removed');
      reloadHere();
    } catch {
      notifyError('Could not reach the server. Please try again.', 'Sample data');
    } finally {
      setBusy(null);
      setConfirmRemove(false);
    }
  };

  const c = status?.counts;
  return (
    <div className="space-y-5 mt-4 max-w-4xl">
      <div>
        <h3 className="text-lg font-semibold text-ghana-black">Sample data for testing</h3>
        <p className="text-sm text-gray-600 mt-1">
          Fill this hotel with realistic starter records so testers can try every screen straight away. Sample records are kept apart from
          anything you enter yourself: <strong>Remove sample data</strong> takes out exactly what was loaded and leaves your own data — and a clean slate — behind.
        </p>
      </div>

      <Card className="border-0 shadow-md">
        <CardBody className="space-y-3">
          <p className="text-sm font-medium text-ghana-black">What gets added</p>
          <ul className="space-y-2">
            {INCLUDED.map(([area, text]) => (
              <li key={area} className="text-sm text-gray-700"><span className="font-semibold text-ghana-black">{area}:</span> {text}</li>
            ))}
          </ul>
          <p className="text-xs text-gray-500">Loading again never duplicates anything. If this hotel has no rooms yet, a sample set of rooms is added too.</p>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-md">
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium text-ghana-black">{status === null ? 'Checking…' : status.loaded ? 'Sample data is loaded' : 'No sample data loaded'}</p>
              {c && status?.loaded && (
                <p className="text-xs text-gray-600 mt-1">
                  {c.staff} staff · {c.guests} guests · {c.reservations} reservations · {c.stockItems} stock items · {c.suppliers} suppliers · {c.housekeepingTasks} housekeeping tasks · {c.events} events · {c.recipes} recipes
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button color="primary" isDisabled={!canManage || busy !== null} isLoading={busy === 'load'} onPress={() => run('load')}>
                {status?.loaded ? 'Load again' : 'Load sample data'}
              </Button>
              <Button color="danger" variant="flat" isDisabled={!canManage || busy !== null || !status?.loaded} onPress={() => setConfirmRemove(true)}>
                Remove sample data
              </Button>
            </div>
          </div>
          {!canManage && <p className="text-xs text-amber-700">Loading or removing sample data needs the “Load or remove sample data” permission (System Administrators have it).</p>}
          {busy && <div className="flex items-center gap-2 text-sm text-gray-600"><Spinner size="sm" /> Working — this can take a few seconds…</div>}
        </CardBody>
      </Card>

      <Modal isOpen={confirmRemove} onOpenChange={setConfirmRemove} size="lg">
        <ModalContent>
          <ModalHeader>Remove all sample data?</ModalHeader>
          <ModalBody className="space-y-2 text-sm text-gray-700">
            <p>This deletes every sample record listed above, together with anything added to them since — for example a payment or charge on a sample guest’s stay, or attendance for a sample staff member.</p>
            <p>Records you created yourself stay. Sample payroll that was <strong>approved</strong> can’t be undone here: its ledger entries remain.</p>
            <p className="font-medium text-ghana-black">This can’t be undone, but you can load the sample data again any time.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setConfirmRemove(false)}>Cancel</Button>
            <Button color="danger" isLoading={busy === 'remove'} onPress={() => run('remove')}>Remove sample data</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
