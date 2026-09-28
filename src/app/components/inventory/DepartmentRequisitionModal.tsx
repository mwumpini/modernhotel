'use client';

import React, { useEffect, useState } from 'react';
import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Textarea,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Divider, Autocomplete, AutocompleteItem,
  Checkbox, Select, SelectItem,
} from '@heroui/react';
import { useSession } from 'next-auth/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';

function fbHeaders() {
  return { 'Content-Type': 'application/json', 'x-tenant-subdomain': getClientTenantSubdomain() };
}

export interface RequisitionCatalogItem {
  id: string;
  code: string;
  name: string;
  defaultCost: number;
}

interface RequisitionRow {
  rowId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  estimatedPrice: number;
}

const emptyRow = (): RequisitionRow => ({
  rowId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  itemId: '', itemCode: '', itemName: '', quantity: 1, estimatedPrice: 0,
});

/**
 * "Create Requisition" form shared by every department that requests stock from
 * Stores (Restaurant & Bar, Kitchen, ...) — same shape as Inventory & Stores' own
 * Create Requisition modal (auto-numbered, dynamic item rows via Autocomplete,
 * running total), just tagged with the requesting department so it lands scoped
 * in that department's own Requisitions list and, once approved, its own stock.
 */
export default function DepartmentRequisitionModal({
  isOpen, onClose, department, departmentLabel, inventoryItems, onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  department: string;
  departmentLabel: string;
  inventoryItems: RequisitionCatalogItem[];
  onCreated: () => void;
}) {
  const { data: session } = useSession();
  const currentUserName = session?.user?.name || 'User';

  const [requestedBy, setRequestedBy] = useState(currentUserName);
  const [requestedDate, setRequestedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<RequisitionRow[]>([]);
  const [itemSearchTerms, setItemSearchTerms] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');

  // Off by default — a requisition addresses the department queue in general
  // (whoever's on duty at Stores). Checking this lets the requester route it to
  // one specific Stores staffer instead, when they already know who should handle it.
  const [assignToStaff, setAssignToStaff] = useState(false);
  const [assignedToId, setAssignedToId] = useState('');
  const [storesStaff, setStoresStaff] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      setRequestedBy(currentUserName);
      setRequestedDate(new Date().toISOString().split('T')[0]);
      setRows([]);
      setItemSearchTerms({});
      setNotes('');
      setAssignToStaff(false);
      setAssignedToId('');
      fetch('/api/tenant?module=inventory', { headers: fbHeaders() })
        .then((r) => (r.ok ? r.json() : { staff: [] }))
        .then((data) => setStoresStaff(data.staff || []))
        .catch(() => setStoresStaff([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const addRow = () => setRows([...rows, emptyRow()]);
  const updateRow = (rowId: string, updates: Partial<RequisitionRow>) => {
    setRows(rows.map((r) => (r.rowId === rowId ? { ...r, ...updates } : r)));
  };
  const removeRow = (rowId: string) => setRows(rows.filter((r) => r.rowId !== rowId));

  const selectItem = (rowId: string, itemCode: string, index: number) => {
    const item = inventoryItems.find((i) => i.code === itemCode);
    if (!item) return;
    updateRow(rowId, { itemId: item.id, itemCode: item.code, itemName: item.name, estimatedPrice: item.defaultCost });
    setItemSearchTerms((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const getFilteredItems = (index: number) => {
    const term = (itemSearchTerms[index] || '').toLowerCase();
    if (!term) return inventoryItems.slice(0, 20);
    return inventoryItems.filter((i) => i.code.toLowerCase().includes(term) || i.name.toLowerCase().includes(term)).slice(0, 20);
  };

  const totalAmount = rows.reduce((sum, r) => sum + r.quantity * r.estimatedPrice, 0);

  const submit = async () => {
    const items = rows
      .filter((r) => r.itemId && r.quantity > 0)
      .map((r) => ({ itemId: r.itemId, itemCode: r.itemCode, itemName: r.itemName, quantity: r.quantity, estimatedPrice: r.estimatedPrice }));
    if (items.length === 0) return;
    const assignedStaff = assignToStaff ? storesStaff.find((s) => s.id === assignedToId) : undefined;
    const res = await fetch('/api/inventory/requisitions', {
      method: 'POST',
      headers: fbHeaders(),
      body: JSON.stringify({
        requestedBy, requestedDate, department, notes: notes || undefined, items,
        assignedToId: assignedStaff?.id,
        assignedToName: assignedStaff?.name,
      }),
    });
    if (res.ok) {
      onCreated();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside" classNames={{ base: '!max-w-[calc(64rem*0.85)]' }}>
      <ModalContent>
        <ModalHeader>Create Requisition — {departmentLabel} → Stores</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Requisition Number" value="" placeholder="REQ-0000" isDisabled description="Auto-generated" />
              <Input label="Requested By" value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} isRequired />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Requested Date"
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                isRequired
              />
              <div className="flex flex-col gap-2 border border-gray-200 rounded-lg px-3 py-2">
                <Checkbox
                  size="sm"
                  isSelected={assignToStaff}
                  onValueChange={(checked) => {
                    setAssignToStaff(checked);
                    if (!checked) setAssignedToId('');
                  }}
                >
                  Assign to a specific staff member
                </Checkbox>
                {assignToStaff ? (
                  <Select
                    size="sm"
                    placeholder="Choose staff at Stores..."
                    selectedKeys={assignedToId ? [assignedToId] : []}
                    onSelectionChange={(keys) => setAssignedToId((Array.from(keys)[0] as string) || '')}
                  >
                    {storesStaff.map((s) => (
                      <SelectItem key={s.id}>{s.name}</SelectItem>
                    ))}
                  </Select>
                ) : (
                  <p className="text-xs text-gray-500">Default: goes to the Stores queue, not a named person.</p>
                )}
              </div>
            </div>

            <Divider />

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Requested Items</h4>
                <Button size="sm" color="primary" onPress={addRow}>+ Add Item</Button>
              </div>
              {rows.length > 0 ? (
                <Table aria-label="Requested items" className="[&_thead]:hidden">
                  <TableHeader>
                    <TableColumn>Item</TableColumn>
                    <TableColumn>Quantity</TableColumn>
                    <TableColumn>Price</TableColumn>
                    <TableColumn>Total</TableColumn>
                    <TableColumn>Action</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={row.rowId}>
                        <TableCell className="w-[40%]">
                          <Autocomplete
                            placeholder="🔍 Search item by code or name..."
                            selectedKey={row.itemCode || undefined}
                            onSelectionChange={(key) => {
                              if (key) selectItem(row.rowId, String(key), index);
                            }}
                            onInputChange={(value) => setItemSearchTerms((prev) => ({ ...prev, [index]: value }))}
                            inputValue={
                              itemSearchTerms[index] !== undefined
                                ? itemSearchTerms[index]
                                : row.itemCode ? `${row.itemCode} - ${row.itemName}` : ''
                            }
                            size="sm"
                            allowsCustomValue={false}
                          >
                            {getFilteredItems(index).map((item) => (
                              <AutocompleteItem key={item.code} textValue={`${item.code} ${item.name}`}>
                                <div className="flex flex-col">
                                  <span className="font-semibold">{item.code}</span>
                                  <span className="text-sm text-gray-500">{item.name}</span>
                                </div>
                              </AutocompleteItem>
                            ))}
                          </Autocomplete>
                        </TableCell>
                        <TableCell className="w-[15%]">
                          <Input
                            type="number"
                            value={String(row.quantity)}
                            onChange={(e) => updateRow(row.rowId, { quantity: parseInt(e.target.value) || 0 })}
                            size="sm"
                            min="1"
                            placeholder="Qty"
                          />
                        </TableCell>
                        <TableCell className="w-[20%]">
                          <Input
                            type="number"
                            value={String(row.estimatedPrice)}
                            onChange={(e) => updateRow(row.rowId, { estimatedPrice: parseFloat(e.target.value) || 0 })}
                            size="sm"
                            startContent="₵"
                            placeholder="Price"
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold w-[15%]">
                          ₵{(row.quantity * row.estimatedPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="w-[10%]">
                          <Button size="sm" color="danger" variant="flat" onPress={() => removeRow(row.rowId)}>🗑️</Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
                  ₵{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes or justification..." />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="bordered" onPress={onClose}>Cancel</Button>
          <Button color="primary" onPress={submit} isDisabled={rows.filter((r) => r.itemId).length === 0}>
            Create Requisition
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
