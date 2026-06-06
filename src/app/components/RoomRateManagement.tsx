'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
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
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Textarea,
  Tooltip,
  Badge
} from '@heroui/react';
import { enhancedFrontOfficeStore } from '../lib/frontoffice/enhancedStore';
import { useCalculateTax } from '@/app/hooks/useCalculateTax';

interface RatePlan {
  id: string;
  name: string;
  roomTypeId: string;
  basePrice: number;
  priceType?: 'subtotal' | 'gross_total';
  isActive: boolean;
  marketSegment: string;
  lastUpdated?: string;
  restrictions: {
    minStay: number;
    maxStay: number;
    advanceBooking: number;
    cancellationPolicy: string;
  };
  seasonalRates: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    multiplier: number;
    description: string;
  }>;
  dayOfWeekRates: {
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
  };
}

export default function RoomRateManagement() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedRatePlan, setSelectedRatePlan] = useState<RatePlan | null>(null);
  const [seasonalModalOpen, setSeasonalModalOpen] = useState(false);
  const [seasonalPlanId, setSeasonalPlanId] = useState<string>('');
  const [seasonalForm, setSeasonalForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    multiplier: 1,
    description: ''
  });
  const [selectedTaxPreviewPlan, setSelectedTaxPreviewPlan] = useState<string | null>(null);
  const [selectedSeasonalPlan, setSelectedSeasonalPlan] = useState<string | null>(null);
  
  // Sorting states
  const [ratePlansSortField, setRatePlansSortField] = useState<string>('name');
  const [ratePlansSortDirection, setRatePlansSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Form states
  const [newRatePlan, setNewRatePlan] = useState<{
    name: string;
    roomType: string;
    price: string;
    priceType: 'subtotal' | 'gross_total';
    description: string;
  }>({
    name: '',
    roomType: '',
    price: '0',
    priceType: 'subtotal',
    description: ''
  });

  const [editRatePlanForm, setEditRatePlanForm] = useState({
    name: '',
    roomType: '',
    price: '0',
    priceType: 'subtotal' as 'subtotal' | 'gross_total',
    description: ''
  });

  // Enhanced logging function
  const logAction = (action: string, details: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ROOM_RATE_MANAGEMENT: ${action}`, details);
  };

  const calculateTax = useCalculateTax();

  // Reverse gross-to-subtotal by binary searching the engine (monotonic increasing total)
  const reverseToSubtotalFromGross = (gross: number, category?: string, context?: Record<string, any>) => {
    let lo = 0, hi = Math.max(gross, 1) * 2;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const { total } = calculateTax(mid, category, context);
      if (total > gross) hi = mid; else lo = mid;
    }
    return lo;
  };

  const getLivePreview = () => {
    if (!newRatePlan.price || Number(newRatePlan.price) <= 0) return null;
    const category = 'HOTEL';
    const context = { numPersons: 1, numNights: 1 };
    const baseForCalc = newRatePlan.priceType === 'subtotal'
      ? Number(newRatePlan.price)
      : reverseToSubtotalFromGross(Number(newRatePlan.price), category, context);
    const result = calculateTax(baseForCalc, category, context);
    const breakdownEntries = result.taxes.map(t => ({ key: t.name, amount: t.amount }));
    const mapped: any = { subtotal: baseForCalc, totalTax: result.taxes.reduce((s, t) => s + t.amount, 0), finalBill: result.total };
    breakdownEntries.forEach(b => { mapped[b.key.toLowerCase().replace(/[^a-z]/g, '')] = b.amount; });
    if (mapped.vatstandardrate != null) mapped.vat = mapped.vatstandardrate;
    if (mapped.tourismlevy != null) mapped.tourism = mapped.tourismlevy;
    if (mapped.getfundlevy != null) mapped.getfund = mapped.getfundlevy;
    return mapped;
  };

  const handleAddRatePlan = () => {
    if (newRatePlan.name && newRatePlan.roomType && Number(newRatePlan.price) > 0) {
      const ratePlan: RatePlan = {
        id: Date.now().toString(),
        name: newRatePlan.name,
        roomTypeId: newRatePlan.roomType,
        basePrice: Number(newRatePlan.price),
        priceType: newRatePlan.priceType,
        isActive: true,
        marketSegment: 'General',
        lastUpdated: new Date().toISOString(),
        restrictions: {
          minStay: 1,
          maxStay: 30,
          advanceBooking: 30,
          cancellationPolicy: 'Flexible',
        },
        seasonalRates: [],
        dayOfWeekRates: {
          monday: 1,
          tuesday: 1,
          wednesday: 1,
          thursday: 1,
          friday: 1,
          saturday: 1,
          sunday: 1
        }
      };
      
      enhancedFrontOfficeStore.addRatePlan(ratePlan as any);
      logAction('ADD_RATE_PLAN', { ratePlan });
      setNewRatePlan({ name: '', roomType: '', price: '0', priceType: 'subtotal', description: '' });
      setShowCreateForm(false);
    }
  };

  const handleEditRatePlan = (ratePlan: RatePlan) => {
    setSelectedRatePlan(ratePlan);
    setEditRatePlanForm({
      name: ratePlan.name,
      roomType: ratePlan.roomTypeId,
      price: ratePlan.basePrice.toString(),
      priceType: ratePlan.priceType || 'subtotal',
      description: ''
    });
    setShowEditForm(true);
    logAction('EDIT_RATE_PLAN_OPEN', { ratePlan });
  };

  const handleUpdateRatePlan = () => {
    if (selectedRatePlan && editRatePlanForm.name && editRatePlanForm.roomType) {
      const updates = {
        name: editRatePlanForm.name,
        roomTypeId: editRatePlanForm.roomType,
        basePrice: Number(editRatePlanForm.price),
        priceType: editRatePlanForm.priceType,
        lastUpdated: new Date().toISOString()
      };
      
      enhancedFrontOfficeStore.updateRatePlan(selectedRatePlan.id, updates);
      logAction('UPDATE_RATE_PLAN', { ratePlanId: selectedRatePlan.id, updates });
      setShowEditForm(false);
      setSelectedRatePlan(null);
    }
  };

  const handleDeleteRatePlan = (ratePlan: RatePlan) => {
    if (confirm(`Are you sure you want to delete rate plan "${ratePlan.name}"?`)) {
      enhancedFrontOfficeStore.deleteRatePlan(ratePlan.id);
      logAction('DELETE_RATE_PLAN', { ratePlan });
    }
  };

  const handleAddSeasonalRate = () => {
    if (seasonalForm.name && seasonalForm.startDate && seasonalForm.endDate && seasonalForm.multiplier > 0) {
      const seasonalRate = {
        id: Date.now().toString(),
        name: seasonalForm.name,
        startDate: seasonalForm.startDate,
        endDate: seasonalForm.endDate,
        multiplier: seasonalForm.multiplier,
        description: seasonalForm.description
      };

      if (selectedSeasonalPlan) {
        const plan = enhancedFrontOfficeStore.ratePlans.find(p => p.id === selectedSeasonalPlan);
        if (plan) {
          const updatedSeasonalRates = [...(plan.seasonalRates || []), seasonalRate];
          enhancedFrontOfficeStore.updateRatePlan(selectedSeasonalPlan, { seasonalRates: updatedSeasonalRates });
          logAction('ADD_SEASONAL_RATE', { ratePlanId: selectedSeasonalPlan, seasonalRate });
        }
      }
      
      setSeasonalModalOpen(false);
      setSeasonalForm({ name: '', startDate: '', endDate: '', multiplier: 1, description: '' });
    }
  };

  const getRoomTypeName = (typeId: string) => {
    const roomType = enhancedFrontOfficeStore.roomTypes.find(rt => rt.id === typeId);
    return roomType ? roomType.name : typeId;
  };

  // Sorting functions
  const handleRatePlansSort = (field: string) => {
    if (ratePlansSortField === field) {
      setRatePlansSortDirection(ratePlansSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setRatePlansSortField(field);
      setRatePlansSortDirection('asc');
    }
  };

  const getSortedRatePlans = () => {
    const ratePlans = enhancedFrontOfficeStore.ratePlans.map(plan => ({
      id: plan.id,
      name: plan.name,
      roomTypeId: plan.roomTypeId,
      basePrice: plan.basePrice,
      priceType: plan.priceType || 'subtotal',
      isActive: plan.isActive,
      marketSegment: plan.marketSegment || 'standard',
      lastUpdated: plan.lastUpdated || new Date().toISOString(),
      restrictions: plan.restrictions || {
        minStay: 1,
        maxStay: 30,
        advanceBooking: 0,
        cancellationPolicy: 'Flexible'
      },
      seasonalRates: plan.seasonalRates || [],
      dayOfWeekRates: plan.dayOfWeekRates || {
        monday: 1,
        tuesday: 1,
        wednesday: 1,
        thursday: 1,
        friday: 1,
        saturday: 1,
        sunday: 1
      }
    }));

    return ratePlans.sort((a: any, b: any) => {
      let aValue: any, bValue: any;
      
      switch (ratePlansSortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'roomType':
          aValue = getRoomTypeName(a.roomTypeId);
          bValue = getRoomTypeName(b.roomTypeId);
          break;
        case 'price':
          aValue = a.basePrice;
          bValue = b.basePrice;
          break;
        case 'priceType':
          aValue = a.priceType;
          bValue = b.priceType;
          break;
        case 'lastUpdated':
          aValue = new Date(a.lastUpdated || new Date().toISOString()).getTime();
          bValue = new Date(b.lastUpdated || new Date().toISOString()).getTime();
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return ratePlansSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return ratePlansSortDirection === 'asc' 
          ? (aValue > bValue ? 1 : -1)
          : (aValue < bValue ? -1 : 1);
      }
    });
  };

  const getSortIcon = (field: string, currentField: string, direction: 'asc' | 'desc') => {
    if (currentField !== field) return '↕️';
    return direction === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="space-y-6 dark:bg-gray-900 dark:text-gray-100">
      {/* Price Type Information */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
        <CardHeader className="dark:bg-blue-900/20">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">💰 Understanding Price Types</h3>
        </CardHeader>
        <CardBody className="dark:bg-blue-900/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-blue-700 dark:text-blue-300">Subtotal (Before Tax)</h4>
              <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                <li>• You set the base room rate</li>
                <li>• Taxes are calculated and added on top</li>
                <li>• Guest pays: Base Rate + Taxes</li>
                <li>• Example: ₵600 + ₵132 = ₵732 total</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-blue-700 dark:text-blue-300">Gross Total (Including Tax)</h4>
              <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                <li>• You set the final guest price</li>
                <li>• Taxes are included in your rate</li>
                <li>• Guest pays exactly what you set</li>
                <li>• Example: ₵732 (taxes already included)</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-800/30 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>💡 Tip:</strong> Use "Subtotal" if you want to control your base revenue, 
              use "Gross Total" if you want to control the final guest price.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Add New Rate Plan */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="dark:bg-gray-800">
          <h3 className="text-xl font-semibold dark:text-white">Add New Rate Plan</h3>
        </CardHeader>
        <CardBody className="dark:bg-gray-800">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              label="Rate Plan Name"
              placeholder="e.g., Weekend Special, Corporate Rate"
              value={newRatePlan.name}
              onChange={(e) => setNewRatePlan({...newRatePlan, name: e.target.value})}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-400"
            />
            <Select
              label="Room Type"
              placeholder="Select room type"
              value={newRatePlan.roomType}
              onChange={(e) => setNewRatePlan({...newRatePlan, roomType: e.target.value})}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {enhancedFrontOfficeStore.roomTypes.map((type) => (
                <SelectItem key={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </Select>
            <Input
              label={`Price (₵) - ${newRatePlan.priceType === 'subtotal' ? 'Subtotal' : 'Gross Total'}`}
              type="number"
              placeholder="750"
              value={newRatePlan.price}
              onChange={(e) => setNewRatePlan({...newRatePlan, price: e.target.value})}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-400"
            />
            <Select
              label="Price Type"
              placeholder="Select price type"
              value={newRatePlan.priceType}
              onChange={(e) => setNewRatePlan({...newRatePlan, priceType: e.target.value as 'subtotal' | 'gross_total'})}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <SelectItem key="subtotal">
                Subtotal (Before Tax)
              </SelectItem>
              <SelectItem key="gross_total">
                Gross Total (Including Tax)
              </SelectItem>
            </Select>
            <div className="flex items-end">
              <Button 
                color="primary" 
                onClick={handleAddRatePlan}
                className="w-full dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
              >
                Add Rate Plan
              </Button>
            </div>
          </div>

          {/* Live tax preview */}
          {getLivePreview() && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border dark:border-gray-600">
              <div>
                <h4 className="font-medium mb-2 dark:text-white">Live Preview</h4>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex justify-between"><span>Base (Subtotal):</span><span className="font-mono">₵{getLivePreview()?.subtotal?.toFixed(2) || '0.00'}</span></div>
                  <div className="flex justify-between"><span>NHIL (2.5%):</span><span className="font-mono">₵{getLivePreview()?.nhil?.toFixed(2) || '0.00'}</span></div>
                  <div className="flex justify-between"><span>GETFund (2.5%):</span><span className="font-mono">₵{getLivePreview()?.getfund?.toFixed(2) || '0.00'}</span></div>
                  <div className="flex justify-between"><span>VAT (15% on base+levies):</span><span className="font-mono">₵{getLivePreview()?.vat?.toFixed(2) || '0.00'}</span></div>
                  <div className="flex justify-between"><span>Tourism Levy (1%):</span><span className="font-mono">₵{getLivePreview()?.tourism?.toFixed(2) || '0.00'}</span></div>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-full">
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>Total Tax:</span>
                    <span className="font-mono font-semibold text-red-600 dark:text-red-400">₵{getLivePreview()?.totalTax?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between text-base mt-2">
                    <span className="text-gray-800 dark:text-gray-200 font-medium">Guest Pays:</span>
                    <span className="font-mono font-bold text-green-700 dark:text-green-400">₵{getLivePreview()?.finalBill?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 self-end">
                Changes respond instantly to price and price type. Switch between Subtotal and Gross Total anytime.
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Rate Plans Table */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="dark:bg-gray-800">
          <h3 className="text-xl font-semibold dark:text-white">All Rate Plans</h3>
        </CardHeader>
        <CardBody className="dark:bg-gray-800">
          {enhancedFrontOfficeStore.ratePlans.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No rate plans configured yet. Create your first rate plan to get started!</p>
            </div>
          ) : (
            <Table aria-label="Rate plans table" className="dark:bg-gray-800">
              <TableHeader className="dark:bg-gray-700">
                <TableColumn 
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none transition-colors duration-200 dark:text-white"
                  onClick={() => handleRatePlansSort('name')}
                >
                  <div className="flex items-center gap-2">
                    <span>Name</span>
                    <span className="text-gray-500 dark:text-gray-400">{getSortIcon('name', ratePlansSortField, ratePlansSortDirection)}</span>
                  </div>
                </TableColumn>
                <TableColumn 
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none transition-colors duration-200 dark:text-white"
                  onClick={() => handleRatePlansSort('roomType')}
                >
                  <div className="flex items-center gap-2">
                    <span>Room Type</span>
                    <span className="text-gray-500 dark:text-gray-400">{getSortIcon('roomType', ratePlansSortField, ratePlansSortDirection)}</span>
                  </div>
                </TableColumn>
                <TableColumn 
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none transition-colors duration-200 dark:text-white"
                  onClick={() => handleRatePlansSort('price')}
                >
                  <div className="flex items-center gap-2">
                    <span>Subtotal</span>
                    <span className="text-gray-500 dark:text-gray-400">{getSortIcon('price', ratePlansSortField, ratePlansSortDirection)}</span>
                  </div>
                </TableColumn>
                <TableColumn className="text-center dark:text-white">
                  Final Bill (Tax Inclusive)
                </TableColumn>
                <TableColumn 
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none transition-colors duration-200 dark:text-white"
                  onClick={() => handleRatePlansSort('priceType')}
                >
                  <div className="flex items-center gap-2">
                    <span>Price Type</span>
                    <span className="text-gray-500 dark:text-gray-400">{getSortIcon('priceType', ratePlansSortField, ratePlansSortDirection)}</span>
                  </div>
                </TableColumn>
                <TableColumn 
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none transition-colors duration-200 dark:text-white"
                  onClick={() => handleRatePlansSort('lastUpdated')}
                >
                  <div className="flex items-center gap-2">
                    <span>Last Updated</span>
                    <span className="text-gray-500 dark:text-gray-400">{getSortIcon('lastUpdated', ratePlansSortField, ratePlansSortDirection)}</span>
                  </div>
                </TableColumn>
                <TableColumn className="dark:text-white">Seasonal Rates</TableColumn>
                <TableColumn className="dark:text-white">Actions</TableColumn>
              </TableHeader>
              <TableBody className="dark:bg-gray-800">
                {getSortedRatePlans().map((plan) => (
                  <TableRow key={plan.id} className="dark:border-gray-700 dark:hover:bg-gray-700">
                    <TableCell className="font-medium dark:text-white">{plan.name}</TableCell>
                    <TableCell className="dark:text-white">{getRoomTypeName(plan.roomTypeId)}</TableCell>
                    <TableCell className="dark:text-white">₵{plan.basePrice}</TableCell>
                    <TableCell className="text-center dark:text-white">
                      {(() => {
                        const category = 'HOTEL';
                        const context = { numPersons: 1, numNights: 1, roomType: plan.roomTypeId };
                        const subtotal = plan.priceType === 'subtotal' ? plan.basePrice : reverseToSubtotalFromGross(plan.basePrice, category, context);
                        const { total } = calculateTax(subtotal, category, context);
                        return `₵${total.toFixed(2)}`;
                      })()}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        size="sm" 
                        color={(plan.priceType || 'subtotal') === 'subtotal' ? 'primary' : 'success'} 
                        variant="flat"
                        className={(plan.priceType || 'subtotal') === 'subtotal' ? 'dark:bg-blue-900 dark:text-blue-100' : 'dark:bg-green-900 dark:text-green-100'}
                      >
                        {(plan.priceType || 'subtotal') === 'subtotal' ? 'Subtotal' : 'Gross Total'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {new Date(plan.lastUpdated || new Date().toISOString()).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {plan.seasonalRates.length > 0 ? (
                        <div className="space-y-1">
                          {plan.seasonalRates.map((seasonal) => (
                            <div key={seasonal.id} className="text-xs bg-blue-50 dark:bg-blue-900/30 p-1 rounded">
                              <span className="font-medium dark:text-blue-200">{seasonal.name}</span>
                              <br />
                              <span className="text-gray-600 dark:text-gray-300">
                                {new Date(seasonal.startDate).toLocaleDateString('en-GB')} - {new Date(seasonal.endDate).toLocaleDateString('en-GB')}
                              </span>
                              <br />
                              <span className="text-green-600 dark:text-green-400 font-semibold">{seasonal.multiplier}x</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">No seasonal rates</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Tooltip content="Edit Rate Plan">
                          <Button 
                            size="sm" 
                            variant="light" 
                            isIconOnly
                            onClick={() => handleEditRatePlan(plan as any)}
                            className="dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500"
                          >
                            ✏️
                          </Button>
                        </Tooltip>
                        <Tooltip content="Delete Rate Plan">
                          <Button 
                            size="sm" 
                            variant="light" 
                            color="danger" 
                            isIconOnly
                            onClick={() => handleDeleteRatePlan(plan as any)}
                            className="dark:bg-red-600 dark:text-white dark:hover:bg-red-700"
                          >
                            🗑️
                          </Button>
                        </Tooltip>
                        <Tooltip content="Add Seasonal Rate">
                          <Button 
                            size="sm" 
                            variant="light" 
                            isIconOnly
                            onClick={() => {
                              setSeasonalPlanId(plan.id);
                              setSeasonalForm({ name: '', startDate: '', endDate: '', multiplier: 1, description: '' });
                              setSeasonalModalOpen(true);
                            }}
                            className="dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500"
                          >
                            ➕
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Tax Calculation Preview */}
      <Card>
        <CardHeader>
          <h3 className="text-xl font-semibold">Tax Calculation Preview</h3>
          <p className="text-sm text-gray-600">See how your rates translate to guest bills</p>
        </CardHeader>
        <CardBody>
          {/* Rate Plan Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Select
              label="Rate Plan"
              placeholder="Select rate plan to preview"
              value={selectedTaxPreviewPlan || ''}
              onChange={(e) => setSelectedTaxPreviewPlan(e.target.value)}
            >
              {enhancedFrontOfficeStore.ratePlans.map((plan) => (
                <SelectItem key={plan.id}>
                  {plan.name} - {getRoomTypeName(plan.roomTypeId)}
                </SelectItem>
              ))}
            </Select>
            {selectedTaxPreviewPlan && (
              <div className="flex items-end">
                <Badge color="primary" variant="flat">
                  Previewing: {enhancedFrontOfficeStore.ratePlans.find(p => p.id === selectedTaxPreviewPlan)?.name}
                </Badge>
              </div>
            )}
          </div>

          {/* Tax Calculation Display */}
          {selectedTaxPreviewPlan ? (
            (() => {
              const plan = enhancedFrontOfficeStore.ratePlans.find(p => p.id === selectedTaxPreviewPlan);
              if (!plan) return null;
              
              const roomType = enhancedFrontOfficeStore.roomTypes.find(rt => rt.id === plan.roomTypeId);
              if (!roomType) return null;

              // Calculate tax breakdown via engine
              const category = 'HOTEL';
              const context = { numPersons: 1, numNights: 1, roomType: plan.roomTypeId };
              const subtotal = plan.priceType === 'subtotal' ? plan.basePrice : reverseToSubtotalFromGross(plan.basePrice, category, context);
              const { taxes, total } = calculateTax(subtotal, category, context);
              const grossTotal = total;
              const totalTax = taxes.reduce((s, t) => s + t.amount, 0);
              const nhilAmt = taxes.find((t) => t.name === 'NHIL')?.amount ?? 0;
              const getfundAmt = taxes.find((t) => t.name.includes('GETFund'))?.amount ?? 0;

              return (
                <div className="p-4 border rounded-lg bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">{plan.name}</h4>
                      <p className="text-sm text-gray-600">{roomType.name} • {plan.priceType === 'subtotal' ? 'Subtotal Rate' : 'Gross Rate'}</p>
                    </div>
                    <Chip 
                      size="sm" 
                      color={plan.priceType === 'subtotal' ? 'primary' : 'success'} 
                      variant="flat"
                    >
                      {plan.priceType === 'subtotal' ? 'Subtotal' : 'Gross Total'}
                    </Chip>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Base Rate:</span>
                        <span className="font-mono">₵{subtotal.toFixed(2)}</span>
                      </div>
                      {(() => {
                        const category = 'HOTEL';
                        const context = { numPersons: 1, numNights: 1, roomType: plan.roomTypeId };
                        const subtotalPreview = plan.priceType === 'subtotal' ? plan.basePrice : reverseToSubtotalFromGross(plan.basePrice, category, context);
                        const { taxes } = calculateTax(subtotalPreview, category, context);
                        return taxes.map((t, idx) => (
                          <div key={`${t.name}-${idx}`} className="flex justify-between">
                            <span className="text-sm text-gray-600">{t.name}:</span>
                            <span className="font-mono text-orange-600">₵{t.amount.toFixed(2)}</span>
                          </div>
                        ));
                      })()}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Tax:</span>
                        <span className="font-mono font-semibold text-red-600">₵{totalTax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Guest Pays:</span>
                        <span className="font-mono font-bold text-green-600 text-lg">₵{grossTotal.toFixed(2)}</span>
                      </div>
                      <div className="pt-2">
                        <div className="text-xs text-gray-500">
                          <p><strong>Tax Breakdown:</strong></p>
                          <p>• NHIL + GETFund = {subtotal > 0 ? (((nhilAmt + getfundAmt) / subtotal) * 100).toFixed(1) : '0'}% of base</p>
                          <p>• VAT = 15% of (base + levies)</p>
                          <p>• Tourism = 1% of base</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Select a rate plan above to see tax calculations.</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Seasonal Rates Management */}
      <Card>
        <CardHeader>
          <h3 className="text-xl font-semibold">Seasonal Rates Management</h3>
          <p className="text-sm text-gray-600">Manage seasonal pricing periods and multipliers</p>
        </CardHeader>
        <CardBody>
          {/* Rate Plan Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Select
              label="Rate Plan"
              placeholder="Select rate plan to manage seasonal rates"
              value={selectedSeasonalPlan || ''}
              onChange={(e) => setSelectedSeasonalPlan(e.target.value)}
            >
              {enhancedFrontOfficeStore.ratePlans.map((plan) => (
                <SelectItem key={plan.id}>
                  {plan.name} - {getRoomTypeName(plan.roomTypeId)}
                </SelectItem>
              ))}
            </Select>
            {selectedSeasonalPlan && (
              <div className="flex items-end">
                <Badge color="primary" variant="flat">
                  Managing: {enhancedFrontOfficeStore.ratePlans.find(p => p.id === selectedSeasonalPlan)?.name}
                </Badge>
              </div>
            )}
          </div>

          {/* Seasonal Rates Display */}
          {selectedSeasonalPlan && (() => {
            const plan = enhancedFrontOfficeStore.ratePlans.find(p => p.id === selectedSeasonalPlan);
            if (!plan) return null;

            return (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Current Seasonal Rates</h4>
                  <Button 
                    size="sm" 
                    color="primary"
                    onClick={() => setSeasonalModalOpen(true)}
                  >
                    + Add Seasonal Rate
                  </Button>
                </div>
                
                {plan.seasonalRates && plan.seasonalRates.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plan.seasonalRates.map((seasonal) => (
                      <Card key={seasonal.id} className="border border-blue-200">
                        <CardBody className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-medium text-blue-800">{seasonal.name}</h5>
                            <Chip size="sm" color="success" variant="flat">
                              {seasonal.multiplier}x
                            </Chip>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><strong>Period:</strong> {new Date(seasonal.startDate).toLocaleDateString('en-GB')} - {new Date(seasonal.endDate).toLocaleDateString('en-GB')}</p>
                            {seasonal.description && (
                              <p><strong>Description:</strong> {seasonal.description}</p>
                            )}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                    <p>No seasonal rates configured for this plan.</p>
                    <Button 
                      size="sm" 
                      color="primary" 
                      variant="flat"
                      className="mt-2"
                      onClick={() => setSeasonalModalOpen(true)}
                    >
                      Add First Seasonal Rate
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}

          {!selectedSeasonalPlan && (
            <div className="text-center py-8 text-gray-500">
              <p>Select a rate plan above to manage its seasonal rates.</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Create Rate Plan Modal */}
      <Modal isOpen={showCreateForm} onClose={() => setShowCreateForm(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Create New Rate Plan</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Rate Plan Name"
                placeholder="e.g., Weekend Special, Corporate Rate"
                value={newRatePlan.name}
                onChange={(e) => setNewRatePlan({...newRatePlan, name: e.target.value})}
              />
              <Select
                label="Room Type"
                placeholder="Select room type"
                value={newRatePlan.roomType}
                onChange={(e) => setNewRatePlan({...newRatePlan, roomType: e.target.value})}
              >
                {enhancedFrontOfficeStore.roomTypes.map((type) => (
                  <SelectItem key={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </Select>
              <Input
                label={`Price (₵) - ${newRatePlan.priceType === 'subtotal' ? 'Subtotal' : 'Gross Total'}`}
                type="number"
                placeholder="750"
                value={newRatePlan.price}
                onChange={(e) => setNewRatePlan({...newRatePlan, price: e.target.value})}
              />
              <Select
                label="Price Type"
                placeholder="Select price type"
                value={newRatePlan.priceType}
                onChange={(e) => setNewRatePlan({...newRatePlan, priceType: e.target.value as 'subtotal' | 'gross_total'})}
              >
                <SelectItem key="subtotal">
                  Subtotal (Before Tax)
                </SelectItem>
                <SelectItem key="gross_total">
                  Gross Total (Including Tax)
                </SelectItem>
              </Select>
              <Textarea
                label="Description (Optional)"
                placeholder="Additional details about this rate plan..."
                value={newRatePlan.description}
                onChange={(e) => setNewRatePlan({...newRatePlan, description: e.target.value})}
              />

              {/* Live tax preview */}
              {getLivePreview() && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h4 className="font-medium mb-2">Live Preview</h4>
                  <div className="text-sm text-gray-700">
                    <div className="flex justify-between"><span>Base (Subtotal):</span><span className="font-mono">₵{getLivePreview()?.subtotal?.toFixed(2) || '0.00'}</span></div>
                    <div className="flex justify-between"><span>NHIL (2.5%):</span><span className="font-mono">₵{getLivePreview()?.nhil?.toFixed(2) || '0.00'}</span></div>
                    <div className="flex justify-between"><span>GETFund (2.5%):</span><span className="font-mono">₵{getLivePreview()?.getfund?.toFixed(2) || '0.00'}</span></div>
                    <div className="flex justify-between"><span>VAT (15% on base+levies):</span><span className="font-mono">₵{getLivePreview()?.vat?.toFixed(2) || '0.00'}</span></div>
                    <div className="flex justify-between"><span>Tourism Levy (1%):</span><span className="font-mono">₵{getLivePreview()?.tourism?.toFixed(2) || '0.00'}</span></div>
                    <div className="flex justify-between text-base mt-2">
                      <span className="text-gray-800 font-medium">Guest Pays:</span>
                      <span className="font-mono font-bold text-green-700">₵{getLivePreview()?.finalBill?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setShowCreateForm(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleAddRatePlan}>
              Create Rate Plan
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Rate Plan Modal */}
      <Modal isOpen={showEditForm} onClose={() => setShowEditForm(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Edit Rate Plan</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Rate Plan Name"
                placeholder="e.g., Weekend Special, Corporate Rate"
                value={editRatePlanForm.name}
                onChange={(e) => setEditRatePlanForm({...editRatePlanForm, name: e.target.value})}
              />
              <Select
                label="Room Type"
                placeholder="Select room type"
                value={editRatePlanForm.roomType}
                onChange={(e) => setEditRatePlanForm({...editRatePlanForm, roomType: e.target.value})}
              >
                {enhancedFrontOfficeStore.roomTypes.map((type) => (
                  <SelectItem key={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </Select>
              <Input
                label={`Price (₵) - ${editRatePlanForm.priceType === 'subtotal' ? 'Subtotal' : 'Gross Total'}`}
                type="number"
                placeholder="750"
                value={editRatePlanForm.price}
                onChange={(e) => setEditRatePlanForm({...editRatePlanForm, price: e.target.value})}
              />
              <Select
                label="Price Type"
                placeholder="Select price type"
                value={editRatePlanForm.priceType}
                onChange={(e) => setEditRatePlanForm({...editRatePlanForm, priceType: e.target.value as 'subtotal' | 'gross_total'})}
              >
                <SelectItem key="subtotal">
                  Subtotal (Before Tax)
                </SelectItem>
                <SelectItem key="gross_total">
                  Gross Total (Including Tax)
                </SelectItem>
              </Select>
              <Textarea
                label="Description (Optional)"
                placeholder="Additional details about this rate plan..."
                value={editRatePlanForm.description}
                onChange={(e) => setEditRatePlanForm({...editRatePlanForm, description: e.target.value})}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setShowEditForm(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleUpdateRatePlan}>
              Update Rate Plan
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Seasonal Rate Modal */}
      <Modal isOpen={seasonalModalOpen} onClose={() => setSeasonalModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Add Seasonal Rate</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Season Name"
                placeholder="e.g., Peak Season, Holiday Rate"
                value={seasonalForm.name}
                onChange={(e) => setSeasonalForm({...seasonalForm, name: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start Date"
                  type="date"
                  value={seasonalForm.startDate}
                  onChange={(e) => setSeasonalForm({...seasonalForm, startDate: e.target.value})}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={seasonalForm.endDate}
                  onChange={(e) => setSeasonalForm({...seasonalForm, endDate: e.target.value})}
                />
              </div>
              <Input
                label="Multiplier"
                type="number"
                step="0.1"
                min="0.1"
                placeholder="1.5"
                value={seasonalForm.multiplier.toString()}
                onChange={(e) => setSeasonalForm({...seasonalForm, multiplier: parseFloat(e.target.value) || 1})}
                description="e.g., 1.5 = 50% increase, 0.8 = 20% discount"
              />
              <Textarea
                label="Description (Optional)"
                placeholder="Additional details about this seasonal rate..."
                value={seasonalForm.description}
                onChange={(e) => setSeasonalForm({...seasonalForm, description: e.target.value})}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setSeasonalModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleAddSeasonalRate}>
              Add Seasonal Rate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
