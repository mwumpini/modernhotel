'use client';

import { useState } from 'react';
import { useAccountingStore } from '../../lib/accounting/store';
import type { CostCenter, RevenueCenter } from '../../lib/accounting/models';
import { formatAccountingCurrency } from '../../lib/accounting/tenantAccountingConfig';

// formatAccountingCurrency always shows a magnitude, so the sign is reattached in front
// of it here (budget variance can be negative).
function fmt(amount: number): string {
  return (amount < 0 ? '-' : '') + formatAccountingCurrency(amount);
}

export default function CostRevenueCenters() {
  const {
    costCenters,
    revenueCenters,
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cost & Revenue Centers</h1>
        <p className="text-gray-600">Manage cost and revenue centers for financial tracking and reporting</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('cost')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'cost'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Cost Centers ({costCenters.length})
          </button>
          <button
            onClick={() => setActiveTab('revenue')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'revenue'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Revenue Centers ({revenueCenters.length})
          </button>
        </nav>
      </div>

      {/* Add Button */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => {
            setEditingCostCenter(null);
            setEditingRevenueCenter(null);
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add {activeTab === 'cost' ? 'Cost' : 'Revenue'} Center
        </button>
      </div>

      {/* Cost Centers Table */}
      {activeTab === 'cost' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {costCenters.map((center) => {
                const variance = (center.budget || 0) - center.actualExpenses;
                const variancePercent = center.budget ? (variance / center.budget * 100).toFixed(1) : '0';
                return (
                  <tr key={center.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{center.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{center.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{center.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fmt(center.budget || 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fmt(center.actualExpenses)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {variance >= 0 ? '+' : ''}{fmt(variance)} ({variancePercent}%)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${center.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {center.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => {
                          setEditingCostCenter(center);
                          setShowAddModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCostCenter(center)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Revenue Centers Table */}
      {activeTab === 'revenue' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {revenueCenters.map((center) => {
                const variance = center.actualRevenue - (center.budget || 0);
                const variancePercent = center.budget ? (variance / center.budget * 100).toFixed(1) : '0';
                return (
                  <tr key={center.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{center.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{center.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{center.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fmt(center.budget || 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{fmt(center.actualRevenue)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {variance >= 0 ? '+' : ''}{fmt(variance)} ({variancePercent}%)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${center.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {center.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => {
                          setEditingRevenueCenter(center);
                          setShowAddModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRevenueCenter(center)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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

      <div className="grid grid-cols-2 gap-4">
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

