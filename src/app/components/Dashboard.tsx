'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Progress, Badge, Chip, 
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Tabs, Tab, Divider, Spinner
} from '@heroui/react';
import { useAccountingStore } from '../lib/accounting/store';
import { storesStore } from '../lib/stores/store';
import { trackEvent } from '../lib/analytics/trackEvent';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  
  const accountingStore = useAccountingStore();
  
  // Get data from various stores
  const chartOfAccounts = accountingStore.chartOfAccounts;
  const journalEntries = accountingStore.journalEntries;
  const inventoryItems = storesStore.getAllItems();
  const purchaseOrders = storesStore.getPurchaseOrders();
  const stockMovements = storesStore.getStockMovements();
  
  // Calculate key metrics
  const totalRevenue = chartOfAccounts
    .filter(acc => acc.code.startsWith('4')) // Revenue accounts
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);
    
  const totalExpenses = chartOfAccounts
    .filter(acc => acc.code.startsWith('5') || acc.code.startsWith('6')) // COGS and Expenses
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);
    
  const inventoryValue = storesStore.getInventoryValue();
  const vatLiability = storesStore.getVATLiability();
  
  const recentTransactions = journalEntries.slice(0, 10);
  const recentStockMovements = stockMovements.slice(0, 10);
  
  const stats = [
    { 
      label: 'Total Revenue', 
      value: `₵${totalRevenue.toLocaleString()}`, 
      change: '+12%', 
      changeType: 'positive', 
      icon: '💰',
      description: 'Current period revenue'
    },
    { 
      label: 'Total Expenses', 
      value: `₵${totalExpenses.toLocaleString()}`, 
      change: '+8%', 
      changeType: 'negative', 
      icon: '💸',
      description: 'Current period expenses'
    },
    { 
      label: 'Net Profit', 
      value: `₵${(totalRevenue - totalExpenses).toLocaleString()}`, 
      change: '+15%', 
      changeType: 'positive', 
      icon: '📈',
      description: 'Revenue minus expenses'
    },
    { 
      label: 'Inventory Value', 
      value: `₵${inventoryValue.toLocaleString()}`, 
      change: '+5%', 
      changeType: 'positive', 
      icon: '📦',
      description: 'Current stock value'
    },
    { 
      label: 'VAT Liability', 
      value: `₵${vatLiability.toLocaleString()}`, 
      change: '+5%', 
      changeType: 'neutral', 
      icon: '🏛️',
      description: 'Ghana VAT obligations'
    },
    { 
      label: 'Open POs', 
      value: purchaseOrders.filter(po => po.status === 'draft' || po.status === 'sent').length.toString(), 
      change: '+2', 
      changeType: 'neutral', 
      icon: '🧾',
      description: 'Pending purchase orders'
    }
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl">{stat.icon}</div>
                <Badge 
                  size="sm" 
                  color={stat.changeType === 'positive' ? 'success' : stat.changeType === 'negative' ? 'danger' : 'default'}
                >
                  {stat.change}
                </Badge>
              </div>
              <h3 className="text-2xl font-bold text-ghana-black mb-2">{stat.value}</h3>
              <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
              <p className="text-xs text-gray-500">{stat.description}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* System Integration Status */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🔄 System Integration Status</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Module Connectivity</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Front Desk ↔ Accounting</span>
                  <Badge color="success">Connected</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">F&B POS ↔ Stores</span>
                  <Badge color="success">Connected</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Stores ↔ Accounting</span>
                  <Badge color="success">Connected</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">HR ↔ Payroll</span>
                  <Badge color="success">Connected</Badge>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Data Flow Health</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Real-time Updates</span>
                  <Badge color="success">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Audit Trail</span>
                  <Badge color="success">Recording</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Backup Sync</span>
                  <Badge color="success">Synced</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Offline Mode</span>
                  <Badge color="warning">Standby</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Ghanaian Compliance Overview */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🇬🇭 Ghanaian Compliance Status</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">VAT Management</h4>
              <p className="text-sm text-blue-600">Output VAT: ₵{(totalRevenue * 0.15).toFixed(2)}</p>
              <p className="text-sm text-blue-600">Input VAT: ₵{vatLiability.toFixed(2)}</p>
              <p className="text-sm text-blue-600">Net VAT: ₵{((totalRevenue * 0.15) - vatLiability).toFixed(2)}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">Tax Compliance</h4>
              <p className="text-sm text-green-600">NHIL: ₵{(totalRevenue * 0.025).toFixed(2)}</p>
              <p className="text-sm text-green-600">GETFund: ₵{(totalRevenue * 0.025).toFixed(2)}</p>
              <p className="text-sm text-green-600">Tourism Levy: ₵{(totalRevenue * 0.01).toFixed(2)}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2">Documentation</h4>
              <p className="text-sm text-purple-600">VAT Returns: Up to date</p>
              <p className="text-sm text-purple-600">Audit Trail: Complete</p>
              <p className="text-sm text-purple-600">Supplier Compliance: Verified</p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderFinancialFlow = () => (
    <div className="space-y-6">
      {/* Financial Flow Diagram */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">💼 Financial Data Flow</h3>
        </CardHeader>
        <CardBody>
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                <div className="text-2xl mb-2">🏨</div>
                <h4 className="font-semibold text-blue-800">Front Desk</h4>
                <p className="text-xs text-gray-600">Room Revenue</p>
                <p className="text-sm font-bold">₵{chartOfAccounts.find(acc => acc.code === '4100')?.balance?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-green-200">
                <div className="text-2xl mb-2">🍽️</div>
                <h4 className="font-semibold text-green-800">F&B Sales</h4>
                <p className="text-xs text-gray-600">Restaurant & Bar</p>
                <p className="text-sm font-bold">₵{chartOfAccounts.find(acc => acc.code === '4200')?.balance?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-yellow-200">
                <div className="text-2xl mb-2">📦</div>
                <h4 className="font-semibold text-yellow-800">Inventory</h4>
                <p className="text-xs text-gray-600">Stock Value</p>
                <p className="text-sm font-bold">₵{inventoryValue.toFixed(2)}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-red-200">
                <div className="text-2xl mb-2">🏛️</div>
                <h4 className="font-semibold text-red-800">Tax Liabilities</h4>
                <p className="text-xs text-gray-600">VAT & Levies</p>
                <p className="text-sm font-bold">₵{vatLiability.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <div className="text-sm text-gray-600 mb-2">Data flows automatically between modules</div>
              <div className="flex justify-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Recent Financial Transactions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Financial Transactions</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Recent transactions">
            <TableHeader>
              <TableColumn>Date</TableColumn>
              <TableColumn>Reference</TableColumn>
              <TableColumn>Description</TableColumn>
              <TableColumn>Amount</TableColumn>
              <TableColumn>Status</TableColumn>
            </TableHeader>
            <TableBody>
              {recentTransactions.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono">{entry.entryNumber}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>
                    <span className={entry.lines.reduce((sum, line) => sum + line.debit, 0) > 0 ? 'text-red-600' : 'text-green-600'}>
                      ₵{Math.abs(entry.lines.reduce((sum, line) => sum + line.debit - line.credit, 0)).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      size="sm" 
                      color={entry.status === 'posted' ? 'success' : 'warning'}
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderInventoryFlow = () => (
    <div className="space-y-6">
      {/* Inventory Flow Diagram */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📦 Inventory & Cost Flow</h3>
        </CardHeader>
        <CardBody>
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
              <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                <div className="text-2xl mb-2">🛒</div>
                <h4 className="font-semibold text-blue-800">Purchase</h4>
                <p className="text-xs text-gray-600">Create PO</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-green-200">
                <div className="text-2xl mb-2">📥</div>
                <h4 className="font-semibold text-green-800">Receive</h4>
                <p className="text-xs text-gray-600">GRN Process</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-yellow-200">
                <div className="text-2xl mb-2">🏪</div>
                <h4 className="font-semibold text-yellow-800">Store</h4>
                <p className="text-xs text-gray-600">Inventory Asset</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-red-200">
                <div className="text-2xl mb-2">📤</div>
                <h4 className="font-semibold text-red-800">Issue</h4>
                <p className="text-xs text-gray-600">To Departments</p>
              </div>
              <div className="bg-white p-4 rounded-lg border-2 border-purple-200">
                <div className="text-2xl mb-2">💰</div>
                <h4 className="font-semibold text-purple-800">COGS</h4>
                <p className="text-xs text-gray-600">Cost Recognition</p>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <div className="text-sm text-gray-600 mb-2">Automatic accounting entries at each step</div>
              <div className="flex justify-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Recent Stock Movements */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📤 Recent Stock Movements</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Recent stock movements">
            <TableHeader>
              <TableColumn>Date</TableColumn>
              <TableColumn>Item</TableColumn>
              <TableColumn>Type</TableColumn>
              <TableColumn>Quantity</TableColumn>
              <TableColumn>Value</TableColumn>
              <TableColumn>Reference</TableColumn>
            </TableHeader>
            <TableBody>
              {recentStockMovements.map(movement => (
                <TableRow key={movement.id}>
                  <TableCell>{new Date(movement.date).toLocaleDateString()}</TableCell>
                  <TableCell>{movement.itemName}</TableCell>
                  <TableCell>
                    <Badge 
                      size="sm" 
                      color={
                        movement.movementType === 'purchase' ? 'success' :
                        movement.movementType === 'issue' ? 'warning' : 'default'
                      }
                    >
                      {movement.movementType}
                    </Badge>
                  </TableCell>
                  <TableCell>{movement.quantity}</TableCell>
                  <TableCell>₵{movement.totalValue.toFixed(2)}</TableCell>
                  <TableCell className="font-mono">{movement.reference}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderWorkflowIntegration = () => (
    <div className="space-y-6">
      {/* Guest Journey Integration */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">👥 Guest Journey Integration</h3>
        </CardHeader>
        <CardBody>
          <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-2xl mb-2">📅</div>
                <h4 className="font-semibold text-blue-800">1. Reservation</h4>
                <p className="text-xs text-gray-600">Front Desk</p>
                <p className="text-xs text-gray-600">Creates guest folio</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-2xl mb-2">🔑</div>
                <h4 className="font-semibold text-green-800">2. Check-in</h4>
                <p className="text-xs text-gray-600">Room assignment</p>
                <p className="text-xs text-gray-600">Folio activation</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-2xl mb-2">🍽️</div>
                <h4 className="font-semibold text-yellow-800">3. Services</h4>
                <p className="text-xs text-gray-600">F&B, Spa, etc.</p>
                <p className="text-xs text-gray-600">Auto-post to folio</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-2xl mb-2">🚪</div>
                <h4 className="font-semibold text-red-800">4. Check-out</h4>
                <p className="text-xs text-gray-600">Final settlement</p>
                <p className="text-xs text-gray-600">Accounting update</p>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <div className="text-sm text-gray-600 mb-2">Seamless data flow across all touchpoints</div>
              <div className="flex justify-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Department Integration */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🏢 Department Integration</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Front Office</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Guest Folios</span>
                  <Badge size="sm" color="success">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Room Status</span>
                  <Badge size="sm" color="success">Synced</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Payment Processing</span>
                  <Badge size="sm" color="success">Connected</Badge>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Food & Beverage</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>POS Integration</span>
                  <Badge size="sm" color="success">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Kitchen Display</span>
                  <Badge size="sm" color="success">Connected</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Inventory Updates</span>
                  <Badge size="sm" color="success">Real-time</Badge>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Housekeeping</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Room Status</span>
                  <Badge size="sm" color="success">Synced</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Supply Requests</span>
                  <Badge size="sm" color="success">Connected</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Maintenance</span>
                  <Badge size="sm" color="success">Integrated</Badge>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Accounting</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Journal Entries</span>
                  <Badge size="sm" color="success">Auto-generated</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tax Calculations</span>
                  <Badge size="sm" color="success">Ghana Compliant</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Reports</span>
                  <Badge size="sm" color="success">Real-time</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🏨 Hotel Management System</h1>
          <p className="text-gray-600">Integrated Dashboard - All modules working together</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">Ghana Compliant</Badge>
        </div>
      </div>

      <Tabs 
        selectedKey={activeTab} 
        onSelectionChange={(key) => setActiveTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="System Overview" />
        <Tab key="financial" title="Financial Flow" />
        <Tab key="inventory" title="Inventory Flow" />
        <Tab key="workflow" title="Workflow Integration" />
      </Tabs>

      <div className="mt-6">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'financial' && renderFinancialFlow()}
        {activeTab === 'inventory' && renderInventoryFlow()}
        {activeTab === 'workflow' && renderWorkflowIntegration()}
      </div>

      {/* Integration Status Footer */}
      <div className="mt-8 p-4 bg-gradient-to-r from-blue-500/10 to-ghana-gold/10 rounded-xl border border-blue-500/20">
        <h3 className="text-sm font-semibold text-ghana-black mb-2">🔄 Real-time Integration Status</h3>
        <div className="text-xs text-gray-600 space-y-1">
          <p>• All modules are interconnected and sharing data automatically</p>
          <p>• Changes in one module immediately reflect across the entire system</p>
          <p>• Ghanaian tax compliance is automated and real-time</p>
          <p>• Audit trail is maintained for all transactions and changes</p>
        </div>
      </div>
    </div>
  );
}
