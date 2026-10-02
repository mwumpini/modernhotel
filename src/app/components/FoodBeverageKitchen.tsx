'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, Button, Input, Textarea, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Badge, Progress, Tabs, Tab } from "@heroui/react";
import { kitchenOpsStore, type KitchenAction, type KitchenOpRecord } from '../lib/fb/kitchenOpsStore';
import { kitchenCookMinutes } from '../lib/fb/kitchenEvents';
import { fetchFbOrders, openKitchenDisplay, type FbOrderDto } from '../lib/fb/api';
import { buildLiveStationBoard, kitchenStats, type LiveStationView } from '../lib/fb/kitchenStations';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import KitchenDisplaySystem from './KitchenDisplaySystem';
import DepartmentRequisitionModal from './inventory/DepartmentRequisitionModal';
import DepartmentStockCountPanel from './inventory/DepartmentStockCountPanel';
import DepartmentInventoryPanel, {
  STOCK_KPI_SECTIONS,
  deptInventoryVisibilityKey,
} from './inventory/DepartmentInventoryPanel';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import ModuleExpandButton from './ModuleExpandButton';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';
import { useDashboardPeriod, isInPeriod } from '../lib/dashboard/useDashboardPeriod';
import DepartmentStaffTab from './hr/DepartmentStaffTab';
import { worksheetTableClassNames } from './frontoffice/StayWorksheetTable';
import { sizedTableClassNames, useResizableColumns } from './frontoffice/columnResize';
import { DateFilterPills, matchesDateFilter, useDateFilter } from './fb/DateFilterPills';
import SubViewPills from './dashboard/SubViewPills';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from './dashboard/deskTabsUi';
import { SummaryCollapsedProvider, useSummaryCollapsed } from '../lib/dashboard/useSummaryCollapsed';
import { SummaryToggle } from './dashboard/SummaryToggle';
import KitchenReportsAnalysis from './KitchenReportsAnalysis';

type SuppliesView = 'inventory' | 'stock-count' | 'requisitions';
const SUPPLIES_VIEWS: { key: SuppliesView; label: string }[] = [
  { key: 'inventory', label: '📦 Inventory' },
  { key: 'stock-count', label: '🔍 Stock Count' },
  { key: 'requisitions', label: '📝 Requisitions' },
];

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
}: {
  label: string;
  column: string;
  sort: ColumnSort;
  onSort: (column: string) => void;
}) {
  const active = sort.column === column;
  return (
    <button
      type="button"
      className="max-w-full truncate font-semibold text-ghana-black text-left"
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

// Hideable summary cards on this dashboard — the Tabs below (Kitchen Display,
// Stations, Inventory, etc.) are core navigation, not clutter.
const KITCHEN_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'activeOrders', label: 'Active Orders' },
  { id: 'avgPrepTime', label: 'Avg Prep Time' },
  { id: 'kitchenEfficiency', label: 'Kitchen Efficiency' },
  { id: 'recipesOnFile', label: 'Recipes on File' },
];

function fbHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  defaultCost: number;
  sellingPrice: number;
  isActive: boolean;
}

interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  inventoryItemId?: string;
}

