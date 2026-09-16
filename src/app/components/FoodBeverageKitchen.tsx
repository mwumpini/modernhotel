'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, CardHeader, Button, Input, Textarea, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Badge, Progress, Tabs, Tab } from "@heroui/react";
import { kitchenOpsStore, KitchenOpRecord } from '../lib/fb/kitchenOpsStore';
import { fetchFbOrders, openKitchenDisplay, type FbOrderDto } from '../lib/fb/api';
import { buildLiveStationBoard, kitchenStats, type LiveStationView } from '../lib/fb/kitchenStations';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import KitchenDisplaySystem from './KitchenDisplaySystem';
import DepartmentRequisitionModal from './inventory/DepartmentRequisitionModal';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import { useDashboardVisibility, type DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';
import DepartmentStaffTab from './hr/DepartmentStaffTab';

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

export default function FoodBeverageKitchen() {
  const [selectedTab, setSelectedTab] = useState('kds');
  const { isHidden, hide, toggle: toggleSection, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.kitchen', KITCHEN_DASHBOARD_SECTIONS);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [liveOrders, setLiveOrders] = useState<FbOrderDto[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);

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
      }))));
  }, []);

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
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
      }))));
  };
  useEffect(() => { reloadRequisitions(); }, []);

  // Real, ledger-derived on-hand for THIS department — see getLocationStockLevels.
  // Populated by requisitions Stores has approved and fulfilled (transfers stock
  // from the shared central pool into Kitchen's own location).
  const [stockOnHand, setStockOnHand] = useState<Record<string, number>>({});
  const reloadStockLevels = () => {
    fetch('/api/inventory/stock-levels?department=kitchen', { headers: fbHeaders() })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setStockOnHand(Object.fromEntries((data.items || []).map((i: any) => [i.id, Number(i.onHand || 0)]))));
  };
  useEffect(() => { reloadStockLevels(); }, []);

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

  const stats = kitchenStats(liveOrders);
  const kitchenStations: LiveStationView[] = buildLiveStationBoard(liveOrders);
  const avgEfficiency =
    kitchenStations.length > 0
      ? Math.round(kitchenStations.reduce((s, st) => s + st.efficiency, 0) / kitchenStations.length)
      : 0;

  const [recipes, setRecipes] = useState<Recipe[]>([]);
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
      }))));
  };
  useEffect(() => { reloadRecipes(); }, []);

  const [recipeForm, setRecipeForm] = useState({
    name: '', category: 'main-course', prepTime: '30', difficulty: 'medium', allergens: '', instructions: '',
  });
  const [ingredientRows, setIngredientRows] = useState<RecipeIngredient[]>([{ name: '', quantity: 0, unit: '' }]);
  const addIngredientRow = () => setIngredientRows([...ingredientRows, { name: '', quantity: 0, unit: '' }]);
  const updateIngredientRow = (index: number, patch: Partial<RecipeIngredient>) => {
    setIngredientRows(ingredientRows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const removeIngredientRow = (index: number) => setIngredientRows(ingredientRows.filter((_, i) => i !== index));

  const submitRecipe = async () => {
    if (!recipeForm.name) return;
    const ingredients = ingredientRows.filter((row) => row.name.trim());
    const instructions = recipeForm.instructions.split('\n').map((s) => s.trim()).filter(Boolean);
    const res = await fetch('/api/fb/recipes', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({
        id: `recipe-${Date.now()}`,
        name: recipeForm.name,
        category: recipeForm.category,
        preparationTime: Number(recipeForm.prepTime) || 0,
        difficulty: recipeForm.difficulty,
        allergens: recipeForm.allergens || undefined,
        ingredients,
        instructions,
      }),
    });
    if (res.ok) {
      setRecipeForm({ name: '', category: 'main-course', prepTime: '30', difficulty: 'medium', allergens: '', instructions: '' });
      setIngredientRows([{ name: '', quantity: 0, unit: '' }]);
      setIsRecipeModalOpen(false);
      reloadRecipes();
    }
  };
  const deleteRecipeById = async (id: string) => {
    await fetch(`/api/fb/recipes?id=${id}`, { method: 'DELETE', headers: fbHeaders() });
    reloadRecipes();
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">👨‍🍳 Kitchen Operations</h2>
          <p className="text-gray-600">Live kitchen display, stations, inventory, requisitions, and recipes</p>
        </div>
        <div className="flex gap-3">
          <Button
            color="primary"
            className="bg-ghana-green text-white"
            onClick={openKitchenDisplay}
          >
            Open Full-Screen KDS
          </Button>
          <Button
            color="success"
            className="bg-blue-500 text-white"
            onClick={() => setIsNewRequisitionModalOpen(true)}
          >
            + Request Stock
          </Button>
          <Button
            color="secondary"
            className="bg-ghana-gold text-white"
            onClick={() => setIsRecipeModalOpen(true)}
          >
            + Add Recipe
          </Button>
          <CustomizeViewControl
            sections={KITCHEN_DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggleSection}
            showAll={showAll}
            hiddenCount={hiddenCount}
          />
        </div>
      </div>

      {/* Stats Overview */}
      {(!isHidden('activeOrders') || !isHidden('avgPrepTime') || !isHidden('kitchenEfficiency') || !isHidden('recipesOnFile')) && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {!isHidden('activeOrders') && (
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Orders</p>
                <p className="text-2xl font-bold text-ghana-black">{stats.activeCount}</p>
                <p className="text-sm text-blue-600">{stats.urgent > 0 ? `${stats.urgent} urgent` : 'From live KDS'}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <HideCardButton onHide={() => hide('activeOrders')} label="Active Orders" />
                <div className="text-3xl">📋</div>
              </div>
            </div>
          </CardBody>
        </Card>
        )}

        {!isHidden('avgPrepTime') && (
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Prep Time</p>
                <p className="text-2xl font-bold text-ghana-black">{stats.avgPrep > 0 ? `${stats.avgPrep}min` : '—'}</p>
                <p className="text-sm text-green-600">{stats.servedToday} served today</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <HideCardButton onHide={() => hide('avgPrepTime')} label="Avg Prep Time" />
                <div className="text-3xl">⏱️</div>
              </div>
            </div>
          </CardBody>
        </Card>
        )}

        {!isHidden('kitchenEfficiency') && (
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Kitchen Efficiency</p>
                <p className="text-2xl font-bold text-ghana-black">{avgEfficiency > 0 ? `${avgEfficiency}%` : '—'}</p>
                <p className="text-sm text-green-600">Live station load</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <HideCardButton onHide={() => hide('kitchenEfficiency')} label="Kitchen Efficiency" />
                <div className="text-3xl">🔥</div>
              </div>
            </div>
          </CardBody>
        </Card>
        )}

        {!isHidden('recipesOnFile') && (
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Recipes on File</p>
                <p className="text-2xl font-bold text-ghana-black">{recipes.length}</p>
                <p className="text-sm text-gray-500">{inventoryItems.length} catalog items</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <HideCardButton onHide={() => hide('recipesOnFile')} label="Recipes on File" />
                <div className="text-3xl">📖</div>
              </div>
            </div>
          </CardBody>
        </Card>
        )}
      </div>
      )}

      {/* Main Content Tabs */}
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
          >
            <Tab key="kds" title="🍳 Kitchen Display">
              <div className="p-4">
                <KitchenDisplaySystem embedded />
              </div>
            </Tab>
            <Tab key="log" title="🧾 Kitchen Operations Log">
              <div className="p-6">
                <KitchenOpsLog />
              </div>
            </Tab>

            <Tab key="stations" title="🔥 Kitchen Stations">
              <div className="p-6">
                {ordersError && (
                  <p className="text-sm text-danger mb-4">⚠ {ordersError}</p>
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
                          <div className="flex gap-2">
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
            </Tab>

            <Tab key="inventory" title="📦 Kitchen Inventory">
              <div className="p-6">
                <p className="text-sm text-gray-500 mb-4">
                  On Hand is Kitchen's own real stock — built up from requisitions Stores has approved and fulfilled.
                  It's separate from what Stores or Restaurant & Bar hold; request more via the Requisitions tab.
                </p>
                <Table aria-label="Kitchen inventory table">
                  <TableHeader>
                    <TableColumn>ITEM</TableColumn>
                    <TableColumn>CATEGORY</TableColumn>
                    <TableColumn>ON HAND</TableColumn>
                    <TableColumn>UNIT</TableColumn>
                    <TableColumn>DEFAULT COST</TableColumn>
                    <TableColumn>SELLING PRICE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No inventory items yet.">
                    {inventoryItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-ghana-black">{item.name}</p>
                            <p className="text-sm text-gray-600">{item.code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge color="primary" variant="flat">{item.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={(stockOnHand[item.id] ?? 0) <= 0 ? 'text-danger font-semibold' : 'font-semibold'}>
                            {stockOnHand[item.id] ?? 0}
                          </span>
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>₵{item.defaultCost.toFixed(2)}</TableCell>
                        <TableCell>₵{item.sellingPrice.toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip color={item.isActive ? 'success' : 'danger'} size="sm">
                            {item.isActive ? 'Active' : 'Inactive'}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="requisitions" title="📝 Requisitions">
              <div className="p-6">
                <p className="text-xs text-gray-500 mb-3">
                  Request stock from Stores — Kitchen doesn't manage suppliers or purchase orders directly. Stores approves it, then marks it <strong>Ready</strong> once it's pulled and staged for pickup (that's also when it lands in your Kitchen Inventory on-hand); until then it's still just approved and you're waiting on it.
                </p>
                <div className="flex justify-end mb-4">
                  <Button color="success" className="bg-blue-500 text-white" onClick={() => setIsNewRequisitionModalOpen(true)}>
                    + Request Stock
                  </Button>
                </div>
                <Table aria-label="Kitchen requisitions table">
                  <TableHeader>
                    <TableColumn>REQUISITION #</TableColumn>
                    <TableColumn>ITEMS</TableColumn>
                    <TableColumn>REQUESTED BY</TableColumn>
                    <TableColumn>REQUESTED DATE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No requisitions yet — request stock from Stores using the button above.">
                    {requisitions.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.requisitionNumber}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {req.items.length} items
                            <p className="text-gray-500 text-xs">
                              {req.items.map(item => `${item.itemName} (${item.quantity})`).join(', ')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{req.requestedBy}</TableCell>
                        <TableCell>
                          <div className="text-sm">{req.requestedDate.toLocaleDateString()}</div>
                        </TableCell>
                        <TableCell>
                          <Chip color={getRequisitionStatusColor(req.status)} size="sm">
                            {req.status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="recipes" title="📖 Recipe Management">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recipes.map((recipe) => (
                    <Card key={recipe.id} className="border border-gray-200 hover:border-ghana-green transition-colors">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-ghana-black">{recipe.name}</h4>
                          <Chip color={getDifficultyColor(recipe.difficulty)} size="sm">
                            {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
                          </Chip>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{recipe.category}</p>
                        
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-sm">
                            <span>Prep Time:</span>
                            <span className="font-medium">⏱️ {recipe.preparationTime}min</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Ingredients:</span>
                            <span className="font-medium">{recipe.ingredients.length} items</span>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">Key Ingredients:</p>
                          <div className="flex flex-wrap gap-1">
                            {recipe.ingredients.slice(0, 3).map((ingredient, index) => (
                              <Chip key={index} size="sm" variant="flat" color="secondary">
                                {ingredient.name}
                              </Chip>
                            ))}
                            {recipe.ingredients.length > 3 && (
                              <Chip size="sm" variant="flat" color="default">
                                +{recipe.ingredients.length - 3} more
                              </Chip>
                            )}
                          </div>
                        </div>
                        
                        {recipe.allergens.length > 0 && recipe.allergens[0] !== 'None' && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Allergens:</p>
                            <div className="flex flex-wrap gap-1">
                              {recipe.allergens.map((allergen, index) => (
                                <Chip key={index} size="sm" variant="flat" color="warning">
                                  {allergen}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Button size="sm" color="primary" variant="flat" onClick={() => setViewingRecipe(recipe)}>View Recipe</Button>
                          <Button size="sm" color="danger" variant="flat" onClick={() => deleteRecipeById(recipe.id)}>Delete</Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                  {recipes.length === 0 && (
                    <p className="text-gray-500 col-span-full text-center py-8">No recipes yet. Add one to get started.</p>
                  )}
                </div>
              </div>
            </Tab>

            <Tab key="staff" title="👥 Staff Management">
              <DepartmentStaffTab
                departmentLabel="Kitchen"
                overtimePermissionId="kitchen.log-overtime"
                departmentNameHints={['kitchen']}
                emptyLabel="No Kitchen staff found in HR records."
                helperText="Staff sourced from HR records for Kitchen departments — separate from Restaurant & Bar's own Staff Management tab."
              />
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* New Recipe Modal */}
      <Modal isOpen={isRecipeModalOpen} onClose={() => setIsRecipeModalOpen(false)} size="3xl">
        <ModalContent>
          <ModalHeader>Add New Recipe</ModalHeader>
          <ModalBody>
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
                    <div key={index} className="grid grid-cols-[1fr,100px,100px,auto] gap-2 items-center">
                      <Input size="sm" placeholder="Ingredient" value={row.name} onChange={(e) => updateIngredientRow(index, { name: e.target.value })} />
                      <Input size="sm" type="number" placeholder="Qty" value={String(row.quantity || '')} onChange={(e) => updateIngredientRow(index, { quantity: Number(e.target.value) || 0 })} />
                      <Input size="sm" placeholder="Unit" value={row.unit} onChange={(e) => updateIngredientRow(index, { unit: e.target.value })} />
                      <Button size="sm" color="danger" variant="light" isIconOnly onClick={() => removeIngredientRow(index)}>✕</Button>
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="flat" className="mt-2" onClick={addIngredientRow}>+ Add Ingredient</Button>
              </div>

              <Textarea label="Instructions" placeholder="Enter cooking instructions, one step per line" value={recipeForm.instructions} onChange={(e) => setRecipeForm({ ...recipeForm, instructions: e.target.value })} minRows={4} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsRecipeModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" className="bg-ghana-green text-white" onPress={submitRecipe}>
              Add Recipe
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
        onCreated={() => { reloadRequisitions(); reloadStockLevels(); }}
      />

      {/* View Recipe Modal */}
      <Modal isOpen={!!viewingRecipe} onClose={() => setViewingRecipe(null)} size="2xl">
        <ModalContent>
          <ModalHeader>{viewingRecipe?.name}</ModalHeader>
          <ModalBody className="pb-6">
            {viewingRecipe && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Chip color={getDifficultyColor(viewingRecipe.difficulty)} size="sm">
                    {viewingRecipe.difficulty.charAt(0).toUpperCase() + viewingRecipe.difficulty.slice(1)}
                  </Chip>
                  <span className="text-sm text-gray-600">{viewingRecipe.category}</span>
                  <span className="text-sm text-gray-600">⏱️ {viewingRecipe.preparationTime}min</span>
                </div>
                <div>
                  <p className="font-medium text-ghana-black mb-1">Ingredients</p>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {viewingRecipe.ingredients.map((ing, i) => (
                      <li key={i}>{ing.quantity} {ing.unit} {ing.name}</li>
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
        </ModalContent>
      </Modal>
    </div>
  );
}

function KitchenOpsLog() {
  const [rows, setRows] = React.useState<KitchenOpRecord[]>([]);
  React.useEffect(() => {
    const sync = () => setRows(kitchenOpsStore.all());
    sync();
    return kitchenOpsStore.subscribe(sync);
  }, []);
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <h3 className="text-xl font-semibold text-ghana-black">Kitchen Operations Log</h3>
        <p className="text-sm text-gray-500 font-normal mt-1">
          Populated from Kitchen Display actions (assign cook, status bumps, cancel).
        </p>
      </CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No kitchen events yet. Assign a cook or bump an order on the Kitchen Display tab.
          </p>
        ) : (
        <div className="max-h-[520px] overflow-y-auto">
          <Table aria-label="Kitchen operations log">
            <TableHeader>
              <TableColumn>TIME</TableColumn>
              <TableColumn>ORDER</TableColumn>
              <TableColumn>TABLE</TableColumn>
              <TableColumn>ITEM</TableColumn>
              <TableColumn>ACTION</TableColumn>
              <TableColumn>FROM → TO</TableColumn>
              <TableColumn>ASSIGNEE</TableColumn>
              <TableColumn>PREPARED BY</TableColumn>
              <TableColumn>PRIORITY</TableColumn>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.at).toLocaleString()}</TableCell>
                  <TableCell>{r.orderId}</TableCell>
                  <TableCell>{r.table}</TableCell>
                  <TableCell>{r.itemName}</TableCell>
                  <TableCell>{r.action}</TableCell>
                  <TableCell>{r.fromStatus || '-'} → {r.toStatus || '-'}</TableCell>
                  <TableCell>{r.assignedToName || '-'}</TableCell>
                  <TableCell>{r.preparedByName || '-'}</TableCell>
                  <TableCell>{(r.priority || '-').toString().toUpperCase()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}
      </CardBody>
    </Card>
  );
}
