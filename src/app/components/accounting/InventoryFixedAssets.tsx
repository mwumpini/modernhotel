'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Badge, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Tabs, Tab, Textarea, Divider, Spinner, Alert, Progress
} from "@heroui/react";
import { useAccountingStore } from '@/app/lib/accounting/store';
import { FixedAsset, DepreciationSchedule } from '@/app/lib/accounting/models';

export default function InventoryFixedAssetsPage() {
  const {
    fixedAssets,
    depreciationSchedules,
    isLoading,
    error
  } = useAccountingStore();

  const [selectedTab, setSelectedTab] = useState("fixed-assets");
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

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
              {categories.map(category => (
                <SelectItem key={category}>{category}</SelectItem>
              ))}
            </Select>

            <Select
              placeholder="Filter by Status"
              selectedKeys={[filterStatus]}
              onSelectionChange={(keys) => setFilterStatus(Array.from(keys)[0] as string)}
            >
              <SelectItem key="all">All Statuses</SelectItem>
              {statuses.map(status => (
                <SelectItem key={status}>{status}</SelectItem>
              ))}
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
                  >
                    Add Asset
                  </Button>
                </div>

                <Table aria-label="Fixed Assets">
                  <TableHeader>
                    <TableColumn>ASSET #</TableColumn>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>CATEGORY</TableColumn>
                    <TableColumn>PURCHASE COST</TableColumn>
                    <TableColumn>DEPRECIATION</TableColumn>
                    <TableColumn>NET BOOK VALUE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No fixed assets found.">
                    {filteredAssets.map((asset) => (
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
                        <TableCell>
                          <div className="text-right font-medium">
                            ₵{asset.purchaseCost.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">
                              {asset.depreciationMethod}
                            </div>
                            <div className="font-medium">
                              ₵{asset.accumulatedDepreciation.toLocaleString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-right font-medium text-green-600">
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
              </div>
            </Tab>

            <Tab key="depreciation" title="📉 Depreciation">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Depreciation Schedules</h3>
                <div className="text-center p-8 text-gray-500">
                  Depreciation schedule management coming soon...
                </div>
              </div>
            </Tab>

            <Tab key="inventory" title="📦 Inventory">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Inventory Valuation</h3>
                <div className="text-center p-8 text-gray-500">
                  Inventory valuation and management coming soon...
                </div>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
