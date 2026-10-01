'use client';

import { announcementStore, type DepartmentKey } from '../analytics/announcementStore';
import { frontOfficeStore } from '../frontoffice/store';
import { housekeepingStore } from '../housekeeping/store';
import { useSettingsStore } from '../settings/store';
import { useStockStore } from '../inventory/stockStore';
import { useEmployeeStore } from '../hr/employeeStore';
import { usePayrollStore } from '../hr/payrollStore';
import { useAccountingStore } from '../accounting/store';
import { ordersStore } from '../fb/ordersStore';
import { useShiftStore } from '../security/shiftStore';
import { usePatrolStore } from '../security/patrolStore';
import { useIncidentStore } from '../security/incidentStore';

export type DeskBrief = {
  desk: DepartmentKey;
  label: string;
  snapshot: string[];
  notices: string[];
  prompts: string[];
};

const LABELS: Record<DepartmentKey, string> = {
  all: 'All departments',
  master: 'Executive',
  gm: 'General Manager',
  frontdesk: 'Front Office',
  housekeeping: 'Housekeeping',
  inventory: 'Inventory & Stores',
  security: 'Security',
  hr: 'HR & Payroll',
  accounting: 'Accounting',
  'f&b': 'Restaurant & Bar',
  events: 'Events & Conferences',
};

const PROMPTS: Record<DepartmentKey, string[]> = {
  all: ["Summarize today's notices", 'Draft a notice to all departments'],
  master: ["Summarize today's notices", 'Draft a notice to all departments'],
  gm: ["Summarize today's notices", 'Draft a notice to all departments'],
  frontdesk: ["Summarize today's rooms", 'Draft an arrival notice'],
  housekeeping: ['Summarize rooms that need cleaning', 'Draft a maintenance notice'],
  inventory: ['Draft a low-stock notice', 'Summarize stock that needs reorder'],
  security: ['Summarize who is on duty', 'Draft an incident notice'],
  hr: ['Summarize staff on leave', 'Draft a payroll reminder'],
  accounting: ['Summarize open invoices', 'Draft an end-of-day notice'],
  'f&b': ['Summarize open orders', 'Draft a kitchen notice'],
  events: ['Draft a setup reminder', "Summarize today's notices"],
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function roomLine(): string | null {
  try {
    const live = housekeepingStore.getAllRooms();
    const rooms = live.length
      ? live.map((r) => r.status)
      : (useSettingsStore.getState().roomManagement.rooms || []).map((r) => r.status);
    if (!rooms.length) return null;
    const n = (status: string) => rooms.filter((s) => s === status).length;
    return `${rooms.length} rooms: ${n('occupied')} occupied, ${n('vacant')} vacant, ${n('dirty')} dirty, ${n('clean')} clean, ${n('maintenance')} maintenance.`;
  } catch {
    return null;
  }
}

function stayLine(): string | null {
  try {
    const stays = frontOfficeStore.reservations || [];
    if (!stays.length) return null;
    const today = todayIso();
    const inHouse = stays.filter((r) => r.status === 'checked-in').length;
    const arriving = stays.filter((r) => r.arrival?.slice(0, 10) === today && r.status !== 'cancelled' && r.status !== 'no-show' && r.status !== 'checked-out').length;
    return `${inHouse} checked in, ${arriving} arriving today.`;
  } catch {
    return null;
  }
}

function stockLine(): string | null {
  try {
    const stock = useStockStore.getState();
    if (!stock.stockItems.length) return null;
    const low = stock.getLowStockItems();
    const out = stock.getOutOfStockItems();
    const names = low.slice(0, 3).map((i) => i.name).filter(Boolean).join(', ');
    return `${stock.stockItems.length} stock items, ${low.length} at or below reorder, ${out.length} out of stock${names ? ` (${names})` : ''}.`;
  } catch {
    return null;
  }
}

function staffLine(): string | null {
  try {
    const employees = useEmployeeStore.getState().employees;
    if (!employees.length) return null;
    const active = employees.filter((e) => e.status === 'active').length;
    const leave = employees.filter((e) => e.status === 'on_leave').length;
    return `${active} active employees, ${leave} on leave.`;
  } catch {
    return null;
  }
}

function payrollLine(): string | null {
  try {
    const periods = usePayrollStore.getState().payrollPeriods;
    if (!periods.length) return null;
    const open = periods.filter((p) => p.status === 'draft' || p.status === 'processing').length;
    return `${open} payroll periods still draft or processing.`;
  } catch {
    return null;
  }
}

function invoiceLine(): string | null {
  try {
    const invoices = useAccountingStore.getState().invoices;
    if (!invoices.length) return null;
    const openSales = invoices.filter((i) => i.type === 'Sales' && i.status !== 'Void' && i.status !== 'Paid' && Number(i.total || 0) - Number(i.paidAmount || 0) > 0);
    const openBills = invoices.filter((i) => i.type === 'Purchase' && i.status !== 'Void' && i.status !== 'Paid' && Number(i.total || 0) - Number(i.paidAmount || 0) > 0);
    return `${openSales.length} open sales invoices, ${openBills.length} open supplier bills.`;
  } catch {
    return null;
  }
}

function orderLine(): string | null {
  try {
    const orders = ordersStore.all();
    if (!orders.length) return null;
    const open = orders.filter((o) => o.status === 'pending' || o.status === 'sent' || o.status === 'preparing' || o.status === 'ready' || o.status === 'billed').length;
    return `${open} open restaurant orders.`;
  } catch {
    return null;
  }
}

function securityLines(): string[] {
  const lines: string[] = [];
  try {
    const shifts = useShiftStore.getState().shifts;
    if (shifts.length) lines.push(`${shifts.filter((s) => s.status === 'on_duty').length} security staff on duty.`);
  } catch { /* desk can still answer from notices */ }
  try {
    const patrols = usePatrolStore.getState().patrols;
    if (patrols.length) lines.push(`${patrols.filter((p) => p.status === 'active').length} patrols active.`);
  } catch { /* ignore */ }
  try {
    const incidents = useIncidentStore.getState().incidents;
    if (incidents.length) {
      const open = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'closed').length;
      lines.push(`${open} incidents still open.`);
    }
  } catch { /* ignore */ }
  return lines;
}

