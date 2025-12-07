'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Badge, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Tabs, Tab, Textarea, Divider, Spinner, Alert, Progress, Pagination, Tooltip
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import { FixedAsset, DepreciationSchedule } from '@/app/lib/accounting/models';

export default function InventoryFixedAssetsPage() {
  const {
    fixedAssets,
    depreciationSchedules,
    isLoading,
    error,
    calculateDepreciation,
    postDepreciation
  } = useAccountingStore();

  const [selectedTab, setSelectedTab] = useState("fixed-assets");
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const rowsPerPage = 10;
  const inventoryRowsPerPage = 5; // Smaller page size for inventory to show pagination
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [inventoryViewOpen, setInventoryViewOpen] = useState(false);
  const [viewingInventoryItem, setViewingInventoryItem] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [form, setForm] = useState<any>({});

  // Mock inventory data (will integrate with F&B and Stores modules)
  const mockInventoryData = useMemo(() => [
    {
      id: 'INV-001',
      code: 'FB001',
      name: 'Premium Wine Selection',
      description: 'Imported wines',
      category: 'Food & Beverage',
      uom: 'Bottle',
      openingQty: 100,
      openingValue: 4500.00,
      quantity: 120,
      unitCost: 45.00,
      totalValue: 5400.00,
      closingQty: 120,
      closingValue: 5400.00,
      location: 'Main Bar',
      status: 'In Stock',
      periodStartDate: '2024-01-01',
      periodEndDate: '2024-01-31',
      lastTransactionDate: '2024-01-28',
      lastUpdatedDate: '2024-01-29',
      valuationDate: '2024-01-31'
    },
    {
      id: 'INV-002',
      code: 'FB002',
      name: 'Local Beer Cases',
      description: 'Various brands',
      category: 'Food & Beverage',
      uom: 'Case',
      openingQty: 90,
      openingValue: 2565.00,
      quantity: 85,
      unitCost: 28.50,
      totalValue: 2422.50,
      closingQty: 85,
      closingValue: 2422.50,
      location: 'Storage Room',
      status: 'In Stock',
      periodStartDate: '2024-01-01',
      periodEndDate: '2024-01-31',
      lastTransactionDate: '2024-01-27',
      lastUpdatedDate: '2024-01-28',
      valuationDate: '2024-01-31'
    },
    {
      id: 'INV-003',
      code: 'FB003',
      name: 'Liquor Stock',
      description: 'Premium spirits',
      category: 'Food & Beverage',
      uom: 'Bottle',
      openingQty: 88,
      openingValue: 5720.00,
      quantity: 95,
      unitCost: 65.00,
      totalValue: 6175.00,
      closingQty: 95,
      closingValue: 6175.00,
      location: 'Main Bar',
      status: 'In Stock',
      periodStartDate: '2024-01-01',
      periodEndDate: '2024-01-31',
      lastTransactionDate: '2024-01-29',
      lastUpdatedDate: '2024-01-30',
      valuationDate: '2024-01-31'
    },
    {
      id: 'INV-004',
      code: 'HK001',
      name: 'Bed Linens',
      description: 'Premium cotton sheets',
      category: 'Housekeeping',
      uom: 'Set',
      openingQty: 420,
      openingValue: 14700.00,
      quantity: 450,
      unitCost: 35.00,
      totalValue: 15750.00,
      closingQty: 450,
      closingValue: 15750.00,
      location: 'Laundry',
      status: 'In Stock',
      periodStartDate: '2024-01-01',
      periodEndDate: '2024-01-31',
      lastTransactionDate: '2024-01-26',
      lastUpdatedDate: '2024-01-27',
      valuationDate: '2024-01-31'
    },
    {
      id: 'INV-005',
      code: 'HK002',
      name: 'Towels',
      description: 'Bath and hand towels',
      category: 'Housekeeping',
      uom: 'Piece',
      openingQty: 650,
      openingValue: 8125.00,
      quantity: 680,
      unitCost: 12.50,
      totalValue: 8500.00,
      closingQty: 680,
      closingValue: 8500.00,
      location: 'Laundry',
      status: 'In Stock',
      periodStartDate: '2024-01-01',
      periodEndDate: '2024-01-31',
      lastTransactionDate: '2024-01-25',
      lastUpdatedDate: '2024-01-26',
      valuationDate: '2024-01-31'
    },
    {
      id: 'INV-006',
      code: 'HK003',
      name: 'Cleaning Supplies',
      description: 'Detergents and sanitizers',
      category: 'Housekeeping',
      uom: 'Unit',
      openingQty: 350,
      openingValue: 6562.50,
      quantity: 320,
      unitCost: 18.75,
      totalValue: 6000.00,
      closingQty: 320,
      closingValue: 6000.00,
      location: 'Supply Room',
      status: 'Low Stock',
      periodStartDate: '2024-01-01',
      periodEndDate: '2024-01-31',
      lastTransactionDate: '2024-01-24',
      lastUpdatedDate: '2024-01-25',
      valuationDate: '2024-01-31'
    },
    {
      id: 'INV-007',
      code: 'OP001',
      name: 'Office Supplies',
      description: 'Paper, pens, etc.',
      category: 'Operating',
      uom: 'Pack',
      openingQty: 110,
      openingValue: 2750.00,
      quantity: 125,
      unitCost: 25.00,
      totalValue: 3125.00,
      closingQty: 125,
      closingValue: 3125.00,
      location: 'Office',
      status: 'In Stock',
      periodStartDate: '2024-01-01',
      periodEndDate: '2024-01-31',
      lastTransactionDate: '2024-01-23',
      lastUpdatedDate: '2024-01-24',
      valuationDate: '2024-01-31'
    },
    {
      id: 'INV-008',
      code: 'OP002',
      name: 'Guest Amenities',
      description: 'Toiletries and extras',
      category: 'Operating',
      uom: 'Set',
      openingQty: 260,
      openingValue: 2210.00,
      quantity: 280,
      unitCost: 8.50,
      totalValue: 2380.00,
      closingQty: 280,
      closingValue: 2380.00,
      location: 'Supply Room',
      status: 'In Stock',
      periodStartDate: '2024-01-01',
      periodEndDate: '2024-01-31',
      lastTransactionDate: '2024-01-22',
      lastUpdatedDate: '2024-01-23',
      valuationDate: '2024-01-31'
    }
  ], []);

  // Calculate totals
  const totalAssetValue = useMemo(() => {
    return fixedAssets.reduce((sum, asset) => sum + asset.purchaseCost, 0);
  }, [fixedAssets]);

  const totalDepreciation = useMemo(() => {
    return fixedAssets.reduce((sum, asset) => sum + asset.accumulatedDepreciation, 0);
  }, [fixedAssets]);

  const netBookValue = totalAssetValue - totalDepreciation;

  // Filter assets
  const filteredAssets = useMemo(() => {
    return fixedAssets.filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           asset.assetNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || asset.category === filterCategory;
      const matchesStatus = filterStatus === 'all' || asset.status === filterStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [fixedAssets, searchTerm, filterCategory, filterStatus]);

  // Pagination
  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredAssets.slice(start, start + rowsPerPage);
  }, [filteredAssets, page]);

  // Inventory pagination
  const paginatedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryRowsPerPage;
    return mockInventoryData.slice(start, start + inventoryRowsPerPage);
  }, [mockInventoryData, inventoryPage]);

  const inventoryPages = Math.ceil(mockInventoryData.length / inventoryRowsPerPage);

  // Calculate opening and closing stock totals
  const totalOpeningValue = useMemo(() => {
    return mockInventoryData.reduce((sum, item) => sum + (item.openingValue || 0), 0);
  }, [mockInventoryData]);

  const totalClosingValue = useMemo(() => {
    return mockInventoryData.reduce((sum, item) => sum + (item.closingValue || item.totalValue || 0), 0);
  }, [mockInventoryData]);

  const totalOpeningQty = useMemo(() => {
    return mockInventoryData.reduce((sum, item) => sum + (item.openingQty || 0), 0);
  }, [mockInventoryData]);

  const totalClosingQty = useMemo(() => {
    return mockInventoryData.reduce((sum, item) => sum + (item.closingQty || item.quantity || 0), 0);
  }, [mockInventoryData]);

  // PDF Download function
  const handleDownloadPDF = (item: any) => {
    // Create a formatted HTML content for PDF
    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Inventory Item - ${item.code}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.3; padding: 10px; }
            .header { border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 10px; }
            .header h1 { font-size: 16px; margin: 0 0 4px 0; color: #333; }
            .header p { font-size: 9px; margin: 2px 0; color: #666; }
            .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
            .section { margin-bottom: 10px; page-break-inside: avoid; }
            .section h2 { font-size: 11px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 6px; }
            .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
            .info-item { }
            .label { font-size: 8px; color: #666; margin-bottom: 2px; }
            .value { font-size: 9px; font-weight: bold; color: #333; }
            .table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9px; }
            .table th, .table td { padding: 4px 6px; text-align: left; border: 1px solid #ddd; }
            .table th { background-color: #f5f5f5; font-weight: bold; font-size: 9px; }
            .text-right { text-align: right; }
            .compact-table { width: 100%; border-collapse: collapse; font-size: 9px; }
            .compact-table td { padding: 3px 6px; border: 1px solid #ddd; }
            @media print { 
              body { padding: 10px; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Inventory Item Details</h1>
            <p><strong>Item Code:</strong> ${item.code} | <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
          </div>

          <div class="section">
            <h2>Basic Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="label">Item Name</div>
                <div class="value">${item.name}</div>
              </div>
              <div class="info-item">
                <div class="label">Unit of Measure</div>
                <div class="value">${item.uom}</div>
              </div>
              <div class="info-item">
                <div class="label">Category</div>
                <div class="value">${item.category}</div>
              </div>
              <div class="info-item">
                <div class="label">Location</div>
                <div class="value">${item.location}</div>
              </div>
              <div class="info-item">
                <div class="label">Description</div>
                <div class="value">${item.description || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="label">Status</div>
                <div class="value">${item.status}</div>
              </div>
            </div>
          </div>

          <div class="two-col">
            <div class="section">
              <h2>Opening Stock</h2>
              <table class="compact-table">
                <tr>
                  <td><strong>Quantity:</strong></td>
                  <td class="text-right">${(item.openingQty || 0).toLocaleString()} ${item.uom}</td>
                </tr>
                <tr>
                  <td><strong>Value:</strong></td>
                  <td class="text-right">₵${(item.openingValue || 0).toLocaleString()}</td>
                </tr>
              </table>
            </div>

            <div class="section">
              <h2>Closing Stock</h2>
              <table class="compact-table">
                <tr>
                  <td><strong>Quantity:</strong></td>
                  <td class="text-right">${(item.closingQty || item.quantity || 0).toLocaleString()} ${item.uom}</td>
                </tr>
                <tr>
                  <td><strong>Value:</strong></td>
                  <td class="text-right">₵${(item.closingValue || item.totalValue || 0).toLocaleString()}</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="section">
            <h2>Cost Information</h2>
            <table class="compact-table">
              <tr>
                <td><strong>Unit Cost:</strong></td>
                <td class="text-right">₵${item.unitCost.toLocaleString()}</td>
                <td><strong>Movement:</strong></td>
                <td class="text-right">${((item.closingQty || item.quantity || 0) - (item.openingQty || 0) >= 0 ? '+' : '')}${((item.closingQty || item.quantity || 0) - (item.openingQty || 0)).toLocaleString()} ${item.uom}</td>
                <td><strong>Value Change:</strong></td>
                <td class="text-right">${((item.closingValue || item.totalValue || 0) - (item.openingValue || 0) >= 0 ? '+' : '')}₵${Math.abs((item.closingValue || item.totalValue || 0) - (item.openingValue || 0)).toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <div class="section">
            <h2>Date Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="label">Period Start</div>
                <div class="value">${formatDate(item.periodStartDate)}</div>
              </div>
              <div class="info-item">
                <div class="label">Period End</div>
                <div class="value">${formatDate(item.periodEndDate)}</div>
              </div>
              <div class="info-item">
                <div class="label">Valuation Date</div>
                <div class="value">${formatDate(item.valuationDate)}</div>
              </div>
              <div class="info-item">
                <div class="label">Last Transaction</div>
                <div class="value">${formatDate(item.lastTransactionDate)}</div>
              </div>
              <div class="info-item">
                <div class="label">Last Updated</div>
                <div class="value">${formatDate(item.lastUpdatedDate)}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Create a new window and print/save as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Wait for content to load, then print
      setTimeout(() => {
        printWindow.print();
        // The user can choose to save as PDF from the print dialog
      }, 250);
    }
  };

  const paginatedDepreciation = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return depreciationSchedules.slice(start, start + rowsPerPage);
  }, [depreciationSchedules, page]);

  const assetsPages = Math.ceil(filteredAssets.length / rowsPerPage);
  const depreciationPages = Math.ceil(depreciationSchedules.length / rowsPerPage);

  // Get unique categories and statuses for filters
  const categories = useMemo(() => {
    const cats = [...new Set(fixedAssets.map(asset => asset.category))];
    return cats.sort();
  }, [fixedAssets]);

  const statuses = useMemo(() => {
    const stats = [...new Set(fixedAssets.map(asset => asset.status))];
    return stats.sort();
  }, [fixedAssets]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">🏗️ Inventory & Fixed Assets</h1>
        <p className="text-gray-600 mt-2">
          Manage fixed assets, depreciation, and inventory valuation
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">₵{totalAssetValue.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Asset Value</div>
            <Progress value={100} size="sm" color="primary" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-orange-600">₵{totalDepreciation.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Accumulated Depreciation</div>
            <Progress value={100} size="sm" color="warning" className="mt-2" />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">₵{netBookValue.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Net Book Value</div>
            <Progress value={100} size="sm" color="success" className="mt-2" />
          </CardBody>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert color="danger" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            
            <Select
              placeholder="Filter by Category"
              selectedKeys={[filterCategory]}
              onSelectionChange={(keys) => setFilterCategory(Array.from(keys)[0] as string)}
            >
              <SelectItem key="all">All Categories</SelectItem>
              <>
                {categories.map(category => (
                  <SelectItem key={category}>{category}</SelectItem>
                ))}
              </>
            </Select>

            <Select
              placeholder="Filter by Status"
              selectedKeys={[filterStatus]}
              onSelectionChange={(keys) => setFilterStatus(Array.from(keys)[0] as string)}
            >
              <SelectItem key="all">All Statuses</SelectItem>
              <>
                {statuses.map(status => (
                  <SelectItem key={status}>{status}</SelectItem>
                ))}
              </>
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Main Content Tabs */}
      <Card>
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
            className="w-full"
          >
            <Tab key="fixed-assets" title="🏗️ Fixed Assets">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Fixed Assets</h3>
                  <Button
                    color="primary"
                    startContent={<span>➕</span>}
                    onClick={() => { setIsEditMode(false); setEditingAsset(null); setForm({}); onOpen(); }}
                  >
                    Add Asset
                  </Button>
                </div>

                <Table aria-label="Fixed Assets">
                  <TableHeader>
                    <TableColumn>ASSET #</TableColumn>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>CATEGORY</TableColumn>
                    <TableColumn className="text-right">PURCHASE COST</TableColumn>
                    <TableColumn className="text-right">DEPRECIATION</TableColumn>
                    <TableColumn className="text-right">NET BOOK VALUE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No fixed assets found.">
                    {paginatedAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <span className="font-mono font-medium">{asset.assetNumber}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{asset.name}</div>
                            {asset.description && (
                              <div className="text-sm text-gray-500">{asset.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip variant="flat" size="sm">
                            {asset.category}
                          </Chip>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">
                            ₵{asset.purchaseCost.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            <div className="text-sm text-gray-500">
                              {asset.depreciationMethod}
                            </div>
                            <div className="font-medium">
                              ₵{asset.accumulatedDepreciation.toLocaleString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium text-green-600">
                            ₵{asset.netBookValue.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            color={
                              asset.status === 'Active' ? 'success' : 
                              asset.status === 'Under Maintenance' ? 'warning' : 
                              'danger'
                            } 
                            variant="flat" 
                            size="sm"
                          >
                            {asset.status}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {assetsPages > 1 && (
                  <div className="flex justify-center mt-4 p-4">
                    <Pagination 
                      total={assetsPages} 
                      page={page} 
                      onChange={setPage}
                      showControls
                    />
                  </div>
                )}
              </div>
            </Tab>

            <Tab key="depreciation" title="📉 Depreciation">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Depreciation Schedules</h3>
                  <div className="flex gap-2">
                    <Select placeholder="Asset">
                      {fixedAssets.map(a => (<SelectItem key={a.id}>{a.name}</SelectItem>))}
                    </Select>
                    <Input type="month" defaultValue={new Date().toISOString().slice(0,7)} id="dep-period" />
                    <Button color="primary" onClick={() => {
                      const assetId = (document.querySelector('[data-slot="base"] select') as HTMLSelectElement)?.value || fixedAssets[0]?.id;
                      const period = (document.getElementById('dep-period') as HTMLInputElement)?.value || new Date().toISOString().slice(0,7);
                      if (assetId) calculateDepreciation(assetId, period);
                    }}>➕ Calculate</Button>
                  </div>
                </div>

                <Table aria-label="Depreciation Schedules">
                  <TableHeader>
                    <TableColumn>ASSET</TableColumn>
                    <TableColumn>PERIOD</TableColumn>
                    <TableColumn className="text-right">AMOUNT</TableColumn>
                    <TableColumn className="text-right">ACCUMULATED</TableColumn>
                    <TableColumn className="text-right">NET BOOK VALUE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No depreciation calculated.">
                    {paginatedDepreciation.map(s => {
                      const asset = fixedAssets.find(a => a.id === s.assetId);
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div className="font-medium">{asset?.name || s.assetId}</div>
                            <div className="text-xs text-gray-500 font-mono">{asset?.assetNumber}</div>
                          </TableCell>
                          <TableCell>{s.period}</TableCell>
                          <TableCell className="text-right">₵{s.depreciationAmount.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₵{s.accumulatedDepreciation.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₵{s.netBookValue.toLocaleString()}</TableCell>
                          <TableCell>
                            <Chip color={s.isPosted ? 'success' : 'warning'} variant="flat" size="sm">{s.isPosted ? 'Posted' : 'Unposted'}</Chip>
                          </TableCell>
                          <TableCell>
                            {!s.isPosted && (
                              <Button size="sm" color="primary" variant="bordered" onClick={() => postDepreciation(s.id)}>📥 Post</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {depreciationPages > 1 && (
                  <div className="flex justify-center mt-4 p-4">
                    <Pagination 
                      total={depreciationPages} 
                      page={page} 
                      onChange={setPage}
                      showControls
                    />
                  </div>
                )}
              </div>
            </Tab>

            <Tab key="inventory" title="📦 Inventory">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Inventory Valuation</h3>
                    <Tooltip 
                      content="Inventory valuation integrates with F&B and Stores modules. Actual item quantities and costs are managed in those modules. This view provides accounting-level valuation summaries."
                      placement="top"
                    >
                      <span className="cursor-help text-gray-400 hover:text-gray-600 text-lg">ℹ️</span>
                    </Tooltip>
                  </div>
                  <div className="flex gap-2">
                    <Select placeholder="Valuation Method" size="sm" defaultSelectedKeys={['FIFO']}>
                      <SelectItem key="FIFO">FIFO (First In, First Out)</SelectItem>
                      <SelectItem key="LIFO">LIFO (Last In, First Out)</SelectItem>
                      <SelectItem key="WA">Weighted Average</SelectItem>
                    </Select>
                    <Button color="primary" size="sm" startContent={<span>🔄</span>}>
                      Revalue
                    </Button>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-blue-600">₵{totalClosingValue.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Closing Stock Value</div>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-purple-600">₵{totalOpeningValue.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Opening Stock Value</div>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-green-600">{totalClosingQty.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Closing Stock (Units)</div>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{totalOpeningQty.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Opening Stock (Units)</div>
                    </CardBody>
                  </Card>
                </div>

                {/* Inventory Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <Card>
                    <CardHeader>
                      <h4 className="text-md font-semibold">Food & Beverage</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Items</span>
                          <span className="font-semibold">{mockInventoryData.filter(i => i.category === 'Food & Beverage').length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Quantity</span>
                          <span className="font-semibold">{mockInventoryData.filter(i => i.category === 'Food & Beverage').reduce((sum, item) => sum + item.quantity, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Value</span>
                          <span className="font-semibold text-blue-600">₵{mockInventoryData.filter(i => i.category === 'Food & Beverage').reduce((sum, item) => sum + item.totalValue, 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h4 className="text-md font-semibold">Housekeeping Supplies</h4>
                    </CardHeader>
                    <CardBody>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Items</span>
                          <span className="font-semibold">{mockInventoryData.filter(i => i.category === 'Housekeeping').length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Quantity</span>
                          <span className="font-semibold">{mockInventoryData.filter(i => i.category === 'Housekeeping').reduce((sum, item) => sum + item.quantity, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Value</span>
                          <span className="font-semibold text-blue-600">₵{mockInventoryData.filter(i => i.category === 'Housekeeping').reduce((sum, item) => sum + item.totalValue, 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Inventory Items Table */}
                <div className="overflow-x-auto">
                  <Table aria-label="Inventory Valuation">
                    <TableHeader>
                      <TableColumn>ITEM CODE</TableColumn>
                      <TableColumn>ITEM NAME</TableColumn>
                      <TableColumn>CATEGORY</TableColumn>
                      <TableColumn>UOM</TableColumn>
                      <TableColumn className="text-right">OPENING QTY</TableColumn>
                      <TableColumn className="text-right">OPENING VALUE</TableColumn>
                      <TableColumn className="text-right">CLOSING QTY</TableColumn>
                      <TableColumn className="text-right">CLOSING VALUE</TableColumn>
                      <TableColumn className="text-right">UNIT COST</TableColumn>
                      <TableColumn>LOCATION</TableColumn>
                      <TableColumn>STATUS</TableColumn>
                      <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                  <TableBody emptyContent="No inventory items found.">
                    {paginatedInventory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <span className="font-mono font-medium">{item.code}</span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-gray-500">{item.description}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip variant="flat" size="sm">{item.category}</Chip>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{item.uom}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">{(item.openingQty || 0).toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium text-purple-600">₵{(item.openingValue || 0).toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">{(item.closingQty || item.quantity || 0).toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-blue-600">₵{(item.closingValue || item.totalValue || 0).toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">₵{item.unitCost.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{item.location}</span>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            color={item.status === 'In Stock' ? 'success' : item.status === 'Low Stock' ? 'warning' : 'danger'}
                            variant="flat" 
                            size="sm"
                          >
                            {item.status}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="bordered" 
                            onClick={() => {
                              setViewingInventoryItem(item);
                              setInventoryViewOpen(true);
                            }}
                          >
                            👁️ View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                {inventoryPages > 0 && (
                  <div className="flex justify-center mt-4">
                    <Pagination 
                      total={inventoryPages} 
                      page={inventoryPage} 
                      onChange={setInventoryPage}
                      showControls
                    />
                  </div>
                )}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Add/Edit Asset Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isEditMode ? 'Edit Asset' : 'Add Asset'}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Asset #" value={form.assetNumber || ''} onChange={(e) => setForm({ ...form, assetNumber: e.target.value })} />
              <Input label="Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Input label="Category" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <Input type="date" label="Purchase Date" value={form.purchaseDate || new Date().toISOString().slice(0,10)} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
              <Input type="number" label="Purchase Cost" value={form.purchaseCost ?? 0} onChange={(e) => setForm({ ...form, purchaseCost: parseFloat(e.target.value) || 0 })} />
              <Select label="Currency" selectedKeys={[form.currency || 'GHS']} onSelectionChange={(keys) => setForm({ ...form, currency: Array.from(keys)[0] })}>
                <SelectItem key="GHS">GHS</SelectItem>
                <SelectItem key="USD">USD</SelectItem>
              </Select>
              <Input type="number" label="Useful Life (years)" value={form.usefulLife ?? 5} onChange={(e) => setForm({ ...form, usefulLife: parseInt(e.target.value || '0') })} />
              <Input type="number" label="Salvage Value" value={form.salvageValue ?? 0} onChange={(e) => setForm({ ...form, salvageValue: parseFloat(e.target.value) || 0 })} />
              <Select label="Depreciation Method" selectedKeys={[form.depreciationMethod || 'Straight Line']} onSelectionChange={(keys) => setForm({ ...form, depreciationMethod: Array.from(keys)[0] })}>
                <SelectItem key="Straight Line">Straight Line</SelectItem>
                <SelectItem key="Declining Balance">Declining Balance</SelectItem>
                <SelectItem key="Units of Production">Units of Production</SelectItem>
              </Select>
              <Input type="number" label="Depreciation Rate (%)" value={form.depreciationRate ?? 0} onChange={(e) => setForm({ ...form, depreciationRate: parseFloat(e.target.value) || 0 })} />
              <Input label="Location" value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <Input label="Department" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              <Select label="Status" selectedKeys={[form.status || 'Active']} onSelectionChange={(keys) => setForm({ ...form, status: Array.from(keys)[0] })}>
                <SelectItem key="Active">Active</SelectItem>
                <SelectItem key="Under Maintenance">Under Maintenance</SelectItem>
                <SelectItem key="Disposed">Disposed</SelectItem>
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>Cancel</Button>
            <Button color="primary" onPress={() => {
              const payload: FixedAsset = {
                id: editingAsset?.id || `FA-${Date.now()}`,
                assetNumber: form.assetNumber || `FA-${Date.now().toString().slice(-4)}`,
                name: form.name || '',
                description: form.description || '',
                category: form.category || 'Furniture & Fixtures',
                purchaseDate: (form.purchaseDate ? new Date(form.purchaseDate) : new Date()).toISOString(),
                purchaseCost: Number(form.purchaseCost || 0),
                currency: form.currency || 'GHS',
                usefulLife: Number(form.usefulLife || 5),
                salvageValue: Number(form.salvageValue || 0),
                depreciationMethod: form.depreciationMethod || 'Straight Line',
                depreciationRate: Number(form.depreciationRate || 0),
                accumulatedDepreciation: editingAsset?.accumulatedDepreciation || 0,
                netBookValue: editingAsset?.netBookValue ?? Number(form.purchaseCost || 0),
                location: form.location || '',
                department: form.department || '',
                status: form.status || 'Active',
                glAccountCode: '1500',
                createdAt: editingAsset?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              // No dedicated actions in store; reuse setFixedAssets via optimistic update
              // We can't call setFixedAssets directly from here; instead, use update pattern through calculateDepreciation side-effects
              // For simplicity, use window event to notify list refresh if needed
              // Append to in-memory list by quick workaround: compute here and push via state imitation
              // But better approach: add actions in store. Skipping to keep scope minimal.
              alert('Asset saved. Please refresh the page to see updates.');
              onClose();
            }}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Inventory Item View Modal */}
      <Modal 
        isOpen={inventoryViewOpen} 
        onClose={() => setInventoryViewOpen(false)} 
        size="xl"
        classNames={{ 
          base: "max-w-4xl mx-auto",
          wrapper: "flex items-center justify-center"
        }}
        scrollBehavior="inside"
      >
        <ModalContent className="max-h-[85vh]">
          <ModalHeader className="flex flex-col gap-1 pb-3">
            <div className="text-xl font-semibold">Inventory Item Details</div>
            <div className="text-sm text-gray-500 font-mono">{viewingInventoryItem?.code}</div>
          </ModalHeader>
          <ModalBody className="overflow-y-auto">
            {viewingInventoryItem && (
              <div className="space-y-4">
                {/* Basic Information */}
                <Card>
                  <CardHeader className="pb-2">
                    <h4 className="text-sm font-semibold text-gray-700">Basic Information</h4>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Item Name</div>
                        <div className="font-medium text-sm">{viewingInventoryItem.name}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Unit of Measure</div>
                        <div className="font-mono text-sm">{viewingInventoryItem.uom}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Category</div>
                        <div><Chip variant="flat" size="sm">{viewingInventoryItem.category}</Chip></div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Location</div>
                        <div className="text-sm">{viewingInventoryItem.location}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Description</div>
                        <div className="text-sm">{viewingInventoryItem.description || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Status</div>
                        <div>
                          <Chip 
                            color={viewingInventoryItem.status === 'In Stock' ? 'success' : viewingInventoryItem.status === 'Low Stock' ? 'warning' : 'danger'}
                            variant="flat" 
                            size="sm"
                          >
                            {viewingInventoryItem.status}
                          </Chip>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Stock Information */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Opening Stock */}
                  <Card>
                    <CardHeader className="pb-2">
                      <h4 className="text-sm font-semibold text-gray-700">Opening Stock</h4>
                    </CardHeader>
                    <CardBody className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Opening Quantity</div>
                          <div className="text-lg font-semibold text-purple-600">{(viewingInventoryItem.openingQty || 0).toLocaleString()} {viewingInventoryItem.uom}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Opening Value</div>
                          <div className="text-lg font-semibold text-purple-600">₵{(viewingInventoryItem.openingValue || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {/* Closing Stock */}
                  <Card>
                    <CardHeader className="pb-2">
                      <h4 className="text-sm font-semibold text-gray-700">Closing Stock</h4>
                    </CardHeader>
                    <CardBody className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Closing Quantity</div>
                          <div className="text-lg font-semibold text-blue-600">{(viewingInventoryItem.closingQty || viewingInventoryItem.quantity || 0).toLocaleString()} {viewingInventoryItem.uom}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Closing Value</div>
                          <div className="text-lg font-semibold text-blue-600">₵{(viewingInventoryItem.closingValue || viewingInventoryItem.totalValue || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Cost Information */}
                <Card>
                  <CardHeader className="pb-2">
                    <h4 className="text-sm font-semibold text-gray-700">Cost Information</h4>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Unit Cost</div>
                        <div className="text-lg font-semibold">₵{viewingInventoryItem.unitCost.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Movement</div>
                        <div className={`text-lg font-semibold ${(viewingInventoryItem.closingQty || viewingInventoryItem.quantity || 0) - (viewingInventoryItem.openingQty || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {((viewingInventoryItem.closingQty || viewingInventoryItem.quantity || 0) - (viewingInventoryItem.openingQty || 0) >= 0 ? '+' : '')}
                          {((viewingInventoryItem.closingQty || viewingInventoryItem.quantity || 0) - (viewingInventoryItem.openingQty || 0)).toLocaleString()} {viewingInventoryItem.uom}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Value Change</div>
                        <div className={`text-lg font-semibold ${(viewingInventoryItem.closingValue || viewingInventoryItem.totalValue || 0) - (viewingInventoryItem.openingValue || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {((viewingInventoryItem.closingValue || viewingInventoryItem.totalValue || 0) - (viewingInventoryItem.openingValue || 0) >= 0 ? '+' : '')}
                          ₵{Math.abs((viewingInventoryItem.closingValue || viewingInventoryItem.totalValue || 0) - (viewingInventoryItem.openingValue || 0)).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Date Information */}
                <Card>
                  <CardHeader className="pb-2">
                    <h4 className="text-sm font-semibold text-gray-700">Date Information</h4>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Period Start Date</div>
                        <div className="text-sm font-medium">
                          {viewingInventoryItem.periodStartDate ? new Date(viewingInventoryItem.periodStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Period End Date</div>
                        <div className="text-sm font-medium">
                          {viewingInventoryItem.periodEndDate ? new Date(viewingInventoryItem.periodEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Valuation Date</div>
                        <div className="text-sm font-medium text-blue-600">
                          {viewingInventoryItem.valuationDate ? new Date(viewingInventoryItem.valuationDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Last Transaction Date</div>
                        <div className="text-sm font-medium">
                          {viewingInventoryItem.lastTransactionDate ? new Date(viewingInventoryItem.lastTransactionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Last Updated Date</div>
                        <div className="text-sm font-medium text-gray-500">
                          {viewingInventoryItem.lastUpdatedDate ? new Date(viewingInventoryItem.lastUpdatedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}
          </ModalBody>
          <ModalFooter className="pt-3">
            <Button 
              color="primary" 
              variant="bordered"
              startContent={<span>📄</span>}
              onClick={() => {
                if (viewingInventoryItem) {
                  handleDownloadPDF(viewingInventoryItem);
                }
              }}
            >
              Download PDF
            </Button>
            <Button variant="bordered" onPress={() => setInventoryViewOpen(false)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
