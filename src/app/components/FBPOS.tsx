'use client';

import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Tabs,
  Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Chip
} from "@heroui/react";
import { trackEvent } from '../lib/analytics/trackEvent';
import { logAudit } from '../lib/analytics/auditLogStore';
import { ordersStore, FBOrder } from '../lib/fb/ordersStore';
import { buildReceiptHtml, printReceipt, printKOTDoc, buildKOTHtml, printHtml, previewReceipt } from '../lib/print/print';
import { storesIssueBus } from '../lib/fb/stores';
import { kitchenOpsStore } from '../lib/fb/kitchenOpsStore';
import { storesStore } from '../lib/stores/store';
import { useAccountingStore } from '../lib/accounting/store';
import { captureCompleteSale, type DepartmentSource } from '../lib/accounting/integration';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { customerStore } from '../lib/fb/customerStore';
import { fbTenantHeaders, normalizePosVenue, createFbOrder, patchFbOrderStatus, fetchFbOrderById, type FbOrderStatus } from '../lib/fb/api';
import { computeSalesTaxTotal } from '../lib/tax/engine';
import { useSettingsStore } from '../lib/settings/store';
import { notifyError } from '../lib/notifications/notify';

type CustomerType = 'In-house' | 'Walk-in';
type VenueMode = 'Restaurant' | 'Bar';
type PaymentMethod = 'Cash' | 'Card' | 'Mobile Money' | 'Room Charge';

interface FBPOSProps {
  onClose: () => void;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  route: 'kitchen' | 'bar';
  aliases?: string[];
  isPinned?: boolean;
}

interface CartItem extends MenuItem {
  qty: number;
  note?: string;
  discountPerUnit?: number;
  serviceChargePerUnit?: number;
  isRoomService?: boolean;
}

interface Waiter {
  id: string;
  name: string;
}

interface PendingOrder {
  id: string;
  table: string;
  waiterId: string;
  items: CartItem[];
  status: 'pending' | 'preparing' | 'ready' | 'sent' | 'served' | 'billed' | 'paid' | 'cancelled';
  customerType: CustomerType;
  venue: VenueMode;
  notes?: string;
  urgent?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export default function FBPOS({ onClose }: FBPOSProps) {
  const [venue, setVenue] = useState<VenueMode>('Restaurant');
  const [customerType, setCustomerType] = useState<CustomerType>('Walk-in');
  const [roomNumber, setRoomNumber] = useState('');
  const [guestName, setGuestName] = useState('Walk-in Guest');
  const [roomSearchTerm, setRoomSearchTerm] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [walkInSearchTerm, setWalkInSearchTerm] = useState('');
  const [selectedWalkIn, setSelectedWalkIn] = useState<any>(null);
  const [walkInFocused, setWalkInFocused] = useState(false);
  const [tableNumber, setTableNumber] = useState('T01');
  const [waiterId, setWaiterId] = useState('W1');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [roomServiceChargePerUnit, setRoomServiceChargePerUnit] = useState<number>(5);
  const [applyRoomServiceCharge, setApplyRoomServiceCharge] = useState<boolean>(false);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>('');
  
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(() => {
    try { return (localStorage.getItem('kitchen.priority.filter') as any) || 'high'; } catch { return 'high'; }
  });

  const [isSending, setIsSending] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  // Track the DB order created by "Send to Kitchen" so Pay reuses it instead of creating a duplicate
  const [sentOrderData, setSentOrderData] = useState<{
    id: string; subtotal: number; taxAmount: number; total: number;
  } | null>(null);
  // Tenant info loaded from API
  const [hotelName, setHotelName] = useState('Hotel');
  const [waiters, setWaiters] = useState<Waiter[]>([
    { id: 'W1', name: 'Ama' },
    { id: 'W2', name: 'Kwame' },
    { id: 'W3', name: 'Efua' },
  ]);

  const paymentModal = useDisclosure();
  const newItemModal = useDisclosure();
  const orderDetailModal = useDisclosure();
  const managerPinModal = useDisclosure();
  const printPreviewModal = useDisclosure();
  const [printPreview, setPrintPreview] = useState<{ title: string; html: string } | null>(null);
  const [managerPin, setManagerPin] = useState<string>('1234');
  const [pinValue, setPinValue] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [pendingManagerAction, setPendingManagerAction] = useState<{ type: 'delete'; orderId: string } | null>(null);
  const [orders, setOrders] = useState<FBOrder[]>([]);
  const [showAllItems, setShowAllItems] = useState(false);
  const [sortKey, setSortKey] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activityPage, setActivityPage] = useState<number>(1);
  const [activityRowsPerPage, setActivityRowsPerPage] = useState<number>(10);
  const [activitySearch, setActivitySearch] = useState<string>('');
  const [activityStatusFilter, setActivityStatusFilter] = useState<string>('all');
  const [splitPayments, setSplitPayments] = useState<Array<{ method: PaymentMethod; amount: number }>>([]);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [settleRoomSearch, setSettleRoomSearch] = useState<string>('');
  const [settleSelectedRoom, setSettleSelectedRoom] = useState<{ roomId: string; guestId: string; guestName: string } | null>(null);
  const [orderMode, setOrderMode] = useState<'Dine-in' | 'Takeaway'>('Dine-in');
  const [packagingFee, setPackagingFee] = useState<number>(0);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const cartRef = React.useRef<HTMLDivElement | null>(null);
  const [showItemDiscounts, setShowItemDiscounts] = useState<boolean>(false);
  const cancelReasonModal = useDisclosure();
  const [cancelReason, setCancelReason] = useState<string>('Out of stock');
  const [cancelReasonCustom, setCancelReasonCustom] = useState<string>('');

  // Keep order-level Room Service in sync with item-level service charge
  React.useEffect(() => {
    setCart(prev => prev.map(i => ({
      ...i,
      serviceChargePerUnit: applyRoomServiceCharge ? roomServiceChargePerUnit : 0,
      isRoomService: applyRoomServiceCharge
    })));
  }, [applyRoomServiceCharge, roomServiceChargePerUnit]);

  // POS Activity row modal state
  const [activitySelected, setActivitySelected] = useState<{ order: FBOrder; item: any } | null>(null);
  const [activityQty, setActivityQty] = useState<number>(0);
  const [activityTable, setActivityTable] = useState<string>('');
  const [activityVenue, setActivityVenue] = useState<VenueMode>('Restaurant');
  const [activityWaiter, setActivityWaiter] = useState<string>('');

  const accountingStore = useAccountingStore();

  // Get available rooms (checked-in guests only)
  const availableRooms = useMemo(() => {
    return frontOfficeStore.reservations
      .filter(r => r.status === 'checked-in' && r.roomId && r.roomId !== 'TBD')
      .map(r => ({
        roomId: r.roomId,
        guestName: r.guestName,
        guestId: r.guestId,
        roomType: frontOfficeStore.roomTypes.find(rt => rt.id === r.roomTypeId)?.name || 'Unknown'
      }))
      .filter((room, index, self) => 
        index === self.findIndex(r => r.roomId === room.roomId)
      );
  }, []);

  // Get filtered rooms based on search
  const filteredRooms = useMemo(() => {
    if (!roomSearchTerm) return availableRooms;
    return availableRooms.filter(room => 
      (room.roomId || '').toLowerCase().includes(roomSearchTerm.toLowerCase()) ||
      room.guestName.toLowerCase().includes(roomSearchTerm.toLowerCase())
    );
  }, [availableRooms, roomSearchTerm]);

  // Walk-in customers search — re-run whenever customerStore's data actually
  // changes (e.g. once hydrateFromApi resolves), not just when the search
  // text changes, so the dropdown doesn't stay stuck on stale/empty data.
  const [customersTick, setCustomersTick] = React.useState(0);
  React.useEffect(() => customerStore.subscribe(() => setCustomersTick((t) => t + 1)), []);
  const filteredWalkIns = useMemo(() => {
    if (!walkInSearchTerm) return customerStore.getAllCustomers().slice(0, 20);
    return customerStore.searchCustomers(walkInSearchTerm).slice(0, 20);
  }, [walkInSearchTerm, customersTick]);

  // Handle room selection
  const handleRoomSelect = (room: any) => {
    setRoomNumber(room.roomId);
    setGuestName(room.guestName);
    setSelectedGuest(room);
    setRoomSearchTerm('');
  };

  const handleWalkInSelect = (cust: any) => {
    const fullName = `${cust.firstName} ${cust.lastName}`.trim();
    setGuestName(fullName);
    setSelectedWalkIn(cust);
    setWalkInSearchTerm('');
  };

