'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Tabs, 
  Tab,
  Chip,
  Tooltip
} from "@heroui/react";
import OfflineIndicator from './OfflineIndicator';
import { housekeepingStore } from '../lib/housekeeping/store';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { useSettingsStore } from '../lib/settings/store';
import { useRouter } from 'next/navigation';

// Info Icon Component with Tooltip
const InfoIcon = ({ description }: { description: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 2000); // 2 second delay
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Tooltip
      content={description}
      isOpen={showTooltip}
      onOpenChange={setShowTooltip}
      placement="top"
      showArrow
      color="primary"
      delay={0}
    >
      <div
        className="inline-flex items-center justify-center w-4 h-4 mr-2 text-xs text-blue-500 bg-blue-100 rounded-full cursor-help hover:bg-blue-200 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={description}
      >
        ℹ
      </div>
    </Tooltip>
  );
};

export default function FrontdeskDashboard() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const router = useRouter();

  const settings = useSettingsStore();
  const reservations = frontOfficeStore.reservations;
  const rooms = frontOfficeStore.rooms;
  const hkAllRooms = housekeepingStore.getAllRooms();
  const settingsRoomsCount = (settings as any)?.roomManagement?.rooms?.length || 0;
  const totalRooms = settingsRoomsCount || rooms.length || hkAllRooms.length;
  const availableTotal = hkAllRooms.filter(r => ['vacant', 'clean', 'inspected'].includes(r.status as any)).length;
  const occupiedTotal = hkAllRooms.filter(r => r.status === 'occupied').length;
  const dirtyRooms = hkAllRooms.filter(r => r.status === 'dirty').length;
  const maintenanceOpen = housekeepingStore.getMaintenanceRequests().filter(m => m.status !== 'completed').length;
  const readySoon = hkAllRooms.filter(r => r.status === 'inspected').length;
  const todayIso = new Date().toISOString().slice(0,10);
  const checkingOutToday = reservations.filter(r => r.status === 'checked-in' && r.departure.slice(0,10) === todayIso).length;
  const extendedStays = reservations.filter(r => r.status === 'checked-in' && r.departure < new Date().toISOString()).length;
  const standardAvail = rooms.filter(r => r.roomTypeId === 'rt-standard').length;
  const deluxeAvail = rooms.filter(r => r.roomTypeId === 'rt-deluxe').length;
  const suiteAvail = rooms.filter(r => r.roomTypeId === 'rt-suite').length;
  const todayCheckIns = reservations.filter(r => (r.status === 'confirmed' || r.status === 'pending') && r.arrival.slice(0,10) === todayIso).length;
  const todayCheckOuts = checkingOutToday;

  const operationalItems = [
    {
      category: 'Reservations & Bookings',
      items: [
        { title: 'Reservations', icon: '📅', description: 'Manage room reservations and bookings', status: 'active', count: reservations.length },
        { title: 'Rooms & Bookings', icon: '🏠', description: 'View and manage room assignments', status: 'active', count: totalRooms },
        { title: 'Room Management', icon: '📋', description: 'Room status and maintenance tracking', status: 'active', count: totalRooms },
        { title: 'Client Management', icon: '👥', description: 'Manage client profiles, search, and preferences', status: 'active', count: 0 },
      ]
    },
    {
      category: 'Guest Services',
      items: [
        { title: 'Check-ins', icon: '✅', description: 'Guest check-in processing', status: 'active', count: 0 }, // Clean slate - no check-ins
        { title: 'In-House', icon: '🏠', description: 'Current guest management', status: 'active', count: occupiedTotal },
        { title: 'Check-outs', icon: '🚪', description: 'Guest check-out processing', status: 'active', count: 0 }, // Clean slate - no check-outs
        { title: 'Invoices & Payments', icon: '📄', description: 'Billing and payment processing', status: 'active', count: 0 }, // Clean slate - no invoices
        { title: 'Guest Experience Manager', icon: '👥', description: 'Guest satisfaction and services', status: 'active', count: occupiedTotal },
        { title: 'Mobile Guest Services', icon: '📱', description: 'Mobile app guest services', status: 'active', count: 0 }, // Clean slate - no mobile services
      ]
    },


    {
      category: 'Tools & Support',
      items: [
        { title: 'Tools & Templates', icon: '🛠️', description: 'Operational tools and templates', status: 'active', count: 0 }, // Clean slate - no tools configured
        { title: 'View Activities', icon: '📊', description: 'Activity logs and audit trails', status: 'active', count: 0 }, // Clean slate - no activities
      ]
    },

    {
      category: 'User Preferences',
      items: [
        { title: 'System Settings', icon: '⚙️', description: 'System configuration and preferences', status: 'active', count: 0 }, // Clean slate - default settings
        { title: 'User Management', icon: '👤', description: 'User accounts and permissions', status: 'active', count: 0 }, // Clean slate - no users configured
        { title: 'Interface Customization', icon: '🎨', description: 'Personalize dashboard and interface', status: 'active', count: 0 }, // Clean slate - default interface
        { title: 'Notification Settings', icon: '🔔', description: 'Alert and notification preferences', status: 'active', count: 0 }, // Clean slate - default notifications
      ]
    }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">🏨 Front Office Operations</h2>
        <OfflineIndicator />
      </div>

      {/* Room Status Overview */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-ghana-black flex items-center gap-2">
            🏠 Room Status Overview ({totalRooms} Rooms)
          </h3>
        </div>
        
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Available Rooms */}
          <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Available Rooms</h4>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-3">{availableTotal}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Standard Rooms</span>
                  <span className="font-medium">{standardAvail}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deluxe Rooms</span>
                  <span className="font-medium">{deluxeAvail}</span>
                </div>
                <div className="flex justify-between">
                  <span>Suite Rooms</span>
                  <span className="font-medium">{suiteAvail}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Occupied Rooms */}
          <Card className="border-0 shadow-lg border-l-4 border-l-red-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Occupied Rooms</h4>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-red-600 mb-3">{occupiedTotal}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Checking Out Today</span>
                  <span className="font-medium">{checkingOutToday}</span>
                </div>
                <div className="flex justify-between">
                  <span>Extended Stays</span>
                  <span className="font-medium">{extendedStays}</span>
                </div>
                <div className="flex justify-between">
                  <span>VIP Guests</span>
                  <span className="font-medium">0</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Maintenance & Cleaning */}
          <Card className="border-0 shadow-lg border-l-4 border-l-yellow-500">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-ghana-black">Maintenance & Cleaning</h4>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              </div>
              <div className="text-3xl font-bold text-yellow-600 mb-3">{maintenanceOpen + dirtyRooms}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Under Maintenance</span>
                  <span className="font-medium">{maintenanceOpen}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deep Cleaning</span>
                  <span className="font-medium">{dirtyRooms}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ready Soon</span>
                  <span className="font-medium">{readySoon}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Today's Room Operations */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h4 className="text-lg font-semibold text-ghana-black">Today's Room Operations</h4>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-600 font-medium">{todayCheckIns} Check-ins</span>
                <span className="text-gray-500">Starting 2:00 PM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">{todayCheckOuts} Check-outs</span>
                <span className="text-gray-500">By 12:00 PM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-600 font-medium">{maintenanceOpen} Maintenance</span>
                <span className="text-gray-500">Scheduled</span>
              </div>
            </div>
          </div>
          <Button 
            color="success" 
            variant="solid"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => router.push('/room-assignments')}
          >
            🏢 View Full Status
          </Button>
        </div>
      </div>

      {/* Main Operations Interface */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Operations Overview</h3>
        </CardHeader>
        <CardBody>
          <Tabs 
            selectedKey={selectedTab} 
            onSelectionChange={(key) => {
              console.log(`[GUEST-SERVICES] Tab changed from ${selectedTab} to ${key}`);
              setSelectedTab(key as string);
            }}
            className="w-full"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                {operationalItems.slice(0, 5).map((category, categoryIndex) => (
                  <Card key={categoryIndex} className="border border-gray-200 shadow-md">
                    <CardHeader className="pb-3">
                      <h4 className="text-lg font-semibold text-ghana-black">{category.category}</h4>
                    </CardHeader>
                    <CardBody className="pt-0">
                      <div className="space-y-3">
                        {category.items.map((item, itemIndex) => (
                          <div 
                            key={itemIndex}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-ghana-gold/10 cursor-pointer transition-colors"
                            onClick={() => {
                              // Handle navigation based on item type
                              if (item.title.includes('Reservations')) {
                                router.push('/reservations');
                              } else if (item.title.includes('Rooms & Bookings')) {
                                router.push('/room-assignments');
                              } else if (item.title.includes('Room Management')) {
                                router.push('/room-status');
                              } else if (item.title.includes('Check-ins')) {
                                router.push('/guest-services/check-ins');
                              } else if (item.title.includes('In-House')) {
                                router.push('/guest-services/in-house');
                              } else if (item.title.includes('Check-outs')) {
                                router.push('/guest-services/check-outs');
                              } else if (item.title.includes('Guest Experience Manager')) {
                                router.push('/guest-services/guest-experience');
                              } else if (item.title.includes('Mobile Guest Services')) {
                                router.push('/guest-services/mobile-services');
                              } else if (item.title.includes('Invoices & Payments')) {
                                router.push('/guest-services/client-services/invoices-payments');
                              } else if (item.title.includes('Client Management')) {
                                router.push('/guest-services/client-services/clients-services');
                              } else if (item.title.includes('Tools & Templates')) {
                                router.push('/tools-support/tools-templates');
                              } else if (item.title.includes('View Activities')) {
                                router.push('/tools-support/view-activities');
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-xl">{item.icon}</span>
                              <div>
                                <div className="flex items-center">
                                  <InfoIcon description={item.description} />
                                  <p className="font-medium text-ghana-black">{item.title}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge 
                                color={item.status === 'active' ? 'success' : 'default'}
                                variant="flat"
                              >
                                {item.status}
                              </Badge>
                              <Chip size="sm" variant="flat" color="primary">
                                {item.count}
                              </Chip>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </Tab>
            <Tab key="reservations" title="📅 Reservations">
              <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {operationalItems[0].items.map((item, index) => (
                    <Card key={index} className="border border-gray-200">
                      <CardBody className="p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <div className="flex items-center">
                              <InfoIcon description={item.description} />
                              <h4 className="font-semibold text-ghana-black">{item.title}</h4>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge color="success" variant="flat">{item.status}</Badge>
                          <Chip size="sm" variant="flat" color="primary">{item.count}</Chip>
                        </div>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            className="w-full"
                            onClick={() => {
                              if (item.title.includes('Reservations')) {
                                router.push('/reservations');
                              } else if (item.title.includes('Rooms & Bookings')) {
                                router.push('/room-assignments');
                              } else if (item.title.includes('Room Management')) {
                                router.push('/room-status');
                              } else if (item.title.includes('Client Management')) {
                                router.push('/guest-services/client-services/clients-services');
                              }
                            }}
                          >
                            {item.title.includes('Reservations') ? '📅 Manage Reservations' :
                             item.title.includes('Rooms & Bookings') ? '🏠 Manage Assignments' :
                             item.title.includes('Room Management') ? '📋 Track Status' :
                             item.title.includes('Client Management') ? '👥 Manage Clients' :
                             '📋 Track Status'}
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>
            
            <Tab key="guest-services" title="👥 Guest Services">
              <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 1. Check-ins */}
                  <Card className="border border-gray-200">
                      <CardBody className="p-4">
                        <div className="flex items-center space-x-3 mb-3">
                        <span className="text-2xl">✅</span>
                          <div>
                            <div className="flex items-center">
                            <InfoIcon description="Guest arrival and registration" />
                            <h4 className="font-semibold text-ghana-black">Check-ins</h4>
                          </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                        <Badge color="success" variant="flat">active</Badge>
                        <Chip size="sm" variant="flat" color="primary">0</Chip>
                        </div>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            className="w-full"
                          onClick={() => router.push('/guest-services/check-ins?type=walkin')}
                        >
                          ✅ Process Check-ins
                          </Button>
                            <Button
                              size="sm"
                              color="secondary"
                              variant="flat"
                              className="w-full mt-2"
                              onClick={() => router.push('/guest-services/check-ins?type=walkin&quick=true')}
                            >
                              🚶‍♂️ Quick Walk-In
                            </Button>
                      </div>
                    </CardBody>
                  </Card>

                  {/* 2. In-House */}
                  <Card className="border border-gray-200">
                    <CardBody className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-2xl">🏠</span>
                        <div>
                          <div className="flex items-center">
                            <InfoIcon description="Manage guests during their stay" />
                            <h4 className="font-semibold text-ghana-black">In-House</h4>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <Badge color="success" variant="flat">active</Badge>
                        <Chip size="sm" variant="flat" color="primary">0</Chip>
                      </div>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          className="w-full"
                          onClick={() => router.push('/guest-services/in-house')}
                        >
                          🏠 Manage Guests
                        </Button>
                        </div>
                      </CardBody>
                    </Card>

                  {/* 3. Check-outs */}
                  <Card className="border border-gray-200">
                    <CardBody className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-2xl">🚪</span>
                        <div>
                          <div className="flex items-center">
                            <InfoIcon description="Guest departure and final billing" />
                            <h4 className="font-semibold text-ghana-black">Check-outs</h4>
                          </div>
                </div>
              </div>
                      <div className="flex items-center justify-between mb-3">
                        <Badge color="success" variant="flat">active</Badge>
                        <Chip size="sm" variant="flat" color="primary">0</Chip>
                      </div>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          className="w-full"
                          onClick={() => router.push('/guest-services/check-outs')}
                        >
                          🚪 Process Check-outs
                        </Button>
                      </div>
                    </CardBody>
                  </Card>

                  {/* 4. Invoices & Payments */}
                  <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => router.push('/guest-services/client-services/invoices-payments')}>
                  <CardBody className="p-4 text-center">
                    <div className="text-3xl mb-2">📄</div>
                    <h3 className="text-lg font-semibold text-gray-800">Invoices & Payments</h3>
                    <p className="text-sm text-gray-600">Billing and payment processing</p>
                      <Button 
                        color="primary" 
                        variant="flat" 
                        size="sm" 
                        className="mt-3"
                        onClick={() => router.push('/guest-services/client-services/invoices-payments')}
                      >
                        Manage
                      </Button>
                    </CardBody>
                  </Card>

                  {/* 5. Guest Experience Manager */}
                  <Card className="border border-gray-200">
                    <CardBody className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-2xl">👥</span>
                        <div>
                          <div className="flex items-center">
                            <InfoIcon description="Manage guest experience and services" />
                            <h4 className="font-semibold text-ghana-black">Guest Experience Manager</h4>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <Badge color="success" variant="flat">active</Badge>
                        <Chip size="sm" variant="flat" color="primary">0</Chip>
                      </div>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          className="w-full"
                          onClick={() => router.push('/guest-services/guest-experience')}
                        >
                          👥 Manage Experience
                        </Button>
                      </div>
                  </CardBody>
                </Card>

                  {/* 6. Mobile Guest Services */}
                  <Card className="border border-gray-200">
                    <CardBody className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-2xl">📱</span>
                        <div>
                          <div className="flex items-center">
                            <InfoIcon description="Mobile app guest services" />
                            <h4 className="font-semibold text-ghana-black">Mobile Guest Services</h4>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <Badge color="success" variant="flat">active</Badge>
                        <Chip size="sm" variant="flat" color="primary">0</Chip>
                      </div>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          className="w-full"
                          onClick={() => router.push('/guest-services/mobile-services')}
                        >
                          📱 Mobile Services
                        </Button>
                      </div>
                  </CardBody>
                </Card>
                </div>
              </div>
            </Tab>
            

            
            <Tab key="tools-support" title="🛠️ Tools & Support">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => router.push('/tools-support/tools-templates')}>
                  <CardBody className="p-4 text-center">
                    <div className="text-3xl mb-2">🛠️</div>
                    <h3 className="text-lg font-semibold text-gray-800">Tools & Templates</h3>
                    <p className="text-sm text-gray-600">Operational tools and communication templates</p>
                    <Button color="primary" variant="flat" size="sm" className="mt-3">Manage</Button>
                  </CardBody>
                </Card>
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => router.push('/tools-support/view-activities')}>
                  <CardBody className="p-4 text-center">
                    <div className="text-3xl mb-2">📊</div>
                    <h3 className="text-lg font-semibold text-gray-800">View Activities</h3>
                    <p className="text-sm text-gray-600">Activity logs and audit trails</p>
                    <Button color="primary" variant="flat" size="sm" className="mt-3">Monitor</Button>
                  </CardBody>
                </Card>
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
                  <CardBody className="p-4 text-center">
                    <div className="text-3xl mb-2">📋</div>
                    <h3 className="text-lg font-semibold text-gray-800">Reports</h3>
                    <p className="text-sm text-gray-600">Generate and export reports</p>
                    <Button color="primary" variant="flat" size="sm" className="mt-3">Create</Button>
                  </CardBody>
                </Card>
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
                  <CardBody className="p-4 text-center">
                    <div className="text-3xl mb-2">⚙️</div>
                    <h3 className="text-lg font-semibold text-gray-800">System Tools</h3>
                    <p className="text-sm text-gray-600">System maintenance and utilities</p>
                    <Button color="primary" variant="flat" size="sm" className="mt-3">Access</Button>
                  </CardBody>
                </Card>
              </div>
            </Tab>
            

            
            <Tab key="user-preferences" title="⚙️ User Preferences">
              <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {operationalItems[3].items.map((item, index) => (
                    <Card key={index} className="border border-gray-200">
                      <CardBody className="p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <div className="flex items-center">
                              <InfoIcon description={item.description} />
                              <h4 className="font-semibold text-ghana-black">{item.title}</h4>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <Badge color="success" variant="flat">{item.status}</Badge>
                          <Chip size="sm" variant="flat" color="primary">{item.count}</Chip>
                        </div>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            className="w-full"
                            onClick={() => {
                              if (item.title.includes('System Settings')) {
                                router.push('/settings');
                              } else if (item.title.includes('User Management')) {
                                router.push('/user-management');
                              } else if (item.title.includes('Interface Customization')) {
                                router.push('/settings/interface');
                              } else if (item.title.includes('Notification Settings')) {
                                router.push('/settings/notifications');
                              }
                            }}
                          >
                            {item.title.includes('System Settings') ? '⚙️ Configure' :
                             item.title.includes('User Management') ? '👤 Manage Users' :
                             item.title.includes('Interface Customization') ? '🎨 Customize' :
                             '🔔 Configure'}
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Recent Activities & Notices */}
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-800">Invoice #INV-001 sent (2 minutes ago)</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-800">New booking from John Doe (5 minutes ago)</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-3 w-3 bg-purple-500 rounded-full"></div>
                  <span className="text-sm text-gray-800">Hall 1 booked for conference (10 minutes ago)</span>
              </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-800">Payment received (1 hour ago)</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-3 w-3 bg-orange-500 rounded-full"></div>
                  <span className="text-sm text-gray-800">Room 205 marked for maintenance (2 hours ago)</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Notices & Alerts */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 Notices & Alerts</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-red-800 font-medium">High occupancy alert: 95% rooms occupied</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-yellow-800 font-medium">Maintenance scheduled: Room 203 tomorrow</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-blue-800 font-medium">New policy update: Check-in time changed to 3 PM</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-800 font-medium">System maintenance: Tonight 2-4 AM</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="h-3 w-3 bg-purple-500 rounded-full"></div>
                  <span className="text-sm text-purple-800 font-medium">Staff meeting: Tomorrow 9 AM in Conference Room</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
