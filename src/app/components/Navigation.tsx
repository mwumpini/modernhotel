'use client';

import React, { useState } from 'react';
import { Button, Link, Accordion, AccordionItem, Badge, Divider, Card, CardBody, CardHeader, Progress, Avatar, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import FrontdeskDashboard from './FrontdeskDashboard';
import HousekeepingDashboard from './HousekeepingDashboard';
import FoodBeverageDashboard from './FoodBeverageDashboard';
import SecurityDashboard from './SecurityDashboard';
import OfflineIndicator from './OfflineIndicator';
import OfflineManager from './OfflineManager';
import ActivityLog from './ActivityLog';
import SettingsDashboard from './SettingsDashboard';

interface NavigationProps {
  onLogout: () => void;
}

type ActiveSection = 'dashboard' | 'frontdesk' | 'housekeeping' | 'f&b' | 'security' | 'hr' | 'accounting' | 'reports' | 'settings';

export default function Navigation({ onLogout }: NavigationProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(['dashboard']));
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');



  const navigationSections = [
    {
      key: 'dashboard',
      title: '📊 Live Dashboard',
      icon: '📊',
      items: [
        { title: 'Arrival/Departure Board', href: '#' },
        { title: 'Room Status Overview', href: '#' },
        { title: 'Revenue Snapshot', href: '#' },
      ]
    },
    {
      key: 'frontdesk',
      title: '🏨 Front Office Operations',
      icon: '🏨',
      items: [
        { title: 'Dashboard', href: '#' },
        { title: 'Rooms', href: '#' },
        { title: 'Bookings', href: '#' },
        { title: 'Invoices', href: '#' },
        { title: 'Clients', href: '#' },
        { title: 'Services & Facilities', href: '#' },
        { title: 'Events & Conferences', href: '#' },
        { title: 'Tools', href: '#' },
        { title: 'Templates', href: '#' },
        { title: 'Reports', href: '#' },
        { title: 'Payments', href: '#' },
      ]
    },
    {
      key: 'f&b',
      title: '🍽️ Food & Beverage',
      icon: '🍽️',
      items: [
        { title: 'Dashboard', href: '#' },
        { title: 'Point of Sale', href: '#' },
        { title: 'Kitchen Operations', href: '#' },
        { title: 'Bar Management', href: '#' },
        { title: 'Menu Management', href: '#' },
        { title: 'Inventory', href: '#' },
        { title: 'Reports & Analytics', href: '#' },
        { title: 'Staff Management', href: '#' },
      ]
    },
    {
      key: 'housekeeping',
      title: '🛏️ Housekeeping & Maintenance',
      icon: '🛏️',
      items: [
        { title: 'Room Status Grid', href: '#' },
        { title: 'Inspection Checklists', href: '#' },
        { title: 'Deep Cleaning', href: '#' },
        { title: 'Work Orders', href: '#' },
        { title: 'Preventive Maintenance', href: '#' },
      ]
    },
    {
      key: 'security',
      title: '🚨 Security Operations',
      icon: '🚨',
      items: [
        { title: 'Incident Reporting', href: '#' },
        { title: 'Visitor Management', href: '#' },
        { title: 'Patrol Tracking', href: '#' },
        { title: 'Emergency Protocols', href: '#' },
        { title: 'Key Control', href: '#' },
      ]
    },
    {
      key: 'hr',
      title: '👥 HR & Payroll',
      icon: '👥',
      items: [
        { title: 'Staff Management', href: '#' },
        { title: 'Shift Scheduling', href: '#' },
        { title: 'Training Records', href: '#' },
        { title: 'Payroll Processing', href: '#' },
        { title: 'Benefits Admin', href: '#' },
      ]
    },
    {
      key: 'accounting',
      title: '🧾 Complete Accounting System',
      icon: '🧾',
      items: [
        { title: 'CFO Dashboard', href: '#' },
        { title: 'Chart of Accounts', href: '#' },
        { title: 'Bank & Cash', href: '#' },
        { title: 'Accounts Payable', href: '#' },
        { title: 'Accounts Receivable', href: '#' },
        { title: 'Inventory Accounting', href: '#' },
        { title: 'Fixed Assets', href: '#' },
        { title: 'Financial Reports', href: '#' },
        { title: 'Audit & Controls', href: '#' },
      ]
    },
    {
      key: 'reports',
      title: '📈 Reports & Analytics',
      icon: '📈',
      items: [
        { title: 'Operational Reports', href: '#' },
        { title: 'Compliance Reports', href: '#' },
        { title: 'VAT/NHIL Returns', href: '#' },
        { title: 'Tourism Levy', href: '#' },
        { title: 'SSNIT Filings', href: '#' },
      ]
    },
    {
      key: 'settings',
      title: '⚙️ System Settings',
      icon: '⚙️',
      items: [
        { title: 'User Role Matrix', href: '#' },
        { title: 'Activity Logs', href: '#' },
        { title: 'Offline Management', href: '#' },
        { title: 'Tax Rule Setup', href: '#' },
        { title: 'Mobile Money APIs', href: '#' },
        { title: 'Localization', href: '#' },
        { title: 'GRA Templates', href: '#' },
      ]
    }
  ];

  const handleSelectionChange = (keys: any) => {
    setExpandedKeys(keys);
  };

  const handleSectionClick = (sectionKey: string) => {
    setActiveSection(sectionKey as ActiveSection);
  };

  const renderDashboardContent = () => {
    switch (activeSection) {
      case 'frontdesk':
        return <FrontdeskDashboard />;
      case 'housekeeping':
        return <HousekeepingDashboard />;
      case 'f&b':
        return <FoodBeverageDashboard />;
      case 'security':
        return <SecurityDashboard />;
      case 'settings':
        return <SettingsDashboard />;

      case 'dashboard':
      default:
        return (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-ghana-black">📊 Live Dashboard</h2>
              <OfflineIndicator />
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="border-0 shadow-lg">
                <CardBody className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Rooms</p>
                      <p className="text-2xl font-bold text-ghana-black">156</p>
                      <p className="text-sm text-green-600">+2 from yesterday</p>
                    </div>
                    <div className="text-3xl">🏠</div>
                  </div>
                </CardBody>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardBody className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Occupied</p>
                      <p className="text-2xl font-bold text-ghana-black">142</p>
                      <p className="text-sm text-green-600">+5 from yesterday</p>
                    </div>
                    <div className="text-3xl">✅</div>
                  </div>
                </CardBody>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardBody className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Available</p>
                      <p className="text-2xl font-bold text-ghana-black">14</p>
                      <p className="text-sm text-red-600">-3 from yesterday</p>
                    </div>
                    <div className="text-3xl">🆓</div>
                  </div>
                </CardBody>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardBody className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Revenue Today</p>
                      <p className="text-2xl font-bold text-ghana-black">₵45,230</p>
                      <p className="text-sm text-green-600">+12% from yesterday</p>
                    </div>
                    <div className="text-3xl">💰</div>
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="border-0 shadow-lg mb-8">
              <CardHeader className="pb-3">
                <h3 className="text-xl font-semibold text-ghana-black">🚀 Quick Actions</h3>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    variant="flat"
                    className="bg-ghana-green text-white h-20 flex flex-col items-center justify-center space-y-2"
                    size="lg"
                  >
                    <span className="text-2xl">📅</span>
                    <span className="text-sm font-medium">New Booking</span>
                  </Button>
                  <Button
                    variant="flat"
                    className="bg-ghana-gold text-white h-20 flex flex-col items-center justify-center space-y-2"
                    size="lg"
                  >
                    <span className="text-2xl">🔑</span>
                    <span className="text-sm font-medium">Check In</span>
                  </Button>
                  <Button
                    variant="flat"
                    className="bg-ghana-red text-white h-20 flex flex-col items-center justify-center space-y-2"
                    size="lg"
                  >
                    <span className="text-2xl">🚪</span>
                    <span className="text-sm font-medium">Check Out</span>
                  </Button>
                  <Button
                    variant="flat"
                    className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
                    size="lg"
                  >
                    <span className="text-2xl">👥</span>
                    <span className="text-sm font-medium">Group Block</span>
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Recent Activity */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activity</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
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
                </div>
              </CardBody>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <nav className="w-80 bg-white shadow-xl h-screen overflow-y-auto">
        <div className="p-6">
          {/* Logo Header */}
          <div className="flex items-center mb-8">
            <div className="h-12 w-12 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-2xl flex items-center justify-center mr-4">
              <span className="text-3xl">🏨</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-ghana-black">Ghana Hotel</h1>
              <p className="text-sm text-gray-600">Management System</p>
            </div>
          </div>

          {/* Navigation Sections */}
          <Accordion
            selectionMode="multiple"
            selectedKeys={expandedKeys}
            onSelectionChange={handleSelectionChange}
            className="space-y-2"
          >
            {navigationSections.map((section) => (
              <AccordionItem
                key={section.key}
                aria-label={section.title}
                title={
                  <div 
                    className="flex items-center justify-between w-full cursor-pointer"
                    onClick={() => handleSectionClick(section.key)}
                  >
                    <div className="flex items-center">
                      <span className="text-lg mr-3">{section.icon}</span>
                      <span className="font-semibold text-ghana-black">
                        {section.title.replace(/^[^\s]+\s/, '')}
                      </span>
                    </div>
                  </div>
                }
                className="border-0 shadow-sm rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="space-y-1 pt-2 pb-3">
                                           {section.items.map((item, index) => (
                           <div
                             key={index}
                             className="w-full px-4 py-2.5 rounded-lg transition-all duration-200 text-sm cursor-pointer hover:bg-ghana-gold/20 hover:text-ghana-green"
                             onClick={() => handleSectionClick(section.key)}
                           >
                             <span className="font-medium">{item.title}</span>
                           </div>
                         ))}
                </div>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Workflow Integration Info */}
          <div className="mt-8 p-4 bg-gradient-to-r from-blue-500/10 to-ghana-gold/10 rounded-xl border border-blue-500/20">
            <h3 className="text-sm font-semibold text-ghana-black mb-2">🔄 Workflow Integration</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p>• Automated night audit</p>
              <p>• Real-time room status sync</p>
              <p>• Mobile money reconciliation</p>
              <p>• Ghana compliance automation</p>
            </div>
          </div>

          {/* Ghana-Specific Features */}
          <div className="mt-6 p-4 bg-gradient-to-r from-ghana-red/10 to-ghana-gold/10 rounded-xl border border-ghana-red/20">
            <h3 className="text-sm font-semibold text-ghana-black mb-2">🇬🇭 Ghana Features</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p>• Ghana Card verification</p>
              <p>• VAT/NHIL calculation</p>
              <p>• SSNIT compliance</p>
              <p>• Tourism levy management</p>
            </div>
          </div>

          {/* User Profile & Logout */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center mb-4">
              <Avatar
                name="Admin User"
                className="h-10 w-10 bg-gradient-to-br from-ghana-green to-ghana-gold text-white mr-3"
              />
              <div>
                <p className="font-semibold text-ghana-black">System Administrator</p>
                <p className="text-xs text-gray-600">Ghana Hotel Management</p>
              </div>
            </div>
            <Button
              variant="flat"
              className="w-full bg-gradient-to-r from-ghana-red to-ghana-red/80 text-white"
              size="sm"
              onClick={onLogout}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 bg-gray-50 overflow-y-auto">
        {renderDashboardContent()}
      </div>
    </div>
  );
}
