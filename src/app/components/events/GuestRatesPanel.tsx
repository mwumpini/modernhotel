'use client';

import { Autocomplete, AutocompleteItem, Button, Card, CardBody, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Switch, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import EventsModuleFilters, { EventsDateFilterMode, getEventsDateRangeBounds } from '../EventsModuleFilters';
import { RATE_EFFECTIVE_STATUS_META, RateEffectiveStatus, getRateEffectivePeriodLabel, getRateEffectiveStatus, rateOverlapsDateRange } from './eventShared';
import type { TableSortState } from './eventTypes';
import { deskTableCardBodyClassName, deskTableCardClassName } from '../dashboard/deskTableUi';
import { trackEvent } from '../../lib/analytics/trackEvent';
import { useEffect, useMemo, useState } from 'react';
import { worksheetTableClassNames } from '../frontoffice/StayWorksheetTable';
import { useEventsScreen } from './eventsScreenContext';

/** Events → Guest Rates. Rate table, filters, and the rate editor. */
export function GuestRatesPanel({
    onFilteredCountChange,
  }: {
    onFilteredCountChange?: (count: number) => void;
  }) {
  const eventsScreen = useEventsScreen();
  const [rateSearchTerm, setRateSearchTerm] = useState('');
  const [rateTypeFilter, setRateTypeFilter] = useState<string>('all');
  const [rateGuestFilter, setRateGuestFilter] = useState<string>('all');
  const [rateGuestSearch, setRateGuestSearch] = useState('');
  const [rateEffectiveFilter, setRateEffectiveFilter] = useState<'all' | RateEffectiveStatus>('all');
  const [rateDateFilterMode, setRateDateFilterMode] = useState<EventsDateFilterMode>('thisMonth');
  const [rateDateFilterSingle, setRateDateFilterSingle] = useState('');
  const [rateDateFilterFrom, setRateDateFilterFrom] = useState('');
  const [rateDateFilterTo, setRateDateFilterTo] = useState('');
  const [ratePage, setRatePage] = useState(1);
  const [rateSort, setRateSort] = useState<TableSortState>({ column: 'status', direction: 'asc' });
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<any>(null);
  const [rateForm, setRateForm] = useState<any>({
    name: '',
    selectedTypes: [] as string[], // Multiple types can be selected
    rates: {
      accommodation: { rate: 0, unit: 'per_room', label: 'Accommodation' },
      conference: { rate: 0, unit: 'per_person', label: 'Conference' },
      lunch: { rate: 0, unit: 'per_person', label: 'Lunch' },
      dinner: { rate: 0, unit: 'per_person', label: 'Dinner' },
      other: { rate: 0, unit: 'per_person', label: 'Other' }
    },
    applicableDates: {
      startDate: `${new Date().getFullYear()}-01-01`,
      endDate: `${new Date().getFullYear()}-12-31`,
      isAllYear: false,
    },
    clientSpecific: false,
    clientId: '',
    clientName: '',
    isActive: true,
    notes: ''
  });
  const [rateErrors, setRateErrors] = useState<Record<string, string>>({});
  const rowsPerPage = 10;

  // Use shared conferenceRates state from parent component
  // conferenceRates and setConferenceRates are now in parent scope

  const filteredRates = useMemo(() => {
    let filtered = eventsScreen.conferenceRates;
    const today = new Date().toISOString().slice(0, 10);
    const dateBounds = getEventsDateRangeBounds(
      rateDateFilterMode,
      rateDateFilterSingle,
      rateDateFilterFrom,
      rateDateFilterTo
    );

    if (rateSearchTerm) {
      const term = rateSearchTerm.toLowerCase();
      filtered = filtered.filter(rate =>
        rate.name.toLowerCase().includes(term) ||
        rate.type.toLowerCase().includes(term) ||
        (rate.clientName && rate.clientName.toLowerCase().includes(term)) ||
        rate.notes.toLowerCase().includes(term) ||
        getRateEffectivePeriodLabel(rate.applicableDates).toLowerCase().includes(term)
      );
    }

    if (rateTypeFilter !== 'all') {
      filtered = filtered.filter(rate => rate.type === rateTypeFilter);
    }

    if (rateGuestFilter !== 'all') {
      if (rateGuestFilter === 'general') {
        filtered = filtered.filter(rate => !rate.clientSpecific);
      } else {
        const selectedGuest = (eventsScreen.frontOfficeGuests || []).find((guest: any) => guest.id === rateGuestFilter);
        const selectedOrg = (
          selectedGuest?.employerCompany ||
          selectedGuest?.name ||
          `${selectedGuest?.firstName || ''} ${selectedGuest?.lastName || ''}`
        )
          ?.toLowerCase()
          .trim();
        filtered = filtered.filter((rate) => {
          if (rate.clientId === rateGuestFilter) return true;
          if (!selectedOrg) return false;
          const rateClient = (rate.clientName || '').toLowerCase().trim();
          return (
            rateClient &&
            (rateClient.includes(selectedOrg) || selectedOrg.includes(rateClient))
          );
        });
      }
    }

    if (rateEffectiveFilter !== 'all') {
      filtered = filtered.filter(
        (rate) => getRateEffectiveStatus(rate.applicableDates, today) === rateEffectiveFilter
      );
    }

    if (dateBounds) {
      filtered = filtered.filter((rate) =>
        rateOverlapsDateRange(rate.applicableDates, dateBounds.from, dateBounds.to)
      );
    }

    return filtered;
  }, [
    eventsScreen.conferenceRates,
    rateSearchTerm,
    rateTypeFilter,
    rateGuestFilter,
    rateEffectiveFilter,
    rateDateFilterMode,
    rateDateFilterSingle,
    rateDateFilterFrom,
    rateDateFilterTo,
    eventsScreen.frontOfficeGuests,
  ]);

  useEffect(() => {
    onFilteredCountChange?.(filteredRates.length);
  }, [filteredRates.length, onFilteredCountChange]);

  const sortedRates = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const statusOrder: Record<string, number> = {
      effective: 0,
      'all-year': 1,
      upcoming: 2,
      incomplete: 3,
      expired: 4,
      inactive: 5,
    };
    return eventsScreen.sortRows(filteredRates, rateSort, {
      name: (rate: any) => rate.name || '',
      type: (rate: any) => rate.customLabel || rate.type || '',
      amount: (rate: any) => Number(rate.baseRate || 0),
      period: (rate: any) =>
        rate.applicableDates?.isAllYear ? '0000-01-01' : rate.applicableDates?.startDate || '',
      client: (rate: any) => (rate.clientSpecific ? rate.clientName || '' : 'All clients'),
      status: (rate: any) =>
        statusOrder[rate.isActive === false ? 'inactive' : getRateEffectiveStatus(rate.applicableDates, today)] ?? 9,
    });
  }, [filteredRates, rateSort]);

  const paginatedRates = useMemo(() => {
    const start = (ratePage - 1) * rowsPerPage;
    return sortedRates.slice(start, start + rowsPerPage);
  }, [sortedRates, ratePage, rowsPerPage]);

  const ratePages = useMemo(() => {
    return Math.ceil(filteredRates.length / rowsPerPage);
  }, [filteredRates, rowsPerPage]);

  useEffect(() => {
    setRatePage(1);
  }, [rateSearchTerm, rateTypeFilter, rateGuestFilter, rateEffectiveFilter, rateDateFilterMode, rateDateFilterSingle, rateDateFilterFrom, rateDateFilterTo]);

  const openRateModal = (mode: 'create' | 'edit', rate?: any) => {
    if (mode === 'edit' && rate) {
      setEditingRate(rate);
      // For editing, show single rate (backward compatible)
      const selectedTypes = [rate.type];
      const rates = {
        accommodation: { rate: 0, unit: 'per_room', label: 'Accommodation' },
        conference: { rate: 0, unit: 'per_person', label: 'Conference' },
        lunch: { rate: 0, unit: 'per_person', label: 'Lunch' },
        dinner: { rate: 0, unit: 'per_person', label: 'Dinner' },
        other: { rate: 0, unit: 'per_person', label: 'Other' }
      };
      // Extract label from rate - use customLabel if available, otherwise extract from name
      const defaultLabels: Record<string, string> = {
        accommodation: 'Accommodation',
        conference: 'Conference',
        lunch: 'Lunch',
        dinner: 'Dinner',
        other: 'Other'
      };
      let rateLabel = defaultLabels[rate.type];
      if (rate.customLabel) {
        rateLabel = rate.customLabel;
      } else if (rate.name) {
        // Try to extract label from name (remove client name prefix and "Rate" suffix)
        const nameWithoutRate = rate.name.replace(/Rate$/i, '').trim();
        const clientPrefix = rate.clientName ? `${rate.clientName} - ` : '';
        if (nameWithoutRate.startsWith(clientPrefix)) {
          rateLabel = nameWithoutRate.substring(clientPrefix.length).trim();
        } else {
          rateLabel = nameWithoutRate;
        }
        // If extracted label is just the default, keep default
        if (rateLabel === defaultLabels[rate.type] || rateLabel === rate.type) {
          rateLabel = defaultLabels[rate.type];
        }
      }
      rates[rate.type as keyof typeof rates] = { 
        rate: rate.baseRate, 
        unit: rate.unit, 
        label: rateLabel 
      };

      setRateForm({
        name: rate.name,
        selectedTypes,
        rates,
        applicableDates: rate.applicableDates,
        clientSpecific: rate.clientSpecific,
        clientId: rate.clientId || '',
        clientName: rate.clientName || '',
        isActive: rate.isActive,
        notes: rate.notes || ''
      });
    } else {
      setEditingRate(null);
      setRateForm({
        name: '',
        selectedTypes: [],
        rates: {
          accommodation: { rate: 0, unit: 'per_room', label: 'Accommodation' },
          conference: { rate: 0, unit: 'per_person', label: 'Conference' },
          lunch: { rate: 0, unit: 'per_person', label: 'Lunch' },
          dinner: { rate: 0, unit: 'per_person', label: 'Dinner' },
          other: { rate: 0, unit: 'per_person', label: 'Other' }
        },
        applicableDates: {
          startDate: `${new Date().getFullYear()}-01-01`,
          endDate: `${new Date().getFullYear()}-12-31`,
          isAllYear: false,
        },
        clientSpecific: false,
        clientId: '',
        clientName: '',
        isActive: true,
        notes: ''
      });
    }
    setRateErrors({});
    setIsRateModalOpen(true);
  };

  const validateRateForm = () => {
    const errors: Record<string, string> = {};
    if (rateForm.selectedTypes.length === 0) {
      errors.selectedTypes = 'Please select at least one rate type';
    }
    if (rateForm.clientSpecific && !rateForm.clientName && !rateForm.clientId) {
      errors.clientId = 'Guest/Company must be selected or entered for client-specific rates';
    }
    if (!rateForm.applicableDates.isAllYear) {
      if (!rateForm.applicableDates.startDate) errors.startDate = 'Effective from date is required';
      if (!rateForm.applicableDates.endDate) errors.endDate = 'Effective to date is required';
      if (rateForm.applicableDates.startDate && rateForm.applicableDates.endDate && 
          new Date(rateForm.applicableDates.startDate) > new Date(rateForm.applicableDates.endDate)) {
        errors.endDate = 'End date must be after start date';
      }
    }
    // Validate that each selected type has a rate > 0
    rateForm.selectedTypes.forEach((type: string) => {
      const rateValue = rateForm.rates[type as keyof typeof rateForm.rates]?.rate || 0;
      if (!rateValue || rateValue <= 0) {
        errors[`rate_${type}`] = `${type.charAt(0).toUpperCase() + type.slice(1)} rate must be greater than 0`;
      }
    });
    setRateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveRate = () => {
    if (!validateRateForm()) return;

    // If client-specific, ensure clientName is set
    const finalClientName = rateForm.clientSpecific 
      ? (rateForm.clientName || (rateForm.clientId ? availableClients.find(c => c.id === rateForm.clientId)?.name : ''))
      : '';

    const baseTimestamp = editingRate ? editingRate.id : Date.now();

    if (editingRate) {
      // Editing mode: update single rate
      const firstType = rateForm.selectedTypes[0];
      const firstTypeRate = rateForm.rates[firstType as keyof typeof rateForm.rates];
      const customLabel = firstTypeRate?.label || firstType;
      const rateData = {
        id: editingRate.id,
        name: rateForm.name.trim() || `${finalClientName ? `${finalClientName} - ` : ''}${customLabel} Rate`,
        type: firstType,
        baseRate: parseFloat(firstTypeRate?.rate || 0),
        unit: firstTypeRate?.unit || 'per_person',
        customLabel: customLabel, // Store custom label
        applicableDates: rateForm.applicableDates,
        clientSpecific: rateForm.clientSpecific,
        clientId: rateForm.clientId || '',
        clientName: finalClientName,
        isActive: rateForm.isActive,
        notes: rateForm.notes.trim(),
        createdAt: editingRate.createdAt,
        updatedAt: new Date().toISOString().split('T')[0]
      };
      eventsScreen.setConferenceRates(prev => prev.map(r => r.id === editingRate.id ? rateData : r));
      trackEvent('Analytics.ActionClicked', { action: 'ConferenceRateUpdated', rateId: rateData.id });
    } else {
      // Create mode: create multiple rates if multiple types selected
      const typeLabels: Record<string, string> = {
        accommodation: 'Accommodation',
        conference: 'Conference',
        lunch: 'Lunch',
        dinner: 'Dinner',
        other: 'Other'
      };
      const newRates = rateForm.selectedTypes.map((type: string, index: number) => {
        const typeRate = rateForm.rates[type as keyof typeof rateForm.rates];
        const customLabel = typeRate?.label || typeLabels[type];
        return {
          id: `rate-${baseTimestamp}-${index}`,
          name: rateForm.name.trim() || `${finalClientName ? `${finalClientName} - ` : ''}${customLabel} Rate`,
          type: type,
          baseRate: parseFloat(typeRate?.rate || 0),
          unit: typeRate?.unit || (type === 'accommodation' ? 'per_room' : 'per_person'),
          customLabel: customLabel, // Store custom label
          applicableDates: rateForm.applicableDates,
          clientSpecific: rateForm.clientSpecific,
          clientId: rateForm.clientId || '',
          clientName: finalClientName,
          isActive: rateForm.isActive,
          notes: rateForm.notes.trim(),
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0]
        };
      });
      eventsScreen.setConferenceRates(prev => [...newRates, ...prev]);
      newRates.forEach((rate: any) => {
        trackEvent('Analytics.ActionClicked', { action: 'ConferenceRateCreated', rateId: rate.id });
      });
    }

    setIsRateModalOpen(false);
    setEditingRate(null);
  };

  const handleDeleteRate = async (rateId: string) => {
    const { confirmDelete } = await import('../DangerConfirm');
    if (await confirmDelete('this rate', 'The rate will be permanently removed.')) {
      eventsScreen.setConferenceRates(prev => prev.filter(r => r.id !== rateId));
      trackEvent('Analytics.ActionClicked', { action: 'ConferenceRateDeleted', rateId });
    }
  };

  const getRateTypeLabel = (rate: any) => {
    // If rate is a string (backward compatibility), treat it as type
    if (typeof rate === 'string') {
      const labels: Record<string, string> = {
        accommodation: '🏨 Accommodation',
        conference: '📅 Conference',
        lunch: '🍽️ Lunch',
        dinner: '🍴 Dinner',
        other: '📋 Other'
      };
      return labels[rate] || rate;
    }

    // Use customLabel if available, otherwise use default label
    if (rate.customLabel && rate.customLabel !== rate.type) {
      const icons: Record<string, string> = {
        accommodation: '🏨',
        conference: '📅',
        lunch: '🍽️',
        dinner: '🍴',
        other: '📋'
      };
      return `${icons[rate.type] || ''} ${rate.customLabel}`;
    }

    const labels: Record<string, string> = {
      accommodation: '🏨 Accommodation',
      conference: '📅 Conference',
      lunch: '🍽️ Lunch',
      dinner: '🍴 Dinner',
      other: '📋 Other'
    };
    return labels[rate.type] || rate.type;
  };

  const getUnitLabel = (unit: string) => {
    const labels: Record<string, string> = {
      per_person: 'Per person',
      per_room: 'Per room',
      per_event: 'Per event',
      per_day: 'Per day'
    };
    return labels[unit] || unit;
  };

  const getRateTypePlain = (rate: any) => {
    if (rate?.customLabel && rate.customLabel !== rate.type) return rate.customLabel;
    const labels: Record<string, string> = {
      accommodation: 'Accommodation',
      conference: 'Conference',
      lunch: 'Lunch',
      dinner: 'Dinner',
      other: 'Other',
    };
    return labels[rate?.type] || rate?.type || 'Other';
  };

  const getRateTypeColor = (type: string): 'primary' | 'secondary' | 'warning' | 'success' | 'default' => {
    if (type === 'accommodation') return 'primary';
    if (type === 'conference') return 'secondary';
    if (type === 'lunch') return 'warning';
    if (type === 'dinner') return 'success';
    return 'default';
  };

  const handleRateSort = (column: string) => {
    setRateSort((prev) => eventsScreen.getNextSortState(prev, column));
  };

  const renderRateSortHeader = (label: string, columnKey: string) => (
    <button
      type="button"
      className="font-semibold text-ghana-black"
      onClick={() => handleRateSort(columnKey)}
    >
      {label}{rateSort.column === columnKey ? (rateSort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );

  const rateTableClassNames = {
    ...worksheetTableClassNames,
    base: 'max-w-full overflow-x-auto',
    table: 'w-full min-w-max',
  };

  // Get available clients for client-specific rates (same logic as events form)
  const availableClients = useMemo(() => {
    const guests = eventsScreen.frontOfficeGuests || [];
    const clientMap = new Map();

    guests.forEach((g: any) => {
      const org = g.employerCompany || (g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim());
      if (org && !clientMap.has(org)) {
        clientMap.set(org, {
          id: g.id,
          name: org,
          guest: g
        });
      }
    });

    return Array.from(clientMap.values());
  }, [eventsScreen.frontOfficeGuests]);

  // Get unique guest/company list for filter dropdown
  const availableGuestsForFilter = useMemo(() => {
    const guests = eventsScreen.frontOfficeGuests || [];
    const guestMap = new Map();

    // Add "General Rates" option
    guestMap.set('general', { id: 'general', name: 'General Rates (All Clients)' });

    guests.forEach((g: any) => {
      const org = g.employerCompany || (g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim());
      if (org && !guestMap.has(org)) {
        guestMap.set(org, {
          id: g.id,
          name: org
        });
      }
    });

    return Array.from(guestMap.values());
  }, [eventsScreen.frontOfficeGuests]);

  return (
    <div className="space-y-2 mt-2">
      <div>
        <h3 className="text-lg font-semibold text-ghana-black">Guest Rates</h3>
        <p className="text-sm text-gray-500">
          Rates apply only when the event dates fall within the rate&apos;s effective period.
        </p>
      </div>

      {/* Filters */}
      <EventsModuleFilters
        searchTerm={rateSearchTerm}
        onSearchChange={setRateSearchTerm}
        searchPlaceholder="Search rates by name, type, client, or effective period..."
        statusFilter={rateTypeFilter}
        onStatusChange={setRateTypeFilter}
        statusPlaceholder="Filter by type"
        statusOptions={[
          { key: 'all', label: 'All Types' },
          { key: 'accommodation', label: '🏨 Accommodation' },
          { key: 'conference', label: '📅 Conference' },
          { key: 'lunch', label: '🍽️ Lunch' },
          { key: 'dinner', label: '🍴 Dinner' },
          { key: 'other', label: '📋 Other' },
        ]}
        showDateFilter
        dateFilterMode={rateDateFilterMode}
        onDateFilterModeChange={setRateDateFilterMode}
        dateFilterSingle={rateDateFilterSingle}
        onDateFilterSingleChange={setRateDateFilterSingle}
        dateFilterFrom={rateDateFilterFrom}
        onDateFilterFromChange={setRateDateFilterFrom}
        dateFilterTo={rateDateFilterTo}
        onDateFilterToChange={setRateDateFilterTo}
        singleRow
        extraFilters={
          <>
            <Select
              size="sm"
              aria-label="Effective status"
              placeholder="Effective status"
              className="min-w-[min(100%,9rem)] flex-1 basis-[9rem] max-w-full sm:max-w-[12rem]"
              selectedKeys={[rateEffectiveFilter]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as typeof rateEffectiveFilter | undefined;
                setRateEffectiveFilter(value || 'all');
              }}
            >
              <SelectItem key="all">All statuses</SelectItem>
              <SelectItem key="effective">Effective now</SelectItem>
              <SelectItem key="all-year">Always effective</SelectItem>
              <SelectItem key="upcoming">Upcoming</SelectItem>
              <SelectItem key="expired">Expired</SelectItem>
              <SelectItem key="incomplete">Needs dates</SelectItem>
            </Select>
            <Autocomplete
            size="sm"
            aria-label="Guest or company"
            placeholder="Guest or company"
            selectedKey={rateGuestFilter !== 'all' ? rateGuestFilter : null}
            onSelectionChange={(key) => {
              setRateGuestFilter((key as string) || 'all');
            }}
            inputValue={rateGuestSearch}
            onInputChange={(value) => {
              setRateGuestSearch(value);
              if (!value) {
                setRateGuestFilter('all');
              }
            }}
            className="min-w-[min(100%,11rem)] flex-1 basis-[11rem] max-w-full sm:max-w-[14rem]"
            allowsCustomValue
          >
            {(() => {
              const q = (rateGuestSearch || '').trim();
              const guests = eventsScreen.frontOfficeGuests || [];
              const results = q.length >= 2
                ? guests.filter((g: any) => {
                    if (g.isActive === false) return false;
                    const org = (g.employerCompany || '').toLowerCase();
                    const name = (g.name || `${g.firstName || ''} ${g.lastName || ''}`).toLowerCase();
                    const phone = (g.companyPhone || g.phone || '').toLowerCase();
                    return org.includes(q.toLowerCase()) || name.includes(q.toLowerCase()) || phone.includes(q.toLowerCase());
                  }).slice(0, 20)
                : [];

              const filterOptions = [];

              if (q.length < 2) {
                filterOptions.push(
                  <AutocompleteItem key="all" textValue="All Rates">
                    All Rates
                  </AutocompleteItem>
                );
                filterOptions.push(
                  <AutocompleteItem key="general" textValue="General Rates Only">
                    General Rates Only
                  </AutocompleteItem>
                );
              }

              results.forEach((guest: any) => {
                const label = guest.employerCompany || guest.name || `${guest.firstName || ''} ${guest.lastName || ''}`.trim();
                filterOptions.push(
                  <AutocompleteItem key={guest.id} textValue={label}>
                    {label}
                  </AutocompleteItem>
                );
              });

              return filterOptions;
            })()}
          </Autocomplete>
          </>
        }
      />

      <Card className={deskTableCardClassName}>
        <CardBody className={deskTableCardBodyClassName}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-800">Rates</h3>
            <Button size="sm" color="primary" variant="solid" onPress={() => openRateModal('create')}>
              New rate
            </Button>
          </div>
          <Table
            aria-label="Guest rates"
            removeWrapper
            classNames={rateTableClassNames}
          >
            <TableHeader>
              <TableColumn key="client">
                {renderRateSortHeader('Client', 'client')}
              </TableColumn>
              <TableColumn key="name">
                {renderRateSortHeader('Rate', 'name')}
              </TableColumn>
              <TableColumn key="type">
                {renderRateSortHeader('Type', 'type')}
              </TableColumn>
              <TableColumn key="amount" align="end">
                {renderRateSortHeader('Amount', 'amount')}
              </TableColumn>
              <TableColumn key="period">
                {renderRateSortHeader('Period', 'period')}
              </TableColumn>
              <TableColumn key="status">
                {renderRateSortHeader('Status', 'status')}
              </TableColumn>
              <TableColumn key="actions" align="end"> </TableColumn>
            </TableHeader>
            <TableBody emptyContent="No rates match the current filters.">
              {paginatedRates.map((rate: any) => {
                  const effectiveStatus = getRateEffectiveStatus(rate.applicableDates);
                  const effectiveMeta = RATE_EFFECTIVE_STATUS_META[effectiveStatus];
                  const statusLabel = rate.isActive === false ? 'Inactive' : (
                    effectiveStatus === 'all-year' ? 'Always' :
                    effectiveStatus === 'effective' ? 'Effective' :
                    effectiveMeta.label
                  );
                  const statusColor = rate.isActive === false ? 'default' : effectiveMeta.color;
                  return (
                  <TableRow
                    key={rate.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openRateModal('edit', rate)}
                  >
                    <TableCell>
                      <span className={`whitespace-nowrap ${rate.clientSpecific ? 'text-slate-700' : 'text-slate-400'}`}>
                        {rate.clientSpecific ? (rate.clientName || '—') : 'All clients'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[160px] max-w-[280px]" title={rate.notes || undefined}>
                        <p className="font-medium text-slate-900 leading-5">{rate.name}</p>
                        {rate.notes ? (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{rate.notes}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={getRateTypeColor(rate.type)}>
                        {getRateTypePlain(rate)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="text-right">
                        <p className="whitespace-nowrap tabular-nums font-medium text-slate-900">
                          {eventsScreen.formatCurrency(rate.baseRate)}
                        </p>
                        <p className="text-xs text-slate-500">{getUnitLabel(rate.unit)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-slate-700">
                        {getRateEffectivePeriodLabel(rate.applicableDates)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={statusColor}>
                        {statusLabel}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                        <Button size="sm" variant="light" color="danger" onPress={() => handleDeleteRate(rate.id)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
            </TableBody>
          </Table>
          <div className="flex justify-end mt-3">
              <Pagination
                total={Math.max(1, ratePages)}
                page={ratePage}
                onChange={setRatePage}
                showControls
                size="sm"
              />
            </div>
        </CardBody>
      </Card>

      {/* Rate Modal */}
      <Modal
        isOpen={isRateModalOpen}
        onClose={() => {
          setIsRateModalOpen(false);
          setEditingRate(null);
          setRateErrors({});
        }}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-semibold">
              {editingRate ? 'Edit Rate' : 'Create New Rate'}
            </h3>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* Rate Name (Optional - will auto-generate if not provided) */}
              <Input
                label="Rate Name (Optional)"
                placeholder="e.g., Agrivest Co Rates (leave blank to auto-generate)"
                value={rateForm.name}
                onValueChange={(value) => setRateForm({ ...rateForm, name: value })}
                description="If left blank, names will be auto-generated based on client and rate type"
              />

              {/* Rate Types - Multiple Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Rate Types *</label>
                <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg">
                  {[
                    { key: 'accommodation', label: '🏨 Accommodation', defaultUnit: 'per_room' },
                    { key: 'conference', label: '📅 Conference', defaultUnit: 'per_person' },
                    { key: 'lunch', label: '🍽️ Lunch', defaultUnit: 'per_person' },
                    { key: 'dinner', label: '🍴 Dinner', defaultUnit: 'per_person' },
                    { key: 'other', label: '📋 Other', defaultUnit: 'per_person' }
                  ].map((type) => (
                    <div key={type.key} className="space-y-2">
                      <Switch
                        isSelected={rateForm.selectedTypes.includes(type.key)}
                        onValueChange={(checked) => {
                          const newTypes = checked
                            ? [...rateForm.selectedTypes, type.key]
                            : rateForm.selectedTypes.filter((t: string) => t !== type.key);
                          setRateForm({ ...rateForm, selectedTypes: newTypes });
                        }}
                      >
                        <span className="text-sm">{type.label}</span>
                      </Switch>
                      {rateForm.selectedTypes.includes(type.key) && (
                        <div className="ml-6 space-y-2">
                          <Input
                            size="sm"
                            label="Custom Label *"
                            placeholder={(() => {
                              const placeholders: Record<string, string> = {
                                accommodation: 'e.g., Accommodation & Breakfast, Standard Accommodation, Deluxe Room',
                                conference: 'e.g., Conference with 1 Snack, Conference with 2 Snacks, Full Conference Package',
                                lunch: 'e.g., Lunch, Buffet Lunch, Set Lunch Menu',
                                dinner: 'e.g., Dinner, Buffet Dinner, Set Dinner Menu',
                                other: 'e.g., Tea Break, Coffee Break, Snacks'
                              };
                              return placeholders[type.key] || `e.g., ${type.label.replace(/^[^\s]+\s/, '')}`;
                            })()}
                            value={rateForm.rates[type.key as keyof typeof rateForm.rates]?.label || ''}
                            onValueChange={(value) => {
                              const defaultLabels: Record<string, string> = {
                                accommodation: 'Accommodation',
                                conference: 'Conference',
                                lunch: 'Lunch',
                                dinner: 'Dinner',
                                other: 'Other'
                              };
                              setRateForm({
                                ...rateForm,
                                rates: {
                                  ...rateForm.rates,
                                  [type.key]: {
                                    ...rateForm.rates[type.key as keyof typeof rateForm.rates],
                                    label: value.trim() || defaultLabels[type.key] || type.label.replace(/^[^\s]+\s/, '')
                                  }
                                }
                              });
                            }}
                            description="Customize how this rate will be labeled. Leave blank to use default label."
                          />
                          <Input
                            size="sm"
                            type="number"
                            label="Rate (₵)"
                            placeholder="0.00"
                            value={rateForm.rates[type.key as keyof typeof rateForm.rates]?.rate?.toString() || '0'}
                            onValueChange={(value) => {
                              setRateForm({
                                ...rateForm,
                                rates: {
                                  ...rateForm.rates,
                                  [type.key]: {
                                    ...rateForm.rates[type.key as keyof typeof rateForm.rates],
                                    rate: parseFloat(value) || 0
                                  }
                                }
                              });
                            }}
                            isInvalid={!!rateErrors[`rate_${type.key}`]}
                            errorMessage={rateErrors[`rate_${type.key}`]}
                            startContent={<span className="text-xs text-gray-400">₵</span>}
                          />
                          <Select
                            size="sm"
                            label="Unit"
                            selectedKeys={[rateForm.rates[type.key as keyof typeof rateForm.rates]?.unit || type.defaultUnit]}
                            onSelectionChange={(keys) => {
                              const unit = Array.from(keys)[0] as string;
                              setRateForm({
                                ...rateForm,
                                rates: {
                                  ...rateForm.rates,
                                  [type.key]: {
                                    ...rateForm.rates[type.key as keyof typeof rateForm.rates],
                                    unit: unit
                                  }
                                }
                              });
                            }}
                          >
                            <SelectItem key="per_person">Per Person</SelectItem>
                            <SelectItem key="per_room">Per Room</SelectItem>
                            <SelectItem key="per_event">Per Event</SelectItem>
                            <SelectItem key="per_day">Per Day</SelectItem>
                          </Select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {rateErrors.selectedTypes && (
                  <p className="text-sm text-danger">{rateErrors.selectedTypes}</p>
                )}
              </div>

              {/* Effective Period */}
              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                <div>
                  <p className="text-sm font-semibold text-ghana-black">Effective Period</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    The rate only auto-applies to events whose dates overlap this period.
                  </p>
                </div>
                <Switch
                  isSelected={rateForm.applicableDates.isAllYear}
                  onValueChange={(checked) => {
                    const year = new Date().getFullYear();
                    setRateForm({
                      ...rateForm,
                      applicableDates: {
                        ...rateForm.applicableDates,
                        isAllYear: checked,
                        startDate: checked ? '' : rateForm.applicableDates.startDate || `${year}-01-01`,
                        endDate: checked ? '' : rateForm.applicableDates.endDate || `${year}-12-31`,
                      },
                    });
                  }}
                >
                  <span className="font-medium">Always effective (all year)</span>
                </Switch>
                {!rateForm.applicableDates.isAllYear && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Effective from"
                      type="date"
                      value={rateForm.applicableDates.startDate}
                      onValueChange={(value) => {
                        setRateForm({
                          ...rateForm,
                          applicableDates: { ...rateForm.applicableDates, startDate: value },
                        });
                      }}
                      isRequired
                      isInvalid={!!rateErrors.startDate}
                      errorMessage={rateErrors.startDate}
                    />
                    <Input
                      label="Effective to"
                      type="date"
                      value={rateForm.applicableDates.endDate}
                      onValueChange={(value) => {
                        setRateForm({
                          ...rateForm,
                          applicableDates: { ...rateForm.applicableDates, endDate: value },
                        });
                      }}
                      isRequired
                      isInvalid={!!rateErrors.endDate}
                      errorMessage={rateErrors.endDate}
                    />
                  </div>
                )}
              </div>

              {/* Client-Specific Rate */}
              <div className="space-y-2">
                <Switch
                  isSelected={rateForm.clientSpecific}
                  onValueChange={(checked) => {
                    setRateForm({
                      ...rateForm,
                      clientSpecific: checked,
                      clientId: checked ? rateForm.clientId : '',
                      clientName: checked ? rateForm.clientName : ''
                    });
                  }}
                >
                  <span className="font-medium">Client-Specific Rate</span>
                </Switch>
                {rateForm.clientSpecific && (
                  <Autocomplete
                    label="Select Guest/Company"
                    placeholder="Type at least 2 characters to search..."
                    selectedKey={rateForm.clientId || null}
                    onSelectionChange={(key) => {
                      if (key && typeof key === 'string') {
                        if (key.startsWith('custom:')) {
                          const customName = key.replace('custom:', '');
                          setRateForm({
                            ...rateForm,
                            clientId: '',
                            clientName: customName
                          });
                        } else {
                          const g = eventsScreen.frontOfficeGuests.find((c: any) => c.id === key);
                          if (g) {
                            const org = g.employerCompany || (g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim());
                            setRateForm({
                              ...rateForm,
                              clientId: g.id,
                              clientName: org
                            });
                          }
                        }
                      }
                    }}
                    inputValue={rateForm.clientName}
                    onInputChange={(value) => {
                      setRateForm({ ...rateForm, clientName: value, clientId: '' });
                    }}
                    isInvalid={!!rateErrors.clientId}
                    errorMessage={rateErrors.clientId}
                    className="ml-6"
                    allowsCustomValue
                  >
                    {(() => {
                      const q = (rateForm.clientName || '').trim();
                      const guests = eventsScreen.frontOfficeGuests || [];
                      const results = q.length >= 2
                        ? guests.filter((g: any) => {
                            if (g.isActive === false) return false;
                            const org = (g.employerCompany || '').toLowerCase();
                            const name = (g.name || `${g.firstName || ''} ${g.lastName || ''}`).toLowerCase();
                            const phone = (g.companyPhone || g.phone || '').toLowerCase();
                            return org.includes(q.toLowerCase()) || name.includes(q.toLowerCase()) || phone.includes(q.toLowerCase());
                          }).slice(0, 20)
                        : [];
                      return q.length >= 2 ? (
                        <>
                          <AutocompleteItem key={`custom:${q}`} textValue={q}>
                            <div className="flex justify-between items-center w-full">
                              <span className="font-medium">Use "{q}"</span>
                              <span className="text-xs text-gray-500">Click to confirm</span>
                            </div>
                          </AutocompleteItem>
                          {results.map((g: any) => {
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
                )}
              </div>

              {/* Active Status */}
              <Switch
                isSelected={rateForm.isActive}
                onValueChange={(checked) => setRateForm({ ...rateForm, isActive: checked })}
              >
                <span className="font-medium">Active</span>
              </Switch>

              {/* Notes */}
              <Textarea
                label="Notes"
                placeholder="Additional notes about this rate..."
                value={rateForm.notes}
                onValueChange={(value) => setRateForm({ ...rateForm, notes: value })}
                minRows={3}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => {
                setIsRateModalOpen(false);
                setEditingRate(null);
                setRateErrors({});
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSaveRate}
            >
              {editingRate 
                ? 'Update Rate' 
                : rateForm.selectedTypes.length > 1 
                  ? `Create ${rateForm.selectedTypes.length} Rates` 
                  : 'Create Rate'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
