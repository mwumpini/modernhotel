'use client';

import { Badge, Button, Card, CardBody, CardHeader, Chip, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs, Textarea } from '@heroui/react';
import { DEPARTMENT_LOCATIONS } from '../../lib/inventory/departmentLocations';
import { DESK_PAGE_SIZE, SortHeader, deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, toggleColumnSort } from '../dashboard/deskTableUi';
import { StockCountItem } from '../../lib/inventory/models';
import { deskBookTabsClassNames } from '../dashboard/deskTabsUi';
import { sizedTableClassNames } from '../frontoffice/columnResize';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { useSupplierStore } from '../../lib/inventory/supplierStore';
import { inventoryHeaders } from './inventoryHeaders';
import { useInventoryScreen } from './inventoryScreenContext';
import PostingDateField from '../shared/PostingDateField';

/** Inventory → Receive & Recon. Goods receipt and stock count lists. */
export function ReceiveAndReconTable() {
  const inventoryScreen = useInventoryScreen();
  const activeOpTab = inventoryScreen.stockOpSubTab === 'grn-management' ? 'goods-receipt' : inventoryScreen.stockOpSubTab;
  // Get POs ready for receipt (confirmed or in-transit)
  const posForReceipt = inventoryScreen.supplierStorePurchaseOrders.filter(po => 
    po.status === 'confirmed' || po.status === 'in-transit'
  );
  const receiptFiltered = posForReceipt.filter((po) =>
    po.poNumber.toLowerCase().includes(inventoryScreen.poSearchTerm.toLowerCase()) ||
    po.supplierName.toLowerCase().includes(inventoryScreen.poSearchTerm.toLowerCase())
  );
  const receiptDir = inventoryScreen.receiptSort.direction === 'asc' ? 1 : -1;
  const receiptMs = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();
  const receiptSorted = [...receiptFiltered].sort((a, b) => {
    switch (inventoryScreen.receiptSort.column) {
      case 'supplier': return a.supplierName.localeCompare(b.supplierName) * receiptDir;
      case 'ordered': return (receiptMs(a.orderDate) - receiptMs(b.orderDate)) * receiptDir;
      case 'expected': return (receiptMs(a.expectedDeliveryDate) - receiptMs(b.expectedDeliveryDate)) * receiptDir;
      case 'lines': return (a.items.length - b.items.length) * receiptDir;
      case 'status': return a.status.localeCompare(b.status) * receiptDir;
      case 'number':
      default: return a.poNumber.localeCompare(b.poNumber) * receiptDir;
    }
  });
  const receiptPages = Math.max(1, Math.ceil(receiptSorted.length / DESK_PAGE_SIZE));
  const receiptPageSafe = Math.min(inventoryScreen.receiptPage, receiptPages);
  const receiptPaged = receiptSorted.slice((receiptPageSafe - 1) * DESK_PAGE_SIZE, receiptPageSafe * DESK_PAGE_SIZE);

  const countFiltered = inventoryScreen.stockCounts.filter((c) =>
    (inventoryScreen.stockCountSearchTerm === '' ||
      c.countNumber.toLowerCase().includes(inventoryScreen.stockCountSearchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(inventoryScreen.stockCountSearchTerm.toLowerCase())) &&
    (inventoryScreen.stockCountFilterStatus === 'all' || c.status === inventoryScreen.stockCountFilterStatus)
  );
  const countDir = inventoryScreen.countSort.direction === 'asc' ? 1 : -1;
  const countMs = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();
  const countSorted = [...countFiltered].sort((a, b) => {
    switch (inventoryScreen.countSort.column) {
      case 'type': return a.countType.localeCompare(b.countType) * countDir;
      case 'location': return a.location.localeCompare(b.location) * countDir;
      case 'started': return (countMs(a.startDate) - countMs(b.startDate)) * countDir;
      case 'lines': return (a.items.length - b.items.length) * countDir;
      case 'variance': return (a.varianceItems - b.varianceItems) * countDir;
      case 'status': return a.status.localeCompare(b.status) * countDir;
      case 'number':
      default: return a.countNumber.localeCompare(b.countNumber) * countDir;
    }
  });
  const countPages = Math.max(1, Math.ceil(countSorted.length / DESK_PAGE_SIZE));
  const countPageSafe = Math.min(inventoryScreen.countPage, countPages);
  const countPaged = countSorted.slice((countPageSafe - 1) * DESK_PAGE_SIZE, countPageSafe * DESK_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <Tabs
        selectedKey={activeOpTab}
        onSelectionChange={(key) => inventoryScreen.setStockOpSubTab(key as string)}
        className="w-full"
        size="sm"
        variant="solid"
        classNames={deskBookTabsClassNames}
        aria-label="Receive and recon sections"
      >
        <Tab key="goods-receipt" title="📥 Goods Receipt" />
        <Tab key="stock-counts" title="🔍 Stock Count" />
      </Tabs>

      {activeOpTab === 'goods-receipt' && (
        <div className="space-y-6">
          <Card className={deskTableCardClassName}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between w-full">
                <div>
                  <h3 className="text-xl font-semibold text-ghana-black">📥 Goods Receipt</h3>
                  <p className="text-sm text-gray-500">Receive against confirmed / in-transit POs — QC follows in the receipt view</p>
                </div>
                <Badge color="primary" variant="flat">{posForReceipt.length} ready</Badge>
              </div>
            </CardHeader>
            <CardBody className={deskTableCardBodyClassName}>
              <div className="mb-6">
                <Input
                  placeholder="Search PO # or supplier..."
                  value={inventoryScreen.poSearchTerm}
                  onChange={(e) => { inventoryScreen.setPOSearchTerm(e.target.value); inventoryScreen.setReceiptPage(1); }}
                  startContent={<span className="text-gray-400">🔍</span>}
                />
              </div>
              <div ref={inventoryScreen.receiptCols.frameRef} style={inventoryScreen.receiptCols.frameStyle}>
              <Table aria-label="POs ready for receipt" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
                <TableHeader>
                  <TableColumn className="relative" style={inventoryScreen.receiptCols.style('number')}>{<SortHeader label="PO #" column="number" sort={inventoryScreen.receiptSort} onSort={(column) => inventoryScreen.setReceiptSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.receiptCols.sizer('number', 'PO #')}</TableColumn>
                  <TableColumn className="relative" style={inventoryScreen.receiptCols.style('supplier')}>{<SortHeader label="Supplier" column="supplier" sort={inventoryScreen.receiptSort} onSort={(column) => inventoryScreen.setReceiptSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.receiptCols.sizer('supplier', 'Supplier')}</TableColumn>
                  <TableColumn className="relative" style={inventoryScreen.receiptCols.style('ordered')}>{<SortHeader label="Ordered" column="ordered" sort={inventoryScreen.receiptSort} onSort={(column) => inventoryScreen.setReceiptSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.receiptCols.sizer('ordered', 'Ordered')}</TableColumn>
                  <TableColumn className="relative" style={inventoryScreen.receiptCols.style('expected')}>{<SortHeader label="Expected" column="expected" sort={inventoryScreen.receiptSort} onSort={(column) => inventoryScreen.setReceiptSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.receiptCols.sizer('expected', 'Expected')}</TableColumn>
                  <TableColumn className="relative" style={inventoryScreen.receiptCols.style('lines')}>{<SortHeader label="Lines" column="lines" sort={inventoryScreen.receiptSort} onSort={(column) => inventoryScreen.setReceiptSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.receiptCols.sizer('lines', 'Lines')}</TableColumn>
                  <TableColumn className="relative" style={inventoryScreen.receiptCols.style('status')}>{<SortHeader label="Status" column="status" sort={inventoryScreen.receiptSort} onSort={(column) => inventoryScreen.setReceiptSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.receiptCols.sizer('status', 'Status')}</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No POs ready. Confirm a purchase order first.">
                  {receiptPaged.map((po) => (
                      <TableRow
                        key={po.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => inventoryScreen.handleOpenGoodsReceipt(po)}
                      >
                        <TableCell>
                          <span className="text-gray-600 whitespace-nowrap">{po.poNumber}</span>
                        </TableCell>
                        <TableCell className="truncate max-w-[160px]" title={po.supplierName}>{po.supplierName}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {po.orderDate instanceof Date ? po.orderDate.toLocaleDateString() : new Date(po.orderDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {po.expectedDeliveryDate instanceof Date ? po.expectedDeliveryDate.toLocaleDateString() : new Date(po.expectedDeliveryDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className="block text-right tabular-nums">{po.items.length}</span>
                        </TableCell>
                        <TableCell>
                          <Badge color={po.status === 'confirmed' ? 'warning' : 'primary'} size="sm" variant="flat" className="capitalize">
                            {po.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              </div>
              <div className="mt-3 flex justify-end">
                <Pagination page={receiptPageSafe} total={receiptPages} onChange={inventoryScreen.setReceiptPage} showControls size="sm" />
              </div>
            </CardBody>
          </Card>

          {(() => {
            const pendingGrns = inventoryScreen.goodsReceiptNotes
              .filter((g) => g.status === 'pending' || g.status === 'quality-check')
              .sort((a, b) => {
                const ta = a.receiptDate instanceof Date ? a.receiptDate.getTime() : new Date(a.receiptDate).getTime();
                const tb = b.receiptDate instanceof Date ? b.receiptDate.getTime() : new Date(b.receiptDate).getTime();
                return tb - ta;
              });
            if (pendingGrns.length === 0) return null;
            return (
              <Card className={deskTableCardClassName}>
                <CardHeader className="pb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-ghana-black">Awaiting QC / Approve</h3>
                    <p className="text-sm text-gray-500">Receipts created — finish quality check, then approve</p>
                  </div>
                </CardHeader>
                <CardBody className={deskTableCardBodyClassName}>
                  <Table aria-label="GRNs awaiting QC" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
                    <TableHeader>
                      <TableColumn>GRN</TableColumn>
                      <TableColumn>PO</TableColumn>
                      <TableColumn>Supplier</TableColumn>
                      <TableColumn>Received</TableColumn>
                      <TableColumn>Status</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {pendingGrns.map((grn) => (
                        <TableRow
                          key={grn.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                            inventoryScreen.setViewingGRN(grn);
                            inventoryScreen.onGRNViewOpen();
                          }}
                        >
                          <TableCell>
                            <span className="text-gray-600 whitespace-nowrap font-mono">{grn.grnNumber}</span>
                          </TableCell>
                          <TableCell className="font-mono whitespace-nowrap">{grn.poNumber}</TableCell>
                          <TableCell className="truncate max-w-[160px]" title={grn.supplierName}>{grn.supplierName}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {grn.receiptDate instanceof Date
                              ? grn.receiptDate.toLocaleDateString()
                              : new Date(grn.receiptDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              color={grn.status === 'quality-check' ? 'primary' : 'warning'}
                              size="sm"
                              variant="flat"
                              className="capitalize"
                            >
                              {grn.status.replace('-', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
            );
          })()}
        </div>
      )}

      {activeOpTab === 'stock-counts' && (
        <div className="space-y-6">
          <Card className={deskTableCardClassName}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between w-full">
                <div>
                  <h3 className="text-xl font-semibold text-ghana-black">🔍 Stock Count</h3>
                </div>
                {inventoryScreen.canRunStockCount && (
                  <Button color="primary" className="bg-ghana-gold text-white" variant="flat" onPress={inventoryScreen.handleAddStockCount}>
                    + New Count
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody className={deskTableCardBodyClassName}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Input
                  placeholder="Search count # or location..."
                  value={inventoryScreen.stockCountSearchTerm}
                  onChange={(e) => { inventoryScreen.setStockCountSearchTerm(e.target.value); inventoryScreen.setCountPage(1); }}
                  startContent={<span className="text-gray-400">🔍</span>}
                  className="md:col-span-2"
                />
                <Select
                  selectedKeys={[inventoryScreen.stockCountFilterStatus]}
                  onSelectionChange={(keys) => { inventoryScreen.setStockCountFilterStatus(Array.from(keys)[0] as string); inventoryScreen.setCountPage(1); }}
                >
                  <SelectItem key="all">All Status</SelectItem>
                  <SelectItem key="planned">Planned</SelectItem>
                  <SelectItem key="in-progress">In Progress</SelectItem>
                  <SelectItem key="completed">Completed</SelectItem>
                  <SelectItem key="cancelled">Cancelled</SelectItem>
                </Select>
              </div>
              <div ref={inventoryScreen.countCols.frameRef} style={inventoryScreen.countCols.frameStyle}>
              <Table aria-label="Stock counts" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
                <TableHeader>
                  <TableColumn className="relative" style={inventoryScreen.countCols.style('number')}>{<SortHeader label="Count #" column="number" sort={inventoryScreen.countSort} onSort={(column) => inventoryScreen.setCountSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.countCols.sizer('number', 'Count #')}</TableColumn>
                  <TableColumn className="relative" style={inventoryScreen.countCols.style('type')}>{<SortHeader label="Type" column="type" sort={inventoryScreen.countSort} onSort={(column) => inventoryScreen.setCountSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.countCols.sizer('type', 'Type')}</TableColumn>
                  <TableColumn className="relative" style={inventoryScreen.countCols.style('location')}>{<SortHeader label="Location" column="location" sort={inventoryScreen.countSort} onSort={(column) => inventoryScreen.setCountSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.countCols.sizer('location', 'Location')}</TableColumn>
                  <TableColumn className="relative" style={inventoryScreen.countCols.style('started')}>{<SortHeader label="Started" column="started" sort={inventoryScreen.countSort} onSort={(column) => inventoryScreen.setCountSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.countCols.sizer('started', 'Started')}</TableColumn>
                  <TableColumn className="relative" style={inventoryScreen.countCols.style('lines')}>{<SortHeader label="Lines" column="lines" sort={inventoryScreen.countSort} onSort={(column) => inventoryScreen.setCountSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.countCols.sizer('lines', 'Lines')}</TableColumn>
                  <TableColumn className="relative" style={inventoryScreen.countCols.style('variance')}>{<SortHeader label="Δ" column="variance" sort={inventoryScreen.countSort} onSort={(column) => inventoryScreen.setCountSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.countCols.sizer('variance', 'Variance')}</TableColumn>
                  <TableColumn className="relative" style={inventoryScreen.countCols.style('status')}>{<SortHeader label="Status" column="status" sort={inventoryScreen.countSort} onSort={(column) => inventoryScreen.setCountSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.countCols.sizer('status', 'Status')}</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No counts yet. Create one to reconcile a location.">
                  {countPaged.map((count) => (
                      <TableRow
                        key={count.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => {
                          inventoryScreen.setViewingStockCount(count);
                          inventoryScreen.onStockCountViewOpen();
                        }}
                      >
                        <TableCell>
                          <span className="text-gray-600 whitespace-nowrap">{count.countNumber}</span>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" className="capitalize">{count.countType}</Chip>
                        </TableCell>
                        <TableCell className="truncate max-w-[140px]" title={count.location}>{count.location}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {count.startDate instanceof Date ? count.startDate.toLocaleDateString() : new Date(count.startDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className="block text-right tabular-nums">{count.items.length}</span>
                        </TableCell>
                        <TableCell className={count.varianceItems > 0 ? 'font-semibold text-orange-600' : ''}>
                          <span className="block text-right tabular-nums">{count.varianceItems}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            color={
                              count.status === 'completed' ? 'success' :
                              count.status === 'in-progress' ? 'warning' :
                              count.status === 'cancelled' ? 'danger' : 'default'
                            }
                            size="sm"
                            variant="flat"
                            className="capitalize"
                          >
                            {count.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              </div>
              <div className="mt-3 flex justify-end">
                <Pagination page={countPageSafe} total={countPages} onChange={inventoryScreen.setCountPage} showControls size="sm" />
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Inventory → Receive & Recon. Goods receipt and quality check dialogs. */
export function GoodsReceiptModals() {
  const inventoryScreen = useInventoryScreen();
  return (
  <>
        {/* Stock Operations Modals */}
        {/* Goods Receipt Modal */}
        <Modal isOpen={inventoryScreen.isGoodsReceiptOpen} onClose={inventoryScreen.onGoodsReceiptClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              Receive Goods
              <span className="block text-sm font-normal text-slate-500 mt-1 font-mono">
                {inventoryScreen.selectedPOForReceipt?.poNumber} · GRN # assigned on save
              </span>
            </ModalHeader>
            <ModalBody>
              {inventoryScreen.selectedPOForReceipt && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Supplier</div>
                      <div className="font-semibold">{inventoryScreen.selectedPOForReceipt.supplierName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Order Date</div>
                      <div>{inventoryScreen.selectedPOForReceipt.orderDate instanceof Date ? inventoryScreen.selectedPOForReceipt.orderDate.toLocaleDateString() : new Date(inventoryScreen.selectedPOForReceipt.orderDate).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <Divider />

                  <div>
                    <h4 className="font-semibold mb-2">This shipment</h4>
                    <Table>
                      <TableHeader>
                        <TableColumn>Item</TableColumn>
                        <TableColumn>Ordered</TableColumn>
                        <TableColumn>Already</TableColumn>
                        <TableColumn>Receive Now</TableColumn>
                        <TableColumn>Batch / Expiry</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {inventoryScreen.receiptItems.map((item, index) => {
                          const remaining = Math.max(0, item.orderedQty - item.alreadyReceived);
                          return (
                            <TableRow key={item.itemId}>
                              <TableCell>
                                <div className="font-mono text-sm font-semibold">{item.itemCode}</div>
                                <div className="text-sm text-gray-500">{item.itemName}</div>
                              </TableCell>
                              <TableCell>
                                <div>{item.orderedQty}</div>
                                <div className="text-xs text-gray-500">₵{item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{item.alreadyReceived}</div>
                                <div className="text-xs text-gray-400">left {remaining}</div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={String(item.receiveNow)}
                                  onChange={(e) => {
                                    const newQty = Math.min(Math.max(0, parseInt(e.target.value) || 0), remaining);
                                    const updatedItems = [...inventoryScreen.receiptItems];
                                    updatedItems[index] = { ...item, receiveNow: newQty };
                                    inventoryScreen.setReceiptItems(updatedItems);
                                  }}
                                  min={0}
                                  max={remaining}
                                  size="sm"
                                  isDisabled={remaining === 0}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  placeholder="Batch #"
                                  value={item.batchNumber || ''}
                                  onChange={(e) => {
                                    const updatedItems = [...inventoryScreen.receiptItems];
                                    updatedItems[index] = { ...item, batchNumber: e.target.value };
                                    inventoryScreen.setReceiptItems(updatedItems);
                                  }}
                                  size="sm"
                                  className="mb-1"
                                />
                                <Input
                                  type="date"
                                  value={item.expiryDate ? (item.expiryDate instanceof Date ? item.expiryDate.toISOString().split('T')[0] : new Date(item.expiryDate).toISOString().split('T')[0]) : ''}
                                  onChange={(e) => {
                                    const updatedItems = [...inventoryScreen.receiptItems];
                                    updatedItems[index] = { ...item, expiryDate: e.target.value ? new Date(e.target.value) : undefined };
                                    inventoryScreen.setReceiptItems(updatedItems);
                                  }}
                                  size="sm"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="bordered" onPress={inventoryScreen.onGoodsReceiptClose}>Cancel</Button>
              <Button color="primary" className="bg-ghana-green text-white" onPress={inventoryScreen.handleReceiveGoods}>
                Receive & Create GRN
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* GRN View Modal */}
        <Modal isOpen={inventoryScreen.isGRNViewOpen} onClose={inventoryScreen.onGRNViewClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              <div>
                <div className="text-xl font-semibold">GRN Details</div>
                <div className="text-sm text-gray-500 font-mono">{inventoryScreen.viewingGRN?.grnNumber}</div>
              </div>
            </ModalHeader>
            <ModalBody>
              {inventoryScreen.viewingGRN && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">PO</div>
                      <div className="font-mono font-semibold">{inventoryScreen.viewingGRN.poNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Supplier</div>
                      <div className="font-semibold">{inventoryScreen.viewingGRN.supplierName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Receipt Date</div>
                      <div>{inventoryScreen.viewingGRN.receiptDate instanceof Date ? inventoryScreen.viewingGRN.receiptDate.toLocaleDateString() : new Date(inventoryScreen.viewingGRN.receiptDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Status</div>
                      <Badge
                        color={
                          inventoryScreen.viewingGRN.status === 'approved' || inventoryScreen.viewingGRN.status === 'completed' ? 'success' :
                          inventoryScreen.viewingGRN.status === 'quality-check' ? 'primary' :
                          inventoryScreen.viewingGRN.status === 'rejected' ? 'danger' : 'warning'
                        }
                        variant="flat"
                        className="capitalize"
                      >
                        {inventoryScreen.viewingGRN.status.replace('-', ' ')}
                      </Badge>
                      {inventoryScreen.viewingGRN.qualityStatus && (
                        <span className="ml-2 text-sm text-slate-500">QC: {inventoryScreen.viewingGRN.qualityStatus}</span>
                      )}
                    </div>
                  </div>
                  <Divider />
                  <Table>
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn>Ordered</TableColumn>
                      <TableColumn>Received</TableColumn>
                      <TableColumn className="text-right">Value</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {inventoryScreen.viewingGRN.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-mono text-sm">{item.itemCode}</div>
                            <div className="text-sm text-gray-500">{item.itemName}</div>
                          </TableCell>
                          <TableCell>{item.orderedQuantity}</TableCell>
                          <TableCell>{item.receivedQuantity}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ₵{item.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between bg-gray-50 p-3 rounded-lg">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold">
                      ₵{inventoryScreen.viewingGRN.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex flex-wrap gap-2">
              <Button variant="bordered" onPress={inventoryScreen.onGRNViewClose}>Close</Button>
              {inventoryScreen.viewingGRN?.status === 'pending' && (
                <Button color="danger" variant="light" onPress={async () => {
                  const { confirmDelete } = await import('../DangerConfirm');
                  if (!(await confirmDelete(inventoryScreen.viewingGRN.grnNumber, 'A receipt that was never approved will be permanently removed.'))) return;
                  useSupplierStore.setState((state) => ({ goodsReceiptNotes: state.goodsReceiptNotes.filter((g) => g.id !== inventoryScreen.viewingGRN.id) }));
                  inventoryScreen.onGRNViewClose();
                }}>Delete</Button>
              )}
              {inventoryScreen.viewingGRN && inventoryScreen.viewingGRN.status !== 'pending' && inventoryScreen.viewingGRN.status !== 'void' && inventoryScreen.viewingGRN.status !== 'rejected' && (
                <Button color="warning" variant="flat" onPress={async () => {
                  const { confirmVoid } = await import('../DangerConfirm');
                  if (!(await confirmVoid(inventoryScreen.viewingGRN.grnNumber, 'The receipt stays on file as Void. A reversing journal entry keeps the books even.'))) return;
                  try {
                    const { useAccountingStore } = await import('../../lib/accounting/store');
                    const entry = useAccountingStore.getState().journalEntries.find((e) => e.id === `JE-GRN-${inventoryScreen.viewingGRN.id}` || e.sourceTransactionId === inventoryScreen.viewingGRN.id);
                    if (entry && entry.status === 'Posted') await useAccountingStore.getState().voidJournalEntry(entry.id);
                  } catch {}
                  inventoryScreen.updateGRN(inventoryScreen.viewingGRN.id, { status: 'void' });
                  inventoryScreen.setViewingGRN({ ...inventoryScreen.viewingGRN, status: 'void' });
                }}>Void</Button>
              )}
              {inventoryScreen.viewingGRN?.status === 'pending' && (
                <Button
                  color="warning"
                  onPress={() => {
                    inventoryScreen.onGRNViewClose();
                    inventoryScreen.openQualityCheck(inventoryScreen.viewingGRN);
                  }}
                >
                  🔍 Quality Check
                </Button>
              )}
              {inventoryScreen.viewingGRN?.status === 'quality-check' && (
                <>
                  <Button
                    color="success"
                    onPress={async () => {
                      const { confirmChoice } = await import('../DangerConfirm');
                      if (!(await confirmChoice('Approve this receipt?', 'This posts the goods into stock and the amount into accounts payable.', 'Approve'))) return;
                      inventoryScreen.approveGRN(inventoryScreen.viewingGRN.id, inventoryScreen.currentUserName);
                      inventoryScreen.setViewingGRN(inventoryScreen.getGRN(inventoryScreen.viewingGRN.id) || { ...inventoryScreen.viewingGRN, status: 'approved' });
                      trackEvent('Stores.Issued', { action: 'approve_grn', grnNumber: inventoryScreen.viewingGRN.grnNumber });
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
                        inventoryScreen.rejectGRN(inventoryScreen.viewingGRN.id, inventoryScreen.currentUserName, reason);
                        inventoryScreen.setViewingGRN(inventoryScreen.getGRN(inventoryScreen.viewingGRN.id) || { ...inventoryScreen.viewingGRN, status: 'rejected' });
                        trackEvent('Stores.Issued', { action: 'reject_grn', grnNumber: inventoryScreen.viewingGRN.grnNumber });
                      }
                    }}
                  >
                    ✗ Reject
                  </Button>
                </>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Quality Check Modal */}
        <Modal isOpen={inventoryScreen.isQualityCheckOpen} onClose={inventoryScreen.onQualityCheckClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              Quality Check
              <span className="block text-sm font-normal text-slate-500 mt-1 font-mono">
                {inventoryScreen.selectedGRNForQC?.grnNumber}
              </span>
            </ModalHeader>
            <ModalBody>
              {inventoryScreen.selectedGRNForQC && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">
                    Mark failed qty per line. Zero failed = pass. Completing QC unlocks Approve on the GRN.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableColumn>Item</TableColumn>
                      <TableColumn>Received</TableColumn>
                      <TableColumn>Failed Qty</TableColumn>
                      <TableColumn>Reason</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {(inventoryScreen.qualityCheckFormData.items || []).map((item: any, index: number) => (
                        <TableRow key={item.id || index}>
                          <TableCell>
                            <div className="font-mono text-sm">{item.itemCode}</div>
                            <div className="text-sm text-gray-500">{item.itemName}</div>
                          </TableCell>
                          <TableCell>{item.receivedQuantity}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              size="sm"
                              min={0}
                              max={item.receivedQuantity}
                              value={String(item.failedQuantity || 0)}
                              onChange={(e) => {
                                const failed = Math.min(Math.max(0, parseInt(e.target.value) || 0), item.receivedQuantity);
                                const items = [...(inventoryScreen.qualityCheckFormData.items || [])];
                                items[index] = { ...item, failedQuantity: failed, checkedQuantity: item.receivedQuantity };
                                inventoryScreen.setQualityCheckFormData({ ...inventoryScreen.qualityCheckFormData, items });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              size="sm"
                              placeholder="If failed…"
                              value={item.failureReason || ''}
                              onChange={(e) => {
                                const items = [...(inventoryScreen.qualityCheckFormData.items || [])];
                                items[index] = { ...item, failureReason: e.target.value };
                                inventoryScreen.setQualityCheckFormData({ ...inventoryScreen.qualityCheckFormData, items });
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Textarea
                    label="Notes"
                    value={inventoryScreen.qualityCheckFormData.notes || ''}
                    onChange={(e) => inventoryScreen.setQualityCheckFormData({ ...inventoryScreen.qualityCheckFormData, notes: e.target.value })}
                  />
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="bordered" onPress={inventoryScreen.onQualityCheckClose}>Cancel</Button>
              <Button color="primary" className="bg-ghana-gold text-white" onPress={inventoryScreen.handleSubmitQualityCheck}>
                Submit QC
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}

/** Inventory → Receive & Recon. Create or edit a stock count. */
export function StockCountModal() {
  const inventoryScreen = useInventoryScreen();
  return (
  <>
        {/* Stock Count Modal */}
        <Modal isOpen={inventoryScreen.isStockCountOpen} onClose={inventoryScreen.onStockCountClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              {inventoryScreen.editingStockCount ? 'Edit Stock Count' : 'Create Stock Count'}
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Count #"
                    value={inventoryScreen.stockCountFormData.countNumber || ''}
                    isReadOnly
                    description="Auto from Settings → Document Numbering → Stock Count"
                    classNames={{ input: 'font-mono font-semibold' }}
                  />
                  <Select
                    label="Count Type"
                    selectedKeys={inventoryScreen.stockCountFormData.countType ? [inventoryScreen.stockCountFormData.countType] : ['full']}
                    onSelectionChange={(keys) => inventoryScreen.setStockCountFormData({
                      ...inventoryScreen.stockCountFormData,
                      countType: Array.from(keys)[0] as 'full' | 'cycle' | 'spot' | 'random'
                    })}
                  >
                    <SelectItem key="full">Full Count</SelectItem>
                    <SelectItem key="cycle">Cycle Count</SelectItem>
                    <SelectItem key="spot">Spot Count</SelectItem>
                    <SelectItem key="random">Random Count</SelectItem>
                  </Select>
                  <Select
                    label="Location"
                    selectedKeys={inventoryScreen.stockCountFormData.location ? [inventoryScreen.stockCountFormData.location] : []}
                    onSelectionChange={async (keys) => {
                      const selectedLocation = Array.from(keys)[0] as string;
                      const selectedMasterLoc = inventoryScreen.masterLocations.find((l) => l.name === selectedLocation);
                      const deptEntry = (selectedMasterLoc?.department && DEPARTMENT_LOCATIONS[selectedMasterLoc.department])
                        ? [selectedMasterLoc.department, DEPARTMENT_LOCATIONS[selectedMasterLoc.department]] as const
                        : Object.entries(DEPARTMENT_LOCATIONS).find(([, loc]) => loc.name === selectedLocation);
                      let lines: StockCountItem[] = [];
                      if (deptEntry) {
                        try {
                          const res = await fetch(
                            `/api/inventory/stock-levels?department=${encodeURIComponent(deptEntry[0])}`,
                            { headers: inventoryHeaders(), cache: 'no-store' },
                          );
                          if (res.ok) {
                            const data = await res.json();
                            lines = (data.items || [])
                              .filter((item: any) => Number(item.onHand || 0) > 0)
                              .map((item: any) => ({
                                id: Date.now().toString() + Math.random(),
                                itemId: item.id,
                                itemCode: item.code,
                                itemName: item.name,
                                expectedQuantity: Number(item.onHand || 0),
                                countedQuantity: Number(item.onHand || 0),
                                variance: 0,
                                unitCost: Number(item.defaultCost || 0),
                                varianceValue: 0,
                              }));
                          }
                        } catch {
                          lines = [];
                        }
                      } else {
                        lines = inventoryScreen.stockItems
                          .filter((i) => i.location === selectedLocation)
                          .map((item) => ({
                            id: Date.now().toString() + Math.random(),
                            itemId: item.id,
                            itemCode: item.itemCode,
                            itemName: item.name,
                            expectedQuantity: item.currentStock,
                            countedQuantity: item.currentStock,
                            variance: 0,
                            unitCost: item.unitCost,
                            varianceValue: 0,
                          }));
                      }
                      inventoryScreen.setStockCountFormData({
                        ...inventoryScreen.stockCountFormData,
                        location: selectedLocation,
                        items: lines,
                      });
                    }}
                    isRequired
                  >
                    <>
                      {inventoryScreen.availableLocations.map((loc) => (
                        <SelectItem key={loc}>{loc}</SelectItem>
                      ))}
                    </>
                  </Select>
                  <PostingDateField
                    label="Start Date"
                    type="date"
                    value={inventoryScreen.stockCountFormData.startDate instanceof Date
                      ? inventoryScreen.stockCountFormData.startDate.toISOString().split('T')[0]
                      : inventoryScreen.stockCountFormData.startDate
                        ? new Date(inventoryScreen.stockCountFormData.startDate).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0]}
                    onChange={(e) => inventoryScreen.setStockCountFormData({
                      ...inventoryScreen.stockCountFormData,
                      startDate: new Date(e.target.value)
                    })}
                  />
                </div>

                {inventoryScreen.stockCountFormData.items && inventoryScreen.stockCountFormData.items.length > 0 ? (
                  <>
                    <Divider />
                    <div>
                      <h4 className="font-semibold mb-2">Count lines ({inventoryScreen.stockCountFormData.items.length})</h4>
                      <Table>
                        <TableHeader>
                          <TableColumn>Item</TableColumn>
                          <TableColumn>Book</TableColumn>
                          <TableColumn>Counted</TableColumn>
                          <TableColumn>Δ</TableColumn>
                          <TableColumn className="text-right">Δ Value</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {inventoryScreen.stockCountFormData.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="font-mono text-sm font-semibold">{item.itemCode}</div>
                                <div className="text-sm text-gray-500">{item.itemName}</div>
                              </TableCell>
                              <TableCell className="font-semibold">{item.expectedQuantity}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={String(item.countedQuantity)}
                                  onChange={(e) => {
                                    const counted = parseInt(e.target.value) || 0;
                                    const variance = counted - item.expectedQuantity;
                                    const updatedItems = (inventoryScreen.stockCountFormData.items || []).map((i) =>
                                      i.id === item.id
                                        ? {
                                            ...i,
                                            countedQuantity: counted,
                                            variance,
                                            varianceValue: Math.abs(variance * i.unitCost)
                                          }
                                        : i
                                    );
                                    inventoryScreen.setStockCountFormData({ ...inventoryScreen.stockCountFormData, items: updatedItems });
                                  }}
                                  size="sm"
                                  min="0"
                                />
                              </TableCell>
                              <TableCell>
                                <div className={`font-semibold ${item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                  {item.variance > 0 ? '+' : ''}{item.variance}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {item.varianceValue > 0 ? `₵${item.varianceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-amber-600">Select a location to load items for counting.</p>
                )}

                <Textarea
                  label="Notes"
                  value={inventoryScreen.stockCountFormData.notes || ''}
                  onChange={(e) => inventoryScreen.setStockCountFormData({ ...inventoryScreen.stockCountFormData, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="bordered" onPress={inventoryScreen.onStockCountClose}>Cancel</Button>
              <Button color="primary" className="bg-ghana-gold text-white" onPress={inventoryScreen.handleSaveStockCount}>
                {inventoryScreen.editingStockCount ? 'Update' : 'Save'} Count
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}

/** Inventory → Receive & Recon. View a stock count. */
export function StockCountViewModal() {
  const inventoryScreen = useInventoryScreen();
  return (
  <>
        {/* Stock Count View Modal */}
        <Modal isOpen={inventoryScreen.isStockCountViewOpen} onClose={inventoryScreen.onStockCountViewClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xl font-semibold">Stock Count Details</div>
                <div className="text-sm text-gray-500 font-mono">{inventoryScreen.viewingStockCount?.countNumber}</div>
              </div>
              {inventoryScreen.viewingStockCount && (
                <div className="flex flex-wrap items-center gap-1 border-b border-default-200 pb-0.5" role="tablist" aria-label="Stock count actions">
                  {inventoryScreen.canPrintInventoryDocs && (
                    <Button size="sm" variant="light" className="min-w-16 h-8 rounded-none border-b-2 border-transparent data-[hover=true]:border-primary" onPress={() => inventoryScreen.handlePrintStockCount(inventoryScreen.viewingStockCount)}>
                      Print
                    </Button>
                  )}
                  {inventoryScreen.canEditInventoryDocs && (
                    <Button
                      size="sm"
                      variant="light"
                      className="min-w-16 h-8 rounded-none border-b-2 border-transparent data-[hover=true]:border-primary"
                      isDisabled={inventoryScreen.viewingStockCount.status === 'completed' || inventoryScreen.viewingStockCount.status === 'cancelled'}
                      onPress={() => inventoryScreen.handleEditStockCountFromView(inventoryScreen.viewingStockCount)}
                    >
                      Edit
                    </Button>
                  )}
                  {inventoryScreen.canDeleteInventoryDocs && (
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      className="min-w-16 h-8 rounded-none border-b-2 border-transparent data-[hover=true]:border-danger"
                      isDisabled={inventoryScreen.viewingStockCount.status === 'completed'}
                      onPress={() => inventoryScreen.handleDeleteStockCount(inventoryScreen.viewingStockCount)}
                    >
                      Delete
                    </Button>
                  )}
                  {inventoryScreen.canVoidInventoryDocs && (
                    <Button
                      size="sm"
                      variant="light"
                      color="warning"
                      className="min-w-16 h-8 rounded-none border-b-2 border-transparent data-[hover=true]:border-warning"
                      isDisabled={inventoryScreen.viewingStockCount.status === 'completed' || inventoryScreen.viewingStockCount.status === 'cancelled'}
                      onPress={() => inventoryScreen.handleVoidStockCount(inventoryScreen.viewingStockCount)}
                    >
                      Void
                    </Button>
                  )}
                </div>
              )}
            </ModalHeader>
            <ModalBody>
              {inventoryScreen.viewingStockCount && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Count Type</div>
                      <Chip size="sm" variant="flat">{inventoryScreen.viewingStockCount.countType}</Chip>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Location</div>
                      <div className="font-semibold">{inventoryScreen.viewingStockCount.location}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Start Date</div>
                      <div>{inventoryScreen.viewingStockCount.startDate instanceof Date ? inventoryScreen.viewingStockCount.startDate.toLocaleDateString() : new Date(inventoryScreen.viewingStockCount.startDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Status</div>
                      <Badge color={inventoryScreen.viewingStockCount.status === 'completed' ? 'success' : inventoryScreen.viewingStockCount.status === 'in-progress' ? 'warning' : inventoryScreen.viewingStockCount.status === 'cancelled' ? 'danger' : 'default'} variant="flat">
                        {inventoryScreen.viewingStockCount.status}
                      </Badge>
                    </div>
                  </div>

                  <Divider />

                  <div>
                    <h4 className="font-semibold mb-2">Count Results</h4>
                    <Table>
                      <TableHeader>
                        <TableColumn>Item Code</TableColumn>
                        <TableColumn>Item Name</TableColumn>
                        <TableColumn>Expected</TableColumn>
                        <TableColumn>Counted</TableColumn>
                        <TableColumn>Variance</TableColumn>
                        <TableColumn className="text-right">Variance Value</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {inventoryScreen.viewingStockCount.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.itemCode}</TableCell>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell>{item.expectedQuantity}</TableCell>
                            <TableCell>{item.countedQuantity}</TableCell>
                            <TableCell>
                              <span className={item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-gray-600'}>
                                {item.variance > 0 ? '+' : ''}{item.variance}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              ₵{Math.abs(item.varianceValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Divider />

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Total Items</div>
                        <div className="font-semibold">{inventoryScreen.viewingStockCount.totalItems}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Variance Items</div>
                        <div className="font-semibold text-orange-600">{inventoryScreen.viewingStockCount.varianceItems}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Total Value</div>
                        <div className="font-semibold">₵{inventoryScreen.viewingStockCount.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Variance Value</div>
                        <div className="font-semibold text-orange-600">
                          ₵{inventoryScreen.viewingStockCount.varianceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex flex-wrap gap-2">
              <Button variant="bordered" onPress={inventoryScreen.onStockCountViewClose}>Close</Button>
              {inventoryScreen.viewingStockCount && inventoryScreen.viewingStockCount.status === 'in-progress' && inventoryScreen.canRunStockCount && (
                <Button
                  color="success"
                  onPress={async () => {
                    const { confirmChoice } = await import('../DangerConfirm');
                    if (!(await confirmChoice('Complete this stock count?', 'Variances will adjust the stock on hand.', 'Complete'))) return;
                    inventoryScreen.handleCompleteStockCount(inventoryScreen.viewingStockCount);
                  }}
                >
                  ✅ Complete & Post
                </Button>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}
