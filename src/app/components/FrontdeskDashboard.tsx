'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Tabs, 
  Tab,
  Chip
} from "@heroui/react";
import OfflineIndicator from './OfflineIndicator';
import { useRouter } from 'next/navigation';

export default function FrontdeskDashboard() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const router = useRouter();

  // Room status data - this would typically come from your backend/database
  const roomStatusData = {
    totalRooms: 50,
    available: {
      total: 28,
      breakdown: {
        standard: 18,
        deluxe: 8,
        suite: 2
      }
    },
    occupied: {
      total: 20,
      breakdown: {
        checkingOutToday: 5,
        extendedStays: 12,
        vipGuests: 3
      }
    },
    maintenance: {
      total: 2,
      breakdown: {
        underMaintenance: 1,
        deepCleaning: 1,
        readySoon: 0
      }
    },
    todayOperations: {
      checkIns: 8,
      checkOuts: 5,
      maintenance: 2
    }
  };

  const operationalItems = [
    {
      category: 'Reservations & Bookings',
      items: [
        { title: '📅 Reservations', icon: '📅', description: 'Manage room reservations and bookings', status: 'active', count: 45 },
        { title: '🏠 Rooms & Bookings', icon: '🏠', description: 'View and manage room assignments', status: 'active', count: 156 },
        { title: '📋 Room Management', icon: '📋', description: 'Room status and maintenance tracking', status: 'active', count: 156 },
        { title: '👥 Manage Clients', icon: '👥', description: 'Client profiles and management', status: 'active', count: 234 },
      ]
    },
    {
      category: 'Guest Services',
      items: [
        { title: '✅ Check-ins', icon: '✅', description: 'Guest check-in processing', status: 'active', count: 12 },
        { title: '🏠 In-House', icon: '🏠', description: 'Current guest management', status: 'active', count: 142 },
        { title: '🚪 Check-outs', icon: '🚪', description: 'Guest check-out processing', status: 'active', count: 8 },
        { title: '👥 Guest Experience Manager', icon: '👥', description: 'Guest satisfaction and services', status: 'active', count: 142 },
        { title: '📱 Mobile Guest Services', icon: '📱', description: 'Mobile app guest services', status: 'active', count: 89 },
      ]
    },
    {
      category: 'Financial Operations',
      items: [
        { title: '💰 Invoices & Payments', icon: '💰', description: 'Billing and payment processing', status: 'active', count: 67 },
        { title: '👥 Clients & Services', icon: '👥', description: 'Client relationship management', status: 'active', count: 234 },
      ]
    },
    {
      category: 'Tools & Support',
      items: [
        { title: '🛠️ Tools & Templates', icon: '🛠️', description: 'Operational tools and templates', status: 'active', count: 15 },
        { title: '📊 View Activities', icon: '📊', description: 'Activity logs and audit trails', status: 'active', count: 1234 },
      ]
    },

    {
      category: 'User Preferences',
      items: [
        { title: '⚙️ System Settings', icon: '⚙️', description: 'System configuration and preferences', status: 'active', count: 12 },
        { title: '👤 User Management', icon: '👤', description: 'User accounts and permissions', status: 'active', count: 89 },
        { title: '🎨 Interface Customization', icon: '🎨', description: 'Personalize dashboard and interface', status: 'active', count: 34 },
        { title: '🔔 Notification Settings', icon: '🔔', description: 'Alert and notification preferences', status: 'active', count: 56 },
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
            🏠 Room Status Overview - Ghana Hotel ({roomStatusData.totalRooms} Rooms)
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
              <div className="text-3xl font-bold text-green-600 mb-3">{roomStatusData.available.total}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Standard Rooms</span>
                  <span className="font-medium">{roomStatusData.available.breakdown.standard}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deluxe Rooms</span>
                  <span className="font-medium">{roomStatusData.available.breakdown.deluxe}</span>
                </div>
                <div className="flex justify-between">
                  <span>Suite Rooms</span>
                  <span className="font-medium">{roomStatusData.available.breakdown.suite}</span>
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
              <div className="text-3xl font-bold text-red-600 mb-3">{roomStatusData.occupied.total}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Checking Out Today</span>
                  <span className="font-medium">{roomStatusData.occupied.breakdown.checkingOutToday}</span>
                </div>
                <div className="flex justify-between">
                  <span>Extended Stays</span>
                  <span className="font-medium">{roomStatusData.occupied.breakdown.extendedStays}</span>
                </div>
                <div className="flex justify-between">
                  <span>VIP Guests</span>
                  <span className="font-medium">{roomStatusData.occupied.breakdown.vipGuests}</span>
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
              <div className="text-3xl font-bold text-yellow-600 mb-3">{roomStatusData.maintenance.total}</div>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Under Maintenance</span>
                  <span className="font-medium">{roomStatusData.maintenance.breakdown.underMaintenance}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deep Cleaning</span>
                  <span className="font-medium">{roomStatusData.maintenance.breakdown.deepCleaning}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ready Soon</span>
                  <span className="font-medium">{roomStatusData.maintenance.breakdown.readySoon}</span>
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
                <span className="text-green-600 font-medium">{roomStatusData.todayOperations.checkIns} Check-ins</span>
                <span className="text-gray-500">Starting 2:00 PM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">{roomStatusData.todayOperations.checkOuts} Check-outs</span>
                <span className="text-gray-500">By 12:00 PM</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-600 font-medium">{roomStatusData.todayOperations.maintenance} Maintenance</span>
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
              console.log(`[FRONT-OFFICE] Tab changed from ${selectedTab} to ${key}`);
              setSelectedTab(key as string);
            }}
            className="w-full"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                {operationalItems.slice(0, 4).map((category, categoryIndex) => (
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
                              } else if (item.title.includes('Manage Clients')) {
                                router.push('/manage-clients');
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
                                router.push('/financial-operations/invoices-payments');
                              } else if (item.title.includes('Clients & Services')) {
                                router.push('/financial-operations/clients-services');
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
                                <p className="font-medium text-ghana-black">{item.title}</p>
                                <p className="text-sm text-gray-600">{item.description}</p>
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
                            <h4 className="font-semibold text-ghana-black">{item.title}</h4>
                            <p className="text-sm text-gray-600">{item.description}</p>
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
                              } else if (item.title.includes('Manage Clients')) {
                                router.push('/manage-clients');
                              }
                            }}
                          >
                            {item.title.includes('Reservations') ? '📅 Manage Reservations' :
                             item.title.includes('Rooms & Bookings') ? '🏠 Manage Assignments' :
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
                  {operationalItems[1].items.map((item, index) => (
                    <Card key={index} className="border border-gray-200">
                      <CardBody className="p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <h4 className="font-semibold text-ghana-black">{item.title}</h4>
                            <p className="text-sm text-gray-600">{item.description}</p>
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
                              if (item.title.includes('Check-ins')) {
                                router.push('/guest-services/check-ins?type=walkin');
                              } else if (item.title.includes('In-House')) {
                                router.push('/guest-services/in-house');
                              } else if (item.title.includes('Check-outs')) {
                                router.push('/guest-services/check-outs');
                              } else if (item.title.includes('Guest Experience Manager')) {
                                router.push('/guest-services/guest-experience');
                              } else if (item.title.includes('Mobile Guest Services')) {
                                router.push('/guest-services/mobile-services');
                              }
                            }}
                          >
                            {item.title.includes('Check-ins') ? '✅ Process Check-ins' :
                             item.title.includes('In-House') ? '🏠 Manage Guests' :
                             item.title.includes('Check-outs') ? '🚪 Process Check-outs' :
                             item.title.includes('Guest Experience Manager') ? '👥 Manage Experience' :
                             '📱 Mobile Services'}
                          </Button>
                          {item.title.includes('Check-ins') && (
                            <Button
                              size="sm"
                              color="secondary"
                              variant="flat"
                              className="w-full mt-2"
                              onClick={() => router.push('/guest-services/check-ins?type=walkin&quick=true')}
                            >
                              🚶‍♂️ Quick Walk-In
                            </Button>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </Tab>
            
            <Tab key="financial-operations" title="💰 Financial Operations">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => router.push('/financial-operations/invoices-payments')}>
                  <CardBody className="p-4 text-center">
                    <div className="text-3xl mb-2">📄</div>
                    <h3 className="text-lg font-semibold text-gray-800">Invoices & Payments</h3>
                    <p className="text-sm text-gray-600">Billing and payment processing</p>
                    <Button color="primary" variant="flat" size="sm" className="mt-3">Manage</Button>
                  </CardBody>
                </Card>
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => router.push('/financial-operations/revenue-analytics')}>
                  <CardBody className="p-4 text-center">
                    <div className="text-3xl mb-2">📈</div>
                    <h3 className="text-lg font-semibold text-gray-800">Revenue Analytics</h3>
                    <p className="text-sm text-gray-600">Financial reporting and analysis</p>
                    <Button color="primary" variant="flat" size="sm" className="mt-3">View</Button>
                  </CardBody>
                </Card>
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => router.push('/financial-operations/payment-methods')}>
                  <CardBody className="p-4 text-center">
                    <div className="text-3xl mb-2">💳</div>
                    <h3 className="text-lg font-semibold text-gray-800">Payment Methods</h3>
                    <p className="text-sm text-gray-600">Payment options and methods</p>
                    <Button color="primary" variant="flat" size="sm" className="mt-3">Configure</Button>
                  </CardBody>
                </Card>
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => router.push('/financial-operations/tax-management')}>
                  <CardBody className="p-4 text-center">
                    <div className="text-3xl mb-2">🧮</div>
                    <h3 className="text-lg font-semibold text-gray-800">Tax Management</h3>
                    <p className="text-sm text-gray-600">VAT and tax compliance</p>
                    <Button color="primary" variant="flat" size="sm" className="mt-3">Manage</Button>
                  </CardBody>
                </Card>
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
                  {operationalItems[4].items.map((item, index) => (
                    <Card key={index} className="border border-gray-200">
                      <CardBody className="p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <h4 className="font-semibold text-ghana-black">{item.title}</h4>
                            <p className="text-sm text-gray-600">{item.description}</p>
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