function linesFor(desk: DepartmentKey): string[] {
  const push = (...items: Array<string | null>) => items.filter((x): x is string => !!x);
  switch (desk) {
    case 'frontdesk':
      return push(roomLine(), stayLine());
    case 'housekeeping':
      return push(roomLine());
    case 'inventory':
      return push(stockLine());
    case 'security':
      return securityLines();
    case 'hr':
      return push(staffLine(), payrollLine());
    case 'accounting':
      return push(invoiceLine());
    case 'f&b':
      return push(orderLine(), stockLine());
    case 'events':
      return ['Event bookings stay on the Events desk. Use the notices below.'];
    case 'master':
    case 'gm':
    case 'all':
      return push(roomLine(), stayLine(), stockLine(), staffLine(), ...securityLines(), orderLine());
    default:
      return [];
  }
}

function noticeLines(desk: DepartmentKey): string[] {
  try {
    return announcementStore.getForDepartment(desk, 5).map((m) => {
      const text = `${m.level}: ${m.message}`.replace(/\s+/g, ' ').trim();
      return text.length > 180 ? `${text.slice(0, 177)}...` : text;
    });
  } catch {
    return [];
  }
}

export function buildDeskBrief(desk: DepartmentKey): DeskBrief {
  return {
    desk,
    label: LABELS[desk] || desk,
    snapshot: linesFor(desk).slice(0, 6),
    notices: noticeLines(desk),
    prompts: PROMPTS[desk] || PROMPTS.all,
  };
}
