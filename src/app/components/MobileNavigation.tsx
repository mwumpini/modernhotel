'use client';

import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Link, 
  Accordion, 
  AccordionItem, 
  Badge, 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  useDisclosure
} from "@heroui/react";

interface MobileNavigationProps {
  onLogout: () => void;
}

export default function MobileNavigation({ onLogout }: MobileNavigationProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isMobile, setIsMobile] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(['dashboard']));

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navigationSections = [
    {
      key: 'dashboard',
      title: '📊 Live Dashboard',
      icon: '📊',
      items: [
        { title: 'Arrival/Departure Board', href: '/dashboard/arrivals', badge: 'Live' },
        { title: 'Room Status Overview', href: '/dashboard/rooms', badge: '156' },
        { title: 'Revenue Snapshot', href: '/dashboard/revenue', badge: '₵45,230' },
      ]
    },
    {
      key: 'frontdesk',
      title: '🏨 Frontdesk Operations',
      icon: '🏨',
      items: [
        { title: 'Booking Engine', href: '/frontdesk/bookings', badge: 'Web/OTA' },
        { title: 'Group Blocking', href: '/frontdesk/groups', badge: 'Tool' },
        { title: 'Check-In/Out', href: '/frontdesk/checkin', badge: 'Ghana Card' },
        { title: 'Guest Services', href: '/frontdesk/services', badge: 'Tracking' },
        { title: 'Rate Management', href: '/frontdesk/rates', badge: 'Dynamic' },
        { title: 'Billing Persons', href: '/billing-persons', badge: 'Corporate' },
      ]
    },
    {
      key: 'f&b',
      title: '🍽️ Food & Beverage',
      icon: '🍽️',
      items: [
        { title: 'Point of Sale', href: '/f&b/pos', badge: 'POS' },
        { title: 'Restaurant & Bar', href: '/restaurant', badge: 'Kitchen' },
        { title: 'Kitchen Operations', href: '/f&b/kitchen', badge: 'Prep' },
        { title: 'Menu & Inventory', href: '/f&b/inventory', badge: 'Auto' },
        { title: 'Staff & Reports', href: '/f&b/payments', badge: 'Mobile' },
      ]
    },
    {
      key: 'housekeeping',
      title: '🛏️ Housekeeping & Maintenance',
      icon: '🛏️',
      items: [
        { title: 'Room Status Grid', href: '/housekeeping/rooms', badge: 'Color' },
        { title: 'Inspection & Cleaning', href: '/housekeeping/inspections', badge: 'QC' },
        { title: 'Work Orders & Maintenance', href: '/housekeeping/maintenance', badge: 'Vendor' },
      ]
    },
    {
      key: 'inventory',
      title: '📦 Inventory & Stores',
      icon: '📦',
      items: [
        { title: 'Stock Items & Suppliers', href: '/inventory/items', badge: 'Manage' },
        { title: 'Purchase Orders', href: '/inventory/orders', badge: 'PO' },
        { title: 'Stock Movements', href: '/inventory/movements', badge: 'Track' },
        { title: 'Reports & Alerts', href: '/inventory/reports', badge: 'Auto' },
      ]
    },
    {
      key: 'security',
      title: '🚨 Security Operations',
      icon: '🚨',
      items: [
        { title: 'Incident Reporting', href: '/security/incidents', badge: 'Real-time' },
        { title: 'Visitor & Patrol Management', href: '/security/visitors', badge: 'Track' },
        { title: 'Emergency & Key Control', href: '/security/emergency', badge: 'Library' },
      ]
    },
    {
      key: 'hr',
      title: '👥 HR & Payroll',
      icon: '👥',
      items: [
        { title: 'Staff Management', href: '/hr/staff', badge: 'Biometric' },
        { title: 'Shift Scheduling', href: '/hr/scheduling', badge: 'Auto' },
        { title: 'Training & Benefits', href: '/hr/training', badge: 'Certified' },
        { title: 'Payroll Processing', href: '/hr/payroll', badge: 'PAYE/SSNIT' },
      ]
    },
    {
      key: 'accounting',
      title: '🧾 Complete Accounting System',
      icon: '🧾',
      items: [
        { title: 'Chart of Accounts', href: '/accounting/coa', badge: 'Ghana GAAP' },
        { title: 'Bank, Cash & Receivables', href: '/accounting/banking', badge: 'Mobile Money' },
        { title: 'Accounts Payable', href: '/accounting/ap', badge: 'Vendor' },
        { title: 'Inventory & Fixed Assets', href: '/accounting/inventory', badge: 'COGS' },
        { title: 'Financial Reports', href: '/accounting/reports', badge: 'Compliance' },
        { title: 'Audit & Controls', href: '/accounting/audit', badge: 'Logs' },
      ]
    },
    {
      key: 'compliance',
      title: '⚖️ Compliance & Reports',
      icon: '⚖️',
      items: [
        { title: 'Tax Calculator & Rules', href: '/compliance/tax', badge: 'Ghana' },
        { title: 'VAT/NHIL Returns', href: '/compliance/vat', badge: '12.5%+2.5%' },
        { title: 'Tourism Levy & SSNIT', href: '/compliance/levy', badge: 'Auto' },
        { title: 'Operational Reports', href: '/compliance/reports', badge: 'RevPAR' },
      ]
    },
    {
      key: 'settings',
      title: '⚙️ System Settings',
      icon: '⚙️',
      items: [
        { title: 'User Management & Preferences', href: '/settings/users', badge: 'Security' },
        { title: 'Theme Test', href: '/settings/theme-test', badge: 'Test' },
        { title: 'Activity Logs', href: '/settings/logs', badge: 'Audit' },
        { title: 'Offline Management', href: '/settings/offline', badge: 'Sync' },
        { title: 'Tax Rules & APIs', href: '/settings/tax', badge: 'Ghana' },
        { title: 'Localization & Templates', href: '/settings/localization', badge: 'Twi' },
      ]
    }
  ];

  const handleSelectionChange = (keys: Set<string>) => {
    setExpandedKeys(keys);
  };

  const MobileHeader = () => (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-lg border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <div className="h-10 w-10 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-xl flex items-center justify-center mr-3">
            <span className="text-2xl">🏨</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-ghana-black">Ghana Hotel</h1>
            <p className="text-xs text-gray-600">Management System</p>
          </div>
        </div>
        
        <Button
          isIconOnly
          variant="light"
          onPress={onOpen}
          className="text-ghana-black"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
      </div>
    </div>
  );

  const MobileDrawer = () => (
    <Drawer isOpen={isOpen} onClose={onClose} placement="left" size="full">
      <DrawerContent>
        <DrawerHeader className="border-b border-gray-200">
          <div className="flex items-center">
            <div className="h-12 w-12 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-2xl flex items-center justify-center mr-4">
              <span className="text-3xl">🏨</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-ghana-black">Ghana Hotel</h2>
              <p className="text-sm text-gray-600">Management System</p>
            </div>
          </div>
        </DrawerHeader>
        
        <DrawerBody className="px-4 py-6">
          <Accordion
            selectionMode="multiple"
            selectedKeys={expandedKeys}
            onSelectionChange={handleSelectionChange}
            className="space-y-3"
          >
            {navigationSections.map((section) => (
              <AccordionItem
                key={section.key}
                aria-label={section.title}
                title={
                  <div 
                    className="flex items-center justify-between w-full cursor-pointer"
                    onClick={() => {
                      // Navigate to the section dashboard
                      window.location.href = `/${section.key}`;
                      onClose();
                    }}
                  >
                    <div className="flex items-center">
                      <span className="text-lg mr-3">{section.icon}</span>
                      <span className="font-semibold text-ghana-black text-sm">
                        {section.title.replace(/^[^\s]+\s/, '')}
                      </span>
                    </div>
                  </div>
                }
                className="border-0 shadow-sm rounded-lg bg-gray-50"
              >
                <div className="space-y-1 pt-2 pb-3">
                  {section.items.map((item, index) => (
                    <Link
                      key={index}
                      href={item.href}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 text-sm text-ghana-black hover:bg-ghana-gold/20 hover:text-ghana-green"
                      onClick={onClose}
                    >
                      <span className="font-medium">{item.title}</span>
                      <Badge
                        size="sm"
                        variant="flat"
                        className="bg-ghana-green/10 text-ghana-green"
                      >
                        {item.badge}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Mobile Quick Actions */}
          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-semibold text-ghana-black mb-3">🚀 Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="flat"
                className="bg-ghana-green/10 text-ghana-green border border-ghana-green/20"
                size="sm"
                as="a"
                href="/frontdesk"
              >
                🏨 Frontdesk
              </Button>
              <Button
                variant="flat"
                className="bg-ghana-gold/10 text-ghana-gold border border-ghana-gold/20"
                size="sm"
                as="a"
                href="/housekeeping"
              >
                🛏️ Housekeeping
              </Button>
              <Button
                variant="flat"
                className="bg-ghana-red/10 text-ghana-red border border-ghana-red/20"
                size="sm"
                as="a"
                href="/f&b"
              >
                🍽️ F&B
              </Button>
              <Button
                variant="flat"
                className="bg-blue-500/10 text-blue-600 border border-blue-500/20"
                size="sm"
                as="a"
                href="/night-audit"
              >
                🌙 Night Audit
              </Button>
              <Button
                variant="flat"
                className="bg-purple-600/10 text-purple-600 border border-purple-600/20"
                size="sm"
                as="a"
                href="/compliance"
              >
                🇬🇭 Compliance
              </Button>
              <Button
                variant="flat"
                className="bg-indigo-600/10 text-indigo-600 border border-indigo-600/20"
                size="sm"
                as="a"
                href="/accounting"
              >
                🧾 Accounting
              </Button>
            </div>
          </div>

          {/* Ghana Features Mobile */}
          <div className="mt-6 p-4 bg-gradient-to-r from-ghana-red/10 to-ghana-gold/10 rounded-xl border border-ghana-red/20">
            <h3 className="text-sm font-semibold text-ghana-black mb-2">🇬🇭 Ghana Features</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p>• Mobile Money reconciliation</p>
              <p>• VAT/NHIL auto-calculation</p>
              <p>• Ghana Card scanning</p>
              <p>• SSNIT compliance</p>
              <p>• GRA integration</p>
            </div>
          </div>
        </DrawerBody>
        
        <DrawerFooter className="border-t border-gray-200">
          <div className="w-full">
            <div className="flex items-center mb-3">
              <div className="h-10 w-10 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-full flex items-center justify-center mr-3">
                <span className="text-white text-lg">👤</span>
              </div>
              <div>
                <p className="font-semibold text-ghana-black">System Administrator</p>
                <p className="text-xs text-gray-600">Ghana Hotel Management</p>
              </div>
            </div>
            <Button
              variant="flat"
              className="w-full bg-gradient-to-r from-ghana-red to-ghana-red/80 text-white"
              size="sm"
              onClick={() => {
                onLogout();
                onClose();
              }}
            >
              Sign Out
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );

  if (!isMobile) {
    return null; // Don't render mobile components on desktop
  }

  return (
    <>
      <MobileHeader />
      <MobileDrawer />
      {/* Add top margin to content to account for fixed header */}
      <div className="lg:hidden h-16"></div>
    </>
  );
}