  // Handle customer type change
  const handleCustomerTypeChange = (newType: CustomerType) => {
    setCustomerType(newType);
    if (newType !== 'In-house') {
      setRoomNumber('');
      setGuestName('Walk-in Guest');
      setSelectedGuest(null);
      setRoomSearchTerm('');
    }
    if (newType !== 'Walk-in') {
      setSelectedWalkIn(null);
      setWalkInSearchTerm('');
    }
  };


  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('manager.pin');
      if (saved) setManagerPin(saved);
    } catch {}
  }, []);

  // keep orders table in sync with shared store
  React.useEffect(() => {
    const sync = () => setOrders(ordersStore.all());
    sync();
    return ordersStore.subscribe(sync);
  }, []);

  // Load real, persisted walk-in customers (was permanently a hardcoded
  // 3-person demo list otherwise — see customerStore.hydrateFromApi).
  React.useEffect(() => {
    customerStore.hydrateFromApi();
  }, []);

  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);

  const tables = Array.from({ length: 20 }).map((_, i) => `T${String(i + 1).padStart(2, '0')}`);

  const [menuLoading, setMenuLoading] = useState(true);
  const [menu, setMenu] = useState<MenuItem[]>(() => {
    // Seed from localStorage as offline fallback while API loads
    try {
      const raw = localStorage.getItem('fbpos.menu');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  // Load menu from DB API; fall back to localStorage cache if request fails
  React.useEffect(() => {
    let cancelled = false;
    async function fetchMenu() {
      try {
        const res = await fetch('/api/fb/menu?available=true', {
          headers: fbTenantHeaders(),
        });
        if (!res.ok) throw new Error(`Menu API ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const mapped: MenuItem[] = (data.items || []).map((it: any) => ({
          id: it.id,
          code: it.code,
          name: it.name,
          price: Number(it.unitPrice),
          category: it.category,
          venue: it.venue,
          aliases: it.aliases ? it.aliases.split(',').map((a: string) => a.trim()).filter(Boolean) : [],
          isPinned: !!it.isPinned,
          route: (it.route || (it.category?.toLowerCase().includes('drink') || it.category?.toLowerCase().includes('bever') ? 'bar' : 'kitchen')) as 'kitchen' | 'bar',
        }));
        if (mapped.length > 0) {
          setMenu(mapped);
          // Update offline cache
          try { localStorage.setItem('fbpos.menu', JSON.stringify(mapped)); } catch {}
        }
      } catch (err) {
        // API unavailable — keep localStorage fallback silently
        console.warn('[FBPOS] Menu API unavailable, using local cache:', err);
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    }
    fetchMenu();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load tenant info: hotel name + staff list for waiter select
  React.useEffect(() => {
    let cancelled = false;
    async function fetchTenantInfo() {
      try {
        const res = await fetch('/api/tenant', { headers: fbTenantHeaders() });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.hotelName) setHotelName(data.hotelName);
        if (Array.isArray(data.staff) && data.staff.length > 0) {
          setWaiters(data.staff.map((s: any) => ({ id: s.id, name: s.name })));
          // Default waiterId to first staff member
          setWaiterId(data.staff[0].id);
        }
      } catch {
        // Keep default fallback values
      }
    }
    fetchTenantInfo();
    return () => { cancelled = true; };
  }, []);

  // Short names are kept on the menu item (set in Menu & Inventory); this is menuId -> aliases.
  const aliases = useMemo(() => {
    const map: Record<string, string[]> = {};
    menu.forEach(m => { map[m.id] = m.aliases || []; });
    return map;
  }, [menu]);

  const aliasMatches = (m: MenuItem, q: string) => {
    const qs = q.trim().toLowerCase();
    if (!qs) return true;
    if (m.name.toLowerCase().includes(qs)) return true;
    const a = aliases[m.id] || [];
    return a.some(x => x.toLowerCase().includes(qs));
  };

  const visibleMenu = useMemo(() => {
    const filtered = menu.filter(m => aliasMatches(m, search));
    if (venue === 'Restaurant') return filtered;
    return filtered.filter(m => m.route === 'bar' || m.category === 'Desserts');
  }, [menu, search, venue, aliases]);



  const categories = useMemo(() => Array.from(new Set(visibleMenu.map(m => m.category))), [visibleMenu]);

  // Pinned items get a tab of their own, first in line, so frequent orders stay a tap away
  // however long the menu grows. While a search is typed the results are shown across all tabs.
  const PINNED_TAB = '__pinned';
  const [menuTab, setMenuTab] = useState('');
  const pinnedItems = useMemo(() => visibleMenu.filter(m => m.isPinned), [visibleMenu]);
  const menuTabs = useMemo(() => [...(pinnedItems.length ? [PINNED_TAB] : []), ...categories], [pinnedItems, categories]);
  const activeTab = menuTabs.includes(menuTab) ? menuTab : menuTabs[0];
  const searching = search.trim() !== '';
  const shownMenu = searching ? visibleMenu : activeTab === PINNED_TAB ? pinnedItems : visibleMenu.filter(m => m.category === activeTab);

  // Pins are kept on the menu item itself, so every terminal shows the same ones.
  const togglePin = async (item: MenuItem) => {
    const setPinned = (pinned: boolean) => setMenu(prev => {
      const next = prev.map(m => (m.id === item.id ? { ...m, isPinned: pinned } : m));
      try { localStorage.setItem('fbpos.menu', JSON.stringify(next)); } catch {}
      return next;
    });
    const pinned = !item.isPinned;
    if (!searching) setMenuTab(activeTab); // stay on this tab, even when this is the first pin and the Pinned tab appears
    setPinned(pinned);
    try {
      const res = await fetch('/api/fb/menu', { method: 'PATCH', headers: fbTenantHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ id: item.id, isPinned: pinned }) });
      if (!res.ok) throw new Error(`Menu API ${res.status}`);
    } catch {
      setPinned(!pinned);
      notifyError(`Could not ${pinned ? 'pin' : 'unpin'} ${item.name}. Please try again.`, 'Pin not saved');
    }
  };
  const menuIdToCategory = useMemo(() => {
    const map: Record<string, string> = {};
    menu.forEach(m => { map[m.id] = m.category; });
    return map;
  }, [menu]);

  const sortedOrders = useMemo(() => {
    const allItems = orders.flatMap((o) => o.items.map((it) => ({ order: o, item: it })));
    const sorted = [...allItems].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortKey) {
        case 'id':
          aValue = a.order.orderNumber || a.order.id;
          bValue = b.order.orderNumber || b.order.id;
          break;
        case 'time':
          aValue = a.order.createdAt || '';
          bValue = b.order.createdAt || '';
          break;
        case 'itemName':
          aValue = a.item.name;
          bValue = b.item.name;
          break;
        case 'category':
          aValue = a.item.category || menuIdToCategory[a.item.id] || '';
          bValue = b.item.category || menuIdToCategory[b.item.id] || '';
          break;
        case 'status':
          aValue = a.item.status || a.order.status;
          bValue = b.item.status || b.order.status;
          break;
        case 'customerName':
          aValue = a.order.guestName || '';
          bValue = b.order.guestName || '';
          break;
        case 'room':
          aValue = a.order.roomNumber || '';
          bValue = b.order.roomNumber || '';
          break;
        case 'table':
          aValue = a.order.table;
          bValue = b.order.table;
          break;
        case 'venue':
          aValue = a.order.venue;
          bValue = b.order.venue;
          break;
        case 'qty':
          aValue = a.item.qty;
          bValue = b.item.qty;
          break;
        case 'amount':
          aValue = a.item.price * a.item.qty;
          bValue = b.item.price * b.item.qty;
          break;
        case 'discount':
          aValue = ((a.item as any).discountPerUnit || 0) * a.item.qty;
          bValue = ((b.item as any).discountPerUnit || 0) * b.item.qty;
          break;
        case 'price':
          aValue = a.item.price - ((a.item as any).discountPerUnit || 0) + (((a.item as any).serviceChargePerUnit || 0));
          bValue = b.item.price - ((b.item as any).discountPerUnit || 0) + (((b.item as any).serviceChargePerUnit || 0));
          break;
        case 'waiter':
          aValue = waiters.find(w => w.id === a.order.waiterId)?.name || a.order.waiterId;
          bValue = waiters.find(w => w.id === b.order.waiterId)?.name || b.order.waiterId;
          break;
        default:
          aValue = a.order.id;
          bValue = b.order.id;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [orders, menuIdToCategory, waiters, sortKey, sortDirection]);

  const activityStatusOptions = useMemo(
    () => Array.from(new Set(sortedOrders.map(({ order, item }) => item.status || order.status))).sort(),
    [sortedOrders]
  );

  const filteredActivityRows = useMemo(() => {
    const term = activitySearch.trim().toLowerCase();
    return sortedOrders.filter(({ order, item }) => {
      const status = item.status || order.status;
      if (activityStatusFilter !== 'all' && status !== activityStatusFilter) return false;
      if (!term) return true;
      const haystack = [
        order.orderNumber, order.id, item.name, order.guestName, order.table, order.roomNumber,
        waiters.find(w => w.id === order.waiterId)?.name || order.waiterId,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [sortedOrders, activitySearch, activityStatusFilter, waiters]);

  const totalActivityPages = Math.max(1, Math.ceil((filteredActivityRows.length || 0) / (activityRowsPerPage || 10)));
  React.useEffect(() => {
    if (activityPage > totalActivityPages) setActivityPage(totalActivityPages);
  }, [activityRowsPerPage, filteredActivityRows.length, totalActivityPages, activityPage]);
  React.useEffect(() => {
    setActivityPage(1);
  }, [activitySearch, activityStatusFilter]);

  const openActivityModal = (o: FBOrder, it: any) => {
    setActivitySelected({ order: o, item: it });
    setActivityQty(it.qty || 0);
    setActivityTable(o.table);
    setActivityVenue(o.venue as VenueMode);
    setActivityWaiter(o.waiterId);
  };

  // The FBOrder -> cart-shaped order mapping needed by both "Edit in Cart" and
  // "Pay" in the View modal below — was duplicated inline at each call site.
  const mapOrderForCart = (o: FBOrder) => ({
    id: o.id,
    table: o.table,
    waiterId: o.waiterId,
    items: o.items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, category: '', route: i.route })),
    status: o.status as any,
    customerType: o.customerType as any,
    venue: o.venue as any,
    notes: o.notes,
    urgent: o.urgent,
    priority: o.priority,
  } as any);

  // Loads the order into the cart and opens the payment modal — the same "Pay" path
  // the POS Activity Table's own row used to offer as its own button, now reached
  // from inside the View modal instead (see the "POS Item Actions" Modal below).
  const openPaymentForOrder = (o: FBOrder) => {
    loadOrderIntoCart(mapOrderForCart(o));
    paymentModal.onOpen();
  };

  const activityReceipt = () => {
    if (!activitySelected) return;
    const { order: o, item: it } = activitySelected;
    previewReceipt({
      hotelName,
      code: `${o.id}-${it.id}`,
      datetime: new Date().toLocaleString(),
      items: [{ name: it.name, qty: it.qty, price: it.price }],
      subtotal: it.qty * it.price,
      discount: ((it as any).discountPerUnit || 0) * it.qty,
      total: (it.price * it.qty) - (((it as any).discountPerUnit || 0) * it.qty),
      table: o.table,
      waiter: waiters.find(w => w.id === o.waiterId)?.name || o.waiterId,
    });
    logAudit({ area: 'f&b', action: 'print', entity: 'Receipt', entityId: `${o.id}-${it.id}`, details: `Printed receipt for ${it.name}`, meta: { table: o.table, waiter: o.waiterId }});
  };

  const activityEdit = async () => {
    if (!activitySelected) return;
    const { order: o, item: it } = activitySelected;
    ordersStore.updateItem(o.id, it.id, { qty: activityQty });
    if (activityTable !== o.table || activityVenue !== (o.venue as VenueMode) || activityWaiter !== o.waiterId) {
      ordersStore.updateOrder(o.id, { table: activityTable, venue: activityVenue as any, waiterId: activityWaiter });
    }
    logAudit({ area: 'f&b', action: 'update', entity: 'OrderItem', entityId: `${o.id}-${it.id}`, details: `Edited qty to ${activityQty}`, meta: { table: activityTable, waiter: activityWaiter, venue: activityVenue }});
    // Persist to DB — PATCH order-level fields (table, serverName)
    try {
      await fetch(`/api/fb/orders/${o.id}`, {
        method: 'PATCH',
        headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          tableNumber: activityTable,
          serverName: waiters.find(w => w.id === activityWaiter)?.name || activityWaiter,
        }),
      });
    } catch { /* silent — in-memory store already updated */ }
    setActivitySelected(null);
  };

  const doCancelWithReason = (reason: string) => {
    if (!activitySelected) return;
    const { order: o, item: it } = activitySelected;
    const wasServed = (it.status === 'served' || o.status === 'served');
    if (wasServed && !reason) return;
    ordersStore.removeItem(o.id, it.id);
    try { kitchenOpsStore.add({ orderId: o.id, table: o.table, waiterId: o.waiterId, itemId: it.id, itemName: it.name, action: 'status', fromStatus: (it.status as any) || 'pending', toStatus: 'pending', notes: `Cancelled${wasServed ? ' after served' : ''}${reason ? `: ${reason}` : ''}` }); } catch {}
    trackEvent('FB.OrderItemCancelled' as any, { orderId: o.id, itemId: it.id, served: wasServed, reason }, { sourceModule: 'F&B' });
    logAudit({ area: 'f&b', action: 'delete', entity: 'OrderItem', entityId: `${o.id}-${it.id}`, details: `Cancelled ${it.name}${wasServed ? ' (after served)' : ''}${reason ? ` - ${reason}` : ''}`, meta: { table: o.table, waiter: o.waiterId }});
    setActivitySelected(null);
  };

  const activityChangeOrder = () => {
    if (!activitySelected) return;
    const { order: o, item: it } = activitySelected;
    ordersStore.updateOrder(o.id, { table: activityTable, venue: activityVenue as any, waiterId: activityWaiter });
    logAudit({ area: 'f&b', action: 'status', entity: 'Order', entityId: o.id, details: `Changed order to table ${activityTable}, venue ${activityVenue}`, meta: { fromTable: o.table, fromVenue: o.venue }});
    setActivitySelected(null);
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.id === item.id && ci.note === undefined);
      if (existing) {
        return prev.map(ci => ci.id === item.id && ci.note === undefined ? { ...ci, qty: ci.qty + 1 } : ci);
      }
      return [...prev, { ...item, qty: 1, discountPerUnit: 0, serviceChargePerUnit: 0, isRoomService: false }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev
      .map(ci => ci.id === id ? { ...ci, qty: Math.max(0, ci.qty + delta) } : ci)
      .filter(ci => ci.qty > 0));
  };

  /** Clear cart items. Pass keepSentOrder=true after Send so the Pay flow can reuse the DB order. */
  const clearCart = (keepSentOrder = false) => {
    setCart([]);
    if (!keepSentOrder) setSentOrderData(null);
  };

  const rawServiceChargeAmount = cart.reduce((sum, ci) => sum + (ci.serviceChargePerUnit || 0) * ci.qty, 0);
  const serviceChargeAmount = orderMode === 'Dine-in' ? rawServiceChargeAmount : 0;
  const subtotal = cart.reduce((sum, ci) => sum + ci.price * ci.qty, 0);
  const itemDiscountAmount = cart.reduce((sum, ci) => sum + (ci.discountPerUnit || 0) * ci.qty, 0);
  const orderDiscountAmount = Math.round(subtotal * discountPercent / 100 * 100) / 100;
  const totalBeforeTip = Math.max(0, subtotal - itemDiscountAmount - orderDiscountAmount + serviceChargeAmount + (orderMode === 'Takeaway' ? (packagingFee || 0) : 0));
  const total = Math.max(0, totalBeforeTip);
  const grandTotal = Math.max(0, total + (tipAmount || 0));
  const splitPaid = splitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const splitRemaining = Math.max(0, grandTotal - splitPaid);

  // Distribute order-level discount across items as per-unit discounts for activity log/store
  const distributeOrderDiscountPerUnit = (items: CartItem[]) => {
    if (!discountPercent || subtotal <= 0) {
      return items.map(i => ({ ...i, discountPerUnit: i.discountPerUnit || 0 }));
    }
    const target = Math.max(0, (subtotal * discountPercent) / 100);
    const amounts = items.map(i => ({ id: i.id, line: i.price * i.qty }));
    const sumLines = amounts.reduce((s, a) => s + a.line, 0) || 1;
    // preliminary allocation
    let allocated = 0;
    const perItemTotalDiscount = amounts.map((a, idx) => {
      const raw = target * (a.line / sumLines);
      const rounded = idx === amounts.length - 1 ? (target - allocated) : Math.round(raw * 100) / 100;
      allocated += idx === amounts.length - 1 ? 0 : rounded;
      return { id: a.id, total: Math.max(0, rounded) };
    });
    // convert to per-unit
    const withPerUnit = items.map(i => {
      const d = perItemTotalDiscount.find(x => x.id === i.id)?.total || 0;
      const perUnit = i.qty > 0 ? Math.min(i.price, Math.round((d / i.qty) * 100) / 100) : 0;
      return { ...i, discountPerUnit: perUnit };
    });
    return withPerUnit;
  };

  const sendOrder = async () => {
    if (cart.length === 0) return;
    if (customerType === 'In-house' && (!roomNumber || !guestName)) {
      alert('Please select a room and guest for in-house orders');
      return;
    }
    setIsSending(true);

    const itemsWithOrderDiscount = distributeOrderDiscountPerUnit(cart);
    // A walk-in not matching a saved customer profile still typed a real name —
    // that's not "no guest", it's just not-yet-a-saved-profile. Falling back to
    // undefined here silently dropped the name from the order entirely.
    const guestDisplayName = customerType === 'In-house'
      ? guestName
      : (selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}`.trim() : (walkInSearchTerm.trim() || 'Walk-in Customer'));

    // ── POST to database API (source of truth for KDS) ─────────────────────
    let apiId: string | null = null;
    const orderNumber = useSettingsStore.getState().getNextModuleNumber('foodBeverage', 'order');
    try {
      const data = await createFbOrder({
        orderNumber,
        venue: normalizePosVenue(venue),
        tableNumber,
        roomNumber: customerType === 'In-house' ? roomNumber : undefined,
        guestId: selectedGuest?.guestId,
        guestName: guestDisplayName,
        serverName: waiters.find(w => w.id === waiterId)?.name || waiterId,
        notes: orderNotes,
        covers: 1,
        discountAmount: orderDiscountAmount,
        serviceCharge: serviceChargeAmount,
        priority,
        items: itemsWithOrderDiscount.map(i => ({
          menuItemId: (i as any).code ? undefined : i.id,
          name: i.name,
          category: i.category,
          quantity: i.qty,
          unitPrice: i.price,
          notes: i.note,
          route: i.route,
        })),
      });
      apiId = data.order?.id ?? null;
      if (apiId && data.order) {
        setSentOrderData({
          id: apiId,
          subtotal: Number(data.order.subtotal),
          taxAmount: Number(data.order.taxAmount),
          total: Number(data.order.total),
        });
      }
    } catch (err: any) {
      console.error('[FBPOS] sendOrder API error:', err);
      alert(
        `Order could not reach the kitchen display (${err?.message || 'network error'}). ` +
        'It was saved locally in POS only — open Kitchen Display after fixing the connection.'
      );
    }
    // isSending stays true until function completes (reset at end)

    // ── Mirror to in-memory store for immediate UI reactivity ───────────────
    const id = apiId ?? `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder: PendingOrder = { id, table: tableNumber, waiterId, items: cart, status: 'pending', customerType, venue, notes: orderNotes, urgent: priority === 'urgent', priority };
    setPendingOrders(prev => [newOrder, ...prev]);
    ordersStore.add({
      id,
      orderNumber,
      table: tableNumber,
      waiterId,
      items: itemsWithOrderDiscount.map(i => ({
        id: i.id, name: i.name, price: i.price, qty: i.qty, route: i.route,
        status: 'pending', prepMinutes: i.route === 'kitchen' ? 15 : 2,
        isRoomService: i.isRoomService || false,
        discountPerUnit: i.discountPerUnit || 0,
        serviceChargePerUnit: i.serviceChargePerUnit || 0,
      })),
      status: 'pending',
      customerType,
      venue,
      notes: orderNotes,
      urgent: priority === 'urgent',
      priority,
      guestName: guestDisplayName,
      roomNumber: customerType === 'In-house' ? roomNumber : undefined,
    } as any);

    // Auto-issue items to Stores
    cart.forEach(i => {
      storesIssueBus.issue({ sku: i.id, name: i.name, qty: i.qty, uom: 'ea', department: i.route === 'bar' ? 'Bar' : 'Kitchen', referenceId: id });
    });
    trackEvent('FB.OrderPlaced', { id, table: tableNumber, waiterId, items: itemsWithOrderDiscount.map(i => ({ id: i.id, qty: i.qty, discountPerUnit: i.discountPerUnit || 0 })), venue, customerType }, { sourceModule: 'F&B' });
    trackEvent('FB.KOT.Created', { id, urgent: priority === 'urgent' }, { sourceModule: 'F&B' });
    clearCart(true); // keepSentOrder=true — Pay flow will reuse this DB order
    setOrderNotes('');
    setPriority('high');
    setIsSending(false);
  };

  const openPayment = () => paymentModal.onOpen();

  const handlePayment = async (paymentMethod: PaymentMethod, amount: number) => {
    if (cart.length === 0) return;
    if (isProcessingPayment) return; // guard against double-click double-charging the guest

    // Validate in-house customer selection
    if (customerType === 'In-house' && (!roomNumber || !guestName)) {
      alert('Please select a room and guest for in-house orders');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const itemsWithOrderDiscount = distributeOrderDiscountPerUnit(cart);
      const guestDisplayName = customerType === 'In-house'
        ? guestName
        : (selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}`.trim() : (walkInSearchTerm.trim() || 'Walk-in Customer'));

      // ── Resolve DB order ─────────────────────────────────────────────────────
      // If waiter already clicked "Send to Kitchen", reuse that order (no duplicate POST).
      // If paying without sending (express pay), create the order now.
      let apiOrder: any = null;
      let finalSubtotal = subtotal;
      let totalTax = 0;
      let total = subtotal; // fallback — replaced by API data

      if (sentOrderData) {
        // Reuse existing DB order created by sendOrder()
        apiOrder = { id: sentOrderData.id };
        finalSubtotal = sentOrderData.subtotal;
        totalTax = sentOrderData.taxAmount;
        total = sentOrderData.total;
      } else {
        // Express pay: create order now (single-step: order + pay)
        try {
          const data = await createFbOrder({
            orderNumber: useSettingsStore.getState().getNextModuleNumber('foodBeverage', 'order'),
            venue: normalizePosVenue(venue),
            tableNumber,
            roomNumber: customerType === 'In-house' ? roomNumber : undefined,
            guestId: selectedGuest?.guestId,
            guestName: guestDisplayName,
            serverName: waiters.find(w => w.id === waiterId)?.name || waiterId,
            notes: orderNotes,
            covers: 1,
            discountAmount: orderDiscountAmount,
            serviceCharge: serviceChargeAmount,
            items: itemsWithOrderDiscount.map(i => ({
              menuItemId: i.id,
              name: i.name,
              category: i.category,
              quantity: i.qty,
              unitPrice: i.price,
              notes: i.note,
              route: i.route,
            })),
          });
          apiOrder = data.order;
          finalSubtotal = Number(apiOrder.subtotal);
          totalTax = Number(apiOrder.taxAmount);
          total = Number(apiOrder.total);
        } catch (err) {
          console.warn('[FBPOS] handlePayment API error:', err);
          // Order creation failed — fall back to the real configured stacked tax rate
          // (VAT/NHIL/GETFund/Tourism from Settings → Tax Rate Builder) instead of a
          // hardcoded 21%, which was both wrong (the real Ghana stack is 21.9%) and stale
          // the moment anyone changes a rate.
          totalTax = computeSalesTaxTotal(subtotal);
          total = subtotal + totalTax;
        }
      }

      // For any payment: advance order through state machine to 'billed'
      // State machine requires: pending→preparing→ready→served→billed. The order may
      // already be past 'pending' (kitchen staff can advance it via KDS independently
      // of this POS), so read its REAL current status instead of assuming — an invalid
      // transition attempt is rejected by the server (400) and must not be swallowed,
      // since silently continuing here means the guest gets charged for an order that
      // was never actually billed on the server.
      const STATUS_SEQUENCE: FbOrderStatus[] = ['pending', 'preparing', 'ready', 'served', 'billed'];
      if (apiOrder?.id) {
        let currentStatus: string = 'pending';
        if (sentOrderData) {
          const liveOrder = await fetchFbOrderById(apiOrder.id);
          currentStatus = liveOrder.status;
        }
        if (currentStatus === 'cancelled' || currentStatus === 'billed') {
          throw new Error(`Order is already '${currentStatus}' and cannot be billed`);
        }
        const startIdx = STATUS_SEQUENCE.indexOf(currentStatus as FbOrderStatus);
        const remainingSteps = startIdx === -1 ? STATUS_SEQUENCE.slice(1) : STATUS_SEQUENCE.slice(startIdx + 1);
        for (const status of remainingSteps) {
          await patchFbOrderStatus(apiOrder.id, status);
        }
        // 'billed' PATCH triggers auto-folio posting for Room Charge orders
      }

      const newId = apiOrder?.id ?? `ORD-${Date.now().toString().slice(-6)}`;

      // ── Mirror to in-memory store for immediate UI reactivity ───────────────
      ordersStore.add({
        id: newId,
        table: tableNumber,
        waiterId,
        items: itemsWithOrderDiscount.map(i => ({
          id: i.id, name: i.name, price: i.price, qty: i.qty, route: i.route,
          status: 'billed', prepMinutes: i.route === 'kitchen' ? 15 : 2,
          isRoomService: i.isRoomService || false,
          discountPerUnit: i.discountPerUnit || 0,
          serviceChargePerUnit: i.serviceChargePerUnit || 0,
        })),
        status: 'billed',
        customerType,
        venue,
        notes: orderNotes,
        urgent: priority === 'urgent',
        priority,
        guestName: guestDisplayName,
        roomNumber: customerType === 'In-house' ? roomNumber : undefined,
      } as any);

      // Update inventory (demo issue movements)
      cart.forEach(cartItem => {
        storesStore.createStockMovement({
          movementType: 'issue',
          itemId: cartItem.id,
          itemName: cartItem.name,
          quantity: cartItem.qty,
          unitPrice: 0,
          reference: `FB-SALE-${newId}`,
          notes: `Sold in ${venue}`,
          department: 'F&B',
          costCenter: venue === 'Restaurant' ? 'REST' : 'BAR'
        });
      });

      // ===== ACCOUNTING INTEGRATION =====
      // Cash/card/MoMo: capture in GL immediately.
      // Room Charge: folio posting already handled above via API PATCH to 'billed'.
      if (paymentMethod !== 'Room Charge') {
        try {
          const departmentSource: DepartmentSource = venue === 'Restaurant' ? 'restaurant'
            : venue === 'Bar' ? 'bar'
            : 'restaurant';
          const accountingPaymentMethod = paymentMethod as 'Cash' | 'Card' | 'Mobile Money';
          const taxPercent = finalSubtotal > 0 ? (totalTax / finalSubtotal) * 100 : 0;
          const currentWaiter = waiters.find(w => w.id === waiterId);
          const staffInfo = {
            staffId: waiterId,
            staffName: currentWaiter?.name || waiterId,
            staffRole: venue === 'Bar' ? 'Bartender' : 'Waiter/Cashier',
          };
          const result = captureCompleteSale(
            {
              id: newId,
              source: departmentSource,
              customerId: customerType === 'In-house' && roomNumber ? `ROOM-${roomNumber}` : undefined,
              customerName: guestDisplayName,
              reference: newId,
              description: `${venue} Sale - Table ${tableNumber || 'N/A'}`,
              items: cart.map(item => ({
                description: item.name,
                quantity: item.qty,
                unitPrice: item.price,
                taxPercent,
              })),
              subtotal: finalSubtotal,
              taxAmount: totalTax,
              total,
              ...staffInfo,
            },
            {
              id: `PAY-${newId}`,
              customerName: guestDisplayName,
              amount: total,
              paymentMethod: accountingPaymentMethod,
              reference: newId,
              description: `Payment for ${venue} order ${newId}`,
              ...staffInfo,
            }
          );
          if (result) {
            console.log(`[F&B POS] ✅ Accounting captured - Invoice: ${result.invoiceId}, Receipt: ${result.receiptId}`);
          }
        } catch (err) {
          console.error('[F&B POS] ❌ Accounting integration error:', err);
          // The order IS billed server-side at this point (state-machine transitions above
          // already succeeded) — don't roll that back over an accounting hiccup, but do
          // surface it: a silently-lost GL capture here is real revenue with no ledger entry.
          alert(`Order ${newId} was billed, but recording it in accounting failed. Please notify a manager to post it manually.`);
        }
      }

      // Track payment received
      trackEvent('Payment.Received', { orderId: newId, venue, customerType, total, itemCount: cart.length }, { sourceModule: 'F&B' });

      // Clear cart and show success
      setCart([]);
      setDiscountPercent(0);
      setOrderNotes('');
      
      // Print receipt for immediate payments
      if (paymentMethod !== 'Room Charge') {
        printReceipt({
          hotelName,
          contact: 'Accra, Ghana',
          code: `RCPT-${newId}`,
          datetime: new Date().toLocaleString(),
          items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
          subtotal: finalSubtotal,
          discount: orderDiscountAmount,
          total,
          table: tableNumber,
          waiter: waiters.find(w => w.id === waiterId)?.name,
        });
      }

      // Close payment modal
      paymentModal.onClose();

    } catch (error) {
      console.error('Payment processing error:', error);
      alert(`Payment failed: ${error instanceof Error ? error.message : 'unknown error'}. The order was NOT billed — please retry.`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const printKOT = () => {
    if (cart.length === 0) return;
    const args = { code: `KOT-${Date.now().toString().slice(-6)}`, table: tableNumber, waiter: waiters.find(w => w.id === waiterId)?.name || waiterId, notes: orderNotes, urgent: priority === 'urgent', items: cart.map(i => ({ name: i.name, qty: i.qty })) };
    printKOTDoc(args);
  };

  const reopenOrderToCart = (order: PendingOrder) => {
    setSelectedOrder(order);
    orderDetailModal.onOpen();
  };

  const openStoreOrder = (order: FBOrder) => {
    const mapped: PendingOrder = {
      id: order.id,
      table: order.table,
      waiterId: order.waiterId,
      items: order.items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, category: '', route: i.route })),
      status: order.status as PendingOrder['status'],
      customerType: order.customerType as CustomerType,
      venue: order.venue as VenueMode,
      notes: order.notes,
      urgent: order.urgent,
      priority: order.priority,
    };
    reopenOrderToCart(mapped);
  };

  const updateSelectedOrder = (mutator: (o: PendingOrder) => PendingOrder) => {
    if (!selectedOrder) return;
    const updated = mutator({ ...selectedOrder });
    setSelectedOrder(updated);
    setPendingOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    trackEvent('FB.OrderUpdated', { id: updated.id, status: updated.status, items: updated.items.map(i => ({ id: i.id, qty: i.qty })) }, { sourceModule: 'F&B' });
    // Reflect changes to shared store
    ordersStore.update({
      id: updated.id,
      table: updated.table,
      waiterId: updated.waiterId,
      items: updated.items,
      status: updated.status,
      customerType: updated.customerType,
      venue: updated.venue,
      notes: updated.notes,
      urgent: updated.urgent,
    } as any);
  };

  const changeOrderStatus = async (orderId: string, status: PendingOrder['status']) => {
    setPendingOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    ordersStore.update({ id: orderId, status } as any);
    trackEvent('FB.OrderStatusChanged', { id: orderId, status }, { sourceModule: 'F&B' });
    const apiStatus =
      status === 'sent' ? 'preparing'
      : status === 'paid' ? 'billed'
      : status;
    try {
      await patchFbOrderStatus(orderId, apiStatus);
    } catch { /* silent — in-memory store already updated */ }
    const found = pendingOrders.find(o => o.id === orderId);
    if (found) {
      ordersStore.update({ ...found, status } as any);
    }
  };

  const loadOrderIntoCart = (o: PendingOrder) => {
    setCart(o.items);
    setTableNumber(o.table);
    setWaiterId(o.waiterId);
    setVenue(o.venue);
    setCustomerType(o.customerType);
    setOrderNotes(o.notes || '');
    setPriority(o.priority || (o.urgent ? 'urgent' : 'low'));
    setEditingOrderId(o.id);
    try { setTimeout(() => cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); } catch {}
  };

  const deleteOrder = (orderId: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    ordersStore.remove(orderId);
  };

  const requestDeleteWithPin = (orderId: string) => {
    setPendingManagerAction({ type: 'delete', orderId });
    setPinValue('');
    setPinError('');
    managerPinModal.onOpen();
  };

  const confirmManagerPin = () => {
    if (pinValue === managerPin) {
      if (pendingManagerAction?.type === 'delete') {
        deleteOrder(pendingManagerAction.orderId);
      }
      managerPinModal.onClose();
      setPendingManagerAction(null);
      setPinValue('');
      setPinError('');
    } else {
      setPinError('Incorrect PIN');
    }
  };

  // Shortcuts: Ctrl+Enter (Send), Ctrl+P (Pay), Esc (Back)
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'enter') {
        e.preventDefault();
        sendOrder();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        openPayment();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sendOrder, openPayment, onClose]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-ghana-black">🛒 POS Terminal</h1>
          <div className="flex gap-2">
            <Button variant="flat" className="bg-gray-200" onClick={() => {
              try {
                const evt = new CustomEvent('app.navigate', { detail: { section: 'fb-kitchen' } });
                window.dispatchEvent(evt);
              } catch {}
            }}>Kitchen Orders</Button>
            <Button variant="flat" className="bg-gray-200" onClick={onClose}>Back to F&B</Button>
          </div>
        </div>

        

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2"><h3 className="font-semibold text-ghana-black">Order Context</h3></CardHeader>
              <CardBody className="space-y-3">
                <Select label="Venue" selectedKeys={[venue]} onSelectionChange={(k) => setVenue(Array.from(k as Set<string>)[0] as VenueMode)}>
                  <SelectItem key="Restaurant">Restaurant</SelectItem>
                  <SelectItem key="Bar">Bar</SelectItem>
                </Select>
                <Select label="Customer Type" selectedKeys={[customerType]} onSelectionChange={(k) => handleCustomerTypeChange(Array.from(k as Set<string>)[0] as CustomerType)}>
                  <SelectItem key="In-house">In-house</SelectItem>
                  <SelectItem key="Walk-in">Walk-in</SelectItem>
                </Select>
                {/* Unified guest/customer search directly under customer type */}
                {customerType === 'In-house' ? (
                  <div>
                    <Input 
                      label="Room Number" 
                      placeholder="Search by room number or guest name..."
                      value={roomSearchTerm || roomNumber}
                      onChange={(e) => {
                        setRoomSearchTerm(e.target.value);
                        if (!e.target.value) {
                          setRoomNumber('');
                          setGuestName('');
                          setSelectedGuest(null);
                        }
                      }}
                      onFocus={() => setRoomSearchTerm(roomNumber)}
                      startContent={<span>🏨</span>}
                    />
                    {roomSearchTerm && filteredRooms.length > 0 && (
                      <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg z-10">
                        {filteredRooms.map((room) => (
                          <div
                            key={room.roomId}
                            className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleRoomSelect(room)}
                          >
                            <div className="font-medium">Room {room.roomId}</div>
                            <div className="text-sm text-gray-600">{room.guestName} • {room.roomType}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <Input 
                      label="Customer (Walk-in)" 
                      placeholder="Search by name, phone, or email..."
                      value={walkInSearchTerm || (selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}` : '')}
                      onChange={(e) => {
                        setWalkInSearchTerm(e.target.value);
                        if (!e.target.value) {
                          setSelectedWalkIn(null);
                        }
                      }}
                      onFocus={() => { setWalkInFocused(true); setWalkInSearchTerm(selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}` : ''); }}
                      onBlur={() => { setTimeout(() => setWalkInFocused(false), 150); }}
                      startContent={<span>🧾</span>}
                    />
                    {(walkInFocused || !!walkInSearchTerm) && filteredWalkIns.length > 0 && (
                      <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg z-10">
                        {filteredWalkIns.map((c) => (
                          <div
                            key={c.id}
                            className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleWalkInSelect(c)}
                          >
                            <div className="font-medium">{c.firstName} {c.lastName}</div>
                            <div className="text-sm text-gray-600">
                              {c.phone && `📞 ${c.phone}`}
                              {c.email && ` • ✉️ ${c.email}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Select label="Order Mode" selectedKeys={[orderMode]} onSelectionChange={(k) => setOrderMode(Array.from(k as Set<string>)[0] as any)}>
                    <SelectItem key="Dine-in">Dine-in</SelectItem>
                    <SelectItem key="Takeaway">Takeaway</SelectItem>
                  </Select>
                  {orderMode === 'Takeaway' ? (
                    <Input type="number" label="Packaging Fee (₵)" value={String(packagingFee)} onChange={(e) => setPackagingFee(Number(e.target.value || 0))} />
                  ) : (
                    <div />
                  )}
                </div>

                {customerType === 'In-house' && (
                  <div className="space-y-3">
                    {selectedGuest && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="text-sm text-green-800">
                          <div className="font-medium">✓ Guest Selected</div>
                          <div>Room: {roomNumber} • Guest: {guestName}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Select label="Waiter/Waitress" selectedKeys={[waiterId]} onSelectionChange={(k) => setWaiterId(Array.from(k as Set<string>)[0])}>
                  {waiters.map(w => (
                    <SelectItem key={w.id}>{w.name}</SelectItem>
                  ))}
                </Select>
                <Select label="Table" selectedKeys={[tableNumber]} onSelectionChange={(k) => setTableNumber(Array.from(k as Set<string>)[0])}>
                  {tables.map(t => (
                    <SelectItem key={t}>{t}</SelectItem>
                  ))}
                </Select>
                <Input label="Order notes / allergies" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Select label="Room Service" selectedKeys={[applyRoomServiceCharge ? 'yes' : 'no']} onSelectionChange={(k) => setApplyRoomServiceCharge(Array.from(k as Set<string>)[0] === 'yes')}>
                    <SelectItem key="no">No</SelectItem>
                    <SelectItem key="yes">Yes</SelectItem>
                  </Select>
                  <Input type="number" label="Room Service Charge / Unit (₵)" value={String(roomServiceChargePerUnit)} onChange={(e) => setRoomServiceChargePerUnit(Number(e.target.value || 0))} />
                </div>
                <Button variant="flat" className="w-full bg-green-50 text-ghana-green border border-ghana-green/30" onClick={newItemModal.onOpen}>Add Menu Item</Button>
              </CardBody>
            </Card>

            {/* Orders table removed per request; replaced by POS Activity Table at top of screen */}
          </div>

          <div className="lg:col-span-2 relative">
            {/* Wide screens: the card is laid over the row and scrolls inside, so a long menu never makes it taller than Order Context. */}
            <Card className="border-0 shadow-lg lg:absolute lg:inset-0">
              <CardHeader className="pb-2 flex-col items-stretch gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-ghana-black">Menu</h3>
                    {menuLoading && <span className="text-xs text-gray-400 animate-pulse">Loading from database…</span>}
                    {!menuLoading && menu.length === 0 && <span className="text-xs text-orange-500">No menu items found. Run accounting setup to seed.</span>}
                  </div>
                  <Input aria-label="Search menu" size="sm" className="max-w-[16rem]" placeholder="Search menu" value={search} onValueChange={setSearch} isClearable onClear={() => setSearch('')} />
                </div>
                {!searching && menuTabs.length > 0 && (
                  <Tabs aria-label="Menu categories" selectedKey={activeTab} onSelectionChange={(k) => setMenuTab(String(k))}>
                    {menuTabs.map(t => <Tab key={t} title={t === PINNED_TAB ? `★ Pinned (${pinnedItems.length})` : t} />)}
                  </Tabs>
                )}
              </CardHeader>
              <CardBody className="min-h-0 max-h-[70vh] lg:max-h-none">
                {shownMenu.length === 0 ? (
                  <p className="text-sm text-gray-500">{searching ? 'No items match your search.' : 'No items here yet.'}</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {shownMenu.map(mi => (
                      <div key={mi.id} className="relative">
                        <button className="w-full h-full p-3 rounded-lg border border-gray-200 bg-white text-left hover:bg-gray-50" onClick={() => addToCart(mi)}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-ghana-black">{mi.name}</div>
                              <div className="text-xs text-gray-500 capitalize">{mi.route}</div>
                            </div>
                            <div className="text-sm font-semibold">₵{mi.price}</div>
                          </div>
                        </button>
                        <button
                          aria-label={mi.isPinned ? `Unpin ${mi.name}` : `Pin ${mi.name}`}
                          title={mi.isPinned ? 'Unpin' : 'Pin to the top'}
                          className={`absolute bottom-1 right-2 text-base leading-none ${mi.isPinned ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
                          onClick={() => togglePin(mi)}
                        >
                          {mi.isPinned ? '★' : '☆'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-ghana-black">Current Order</h3>
                  <Chip size="sm" variant="flat" color="primary">{venue}</Chip>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="flat" className="bg-gray-100" onClick={() => setShowItemDiscounts(v => !v)}>
                    {showItemDiscounts ? 'Hide Item Discounts' : 'Show Item Discounts'}
                  </Button>
                </div>
              </CardHeader>
              <CardBody {...({ ref: cartRef } as any)}>
                <div className="space-y-3">
                  {cart.length === 0 && (
                    <div className="text-sm text-gray-500">No items added.</div>
                  )}
                  {cart.map(ci => (
                    <div key={ci.id} className="border-b border-gray-100 pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-ghana-black">{ci.name}</div>
                          <div className="text-xs text-gray-500 capitalize">{ci.route}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="flat" className="bg-gray-100" onClick={() => updateQty(ci.id, -1)}>-</Button>
                          <div className="w-6 text-center text-sm">{ci.qty}</div>
                          <Button size="sm" variant="flat" className="bg-gray-100" onClick={() => updateQty(ci.id, 1)}>+</Button>
                          <div className="w-16 text-right text-sm">₵{((ci.price - (ci.discountPerUnit || 0) + (ci.serviceChargePerUnit || 0)) * ci.qty).toFixed(2)}</div>
                        </div>
                      </div>
                      {showItemDiscounts && (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs items-center">
                          <Input 
                            size="sm" 
                            type="number" 
                            label="Disc/Unit (₵)" 
                            value={String(ci.discountPerUnit || 0)} 
                            onChange={(e) => setCart(prev => prev.map(x => x.id === ci.id ? { ...x, discountPerUnit: Number(e.target.value || 0) } : x))} 
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>₵{subtotal.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between">
                    <span>Discount (%)</span>
                    <Input className="w-24" type="number" value={String(discountPercent)} onChange={(e) => setDiscountPercent(Number(e.target.value || 0))} />
                  </div>
                  <div className="flex justify-between"><span>Discount</span><span>-₵{orderDiscountAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Service Charge</span><span>₵{serviceChargeAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Pre-tax Total</span><span>₵{total.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-gray-400"><span>~Ghana Tax (VAT+NHIL+GETFund+Tourism)</span><span>₵{computeSalesTaxTotal(total).toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-ghana-black border-t pt-1 mt-1"><span>Est. Total (incl. tax)</span><span>₵{(total + computeSalesTaxTotal(total)).toFixed(2)}</span></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="flat" className="bg-ghana-green text-white" onClick={() => {
                    if (editingOrderId) {
                      // Update existing order instead of creating a new one
                      const existing = orders.find(o => o.id === editingOrderId);
                      if (existing) {
                        const itemsWithOrderDiscount = distributeOrderDiscountPerUnit(cart);
                        const updated = {
                          ...existing,
                          table: tableNumber,
                          waiterId,
                          venue,
                          notes: orderNotes,
                          items: itemsWithOrderDiscount.map(i => ({
                            id: i.id,
                            name: i.name,
                            price: i.price,
                            qty: i.qty,
                            route: i.route,
                            status: (existing.items.find(x => x.id === i.id)?.status) || 'pending',
                            prepMinutes: i.route === 'kitchen' ? 15 : 2,
                            isRoomService: i.isRoomService || false,
                            discountPerUnit: i.discountPerUnit || 0,
                            serviceChargePerUnit: i.serviceChargePerUnit || 0
                          }))
                        } as any;
                        // Reflect to store and local pending list
                        ordersStore.update(updated);
                        trackEvent('FB.OrderUpdated', { id: updated.id, items: updated.items.map((it: any) => ({ id: it.id, qty: it.qty, discountPerUnit: it.discountPerUnit || 0 })) }, { sourceModule: 'F&B' });
                        setPendingOrders(prev => prev.map(po => po.id === editingOrderId ? {
                          ...po,
                          table: updated.table,
                          waiterId: updated.waiterId,
                          venue: updated.venue,
                          notes: updated.notes,
                          items: cart
                        } : po));
                      }
                      setEditingOrderId(null);
                      clearCart();
                      setOrderNotes('');
                      return;
                    }
                    sendOrder();
                  }} isLoading={isSending} isDisabled={isSending || cart.length === 0}>{editingOrderId ? 'Update' : (isSending ? 'Sending…' : 'Send to Kitchen')}</Button>
                  <Button variant="flat" className="bg-gray-200" onClick={() => clearCart()}>Clear</Button>
                  <Button variant="flat" className="bg-blue-600 text-white" onClick={openPayment}>Pay</Button>
                  <Button variant="flat" className="bg-indigo-600 text-white" isDisabled={cart.length === 0} onClick={() => {
                    const html = buildReceiptHtml({
                      hotelName,
                      contact: 'Accra, Ghana',
                      code: `RCPT-${Date.now().toString().slice(-6)}`,
                      datetime: new Date().toLocaleString(),
                      items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
                      subtotal,
                      discount: orderDiscountAmount,
                      total,
                      table: tableNumber,
                      waiter: waiters.find(w => w.id === waiterId)?.name,
                    });
                    setPrintPreview({ title: 'Receipt Preview', html });
                    printPreviewModal.onOpen();
                  }}>Preview</Button>
                  <Select label="Priority" selectedKeys={[priority]} onSelectionChange={(k) => {
                    const p = Array.from(k as Set<string>)[0] as 'low' | 'medium' | 'high' | 'urgent';
                    setPriority(p);
                    localStorage.setItem('kitchen.priority.filter', p);
                  }}>
                    <SelectItem key="urgent">Urgent</SelectItem>
                    <SelectItem key="high">High</SelectItem>
                    <SelectItem key="medium">Medium</SelectItem>
                    <SelectItem key="low">Low</SelectItem>
                  </Select>
                  <Button variant="flat" className="bg-orange-500 text-white" onClick={() => {
                    const args = { code: `KOT-${Date.now().toString().slice(-6)}`, table: tableNumber, waiter: waiters.find(w => w.id === waiterId)?.name || waiterId, notes: orderNotes, urgent: priority === 'urgent', items: (cart.length > 0 ? cart : [
                      { id: 'M1', name: 'Jollof Rice', price: 65, category: 'Mains', route: 'kitchen', qty: 1 },
                      { id: 'D1', name: 'Club Beer', price: 20, category: 'Drinks', route: 'bar', qty: 2 },
                    ]).map(i => ({ name: i.name, qty: i.qty })) };
                    const html = buildKOTHtml(args);
                    setPrintPreview({ title: 'KOT Preview', html });
                    printPreviewModal.onOpen();
                  }}>Print KOT</Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

        {/* Visual divider between POS terminal and Activity Table */}
        <div className="my-6 border-t border-gray-300" />

        {/* POS Activity Table - moved to bottom */}
        <Card className="border border-gray-300 shadow-lg mt-6">
                        <CardHeader className="pb-2 flex items-center justify-between">
                <h3 className="font-semibold text-ghana-black">POS Activity Table</h3>
                <div className="flex items-center gap-2">
                  <Select size="sm" label="Rows" selectedKeys={[String(activityRowsPerPage)]} onSelectionChange={(k) => {
                    const v = Number(Array.from(k as Set<string>)[0] || '10');
                    setActivityRowsPerPage(v);
                    setActivityPage(1);
                  }} className="w-24">
                    <SelectItem key="10">10</SelectItem>
                    <SelectItem key="25">25</SelectItem>
                    <SelectItem key="50">50</SelectItem>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="flat" className="bg-gray-100" isDisabled={activityPage <= 1} onClick={() => setActivityPage(p => Math.max(1, p - 1))}>Prev</Button>
                    <span className="text-xs text-gray-600">Page {activityPage} / {totalActivityPages}</span>
                    <Button size="sm" variant="flat" className="bg-gray-100" isDisabled={activityPage >= totalActivityPages} onClick={() => setActivityPage(p => Math.min(totalActivityPages, p + 1))}>Next</Button>
                  </div>
                </div>
              </CardHeader>
          <CardBody>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Input
                      size="sm"
                      className="w-64"
                      placeholder="Search order #, item, customer, table, waiter..."
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                      startContent={<span className="text-gray-400">🔍</span>}
                      isClearable
                      onClear={() => setActivitySearch('')}
                    />
                    <Select
                      size="sm"
                      label="Status"
                      selectedKeys={[activityStatusFilter]}
                      onSelectionChange={(k) => setActivityStatusFilter(Array.from(k as Set<string>)[0] || 'all')}
                      className="w-40"
                    >
                      <SelectItem key="all">All statuses</SelectItem>
                      <>
                        {activityStatusOptions.map((s) => (
                          <SelectItem key={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </>
                    </Select>
                  </div>
                            <div className="w-full overflow-x-auto max-h-[50vh] overflow-y-auto">
                  <Table aria-label="POS Activity Table - item level log" className="min-w-[1200px]">
                    <TableHeader>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'id') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('id');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        ID {sortKey === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'time') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('time');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        DATE {sortKey === 'time' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn>TIME</TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'itemName') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('itemName');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        ITEM NAME {sortKey === 'itemName' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'category') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('category');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        CATEGORY {sortKey === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'status') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('status');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        STATUS {sortKey === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'customerName') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('customerName');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        CUSTOMER NAME {sortKey === 'customerName' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'room') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('room');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        ROOM {sortKey === 'room' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'table') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('table');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        TABLE {sortKey === 'table' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'venue') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('venue');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        VENUE {sortKey === 'venue' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'qty') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('qty');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        QTY {sortKey === 'qty' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'amount') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('amount');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        AMOUNT {sortKey === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'discount') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('discount');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        DISCOUNT {sortKey === 'discount' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'price') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('price');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        PRICE {sortKey === 'price' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'waiter') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('waiter');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        WAITER/ESS {sortKey === 'waiter' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No matching orders.">
                      {filteredActivityRows.slice((activityPage - 1) * activityRowsPerPage, activityPage * activityRowsPerPage).map(({ order: o, item: it }) => (
                        <TableRow key={`${o.id}-${it.id}`} onDoubleClick={() => openActivityModal(o, it)}>
                          <TableCell>{o.orderNumber || o.id}</TableCell>
                          <TableCell>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '-'}</TableCell>
                          <TableCell>{o.createdAt ? new Date(o.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                          <TableCell>{it.name}</TableCell>
                          <TableCell>{it.category || menuIdToCategory[it.id] || '-'}</TableCell>
                          <TableCell>{(it.status || o.status)}</TableCell>
                          <TableCell>{o.guestName || '-'}</TableCell>
                          <TableCell>{o.roomNumber || '-'}</TableCell>
                          <TableCell><Badge color="primary" variant="flat">{o.table}</Badge></TableCell>
                          <TableCell>{o.venue}</TableCell>
                          <TableCell>{it.qty}</TableCell>
                          <TableCell>₵{(it.price * it.qty).toFixed(2)}</TableCell>
                          <TableCell>₵{(((it as any).discountPerUnit || 0) * it.qty).toFixed(2)}</TableCell>
                          <TableCell>₵{(it.price - ((it as any).discountPerUnit || 0) + (((it as any).serviceChargePerUnit || 0))).toFixed(2)}</TableCell>
                          <TableCell>{waiters.find(w => w.id === o.waiterId)?.name || o.waiterId}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="flat"
                                className={`${(it.status || o.status) === 'served' ? 'bg-green-600 text-white' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}
                                isDisabled={(it.status || o.status) === 'served'}
                                onClick={async () => {
                                  if ((it.status || o.status) === 'served') return;
                                  ordersStore.updateItem(o.id, it.id, { status: 'served' });
                                  kitchenOpsStore.add({ orderId: o.id, table: o.table, waiterId: o.waiterId, itemId: it.id, itemName: it.name, action: 'status', fromStatus: (it.status as any) || 'pending', toStatus: 'served', priority: (o.priority || (o.urgent ? 'urgent' : 'low')) as any });
                                  trackEvent('FB.OrderStatusChanged', { id: o.id, itemId: it.id, status: 'served' }, { sourceModule: 'F&B' });
                                  // Persist to DB — attempt PATCH (silent fail if in-memory-only ID)
                                  try {
                                    await fetch(`/api/fb/orders/${o.id}`, {
                                      method: 'PATCH',
                                      headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
                                      body: JSON.stringify({ status: 'served' }),
                                    });
                                  } catch { /* silent — in-memory store already updated */ }
                                }}
                              >
                                {(it.status || o.status) === 'served' ? 'Served' : 'Serve'}
                              </Button>
                              <Button size="sm" variant="flat" className="bg-gray-100" onClick={() => openActivityModal(o, it)}>View</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
          </CardBody>
        </Card>

      <Modal isOpen={paymentModal.isOpen} onClose={paymentModal.onClose} size="lg">
        <ModalContent>
          <ModalHeader className="text-ghana-black">Complete Payment</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button variant="flat" className="bg-ghana-green text-white" isLoading={isProcessingPayment} isDisabled={isProcessingPayment} onClick={() => handlePayment('Cash', total)}>Cash</Button>
              <Button variant="flat" className="bg-blue-600 text-white" isLoading={isProcessingPayment} isDisabled={isProcessingPayment} onClick={() => handlePayment('Card', total)}>Card</Button>
              <Button variant="flat" className="bg-yellow-500 text-white" isLoading={isProcessingPayment} isDisabled={isProcessingPayment} onClick={() => handlePayment('Mobile Money', total)}>Mobile Money</Button>
              <Button variant="flat" className="bg-purple-600 text-white" isLoading={isProcessingPayment} isDisabled={isProcessingPayment} onClick={() => handlePayment('Room Charge', total)}>Bill to Room</Button>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-ghana-black">Split Payments</div>
                <Button size="sm" variant="flat" className="bg-gray-100" onClick={() => setSplitPayments(prev => [...prev, { method: 'Cash', amount: 0 }])}>Add Split</Button>
              </div>
              {splitPayments.length === 0 && (
                <div className="text-xs text-gray-500">No split rows added.</div>
              )}
              <div className="space-y-2">
                {splitPayments.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-2 items-center">
                    <Select size="sm" label="Method" selectedKeys={[row.method]} onSelectionChange={(k) => setSplitPayments(prev => prev.map((r,i) => i===idx ? { ...r, method: Array.from(k as Set<string>)[0] as PaymentMethod } : r))}>
                      <SelectItem key="Cash">Cash</SelectItem>
                      <SelectItem key="Card">Card</SelectItem>
                      <SelectItem key="Mobile Money">Mobile Money</SelectItem>
                      <SelectItem key="Room Charge">Room Charge</SelectItem>
                    </Select>
                    <Input size="sm" type="number" label="Amount" value={String(row.amount)} onChange={(e) => setSplitPayments(prev => prev.map((r,i) => i===idx ? { ...r, amount: Number(e.target.value || 0) } : r))} className="col-span-3" />
                    <Button size="sm" variant="flat" className="bg-red-100" onClick={() => setSplitPayments(prev => prev.filter((_, i) => i !== idx))}>Remove</Button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Input label="Tip/Gratuity (₵)" type="number" value={String(tipAmount)} onChange={(e) => setTipAmount(Number(e.target.value || 0))} />
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-sm flex items-center justify-between">
                  <span>Remaining</span>
                  <span className="font-semibold">₵{splitRemaining.toFixed(2)}</span>
                </div>
              </div>
              {splitPayments.some(p => p.method === 'Room Charge' && Number(p.amount) > 0) && (
                <div className="mt-3">
                  <div className="text-xs text-gray-600 mb-1">Select room to charge</div>
                  <Input 
                    label="Room (for Room Charge)"
                    placeholder="Search room or guest..."
                    value={settleRoomSearch}
                    onChange={(e) => setSettleRoomSearch(e.target.value)}
                    startContent={<span>🏨</span>}
                  />
                  {settleRoomSearch && filteredRooms.filter(r => (r.roomId || '').toLowerCase().includes(settleRoomSearch.toLowerCase()) || r.guestName.toLowerCase().includes(settleRoomSearch.toLowerCase())).slice(0, 10).map(r => (
                    <div key={r.roomId} className="p-2 border-b text-sm cursor-pointer hover:bg-gray-50" onClick={() => { setSettleSelectedRoom(r as any); setSettleRoomSearch(`${r.roomId} - ${r.guestName}`); }}>
                      Room {r.roomId} • {r.guestName}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {customerType === 'In-house' && (
              <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
                <div className="flex items-center justify-between">
                  <span>Room</span>
                  <span className="font-semibold">{roomNumber || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Guest</span>
                  <span className="font-semibold">{guestName || '-'}</span>
                </div>
              </div>
            )}
                {((customerType as string) === 'Walk-in' || (customerType as string) === 'Takeout') && (
                  <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Customer</span>
                      <span className="font-semibold">{selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}` : '-'}</span>
                    </div>
                  </div>
                )}

                {customerType === 'Walk-in' && (
                  <div className="space-y-3">
                    <div>
                    <Input 
                        label="Customer (Walk-in)" 
                        placeholder="Search by name, phone, or email..."
                        value={walkInSearchTerm || (selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}` : '')}
                        onChange={(e) => {
                          setWalkInSearchTerm(e.target.value);
                          if (!e.target.value) {
                            setSelectedWalkIn(null);
                          }
                        }}
                      onFocus={() => { setWalkInFocused(true); setWalkInSearchTerm(selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}` : ''); }}
                      onBlur={() => { setTimeout(() => setWalkInFocused(false), 150); }}
                        startContent={<span>🧾</span>}
                      />
                      {(walkInFocused || !!walkInSearchTerm) && filteredWalkIns.length > 0 && (
                        <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg z-10">
                          {filteredWalkIns.map((c) => (
                            <div
                              key={c.id}
                              className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => handleWalkInSelect(c)}
                            >
                              <div className="font-medium">{c.firstName} {c.lastName}</div>
                              <div className="text-sm text-gray-600">
                                {c.phone && `📞 ${c.phone}`}
                                {c.email && ` • ✉️ ${c.email}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-gray-600">
                        Can't find customer? <a className="text-blue-600 underline" href="/manage-clients" target="_blank" rel="noopener noreferrer">Register new client</a>
                      </div>
                    </div>

                    {selectedWalkIn && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="text-sm text-green-800">
                          <div className="font-medium">✓ Customer Selected</div>
                          <div>Customer: {selectedWalkIn.firstName} {selectedWalkIn.lastName}</div>
                        </div>
                      </div>
                    )}
              </div>
            )}
            <div className="text-sm">
              <div className="flex items-center justify-between"><span>Subtotal</span><span className="font-semibold">₵{total.toFixed(2)}</span></div>
              {orderMode === 'Takeaway' && (
                <div className="flex items-center justify-between"><span>Packaging</span><span className="font-semibold">₵{(packagingFee || 0).toFixed(2)}</span></div>
              )}
              <div className="flex items-center justify-between"><span>Tip</span><span className="font-semibold">₵{(tipAmount || 0).toFixed(2)}</span></div>
              <div className="flex items-center justify-between"><span>Total</span><span className="font-semibold">₵{grandTotal.toFixed(2)}</span></div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" className="bg-gray-200" onClick={paymentModal.onClose}>Close</Button>
            <Button color="primary" isDisabled={splitPayments.length > 0 && splitRemaining > 0} onClick={async () => {
              if (splitPayments.length === 0) return;

              // Validate room charge has a room selected
              const hasRoom = splitPayments.some(p => p.method === 'Room Charge' && Number(p.amount) > 0);
              if (hasRoom && !settleSelectedRoom && !(selectedGuest && roomNumber)) {
                alert('Select room to charge before completing payment.');
                return;
              }

              const guestDisplayName = customerType === 'In-house'
                ? guestName
                : (selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}`.trim() : (walkInSearchTerm.trim() || 'Walk-in Customer'));

              // Resolve or create DB order
              let orderId = sentOrderData?.id ?? null;
              let finalSubtotal = sentOrderData?.subtotal ?? subtotal;
              let finalTax = sentOrderData?.taxAmount ?? computeSalesTaxTotal(subtotal);
              let finalTotal = sentOrderData?.total ?? (subtotal + finalTax);

              if (!orderId) {
                try {
                  const itemsWithOrderDiscount = distributeOrderDiscountPerUnit(cart);
                  const data = await createFbOrder({
                    orderNumber: useSettingsStore.getState().getNextModuleNumber('foodBeverage', 'order'),
                    venue: normalizePosVenue(venue),
                    tableNumber,
                    roomNumber: customerType === 'In-house' ? roomNumber : undefined,
                    guestId: selectedGuest?.guestId,
                    guestName: guestDisplayName,
                    serverName: waiters.find(w => w.id === waiterId)?.name || waiterId,
                    notes: orderNotes,
                    covers: 1,
                    discountAmount: orderDiscountAmount,
                    serviceCharge: serviceChargeAmount,
                    items: itemsWithOrderDiscount.map(i => ({
                      menuItemId: i.id,
                      name: i.name,
                      category: i.category,
                      quantity: i.qty,
                      unitPrice: i.price,
                      notes: i.note,
                      route: i.route,
                    })),
                  });
                  orderId = data.order?.id ?? null;
                  if (data.order) {
                    finalSubtotal = Number(data.order.subtotal);
                    finalTax = Number(data.order.taxAmount);
                    finalTotal = Number(data.order.total);
                  }
                } catch { /* fallback totals already set */ }
              }

              // Advance order through state machine → billed
              if (orderId) {
                try {
                  await patchFbOrderStatus(orderId, 'preparing');
                  await patchFbOrderStatus(orderId, 'ready');
                  await patchFbOrderStatus(orderId, 'served');
                  await patchFbOrderStatus(orderId, 'billed');
                } catch { /* silent */ }
              }

              // GL capture for each non-room-charge split
              const departmentSource: DepartmentSource = venue === 'Restaurant' ? 'restaurant' : 'bar';
              const taxPercent = finalSubtotal > 0 ? (finalTax / finalSubtotal) * 100 : 0;
              const currentWaiter = waiters.find(w => w.id === waiterId);
              const staffInfo = { staffId: waiterId, staffName: currentWaiter?.name || waiterId, staffRole: 'Waiter/Cashier' as const };

              for (const split of splitPayments) {
                if (split.method === 'Room Charge') continue; // handled via folio PATCH above
                if (Number(split.amount) <= 0) continue;
                try {
                  captureCompleteSale(
                    {
                      id: orderId ?? `SPLIT-${Date.now()}`, source: departmentSource,
                      customerName: guestDisplayName, reference: orderId ?? '',
                      description: `${venue} Split — ${split.method}`,
                      items: cart.map(item => ({ description: item.name, quantity: item.qty, unitPrice: item.price, taxPercent })),
                      subtotal: finalSubtotal, taxAmount: finalTax, total: finalTotal, ...staffInfo,
                    },
                    {
                      id: `SPLIT-${split.method}-${Date.now()}`, customerName: guestDisplayName,
                      amount: Number(split.amount), paymentMethod: split.method as 'Cash' | 'Card' | 'Mobile Money',
                      reference: orderId ?? '', description: `Split payment: ${split.method}`, ...staffInfo,
                    }
                  );
                } catch { /* silent GL error — order already billed */ }
              }

              // Print combined receipt
              printReceipt({
                hotelName,
                contact: 'Accra, Ghana',
                code: `RCPT-${orderId ?? Date.now().toString().slice(-6)}`,
                datetime: new Date().toLocaleString(),
                items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
                subtotal: finalSubtotal,
                discount: orderDiscountAmount,
                total: finalTotal + (tipAmount || 0),
                table: tableNumber,
                waiter: waiters.find(w => w.id === waiterId)?.name,
              });

              trackEvent('Payment.Received', { orderId, venue, customerType, total: finalTotal, splits: splitPayments.length }, { sourceModule: 'F&B' });
              setSentOrderData(null);
              setCart([]);
              setDiscountPercent(0);
              setSplitPayments([]);
              setTipAmount(0);
              setOrderNotes('');
              paymentModal.onClose();
            }}>Complete Payment</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={newItemModal.isOpen} onClose={newItemModal.onClose}>
        <ModalContent>
          <ModalHeader className="text-ghana-black">Add Menu Item</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Name" placeholder="Item name" id="new-item-name" />
              <Input label="Price (₵)" type="number" placeholder="0" id="new-item-price" />
              <Input label="Category" placeholder="Mains/Drinks/Desserts" id="new-item-category" />
              <Select label="Route" selectedKeys={['kitchen']} id="new-item-route">
                <SelectItem key="kitchen">kitchen</SelectItem>
                <SelectItem key="bar">bar</SelectItem>
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" className="bg-gray-200" onClick={newItemModal.onClose}>Cancel</Button>
            <Button variant="flat" className="bg-ghana-green text-white" onClick={() => {
              const name = (document.getElementById('new-item-name') as HTMLInputElement)?.value?.trim();
              const price = Number((document.getElementById('new-item-price') as HTMLInputElement)?.value || 0);
              const category = (document.getElementById('new-item-category') as HTMLInputElement)?.value?.trim() || 'Mains';
              const routeEl = document.getElementById('new-item-route') as HTMLElement;
              const route = (routeEl?.querySelector('select') as HTMLSelectElement)?.value || 'kitchen';
              if (!name || price <= 0) return;
              const id = `${name.toUpperCase().replace(/\s+/g, '_')}-${Date.now().toString().slice(-4)}`;
              const item: MenuItem = { id, name, price, category, route: route as 'kitchen' | 'bar' };
              setMenu(prev => [item, ...prev]);
              trackEvent('FB.MenuItemAdded', { id, name, price, category, route }, { sourceModule: 'F&B' });
              newItemModal.onClose();
            }}>Add</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={orderDetailModal.isOpen} onClose={orderDetailModal.onClose} size="lg">
        <ModalContent>
          <ModalHeader className="text-ghana-black">Order Details</ModalHeader>
          <ModalBody>
            {!selectedOrder ? null : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Order</span> <span className="font-medium">{selectedOrder.id}</span></div>
                  <div><span className="text-gray-500">Waiter</span> <span className="font-medium">{waiters.find(w => w.id === selectedOrder.waiterId)?.name}</span></div>
                  <div><span className="text-gray-500">Table</span> <span className="font-medium">{selectedOrder.table}</span></div>
                  <div><span className="text-gray-500">Customer</span> <span className="font-medium">{selectedOrder.customerType}</span></div>
                </div>
                <Table aria-label="Order items">
                  <TableHeader>
                    <TableColumn>Item</TableColumn>
                    <TableColumn>Qty</TableColumn>
                    <TableColumn>Price</TableColumn>
                    <TableColumn>Total</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map(it => (
                      <TableRow key={it.id}>
                        <TableCell>{it.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="flat" className="bg-gray-100" onClick={() => updateSelectedOrder(o => ({ ...o, items: o.items.map(ci => ci.id === it.id ? { ...ci, qty: Math.max(1, ci.qty - 1) } : ci) }))}>-</Button>
                            <span className="w-6 text-center text-sm">{it.qty}</span>
                            <Button size="sm" variant="flat" className="bg-gray-100" onClick={() => updateSelectedOrder(o => ({ ...o, items: o.items.map(ci => ci.id === it.id ? { ...ci, qty: ci.qty + 1 } : ci) }))}>+</Button>
                          </div>
                        </TableCell>
                        <TableCell>₵{it.price}</TableCell>
                        <TableCell>₵{it.price * it.qty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center gap-2">
                  <Button variant="flat" className="bg-blue-600 text-white" onClick={() => changeOrderStatus(selectedOrder.id, 'preparing')}>Mark Preparing</Button>
                  <Button variant="flat" className="bg-green-600 text-white" onClick={() => changeOrderStatus(selectedOrder.id, 'served')}>Mark Served</Button>
                  <Button variant="flat" className="bg-ghana-gold text-white" onClick={() => changeOrderStatus(selectedOrder.id, 'billed')}>Mark Billed</Button>
                  <Button variant="flat" className="bg-gray-700 text-white" onClick={() => { loadOrderIntoCart(selectedOrder); orderDetailModal.onClose(); }}>Edit in Cart</Button>
                  <Button variant="flat" className="bg-red-600 text-white" onClick={() => { requestDeleteWithPin(selectedOrder.id); }}>Delete</Button>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" className="bg-gray-200" onClick={orderDetailModal.onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Manager PIN Modal */}
      <Modal isOpen={managerPinModal.isOpen} onClose={managerPinModal.onClose}>
        <ModalContent>
          <ModalHeader className="text-ghana-black">Manager Authorization</ModalHeader>
          <ModalBody>
            <Input label="Enter Manager PIN" type="password" value={pinValue} onChange={(e) => setPinValue(e.target.value)} isInvalid={!!pinError} errorMessage={pinError || undefined} />
            <div className="text-xs text-gray-500">Required to delete orders.</div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" className="bg-gray-200" onClick={managerPinModal.onClose}>Cancel</Button>
            <Button variant="flat" className="bg-red-600 text-white" onClick={confirmManagerPin}>Confirm</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Split bill and tips modals removed */}

      {/* Print Preview Modal */}
      <Modal isOpen={printPreviewModal.isOpen} onClose={() => { setPrintPreview(null); printPreviewModal.onClose(); }} size="lg">
        <ModalContent>
          <ModalHeader className="text-ghana-black">{printPreview?.title || 'Preview'}</ModalHeader>
          <ModalBody>
            {printPreview?.html ? (
              <div className="max-h-[60vh] overflow-auto">
                <div dangerouslySetInnerHTML={{ __html: printPreview.html }} />
              </div>
            ) : (
              <div className="text-sm text-gray-500">Nothing to preview.</div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" className="bg-gray-200" onClick={() => { setPrintPreview(null); printPreviewModal.onClose(); }}>Close</Button>
            <Button variant="flat" className="bg-ghana-green text-white" onClick={() => {
              if (printPreview?.html) {
                printHtml(printPreview.title || 'Preview', printPreview.html);
              }
            }}>Print</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* POS Activity Table's "View" modal — one place for everything that used to be
          three separate row buttons (Actions + Payment; Serve stays its own quick
          button in the row since it's the most frequent single click). */}
      <Modal isOpen={!!activitySelected} onClose={() => setActivitySelected(null)}>
        <ModalContent>
          <ModalHeader className="text-ghana-black">Order Item — View</ModalHeader>
          <ModalBody>
            {!activitySelected ? null : (
              <div className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-ghana-black">{activitySelected.item.name}</div>
                    <Badge color="primary" variant="flat">{activitySelected.order.table}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    <span>Waiter: {waiters.find(w => w.id === activitySelected.order.waiterId)?.name || activitySelected.order.waiterId}</span>
                    <span className="mx-2">•</span>
                    <span>Venue: {activitySelected.order.venue}</span>
                    <span className="mx-2">•</span>
                    <span>Status: {(activitySelected.item.status || activitySelected.order.status)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button variant="flat" className="bg-blue-50 text-blue-700 border border-blue-200" onClick={() => {
                    openPaymentForOrder(activitySelected.order);
                    setActivitySelected(null);
                  }}>Pay</Button>
                  <Button variant="flat" className="bg-gray-100" onClick={() => {
                    loadOrderIntoCart(mapOrderForCart(activitySelected.order));
                    setActivitySelected(null);
                  }}>Edit in Cart</Button>
                  <Button variant="flat" className="bg-red-50 text-red-700 border border-red-200" onClick={() => cancelReasonModal.onOpen()}>Cancel Item</Button>
                  <Button variant="flat" className="bg-gray-100 text-red-600" onClick={() => { if (activitySelected) requestDeleteWithPin(activitySelected.order.id); }}>Delete Order</Button>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" className="bg-gray-200" onClick={() => setActivitySelected(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cancel reason modal */}
      <Modal isOpen={cancelReasonModal.isOpen} onClose={cancelReasonModal.onClose}>
        <ModalContent>
          <ModalHeader className="text-ghana-black">Cancellation Reason</ModalHeader>
          <ModalBody>
            <Select label="Reason" selectedKeys={[cancelReason]} onSelectionChange={(k) => setCancelReason(Array.from(k as Set<string>)[0] as string)}>
              <SelectItem key="Out of stock">Out of stock</SelectItem>
              <SelectItem key="Customer changed mind">Customer changed mind</SelectItem>
              <SelectItem key="Wrong entry">Wrong entry</SelectItem>
              <SelectItem key="Kitchen rejected">Kitchen rejected</SelectItem>
              <SelectItem key="Other">Other</SelectItem>
            </Select>
            {cancelReason === 'Other' && (
              <Input label="Custom reason" placeholder="Type reason" value={cancelReasonCustom} onChange={(e) => setCancelReasonCustom(e.target.value)} />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" className="bg-gray-200" onClick={cancelReasonModal.onClose}>Close</Button>
            <Button color="danger" onClick={() => {
              const finalReason = cancelReason === 'Other' ? (cancelReasonCustom || '') : cancelReason;
              doCancelWithReason(finalReason);
              setCancelReasonCustom('');
              cancelReasonModal.onClose();
            }}>Confirm Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}


