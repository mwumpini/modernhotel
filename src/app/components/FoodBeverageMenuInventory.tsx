'use client';

import React, { useEffect, useMemo, useState } from 'react';
import HeadingInfo from './HeadingInfo';
import MenuPhotoPicker, { menuImageSrc } from './fb/MenuPhotoPicker';
import { Card, CardBody, Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Tabs, Tab, Pagination } from "@heroui/react";
import { worksheetTableClassNames } from './frontoffice/StayWorksheetTable';
import { sizedTableClassNames, useResizableColumns } from './frontoffice/columnResize';
import { DateFilterPills, matchesDateFilter, useDateFilter } from './fb/DateFilterPills';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import DepartmentRequisitionModal from './inventory/DepartmentRequisitionModal';
import DepartmentInventoryPanel from './inventory/DepartmentInventoryPanel';

function fbHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

const deskTableClassNames = {
  ...worksheetTableClassNames,
  table: 'w-full min-w-max',
  th: `${worksheetTableClassNames.th} relative`,
};

type ColumnSort = { column: string; direction: 'asc' | 'desc' };

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
  return prev.column === column
    ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
    : { column, direction: 'asc' };
}

const MENU_UNITS = ['portion', 'plate', 'bowl', 'glass', 'bottle', 'shot', 'cup', 'piece'] as const;

const emptyMenuForm = {
  code: '',
  name: '',
  alias: '',
  category: 'food',
  venue: 'restaurant',
  route: 'kitchen',
  unit: 'portion',
  description: '',
  price: '0',
  cost: '0',
  prepTime: '15',
  allergens: '',
  inventoryItemId: '',
  stockLocationId: '',
};

function venueLabel(venue: string) {
  switch (venue) {
    case 'restaurant': return 'Restaurant';
    case 'bar': return 'Bar';
    case 'room_service': return 'Room service';
    case 'pool_bar': return 'Pool bar';
    case 'all': return 'All venues';
    default: return venue || '—';
  }
}

function categoryLabel(category: string) {
  if (!category) return '—';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function unitLabel(unit: string) {
  if (!unit) return 'Portion';
  return unit.charAt(0).toUpperCase() + unit.slice(1);
}

interface MenuItem {
  id: string;
  code: string;
  name: string;
  alias: string;
  description: string;
  category: string;
  venue: string;
  route: string;
  unit: string;
  price: number;
  cost: number;
  profitMargin: number;
  available: boolean;
  preparationTime: number;
  allergens: string[];
  usedCount: number;
  inventoryItemId: string | null;
  stockLocationId: string | null;
  hasImage: boolean;
  imageVersion: number;
}

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  defaultCost: number;
  sellingPrice: number;
  isActive: boolean;
  createdAt?: string;
}

interface Requisition {
  id: string;
  requisitionNumber: string;
  requestedBy: string;
  requestedDate: Date;
  status: 'pending' | 'approved' | 'ready' | 'rejected' | 'converted-to-po' | 'cancelled';
  notes: string;
  items: { itemName: string; quantity: number }[];
}

