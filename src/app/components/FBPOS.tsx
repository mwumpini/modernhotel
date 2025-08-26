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
import { storesStore } from '../lib/stores/store';
import { useAccountingStore } from '../lib/accounting/store';

type CustomerType = 'In-house' | 'Walk-in' | 'Takeout';
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
  status: 'pending' | 'sent' | 'served' | 'paid';
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
  const [guestName, setGuestName] = useState('');
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
  const [ordersPriorityFilter, setOrdersPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'urgent'>(() => {
    try { return (localStorage.getItem('kitchen.priority.filter') as any) || 'high'; } catch { return 'high'; }
  });

  const paymentModal = useDisclosure();
  const aliasModal = useDisclosure();
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

  // POS Activity row modal state
  const [activitySelected, setActivitySelected] = useState<{ order: FBOrder; item: any } | null>(null);
  const [activityQty, setActivityQty] = useState<number>(0);
  const [activityTable, setActivityTable] = useState<string>('');
  const [activityVenue, setActivityVenue] = useState<VenueMode>('Restaurant');
  const [activityWaiter, setActivityWaiter] = useState<string>('');

  const accountingStore = useAccountingStore();

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

  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);

  const waiters: Waiter[] = [
    { id: 'W1', name: 'Ama' },
    { id: 'W2', name: 'Kwame' },
    { id: 'W3', name: 'Efua' },
  ];

  const tables = Array.from({ length: 20 }).map((_, i) => `T${String(i + 1).padStart(2, '0')}`);

  const [menu, setMenu] = useState<MenuItem[]>([
    { id: 'M1', name: 'Jollof Rice', price: 65, category: 'Mains', route: 'kitchen' },
    { id: 'M2', name: 'Banku & Tilapia', price: 85, category: 'Mains', route: 'kitchen' },
    { id: 'M3', name: 'Waakye Pack', price: 50, category: 'Mains', route: 'kitchen' },
    { id: 'M4', name: 'Chicken Wings', price: 45, category: 'Starters', route: 'kitchen' },
    { id: 'M5', name: 'Garden Salad', price: 38, category: 'Starters', route: 'kitchen' },
    { id: 'D1', name: 'Club Beer', price: 20, category: 'Drinks', route: 'bar' },
    { id: 'D2', name: 'Fresh Juice', price: 25, category: 'Drinks', route: 'bar' },
    { id: 'D3', name: 'Cocktail', price: 55, category: 'Drinks', route: 'bar' },
    { id: 'DS1', name: 'Chocolate Cake', price: 30, category: 'Desserts', route: 'kitchen' },
  ]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('fbpos.menu');
      if (raw) setMenu(JSON.parse(raw));
    } catch {}
  }, []);

  React.useEffect(() => {
    localStorage.setItem('fbpos.menu', JSON.stringify(menu));
  }, [menu]);

  type AliasesMap = Record<string, string[]>; // menuId -> aliases
  const [aliases, setAliases] = useState<AliasesMap>(() => {
    try {
      const raw = localStorage.getItem('fbpos.aliases');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const saveAliases = (next: AliasesMap) => {
    setAliases(next);
    localStorage.setItem('fbpos.aliases', JSON.stringify(next));
    trackEvent('FB.MenuAliasesUpdated', { count: Object.values(next).reduce((a, b) => a + b.length, 0) }, { sourceModule: 'F&B' });
  };

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
          aValue = a.order.id;
          bValue = b.order.id;
          break;
        case 'time':
          aValue = a.order.createdAt || '';
          bValue = b.order.createdAt || '';
          break;
        case 'itemCode':
          aValue = (aliases[a.item.id]?.[0]) || a.item.id;
          bValue = (aliases[b.item.id]?.[0]) || b.item.id;
          break;
        case 'itemName':
          aValue = a.item.name;
          bValue = b.item.name;
          break;
        case 'category':
          aValue = menuIdToCategory[a.item.id] || '';
          bValue = menuIdToCategory[b.item.id] || '';
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
  }, [orders, aliases, menuIdToCategory, waiters, sortKey, sortDirection]);

  const openActivityModal = (o: FBOrder, it: any) => {
    setActivitySelected({ order: o, item: it });
    setActivityQty(it.qty || 0);
    setActivityTable(o.table);
    setActivityVenue(o.venue as VenueMode);
    setActivityWaiter(o.waiterId);
  };

  const activityReceipt = () => {
    if (!activitySelected) return;
    const { order: o, item: it } = activitySelected;
    previewReceipt({
      hotelName: 'Ghana Hotel',
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

  const activityEdit = () => {
    if (!activitySelected) return;
    const { order: o, item: it } = activitySelected;
    ordersStore.updateItem(o.id, it.id, { qty: activityQty });
    if (activityTable !== o.table || activityVenue !== (o.venue as VenueMode) || activityWaiter !== o.waiterId) {
      ordersStore.updateOrder(o.id, { table: activityTable, venue: activityVenue as any, waiterId: activityWaiter });
    }
    logAudit({ area: 'f&b', action: 'update', entity: 'OrderItem', entityId: `${o.id}-${it.id}`, details: `Edited qty to ${activityQty}`, meta: { table: activityTable, waiter: activityWaiter, venue: activityVenue }});
    setActivitySelected(null);
  };

  const activityCancel = () => {
    if (!activitySelected) return;
    const { order: o, item: it } = activitySelected;
    ordersStore.removeItem(o.id, it.id);
    logAudit({ area: 'f&b', action: 'delete', entity: 'OrderItem', entityId: `${o.id}-${it.id}`, details: `Cancelled ${it.name}`, meta: { table: o.table, waiter: o.waiterId }});
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

  const clearCart = () => setCart([]);

  const serviceChargeAmount = cart.reduce((sum, ci) => sum + (ci.serviceChargePerUnit || 0) * ci.qty, 0);
  const subtotal = cart.reduce((sum, ci) => sum + ci.price * ci.qty, 0);
  const itemDiscountAmount = cart.reduce((sum, ci) => sum + (ci.discountPerUnit || 0) * ci.qty, 0);
  const orderDiscountAmount = Math.round((subtotal * discountPercent) * 100) / 100 / 100;
  const totalBeforeTip = Math.max(0, subtotal - itemDiscountAmount - orderDiscountAmount + serviceChargeAmount);
  const total = Math.max(0, totalBeforeTip);

  const sendOrder = () => {
    if (cart.length === 0) return;
    const id = `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder: PendingOrder = {
      id,
      table: tableNumber,
      waiterId,
      items: cart,
      status: 'pending',
      customerType,
      venue,
      notes: orderNotes,
      urgent: priority === 'urgent',
      priority,
    };
    setPendingOrders(prev => [newOrder, ...prev]);
    ordersStore.add({
      id: newOrder.id,
      table: newOrder.table,
      waiterId: newOrder.waiterId,
      items: newOrder.items.map(i => ({ 
        id: i.id, 
        name: i.name, 
        price: i.price, 
        qty: i.qty, 
        route: i.route, 
        status: 'pending', 
        prepMinutes: i.route === 'kitchen' ? 15 : 2, 
        isRoomService: i.isRoomService || false,
        discountPerUnit: i.discountPerUnit || 0,
        serviceChargePerUnit: i.serviceChargePerUnit || 0
      })),
      status: newOrder.status,
      customerType: newOrder.customerType,
      venue: newOrder.venue,
      notes: orderNotes,
      urgent: priority === 'urgent',
      priority,
      guestName: customerType === 'In-house' ? guestName : undefined,
      roomNumber: customerType === 'In-house' ? roomNumber : undefined,
    } as any);
    // Auto-issue items to Stores (demo)
    cart.forEach(i => {
      storesIssueBus.issue({ sku: i.id, name: i.name, qty: i.qty, uom: 'ea', department: i.route === 'bar' ? 'Bar' : 'Kitchen', referenceId: id });
    });
    trackEvent('FB.OrderPlaced', { id, table: tableNumber, waiterId, items: cart.map(i => ({ id: i.id, qty: i.qty })), venue, customerType }, { sourceModule: 'F&B' });
    trackEvent('FB.KOT.Created', { id, urgent: priority === 'urgent' }, { sourceModule: 'F&B' });
    clearCart();
    setOrderNotes('');
    setPriority('high');
  };

  const openPayment = () => paymentModal.onOpen();

  const handlePayment = async (paymentMethod: PaymentMethod, amount: number) => {
    if (cart.length === 0) return;

    try {
      // Calculate totals with Ghanaian taxes
      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const vatAmount = subtotal * 0.15; // 15% VAT
      const nhilAmount = subtotal * 0.025; // 2.5% NHIL
      const getFundAmount = subtotal * 0.025; // 2.5% GETFund
      const tourismLevy = (subtotal + vatAmount + nhilAmount + getFundAmount) * 0.01; // 1% Tourism Levy
      const total = subtotal + vatAmount + nhilAmount + getFundAmount + tourismLevy;

      // Persist order in shared store as paid
      const newId = `ORD-${Date.now().toString().slice(-6)}`;
      ordersStore.add({
        id: newId,
        table: tableNumber,
        waiterId,
        items: cart.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          qty: i.qty,
          route: i.route,
          status: 'paid',
          prepMinutes: i.route === 'kitchen' ? 15 : 2,
          isRoomService: i.isRoomService || false,
          discountPerUnit: i.discountPerUnit || 0,
          serviceChargePerUnit: i.serviceChargePerUnit || 0
        })),
        status: 'paid',
        customerType,
        venue,
        notes: orderNotes,
        urgent: priority === 'urgent',
        priority,
        guestName: customerType === 'In-house' ? guestName : undefined,
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

      // Track payment received
      trackEvent('Payment.Received', { orderId: newId, venue, customerType, total, itemCount: cart.length }, { sourceModule: 'F&B' });

      // Clear cart and show success
      setCart([]);
      setDiscountPercent(0);
      setOrderNotes('');
      
      // Print receipt for immediate payments
      if (paymentMethod !== 'Room Charge') {
        printReceipt({
          hotelName: 'Ghana Hotel',
          contact: 'Accra • +233',
          code: `RCPT-${Date.now().toString().slice(-6)}`,
          datetime: new Date().toLocaleString(),
          items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
          subtotal,
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
      // Handle error - show error message to user
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
      status: order.status,
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

  const changeOrderStatus = (orderId: string, status: PendingOrder['status']) => {
    setPendingOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    trackEvent('FB.OrderStatusChanged', { id: orderId, status }, { sourceModule: 'F&B' });
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
            <Button variant="flat" className="bg-gray-100" onClick={aliasModal.onOpen}>Aliases</Button>
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
                <Select label="Customer Type" selectedKeys={[customerType]} onSelectionChange={(k) => setCustomerType(Array.from(k as Set<string>)[0] as CustomerType)}>
                  <SelectItem key="In-house">In-house</SelectItem>
                  <SelectItem key="Walk-in">Walk-in</SelectItem>
                  <SelectItem key="Takeout">Takeout</SelectItem>
                </Select>

                {customerType === 'In-house' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Room Number" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
                    <Input label="Guest Name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
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
                <Input label="Search menu" value={search} onChange={(e) => setSearch(e.target.value)} />
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

          <div className="lg:col-span-2 space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2"><h3 className="font-semibold text-ghana-black">Menu</h3></CardHeader>
              <CardBody>
                <Tabs aria-label="Menu categories">
                  {categories.map(cat => (
                    <Tab key={cat} title={cat}>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {visibleMenu.filter(m => m.category === cat).map(mi => (
                          <button key={mi.id} className="p-3 rounded-lg border border-gray-200 bg-white text-left hover:bg-gray-50" onClick={() => addToCart(mi)}>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-ghana-black">{mi.name}</div>
                                <div className="text-xs text-gray-500 capitalize">{mi.route}</div>
                              </div>
                              <div className="text-sm font-semibold">₵{mi.price}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </Tab>
                  ))}
                </Tabs>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2 flex items-center justify-between">
                <h3 className="font-semibold text-ghana-black">Current Order</h3>
                <Chip size="sm" variant="flat" color="primary">{venue}</Chip>
              </CardHeader>
              <CardBody>
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
                          <div className="w-16 text-right text-sm">₵{(ci.price - (ci.discountPerUnit || 0) + (ci.serviceChargePerUnit || 0)) * ci.qty}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs items-center">
                        <Input size="sm" type="number" label="Discount/Unit (₵)" value={String(ci.discountPerUnit || 0)} onChange={(e) => setCart(prev => prev.map(x => x.id === ci.id ? { ...x, discountPerUnit: Number(e.target.value || 0) } : x))} />
                        <Input size="sm" type="number" label="Service/Unit (₵)" value={String(ci.serviceChargePerUnit || 0)} onChange={(e) => setCart(prev => prev.map(x => x.id === ci.id ? { ...x, serviceChargePerUnit: Number(e.target.value || 0) } : x))} />
                        <Select size="sm" label="Room Service" selectedKeys={[ci.isRoomService ? 'yes' : 'no']} onSelectionChange={(k) => setCart(prev => prev.map(x => x.id === ci.id ? { ...x, isRoomService: Array.from(k as Set<string>)[0] === 'yes' } : x))}>
                          <SelectItem key="no">No</SelectItem>
                          <SelectItem key="yes">Yes</SelectItem>
                        </Select>
                        <Input size="sm" label="Notes" value={ci.note || ''} onChange={(e) => setCart(prev => prev.map(x => x.id === ci.id ? { ...x, note: e.target.value } : x))} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>₵{subtotal.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between">
                    <span>Discount (%)</span>
                    <Input className="w-24" type="number" value={String(discountPercent)} onChange={(e) => setDiscountPercent(Number(e.target.value || 0))} />
                  </div>
                  <div className="flex justify-between"><span>Discount</span><span>₵{orderDiscountAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Service Charge</span><span>₵{serviceChargeAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold text-ghana-black"><span>Total</span><span>₵{total.toFixed(2)}</span></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="flat" className="bg-ghana-green text-white" onClick={sendOrder}>Send</Button>
                  <Button variant="flat" className="bg-gray-200" onClick={clearCart}>Clear</Button>
                  <Button variant="flat" className="bg-blue-600 text-white" onClick={openPayment}>Pay</Button>
                  <Button variant="flat" className="bg-indigo-600 text-white" onClick={() => {
                    const html = buildReceiptHtml({
                      hotelName: 'Ghana Hotel',
                      contact: 'Accra • +233',
                      code: `RCPT-${Date.now().toString().slice(-6)}`,
                      datetime: new Date().toLocaleString(),
                      items: cart.length > 0 ? cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })) : [
                        { name: 'Jollof Rice', qty: 1, price: 65 },
                        { name: 'Club Beer', qty: 2, price: 20 },
                      ],
                      subtotal: cart.length > 0 ? subtotal : 105,
                      discount: cart.length > 0 ? orderDiscountAmount : 0,
                      total: cart.length > 0 ? total : 105,
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

        {/* POS Activity Table - moved to bottom */}
        <Card className="border-0 shadow-lg mt-6">
                        <CardHeader className="pb-2 flex items-center justify-between">
                <h3 className="font-semibold text-ghana-black">POS Activity Table</h3>
                <Button 
                  size="sm" 
                  variant="flat" 
                  onClick={() => setShowAllItems(!showAllItems)}
                >
                  {showAllItems ? 'Show 10' : 'Show All'}
                </Button>
              </CardHeader>
          <CardBody>
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
                        DATE/TIME {sortKey === 'time' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
                      <TableColumn 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortKey === 'itemCode') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey('itemCode');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        ITEM CODE {sortKey === 'itemCode' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </TableColumn>
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
                    </TableHeader>
                    <TableBody>
                      {sortedOrders.slice(0, showAllItems ? undefined : 10).map(({ order: o, item: it }) => (
                        <TableRow key={`${o.id}-${it.id}`} onDoubleClick={() => openActivityModal(o, it)}>
                          <TableCell>{o.id}</TableCell>
                          <TableCell>{o.createdAt ? new Date(o.createdAt).toLocaleString() : '-'}</TableCell>
                          <TableCell>{(aliases[it.id]?.[0]) || it.id}</TableCell>
                          <TableCell>{it.name}</TableCell>
                          <TableCell>{menuIdToCategory[it.id] || '-'}</TableCell>
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
              <Button variant="flat" className="bg-ghana-green text-white" onClick={() => handlePayment('Cash', total)}>Cash</Button>
              <Button variant="flat" className="bg-blue-600 text-white" onClick={() => handlePayment('Card', total)}>Card</Button>
              <Button variant="flat" className="bg-yellow-500 text-white" onClick={() => handlePayment('Mobile Money', total)}>Mobile Money</Button>
              <Button variant="flat" className="bg-purple-600 text-white" onClick={() => handlePayment('Room Charge', total)}>Bill to Room</Button>
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
            <div className="text-sm">
              <div className="flex items-center justify-between"><span>Total</span><span className="font-semibold">₵{total.toFixed(2)}</span></div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" className="bg-gray-200" onClick={paymentModal.onClose}>Close</Button>
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
                  <Button variant="flat" className="bg-blue-600 text-white" onClick={() => changeOrderStatus(selectedOrder.id, 'sent')}>Mark Sent</Button>
                  <Button variant="flat" className="bg-green-600 text-white" onClick={() => changeOrderStatus(selectedOrder.id, 'served')}>Mark Served</Button>
                  <Button variant="flat" className="bg-ghana-gold text-white" onClick={() => changeOrderStatus(selectedOrder.id, 'paid')}>Mark Paid</Button>
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

      <Modal isOpen={aliasModal.isOpen} onClose={aliasModal.onClose} size="lg">
        <ModalContent>
          <ModalHeader className="text-ghana-black">Menu Short Names (Aliases)</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              {menu.map(m => (
                <div key={m.id} className="p-2 rounded-lg border border-gray-200">
                  <div className="text-sm font-medium text-ghana-black">{m.name} <span className="text-xs text-gray-500">(₵{m.price})</span></div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(aliases[m.id] || []).map((a, idx) => (
                      <Chip key={idx} variant="flat" className="bg-ghana-green/10 text-ghana-green">
                        {a}
                        <button className="ml-2 text-xs" onClick={() => {
                          const next = { ...aliases, [m.id]: (aliases[m.id] || []).filter(x => x !== a) };
                          saveAliases(next);
                        }}>✕</button>
                      </Chip>
                    ))}
                    <Input className="w-48" size="sm" placeholder="Add alias and press Enter" onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (!val) return;
                        const next = { ...aliases, [m.id]: Array.from(new Set([...(aliases[m.id] || []), val])) };
                        saveAliases(next);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" className="bg-gray-200" onClick={aliasModal.onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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

      {/* Activity Row Actions Modal */}
      <Modal isOpen={!!activitySelected} onClose={() => setActivitySelected(null)}>
        <ModalContent>
          <ModalHeader className="text-ghana-black">POS Item Actions</ModalHeader>
          <ModalBody>
            {!activitySelected ? null : (
              <div className="space-y-3 text-sm">
                <div><strong>Item:</strong> {activitySelected.item.name}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Input size="sm" type="number" label="Qty" value={String(activityQty)} onChange={(e) => setActivityQty(Math.max(0, Number(e.target.value || 0)))} />
                  <Input size="sm" label="Table" value={activityTable} onChange={(e) => setActivityTable(e.target.value)} />
                  <Select size="sm" label="Venue" selectedKeys={[activityVenue]} onSelectionChange={(k) => setActivityVenue(Array.from(k as Set<string>)[0] as VenueMode)}>
                    <SelectItem key="Restaurant">Restaurant</SelectItem>
                    <SelectItem key="Bar">Bar</SelectItem>
                  </Select>
                  <Select size="sm" label="Waiter" selectedKeys={[activityWaiter]} onSelectionChange={(k) => setActivityWaiter(Array.from(k as Set<string>)[0])}>
                    {waiters.map(w => (<SelectItem key={w.id}>{w.name}</SelectItem>))}
                  </Select>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" className="bg-gray-200" onClick={() => setActivitySelected(null)}>Close</Button>
            {activitySelected && (
              <>
                <Button color="primary" onClick={activityReceipt}>Receipt</Button>
                <Button color="warning" variant="flat" onClick={activityChangeOrder}>Change Order</Button>
                <Button color="secondary" variant="flat" onClick={activityEdit}>Edit</Button>
                <Button color="danger" onClick={activityCancel}>Cancel</Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}


