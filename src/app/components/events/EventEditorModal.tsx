'use client';

import { useEffect, useRef } from 'react';
import { Autocomplete, AutocompleteItem, Badge, Button, Card, CardBody, CardHeader, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Popover, PopoverContent, PopoverTrigger, Select, SelectItem, Switch, Tab, Tabs, Textarea } from '@heroui/react';
import { EVENT_DOC_TYPE } from './eventShared';
import type { SimpleEventStatus } from './eventTypes';
import { paymentMethodLabel } from '../../lib/accounting/receiptPrint';
import { useEventsScreen } from './eventsScreenContext';

function guestPersonName(guest: any) {
  return String(guest?.name || `${guest?.firstName || ''} ${guest?.lastName || ''}`).trim();
}

function guestOrganizationName(guest: any) {
  return String(guest?.employerCompany || '').trim() || guestPersonName(guest);
}

function findExactGuest(guests: any[], query: string) {
  const typed = query.trim().toLowerCase();
  if (typed.length < 2) return null;
  return (guests || []).find((guest) => {
    if (guest?.isActive === false) return false;
    const organization = String(guest?.employerCompany || '').trim().toLowerCase();
    const person = guestPersonName(guest).toLowerCase();
    return typed === organization || typed === person;
  }) || null;
}

/** Events → event form. Dates, rooms, daily schedule, tax, and status. */
export function EventEditorModal() {
  const eventsScreen = useEventsScreen();
  const eventNameDefaultRef = useRef('');
  const eventNameTouchedRef = useRef(false);
  const eventSessionRef = useRef('');
  const pickingClientRef = useRef(false);

  useEffect(() => {
    if (!eventsScreen.isEventModalOpen) {
      eventSessionRef.current = '';
      eventNameDefaultRef.current = '';
      eventNameTouchedRef.current = false;
      return;
    }
    const session = eventsScreen.editingEvent?.id || 'new';
    if (eventSessionRef.current === session) return;
    const eventName = (eventsScreen.eventName || '').trim();
    const organization = (eventsScreen.orgName || '').trim();
    if (!eventName && !organization && session !== 'new') return;
    eventSessionRef.current = session;
    eventNameTouchedRef.current = Boolean(eventName) && eventName !== organization;
    eventNameDefaultRef.current = eventNameTouchedRef.current ? '' : organization;
  }, [
    eventsScreen.isEventModalOpen,
    eventsScreen.editingEvent?.id,
    eventsScreen.eventName,
    eventsScreen.orgName,
  ]);

  useEffect(() => {
    if (!eventsScreen.isEventModalOpen || eventNameTouchedRef.current) return;
    const organization = (eventsScreen.orgName || '').trim();
    const eventName = (eventsScreen.eventName || '').trim();
    if (!organization || eventName === organization) {
      eventNameDefaultRef.current = organization;
      return;
    }
    if (eventName && eventName !== eventNameDefaultRef.current) return;
    eventNameDefaultRef.current = organization;
    eventsScreen.setEventName(organization);
  }, [
    eventsScreen.isEventModalOpen,
    eventsScreen.orgName,
    eventsScreen.eventName,
    eventsScreen.setEventName,
  ]);

  const applyGuest = (guest: any) => {
    const organization = guestOrganizationName(guest);
    const person = guestPersonName(guest);
    eventsScreen.setOrgClientId(guest.id);
    eventsScreen.setOrgName(organization);
    eventsScreen.setOrgSearch(organization);
    eventsScreen.setClientContactName(person);
    eventsScreen.setOrgContactPhone(guest.companyPhone || guest.phone || '');
    eventsScreen.setOrgClientEmail(guest.email || '');
    if (organization) eventsScreen.setPhase1Error((prev) => (prev === 'Organization is required' ? '' : prev));
  };

  const applyTypedOrganization = (value: string) => {
    const guest = findExactGuest(eventsScreen.frontOfficeGuests, value);
    if (guest) {
      applyGuest(guest);
      return;
    }
    eventsScreen.setOrgSearch(value);
    eventsScreen.setOrgName(value);
    const selected = (eventsScreen.frontOfficeGuests || []).find((item: any) => item.id === eventsScreen.orgClientId);
    const selectedName = selected ? guestOrganizationName(selected) : '';
    if (eventsScreen.orgClientId && value.trim() !== selectedName && value.trim() !== guestPersonName(selected)) {
      eventsScreen.setOrgClientId('');
    }
    if (value.trim()) eventsScreen.setPhase1Error((prev) => (prev === 'Organization is required' ? '' : prev));
  };

  return (
  <>
        <Modal
          isOpen={eventsScreen.isEventModalOpen}
          onOpenChange={(open) => {
            if (!open) eventsScreen.closeEventWorkspace();
          }}
          onClose={eventsScreen.closeEventWorkspace}
          size="5xl"
          scrollBehavior="inside"
        >
          <ModalContent className="mx-auto w-[calc(100vw-1.5rem)] max-w-[1200px] px-4 py-5 sm:px-6 md:w-[94vw] md:px-8 xl:w-[65vw] xl:px-10 xl:py-8">
            <ModalHeader>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎉</span>
                <div>
                  <h3 className="text-lg font-semibold">
                    {eventsScreen.isEditingInvoiceDetails
                      ? (eventsScreen.eventInvoices.some((inv) => inv.eventId === eventsScreen.editingEvent?.id) ? 'Edit Invoice' : 'Create Invoice')
                      : eventsScreen.isCreatingEvent
                        ? 'Create New Event'
                        : eventsScreen.isViewMode
                          ? 'View Event'
                          : 'Edit Event'
                    }
                  </h3>
                  <p className="text-sm text-gray-600">
                    {eventsScreen.isEditingInvoiceDetails
                      ? (eventsScreen.eventInvoices.some((inv) => inv.eventId === eventsScreen.editingEvent?.id)
                        ? 'Same event form — confirm pax, dates and rates, then update the invoice.'
                        : 'Select a proforma, confirm pax, dates and rates, then issue the invoice.')
                      : 'Event details, client, schedule and rates'
                    }
                  </p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody className="py-2">
              <div className="mb-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              {/* Phase 1: Event Details & Client */}
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  Phase 1: Event Details & Client
                  {eventsScreen.isEditingInvoiceDetails && <Badge color="primary" variant="flat" className="ml-2 text-xs">Editable</Badge>}
                </h4>
                <div className="space-y-3">
                {eventsScreen.isEditingInvoiceDetails && !eventsScreen.eventInvoices.some((inv) => inv.eventId === eventsScreen.editingEvent?.id) && (
                  <Autocomplete
                    size="sm"
                    label="Proforma"
                    placeholder="Select a quote / proforma"
                    selectedKey={eventsScreen.editingEvent?.id || null}
                    items={eventsScreen.getInvoiceableProformas().map((ev) => ({
                      key: ev.id,
                      label: eventsScreen.getProformaPickerLabel(ev),
                    }))}
                    onSelectionChange={(key) => {
                      if (key == null || String(key) === eventsScreen.editingEvent?.id) return;
                      const event = eventsScreen.allEvents.find((ev) => ev.id === String(key));
                      if (event) eventsScreen.openEventInvoiceForm(event);
                    }}
                    description="Choose the quote to convert — the event form below stays the same"
                  >
                    {(item) => (
                      <AutocompleteItem key={item.key} textValue={item.label}>
                        {item.label}
                      </AutocompleteItem>
                    )}
                  </Autocomplete>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[0.795fr_1.205fr]">
                  <Input
                    size="sm"
                    label="Event ID"
                    placeholder={eventsScreen.isCreatingEvent ? "Auto-generated on save" : eventsScreen.formatEventId(eventsScreen.editingEvent?.id) || "—"}
                    value={eventsScreen.formatEventId(eventsScreen.editingEvent?.id) || (eventsScreen.isCreatingEvent ? "" : "—")}
                    isReadOnly
                    className="font-semibold"
                  />
                  <Autocomplete
                    size="sm"
                    label="Organization"
                    placeholder="Search client"
                    allowsCustomValue
                    selectedKey={eventsScreen.orgClientId || undefined}
                    inputValue={eventsScreen.orgName}
                    isReadOnly={eventsScreen.isViewMode}
                    isDisabled={eventsScreen.isViewMode}
                    onSelectionChange={(key) => {
                      const id = typeof key === 'string' ? key : (key as any) || '';
                      if (!id) return;
                      pickingClientRef.current = true;
                      if (id.startsWith('custom:')) {
                        applyTypedOrganization(id.replace('custom:', ''));
                        return;
                      }
                      const guest = eventsScreen.frontOfficeGuests.find((item: any) => item.id === id);
                      if (guest) applyGuest(guest);
                    }}
                    onInputChange={(value) => {
                      if (pickingClientRef.current) {
                        pickingClientRef.current = false;
                        if (!value) return;
                      }
                      applyTypedOrganization(value);
                    }}
                    isInvalid={eventsScreen.phase1Error === 'Organization is required'}
                    errorMessage={eventsScreen.phase1Error === 'Organization is required' ? eventsScreen.phase1Error : undefined}
                  >
                    {(() => {
                      const q = (eventsScreen.orgSearch || '').trim();
                      const guests = eventsScreen.frontOfficeGuests || [];
                      const results = q.length >= 2
                        ? guests.filter(g => {
                            if (g.isActive === false) return false;
                            const org = (g.employerCompany || '').toLowerCase();
                            const name = (g.name || `${g.firstName || ''} ${g.lastName || ''}`).toLowerCase();
                            const phone = (g.companyPhone || g.phone || '').toLowerCase();
                            return org.includes(q.toLowerCase()) || name.includes(q.toLowerCase()) || phone.includes(q.toLowerCase());
                          }).slice(0, 20)
                        : [];
                      const exactGuest = findExactGuest(guests, q);
                      return q.length >= 2 ? (
                        <>
                          {!exactGuest && (
                          <AutocompleteItem key={`custom:${q}`} textValue={q}>
                            <div className="flex justify-between items-center w-full">
                              <span className="font-medium">Use "{q}"</span>
                              <span className="text-xs text-gray-500">Click to confirm</span>
                            </div>
                          </AutocompleteItem>
                          )}
                          {results.map(g => {
                            const org = g.employerCompany || (g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim());
                            const person = g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim();
                            return (
                              <AutocompleteItem key={g.id} textValue={`${org} ${person}`}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{org}</span>
                                  <span className="text-xs text-gray-600">{person} • {(g.companyPhone || g.phone || '')}</span>
                                </div>
                              </AutocompleteItem>
                            );
                          })}
                        </>
                      ) : null;
                    })()}
                  </Autocomplete>
                  <Input
                    size="sm"
                    className="sm:col-span-2"
                    label="Event Name"
                    placeholder="Conference name"
                    value={eventsScreen.eventName}
                    onChange={(e) => {
                      const next = e.target.value;
                      const organization = (eventsScreen.orgName || '').trim();
                      eventNameTouchedRef.current = Boolean(next.trim()) && next.trim() !== organization;
                      eventNameDefaultRef.current = eventNameTouchedRef.current ? '' : organization;
                      eventsScreen.setEventName(next);
                    }}
                    isReadOnly={eventsScreen.isViewMode}
                  />
                  </div>

                  <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                    <Input
                      size="sm"
                      label="Client Contact Name"
                    placeholder="On-site contact person"
                    value={eventsScreen.clientContactName}
                    onChange={(e) => eventsScreen.setClientContactName(e.target.value)}
                    isReadOnly={eventsScreen.isViewMode}
                  />
                  <Input
                      size="sm"
                      label="Contact Phone"
                    placeholder="Phone number"
                    value={eventsScreen.orgContactPhone}
                    onChange={(e) => eventsScreen.setOrgContactPhone(e.target.value)}
                    isReadOnly={eventsScreen.isViewMode}
                  />
                  </div>
                  <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                    <Input
                      size="sm"
                      label="Client Email"
                      placeholder="Email address"
                      value={eventsScreen.orgClientEmail}
                      onChange={(e) => {
                        eventsScreen.setOrgClientEmail(e.target.value);
                        if (!e.target.value || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(e.target.value)) {
                          eventsScreen.setPhase1Error((prev) => (prev === 'Please enter a valid client email' ? '' : prev));
                        }
                      }}
                      isReadOnly={eventsScreen.isViewMode}
                      isInvalid={eventsScreen.phase1Error === 'Please enter a valid client email'}
                      errorMessage={eventsScreen.phase1Error === 'Please enter a valid client email' ? eventsScreen.phase1Error : undefined}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isResidential"
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        checked={eventsScreen.isResidential}
                        onChange={(e) => eventsScreen.setIsResidential(e.target.checked)}
                        disabled={eventsScreen.isViewMode}
                      />
                      <label htmlFor="isResidential" className="text-sm text-blue-800 font-semibold">
                        🏨 Residential Events
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <Divider className="my-4 lg:hidden" />

              {/* Phase 2: Event Dates & Venue */}
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  Phase 2: Event Dates & Venue
                  {eventsScreen.isEditingInvoiceDetails && <Badge color="primary" variant="flat" className="ml-2 text-xs">Editable</Badge>}
                </h4>
                <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    size="sm"
                    label="Start Date"
                    type="date"
                    value={eventsScreen.startDate}
                    onChange={(e) => eventsScreen.setStartDate(e.target.value)}
                    isReadOnly={eventsScreen.isViewMode && !eventsScreen.isEditingInvoiceDetails}
                    description={eventsScreen.isEditingInvoiceDetails ? "Change to expand/contract schedule" : undefined}
                  />
                  <Input
                    size="sm"
                    label="End Date"
                    type="date"
                    value={eventsScreen.endDate}
                    onChange={(e) => eventsScreen.setEndDate(e.target.value)}
                    isReadOnly={eventsScreen.isViewMode && !eventsScreen.isEditingInvoiceDetails}
                    description={eventsScreen.isEditingInvoiceDetails ? "Change to expand/contract schedule" : undefined}
                  />
                  <Select
                    size="sm"
                    className="sm:col-span-2"
                    label="Venue Selection"
                    placeholder="Select venue"
                    selectedKeys={eventsScreen.venueKey ? new Set([eventsScreen.venueKey]) : new Set()}
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0];
                      if (typeof value === 'string' && value) {
                        eventsScreen.setVenueKey(value);
                        eventsScreen.setPhase1Error((prev) => (prev === 'Select a venue' || prev.startsWith('This venue is inactive') ? '' : prev));
                      }
                    }}
                    isDisabled={eventsScreen.isViewMode && !eventsScreen.isEditingInvoiceDetails}
                    isInvalid={eventsScreen.phase1Error === 'Select a venue' || eventsScreen.phase1Error.startsWith('This venue is inactive')}
                    errorMessage={
                      eventsScreen.phase1Error === 'Select a venue' || eventsScreen.phase1Error.startsWith('This venue is inactive')
                        ? eventsScreen.phase1Error
                        : undefined
                    }
                  >
                    {(eventsScreen.modernVenues || [])
                      .filter((v) => v.status !== 'inactive' || v.id === eventsScreen.venueKey)
                      .map((v) => (
                      <SelectItem key={v.id}>{`${v.name} (${v.capacity} pax)`}</SelectItem>
                    ))}
                  </Select>
                  </div>

                  <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
                    <Input
                      size="sm"
                      label="Expected Pax"
                      type="number"
                      placeholder="Attendees"
                      value={eventsScreen.expectedPax ? String(eventsScreen.expectedPax) : ''}
                      onChange={(e)=> eventsScreen.setExpectedPax(parseInt(e.target.value || '0', 10) || 0)}
                      className="flex-1"
                      isReadOnly={eventsScreen.isViewMode && !eventsScreen.isEditingInvoiceDetails}
                    />
                    {eventsScreen.isCreatingInvoiceFromFolio || eventsScreen.isEditingInvoiceDetails || eventsScreen.eventStatus === 'invoiced' ? (
                      <Select
                        size="sm"
                        label="Event Status"
                        selectedKeys={new Set(['invoiced'])}
                        isDisabled
                      >
                        <SelectItem key="invoiced" textValue="Invoiced">Invoiced</SelectItem>
                      </Select>
                    ) : eventsScreen.eventStatus === 'cancelled' ? (
                      <Select
                        size="sm"
                        label="Event Status"
                        selectedKeys={new Set(['cancelled'])}
                        isDisabled
                      >
                        <SelectItem key="cancelled" textValue="Cancelled">Cancelled</SelectItem>
                      </Select>
                    ) : (
                      <Select
                        size="sm"
                        label="Event Status"
                        selectedKeys={eventsScreen.eventStatus ? new Set([eventsScreen.eventStatus]) : new Set()}
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys)[0] as SimpleEventStatus;
                          if (selected) eventsScreen.setEventStatus(selected);
                        }}
                        isDisabled={eventsScreen.isViewMode}
                        popoverProps={{ classNames: { base: '!z-[200]' } }}
                      >
                        {eventsScreen.PRE_EVENT_STATUS_OPTIONS.map(option => (
                          <SelectItem key={option.key} textValue={option.label}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </Select>
                    )}
                    {!eventsScreen.isCreatingInvoiceFromFolio && !eventsScreen.isEditingInvoiceDetails && eventsScreen.eventStatus !== 'invoiced' && (
                      <div className="flex flex-col gap-2 sm:col-span-2">
                        <span className="text-sm font-semibold text-gray-600">Availability & Conflicts</span>
                        <div className="flex items-center gap-16">
                        <Popover placement="bottom-start">
                          <PopoverTrigger>
                            <div
                              className={`px-3 py-2 rounded-md text-xs whitespace-nowrap border font-semibold ${
                                !eventsScreen.venueKey || !eventsScreen.expectedPax
                                  ? 'bg-gray-50 border-gray-200 text-gray-600'
                                  : eventsScreen.capacityOk && eventsScreen.clashCount === 0
                                  ? 'bg-green-50 border-green-200 text-green-700'
                                  : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                              } ${eventsScreen.clashCount > 0 ? 'cursor-pointer' : ''}`}
                            >
                              {!eventsScreen.venueKey || !eventsScreen.expectedPax
                                ? 'Select a venue and headcount'
                                : eventsScreen.capacityOk && eventsScreen.clashCount === 0
                                ? 'Availability: OK'
                                : `Check: ${eventsScreen.capacityOk ? 'OK capacity' : 'Capacity exceeded'}${
                                    eventsScreen.clashCount > 0 ? ` • ${eventsScreen.clashCount} clash${eventsScreen.clashCount > 1 ? 'es' : ''}` : ''
                                  }${eventsScreen.hasWarnings ? ' • warnings' : ''}`}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent>
                            <div className="p-3 text-sm min-w-[320px]">
                              {eventsScreen.clashCount === 0 ? (
                                <div className="text-gray-700">No conflicting programmes in the selected range.</div>
                              ) : (
                                <div>
                                  <div className="font-medium mb-2 text-gray-800">Conflicting programmes</div>
                                  <ul className="space-y-2">
                                    {eventsScreen.conflictingEvents.slice(0, 5).map((ev: any) => (
                                      <li key={ev.id} className="flex items-start gap-2">
                                        <span className="mt-1">📅</span>
                                        <div className="text-gray-700">
                                          <div className="font-medium">
                                            {ev.eventName} <span className="text-gray-500">• {ev.organization}</span>
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {ev.venueName} • {ev.arrivalDate} → {ev.departureDate} • {ev.pax} pax
                                          </div>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                  {eventsScreen.conflictingEvents.length > 5 && (
                                    <div className="mt-2 text-xs text-gray-500">+ {eventsScreen.conflictingEvents.length - 5} more…</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <div className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold tabular-nums text-gray-800">
                          {(() => {
                            const spanCount = eventsScreen.computeEventDurationDays({ arrivalDate: eventsScreen.startDate, departureDate: eventsScreen.endDate });
                            const unit = eventsScreen.isResidential
                              ? (spanCount === 1 ? 'night' : 'nights')
                              : (spanCount === 1 ? 'day' : 'days');
                            return `${spanCount} ${unit}`;
                          })()}
                        </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>

              <Divider className="my-4" />

              {/* Phase 3: Daily Schedule & Headcounts */}
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  📊 Phase 3: Daily Schedule & Headcounts
                  {eventsScreen.isEditingInvoiceDetails && <Badge color="primary" variant="flat" className="ml-2 text-xs">✏️ Editable</Badge>}
                </h4>
                {eventsScreen.isEditingInvoiceDetails && (
                  <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-md border border-blue-200 mb-4">
                    💡 Editing invoice details. All changes will update the invoice totals but won't affect the original event quote.
                  </div>
                )}
                {/* Rates controls */}
                <div className="mb-4 flex flex-wrap items-end gap-4">
                  <div className="flex items-center gap-3">
                    <Switch size="sm" isSelected={!eventsScreen.ratesByParticulars} onValueChange={(v)=> eventsScreen.setRatesByParticulars(!v)} isDisabled={eventsScreen.isViewMode} />
                    <span className="text-sm">Rate by package</span>
                  </div>
                  {!eventsScreen.ratesByParticulars ? (
                    <>
                      <Input size="sm" type="number" label="Default Daily Rate (₵/person)" value={String(eventsScreen.defaultDayRate)} onChange={(e)=> eventsScreen.setDefaultDayRate(parseFloat(e.target.value || '0') || 0)} className="w-56" isReadOnly={eventsScreen.isViewMode} />
                      {!eventsScreen.isViewMode && <Button size="sm" variant="flat" onPress={()=> eventsScreen.setDailySchedule(prev => prev.map(r => ({ ...r, rate: eventsScreen.defaultDayRate || 0 })))}>Apply to All Days</Button>}
                    </>
                  ) : (
                    <div className="flex flex-wrap items-end gap-3">
                      {eventsScreen.isResidential && (
                        <Input size="sm" type="number" label="Room Rate (₵)" value={String(eventsScreen.roomRate)} onChange={(e)=> eventsScreen.setRoomRate(parseFloat(e.target.value || '0') || 0)} className="w-40" isReadOnly={eventsScreen.isViewMode} />
                      )}
                      <Input size="sm" type="number" label="Dinner Rate (₵)" value={String(eventsScreen.dinnerRate)} onChange={(e)=> eventsScreen.setDinnerRate(parseFloat(e.target.value || '0') || 0)} className="w-40" isReadOnly={eventsScreen.isViewMode} />
                      <Input size="sm" type="number" label="Lunch Rate (₵)" value={String(eventsScreen.lunchRate)} onChange={(e)=> eventsScreen.setLunchRate(parseFloat(e.target.value || '0') || 0)} className="w-40" isReadOnly={eventsScreen.isViewMode} />
                      <Input size="sm" type="number" label="Conference Rate (₵)" value={String(eventsScreen.conferenceRate)} onChange={(e)=> eventsScreen.setConferenceRate(parseFloat(e.target.value || '0') || 0)} className="w-40" isReadOnly={eventsScreen.isViewMode} />
                      {!eventsScreen.isViewMode && <Button size="sm" color="primary" variant="flat" onPress={()=> eventsScreen.setCustomParticulars(prev => [...prev, { id: `extra-${Date.now()}`, label: 'Extra Service', rate: 0 }])}>➕ Add Row</Button>}
                    </div>
                  )}
                </div>

                {/* Daily Schedule Table - Using plain HTML table for dynamic columns */}
                <div className="overflow-x-auto rounded-lg border" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9ca3af #f3f4f6' }}>
                  {eventsScreen.dailySchedule.length === 0 ? (
                    /* Empty state - no dates selected */
                    <div className="py-12 text-center text-gray-500 bg-gray-50">
                      <span className="text-5xl">📅</span>
                      <p className="mt-3 text-lg">Please select Start and End dates to generate daily schedule</p>
                    </div>
                  ) : !eventsScreen.ratesByParticulars ? (
                    /* Package Mode Table */
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          {eventsScreen.isResidential && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{eventsScreen.particularLabels.rooms}</th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{eventsScreen.particularLabels.dinnerPax}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{eventsScreen.particularLabels.lunchPax}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{eventsScreen.particularLabels.conferencePax}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate (₵)</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal (₵)</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {eventsScreen.dailySchedule.map((row, idx) => {
                          const c = eventsScreen.computeDayAmounts(row);
                          return (
                            <tr key={row.date} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.date}</td>
                              {eventsScreen.isResidential && (
                                <td className="px-4 py-3">
                                  <Input size="sm" type="number" value={String(row.rooms)} onChange={(e) => {
                                    const v = parseInt(e.target.value || '0', 10) || 0;
                                    eventsScreen.setDailySchedule(prev => prev.map((r, i) => i === idx ? { ...r, rooms: v } : r));
                                    eventsScreen.updateScheduleData(row.date, { rooms: v });
                                  }} isReadOnly={eventsScreen.isViewMode} className="w-20" />
                                </td>
                              )}
                              <td className="px-4 py-3">
                                <Input size="sm" type="number" value={String(row.dinnerPax)} onChange={(e) => {
                                  const v = parseInt(e.target.value || '0', 10) || 0;
                                  eventsScreen.setDailySchedule(prev => prev.map((r, i) => i === idx ? { ...r, dinnerPax: v } : r));
                                  eventsScreen.updateScheduleData(row.date, { dinnerPax: v });
                                }} isReadOnly={eventsScreen.isViewMode} className="w-20" />
                              </td>
                              <td className="px-4 py-3">
                                <Input size="sm" type="number" value={String(row.lunchPax)} onChange={(e) => {
                                  const v = parseInt(e.target.value || '0', 10) || 0;
                                  eventsScreen.setDailySchedule(prev => prev.map((r, i) => i === idx ? { ...r, lunchPax: v } : r));
                                  eventsScreen.updateScheduleData(row.date, { lunchPax: v });
                                }} isReadOnly={eventsScreen.isViewMode} className="w-20" />
                              </td>
                              <td className="px-4 py-3">
                                <Input size="sm" type="number" value={String(row.conferencePax)} onChange={(e) => {
                                  const v = parseInt(e.target.value || '0', 10) || 0;
                                  eventsScreen.setDailySchedule(prev => prev.map((r, i) => i === idx ? { ...r, conferencePax: v } : r));
                                  eventsScreen.updateScheduleData(row.date, { conferencePax: v });
                                }} isReadOnly={eventsScreen.isViewMode} className="w-20" />
                              </td>
                              <td className="px-4 py-3">
                                <Input size="sm" type="number" value={String(row.rate)} onChange={(e) => {
                                  const v = parseFloat(e.target.value || '0') || 0;
                                  eventsScreen.setDailySchedule(prev => prev.map((r, i) => i === idx ? { ...r, rate: v } : r));
                                  eventsScreen.updateScheduleData(row.date, { rate: v });
                                }} className="w-24" isReadOnly={eventsScreen.isViewMode} />
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">₵{c.subtotal.toFixed(2)}</td>
                              <td className="px-4 py-3 text-center">
                                {!eventsScreen.isViewMode ? (
                                  <div className="space-y-2">
                                    <Button size="sm" variant="flat" className="px-2" onPress={() => eventsScreen.addExtraLineToDay(idx)} aria-label="Add extra">＋</Button>
                                    {(row.extraLines || []).map((ln, lineIdx) => (
                                      <div key={`${row.date}-ex-${ln.id}`} className="flex items-center gap-1">
                                        <Input size="sm" value={ln.name} onChange={(e) => eventsScreen.updateExtraLineOnDay(idx, lineIdx, { name: e.target.value })} className="w-24" />
                                        <Input size="sm" type="number" value={String(ln.qty)} onChange={(e) => eventsScreen.updateExtraLineOnDay(idx, lineIdx, { qty: parseInt(e.target.value || '0', 10) || 0 })} className="w-16" />
                                        <Input size="sm" type="number" value={String(ln.unitPrice)} onChange={(e) => eventsScreen.updateExtraLineOnDay(idx, lineIdx, { unitPrice: parseFloat(e.target.value || '0') || 0 })} className="w-20" />
                                        <span className="text-xs text-gray-500">₵{((Number(ln.qty) || 0) * (Number(ln.unitPrice) || 0)).toFixed(2)}</span>
                                        <Button size="sm" color="danger" variant="light" className="px-2" onPress={() => eventsScreen.removeExtraLineFromDay(idx, lineIdx)} aria-label="Remove">✖</Button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    {(row.extraLines || []).map((ln, lineIdx) => (
                                      <div key={`${row.date}-ex-${ln.id}`} className="text-xs text-gray-600">
                                        {ln.name}: {ln.qty} × ₵{ln.unitPrice} = ₵{((Number(ln.qty) || 0) * (Number(ln.unitPrice) || 0)).toFixed(2)}
                                      </div>
                                    ))}
                                    {(!row.extraLines || row.extraLines.length === 0) && <span className="text-xs text-gray-400">—</span>}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    /* Particulars Mode Table - Dynamic columns based on dates */
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Particular</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate (₵)</th>
                          {eventsScreen.dailySchedule.map((row) => (
                            <th key={row.date} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {new Date(row.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal (₵)</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {/* Standard Particulars Rows */}
                        {(['rooms', 'dinnerPax', 'lunchPax', 'conferencePax'] as const)
                          .filter(k => !eventsScreen.hiddenParticulars[k] && (k !== 'rooms' || eventsScreen.isResidential))
                          .map((key) => {
                            const label = eventsScreen.particularLabels[key];
                            const rate = key === 'conferencePax' ? eventsScreen.conferenceRate : key === 'lunchPax' ? eventsScreen.lunchRate : key === 'dinnerPax' ? eventsScreen.dinnerRate : eventsScreen.roomRate;
                            const setRate = key === 'conferencePax' ? eventsScreen.setConferenceRate : key === 'lunchPax' ? eventsScreen.setLunchRate : key === 'dinnerPax' ? eventsScreen.setDinnerRate : eventsScreen.setRoomRate;
                            const subtotal = eventsScreen.dailySchedule.reduce((s, r) => s + ((r as any)[key] || 0) * (rate || 0), 0);
                            return (
                              <tr key={key} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <Input size="sm" value={label} onChange={(e) => eventsScreen.setParticularLabels(prev => ({ ...prev, [key]: e.target.value }))} className="w-40" isReadOnly={eventsScreen.isViewMode} />
                                </td>
                                <td className="px-4 py-3">
                                  <Input size="sm" type="number" value={String(rate)} onChange={(e) => setRate(parseFloat(e.target.value || '0') || 0)} className="w-24" isReadOnly={eventsScreen.isViewMode} />
                                </td>
                                {eventsScreen.dailySchedule.map((r, idx) => (
                                  <td key={`${key}-${r.date}`} className="px-4 py-3 text-center">
                                    <Input size="sm" type="number" value={String((r as any)[key] || 0)} onChange={(e) => {
                                      const v = parseInt(e.target.value || '0', 10) || 0;
                                      eventsScreen.setDailySchedule(prev => prev.map((x, i) => i === idx ? { ...x, [key]: v } : x));
                                      eventsScreen.updateScheduleData(r.date, { [key]: v } as any);
                                    }} className="w-20" isReadOnly={eventsScreen.isViewMode} />
                                  </td>
                                ))}
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">₵{subtotal.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center">
                                  {!eventsScreen.isViewMode && <Button size="sm" color="danger" variant="light" className="px-2" onPress={() => eventsScreen.setHiddenParticulars(prev => ({ ...prev, [key]: true }))} aria-label="Remove">✖</Button>}
                                </td>
                              </tr>
                            );
                          })}
                        {/* Custom Particulars Rows */}
                        {eventsScreen.customParticulars.map((p) => {
                          const subtotal = eventsScreen.dailySchedule.reduce((s, r) => s + (r.extras?.[p.id] || 0) * (p.rate || 0), 0);
                          return (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <Input size="sm" value={p.label} onChange={(e) => eventsScreen.setCustomParticulars(prev => prev.map(x => x.id === p.id ? { ...x, label: e.target.value } : x))} isReadOnly={eventsScreen.isViewMode} />
                              </td>
                              <td className="px-4 py-3">
                                <Input size="sm" type="number" value={String(p.rate)} onChange={(e) => eventsScreen.setCustomParticulars(prev => prev.map(x => x.id === p.id ? { ...x, rate: parseFloat(e.target.value || '0') || 0 } : x))} className="w-24" isReadOnly={eventsScreen.isViewMode} />
                              </td>
                              {eventsScreen.dailySchedule.map((r, idx) => (
                                <td key={`extra-${p.id}-${r.date}`} className="px-4 py-3 text-center">
                                  <Input size="sm" type="number" value={String(r.extras?.[p.id] || 0)} onChange={(e) => {
                                    const v = parseInt(e.target.value || '0', 10) || 0;
                                    eventsScreen.setDailySchedule(prev => prev.map((x, i) => i === idx ? { ...x, extras: { ...(x.extras || {}), [p.id]: v } } : x));
                                    const currentExtras = eventsScreen.scheduleDataMap.get(r.date)?.extras || {};
                                    eventsScreen.updateScheduleData(r.date, { extras: { ...currentExtras, [p.id]: v } });
                                  }} className="w-20" isReadOnly={eventsScreen.isViewMode} />
                                </td>
                              ))}
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">₵{subtotal.toFixed(2)}</td>
                              <td className="px-4 py-3 text-center">
                                {!eventsScreen.isViewMode && (
                                  <Button size="sm" color="danger" variant="light" className="px-2" onPress={() => {
                                    eventsScreen.setCustomParticulars(prev => prev.filter(x => x.id !== p.id));
                                    eventsScreen.setDailySchedule(prev => prev.map(r => { const n = { ...(r.extras || {}) }; delete n[p.id]; return { ...r, extras: n }; }));
                                  }} aria-label="Remove">✖</Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              {/* Phase 3 totals removed - moved subtotal to Phase 4 */}
              </div>

              <Divider />

              {/* Phase 4 removed per requirements */}

              <Divider className="my-8" />
              {/* Phase 4: Financial Summary (AUTO-CALCULATED) */}
              <div className="mb-8">
                <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  💰 Phase 4: Financial Summary (AUTO-CALCULATED)
                </h4>
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Left controls: tax exempt only */}
                  <div className="p-6 bg-white rounded-lg border w-full md:w-4/12 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-ghana-black">Payment & Tax Controls</h5>
                      <Button size="sm" variant="light" onPress={eventsScreen.refreshTaxRules} className="text-xs">
                        🔄 Sync Taxes
                      </Button>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Prepayment Enabled</span>
                        <Switch size="sm" isSelected={eventsScreen.prepaymentEnabled} onValueChange={eventsScreen.setPrepaymentEnabled} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tax Exempt</span>
                        <Switch size="sm" isSelected={eventsScreen.eventTaxExempt} onValueChange={(val) => { eventsScreen.setEventTaxExempt(val); eventsScreen.setQuoteTaxExempt(val); }} />
                      </div>
                    </div>
                  </div>
                  {/* Right summary: aligns right on desktop */}
                  <div className="w-full space-y-3 rounded-lg border bg-white p-4 md:ml-auto md:w-7/12">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-ghana-black">Subtotal:</span>
                    <span className="font-semibold">₵{eventsScreen.eventTotals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-ghana-black">Discount:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">
                        {eventsScreen.discountEnabled ? (eventsScreen.discountType === 'percent' ? `${eventsScreen.discountValue}%` : `₵${eventsScreen.discountValue}`) : '—'}
                      </span>
                      <Button size="sm" variant="flat" onPress={()=> eventsScreen.setShowDiscountModal(true)}>Edit</Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {eventsScreen.eventTaxExempt ? (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                        <span className="text-green-700 font-medium">✓ Tax Exempt</span>
                        <span className="block text-xs text-green-600 mt-1">All taxes waived for this event</span>
                      </div>
                    ) : eventsScreen.detailedTaxRows.length > 0 ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 font-semibold text-xs uppercase text-gray-500">
                          <span>Tax</span>
                          <span className="text-right">Rate</span>
                          <span className="text-right">Amount</span>
                        </div>
                        <div className="space-y-1">
                          {eventsScreen.detailedTaxRows.map((tax, idx) => {
                            const basisLabel = tax.method === 'fixed'
                              ? (tax.fixedAmount != null ? `₵${Number(tax.fixedAmount).toFixed(2)}` : 'Fixed')
                              : (tax.rate != null ? `${tax.rate}%` : (tax.method === 'tiered' ? 'Tiered' : '—'));
                            const amountDisplay = `₵${Number(tax.amount || 0).toFixed(2)}`;
                            return (
                              <div
                                key={`${tax.name}-${idx}`}
                                className="grid grid-cols-3 gap-2 items-center text-xs md:text-sm"
                              >
                                <span className="font-medium text-ghana-black">{tax.name}</span>
                                <span className="text-right text-gray-600">{basisLabel}</span>
                                <span className={`text-right font-medium ${tax.effect === 'subtract' ? 'text-red-600' : 'text-gray-800'}`}>
                                  {amountDisplay}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-500">
                        No taxes apply to this event.
                      </div>
                    )}
                  </div>
                  <div className="border-t pt-4">
                    <h5 className="text-lg font-semibold text-ghana-black mb-3">Final Summary</h5>
                    <div className="space-y-3">
                      <div className="flex justify-between text-lg">
                        <span>Grand Total:</span>
                        <span className="font-bold text-green-600">₵{eventsScreen.eventTotals.total.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Prepayment{eventsScreen.prepaymentEnabled ? ` (${eventsScreen.prepaymentDisplay})` : ''}:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-blue-600">₵{(eventsScreen.prepaymentEnabled ? eventsScreen.cappedPrepaymentAmount : 0).toFixed(2)}</span>
                          <Button size="sm" variant="flat" onPress={()=> eventsScreen.setShowPrepaymentModal(true)}>Edit</Button>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span>Balance Due:</span>
                        <span className="font-medium text-orange-600">₵{eventsScreen.balanceDue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>

              <Divider className="my-4" />
              {/* Phase 6: Status & Communication */}
              {/* Prepayment & Discount Modals */}
              {eventsScreen.showPrepaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                    <h5 className="font-medium text-ghana-black mb-4">Set Prepayment</h5>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Enable Prepayment</span>
                        <Switch size="sm" isSelected={eventsScreen.prepaymentEnabled} onValueChange={eventsScreen.setPrepaymentEnabled} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Select label="Type" selectedKeys={[eventsScreen.prepaymentType]} onSelectionChange={(keys)=> eventsScreen.setPrepaymentType(Array.from(keys)[0] as any)}>
                          <SelectItem key="percent">Percent</SelectItem>
                          <SelectItem key="amount">Amount</SelectItem>
                        </Select>
                        <Input type="number" label={eventsScreen.prepaymentType === 'percent' ? 'Value (%)' : 'Value (₵)'} value={String(eventsScreen.prepaymentValue)} onChange={(e)=> eventsScreen.setPrepaymentValue(parseFloat(e.target.value || '0') || 0)} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="flat" onPress={()=> eventsScreen.setShowPrepaymentModal(false)}>Cancel</Button>
                        <Button color="primary" onPress={()=> eventsScreen.setShowPrepaymentModal(false)}>Save</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {eventsScreen.showDiscountModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                    <h5 className="font-medium text-ghana-black mb-4">Set Discount</h5>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Enable Discount</span>
                        <Switch size="sm" isSelected={eventsScreen.discountEnabled} onValueChange={eventsScreen.setDiscountEnabled} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Select label="Type" selectedKeys={[eventsScreen.discountType]} onSelectionChange={(keys)=> eventsScreen.setDiscountType(Array.from(keys)[0] as any)}>
                          <SelectItem key="percent">Percent</SelectItem>
                          <SelectItem key="amount">Amount</SelectItem>
                        </Select>
                        <Input type="number" label={eventsScreen.discountType === 'percent' ? 'Value (%)' : 'Value (₵)'} value={String(eventsScreen.discountValue)} onChange={(e)=> eventsScreen.setDiscountValue(parseFloat(e.target.value || '0') || 0)} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="flat" onPress={()=> eventsScreen.setShowDiscountModal(false)}>Cancel</Button>
                        <Button color="primary" onPress={()=> eventsScreen.setShowDiscountModal(false)}>Save</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="mb-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  Phase 6: Communication
                </h4>
                <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-3">
                  <Select
                    size="sm"
                    label="Coordinator"
                    placeholder="Assign"
                    selectedKeys={new Set([eventsScreen.resolveCoordinatorValue(eventsScreen.eventCoordinator)])}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as string;
                      eventsScreen.setEventCoordinator(eventsScreen.resolveCoordinatorValue(selected));
                    }}
                    isDisabled={eventsScreen.isViewMode}
                  >
                    {eventsScreen.beoCoordinatorOptions.map((option) => (
                      <SelectItem key={option.key} textValue={option.label}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </Select>
                  <Input
                    size="sm"
                    label="Follow-up"
                    type="date"
                    value={eventsScreen.followUpDate}
                    onValueChange={eventsScreen.setFollowUpDate}
                    isDisabled={eventsScreen.isViewMode}
                  />
                  <Input
                    size="sm"
                    label="Next action"
                    placeholder="Send contract"
                    value={eventsScreen.nextAction}
                    onValueChange={eventsScreen.setNextAction}
                    isDisabled={eventsScreen.isViewMode}
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Textarea
                    minRows={5}
                    label="Special Requirements & Notes"
                    placeholder="Any special requirements, dietary restrictions, action items, or communication notes..."
                    defaultValue={eventsScreen.editingEvent?.specialRequirements || eventsScreen.editingEvent?.communicationNotes || ''}
                    className="w-full"
                  />
                  <Card className="border border-dashed border-gray-200 bg-white h-full">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <p className="text-sm font-semibold text-ghana-black">
                        {eventsScreen.isEditingInvoiceDetails ? 'Print Invoice' : 'Print Documents'}
                      </p>
                      <p className="text-xs text-gray-500 font-normal mt-0.5">
                        Opens the browser print dialog — choose &quot;Save as PDF&quot; to save a file.
                      </p>
                    </CardHeader>
                    <CardBody className="pt-0 px-4 pb-4">
                      {eventsScreen.isEditingInvoiceDetails ? (
                        <div className="space-y-4">
                          <p className="text-xs text-gray-500">Layout set in Settings → Document Templates</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              color="primary"
                              className="flex-1"
                              onPress={() => {
                                const invoice = eventsScreen.eventInvoices.find((inv) => inv.eventId === eventsScreen.editingEvent?.id);
                                if (invoice) {
                                  eventsScreen.handleDownloadInvoicePdf(invoice);
                                } else {
                                  alert('Please save the invoice first before printing.');
                                }
                              }}
                            >
                              🖨️ Print Invoice
                            </Button>
                            <Button
                              size="sm"
                              color="secondary"
                              className="flex-1"
                              onPress={eventsScreen.handleExportEventXls}
                            >
                              📊 Export XLS
                            </Button>
                          </div>
                        </div>
                      ) : (
                      <Tabs
                        size="sm"
                        variant="underlined"
                        selectedKey={eventsScreen.activePrintTab}
                        onSelectionChange={(key) => eventsScreen.setActivePrintTab(key as 'quote' | 'invoice' | 'receipt' | 'xls')}
                      >
                        {eventsScreen.showQuotePrintInModal && eventsScreen.editingEvent && (() => {
                          const proformaType = EVENT_DOC_TYPE[eventsScreen.editingEventDocSection].proforma;
                          const proformaOptions = eventsScreen.listSelectableTemplates(proformaType);
                          const proformaDefault = eventsScreen.resolveEventTemplateKey(proformaType) || proformaOptions[0]?.key || '';
                          return (
                          <Tab key="quote" title="📄 Proforma">
                            <div className="space-y-3">
                              <Select
                                size="sm"
                                label="Template"
                                selectedKeys={proformaOptions.some(opt => opt.key === (eventsScreen.selectedProformaTemplate || proformaDefault)) ? [eventsScreen.selectedProformaTemplate || proformaDefault] : []}
                                onSelectionChange={(keys) => { const key = Array.from(keys)[0] as string; if (key) eventsScreen.setSelectedProformaTemplate(key); }}
                              >
                                {proformaOptions.map((opt) => (<SelectItem key={opt.key}>{opt.name}</SelectItem>))}
                              </Select>
                              <Button
                                size="sm"
                                color="primary"
                                className="w-full"
                                onPress={() => eventsScreen.handlePrintQuotePdf(eventsScreen.selectedProformaTemplate || proformaDefault)}
                              >
                                🖨️ Print Proforma
                              </Button>
                            </div>
                          </Tab>
                          );
                        })()}
                        {eventsScreen.showQuotePrintInModal && eventsScreen.editingEvent && (() => {
                          const invoiceType = EVENT_DOC_TYPE[eventsScreen.editingEventDocSection].invoice;
                          const invoiceOptions = eventsScreen.listSelectableTemplates(invoiceType);
                          const invoiceDefault = eventsScreen.resolveEventTemplateKey(invoiceType) || invoiceOptions[0]?.key || '';
                          return (
                          <Tab key="invoice" title="🧾 Invoice">
                            <div className="space-y-3">
                              {!eventsScreen.linkedEventInvoice && (
                                <p className="text-xs text-gray-500">No invoice has been formally created for this event yet — this prints straight from the current totals below.</p>
                              )}
                              <Select
                                size="sm"
                                label="Template"
                                selectedKeys={invoiceOptions.some(opt => opt.key === (eventsScreen.selectedInvoiceTemplate || invoiceDefault)) ? [eventsScreen.selectedInvoiceTemplate || invoiceDefault] : []}
                                onSelectionChange={(keys) => { const key = Array.from(keys)[0] as string; if (key) eventsScreen.setSelectedInvoiceTemplate(key); }}
                              >
                                {invoiceOptions.map((opt) => (<SelectItem key={opt.key}>{opt.name}</SelectItem>))}
                              </Select>
                              <Button
                                size="sm"
                                color="primary"
                                className="w-full"
                                onPress={() => eventsScreen.linkedEventInvoice
                                  ? eventsScreen.handleDownloadInvoicePdf(eventsScreen.linkedEventInvoice, eventsScreen.selectedInvoiceTemplate || invoiceDefault)
                                  : eventsScreen.handlePrintEventInvoicePdf(eventsScreen.selectedInvoiceTemplate || invoiceDefault)}
                              >
                                🖨️ Print Invoice
                              </Button>
                            </div>
                          </Tab>
                          );
                        })()}
                        {eventsScreen.showQuotePrintInModal && eventsScreen.editingEvent && (() => {
                          const receiptType = EVENT_DOC_TYPE[eventsScreen.editingEventDocSection].receipt;
                          const receiptOptions = eventsScreen.listSelectableTemplates(receiptType);
                          const receiptDefault = eventsScreen.resolveEventTemplateKey(receiptType) || receiptOptions[0]?.key || '';
                          const outstandingBalance = eventsScreen.linkedEventInvoice
                            ? (eventsScreen.linkedEventInvoice.balance || 0)
                            : Math.max(0, eventsScreen.balanceDue - eventsScreen.linkedEventReceipts.reduce((s, r) => s + (r.amount || 0), 0));
                          return (
                          <Tab key="receipt" title="💰 Receipt">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 border border-gray-200">
                                <span className="text-xs text-gray-600">Outstanding Balance</span>
                                <span className="text-sm font-semibold text-ghana-black">{eventsScreen.formatCurrency(outstandingBalance)}</span>
                              </div>
                              <Button
                                size="sm"
                                color="success"
                                className="w-full"
                                onPress={() => {
                                  if (eventsScreen.linkedEventInvoice) {
                                    eventsScreen.openReceiptFromInvoice(eventsScreen.linkedEventInvoice);
                                    return;
                                  }
                                  eventsScreen.openReceiptModal('create', undefined, {
                                    ...eventsScreen.editingEvent,
                                    balance: outstandingBalance,
                                  });
                                }}
                              >
                                Record receipt
                              </Button>
                              {eventsScreen.linkedEventReceipts.length > 0 && (
                                <div className="space-y-2">
                                  <Select
                                    size="sm"
                                    label="Print Template"
                                    selectedKeys={receiptOptions.some(opt => opt.key === (eventsScreen.selectedReceiptTemplate || receiptDefault)) ? [eventsScreen.selectedReceiptTemplate || receiptDefault] : []}
                                    onSelectionChange={(keys) => { const key = Array.from(keys)[0] as string; if (key) eventsScreen.setSelectedReceiptTemplate(key); }}
                                  >
                                    {receiptOptions.map((opt) => (<SelectItem key={opt.key}>{opt.name}</SelectItem>))}
                                  </Select>
                                  <p className="text-xs text-gray-500">Receipts on file</p>
                                  {eventsScreen.linkedEventReceipts.map((rcpt) => (
                                    <div key={rcpt.id} className="flex items-center justify-between gap-2 text-sm">
                                      <span className={`text-gray-600 ${rcpt.status === 'Void' ? 'line-through' : ''}`}>{rcpt.date} · {eventsScreen.formatCurrency(rcpt.amount)} · {paymentMethodLabel(rcpt.method)}{rcpt.status === 'Void' ? ' · void' : ''}</span>
                                      {rcpt.status !== 'Void' && (
                                        <Button size="sm" variant="flat" onPress={() => eventsScreen.handleDownloadReceiptPdf(rcpt, eventsScreen.selectedReceiptTemplate || receiptDefault)}>🖨️ Print</Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </Tab>
                          );
                        })()}
                        <Tab key="xls" title="📊 XLS">
                          <div className="space-y-3">
                            <p className="text-xs text-gray-600">
                              Export a spreadsheet summary of the event schedule, services, and financials.
                            </p>
                            <Button
                              size="sm"
                              color="secondary"
                              className="w-full"
                              onPress={eventsScreen.handleExportEventXls}
                            >
                              Export Event XLS
                            </Button>
                          </div>
                        </Tab>
                      </Tabs>
                      )}
                    </CardBody>
                  </Card>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              {eventsScreen.isViewMode ? (
                <>
                  <Button
                    color="default"
                    variant="flat"
                    onPress={eventsScreen.closeEventWorkspace}
                  >
                    Close
                  </Button>
                  <Button
                    color="primary"
                    onPress={() => {
                      eventsScreen.setIsViewMode(false);
                    }}
                  >
                    Edit Event
                  </Button>
                </>
              ) : (
                <div className="flex w-full items-center justify-between gap-2">
                  <div>
                    {!eventsScreen.isCreatingEvent && !eventsScreen.isEditingInvoiceDetails && !eventsScreen.isCreatingInvoiceFromFolio && eventsScreen.eventStatus !== 'invoiced' && eventsScreen.eventStatus !== 'cancelled' && eventsScreen.editingEvent?.id && eventsScreen.editingEvent.completionStatus !== 'completed' && eventsScreen.editingEvent.completionStatus !== 'billed' && (
                      <Button
                        color="danger"
                        variant="flat"
                        onPress={async () => {
                          const ok = await eventsScreen.cancelMissedEvent(eventsScreen.editingEvent);
                          if (ok) eventsScreen.closeEventWorkspace();
                        }}
                      >
                        Cancel booking
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-row gap-2">
                  {!eventsScreen.isCreatingEvent && !eventsScreen.isEditingInvoiceDetails && eventsScreen.editingEvent?.id && (
                    <Button
                      color="secondary"
                      variant="flat"
                      onPress={eventsScreen.handleOpenContractFromEvent}
                    >
                      Generate Contract
                    </Button>
                  )}
                  {!eventsScreen.isCreatingEvent && !eventsScreen.isEditingInvoiceDetails && eventsScreen.editingEvent?.id && !eventsScreen.eventInvoices.some((inv) => inv.eventId === eventsScreen.editingEvent.id) && (
                    <Button
                      color="success"
                      variant="flat"
                      onPress={() => {
                        eventsScreen.setIsEditingInvoiceDetails(true);
                        eventsScreen.setEventStatus('invoiced');
                      }}
                    >
                      Create Invoice
                    </Button>
                  )}
                  <Button
                    color="primary"
                    isDisabled={eventsScreen.eventSubmitting}
                    onPress={() => (eventsScreen.isEditingInvoiceDetails ? eventsScreen.handleInvoiceDetailsSave() : eventsScreen.handleEventSubmit())}
                  >
                    {eventsScreen.eventSubmitting
                      ? (eventsScreen.isEditingInvoiceDetails
                          ? (eventsScreen.eventInvoices.some((inv) => inv.eventId === eventsScreen.editingEvent?.id) ? 'Saving Invoice...' : 'Creating Invoice...')
                          : eventsScreen.isCreatingEvent
                            ? 'Creating...'
                            : eventsScreen.isAdjustMode
                              ? 'Adjusting...'
                              : 'Updating...')
                      : (eventsScreen.isEditingInvoiceDetails
                          ? (eventsScreen.eventInvoices.some((inv) => inv.eventId === eventsScreen.editingEvent?.id) ? 'Save Invoice' : 'Create Invoice')
                          : eventsScreen.isCreatingEvent
                            ? 'Create Event'
                            : eventsScreen.isAdjustMode
                              ? 'Adjust'
                              : 'Update Event')}
                    </Button>
                  <Button
                    color="default"
                    variant="flat"
                    onPress={eventsScreen.closeEventWorkspace}
                  >
                    Close
                  </Button>
                  </div>
                </div>
              )}
            </ModalFooter>
          </ModalContent>
        </Modal>



  </>
  );
}
