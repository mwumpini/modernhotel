'use client';

import React, { useMemo, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { worksheetTableClassNames } from './frontoffice/StayWorksheetTable';
import { sizedTableClassNames, useResizableColumns } from './frontoffice/columnResize';
import { ordersStore, type FBOrder, type OrderItem } from '../lib/fb/ordersStore';
import { lineTicket, parseTicketTag } from '../lib/fb/ticketTag';
import { DateFilterPills, type DateMode } from './fb/DateFilterPills';

const deskTableClassNames = {
  ...worksheetTableClassNames,
  table: 'w-full min-w-max',
  th: `${worksheetTableClassNames.th} relative`,
};

type ColumnSort = { column: string; direction: 'asc' | 'desc' };
type ActivityQueue = 'all' | 'pending-kot' | 'pending-bot' | 'unpaid' | 'billed' | 'cancelled';

type ActivityRow = { order: FBOrder; item: OrderItem };

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  column: string;
  sort: ColumnSort;
  onSort: (column: string) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.column === column;
  return (
    <button
      type="button"
      className={`max-w-full truncate font-semibold text-ghana-black ${align === 'right' ? 'ml-auto block text-right' : ''}`}
      onClick={() => onSort(column)}
    >
      {label}{active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

function toggleColumnSort(prev: ColumnSort, column: string): ColumnSort {
  if (prev.column !== column) {
    return { column, direction: column === 'time' || column === 'amount' ? 'desc' : 'asc' };
  }
  return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
}

function stamp(iso?: string) {
  if (!iso) return { date: '—', time: '—' };
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return { date: '—', time: '—' };
  return {
    date: when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    time: when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

function dayKey(iso?: string) {
  const when = iso ? new Date(iso) : null;
  if (!when || Number.isNaN(when.getTime())) return '';
  const month = String(when.getMonth() + 1).padStart(2, '0');
  const day = String(when.getDate()).padStart(2, '0');
  return `${when.getFullYear()}-${month}-${day}`;
}

function lineStatus(order: FBOrder, item: OrderItem) {
  return String(item.status || order.status || '').toLowerCase();
}

function lineOpen(status: string) {
  return status !== 'served' && status !== 'billed' && status !== 'paid' && status !== 'cancelled' && status !== 'void';
}

function inQueue(queue: ActivityQueue, order: FBOrder, item: OrderItem) {
  if (queue === 'all') return true;
  const status = lineStatus(order, item);
  const route = item.route === 'bar' ? 'bar' : 'kitchen';
  if (queue === 'pending-kot') return route === 'kitchen' && lineOpen(status);
  if (queue === 'pending-bot') return route === 'bar' && lineOpen(status);
  if (queue === 'unpaid') return status === 'served' || status === 'ready';
  if (queue === 'billed') return status === 'billed' || status === 'paid';
  return status === 'cancelled' || status === 'void';
}

function statusColor(status: string): 'warning' | 'primary' | 'success' | 'danger' | 'default' | 'secondary' {
  if (status === 'pending' || status === 'sent') return 'warning';
  if (status === 'preparing') return 'primary';
  if (status === 'ready') return 'secondary';
  if (status === 'served' || status === 'billed' || status === 'paid') return 'success';
  if (status === 'cancelled' || status === 'void') return 'danger';
  return 'default';
}

function statusLabel(status: string) {
  if (!status) return '—';
  if (status === 'cancelled') return 'Void';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function money(amount: number) {
  return `₵${amount.toFixed(2)}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-ghana-black">{value}</div>
    </div>
  );
}

export default function FoodBeveragePosActivity({
  onEditInPos,
}: {
  onEditInPos?: (orderId: string) => void;
} = {}) {
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState<ActivityQueue>('all');
  const [staff, setStaff] = useState('everyone');
  const [dateMode, setDateMode] = useState<DateMode>('all');
  const [dateSingle, setDateSingle] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ColumnSort>({ column: 'time', direction: 'desc' });
  const activityCols = useResizableColumns({
    ticket: 120,
    date: 88,
    clock: 72,
    item: 180,
    customer: 140,
    room: 80,
    table: 80,
    venue: 110,
    qty: 64,
    amount: 96,
    status: 110,
    server: 140,
  });
  const [tick, setTick] = useState(0);
  const [openLine, setOpenLine] = useState<{ orderId: string; itemId: string } | null>(null);

  React.useEffect(() => ordersStore.subscribe(() => setTick((value) => value + 1)), []);

  const staffNames = useMemo(() => {
    return Array.from(new Set(ordersStore.all().map((order) => order.waiterId).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [tick]);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = ordersStore.all().flatMap((order) => order.items.map((item) => ({ order, item })));
    const filtered = list.filter(({ order, item }) => {
      if (!inQueue(queue, order, item)) return false;
      if (staff && staff !== 'everyone' && staff !== 'all' && order.waiterId !== staff) return false;
      const orderDay = dayKey(order.createdAt);
      const today = dayKey(new Date().toISOString());
      if (dateMode === 'today' && orderDay !== today) return false;
      if (dateMode === 'specific' && dateSingle && orderDay !== dateSingle) return false;
      if (dateMode === 'range' && (dateFrom || dateTo)) {
        if (dateFrom && orderDay < dateFrom) return false;
        if (dateTo && orderDay > dateTo) return false;
      }
      if (!term) return true;
      const ticket = lineTicket(order.notes, item.route, order.orderNumber || order.id);
      return [ticket, order.orderNumber, item.name, order.table, order.guestName, order.waiterId, order.roomNumber]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
    const direction = sort.direction === 'asc' ? 1 : -1;
    const valueOf = ({ order, item }: ActivityRow) => {
      switch (sort.column) {
        case 'ticket': return lineTicket(order.notes, item.route, order.orderNumber || order.id);
        case 'item': return item.name || '';
        case 'customer': return order.guestName || '';
        case 'room': return order.roomNumber || '';
        case 'table': return order.table || '';
        case 'venue': return order.venue || '';
        case 'qty': return item.qty || 0;
        case 'amount': return (item.price || 0) * (item.qty || 0);
        case 'status': return lineStatus(order, item);
        case 'server': return order.waiterId || '';
        default: return order.createdAt || '';
      }
    };
    return [...filtered].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [query, queue, staff, dateMode, dateSingle, dateFrom, dateTo, sort, tick]);

  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, pages);
  const paged = rows.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const opened = useMemo(() => {
    if (!openLine) return null;
    const order = ordersStore.all().find((entry) => entry.id === openLine.orderId);
    const item = order?.items.find((entry) => entry.id === openLine.itemId);
    if (!order || !item) return null;
    return { order, item };
  }, [openLine, tick]);

  return (
    <div className="px-2 pb-2">
      <Card className="border-0 shadow-lg">
        <CardBody className="px-2 py-3">
          <div className="mb-[18px] flex flex-wrap items-center gap-2">
            <Input
              aria-label="Search transactions"
              placeholder="Search ticket, item, table"
              size="sm"
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              isClearable
              onClear={() => {
                setQuery('');
                setPage(1);
              }}
              className="w-full max-w-full sm:w-56 sm:max-w-[14rem] shrink-0"
            />
            <Select
              aria-label="Queue"
              placeholder="All activity"
              size="sm"
              selectedKeys={[queue]}
              onSelectionChange={(keys) => {
                const next = Array.from(keys)[0] as ActivityQueue;
                if (next) {
                  setQueue(next);
                  setPage(1);
                }
              }}
              className="w-full max-w-full sm:w-44 sm:max-w-[11rem] shrink-0"
            >
              <SelectItem key="all">All activity</SelectItem>
              <SelectItem key="pending-kot">Pending KOT</SelectItem>
              <SelectItem key="pending-bot">Pending BOT</SelectItem>
              <SelectItem key="unpaid">Unpaid</SelectItem>
              <SelectItem key="billed">Billed</SelectItem>
              <SelectItem key="cancelled">Voided</SelectItem>
            </Select>
            <Select
              aria-label="Staff"
              placeholder="All staff"
              size="sm"
              selectedKeys={[staff === 'all' ? 'everyone' : staff]}
              onSelectionChange={(keys) => {
                const next = Array.from(keys)[0] as string;
                if (next) {
                  setStaff(next);
                  setPage(1);
                }
              }}
              className="w-full max-w-full sm:w-44 sm:max-w-[11rem] shrink-0"
            >
              {[
                <SelectItem key="everyone">All staff</SelectItem>,
                ...staffNames.map((name) => (
                  <SelectItem key={name}>{name}</SelectItem>
                )),
              ]}
            </Select>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <DateFilterPills
                mode={dateMode}
                onMode={(next) => {
                  setDateMode(next);
                  setPage(1);
                }}
                single={dateSingle}
                onSingle={(value) => {
                  setDateSingle(value);
                  setPage(1);
                }}
                from={dateFrom}
                onFrom={(value) => {
                  setDateFrom(value);
                  setPage(1);
                }}
                to={dateTo}
                onTo={(value) => {
                  setDateTo(value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div ref={activityCols.frameRef} style={activityCols.frameStyle}>
          <Table aria-label="Transactions" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
            <TableHeader>
              <TableColumn className="relative" style={activityCols.style('ticket')}>{<SortHeader label="Ticket" column="ticket" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{activityCols.sizer('ticket', 'Ticket')}</TableColumn>
              <TableColumn className="relative" style={activityCols.style('date')}>{<SortHeader label="Date" column="time" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{activityCols.sizer('date', 'Date')}</TableColumn>
              <TableColumn className="relative" style={activityCols.style('clock')}>Time{activityCols.sizer('clock', 'Time')}</TableColumn>
              <TableColumn className="relative" style={activityCols.style('item')}>{<SortHeader label="Item" column="item" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{activityCols.sizer('item', 'Item')}</TableColumn>
              <TableColumn className="relative" style={activityCols.style('customer')}>{<SortHeader label="Customer" column="customer" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{activityCols.sizer('customer', 'Customer')}</TableColumn>
              <TableColumn className="relative" style={activityCols.style('room')}>{<SortHeader label="Room" column="room" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{activityCols.sizer('room', 'Room')}</TableColumn>
              <TableColumn className="relative" style={activityCols.style('table')}>{<SortHeader label="Table" column="table" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{activityCols.sizer('table', 'Table')}</TableColumn>
              <TableColumn className="relative" style={activityCols.style('venue')}>{<SortHeader label="Venue" column="venue" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{activityCols.sizer('venue', 'Venue')}</TableColumn>
              <TableColumn className="relative" style={activityCols.style('qty')}>{<SortHeader label="Qty" column="qty" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} align="right" />}{activityCols.sizer('qty', 'Qty')}</TableColumn>
              <TableColumn className="relative" style={activityCols.style('amount')}>{<SortHeader label="Amount" column="amount" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} align="right" />}{activityCols.sizer('amount', 'Amount')}</TableColumn>
              <TableColumn className="relative" style={activityCols.style('status')}>{<SortHeader label="Status" column="status" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{activityCols.sizer('status', 'Status')}</TableColumn>
              <TableColumn className="relative" style={activityCols.style('server')}>{<SortHeader label="Staff" column="server" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{activityCols.sizer('server', 'Staff')}</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No transactions yet.">
              {paged.map(({ order, item }) => {
                const when = stamp(order.createdAt);
                const status = lineStatus(order, item);
                const amount = (item.price || 0) * (item.qty || 0);
                const selected = openLine?.orderId === order.id && openLine.itemId === item.id;
                return (
                  <TableRow
                    key={`${order.id}-${item.id}`}
                    className={`cursor-pointer ${selected ? 'bg-green-50 dark:bg-white/10' : 'hover:bg-gray-50'}`}
                    onClick={() => setOpenLine({ orderId: order.id, itemId: item.id })}
                  >
                    <TableCell className="font-medium">{lineTicket(order.notes, item.route, order.orderNumber || order.id)}</TableCell>
                    <TableCell>{when.date}</TableCell>
                    <TableCell>{when.time}</TableCell>
                    <TableCell>
                      <span className="block truncate" title={item.name}>{item.name}</span>
                    </TableCell>
                    <TableCell>{order.guestName || '—'}</TableCell>
                    <TableCell>{order.roomNumber || '—'}</TableCell>
                    <TableCell>{order.table || '—'}</TableCell>
                    <TableCell>{order.venue}</TableCell>
                    <TableCell>
                      <span className="block text-right tabular-nums">{item.qty}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block text-right tabular-nums">₵{amount.toFixed(2)}</span>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={statusColor(status)}>{statusLabel(status)}</Chip>
                    </TableCell>
                    <TableCell>{order.waiterId || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={pageSafe} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>
      <TransactionDialog
        opened={opened}
        onClose={() => setOpenLine(null)}
        onEditInPos={onEditInPos}
      />
    </div>
  );
}

function TransactionDialog({
  opened,
  onClose,
  onEditInPos,
}: {
  opened: { order: FBOrder; item: OrderItem } | null;
  onClose: () => void;
  onEditInPos?: (orderId: string) => void;
}) {
  const order = opened?.order;
  const item = opened?.item;
  const when = stamp(order?.createdAt);
  const ticket = order && item ? lineTicket(order.notes, item.route, order.orderNumber || order.id) : '';
  const place = order?.table || (order?.roomNumber ? `Room ${order.roomNumber}` : 'Walk-in');
  const notes = parseTicketTag(order?.notes).notes;
  const orderTotal = order
    ? order.items.reduce((sum, line) => sum + (line.price || 0) * (line.qty || 0), 0)
    : 0;
  const lineState = order && item ? lineStatus(order, item) : '';
  const isVoided = lineState === 'cancelled' || lineState === 'void';
  const isBilled = lineState === 'billed' || lineState === 'paid';

  const [caution, setCaution] = useState<null | {
    kind: 'void' | 'delete';
    title: string;
    message: string;
    confirmLabel: string;
  }>(null);

  React.useEffect(() => {
    if (!opened) setCaution(null);
  }, [opened?.order.id, opened?.item.id]);

  const persistOrderCancel = async (orderId: string, reason: string) => {
    try {
      const { getClientTenantSubdomain } = await import('../lib/api/clientTenant');
      const tenant = getClientTenantSubdomain();
      if (!tenant) return;
      await fetch(`/api/fb/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-subdomain': tenant },
        body: JSON.stringify({ status: 'cancelled', cancelReason: reason }),
      });
    } catch {
      /* local store already updated */
    }
  };

  const startEditInPos = () => {
    if (!order || isVoided || isBilled) return;
    onClose();
    onEditInPos?.(order.id);
  };

  const askVoid = () => {
    if (!order || !item || isVoided) return;
    setCaution({
      kind: 'void',
      title: 'Void this line?',
      message: `${item.name} on ${ticket || order.orderNumber || order.id} stays on file as Void. It will no longer count toward sales.`,
      confirmLabel: 'Void line',
    });
  };

  const askDelete = () => {
    if (!order || !item) return;
    setCaution({
      kind: 'delete',
      title: 'Delete this line?',
      message: `${item.name} on ${ticket || order.orderNumber || order.id} will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete line',
    });
  };

  const confirmCaution = () => {
    if (!caution || !order || !item) return;
    const kind = caution.kind;
    setCaution(null);

    if (kind === 'void') {
      ordersStore.updateItem(order.id, item.id, { status: 'cancelled' });
      const refreshed = ordersStore.all().find((entry) => entry.id === order.id);
      const stillOpen = (refreshed?.items || []).some((line) => {
        const status = String(line.status || refreshed?.status || '').toLowerCase();
        return status !== 'cancelled' && status !== 'void';
      });
      if (!stillOpen) {
        ordersStore.updateOrder(order.id, { status: 'cancelled' });
        void persistOrderCancel(order.id, `Voided line ${item.name}`);
      }
      onClose();
      return;
    }

    if (kind === 'delete') {
      const onlyLine = order.items.length <= 1;
      if (onlyLine) {
        ordersStore.remove(order.id);
      } else {
        ordersStore.removeItem(order.id, item.id);
      }
      onClose();
    }
  };

  return (
    <>
      <Modal
        isOpen={!!opened}
        onClose={onClose}
        size="3xl"
        scrollBehavior="inside"
        classNames={{ base: 'sm:!max-w-[52rem]', closeButton: 'text-white hover:bg-white/20' }}
      >
        <ModalContent>
          {order && item && (
            <>
              <ModalHeader className="bg-gradient-to-r from-blue-600 to-purple-600 pr-12 text-white">
                <div>
                  <h2 className="text-xl font-bold">{item.name}</h2>
                  <p className="text-sm font-normal text-blue-100">
                    {ticket} • {place} • {when.date} {when.time}
                    {isVoided ? ' · Void' : ''}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="gap-4">
                <Card shadow="sm" className="shrink-0">
                  <CardHeader className="pb-0">
                    <h4 className="text-base font-semibold text-ghana-black">Transaction</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <Fact label="Status" value={statusLabel(lineState)} />
                      <Fact label="Customer" value={order.guestName || order.customerType || '—'} />
                      <Fact label="Staff" value={order.waiterId || '—'} />
                      <Fact label="Room" value={order.roomNumber || '—'} />
                      <Fact label="Table" value={order.table || '—'} />
                      <Fact label="Venue" value={order.venue || '—'} />
                      <Fact label="Qty" value={String(item.qty || 0)} />
                      <Fact label="Amount" value={money((item.price || 0) * (item.qty || 0))} />
                      <Fact label="Ticket" value={ticket || '—'} />
                    </div>
                    {notes && <p className="mt-3 text-sm text-gray-600">{notes}</p>}
                  </CardBody>
                </Card>
                <Card shadow="sm" className="shrink-0">
                  <CardHeader className="pb-0">
                    <h4 className="text-base font-semibold text-ghana-black">Ticket</h4>
                  </CardHeader>
                  <CardBody className="px-3 py-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_4rem_6.5rem_6.5rem] gap-x-3 border-b border-gray-200 pb-1 text-xs text-gray-500">
                      <span className="text-sm font-semibold text-ghana-black">Item</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Amount</span>
                      <span>Status</span>
                    </div>
                    {order.items.map((line) => {
                      const lineAmount = (line.price || 0) * (line.qty || 0);
                      const current = line.id === item.id;
                      return (
                        <div
                          key={line.id}
                          className={`grid grid-cols-[minmax(0,1fr)_4rem_6.5rem_6.5rem] items-center gap-x-3 border-b border-gray-100 py-1.5 text-sm ${current ? 'bg-green-50' : ''}`}
                        >
                          <span className="truncate font-medium text-ghana-black">{line.name}</span>
                          <span className="text-right tabular-nums">{line.qty}</span>
                          <span className="text-right tabular-nums">{money(lineAmount)}</span>
                          <Chip size="sm" variant="flat" color={statusColor(lineStatus(order, line))}>
                            {statusLabel(lineStatus(order, line))}
                          </Chip>
                        </div>
                      );
                    })}
                    <div className="grid grid-cols-[minmax(0,1fr)_4rem_6.5rem_6.5rem] gap-x-3 pt-2 text-sm font-semibold text-ghana-black">
                      <span>Ticket total</span>
                      <span />
                      <span className="text-right tabular-nums">{money(orderTotal)}</span>
                      <span />
                    </div>
                  </CardBody>
                </Card>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="flat" onPress={askDelete}>
                  Delete
                </Button>
                <Button color="warning" variant="flat" isDisabled={isVoided} onPress={askVoid}>
                  Void
                </Button>
                <Button
                  color="primary"
                  variant="flat"
                  isDisabled={isVoided || isBilled || !onEditInPos}
                  onPress={startEditInPos}
                >
                  Edit in POS
                </Button>
                <Button variant="light" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(caution)} onClose={() => setCaution(null)} size="sm">
        <ModalContent>
          <ModalHeader>{caution?.title || 'Please confirm'}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-slate-600">{caution?.message}</p>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="flat" onPress={() => setCaution(null)}>
              Keep as is
            </Button>
            <Button
              size="sm"
              color={caution?.kind === 'delete' ? 'danger' : 'warning'}
              onPress={confirmCaution}
            >
              {caution?.confirmLabel || 'Confirm'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
