'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Chip, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { getExpiryAlerts, EXPIRY_WINDOW_DAYS } from '@/app/lib/hr/expiryAlerts';
import { HideCardButton } from '../dashboard/CustomizeViewControl';

const when = (daysLeft: number) =>
  daysLeft < 0 ? `${-daysLeft} day${daysLeft === -1 ? '' : 's'} overdue` : daysLeft === 0 ? 'Today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
const color = (daysLeft: number) => (daysLeft < 0 ? 'danger' : daysLeft <= 30 ? 'warning' : 'default') as 'danger' | 'warning' | 'default';

/** Contracts, work permits, health certificates and probation periods that have run out or
 * are about to — the dates are already captured on each staff record; this is what reads them. */
export default function ExpiryAlertsCard({ onHide }: { onHide?: () => void }) {
  const employees = useEmployeeStore((s) => s.employees);
  // Depends on today's date, which differs between the server render and the browser — only
  // compute after mount so both first paints agree.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const alerts = React.useMemo(() => (mounted ? getExpiryAlerts(employees) : []), [mounted, employees]);

  return (
    <Card className="border-0 shadow-lg mb-6">
      <CardHeader className="pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⏳</span>
          <h3 className="text-lg font-semibold text-ghana-black">Expiring Documents</h3>
          {alerts.length > 0 && <Chip size="sm" variant="flat" color={alerts.some((a) => a.daysLeft < 0) ? 'danger' : 'warning'}>{alerts.length}</Chip>}
        </div>
        {onHide && <HideCardButton onHide={onHide} label="Expiring Documents" />}
      </CardHeader>
      <CardBody>
        {alerts.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing expiring in the next {EXPIRY_WINDOW_DAYS} days — contracts, work permits, health certificates and probation periods are all up to date.</p>
        ) : (
          <Table aria-label="expiring-documents" removeWrapper>
            <TableHeader>
              <TableColumn>STAFF</TableColumn>
              <TableColumn>DOCUMENT</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>STATUS</TableColumn>
            </TableHeader>
            <TableBody>
              {alerts.map((a) => (
                <TableRow key={`${a.employeeId}-${a.kind}`}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.kind}</TableCell>
                  <TableCell>{new Date(`${a.date}T00:00:00`).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell><Chip size="sm" variant="flat" color={color(a.daysLeft)}>{when(a.daysLeft)}</Chip></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
