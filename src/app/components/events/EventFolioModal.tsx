'use client';

import { Autocomplete, AutocompleteItem, Badge, Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Table, TableBody, TableCell, TableHeader, TableRow, Tooltip } from '@heroui/react';
import type { EventFolioEntry, EventInvoice } from './eventTypes';
import { FOLIO_PAGE_SIZE, folioAccountColumnList, renderFolioAccountColumn } from '../frontoffice/folioAccountColumns';
import React from 'react';
import { deskResizableTableClassNames } from '../frontoffice/columnResize';
import { useEventsScreen } from './eventsScreenContext';
import { isEventNoShow, scheduleHasEventComponent } from './eventShared';

function FolioStageActions() {
  const eventsScreen = useEventsScreen();
  const folio = eventsScreen.activeFolio;
  if (!folio) return null;
  const event =
    eventsScreen.reportingEvents.find((item) => item.id === folio.eventId) ||
    eventsScreen.allEvents.find((item) => item.id === folio.eventId);
  if (!event) return null;

  const invoice = eventsScreen.eventInvoices.find((item) => item.eventId === event.id);
  const business = String(event.status || '').toLowerCase();
  const lifecycle = String(event.eventStatus || '').toLowerCase();
  const ended = event.completionStatus === 'completed' || event.completionStatus === 'billed' || lifecycle === 'completed' || lifecycle === 'billed';
  const inProgress = lifecycle === 'in-progress';
  const roomOnly = !scheduleHasEventComponent(event.dailySchedule || [], event.customParticulars || []);
  const canCheckIn = !ended && !inProgress && !isEventNoShow(event) && business !== 'quote' && business !== 'cancelled' && roomOnly && !event.checkedIn && (lifecycle === 'confirmed' || business === 'confirmed');

  const openBeo = () => {
    eventsScreen.setSelectedEventForBEO(event);
    eventsScreen.generateBEO(event);
    eventsScreen.generateFunctionSheet(event);
    eventsScreen.setIsBEOModalOpen(true);
  };
  const openInvoice = () => {
    if (business === 'quote' && invoice) {
      eventsScreen.openInvoiceDetailEdit(invoice);
      return;
    }
    if (invoice) eventsScreen.openEventInvoiceForm(event, invoice);
    else eventsScreen.openEventInvoiceForm(event);
  };
  const openPay = () => {
    eventsScreen.openReceiptModal('create', undefined, {
      ...event,
      invoiceId: invoice?.id,
      balance: invoice?.balance ?? event.balance ?? 0,
    });
  };

  return (
    <>
      {isEventNoShow(event) && (
        <>
          <Button size="sm" color="warning" variant="flat" onPress={() => { void eventsScreen.markEventAsCompleted(event); }}>End</Button>
          <Button size="sm" color="danger" variant="flat" onPress={() => { void eventsScreen.cancelMissedEvent(event); }}>Cancel</Button>
        </>
      )}
      {!isEventNoShow(event) && business === 'quote' && (
        <>
          <Button size="sm" color="primary" variant="flat" onPress={openInvoice}>{invoice ? 'Invoice' : 'To invoice'}</Button>
          <Button size="sm" variant="flat" onPress={() => eventsScreen.openEventForEdit(event, true)}>Edit</Button>
          <Button size="sm" variant="flat" onPress={() => eventsScreen.handleDownloadQuotePdf(event)}>Print</Button>
          <Button size="sm" color="danger" variant="flat" onPress={() => { void eventsScreen.cancelMissedEvent(event); }}>Cancel</Button>
        </>
      )}
      {!isEventNoShow(event) && !ended && business !== 'quote' && business !== 'cancelled' && (
        <>
          {canCheckIn && (
            <Button size="sm" color="primary" variant="flat" onPress={() => { void eventsScreen.checkInEventGroup(event); }}>Check in</Button>
          )}
          {inProgress ? (
            <Button size="sm" color="warning" variant="flat" onPress={() => { void eventsScreen.markEventAsCompleted(event); }}>End</Button>
          ) : (
            <Button size="sm" color="warning" variant="flat" onPress={() => { void eventsScreen.markEventAsCompleted(event); }}>Complete</Button>
          )}
          <Button size="sm" variant="flat" onPress={openBeo}>BEO</Button>
          <Button size="sm" color="danger" variant="flat" onPress={() => { void eventsScreen.cancelMissedEvent(event); }}>Cancel</Button>
        </>
      )}
      {!isEventNoShow(event) && ended && (
        <>
          {event.completionStatus === 'completed' && (
            <Button size="sm" color="warning" variant="flat" onPress={() => { void eventsScreen.reopenEndedEvent(event); }}>Reopen</Button>
          )}
          <Button size="sm" color="primary" variant="flat" onPress={openPay}>Pay</Button>
          <Button size="sm" variant="flat" onPress={openBeo}>BEO</Button>
        </>
      )}
      {!isEventNoShow(event) && business === 'cancelled' && (
        <Button size="sm" variant="flat" onPress={openBeo}>BEO</Button>
      )}
    </>
  );
}

