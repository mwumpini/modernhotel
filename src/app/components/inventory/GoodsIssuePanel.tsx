'use client';

import { Autocomplete, AutocompleteItem, Badge, Button, Card, CardBody, CardHeader, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import { DESK_PAGE_SIZE, SortHeader, deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, toggleColumnSort } from '../dashboard/deskTableUi';
import { StockItem } from '../../lib/inventory/models';
import { sizedTableClassNames } from '../frontoffice/columnResize';
import { useInventoryScreen } from './inventoryScreenContext';
import { DateFilterPills, matchesDateFilter, useDateFilter } from '../fb/DateFilterPills';

/** Inventory → Issues. Goods issue list. */
export function GoodsIssueTable() {
  const inventoryScreen = useInventoryScreen();
  const dates = useDateFilter();
  const filtered = inventoryScreen.goodsIssues.filter((row) =>
    (inventoryScreen.issueSearchTerm === '' ||
    row.issueNumber.toLowerCase().includes(inventoryScreen.issueSearchTerm.toLowerCase()) ||
    row.department.toLowerCase().includes(inventoryScreen.issueSearchTerm.toLowerCase()) ||
    row.issuedTo.toLowerCase().includes(inventoryScreen.issueSearchTerm.toLowerCase())) &&
    matchesDateFilter(row.issueDate, dates.mode, dates.single, dates.from, dates.to)
  );
  const dir = inventoryScreen.issueSort.direction === 'asc' ? 1 : -1;
  const ms = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();
  const sorted = [...filtered].sort((a, b) => {
    switch (inventoryScreen.issueSort.column) {
      case 'department': return a.department.localeCompare(b.department) * dir;
      case 'issuedTo': return a.issuedTo.localeCompare(b.issuedTo) * dir;
      case 'date': return (ms(a.issueDate) - ms(b.issueDate)) * dir;
      case 'lines': return (a.totalItems - b.totalItems) * dir;
      case 'value': return (a.totalValue - b.totalValue) * dir;
      case 'number':
      default: return a.issueNumber.localeCompare(b.issueNumber) * dir;
    }
  });
  const pages = Math.max(1, Math.ceil(sorted.length / DESK_PAGE_SIZE));
  const pageSafe = Math.min(inventoryScreen.issuePage, pages);
  const paged = sorted.slice((pageSafe - 1) * DESK_PAGE_SIZE, pageSafe * DESK_PAGE_SIZE);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = inventoryScreen.goodsIssues.filter((r) => {
    const d = new Date(r.issueDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).length;

  return (
    <div className="space-y-3">
      <Card className={deskTableCardClassName}>
        <CardHeader className="!px-3 !pt-2 !pb-0">
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="text-base font-semibold text-ghana-black">📤 Goods Issue</h3>
              <p className="text-sm text-gray-500">Issue stock from Stores to a department or person</p>
            </div>
            <div className="flex gap-2 items-center">
              <Badge color="success" variant="flat">{todayCount} today</Badge>
              <Button size="sm" color="primary" className="bg-ghana-gold text-white" variant="flat" onPress={inventoryScreen.handleOpenGoodsIssue}>
                + New Issue
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className={`${deskTableCardBodyClassName} !pt-1`}>
          <div className="mb-2">
            <Input
              size="sm"
              placeholder="Search issue #, department, or person..."
              value={inventoryScreen.issueSearchTerm}
              onChange={(e) => { inventoryScreen.setIssueSearchTerm(e.target.value); inventoryScreen.setIssuePage(1); }}
              startContent={<span className="text-gray-400">🔍</span>}
            />
          </div>
          <div className="mb-2">
            <DateFilterPills
              mode={dates.mode}
              onMode={(mode) => { dates.setMode(mode); inventoryScreen.setIssuePage(1); }}
              single={dates.single}
              onSingle={(value) => { dates.setSingle(value); inventoryScreen.setIssuePage(1); }}
              from={dates.from}
              onFrom={(value) => { dates.setFrom(value); inventoryScreen.setIssuePage(1); }}
              to={dates.to}
              onTo={(value) => { dates.setTo(value); inventoryScreen.setIssuePage(1); }}
            />
          </div>
          <div ref={inventoryScreen.issueCols.frameRef} style={inventoryScreen.issueCols.frameStyle}>
          <Table aria-label="Goods issues" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
            <TableHeader>
              <TableColumn className="relative" style={inventoryScreen.issueCols.style('number')}>{<SortHeader label="Issue #" column="number" sort={inventoryScreen.issueSort} onSort={(column) => inventoryScreen.setIssueSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.issueCols.sizer('number', 'Issue #')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.issueCols.style('date')}>{<SortHeader label="Date" column="date" sort={inventoryScreen.issueSort} onSort={(column) => inventoryScreen.setIssueSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.issueCols.sizer('date', 'Date')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.issueCols.style('department')}>{<SortHeader label="Department" column="department" sort={inventoryScreen.issueSort} onSort={(column) => inventoryScreen.setIssueSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.issueCols.sizer('department', 'Department')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.issueCols.style('issuedTo')}>{<SortHeader label="Issued To" column="issuedTo" sort={inventoryScreen.issueSort} onSort={(column) => inventoryScreen.setIssueSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.issueCols.sizer('issuedTo', 'Issued To')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.issueCols.style('lines')}>{<SortHeader label="Lines" column="lines" sort={inventoryScreen.issueSort} onSort={(column) => inventoryScreen.setIssueSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.issueCols.sizer('lines', 'Lines')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.issueCols.style('value')}>{<SortHeader label="Value" column="value" sort={inventoryScreen.issueSort} onSort={(column) => inventoryScreen.setIssueSort((prev) => toggleColumnSort(prev, column))} align="right" />}{inventoryScreen.issueCols.sizer('value', 'Value')}</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No issues yet. Create one to send stock to a department.">
              {paged.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    inventoryScreen.setViewingGoodsIssue(row);
                    inventoryScreen.onGoodsIssueViewOpen();
                  }}
                >
                  <TableCell>
                    <span className="text-gray-600 whitespace-nowrap">{row.issueNumber}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.issueDate instanceof Date ? row.issueDate.toLocaleDateString() : new Date(row.issueDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="truncate" title={row.department}>{row.department}</TableCell>
                  <TableCell className="truncate" title={row.issuedTo}>{row.issuedTo}</TableCell>
                  <TableCell>
                    <span className="block text-right tabular-nums">{row.totalItems}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap">
                    ₵{row.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={pageSafe} total={pages} onChange={inventoryScreen.setIssuePage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/** Inventory → Issues. View and create a goods issue. */
export function GoodsIssueModals() {
  const inventoryScreen = useInventoryScreen();
  return (
  <>
        {/* Goods Issue View Modal */}
        <Modal isOpen={inventoryScreen.isGoodsIssueViewOpen} onClose={inventoryScreen.onGoodsIssueViewClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              <div>
                <div className="text-xl font-semibold">Goods Issue</div>
                <div className="text-sm text-gray-500 font-mono">{inventoryScreen.viewingGoodsIssue?.issueNumber}</div>
              </div>
            </ModalHeader>
            <ModalBody>
              {inventoryScreen.viewingGoodsIssue && (
                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="text-2xl font-semibold tabular-nums">₵{inventoryScreen.viewingGoodsIssue.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <Badge color={inventoryScreen.viewingGoodsIssue.status === 'issued' ? 'success' : inventoryScreen.viewingGoodsIssue.status === 'void' || inventoryScreen.viewingGoodsIssue.status === 'cancelled' ? 'danger' : 'default'} variant="flat">
                      {inventoryScreen.viewingGoodsIssue.status.replace(/-/g, ' ')}
                    </Badge>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Department</div>
                      <div className="font-semibold">{inventoryScreen.viewingGoodsIssue.department}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Issued to</div>
                      <div className="font-semibold">{inventoryScreen.viewingGoodsIssue.issuedTo}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Date</div>
                      <div>{inventoryScreen.viewingGoodsIssue.issueDate instanceof Date ? inventoryScreen.viewingGoodsIssue.issueDate.toLocaleDateString() : new Date(inventoryScreen.viewingGoodsIssue.issueDate).toLocaleDateString()}</div>
                      <div className="text-gray-600">{inventoryScreen.viewingGoodsIssue.issuedBy}</div>
                    </div>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 px-2 py-1.5 text-left">Item code</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-left">Item</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-center">Qty</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-right">Value</th>
                        <th className="border border-gray-300 px-2 py-1.5 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryScreen.viewingGoodsIssue.items.map((item) => (
                        <tr key={item.id}>
                          <td className="border border-gray-300 px-2 py-1.5 font-mono">{item.itemCode}</td>
                          <td className="border border-gray-300 px-2 py-1.5">{item.itemName}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center tabular-nums">{item.quantity}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">₵{item.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="border border-gray-300 px-2 py-1.5">{item.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="w-full sm:w-72 ml-auto text-sm border-collapse">
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Total</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold tabular-nums">₵{inventoryScreen.viewingGoodsIssue.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                  {inventoryScreen.viewingGoodsIssue.notes && (
                    <>
                      <Divider />
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Notes</div>
                        <div className="text-sm">{inventoryScreen.viewingGoodsIssue.notes}</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex w-full flex-wrap items-center gap-2 !justify-between">
              <div />
              <div className="flex flex-wrap justify-end gap-2">
              {inventoryScreen.viewingGoodsIssue && (
                <Button variant="flat" onPress={() => inventoryScreen.printGoodsIssue(inventoryScreen.viewingGoodsIssue)}>
                  Print
                </Button>
              )}
              {inventoryScreen.viewingGoodsIssue && inventoryScreen.viewingGoodsIssue.status === 'issued' && (
                <Button color="warning" variant="flat" onPress={async () => {
                  const { confirmVoid } = await import('../DangerConfirm');
                  if (!(await confirmVoid(inventoryScreen.viewingGoodsIssue.issueNumber, 'The issue stays on file as Void and the stock is put back.'))) return;
                  inventoryScreen.handleVoidGoodsIssue(inventoryScreen.viewingGoodsIssue);
                }}>Void</Button>
              )}
              <Button variant="bordered" onPress={inventoryScreen.onGoodsIssueViewClose}>Close</Button>
              </div>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Goods Issue Modal */}
        <Modal isOpen={inventoryScreen.isGoodsIssueOpen} onClose={inventoryScreen.onGoodsIssueClose} size="4xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader>
              Issue Goods
              <span className="block text-sm font-normal text-slate-500 mt-1">
                Pull stock from Stores for a department or person. Number assigned on save.
              </span>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Department"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={inventoryScreen.issueFormData.department ? new Set([inventoryScreen.issueFormData.department]) : new Set()}
                    onSelectionChange={(keys) => {
                      if (keys === 'all') return;
                      const dept = Array.from(keys)[0] as string | undefined;
                      if (!dept) return;
                      inventoryScreen.setIssueFormData({ ...inventoryScreen.issueFormData, department: dept });
                    }}
                    isRequired
                  >
                    {inventoryScreen.departments.map((dept) => (
                      <SelectItem key={dept} textValue={dept}>{dept}</SelectItem>
                    ))}
                  </Select>
                  <Input
                    label="Issued To"
                    value={inventoryScreen.issueFormData.issuedTo}
                    onChange={(e) => inventoryScreen.setIssueFormData({ ...inventoryScreen.issueFormData, issuedTo: e.target.value })}
                    placeholder="Person name"
                    isRequired
                  />
                </div>

                <Divider />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Items</h4>
                    <Button size="sm" color="primary" onPress={inventoryScreen.handleAddIssueItem}>
                      + Add Item
                    </Button>
                  </div>
                  {inventoryScreen.issueFormData.items.length > 0 ? (
                    <Table className="[&_thead]:hidden">
                      <TableHeader>
                        <TableColumn>Item</TableColumn>
                        <TableColumn>Quantity</TableColumn>
                        <TableColumn>Reason</TableColumn>
                        <TableColumn>Action</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {inventoryScreen.issueFormData.items.map((item, index) => {
                          const filtered = inventoryScreen.getFilteredIssueItems(index);
                          return (
                            <TableRow key={index}>
                              <TableCell className="w-[40%]">
                                <Autocomplete
                                  placeholder="🔍 Search item..."
                                  selectedKey={item.itemCode || undefined}
                                  onSelectionChange={(key) => {
                                    if (key) {
                                      const selectedItem = inventoryScreen.stockItems.find(i => i.itemCode === String(key));
                                      if (selectedItem) {
                                        const updatedItems = [...inventoryScreen.issueFormData.items];
                                        updatedItems[index] = {
                                          itemId: selectedItem.id,
                                          itemCode: selectedItem.itemCode,
                                          itemName: selectedItem.name,
                                          quantity: item.quantity || 1,
                                          unitCost: selectedItem.unitCost,
                                          reason: item.reason
                                        };
                                        inventoryScreen.setIssueFormData({ ...inventoryScreen.issueFormData, items: updatedItems });
                                        inventoryScreen.setIssueItemSearchTerms((prev) => {
                                          const next = { ...prev };
                                          delete next[index];
                                          return next;
                                        });
                                      }
                                    }
                                  }}
                                  onInputChange={(value) => {
                                    inventoryScreen.setIssueItemSearchTerms((prev) => ({ ...prev, [index]: value }));
                                  }}
                                  inputValue={
                                    inventoryScreen.issueItemSearchTerms[index] !== undefined
                                      ? inventoryScreen.issueItemSearchTerms[index]
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
                                    const updatedItems = [...inventoryScreen.issueFormData.items];
                                    updatedItems[index] = { ...item, quantity: parseInt(e.target.value) || 0 };
                                    inventoryScreen.setIssueFormData({ ...inventoryScreen.issueFormData, items: updatedItems });
                                  }}
                                  size="sm"
                                  min="1"
                                  placeholder="Qty"
                                />
                              </TableCell>
                              <TableCell className="w-[30%]">
                                <Input
                                  value={item.reason || ''}
                                  onChange={(e) => {
                                    const updatedItems = [...inventoryScreen.issueFormData.items];
                                    updatedItems[index] = { ...item, reason: e.target.value };
                                    inventoryScreen.setIssueFormData({ ...inventoryScreen.issueFormData, items: updatedItems });
                                  }}
                                  size="sm"
                                  placeholder="Reason/purpose"
                                />
                              </TableCell>
                              <TableCell className="w-[10%]">
                                <Button
                                  size="sm"
                                  color="danger"
                                  variant="flat"
                                  onPress={() => {
                                    const updatedItems = inventoryScreen.issueFormData.items.filter((_, i) => i !== index);
                                    inventoryScreen.setIssueFormData({ ...inventoryScreen.issueFormData, items: updatedItems });
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
                      No items yet — add lines to issue.
                    </div>
                  )}
                </div>

                <Textarea
                  label="Notes"
                  value={inventoryScreen.issueFormData.notes || ''}
                  onChange={(e) => inventoryScreen.setIssueFormData({ ...inventoryScreen.issueFormData, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="bordered" onPress={inventoryScreen.onGoodsIssueClose}>Cancel</Button>
              <Button color="primary" className="bg-ghana-gold text-white" onPress={inventoryScreen.handleIssueGoods}>
                Issue Goods
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}
