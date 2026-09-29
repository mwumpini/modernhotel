'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Chip,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Tabs,
  Tab,
} from '@heroui/react';
import HeadingInfo from '../HeadingInfo';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { useDeskPagination } from '../dashboard/deskTableUi';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from '../dashboard/deskTabsUi';
import { useAccountingStore } from '../../lib/accounting/store';
import type { CostCenter, RevenueCenter } from '../../lib/accounting/models';
import { formatAccountingCurrency } from '../../lib/accounting/tenantAccountingConfig';
import { computeCostCenterActual, computeRevenueCenterActual } from '../../lib/accounting/costRevenueRollup';
import { downloadCSV, openPrintPreview, generatePdfHtml } from '@/app/lib/accounting/helpers/exportHelpers';

// formatAccountingCurrency always shows a magnitude, so the sign is reattached in front
// of it here (budget variance can be negative).
function fmt(amount: number): string {
  return (amount < 0 ? '-' : '') + formatAccountingCurrency(amount);
}

type CenterSortKey = 'code' | 'name' | 'department' | 'budget' | 'actual' | 'variance' | 'status';
type ViewKind = 'cost' | 'revenue' | null;
type CostCenterRow = {
  center: CostCenter;
  actual: number;
  variance: number;
  variancePercent: string;
};

type RevenueCenterRow = {
  center: RevenueCenter;
  actual: number;
  variance: number;
  variancePercent: string;
};

