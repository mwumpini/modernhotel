"use client";

import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../../components/PageLayout';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Tabs,
  Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Select,
  SelectItem,
  Badge,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Divider
} from "@heroui/react";
import { enhancedFrontOfficeStore } from '../../lib/frontoffice/enhancedStore';
import { trackEvent } from '../../lib/analytics/trackEvent';

const formatCurrency = (value: number) =>
  `₵${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ConfirmedEvent {
  id: string;
  eventName: string;
  organization: string;
  startDate: string;
  endDate: string;
  venueName: string;
  expectedPax: number;
  budgetTotal: number;
  actualTotal?: number;
  variance?: number;
  status: 'confirmed' | 'in-progress' | 'completed' | 'billed';
  actualCosts?: {
    accommodation: number;
    conference: number;
    dinner: number;
    lunch: number;
    extras: number;
    notes?: string;
    updatedAt?: string;
  };
  dailySchedule?: any[];
  residential?: boolean;
  roomRate?: number;
  conferenceRate?: number;
  lunchRate?: number;
  dinnerRate?: number;
  ratesByParticulars?: boolean;
}

interface ConfirmedEventsManagementProps {
  activeTab: string;
}

function ConfirmedEventsManagement({ activeTab }: ConfirmedEventsManagementProps) {
  const [events, setEvents] = useState<ConfirmedEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<ConfirmedEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<ConfirmedEvent | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isActualsModalOpen, setIsActualsModalOpen] = useState(false);
  const [actualCosts, setActualCosts] = useState({
    accommodation: 0,
    conference: 0,
    dinner: 0,
    lunch: 0,
    extras: 0,
    notes: ''
  });
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(10);

  // Load confirmed events
  useEffect(() => {
    loadConfirmedEvents();
  }, []);

  const loadConfirmedEvents = () => {
    // Get all events from the store and filter for confirmed ones
    const allEvents = enhancedFrontOfficeStore.eventBookings || [];
    const confirmed = allEvents
      .filter((evt: any) => evt.status === 'confirmed' || evt.status === 'in-progress')
      .map((evt: any) => {
        const budget = calculateBudget(evt);
        const actuals = evt.actualCosts || {};
        const actualTotal = (actuals.accommodation || 0) + (actuals.conference || 0) + 
                          (actuals.dinner || 0) + (actuals.lunch || 0) + (actuals.extras || 0);
        const budgetTotal = budget.accommodation + budget.conference + budget.dinner + budget.lunch + budget.extras;
        
        return {
          id: evt.id,
          eventName: evt.eventName || 'Unnamed Event',
          organization: evt.corporateClientName || 'Unknown',
          startDate: evt.startDate,
          endDate: evt.endDate,
          venueName: evt.resources?.[0]?.resourceId || 'Unassigned',
          expectedPax: evt.attendees || 0,
          budgetTotal,
          actualTotal: actualTotal > 0 ? actualTotal : undefined,
          variance: actualTotal > 0 ? actualTotal - budgetTotal : undefined,
          status: determineEventStatus(evt.startDate, evt.endDate, actualTotal),
          actualCosts: actuals,
          dailySchedule: evt.dailySchedule,
          residential: evt.eventType?.includes('residential'),
          roomRate: evt.roomRate,
          conferenceRate: evt.conferenceRate,
          lunchRate: evt.lunchRate,
          dinnerRate: evt.dinnerRate,
          ratesByParticulars: evt.ratesByParticulars
        };
      });
    
    setEvents(confirmed);
    setFilteredEvents(confirmed);
  };

  const calculateBudget = (event: any) => {
    const schedule = event.dailySchedule || [];
    let accommodation = 0;
    let conference = 0;
    let dinner = 0;
    let lunch = 0;
    let extras = 0;

    schedule.forEach((day: any) => {
      if (event.residential && day.rooms) {
        accommodation += (day.rooms || 0) * (event.roomRate || 0);
      }
      if (event.ratesByParticulars) {
        conference += (day.conferencePax || 0) * (event.conferenceRate || 0);
        lunch += (day.lunchPax || 0) * (event.lunchRate || 0);
        dinner += (day.dinnerPax || 0) * (event.dinnerRate || 0);
      } else {
        conference += (day.conferencePax || 0) * (day.rate || 0);
        lunch += (day.lunchPax || 0) * (event.lunchRate || 0);
        dinner += (day.dinnerPax || 0) * (event.dinnerRate || 0);
      }
      (day.extraLines || []).forEach((extra: any) => {
        extras += (extra.qty || 0) * (extra.unitPrice || 0);
      });
    });

    return { accommodation, conference, dinner, lunch, extras };
  };

  const determineEventStatus = (startDate: string, endDate: string, actualTotal?: number): 'confirmed' | 'in-progress' | 'completed' | 'billed' => {
    const today = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (today < start) return 'confirmed';
    if (today >= start && today <= end) return 'in-progress';
    if (today > end && !actualTotal) return 'completed';
    return 'billed';
  };

  // Filter events based on search and status
  useEffect(() => {
    let filtered = events;

    if (activeTab === 'active') {
      filtered = filtered.filter(e => e.status === 'confirmed' || e.status === 'in-progress');
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(e => e.status === 'completed' || e.status === 'billed');
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e => 
        e.eventName.toLowerCase().includes(term) ||
        e.organization.toLowerCase().includes(term) ||
        e.venueName.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }

    setFilteredEvents(filtered);
  }, [events, searchTerm, statusFilter, activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'primary';
      case 'in-progress': return 'warning';
      case 'completed': return 'success';
      case 'billed': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'in-progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'billed': return 'Billed';
      default: return status;
    }
  };

  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredEvents.slice(start, start + rowsPerPage);
  }, [filteredEvents, page, rowsPerPage]);

  const openEventDetails = (event: ConfirmedEvent) => {
    setSelectedEvent(event);
    setIsDetailsModalOpen(true);
  };

  const openActualsTracking = (event: ConfirmedEvent) => {
    setSelectedEvent(event);
    setActualCosts({
      accommodation: event.actualCosts?.accommodation || 0,
      conference: event.actualCosts?.conference || 0,
      dinner: event.actualCosts?.dinner || 0,
      lunch: event.actualCosts?.lunch || 0,
      extras: event.actualCosts?.extras || 0,
      notes: event.actualCosts?.notes || ''
    });
    setIsActualsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-200">
          <CardBody className="p-4">
            <p className="text-sm text-gray-600 mb-1">Total Confirmed</p>
            <p className="text-2xl font-bold text-blue-700">
              {events.filter(e => e.status === 'confirmed' || e.status === 'in-progress').length}
            </p>
          </CardBody>
        </Card>
        <Card className="border-2 border-green-200">
          <CardBody className="p-4">
            <p className="text-sm text-gray-600 mb-1">In Progress</p>
            <p className="text-2xl font-bold text-green-700">
              {events.filter(e => e.status === 'in-progress').length}
            </p>
          </CardBody>
        </Card>
        <Card className="border-2 border-orange-200">
          <CardBody className="p-4">
            <p className="text-sm text-gray-600 mb-1">Ready for Billing</p>
            <p className="text-2xl font-bold text-orange-700">
              {events.filter(e => e.status === 'completed').length}
            </p>
          </CardBody>
        </Card>
        <Card className="border-2 border-purple-200">
          <CardBody className="p-4">
            <p className="text-sm text-gray-600 mb-1">Total Budget</p>
            <p className="text-2xl font-bold text-purple-700">
              {formatCurrency(events.reduce((sum, e) => sum + e.budgetTotal, 0))}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Search by event name, organization, or venue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
              startContent={<span className="text-gray-400">🔍</span>}
            />
            <Select
              placeholder="Filter by status"
              selectedKeys={statusFilter !== 'all' ? [statusFilter] : []}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string;
                setStatusFilter(value || 'all');
              }}
              className="w-full sm:w-48"
            >
              <SelectItem key="all">All Statuses</SelectItem>
              <SelectItem key="confirmed">Confirmed</SelectItem>
              <SelectItem key="in-progress">In Progress</SelectItem>
              <SelectItem key="completed">Completed</SelectItem>
              <SelectItem key="billed">Billed</SelectItem>
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <h3 className="text-lg font-semibold">
              {activeTab === 'active' ? 'Active Events' : 'Completed Events'}
            </h3>
            <Badge content={filteredEvents.length} color="primary">
              <span className="text-sm text-gray-600">Total Events</span>
            </Badge>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Confirmed events table">
            <TableHeader>
              <TableColumn>EVENT</TableColumn>
              <TableColumn>ORGANIZATION</TableColumn>
              <TableColumn>DATES</TableColumn>
              <TableColumn>VENUE</TableColumn>
              <TableColumn>PAX</TableColumn>
              <TableColumn>BUDGET</TableColumn>
              <TableColumn>ACTUAL</TableColumn>
              <TableColumn>VARIANCE</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {paginatedEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                    <div>
                      <span className="text-4xl">📅</span>
                      <p className="mt-2">No {activeTab === 'active' ? 'active' : 'completed'} events found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{event.eventName}</p>
                        <p className="text-xs text-gray-500">ID: {event.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>{event.organization}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{new Date(event.startDate).toLocaleDateString()}</p>
                        <p className="text-gray-500">to {new Date(event.endDate).toLocaleDateString()}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge color="secondary" variant="flat">{event.venueName}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{event.expectedPax}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(event.budgetTotal)}</TableCell>
                    <TableCell>
                      {event.actualTotal ? (
                        <span className="font-semibold">{formatCurrency(event.actualTotal)}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">Not tracked</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {event.variance !== undefined ? (
                        <span className={event.variance >= 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                          {event.variance >= 0 ? '+' : ''}{formatCurrency(event.variance)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip color={getStatusColor(event.status) as any} size="sm" variant="flat">
                        {getStatusLabel(event.status)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          color="default"
                          variant="flat"
                          onPress={() => openEventDetails(event)}
                        >
                          View
                        </Button>
                        {event.status !== 'billed' && (
                          <Button
                            size="sm"
                            color="success"
                            variant="flat"
                            onPress={() => openActualsTracking(event)}
                          >
                            💰 Track
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Event Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedEvent(null);
        }}
        size="4xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <div>
              <h3 className="text-lg font-semibold">Event Details</h3>
              <p className="text-sm text-gray-600">{selectedEvent?.eventName}</p>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedEvent && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Organization</p>
                    <p className="font-medium">{selectedEvent.organization}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Venue</p>
                    <p className="font-medium">{selectedEvent.venueName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Start Date</p>
                    <p className="font-medium">{new Date(selectedEvent.startDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">End Date</p>
                    <p className="font-medium">{new Date(selectedEvent.endDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Expected Pax</p>
                    <p className="font-medium">{selectedEvent.expectedPax}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Chip color={getStatusColor(selectedEvent.status) as any} size="sm">
                      {getStatusLabel(selectedEvent.status)}
                    </Chip>
                  </div>
                </div>
                <Divider />
                <div>
                  <h4 className="font-semibold mb-2">Budget Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Budget Total</p>
                      <p className="font-semibold text-lg">{formatCurrency(selectedEvent.budgetTotal)}</p>
                    </div>
                    {selectedEvent.actualTotal && (
                      <>
                        <div>
                          <p className="text-gray-600">Actual Total</p>
                          <p className="font-semibold text-lg">{formatCurrency(selectedEvent.actualTotal)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Variance</p>
                          <p className={`font-semibold text-lg ${selectedEvent.variance && selectedEvent.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {selectedEvent.variance && selectedEvent.variance >= 0 ? '+' : ''}{formatCurrency(selectedEvent.variance || 0)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsDetailsModalOpen(false)}>Close</Button>
            {selectedEvent && selectedEvent.status !== 'billed' && (
              <Button
                color="primary"
                onPress={() => {
                  setIsDetailsModalOpen(false);
                  openActualsTracking(selectedEvent);
                }}
              >
                Track Actual Costs
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Actuals Tracking Modal */}
      <Modal
        isOpen={isActualsModalOpen}
        onClose={() => {
          setIsActualsModalOpen(false);
          setSelectedEvent(null);
        }}
        size="4xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <div>
                <h3 className="text-lg font-semibold">Track Actual Costs vs Budget</h3>
                <p className="text-sm text-gray-600">
                  {selectedEvent?.eventName} • {selectedEvent?.organization}
                </p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="py-6">
            {selectedEvent && (
              <ActualsTrackingForm
                event={selectedEvent}
                actualCosts={actualCosts}
                onActualCostsChange={setActualCosts}
              />
            )}
          </ModalBody>
          <ModalFooter>
            {selectedEvent && (
              <>
                <Button
                  color="default"
                  variant="flat"
                  onPress={() => {
                    setIsActualsModalOpen(false);
                    setSelectedEvent(null);
                    setActualCosts({
                      accommodation: 0,
                      conference: 0,
                      dinner: 0,
                      lunch: 0,
                      extras: 0,
                      notes: ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={() => {
                    const actuals = {
                      ...actualCosts,
                      updatedAt: new Date().toISOString()
                    };
                    
                    // Update the event with actual costs
                    const updatedEvent = {
                      ...selectedEvent,
                      actualCosts: actuals,
                      actualTotal: actuals.accommodation + actuals.conference + actuals.dinner + actuals.lunch + actuals.extras,
                      variance: (actuals.accommodation + actuals.conference + actuals.dinner + actuals.lunch + actuals.extras) - selectedEvent.budgetTotal
                    };
                    
                    // Update in local state
                    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
                    
                    // Update in store
                    enhancedFrontOfficeStore.updateEventBooking(selectedEvent.id, {
                      actualCosts: actuals
                    } as any);
                    
                    trackEvent('Events.ActualCostsUpdated', {
                      eventId: selectedEvent.id,
                      variance: updatedEvent.variance
                    });
                    
                    setIsActualsModalOpen(false);
                    setSelectedEvent(null);
                    setActualCosts({
                      accommodation: 0,
                      conference: 0,
                      dinner: 0,
                      lunch: 0,
                      extras: 0,
                      notes: ''
                    });
                    loadConfirmedEvents(); // Reload to refresh data
                  }}
                >
                  Save Actual Costs
                </Button>
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// Actuals Tracking Form Component
interface ActualsTrackingFormProps {
  event: ConfirmedEvent;
  actualCosts: any;
  onActualCostsChange: (costs: any) => void;
}

function ActualsTrackingForm({ event, actualCosts, onActualCostsChange }: ActualsTrackingFormProps) {

  const budget = useMemo(() => {
    const schedule = event.dailySchedule || [];
    let accommodation = 0;
    let conference = 0;
    let dinner = 0;
    let lunch = 0;
    let extras = 0;

    schedule.forEach((day: any) => {
      if (event.residential && day.rooms) {
        accommodation += (day.rooms || 0) * (event.roomRate || 0);
      }
      if (event.ratesByParticulars) {
        conference += (day.conferencePax || 0) * (event.conferenceRate || 0);
        lunch += (day.lunchPax || 0) * (event.lunchRate || 0);
        dinner += (day.dinnerPax || 0) * (event.dinnerRate || 0);
      } else {
        conference += (day.conferencePax || 0) * (day.rate || 0);
        lunch += (day.lunchPax || 0) * (event.lunchRate || 0);
        dinner += (day.dinnerPax || 0) * (event.dinnerRate || 0);
      }
      (day.extraLines || []).forEach((extra: any) => {
        extras += (extra.qty || 0) * (extra.unitPrice || 0);
      });
    });

    return { accommodation, conference, dinner, lunch, extras };
  }, [event]);

  const budgetTotal = budget.accommodation + budget.conference + budget.dinner + budget.lunch + budget.extras;
  const actualTotal = actualCosts.accommodation + actualCosts.conference + actualCosts.dinner + actualCosts.lunch + actualCosts.extras;
  const variance = actualTotal - budgetTotal;
  const variancePercent = budgetTotal > 0 ? ((variance / budgetTotal) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardBody className="p-4">
            <p className="text-sm text-gray-600 mb-1">Budgeted Total</p>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(budgetTotal)}</p>
          </CardBody>
        </Card>
        <Card className={`border-2 ${variance >= 0 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}`}>
          <CardBody className="p-4">
            <p className="text-sm text-gray-600 mb-1">Actual Total</p>
            <p className={`text-2xl font-bold ${variance >= 0 ? 'text-orange-700' : 'text-green-700'}`}>
              {formatCurrency(actualTotal)}
            </p>
          </CardBody>
        </Card>
        <Card className={`border-2 ${variance >= 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <CardBody className="p-4">
            <p className="text-sm text-gray-600 mb-1">Variance</p>
            <p className={`text-2xl font-bold ${variance >= 0 ? 'text-red-700' : 'text-green-700'}`}>
              {variance >= 0 ? '+' : ''}{formatCurrency(variance)} ({variancePercent}%)
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Budget vs Actual Comparison Table */}
      <div>
        <h4 className="font-semibold text-lg mb-4">Cost Breakdown Comparison</h4>
        <Table aria-label="Budget vs Actual comparison">
          <TableHeader>
            <TableColumn>Category</TableColumn>
            <TableColumn>Budgeted (₵)</TableColumn>
            <TableColumn>Actual (₵)</TableColumn>
            <TableColumn>Variance (₵)</TableColumn>
            <TableColumn>% Variance</TableColumn>
          </TableHeader>
          <TableBody>
            {[
              ...[
              { key: 'accommodation', label: 'Accommodation & Breakfast', budget: budget.accommodation, actual: actualCosts.accommodation },
              { key: 'conference', label: 'Conference', budget: budget.conference, actual: actualCosts.conference },
              { key: 'dinner', label: 'Dinner', budget: budget.dinner, actual: actualCosts.dinner },
              { key: 'lunch', label: 'Lunch', budget: budget.lunch, actual: actualCosts.lunch },
              { key: 'extras', label: 'Extra Services', budget: budget.extras, actual: actualCosts.extras }
            ].map((item) => {
              const itemVariance = item.actual - item.budget;
              const itemVariancePercent = item.budget > 0 ? ((itemVariance / item.budget) * 100).toFixed(1) : '0.0';
              return (
                <TableRow key={item.key}>
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell>{formatCurrency(item.budget)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 text-sm">₵</span>
                      <Input
                        size="sm"
                        type="number"
                        value={String(item.actual)}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value || '0') || 0;
                          onActualCostsChange({ ...actualCosts, [item.key]: value });
                        }}
                        className="w-32"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={itemVariance >= 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                      {itemVariance >= 0 ? '+' : ''}{formatCurrency(itemVariance)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={itemVariance >= 0 ? 'text-red-600' : 'text-green-600'}>
                      {itemVariance >= 0 ? '+' : ''}{itemVariancePercent}%
                    </span>
                  </TableCell>
                </TableRow>
              );
            }),
            <TableRow key="__total" className="bg-gray-50 font-semibold">
              <TableCell>TOTAL</TableCell>
              <TableCell>{formatCurrency(budgetTotal)}</TableCell>
              <TableCell>{formatCurrency(actualTotal)}</TableCell>
              <TableCell>
                <span className={variance >= 0 ? 'text-red-600' : 'text-green-600'}>
                  {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                </span>
              </TableCell>
              <TableCell>
                <span className={variance >= 0 ? 'text-red-600' : 'text-green-600'}>
                  {variance >= 0 ? '+' : ''}{variancePercent}%
                </span>
              </TableCell>
            </TableRow>,
            ]}
          </TableBody>
        </Table>
      </div>

      {/* Notes Section */}
      <div>
        <Textarea
          label="Notes & Adjustments"
          placeholder="Add notes about actual costs, reasons for variances, or adjustments made..."
          value={actualCosts.notes}
          onChange={(e) => onActualCostsChange({ ...actualCosts, notes: e.target.value })}
          minRows={4}
        />
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Actual costs will be used when generating the final invoice. 
          Update these values as the event progresses to ensure accurate billing.
        </p>
      </div>
    </div>
  );
}

export default function ConfirmedEventsPage() {
  const [activeTab, setActiveTab] = useState('active');

  return (
    <PageLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-ghana-black">✅ Confirmed Events Management</h1>
          <p className="text-gray-600 mt-2">
            Track actual costs, make adjustments, and finalize billing for confirmed events
          </p>
        </div>

        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          className="w-full"
        >
          <Tab key="active" title="🟢 Active Events">
            <ConfirmedEventsManagement activeTab={activeTab} />
          </Tab>
          <Tab key="completed" title="✅ Completed Events">
            <ConfirmedEventsManagement activeTab={activeTab} />
          </Tab>
        </Tabs>
      </div>
    </PageLayout>
  );
}

