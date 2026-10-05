'use client';

import { Badge, Button, Card, CardBody, CardHeader, Chip, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea, Tooltip } from '@heroui/react';
import React from 'react';
import { SortHeader, deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, toggleColumnSort } from '../dashboard/deskTableUi';
import { sizedTableClassNames } from '../frontoffice/columnResize';
import { useInventoryScreen } from './inventoryScreenContext';

/** Inventory → Suppliers. Supplier table. */
export function SuppliersTable() {
  const inventoryScreen = useInventoryScreen();
  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <Card className="border-0 shadow-lg">
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              placeholder="Search suppliers..."
              value={inventoryScreen.supplierSearchTerm}
              onChange={(e) => inventoryScreen.setSupplierSearchTerm(e.target.value)}
              startContent={<span className="text-gray-400">🔍</span>}
              className="md:col-span-2"
            />

            <Select
              placeholder="Status"
              selectedKeys={[inventoryScreen.supplierFilterStatus]}
              onSelectionChange={(keys) => inventoryScreen.setSupplierFilterStatus(Array.from(keys)[0] as string)}
            >
              <SelectItem key="all">All Status</SelectItem>
              <SelectItem key="active">Active</SelectItem>
              <SelectItem key="inactive">Inactive</SelectItem>
            </Select>

            <Select
              placeholder="Category"
              selectedKeys={[inventoryScreen.supplierFilterCategory]}
              onSelectionChange={(keys) => inventoryScreen.setSupplierFilterCategory(Array.from(keys)[0] as string)}
            >
              <SelectItem key="all">All Categories</SelectItem>
              <React.Fragment>
                {inventoryScreen.supplierCategories.map(cat => (
                  <SelectItem key={cat}>{cat}</SelectItem>
                ))}
              </React.Fragment>
            </Select>

            <Select
              placeholder="Payment Terms"
              selectedKeys={[inventoryScreen.supplierFilterPaymentTerms]}
              onSelectionChange={(keys) => inventoryScreen.setSupplierFilterPaymentTerms(Array.from(keys)[0] as string)}
            >
              <SelectItem key="all">All Terms</SelectItem>
              <SelectItem key="immediate">Immediate</SelectItem>
              <SelectItem key="net30">Net 30</SelectItem>
              <SelectItem key="net60">Net 60</SelectItem>
              <SelectItem key="net90">Net 90</SelectItem>
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Main Table */}
      <Card className={deskTableCardClassName}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <h3 className="text-xl font-semibold text-ghana-black">🤝 Suppliers</h3>
            <Button
              color="primary"
              className="bg-blue-500 text-white"
              variant="flat"
              startContent={<span>➕</span>}
              onClick={inventoryScreen.handleAddSupplier}
            >
              Add Supplier
            </Button>
          </div>
        </CardHeader>
        <CardBody className={deskTableCardBodyClassName}>
          <div ref={inventoryScreen.supplierCols.frameRef} style={inventoryScreen.supplierCols.frameStyle}>
          <Table aria-label="Suppliers table" removeWrapper classNames={sizedTableClassNames(deskTableClassNames)}>
            <TableHeader>
              <TableColumn className="relative" style={inventoryScreen.supplierCols.style('code')}>{<SortHeader label="Code" column="code" sort={inventoryScreen.supplierSort} onSort={(column) => inventoryScreen.setSupplierSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.supplierCols.sizer('code', 'Code')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.supplierCols.style('supplier')}>{<SortHeader label="Supplier" column="supplier" sort={inventoryScreen.supplierSort} onSort={(column) => inventoryScreen.setSupplierSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.supplierCols.sizer('supplier', 'Supplier')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.supplierCols.style('contact')}>{<SortHeader label="Contact" column="contact" sort={inventoryScreen.supplierSort} onSort={(column) => inventoryScreen.setSupplierSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.supplierCols.sizer('contact', 'Contact')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.supplierCols.style('address')}>{<SortHeader label="Address" column="address" sort={inventoryScreen.supplierSort} onSort={(column) => inventoryScreen.setSupplierSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.supplierCols.sizer('address', 'Address')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.supplierCols.style('supplies')}>{<SortHeader label="Supplies" column="supplies" sort={inventoryScreen.supplierSort} onSort={(column) => inventoryScreen.setSupplierSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.supplierCols.sizer('supplies', 'Supplies')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.supplierCols.style('terms')}>{<SortHeader label="Terms" column="terms" sort={inventoryScreen.supplierSort} onSort={(column) => inventoryScreen.setSupplierSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.supplierCols.sizer('terms', 'Terms')}</TableColumn>
              <TableColumn className="relative" style={inventoryScreen.supplierCols.style('status')}>{<SortHeader label="Status" column="status" sort={inventoryScreen.supplierSort} onSort={(column) => inventoryScreen.setSupplierSort((prev) => toggleColumnSort(prev, column))} />}{inventoryScreen.supplierCols.sizer('status', 'Status')}</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No suppliers found.">
              {inventoryScreen.paginatedSuppliers.map((supplier) => (
                <TableRow
                  key={supplier.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => inventoryScreen.handleViewSupplier(supplier)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 whitespace-nowrap">{supplier.code}</span>
                      {inventoryScreen.accountingSuppliers.some(bp => bp.id === supplier.id || bp.code === supplier.code) && (
                        <Tooltip content="Linked to Accounting">
                          <Badge color="success" size="sm" variant="flat">💼</Badge>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-ghana-black truncate" title={supplier.name}>{supplier.name}</div>
                    {supplier.email && (
                      <div className="text-xs text-gray-500 truncate max-w-[160px]">{supplier.email}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium truncate">{supplier.contactPerson || '—'}</div>
                    <div className="text-xs text-gray-500 truncate">{supplier.phone || supplier.email || ''}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm max-w-[180px]">
                      {supplier.address ? (
                        <>
                          <div className="truncate" title={supplier.address}>{supplier.address}</div>
                          {(supplier.city || supplier.country) && (
                            <div className="text-xs text-gray-500">
                              {[supplier.city, supplier.country].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400">{supplier.city || '—'}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[160px]">
                      {(supplier.categories || []).length > 0 ? (
                        <>
                          {supplier.categories.slice(0, 2).map((category) => (
                            <Chip key={category} color="primary" size="sm" variant="flat">
                              {category}
                            </Chip>
                          ))}
                          {supplier.categories.length > 2 && (
                            <Chip size="sm" variant="flat" color="secondary">
                              +{supplier.categories.length - 2}
                            </Chip>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color="secondary">
                      {(supplier.paymentTerms || 'net30').toUpperCase()}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Badge
                      color={supplier.isActive ? 'success' : 'default'}
                      size="sm"
                      variant="flat"
                    >
                      {supplier.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination
              total={inventoryScreen.supplierPages}
              page={inventoryScreen.supplierPageSafe}
              onChange={inventoryScreen.setSupplierPage}
              showControls
              size="sm"
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/** Inventory → Suppliers. Add, edit, and view a supplier. */
export function SupplierModals() {
  const inventoryScreen = useInventoryScreen();
  return (
  <>
        {/* Supplier Modals - rendered outside conditional to avoid hook issues */}
        {inventoryScreen.selectedTab === 'suppliers' && (
          <>
            {/* Add/Edit Supplier Modal */}
            <Modal isOpen={inventoryScreen.isSupplierModalOpen} onClose={inventoryScreen.onSupplierModalClose} size="3xl" scrollBehavior="inside">
              <ModalContent>
                <ModalHeader>
                  {inventoryScreen.editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
                </ModalHeader>
                <ModalBody>
                  <p className="text-sm text-slate-500 -mt-1 mb-2">
                    Who you buy from. Rating and balance stay on View / Accounting.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Supplier Code"
                      value={inventoryScreen.supplierFormData.code || ''}
                      onChange={(e) => inventoryScreen.setSupplierFormData({ ...inventoryScreen.supplierFormData, code: e.target.value })}
                      placeholder="Auto-generated"
                      isDisabled={!inventoryScreen.editingSupplier}
                      description={inventoryScreen.editingSupplier ? 'Code can be edited' : 'Auto-generated'}
                      isRequired
                    />
                    <Input
                      label="Supplier Name"
                      value={inventoryScreen.supplierFormData.name || ''}
                      onChange={(e) => inventoryScreen.setSupplierFormData({ ...inventoryScreen.supplierFormData, name: e.target.value })}
                      placeholder="e.g. Accra Fresh Foods Ltd"
                      isRequired
                      classNames={{ input: 'font-medium' }}
                    />
                    <Input
                      label="Contact Person"
                      value={inventoryScreen.supplierFormData.contactPerson || ''}
                      onChange={(e) => inventoryScreen.setSupplierFormData({ ...inventoryScreen.supplierFormData, contactPerson: e.target.value })}
                      placeholder="Who we call"
                    />
                    <Input
                      label="Phone"
                      value={inventoryScreen.supplierFormData.phone || ''}
                      onChange={(e) => inventoryScreen.setSupplierFormData({ ...inventoryScreen.supplierFormData, phone: e.target.value })}
                      placeholder="+233 XX XXX XXXX"
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={inventoryScreen.supplierFormData.email || ''}
                      onChange={(e) => inventoryScreen.setSupplierFormData({ ...inventoryScreen.supplierFormData, email: e.target.value })}
                      placeholder="supplier@email.com"
                      className="col-span-2"
                    />
                    <Textarea
                      label="Address"
                      value={inventoryScreen.supplierFormData.address || ''}
                      onChange={(e) => inventoryScreen.setSupplierFormData({ ...inventoryScreen.supplierFormData, address: e.target.value })}
                      placeholder="Street / building"
                      className="col-span-2"
                      minRows={2}
                    />
                    <Input
                      label="City"
                      value={inventoryScreen.supplierFormData.city || ''}
                      onChange={(e) => inventoryScreen.setSupplierFormData({ ...inventoryScreen.supplierFormData, city: e.target.value })}
                      placeholder="e.g. Accra"
                    />
                    <Input
                      label="Category — what they’re into"
                      value={inventoryScreen.supplierFormData.categories?.join(', ') || ''}
                      onChange={(e) => inventoryScreen.setSupplierFormData({
                        ...inventoryScreen.supplierFormData,
                        categories: e.target.value.split(',').map(c => c.trim()).filter(Boolean),
                      })}
                      placeholder="e.g. food, cleaning, linens"
                      description="Separate with commas — shows as chips in the table"
                    />
                    <Select
                      label="Payment Terms"
                      selectedKeys={inventoryScreen.supplierFormData.paymentTerms ? [inventoryScreen.supplierFormData.paymentTerms] : ['net30']}
                      onSelectionChange={(keys) => inventoryScreen.setSupplierFormData({ ...inventoryScreen.supplierFormData, paymentTerms: Array.from(keys)[0] as any })}
                    >
                      <SelectItem key="immediate">Immediate</SelectItem>
                      <SelectItem key="net30">Net 30</SelectItem>
                      <SelectItem key="net60">Net 60</SelectItem>
                      <SelectItem key="net90">Net 90</SelectItem>
                    </Select>
                    <Input
                      label="Credit Limit (₵)"
                      type="number"
                      value={inventoryScreen.supplierFormData.creditLimit?.toString() || '0'}
                      onChange={(e) => inventoryScreen.setSupplierFormData({ ...inventoryScreen.supplierFormData, creditLimit: parseFloat(e.target.value) || 0 })}
                      description="Optional"
                    />
                    <Input
                      label="Tax ID / TIN"
                      value={inventoryScreen.supplierFormData.taxId || ''}
                      onChange={(e) => inventoryScreen.setSupplierFormData({ ...inventoryScreen.supplierFormData, taxId: e.target.value })}
                      placeholder="e.g. GH123456789"
                      className="col-span-2"
                    />
                    <div className="col-span-2">
                      <Chip
                        color={inventoryScreen.supplierFormData.isActive !== false ? 'success' : 'warning'}
                        variant="flat"
                        onClick={() => inventoryScreen.setSupplierFormData({ ...inventoryScreen.supplierFormData, isActive: !(inventoryScreen.supplierFormData.isActive !== false) })}
                        className="cursor-pointer"
                      >
                        {inventoryScreen.supplierFormData.isActive !== false ? '✓ Active — ready to buy from' : 'Inactive — paused'}
                      </Chip>
                    </div>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="bordered" onPress={inventoryScreen.onSupplierModalClose}>Cancel</Button>
                  <Button color="primary" className="bg-blue-500" onPress={inventoryScreen.handleSaveSupplier}>
                    {inventoryScreen.editingSupplier ? 'Update' : 'Add'} Supplier
                  </Button>
                </ModalFooter>
              </ModalContent>
            </Modal>

            {/* View Supplier Details Modal */}
            <Modal isOpen={inventoryScreen.supplierViewOpen} onClose={() => inventoryScreen.setSupplierViewOpen(false)} size="2xl" scrollBehavior="inside">
              <ModalContent>
                <ModalHeader>
                  <div>
                    <div className="text-xl font-semibold">Supplier Details</div>
                    <div className="text-sm text-gray-500 font-mono">{inventoryScreen.viewingSupplier?.code}</div>
                  </div>
                </ModalHeader>
                <ModalBody>
                  {inventoryScreen.viewingSupplier && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Supplier Name</div>
                          <div className="font-semibold">{inventoryScreen.viewingSupplier.name}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Status</div>
                          <Badge color={inventoryScreen.viewingSupplier.isActive ? 'success' : 'default'} size="sm">
                            {inventoryScreen.viewingSupplier.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Contact Person</div>
                          <div className="font-semibold">{inventoryScreen.viewingSupplier.contactPerson}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Email</div>
                          <div className="text-sm">{inventoryScreen.viewingSupplier.email}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Phone</div>
                          <div className="text-sm">{inventoryScreen.viewingSupplier.phone}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Tax ID</div>
                          <div className="text-sm font-mono">{inventoryScreen.viewingSupplier.taxId}</div>
                        </div>
                      </div>

                      <Divider />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Address</div>
                          <div className="text-sm">{inventoryScreen.viewingSupplier.address}</div>
                          <div className="text-sm">{inventoryScreen.viewingSupplier.city}, {inventoryScreen.viewingSupplier.country}</div>
                          <div className="text-sm">{inventoryScreen.viewingSupplier.postalCode}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Payment Terms</div>
                          <Chip size="sm" variant="flat" color="secondary">
                            {inventoryScreen.viewingSupplier.paymentTerms.toUpperCase()}
                          </Chip>
                        </div>
                      </div>

                      <Divider />

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Credit Limit</div>
                          <div className="text-lg font-semibold text-blue-600">
                            ₵{inventoryScreen.viewingSupplier.creditLimit.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Current Balance</div>
                          <div className={`text-lg font-semibold ${
                            inventoryScreen.viewingSupplier.currentBalance > inventoryScreen.viewingSupplier.creditLimit * 0.8 ? 'text-red-600' :
                            inventoryScreen.viewingSupplier.currentBalance > inventoryScreen.viewingSupplier.creditLimit * 0.6 ? 'text-orange-600' :
                            'text-green-600'
                          }`}>
                            ₵{inventoryScreen.viewingSupplier.currentBalance.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Available Credit</div>
                          <div className="text-lg font-semibold text-green-600">
                            ₵{Math.max(0, inventoryScreen.viewingSupplier.creditLimit - inventoryScreen.viewingSupplier.currentBalance).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <Divider />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Rating</div>
                          <div className="flex items-center space-x-2">
                            <span className="text-lg font-semibold">{inventoryScreen.viewingSupplier.rating.toFixed(1)}</span>
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <span 
                                  key={i} 
                                  className={`text-lg ${i < Math.floor(inventoryScreen.viewingSupplier.rating) ? 'text-yellow-500' : 'text-gray-300'}`}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Categories</div>
                          <div className="flex flex-wrap gap-1">
                            {inventoryScreen.viewingSupplier.categories.map((cat) => (
                              <Chip key={cat} size="sm" variant="flat" color="primary">
                                {cat}
                              </Chip>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">On-Time Delivery</div>
                          <div className="text-sm font-semibold">{inventoryScreen.viewingSupplier.performance.onTimeDelivery}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Total Orders</div>
                          <div className="text-sm font-semibold">{inventoryScreen.viewingSupplier.performance.totalOrders}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Quality Rating</div>
                          <div className="text-sm font-semibold">{inventoryScreen.viewingSupplier.performance.qualityRating.toFixed(1)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Avg Response Time</div>
                          <div className="text-sm font-semibold">{inventoryScreen.viewingSupplier.performance.responseTime} days</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Contract Start</div>
                          <div className="text-sm">
                            {new Date(inventoryScreen.viewingSupplier.contractStartDate).toLocaleDateString()}
                          </div>
                        </div>
                        {inventoryScreen.viewingSupplier.contractEndDate && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Contract End</div>
                            <div className="text-sm">
                              {new Date(inventoryScreen.viewingSupplier.contractEndDate).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>

                      {inventoryScreen.viewingSupplier.notes && (
                        <>
                          <Divider />
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Notes</div>
                            <div className="text-sm">{inventoryScreen.viewingSupplier.notes}</div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button variant="bordered" onPress={() => inventoryScreen.setSupplierViewOpen(false)}>Close</Button>
                  {inventoryScreen.viewingSupplier && (
                    <Button color="danger" variant="light" onPress={() => { inventoryScreen.setSupplierViewOpen(false); void inventoryScreen.handleDeleteSupplier(inventoryScreen.viewingSupplier.id); }}>Delete</Button>
                  )}
                  {inventoryScreen.viewingSupplier && (
                    <Button color="primary" onPress={() => {
                      inventoryScreen.setSupplierViewOpen(false);
                      inventoryScreen.handleEditSupplier(inventoryScreen.viewingSupplier);
                    }}>
                      Edit
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