export default function CostRevenueCenters() {
  const {
    costCenters,
    revenueCenters,
    journalEntries,
    addCostCenter,
    updateCostCenter,
    deleteCostCenter,
    addRevenueCenter,
    updateRevenueCenter,
    deleteRevenueCenter,
    error,
  } = useAccountingStore();

  const [activeTab, setActiveTab] = useState<'cost' | 'revenue'>('cost');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null);
  const [editingRevenueCenter, setEditingRevenueCenter] = useState<RevenueCenter | null>(null);
  const [sortKey, setSortKey] = useState<CenterSortKey>('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewKind, setViewKind] = useState<ViewKind>(null);
  const [viewRow, setViewRow] = useState<CostCenterRow | RevenueCenterRow | null>(null);
  const isViewOpen = viewKind != null && viewRow != null;
  const cols = useResizableColumns<CenterSortKey>({
    code: 88,
    name: 160,
    department: 140,
    budget: 110,
    actual: 110,
    variance: 140,
    status: 88,
  });

  const costDepts = ['front_office', 'housekeeping', 'food_beverage', 'kitchen', 'maintenance', 'sales_marketing', 'accounting', 'hr', 'security', 'general', 'other'];
  const revenueDepts = ['front_office', 'restaurant', 'bar', 'room_service', 'conference', 'spa', 'retail', 'other'];
  const costTypes = ['department', 'operation', 'project', 'support'];
  const revenueTypes = ['rooms', 'food_beverage', 'services', 'conferences', 'spa', 'gift_shop', 'other'];

  const handleSaveCostCenter = (formData: any) => {
    if (editingCostCenter) {
      updateCostCenter(editingCostCenter.id, formData);
    } else {
      const newCenter: CostCenter = {
        id: `CC-${Date.now()}`,
        ...formData,
        actualExpenses: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      addCostCenter(newCenter);
    }
    // A duplicate-code (or other) validation failure sets store.error and adds nothing —
    // keep the modal open so the user sees why, instead of closing as if it saved.
    if (useAccountingStore.getState().error) return;
    setEditingCostCenter(null);
    setShowAddModal(false);
  };

  const handleSaveRevenueCenter = (formData: any) => {
    if (editingRevenueCenter) {
      updateRevenueCenter(editingRevenueCenter.id, formData);
    } else {
      const newCenter: RevenueCenter = {
        id: `RC-${Date.now()}`,
        ...formData,
        actualRevenue: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      addRevenueCenter(newCenter);
    }
    if (useAccountingStore.getState().error) return;
    setEditingRevenueCenter(null);
    setShowAddModal(false);
  };

  const handleDeleteCostCenter = (center: CostCenter) => {
    if (!confirm(`Delete cost centre "${center.name}" (${center.code})?`)) return;
    deleteCostCenter(center.id);
  };

  const handleDeleteRevenueCenter = (center: RevenueCenter) => {
    if (!confirm(`Delete revenue centre "${center.name}" (${center.code})?`)) return;
    deleteRevenueCenter(center.id);
  };

  const costRows = useMemo(() => {
    const enriched: CostCenterRow[] = costCenters.map((center) => {
      const actual = computeCostCenterActual(center, journalEntries);
      const variance = (center.budget || 0) - actual;
      const variancePercent = center.budget ? (variance / center.budget * 100).toFixed(1) : '0';
      return { center, actual, variance, variancePercent };
    });
    const value = (row: CostCenterRow): string | number => {
      const { center } = row;
      switch (sortKey) {
        case 'code': return center.code.toLowerCase();
        case 'name': return center.name.toLowerCase();
        case 'department': return center.department.toLowerCase();
        case 'budget': return center.budget || 0;
        case 'actual': return row.actual;
        case 'variance': return row.variance;
        case 'status': return center.isActive ? 1 : 0;
        default: return '';
      }
    };
    const sorted = [...enriched].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [costCenters, journalEntries, sortKey, sortDir]);

  const revenueRows = useMemo(() => {
    const enriched: RevenueCenterRow[] = revenueCenters.map((center) => {
      const actual = computeRevenueCenterActual(center, journalEntries);
      const variance = actual - (center.budget || 0);
      const variancePercent = center.budget ? (variance / center.budget * 100).toFixed(1) : '0';
      return { center, actual, variance, variancePercent };
    });
    const value = (row: RevenueCenterRow): string | number => {
      const { center } = row;
      switch (sortKey) {
        case 'code': return center.code.toLowerCase();
        case 'name': return center.name.toLowerCase();
        case 'department': return center.department.toLowerCase();
        case 'budget': return center.budget || 0;
        case 'actual': return row.actual;
        case 'variance': return row.variance;
        case 'status': return center.isActive ? 1 : 0;
        default: return '';
      }
    };
    const sorted = [...enriched].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [revenueCenters, journalEntries, sortKey, sortDir]);

  const {
    page: costPage,
    setPage: setCostPage,
    pages: costPages,
    paged: pagedCostRows,
  } = useDeskPagination(costRows, [sortKey, sortDir, costCenters, journalEntries]);

  const {
    page: revenuePage,
    setPage: setRevenuePage,
    pages: revenuePages,
    paged: pagedRevenueRows,
  } = useDeskPagination(revenueRows, [sortKey, sortDir, revenueCenters, journalEntries]);

  const onSort = (key: CenterSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'budget' || key === 'actual' || key === 'variance' ? 'desc' : 'asc');
    }
  };

  const centerColumn = (key: CenterSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const closeView = () => {
    setViewKind(null);
    setViewRow(null);
  };

  const exportCSV = () => {
    if (activeTab === 'cost') {
      downloadCSV(
        costCenters.map((c) => {
          const actual = computeCostCenterActual(c, journalEntries);
          return {
            code: c.code,
            name: c.name,
            department: c.department,
            budget: (c.budget || 0).toFixed(2),
            actual: actual.toFixed(2),
            variance: ((c.budget || 0) - actual).toFixed(2),
            status: c.isActive ? 'Active' : 'Inactive',
          };
        }),
        'cost_centers',
        [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'department', label: 'Department' },
          { key: 'budget', label: 'Budget' },
          { key: 'actual', label: 'Actual' },
          { key: 'variance', label: 'Variance' },
          { key: 'status', label: 'Status' },
        ]
      );
    } else {
      downloadCSV(
        revenueCenters.map((c) => {
          const actual = computeRevenueCenterActual(c, journalEntries);
          return {
            code: c.code,
            name: c.name,
            department: c.department,
            budget: (c.budget || 0).toFixed(2),
            actual: actual.toFixed(2),
            variance: (actual - (c.budget || 0)).toFixed(2),
            status: c.isActive ? 'Active' : 'Inactive',
          };
        }),
        'revenue_centers',
        [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'department', label: 'Department' },
          { key: 'budget', label: 'Budget' },
          { key: 'actual', label: 'Actual' },
          { key: 'variance', label: 'Variance' },
          { key: 'status', label: 'Status' },
        ]
      );
    }
  };

  const printPDF = () => {
    const isCost = activeTab === 'cost';
    const rows = (isCost ? costCenters : revenueCenters).map((c: any) => {
      const actual = isCost ? computeCostCenterActual(c, journalEntries) : computeRevenueCenterActual(c, journalEntries);
      const variance = isCost ? (c.budget || 0) - actual : actual - (c.budget || 0);
      return `<tr>
        <td>${c.code}</td>
        <td>${c.name}</td>
        <td>${c.department}</td>
        <td class="amount">${fmt(c.budget || 0)}</td>
        <td class="amount">${fmt(actual)}</td>
        <td class="amount">${fmt(variance)}</td>
        <td>${c.isActive ? 'Active' : 'Inactive'}</td>
      </tr>`;
    }).join('');
    const title = isCost ? 'Cost Centers' : 'Revenue Centers';
    const html = generatePdfHtml(title, `
      <div class="header">
        <h1>${title}</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
      </div>
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Budget</th><th>Actual</th><th>Variance</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `, title);
    openPrintPreview(html);
  };

  return (
    <div className="px-3 pt-2 pb-3 md:px-4 md:pt-3 md:pb-4">
      <div className="mb-2 flex items-center gap-1.5">
        <h1 className="text-lg md:text-xl font-bold text-gray-800">Cost & Revenue Centers</h1>
        <HeadingInfo label="About cost and revenue centers">Manage cost and revenue centers for financial tracking and reporting</HeadingInfo>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(String(k) as 'cost' | 'revenue')}
        className="w-full"
        size="sm"
        variant="solid"
        classNames={deskBookTabsClassNames}
        aria-label="Cost and revenue centers"
      >
        <Tab key="cost" title={`Cost Centers (${costCenters.length})`} />
        <Tab key="revenue" title={`Revenue Centers (${revenueCenters.length})`} />
      </Tabs>

      <div className={`${deskBookTabPanelClassName} !px-0`}>
      {/* Add / Export Buttons */}
      <div className="mb-2 flex justify-end gap-2">
        <Button size="sm" variant="bordered" onPress={exportCSV}>CSV</Button>
        <Button size="sm" variant="bordered" onPress={printPDF}>📑 PDF</Button>
        <Button
          size="sm"
          color="primary"
          onPress={() => {
            setEditingCostCenter(null);
            setEditingRevenueCenter(null);
            setShowAddModal(true);
          }}
        >
          + Add {activeTab === 'cost' ? 'Cost' : 'Revenue'} Center
        </Button>
      </div>

      {/* Cost Centers Table */}
      {activeTab === 'cost' && (
        <div className="bg-white rounded-lg shadow">
          <div ref={cols.frameRef} style={cols.frameStyle}>
            <Table aria-label="Cost centers" removeWrapper classNames={deskResizableTableClassNames()}>
              <TableHeader>
                {centerColumn('code', 'Code')}
                {centerColumn('name', 'Name')}
                {centerColumn('department', 'Department')}
                {centerColumn('budget', 'Budget', 'right')}
                {centerColumn('actual', 'Actual', 'right')}
                {centerColumn('variance', 'Variance', 'right')}
                {centerColumn('status', 'Status')}
              </TableHeader>
              <TableBody emptyContent="No cost centers yet.">
                {pagedCostRows.map((row) => {
                  const { center, actual, variance, variancePercent } = row;
                  return (
                  <TableRow key={center.id} className={rowClassNames(viewRow?.center.id === center.id && viewKind === 'cost')} onClick={() => { setViewKind('cost'); setViewRow(row); }}>
                    <TableCell className="font-medium text-blue-600 hover:underline">{center.code}</TableCell>
                    <TableCell><span className="block truncate">{center.name}</span></TableCell>
                    <TableCell className="text-gray-500">{center.department}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(center.budget || 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(actual)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {variance >= 0 ? '+' : ''}{fmt(variance)} ({variancePercent}%)
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={center.isActive ? 'success' : 'default'}>
                        {center.isActive ? 'Active' : 'Inactive'}
                      </Chip>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex justify-end px-4 pb-4">
            <Pagination page={costPage} total={costPages} onChange={setCostPage} showControls size="sm" />
          </div>
        </div>
      )}

      {/* Revenue Centers Table */}
      {activeTab === 'revenue' && (
        <div className="bg-white rounded-lg shadow">
          <div ref={cols.frameRef} style={cols.frameStyle}>
            <Table aria-label="Revenue centers" removeWrapper classNames={deskResizableTableClassNames()}>
              <TableHeader>
                {centerColumn('code', 'Code')}
                {centerColumn('name', 'Name')}
                {centerColumn('department', 'Department')}
                {centerColumn('budget', 'Budget', 'right')}
                {centerColumn('actual', 'Actual', 'right')}
                {centerColumn('variance', 'Variance', 'right')}
                {centerColumn('status', 'Status')}
              </TableHeader>
              <TableBody emptyContent="No revenue centers yet.">
                {pagedRevenueRows.map((row) => {
                  const { center, actual, variance, variancePercent } = row;
                  return (
                  <TableRow key={center.id} className={rowClassNames(viewRow?.center.id === center.id && viewKind === 'revenue')} onClick={() => { setViewKind('revenue'); setViewRow(row); }}>
                    <TableCell className="font-medium text-blue-600 hover:underline">{center.code}</TableCell>
                    <TableCell><span className="block truncate">{center.name}</span></TableCell>
                    <TableCell className="text-gray-500">{center.department}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(center.budget || 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(actual)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {variance >= 0 ? '+' : ''}{fmt(variance)} ({variancePercent}%)
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={center.isActive ? 'success' : 'default'}>
                        {center.isActive ? 'Active' : 'Inactive'}
                      </Chip>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex justify-end px-4 pb-4">
            <Pagination page={revenuePage} total={revenuePages} onChange={setRevenuePage} showControls size="sm" />
          </div>
        </div>
      )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {activeTab === 'cost'
                ? (editingCostCenter ? 'Edit Cost Center' : 'Add Cost Center')
                : (editingRevenueCenter ? 'Edit Revenue Center' : 'Add Revenue Center')
              }
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            {activeTab === 'cost' ? (
              <CostCenterForm
                center={editingCostCenter}
                onSave={handleSaveCostCenter}
                onCancel={() => {
                  setShowAddModal(false);
                  setEditingCostCenter(null);
                }}
                departments={costDepts}
                types={costTypes}
              />
            ) : (
              <RevenueCenterForm
                center={editingRevenueCenter}
                onSave={handleSaveRevenueCenter}
                onCancel={() => {
                  setShowAddModal(false);
                  setEditingRevenueCenter(null);
                }}
                departments={revenueDepts}
                types={revenueTypes}
              />
            )}
          </div>
        </div>
      )}

      <Modal isOpen={isViewOpen} onOpenChange={(open) => { if (!open) closeView(); }} size="2xl">
        <ModalContent>
          {(onClose) => {
            if (!viewRow || !viewKind) return null;
            const { center, actual, variance, variancePercent } = viewRow;
            const isCost = viewKind === 'cost';
            return (
              <>
                <ModalHeader className="border-b bg-white px-6 py-4">
                  <div className="flex justify-between items-start w-full pr-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-gray-900">{isCost ? 'COST CENTER' : 'REVENUE CENTER'}</h3>
                        <Chip size="sm" variant="flat" color={center.isActive ? 'success' : 'default'}>
                          {center.isActive ? 'Active' : 'Inactive'}
                        </Chip>
                      </div>
                      <p className="text-lg text-gray-800">{center.name}</p>
                      <p className="text-sm font-mono text-gray-500">{center.code}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold tabular-nums ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {variance >= 0 ? '+' : ''}{fmt(variance)}
                      </p>
                      <p className="text-xs text-gray-500">Variance ({variancePercent}%)</p>
                    </div>
                  </div>
                </ModalHeader>
                <ModalBody className="p-6 bg-white text-sm">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <div><span className="text-gray-500">Department:</span> <span className="font-medium">{center.department}</span></div>
                      <div><span className="text-gray-500">Budget:</span> <span className="tabular-nums font-medium">{fmt(center.budget || 0)}</span></div>
                    </div>
                    <div className="space-y-1">
                      <div><span className="text-gray-500">Actual:</span> <span className="tabular-nums font-medium">{fmt(actual)}</span></div>
                      <div><span className="text-gray-500">Variance:</span> <span className={`tabular-nums font-semibold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(variance)}</span></div>
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter className="border-t bg-white">
                  <Button variant="flat" onPress={onClose}>Close</Button>
                  <Button color="danger" variant="flat" onPress={() => {
                    if (isCost) handleDeleteCostCenter(center as CostCenter);
                    else handleDeleteRevenueCenter(center as RevenueCenter);
                    closeView();
                  }}>🗑️ Delete</Button>
                  <Button color="primary" onPress={() => {
                    closeView();
                    if (isCost) {
                      setEditingCostCenter(center as CostCenter);
                      setEditingRevenueCenter(null);
                    } else {
                      setEditingRevenueCenter(center as RevenueCenter);
                      setEditingCostCenter(null);
                    }
                    setShowAddModal(true);
                  }}>✏️ Edit</Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}

// Cost Center Form Component
function CostCenterForm({ center, onSave, onCancel, departments, types }: any) {
  const [formData, setFormData] = useState({
    code: center?.code || '',
    name: center?.name || '',
    description: center?.description || '',
    type: center?.type || 'department',
    department: center?.department || 'front_office',
    glAccountCode: center?.glAccountCode || '',
    budget: center?.budget || 0,
    isActive: center?.isActive !== false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, glAccountCode: formData.glAccountCode.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
          <input
            type="text"
            required
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {types.map((type: string) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {departments.map((dept: string) => (
              <option key={dept} value={dept}>{dept.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GL Account Code <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={formData.glAccountCode}
            onChange={(e) => setFormData({ ...formData, glAccountCode: e.target.value })}
            placeholder="e.g. 5100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p className="mt-1 text-xs text-gray-500">When set, Actual is the live total posted to this GL account instead of a manual figure.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Budget (GHS)</label>
          <input
            type="number"
            required
            min="0"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="active"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="active" className="ml-2 block text-sm text-gray-900">Active</label>
      </div>

      <div className="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </form>
  );
}

// Revenue Center Form Component
function RevenueCenterForm({ center, onSave, onCancel, departments, types }: any) {
  const [formData, setFormData] = useState({
    code: center?.code || '',
    name: center?.name || '',
    description: center?.description || '',
    type: center?.type || 'rooms',
    department: center?.department || 'front_office',
    glAccountCode: center?.glAccountCode || '4100',
    budget: center?.budget || 0,
    isActive: center?.isActive !== false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
          <input
            type="text"
            required
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {types.map((type: string) => (
              <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {departments.map((dept: string) => (
              <option key={dept} value={dept}>{dept.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GL Account Code</label>
          <input
            type="text"
            required
            value={formData.glAccountCode}
            onChange={(e) => setFormData({ ...formData, glAccountCode: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Budget (GHS)</label>
          <input
            type="number"
            required
            min="0"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="active"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="active" className="ml-2 block text-sm text-gray-900">Active</label>
      </div>

      <div className="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </form>
  );
}

