'use client';

import { Autocomplete, AutocompleteItem, Badge, Button, Card, CardBody, CardHeader, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import { PurchaseOrder, StockItem } from '../../lib/inventory/models';
import { SortHeader, deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, toggleColumnSort } from '../dashboard/deskTableUi';
import { sizedTableClassNames } from '../frontoffice/columnResize';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { useInventoryScreen } from './inventoryScreenContext';

/** Inventory → Purchase Orders. Order table. */
export function PurchaseOrdersTable() {
  const inventoryScreen = useInventoryScreen();
  return (
  (
      <div className="space-y-6">
        <Card className={deskTableCardClassName}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Purchase Orders</h3>
              <Button
                color="primary"
                className="bg-ghana-gold text-white"
                variant="flat"
                onPress={inventoryScreen.handleAddPO}
              >
                📋 Create PO
              </Button>
            </div>
          </CardHeader>
          <CardBody className={deskTableCardBodyClassName}>
            {/* Filters and Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Input
                placeholder="Search PO number or supplier..."
                value={inventoryScreen.poSearchTerm}
                onChange={(e) => inventoryScreen.setPOSearchTerm(e.target.value)}
                startContent={<span className="text-gray-400">🔍</span>}
                className="md:col-span-2"
              />
              <Select
                placeholder="Filter by Status"
                selectedKeys={[inventoryScreen.poFilterStatus]}
                onSelectionChange={(keys) => inventoryScreen.setPOFilterStatus(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Status</SelectItem>
                <SelectItem key="draft">Draft</SelectItem>
                <SelectItem key="sent">Sent</SelectItem>
                <SelectItem key="confirmed">Confirmed</SelectItem>
                <SelectItem key="in-transit">In Transit</SelectItem>
                <SelectItem key="delivered">Delivered</SelectItem>
                <SelectItem key="cancelled">Cancelled</SelectItem>
                <SelectItem key="closed">Closed</SelectItem>
              </Select>
            </div>

            <div ref={inventoryScreen.poCols.frameRef} style={inventoryScreen.poCols.frameStyle}>
            <Table aria-label="Purchase orders table" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
              <TableHeader>
                <TableColumn className="relative" style={inventoryScreen.poCols.style('number')}>{<SortHeader label="PO Number" column="number" sort={inventoryScreen.poSort} onSort={(column) => inventoryScreen.setPOSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.poCols.sizer('number', 'PO Number')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.poCols.style('supplier')}>{<SortHeader label="Supplier" column="supplier" sort={inventoryScreen.poSort} onSort={(column) => inventoryScreen.setPOSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.poCols.sizer('supplier', 'Supplier')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.poCols.style('orderDate')}>{<SortHeader label="Order Date" column="orderDate" sort={inventoryScreen.poSort} onSort={(column) => inventoryScreen.setPOSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.poCols.sizer('orderDate', 'Order Date')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.poCols.style('expected')}>{<SortHeader label="Expected" column="expected" sort={inventoryScreen.poSort} onSort={(column) => inventoryScreen.setPOSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.poCols.sizer('expected', 'Expected')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.poCols.style('priority')}>{<SortHeader label="Priority" column="priority" sort={inventoryScreen.poSort} onSort={(column) => inventoryScreen.setPOSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.poCols.sizer('priority', 'Priority')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.poCols.style('amount')}>{<SortHeader label="Amount" column="amount" sort={inventoryScreen.poSort} onSort={(column) => inventoryScreen.setPOSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.poCols.sizer('amount', 'Amount')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.poCols.style('status')}>{<SortHeader label="Status" column="status" sort={inventoryScreen.poSort} onSort={(column) => inventoryScreen.setPOSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.poCols.sizer('status', 'Status')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No purchase orders found.">
                {inventoryScreen.paginatedPOs.map((po) => {
                  const getStatusColor = (status: PurchaseOrder['status']) => {
                    switch (status) {
                      case 'delivered': return 'success';
                      case 'confirmed': case 'in-transit': return 'warning';
                      case 'sent': return 'primary';
                      case 'draft': return 'default';
                      case 'cancelled': return 'danger';
                      case 'closed': return 'secondary';
                      default: return 'default';
                    }
                  };

                  const getPriorityColor = (priority: PurchaseOrder['priority']) => {
                    switch (priority) {
                      case 'urgent': return 'danger';
                      case 'high': return 'warning';
                      case 'medium': return 'primary';
                      case 'low': return 'default';
                      default: return 'default';
                    }
                  };

                  return (
                    <TableRow
                      key={po.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => inventoryScreen.handleViewPO(po)}
                    >
                      <TableCell>
                        <span className="text-gray-600 whitespace-nowrap">{po.poNumber}</span>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold truncate max-w-[200px]" title={po.supplierName}>{po.supplierName}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {po.orderDate instanceof Date ? po.orderDate.toLocaleDateString() : new Date(po.orderDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {po.expectedDeliveryDate instanceof Date 
                          ? po.expectedDeliveryDate.toLocaleDateString() 
                          : new Date(po.expectedDeliveryDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge color={getPriorityColor(po.priority)} size="sm" variant="flat" className="capitalize">
                          {po.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold tabular-nums whitespace-nowrap">
                          ₵{Number(po.finalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge color={getStatusColor(po.status)} size="sm" className="capitalize whitespace-nowrap">
                          {po.status.replace('-', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>

            <div className="mt-3 flex justify-end">
              <Pagination
                total={inventoryScreen.poPages}
                page={inventoryScreen.poPageSafe}
                onChange={inventoryScreen.setPOPage}
                showControls
                size="sm"
              />
            </div>
          </CardBody>
        </Card>
      </div>
    )
  );
}

/** Inventory → Purchase Orders. Create, view, and void an order. */
export function PurchaseOrderModals() {
  const inventoryScreen = useInventoryScreen();
  return (
  <>
        {/* Purchase Order Modals */}
        <Modal isOpen={inventoryScreen.isPOModalOpen} onClose={inventoryScreen.onPOModalClose} size="5xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              {inventoryScreen.editingPO ? 'Edit Purchase Order' : 'Create Purchase Order'}
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="PO Number"
                    value={inventoryScreen.poFormData.poNumber || ''}
                    isReadOnly
                    description="Auto from Settings → Document Numbering → Purchase Order"
                    classNames={{ input: 'font-mono font-semibold' }}
                  />
                  <Select
                    label="Supplier"
                    placeholder="Select Supplier"
                    selectedKeys={inventoryScreen.poFormData.supplierId ? [inventoryScreen.poFormData.supplierId] : []}
                    onSelectionChange={(keys) => inventoryScreen.handlePOSupplierChange(Array.from(keys)[0] as string)}
                    isRequired
                  >
                    {inventoryScreen.mergedSuppliers.filter(s => s.isActive).map(supplier => (
                      <SelectItem key={supplier.id}>{supplier.name}</SelectItem>
                    ))}
                  </Select>
                  <Input
                    label="Order Date"
                    type="date"
                    value={inventoryScreen.poFormData.orderDate instanceof Date 
                      ? inventoryScreen.poFormData.orderDate.toISOString().split('T')[0]
                      : inventoryScreen.poFormData.orderDate 
                        ? new Date(inventoryScreen.poFormData.orderDate).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0]}
                    onChange={(e) => inventoryScreen.setPOFormData({ 
                      ...inventoryScreen.poFormData, 
                      orderDate: new Date(e.target.value) 
                    })}
                    isRequired
                  />
                  <Input
                    label="Expected Delivery Date"
                    type="date"
                    value={inventoryScreen.poFormData.expectedDeliveryDate instanceof Date
                      ? inventoryScreen.poFormData.expectedDeliveryDate.toISOString().split('T')[0]
                      : inventoryScreen.poFormData.expectedDeliveryDate
                        ? new Date(inventoryScreen.poFormData.expectedDeliveryDate).toISOString().split('T')[0]
                        : ''}
                    onChange={(e) => inventoryScreen.setPOFormData({ 
                      ...inventoryScreen.poFormData, 
                      expectedDeliveryDate: new Date(e.target.value) 
                    })}
                    isRequired
                  />
                  <Select
                    label="Priority"
                    selectedKeys={inventoryScreen.poFormData.priority ? [inventoryScreen.poFormData.priority] : ['medium']}
                    onSelectionChange={(keys) => inventoryScreen.setPOFormData({ 
                      ...inventoryScreen.poFormData, 
                      priority: Array.from(keys)[0] as PurchaseOrder['priority'] 
                    })}
                  >
                    <SelectItem key="low">Low</SelectItem>
                    <SelectItem key="medium">Medium</SelectItem>
                    <SelectItem key="high">High</SelectItem>
                    <SelectItem key="urgent">Urgent</SelectItem>
                  </Select>
                  <Select
                    label="Payment Terms"
                    selectedKeys={inventoryScreen.poFormData.paymentTerms ? [inventoryScreen.poFormData.paymentTerms] : ['net30']}
                    onSelectionChange={(keys) => inventoryScreen.setPOFormData({ 
                      ...inventoryScreen.poFormData, 
                      paymentTerms: Array.from(keys)[0] as string 
                    })}
                  >
                    <SelectItem key="immediate">Immediate</SelectItem>
                    <SelectItem key="net30">Net 30</SelectItem>
                    <SelectItem key="net60">Net 60</SelectItem>
                    <SelectItem key="net90">Net 90</SelectItem>
                  </Select>
                </div>

                <Divider />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Items</h4>
                    <Button size="sm" color="primary" onPress={inventoryScreen.handleAddPOItem}>
                      + Add Item
                    </Button>
                  </div>
                  {(inventoryScreen.poFormData.items || []).length > 0 ? (
                    <Table aria-label="PO Items" className="[&_thead]:hidden">
                      <TableHeader>
                        <TableColumn>Item</TableColumn>
                        <TableColumn>Quantity</TableColumn>
                        <TableColumn>Unit Cost</TableColumn>
                        <TableColumn>Total</TableColumn>
                        <TableColumn>Action</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {(inventoryScreen.poFormData.items || []).map((item, index) => {
                          const filteredItems = inventoryScreen.getFilteredPOItemsForIndex(index);
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="w-[40%]">
                                <Autocomplete
                                  placeholder="🔍 Search item by code or name..."
                                  selectedKey={item.itemCode || undefined}
                                  defaultSelectedKey={item.itemCode || undefined}
                                  onSelectionChange={(key) => {
                                    if (key) {
                                      inventoryScreen.handlePOItemChange(String(key), index);
                                    } else {
                                      // Clear item when selection is cleared
                                      inventoryScreen.handleUpdatePOItem(item.id, {
                                        itemId: '',
                                        itemCode: '',
                                        itemName: '',
                                        unitCost: 0,
                                        totalCost: 0
                                      });
                                      inventoryScreen.setPOItemSearchTerms((prev: Record<number, string>) => {
                                        const updated = { ...prev };
                                        delete updated[index];
                                        return updated;
                                      });
                                    }
                                  }}
                                  onInputChange={(value) => {
                                    // Always allow search, update search term
                                    inventoryScreen.setPOItemSearchTerms((prev: Record<number, string>) => ({ ...prev, [index]: value }));
                                  }}
                                  inputValue={
                                    // If user is actively searching (has search term), show search term
                                    // Otherwise, if item is selected, show the selected item
                                    inventoryScreen.poItemSearchTerms[index] !== undefined
                                      ? inventoryScreen.poItemSearchTerms[index]
                                      : item.itemCode
                                        ? `${item.itemCode} - ${item.itemName}`
                                        : ''
                                  }
                                  size="sm"
                                  allowsCustomValue={false}
                                  allowsEmptyCollection={false}
                                >
                                  <>
                                    {filteredItems.map((stockItem: StockItem) => (
                                      <AutocompleteItem 
                                        key={stockItem.itemCode} 
                                        textValue={`${stockItem.itemCode} ${stockItem.name}`}
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-semibold">{stockItem.itemCode}</span>
                                          <span className="text-sm text-gray-500">{stockItem.name}</span>
                                        </div>
                                      </AutocompleteItem>
                                    ))}
                                  </>
                                </Autocomplete>
                              </TableCell>
                              <TableCell className="w-[15%]">
                                <Input
                                  type="number"
                                  value={String(item.quantity)}
                                  onChange={(e) => inventoryScreen.handleUpdatePOItem(item.id, { 
                                    quantity: parseInt(e.target.value) || 0 
                                  })}
                                  size="sm"
                                  min="1"
                                  placeholder="Qty"
                                />
                              </TableCell>
                              <TableCell className="w-[20%]">
                                <Input
                                  type="number"
                                  value={String(item.unitCost)}
                                  onChange={(e) => inventoryScreen.handleUpdatePOItem(item.id, { 
                                    unitCost: parseFloat(e.target.value) || 0 
                                  })}
                                  size="sm"
                                  startContent="₵"
                                  placeholder="Cost"
                                />
                              </TableCell>
                              <TableCell className="text-right font-semibold w-[15%]">
                                ₵{item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="w-[10%]">
                                <Button 
                                  size="sm" 
                                  color="danger" 
                                  variant="flat"
                                  onPress={() => inventoryScreen.handleRemovePOItem(item.id)}
                                >
                                  🗑️
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No items added. Click "Add Item" to add items to this purchase order.
                    </div>
                  )}
                </div>

                <Divider />

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Tax Type"
                    selectedKeys={inventoryScreen.poFormData.taxType ? [inventoryScreen.poFormData.taxType] : ['none']}
                    onSelectionChange={(keys) => {
                      const selectedTaxType = Array.from(keys)[0] as string;
                      inventoryScreen.setPOFormData({
                        ...inventoryScreen.poFormData,
                        taxType: selectedTaxType,
                        // Only 'custom' has a rate to type in — a real Tax Type's
                        // amount comes from its assigned rules, not one percentage.
                        taxRate: selectedTaxType === 'custom' ? (inventoryScreen.poFormData.taxRate || 0) : 0
                      });
                    }}
                  >
                    <>
                      {inventoryScreen.taxOptions.map(option => (
                        <SelectItem key={option.value}>{option.label}</SelectItem>
                      ))}
                    </>
                  </Select>
                  {inventoryScreen.poFormData.taxType === 'custom' && (
                    <Input
                      label="Custom Tax Rate (%)"
                      type="number"
                      value={String(inventoryScreen.poFormData.taxRate || 0)}
                      onChange={(e) => inventoryScreen.setPOFormData({
                        ...inventoryScreen.poFormData,
                        taxRate: parseFloat(e.target.value) || 0
                      })}
                      endContent="%"
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Discount Amount"
                    type="number"
                    value={String(inventoryScreen.poFormData.discountAmount || 0)}
                    onChange={(e) => inventoryScreen.setPOFormData({
                      ...inventoryScreen.poFormData,
                      discountAmount: parseFloat(e.target.value) || 0
                    })}
                    startContent="₵"
                  />
                  <Input
                    label="Shipping Amount"
                    type="number"
                    value={String(inventoryScreen.poFormData.shippingAmount || 0)}
                    onChange={(e) => inventoryScreen.setPOFormData({
                      ...inventoryScreen.poFormData,
                      shippingAmount: parseFloat(e.target.value) || 0
                    })}
                    startContent="₵"
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Subtotal:</span>
                    <span className="font-semibold">
                      ₵{((inventoryScreen.poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {inventoryScreen.poFormData.taxType && inventoryScreen.poFormData.taxType !== 'none' && (() => {
                    const itemsTotal = (inventoryScreen.poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0);
                    const lines = inventoryScreen.computePOTaxLines(itemsTotal, inventoryScreen.poFormData.taxType, inventoryScreen.poFormData.taxRate || 0);
                    return lines.map((line, idx) => (
                      <div key={idx} className="flex justify-between mb-2 text-sm">
                        <span>{line.amount < 0 ? `${line.name} (withheld)` : line.name}:</span>
                        <span>
                          {line.amount < 0 ? '-' : ''}₵{Math.abs(line.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ));
                  })()}
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Shipping:</span>
                    <span>
                      ₵{(inventoryScreen.poFormData.shippingAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Discount:</span>
                    <span>
                      -₵{(inventoryScreen.poFormData.discountAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <Divider className="my-2" />
                  <div className="flex justify-between">
                    <span className="text-lg font-bold">Total Amount:</span>
                    <span className="text-lg font-bold">
                      ₵{(() => {
                        const itemsTotal = (inventoryScreen.poFormData.items || []).reduce((sum, item) => sum + item.totalCost, 0);
                        const taxAmount = inventoryScreen.computePOTax(itemsTotal, inventoryScreen.poFormData.taxType, inventoryScreen.poFormData.taxRate || 0);
                        const total = itemsTotal + taxAmount + (inventoryScreen.poFormData.shippingAmount || 0) - (inventoryScreen.poFormData.discountAmount || 0);
                        return total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()}
                    </span>
                  </div>
                </div>

                <Textarea
                  label="Notes"
                  value={inventoryScreen.poFormData.notes || ''}
                  onChange={(e) => inventoryScreen.setPOFormData({ ...inventoryScreen.poFormData, notes: e.target.value })}
                  placeholder="Additional notes or instructions..."
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="bordered" onPress={inventoryScreen.onPOModalClose}>Cancel</Button>
              <Button 
                variant="flat" 
                color="secondary" 
                onPress={inventoryScreen.handleGeneratePOPDF}
                startContent={<span>📄</span>}
              >
                PDF
              </Button>
              <Button color="primary" onPress={inventoryScreen.handleSavePO}>
                {inventoryScreen.editingPO ? 'Update' : 'Create'} Purchase Order
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* PO View Modal */}
        <Modal isOpen={inventoryScreen.isPOViewOpen} onClose={inventoryScreen.onPOViewClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              Purchase Order Details — {inventoryScreen.viewingPO?.poNumber}
              <span className="block text-sm font-normal text-slate-500 mt-1">
                Review the order, then send, confirm, or edit from here.
              </span>
            </ModalHeader>
            <ModalBody>
              {inventoryScreen.viewingPO && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">PO Number</div>
                      <div className="font-semibold font-mono">{inventoryScreen.viewingPO.poNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Status</div>
                      <Badge color={
                        inventoryScreen.viewingPO.status === 'delivered' ? 'success' :
                        inventoryScreen.viewingPO.status === 'confirmed' || inventoryScreen.viewingPO.status === 'in-transit' ? 'warning' :
                        inventoryScreen.viewingPO.status === 'sent' ? 'primary' :
                        inventoryScreen.viewingPO.status === 'draft' ? 'default' :
                        inventoryScreen.viewingPO.status === 'cancelled' ? 'danger' : 'secondary'
                      }>
                        {inventoryScreen.viewingPO.status.replace('-', ' ')}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Supplier</div>
                      <div className="font-semibold">{inventoryScreen.viewingPO.supplierName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Priority</div>
                      <Badge color={
                        inventoryScreen.viewingPO.priority === 'urgent' ? 'danger' :
                        inventoryScreen.viewingPO.priority === 'high' ? 'warning' :
                        inventoryScreen.viewingPO.priority === 'medium' ? 'primary' : 'default'
                      } variant="flat">
                        {inventoryScreen.viewingPO.priority}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Order Date</div>
                      <div>
                        {inventoryScreen.viewingPO.orderDate instanceof Date 
                          ? inventoryScreen.viewingPO.orderDate.toLocaleDateString()
                          : new Date(inventoryScreen.viewingPO.orderDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Expected Delivery</div>
                      <div>
                        {inventoryScreen.viewingPO.expectedDeliveryDate instanceof Date
                          ? inventoryScreen.viewingPO.expectedDeliveryDate.toLocaleDateString()
                          : new Date(inventoryScreen.viewingPO.expectedDeliveryDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <Divider />

                  <div>
                    <h4 className="font-semibold mb-2">Items</h4>
                    <Table>
                      <TableHeader>
                        <TableColumn>Item Code</TableColumn>
                        <TableColumn>Item Name</TableColumn>
                        <TableColumn>Quantity</TableColumn>
                        <TableColumn>Unit Cost</TableColumn>
                        <TableColumn className="text-right">Total</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {inventoryScreen.viewingPO.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.itemCode}</TableCell>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>₵{item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right font-semibold">
                              ₵{item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Divider />

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span className="font-semibold">Subtotal:</span>
                      <span className="font-semibold">₵{inventoryScreen.viewingPO.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {inventoryScreen.viewingPO.taxAmount !== 0 && (() => {
                      // Real Tax Types are a bundle of rules — show each one (NHIL,
                      // GETFund, VAT, etc.) separately, re-derived live from the current
                      // rules (rates may have changed in Settings since this PO was
                      // saved). 'custom' and legacy records have no rules to re-derive,
                      // so those fall back to the one persisted signed amount.
                      const lines = inventoryScreen.viewingPO.taxTypeId && inventoryScreen.viewingPO.taxTypeId !== 'custom'
                        ? inventoryScreen.computePOTaxLines(inventoryScreen.viewingPO.totalAmount, inventoryScreen.viewingPO.taxTypeId, 0)
                        : [];
                      if (lines.length > 0) {
                        return lines.map((line, idx) => (
                          <div key={idx} className="flex justify-between mb-2 text-sm">
                            <span>{line.amount < 0 ? `${line.name} (withheld)` : line.name}:</span>
                            <span>{line.amount < 0 ? '-' : ''}₵{Math.abs(line.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        ));
                      }
                      const rate = inventoryScreen.viewingPO.totalAmount > 0 ? Math.abs((inventoryScreen.viewingPO.taxAmount / inventoryScreen.viewingPO.totalAmount) * 100) : 0;
                      const isWithheld = inventoryScreen.viewingPO.taxAmount < 0;
                      return (
                        <div className="flex justify-between mb-2 text-sm">
                          <span>{isWithheld ? 'Withholding' : 'Tax'} ({rate.toFixed(1)}%):</span>
                          <span>{isWithheld ? '-' : ''}₵{Math.abs(inventoryScreen.viewingPO.taxAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      );
                    })()}
                    <div className="flex justify-between mb-2 text-sm">
                      <span>Shipping:</span>
                      <span>₵{inventoryScreen.viewingPO.shippingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {inventoryScreen.viewingPO.discountAmount > 0 && (
                      <div className="flex justify-between mb-2 text-sm">
                        <span>Discount:</span>
                        <span>-₵{inventoryScreen.viewingPO.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <Divider className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">Total Amount:</span>
                      <span className="text-lg font-bold">₵{inventoryScreen.viewingPO.finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {inventoryScreen.viewingPO.notes && (
                    <>
                      <Divider />
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Notes</div>
                        <div className="text-sm">{inventoryScreen.viewingPO.notes}</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex flex-wrap gap-2">
              <Button variant="bordered" onPress={inventoryScreen.onPOViewClose}>Close</Button>
              {inventoryScreen.viewingPO && inventoryScreen.viewingPO.status === 'draft' && (
                <Button color="warning" variant="flat" onPress={() => {
                  inventoryScreen.onPOViewClose();
                  inventoryScreen.handleEditPO(inventoryScreen.viewingPO);
                }}>
                  ✏️ Edit
                </Button>
              )}
              {inventoryScreen.viewingPO && inventoryScreen.viewingPO.status === 'draft' && (
                <Button color="success" onPress={() => {
                  inventoryScreen.sendPurchaseOrder(inventoryScreen.viewingPO.id);
                  trackEvent('Stores.Issued', { action: 'send_po', poNumber: inventoryScreen.viewingPO.poNumber });
                  inventoryScreen.setViewingPO({ ...inventoryScreen.viewingPO, status: 'sent' });
                }}>
                  📤 Send to Supplier
                </Button>
              )}
              {inventoryScreen.viewingPO && inventoryScreen.viewingPO.status === 'sent' && (
                <Button color="success" onPress={() => {
                  inventoryScreen.confirmPurchaseOrder(inventoryScreen.viewingPO.id, inventoryScreen.viewingPO.supplierId);
                  trackEvent('Stores.Issued', { action: 'confirm_po', poNumber: inventoryScreen.viewingPO.poNumber });
                  inventoryScreen.setViewingPO({ ...inventoryScreen.viewingPO, status: 'confirmed' });
                }}>
                  ✓ Confirm
                </Button>
              )}
              {inventoryScreen.viewingPO && (inventoryScreen.viewingPO.status === 'confirmed' || inventoryScreen.viewingPO.status === 'sent') && (
                <Button color="warning" variant="flat" onPress={() => {
                  inventoryScreen.markInTransit(inventoryScreen.viewingPO.id);
                  trackEvent('Stores.Issued', { action: 'mark_in_transit_po', poNumber: inventoryScreen.viewingPO.poNumber });
                  inventoryScreen.setViewingPO({ ...inventoryScreen.viewingPO, status: 'in-transit' });
                }}>
                  🚚 Mark In Transit
                </Button>
              )}
              {inventoryScreen.viewingPO && (inventoryScreen.viewingPO.status === 'in-transit' || inventoryScreen.viewingPO.status === 'confirmed') && (
                <Button color="success" onPress={() => {
                  inventoryScreen.markDelivered(inventoryScreen.viewingPO.id, new Date());
                  trackEvent('Stores.Issued', { action: 'mark_delivered_po', poNumber: inventoryScreen.viewingPO.poNumber });
                  inventoryScreen.setViewingPO({ ...inventoryScreen.viewingPO, status: 'delivered' });
                }}>
                  ✅ Mark Delivered
                </Button>
              )}
              {inventoryScreen.viewingPO && inventoryScreen.viewingPO.status === 'draft' && (
                <Button color="danger" variant="light" onPress={async () => {
                  const { confirmDelete } = await import('../DangerConfirm');
                  if (!(await confirmDelete(inventoryScreen.viewingPO.poNumber, 'This draft purchase order will be permanently removed.'))) return;
                  inventoryScreen.deletePurchaseOrder(inventoryScreen.viewingPO.id);
                  trackEvent('Stores.Issued', { action: 'delete_po', poNumber: inventoryScreen.viewingPO.poNumber });
                  inventoryScreen.onPOViewClose();
                }}>
                  Delete
                </Button>
              )}
              {inventoryScreen.viewingPO && inventoryScreen.viewingPO.status !== 'draft' && inventoryScreen.viewingPO.status !== 'cancelled' && inventoryScreen.viewingPO.status !== 'delivered' && (
                <Button color="warning" variant="flat" onPress={async () => {
                  const { confirmVoid } = await import('../DangerConfirm');
                  if (!(await confirmVoid(inventoryScreen.viewingPO.poNumber, 'The order stays on file as cancelled. It was never fully received.'))) return;
                  inventoryScreen.cancelPurchaseOrder(inventoryScreen.viewingPO.id, 'Void');
                  trackEvent('Stores.Issued', { action: 'void_po', poNumber: inventoryScreen.viewingPO.poNumber });
                  inventoryScreen.setViewingPO({ ...inventoryScreen.viewingPO, status: 'cancelled' });
                }}>
                  Void
                </Button>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}