/** Events → folio dialog for an event. */
export function EventFolioModal() {
  const eventsScreen = useEventsScreen();
  return (
  <>
        {/* Event Folio Modal */}
        <Modal
          isOpen={eventsScreen.isFolioModalOpen}
          onClose={eventsScreen.closeFolioModal}
          size="4xl"
          scrollBehavior="inside"
        >
          <ModalContent className="w-[72.25vw] max-w-[935px]">
            <ModalHeader className="flex flex-col items-stretch gap-3">
              {eventsScreen.activeFolio ? (
                <>
                  <div className="flex items-start justify-between gap-4 rounded-lg border-l-4 border-ghana-green bg-green-50 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-green-800">Event Folio</p>
                      <h3 className="text-xl font-semibold text-green-900">{eventsScreen.formatFolioNumber(eventsScreen.activeFolio.id)}</h3>
                      <p className="text-sm font-normal text-slate-600">
                        {eventsScreen.activeFolio.eventName}
                        {eventsScreen.activeFolio.clientName ? <> · <span className="font-bold text-slate-900">{eventsScreen.activeFolio.clientName}</span></> : null}
                      </p>
                    </div>
                    <Badge
                      color={
                        eventsScreen.activeFolio.status === 'Void'
                          ? 'danger'
                          : eventsScreen.activeFolio.status === 'Open'
                            ? 'success'
                            : 'default'
                      }
                      variant="flat"
                    >
                      {eventsScreen.activeFolio.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Charges</p>
                      <p className="font-semibold text-slate-900">{eventsScreen.formatCurrency(eventsScreen.activeFolioTotals.debits)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Payments</p>
                      <p className="font-semibold text-slate-900">{eventsScreen.formatCurrency(eventsScreen.activeFolioTotals.credits)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">{eventsScreen.activeFolioBalance >= 0 ? 'Amount due' : 'Credit'}</p>
                      <p className={`font-semibold ${eventsScreen.activeFolioBalance > 0.01 ? 'text-red-700' : eventsScreen.activeFolioBalance < -0.01 ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {eventsScreen.formatCurrency(Math.abs(eventsScreen.activeFolioBalance))}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <h3 className="text-lg font-semibold">Event Folio</h3>
              )}
            </ModalHeader>
            <ModalBody className="py-4">
              {eventsScreen.activeFolio ? (
                <div className="space-y-4">
                  {eventsScreen.activeFolioBalance < -0.01 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <span>Credit {eventsScreen.formatCurrency(Math.abs(eventsScreen.activeFolioBalance))} on this account.</span>
                      <div className="flex gap-2">
                        <Button size="sm" color="warning" variant="flat" onPress={() => eventsScreen.processRefund(eventsScreen.activeFolio)}>
                          Refund
                        </Button>
                        <Button size="sm" variant="flat" onPress={() => eventsScreen.createCreditNote(eventsScreen.activeFolio)}>
                          Credit note
                        </Button>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const invoice = eventsScreen.eventInvoices.find((inv: EventInvoice) => inv.eventId === eventsScreen.activeFolio.eventId);
                    const event = eventsScreen.allEvents.find((ev) => ev.id === eventsScreen.activeFolio.eventId);
                    const folioLocked = eventsScreen.activeFolio.status === 'Void';
                    return (
                      <div className="flex w-full flex-wrap items-center gap-2">
                        {event && (
                          <Button size="sm" variant="flat" onPress={() => eventsScreen.openEventForView(event)}>
                            View
                          </Button>
                        )}
                        <Button
                          size="sm"
                          color="success"
                          variant="flat"
                          isDisabled={folioLocked}
                          onPress={() => {
                            if (invoice) {
                              eventsScreen.openReceiptFromInvoice(invoice);
                              return;
                            }
                            eventsScreen.openReceiptModal('create', undefined, {
                              ...(event || {}),
                              balance: Math.abs(eventsScreen.activeFolioBalance),
                            });
                          }}
                        >
                          Record receipt
                        </Button>
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          isDisabled={folioLocked}
                          onPress={() => {
                            eventsScreen.setFolioEntryForm((prev) => ({ ...prev, type: 'charge' }));
                            eventsScreen.setFolioComposerOpen(true);
                          }}
                        >
                          Add charge
                        </Button>
                        <Button size="sm" variant="flat" isDisabled={folioLocked} onPress={() => eventsScreen.createDebitNote(eventsScreen.activeFolio)}>
                          Debit note
                        </Button>
                        <div className="ml-auto flex items-center gap-2">
                          {invoice && (
                            <Button size="sm" variant="flat" onPress={() => eventsScreen.handleDownloadInvoicePdf(invoice)}>
                              Print invoice
                            </Button>
                          )}
                          <Button size="sm" variant="flat" onPress={eventsScreen.handlePrintEventFolio}>
                            Report
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  {eventsScreen.folioComposerOpen && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-800">Add charge</p>
                        <Button size="sm" variant="light" onPress={() => eventsScreen.setFolioComposerOpen(false)}>
                          Cancel
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Input
                          label="Amount"
                          type="number"
                          placeholder="0.00"
                          value={eventsScreen.folioEntryForm.amount > 0 ? String(eventsScreen.folioEntryForm.amount) : ''}
                          onValueChange={(value) => eventsScreen.setFolioEntryForm((prev) => ({ ...prev, amount: parseFloat(value) || 0 }))}
                          startContent={<span className="text-slate-400">₵</span>}
                        />
                        <Input
                          label="Description"
                          placeholder="Extra hours, equipment, late change"
                          value={eventsScreen.folioEntryForm.description}
                          onValueChange={(value) => eventsScreen.setFolioEntryForm((prev) => ({ ...prev, description: value }))}
                          className="md:col-span-2"
                        />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          color="primary"
                          onPress={eventsScreen.handleAddFolioEntry}
                          isDisabled={!eventsScreen.folioEntryForm.description.trim() || eventsScreen.folioEntryForm.amount <= 0}
                        >
                          Post charge
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-800">Account</h4>
                      {(eventsScreen.activeFolio.entries.length + (eventsScreen.activeFolio.openingBalance !== 0 ? 1 : 0)) > FOLIO_PAGE_SIZE && (
                        <Input
                          size="sm"
                          placeholder="Search entries"
                          value={eventsScreen.folioEntrySearch}
                          onValueChange={(value) => { eventsScreen.setFolioEntrySearch(value); eventsScreen.setFolioPage(1); }}
                          className="max-w-xs"
                          variant="bordered"
                        />
                      )}
                    </div>
                    {eventsScreen.activeFolio.entries.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                        No charges or payments on this folio yet.
                      </div>
                    ) : eventsScreen.filteredFolioEntries.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 py-8 text-center text-sm text-slate-500">
                        No entries match the search.
                        <div className="mt-2">
                          <Button size="sm" variant="flat" onPress={() => eventsScreen.setFolioEntrySearch('')}>
                            Clear search
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                      <div ref={eventsScreen.folioAccountCols.frameRef} style={eventsScreen.folioAccountCols.frameStyle}>
                      <Table
                        aria-label="Folio account"
                        removeWrapper
                        classNames={deskResizableTableClassNames()}
                      >
                        <TableHeader columns={folioAccountColumnList}>
                          {(col) => renderFolioAccountColumn(col, eventsScreen.folioSortKey, eventsScreen.folioSortDir, eventsScreen.sortFolioAccount, eventsScreen.folioAccountCols)}
                        </TableHeader>
                        <TableBody>
                          <React.Fragment>
                            {eventsScreen.folioPageRows.map((entry: EventFolioEntry) => {
                              if (entry.id === '__opening') {
                                return (
                                  <TableRow key="opening">
                                    <TableCell>{entry.date ? new Date(entry.date).toLocaleDateString() : '—'}</TableCell>
                                    <TableCell className="font-medium">Opening balance</TableCell>
                                    <TableCell className="text-slate-400">—</TableCell>
                                    <TableCell className="text-right">{entry.debit > 0 ? eventsScreen.formatCurrency(entry.debit) : '—'}</TableCell>
                                    <TableCell className="text-right">{entry.credit > 0 ? eventsScreen.formatCurrency(entry.credit) : '—'}</TableCell>
                                    <TableCell className="text-right font-semibold">{eventsScreen.formatCurrency(entry.balance)}</TableCell>
                                    <TableCell>—</TableCell>
                                  </TableRow>
                                );
                              }
                              const linkedInvoice = entry.reference
                                ? eventsScreen.eventInvoices.find((inv) => inv.id === entry.reference)
                                : null;
                              const linkedReceipt = entry.reference
                                ? eventsScreen.eventReceipts.find((rcpt) => rcpt.id === entry.reference)
                                : null;
                              const line = eventsScreen.formatFolioEntryCopy(entry);

                              return (
                                <TableRow key={entry.id}>
                                  <TableCell>
                                    {entry.date ? new Date(entry.date).toLocaleDateString() : '—'}
                                  </TableCell>
                                  <TableCell>{line.description}</TableCell>
                                  <TableCell className="text-slate-600">{line.reference}</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {entry.debit > 0 ? eventsScreen.formatCurrency(entry.debit) : '—'}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {entry.credit > 0 ? eventsScreen.formatCurrency(entry.credit) : '—'}
                                  </TableCell>
                                  <TableCell className={`text-right tabular-nums font-semibold ${entry.balance > 0.01 ? 'text-red-700' : entry.balance < -0.01 ? 'text-emerald-700' : 'text-slate-900'}`}>
                                    {eventsScreen.formatCurrency(entry.balance)}
                                  </TableCell>
                                  <TableCell className="w-px">
                                    {eventsScreen.activeFolio.status === 'Void' ? (
                                      <span className="text-slate-400">—</span>
                                    ) : (
                                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                                      {linkedInvoice && (
                                        <Tooltip content="Open invoice">
                                          <Button
                                            size="sm"
                                            variant="light"
                                            className="min-w-8 h-8"
                                            onPress={() => eventsScreen.handleEditInvoiceFromFolio(linkedInvoice)}
                                          >
                                            Edit
                                          </Button>
                                        </Tooltip>
                                      )}
                                      {linkedReceipt && (
                                        <Tooltip content="Open receipt">
                                          <Button
                                            size="sm"
                                            variant="light"
                                            className="min-w-8 h-8"
                                            onPress={() => eventsScreen.handleEditReceiptFromFolio(linkedReceipt)}
                                          >
                                            Receipt
                                          </Button>
                                        </Tooltip>
                                      )}
                                      <Tooltip content={/^\s*(REVERSAL|VOID)\b/i.test(entry.description || '') ? 'Void this reversal' : (entry.debit || 0) > 0 ? 'Void this charge' : 'Void this payment'}>
                                        <Button
                                          size="sm"
                                          color="warning"
                                          variant="light"
                                          isIconOnly
                                          className="min-w-8 h-8"
                                          onPress={() => eventsScreen.reverseFolioEntry(eventsScreen.activeFolio, entry)}
                                        >
                                          ↻
                                        </Button>
                                      </Tooltip>
                                      <Tooltip content={/^\s*(REVERSAL|VOID)\b/i.test(entry.description || '') ? 'Delete this reversal' : (entry.debit || 0) > 0 ? 'Delete this charge' : 'Delete this payment'}>
                                        <Button
                                          size="sm"
                                          color="danger"
                                          variant="light"
                                          isIconOnly
                                          className="min-w-8 h-8"
                                          onPress={() => eventsScreen.deleteFolioEntry(eventsScreen.activeFolio, entry.id)}
                                        >
                                          ✖
                                        </Button>
                                      </Tooltip>
                                    </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </React.Fragment>
                        </TableBody>
                      </Table>
                      </div>
                      {eventsScreen.sortedFolioEntries.length > FOLIO_PAGE_SIZE && (
                        <div className="mt-3 flex justify-end">
                          <Pagination page={eventsScreen.folioSafePage} total={eventsScreen.folioPageCount} onChange={eventsScreen.setFolioPage} size="sm" showControls />
                        </div>
                      )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">
                  No folio selected
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <FolioStageActions />
              </div>
              <div className="flex flex-wrap gap-2">
                {eventsScreen.activeFolio && (
                  <>
                    <Button color="danger" variant="flat" onPress={eventsScreen.deleteActiveFolio}>
                      Delete
                    </Button>
                    {eventsScreen.activeFolio.status === 'Void' ? (
                      <Button color="warning" variant="flat" onPress={eventsScreen.unvoidActiveFolio}>
                        Unvoid
                      </Button>
                    ) : (
                      <Button color="warning" variant="flat" onPress={eventsScreen.voidActiveFolio}>
                        Void
                      </Button>
                    )}
                  </>
                )}
                <Button color="default" variant="flat" onPress={eventsScreen.closeFolioModal}>
                  Close
                </Button>
              </div>
            </ModalFooter>
          </ModalContent>
        </Modal>


  </>
  );
}

/** Events → create-folio dialog. */
export function EventFolioCreateModal() {
  const eventsScreen = useEventsScreen();
  return (
  <>
        <Modal
          isOpen={eventsScreen.isFolioCreateModalOpen}
          onClose={() => {
            eventsScreen.setIsFolioCreateModalOpen(false);
            eventsScreen.setFolioCreateError('');
          }}
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
              const selectedEvent = eventsScreen.allEvents.find((ev) => ev.id === eventsScreen.folioCreateForm.eventId);
              const linkedInvoice = selectedEvent
                ? eventsScreen.eventInvoices.find((inv) => inv.eventId === selectedEvent.id)
                : undefined;
              const linkedReceipts = selectedEvent
                ? eventsScreen.eventReceipts.filter((rcpt) => rcpt.eventId === selectedEvent.id)
                : [];
              const existingFolio = selectedEvent
                ? eventsScreen.eventFolios.find((f) => f.eventId === selectedEvent.id)
                : undefined;
              const eventItems = eventsScreen.getFolioCandidateEvents().map((ev) => ({
                key: ev.id,
                label: eventsScreen.getFolioEventLabel(ev),
              }));
              if (selectedEvent && !eventItems.some((item) => item.key === selectedEvent.id)) {
                eventItems.unshift({ key: selectedEvent.id, label: eventsScreen.getFolioEventLabel(selectedEvent) });
              }
              return (
                <>
            <ModalHeader>
              <div>
                <h3 className="text-lg font-semibold text-ghana-black">New Folio</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select the event. The folio posts any existing invoice and receipts, then opens the ledger.
                </p>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <Autocomplete
                  size="sm"
                  label="Event"
                  placeholder="Type to filter events"
                  selectedKey={eventsScreen.folioCreateForm.eventId || null}
                  items={eventItems}
                  isInvalid={!!eventsScreen.folioCreateError}
                  errorMessage={eventsScreen.folioCreateError}
                  description="Pick an event. Existing folios open the ledger instead of creating a second one."
                  onSelectionChange={(key) => {
                    if (key == null) return;
                    eventsScreen.setFolioCreateForm((prev) => ({ ...prev, eventId: String(key) }));
                    eventsScreen.setFolioCreateError('');
                  }}
                >
                  {(item) => (
                    <AutocompleteItem key={item.key} textValue={item.label}>
                      {item.label}
                    </AutocompleteItem>
                  )}
                </Autocomplete>

                {selectedEvent && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" color="primary" variant="flat">{eventsScreen.getEventDisplayName(selectedEvent)}</Chip>
                    <Chip size="sm" color="secondary" variant="flat">{eventsScreen.getEventClientName(selectedEvent)}</Chip>
                    {existingFolio ? (
                      <Chip size="sm" color="success" variant="flat">{existingFolio.id}</Chip>
                    ) : linkedInvoice ? (
                      <>
                        <Chip size="sm" color="success" variant="flat">{linkedInvoice.id}</Chip>
                        <Chip size="sm" color="warning" variant="flat">Due {eventsScreen.formatCurrency(Number(linkedInvoice.balance || 0))}</Chip>
                      </>
                    ) : (
                      <Chip size="sm" variant="flat">No invoice yet</Chip>
                    )}
                    {linkedReceipts.length > 0 && (
                      <Chip size="sm" color="success" variant="flat">{linkedReceipts.length} receipt{linkedReceipts.length === 1 ? '' : 's'}</Chip>
                    )}
                  </div>
                )}

                {existingFolio ? (
                  <p className="text-xs text-slate-500">
                    This event already has a folio. Open it to add charges or payments.
                  </p>
                ) : linkedInvoice ? (
                  <p className="text-xs text-slate-500">
                    Invoice {linkedInvoice.id} ({eventsScreen.formatCurrency(Number(linkedInvoice.total || 0))}) and its receipts will post onto this folio.
                  </p>
                ) : selectedEvent ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      size="sm"
                      label="Opening balance"
                      type="number"
                      value={String(eventsScreen.folioCreateForm.openingBalance ?? 0)}
                      onValueChange={(value) =>
                        eventsScreen.setFolioCreateForm((prev) => ({
                          ...prev,
                          openingBalance: parseFloat(value) || 0,
                        }))
                      }
                      description="Optional — skip if charges will come later"
                      startContent={<span className="text-slate-400 text-xs">₵</span>}
                    />
                    <Input
                      size="sm"
                      label="Note"
                      placeholder="Opening balance note"
                      value={eventsScreen.folioCreateForm.note || ''}
                      onValueChange={(value) => eventsScreen.setFolioCreateForm((prev) => ({ ...prev, note: value }))}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Select an event to create or open its folio.</p>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button size="sm" variant="flat" onPress={() => eventsScreen.setIsFolioCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" color="primary" onPress={eventsScreen.handleCreateFolio} isDisabled={!eventsScreen.folioCreateForm.eventId}>
                {existingFolio ? 'Open Folio' : 'Create Folio'}
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
