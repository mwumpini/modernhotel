'use client';

import { Badge, Button, Card, CardBody, CardHeader, Chip, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import { DEPARTMENT_LOCATIONS } from '../../lib/inventory/departmentLocations';
import { DESK_PAGE_SIZE, SortHeader, deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, toggleColumnSort } from '../dashboard/deskTableUi';
import { StockCountItem } from '../../lib/inventory/models';
import { sizedTableClassNames } from '../frontoffice/columnResize';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { inventoryHeaders } from './inventoryHeaders';
import { useInventoryScreen } from './inventoryScreenContext';
import PostingDateField from '../shared/PostingDateField';
import { DateFilterPills, matchesDateFilter, useDateFilter } from '../fb/DateFilterPills';

/** Inventory → Purchase Orders. Orders waiting to be received, and receipts waiting on quality check. */
export function GoodsReceiptList() {
  const inventoryScreen = useInventoryScreen();
  const receiptDates = useDateFilter();
  const qcDates = useDateFilter();
  // Get POs ready for receipt (confirmed or in-transit)
  const posForReceipt = inventoryScreen.supplierStorePurchaseOrders.filter(po => 
    po.status === 'confirmed' || po.status === 'in-transit'
  );
  const receiptFiltered = posForReceipt.filter((po) =>
    (po.poNumber.toLowerCase().includes(inventoryScreen.poSearchTerm.toLowerCase()) ||
    po.supplierName.toLowerCase().includes(inventoryScreen.poSearchTerm.toLowerCase())) &&
    matchesDateFilter(po.orderDate, receiptDates.mode, receiptDates.single, receiptDates.from, receiptDates.to)
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

  return (
        <div className="space-y-3">
          <Card className={deskTableCardClassName}>
            <CardHeader className="!px-3 !pt-2 !pb-0">
              <div className="flex items-center justify-between w-full">
                <div>
                  <h3 className="text-base font-semibold text-ghana-black">📥 Goods Receipt</h3>
                  <p className="text-sm text-gray-500">Receive against confirmed / in-transit POs — QC follows in the receipt view</p>
                </div>
                <Badge color="primary" variant="flat">{posForReceipt.length} ready</Badge>
              </div>
            </CardHeader>
            <CardBody className={`${deskTableCardBodyClassName} !pt-1`}>
              <div className="mb-2">
                <Input
                  size="sm"
                  placeholder="Search PO # or supplier..."
                  value={inventoryScreen.poSearchTerm}
                  onChange={(e) => { inventoryScreen.setPOSearchTerm(e.target.value); inventoryScreen.setReceiptPage(1); }}
                  startContent={<span className="text-gray-400">🔍</span>}
                />
              </div>
              <div className="mb-2">
                <DateFilterPills
                  mode={receiptDates.mode}
                  onMode={(mode) => { receiptDates.setMode(mode); inventoryScreen.setReceiptPage(1); }}
                  single={receiptDates.single}
                  onSingle={(value) => { receiptDates.setSingle(value); inventoryScreen.setReceiptPage(1); }}
                  from={receiptDates.from}
                  onFrom={(value) => { receiptDates.setFrom(value); inventoryScreen.setReceiptPage(1); }}
                  to={receiptDates.to}
                  onTo={(value) => { receiptDates.setTo(value); inventoryScreen.setReceiptPage(1); }}
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
            const awaitingGrns = inventoryScreen.goodsReceiptNotes
              .filter((g) => g.status === 'pending' || g.status === 'quality-check');
            if (awaitingGrns.length === 0) return null;
            const pendingGrns = awaitingGrns
              .filter((g) => matchesDateFilter(g.receiptDate, qcDates.mode, qcDates.single, qcDates.from, qcDates.to))
              .sort((a, b) => {
                const ta = a.receiptDate instanceof Date ? a.receiptDate.getTime() : new Date(a.receiptDate).getTime();
                const tb = b.receiptDate instanceof Date ? b.receiptDate.getTime() : new Date(b.receiptDate).getTime();
                return tb - ta;
              });
            return (
              <Card className={deskTableCardClassName}>
                <CardHeader className="!px-3 !pt-2 !pb-0">
                  <div>
                    <h3 className="text-base font-semibold text-ghana-black">Awaiting QC / Approve</h3>
                    <p className="text-sm text-gray-500">Receipts created — finish quality check, then approve</p>
                  </div>
                </CardHeader>
                <CardBody className={`${deskTableCardBodyClassName} !pt-1`}>
                  <div className="mb-2">
                    <DateFilterPills
                      mode={qcDates.mode}
                      onMode={qcDates.setMode}
                      single={qcDates.single}
                      onSingle={qcDates.setSingle}
                      from={qcDates.from}
                      onFrom={qcDates.setFrom}
                      to={qcDates.to}
                      onTo={qcDates.setTo}
                    />
                  </div>
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
  );
}

/** Inventory → Stock Count. Physical counts for a location. */
export function ReceiveAndReconTable() {
  const inventoryScreen = useInventoryScreen();
  const countDates = useDateFilter();
  const countFiltered = inventoryScreen.stockCounts.filter((c) =>
    (inventoryScreen.stockCountSearchTerm === '' ||
      c.countNumber.toLowerCase().includes(inventoryScreen.stockCountSearchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(inventoryScreen.stockCountSearchTerm.toLowerCase())) &&
    (inventoryScreen.stockCountFilterStatus === 'all' || c.status === inventoryScreen.stockCountFilterStatus) &&
    matchesDateFilter(c.startDate, countDates.mode, countDates.single, countDates.from, countDates.to)
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
        <div className="space-y-3">
          <Card className={deskTableCardClassName}>
            <CardHeader className="!px-3 !pt-2 !pb-0">
              <div className="flex items-center justify-between w-full">
                <div>
                  <h3 className="text-base font-semibold text-ghana-black">🔍 Stock Count</h3>
                </div>
                {inventoryScreen.canRunStockCount && (
                  <Button size="sm" color="primary" className="bg-ghana-gold text-white" variant="flat" onPress={inventoryScreen.handleAddStockCount}>
                    + New Count
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody className={`${deskTableCardBodyClassName} !pt-1`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                <Input
                  size="sm"
                  placeholder="Search count # or location..."
                  value={inventoryScreen.stockCountSearchTerm}
                  onChange={(e) => { inventoryScreen.setStockCountSearchTerm(e.target.value); inventoryScreen.setCountPage(1); }}
                  startContent={<span className="text-gray-400">🔍</span>}
                  className="md:col-span-2"
                />
                <Select
                  size="sm"
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
              <div className="mb-2">
                <DateFilterPills
                  mode={countDates.mode}
                  onMode={(mode) => { countDates.setMode(mode); inventoryScreen.setCountPage(1); }}
                  single={countDates.single}
                  onSingle={(value) => { countDates.setSingle(value); inventoryScreen.setCountPage(1); }}
                  from={countDates.from}
                  onFrom={(value) => { countDates.setFrom(value); inventoryScreen.setCountPage(1); }}
                  to={countDates.to}
                  onTo={(value) => { countDates.setTo(value); inventoryScreen.setCountPage(1); }}
                />
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
            <ModalFooter className="flex w-full flex-wrap items-center gap-2 !justify-between">
              <div>
              {inventoryScreen.viewingGRN && inventoryScreen.viewingGRN.status !== 'void' && (
                <Button color="danger" variant="light" onPress={async () => {
                  const posted = inventoryScreen.viewingGRN.status === 'approved';
                  const { confirmDelete } = await import('../DangerConfirm');
                  if (!(await confirmDelete(
                    inventoryScreen.viewingGRN.grnNumber,
                    posted
                      ? 'Stock and the payable are reversed, then this receipt is removed.'
                      : 'This receipt will be permanently removed.',
                  ))) return;
                  inventoryScreen.deleteGRN(inventoryScreen.viewingGRN.id, inventoryScreen.currentUserName);
                  inventoryScreen.onGRNViewClose();
                }}>Delete</Button>
              )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
              {inventoryScreen.viewingGRN && inventoryScreen.viewingGRN.status !== 'void' && inventoryScreen.viewingGRN.status !== 'rejected' && inventoryScreen.viewingGRN.status !== 'pending' && (
                <Button color="warning" variant="flat" onPress={async () => {
                  const posted = inventoryScreen.viewingGRN.status === 'approved';
                  const { confirmVoid } = await import('../DangerConfirm');
                  if (!(await confirmVoid(
                    inventoryScreen.viewingGRN.grnNumber,
                    posted
                      ? 'Accepted goods come back out of stock, the payable is reversed, and the receipt stays on file as Void.'
                      : 'The receipt stays on file as Void. Nothing was posted to stock.',
                  ))) return;
                  inventoryScreen.voidGRN(inventoryScreen.viewingGRN.id, inventoryScreen.currentUserName);
                  inventoryScreen.setViewingGRN(inventoryScreen.getGRN(inventoryScreen.viewingGRN.id) || { ...inventoryScreen.viewingGRN, status: 'void' });
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
              {inventoryScreen.viewingGRN && (
                <Button variant="flat" onPress={() => {
                  const grn = inventoryScreen.viewingGRN;
                  const money = (n: number) => `₵${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  inventoryScreen.printInventorySheet({
                    title: 'Goods Receipt',
                    subtitle: grn.grnNumber,
                    fields: [
                      ['Supplier', grn.supplierName],
                      ['Purchase order', grn.poNumber],
                      ['Status', grn.status],
                      ['Total', money(grn.totalValue)],
                    ],
                    columns: ['Item', 'Ordered', 'Received', 'Amount'],
                    rows: grn.items.map((item) => [item.itemName, item.orderedQuantity, item.receivedQuantity, money(item.totalValue)]),
                  });
                }}>
                  Print
                </Button>
              )}
              <Button variant="bordered" onPress={inventoryScreen.onGRNViewClose}>Close</Button>
              </div>
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
                    What passes is added to stock and to accounts payable. Failed quantity is left out. Override accepts every line.
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
              <Button variant="flat" onPress={() => inventoryScreen.handleSubmitQualityCheck(true)}>
                Override — accept all
              </Button>
              <Button color="primary" className="bg-ghana-gold text-white" onPress={() => inventoryScreen.handleSubmitQualityCheck()}>
                Finish check
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
            <ModalHeader className="flex flex-col gap-1">
              <div className="text-xl font-semibold">Stock Count Details</div>
              <div className="text-sm text-gray-500 font-mono">{inventoryScreen.viewingStockCount?.countNumber}</div>
            </ModalHeader>
            <ModalBody>
              {inventoryScreen.viewingStockCount && (
                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500">Variance value</div>
                      <div className="text-2xl font-semibold tabular-nums">₵{inventoryScreen.viewingStockCount.varianceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <Badge color={inventoryScreen.viewingStockCount.status === 'completed' ? 'success' : inventoryScreen.viewingStockCount.status === 'in-progress' ? 'warning' : inventoryScreen.viewingStockCount.status === 'cancelled' ? 'danger' : 'default'} variant="flat">
                      {inventoryScreen.viewingStockCount.status.replace(/-/g, ' ')}
                    </Badge>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Location</div>
                      <div className="font-semibold">{inventoryScreen.viewingStockCount.location}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Count type</div>
                      <div className="font-semibold capitalize">{inventoryScreen.viewingStockCount.countType}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Start date</div>
                      <div>{inventoryScreen.viewingStockCount.startDate instanceof Date ? inventoryScreen.viewingStockCount.startDate.toLocaleDateString() : new Date(inventoryScreen.viewingStockCount.startDate).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 px-2 py-1.5 text-left">Item code</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-left">Item</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-center">Expected</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-center">Counted</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-center">Variance</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-right">Variance value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryScreen.viewingStockCount.items.map((item) => (
                        <tr key={item.id}>
                          <td className="border border-gray-300 px-2 py-1.5 font-mono">{item.itemCode}</td>
                          <td className="border border-gray-300 px-2 py-1.5">{item.itemName}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center tabular-nums">{item.expectedQuantity}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center tabular-nums">{item.countedQuantity}</td>
                          <td className={`border border-gray-300 px-2 py-1.5 text-center tabular-nums ${item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : ''}`}>
                            {item.variance > 0 ? '+' : ''}{item.variance}
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">₵{Math.abs(item.varianceValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <table className="w-full sm:w-72 ml-auto text-sm border-collapse">
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-2 py-1.5 text-right">Total items</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">{inventoryScreen.viewingStockCount.totalItems}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-2 py-1.5 text-right">Variance lines</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">{inventoryScreen.viewingStockCount.varianceItems}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-2 py-1.5 text-right">Stock value</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">₵{inventoryScreen.viewingStockCount.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Variance value</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold tabular-nums">₵{inventoryScreen.viewingStockCount.varianceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>

                  {inventoryScreen.viewingStockCount.notes && (
                    <>
                      <Divider />
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Notes</div>
                        <div className="text-sm">{inventoryScreen.viewingStockCount.notes}</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex w-full flex-wrap items-center gap-2 !justify-between">
              <div>
              {inventoryScreen.viewingStockCount && inventoryScreen.canDeleteInventoryDocs && inventoryScreen.viewingStockCount.status !== 'completed' && (
                <Button color="danger" variant="light" onPress={() => inventoryScreen.handleDeleteStockCount(inventoryScreen.viewingStockCount)}>
                  Delete
                </Button>
              )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
              {inventoryScreen.viewingStockCount && inventoryScreen.canVoidInventoryDocs && inventoryScreen.viewingStockCount.status !== 'completed' && inventoryScreen.viewingStockCount.status !== 'cancelled' && (
                <Button color="warning" variant="flat" onPress={() => inventoryScreen.handleVoidStockCount(inventoryScreen.viewingStockCount)}>
                  Void
                </Button>
              )}
              {inventoryScreen.viewingStockCount && inventoryScreen.canEditInventoryDocs && inventoryScreen.viewingStockCount.status !== 'completed' && inventoryScreen.viewingStockCount.status !== 'cancelled' && (
                <Button color="warning" variant="flat" onPress={() => inventoryScreen.handleEditStockCountFromView(inventoryScreen.viewingStockCount)}>
                  Edit
                </Button>
              )}
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
              {inventoryScreen.viewingStockCount && inventoryScreen.canPrintInventoryDocs && (
                <Button variant="flat" onPress={() => inventoryScreen.handlePrintStockCount(inventoryScreen.viewingStockCount)}>
                  Print
                </Button>
              )}
              <Button variant="bordered" onPress={inventoryScreen.onStockCountViewClose}>Close</Button>
              </div>
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}