export default function FoodBeverageMenuInventory({ panel }: { panel?: 'menu' | 'inventory' | 'requisitions' }) {
  const [selectedTab, setSelectedTab] = useState('menu');
  const [isNewMenuItemModalOpen, setIsNewMenuItemModalOpen] = useState(false);
  const [viewingMenuId, setViewingMenuId] = useState<string | null>(null);
  const [isNewRequisitionModalOpen, setIsNewRequisitionModalOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [menuLayout, setMenuLayout] = useState<'cards' | 'table'>('cards');
  const [menuPage, setMenuPage] = useState(1);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuSort, setMenuSort] = useState<ColumnSort>({ column: 'name', direction: 'asc' });
  const [requisitionQuery, setRequisitionQuery] = useState('');
  const requisitionDates = useDateFilter();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const reloadMenu = () => {
    fetch('/api/fb/menu?includeUsage=true', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setMenuItems((data.items || []).map((i: any) => {
        const price = Number(i.unitPrice || 0);
        const cost = Number(i.costPrice || 0);
        return {
          id: i.id,
          code: i.code,
          name: i.name,
          alias: i.alias || '',
          description: i.description || '',
          category: i.category,
          venue: i.venue,
          route: i.route || (i.category === 'beverage' ? 'bar' : 'kitchen'),
          unit: i.unit || 'portion',
          price,
          cost,
          profitMargin: price > 0 ? ((price - cost) / price) * 100 : 0,
          available: i.isAvailable,
          preparationTime: i.prepMinutes,
          allergens: i.allergens ? i.allergens.split(',').map((a: string) => a.trim()).filter(Boolean) : [],
          usedCount: Number(i.usedCount || 0),
          inventoryItemId: i.inventoryItemId || null,
          stockLocationId: i.stockLocationId || null,
          hasImage: !!i.hasImage,
          imageVersion: Number(i.imageVersion || 0),
        };
      })))
      .catch(() => setMenuItems([]));
  };
  useEffect(() => { reloadMenu(); }, []);

  const [menuForm, setMenuForm] = useState(emptyMenuForm);
  // Photo edit: undefined = keep the saved one, '' = remove it, a data URL = the new photo.
  const [menuPhoto, setMenuPhoto] = useState<string | undefined>(undefined);
  const closeMenuForm = () => {
    setIsNewMenuItemModalOpen(false);
    setEditingMenuId(null);
    setMenuForm(emptyMenuForm);
    setMenuPhoto(undefined);
  };
  const openCreateMenu = () => {
    setEditingMenuId(null);
    setMenuForm(emptyMenuForm);
    setMenuPhoto(undefined);
    reloadInventoryItems();
    reloadRestaurantLocations();
    setIsNewMenuItemModalOpen(true);
  };
  const openEditMenu = (item: MenuItem) => {
    setEditingMenuId(item.id);
    setMenuPhoto(undefined);
    reloadInventoryItems();
    reloadRestaurantLocations();
    setMenuForm({
      code: item.code,
      name: item.name,
      alias: item.alias,
      category: item.category || 'food',
      venue: item.venue || 'restaurant',
      route: item.route || 'kitchen',
      unit: item.unit || 'portion',
      description: item.description,
      price: String(item.price),
      cost: String(item.cost),
      prepTime: String(item.preparationTime || 15),
      allergens: item.allergens.filter((allergen) => allergen && allergen !== 'None').join(', '),
      inventoryItemId: item.inventoryItemId || '',
      stockLocationId: item.stockLocationId || '',
    });
    setViewingMenuId(null);
    setIsNewMenuItemModalOpen(true);
  };
  const submitMenuItem = async () => {
    if (!menuForm.name) return;
    const payload = {
      name: menuForm.name,
      alias: menuForm.alias.trim(),
      description: menuForm.description,
      category: menuForm.category,
      venue: menuForm.venue,
      route: menuForm.route || (menuForm.category === 'beverage' ? 'bar' : 'kitchen'),
      unit: menuForm.unit || 'portion',
      unitPrice: Number(menuForm.price) || 0,
      costPrice: Number(menuForm.cost) || 0,
      prepMinutes: Number(menuForm.prepTime) || 10,
      allergens: menuForm.allergens || undefined,
      inventoryItemId: menuForm.inventoryItemId || null,
      stockLocationId: menuForm.inventoryItemId ? (menuForm.stockLocationId || null) : null,
      ...(menuPhoto !== undefined ? { imageUrl: menuPhoto || null } : {}),
    };
    const res = await fetch('/api/fb/menu', {
      method: editingMenuId ? 'PATCH' : 'POST',
      headers: fbHeaders(),
      body: JSON.stringify(editingMenuId
        ? { id: editingMenuId, code: menuForm.code.trim() || undefined, ...payload }
        : {
            ...payload,
            code: menuForm.code.trim() || menuForm.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20) + '-' + Date.now().toString().slice(-4),
          }),
    });
    if (res.ok) {
      closeMenuForm();
      reloadMenu();
    }
  };
  const toggleMenuItemAvailability = async (item: MenuItem) => {
    await fetch('/api/fb/menu', {
      method: 'PATCH',
      headers: fbHeaders(),
      body: JSON.stringify({ id: item.id, isAvailable: !item.available }),
    });
    reloadMenu();
  };

  const handleRemoveMenuItem = async (item: MenuItem) => {
    if (item.usedCount > 0) {
      if (!item.available) {
        alert(`${item.name} has ${item.usedCount} order line${item.usedCount === 1 ? '' : 's'} and cannot be deleted. It is already unavailable.`);
        return;
      }
      if (
        !confirm(
          `${item.name} has ${item.usedCount} order line${item.usedCount === 1 ? '' : 's'} and cannot be deleted. Mark it Unavailable so it stays off new orders but history is kept?`
        )
      ) {
        return;
      }
      await fetch('/api/fb/menu', {
        method: 'PATCH',
        headers: fbHeaders(),
        body: JSON.stringify({ id: item.id, isAvailable: false }),
      });
      reloadMenu();
      return;
    }
    if (!confirm(`Delete ${item.name}? This action cannot be undone.`)) return;
    await fetch(`/api/fb/menu?id=${encodeURIComponent(item.id)}`, { method: 'DELETE', headers: fbHeaders() });
    reloadMenu();
  };


  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [restaurantLocations, setRestaurantLocations] = useState<{ id: string; name: string }[]>([]);
  const reloadInventoryItems = () => {
    fetch('/api/inventory/items', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setInventoryItems((data.items || []).map((i: any) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        description: i.description || '',
        category: i.category?.name || '—',
        unit: i.unit?.name || '—',
        defaultCost: Number(i.defaultCost || 0),
        sellingPrice: Number(i.sellingPrice || 0),
        isActive: i.isActive,
        createdAt: i.createdAt,
      }))))
      .catch(() => setInventoryItems([]));
  };
  const reloadRestaurantLocations = () => {
    fetch('/api/inventory/stock-locations?activeOnly=1&department=restaurant', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { locations: [] }))
      .then((data) =>
        setRestaurantLocations(
          (data.locations || []).map((loc: any) => ({ id: loc.id, name: loc.name })),
        ),
      )
      .catch(() => setRestaurantLocations([]));
  };

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [requisitionStatusFilter, setRequisitionStatusFilter] = useState('all');
  const [requisitionSort, setRequisitionSort] = useState<ColumnSort>({ column: 'date', direction: 'desc' });
  const menuCols = useResizableColumns({
    code: 110,
    name: 200,
    category: 120,
    unit: 100,
    venue: 120,
    price: 90,
    prep: 80,
    status: 120,
  });
  const requisitionCols = useResizableColumns({
    number: 140,
    items: 240,
    by: 160,
    date: 140,
    status: 120,
  });
  const reloadRequisitions = () => {
    fetch('/api/inventory/requisitions?department=restaurant', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { requisitions: [] }))
      .then((data) => setRequisitions((data.requisitions || []).map((req: any) => ({
        id: req.id,
        requisitionNumber: req.requisitionNumber,
        requestedBy: req.requestedBy,
        requestedDate: new Date(req.requestedDate || req.createdAt),
        status: req.status,
        notes: req.notes || '',
        items: (req.items || []).map((it: any) => ({ itemName: it.itemName, quantity: Number(it.quantity) })),
      }))))
      .catch(() => setRequisitions([]));
  };

  // Ledger on-hand for Restaurant (menu/requisition summary cards).
  const [stockOnHand, setStockOnHand] = useState<Record<string, number>>({});
  const reloadStockLevels = () => {
    fetch('/api/inventory/stock-levels?department=restaurant', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setStockOnHand(Object.fromEntries((data.items || []).map((i: any) => [i.id, Number(i.onHand || 0)]))))
      .catch(() => setStockOnHand({}));
  };

  useEffect(() => { reloadInventoryItems(); reloadRestaurantLocations(); reloadRequisitions(); reloadStockLevels(); }, []);

  const getRequisitionStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'primary';
      case 'ready': return 'success';
      case 'converted-to-po': return 'secondary';
      case 'rejected': return 'danger';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const menuQueryText = menuQuery.trim().toLowerCase();
  const filteredMenuItems = menuItems.filter((item) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (!menuQueryText) return true;
    return [item.name, item.alias, item.code].some((value) => value.toLowerCase().includes(menuQueryText));
  });

  const sortedMenuItems = useMemo(() => {
    const direction = menuSort.direction === 'asc' ? 1 : -1;
    const value = (item: MenuItem) => {
      switch (menuSort.column) {
        case 'code': return item.code || '';
        case 'category': return item.category || '';
        case 'unit': return item.unit || '';
        case 'venue': return item.venue || '';
        case 'price': return item.price || 0;
        case 'prep': return item.preparationTime || 0;
        case 'status': return item.available ? 'Available' : 'Unavailable';
        default: return item.name || '';
      }
    };
    return [...filteredMenuItems].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [filteredMenuItems, menuSort]);

  const menuPageSize = menuLayout === 'cards' ? 18 : 10;
  const menuPages = Math.max(1, Math.ceil(sortedMenuItems.length / menuPageSize));
  const menuPageSafe = Math.min(menuPage, menuPages);
  const pagedMenuItems = sortedMenuItems.slice((menuPageSafe - 1) * menuPageSize, menuPageSafe * menuPageSize);

  const sortedRequisitions = useMemo(() => {
    const term = requisitionQuery.trim().toLowerCase();
    const list = requisitions.filter((req) => {
      if (requisitionStatusFilter !== 'all' && req.status !== requisitionStatusFilter) return false;
      if (!matchesDateFilter(req.requestedDate, requisitionDates.mode, requisitionDates.single, requisitionDates.from, requisitionDates.to)) return false;
      if (!term) return true;
      const itemText = req.items.map((item) => item.itemName).join(' ');
      return [req.requisitionNumber, req.requestedBy, req.notes, req.status, itemText]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
    const direction = requisitionSort.direction === 'asc' ? 1 : -1;
    const value = (req: Requisition) => {
      switch (requisitionSort.column) {
        case 'number': return req.requisitionNumber || '';
        case 'items': return req.items.length;
        case 'by': return req.requestedBy || '';
        case 'status': return req.status || '';
        default: return req.requestedDate.getTime();
      }
    };
    return [...list].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [requisitions, requisitionStatusFilter, requisitionSort, requisitionQuery, requisitionDates.mode, requisitionDates.single, requisitionDates.from, requisitionDates.to]);

  const embedded = Boolean(panel);
  const openMenuItem = viewingMenuId ? menuItems.find((item) => item.id === viewingMenuId) ?? null : null;

  return (
    <div className={embedded ? 'px-2 pb-2' : 'p-6'}>
      {/* Header */}
      {!embedded && (
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-2xl font-bold text-ghana-black">🍽️ Restaurant & Bar - Menu & Inventory</h2>
            <HeadingInfo label="About menu and inventory">Manage menu items, inventory items, and stock requisitions to Stores</HeadingInfo>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            color="primary"
            className="bg-ghana-green text-white"
            onClick={openCreateMenu}
          >
            + Add Menu Item
          </Button>
          <Button
            color="success"
            className="bg-blue-500 text-white"
            onClick={() => setIsNewRequisitionModalOpen(true)}
          >
            + Request Stock
          </Button>
        </div>
      </div>
      )}

      {/* Stats Overview */}
      {!embedded && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Menu Items</p>
                <p className="text-2xl font-bold text-ghana-black">{menuItems.length}</p>
                <p className="text-sm text-green-600">{menuItems.filter(item => item.available).length} available</p>
              </div>
              <div className="text-3xl">🍽️</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inventory Items</p>
                <p className="text-2xl font-bold text-ghana-black">{inventoryItems.length}</p>
                <p className="text-sm text-gray-500">{inventoryItems.filter(i => i.isActive).length} active</p>
              </div>
              <div className="text-3xl">📦</div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Requisitions</p>
                <p className="text-2xl font-bold text-ghana-black">{requisitions.length}</p>
                <p className="text-sm text-amber-600">{requisitions.filter(r => r.status === 'pending').length} pending</p>
              </div>
              <div className="text-3xl">📝</div>
            </div>
          </CardBody>
        </Card>
      </div>
      )}

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs 
            selectedKey={panel || selectedTab} 
            onSelectionChange={(key) => { if (!embedded) setSelectedTab(key as string); }}
            className="w-full"
            classNames={embedded ? { tabList: 'hidden', panel: 'p-0' } : undefined}
          >
            {(!embedded || panel === 'menu') && (
            <Tab key="menu" title="🍽️ Menu Management">
              <div className="px-2 pb-3">
                <div className="mb-[18px] flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="Search menu"
                    placeholder="Search menu"
                    size="sm"
                    value={menuQuery}
                    onValueChange={(value) => {
                      setMenuQuery(value);
                      setMenuPage(1);
                    }}
                    isClearable
                    onClear={() => {
                      setMenuQuery('');
                      setMenuPage(1);
                    }}
                    className="w-full max-w-full sm:w-56 sm:max-w-[14rem] shrink-0"
                  />
                  <Select
                    aria-label="Category"
                    placeholder="All categories"
                    size="sm"
                    selectedKeys={[selectedCategory]}
                    onSelectionChange={(keys) => {
                      const next = Array.from(keys)[0] as string;
                      if (next) {
                        setSelectedCategory(next);
                        setMenuPage(1);
                      }
                    }}
                    className="w-full max-w-full sm:w-44 sm:max-w-[11rem] shrink-0"
                  >
                    <SelectItem key="all">All categories</SelectItem>
                    <SelectItem key="food">Food</SelectItem>
                    <SelectItem key="beverage">Beverage</SelectItem>
                    <SelectItem key="dessert">Dessert</SelectItem>
                    <SelectItem key="snack">Snack</SelectItem>
                    <SelectItem key="special">Special</SelectItem>
                  </Select>
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    <div className="flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                      <button
                        type="button"
                        className={`rounded-md px-3 min-h-8 text-sm ${menuLayout === 'cards' ? 'bg-white font-semibold text-ghana-black shadow-sm' : 'text-gray-600'}`}
                        onClick={() => { setMenuLayout('cards'); setMenuPage(1); }}
                      >
                        Cards
                      </button>
                      <button
                        type="button"
                        className={`rounded-md px-3 min-h-8 text-sm ${menuLayout === 'table' ? 'bg-white font-semibold text-ghana-black shadow-sm' : 'text-gray-600'}`}
                        onClick={() => { setMenuLayout('table'); setMenuPage(1); }}
                      >
                        Table
                      </button>
                    </div>
                    <Button size="sm" color="primary" className="shrink-0 bg-ghana-green text-white" onPress={openCreateMenu}>
                      + Add Menu Item
                    </Button>
                  </div>
                </div>

                {menuLayout === 'cards' ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {pagedMenuItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setViewingMenuId(item.id)}
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-left shadow-sm hover:border-ghana-green"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="line-clamp-1 text-sm font-semibold leading-5 text-ghana-black">{item.name}</span>
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.available ? 'bg-green-500' : 'bg-red-400'}`}
                            title={item.available ? 'Available' : 'Unavailable'}
                          />
                        </div>
                        <div className="mt-1 flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold tabular-nums text-ghana-black">₵{item.price.toFixed(2)}</span>
                          <span className="truncate text-[11px] text-gray-500">{unitLabel(item.unit)} · {item.preparationTime}m</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div ref={menuCols.frameRef} style={menuCols.frameStyle}>
                  <Table aria-label="Menu items" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
                    <TableHeader>
                      <TableColumn className="relative" style={menuCols.style('code')}>{<SortHeader label="Code" column="code" sort={menuSort} onSort={(column) => setMenuSort((prev) => toggleColumnSort(prev, column))} />}{menuCols.sizer('code', 'Code')}</TableColumn>
                      <TableColumn className="relative" style={menuCols.style('name')}>{<SortHeader label="Item" column="name" sort={menuSort} onSort={(column) => setMenuSort((prev) => toggleColumnSort(prev, column))} />}{menuCols.sizer('name', 'Item')}</TableColumn>
                      <TableColumn className="relative" style={menuCols.style('category')}>{<SortHeader label="Category" column="category" sort={menuSort} onSort={(column) => setMenuSort((prev) => toggleColumnSort(prev, column))} />}{menuCols.sizer('category', 'Category')}</TableColumn>
                      <TableColumn className="relative" style={menuCols.style('unit')}>{<SortHeader label="Unit" column="unit" sort={menuSort} onSort={(column) => setMenuSort((prev) => toggleColumnSort(prev, column))} />}{menuCols.sizer('unit', 'Unit')}</TableColumn>
                      <TableColumn className="relative" style={menuCols.style('venue')}>{<SortHeader label="Venue" column="venue" sort={menuSort} onSort={(column) => setMenuSort((prev) => toggleColumnSort(prev, column))} />}{menuCols.sizer('venue', 'Venue')}</TableColumn>
                      <TableColumn className="relative" style={menuCols.style('price')}>{<SortHeader label="Price" column="price" sort={menuSort} onSort={(column) => setMenuSort((prev) => toggleColumnSort(prev, column))} align="right" />}{menuCols.sizer('price', 'Price')}</TableColumn>
                      <TableColumn className="relative" style={menuCols.style('prep')}>{<SortHeader label="Prep" column="prep" sort={menuSort} onSort={(column) => setMenuSort((prev) => toggleColumnSort(prev, column))} />}{menuCols.sizer('prep', 'Prep')}</TableColumn>
                      <TableColumn className="relative" style={menuCols.style('status')}>{<SortHeader label="Status" column="status" sort={menuSort} onSort={(column) => setMenuSort((prev) => toggleColumnSort(prev, column))} />}{menuCols.sizer('status', 'Status')}</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No menu items.">
                      {pagedMenuItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setViewingMenuId(item.id)}
                        >
                          <TableCell className="whitespace-nowrap">{item.code}</TableCell>
                          <TableCell>
                            <div className="min-w-0 whitespace-normal">
                              <p className="font-medium text-ghana-black">{item.name}</p>
                              {item.alias && <p className="text-xs text-gray-500">{item.alias}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{categoryLabel(item.category)}</TableCell>
                          <TableCell>{unitLabel(item.unit)}</TableCell>
                          <TableCell>{venueLabel(item.venue)}</TableCell>
                          <TableCell>
                            <span className="block text-right tabular-nums">₵{item.price.toFixed(2)}</span>
                          </TableCell>
                          <TableCell>{item.preparationTime} min</TableCell>
                          <TableCell>
                            <Chip color={item.available ? 'success' : 'danger'} size="sm" variant="flat">
                              {item.available ? 'Available' : 'Unavailable'}
                            </Chip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <Pagination
                    page={menuPageSafe}
                    total={menuPages}
                    onChange={setMenuPage}
                    showControls
                    size="sm"
                  />
                </div>
              </div>
            </Tab>
            )}

            {(!embedded || panel === 'inventory') && (
            <Tab key="inventory" title="📦 Inventory Management">
              <DepartmentInventoryPanel department="restaurant" />
            </Tab>
            )}

            {(!embedded || panel === 'requisitions') && (
            <Tab key="requisitions" title="📝 Requisitions">
              <div className="px-2 pb-3">
                <div className="mb-[18px] flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="Search requisitions"
                    placeholder="Search requisitions"
                    size="sm"
                    value={requisitionQuery}
                    onValueChange={setRequisitionQuery}
                    isClearable
                    onClear={() => setRequisitionQuery('')}
                    className="w-full max-w-full sm:w-56 sm:max-w-[14rem] shrink-0"
                  />
                  <Select
                    aria-label="Filter requisitions by status"
                    placeholder="All statuses"
                    size="sm"
                    className="w-full max-w-full sm:w-44 sm:max-w-[11rem] shrink-0"
                    selectedKeys={[requisitionStatusFilter]}
                    onSelectionChange={(keys) => {
                      const next = Array.from(keys)[0] as string;
                      if (next) setRequisitionStatusFilter(next);
                    }}
                  >
                    <SelectItem key="all">All statuses</SelectItem>
                    <SelectItem key="pending">Pending</SelectItem>
                    <SelectItem key="approved">Approved</SelectItem>
                    <SelectItem key="ready">Ready</SelectItem>
                    <SelectItem key="rejected">Rejected</SelectItem>
                  </Select>
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    <DateFilterPills
                      mode={requisitionDates.mode}
                      onMode={requisitionDates.setMode}
                      single={requisitionDates.single}
                      onSingle={requisitionDates.setSingle}
                      from={requisitionDates.from}
                      onFrom={requisitionDates.setFrom}
                      to={requisitionDates.to}
                      onTo={requisitionDates.setTo}
                    />
                    <Button size="sm" color="success" className="shrink-0 bg-blue-500 text-white" onClick={() => setIsNewRequisitionModalOpen(true)}>
                      + Request Stock
                    </Button>
                  </div>
                </div>
                <div ref={requisitionCols.frameRef} style={requisitionCols.frameStyle}>
                <Table aria-label="Requisitions table" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
                  <TableHeader>
                    <TableColumn className="relative" style={requisitionCols.style('number')}>{<SortHeader label="Requisition" column="number" sort={requisitionSort} onSort={(column) => setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{requisitionCols.sizer('number', 'Requisition')}</TableColumn>
                    <TableColumn className="relative" style={requisitionCols.style('items')}>{<SortHeader label="Items" column="items" sort={requisitionSort} onSort={(column) => setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{requisitionCols.sizer('items', 'Items')}</TableColumn>
                    <TableColumn className="relative" style={requisitionCols.style('by')}>{<SortHeader label="Requested by" column="by" sort={requisitionSort} onSort={(column) => setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{requisitionCols.sizer('by', 'Requested by')}</TableColumn>
                    <TableColumn className="relative" style={requisitionCols.style('date')}>{<SortHeader label="Requested date" column="date" sort={requisitionSort} onSort={(column) => setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{requisitionCols.sizer('date', 'Requested date')}</TableColumn>
                    <TableColumn className="relative" style={requisitionCols.style('status')}>{<SortHeader label="Status" column="status" sort={requisitionSort} onSort={(column) => setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{requisitionCols.sizer('status', 'Status')}</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent={requisitions.length === 0 ? 'No requisitions yet — request stock from Stores using the button above.' : 'No requisitions match.'}>
                    {sortedRequisitions.map((req) => (
                      <TableRow key={req.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{req.requisitionNumber}</TableCell>
                        <TableCell>
                          <div className="min-w-0 whitespace-normal text-sm">
                            <p className="font-medium">
                              {req.items.length} {req.items.length === 1 ? 'item' : 'items'}
                            </p>
                            <p className="text-xs text-gray-500" title={req.items.map(item => `${item.itemName} (${item.quantity})`).join(', ')}>
                              {req.items.slice(0, 2).map(item => `${item.itemName} (${item.quantity})`).join(', ')}
                              {req.items.length > 2 ? ` +${req.items.length - 2} more` : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{req.requestedBy}</TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap">{req.requestedDate.toLocaleDateString()}</span>
                        </TableCell>
                        <TableCell>
                          <Chip color={getRequisitionStatusColor(req.status)} size="sm" variant="flat">
                            {req.status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            </Tab>
            )}
          </Tabs>
        </CardBody>
      </Card>

      {/* New Menu Item Modal */}
      <Modal isOpen={isNewMenuItemModalOpen} onClose={closeMenuForm} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{editingMenuId ? 'Edit menu item' : 'Add menu item'}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-500">
              This is the dish guests order. The alias is the short name staff can search at the till. The unit is how it is sold. Purchase dates and supplier prices are recorded in Stores when stock is received.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Item name" placeholder="Jollof rice & chicken" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} />
              <Input label="Alias" placeholder="jollof, jollof rice" description="Short names, separated by commas" value={menuForm.alias} onChange={(e) => setMenuForm({ ...menuForm, alias: e.target.value })} />
              <Input label="Item code" placeholder="Filled in automatically if left blank" value={menuForm.code} onChange={(e) => setMenuForm({ ...menuForm, code: e.target.value })} />
              <Select label="Category" selectedKeys={[menuForm.category]} onSelectionChange={(k) => setMenuForm({ ...menuForm, category: (Array.from(k)[0] as string) || 'food' })}>
                <SelectItem key="food">Food</SelectItem>
                <SelectItem key="beverage">Beverage</SelectItem>
                <SelectItem key="dessert">Dessert</SelectItem>
                <SelectItem key="snack">Snack</SelectItem>
                <SelectItem key="special">Special</SelectItem>
              </Select>
              <Select label="Venue" selectedKeys={[menuForm.venue]} onSelectionChange={(k) => setMenuForm({ ...menuForm, venue: (Array.from(k)[0] as string) || 'restaurant' })}>
                <SelectItem key="restaurant">Restaurant</SelectItem>
                <SelectItem key="bar">Bar</SelectItem>
                <SelectItem key="room_service">Room service</SelectItem>
                <SelectItem key="all">All venues</SelectItem>
              </Select>
              <Select label="Sent to" selectedKeys={[menuForm.route]} onSelectionChange={(k) => setMenuForm({ ...menuForm, route: (Array.from(k)[0] as string) || 'kitchen' })}>
                <SelectItem key="kitchen">Kitchen</SelectItem>
                <SelectItem key="bar">Bar</SelectItem>
              </Select>
              <Select label="Selling unit" selectedKeys={[menuForm.unit]} onSelectionChange={(k) => setMenuForm({ ...menuForm, unit: (Array.from(k)[0] as string) || 'portion' })}>
                {MENU_UNITS.map((unit) => (
                  <SelectItem key={unit}>{unitLabel(unit)}</SelectItem>
                ))}
              </Select>
              <Input label="Selling price (₵)" type="number" placeholder="0.00" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} />
              <Input label="Dish cost (₵)" type="number" placeholder="0.00" value={menuForm.cost} onChange={(e) => setMenuForm({ ...menuForm, cost: e.target.value })} />
              <Input label="Prep time (min)" type="number" placeholder="15" value={menuForm.prepTime} onChange={(e) => setMenuForm({ ...menuForm, prepTime: e.target.value })} />
              <Select
                label="Stock item (optional)"
                placeholder="None — no auto deduct"
                selectedKeys={[menuForm.inventoryItemId || 'none']}
                onSelectionChange={(k) => {
                  const next = (Array.from(k)[0] as string) || 'none';
                  setMenuForm({
                    ...menuForm,
                    inventoryItemId: next === 'none' ? '' : next,
                    stockLocationId: next === 'none' ? '' : menuForm.stockLocationId,
                  });
                }}
                description="Link a bar bottle / retail SKU. Billing deducts 1 per sold unit from Restaurant stock."
                className="sm:col-span-2"
              >
                <>
                  <SelectItem key="none">None — no auto deduct</SelectItem>
                  {inventoryItems.filter((i) => i.isActive !== false).map((item) => (
                    <SelectItem key={item.id} textValue={`${item.code} ${item.name}`}>
                      {item.code} — {item.name}
                    </SelectItem>
                  ))}
                </>
              </Select>
              {menuForm.inventoryItemId ? (
                <Select
                  label="Issue from location"
                  selectedKeys={[menuForm.stockLocationId || 'floor']}
                  onSelectionChange={(k) => {
                    const next = (Array.from(k)[0] as string) || 'floor';
                    setMenuForm({ ...menuForm, stockLocationId: next === 'floor' ? '' : next });
                  }}
                  description="Leave as department floor, or pick Bar Store / a fridge"
                  className="sm:col-span-2"
                >
                  <>
                    <SelectItem key="floor">Restaurant &amp; Bar (floor)</SelectItem>
                    {restaurantLocations.map((loc) => (
                      <SelectItem key={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </>
                </Select>
              ) : null}
              <Input className="sm:col-span-2" label="Allergens" placeholder="Peanuts, fish, gluten" value={menuForm.allergens} onChange={(e) => setMenuForm({ ...menuForm, allergens: e.target.value })} />
              <Input className="sm:col-span-2" label="Description" placeholder="How it is served" value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} />
              {(() => {
                const saved = editingMenuId ? menuItems.find((m) => m.id === editingMenuId) : undefined;
                return (
                  <MenuPhotoPicker
                    savedSrc={saved?.hasImage ? menuImageSrc(saved.id, saved.imageVersion) : null}
                    value={menuPhoto}
                    onChange={setMenuPhoto}
                  />
                );
              })()}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeMenuForm}>Cancel</Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitMenuItem} isDisabled={!menuForm.name}>
              {editingMenuId ? 'Save' : 'Add menu item'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!openMenuItem} onClose={() => setViewingMenuId(null)} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex items-center gap-3">
            <span>{openMenuItem?.name}</span>
            {openMenuItem && (
              <Chip color={openMenuItem.available ? 'success' : 'danger'} size="sm" variant="flat">
                {openMenuItem.available ? 'Available' : 'Unavailable'}
              </Chip>
            )}
          </ModalHeader>
          <ModalBody>
            {openMenuItem && (
              <div className="space-y-4">
                <div className="flex items-end justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Selling price</p>
                    <p className="text-2xl font-semibold tabular-nums text-ghana-black">₵{openMenuItem.price.toFixed(2)}</p>
                  </div>
                  <p className="text-sm text-gray-500">{categoryLabel(openMenuItem.category)} · {venueLabel(openMenuItem.venue)} · {unitLabel(openMenuItem.unit)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Cost', `₵${openMenuItem.cost.toFixed(2)}`],
                    ['Margin', `${openMenuItem.profitMargin.toFixed(1)}%`],
                    ['Prep', `${openMenuItem.preparationTime} min`],
                    ['Orders', String(openMenuItem.usedCount)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-gray-200 px-3 py-2">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="font-semibold tabular-nums text-ghana-black">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400">{openMenuItem.code}{openMenuItem.route === 'bar' ? ' · Bar' : ' · Kitchen'}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 px-3 py-2">
                    <p className="text-xs text-gray-500">Stock item</p>
                    <p className="font-medium text-ghana-black">
                      {openMenuItem.inventoryItemId
                        ? (inventoryItems.find((i) => i.id === openMenuItem.inventoryItemId)?.name
                          || inventoryItems.find((i) => i.id === openMenuItem.inventoryItemId)?.code
                          || openMenuItem.inventoryItemId)
                        : 'None — no auto deduct'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 px-3 py-2">
                    <p className="text-xs text-gray-500">Issue from location</p>
                    <p className="font-medium text-ghana-black">
                      {!openMenuItem.inventoryItemId
                        ? '—'
                        : openMenuItem.stockLocationId
                          ? (restaurantLocations.find((l) => l.id === openMenuItem.stockLocationId)?.name || 'Location')
                          : 'Restaurant & Bar (floor)'}
                    </p>
                  </div>
                </div>
                {openMenuItem.alias && <p className="text-sm text-gray-600">Also known as {openMenuItem.alias}</p>}
                {openMenuItem.description && <p className="text-sm text-gray-700">{openMenuItem.description}</p>}
                {openMenuItem.allergens.length > 0 && openMenuItem.allergens[0] !== 'None' && (
                  <div className="flex flex-wrap gap-1">
                    {openMenuItem.allergens.map((allergen, index) => (
                      <Chip key={index} size="sm" variant="flat" color="warning">{allergen}</Chip>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {openMenuItem && (
              <Button variant="flat" onPress={() => openEditMenu(openMenuItem)}>Edit</Button>
            )}
            {openMenuItem && (
              <Button color="secondary" variant="flat" onPress={() => toggleMenuItemAvailability(openMenuItem)}>
                {openMenuItem.available ? 'Mark unavailable' : 'Mark available'}
              </Button>
            )}
            {openMenuItem && (
              <Button
                color={openMenuItem.usedCount > 0 ? 'warning' : 'danger'}
                variant="flat"
                onPress={() => handleRemoveMenuItem(openMenuItem)}
              >
                {openMenuItem.usedCount > 0 ? (openMenuItem.available ? 'Deactivate' : 'Already inactive') : 'Delete'}
              </Button>
            )}
            <Button variant="light" onPress={() => setViewingMenuId(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <DepartmentRequisitionModal
        isOpen={isNewRequisitionModalOpen}
        onClose={() => setIsNewRequisitionModalOpen(false)}
        department="restaurant"
        departmentLabel="Restaurant & Bar"
        inventoryItems={inventoryItems}
        onCreated={() => { reloadRequisitions(); reloadStockLevels(); }}
      />
    </div>
  );
}
