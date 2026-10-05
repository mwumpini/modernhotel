'use client';

import { Autocomplete, AutocompleteItem, Badge, Button, Card, CardBody, CardHeader, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import { SortHeader, deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, toggleColumnSort } from '../dashboard/deskTableUi';
import { StockItem } from '../../lib/inventory/models';
import { sizedTableClassNames } from '../frontoffice/columnResize';
import { useInventoryScreen } from './inventoryScreenContext';

/** Inventory → Requisitions. Requisition table. */
export function RequisitionsTable() {
  const inventoryScreen = useInventoryScreen();
  return (
  (
      <div className="space-y-6">
        <Card className={deskTableCardClassName}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-xl font-semibold text-ghana-black">📝 Requisitions</h3>
              <Button
                color="primary"
                className="bg-ghana-green text-white"
                variant="flat"
                onPress={inventoryScreen.handleAddRequisition}
              >
                📝 Create Requisition
              </Button>
            </div>
          </CardHeader>
          <CardBody className={deskTableCardBodyClassName}>
            {/* Filters and Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Input
                placeholder="Search requisition number or requester..."
                value={inventoryScreen.requisitionSearchTerm}
                onChange={(e) => inventoryScreen.setRequisitionSearchTerm(e.target.value)}
                startContent={<span className="text-gray-400">🔍</span>}
                className="md:col-span-2"
              />
              <Select
                placeholder="Filter by Status"
                selectedKeys={[inventoryScreen.requisitionFilterStatus]}
                onSelectionChange={(keys) => inventoryScreen.setRequisitionFilterStatus(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all">All Status</SelectItem>
                <SelectItem key="pending">Pending</SelectItem>
                <SelectItem key="approved">Approved</SelectItem>
                <SelectItem key="ready">Ready for Pickup</SelectItem>
                <SelectItem key="rejected">Rejected</SelectItem>
                <SelectItem key="converted-to-po">Converted to PO</SelectItem>
                <SelectItem key="cancelled">Cancelled</SelectItem>
              </Select>
            </div>

            <div ref={inventoryScreen.requisitionCols.frameRef} style={inventoryScreen.requisitionCols.frameStyle}>
            <Table aria-label="Requisitions table" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
              <TableHeader>
                <TableColumn className="relative" style={inventoryScreen.requisitionCols.style('number')}>{<SortHeader label="Req Number" column="number" sort={inventoryScreen.requisitionSort} onSort={(column) => inventoryScreen.setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.requisitionCols.sizer('number', 'Req Number')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.requisitionCols.style('requestedBy')}>{<SortHeader label="Requested By" column="requestedBy" sort={inventoryScreen.requisitionSort} onSort={(column) => inventoryScreen.setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.requisitionCols.sizer('requestedBy', 'Requested By')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.requisitionCols.style('date')}>{<SortHeader label="Requested Date" column="date" sort={inventoryScreen.requisitionSort} onSort={(column) => inventoryScreen.setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.requisitionCols.sizer('date', 'Requested Date')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.requisitionCols.style('items')}>{<SortHeader label="Items" column="items" sort={inventoryScreen.requisitionSort} onSort={(column) => inventoryScreen.setRequisitionSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.requisitionCols.sizer('items', 'Items')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.requisitionCols.style('amount')}>{<SortHeader label="Total Amount" column="amount" sort={inventoryScreen.requisitionSort} onSort={(column) => inventoryScreen.setRequisitionSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.requisitionCols.sizer('amount', 'Total Amount')}</TableColumn>
                <TableColumn className="relative" style={inventoryScreen.requisitionCols.style('status')}>{<SortHeader label="Status" column="status" sort={inventoryScreen.requisitionSort} onSort={(column) => inventoryScreen.setRequisitionSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.requisitionCols.sizer('status', 'Status')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No requisitions found.">
                {inventoryScreen.paginatedRequisitions.map((req) => {
                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case 'approved': return 'primary';
                      case 'ready': return 'success';
                      case 'rejected': case 'cancelled': return 'danger';
                      case 'converted-to-po': return 'secondary';
                      case 'pending': return 'warning';
                      default: return 'default';
                    }
                  };

                  const totalAmount = req.requestedItems.reduce((sum, item) => sum + item.totalCost, 0);

                  return (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => inventoryScreen.handleViewRequisition(req)}
                    >
                      <TableCell className="text-gray-600 whitespace-nowrap">{req.requisitionNumber}</TableCell>
                      <TableCell className="font-semibold truncate" title={req.requestedBy}>{req.requestedBy}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {req.requestedDate instanceof Date 
                          ? req.requestedDate.toLocaleDateString()
                          : new Date(req.requestedDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className="block text-right tabular-nums">{req.requestedItems.length}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                        ₵{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge color={getStatusColor(req.status)} size="sm" className="capitalize">
                          {req.status.replace('-', ' ')}
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
                total={inventoryScreen.requisitionPages}
                page={inventoryScreen.requisitionPageSafe}
                onChange={inventoryScreen.setRequisitionPage}
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

/** Inventory → Requisitions. Create and act on a requisition. */
export function RequisitionModals() {
  const inventoryScreen = useInventoryScreen();
  return (
  <>
        {/* Requisition Modals */}
        <Modal isOpen={inventoryScreen.isRequisitionModalOpen} onClose={inventoryScreen.onRequisitionModalClose} size="5xl" scrollBehavior="inside" classNames={{ base: '!max-w-[calc(64rem*0.85)]' }}>
          <ModalContent>
            <ModalHeader>
              {inventoryScreen.editingRequisition ? 'Edit Requisition' : 'Create Requisition'}
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Requisition Number"
                    value={inventoryScreen.requisitionFormData.requisitionNumber || ''}
                    isDisabled
                    description="Auto-generated"
                  />
                  <Input
                    label="Requested By"
                    value={inventoryScreen.requisitionFormData.requestedBy || ''}
                    onChange={(e) => inventoryScreen.setRequisitionFormData({ ...inventoryScreen.requisitionFormData, requestedBy: e.target.value })}
                    isRequired
                  />
                  <Input
                    label="Requested Date"
                    type="date"
                    value={inventoryScreen.requisitionFormData.requestedDate instanceof Date
                      ? inventoryScreen.requisitionFormData.requestedDate.toISOString().split('T')[0]
                      : inventoryScreen.requisitionFormData.requestedDate
                        ? new Date(inventoryScreen.requisitionFormData.requestedDate).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0]}
                    onChange={(e) => inventoryScreen.setRequisitionFormData({ 
                      ...inventoryScreen.requisitionFormData, 
                      requestedDate: new Date(e.target.value) 
                    })}
                    isRequired
                  />
                </div>

                <Divider />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Requested Items</h4>
                    <Button size="sm" color="primary" onPress={inventoryScreen.handleAddRequisitionItem}>
                      + Add Item
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    Optional preferred supplier per line — filtered to vendors linked to that product (item supplier, matching category, or past POs).
                  </p>
                  {(inventoryScreen.requisitionFormData.requestedItems || []).length > 0 ? (
                    <Table aria-label="Requested items" className="[&_thead]:hidden">
                      <TableHeader>
                        <TableColumn>Item</TableColumn>
                        <TableColumn>Supplier</TableColumn>
                        <TableColumn>Quantity</TableColumn>
                        <TableColumn>Price</TableColumn>
                        <TableColumn>Total</TableColumn>
                        <TableColumn>Action</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {(inventoryScreen.requisitionFormData.requestedItems || []).map((item, index) => {
                          const filteredItems = inventoryScreen.getFilteredItemsForIndex(index);
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="w-[32%]">
                                <Autocomplete
                                  placeholder="🔍 Search item by code or name..."
                                  selectedKey={item.itemCode || undefined}
                                  defaultSelectedKey={item.itemCode || undefined}
                                  onSelectionChange={(key) => {
                                    if (key) {
                                      inventoryScreen.handleRequisitionItemChange(String(key), index);
                                    } else {
                                      // Clear item when selection is cleared
                                      inventoryScreen.handleUpdateRequisitionItem(item.id, {
                                        itemId: '',
                                        itemCode: '',
                                        itemName: '',
                                        estimatedPrice: 0,
                                        totalCost: 0,
                                        preferredSupplierId: undefined,
                                        preferredSupplierName: undefined,
                                      });
                                      inventoryScreen.setItemSearchTerms((prev: Record<number, string>) => {
                                        const updated = { ...prev };
                                        delete updated[index];
                                        return updated;
                                      });
                                    }
                                  }}
                                  onInputChange={(value) => {
                                    // Always allow search, update search term
                                    inventoryScreen.setItemSearchTerms((prev: Record<number, string>) => ({ ...prev, [index]: value }));
                                  }}
                                  inputValue={
                                    // If user is actively searching (has search term), show search term
                                    // Otherwise, if item is selected, show the selected item
                                    inventoryScreen.itemSearchTerms[index] !== undefined
                                      ? inventoryScreen.itemSearchTerms[index]
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
                              <TableCell className="w-[22%]">
                                {(() => {
                                  const vendors = inventoryScreen.getVendorsForRequisitionLine(item);
                                  const selectedOk = item.preferredSupplierId && vendors.some((v) => v.id === item.preferredSupplierId);
                                  return (
                                    <Select
                                      placeholder={item.itemId ? (vendors.length ? 'Preferred vendor' : 'No vendor for item') : 'Pick item first'}
                                      size="sm"
                                      isDisabled={!item.itemId || vendors.length === 0}
                                      selectedKeys={selectedOk ? [item.preferredSupplierId!] : []}
                                      onSelectionChange={(keys) => {
                                        const sid = Array.from(keys)[0] as string;
                                        const supplier = vendors.find((s) => s.id === sid);
                                        inventoryScreen.handleUpdateRequisitionItem(item.id, {
                                          preferredSupplierId: supplier?.id,
                                          preferredSupplierName: supplier?.name,
                                        });
                                      }}
                                      description={
                                        !item.itemId
                                          ? undefined
                                          : vendors.length === 0
                                            ? 'Link a supplier on the item (or category)'
                                            : undefined
                                      }
                                    >
                                      {vendors.map((s) => (
                                        <SelectItem key={s.id}>{s.name}</SelectItem>
                                      ))}
                                    </Select>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="w-[12%]">
                                <Input
                                  type="number"
                                  value={String(item.quantity)}
                                  onChange={(e) => inventoryScreen.handleUpdateRequisitionItem(item.id, { 
                                    quantity: parseInt(e.target.value) || 0 
                                  })}
                                  size="sm"
                                  min="1"
                                  placeholder="Qty"
                                />
                              </TableCell>
                              <TableCell className="w-[14%]">
                                <Input
                                  type="number"
                                  value={String(item.estimatedPrice)}
                                  onChange={(e) => inventoryScreen.handleUpdateRequisitionItem(item.id, { 
                                    estimatedPrice: parseFloat(e.target.value) || 0 
                                  })}
                                  size="sm"
                                  startContent="₵"
                                  placeholder="Price"
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
                                  onPress={() => inventoryScreen.handleRemoveRequisitionItem(item.id)}
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
                      No items added. Click "Add Item" to add items to this requisition.
                    </div>
                  )}
                </div>

                <Divider />

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold">Total Amount:</span>
                    <span className="text-lg font-bold">
                      ₵{((inventoryScreen.requisitionFormData.requestedItems || []).reduce((sum, item) => sum + item.totalCost, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <Textarea
                  label="Notes"
                  value={inventoryScreen.requisitionFormData.notes || ''}
                  onChange={(e) => inventoryScreen.setRequisitionFormData({ ...inventoryScreen.requisitionFormData, notes: e.target.value })}
                  placeholder="Additional notes or justification..."
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="bordered" onPress={inventoryScreen.onRequisitionModalClose}>Cancel</Button>
              <Button color="primary" onPress={inventoryScreen.handleSaveRequisition}>
                {inventoryScreen.editingRequisition ? 'Update' : 'Create'} Requisition
              </Button>
              <Button 
                variant="flat" 
                color="secondary" 
                onPress={inventoryScreen.handleGenerateRequisitionPDF}
                startContent={<span>📄</span>}
              >
                PDF
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Requisition View Modal */}
        <Modal isOpen={inventoryScreen.isRequisitionViewOpen} onClose={inventoryScreen.onRequisitionViewClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              Requisition Details — {inventoryScreen.viewingRequisition?.requisitionNumber}
              <span className="block text-sm font-normal text-slate-500 mt-1">
                Review the lines below, then approve or reject from here.
              </span>
            </ModalHeader>
            <ModalBody>
              {inventoryScreen.viewingRequisition && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Requisition Number</div>
                      <div className="font-semibold font-mono">{inventoryScreen.viewingRequisition.requisitionNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Status</div>
                      <Badge color={
                        inventoryScreen.viewingRequisition.status === 'ready' ? 'success' :
                        inventoryScreen.viewingRequisition.status === 'approved' ? 'primary' :
                        inventoryScreen.viewingRequisition.status === 'rejected' || inventoryScreen.viewingRequisition.status === 'cancelled' ? 'danger' :
                        inventoryScreen.viewingRequisition.status === 'converted-to-po' ? 'secondary' :
                        'warning'
                      }>
                        {inventoryScreen.viewingRequisition.status.replace('-', ' ')}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Requested By</div>
                      <div className="font-semibold">{inventoryScreen.viewingRequisition.requestedBy}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Requested Date</div>
                      <div>
                        {inventoryScreen.viewingRequisition.requestedDate instanceof Date 
                          ? inventoryScreen.viewingRequisition.requestedDate.toLocaleDateString()
                          : new Date(inventoryScreen.viewingRequisition.requestedDate).toLocaleDateString()}
                      </div>
                    </div>
                    {inventoryScreen.viewingRequisition.approvedBy && (
                      <>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Approved By</div>
                          <div className="font-semibold">{inventoryScreen.viewingRequisition.approvedBy}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Approved At</div>
                          <div>
                            {inventoryScreen.viewingRequisition.approvedAt 
                              ? (inventoryScreen.viewingRequisition.approvedAt instanceof Date 
                                  ? inventoryScreen.viewingRequisition.approvedAt.toLocaleDateString()
                                  : new Date(inventoryScreen.viewingRequisition.approvedAt).toLocaleDateString())
                              : 'N/A'}
                          </div>
                        </div>
                      </>
                    )}
                    {inventoryScreen.viewingRequisition.rejectedBy && (
                      <>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Rejected By</div>
                          <div className="font-semibold">{inventoryScreen.viewingRequisition.rejectedBy}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Rejection Reason</div>
                          <div className="text-sm">{inventoryScreen.viewingRequisition.rejectionReason || 'No reason provided'}</div>
                        </div>
                      </>
                    )}
                    {inventoryScreen.viewingRequisition.convertedToPONumber && (
                      <div className="col-span-2">
                        <div className="text-xs text-gray-500 mb-1">Converted to PO</div>
                        <div className="font-semibold font-mono">{inventoryScreen.viewingRequisition.convertedToPONumber}</div>
                      </div>
                    )}
                  </div>

                  <Divider />

                  <div>
                    <h4 className="font-semibold mb-2">Requested Items</h4>
                    <Table>
                      <TableHeader>
                        <TableColumn>Item Code</TableColumn>
                        <TableColumn>Item Name</TableColumn>
                        <TableColumn>Preferred Supplier</TableColumn>
                        <TableColumn>Quantity</TableColumn>
                        <TableColumn>Estimated Price</TableColumn>
                        <TableColumn className="text-right">Total</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {inventoryScreen.viewingRequisition.requestedItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.itemCode}</TableCell>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell className="text-sm">
                              {item.preferredSupplierName || '—'}
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>₵{item.estimatedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">Total Amount:</span>
                      <span className="text-lg font-bold">
                        ₵{inventoryScreen.viewingRequisition.requestedItems.reduce((sum, item) => sum + item.totalCost, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {inventoryScreen.viewingRequisition.notes && (
                    <>
                      <Divider />
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Notes</div>
                        <div className="text-sm">{inventoryScreen.viewingRequisition.notes}</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex flex-wrap gap-2">
              <Button variant="bordered" onPress={inventoryScreen.onRequisitionViewClose}>Close</Button>
              {inventoryScreen.viewingRequisition && (inventoryScreen.viewingRequisition.status === 'pending' || inventoryScreen.canEditProcessedRequisitions) && inventoryScreen.viewingRequisition.status !== 'converted-to-po' && (
                <Button color="warning" variant="flat" onPress={() => {
                  inventoryScreen.onRequisitionViewClose();
                  inventoryScreen.handleEditRequisition(inventoryScreen.viewingRequisition);
                }}>
                  ✏️ Edit
                </Button>
              )}
              {inventoryScreen.viewingRequisition && (inventoryScreen.viewingRequisition.status === 'pending' || inventoryScreen.canEditProcessedRequisitions) && inventoryScreen.viewingRequisition.status !== 'converted-to-po' && (
                <Button color="danger" variant="flat" onPress={() => inventoryScreen.openReqAction('delete', inventoryScreen.viewingRequisition)}>
                  🗑️ Delete
                </Button>
              )}
              {inventoryScreen.viewingRequisition && inventoryScreen.viewingRequisition.status === 'pending' && inventoryScreen.canActOnRequisitions && (
                <>
                  <Button color="success" onPress={() => inventoryScreen.openReqAction('approve', inventoryScreen.viewingRequisition)}>
                    ✓ Approve
                  </Button>
                  <Button color="danger" variant="flat" onPress={() => inventoryScreen.openReqAction('reject', inventoryScreen.viewingRequisition)}>
                    ❌ Reject
                  </Button>
                </>
              )}
              {inventoryScreen.viewingRequisition && inventoryScreen.viewingRequisition.status === 'approved' && inventoryScreen.canActOnRequisitions && (
                <>
                  <Button color="success" onPress={() => inventoryScreen.openReqAction('ready', inventoryScreen.viewingRequisition)}>
                    📦 Mark Ready
                  </Button>
                  <Button color="primary" onPress={() => inventoryScreen.openReqAction('convert', inventoryScreen.viewingRequisition)}>
                    📋 Convert to PO
                  </Button>
                </>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Requisition Approve/Reject/Ready/Convert/Delete confirmation — see reqActionModal above */}
        <Modal isOpen={!!inventoryScreen.reqActionModal} onClose={inventoryScreen.closeReqAction} size={inventoryScreen.reqActionModal?.type === 'convert' ? '3xl' : 'md'}>
          <ModalContent>
            <ModalHeader>
              {inventoryScreen.reqActionModal?.type === 'approve' && 'Approve Requisition'}
              {inventoryScreen.reqActionModal?.type === 'ready' && 'Mark Ready for Pickup'}
              {inventoryScreen.reqActionModal?.type === 'reject' && 'Reject Requisition'}
              {inventoryScreen.reqActionModal?.type === 'convert' && 'Convert to Purchase Order(s)'}
              {inventoryScreen.reqActionModal?.type === 'delete' && 'Delete Requisition'}
            </ModalHeader>
            <ModalBody>
              {inventoryScreen.reqActionModal?.type === 'approve' && (
                <p>
                  Approve requisition <strong>{inventoryScreen.reqActionModal.requisitionNumber}</strong>? This means Stores agrees to
                  fulfill it — the requester is still waiting until you mark it ready for pickup.
                </p>
              )}
              {inventoryScreen.reqActionModal?.type === 'ready' && (
                <p>
                  Mark requisition <strong>{inventoryScreen.reqActionModal.requisitionNumber}</strong> ready for pickup? This transfers
                  the requested items from Stores' shared stock into the requesting department's own stock, and lets
                  them know it's ready to collect.
                </p>
              )}
              {inventoryScreen.reqActionModal?.type === 'reject' && (
                <div className="space-y-3">
                  <p>Reject requisition <strong>{inventoryScreen.reqActionModal.requisitionNumber}</strong>?</p>
                  <Textarea
                    label="Rejection reason (optional)"
                    value={inventoryScreen.reqRejectReason}
                    onChange={(e) => inventoryScreen.setReqRejectReason(e.target.value)}
                    placeholder="Let the requester know why..."
                  />
                </div>
              )}
              {inventoryScreen.reqActionModal?.type === 'convert' && (() => {
                const req = inventoryScreen.supplierStoreRequisitions.find((r) => r.id === inventoryScreen.reqActionModal.requisitionId);
                const lines = req?.requestedItems || [];
                const groupCounts = new Map<string, number>();
                for (const item of lines) {
                  const sid = inventoryScreen.reqConvertSuppliers[item.id];
                  if (!sid) continue;
                  groupCounts.set(sid, (groupCounts.get(sid) || 0) + 1);
                }
                return (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      Assign a supplier per line. Lines to the same vendor become <strong>one PO</strong>;
                      different vendors (fish vs biscuits) become <strong>separate POs</strong>.
                    </p>
                    <div className="space-y-3 max-h-[360px] overflow-y-auto">
                      {lines.map((item) => {
                        const vendors = inventoryScreen.getVendorsForRequisitionLine(item);
                        const selectedOk = inventoryScreen.reqConvertSuppliers[item.id] && vendors.some((v) => v.id === inventoryScreen.reqConvertSuppliers[item.id]);
                        return (
                          <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-2 items-center border rounded-lg p-3">
                            <div>
                              <div className="font-mono text-sm font-semibold">{item.itemCode}</div>
                              <div className="text-sm">{item.itemName} · qty {item.quantity}</div>
                              {vendors.length === 0 && (
                                <div className="text-xs text-amber-700 mt-1">No vendor linked to this product — set one on the item first.</div>
                              )}
                            </div>
                            <Select
                              label="Supplier"
                              size="sm"
                              isDisabled={vendors.length === 0}
                              selectedKeys={selectedOk ? [inventoryScreen.reqConvertSuppliers[item.id]] : []}
                              onSelectionChange={(keys) => {
                                const sid = Array.from(keys)[0] as string;
                                if (!sid) return;
                                inventoryScreen.setReqConvertSuppliers((prev) => ({ ...prev, [item.id]: sid }));
                              }}
                              isRequired
                              placeholder={vendors.length ? 'Select vendor' : 'No vendors'}
                            >
                              {vendors.map((s) => (
                                <SelectItem key={s.id}>{s.name}</SelectItem>
                              ))}
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                    {groupCounts.size > 0 && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
                        <div className="font-semibold mb-1">Will create {groupCounts.size} purchase order{groupCounts.size === 1 ? '' : 's'}:</div>
                        <ul className="list-disc pl-5 space-y-0.5">
                          {[...groupCounts.entries()].map(([sid, count]) => (
                            <li key={sid}>
                              {inventoryScreen.mergedSuppliers.find((s) => s.id === sid)?.name || sid} — {count} line{count === 1 ? '' : 's'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}
              {inventoryScreen.reqActionModal?.type === 'delete' && (
                <p>
                  Permanently delete requisition <strong>{inventoryScreen.reqActionModal.requisitionNumber}</strong>? This cannot be
                  undone. It does not reverse any stock already transferred if this requisition was marked ready.
                </p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="bordered" onPress={inventoryScreen.closeReqAction}>Cancel</Button>
              <Button
                color={inventoryScreen.reqActionModal?.type === 'reject' || inventoryScreen.reqActionModal?.type === 'delete' ? 'danger' : 'primary'}
                onPress={inventoryScreen.confirmReqAction}
              >
                {inventoryScreen.reqActionModal?.type === 'approve' && 'Approve'}
                {inventoryScreen.reqActionModal?.type === 'ready' && 'Mark Ready'}
                {inventoryScreen.reqActionModal?.type === 'reject' && 'Reject'}
                {inventoryScreen.reqActionModal?.type === 'convert' && `Create ${new Set(Object.values(inventoryScreen.reqConvertSuppliers)).size || 0} PO(s)`}
                {inventoryScreen.reqActionModal?.type === 'delete' && 'Delete'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}
