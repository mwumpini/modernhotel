'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Input, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, Textarea,
  Tabs, Tab, Divider, Progress, Avatar, useDisclosure, Tooltip, Switch, Alert, Pagination
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';

interface POSTransaction {
  id: string;
  orderNumber: string;
  tableNumber: string;
  customerName: string;
  items: POSItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile_money' | 'bank_transfer';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  orderStatus: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  kotStatus: 'pending' | 'sent' | 'acknowledged' | 'completed';
  server: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
  receiptNumber: string;
}

interface POSItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
  specialInstructions?: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  isAvailable: boolean;
  description: string;
}

export default function POSManagementDashboard() {
  const [activeTab, setActiveTab] = useState('pos-terminal');
  const [selectedTransaction, setSelectedTransaction] = useState<POSTransaction | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isKOTModalOpen, setIsKOTModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  const settings = useSettingsStore();

  // Sample POS transactions data
  const posTransactions: POSTransaction[] = [
    {
      id: '1',
      orderNumber: 'ORD-001',
      tableNumber: 'T1',
      customerName: 'John Doe',
      items: [
        { id: '1', name: 'Jollof Rice', quantity: 2, unitPrice: 45.00, total: 90.00, category: 'Main Course' },
        { id: '2', name: 'Bissap Juice', quantity: 2, unitPrice: 12.00, total: 24.00, category: 'Beverage' }
      ],
      subtotal: 114.00,
      tax: 17.10,
      total: 131.10,
      paymentMethod: 'card',
      paymentStatus: 'completed',
      orderStatus: 'served',
      kotStatus: 'completed',
      server: 'Ama Serwaa',
      createdAt: '2024-01-16T12:00:00Z',
      completedAt: '2024-01-16T12:45:00Z',
      receiptNumber: 'RCP-001'
    },
    {
      id: '2',
      orderNumber: 'ORD-002',
      tableNumber: 'T3',
      customerName: 'Jane Smith',
      items: [
        { id: '3', name: 'Banku & Tilapia', quantity: 1, unitPrice: 55.00, total: 55.00, category: 'Main Course' },
        { id: '4', name: 'Kelewele', quantity: 1, unitPrice: 15.00, total: 15.00, category: 'Appetizer' }
      ],
      subtotal: 70.00,
      tax: 10.50,
      total: 80.50,
      paymentMethod: 'mobile_money',
      paymentStatus: 'completed',
      orderStatus: 'ready',
      kotStatus: 'acknowledged',
      server: 'Kofi Mensah',
      createdAt: '2024-01-16T12:15:00Z',
      receiptNumber: 'RCP-002'
    },
    {
      id: '3',
      orderNumber: 'ORD-003',
      tableNumber: 'T5',
      customerName: 'Mike Johnson',
      items: [
        { id: '5', name: 'Fufu & Light Soup', quantity: 1, unitPrice: 40.00, total: 40.00, category: 'Main Course' }
      ],
      subtotal: 40.00,
      tax: 6.00,
      total: 46.00,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      orderStatus: 'preparing',
      kotStatus: 'sent',
      server: 'Efua Osei',
      createdAt: '2024-01-16T12:30:00Z',
      receiptNumber: 'RCP-003'
    }
  ];

  // Sample menu items for POS
  const menuItems: MenuItem[] = [
    { id: '1', name: 'Jollof Rice', category: 'Main Course', price: 45.00, isAvailable: true, description: 'Traditional Ghanaian Jollof rice with chicken' },
    { id: '2', name: 'Banku & Tilapia', category: 'Main Course', price: 55.00, isAvailable: true, description: 'Fermented corn and cassava dough with grilled tilapia' },
    { id: '3', name: 'Fufu & Light Soup', category: 'Main Course', price: 40.00, isAvailable: true, description: 'Pounded cassava and plantain with light soup' },
    { id: '4', name: 'Kelewele', category: 'Appetizer', price: 15.00, isAvailable: true, description: 'Spiced fried plantains' },
    { id: '5', name: 'Bissap Juice', category: 'Beverage', price: 12.00, isAvailable: true, description: 'Refreshing hibiscus juice' }
  ];

  // Filter and search transactions
  const filteredTransactions = posTransactions.filter(transaction => {
    const matchesSearch = transaction.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.tableNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || transaction.orderStatus === filterStatus;
    const matchesPayment = filterPayment === 'all' || transaction.paymentStatus === filterPayment;
    
    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleTransactionAction = (action: string, transaction: POSTransaction) => {
    setSelectedTransaction(transaction);
    trackEvent('POS.TransactionAction', { action, transactionId: transaction.id });
    
    switch (action) {
      case 'edit':
        setIsTransactionModalOpen(true);
        break;
      case 'kot':
        setIsKOTModalOpen(true);
        break;
      case 'receipt':
        setIsReceiptModalOpen(true);
        break;
      case 'bill':
        setIsBillModalOpen(true);
        break;
    }
  };

  const renderPOSTerminal = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">💳 Point of Sale Terminal</h3>
            <div className="flex items-center space-x-2">
              <Badge color="success">Online</Badge>
              <Badge color="primary">Ready</Badge>
              <Badge color="warning">Table 3 Active</Badge>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Menu Categories */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-ghana-black">🍽️ Menu Categories</h4>
              <div className="space-y-2">
                {['Main Course', 'Appetizer', 'Beverage', 'Dessert'].map(category => (
                  <Button
                    key={category}
                    variant="flat"
                    className="w-full justify-start bg-gray-50 hover:bg-gray-100"
                    size="lg"
                  >
                    <span className="text-lg mr-2">
                      {category === 'Main Course' ? '🍖' : 
                       category === 'Appetizer' ? '🥗' : 
                       category === 'Beverage' ? '🥤' : '🍰'}
                    </span>
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-ghana-black">📋 Menu Items</h4>
              <div className="grid grid-cols-2 gap-3">
                {menuItems.map(item => (
                  <Button
                    key={item.id}
                    variant="flat"
                    className="h-20 flex flex-col items-center justify-center bg-ghana-green text-white hover:bg-ghana-green/90"
                    size="lg"
                  >
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs">₵{item.price.toFixed(2)}</div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Current Order */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-ghana-black">🛒 Current Order</h4>
              <div className="bg-gray-50 p-4 rounded-lg min-h-[200px]">
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-2">📝</div>
                  <p>Select items to add to order</p>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="space-y-2">
                <Button
                  color="primary"
                  className="w-full bg-ghana-green text-white"
                  variant="flat"
                  size="lg"
                >
                  💰 Process Payment
                </Button>
                <Button
                  color="secondary"
                  className="w-full bg-ghana-gold text-white"
                  variant="flat"
                  size="lg"
                >
                  📋 Send KOT
                </Button>
                <Button
                  color="success"
                  className="w-full bg-blue-500 text-white"
                  variant="flat"
                  size="lg"
                >
                  🧾 Print Receipt
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderTransactionsTable = () => (
    <div className="space-y-6">
      {/* Filters and Search */}
      <Card className="border-0 shadow-lg">
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search orders, customers, tables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              placeholder="Order Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <SelectItem key="all" value="all">All Statuses</SelectItem>
              <SelectItem key="pending" value="pending">Pending</SelectItem>
              <SelectItem key="preparing" value="preparing">Preparing</SelectItem>
              <SelectItem key="ready" value="ready">Ready</SelectItem>
              <SelectItem key="served" value="served">Served</SelectItem>
              <SelectItem key="cancelled" value="cancelled">Cancelled</SelectItem>
            </Select>
            <Select
              placeholder="Payment Status"
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
            >
              <SelectItem key="all" value="all">All Payments</SelectItem>
              <SelectItem key="pending" value="pending">Pending</SelectItem>
              <SelectItem key="completed" value="completed">Completed</SelectItem>
              <SelectItem key="failed" value="failed">Failed</SelectItem>
              <SelectItem key="refunded" value="refunded">Refunded</SelectItem>
            </Select>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setActiveTab('pos-terminal')}
            >
              💳 Switch to POS
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Transactions Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">📊 POS Transactions</h3>
            <div className="flex items-center space-x-2">
              <Badge color="primary">{filteredTransactions.length} transactions</Badge>
              <Badge color="success">₵{filteredTransactions.reduce((sum, t) => sum + t.total, 0).toFixed(2)} total</Badge>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="POS transactions table">
            <TableHeader>
              <TableColumn>Order Details</TableColumn>
              <TableColumn>Customer & Table</TableColumn>
              <TableColumn>Items & Total</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Payment</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    <div>
                      <div className="font-semibold text-ghana-black">{transaction.orderNumber}</div>
                      <div className="text-sm text-gray-500">{transaction.receiptNumber}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{transaction.customerName}</div>
                      <div className="text-sm text-gray-600">Table {transaction.tableNumber}</div>
                      <div className="text-xs text-gray-500">Server: {transaction.server}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {transaction.items.map(item => (
                        <div key={item.id} className="text-sm">
                          {item.quantity}x {item.name}
                        </div>
                      ))}
                      <div className="font-semibold text-ghana-black mt-2">
                        ₵{transaction.total.toFixed(2)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge 
                        color={
                          transaction.orderStatus === 'served' ? 'success' :
                          transaction.orderStatus === 'ready' ? 'primary' :
                          transaction.orderStatus === 'preparing' ? 'warning' :
                          'default'
                        } 
                        size="sm"
                      >
                        {transaction.orderStatus}
                      </Badge>
                      <Badge 
                        color={
                          transaction.kotStatus === 'completed' ? 'success' :
                          transaction.kotStatus === 'acknowledged' ? 'primary' :
                          transaction.kotStatus === 'sent' ? 'warning' :
                          'default'
                        } 
                        size="sm"
                      >
                        KOT: {transaction.kotStatus}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge 
                        color={
                          transaction.paymentStatus === 'completed' ? 'success' :
                          transaction.paymentStatus === 'pending' ? 'warning' :
                          transaction.paymentStatus === 'failed' ? 'danger' :
                          'default'
                        } 
                        size="sm"
                      >
                        {transaction.paymentStatus}
                      </Badge>
                      <div className="text-xs text-gray-600 capitalize">
                        {transaction.paymentMethod.replace('_', ' ')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        onClick={() => handleTransactionAction('edit', transaction)}
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        color="secondary"
                        onClick={() => handleTransactionAction('kot', transaction)}
                      >
                        📋 KOT
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        color="success"
                        onClick={() => handleTransactionAction('receipt', transaction)}
                      >
                        🧾 Receipt
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        color="warning"
                        onClick={() => handleTransactionAction('bill', transaction)}
                      >
                        💰 Bill
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination
                total={totalPages}
                page={currentPage}
                onChange={setCurrentPage}
                showControls
                color="primary"
              />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">💳 POS Management Dashboard</h1>
          <p className="text-gray-600">Complete POS operations with integrated transaction management and KOT system</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">POS Ready</Badge>
          <Badge color="warning">3 Active Orders</Badge>
        </div>
      </div>

      <Tabs 
        selectedKey={activeTab} 
        onSelectionChange={(key) => setActiveTab(key as string)}
        className="w-full"
      >
        <Tab key="pos-terminal" title="💳 POS Terminal" />
        <Tab key="transactions" title="📊 Transactions" />
      </Tabs>

      <div className="mt-6">
        {activeTab === 'pos-terminal' && renderPOSTerminal()}
        {activeTab === 'transactions' && renderTransactionsTable()}
      </div>

      {/* Transaction Edit Modal */}
      <Modal isOpen={isTransactionModalOpen} onClose={() => setIsTransactionModalOpen(false)} size="4xl">
        <ModalContent>
          <ModalHeader>Edit Transaction - {selectedTransaction?.orderNumber}</ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Transaction edit form will be implemented here</p>
              <p className="text-sm mt-2">Edit order details, items, customer info, etc.</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsTransactionModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsTransactionModalOpen(false)}>
              Update Transaction
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* KOT Modal */}
      <Modal isOpen={isKOTModalOpen} onClose={() => setIsKOTModalOpen(false)} size="3xl">
        <ModalContent>
          <ModalHeader>Kitchen Order Ticket - {selectedTransaction?.orderNumber}</ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>KOT management interface will be implemented here</p>
              <p className="text-sm mt-2">Send to kitchen, track preparation, mark as ready</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsKOTModalOpen(false)}>
              Close
            </Button>
            <Button color="primary" onPress={() => setIsKOTModalOpen(false)}>
              Send KOT
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Print Receipt - {selectedTransaction?.orderNumber}</ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Receipt preview and print options will be implemented here</p>
              <p className="text-sm mt-2">Print, email, or save receipt</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsReceiptModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsReceiptModalOpen(false)}>
              Print Receipt
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Bill Modal */}
      <Modal isOpen={isBillModalOpen} onClose={() => setIsBillModalOpen(false)} size="3xl">
        <ModalContent>
          <ModalHeader>Create Bill - {selectedTransaction?.orderNumber}</ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Bill creation interface will be implemented here</p>
              <p className="text-sm mt-2">Generate detailed bill, add charges, apply discounts</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsBillModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsBillModalOpen(false)}>
              Create Bill
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
