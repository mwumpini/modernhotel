'use client';

import { Badge, Button, Card, CardBody, CardHeader, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import { SortHeader, deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, toggleColumnSort } from '../dashboard/deskTableUi';
import { SupplierInvoice } from '../../lib/inventory/models';
import { sizedTableClassNames } from '../frontoffice/columnResize';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { useSupplierStore } from '../../lib/inventory/supplierStore';
import { useInventoryScreen } from './inventoryScreenContext';
import PostingDateField from '../shared/PostingDateField';

/** Inventory → Supplier invoices. Invoice table. */
export function SupplierInvoicesTable() {
  const inventoryScreen = useInventoryScreen();
  const filteredInvoices = inventoryScreen.supplierInvoices.filter(inv => {
    const matchesSearch = inventoryScreen.invoiceSearchTerm === '' || 
      inv.invoiceNumber.toLowerCase().includes(inventoryScreen.invoiceSearchTerm.toLowerCase()) ||
      inv.poNumber.toLowerCase().includes(inventoryScreen.invoiceSearchTerm.toLowerCase()) ||
      inv.supplierName.toLowerCase().includes(inventoryScreen.invoiceSearchTerm.toLowerCase());
    const matchesStatus = inventoryScreen.invoiceFilterStatus === 'all' || inv.status === inventoryScreen.invoiceFilterStatus;
    return matchesSearch && matchesStatus;
  });
  const dir = inventoryScreen.invoiceSort.direction === 'asc' ? 1 : -1;
  const ms = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();
  const sorted = [...filteredInvoices].sort((a, b) => {
    switch (inventoryScreen.invoiceSort.column) {
      case 'po': return a.poNumber.localeCompare(b.poNumber) * dir;
      case 'grn': return (a.grnNumber || '').localeCompare(b.grnNumber || '') * dir;
      case 'supplier': return a.supplierName.localeCompare(b.supplierName) * dir;
      case 'date': return (ms(a.invoiceDate) - ms(b.invoiceDate)) * dir;
      case 'amount': return (a.totalAmount - b.totalAmount) * dir;
      case 'matching': {
        const ma = a.matchingStatus.isQuantityMatched && a.matchingStatus.isPriceMatched && a.matchingStatus.isTermsMatched ? 2 : a.status === 'matched' ? 1 : 0;
        const mb = b.matchingStatus.isQuantityMatched && b.matchingStatus.isPriceMatched && b.matchingStatus.isTermsMatched ? 2 : b.status === 'matched' ? 1 : 0;
        return (ma - mb) * dir;
      }
      case 'status': return a.status.localeCompare(b.status) * dir;
      case 'number':
      default: return a.invoiceNumber.localeCompare(b.invoiceNumber) * dir;
    }
  });
  const totalInvoicePages = Math.max(1, Math.ceil(sorted.length / inventoryScreen.invoiceRowsPerPage));
  const invoicePageSafe = Math.min(inventoryScreen.invoicePage, totalInvoicePages);
  const paginatedInvoices = sorted.slice((invoicePageSafe - 1) * inventoryScreen.invoiceRowsPerPage, invoicePageSafe * inventoryScreen.invoiceRowsPerPage);

  return (
    <div className="space-y-6">
      <Card className={deskTableCardClassName}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xl font-semibold text-ghana-black">🧾 Supplier Invoices</h3>
            <div className="flex gap-2">
              <Badge color="primary" variant="flat">
                {inventoryScreen.supplierInvoices.length} Invoices
              </Badge>
              <Button
                color="primary"
                className="bg-ghana-gold text-white"
                variant="flat"
                onPress={() => {
                  inventoryScreen.setEditingInvoice(null);
                  inventoryScreen.setInvoiceFormData({ items: [] });
                  inventoryScreen.onInvoiceModalOpen();
                }}
              >
                + Create Invoice
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className={deskTableCardBodyClassName}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Input
              placeholder="Search invoice, PO number or supplier..."
              value={inventoryScreen.invoiceSearchTerm}
              onChange={(e) => { inventoryScreen.setInvoiceSearchTerm(e.target.value); inventoryScreen.setInvoicePage(1); }}
              startContent={<span className="text-gray-400">🔍</span>}
              className="md:col-span-2"
            />
            <Select
              placeholder="Filter by Status"
              selectedKeys={[inventoryScreen.invoiceFilterStatus]}
              onSelectionChange={(keys) => { inventoryScreen.setInvoiceFilterStatus(Array.from(keys)[0] as string); inventoryScreen.setInvoicePage(1); }}
            >
              <SelectItem key="all">All Status</SelectItem>
              <SelectItem key="pending">Pending</SelectItem>
              <SelectItem key="matched">Matched</SelectItem>
              <SelectItem key="approved">Approved</SelectItem>
              <SelectItem key="rejected">Rejected</SelectItem>
              <SelectItem key="paid">Paid</SelectItem>
              <SelectItem key="cancelled">Cancelled</SelectItem>
            </Select>
          </div>

          <div ref={inventoryScreen.invoiceCols.frameRef} style={inventoryScreen.invoiceCols.frameStyle}>
          <Table aria-label="Supplier invoices" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
            <TableHeader>
              <TableColumn className="relative" style={inventoryScreen.invoiceCols.style('number')}>{<SortHeader label="Invoice #" column="number" sort={inventoryScreen.invoiceSort} onSort={(column) => inventoryScreen.setInvoiceSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.invoiceCols.sizer('number', 'Invoice #')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.invoiceCols.style('po')}>{<SortHeader label="PO #" column="po" sort={inventoryScreen.invoiceSort} onSort={(column) => inventoryScreen.setInvoiceSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.invoiceCols.sizer('po', 'PO #')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.invoiceCols.style('grn')}>{<SortHeader label="GRN #" column="grn" sort={inventoryScreen.invoiceSort} onSort={(column) => inventoryScreen.setInvoiceSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.invoiceCols.sizer('grn', 'GRN #')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.invoiceCols.style('supplier')}>{<SortHeader label="Supplier" column="supplier" sort={inventoryScreen.invoiceSort} onSort={(column) => inventoryScreen.setInvoiceSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.invoiceCols.sizer('supplier', 'Supplier')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.invoiceCols.style('date')}>{<SortHeader label="Date" column="date" sort={inventoryScreen.invoiceSort} onSort={(column) => inventoryScreen.setInvoiceSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.invoiceCols.sizer('date', 'Date')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.invoiceCols.style('amount')}>{<SortHeader label="Amount" column="amount" sort={inventoryScreen.invoiceSort} onSort={(column) => inventoryScreen.setInvoiceSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.invoiceCols.sizer('amount', 'Amount')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.invoiceCols.style('matching')}>{<SortHeader label="Matching" column="matching" sort={inventoryScreen.invoiceSort} onSort={(column) => inventoryScreen.setInvoiceSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.invoiceCols.sizer('matching', 'Matching')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.invoiceCols.style('status')}>{<SortHeader label="Status" column="status" sort={inventoryScreen.invoiceSort} onSort={(column) => inventoryScreen.setInvoiceSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.invoiceCols.sizer('status', 'Status')}</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No invoices found.">
              {paginatedInvoices.map((inv: SupplierInvoice) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    inventoryScreen.setViewingInvoice(inv);
                    inventoryScreen.onInvoiceViewOpen();
                  }}
                >
                  <TableCell className="text-gray-600 whitespace-nowrap">{inv.invoiceNumber}</TableCell>
                  <TableCell className="font-mono whitespace-nowrap">{inv.poNumber}</TableCell>
                  <TableCell className="font-mono whitespace-nowrap">{inv.grnNumber || '—'}</TableCell>
                  <TableCell className="truncate max-w-[160px]" title={inv.supplierName}>{inv.supplierName}</TableCell>
                  <TableCell className="whitespace-nowrap">{inv.invoiceDate instanceof Date ? inv.invoiceDate.toLocaleDateString() : new Date(inv.invoiceDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">₵{inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    {inv.matchingStatus.isQuantityMatched && inv.matchingStatus.isPriceMatched && inv.matchingStatus.isTermsMatched ? (
                      <Badge color="success" variant="flat">✓ Matched</Badge>
                    ) : inv.status === 'matched' ? (
                      <Badge color="warning" variant="flat">⚠ Partial</Badge>
                    ) : (
                      <Badge color="default" variant="flat">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        inv.status === 'paid' ? 'success' :
                        inv.status === 'approved' ? 'primary' :
                        inv.status === 'matched' ? 'warning' :
                        inv.status === 'rejected' || inv.status === 'cancelled' ? 'danger' : 'default'
                      } 
                      variant="flat"
                      className="capitalize"
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>

          <div className="mt-3 flex justify-end">
            <Pagination
              total={totalInvoicePages}
              page={invoicePageSafe}
              onChange={inventoryScreen.setInvoicePage}
              showControls
              size="sm"
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/** Inventory → Supplier invoices. Create, view, and match an invoice. */
export function SupplierInvoiceModals() {
  const inventoryScreen = useInventoryScreen();
  return (
  <>
        {/* Supplier Invoice — Create */}
        <Modal
          isOpen={inventoryScreen.isInvoiceModalOpen}
          onClose={() => {
            inventoryScreen.onInvoiceModalClose();
            inventoryScreen.setInvoiceFormData({ items: [] });
            inventoryScreen.setSelectedPOForInvoice(null);
          }}
          size="4xl"
          scrollBehavior="inside"
        >
          <ModalContent>
            <ModalHeader>
              {inventoryScreen.editingInvoice ? 'Edit Supplier Invoice' : 'Create Supplier Invoice'}
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-slate-500 -mt-1 mb-2">
                Pick a PO — lines fill from the order (and GRN qty when one exists). Then save for three-way match.
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Purchase Order"
                    placeholder="Select PO"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={inventoryScreen.invoiceFormData.poId ? new Set([inventoryScreen.invoiceFormData.poId]) : new Set()}
                    onSelectionChange={(keys) => {
                      if (keys === 'all') return;
                      const id = Array.from(keys)[0] as string | undefined;
                      if (id) inventoryScreen.handleInvoicePOChange(id);
                    }}
                    isRequired
                  >
                    {inventoryScreen.supplierStorePurchaseOrders
                      .filter((po) => ['confirmed', 'in-transit', 'delivered', 'closed'].includes(po.status))
                      .map((po) => (
                        <SelectItem key={po.id} textValue={`${po.poNumber} — ${po.supplierName}`}>
                          {po.poNumber} — {po.supplierName}
                        </SelectItem>
                      ))}
                  </Select>
                  <Input
                    label="Invoice #"
                    value={inventoryScreen.generateNextInvoiceNumber()}
                    isReadOnly
                    description="Assigned on save"
                    classNames={{ input: 'font-mono font-semibold' }}
                  />
                  <Input
                    label="Supplier"
                    value={inventoryScreen.invoiceFormData.supplierName || ''}
                    isReadOnly
                  />
                  <Input
                    label="Linked GRN"
                    value={inventoryScreen.invoiceFormData.grnNumber || 'None yet'}
                    isReadOnly
                  />
                  <PostingDateField
                    label="Invoice Date"
                    type="date"
                    value={
                      inventoryScreen.invoiceFormData.invoiceDate instanceof Date
                        ? inventoryScreen.invoiceFormData.invoiceDate.toISOString().split('T')[0]
                        : inventoryScreen.invoiceFormData.invoiceDate
                          ? new Date(inventoryScreen.invoiceFormData.invoiceDate).toISOString().split('T')[0]
                          : new Date().toISOString().split('T')[0]
                    }
                    onChange={(e) =>
                      inventoryScreen.setInvoiceFormData({ ...inventoryScreen.invoiceFormData, invoiceDate: new Date(e.target.value) })
                    }
                    isRequired
                  />
                  <Input
                    label="Due Date"
                    type="date"
                    value={
                      inventoryScreen.invoiceFormData.dueDate instanceof Date
                        ? inventoryScreen.invoiceFormData.dueDate.toISOString().split('T')[0]
                        : inventoryScreen.invoiceFormData.dueDate
                          ? new Date(inventoryScreen.invoiceFormData.dueDate).toISOString().split('T')[0]
                          : ''
                    }
                    onChange={(e) =>
                      inventoryScreen.setInvoiceFormData({ ...inventoryScreen.invoiceFormData, dueDate: new Date(e.target.value) })
                    }
                    isRequired
                  />
                </div>

                {(inventoryScreen.invoiceFormData.items || []).length > 0 && (
                  <>
                    <Divider />
                    <Table aria-label="Invoice lines">
                      <TableHeader>
                        <TableColumn>Item</TableColumn>
                        <TableColumn className="text-right">Qty</TableColumn>
                        <TableColumn className="text-right">Unit Price</TableColumn>
                        <TableColumn className="text-right">Total</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {(inventoryScreen.invoiceFormData.items || []).map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-mono text-sm font-semibold">{item.itemCode}</div>
                              <div className="text-xs text-gray-500">{item.itemName}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                size="sm"
                                className="max-w-[100px] ml-auto"
                                value={String(item.quantity)}
                                onChange={(e) => {
                                  const quantity = parseFloat(e.target.value) || 0;
                                  const items = [...(inventoryScreen.invoiceFormData.items || [])];
                                  items[index] = {
                                    ...item,
                                    quantity,
                                    totalPrice: quantity * item.unitPrice,
                                  };
                                  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
                                  const taxAmount = Number(inventoryScreen.invoiceFormData.taxAmount || 0);
                                  const shippingAmount = Number(inventoryScreen.invoiceFormData.shippingAmount || 0);
                                  const discountAmount = Number(inventoryScreen.invoiceFormData.discountAmount || 0);
                                  inventoryScreen.setInvoiceFormData({
                                    ...inventoryScreen.invoiceFormData,
                                    items,
                                    subtotal,
                                    totalAmount: subtotal + taxAmount + shippingAmount - discountAmount,
                                  });
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              ₵{Number(item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              ₵{Number(item.totalPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="tabular-nums">₵{Number(inventoryScreen.invoiceFormData.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span className="tabular-nums">₵{Number(inventoryScreen.invoiceFormData.taxAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base pt-1 border-t">
                        <span>Total</span>
                        <span className="tabular-nums">₵{Number(inventoryScreen.invoiceFormData.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </>
                )}

                <Textarea
                  label="Notes"
                  value={inventoryScreen.invoiceFormData.notes || ''}
                  onChange={(e) => inventoryScreen.setInvoiceFormData({ ...inventoryScreen.invoiceFormData, notes: e.target.value })}
                  minRows={2}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="bordered"
                onPress={() => {
                  inventoryScreen.onInvoiceModalClose();
                  inventoryScreen.setInvoiceFormData({ items: [] });
                  inventoryScreen.setSelectedPOForInvoice(null);
                }}
              >
                Cancel
              </Button>
              <Button color="primary" className="bg-ghana-gold text-white" onPress={inventoryScreen.handleSaveInvoice}>
                Save Invoice
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Supplier Invoice — View */}
        <Modal isOpen={inventoryScreen.isInvoiceViewOpen} onClose={inventoryScreen.onInvoiceViewClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              Invoice Details — {inventoryScreen.viewingInvoice?.invoiceNumber}
              <span className="block text-sm font-normal text-slate-500 mt-1">
                Review, then match / approve / pay from here.
              </span>
            </ModalHeader>
            <ModalBody>
              {inventoryScreen.viewingInvoice && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Invoice #</div>
                      <div className="font-mono font-semibold">{inventoryScreen.viewingInvoice.invoiceNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Status</div>
                      <Badge
                        color={
                          inventoryScreen.viewingInvoice.status === 'paid' ? 'success' :
                          inventoryScreen.viewingInvoice.status === 'approved' ? 'primary' :
                          inventoryScreen.viewingInvoice.status === 'matched' ? 'warning' :
                          inventoryScreen.viewingInvoice.status === 'rejected' || inventoryScreen.viewingInvoice.status === 'cancelled' ? 'danger' : 'default'
                        }
                        variant="flat"
                      >
                        {inventoryScreen.viewingInvoice.status}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Supplier</div>
                      <div className="font-semibold">{inventoryScreen.viewingInvoice.supplierName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">PO</div>
                      <div className="font-mono">{inventoryScreen.viewingInvoice.poNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">GRN</div>
                      <div className="font-mono">{inventoryScreen.viewingInvoice.grnNumber || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Total</div>
                      <div className="font-semibold tabular-nums">
                        ₵{Number(inventoryScreen.viewingInvoice.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <Divider />
                  <Table aria-label="Invoice items">
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn className="text-right">Qty</TableColumn>
                      <TableColumn className="text-right">Unit Price</TableColumn>
                      <TableColumn className="text-right">Total</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {inventoryScreen.viewingInvoice.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-mono text-sm">{item.itemCode}</div>
                            <div className="text-xs text-gray-500">{item.itemName}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            ₵{Number(item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            ₵{Number(item.totalPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {inventoryScreen.viewingInvoice.matchingStatus?.discrepancies?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                      <div className="font-semibold mb-1">Match notes</div>
                      <ul className="list-disc pl-5 space-y-0.5 text-amber-900">
                        {inventoryScreen.viewingInvoice.matchingStatus.discrepancies.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex flex-wrap gap-2">
              <Button variant="bordered" onPress={inventoryScreen.onInvoiceViewClose}>Close</Button>
              {inventoryScreen.viewingInvoice?.status === 'pending' && (
                <Button color="danger" variant="light" onPress={async () => {
                  const { confirmDelete } = await import('../DangerConfirm');
                  if (!(await confirmDelete(inventoryScreen.viewingInvoice.invoiceNumber, 'A draft supplier invoice will be permanently removed.'))) return;
                  useSupplierStore.setState((state) => ({ supplierInvoices: state.supplierInvoices.filter((inv) => inv.id !== inventoryScreen.viewingInvoice.id) }));
                  inventoryScreen.onInvoiceViewClose();
                }}>Delete</Button>
              )}
              {inventoryScreen.viewingInvoice?.status === 'void' && (
                <Button color="warning" variant="flat" onPress={async () => {
                  const { confirmUnvoid } = await import('../DangerConfirm');
                  if (!(await confirmUnvoid(inventoryScreen.viewingInvoice.invoiceNumber, 'The bill counts again.'))) return;
                  const next = (inventoryScreen.viewingInvoice as any).statusBeforeVoid || 'matched';
                  inventoryScreen.updateSupplierInvoice(inventoryScreen.viewingInvoice.id, { status: next });
                  inventoryScreen.setViewingInvoice({ ...inventoryScreen.viewingInvoice, status: next });
                }}>Unvoid</Button>
              )}
              {inventoryScreen.viewingInvoice && !['pending', 'void', 'rejected', 'cancelled'].includes(inventoryScreen.viewingInvoice.status) && (
                <Button color="warning" variant="flat" onPress={async () => {
                  const { confirmVoid } = await import('../DangerConfirm');
                  if (!(await confirmVoid(inventoryScreen.viewingInvoice.invoiceNumber, 'The bill stays on file as Void.'))) return;
                  const previous = inventoryScreen.viewingInvoice.status;
                  inventoryScreen.updateSupplierInvoice(inventoryScreen.viewingInvoice.id, { status: 'void', statusBeforeVoid: previous } as any);
                  inventoryScreen.setViewingInvoice({ ...inventoryScreen.viewingInvoice, status: 'void', statusBeforeVoid: previous } as any);
                }}>Void</Button>
              )}
              {inventoryScreen.viewingInvoice?.status === 'pending' && (
                <Button
                  color="warning"
                  variant="flat"
                  onPress={() => {
                    inventoryScreen.onInvoiceViewClose();
                    inventoryScreen.setMatchResult(null);
                    inventoryScreen.onThreeWayMatchOpen();
                  }}
                >
                  🔗 3-Way Match
                </Button>
              )}
              {inventoryScreen.viewingInvoice?.status === 'matched' && (
                <>
                  <Button
                    color="success"
                    onPress={async () => {
                      const { confirmChoice } = await import('../DangerConfirm');
                      if (!(await confirmChoice('Approve this invoice for payment?', 'The bill will be ready to pay.', 'Approve'))) return;
                      inventoryScreen.approveInvoice(inventoryScreen.viewingInvoice.id, inventoryScreen.currentUserName);
                      trackEvent('Stores.Issued', { action: 'approve_invoice', invoiceNumber: inventoryScreen.viewingInvoice.invoiceNumber });
                      inventoryScreen.setViewingInvoice({ ...inventoryScreen.viewingInvoice, status: 'approved' });
                    }}
                  >
                    ✓ Approve
                  </Button>
                  <Button
                    color="danger"
                    variant="flat"
                    onPress={() => {
                      const reason = prompt('Enter rejection reason:');
                      if (reason) {
                        inventoryScreen.rejectInvoice(inventoryScreen.viewingInvoice.id, inventoryScreen.currentUserName, reason);
                        trackEvent('Stores.Issued', { action: 'reject_invoice', invoiceNumber: inventoryScreen.viewingInvoice.invoiceNumber });
                        inventoryScreen.setViewingInvoice({ ...inventoryScreen.viewingInvoice, status: 'rejected' });
                      }
                    }}
                  >
                    ✗ Reject
                  </Button>
                </>
              )}
              {inventoryScreen.viewingInvoice?.status === 'approved' && (
                <Button
                  color="success"
                  onPress={() => {
                    const method = prompt('Enter payment method (e.g., Bank Transfer, Check, Cash):');
                    const ref = prompt('Enter payment reference:');
                    if (method && ref) {
                      inventoryScreen.markInvoicePaid(inventoryScreen.viewingInvoice.id, inventoryScreen.currentUserName, method, ref);
                      trackEvent('Stores.Issued', { action: 'mark_invoice_paid', invoiceNumber: inventoryScreen.viewingInvoice.invoiceNumber });
                      inventoryScreen.setViewingInvoice({ ...inventoryScreen.viewingInvoice, status: 'paid' });
                    }
                  }}
                >
                  💰 Mark Paid
                </Button>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Supplier Invoice — 3-Way Match */}
        <Modal
          isOpen={inventoryScreen.isThreeWayMatchOpen}
          onClose={() => {
            inventoryScreen.onThreeWayMatchClose();
            inventoryScreen.setMatchResult(null);
          }}
          size="lg"
        >
          <ModalContent>
            <ModalHeader>Three-Way Match — {inventoryScreen.viewingInvoice?.invoiceNumber}</ModalHeader>
            <ModalBody>
              <p className="text-sm text-slate-600 mb-3">
                Compares invoice lines to the PO and approved GRN (qty, price, totals).
              </p>
              {inventoryScreen.viewingInvoice && (
                <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">PO</div>
                    <div className="font-mono font-semibold">{inventoryScreen.viewingInvoice.poNumber}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">GRN</div>
                    <div className="font-mono font-semibold">{inventoryScreen.viewingInvoice.grnNumber || '—'}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Invoice total</div>
                    <div className="font-semibold tabular-nums">
                      ₵{Number(inventoryScreen.viewingInvoice.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              )}
              {inventoryScreen.matchResult && (
                <div
                  className={`rounded-lg p-3 text-sm border ${
                    inventoryScreen.matchResult.matched
                      ? 'bg-green-50 border-green-200 text-green-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="font-semibold mb-1">
                    {inventoryScreen.matchResult.matched ? '✓ Matched' : '⚠ Discrepancies found'}
                  </div>
                  {inventoryScreen.matchResult.discrepancies.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-0.5">
                      {inventoryScreen.matchResult.discrepancies.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>PO, GRN, and invoice line up.</p>
                  )}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                variant="bordered"
                onPress={() => {
                  inventoryScreen.onThreeWayMatchClose();
                  inventoryScreen.setMatchResult(null);
                }}
              >
                Close
              </Button>
              <Button color="warning" onPress={inventoryScreen.handleRunThreeWayMatch}>
                Run Match
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
  </>
  );
}