interface Recipe {
  id: string;
  name: string;
  category: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  preparationTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  allergens: string[];
  menuItemId?: string | null;
  isActive?: boolean;
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

export default function FoodBeverageKitchen({
  fullPage = false,
  initialTab,
}: {
  fullPage?: boolean;
  initialTab?: string;
} = {}) {
  const [selectedTab, setSelectedTab] = useState(initialTab || 'kds');
  const { collapsed: summaryCollapsed, toggle: toggleSummary } = useSummaryCollapsed('kitchen.summaryCollapsed');
  const [suppliesView, setSuppliesView] = useState<SuppliesView>('inventory');
  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.kitchen', KITCHEN_DASHBOARD_SECTIONS);
  const stockVisibility = useDashboardVisibility(deptInventoryVisibilityKey('kitchen'), STOCK_KPI_SECTIONS);
  const deskPeriod = useDashboardPeriod('dashboard.period.kitchen', 'today');
  const onInventoryKpis = selectedTab === 'supplies' && suppliesView === 'inventory';
  const customizeSections = onInventoryKpis ? STOCK_KPI_SECTIONS : KITCHEN_DASHBOARD_SECTIONS;
  const customizeApi = onInventoryKpis ? stockVisibility : { isHidden, toggle: toggleSection, showAll, hiddenCount };
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [liveOrders, setLiveOrders] = useState<FbOrderDto[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) setSelectedTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    try {
      const wanted = localStorage.getItem('kitchen.tab');
      if (wanted) {
        setSelectedTab(wanted);
        localStorage.removeItem('kitchen.tab');
      }
    } catch {}
  }, []);

  useEffect(() => {
    const onNavigate = () => {
      try {
        const wanted = localStorage.getItem('kitchen.tab');
        if (wanted) {
          setSelectedTab(wanted);
          localStorage.removeItem('kitchen.tab');
        }
      } catch {}
    };
    window.addEventListener('kitchen-navigate', onNavigate);
    return () => window.removeEventListener('kitchen-navigate', onNavigate);
  }, []);

  const refreshLiveOrders = useCallback(async () => {
    try {
      const orders = await fetchFbOrders();
      setLiveOrders(orders);
      setOrdersError(null);
    } catch (err: any) {
      setOrdersError(err?.message || 'Failed to load orders');
    }
  }, []);

  useEffect(() => {
    refreshLiveOrders();
    const id = setInterval(refreshLiveOrders, 10_000);
    return () => clearInterval(id);
  }, [refreshLiveOrders]);

  // Catalog for requisition picker; on-hand for the Inventory tab lives in DepartmentInventoryPanel.
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  useEffect(() => {
    fetch('/api/inventory/items', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setInventoryItems((data.items || []).map((i: any) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        category: i.category?.name || '—',
        unit: i.unit?.name || '—',
        defaultCost: Number(i.defaultCost || 0),
        sellingPrice: Number(i.sellingPrice || 0),
        isActive: i.isActive,
      }))))
      .catch(() => setInventoryItems([]));
  }, []);

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [requisitionStatusFilter, setRequisitionStatusFilter] = useState('all');
  const [requisitionSort, setRequisitionSort] = useState<ColumnSort>({ column: 'date', direction: 'desc' });
  const requisitionCols = useResizableColumns({
    number: 136,
    items: 220,
    by: 140,
    date: 120,
    status: 112,
  });
  const reloadRequisitions = () => {
    fetch('/api/inventory/requisitions?department=kitchen', { headers: fbHeaders() })
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
  useEffect(() => { reloadRequisitions(); }, []);

  const [isNewRequisitionModalOpen, setIsNewRequisitionModalOpen] = useState(false);

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

  const servedInPeriod = liveOrders.filter(
    (o) =>
      (o.status === 'served' || o.status === 'billed') &&
      isInPeriod(o.servedAt || o.createdAt, deskPeriod.period, deskPeriod.todayISO),
  );
  const stats = kitchenStats(liveOrders, servedInPeriod);
  const kitchenStations: LiveStationView[] = buildLiveStationBoard(liveOrders);
  const avgEfficiency =
    kitchenStations.length > 0
      ? Math.round(kitchenStations.reduce((s, st) => s + st.efficiency, 0) / kitchenStations.length)
      : 0;

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [kitchenMenuItems, setKitchenMenuItems] = useState<{ id: string; name: string; code: string }[]>([]);
  const reloadRecipes = () => {
    fetch('/api/fb/recipes', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { recipes: [] }))
      .then((data) => setRecipes((data.recipes || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        ingredients: r.ingredients || [],
        instructions: r.instructions || [],
        preparationTime: r.preparationTime,
        difficulty: r.difficulty,
        allergens: r.allergens || [],
        menuItemId: r.menuItemId || null,
        isActive: r.isActive !== false,
      }))))
      .catch(() => setRecipes([]));
  };
  const reloadKitchenMenu = () => {
    fetch('/api/fb/menu', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) =>
        setKitchenMenuItems(
          (data.items || [])
            .filter((i: any) => (i.route || 'kitchen') === 'kitchen' && i.isAvailable !== false)
            .map((i: any) => ({ id: i.id, name: i.name, code: i.code })),
        ),
      )
      .catch(() => setKitchenMenuItems([]));
  };
  useEffect(() => { reloadRecipes(); reloadKitchenMenu(); }, []);

  const [recipeForm, setRecipeForm] = useState({
    name: '', category: 'main-course', prepTime: '30', difficulty: 'medium', allergens: '', instructions: '', menuItemId: '',
  });
  const [ingredientRows, setIngredientRows] = useState<RecipeIngredient[]>([
    { name: '', quantity: 0, unit: '', inventoryItemId: '' },
  ]);
  const addIngredientRow = () =>
    setIngredientRows([...ingredientRows, { name: '', quantity: 0, unit: '', inventoryItemId: '' }]);
  const updateIngredientRow = (index: number, patch: Partial<RecipeIngredient>) => {
    setIngredientRows(ingredientRows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const removeIngredientRow = (index: number) => setIngredientRows(ingredientRows.filter((_, i) => i !== index));
  const pickIngredientStock = (index: number, itemId: string) => {
    if (!itemId || itemId === 'none') {
      updateIngredientRow(index, { inventoryItemId: '', name: ingredientRows[index]?.name || '' });
      return;
    }
    const stock = inventoryItems.find((i) => i.id === itemId);
    updateIngredientRow(index, {
      inventoryItemId: itemId,
      name: stock?.name || ingredientRows[index]?.name || '',
      unit: stock?.unit && stock.unit !== '—' ? stock.unit : (ingredientRows[index]?.unit || ''),
    });
  };

  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  const openRecipeForm = () => {
    setEditingRecipeId(null);
    setRecipeForm({ name: '', category: 'main-course', prepTime: '30', difficulty: 'medium', allergens: '', instructions: '', menuItemId: '' });
    setIngredientRows([{ name: '', quantity: 0, unit: '', inventoryItemId: '' }]);
    reloadKitchenMenu();
    setIsRecipeModalOpen(true);
  };

  const openEditRecipe = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setRecipeForm({
      name: recipe.name,
      category: recipe.category || 'main-course',
      prepTime: String(recipe.preparationTime || 30),
      difficulty: recipe.difficulty || 'medium',
      allergens: (recipe.allergens || []).filter((a) => a && a !== 'None').join(', '),
      instructions: (recipe.instructions || []).join('\n'),
      menuItemId: recipe.menuItemId || '',
    });
    setIngredientRows(
      recipe.ingredients?.length
        ? recipe.ingredients.map((ing) => ({
            name: ing.name || '',
            quantity: Number(ing.quantity) || 0,
            unit: ing.unit || '',
            inventoryItemId: ing.inventoryItemId || '',
          }))
        : [{ name: '', quantity: 0, unit: '', inventoryItemId: '' }],
    );
    reloadKitchenMenu();
    setViewingRecipe(null);
    setIsRecipeModalOpen(true);
  };

  const submitRecipe = async () => {
    if (!recipeForm.name) return;
    const ingredients = ingredientRows
      .filter((row) => row.name.trim() || row.inventoryItemId)
      .map((row) => ({
        name: row.name.trim() || inventoryItems.find((i) => i.id === row.inventoryItemId)?.name || 'Ingredient',
        quantity: Number(row.quantity) || 0,
        unit: row.unit.trim() || '',
        inventoryItemId: row.inventoryItemId || undefined,
      }));
    const instructions = recipeForm.instructions.split('\n').map((s) => s.trim()).filter(Boolean);
    const res = await fetch('/api/fb/recipes', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({
        id: editingRecipeId || `recipe-${Date.now()}`,
        name: recipeForm.name,
        category: recipeForm.category,
        preparationTime: Number(recipeForm.prepTime) || 0,
        difficulty: recipeForm.difficulty,
        allergens: recipeForm.allergens || undefined,
        menuItemId: recipeForm.menuItemId || null,
        ingredients,
        instructions,
        isActive: true,
      }),
    });
    if (res.ok) {
      setEditingRecipeId(null);
      setRecipeForm({ name: '', category: 'main-course', prepTime: '30', difficulty: 'medium', allergens: '', instructions: '', menuItemId: '' });
      setIngredientRows([{ name: '', quantity: 0, unit: '', inventoryItemId: '' }]);
      setIsRecipeModalOpen(false);
      reloadRecipes();
    }
  };
  const deleteRecipeById = async (id: string) => {
    const { confirmDelete } = await import('./DangerConfirm');
    if (!(await confirmDelete('this recipe', 'The recipe will be permanently removed. This cannot be undone.'))) return;
    await fetch(`/api/fb/recipes?id=${id}`, { method: 'DELETE', headers: fbHeaders() });
    setViewingRecipe(null);
    reloadRecipes();
  };

  const setRecipeActive = async (recipe: Recipe, isActive: boolean) => {
    const res = await fetch('/api/fb/recipes', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        preparationTime: recipe.preparationTime,
        difficulty: recipe.difficulty,
        allergens: (recipe.allergens || []).join(', ') || undefined,
        menuItemId: recipe.menuItemId || null,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        isActive,
      }),
    });
    if (res.ok) {
      setViewingRecipe((prev) => (prev && prev.id === recipe.id ? { ...prev, isActive } : prev));
      reloadRecipes();
    }
  };

  const printRecipe = (recipe: Recipe) => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const menuName = kitchenMenuItems.find((m) => m.id === recipe.menuItemId)?.name;
    const ingredients = recipe.ingredients
      .map((ing) => `<li>${escapeHtml(String(ing.quantity))} ${escapeHtml(ing.unit)} ${escapeHtml(ing.name)}${ing.inventoryItemId ? ' (stock)' : ''}</li>`)
      .join('');
    const steps = recipe.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
    const allergens = (recipe.allergens || []).filter((a) => a && a !== 'None').map(escapeHtml).join(', ') || 'None';
    const html = `<!DOCTYPE html><html><head><title>${escapeHtml(recipe.name)}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111}
        h1{margin:0 0 8px;font-size:22px}
        .meta{color:#555;font-size:13px;margin-bottom:16px}
        h2{font-size:14px;margin:18px 0 6px}
        ul,ol{margin:0;padding-left:18px;font-size:13px;line-height:1.5}
      </style></head><body>
      <h1>${escapeHtml(recipe.name)}</h1>
      <div class="meta">${escapeHtml(recipe.category)} · ${escapeHtml(recipe.difficulty)} · ${recipe.preparationTime} min
        ${menuName ? ` · Menu: ${escapeHtml(menuName)}` : ''} · ${recipe.isActive === false ? 'Inactive' : 'Active'}</div>
      <h2>Ingredients</h2><ul>${ingredients || '<li>None</li>'}</ul>
      <h2>Instructions</h2><ol>${steps || '<li>None</li>'}</ol>
      <h2>Allergens</h2><p>${allergens}</p>
      </body></html>`;

    // Hidden iframe avoids popup blockers and the blank-tab bug from
    // window.open(..., 'noopener') which returns null and can't be written to.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', `Print ${recipe.name}`);
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);
    const frameWindow = iframe.contentWindow;
    const frameDoc = frameWindow?.document;
    if (!frameWindow || !frameDoc) {
      iframe.remove();
      window.alert('Unable to prepare the print view.');
      return;
    }
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
    const cleanup = () => {
      try { iframe.remove(); } catch { /* ignore */ }
    };
    const triggerPrint = () => {
      try {
        frameWindow.focus();
        frameWindow.print();
      } finally {
        setTimeout(cleanup, 1000);
      }
    };
    if (frameDoc.readyState === 'complete') triggerPrint();
    else iframe.onload = () => triggerPrint();
  };

  const getStationStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'success';
      case 'busy': return 'warning';
      case 'maintenance': return 'danger';
      default: return 'default';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'danger';
      default: return 'default';
    }
  };

  return (
    <SummaryCollapsedProvider collapsed={!fullPage && summaryCollapsed}>
    <div className={fullPage ? 'px-3 pt-1 pb-3' : 'p-6'}>
      {/* Header */}
      <div className={`flex items-center justify-between ${fullPage ? 'mb-2' : 'mb-6'}`}>
        <h2 className={`${fullPage ? 'text-xl' : 'text-2xl'} font-bold text-ghana-black`}>👨‍🍳 Kitchen</h2>
        <div className="flex items-center gap-2">
          {!fullPage && <SummaryToggle collapsed={summaryCollapsed} onToggle={toggleSummary} />}
          <CustomizeViewControl
            sections={customizeSections}
            isHidden={customizeApi.isHidden}
            toggle={customizeApi.toggle}
            showAll={customizeApi.showAll}
            hiddenCount={customizeApi.hiddenCount}
            period={deskPeriod.period}
            onPeriodChange={deskPeriod.setPeriod}
            defaultPeriod={deskPeriod.defaultPeriod}
          />
          {!fullPage && (
            <ModuleExpandButton
              href={selectedTab === 'reports' ? '/kitchen/reports' : '/kitchen/ops'}
              label={selectedTab === 'reports' ? 'Open reports full page' : 'Open kitchen full page'}
            />
          )}
        </div>
      </div>

      {/* Stats Overview */}
      {!fullPage && !summaryCollapsed && (!isHidden('activeOrders') || !isHidden('avgPrepTime') || !isHidden('kitchenEfficiency') || !isHidden('recipesOnFile')) && (
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {!isHidden('activeOrders') && (
        <Card className="relative border border-gray-200 shadow-none">
          <CardBody className="relative px-4 py-3 text-center">
            <div className="absolute right-1.5 top-1 z-10">
              <HideCardButton onHide={() => hide('activeOrders')} label="Active Orders" />
            </div>
            <button
              type="button"
              className="w-full cursor-pointer text-center"
              onClick={() => { setSelectedTab('kds'); openKitchenDisplay(); }}
            >
              <div className="text-2xl font-semibold tabular-nums text-ghana-black">{stats.activeCount}</div>
              <div className="text-sm leading-tight text-gray-500">Active Orders</div>
              <div className="text-xs leading-tight text-gray-400">Live queue</div>
              {stats.urgent > 0 && (
                <div className="text-xs leading-tight text-blue-600">{stats.urgent} urgent</div>
              )}
            </button>
          </CardBody>
        </Card>
        )}

        {!isHidden('avgPrepTime') && (
        <Card className="relative border border-gray-200 shadow-none">
          <CardBody className="relative px-4 py-3 text-center">
            <div className="absolute right-1.5 top-1 z-10">
              <HideCardButton onHide={() => hide('avgPrepTime')} label="Avg Prep Time" />
            </div>
            <button
              type="button"
              className="w-full cursor-pointer text-center"
              onClick={() => setSelectedTab('kds')}
            >
              <div className="text-2xl font-semibold tabular-nums text-ghana-black">{stats.avgPrep > 0 ? `${stats.avgPrep}min` : '—'}</div>
              <div className="text-sm leading-tight text-gray-500">Avg Prep Time</div>
              <div className="text-xs leading-tight text-green-600">
                {stats.servedToday} served · {deskPeriod.label}
              </div>
            </button>
          </CardBody>
        </Card>
        )}

        {!isHidden('kitchenEfficiency') && (
        <Card className="relative border border-gray-200 shadow-none">
          <CardBody className="relative px-4 py-3 text-center">
            <div className="absolute right-1.5 top-1 z-10">
              <HideCardButton onHide={() => hide('kitchenEfficiency')} label="Kitchen Efficiency" />
            </div>
            <button
              type="button"
              className="w-full cursor-pointer text-center"
              onClick={() => setSelectedTab('stations')}
            >
              <div className="text-2xl font-semibold tabular-nums text-ghana-black">{avgEfficiency > 0 ? `${avgEfficiency}%` : '—'}</div>
              <div className="text-sm leading-tight text-gray-500">Kitchen Efficiency</div>
              <div className="text-xs leading-tight text-green-600">Live station load</div>
            </button>
          </CardBody>
        </Card>
        )}

        {!isHidden('recipesOnFile') && (
        <Card className="relative border border-gray-200 shadow-none">
          <CardBody className="relative px-4 py-3 text-center">
            <div className="absolute right-1.5 top-1 z-10">
              <HideCardButton onHide={() => hide('recipesOnFile')} label="Recipes on File" />
            </div>
            <button
              type="button"
              className="w-full cursor-pointer text-center"
              onClick={() => setSelectedTab('recipes')}
            >
              <div className="text-2xl font-semibold tabular-nums text-ghana-black">{recipes.length}</div>
              <div className="text-sm leading-tight text-gray-500">Recipes on File</div>
              <div className="text-xs leading-tight text-gray-500">{inventoryItems.length} catalog items</div>
            </button>
          </CardBody>
        </Card>
        )}
      </div>
      )}

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-lg">
        {fullPage && (
          <div className="flex justify-end px-3 pt-2">
            <Button
              color="primary"
              size="sm"
              className="bg-ghana-green text-white"
              onClick={openKitchenDisplay}
            >
              Open Full-Screen KDS
            </Button>
          </div>
        )}
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
            aria-label="Kitchen operations"
          >
            <Tab key="kds" title="🍳 Kitchen Display" />
            <Tab key="log" title="🧾 Kitchen Operations Log" />
            <Tab key="stations" title="🔥 Kitchen Stations" />
            <Tab key="supplies" title="📦 Supplies" />
            <Tab key="recipes" title="📖 Recipe Management" />
            <Tab key="staff" title="👥 Staff Management" />
            <Tab key="reports" title="📈 Reports & Analysis" />
          </Tabs>

          <div className={deskBookTabPanelClassName}>
            {selectedTab === 'kds' && (
              <div className="space-y-4">
                <KitchenDisplaySystem embedded />
              </div>
            )}

            {selectedTab === 'log' && <KitchenOpsLog orders={liveOrders} />}

            {selectedTab === 'stations' && (
              <div className="space-y-4">
                {ordersError && (
                  <p className="text-sm text-danger">⚠ {ordersError}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {kitchenStations.map((station) => (
                    <Card key={station.id} className={`border-2 transition-colors ${
                      station.status === 'available' ? 'border-green-200 hover:border-green-400' :
                      station.status === 'busy' ? 'border-yellow-200 hover:border-yellow-400' :
                      'border-red-200 hover:border-red-400'
                    }`}>
                      <CardBody className="p-4">
                        <div className="text-center">
                          <h3 className="text-lg font-bold text-ghana-black mb-2">{station.name}</h3>
                          <Chip color={getStationStatusColor(station.status)} size="sm" className="mb-3">
                            {station.status.charAt(0).toUpperCase() + station.status.slice(1)}
                            {station.activeCount > 0 && ` · ${station.activeCount} orders`}
                          </Chip>
                          <p className="text-sm text-gray-600 mb-2">Cook: {station.chef}</p>
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>Efficiency:</span>
                              <span>{station.efficiency}%</span>
                            </div>
                            <Progress value={station.efficiency} color="success" className="w-full" />
                          </div>
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Current Orders:</p>
                            <div className="flex flex-wrap gap-1 justify-center">
                              {station.currentOrders.length > 0 ? (
                                station.currentOrders.map((order) => (
                                  <Badge key={order} color="primary" variant="flat" size="sm">
                                    {order}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-gray-500 text-sm">None</span>
                              )}
                            </div>
                          </div>
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Specializations:</p>
                            <div className="flex flex-wrap gap-1 justify-center">
                              {station.specializations.map((spec, index) => (
                                <Chip key={index} size="sm" variant="flat" color="secondary">
                                  {spec}
                                </Chip>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" color="primary" variant="flat" onPress={() => setSelectedTab('kds')}>
                              Open KDS
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {selectedTab === 'supplies' && (
              <div>
                <SubViewPills
                  views={SUPPLIES_VIEWS}
                  selected={suppliesView}
                  onSelect={setSuppliesView}
                  ariaLabel="Kitchen supplies views"
                />
                {suppliesView === 'inventory' && <DepartmentInventoryPanel department="kitchen" />}
                {suppliesView === 'stock-count' && <DepartmentStockCountPanel department="kitchen" />}
                {suppliesView === 'requisitions' && (
                  <div className="space-y-4">
                    <div className="mb-[18px] flex flex-wrap items-center gap-2">
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
                        <Button size="sm" color="success" className="shrink-0 bg-blue-500 text-white" onClick={() => setIsNewRequisitionModalOpen(true)}>
                          + Request Stock
                        </Button>
                      </div>
                    </div>
                    <div ref={requisitionCols.frameRef} style={requisitionCols.frameStyle}>
                      <Table aria-label="Kitchen requisitions table" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
                        <TableHeader>
                          <TableColumn className="relative" style={requisitionCols.style('number')}>{<SortHeader label="Requisition" column="number" sort={requisitionSort} onSort={(column) => setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{requisitionCols.sizer('number', 'Requisition')}</TableColumn>
                          <TableColumn className="relative" style={requisitionCols.style('items')}>{<SortHeader label="Items" column="items" sort={requisitionSort} onSort={(column) => setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{requisitionCols.sizer('items', 'Items')}</TableColumn>
                          <TableColumn className="relative" style={requisitionCols.style('by')}>{<SortHeader label="Requested by" column="by" sort={requisitionSort} onSort={(column) => setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{requisitionCols.sizer('by', 'Requested by')}</TableColumn>
                          <TableColumn className="relative" style={requisitionCols.style('date')}>{<SortHeader label="Requested date" column="date" sort={requisitionSort} onSort={(column) => setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{requisitionCols.sizer('date', 'Requested date')}</TableColumn>
                          <TableColumn className="relative" style={requisitionCols.style('status')}>{<SortHeader label="Status" column="status" sort={requisitionSort} onSort={(column) => setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{requisitionCols.sizer('status', 'Status')}</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent={requisitions.length === 0 ? 'No requisitions yet.' : 'No requisitions match this status.'}>
                          {[...(requisitionStatusFilter === 'all' ? requisitions : requisitions.filter((req) => req.status === requisitionStatusFilter))]
                            .sort((a, b) => {
                              const dir = requisitionSort.direction === 'asc' ? 1 : -1;
                              switch (requisitionSort.column) {
                                case 'number':
                                  return a.requisitionNumber.localeCompare(b.requisitionNumber) * dir;
                                case 'items':
                                  return (a.items.length - b.items.length) * dir;
                                case 'by':
                                  return a.requestedBy.localeCompare(b.requestedBy) * dir;
                                case 'status':
                                  return a.status.localeCompare(b.status) * dir;
                                case 'date':
                                default:
                                  return (a.requestedDate.getTime() - b.requestedDate.getTime()) * dir;
                              }
                            })
                            .map((req) => (
                            <TableRow key={req.id} className="hover:bg-gray-50">
                              <TableCell className="font-medium">{req.requisitionNumber}</TableCell>
                              <TableCell>
                                <div className="min-w-0 whitespace-normal text-sm">
                                  <p className="font-medium">
                                    {req.items.length} {req.items.length === 1 ? 'item' : 'items'}
                                  </p>
                                  <p className="text-gray-500 text-xs" title={req.items.map(item => `${item.itemName} (${item.quantity})`).join(', ')}>
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
                )}
              </div>
            )}

            {selectedTab === 'recipes' && (
              <div className="space-y-4">
                <div className="mb-[18px] flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-ghana-black">Recipe Management</h3>
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    <Button
                      size="sm"
                      color="secondary"
                      className="shrink-0 bg-ghana-gold text-white"
                      onClick={openRecipeForm}
                    >
                      + Add Recipe
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {recipes.map((recipe) => (
                    <Card
                      key={recipe.id}
                      isPressable
                      onPress={() => setViewingRecipe(recipe)}
                      className={`cursor-pointer border transition-colors ${
                        recipe.isActive === false
                          ? 'border-dashed border-gray-300 opacity-70 hover:border-gray-400'
                          : 'border-gray-200 hover:border-ghana-green'
                      }`}
                    >
                      <CardBody className="gap-1.5 p-2.5">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="min-w-0 truncate text-sm font-semibold leading-tight text-ghana-black" title={recipe.name}>
                            {recipe.name}
                          </h4>
                          <Chip
                            color={recipe.isActive === false ? 'default' : getDifficultyColor(recipe.difficulty)}
                            size="sm"
                            className="h-5 shrink-0 text-[10px]"
                          >
                            {recipe.isActive === false ? 'Off' : recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
                          </Chip>
                        </div>
                        <p className="truncate text-xs text-gray-500">{recipe.category}</p>
                        {recipe.menuItemId && (
                          <p className="truncate text-[10px] leading-snug text-ghana-green" title={`Deducts stock when ${kitchenMenuItems.find((m) => m.id === recipe.menuItemId)?.name || 'linked dish'} is billed`}>
                            Bills → {kitchenMenuItems.find((m) => m.id === recipe.menuItemId)?.name || 'linked dish'}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-600">
                          <span>⏱️ {recipe.preparationTime}m</span>
                          <span>·</span>
                          <span>{recipe.ingredients.length} ing.</span>
                        </div>
                        {recipe.ingredients.length > 0 && (
                          <p className="truncate text-[10px] text-gray-500" title={recipe.ingredients.map((i) => i.name).join(', ')}>
                            {recipe.ingredients.slice(0, 2).map((i) => i.name).join(', ')}
                            {recipe.ingredients.length > 2 ? ` +${recipe.ingredients.length - 2}` : ''}
                          </p>
                        )}
                      </CardBody>
                    </Card>
                  ))}
                  {recipes.length === 0 && (
                    <div className="col-span-full py-8 text-center">
                      <p className="mb-3 text-gray-500">No recipes yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedTab === 'staff' && (
              <DepartmentStaffTab
                departmentLabel="Kitchen"
                overtimePermissionId="kitchen.log-overtime"
                departmentNameHints={['kitchen']}
                helperText="HR staff in a Kitchen department. Restaurant & Bar has its own tab. Names come from the HR file — this tab does not invent staff."
              />
            )}

            {selectedTab === 'reports' && <KitchenReportsAnalysis embedded />}
          </div>
        </CardBody>
      </Card>

      {/* New Recipe Modal */}
      <Modal isOpen={isRecipeModalOpen} onClose={() => { setIsRecipeModalOpen(false); setEditingRecipeId(null); }} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{editingRecipeId ? 'Edit Recipe' : 'Add New Recipe'}</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-500 -mt-1">
              Link a kitchen menu dish and pick stock SKUs for ingredients. When that dish is billed, linked ingredients deduct from Kitchen inventory (qty × portions sold).
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Recipe Name" placeholder="Enter recipe name" value={recipeForm.name} onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })} />
                <Select
                  label="Category"
                  selectedKeys={[recipeForm.category]}
                  onChange={(e) => setRecipeForm({ ...recipeForm, category: e.target.value })}
                >
                  <SelectItem key="appetizer">Appetizer</SelectItem>
                  <SelectItem key="main-course">Main Course</SelectItem>
                  <SelectItem key="dessert">Dessert</SelectItem>
                  <SelectItem key="beverage">Beverage</SelectItem>
                </Select>
              </div>

              <Select
                label="Menu dish (for stock deduct)"
                placeholder="None — recipe only"
                selectedKeys={[recipeForm.menuItemId || 'none']}
                onSelectionChange={(keys) => {
                  const next = (Array.from(keys)[0] as string) || 'none';
                  setRecipeForm({ ...recipeForm, menuItemId: next === 'none' ? '' : next });
                }}
                description="Kitchen menu item that uses this recipe when billed"
              >
                <>
                  <SelectItem key="none">None — recipe only</SelectItem>
                  {kitchenMenuItems.map((item) => (
                    <SelectItem key={item.id} textValue={item.name}>
                      {item.name} ({item.code})
                    </SelectItem>
                  ))}
                </>
              </Select>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Preparation Time (min)" type="number" value={recipeForm.prepTime} onChange={(e) => setRecipeForm({ ...recipeForm, prepTime: e.target.value })} />
                <Select
                  label="Difficulty"
                  selectedKeys={[recipeForm.difficulty]}
                  onChange={(e) => setRecipeForm({ ...recipeForm, difficulty: e.target.value })}
                >
                  <SelectItem key="easy">Easy</SelectItem>
                  <SelectItem key="medium">Medium</SelectItem>
                  <SelectItem key="hard">Hard</SelectItem>
                </Select>
                <Input label="Allergens" placeholder="e.g., Peanuts, Fish, Gluten" value={recipeForm.allergens} onChange={(e) => setRecipeForm({ ...recipeForm, allergens: e.target.value })} />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Ingredients</p>
                <div className="space-y-2">
                  {ingredientRows.map((row, index) => (
                    <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr,1fr,80px,80px,auto] sm:items-end">
                      <Select
                        size="sm"
                        label="Stock item"
                        selectedKeys={[row.inventoryItemId || 'none']}
                        onSelectionChange={(keys) => pickIngredientStock(index, (Array.from(keys)[0] as string) || 'none')}
                      >
                        <>
                          <SelectItem key="none">None — name only</SelectItem>
                          {inventoryItems.filter((i) => i.isActive !== false).map((item) => (
                            <SelectItem key={item.id} textValue={`${item.code} ${item.name}`}>
                              {item.code} — {item.name}
                            </SelectItem>
                          ))}
                        </>
                      </Select>
                      <Input size="sm" label="Name" placeholder="Ingredient" value={row.name} onChange={(e) => updateIngredientRow(index, { name: e.target.value })} />
                      <Input size="sm" label="Qty" type="number" placeholder="Qty" value={String(row.quantity || '')} onChange={(e) => updateIngredientRow(index, { quantity: Number(e.target.value) || 0 })} />
                      <Input size="sm" label="Unit" placeholder="Unit" value={row.unit} onChange={(e) => updateIngredientRow(index, { unit: e.target.value })} />
                      <Button size="sm" color="danger" variant="light" isIconOnly className="mb-1" onClick={() => removeIngredientRow(index)}>✕</Button>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="flat" className="mt-2" onClick={addIngredientRow}>+ Add Ingredient</Button>
              </div>

              <Textarea label="Instructions" placeholder="Enter cooking instructions, one step per line" value={recipeForm.instructions} onChange={(e) => setRecipeForm({ ...recipeForm, instructions: e.target.value })} minRows={4} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => { setIsRecipeModalOpen(false); setEditingRecipeId(null); }}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitRecipe}>
              {editingRecipeId ? 'Save Changes' : 'Add Recipe'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <DepartmentRequisitionModal
        isOpen={isNewRequisitionModalOpen}
        onClose={() => setIsNewRequisitionModalOpen(false)}
        department="kitchen"
        departmentLabel="Kitchen"
        inventoryItems={inventoryItems}
        onCreated={() => { reloadRequisitions(); }}
      />

      {/* View Recipe Modal */}
      <Modal isOpen={!!viewingRecipe} onClose={() => setViewingRecipe(null)} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span>{viewingRecipe?.name}</span>
                {viewingRecipe?.isActive === false && (
                  <span className="text-xs font-normal text-warning">Deactivated — not used for new stock deducts</span>
                )}
              </ModalHeader>
              <ModalBody className="pb-2">
                {viewingRecipe && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Chip color={getDifficultyColor(viewingRecipe.difficulty)} size="sm">
                        {viewingRecipe.difficulty.charAt(0).toUpperCase() + viewingRecipe.difficulty.slice(1)}
                      </Chip>
                      <span className="text-sm text-gray-600">{viewingRecipe.category}</span>
                      <span className="text-sm text-gray-600">⏱️ {viewingRecipe.preparationTime}min</span>
                      {viewingRecipe.menuItemId && (
                        <Chip size="sm" variant="flat" color="primary">
                          Menu:{' '}
                          {kitchenMenuItems.find((m) => m.id === viewingRecipe.menuItemId)?.name
                            || viewingRecipe.menuItemId}
                        </Chip>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-ghana-black mb-1">Ingredients</p>
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        {viewingRecipe.ingredients.map((ing, i) => (
                          <li key={i}>
                            {ing.quantity} {ing.unit} {ing.name}
                            {ing.inventoryItemId ? ' · stock linked' : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-ghana-black mb-1">Instructions</p>
                      <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                        {viewingRecipe.instructions.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    {viewingRecipe.allergens.length > 0 && (
                      <div>
                        <p className="font-medium text-ghana-black mb-1">Allergens</p>
                        <div className="flex flex-wrap gap-1">
                          {viewingRecipe.allergens.map((a, i) => (
                            <Chip key={i} size="sm" variant="flat" color="warning">{a}</Chip>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="flex flex-wrap gap-2">
                <Button size="sm" variant="light" onPress={onClose}>Close</Button>
                <div className="flex flex-1 flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => viewingRecipe && printRecipe(viewingRecipe)}
                  >
                    Print
                  </Button>
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    onPress={() => viewingRecipe && openEditRecipe(viewingRecipe)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    color="warning"
                    variant="flat"
                    onPress={() => viewingRecipe && setRecipeActive(viewingRecipe, viewingRecipe.isActive === false)}
                  >
                    {viewingRecipe?.isActive === false ? 'Activate' : 'Deactivate'}
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    onPress={() => viewingRecipe && deleteRecipeById(viewingRecipe.id)}
                  >
                    Delete
                  </Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
    </SummaryCollapsedProvider>
  );
}

function formatCookDuration(minutes?: number | null) {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  const mins = Math.max(0, Math.round(minutes));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function KitchenOpsLog({ orders = [] }: { orders?: FbOrderDto[] }) {
  const [rows, setRows] = React.useState<KitchenOpRecord[]>([]);
  const [query, setQuery] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState<'all' | KitchenAction>('all');
  const [priorityFilter, setPriorityFilter] = React.useState('all');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<ColumnSort>({ column: 'time', direction: 'desc' });
  const dates = useDateFilter();
  const cols = useResizableColumns({
    time: 156,
    order: 112,
    table: 72,
    item: 168,
    action: 108,
    status: 148,
    assignee: 120,
    prepared: 120,
    priority: 96,
  });

  React.useEffect(() => {
    const sync = () => setRows(kitchenOpsStore.all());
    sync();
    return kitchenOpsStore.subscribe(sync);
  }, []);

  const findOrder = React.useCallback(
    (row: KitchenOpRecord) =>
      orders.find((o) => o.orderNumber === row.orderId || o.id === row.itemId || o.id === row.orderId),
    [orders],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (actionFilter !== 'all' && r.action !== actionFilter) return false;
      if (priorityFilter !== 'all' && String(r.priority || 'normal') !== priorityFilter) return false;
      if (!matchesDateFilter(r.at, dates.mode, dates.single, dates.from, dates.to)) return false;
      if (!q) return true;
      const hay = [
        r.orderId,
        r.table,
        r.itemName,
        r.action,
        r.fromStatus,
        r.toStatus,
        r.assignedToName,
        r.preparedByName,
        r.waiterId,
        r.priority,
        r.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, actionFilter, priorityFilter, dates.mode, dates.single, dates.from, dates.to]);

  const sorted = React.useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.column) {
        case 'order':
          return String(a.orderId).localeCompare(String(b.orderId)) * dir;
        case 'table':
          return String(a.table || '').localeCompare(String(b.table || '')) * dir;
        case 'item':
          return String(a.itemName || '').localeCompare(String(b.itemName || '')) * dir;
        case 'action':
          return String(a.action || '').localeCompare(String(b.action || '')) * dir;
        case 'status':
          return `${a.fromStatus || ''}${a.toStatus || ''}`.localeCompare(`${b.fromStatus || ''}${b.toStatus || ''}`) * dir;
        case 'assignee':
          return String(a.assignedToName || '').localeCompare(String(b.assignedToName || '')) * dir;
        case 'prepared':
          return String(a.preparedByName || '').localeCompare(String(b.preparedByName || '')) * dir;
        case 'priority':
          return String(a.priority || '').localeCompare(String(b.priority || '')) * dir;
        case 'time':
        default:
          return (new Date(a.at).getTime() - new Date(b.at).getTime()) * dir;
      }
    });
  }, [filtered, sort]);

  const selected = selectedId ? rows.find((r) => r.id === selectedId) || null : null;

  const actionChip = (action: KitchenAction) => {
    const color = action === 'assigned' ? 'primary' : action === 'prepared' ? 'success' : 'secondary';
    const label = action === 'assigned' ? 'Assigned' : action === 'prepared' ? 'Prepared' : 'Status';
    return (
      <Chip size="sm" variant="flat" color={color}>
        {label}
      </Chip>
    );
  };

  const priorityChip = (priority?: string) => {
    const p = (priority || 'normal').toLowerCase();
    const color =
      p === 'urgent' ? 'danger' : p === 'high' ? 'warning' : p === 'low' ? 'default' : 'primary';
    return (
      <Chip size="sm" variant="flat" color={color} className="capitalize">
        {p}
      </Chip>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ghana-black">Kitchen Operations Log</h3>
          <p className="text-sm text-gray-500 mt-1">
            Kitchen Display events — click a row for full detail.
          </p>
        </div>
      </div>

      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search kitchen log"
          placeholder="Search order, item, cook…"
          size="sm"
          value={query}
          onValueChange={setQuery}
          isClearable
          onClear={() => setQuery('')}
          className="w-full max-w-full sm:w-56 sm:max-w-[14rem] shrink-0"
        />
        <Select
          aria-label="Filter by action"
          placeholder="All actions"
          size="sm"
          className="w-full max-w-full sm:w-40 sm:max-w-[10rem] shrink-0"
          selectedKeys={[actionFilter]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as string;
            if (next) setActionFilter(next as 'all' | KitchenAction);
          }}
        >
          <SelectItem key="all">All actions</SelectItem>
          <SelectItem key="assigned">Assigned</SelectItem>
          <SelectItem key="status">Status change</SelectItem>
          <SelectItem key="prepared">Prepared</SelectItem>
        </Select>
        <Select
          aria-label="Filter by priority"
          placeholder="All priorities"
          size="sm"
          className="w-full max-w-full sm:w-40 sm:max-w-[10rem] shrink-0"
          selectedKeys={[priorityFilter]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as string;
            if (next) setPriorityFilter(next);
          }}
        >
          <SelectItem key="all">All priorities</SelectItem>
          <SelectItem key="urgent">Urgent</SelectItem>
          <SelectItem key="high">High</SelectItem>
          <SelectItem key="normal">Normal</SelectItem>
          <SelectItem key="medium">Medium</SelectItem>
          <SelectItem key="low">Low</SelectItem>
        </Select>
        <p className="text-sm text-gray-500 shrink-0 whitespace-nowrap">
          {filtered.length} of {rows.length}
        </p>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <DateFilterPills
            mode={dates.mode}
            onMode={dates.setMode}
            single={dates.single}
            onSingle={dates.setSingle}
            from={dates.from}
            onFrom={dates.setFrom}
            to={dates.to}
            onTo={dates.setTo}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No kitchen events yet. Assign a cook or bump an order on the Kitchen Display tab.
        </p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No events match these filters.
        </p>
      ) : (
        <div className="max-h-[520px] overflow-auto" ref={cols.frameRef} style={cols.frameStyle}>
          <Table aria-label="Kitchen operations log" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
            <TableHeader>
              <TableColumn className="relative" style={cols.style('time')}>{<SortHeader label="Time" column="time" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('time', 'Time')}</TableColumn>
              <TableColumn className="relative" style={cols.style('order')}>{<SortHeader label="Order" column="order" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('order', 'Order')}</TableColumn>
              <TableColumn className="relative" style={cols.style('table')}>{<SortHeader label="Table" column="table" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('table', 'Table')}</TableColumn>
              <TableColumn className="relative" style={cols.style('item')}>{<SortHeader label="Item" column="item" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('item', 'Item')}</TableColumn>
              <TableColumn className="relative" style={cols.style('action')}>{<SortHeader label="Action" column="action" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('action', 'Action')}</TableColumn>
              <TableColumn className="relative" style={cols.style('status')}>{<SortHeader label="From → To" column="status" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('status', 'From → To')}</TableColumn>
              <TableColumn className="relative" style={cols.style('assignee')}>{<SortHeader label="Assignee" column="assignee" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('assignee', 'Assignee')}</TableColumn>
              <TableColumn className="relative" style={cols.style('prepared')}>{<SortHeader label="Prepared by" column="prepared" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('prepared', 'Prepared by')}</TableColumn>
              <TableColumn className="relative" style={cols.style('priority')}>{<SortHeader label="Priority" column="priority" sort={sort} onSort={(column) => setSort((prev) => toggleColumnSort(prev, column))} />}{cols.sizer('priority', 'Priority')}</TableColumn>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedId(r.id)}
                >
                  <TableCell className="whitespace-nowrap">{new Date(r.at).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{r.orderId}</TableCell>
                  <TableCell>{r.table || '—'}</TableCell>
                  <TableCell>
                    <p className="font-medium text-ghana-black truncate" title={r.itemName}>{r.itemName}</p>
                  </TableCell>
                  <TableCell>{actionChip(r.action)}</TableCell>
                  <TableCell className="whitespace-nowrap capitalize">
                    {r.fromStatus || r.toStatus ? `${r.fromStatus || '—'} → ${r.toStatus || '—'}` : '—'}
                  </TableCell>
                  <TableCell>{r.assignedToName || '—'}</TableCell>
                  <TableCell>{r.preparedByName || '—'}</TableCell>
                  <TableCell>{priorityChip(r.priority)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        isOpen={!!selected}
        onClose={() => setSelectedId(null)}
        size="md"
        scrollBehavior="inside"
        classNames={{ base: 'max-w-lg' }}
      >
        <ModalContent>
          {selected && (
            <>
              <ModalHeader className="flex flex-col gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-start justify-between gap-3 pr-6">
                  <h2 className="text-xl font-bold text-ghana-black leading-snug">
                    {selected.itemName}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {actionChip(selected.action)}
                  {priorityChip(selected.priority)}
                  <span className="text-xs text-gray-500">
                    {new Date(selected.at).toLocaleString()}
                  </span>
                </div>
              </ModalHeader>
              <ModalBody className="gap-4 py-4 overflow-x-hidden">
                {(() => {
                  const live = findOrder(selected);
                  const orderedAt = selected.orderedAt || live?.createdAt || undefined;
                  const cookingStartedAt =
                    selected.cookingStartedAt || live?.preparingAt || undefined;
                  const cookMins =
                    selected.prepMinutes ??
                    (live
                      ? kitchenCookMinutes(live, selected.toStatus || live.status, selected.at)
                      : undefined) ??
                    (() => {
                      const same = rows.filter((r) => r.orderId === selected.orderId);
                      const startAt =
                        cookingStartedAt ||
                        same.find((r) => r.toStatus === 'preparing')?.at ||
                        same.find((r) => r.action === 'assigned')?.at ||
                        orderedAt;
                      const endAt =
                        selected.toStatus === 'ready' || selected.toStatus === 'served'
                          ? selected.at
                          : same.find((r) => r.toStatus === 'ready' || r.toStatus === 'served')?.at;
                      if (!startAt || !endAt) return undefined;
                      const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
                      if (!Number.isFinite(ms) || ms < 0) return undefined;
                      return Math.round(ms / 60_000);
                    })();
                  const cookLabel = formatCookDuration(cookMins);
                  const waiterName =
                    selected.waiterId && !/^c[a-z0-9]{20,}$/i.test(selected.waiterId)
                      ? selected.waiterId
                      : live?.serverName || selected.waiterId || undefined;

                  return (
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Order</p>
                      <p className="font-semibold text-ghana-black truncate" title={selected.orderId}>
                        {selected.orderId}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Table</p>
                      <p className="font-semibold text-ghana-black">{selected.table || '—'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Order came</p>
                      <p className="font-medium text-ghana-black">
                        {orderedAt ? new Date(orderedAt).toLocaleString() : '—'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Cook time</p>
                      <p className="font-medium text-ghana-black">
                        {cookLabel || '—'}
                        {cookingStartedAt && !cookLabel ? (
                          <span className="block text-[11px] font-normal text-gray-500">
                            Started {new Date(cookingStartedAt).toLocaleTimeString()}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {(selected.fromStatus || selected.toStatus) && (
                      <div className="min-w-0 col-span-2">
                        <p className="text-xs text-gray-500 mb-1">Status change</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {selected.fromStatus ? (
                            <Chip size="sm" variant="flat" className="capitalize">{selected.fromStatus}</Chip>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                          <span className="text-gray-400 text-xs">→</span>
                          {selected.toStatus ? (
                            <Chip size="sm" variant="flat" color="success" className="capitalize">{selected.toStatus}</Chip>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </div>
                    )}
                    {selected.assignedToName && (
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Assignee</p>
                        <p className="font-medium text-ghana-black truncate" title={selected.assignedToName}>
                          {selected.assignedToName}
                        </p>
                      </div>
                    )}
                    {selected.preparedByName && (
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Prepared by</p>
                        <p className="font-medium text-ghana-black truncate" title={selected.preparedByName}>
                          {selected.preparedByName}
                        </p>
                      </div>
                    )}
                    {waiterName && (
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Waiter</p>
                        <p className="font-medium text-ghana-black truncate" title={waiterName}>
                          {waiterName}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                  );
                })()}

                {selected.notes ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Notes</p>
                    <p className="text-sm text-ghana-black whitespace-pre-wrap break-words rounded-xl bg-gray-50 border border-gray-100 p-3">
                      {selected.notes}
                    </p>
                  </div>
                ) : null}

                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer select-none hover:text-ghana-black">More details</summary>
                  <div className="mt-2 space-y-1.5 rounded-lg border border-gray-100 bg-white p-3 break-words">
                    <p><span className="text-gray-400">Dish</span> {selected.itemName}</p>
                    {selected.assignedToName ? (
                      <p><span className="text-gray-400">Cook</span> {selected.assignedToName}</p>
                    ) : null}
                    {selected.preparedByName ? (
                      <p><span className="text-gray-400">Finished by</span> {selected.preparedByName}</p>
                    ) : null}
                    <p><span className="text-gray-400">Event</span> {new Date(selected.at).toLocaleString()}</p>
                  </div>
                </details>
              </ModalBody>
              <ModalFooter className="border-t border-gray-100">
                <Button variant="flat" onPress={() => setSelectedId(null)}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
