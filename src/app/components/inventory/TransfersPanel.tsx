'use client';

import { Autocomplete, AutocompleteItem, Badge, Button, Card, CardBody, CardHeader, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import { DESK_PAGE_SIZE, SortHeader, deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, toggleColumnSort } from '../dashboard/deskTableUi';
import { StockItem, StockTransferItem } from '../../lib/inventory/models';
import { sizedTableClassNames } from '../frontoffice/columnResize';
import { useInventoryScreen } from './inventoryScreenContext';
import PostingDateField from '../shared/PostingDateField';

/** Inventory → Transfers. Transfer list. */
export function TransfersTable() {
  const inventoryScreen = useInventoryScreen();
  const filtered = inventoryScreen.stockTransfers.filter((t) =>
    (inventoryScreen.stockTransferSearchTerm === '' ||
      t.transferNumber.toLowerCase().includes(inventoryScreen.stockTransferSearchTerm.toLowerCase()) ||
      t.fromLocation.toLowerCase().includes(inventoryScreen.stockTransferSearchTerm.toLowerCase()) ||
      t.toLocation.toLowerCase().includes(inventoryScreen.stockTransferSearchTerm.toLowerCase())) &&
    (inventoryScreen.stockTransferFilterStatus === 'all' || t.status === inventoryScreen.stockTransferFilterStatus)
  );
  const dir = inventoryScreen.transferSort.direction === 'asc' ? 1 : -1;
  const ms = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();
  const sorted = [...filtered].sort((a, b) => {
    switch (inventoryScreen.transferSort.column) {
      case 'from': return a.fromLocation.localeCompare(b.fromLocation) * dir;
      case 'to': return a.toLocation.localeCompare(b.toLocation) * dir;
      case 'date': return (ms(a.transferDate) - ms(b.transferDate)) * dir;
      case 'items': return (a.items.length - b.items.length) * dir;
      case 'status': return a.status.localeCompare(b.status) * dir;
      case 'number':
      default: return a.transferNumber.localeCompare(b.transferNumber) * dir;
    }
  });
  const pages = Math.max(1, Math.ceil(sorted.length / DESK_PAGE_SIZE));
  const pageSafe = Math.min(inventoryScreen.transferPage, pages);
  const paged = sorted.slice((pageSafe - 1) * DESK_PAGE_SIZE, pageSafe * DESK_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <Card className={deskTableCardClassName}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="text-xl font-semibold text-ghana-black">🔄 Stock Transfers</h3>
              <p className="text-sm text-gray-500">Move stock between locations</p>
            </div>
            <Button color="primary" className="bg-ghana-green text-white" variant="flat" onPress={inventoryScreen.handleAddStockTransfer}>
              + New Transfer
            </Button>
          </div>
        </CardHeader>
        <CardBody className={deskTableCardBodyClassName}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Input
              placeholder="Search transfer # or location..."
              value={inventoryScreen.stockTransferSearchTerm}
              onChange={(e) => { inventoryScreen.setStockTransferSearchTerm(e.target.value); inventoryScreen.setTransferPage(1); }}
              startContent={<span className="text-gray-400">🔍</span>}
              className="md:col-span-2"
            />
            <Select
              placeholder="Filter by Status"
              selectedKeys={[inventoryScreen.stockTransferFilterStatus]}
              onSelectionChange={(keys) => { inventoryScreen.setStockTransferFilterStatus(Array.from(keys)[0] as string); inventoryScreen.setTransferPage(1); }}
            >
              <SelectItem key="all">All Status</SelectItem>
              <SelectItem key="pending">Pending</SelectItem>
              <SelectItem key="in-transit">In Transit</SelectItem>
              <SelectItem key="delivered">Delivered</SelectItem>
              <SelectItem key="cancelled">Cancelled</SelectItem>
            </Select>
          </div>
          <div ref={inventoryScreen.transferCols.frameRef} style={inventoryScreen.transferCols.frameStyle}>
          <Table aria-label="Stock transfers" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
            <TableHeader>
              <TableColumn className="relative" style={inventoryScreen.transferCols.style('number')}>{<SortHeader label="Transfer #" column="number" sort={inventoryScreen.transferSort} onSort={(column) => inventoryScreen.setTransferSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.transferCols.sizer('number', 'Transfer #')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.transferCols.style('from')}>{<SortHeader label="From" column="from" sort={inventoryScreen.transferSort} onSort={(column) => inventoryScreen.setTransferSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.transferCols.sizer('from', 'From')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.transferCols.style('to')}>{<SortHeader label="To" column="to" sort={inventoryScreen.transferSort} onSort={(column) => inventoryScreen.setTransferSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.transferCols.sizer('to', 'To')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.transferCols.style('date')}>{<SortHeader label="Date" column="date" sort={inventoryScreen.transferSort} onSort={(column) => inventoryScreen.setTransferSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.transferCols.sizer('date', 'Date')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.transferCols.style('items')}>{<SortHeader label="Items" column="items" sort={inventoryScreen.transferSort} onSort={(column) => inventoryScreen.setTransferSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.transferCols.sizer('items', 'Items')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.transferCols.style('status')}>{<SortHeader label="Status" column="status" sort={inventoryScreen.transferSort} onSort={(column) => inventoryScreen.setTransferSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.transferCols.sizer('status', 'Status')}</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No stock transfers yet. Create one to move stock between locations.">
              {paged.map((transfer) => (
                <TableRow
                  key={transfer.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    inventoryScreen.setViewingStockTransfer(transfer);
                    inventoryScreen.onStockTransferViewOpen();
                  }}
                >
                  <TableCell>
                    <span className="text-gray-600 whitespace-nowrap">{transfer.transferNumber}</span>
                  </TableCell>
                  <TableCell className="truncate max-w-[140px]" title={transfer.fromLocation}>{transfer.fromLocation}</TableCell>
                  <TableCell className="truncate max-w-[140px]" title={transfer.toLocation}>{transfer.toLocation}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {transfer.transferDate instanceof Date ? transfer.transferDate.toLocaleDateString() : new Date(transfer.transferDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <span className="block text-right tabular-nums">{transfer.items.length}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      color={
                        transfer.status === 'delivered' ? 'success' :
                        transfer.status === 'in-transit' ? 'warning' :
                        transfer.status === 'cancelled' ? 'danger' : 'default'
                      }
                      size="sm"
                      variant="flat"
                      className="capitalize"
                    >
                      {transfer.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={pageSafe} total={pages} onChange={inventoryScreen.setTransferPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/** Inventory → Transfers. Create or edit a transfer. */
export function StockTransferModal() {
  const inventoryScreen = useInventoryScreen();
  return (
  <>
        {/* Stock Transfer Modal */}
        <Modal isOpen={inventoryScreen.isStockTransferOpen} onClose={inventoryScreen.onStockTransferClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              {inventoryScreen.editingStockTransfer ? 'Edit Stock Transfer' : 'Create Stock Transfer'}
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Transfer #"
                    value={inventoryScreen.stockTransferFormData.transferNumber || ''}
                    isReadOnly
                    description="Auto from Settings → Document Numbering → Stock Transfer"
                    classNames={{ input: 'font-mono font-semibold' }}
                  />
                  <Select
                    label="Priority"
                    selectedKeys={inventoryScreen.stockTransferFormData.priority ? [inventoryScreen.stockTransferFormData.priority] : ['medium']}
                    onSelectionChange={(keys) => inventoryScreen.setStockTransferFormData({ 
                      ...inventoryScreen.stockTransferFormData, 
                      priority: Array.from(keys)[0] as 'low' | 'medium' | 'high' | 'urgent'
                    })}
                  >
                    <SelectItem key="low">Low</SelectItem>
                    <SelectItem key="medium">Medium</SelectItem>
                    <SelectItem key="high">High</SelectItem>
                    <SelectItem key="urgent">Urgent</SelectItem>
                  </Select>
                  <Select
                    label="From Location"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={inventoryScreen.stockTransferFormData.fromLocation ? new Set([inventoryScreen.stockTransferFormData.fromLocation]) : new Set()}
                    onSelectionChange={(keys) => {
                      if (keys === 'all') return;
                      const loc = Array.from(keys)[0] as string | undefined;
                      if (!loc) return;
                      inventoryScreen.setStockTransferFormData({
                        ...inventoryScreen.stockTransferFormData,
                        fromLocation: loc,
                      });
                    }}
                    isRequired
                  >
                    {inventoryScreen.availableLocations.map((loc) => (
                      <SelectItem key={loc} textValue={loc}>{loc}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="To Location"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={inventoryScreen.stockTransferFormData.toLocation ? new Set([inventoryScreen.stockTransferFormData.toLocation]) : new Set()}
                    onSelectionChange={(keys) => {
                      if (keys === 'all') return;
                      const loc = Array.from(keys)[0] as string | undefined;
                      if (!loc) return;
                      inventoryScreen.setStockTransferFormData({
                        ...inventoryScreen.stockTransferFormData,
                        toLocation: loc,
                      });
                    }}
                    isRequired
                  >
                    {inventoryScreen.availableLocations.map((loc) => (
                      <SelectItem key={loc} textValue={loc}>{loc}</SelectItem>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <PostingDateField
                    label="Transfer Date"
                    type="date"
                    value={inventoryScreen.stockTransferFormData.transferDate instanceof Date 
                      ? inventoryScreen.stockTransferFormData.transferDate.toISOString().split('T')[0]
                      : inventoryScreen.stockTransferFormData.transferDate 
                        ? new Date(inventoryScreen.stockTransferFormData.transferDate).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0]}
                    onChange={(e) => inventoryScreen.setStockTransferFormData({ 
                      ...inventoryScreen.stockTransferFormData, 
                      transferDate: new Date(e.target.value) 
                    })}
                  />
                  <Input
                    label="Expected Delivery Date"
                    type="date"
                    value={inventoryScreen.stockTransferFormData.expectedDeliveryDate instanceof Date 
                      ? inventoryScreen.stockTransferFormData.expectedDeliveryDate.toISOString().split('T')[0]
                      : inventoryScreen.stockTransferFormData.expectedDeliveryDate 
                        ? new Date(inventoryScreen.stockTransferFormData.expectedDeliveryDate).toISOString().split('T')[0]
                        : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    onChange={(e) => inventoryScreen.setStockTransferFormData({ 
                      ...inventoryScreen.stockTransferFormData, 
                      expectedDeliveryDate: new Date(e.target.value) 
                    })}
                  />
                </div>

                <Divider />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Transfer Items</h4>
                    <Button
                      size="sm"
                      color="primary"
                      isDisabled={!inventoryScreen.stockTransferFormData.fromLocation}
                      onPress={() => {
                        const newItem: StockTransferItem = {
                          id: Date.now().toString(),
                          itemId: '',
                          itemCode: '',
                          itemName: '',
                          quantity: 1,
                          unitCost: 0,
                          totalValue: 0,
                          transferredQuantity: 0
                        };
                        inventoryScreen.setStockTransferFormData({
                          ...inventoryScreen.stockTransferFormData,
                          items: [...(inventoryScreen.stockTransferFormData.items || []), newItem]
                        });
                      }}
                    >
                      + Add Item
                    </Button>
                  </div>
                  {!inventoryScreen.stockTransferFormData.fromLocation && (
                    <p className="text-sm text-amber-600 mb-2">Select a From location before adding items.</p>
                  )}
                  {inventoryScreen.stockTransferFormData.items && inventoryScreen.stockTransferFormData.items.length > 0 ? (
                    <Table className="[&_thead]:hidden">
                      <TableHeader>
                        <TableColumn>Item</TableColumn>
                        <TableColumn>Quantity</TableColumn>
                        <TableColumn>Unit Cost</TableColumn>
                        <TableColumn>Total</TableColumn>
                        <TableColumn>Action</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {inventoryScreen.stockTransferFormData.items.map((item, index) => {
                          const filtered = inventoryScreen.getFilteredTransferItems(index);
                          return (
                          <TableRow key={item.id}>
                            <TableCell className="w-[40%]">
                              <Autocomplete
                                placeholder="🔍 Search item at from location..."
                                selectedKey={item.itemCode || undefined}
                                onSelectionChange={(key) => {
                                  if (key && inventoryScreen.stockTransferFormData.fromLocation) {
                                    const selectedItem = inventoryScreen.stockItems.find(i => 
                                      i.itemCode === String(key) && i.location === inventoryScreen.stockTransferFormData.fromLocation
                                    );
                                    if (selectedItem) {
                                      const updatedItems = [...(inventoryScreen.stockTransferFormData.items || [])];
                                      const qty = item.quantity || 1;
                                      updatedItems[index] = {
                                        ...item,
                                        itemId: selectedItem.id,
                                        itemCode: selectedItem.itemCode,
                                        itemName: selectedItem.name,
                                        unitCost: selectedItem.unitCost,
                                        quantity: qty,
                                        totalValue: qty * selectedItem.unitCost
                                      };
                                      inventoryScreen.setStockTransferFormData({ ...inventoryScreen.stockTransferFormData, items: updatedItems });
                                      inventoryScreen.setTransferItemSearchTerms((prev) => {
                                        const next = { ...prev };
                                        delete next[index];
                                        return next;
                                      });
                                    }
                                  }
                                }}
                                onInputChange={(value) => {
                                  inventoryScreen.setTransferItemSearchTerms((prev) => ({ ...prev, [index]: value }));
                                }}
                                inputValue={
                                  inventoryScreen.transferItemSearchTerms[index] !== undefined
                                    ? inventoryScreen.transferItemSearchTerms[index]
                                    : item.itemCode
                                      ? `${item.itemCode} - ${item.itemName}`
                                      : ''
                                }
                                size="sm"
                                allowsCustomValue={false}
                              >
                                <>
                                  {filtered.map((stockItem: StockItem) => (
                                    <AutocompleteItem key={stockItem.itemCode} textValue={`${stockItem.itemCode} ${stockItem.name}`}>
                                      <div className="flex flex-col">
                                        <span className="font-semibold">{stockItem.itemCode}</span>
                                        <span className="text-sm text-gray-500">{stockItem.name} · {stockItem.currentStock} {stockItem.unit}</span>
                                      </div>
                                    </AutocompleteItem>
                                  ))}
                                </>
                              </Autocomplete>
                            </TableCell>
                            <TableCell className="w-[20%]">
                              <Input
                                type="number"
                                value={String(item.quantity)}
                                onChange={(e) => {
                                  const updatedItems = [...(inventoryScreen.stockTransferFormData.items || [])];
                                  updatedItems[index] = {
                                    ...item,
                                    quantity: parseInt(e.target.value) || 0
                                  };
                                  updatedItems[index].totalValue = updatedItems[index].quantity * updatedItems[index].unitCost;
                                  inventoryScreen.setStockTransferFormData({ ...inventoryScreen.stockTransferFormData, items: updatedItems });
                                }}
                                size="sm"
                                min="1"
                                placeholder="Qty"
                              />
                            </TableCell>
                            <TableCell className="w-[20%]">
                              <Input
                                type="number"
                                value={String(item.unitCost)}
                                readOnly
                                size="sm"
                                startContent="₵"
                              />
                            </TableCell>
                            <TableCell className="w-[15%]">
                              <div className="text-right font-semibold">
                                ₵{item.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </TableCell>
                            <TableCell className="w-[5%]">
                              <Button
                                size="sm"
                                color="danger"
                                variant="flat"
                                onPress={() => {
                                  const updatedItems = (inventoryScreen.stockTransferFormData.items || []).filter((_, i) => i !== index);
                                  inventoryScreen.setStockTransferFormData({ ...inventoryScreen.stockTransferFormData, items: updatedItems });
                                }}
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
                      No items yet — select From location, then add lines.
                    </div>
                  )}
                </div>

                <Textarea
                  label="Notes"
                  value={inventoryScreen.stockTransferFormData.notes || ''}
                  onChange={(e) => inventoryScreen.setStockTransferFormData({ ...inventoryScreen.stockTransferFormData, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="bordered" onPress={inventoryScreen.onStockTransferClose}>Cancel</Button>
              <Button color="primary" className="bg-ghana-green text-white" onPress={inventoryScreen.handleSaveStockTransfer}>
                {inventoryScreen.editingStockTransfer ? 'Update' : 'Create'} Transfer
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}

/** Inventory → Transfers. View a transfer. */
export function StockTransferViewModal() {
  const inventoryScreen = useInventoryScreen();
  return (
  <>
        {/* Stock Transfer View Modal */}
        <Modal isOpen={inventoryScreen.isStockTransferViewOpen} onClose={inventoryScreen.onStockTransferViewClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              <div>
                <div className="text-xl font-semibold">Stock Transfer Details</div>
                <div className="text-sm text-gray-500 font-mono">{inventoryScreen.viewingStockTransfer?.transferNumber}</div>
              </div>
            </ModalHeader>
            <ModalBody>
              {inventoryScreen.viewingStockTransfer && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">From Location</div>
                      <div className="font-semibold">{inventoryScreen.viewingStockTransfer.fromLocation}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">To Location</div>
                      <div className="font-semibold">{inventoryScreen.viewingStockTransfer.toLocation}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Transfer Date</div>
                      <div>{inventoryScreen.viewingStockTransfer.transferDate instanceof Date ? inventoryScreen.viewingStockTransfer.transferDate.toLocaleDateString() : new Date(inventoryScreen.viewingStockTransfer.transferDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Status</div>
                      <Badge color={inventoryScreen.viewingStockTransfer.status === 'delivered' ? 'success' : inventoryScreen.viewingStockTransfer.status === 'in-transit' ? 'warning' : 'default'} variant="flat">
                        {inventoryScreen.viewingStockTransfer.status}
                      </Badge>
                    </div>
                  </div>

                  <Divider />

                  <div>
                    <h4 className="font-semibold mb-2">Transfer Items</h4>
                    <Table>
                      <TableHeader>
                        <TableColumn>Item Code</TableColumn>
                        <TableColumn>Item Name</TableColumn>
                        <TableColumn>Quantity</TableColumn>
                        <TableColumn>Unit Cost</TableColumn>
                        <TableColumn className="text-right">Total Value</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {inventoryScreen.viewingStockTransfer.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.itemCode}</TableCell>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>₵{item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right font-semibold">
                              ₵{item.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Divider />

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-semibold">Total Value:</span>
                      <span className="font-semibold">
                        ₵{inventoryScreen.viewingStockTransfer.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex flex-wrap gap-2">
              <Button variant="bordered" onPress={inventoryScreen.onStockTransferViewClose}>Close</Button>
              {inventoryScreen.viewingStockTransfer?.status === 'pending' && (
                <Button
                  color="warning"
                  variant="flat"
                  onPress={() => {
                    inventoryScreen.onStockTransferViewClose();
                    inventoryScreen.setEditingStockTransfer(inventoryScreen.viewingStockTransfer);
                    inventoryScreen.setStockTransferFormData({ ...inventoryScreen.viewingStockTransfer, items: inventoryScreen.viewingStockTransfer.items });
                    inventoryScreen.setTransferItemSearchTerms({});
                    inventoryScreen.onStockTransferOpen();
                  }}
                >
                  ✏️ Edit
                </Button>
              )}
              {inventoryScreen.viewingStockTransfer?.status === 'pending' && (
                <Button color="warning" onPress={() => inventoryScreen.handleTransferStatusChange(inventoryScreen.viewingStockTransfer, 'in-transit')}>
                  🚚 Mark In Transit
                </Button>
              )}
              {inventoryScreen.viewingStockTransfer && (inventoryScreen.viewingStockTransfer.status === 'pending' || inventoryScreen.viewingStockTransfer.status === 'in-transit') && (
                <Button color="success" onPress={() => inventoryScreen.handleTransferStatusChange(inventoryScreen.viewingStockTransfer, 'delivered')}>
                  ✅ Mark Delivered
                </Button>
              )}
              {inventoryScreen.viewingStockTransfer && (inventoryScreen.viewingStockTransfer.status === 'pending' || inventoryScreen.viewingStockTransfer.status === 'in-transit') && (
                <Button color="danger" variant="flat" onPress={() => inventoryScreen.handleTransferStatusChange(inventoryScreen.viewingStockTransfer, 'cancelled')}>
                  ❌ Cancel
                </Button>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}
