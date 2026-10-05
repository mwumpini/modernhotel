'use client';

import { Badge, Button, Card, CardBody, CardHeader, Chip, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Progress, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import { SortHeader, deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, toggleColumnSort } from '../dashboard/deskTableUi';
import { sizedTableClassNames } from '../frontoffice/columnResize';
import { useInventoryScreen } from './inventoryScreenContext';

/** Inventory → Items. Stock item table. */
export function ItemsTable() {
  const inventoryScreen = useInventoryScreen();
    return (
    <div className="space-y-6">
        {/* Filters and Search */}
        <Card className="border-0 shadow-lg">
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                placeholder="Search items..."
                value={inventoryScreen.searchTerm}
                onChange={(e) => inventoryScreen.setSearchTerm(e.target.value)}
                startContent={<span className="text-gray-400">🔍</span>}
                className="md:col-span-2"
              />

              <Select
                placeholder="Category"
                selectedKeys={[inventoryScreen.filterCategory]}
                onSelectionChange={(keys) => inventoryScreen.setFilterCategory(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Categories</SelectItem>
                <>
                  {inventoryScreen.categories.map(cat => (
                    <SelectItem key={cat}>{cat}</SelectItem>
                  ))}
                </>
              </Select>

              <Select
                placeholder="Location"
                selectedKeys={[inventoryScreen.filterLocation]}
                onSelectionChange={(keys) => inventoryScreen.setFilterLocation(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Locations</SelectItem>
                <>
                  {inventoryScreen.inventoryLocations.map(loc => (
                    <SelectItem key={loc}>{loc}</SelectItem>
                  ))}
                </>
              </Select>

              <Select
                placeholder="Status"
                selectedKeys={[inventoryScreen.filterStatus]}
                onSelectionChange={(keys) => inventoryScreen.setFilterStatus(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Status</SelectItem>
                <SelectItem key="active">Active</SelectItem>
                <SelectItem key="inactive">Inactive</SelectItem>
                <SelectItem key="low-stock">Low Stock</SelectItem>
                <SelectItem key="out-of-stock">Out of Stock</SelectItem>
                <SelectItem key="overstock">Overstock</SelectItem>
              </Select>
            </div>
          </CardBody>
        </Card>

        {/* Main Table */}
      <Card className={deskTableCardClassName}>
        <CardHeader className="pb-3">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-xl font-semibold text-ghana-black">📦 Stock Items</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
                startContent={<span>➕</span>}
                onClick={inventoryScreen.handleAddItem}
            >
                Add Item
            </Button>
          </div>
        </CardHeader>
        <CardBody className={deskTableCardBodyClassName}>
            <div ref={inventoryScreen.itemCols.frameRef} style={inventoryScreen.itemCols.frameStyle}>
            <Table aria-label="Stock items table" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
            <TableHeader>
                <TableColumn className="relative" style={inventoryScreen.itemCols.style('code')}>{<SortHeader label="Code" column="code" sort={inventoryScreen.itemSort} onSort={(column) => inventoryScreen.setItemSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.itemCols.sizer('code', 'Code')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.itemCols.style('item')}>{<SortHeader label="Item" column="item" sort={inventoryScreen.itemSort} onSort={(column) => inventoryScreen.setItemSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.itemCols.sizer('item', 'Item')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.itemCols.style('category')}>{<SortHeader label="Category" column="category" sort={inventoryScreen.itemSort} onSort={(column) => inventoryScreen.setItemSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.itemCols.sizer('category', 'Category')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.itemCols.style('unit')}>{<SortHeader label="Unit" column="unit" sort={inventoryScreen.itemSort} onSort={(column) => inventoryScreen.setItemSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.itemCols.sizer('unit', 'Unit')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.itemCols.style('onHand')}>{<SortHeader label="On hand" column="onHand" sort={inventoryScreen.itemSort} onSort={(column) => inventoryScreen.setItemSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.itemCols.sizer('onHand', 'On hand')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.itemCols.style('reorder')}>{<SortHeader label="Reorder" column="reorder" sort={inventoryScreen.itemSort} onSort={(column) => inventoryScreen.setItemSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.itemCols.sizer('reorder', 'Reorder')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.itemCols.style('unitCost')}>{<SortHeader label="Unit cost" column="unitCost" sort={inventoryScreen.itemSort} onSort={(column) => inventoryScreen.setItemSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.itemCols.sizer('unitCost', 'Unit cost')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.itemCols.style('location')}>{<SortHeader label="Location" column="location" sort={inventoryScreen.itemSort} onSort={(column) => inventoryScreen.setItemSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.itemCols.sizer('location', 'Location')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.itemCols.style('status')}>{<SortHeader label="Status" column="status" sort={inventoryScreen.itemSort} onSort={(column) => inventoryScreen.setItemSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.itemCols.sizer('status', 'Status')}</TableColumn>
            </TableHeader>
              <TableBody emptyContent="No stock items found.">
                {inventoryScreen.paginatedItems.map((item) => {
                  const stockStatus = inventoryScreen.getStockStatus(item);
                  const onHand = Number(item.currentStock || 0);
                  const maxStock = Number(item.maximumStock || 0);
                  const reorder = Number(item.reorderPoint || 0);
                  const barMax = maxStock > 0 ? maxStock : Math.max(reorder * 2, onHand, 1);
                  const stockPercentage = Math.min(100, (onHand / barMax) * 100);
                  const stockColor =
                    onHand <= reorder ? 'danger' :
                    onHand <= reorder * 1.5 ? 'warning' :
                    'success';
                  const stockText =
                    stockColor === 'danger' ? 'text-red-600' :
                    stockColor === 'warning' ? 'text-orange-600' :
                    'text-green-600';
                  return (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => inventoryScreen.handleViewItem(item)}
                >
                      <TableCell>
                        <span className="text-gray-600 whitespace-nowrap" title={item.itemCode}>
                          {item.itemCode}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0 max-w-[260px]">
                          <p className="font-medium text-ghana-black truncate" title={item.name}>{item.name}</p>
                          {item.description ? (
                            <p className="text-xs text-gray-500 truncate" title={item.description}>{item.description}</p>
                          ) : null}
                        </div>
                      </TableCell>
                  <TableCell>
                    <Chip
                          color={inventoryScreen.getCategoryColor(item.category)}
                      size="sm"
                      variant="flat"
                      className="capitalize"
                    >
                      {item.category}
                    </Chip>
                  </TableCell>
                  <TableCell>
                        <span className="text-sm font-medium whitespace-nowrap">{item.unit || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-0.5">
                          <div className={`font-semibold tabular-nums ${stockText}`}>
                            {onHand.toLocaleString()}
                          </div>
                          <Progress
                            aria-label={`${item.name} stock level`}
                            value={stockPercentage}
                            size="sm"
                            color={stockColor}
                            className="w-16"
                          />
                          {maxStock > 0 && (
                            <div className="text-[10px] text-gray-500 tabular-nums">Max {maxStock.toLocaleString()}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-slate-700 tabular-nums">{reorder}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-blue-600 tabular-nums whitespace-nowrap">₵{Number(item.unitCost || 0).toLocaleString()}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm truncate max-w-[140px]" title={item.location || undefined}>{item.location || '—'}</div>
                        {item.binLocation && (
                          <div className="text-xs text-gray-500 truncate">Bin: {item.binLocation}</div>
                        )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                    <Badge
                          color={stockStatus.color as any}
                      size="sm"
                          variant="flat"
                    >
                          {stockStatus.label}
                    </Badge>
                        {item.isPerishable && (
                          <Chip size="sm" variant="flat" color="warning">
                            🍃 Perishable
                          </Chip>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
                  );
                })}
            </TableBody>
          </Table>
            </div>
            <div className="mt-3 flex justify-end">
              <Pagination
                total={inventoryScreen.pages}
                page={inventoryScreen.pageSafe}
                onChange={inventoryScreen.setPage}
                showControls
                size="sm"
              />
            </div>
          </CardBody>
      </Card>
    </div>
  );
}

/** Inventory → Items. Add, edit, and view an item. */
export function ItemModals() {
  const inventoryScreen = useInventoryScreen();
  return (
  <>
        {/* Modals for Inventory Management - rendered outside conditional to avoid hook issues */}
        {inventoryScreen.selectedTab === 'inventory' && (
          <>
            {/* Add/Edit Modal */}
            <Modal isOpen={inventoryScreen.isOpen} onClose={inventoryScreen.onClose} size="3xl" scrollBehavior="inside">
              <ModalContent>
                <ModalHeader>
                  {inventoryScreen.editingItem ? 'Edit Stock Item' : 'Add Stock Item'}
                </ModalHeader>
                <ModalBody>
                  <p className="text-sm text-slate-500 -mt-1 mb-2">
                    Stock on the shelf. Receiving and issues change on-hand later — you set the starting qty here.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Item Code"
                      value={inventoryScreen.formData.itemCode || ''}
                      isReadOnly
                      isRequired
                      description={
                        inventoryScreen.editingItem
                          ? 'Locked — assigned when the item was created'
                          : 'Auto from Settings → Document Numbering → Stock Item'
                      }
                      classNames={{ input: 'font-mono font-semibold' }}
                    />
                    <Input
                      label="Item Name"
                      value={inventoryScreen.formData.name || ''}
                      onChange={(e) => inventoryScreen.setFormData({ ...inventoryScreen.formData, name: e.target.value })}
                      placeholder="e.g. Bath Soap"
                      isRequired
                      classNames={{ input: 'font-medium' }}
                    />
                    <Select
                      label="Category"
                      selectedKeys={inventoryScreen.formData.category ? [inventoryScreen.formData.category] : ['other']}
                      onSelectionChange={(keys) => inventoryScreen.setFormData({ ...inventoryScreen.formData, category: Array.from(keys)[0] as any })}
                      isRequired
                    >
                      {inventoryScreen.STOCK_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} textValue={cat}>
                          <span className="capitalize">{cat}</span>
                        </SelectItem>
                      ))}
                    </Select>
                    <Select
                      label="Preferred Supplier"
                      placeholder="Who supplies this item?"
                      selectedKeys={inventoryScreen.formData.supplierId ? [inventoryScreen.formData.supplierId] : []}
                      onSelectionChange={(keys) => {
                        const sid = Array.from(keys)[0] as string | undefined;
                        const supplier = inventoryScreen.mergedSuppliers.find((s) => s.id === sid);
                        inventoryScreen.setFormData({
                          ...inventoryScreen.formData,
                          supplierId: supplier?.id,
                          supplierName: supplier?.name,
                        });
                      }}
                      description="Used to filter vendors on requisitions"
                    >
                      {inventoryScreen.mergedSuppliers.filter((s) => s.isActive).map((s) => (
                        <SelectItem key={s.id}>{s.name}</SelectItem>
                      ))}
                    </Select>
                    <Input
                      label="Unit"
                      value={inventoryScreen.formData.unit || ''}
                      onChange={(e) => inventoryScreen.setFormData({ ...inventoryScreen.formData, unit: e.target.value })}
                      placeholder="e.g. pcs, kg, bottles"
                      isRequired
                    />
                    <Input
                      label="Unit Cost (₵)"
                      type="number"
                      value={inventoryScreen.formData.unitCost?.toString() || '0'}
                      onChange={(e) => inventoryScreen.setFormData({ ...inventoryScreen.formData, unitCost: parseFloat(e.target.value) || 0 })}
                      isRequired
                    />
                    <Input
                      label="On Hand (starting qty)"
                      type="number"
                      value={inventoryScreen.formData.currentStock?.toString() || '0'}
                      onChange={(e) => {
                        const currentStock = parseFloat(e.target.value) || 0;
                        inventoryScreen.setFormData({
                          ...inventoryScreen.formData,
                          currentStock,
                          // Keep min/max sensible defaults if still blank
                          minimumStock: inventoryScreen.formData.minimumStock || 0,
                          maximumStock: inventoryScreen.formData.maximumStock || Math.max(currentStock * 2, 100),
                        });
                      }}
                      description={inventoryScreen.editingItem ? 'Prefer receive / issue to change stock' : 'Opening balance'}
                    />
                    <Input
                      label="Reorder Point"
                      type="number"
                      value={inventoryScreen.formData.reorderPoint?.toString() || '0'}
                      onChange={(e) => {
                        const reorderPoint = parseFloat(e.target.value) || 0;
                        inventoryScreen.setFormData({
                          ...inventoryScreen.formData,
                          reorderPoint,
                          minimumStock: inventoryScreen.formData.minimumStock || reorderPoint,
                        });
                      }}
                      description="Alert when on hand falls to this"
                    />
                    <Select
                      label="Location"
                      placeholder="Pick a stock location"
                      selectedKeys={inventoryScreen.formData.location ? [inventoryScreen.formData.location] : []}
                      onSelectionChange={(keys) => {
                        const next = Array.from(keys)[0] as string;
                        if (next) inventoryScreen.setFormData({ ...inventoryScreen.formData, location: next });
                      }}
                      description="Managed in Settings → Stock Locations"
                    >
                      {inventoryScreen.availableLocations.map((loc) => (
                        <SelectItem key={loc}>{loc}</SelectItem>
                      ))}
                    </Select>
                    <Textarea
                      label="Description (optional)"
                      value={inventoryScreen.formData.description || ''}
                      onChange={(e) => inventoryScreen.setFormData({ ...inventoryScreen.formData, description: e.target.value })}
                      placeholder="Short note"
                      className="col-span-2"
                      minRows={2}
                    />
                    <div className="col-span-2 flex flex-wrap gap-3">
                      <Chip
                        color={inventoryScreen.formData.isActive !== false ? 'success' : 'warning'}
                        variant="flat"
                        onClick={() => inventoryScreen.setFormData({ ...inventoryScreen.formData, isActive: !(inventoryScreen.formData.isActive !== false) })}
                        className="cursor-pointer"
                      >
                        {inventoryScreen.formData.isActive !== false ? '✓ Active — in the stock file' : 'Inactive — hidden from day-to-day'}
                      </Chip>
                      <Chip
                        color={inventoryScreen.formData.isPerishable ? 'warning' : 'default'}
                        variant="flat"
                        onClick={() => inventoryScreen.setFormData({ ...inventoryScreen.formData, isPerishable: !inventoryScreen.formData.isPerishable })}
                        className="cursor-pointer"
                      >
                        {inventoryScreen.formData.isPerishable ? '🍃 Perishable' : 'Not perishable'}
                      </Chip>
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="bordered" onPress={inventoryScreen.onClose}>Cancel</Button>
                  <Button color="primary" className="bg-ghana-green text-white" onPress={inventoryScreen.handleSaveItem}>
                    {inventoryScreen.editingItem ? 'Update' : 'Add'} Item
                  </Button>
                </ModalFooter>
              </ModalContent>
            </Modal>

            {/* View Details Modal */}
            <Modal isOpen={inventoryScreen.viewOpen} onClose={() => inventoryScreen.setViewOpen(false)} size="2xl" scrollBehavior="inside">
              <ModalContent>
                <ModalHeader>
                  <div>
                    <div className="text-xl font-semibold">Stock Item Details</div>
                    <div className="text-sm text-gray-500 font-mono">{inventoryScreen.viewingItem?.itemCode}</div>
                  </div>
                </ModalHeader>
                <ModalBody>
                  {inventoryScreen.viewingItem && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Item Name</div>
                          <div className="font-semibold">{inventoryScreen.viewingItem.name}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Category</div>
                          <Chip color={inventoryScreen.getCategoryColor(inventoryScreen.viewingItem.category)} size="sm" variant="flat">
                            {inventoryScreen.viewingItem.category}
                          </Chip>
                        </div>
                        <div className="col-span-2">
                          <div className="text-xs text-gray-500 mb-1">Description</div>
                          <div className="text-sm">{inventoryScreen.viewingItem.description || 'N/A'}</div>
                        </div>
                      </div>

                      <Divider />

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Current Stock</div>
                          <div className="text-lg font-semibold text-blue-600">
                            {inventoryScreen.viewingItem.currentStock.toLocaleString()} {inventoryScreen.viewingItem.unit}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Reorder Point</div>
                          <div className="text-lg font-semibold">{inventoryScreen.viewingItem.reorderPoint}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Stock Value</div>
                          <div className="text-lg font-semibold text-green-600">
                            ₵{(inventoryScreen.viewingItem.currentStock * inventoryScreen.viewingItem.unitCost).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <Divider />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Unit Cost</div>
                          <div className="font-semibold">₵{inventoryScreen.viewingItem.unitCost.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Selling Price</div>
                          <div className="font-semibold">
                            {inventoryScreen.viewingItem.sellingPrice ? `₵${inventoryScreen.viewingItem.sellingPrice.toLocaleString()}` : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Minimum Stock</div>
                          <div className="font-semibold">{inventoryScreen.viewingItem.minimumStock}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Maximum Stock</div>
                          <div className="font-semibold">{inventoryScreen.viewingItem.maximumStock}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Location</div>
                          <div className="font-semibold">{inventoryScreen.viewingItem.location}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Bin Location</div>
                          <div className="font-semibold">{inventoryScreen.viewingItem.binLocation || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Status</div>
                          <Badge color={inventoryScreen.getStockStatus(inventoryScreen.viewingItem).color as any} size="sm">
                            {inventoryScreen.getStockStatus(inventoryScreen.viewingItem).label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </ModalBody>
                <ModalFooter className="flex flex-wrap gap-2">
                  <Button variant="bordered" onPress={() => inventoryScreen.setViewOpen(false)}>Close</Button>
                  {inventoryScreen.viewingItem && (
                    <Button color="danger" variant="light" onPress={() => { inventoryScreen.setViewOpen(false); void inventoryScreen.handleDeleteItem(inventoryScreen.viewingItem.id); }}>Delete</Button>
                  )}
                  {inventoryScreen.viewingItem && (
                    <Button color="warning" variant="flat" onPress={() => {
                      inventoryScreen.setViewOpen(false);
                      inventoryScreen.handleEditItem(inventoryScreen.viewingItem);
                    }}>
                      ✏️ Edit
                    </Button>
                  )}
                  {inventoryScreen.viewingItem && (
                    <Button color="danger" variant="flat" onPress={() => {
                      inventoryScreen.setViewOpen(false);
                      inventoryScreen.handleDeleteItem(inventoryScreen.viewingItem.id);
                    }}>
                      🗑️ Delete
                    </Button>
                  )}
                </ModalFooter>
              </ModalContent>
            </Modal>
          </>
        )}


  </>
  );
}
