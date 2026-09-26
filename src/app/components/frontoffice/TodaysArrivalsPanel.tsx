'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Badge } from '@heroui/react';
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { useSettingsStore } from '../../lib/settings/store';
import { filterTodaysArrivals, canMarkNoShow } from '../../lib/frontoffice/arrivals';
import type { Reservation } from '../../lib/frontoffice/types';

type Props = {
  onCheckIn: (reservation: Reservation) => void;
  onNoShow: (reservation: Reservation) => void;
  compact?: boolean;
};

export default function TodaysArrivalsPanel({ onCheckIn, onNoShow, compact }: Props) {
  const [tick, setTick] = React.useState(0);
  const noShowEnabled = useSettingsStore((s) => !!s.roomManagement.noShowPolicyEnabled);
  const noShowCutoffHour = useSettingsStore((s) => s.roomManagement.noShowCutoffHour ?? 23);

  // Starts null (matching SSR) and is only ever set from an effect, so this
  // component's first render can't diverge from the server-rendered HTML —
  // frontOfficeStore's businessDate may already reflect a client-persisted
  // value from an unrelated store's subscribe() by the time this hydrates.
  const [businessDate, setBusinessDate] = React.useState<string | null>(null);

  React.useEffect(() => {
    const sync = () => setBusinessDate(frontOfficeStore.getBusinessDate());
    sync();
    return frontOfficeStore.subscribe(() => { setTick((t) => t + 1); sync(); });
  }, []);
  void tick;

  const arrivals = businessDate ? filterTodaysArrivals(frontOfficeStore.reservations, businessDate) : [];

  if (!businessDate || arrivals.length === 0) {
    return (
      <Card className="border-0 shadow-md mb-4">
        <CardBody className="py-4">
          <p className="text-sm text-gray-500">No expected arrivals for business date {businessDate ?? '…'}.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md mb-4">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div>
          <h4 className="text-base font-semibold text-ghana-black">Today&apos;s Arrivals</h4>
          <p className="text-xs text-gray-500">Business date {businessDate} · {arrivals.length} expected</p>
        </div>
        <Badge color="primary" variant="flat">{arrivals.length}</Badge>
      </CardHeader>
      <CardBody className={compact ? 'p-0 overflow-x-auto' : 'pt-0'}>
        <Table aria-label="Today's arrivals" removeWrapper={compact}>
          <TableHeader>
            <TableColumn>Guest</TableColumn>
            <TableColumn>Reservation</TableColumn>
            <TableColumn>Room type</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Actions</TableColumn>
          </TableHeader>
          <TableBody>
            {arrivals.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.guestName}</div>
                  {r.guestPhone && <div className="text-xs text-gray-500">{r.guestPhone}</div>}
                </TableCell>
                <TableCell className="text-sm">{r.resId || r.id}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">
                    {frontOfficeStore.roomTypes.find((rt) => rt.id === r.roomTypeId)?.name || '—'}
                  </Chip>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={r.status === 'confirmed' ? 'success' : 'warning'}>
                    {r.status}
                  </Chip>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(r.status === 'confirmed' || r.status === 'pending') && (
                      <Button size="sm" color="success" variant="flat" onPress={() => onCheckIn(r)}>
                        Check in
                      </Button>
                    )}
                    {canMarkNoShow(r, businessDate) && (
                      <Button
                        size="sm"
                        color="danger"
                        variant="flat"
                        onPress={() => onNoShow(r)}
                        isDisabled={!noShowEnabled || !canMarkNoShow(r, businessDate, { cutoffHour: noShowCutoffHour })}
                        title={!noShowEnabled ? 'Enable no-show policy in Operational Policies' : !canMarkNoShow(r, businessDate, { cutoffHour: noShowCutoffHour }) ? `No-show opens at ${String(noShowCutoffHour).padStart(2, '0')}:00` : 'Mark as no-show'}
                      >
                        No-show
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}
