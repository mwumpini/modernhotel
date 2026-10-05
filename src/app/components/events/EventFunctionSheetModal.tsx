'use client';

import { BEO_ACCESS, BEO_INTERNET, BEO_LAYOUTS, BEO_LIGHTING, BEO_MEAL_TYPES, BEO_PARKING, BEO_SERVICE_STYLES, BeoPick, UNASSIGNED_STAFF, formatEventTableRange } from './eventShared';
import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Switch, Tab, Tabs, Textarea } from '@heroui/react';
import { useEventsScreen } from './eventsScreenContext';

/** Events → service dialog and the function sheet (BEO). */
export function EventFunctionSheetModal() {
  const eventsScreen = useEventsScreen();
  return (
  <>
        {/* Service Modal */}
        <Modal isOpen={eventsScreen.isServiceModalOpen} onClose={() => eventsScreen.setIsServiceModalOpen(false)} size="2xl">
          <ModalContent>
            <ModalHeader>
              {eventsScreen.editingService?.id ? 'Edit Service' : 'Create New Service'}
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Service Name"
                  placeholder="Enter service name"
                  defaultValue={eventsScreen.editingService?.name || ''}
                />
                <Select label="Category" placeholder="Select category">
                  <SelectItem key="catering">Catering</SelectItem>
                  <SelectItem key="av">Audio Visual</SelectItem>
                  <SelectItem key="decoration">Decoration</SelectItem>
                  <SelectItem key="transport">Transportation</SelectItem>
                </Select>
                <Input
                  label="Price"
                  type="number"
                  placeholder="Service price"
                  defaultValue={eventsScreen.editingService?.price || ''}
                />
                <Input
                  label="Minimum Notice"
                  placeholder="e.g., 24 hours"
                  defaultValue={eventsScreen.editingService?.minNotice || ''}
                />
                <Select label="Availability" placeholder="Select availability">
                  <SelectItem key="daily">Daily</SelectItem>
                  <SelectItem key="weekdays">Weekdays Only</SelectItem>
                  <SelectItem key="weekends">Weekends Only</SelectItem>
                  <SelectItem key="custom">Custom Schedule</SelectItem>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch defaultSelected={eventsScreen.editingService?.status === 'active'} />
                  <span>Active Service</span>
                </div>
              </div>
              <Textarea
                label="Description"
                placeholder="Service description"
                className="mt-4"
                defaultValue={eventsScreen.editingService?.description || ''}
              />
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="flat" onPress={() => eventsScreen.setIsServiceModalOpen(false)}>
                Cancel
              </Button>
              <Button color="primary" onPress={eventsScreen.handleServiceSubmit}>
                {eventsScreen.editingService?.id ? 'Update Service' : 'Create Service'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
        <Modal
          isOpen={eventsScreen.isBEOModalOpen}
          onClose={() => eventsScreen.setIsBEOModalOpen(false)}
          size="5xl"
          scrollBehavior="inside"
          classNames={{
            base: 'max-h-[90vh]',
            header: 'px-6 py-3 border-b border-slate-200',
            body: 'px-6 py-4',
            footer: 'px-6 py-3 border-t border-slate-200',
          }}
        >
          <ModalContent>
            <ModalHeader className="flex flex-col items-start gap-1.5 pr-8">
              <h3 className="text-base font-semibold text-ghana-black">Function Sheet</h3>
              {eventsScreen.beoForm ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-ghana-black">{eventsScreen.beoForm.eventInfo.eventName || 'Untitled event'}</span>
                  {eventsScreen.beoForm.eventInfo.venueName ? (
                    <Chip size="sm" color="primary" variant="flat">{eventsScreen.beoForm.eventInfo.venueName}</Chip>
                  ) : null}
                  <Chip size="sm" color="success" variant="flat">
                    {formatEventTableRange(eventsScreen.beoForm.eventInfo.arrivalDate, eventsScreen.beoForm.eventInfo.departureDate)}
                  </Chip>
                  {eventsScreen.beoForm.eventInfo.pax ? (
                    <Chip size="sm" color="warning" variant="flat">{eventsScreen.beoForm.eventInfo.pax} pax</Chip>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs font-normal text-slate-500">Operational order for this event</p>
              )}
            </ModalHeader>
            <ModalBody>
              {eventsScreen.beoForm ? (
                <form
                  id="beoForm"
                  onSubmit={(e) => {
                    e.preventDefault();
                    eventsScreen.handleSaveBeoForm();
                  }}
                >
                  <Tabs
                    selectedKey={eventsScreen.beoWorkspaceTab}
                    onSelectionChange={(key) => eventsScreen.setBeoWorkspaceTab(String(key))}
                    variant="underlined"
                    classNames={{
                      tabList: 'gap-6 w-full',
                      cursor: 'w-full bg-primary',
                      tab: 'h-8 px-0 text-sm',
                      tabContent: 'group-data-[selected=true]:text-primary',
                      panel: 'pt-4 min-h-[300px]',
                    }}
                  >
                    <Tab key="overview" title="Event">
                      <div className="space-y-5">
                        <div>
                          <p className="mb-2 text-xs font-semibold text-primary">Client</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input size="sm" label="Event" value={eventsScreen.beoForm.eventInfo.eventName} onChange={(e) => eventsScreen.updateBeoFormSection('eventInfo', 'eventName', e.target.value)} />
                            <Input size="sm" label="Organization" value={eventsScreen.beoForm.eventInfo.organization} onChange={(e) => eventsScreen.updateBeoFormSection('eventInfo', 'organization', e.target.value)} />
                            <Select
                              size="sm"
                              label="Coordinator"
                              placeholder="Assign coordinator"
                              selectedKeys={[eventsScreen.resolveCoordinatorValue(eventsScreen.beoForm.eventInfo.eventCoordinator)]}
                              onSelectionChange={(keys) => {
                                const selected = eventsScreen.resolveCoordinatorValue(Array.from(keys)[0] as string);
                                eventsScreen.updateBeoFormSection('eventInfo', 'eventCoordinator', selected === UNASSIGNED_STAFF ? '' : selected);
                              }}
                              items={eventsScreen.beoCoordinatorOptions}
                            >
                              {(option) => (
                                <SelectItem key={option.key} textValue={option.label}>
                                  {option.label}
                                </SelectItem>
                              )}
                            </Select>
                            <Input size="sm" label="Contact" value={eventsScreen.beoForm.eventInfo.contactPerson} onChange={(e) => eventsScreen.updateBeoFormSection('eventInfo', 'contactPerson', e.target.value)} />
                            <Input size="sm" label="Phone" value={eventsScreen.beoForm.eventInfo.contactPhone} onChange={(e) => eventsScreen.updateBeoFormSection('eventInfo', 'contactPhone', e.target.value)} />
                            <Input size="sm" label="Email" value={eventsScreen.beoForm.eventInfo.contactEmail} onChange={(e) => eventsScreen.updateBeoFormSection('eventInfo', 'contactEmail', e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold text-primary">Schedule</p>
                          <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
                            <Input className="md:col-span-4" size="sm" label="Venue" value={eventsScreen.beoForm.eventInfo.venueName} onChange={(e) => eventsScreen.updateBeoFormSection('eventInfo', 'venueName', e.target.value)} />
                            <Input className="md:col-span-2" size="sm" label="Start" type="date" value={eventsScreen.beoForm.eventInfo.arrivalDate} onChange={(e) => eventsScreen.updateBeoFormSection('eventInfo', 'arrivalDate', e.target.value)} />
                            <Input className="md:col-span-2" size="sm" label="End" type="date" value={eventsScreen.beoForm.eventInfo.departureDate} onChange={(e) => eventsScreen.updateBeoFormSection('eventInfo', 'departureDate', e.target.value)} />
                            <Input className="md:col-span-2" size="sm" label="Days" value={eventsScreen.beoForm.eventInfo.duration} onChange={(e) => eventsScreen.updateBeoFormSection('eventInfo', 'duration', e.target.value)} />
                            <Input className="md:col-span-2" size="sm" label="Pax" value={eventsScreen.beoForm.eventInfo.pax} onChange={(e) => eventsScreen.updateBeoFormSection('eventInfo', 'pax', e.target.value)} />
                          </div>
                        </div>
                        <Textarea size="sm" label="Coordinator notes" minRows={2} value={eventsScreen.beoForm.eventInfo.notes} onChange={(e) => eventsScreen.updateBeoFormSection('eventInfo', 'notes', e.target.value)} />
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-semibold text-primary">Special instructions</p>
                            <Button size="sm" variant="light" onPress={eventsScreen.handleAddBeoInstruction}>Add</Button>
                          </div>
                          <div className="space-y-2">
                            {eventsScreen.beoForm.instructions.map((instruction: string, idx: number) => (
                              <div key={`instruction-${idx}`} className="flex items-center gap-2">
                                <Input
                                  className="flex-1"
                                  size="sm"
                                  placeholder={`Instruction ${idx + 1}`}
                                  value={instruction}
                                  onChange={(e) => eventsScreen.updateBeoInstruction(idx, e.target.value)}
                                />
                                <Button size="sm" variant="light" color="danger" onPress={() => eventsScreen.handleRemoveBeoInstruction(idx)}>×</Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Tab>
                    <Tab key="setup" title="Setup">
                      <div className="space-y-5">
                        <div>
                          <p className="mb-2 text-xs font-semibold text-primary">Room</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <BeoPick label="Layout" value={eventsScreen.beoForm.room.layout} options={BEO_LAYOUTS} onChange={(value) => eventsScreen.updateBeoFormSection('room', 'layout', value)} />
                            <Input size="sm" label="Tables" value={eventsScreen.beoForm.room.tables} onChange={(e) => eventsScreen.updateBeoFormSection('room', 'tables', e.target.value)} />
                            <Input size="sm" label="Chairs" value={eventsScreen.beoForm.room.chairs} onChange={(e) => eventsScreen.updateBeoFormSection('room', 'chairs', e.target.value)} />
                            <Input size="sm" label="Capacity" value={eventsScreen.beoForm.room.capacity} onChange={(e) => eventsScreen.updateBeoFormSection('room', 'capacity', e.target.value)} />
                            <Input size="sm" label="Registration" value={eventsScreen.beoForm.room.registrationTable} onChange={(e) => eventsScreen.updateBeoFormSection('room', 'registrationTable', e.target.value)} />
                            <Input size="sm" label="Display" value={eventsScreen.beoForm.room.displayTable} onChange={(e) => eventsScreen.updateBeoFormSection('room', 'displayTable', e.target.value)} />
                            <BeoPick label="Access" value={eventsScreen.beoForm.room.access} options={BEO_ACCESS} onChange={(value) => eventsScreen.updateBeoFormSection('room', 'access', value)} placeholder="Filter access" />
                            <BeoPick label="Parking" value={eventsScreen.beoForm.room.parking} options={BEO_PARKING} onChange={(value) => eventsScreen.updateBeoFormSection('room', 'parking', value)} />
                          </div>
                          <Textarea className="mt-3" size="sm" label="Setup notes" minRows={2} value={eventsScreen.beoForm.room.setupNotes} onChange={(e) => eventsScreen.updateBeoFormSection('room', 'setupNotes', e.target.value)} />
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold text-primary">AV / Technical</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <Input size="sm" label="Projector" value={eventsScreen.beoForm.technical.projector} onChange={(e) => eventsScreen.updateBeoFormSection('technical', 'projector', e.target.value)} />
                            <Input size="sm" label="Screen" value={eventsScreen.beoForm.technical.screen} onChange={(e) => eventsScreen.updateBeoFormSection('technical', 'screen', e.target.value)} />
                            <Input size="sm" label="Sound" value={eventsScreen.beoForm.technical.soundSystem} onChange={(e) => eventsScreen.updateBeoFormSection('technical', 'soundSystem', e.target.value)} />
                            <Input size="sm" label="Microphones" value={eventsScreen.beoForm.technical.microphones} onChange={(e) => eventsScreen.updateBeoFormSection('technical', 'microphones', e.target.value)} />
                            <Input size="sm" label="Laptop" value={eventsScreen.beoForm.technical.laptop} onChange={(e) => eventsScreen.updateBeoFormSection('technical', 'laptop', e.target.value)} />
                            <BeoPick label="Internet" value={eventsScreen.beoForm.technical.internet} options={BEO_INTERNET} onChange={(value) => eventsScreen.updateBeoFormSection('technical', 'internet', value)} />
                            <BeoPick label="Lighting" value={eventsScreen.beoForm.technical.lighting} options={BEO_LIGHTING} onChange={(value) => eventsScreen.updateBeoFormSection('technical', 'lighting', value)} />
                            <Input size="sm" label="Speed" value={eventsScreen.beoForm.technical.internetSpeed} onChange={(e) => eventsScreen.updateBeoFormSection('technical', 'internetSpeed', e.target.value)} />
                            <Input size="sm" label="Power" value={eventsScreen.beoForm.technical.powerRequirements} onChange={(e) => eventsScreen.updateBeoFormSection('technical', 'powerRequirements', e.target.value)} />
                          </div>
                          <Textarea className="mt-3" size="sm" label="Technical notes" minRows={2} value={eventsScreen.beoForm.technical.notes} onChange={(e) => eventsScreen.updateBeoFormSection('technical', 'notes', e.target.value)} />
                        </div>
                      </div>
                    </Tab>
                    <Tab key="catering" title="Catering">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <BeoPick label="Service" value={eventsScreen.beoForm.catering.serviceStyle} options={BEO_SERVICE_STYLES} onChange={(value) => eventsScreen.updateBeoFormSection('catering', 'serviceStyle', value)} />
                        <BeoPick label="Meal" value={eventsScreen.beoForm.catering.mealType} options={BEO_MEAL_TYPES} onChange={(value) => eventsScreen.updateBeoFormSection('catering', 'mealType', value)} />
                        <Input size="sm" label="Tea breaks" value={eventsScreen.beoForm.catering.teaBreaks} onChange={(e) => eventsScreen.updateBeoFormSection('catering', 'teaBreaks', e.target.value)} />
                        <Input size="sm" label="Special diets" value={eventsScreen.beoForm.catering.specialDietary} onChange={(e) => eventsScreen.updateBeoFormSection('catering', 'specialDietary', e.target.value)} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        <Textarea size="sm" label="Dietary notes" minRows={2} value={eventsScreen.beoForm.catering.dietaryAccommodations} onChange={(e) => eventsScreen.updateBeoFormSection('catering', 'dietaryAccommodations', e.target.value)} />
                        <Textarea size="sm" label="Allergies" minRows={2} value={eventsScreen.beoForm.catering.allergies} onChange={(e) => eventsScreen.updateBeoFormSection('catering', 'allergies', e.target.value)} />
                        <Textarea size="sm" label="Beverages" minRows={2} value={eventsScreen.beoForm.catering.beverages} onChange={(e) => eventsScreen.updateBeoFormSection('catering', 'beverages', e.target.value)} />
                        <Textarea size="sm" label="Snacks" minRows={2} value={eventsScreen.beoForm.catering.snacks} onChange={(e) => eventsScreen.updateBeoFormSection('catering', 'snacks', e.target.value)} />
                      </div>
                    </Tab>
                    <Tab key="timeline" title="Timeline">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs text-slate-500">{eventsScreen.beoForm.timeline.length} line{eventsScreen.beoForm.timeline.length === 1 ? '' : 's'}</p>
                        <Button size="sm" variant="flat" onPress={eventsScreen.handleAddBeoTimeline}>Add line</Button>
                      </div>
                      {eventsScreen.beoForm.timeline.length === 0 ? (
                        <p className="text-sm text-slate-500 py-10 text-center">No timeline lines yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="hidden md:grid grid-cols-12 gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            <span className="col-span-2">Time</span>
                            <span className="col-span-4">Activity</span>
                            <span className="col-span-3">Responsible</span>
                            <span className="col-span-2">Duration</span>
                            <span className="col-span-1" />
                          </div>
                          {eventsScreen.beoForm.timeline.map((item: any, idx: number) => (
                            <div key={`timeline-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                              <Input className="col-span-2" size="sm" aria-label="Time" placeholder="Time" value={item.time} onChange={(e) => eventsScreen.updateBeoTimelineItem(idx, 'time', e.target.value)} />
                              <Input className="col-span-4" size="sm" aria-label="Activity" placeholder="Activity" value={item.activity} onChange={(e) => eventsScreen.updateBeoTimelineItem(idx, 'activity', e.target.value)} />
                              <BeoPick className="col-span-3" value={item.responsible} options={eventsScreen.beoResponsibleOptions} onChange={(value) => eventsScreen.updateBeoTimelineItem(idx, 'responsible', value)} placeholder="Responsible" />
                              <Input className="col-span-2" size="sm" aria-label="Duration" placeholder="Duration" value={item.duration} onChange={(e) => eventsScreen.updateBeoTimelineItem(idx, 'duration', e.target.value)} />
                              <Button className="col-span-1 min-w-0" size="sm" variant="light" color="danger" onPress={() => eventsScreen.handleRemoveBeoTimeline(idx)}>×</Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Tab>
                    <Tab key="departments" title="Tasks">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs text-slate-500">{eventsScreen.beoForm.departmentChecklist.length} task{eventsScreen.beoForm.departmentChecklist.length === 1 ? '' : 's'}</p>
                        <Button size="sm" variant="flat" onPress={eventsScreen.handleAddBeoChecklist}>Add task</Button>
                      </div>
                      {eventsScreen.beoForm.departmentChecklist.length === 0 ? (
                        <p className="text-sm text-slate-500 py-10 text-center">No department tasks yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="hidden md:grid grid-cols-12 gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            <span className="col-span-2">Time</span>
                            <span className="col-span-3">Activity</span>
                            <span className="col-span-2">Department</span>
                            <span className="col-span-2">Status</span>
                            <span className="col-span-2">Duration</span>
                            <span className="col-span-1" />
                          </div>
                          {eventsScreen.beoForm.departmentChecklist.map((task: any, idx: number) => (
                            <div key={`dept-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                              <Input className="col-span-2" size="sm" aria-label="Time" placeholder="Time" value={task.time} onChange={(e) => eventsScreen.updateBeoChecklistItem(idx, 'time', e.target.value)} />
                              <Input className="col-span-3" size="sm" aria-label="Activity" placeholder="Activity" value={task.activity} onChange={(e) => eventsScreen.updateBeoChecklistItem(idx, 'activity', e.target.value)} />
                              <BeoPick className="col-span-2" value={task.department} options={eventsScreen.beoDepartmentOptions} onChange={(value) => eventsScreen.updateBeoChecklistItem(idx, 'department', value)} placeholder="Department" />
                              <Select
                                className="col-span-2"
                                size="sm"
                                aria-label="Status"
                                selectedKeys={[task.status || 'Pending']}
                                onSelectionChange={(keys) => {
                                  const value = Array.from(keys)[0] as string;
                                  if (value) eventsScreen.updateBeoChecklistItem(idx, 'status', value);
                                }}
                              >
                                <SelectItem key="Pending" startContent={<span className="h-2 w-2 rounded-full bg-warning" />}>Pending</SelectItem>
                                <SelectItem key="In Progress" startContent={<span className="h-2 w-2 rounded-full bg-primary" />}>In Progress</SelectItem>
                                <SelectItem key="Completed" startContent={<span className="h-2 w-2 rounded-full bg-success" />}>Completed</SelectItem>
                              </Select>
                              <Input className="col-span-2" size="sm" aria-label="Duration" placeholder="Duration" value={task.duration} onChange={(e) => eventsScreen.updateBeoChecklistItem(idx, 'duration', e.target.value)} />
                              <Button className="col-span-1 min-w-0" size="sm" variant="light" color="danger" onPress={() => eventsScreen.handleRemoveBeoChecklist(idx)}>×</Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Tab>
                  </Tabs>
                </form>
              ) : (
                <div className="py-12 text-center text-slate-500 text-sm">No event selected.</div>
              )}
            </ModalBody>
            <ModalFooter className="justify-between">
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="light" onPress={() => eventsScreen.exportFunctionSchedulePDF()}>
                  Print schedule
                </Button>
                <Button size="sm" variant="light" onPress={() => eventsScreen.exportFunctionSheetPDF()}>
                  Function sheet
                </Button>
                <Button size="sm" variant="light" onPress={eventsScreen.handleSendFunctionSheetToDepartments}>
                  Send to departments
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="flat" onPress={() => eventsScreen.setIsBEOModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" color="primary" onPress={eventsScreen.handleSaveBeoForm} isDisabled={!eventsScreen.beoForm}>
                  Save
                </Button>
              </div>
            </ModalFooter>
          </ModalContent>
        </Modal>



  </>
  );
}
