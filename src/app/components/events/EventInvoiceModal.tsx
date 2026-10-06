'use client';

import { Autocomplete, AutocompleteItem, Badge, Button, Card, CardBody, CardHeader, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea } from '@heroui/react';
import type { EventInvoiceStatus } from './eventTypes';
import { useEventsScreen } from './eventsScreenContext';
import PostingDateField from '../shared/PostingDateField';

/** Events → invoice dialog. */
export function EventInvoiceModal() {
  const eventsScreen = useEventsScreen();
  return (
  <>
        {/* Event Invoice Modal */}
        <Modal
          isOpen={eventsScreen.isInvoiceModalOpen}
          onClose={() => eventsScreen.setIsInvoiceModalOpen(false)}
          size="3xl"
          scrollBehavior="inside"
        >
          <ModalContent>
            <ModalHeader>
              <div className="flex items-center gap-2">
                <span className="text-2xl">📄</span>
                <div>
                  <h3 className="text-lg font-semibold">
                    {eventsScreen.invoiceModalMode === 'edit' ? 'Edit Invoice' : 'Create Invoice'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {eventsScreen.invoiceForm.eventName || 'Event Invoice'}
                  </p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody className="py-6">
              <div className="space-y-6">
                {/* Header Section */}
                <Card className="border border-gray-200">
                  <CardHeader>
                    <h4 className="font-semibold text-gray-800">Invoice Details</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Invoice Number"
                        placeholder="INV-123456"
                        value={eventsScreen.invoiceForm.id || ''}
                        onValueChange={(value) => eventsScreen.setInvoiceForm(prev => ({ ...prev, id: value }))}
                        isInvalid={!!eventsScreen.invoiceErrors.id}
                        errorMessage={eventsScreen.invoiceErrors.id}
                      />
                      <Input
                        label="Reference (Optional)"
                        value={eventsScreen.invoiceForm.reference || ''}
                        onValueChange={(value) => eventsScreen.setInvoiceForm(prev => ({ ...prev, reference: value }))}
                        placeholder="PO number or reference"
                      />
                    </div>
                    <Input
                      label="Event"
                      value={eventsScreen.invoiceForm.eventName || ''}
                      isReadOnly
                      variant="flat"
                      description="Linked to selected event"
                    />
                    <Input
                      label="Client Name"
                      value={eventsScreen.invoiceForm.clientName || ''}
                      onValueChange={(value) => eventsScreen.setInvoiceForm(prev => ({ ...prev, clientName: value }))}
                      isInvalid={!!eventsScreen.invoiceErrors.clientName}
                      errorMessage={eventsScreen.invoiceErrors.clientName}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <PostingDateField
                        label="Issue Date"
                        type="date"
                        value={eventsScreen.invoiceForm.issueDate || ''}
                        onValueChange={(value) => eventsScreen.setInvoiceForm(prev => ({ ...prev, issueDate: value }))}
                        isInvalid={!!eventsScreen.invoiceErrors.issueDate}
                        errorMessage={eventsScreen.invoiceErrors.issueDate}
                      />
                      <Input
                        label="Due Date"
                        type="date"
                        value={eventsScreen.invoiceForm.dueDate || ''}
                        onValueChange={(value) => eventsScreen.setInvoiceForm(prev => ({ ...prev, dueDate: value }))}
                        isInvalid={!!eventsScreen.invoiceErrors.dueDate}
                        errorMessage={eventsScreen.invoiceErrors.dueDate}
                      />
                    </div>
                  </CardBody>
                </Card>

                {/* Financial Section */}
                <Card className="border border-gray-200">
                  <CardHeader>
                    <h4 className="font-semibold text-gray-800">Financial Details</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    {/* Amount Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Subtotal (₵)"
                        type="number"
                        value={eventsScreen.invoiceForm.subtotal?.toString() || '0'}
                        onValueChange={(value) => {
                          const num = parseFloat(value) || 0;
                          const tax = eventsScreen.invoiceForm.tax || 0;
                          const newTotal = num + tax;
                          eventsScreen.setInvoiceForm(prev => ({
                            ...prev,
                            subtotal: num,
                            total: newTotal,
                            balance: newTotal
                          }));
                        }}
                        isInvalid={!!eventsScreen.invoiceErrors.subtotal}
                        errorMessage={eventsScreen.invoiceErrors.subtotal}
                        startContent={<span className="text-gray-500">₵</span>}
                      />
                      <Input
                        label="Tax (₵)"
                        type="number"
                        value={eventsScreen.invoiceForm.tax?.toString() || '0'}
                        onValueChange={(value) => {
                          const num = parseFloat(value) || 0;
                          const subtotal = eventsScreen.invoiceForm.subtotal || 0;
                          const newTotal = subtotal + num;
                          eventsScreen.setInvoiceForm(prev => ({
                            ...prev,
                            tax: num,
                            total: newTotal,
                            balance: newTotal
                          }));
                        }}
                        isInvalid={!!eventsScreen.invoiceErrors.tax}
                        errorMessage={eventsScreen.invoiceErrors.tax}
                        startContent={<span className="text-gray-500">₵</span>}
                      />
                    </div>

                    {/* Total and Balance */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Total Amount:</span>
                          <span className="text-lg font-bold text-gray-900">
                            ₵{eventsScreen.formatCurrency(eventsScreen.invoiceForm.total || 0)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Subtotal: ₵{eventsScreen.formatCurrency(eventsScreen.invoiceForm.subtotal || 0)} +
                          Tax: ₵{eventsScreen.formatCurrency(eventsScreen.invoiceForm.tax || 0)}
                        </div>
                      </div>
                      <Input
                        label="Outstanding Balance (₵)"
                        type="number"
                        value={eventsScreen.invoiceForm.balance?.toString() || '0'}
                        onValueChange={(value) => eventsScreen.setInvoiceForm(prev => ({ ...prev, balance: parseFloat(value) || 0 }))}
                        isInvalid={!!eventsScreen.invoiceErrors.balance}
                        errorMessage={eventsScreen.invoiceErrors.balance}
                        description="Amount still owed by client"
                        startContent={<span className="text-gray-500">₵</span>}
                      />
                    </div>
                  </CardBody>
                </Card>

                {/* Notes & Status Section */}
                <Card className="border border-gray-200">
                  <CardHeader>
                    <h4 className="font-semibold text-gray-800">Notes & Status</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <Textarea
                      label="Invoice Notes"
                      value={eventsScreen.invoiceForm.notes || ''}
                      onValueChange={(value) => eventsScreen.setInvoiceForm(prev => ({ ...prev, notes: value }))}
                      placeholder="Payment terms, special instructions, or additional notes"
                      minRows={3}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Select
                        label="Invoice Status"
                        selectedKeys={eventsScreen.invoiceForm.status ? [eventsScreen.invoiceForm.status] : []}
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys)[0] as EventInvoiceStatus;
                          eventsScreen.setInvoiceForm(prev => ({ ...prev, status: selected }));
                        }}
                        description="Current status of this invoice"
                      >
                        <SelectItem key="Draft">
                          <div className="flex items-center gap-2">
                            <span>📝</span>
                            <span>Draft</span>
                          </div>
                        </SelectItem>
                        <SelectItem key="Issued">
                          <div className="flex items-center gap-2">
                            <span>📤</span>
                            <span>Issued</span>
                          </div>
                        </SelectItem>
                        <SelectItem key="Paid">
                          <div className="flex items-center gap-2">
                            <span>✅</span>
                            <span>Paid</span>
                          </div>
                        </SelectItem>
                        <SelectItem key="Partial">
                          <div className="flex items-center gap-2">
                            <span>💰</span>
                            <span>Partial</span>
                          </div>
                        </SelectItem>
                        <SelectItem key="Overdue">
                          <div className="flex items-center gap-2">
                            <span>⚠️</span>
                            <span>Overdue</span>
                          </div>
                        </SelectItem>
                      </Select>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Quick Actions</label>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            onPress={() => {
                              const event = eventsScreen.allEvents.find(ev => ev.id === eventsScreen.invoiceForm.eventId);
                              if (event) {
                                eventsScreen.openEventForEdit(event, false, false);
                              }
                            }}
                          >
                            View Event
                          </Button>
                          <Button
                            size="sm"
                            variant="flat"
                            color="secondary"
                            onPress={() => {
                              const details = `Invoice: ${eventsScreen.invoiceForm.id}\nClient: ${eventsScreen.invoiceForm.clientName}\nAmount: ₵${eventsScreen.invoiceForm.total}\nDue: ${eventsScreen.invoiceForm.dueDate}`;
                              navigator.clipboard.writeText(details);
                            }}
                          >
                            Copy Details
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {eventsScreen.invoiceForm.status && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Status:</span>
                        <Badge
                          color={
                            eventsScreen.invoiceForm.status === 'Paid' ? 'success' :
                            eventsScreen.invoiceForm.status === 'Partial' ? 'warning' :
                            eventsScreen.invoiceForm.status === 'Overdue' ? 'danger' :
                            eventsScreen.invoiceForm.status === 'Issued' ? 'primary' : 'default'
                          }
                          variant="flat"
                        >
                          {eventsScreen.invoiceForm.status}
                        </Badge>
                        {eventsScreen.invoiceForm.status === 'Paid' && (
                          <span className="text-xs text-green-600">🎉 Fully paid</span>
                        )}
                        {eventsScreen.invoiceForm.status === 'Overdue' && (
                          <span className="text-xs text-red-600">⚠️ Requires attention</span>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            </ModalBody>
            <ModalFooter>
              <div className="flex justify-between items-center w-full">
                <div className="text-xs text-gray-500">
                  {eventsScreen.invoiceModalMode === 'edit' ? 'Update existing invoice' : 'Create new invoice for event'}
                </div>
                <div className="flex gap-2">
                  <Button color="default" variant="flat" onPress={() => eventsScreen.setIsInvoiceModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    onPress={eventsScreen.handleInvoiceSave}
                    startContent={<span>💾</span>}
                  >
                    {eventsScreen.invoiceModalMode === 'edit' ? 'Update Invoice' : 'Create Invoice'}
                  </Button>
                </div>
              </div>
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}

/** Events → pick a proforma before creating an invoice. */
export function EventProformaPickerModal() {
  const eventsScreen = useEventsScreen();
  return (
  <>
        <Modal
          isOpen={eventsScreen.isInvoiceEventPickerOpen}
          onClose={() => eventsScreen.setIsInvoiceEventPickerOpen(false)}
          size="md"
        >
          <ModalContent>
            <ModalHeader>Select Proforma</ModalHeader>
            <ModalBody className="space-y-4">
              <p className="text-sm text-gray-600">
                Choose the quote / proforma to convert. The same event form opens so you can edit the details and issue the invoice.
              </p>
              <Autocomplete
                label="Proforma"
                placeholder="Type to filter quotes"
                selectedKey={eventsScreen.invoiceCreateEventId || null}
                items={eventsScreen.getInvoiceableProformas().map((ev) => ({
                  key: ev.id,
                  label: eventsScreen.getProformaPickerLabel(ev),
                }))}
                onSelectionChange={(key) => {
                  if (key == null) return;
                  eventsScreen.setInvoiceCreateEventId(String(key));
                }}
              >
                {(item) => (
                  <AutocompleteItem key={item.key} textValue={item.label}>
                    {item.label}
                  </AutocompleteItem>
                )}
              </Autocomplete>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={() => eventsScreen.setIsInvoiceEventPickerOpen(false)}>
                Cancel
              </Button>
              <Button color="primary" onPress={eventsScreen.confirmCreateInvoiceForEvent}>
                Continue
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}
