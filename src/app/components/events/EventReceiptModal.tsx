'use client';

import { Autocomplete, AutocompleteItem, Button, Card, CardBody, Checkbox, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@heroui/react';
import { resolveReceiptMethod, withCurrentOption } from './eventShared';
import { useEventsScreen } from './eventsScreenContext';
import PostingDateField from '../shared/PostingDateField';

/** Events → receipt dialog. */
export function EventReceiptModal() {
  const eventsScreen = useEventsScreen();
  return (
  <>
        {/* Event Receipt Modal */}
        <Modal
          isOpen={eventsScreen.isReceiptModalOpen}
          onOpenChange={(open) => {
            if (!open) eventsScreen.closeReceiptWorkspace();
          }}
          onClose={eventsScreen.closeReceiptWorkspace}
          size="2xl"
          scrollBehavior="inside"
          classNames={{
            base: 'max-h-[90vh]',
            header: 'px-5 py-3 border-b border-slate-100',
            body: 'px-5 py-4',
            footer: 'px-5 py-3 border-t border-slate-100',
          }}
        >
          <ModalContent>
            {(() => {
              const selectedInvoice = eventsScreen.eventInvoices.find((inv) => inv.id === eventsScreen.receiptForm.invoiceId);
              const outstanding = Number(selectedInvoice?.balance || 0);
              const invoiceTotal = Number(selectedInvoice?.total || 0);
              const paidSoFar = Math.max(0, invoiceTotal - outstanding);
              const receiptAmount = Number(eventsScreen.receiptForm.amount || 0);
              const invoiceQuery = eventsScreen.receiptInvoiceQuery.trim().toLowerCase();
              const invoiceItems = (() => {
                if (eventsScreen.receiptInvoiceLocked) {
                  return selectedInvoice
                    ? [{ key: selectedInvoice.id, label: eventsScreen.getInvoiceReceiptLabel(selectedInvoice) }]
                    : [];
                }
                const unpaid = eventsScreen.eventInvoices
                  .filter((inv) => Number(inv.balance || 0) > 0.01)
                  .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));
                const matches = invoiceQuery.length < 2
                  ? []
                  : unpaid.filter((inv) => {
                      const haystack = [
                        eventsScreen.getConferenceInvoiceNumber(inv.id, inv.eventId),
                        inv.eventName,
                        inv.clientName,
                        inv.id,
                      ].join(' ').toLowerCase();
                      return haystack.includes(invoiceQuery);
                    }).slice(0, 20);
                if (selectedInvoice && !matches.some((inv) => inv.id === selectedInvoice.id)) {
                  return [selectedInvoice, ...matches].map((inv) => ({ key: inv.id, label: eventsScreen.getInvoiceReceiptLabel(inv) }));
                }
                return matches.map((inv) => ({ key: inv.id, label: eventsScreen.getInvoiceReceiptLabel(inv) }));
              })();
              const linkedReceipts = selectedInvoice
                ? eventsScreen.eventReceipts.filter((rcpt) => rcpt.invoiceId === selectedInvoice.id)
                : [];
              const invoicePaid = !!selectedInvoice && outstanding <= 0;
              const afterThisReceipt = Math.max(0, outstanding - receiptAmount);
              const applyInvoiceSelection = (invoiceId: string) => {
                const invoice = eventsScreen.eventInvoices.find((inv) => inv.id === invoiceId);
                if (!invoice) return;
                const event = eventsScreen.allEvents.find((ev) => ev.id === invoice.eventId);
                eventsScreen.setReceiptForm((prev) => ({
                  ...prev,
                  eventId: invoice.eventId,
                  eventName: invoice.eventName || eventsScreen.getEventDisplayName(event),
                  clientName: invoice.clientName || eventsScreen.getEventClientName(event),
                  invoiceId: invoice.id,
                  amount: Number(invoice.balance || 0),
                }));
                eventsScreen.setReceiptErrors((prev) => {
                  const next = { ...prev };
                  delete next.invoiceId;
                  delete next.eventId;
                  delete next.clientName;
                  return next;
                });
              };
              return (
                <>
            <ModalHeader>
              <div>
                <h3 className="text-lg font-semibold text-ghana-black">
                  {eventsScreen.receiptModalMode === 'edit' ? 'Edit Receipt' : 'Record Receipt'}
                  {eventsScreen.receiptForm.status === 'Void' ? ' · Void' : ''}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {eventsScreen.receiptModalMode === 'edit'
                    ? 'Update this payment against the selected invoice.'
                    : eventsScreen.receiptInvoiceLocked
                      ? 'Payment against this invoice.'
                      : 'Search the unpaid invoice. Do not browse the full invoice book.'}
                </p>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                {eventsScreen.receiptInvoiceLocked && selectedInvoice ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-xs text-slate-500">Invoice</p>
                    <p className="font-semibold text-slate-900">
                      {eventsScreen.getConferenceInvoiceNumber(selectedInvoice.id, selectedInvoice.eventId) || 'Invoice'}
                    </p>
                    <p className="text-sm text-slate-600">
                      {eventsScreen.receiptForm.eventName || selectedInvoice.eventName || 'Event'}
                      {eventsScreen.receiptForm.clientName || selectedInvoice.clientName
                        ? ` · ${eventsScreen.receiptForm.clientName || selectedInvoice.clientName}`
                        : ''}
                    </p>
                  </div>
                ) : (
                <Autocomplete
                  size="sm"
                  label="Invoice"
                  placeholder="Type invoice number, event, or client"
                  selectedKey={eventsScreen.receiptForm.invoiceId || null}
                  items={invoiceItems}
                  menuTrigger="input"
                  inputValue={eventsScreen.receiptInvoiceQuery}
                  isInvalid={!!eventsScreen.receiptErrors.invoiceId || !!eventsScreen.receiptErrors.clientName}
                  errorMessage={eventsScreen.receiptErrors.invoiceId || eventsScreen.receiptErrors.clientName}
                  description={invoiceQuery.length < 2 ? 'Type at least 2 characters to find an unpaid invoice' : 'Unpaid invoices matching your search'}
                  onInputChange={eventsScreen.setReceiptInvoiceQuery}
                  onSelectionChange={(key) => {
                    if (key == null) return;
                    applyInvoiceSelection(String(key));
                  }}
                >
                  {(item) => (
                    <AutocompleteItem key={item.key} textValue={item.label}>
                      {item.label}
                    </AutocompleteItem>
                  )}
                </Autocomplete>
                )}

                {selectedInvoice && (
                  <>
                    {!eventsScreen.receiptInvoiceLocked && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip size="sm" color="primary" variant="flat">{eventsScreen.receiptForm.eventName || selectedInvoice.eventName || 'Event'}</Chip>
                      <Chip size="sm" color="secondary" variant="flat">{eventsScreen.receiptForm.clientName || selectedInvoice.clientName || 'Client'}</Chip>
                      {linkedReceipts.length > 0 && (
                        <Chip size="sm" variant="flat">
                          {linkedReceipts.length} receipt{linkedReceipts.length === 1 ? '' : 's'}
                        </Chip>
                      )}
                    </div>
                    )}
                    <Card className="bg-blue-50 border border-blue-200 shadow-none">
                      <CardBody className="py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <div className="text-gray-500">Invoice</div>
                            <div className="font-semibold">{eventsScreen.getConferenceInvoiceNumber(selectedInvoice.id, selectedInvoice.eventId) || 'Invoice'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Invoice total</div>
                            <div className="font-medium">{eventsScreen.formatCurrency(invoiceTotal)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Balance due</div>
                            <div className={`font-bold ${invoicePaid ? 'text-green-700' : 'text-orange-600'}`}>
                              {eventsScreen.formatCurrency(outstanding)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">After this receipt</div>
                            <div className="font-bold text-green-700">{eventsScreen.formatCurrency(afterThisReceipt)}</div>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </>
                )}
                {invoicePaid && eventsScreen.receiptModalMode === 'create' && (
                  <p className="text-xs text-success">
                    This invoice is already settled{linkedReceipts[0] ? ` (${linkedReceipts[0].id})` : ''}. Enter an amount only if you are recording an additional payment.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    size="sm"
                    label="Amount received *"
                    type="number"
                    placeholder="0.00"
                    value={eventsScreen.receiptForm.amount?.toString() ?? ''}
                    onValueChange={(value) => eventsScreen.setReceiptForm(prev => ({ ...prev, amount: parseFloat(value) || 0 }))}
                    isInvalid={!!eventsScreen.receiptErrors.amount}
                    errorMessage={eventsScreen.receiptErrors.amount}
                    description={selectedInvoice ? `Balance due ${eventsScreen.formatCurrency(outstanding)}` : 'Enter amount received'}
                    startContent={<span className="text-slate-400 text-xs">₵</span>}
                    endContent={
                      selectedInvoice && outstanding > 0 ? (
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => eventsScreen.setReceiptForm((prev) => ({ ...prev, amount: outstanding }))}
                        >
                          Fill
                        </Button>
                      ) : undefined
                    }
                  />
                  <PostingDateField
                    size="sm"
                    label="Receipt date"
                    type="date"
                    value={eventsScreen.receiptForm.date || ''}
                    onValueChange={(value) => eventsScreen.setReceiptForm(prev => ({ ...prev, date: value }))}
                    isInvalid={!!eventsScreen.receiptErrors.date}
                    errorMessage={eventsScreen.receiptErrors.date}
                  />
                  <Select
                    size="sm"
                    label="Payment method"
                    selectedKeys={[resolveReceiptMethod(eventsScreen.receiptForm.method)]}
                    onSelectionChange={(keys) => {
                      const method = resolveReceiptMethod(Array.from(keys)[0] as string);
                      eventsScreen.setReceiptForm(prev => ({
                        ...prev,
                        method,
                        ...(method !== 'Cheque' ? { checkNumber: '' } : {}),
                      }));
                    }}
                  >
                    {eventsScreen.receiptMethods.map(method => (
                      <SelectItem key={method} textValue={eventsScreen.receiptMethodLabels[method]}>
                        {eventsScreen.receiptMethodLabels[method]}
                      </SelectItem>
                    ))}
                  </Select>
                  <Autocomplete
                    size="sm"
                    label="Recorded by"
                    placeholder="Pick staff"
                    selectedKey={eventsScreen.receiptForm.recordedBy || null}
                    inputValue={eventsScreen.receiptForm.recordedBy || ''}
                    allowsCustomValue
                    items={withCurrentOption(
                      eventsScreen.eventStaffOptions.map((option) => option.label),
                      eventsScreen.receiptForm.recordedBy || ''
                    ).map((name) => ({ key: name, label: name }))}
                    onSelectionChange={(key) => {
                      if (key != null) eventsScreen.setReceiptForm((prev) => ({ ...prev, recordedBy: String(key) }));
                    }}
                    onInputChange={(value) => eventsScreen.setReceiptForm((prev) => ({ ...prev, recordedBy: value }))}
                  >
                    {(item) => (
                      <AutocompleteItem key={item.key} textValue={item.label}>
                        {item.label}
                      </AutocompleteItem>
                    )}
                  </Autocomplete>
                  {eventsScreen.receiptForm.method === 'Cheque' && (
                    <Input
                      size="sm"
                      label="Cheque number *"
                      value={eventsScreen.receiptForm.checkNumber || ''}
                      onValueChange={(value) => eventsScreen.setReceiptForm(prev => ({ ...prev, checkNumber: value }))}
                      isInvalid={!!eventsScreen.receiptErrors.checkNumber}
                      errorMessage={eventsScreen.receiptErrors.checkNumber}
                    />
                  )}
                  <Input
                    size="sm"
                    label="Reference / transaction ID"
                    value={eventsScreen.receiptForm.reference || ''}
                    onValueChange={(value) => eventsScreen.setReceiptForm(prev => ({ ...prev, reference: value }))}
                    placeholder="Bank ref, MoMo txn…"
                    className={eventsScreen.receiptForm.method === 'Cheque' ? '' : 'sm:col-span-2'}
                  />
                  <Input
                    size="sm"
                    label="Notes (optional)"
                    placeholder="Internal note"
                    value={eventsScreen.receiptForm.notes || ''}
                    onValueChange={(value) => eventsScreen.setReceiptForm(prev => ({ ...prev, notes: value }))}
                    className="sm:col-span-2"
                  />
                </div>
                {selectedInvoice && receiptAmount > outstanding && outstanding > 0 && (
                  <p className="text-xs text-warning">Amount is above the outstanding balance of {eventsScreen.formatCurrency(outstanding)}.</p>
                )}
                {eventsScreen.receiptModalMode !== 'edit' && (
                  <Checkbox
                    size="sm"
                    isSelected={eventsScreen.receiptPrintAfterSave}
                    onValueChange={eventsScreen.setReceiptPrintAfterSave}
                  >
                    Print receipt after posting
                  </Checkbox>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                size="sm"
                color="danger"
                variant="flat"
                isDisabled={eventsScreen.receiptModalMode !== 'edit' || !eventsScreen.receiptForm.id}
                onPress={eventsScreen.deleteActiveReceipt}
              >
                Delete
              </Button>
              {eventsScreen.receiptForm.status === 'Void' ? (
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  isDisabled={eventsScreen.receiptModalMode !== 'edit' || !eventsScreen.receiptForm.id}
                  onPress={eventsScreen.unvoidActiveReceipt}
                >
                  Unvoid
                </Button>
              ) : (
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  isDisabled={eventsScreen.receiptModalMode !== 'edit' || !eventsScreen.receiptForm.id}
                  onPress={eventsScreen.voidActiveReceipt}
                >
                  Void
                </Button>
              )}
              {eventsScreen.receiptModalMode === 'edit' && (
                <Button
                  size="sm"
                  variant="flat"
                  isDisabled={!eventsScreen.receiptForm.id || eventsScreen.receiptForm.status === 'Void'}
                  onPress={() => {
                    const form = eventsScreen.receiptForm;
                    if (!form.id) return;
                    eventsScreen.handleDownloadReceiptPdf({
                      id: form.id,
                      eventId: form.eventId || '',
                      eventName: form.eventName || '',
                      invoiceId: form.invoiceId,
                      clientName: form.clientName || '',
                      date: form.date || new Date().toISOString().split('T')[0],
                      amount: Number(form.amount ?? 0),
                      method: resolveReceiptMethod(form.method),
                      reference: form.reference,
                      checkNumber: form.checkNumber,
                      recordedBy: form.recordedBy || 'Events Team',
                      notes: form.notes,
                      status: form.status === 'Void' ? 'Void' : 'Posted',
                    });
                  }}
                >
                  Print receipt
                </Button>
              )}
              <Button size="sm" variant="flat" onPress={eventsScreen.closeReceiptWorkspace}>
                Cancel
              </Button>
              <Button
                size="sm"
                color="primary"
                onPress={eventsScreen.handleReceiptSave}
                isDisabled={
                  (eventsScreen.receiptModalMode === 'create' && receiptAmount <= 0) ||
                  eventsScreen.receiptForm.status === 'Void'
                }
              >
                {eventsScreen.receiptModalMode === 'edit' ? 'Save Changes' : 'Post Receipt'}
              </Button>
            </ModalFooter>
                </>
              );
            })()}
          </ModalContent>
        </Modal>


  </>
  );
}

/** Events → confirm before a document change. */
export function EventDocCautionModal() {
  const eventsScreen = useEventsScreen();
  return (
  <>
        <Modal
          isOpen={Boolean(eventsScreen.docCautionPrompt)}
          onClose={() => eventsScreen.setDocCautionPrompt(null)}
          size="sm"
        >
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">
              <span>{eventsScreen.docCautionPrompt?.title || 'Please confirm'}</span>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-slate-600">{eventsScreen.docCautionPrompt?.message}</p>
            </ModalBody>
            <ModalFooter>
              <Button size="sm" variant="flat" onPress={() => eventsScreen.setDocCautionPrompt(null)}>
                Keep as is
              </Button>
              <Button
                size="sm"
                color={eventsScreen.docCautionPrompt?.kind?.startsWith('delete') ? 'danger' : 'warning'}
                onPress={eventsScreen.confirmDocCaution}
              >
                {eventsScreen.docCautionPrompt?.confirmLabel || 'Confirm'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

  </>
  );
}
