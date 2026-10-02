'use client';

import React, { useMemo, useState } from 'react';
import {
  Button,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
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
import { openHtmlPrintWindow } from '../lib/print/engine';
import { printReceipt, buildKOTHtml, printHtml, renderFbReceipt, previewReceipt } from '../lib/print/print';
import { storesIssueBus } from '../lib/fb/stores';
import { kitchenOpsStore } from '../lib/fb/kitchenOpsStore';
import { storesStore } from '../lib/stores/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { customerStore } from '../lib/fb/customerStore';
import { fbTenantHeaders, normalizePosVenue, createFbOrder, patchFbOrderStatus, fetchFbOrderById, alertStockWarnings, type FbOrderStatus, type FbStockWarning } from '../lib/fb/api';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import { computeSalesTaxTotal } from '../lib/tax/engine';
import { useSettingsStore } from '../lib/settings/store';
import { managerPinMatches } from '../lib/settings/managerPin';
import { notifyError } from '../lib/notifications/notify';
import { isOnReadyBoard } from '../lib/fb/readyBoard';
import { confirmDelete, confirmVoid } from './DangerConfirm';
import { issueOrderIdentity, lineTicket, parseTicketTag } from '../lib/fb/ticketTag';
import { useSession } from 'next-auth/react';
import { menuImageSrc } from './fb/MenuPhotoPicker';
import {
  ChefHat, ChevronDown, ChevronUp, ClipboardList, CreditCard, Minus, MoreHorizontal, Plus, Printer,
  Receipt, Search, Send, Trash2, UserRound, UtensilsCrossed, Wine,
} from 'lucide-react';

type CustomerType = 'In-house' | 'Walk-in';
type VenueMode = 'Restaurant' | 'Bar';
type PaymentMethod = 'Cash' | 'Card' | 'Mobile Money' | 'Room Charge';

interface FBPOSProps {
  onClose: () => void;
  /** When set, load this ordersStore order into the cart for editing. */
  editOrderId?: string | null;
}

interface MenuItem {
  id: string;
  code?: string;
  name: string;
  alias?: string;
  price: number;
  category: string;
  route: 'kitchen' | 'bar';
  aliases?: string[];
  isPinned?: boolean;
  /** A photo was uploaded in Menu & Inventory (shown only when the hotel turns menu photos on). */
  hasImage?: boolean;
  imageVersion?: number;
  readyNow?: boolean;
  readyForDate?: string | null;
  readyPortions?: number | null;
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
  /** Has a POS PIN, so can switch in on a shared terminal. */
  hasPin?: boolean;
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

export default function FBPOS({ onClose, editOrderId = null }: FBPOSProps) {
  const { data: session } = useSession();
  const cashierUserId = (session?.user as { id?: string } | undefined)?.id;
  const cashierName = session?.user?.name || session?.user?.email || undefined;
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
  const [floorTables, setFloorTables] = useState<{ number: string; status: string; capacity?: number }[]>([]);
  const [hasOpenTill, setHasOpenTill] = useState<boolean | null>(null);
  // Open the Restaurant / Bar till from right here (same call as the Cashiering tab), instead of
  // sending the cashier off to another screen when the POS says there's no till.
  const openTillModal = useDisclosure();
  const [tillFloat, setTillFloat] = useState('');
  const [tillBusy, setTillBusy] = useState(false);
  const [tillError, setTillError] = useState('');
  const promptOpenTill = () => { setTillError(''); openTillModal.onOpen(); };
  const openTill = async () => {
    const floatValue = parseFloat(tillFloat);
    if (Number.isNaN(floatValue) || floatValue < 0) { setTillError('Enter the cash in the drawer, e.g. 200.'); return; }
    setTillBusy(true);
    setTillError('');
    try {
      const now = new Date();
      const businessDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const res = await fetch('/api/frontoffice/cashier-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() },
        body: JSON.stringify({ openingFloat: floatValue, outlet: 'restaurant', businessDate }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setTillError(data?.error || 'Could not open the till.'); return; }
      setHasOpenTill(true);
      setTillFloat('');
      openTillModal.onClose();
    } catch {
      setTillError('Could not reach the server. Try again.');
    } finally {
      setTillBusy(false);
    }
  };
  const [waiterId, setWaiterId] = useState('');
  // Who is taking orders on this terminal right now. The signed-in account is trusted as it is;
  // anyone else switches in with their own PIN, and the terminal locks again after each order.
  const [verifiedWaiter, setVerifiedWaiter] = useState<{ id: string; name: string } | null>(null);
  const waiterSwitchModal = useDisclosure();
  const [switchTarget, setSwitchTarget] = useState<Waiter | null>(null);
  const [switchPin, setSwitchPin] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [switchBusy, setSwitchBusy] = useState(false);
  // Hotel setting (Settings → Security): off by default — orders are then simply recorded under the
  // signed-in person, with no "Who's ordering?" step and no lock.
  const [waiterSwitchOn, setWaiterSwitchOn] = useState(false);
  const [showMenuImages, setShowMenuImages] = useState(false);
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/pos', { headers: fbTenantHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setWaiterSwitchOn(!!d?.policy?.waiterSwitch);
        setShowMenuImages(!!d?.policy?.showMenuImages);
      })
      .catch(() => { /* keep it off */ });
    return () => { cancelled = true; };
  }, []);
  const kitchenTerminalOn = useSettingsStore((s) => s.moduleSettings.kitchenTerminal !== false);
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
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [waitersReady, setWaitersReady] = useState(false);
  const cashierIsServer = waiters.some((w) => w.id === cashierUserId);
  const needsWaiter = waitersReady && !verifiedWaiter && (waiterSwitchOn || !cashierIsServer);

  const paymentModal = useDisclosure();
  const orderDetailModal = useDisclosure();
  const managerPinModal = useDisclosure();
  const printPreviewModal = useDisclosure();
  const [printPreview, setPrintPreview] = useState<{ title: string; html: string } | null>(null);
  const [pinValue, setPinValue] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [pendingManagerAction, setPendingManagerAction] = useState<{ type: 'delete'; orderId: string } | null>(null);
  const [orders, setOrders] = useState<FBOrder[]>([]);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: PaymentMethod; amount: number }>>([]);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [settleRoomSearch, setSettleRoomSearch] = useState<string>('');
  const [settleSelectedRoom, setSettleSelectedRoom] = useState<{ roomId: string; guestId: string; guestName: string } | null>(null);
  const [orderMode, setOrderMode] = useState<'Dine-in' | 'Takeaway'>('Dine-in');
  const [quickService, setQuickService] = useState(false);
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

  // Load floor tables + whether this cashier has an open restaurant till
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tablesRes, shiftsRes] = await Promise.all([
          fetch('/api/fb/tables', { headers: fbTenantHeaders() }),
          fetch('/api/frontoffice/cashier-shifts?outlet=restaurant', {
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-subdomain': getClientTenantSubdomain(),
            },
          }),
        ]);
        if (cancelled) return;
        if (tablesRes.ok) {
          const data = await tablesRes.json();
          const tables = Array.isArray(data.tables) ? data.tables : [];
          setFloorTables(
            tables.map((t: any) => ({
              number: String(t.number),
              status: String(t.status || 'available'),
              capacity: t.capacity,
            }))
          );
          if (tables.length && !tables.some((t: any) => String(t.number) === tableNumber)) {
            setTableNumber(String(tables[0].number));
          }
        }
        if (shiftsRes.ok && cashierUserId) {
          const data = await shiftsRes.json();
          const shifts = Array.isArray(data.shifts) ? data.shifts : [];
          setHasOpenTill(
            shifts.some((s: any) => s.status === 'open' && s.cashierUserId === cashierUserId)
          );
        } else if (!cashierUserId) {
          setHasOpenTill(false);
        }
      } catch {
        if (!cancelled) setHasOpenTill(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cashierUserId]);

  // Get available rooms (checked-in guests only)
  const availableRooms = useMemo(() => {
    return frontOfficeStore.reservations
      .filter(r => r.status === 'checked-in' && r.roomId && r.roomId !== 'TBD')
      .map(r => ({
        reservationId: r.id,
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

  const inHouseReservationId = () => {
    if (customerType !== 'In-house' && !settleSelectedRoom) return undefined;
    const room = settleSelectedRoom?.roomId || roomNumber;
    return selectedGuest?.reservationId
      || (settleSelectedRoom as any)?.reservationId
      || frontOfficeStore.reservations.find(r => r.status === 'checked-in' && r.roomId === room)?.id;
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

  const tables = floorTables.length
    ? floorTables.map((t) => t.number)
    : Array.from({ length: 20 }).map((_, i) => `T${String(i + 1).padStart(2, '0')}`);

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
          alias: it.alias || '',
          price: Number(it.unitPrice),
          category: it.category,
          venue: it.venue,
          aliases: it.aliases ? it.aliases.split(',').map((a: string) => a.trim()).filter(Boolean) : [],
          isPinned: !!it.isPinned,
          hasImage: !!it.hasImage,
          imageVersion: Number(it.imageVersion || 0),
          route: (it.route || (it.category?.toLowerCase().includes('drink') || it.category?.toLowerCase().includes('bever') ? 'bar' : 'kitchen')) as 'kitchen' | 'bar',
          readyNow: !!it.readyNow,
          readyForDate: it.readyForDate || null,
          readyPortions: it.readyPortions == null ? null : Number(it.readyPortions),
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
    const timer = window.setInterval(fetchMenu, 20000);
    return () => { cancelled = true; window.clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load tenant info: hotel name + staff list for waiter select
  React.useEffect(() => {
    let cancelled = false;
    async function fetchTenantInfo() {
      try {
        const res = await fetch('/api/tenant?assigned=fb', { headers: fbTenantHeaders() });
        if (cancelled) return;
        if (!res.ok) {
          setWaitersReady(true);
          return;
        }
        const data = await res.json();
        if (data.hotelName) setHotelName(data.hotelName);
        const staff = Array.isArray(data.staff) ? data.staff : [];
        setWaiters(staff.map((s: any) => ({ id: s.id, name: s.name, hasPin: !!s.hasPin })));
        // A manager signed in on the terminal is not a waiter. Only someone assigned to the floor starts as the server.
        const me = cashierUserId ? staff.find((s: any) => s.id === cashierUserId) : null;
        if (me) {
          setWaiterId(me.id);
          setVerifiedWaiter({ id: me.id, name: me.name });
        } else {
          setWaiterId('');
          setVerifiedWaiter(null);
        }
        setWaitersReady(true);
      } catch {
        setWaitersReady(true);
      }
    }
    fetchTenantInfo();
    return () => { cancelled = true; };
  }, [cashierUserId]);

  type AliasesMap = Record<string, string[]>; // menuId -> aliases
  const [aliases] = useState<AliasesMap>(() => {
    try {
      const raw = localStorage.getItem('fbpos.aliases');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const aliasTokens = (m: MenuItem) => {
    const split = (value: string) => value.split(/[,;/]+/).map((part) => part.trim()).filter(Boolean);
    return [
      ...split(m.alias || ''),
      ...(m.aliases || []).flatMap((entry) => split(String(entry))),
      ...(aliases[m.id] || []),
    ];
  };

  const aliasMatches = (m: MenuItem, q: string) => {
    const qs = q.trim().toLowerCase();
    if (!qs) return true;
    if (m.name.toLowerCase().includes(qs)) return true;
    if ((m.code || '').toLowerCase().includes(qs)) return true;
    return aliasTokens(m).some((token) => token.toLowerCase().includes(qs));
  };

  const saleMenu = useMemo(
    () => (quickService ? menu.filter((m) => isOnReadyBoard(m)) : menu),
    [menu, quickService],
  );
  const visibleMenu = useMemo(
    () => saleMenu.filter((m) => aliasMatches(m, search)),
    [saleMenu, search, aliases],
  );



  // Everyday categories first, in the order staff reach for them; anything else the hotel adds follows alphabetically.
  const CATEGORY_ORDER = ['food', 'beverage', 'dessert', 'snack'];
  const categories = useMemo(() => {
    const rank = (c: string) => {
      const i = CATEGORY_ORDER.indexOf(c.toLowerCase());
      return i === -1 ? CATEGORY_ORDER.length : i;
    };
    return Array.from(new Set(visibleMenu.map(m => m.category)))
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [visibleMenu]);

  // "All" opens the POS; pinned items get their own tab next, so frequent orders stay a tap away
  // however long the menu grows. While a search is typed the results are shown across all tabs.
  const ALL_TAB = '__all';
  const PINNED_TAB = '__pinned';
  const [menuTab, setMenuTab] = useState(ALL_TAB);
  const pinnedItems = useMemo(() => visibleMenu.filter(m => m.isPinned), [visibleMenu]);
  const menuTabs = useMemo(() => [ALL_TAB, ...(pinnedItems.length ? [PINNED_TAB] : []), ...categories], [pinnedItems, categories]);
  const activeTab = menuTabs.includes(menuTab) ? menuTab : ALL_TAB;
  const searching = search.trim() !== '';
  const shownMenu = searching || activeTab === ALL_TAB
    ? visibleMenu
    : activeTab === PINNED_TAB ? pinnedItems : visibleMenu.filter(m => m.category === activeTab);
  const menuTabLabel = (t: string) =>
    t === ALL_TAB ? 'All' : t === PINNED_TAB ? `★ Pinned (${pinnedItems.length})` : t.charAt(0).toUpperCase() + t.slice(1);

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
  const activityStamp = (iso?: string) => {
    if (!iso) return { date: '-', time: '-' };
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) return { date: '-', time: '-' };
    return {
      date: when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      time: when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
  };

  const openActivityModal = (o: FBOrder, it: any) => {
    setActivitySelected({ order: o, item: it });
    setActivityQty(it.qty || 0);
    setActivityTable(o.table);
    setActivityVenue(o.venue as VenueMode);
    setActivityWaiter(o.waiterId);
  };

  const activityLineStatus = (o: { status?: string }, it: { status?: string }) =>
    String(it.status || o.status || '').toLowerCase();

  const serveActivityItem = async (o: FBOrder, it: any) => {
    const status = activityLineStatus(o, it);
    if (status === 'served' || status === 'billed' || status === 'cancelled') return;
    ordersStore.updateItem(o.id, it.id, { status: 'served' });
    kitchenOpsStore.add({ orderId: o.id, table: o.table, waiterId: o.waiterId, itemId: it.id, itemName: it.name, action: 'status', fromStatus: (it.status as any) || 'pending', toStatus: 'served', priority: (o.priority || (o.urgent ? 'urgent' : 'low')) as any });
    trackEvent('FB.OrderStatusChanged', { id: o.id, itemId: it.id, status: 'served' }, { sourceModule: 'F&B' });
    try {
      await fetch(`/api/fb/orders/${o.id}`, {
        method: 'PATCH',
        headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: 'served' }),
      });
    } catch { /* in-memory store already updated */ }
    setActivitySelected(prev => prev && prev.order.id === o.id && prev.item.id === it.id
      ? { ...prev, item: { ...prev.item, status: 'served' }, order: { ...prev.order, status: 'served' } }
      : prev);
  };

  const payActivityOrder = (o: FBOrder) => {
    const status = String(o.status || '').toLowerCase();
    if (status === 'billed' || status === 'cancelled') return;
    const linesSubtotal = o.items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
    const storedTotal = Number(o.total) || 0;
    const taxAmount = storedTotal > linesSubtotal
      ? Math.round((storedTotal - linesSubtotal) * 100) / 100
      : computeSalesTaxTotal(linesSubtotal);
    const ticketTotal = storedTotal > 0 ? storedTotal : Math.round((linesSubtotal + taxAmount) * 100) / 100;
    loadOrderIntoCart({
      id: o.id,
      table: o.table,
      waiterId: o.waiterId,
      items: o.items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, category: i.category || '', route: i.route })),
      status: o.status as any,
      customerType: o.customerType as any,
      venue: o.venue as any,
      notes: o.notes,
      urgent: o.urgent,
      priority: o.priority,
    } as any);
    if (o.customerType === 'In-house') {
      setGuestName(o.guestName || '');
      setRoomNumber(o.roomNumber || '');
    } else if (o.guestName) {
      setWalkInSearchTerm(o.guestName);
    }
    setSentOrderData({ id: o.id, subtotal: linesSubtotal, taxAmount, total: ticketTotal });
    setActivitySelected(null);
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
    if (quickService && !isOnReadyBoard(item)) {
      notifyError(`${item.name} is not on the kitchen ready board, so it cannot go on a quick order.`, 'Not ready now');
      return;
    }
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
  // A saved ticket (just sent, or opened from the activity table) is billed at its stored total.
  const payingSavedTicket = Boolean(sentOrderData && (cart.length === 0 || editingOrderId === sentOrderData.id));
  const amountDue = payingSavedTicket
    ? Math.max(0, (sentOrderData?.total || 0) + (tipAmount || 0))
    : (cart.length > 0 ? grandTotal : 0);
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
    if (needsWaiter) {
      waiterSwitchModal.onOpen();
      return;
    }
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
    const stamped = issueOrderIdentity(itemsWithOrderDiscount, orderNotes);
    let orderNumber = stamped.orderNumber;
    try {
      const data = await createFbOrder({
        orderNumber,
        venue: normalizePosVenue(venue),
        tableNumber,
        roomNumber: customerType === 'In-house' ? roomNumber : undefined,
        guestId: selectedGuest?.guestId,
        reservationId: inHouseReservationId(),
        guestName: guestDisplayName,
        serverName: waiters.find(w => w.id === waiterId)?.name || waiterId,
        notes: stamped.notes,
        covers: 1,
        discountAmount: orderDiscountAmount,
        serviceCharge: serviceChargeAmount,
        priority,
        quickService,
        items: itemsWithOrderDiscount.map(i => ({
          menuItemId: (i as any).code ? undefined : i.id,
          catalogId: i.id,
          name: i.name,
          category: i.category,
          quantity: i.qty,
          unitPrice: i.price,
          notes: i.note,
          route: i.route,
        })),
      });
      apiId = data.order?.id ?? null;
      if (data.order?.orderNumber) {
        orderNumber = data.order.orderNumber;
        useSettingsStore.getState().raiseModuleNumberFloor('foodBeverage', 'order', [orderNumber]);
      }
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
      if (quickService && /ready board/i.test(err?.message || '')) {
        alert(err.message);
        setIsSending(false);
        return;
      }
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
      notes: stamped.notes,
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
    if (cart.length === 0 && !sentOrderData) return;
    if (isProcessingPayment) return; // guard against double-click double-charging the guest

    // Validate in-house customer selection
    if (customerType === 'In-house' && (!roomNumber || !guestName)) {
      alert('Please select a room and guest for in-house orders');
      return;
    }

    if (paymentMethod !== 'Room Charge' && hasOpenTill === false) {
      promptOpenTill();
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

      let expressStamp: ReturnType<typeof issueOrderIdentity> | null = null;
      if (sentOrderData) {
        // Reuse existing DB order created by sendOrder()
        apiOrder = { id: sentOrderData.id };
        finalSubtotal = sentOrderData.subtotal;
        totalTax = sentOrderData.taxAmount;
        total = sentOrderData.total;
      } else {
        // Express pay: create order now (single-step: order + pay)
        expressStamp = issueOrderIdentity(itemsWithOrderDiscount, orderNotes);
        const stamped = expressStamp;
        try {
          const data = await createFbOrder({
            orderNumber: stamped.orderNumber,
            venue: normalizePosVenue(venue),
            tableNumber,
            roomNumber: customerType === 'In-house' ? roomNumber : undefined,
            guestId: selectedGuest?.guestId,
            reservationId: inHouseReservationId(),
            guestName: guestDisplayName,
            serverName: waiters.find(w => w.id === waiterId)?.name || waiterId,
            notes: stamped.notes,
            covers: 1,
            discountAmount: orderDiscountAmount,
            serviceCharge: serviceChargeAmount,
            quickService,
            items: itemsWithOrderDiscount.map(i => ({
              menuItemId: i.id,
              catalogId: i.id,
              name: i.name,
              category: i.category,
              quantity: i.qty,
              unitPrice: i.price,
              notes: i.note,
              route: i.route,
            })),
          });
          apiOrder = data.order;
          if (apiOrder?.orderNumber) {
            useSettingsStore.getState().raiseModuleNumberFloor('foodBeverage', 'order', [apiOrder.orderNumber]);
          }
          finalSubtotal = Number(apiOrder.subtotal);
          totalTax = Number(apiOrder.taxAmount);
          total = Number(apiOrder.total);
        } catch (err) {
          console.warn('[FBPOS] handlePayment API error:', err);
          if (quickService && /ready board/i.test((err as Error)?.message || '')) {
            alert((err as Error).message);
            setIsProcessingPayment(false);
            return;
          }
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
      let stockWarnings: FbStockWarning[] | undefined;
      let billCogsAmount = 0;
      if (apiOrder?.id) {
        let currentStatus: string = 'pending';
        if (sentOrderData) {
          const liveOrder = await fetchFbOrderById(apiOrder.id);
          currentStatus = liveOrder.status;
        }
        if (currentStatus === 'cancelled' || currentStatus === 'billed' || currentStatus === 'refunded') {
          throw new Error(`Order is already '${currentStatus}' and cannot be billed`);
        }
        const startIdx = STATUS_SEQUENCE.indexOf(currentStatus as FbOrderStatus);
        const remainingSteps = startIdx === -1 ? STATUS_SEQUENCE.slice(1) : STATUS_SEQUENCE.slice(startIdx + 1);
        for (const status of remainingSteps) {
          const patched = await patchFbOrderStatus(
            apiOrder.id,
            status,
            status === 'billed'
              ? {
                  paymentMethod,
                  staffId: waiterId,
                  staffName: waiters.find(w => w.id === waiterId)?.name || waiterId,
                }
              : undefined,
          );
          if (status === 'billed') {
            if (patched.stockWarnings?.length) stockWarnings = patched.stockWarnings;
            if (patched.cogs?.amount) billCogsAmount = Number(patched.cogs.amount);
          }
        }
        // 'billed' PATCH posts folio (room charge) + stock + GL on the server
      }

      const newId = apiOrder?.id ?? `ORD-${Date.now().toString().slice(-6)}`;

      // ── Mirror to in-memory store for immediate UI reactivity ───────────────
      const billedItems = (cart.length > 0 ? itemsWithOrderDiscount : (ordersStore.all().find(o => o.id === newId)?.items || [])).map(i => ({
        id: i.id, name: i.name, price: i.price, qty: i.qty, route: i.route,
        status: 'billed' as const, prepMinutes: i.route === 'kitchen' ? 15 : 2,
        isRoomService: i.isRoomService || false,
        discountPerUnit: i.discountPerUnit || 0,
        serviceChargePerUnit: i.serviceChargePerUnit || 0,
      }));
      const billedOrder = {
        id: newId,
        table: tableNumber,
        waiterId,
        items: billedItems,
        status: 'billed',
        customerType,
        venue,
        notes: expressStamp?.notes || orderNotes,
        urgent: priority === 'urgent',
        priority,
        guestName: guestDisplayName,
        roomNumber: customerType === 'In-house' ? roomNumber : undefined,
        total,
        orderNumber: apiOrder?.orderNumber || expressStamp?.orderNumber,
      } as any;
      const existingBilled = ordersStore.all().find(o => o.id === newId);
      if (existingBilled) {
        ordersStore.update({
          ...existingBilled,
          ...billedOrder,
          notes: existingBilled.notes,
          orderNumber: existingBilled.orderNumber,
          items: billedItems.length > 0 ? billedItems : existingBilled.items,
        });
      } else {
        ordersStore.add(billedOrder);
      }

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

      // ===== ACCOUNTING =====
      // Sale + COGS + cashier stamps post on the server during status=billed.
      // Client no longer double-posts to avoid billed-without-GL / duplicate JE.
      if (billCogsAmount > 0) {
        console.log(`[F&B POS] Server COGS on bill: GH₵${billCogsAmount.toFixed(2)}`);
      }

      // Track payment received
      trackEvent('Payment.Received', { orderId: newId, venue, customerType, total, itemCount: cart.length }, { sourceModule: 'F&B' });

      // Clear cart and show success
      setCart([]);
      setSentOrderData(null);
      setEditingOrderId(null);
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
      alertStockWarnings(`Order ${newId}`, stockWarnings);

    } catch (error) {
      console.error('Payment processing error:', error);
      alert(`Payment failed: ${error instanceof Error ? error.message : 'unknown error'}. The order was NOT billed — please retry.`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const previewStationTicket = (kind: 'kot' | 'bot') => {
    const source = cart.length > 0 ? cart : (kind === 'kot'
      ? [{ name: 'Jollof Rice', qty: 1, route: 'kitchen' as const }]
      : [{ name: 'Club Beer', qty: 2, route: 'bar' as const }]);
    const items = source.filter(i => kind === 'bot' ? i.route === 'bar' : (i.route || 'kitchen') !== 'bar');
    if (items.length === 0) {
      alert(kind === 'bot' ? 'No bar items on this order.' : 'No kitchen items on this order.');
      return;
    }
    const code = useSettingsStore.getState().peekNextModuleNumber(
      'foodBeverage',
      kind === 'bot' ? 'barOrderTicket' : 'kitchenOrderTicket',
    );
    const title = kind === 'bot' ? 'Bar Order Ticket' : 'Kitchen Order Ticket';
    const args = {
      title,
      code,
      table: tableNumber,
      waiter: waiters.find(w => w.id === waiterId)?.name || waiterId,
      notes: parseTicketTag(orderNotes).notes,
      urgent: priority === 'urgent',
      items: items.map(i => ({ name: i.name, qty: i.qty })),
    };
    setPrintPreview({ title: kind === 'bot' ? 'BOT Preview' : 'KOT Preview', html: buildKOTHtml(args) });
    printPreviewModal.onOpen();
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
      const patched = await patchFbOrderStatus(
        orderId,
        apiStatus,
        apiStatus === 'billed' ? { paymentMethod: 'Cash' } : undefined,
      );
      if (apiStatus === 'billed') {
        alertStockWarnings(`Order ${orderId}`, patched.stockWarnings);
      }
    } catch { /* silent — in-memory store already updated */ }
    const found = pendingOrders.find(o => o.id === orderId);
    if (found) {
      ordersStore.update({ ...found, status } as any);
    }
  };

  const orderWasPosted = (status?: string) => ['sent', 'preparing', 'served', 'billed', 'paid'].includes(String(status || '').toLowerCase());

  const refundBilledOrder = async (orderId: string, _orderVenue?: string) => {
    const ok = await confirmVoid(`order ${orderId}`, 'This restocks inventory, voids the folio charge if any, and reverses accounting. The order stays on file as Void.');
    if (!ok) return;
    try {
      const patched = await patchFbOrderStatus(orderId, 'refunded', { refundReason: 'Void' });
      ordersStore.update({ id: orderId, status: 'cancelled' } as any);
      setPendingOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o)));
      setActivitySelected(null);
      trackEvent('FB.OrderRefunded' as any, { orderId, stockRestored: patched.stockRestored }, { sourceModule: 'F&B' });
      const glOk = (patched as any).glRefund?.ok !== false;
      alert(
        glOk
          ? `Order ${orderId} refunded.${patched.stockRestored ? ` Restocked ${patched.stockRestored} line(s).` : ''}`
          : `Order ${orderId} refunded; check accounting if GL reverse failed.`,
      );
    } catch (err) {
      alert(`Refund failed: ${err instanceof Error ? err.message : 'unknown error'}`);
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

  React.useEffect(() => {
    if (!editOrderId) return;
    const order = ordersStore.all().find((entry) => entry.id === editOrderId);
    if (!order) return;
    loadOrderIntoCart({
      id: order.id,
      table: order.table,
      waiterId: order.waiterId,
      items: order.items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        category: i.category || '',
        route: i.route,
      })),
      status: order.status as PendingOrder['status'],
      customerType: (order.customerType === 'In-house' ? 'In-house' : 'Walk-in') as CustomerType,
      venue: order.venue as VenueMode,
      notes: order.notes,
      urgent: order.urgent,
      priority: order.priority,
    });
    // Only when the parent hands us a new order to edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrderId]);

  const deleteOrder = (orderId: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    ordersStore.remove(orderId);
  };

  const requestDeleteWithPin = async (orderId: string) => {
    const ok = await confirmDelete(`order ${orderId}`, 'This order was never posted. It will be permanently removed after the manager PIN.');
    if (!ok) return;
    setPendingManagerAction({ type: 'delete', orderId });
    setPinValue('');
    setPinError('');
    managerPinModal.onOpen();
  };

  const askRemoveOrder = (orderId: string, status?: string) => {
    if (orderWasPosted(status)) {
      void refundBilledOrder(orderId);
      return;
    }
    void requestDeleteWithPin(orderId);
  };

  const confirmManagerPin = () => {
    if (managerPinMatches(pinValue)) {
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
        if (useSettingsStore.getState().moduleSettings.kitchenTerminal === false) return;
        if (cart.length > 0 && !editingOrderId && cart.every((item) => item.route === 'bar')) return;
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
  }, [sendOrder, openPayment, onClose, cart, editingOrderId]);

  // Order panel: "Details" folds away once the order is set up; the second tab replaces the old
  // transactions table at the bottom of this screen (the full list is the dashboard's Transactions tab).
  const [showBreakdown, setShowBreakdown] = useState<boolean>(() => {
    try { return localStorage.getItem('fbpos.breakdownOpen') === 'true'; } catch { return false; }
  });
  React.useEffect(() => {
    try { localStorage.setItem('fbpos.breakdownOpen', String(showBreakdown)); } catch {}
  }, [showBreakdown]);
  const [showOrderDetails, setShowOrderDetails] = useState<boolean>(() => {
    try { return localStorage.getItem('fbpos.detailsOpen') === 'true'; } catch { return false; }
  });
  React.useEffect(() => {
    try { localStorage.setItem('fbpos.detailsOpen', String(showOrderDetails)); } catch {}
  }, [showOrderDetails]);
  const [panelTab, setPanelTab] = useState<'current' | 'orders'>('current');
  // Phones and small tablets: the order opens as a sheet over the menu instead of sitting below a long menu.
  const [mobileOrderOpen, setMobileOrderOpen] = useState(false);
  const [ordersView, setOrdersView] = useState<'open' | 'paid'>('open');
  const [ordersScope, setOrdersScope] = useState<'table' | 'all'>('table');
  const panelOrders = useMemo(() => {
    const today = new Date().toDateString();
    return orders
      .filter((o) => {
        const status = String(o.status || '').toLowerCase();
        const settled = status === 'billed' || status === 'paid';
        if (status === 'cancelled' || status === 'refunded') return false;
        if (ordersScope === 'table' && o.table !== tableNumber) return false;
        if (ordersView === 'open') return !settled;
        const when = new Date(o.createdAt || o.timestamp || '');
        return settled && !Number.isNaN(when.getTime()) && when.toDateString() === today;
      })
      .sort((a, b) => String(b.createdAt || b.timestamp || '').localeCompare(String(a.createdAt || a.timestamp || '')));
  }, [orders, ordersView, ordersScope, tableNumber]);

  // Idle lock: two minutes with nothing on the order and no taps hands the terminal back to "Who's ordering?".
  React.useEffect(() => {
    if (!waiterSwitchOn || !verifiedWaiter || cart.length > 0) return;
    const IDLE_MS = 2 * 60 * 1000;
    let timer = window.setTimeout(() => setVerifiedWaiter(null), IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVerifiedWaiter(null), IDLE_MS);
    };
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [waiterSwitchOn, verifiedWaiter, cart.length]);

  const openWaiterSwitch = () => {
    setSwitchTarget(null);
    setSwitchPin('');
    setSwitchError('');
    waiterSwitchModal.onOpen();
  };
  const becomeWaiter = (w: { id: string; name: string }) => {
    setVerifiedWaiter({ id: w.id, name: w.name });
    setWaiterId(w.id);
    setSwitchTarget(null);
    setSwitchPin('');
    waiterSwitchModal.onClose();
  };
  const chooseWaiter = (w: Waiter) => {
    // Already on this terminal, the signed-in cashier, or a waiter with no login: no PIN again.
    if (w.id === verifiedWaiter?.id || w.id === cashierUserId || !w.hasPin) return becomeWaiter(w);
    setSwitchTarget(w);
    setSwitchPin('');
    setSwitchError('');
  };
  const confirmWaiterPin = async (pin = switchPin) => {
    if (!switchTarget || !/^\d{4,6}$/.test(pin)) return;
    setSwitchBusy(true);
    setSwitchError('');
    try {
      const res = await fetch('/api/fb/staff-pin', {
        method: 'POST',
        headers: fbTenantHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ staffId: switchTarget.id, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        becomeWaiter(data.staff || switchTarget);
      } else {
        setSwitchError(data.error || 'Wrong PIN.');
        setSwitchPin('');
      }
    } catch {
      setSwitchError('Could not reach the server. Try again.');
    } finally {
      setSwitchBusy(false);
    }
  };
  const pressPinKey = (key: string) => {
    if (switchBusy) return;
    if (key === 'back') return setSwitchPin(p => p.slice(0, -1));
    if (key === 'ok') return void confirmWaiterPin();
    setSwitchError('');
    setSwitchPin(p => (p.length >= 6 ? p : p + key));
  };

  const waiterName = verifiedWaiter?.name || waiters.find(w => w.id === waiterId)?.name || waiterId;
  const customerLabel = customerType === 'In-house'
    ? (roomNumber ? `Room ${roomNumber}${guestName ? ` · ${guestName}` : ''}` : 'In-house · pick a room')
    : (selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}` : 'Walk-in');
  const taxAmount = computeSalesTaxTotal(total);
  const cartCount = cart.reduce((n, ci) => n + ci.qty, 0);
  const drinksOnly = cart.length > 0 && !editingOrderId && cart.every((item) => item.route === 'bar');
  const showStationSend = kitchenTerminalOn && !drinksOnly;

  const sendOrUpdate = () => {
    if (needsWaiter) {
      openWaiterSwitch();
      return;
    }
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
  };

  const previewCartReceipt = () => {
    const html = renderFbReceipt({
      hotelName,
      contact: 'Accra, Ghana',
      code: `RCPT-${Date.now().toString().slice(-6)}`,
      datetime: new Date().toLocaleString(),
      guestName: customerType === 'In-house'
        ? guestName
        : (selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}`.trim() : (walkInSearchTerm.trim() || 'Walk-in')),
      items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
      subtotal,
      discount: orderDiscountAmount,
      total: total + taxAmount,
      table: tableNumber,
      waiter: waiters.find(w => w.id === waiterId)?.name,
    });
    setPrintPreview({ title: 'Receipt Preview', html });
    printPreviewModal.onOpen();
  };

  // The one full transactions list lives on the Restaurant & Bar dashboard's Transactions tab.
  const openAllTransactions = () => {
    try { localStorage.setItem('fb.tab', 'activity'); } catch {}
    onClose();
    window.dispatchEvent(new Event('fb-navigate'));
  };

  const itemIcon = (route: 'kitchen' | 'bar', size = 22) =>
    route === 'bar' ? <Wine size={size} aria-hidden /> : <UtensilsCrossed size={size} aria-hidden />;

  return (
    <div className="min-h-screen bg-slate-50 p-3 pb-24 md:p-4 lg:pb-4">
      <div className="mx-auto max-w-[1600px]">
        {/* Top bar: title, menu search, shortcuts */}
        <div className="mb-3 flex flex-wrap items-center gap-2 md:gap-3">
          <h1 className="text-xl font-bold text-ghana-black md:text-2xl">POS Terminal</h1>
          <div className="ml-auto flex items-center gap-2">
            {cashierName && (
              <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex" title="The account signed in on this terminal. Payments go to this person's till.">
                <UserRound size={14} aria-hidden /> Signed in: <span className="font-semibold text-ghana-black">{cashierName}</span>
              </span>
            )}
            {hasOpenTill === false && (
              <button
                type="button"
                onClick={promptOpenTill}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-100 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                title="Cash, card and MoMo need an open till. Room charges work without one."
              >
                No open till · Open one
              </button>
            )}
            <Button size="sm" variant="flat" className="h-9 bg-white border border-slate-200" startContent={<ChefHat size={16} aria-hidden />} onClick={() => {
              try {
                const evt = new CustomEvent('app.navigate', { detail: { section: 'fb-kitchen' } });
                window.dispatchEvent(evt);
              } catch {}
            }}>Kitchen</Button>
            <Button size="sm" variant="flat" className="h-9 bg-white border border-slate-200" startContent={<ClipboardList size={16} aria-hidden />} onClick={openAllTransactions}>
              All transactions
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:h-[calc(100vh-7.5rem)] lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px] md:gap-4">
          {/* Left column: order set-up above the menu, so the order panel on the right keeps its height for items. */}
          <div className="flex min-h-0 flex-col gap-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-3" aria-label="Order set-up">
            <div className="flex flex-wrap items-start gap-2">
              <div className="flex min-w-0 grow basis-[22rem] items-start gap-2">
                <div className="inline-flex shrink-0 rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Customer type">
                  {([['Walk-in', 'Walk-in'], ['In-house', 'In-house']] as const).map(([t, label]) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={customerType === t}
                      onClick={() => handleCustomerTypeChange(t)}
                      className={`h-9 rounded-md px-3 text-xs font-semibold ${customerType === t ? 'bg-white text-ghana-black shadow-sm' : 'text-slate-500'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative min-w-0 flex-1">
                  {customerType === 'In-house' ? (
                    <div>
                      <Input
                        size="sm"
                        label="Guest"
                        startContent={<Search size={16} className="text-slate-400" aria-hidden />}
                        classNames={{ inputWrapper: 'h-10' }}
                        aria-label="Room number or guest name"
                        placeholder="Room number or guest name…"
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
                      />
                      {roomSearchTerm && filteredRooms.length > 0 && (
                        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                          {filteredRooms.map((room) => (
                            <button
                              type="button"
                              key={room.roomId}
                              className="block w-full border-b border-slate-100 p-2 text-left last:border-b-0 hover:bg-slate-50"
                              onClick={() => handleRoomSelect(room)}
                            >
                              <div className="font-medium">Room {room.roomId}</div>
                              <div className="text-sm text-slate-600">{room.guestName} • {room.roomType}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      {selectedGuest && (
                        <p className="mt-1 text-xs text-green-700">✓ Room {roomNumber} · {guestName}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Input
                        size="sm"
                        label="Customer"
                        startContent={<Search size={16} className="text-slate-400" aria-hidden />}
                        classNames={{ inputWrapper: 'h-10' }}
                        aria-label="Walk-in customer"
                        placeholder="Name, phone or email…"
                        value={walkInSearchTerm || (selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}` : '')}
                        onChange={(e) => {
                          setWalkInSearchTerm(e.target.value);
                          if (!e.target.value) {
                            setSelectedWalkIn(null);
                          }
                        }}
                        onFocus={() => { setWalkInFocused(true); setWalkInSearchTerm(selectedWalkIn ? `${selectedWalkIn.firstName} ${selectedWalkIn.lastName}` : ''); }}
                        onBlur={() => { setTimeout(() => setWalkInFocused(false), 150); }}
                      />
                      {(walkInFocused || !!walkInSearchTerm) && filteredWalkIns.length > 0 && (
                        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                          {filteredWalkIns.map((c) => (
                            <button
                              type="button"
                              key={c.id}
                              className="block w-full border-b border-slate-100 p-2 text-left last:border-b-0 hover:bg-slate-50"
                              onClick={() => handleWalkInSelect(c)}
                            >
                              <div className="font-medium">{c.firstName} {c.lastName}</div>
                              <div className="text-sm text-slate-600">
                                {c.phone && `📞 ${c.phone}`}
                                {c.email && ` • ✉️ ${c.email}`}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {waiterSwitchOn && (
                <button
                  type="button"
                  onClick={openWaiterSwitch}
                  className={`inline-flex h-10 max-w-full items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${verifiedWaiter ? 'bg-slate-100 text-ghana-black hover:bg-slate-200' : 'animate-pulse bg-amber-100 text-amber-800'}`}
                  title="Switch who is taking the order"
                >
                  <UserRound size={14} aria-hidden />
                  <span className="truncate">{verifiedWaiter ? `Taking order: ${waiterName}` : "Who's ordering? Tap to choose"}</span>
                  {verifiedWaiter && <span className="text-slate-400">· Switch</span>}
                </button>
              )}
            <Button
              size="sm"
              variant="flat"
              className="h-10 shrink-0 bg-slate-100"
              aria-expanded={showOrderDetails}
              endContent={showOrderDetails ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
              onClick={() => setShowOrderDetails(v => !v)}
            >
              Details
            </Button>
            </div>
            {showOrderDetails && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Select size="sm" label="Order mode" selectedKeys={[orderMode]} onSelectionChange={(k) => setOrderMode(Array.from(k as Set<string>)[0] as any)}>
                  <SelectItem key="Dine-in">Dine-in</SelectItem>
                  <SelectItem key="Takeaway">Takeaway</SelectItem>
                </Select>
                <Select size="sm" label="Table" selectedKeys={[tableNumber]} onSelectionChange={(k) => setTableNumber(Array.from(k as Set<string>)[0])}>
                  {tables.map(t => (
                    <SelectItem key={t}>{t}</SelectItem>
                  ))}
                </Select>
                {orderMode === 'Takeaway' && (
                  <Input size="sm" type="number" label="Packaging fee (GH₵)" value={String(packagingFee)} onChange={(e) => setPackagingFee(Number(e.target.value || 0))} />
                )}
                <Select size="sm" label="Kitchen priority" selectedKeys={[priority]} onSelectionChange={(k) => {
                  const p = Array.from(k as Set<string>)[0] as 'low' | 'medium' | 'high' | 'urgent';
                  setPriority(p);
                  localStorage.setItem('kitchen.priority.filter', p);
                }}>
                  <SelectItem key="urgent">Urgent</SelectItem>
                  <SelectItem key="high">High</SelectItem>
                  <SelectItem key="medium">Medium</SelectItem>
                  <SelectItem key="low">Low</SelectItem>
                </Select>
                <Select size="sm" label="Room service" selectedKeys={[applyRoomServiceCharge ? 'yes' : 'no']} onSelectionChange={(k) => setApplyRoomServiceCharge(Array.from(k as Set<string>)[0] === 'yes')}>
                  <SelectItem key="no">No</SelectItem>
                  <SelectItem key="yes">Yes</SelectItem>
                </Select>
                {applyRoomServiceCharge && (
                  <Input size="sm" type="number" label="Room service charge / unit (GH₵)" value={String(roomServiceChargePerUnit)} onChange={(e) => setRoomServiceChargePerUnit(Number(e.target.value || 0))} />
                )}
                <Input size="sm" label="Order notes / allergies" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} className="sm:col-span-2" />
              </div>
            )}
          </section>

          {/* Menu */}
          <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-3 md:p-4" aria-label="Menu">
            <Input
              aria-label="Search menu"
              placeholder="Search menu or short name…"
              value={search}
              onValueChange={setSearch}
              isClearable
              onClear={() => setSearch('')}
              startContent={<Search size={18} className="text-slate-400" aria-hidden />}
              className="mb-3"
              classNames={{ inputWrapper: 'h-11 bg-slate-50 border-2 border-slate-300 shadow-none' }}
            />
            <div className="mb-3 flex items-center justify-between gap-3">
              <button
                type="button"
                aria-pressed={quickService}
                onClick={() => setQuickService((on) => !on)}
                className={`h-10 shrink-0 rounded-xl border px-3 text-sm font-medium ${quickService ? 'border-ghana-green bg-ghana-green text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Quick order
              </button>
              {searching ? (
                <p className="text-sm text-slate-600">Results for “{search.trim()}”</p>
              ) : (
                <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Menu categories">
                  {menuTabs.map(t => (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === t}
                      onClick={() => setMenuTab(t)}
                      className={`h-10 shrink-0 rounded-xl border px-4 text-sm font-medium transition-colors ${activeTab === t ? 'border-ghana-green bg-ghana-green text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {menuTabLabel(t)}
                    </button>
                  ))}
                </div>
              )}
              {menuLoading && <span className="shrink-0 text-xs text-slate-400 animate-pulse">Loading…</span>}
            </div>
            {quickService && (
              <p className="mb-3 text-xs text-slate-600">Only food the kitchen marked Ready now, plus drinks. A dish that still has to be cooked stays off this order.</p>
            )}
            {!menuLoading && menu.length === 0 && (
              <p className="text-sm text-orange-600">No menu items yet. Add them under Menu &amp; Inventory.</p>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {shownMenu.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">{searching ? 'No items match your search.' : quickService ? 'Nothing is ready for a quick order. Ask the kitchen to update Ready now. Drinks show here once they are on the menu.' : 'No items here yet.'}</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5">
                  {shownMenu.map(mi => (
                    <div key={mi.id} className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-ghana-green/50 hover:shadow-md">
                      <button type="button" onClick={() => addToCart(mi)} className="flex flex-1 flex-col text-left" aria-label={`Add ${mi.name}, GH₵ ${mi.price.toFixed(2)}`}>
                        {showMenuImages && (
                          <div className={`flex h-24 items-center justify-center overflow-hidden md:h-28 ${mi.route === 'bar' ? 'bg-sky-50 text-sky-500' : 'bg-amber-50 text-amber-600'}`}>
                            {mi.hasImage ? (
                              // eslint-disable-next-line @next/next/no-img-element -- small cached API image
                              <img src={menuImageSrc(mi.id, mi.imageVersion)} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              itemIcon(mi.route, 28)
                            )}
                          </div>
                        )}
                        <div className={`flex flex-1 flex-col gap-0.5 p-2.5 ${showMenuImages ? '' : 'pr-10'}`}>
                          <span className="line-clamp-2 text-sm font-semibold leading-snug text-ghana-black">{mi.name}</span>
                          {mi.route !== 'bar' && isOnReadyBoard(mi) && (
                            <span className="text-[11px] font-medium text-emerald-700">Ready{mi.readyPortions != null ? ` · ${mi.readyPortions} left` : ''}</span>
                          )}
                          <span className="truncate text-xs text-slate-500">{mi.category}</span>
                          <span className="mt-auto whitespace-nowrap pt-2 text-sm font-bold text-ghana-black">GH₵ {mi.price.toFixed(2)}</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={mi.isPinned ? `Unpin ${mi.name}` : `Pin ${mi.name}`}
                        title={mi.isPinned ? 'Unpin' : 'Pin to the top'}
                        className={`absolute right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none ${
                          showMenuImages
                            ? 'top-1.5 bg-white/90 shadow-sm'
                            : 'top-1.5 bg-slate-50 shadow-sm'
                        } ${mi.isPinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                        onClick={() => togglePin(mi)}
                      >
                        {mi.isPinned ? '★' : '☆'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          </div>


          {/* Order panel */}
          <aside
            id="pos-order-panel"
            className={`${mobileOrderOpen ? 'fixed inset-x-0 bottom-0 top-3 z-40 flex rounded-b-none shadow-2xl' : 'hidden'} min-h-0 flex-col rounded-2xl border border-slate-200 bg-white lg:static lg:z-auto lg:flex lg:rounded-2xl lg:shadow-none`}
            aria-label="Order"
          >
            {/* The order: table and customer at a glance, then the items get the rest of the height. */}
            <div className="flex items-center justify-between gap-2 px-3 pt-3 md:px-4">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Button size="sm" variant="flat" className="bg-slate-100 lg:hidden" startContent={<ChevronDown size={16} aria-hidden />} onClick={() => setMobileOrderOpen(false)}>
                  Menu
                </Button>
                <span className="text-lg font-bold text-ghana-black">{orderMode === 'Takeaway' ? 'Takeaway' : `Table ${tableNumber}`}</span>
                <Chip size="sm" variant="flat" color={venue === 'Bar' ? 'primary' : 'success'}>{venue}</Chip>
                {editingOrderId && <Chip size="sm" variant="flat" color="warning">Editing an order</Chip>}
              </div>
              <span className="min-w-0 truncate text-xs text-slate-500">{customerLabel}</span>
            </div>

            {/* Current order | Orders */}
            <div className="flex border-b border-slate-100 px-3 md:px-4" role="tablist" aria-label="Order views">
              {([['current', `Current order${cartCount ? ` (${cartCount})` : ''}`], ['orders', 'Orders']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={panelTab === key}
                  onClick={() => setPanelTab(key)}
                  className={`-mb-px h-11 border-b-2 px-3 text-sm font-semibold ${panelTab === key ? 'border-ghana-green text-ghana-green' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {panelTab === 'current' ? (
              <div ref={cartRef} className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {cart.length === 0 && !sentOrderData && (
                    <div className="py-10 text-center text-sm text-slate-500">Tap a menu item to start an order.</div>
                  )}
                  {cart.length === 0 && sentOrderData && (
                    <div className="space-y-2 rounded-xl bg-green-50 p-3 text-sm">
                      <div className="text-xs font-semibold text-ghana-green">Sent to kitchen — ready for payment</div>
                      <div className="flex justify-between"><span>Subtotal</span><span>GH₵ {sentOrderData.subtotal.toFixed(2)}</span></div>
                      <div className="flex justify-between text-slate-500"><span>Tax</span><span>GH₵ {sentOrderData.taxAmount.toFixed(2)}</span></div>
                      <div className="flex justify-between border-t border-green-100 pt-2 text-base font-bold text-ghana-black"><span>Total</span><span>GH₵ {sentOrderData.total.toFixed(2)}</span></div>
                    </div>
                  )}
                  {cart.map(ci => (
                    <div key={ci.id} className="border-b border-slate-100 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ci.route === 'bar' ? 'bg-sky-50 text-sky-500' : 'bg-amber-50 text-amber-600'}`}>
                          {itemIcon(ci.route, 18)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 break-words font-medium leading-snug text-ghana-black" title={ci.name}>{ci.name}</div>
                          <div className="text-xs text-slate-500">GH₵ {ci.price.toFixed(2)} each</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button isIconOnly size="sm" variant="bordered" className="min-w-9 border-slate-200" aria-label={`One less ${ci.name}`} onClick={() => updateQty(ci.id, -1)}><Minus size={14} /></Button>
                          <span className="w-6 text-center text-sm font-semibold" aria-live="polite">{ci.qty}</span>
                          <Button isIconOnly size="sm" variant="bordered" className="min-w-9 border-slate-200" aria-label={`One more ${ci.name}`} onClick={() => updateQty(ci.id, 1)}><Plus size={14} /></Button>
                        </div>
                        <div className="hidden min-w-[5.5rem] shrink-0 whitespace-nowrap text-right text-sm font-semibold sm:block">
                          GH₵ {((ci.price - (ci.discountPerUnit || 0) + (ci.serviceChargePerUnit || 0)) * ci.qty).toFixed(2)}
                        </div>
                        <Button isIconOnly size="sm" variant="light" color="danger" aria-label={`Remove ${ci.name}`} onClick={() => updateQty(ci.id, -ci.qty)}><Trash2 size={16} /></Button>
                      </div>
                      {showItemDiscounts && (
                        <div className="mt-2 pl-[3.25rem]">
                          <Input
                            size="sm"
                            type="number"
                            label="Discount per unit (GH₵)"
                            value={String(ci.discountPerUnit || 0)}
                            onChange={(e) => setCart(prev => prev.map(x => x.id === ci.id ? { ...x, discountPerUnit: Number(e.target.value || 0) } : x))}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {cart.length > 0 && (
                  <div className="mt-3 shrink-0 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                    {/* Breakdown folds away under the total so the item list keeps the room; a discount stays visible when set. */}
                    <div id="pos-totals-breakdown" className={showBreakdown ? 'space-y-1.5' : 'hidden'}>
                    <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>GH₵ {subtotal.toFixed(2)}</span></div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">Discount %</span>
                      <Input size="sm" className="w-20" type="number" aria-label="Discount percent" value={String(discountPercent)} onChange={(e) => setDiscountPercent(Number(e.target.value || 0))} />
                    </div>
                    {orderDiscountAmount > 0 && (
                      <div className="flex justify-between text-slate-500"><span>Discount</span><span>−GH₵ {orderDiscountAmount.toFixed(2)}</span></div>
                    )}
                    {serviceChargeAmount > 0 && (
                      <div className="flex justify-between text-slate-500"><span>Service</span><span>GH₵ {serviceChargeAmount.toFixed(2)}</span></div>
                    )}
                    {orderMode === 'Takeaway' && packagingFee > 0 && (
                      <div className="flex justify-between text-slate-500"><span>Packaging</span><span>GH₵ {packagingFee.toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between text-slate-500"><span>Tax (VAT &amp; levies)</span><span>GH₵ {taxAmount.toFixed(2)}</span></div>
                    </div>
                    <button
                      type="button"
                      aria-expanded={showBreakdown}
                      aria-controls="pos-totals-breakdown"
                      onClick={() => setShowBreakdown(v => !v)}
                      className={`flex w-full items-baseline justify-between gap-2 text-left ${showBreakdown ? 'border-t border-slate-100 pt-2' : ''}`}
                    >
                      <span className="flex items-center gap-1 text-base font-semibold text-ghana-black">
                        Total
                        {showBreakdown ? <ChevronUp size={16} className="text-slate-400" aria-hidden /> : <ChevronDown size={16} className="text-slate-400" aria-hidden />}
                        {!showBreakdown && (
                          <span className="text-xs font-normal text-slate-500">
                            incl. tax GH₵ {taxAmount.toFixed(2)}{orderDiscountAmount > 0 ? ` · ${discountPercent}% off` : ''}
                          </span>
                        )}
                      </span>
                      <span className="whitespace-nowrap text-2xl font-bold text-ghana-black">GH₵ {(total + taxAmount).toFixed(2)}</span>
                    </button>
                  </div>
                )}

                <div className="mt-3 shrink-0 space-y-2">
                  {showStationSend ? (
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Button
                      size="lg"
                      variant="flat"
                      className="h-12 border border-ghana-green bg-white font-semibold text-ghana-green"
                      startContent={<Send size={18} aria-hidden />}
                      onPress={sendOrUpdate}
                      isLoading={isSending}
                      isDisabled={isSending || cart.length === 0}
                    >
                      {needsWaiter ? "Choose who's ordering" : editingOrderId ? 'Update order' : (isSending ? 'Sending…' : 'Send to kitchen')}
                    </Button>
                    <Dropdown placement="top-end">
                      <DropdownTrigger>
                        <Button isIconOnly size="lg" variant="flat" className="h-12 w-12 bg-slate-100" aria-label="More order actions">
                          <MoreHorizontal size={20} />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="More order actions"
                        disabledKeys={cart.length === 0 ? ['preview', 'discounts', 'clear'] : []}
                        onAction={(key) => {
                          if (key === 'preview') previewCartReceipt();
                          if (key === 'kot') previewStationTicket('kot');
                          if (key === 'bot') previewStationTicket('bot');
                          if (key === 'discounts') setShowItemDiscounts(v => !v);
                          if (key === 'clear') clearCart();
                        }}
                      >
                        <DropdownItem key="preview" startContent={<Receipt size={16} />}>Preview receipt</DropdownItem>
                        <DropdownItem key="kot" startContent={<Printer size={16} />}>Print KOT</DropdownItem>
                        <DropdownItem key="bot" startContent={<Printer size={16} />}>Print BOT</DropdownItem>
                        <DropdownItem key="discounts">{showItemDiscounts ? 'Hide item discounts' : 'Item discounts'}</DropdownItem>
                        <DropdownItem key="clear" className="text-danger" color="danger" startContent={<Trash2 size={16} />}>Clear order</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                  ) : (
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Button size="sm" variant="flat" className="h-10 bg-slate-100" startContent={<Receipt size={16} />} isDisabled={cart.length === 0} onPress={previewCartReceipt}>Preview receipt</Button>
                    <Button size="sm" variant="flat" color="danger" className="h-10" startContent={<Trash2 size={16} />} isDisabled={cart.length === 0} onPress={() => clearCart()}>Clear order</Button>
                    <Dropdown placement="top-end">
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="flat" className="h-10 w-10 bg-slate-100" aria-label="More order actions">
                          <MoreHorizontal size={20} />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="More order actions"
                        disabledKeys={cart.length === 0 ? ['discounts'] : []}
                        onAction={(key) => {
                          if (key === 'kot') previewStationTicket('kot');
                          if (key === 'bot') previewStationTicket('bot');
                          if (key === 'discounts') setShowItemDiscounts(v => !v);
                        }}
                      >
                        <DropdownItem key="kot" startContent={<Printer size={16} />}>Print KOT</DropdownItem>
                        <DropdownItem key="bot" startContent={<Printer size={16} />}>Print BOT</DropdownItem>
                        <DropdownItem key="discounts">{showItemDiscounts ? 'Hide item discounts' : 'Item discounts'}</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                  )}
                  <Button
                    size="lg"
                    className="h-14 w-full bg-ghana-green text-base font-semibold text-white"
                    startContent={<CreditCard size={20} aria-hidden />}
                    isDisabled={cart.length === 0 && !sentOrderData}
                    onPress={openPayment}
                  >
                    Process payment
                  </Button>
                  <p className="hidden text-center text-[11px] text-slate-400 lg:block">{showStationSend ? 'Ctrl+Enter send · Ctrl+P pay' : 'Ctrl+P pay'}</p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Order status">
                    {([['open', 'Open'], ['paid', 'Paid today']] as const).map(([key, label]) => (
                      <button key={key} type="button" aria-pressed={ordersView === key} onClick={() => setOrdersView(key)}
                        className={`h-8 rounded-md px-3 text-xs font-semibold ${ordersView === key ? 'bg-white text-ghana-black shadow-sm' : 'text-slate-500'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Which tables">
                    {([['table', `Table ${tableNumber}`], ['all', 'All tables']] as const).map(([key, label]) => (
                      <button key={key} type="button" aria-pressed={ordersScope === key} onClick={() => setOrdersScope(key)}
                        className={`h-8 rounded-md px-3 text-xs font-semibold ${ordersScope === key ? 'bg-white text-ghana-black shadow-sm' : 'text-slate-500'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                  {panelOrders.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500">
                      {ordersView === 'open' ? 'No open orders' : 'No paid orders today'}{ordersScope === 'table' ? ` for Table ${tableNumber}` : ''}.
                    </p>
                  ) : panelOrders.map(o => {
                    const status = String(o.status || '').toLowerCase();
                    const orderTotal = Number(o.total) || o.items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
                    return (
                      <div key={o.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-ghana-black">{o.orderNumber || o.id}</div>
                            <div className="text-xs text-slate-500">
                              {o.table ? `Table ${o.table} · ` : ''}{activityStamp(o.createdAt || o.timestamp).time}
                              {o.guestName ? ` · ${o.guestName}` : ''}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-sm font-bold">GH₵ {orderTotal.toFixed(2)}</div>
                            <Chip size="sm" variant="flat" className="capitalize" color={status === 'billed' || status === 'paid' ? 'success' : status === 'served' || status === 'ready' ? 'primary' : 'warning'}>{status || '—'}</Chip>
                          </div>
                        </div>
                        <ul className="mt-2 divide-y divide-slate-100">
                          {o.items.map(it => (
                            <li key={it.id}>
                              <button type="button" onClick={() => openActivityModal(o, it)} className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-sm hover:bg-slate-50">
                                <span className="min-w-0 truncate">{it.qty} × {it.name}</span>
                                <span className="shrink-0 text-xs capitalize text-slate-500">{it.status || o.status}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {ordersView === 'open' && (
                          <Button size="sm" className="mt-2 w-full bg-ghana-green text-white" startContent={<CreditCard size={14} aria-hidden />} onClick={() => payActivityOrder(o)}>
                            Pay this order
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 shrink-0 text-center text-xs text-slate-400">Tap an item to serve, edit, cancel, refund or delete it.</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Phones and small tablets: the running total is always in reach; tapping it slides the order up over the menu. */}
      {!mobileOrderOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
          <Button
            className={`h-12 w-full font-semibold ${cart.length > 0 || sentOrderData ? 'bg-ghana-green text-white' : 'bg-slate-100 text-ghana-black'}`}
            onClick={() => {
              setPanelTab(cart.length > 0 || sentOrderData ? 'current' : 'orders');
              setMobileOrderOpen(true);
            }}
          >
            {cart.length > 0
              ? `View order · ${cartCount} ${cartCount === 1 ? 'item' : 'items'} · GH₵ ${(total + taxAmount).toFixed(2)}`
              : sentOrderData ? 'Sent to kitchen · Take payment' : 'Open orders'}
          </Button>
        </div>
      )}

      {/* Open the Restaurant / Bar till: count the cash in the drawer and start the shift. */}
      <Modal isOpen={openTillModal.isOpen} onClose={openTillModal.onClose} size="sm" placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            Open the till
            <span className="text-sm font-normal text-slate-500">
              {cashierName ? `${cashierName}'s Restaurant / Bar shift. ` : ''}Count the cash in the drawer before you start.
            </span>
          </ModalHeader>
          <ModalBody>
            <Input
              autoFocus
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              label="Starting cash (float), GH₵"
              placeholder="e.g. 200.00"
              value={tillFloat}
              onValueChange={setTillFloat}
              onKeyDown={(e) => { if (e.key === 'Enter') void openTill(); }}
            />
            <p className="text-xs text-slate-500">At the end of the shift, close the till under Restaurant &amp; Bar → Cashiering to count up.</p>
            {tillError && <p className="text-sm text-red-600" role="alert">{tillError}</p>}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={openTillModal.onClose}>Cancel</Button>
            <Button className="bg-ghana-green text-white" isLoading={tillBusy} isDisabled={tillFloat === ''} onPress={() => void openTill()}>
              Open till
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Shared terminal: PIN once, then this waiter keeps taking orders until they switch or the terminal sits idle. */}
      <Modal isOpen={waiterSwitchModal.isOpen} onClose={waiterSwitchModal.onClose} size="md" placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            {switchTarget ? `Hi ${switchTarget.name}` : "Who's taking this order?"}
            <span className="text-sm font-normal text-slate-500">
              {switchTarget ? 'Enter your PIN' : 'Tap your name. Payments still go to the signed-in cashier.'}
            </span>
          </ModalHeader>
          <ModalBody className="pb-6">
            {!switchTarget ? (
              waiters.length === 0 ? (
                <p className="text-sm text-slate-500">No waiters assigned yet. Add them under HR → Departments, in Food &amp; Beverage.</p>
              ) : (
              <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto">
                {[...waiters]
                  // Signed-in person first, then everyone who can switch in, then those still without a PIN.
                  .sort((a, b) => Number(b.id === cashierUserId) - Number(a.id === cashierUserId) || Number(!!b.hasPin) - Number(!!a.hasPin))
                  .map(w => {
                  const isMe = w.id === cashierUserId;
                  const usable = true;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      disabled={!usable}
                      onClick={() => chooseWaiter(w)}
                      className={`flex min-h-16 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left ${verifiedWaiter?.id === w.id ? 'border-ghana-green bg-green-50' : 'border-slate-200 bg-white hover:border-ghana-green/50'} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span className="w-full truncate font-semibold text-ghana-black">{w.name}</span>
                      <span className="text-xs text-slate-500">{isMe ? 'Signed in · no PIN needed' : w.hasPin ? 'PIN' : 'Assigned'}</span>
                    </button>
                  );
                })}
              </div>
              )
            ) : (
              <div className="mx-auto w-full max-w-xs">
                <div className="mb-3 flex justify-center gap-2" aria-live="polite" aria-label={`${switchPin.length} digits entered`}>
                  {Array.from({ length: Math.max(4, switchPin.length) }).map((_, i) => (
                    <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < switchPin.length ? 'bg-ghana-black' : 'bg-slate-200'}`} />
                  ))}
                </div>
                {/* Physical keyboards work too: type digits, Enter to confirm. */}
                <input
                  autoFocus
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="PIN"
                  className="sr-only"
                  value={switchPin}
                  onChange={(e) => { setSwitchError(''); setSwitchPin(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void confirmWaiterPin(); }}
                />
                {switchError && <p className="mb-2 text-center text-sm text-red-600" role="alert">{switchError}</p>}
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'].map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => pressPinKey(k)}
                      disabled={switchBusy || (k === 'ok' && switchPin.length < 4)}
                      aria-label={k === 'back' ? 'Delete last digit' : k === 'ok' ? 'Confirm PIN' : k}
                      className={`h-14 rounded-xl text-xl font-semibold disabled:opacity-40 ${k === 'ok' ? 'bg-ghana-green text-base text-white' : 'bg-slate-100 text-ghana-black active:bg-slate-200'}`}
                    >
                      {k === 'back' ? '⌫' : k === 'ok' ? (switchBusy ? '…' : 'OK') : k}
                    </button>
                  ))}
                </div>
                <button type="button" className="mt-3 w-full text-center text-sm text-slate-500 hover:underline" onClick={() => { setSwitchTarget(null); setSwitchPin(''); setSwitchError(''); }}>
                  Not {switchTarget.name}? Pick another name
                </button>
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={paymentModal.isOpen} onClose={paymentModal.onClose} size="lg">
        <ModalContent>
          <ModalHeader className="text-ghana-black">Complete Payment</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button variant="flat" className="bg-ghana-green text-white" isLoading={isProcessingPayment} isDisabled={isProcessingPayment || amountDue <= 0} onClick={() => handlePayment('Cash', amountDue)}>Cash</Button>
              <Button variant="flat" className="bg-blue-600 text-white" isLoading={isProcessingPayment} isDisabled={isProcessingPayment || amountDue <= 0} onClick={() => handlePayment('Card', amountDue)}>Card</Button>
              <Button variant="flat" className="bg-yellow-500 text-white" isLoading={isProcessingPayment} isDisabled={isProcessingPayment || amountDue <= 0} onClick={() => handlePayment('Mobile Money', amountDue)}>Mobile Money</Button>
              <Button variant="flat" className="bg-purple-600 text-white" isLoading={isProcessingPayment} isDisabled={isProcessingPayment || amountDue <= 0} onClick={() => handlePayment('Room Charge', amountDue)}>Bill to Room</Button>
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
                        Can't find customer? <a className="text-blue-600 underline" href="/guest-services/client-services/clients-services" target="_blank" rel="noopener noreferrer">Register new client</a>
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
              <div className="flex items-center justify-between"><span>Subtotal</span><span className="font-semibold">₵{(payingSavedTicket ? (sentOrderData?.subtotal ?? 0) : (cart.length > 0 ? total : 0)).toFixed(2)}</span></div>
              {orderMode === 'Takeaway' && (
                <div className="flex items-center justify-between"><span>Packaging</span><span className="font-semibold">₵{(packagingFee || 0).toFixed(2)}</span></div>
              )}
              <div className="flex items-center justify-between"><span>Tip</span><span className="font-semibold">₵{(tipAmount || 0).toFixed(2)}</span></div>
              <div className="flex items-center justify-between"><span>Total</span><span className="font-semibold">₵{amountDue.toFixed(2)}</span></div>
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
                  const stamped = issueOrderIdentity(itemsWithOrderDiscount, orderNotes);
                  const data = await createFbOrder({
                    orderNumber: stamped.orderNumber,
                    venue: normalizePosVenue(venue),
                    tableNumber,
                    roomNumber: settleSelectedRoom?.roomId || (customerType === 'In-house' ? roomNumber : undefined),
                    guestId: settleSelectedRoom?.guestId || selectedGuest?.guestId,
                    reservationId: inHouseReservationId(),
                    guestName: guestDisplayName,
                    serverName: waiters.find(w => w.id === waiterId)?.name || waiterId,
                    notes: stamped.notes,
                    covers: 1,
                    discountAmount: orderDiscountAmount,
                    serviceCharge: serviceChargeAmount,
                    quickService,
                    items: itemsWithOrderDiscount.map(i => ({
                      menuItemId: i.id,
                      catalogId: i.id,
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
                } catch (err) {
                  if (quickService && /ready board/i.test((err as Error)?.message || '')) {
                    alert((err as Error).message);
                    return;
                  }
                  /* fallback totals already set */
                }
              }

              // Advance order through state machine → billed (server posts GL + COGS)
              let billCogsAmount = 0;
              const primaryTender =
                (splitPayments.find((s) => s.method !== 'Room Charge' && Number(s.amount) > 0)?.method as PaymentMethod) ||
                'Cash';
              if (primaryTender !== 'Room Charge' && hasOpenTill === false) {
                promptOpenTill();
                return;
              }
              if (orderId) {
                try {
                  await patchFbOrderStatus(orderId, 'preparing');
                  await patchFbOrderStatus(orderId, 'ready');
                  await patchFbOrderStatus(orderId, 'served');
                  const billed = await patchFbOrderStatus(orderId, 'billed', {
                    paymentMethod: primaryTender,
                    staffId: waiterId,
                    staffName: waiters.find(w => w.id === waiterId)?.name || waiterId,
                  });
                  alertStockWarnings(`Order ${orderId}`, billed.stockWarnings);
                  if (billed.cogs?.amount) billCogsAmount = Number(billed.cogs.amount);
                } catch (err) {
                  alert(`Billing failed: ${err instanceof Error ? err.message : 'unknown error'}`);
                  return;
                }
              }
              if (billCogsAmount > 0) {
                console.log(`[F&B POS] Server COGS on split bill: GH₵${billCogsAmount.toFixed(2)}`);
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
                  <Button variant="flat" className={orderWasPosted(selectedOrder.status) ? 'bg-amber-600 text-white' : 'bg-red-600 text-white'} onClick={() => askRemoveOrder(selectedOrder.id, selectedOrder.status)}>{orderWasPosted(selectedOrder.status) ? 'Void' : 'Delete'}</Button>
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
              <iframe title={printPreview.title || 'Preview'} srcDoc={printPreview.html} className="h-[60vh] w-full border-0 bg-white" />
            ) : (
              <div className="text-sm text-gray-500">Nothing to preview.</div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" className="bg-gray-200" onClick={() => { setPrintPreview(null); printPreviewModal.onClose(); }}>Close</Button>
            <Button variant="flat" className="bg-ghana-green text-white" onClick={() => {
              if (printPreview?.html) {
                if (/^\s*<!doctype/i.test(printPreview.html)) openHtmlPrintWindow(printPreview.html);
                else printHtml(printPreview.title || 'Preview', printPreview.html);
              }
            }}>Print</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Activity Row Actions Modal */}
      <Modal isOpen={!!activitySelected} onClose={() => setActivitySelected(null)} size="lg">
        <ModalContent>
          {activitySelected && (() => {
            const o = activitySelected.order;
            const it = activitySelected.item;
            const status = String(o.status || activityLineStatus(o, it)).toLowerCase();
            const canServe = status !== 'served' && status !== 'billed' && status !== 'cancelled' && status !== 'refunded';
            const canPay = status !== 'billed' && status !== 'cancelled' && status !== 'refunded';
            const canRefund = status === 'billed';
            const waiterName = waiters.find(w => w.id === o.waiterId)?.name || o.waiterId || '—';
            const linesSubtotal = o.items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
            const storedTotal = Number(o.total) || 0;
            const ticketTotal = storedTotal > 0 ? storedTotal : linesSubtotal + computeSalesTaxTotal(linesSubtotal);
            const statusColor = status === 'billed' ? 'success' : status === 'cancelled' || status === 'refunded' ? 'danger' : status === 'served' ? 'primary' : 'warning';
            return (
              <>
                <ModalHeader className="flex flex-col items-start gap-1 text-ghana-black">
                  <span>{o.orderNumber || o.id}</span>
                  <span className="text-sm font-normal text-gray-500">{o.guestName || 'Walk-in'} · {o.table || 'No table'}</span>
                </ModalHeader>
                <ModalBody>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                    <Chip size="sm" variant="flat" color={statusColor} className="capitalize">{status || '—'}</Chip>
                    <span className="text-gray-500">{o.venue || '—'}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-500">{waiterName}</span>
                  </div>
                  <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
                    {o.items.map(line => (
                      <div key={line.id} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2">
                        <div className="min-w-0">
                          <div className="font-medium text-ghana-black">{line.name}</div>
                          <div className="text-xs text-gray-500">{line.qty} × ₵{Number(line.price || 0).toFixed(2)}</div>
                        </div>
                        <div className="shrink-0">₵{(Number(line.price || 0) * Number(line.qty || 0)).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3 text-base font-semibold text-ghana-black">
                    <span>Total</span>
                    <span>₵{ticketTotal.toFixed(2)}</span>
                  </div>
                  {(canServe || canPay || canRefund) && (
                    <div className="mt-4 flex gap-2">
                      {canServe && (
                        <Button fullWidth variant="flat" className="bg-orange-50 text-orange-700 border border-orange-200" onClick={() => serveActivityItem(o, it)}>Serve</Button>
                      )}
                      {canPay && (
                        <Button fullWidth variant="flat" className="bg-blue-600 text-white" onClick={() => payActivityOrder(o)}>Pay ticket</Button>
                      )}
                      {canRefund && (
                        <Button fullWidth variant="flat" className="bg-red-600 text-white" onClick={() => refundBilledOrder(o.id, o.venue)}>Refund</Button>
                      )}
                    </div>
                  )}
                </ModalBody>
                <ModalFooter className="flex-wrap justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="light" onClick={() => {
                      loadOrderIntoCart({
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
                      setActivitySelected(null);
                    }}>Edit in cart</Button>
                    <Button size="sm" variant="light" className="text-red-600" onClick={() => cancelReasonModal.onOpen()}>Cancel item</Button>
                    <Button size="sm" variant="light" className="text-red-600" onClick={() => askRemoveOrder(o.id, o.status)}>{orderWasPosted(o.status) ? 'Void order' : 'Delete order'}</Button>
                  </div>
                  <Button variant="flat" className="bg-gray-200" onClick={() => setActivitySelected(null)}>Close</Button>
                </ModalFooter>
              </>
            );
          })()}
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


