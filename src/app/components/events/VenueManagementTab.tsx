'use client';

import { Badge, Button, Card, CardBody, CardHeader, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import EventsModuleFilters from '../EventsModuleFilters';
import { VenueStatus } from './eventShared';
import { deskTableCardBodyClassName, deskTableCardClassName } from '../dashboard/deskTableUi';
import { worksheetTableClassNames } from '../frontoffice/StayWorksheetTable';
import { useEventsScreen } from './eventsScreenContext';

/** Events → Venue Management. The venue list on the venues tab. */
export function VenueManagementTab() {
  const eventsScreen = useEventsScreen();
  return (
  <>

                <div className="space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-ghana-black">Venue Management</h3>
                    <Button 
                      color="success" 
                      variant="solid"
                      onClick={() => eventsScreen.openVenueModal(null)}
                    >
                      ➕ New Venue
                    </Button>
                  </div>

                  <EventsModuleFilters
                    searchTerm={eventsScreen.venueSearchTerm}
                    onSearchChange={eventsScreen.setVenueSearchTerm}
                    searchPlaceholder="Search venues by name, type, or location..."
                    statusFilter={eventsScreen.venueStatusFilter}
                    onStatusChange={eventsScreen.setVenueStatusFilter}
                    statusOptions={[
                      { key: 'all', label: 'All Statuses' },
                      { key: 'available', label: 'Available' },
                      { key: 'booked', label: 'Booked' },
                      { key: 'setup', label: 'Setup' },
                      { key: 'maintenance', label: 'Maintenance' },
                      { key: 'inactive', label: 'Inactive' },
                    ]}
                    showDateFilter={false}
                  />

                  {/* Venues Table */}
                  <Card className={deskTableCardClassName}>
                    <CardHeader className="px-3 pb-0">
                      <h4 className="font-semibold">All Venues ({eventsScreen.filteredModernVenues.length})</h4>
                    </CardHeader>
                    <CardBody className={deskTableCardBodyClassName}>
                      <Table
                        aria-label="Venues table"
                        removeWrapper
                        classNames={{
                          ...worksheetTableClassNames,
                          base: 'max-w-full overflow-x-auto',
                          table: 'w-full min-w-max',
                        }}
                      >
                        <TableHeader>
                          <TableColumn>Venue</TableColumn>
                          <TableColumn>Type</TableColumn>
                          <TableColumn>Capacity</TableColumn>
                          <TableColumn>Price/Day</TableColumn>
                          <TableColumn>Status</TableColumn>
                          <TableColumn>Features</TableColumn>
                          <TableColumn>Actions</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {eventsScreen.filteredModernVenues.map((venue) => (
                            <TableRow
                              key={venue.id}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => eventsScreen.openVenueModal(venue)}
                            >
                              <TableCell className="whitespace-normal">
                                <div className="min-w-[14rem]">
                                  <p className="font-medium leading-5">{venue.name}</p>
                                  <p className="text-sm leading-5 text-gray-600">{venue.location}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Chip size="sm" variant="flat" color="primary" className="capitalize">
                                  {venue.type}
                                </Chip>
                              </TableCell>
                              <TableCell>
                                <Chip size="sm" variant="flat" color="primary">
                                  {venue.capacity} people
                                </Chip>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">₵{(venue.basePrice || 0).toLocaleString()}</span>
                              </TableCell>
                              <TableCell>
                                <Badge color={eventsScreen.getStatusColor(venue.status) as any} variant="flat">
                                  {venue.status === 'inactive' ? 'Inactive' : venue.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {venue.features.slice(0, 2).map((feature, index) => (
                                    <Chip key={index} size="sm" variant="flat" color="secondary">
                                      {feature}
                                    </Chip>
                                  ))}
                                  {venue.features.length > 2 && (
                                    <Chip size="sm" variant="flat" color="default">
                                      +{venue.features.length - 2} more
                                    </Chip>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                                  {eventsScreen.getEventsUsingVenue(venue).length > 0 ? (
                                    venue.status === 'inactive' ? (
                                      <Button size="sm" variant="flat" isDisabled>
                                        In use
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        color="warning"
                                        variant="flat"
                                        onClick={() => eventsScreen.handleDeleteVenue(venue)}
                                      >
                                        Deactivate
                                      </Button>
                                    )
                                  ) : (
                                    <Button
                                      size="sm"
                                      color="danger"
                                      variant="flat"
                                      onClick={() => eventsScreen.handleDeleteVenue(venue)}
                                    >
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardBody>
                  </Card>
                </div>

  </>
  );
}

/** Events → new or edit venue dialog. */
export function VenueModal() {
  const eventsScreen = useEventsScreen();
  return (
  <>
        <Modal isOpen={eventsScreen.isVenueModalOpen} onClose={eventsScreen.closeVenueModal} size="2xl">
          <ModalContent>
            <ModalHeader>
              {eventsScreen.editingVenue?.id ? 'Edit Venue' : 'Create New Venue'}
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Venue Name"
                  placeholder="Enter venue name"
                  value={eventsScreen.venueForm.name}
                  onValueChange={(value) => eventsScreen.handleVenueFieldChange('name', value)}
                />
                <Select
                  label="Venue Type"
                  placeholder="Select venue type"
                  selectedKeys={[eventsScreen.venueForm.type]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string | undefined;
                    if (value) eventsScreen.handleVenueFieldChange('type', value);
                  }}
                >
                  <SelectItem key="conference">Conference Hall</SelectItem>
                  <SelectItem key="meeting">Meeting Room</SelectItem>
                  <SelectItem key="banquet">Banquet Hall</SelectItem>
                  <SelectItem key="auditorium">Auditorium</SelectItem>
                </Select>
                <Input
                  label="Capacity"
                  type="number"
                  placeholder="Number of people"
                  value={eventsScreen.venueForm.capacity}
                  onValueChange={(value) => eventsScreen.handleVenueFieldChange('capacity', value)}
                />
                <Input
                  label="Price per Day"
                  type="number"
                  placeholder="Daily rate"
                  value={eventsScreen.venueForm.basePrice}
                  onValueChange={(value) => eventsScreen.handleVenueFieldChange('basePrice', value)}
                />
                <Input
                  label="Location"
                  placeholder="Venue location"
                  value={eventsScreen.venueForm.location}
                  onValueChange={(value) => eventsScreen.handleVenueFieldChange('location', value)}
                />
                <Select
                  label="Status"
                  placeholder="Select status"
                  selectedKeys={[eventsScreen.venueForm.status]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as VenueStatus | undefined;
                    if (value) eventsScreen.handleVenueFieldChange('status', value);
                  }}
                >
                  <SelectItem key="available">Available</SelectItem>
                  <SelectItem key="booked">Booked</SelectItem>
                  <SelectItem key="setup">Setup</SelectItem>
                  <SelectItem key="maintenance">Maintenance</SelectItem>
                  <SelectItem key="inactive">Inactive</SelectItem>
                </Select>
              </div>
              <Textarea
                label="Features"
                placeholder="Venue features (one per line)"
                className="mt-4"
                value={eventsScreen.venueForm.featuresInput}
                onValueChange={(value) => eventsScreen.handleVenueFieldChange('featuresInput', value)}
              />
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="flat" onPress={eventsScreen.closeVenueModal}>
                Cancel
              </Button>
              <Button color="primary" onPress={eventsScreen.handleVenueSubmit}>
                {eventsScreen.editingVenue?.id ? 'Update Venue' : 'Create Venue'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

  </>
  );
}
