'use client';

import { Badge, Button, Card, CardBody, CardHeader, Chip, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea, Tooltip } from '@heroui/react';
import React, { useEffect, useState } from 'react';
import { SortHeader, deskTableCardBodyClassName, deskTableCardClassName, deskTableClassNames, toggleColumnSort } from '../dashboard/deskTableUi';
import { sizedTableClassNames } from '../frontoffice/columnResize';
import { trackEvent } from '../../lib/analytics/trackEvent';
import type { Supplier } from '../../lib/inventory/models';
import { useSupplierStore } from '../../lib/inventory/supplierStore';
import { useInventoryScreen } from './inventoryScreenContext';

function blankSupplierForm(code: string): Partial<Supplier> {
  return {
    code,
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Ghana',
    postalCode: '',
    taxId: '',
    paymentTerms: 'net30',
    creditLimit: 0,
    currentBalance: 0,
    rating: 0,
    categories: [],
    isActive: true,
    contractStartDate: new Date(),
    performance: {
      onTimeDelivery: 0,
      qualityRating: 0,
      responseTime: 0,
      totalOrders: 0,
    },
  };
}

/** The inventory supplier form. Accounting opens this same dialog. */
export function SupplierFormModal({
  isOpen,
  editing = null,
  onClose,
}: {
  isOpen: boolean;
  editing?: Supplier | null;
  onClose: () => void;
}) {
  const addSupplier = useSupplierStore((s) => s.addSupplier);
  const updateSupplier = useSupplierStore((s) => s.updateSupplier);
  const generateNextSupplierCode = useSupplierStore((s) => s.generateNextSupplierCode);
  const [form, setForm] = useState<Partial<Supplier>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (editing) setForm({ ...editing });
    else setForm(blankSupplierForm(generateNextSupplierCode()));
  }, [isOpen, editing, generateNextSupplierCode]);

  const handleSave = () => {
    if (!String(form.name || '').trim()) {
      alert('Supplier name is required.');
      return;
    }
    if (editing) {
      updateSupplier(editing.id, form as Partial<Supplier>);
      trackEvent('Stores.Issued', { action: 'update_supplier', supplierCode: editing.code });
    } else {
      const created: Supplier = {
        ...blankSupplierForm(form.code || generateNextSupplierCode()),
        ...form,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
        code: form.code || '',
        name: form.name || '',
        contactPerson: form.contactPerson || '',
        email: form.email || '',
        phone: form.phone || '',
        address: form.address || '',
        city: form.city || '',
        country: form.country || 'Ghana',
        postalCode: form.postalCode || '',
        taxId: form.taxId || '',
        paymentTerms: form.paymentTerms || 'net30',
        creditLimit: form.creditLimit || 0,
        currentBalance: form.currentBalance || 0,
        rating: form.rating || 0,
        categories: form.categories || [],
        isActive: form.isActive !== false,
        contractStartDate: form.contractStartDate || new Date(),
        performance: form.performance || {
          onTimeDelivery: 0,
          qualityRating: 0,
          responseTime: 0,
          totalOrders: 0,
        },
      };
      addSupplier(created);
      trackEvent('Stores.Issued', { action: 'add_supplier', supplierCode: created.code });
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>{editing ? 'Edit Supplier' : 'Add Supplier'}</ModalHeader>
        <ModalBody>
          <p className="text-sm text-slate-500 -mt-1 mb-2">
            Who you buy from. Rating and balance stay on View / Accounting.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Supplier Code"
              value={form.code || ''}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Auto-generated"
              isDisabled={!editing}
              description={editing ? 'Code can be edited' : 'Auto-generated'}
              isRequired
            />
            <Input
              label="Supplier Name"
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Accra Fresh Foods Ltd"
              isRequired
              classNames={{ input: 'font-medium' }}
            />
            <Input
              label="Contact Person"
              value={form.contactPerson || ''}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              placeholder="Who we call"
            />
            <Input
              label="Phone"
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+233 XX XXX XXXX"
            />
            <Input
              label="Email"
              type="email"
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="supplier@email.com"
              className="col-span-2"
            />
            <Textarea
              label="Address"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street / building"
              className="col-span-2"
              minRows={2}
            />
            <Input
              label="City"
              value={form.city || ''}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="e.g. Accra"
            />
            <Input
              label="Category — what they’re into"
              value={form.categories?.join(', ') || ''}
              onChange={(e) => setForm({
                ...form,
                categories: e.target.value.split(',').map((c) => c.trim()).filter(Boolean),
              })}
              placeholder="e.g. food, cleaning, linens"
              description="Separate with commas — shows as chips in the table"
            />
            <Select
              label="Payment Terms"
              selectedKeys={form.paymentTerms ? [form.paymentTerms] : ['net30']}
              onSelectionChange={(keys) => setForm({ ...form, paymentTerms: Array.from(keys)[0] as Supplier['paymentTerms'] })}
            >
              <SelectItem key="immediate">Immediate</SelectItem>
              <SelectItem key="net30">Net 30</SelectItem>
              <SelectItem key="net60">Net 60</SelectItem>
              <SelectItem key="net90">Net 90</SelectItem>
            </Select>
            <Input
              label="Credit Limit (₵)"
              type="number"
              value={form.creditLimit?.toString() || '0'}
              onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })}
              description="Optional"
            />
            <Input
              label="Tax ID / TIN"
              value={form.taxId || ''}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              placeholder="e.g. GH123456789"
              className="col-span-2"
            />
            <div className="col-span-2">
              <Chip
                color={form.isActive !== false ? 'success' : 'warning'}
                variant="flat"
                onClick={() => setForm({ ...form, isActive: !(form.isActive !== false) })}
                className="cursor-pointer"
              >
                {form.isActive !== false ? '✓ Active — ready to buy from' : 'Inactive — paused'}
              </Chip>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="bordered" onPress={onClose}>Cancel</Button>
          <Button color="primary" className="bg-blue-500" onPress={handleSave}>
            {editing ? 'Update' : 'Add'} Supplier
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/** Inventory → Suppliers. Supplier table. */
export function SuppliersTable() {
  const inventoryScreen = useInventoryScreen();
  return (
    <div className="space-y-3">
      {/* Filters and Search */}
      <Card className="border-0 shadow-lg">
        <CardBody className="px-3 py-2">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <Input
              size="sm"
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
              size="sm"
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
        <CardHeader className="!px-3 !pt-2 !pb-0">
          <div className="flex items-center justify-between w-full">
            <h3 className="text-base font-semibold text-ghana-black">🤝 Suppliers</h3>
            <Button
              size="sm"
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
        <CardBody className={`${deskTableCardBodyClassName} !pt-1`}>
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
            <SupplierFormModal
              isOpen={inventoryScreen.isSupplierModalOpen}
              editing={inventoryScreen.editingSupplier}
              onClose={inventoryScreen.onSupplierModalClose}
            />

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
                <ModalFooter className="flex w-full flex-wrap items-center gap-2 !justify-between">
                  <div>
                  {inventoryScreen.viewingSupplier && (
                    <Button color="danger" variant="light" onPress={() => { inventoryScreen.setSupplierViewOpen(false); void inventoryScreen.handleDeleteSupplier(inventoryScreen.viewingSupplier.id); }}>Delete</Button>
                  )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                  {inventoryScreen.viewingSupplier && (
                    <Button color="primary" variant="flat" onPress={() => {
                      inventoryScreen.setSupplierViewOpen(false);
                      inventoryScreen.handleEditSupplier(inventoryScreen.viewingSupplier);
                    }}>
                      Edit
                    </Button>
                  )}
                  {inventoryScreen.viewingSupplier && (
                    <Button variant="flat" onPress={() => {
                      const supplier = inventoryScreen.viewingSupplier;
                      inventoryScreen.printInventorySheet({
                        title: 'Supplier',
                        subtitle: supplier.code,
                        fields: [
                          ['Name', supplier.name],
                          ['Contact', supplier.contactPerson || '—'],
                          ['Phone', supplier.phone || '—'],
                          ['Email', supplier.email || '—'],
                          ['Terms', supplier.paymentTerms || '—'],
                        ],
                      });
                    }}>
                      Print
                    </Button>
                  )}
                  <Button variant="bordered" onPress={() => inventoryScreen.setSupplierViewOpen(false)}>Close</Button>
                  </div>
                </ModalFooter>
              </ModalContent>
            </Modal>
          </>
        )}


  </>
  );
}
