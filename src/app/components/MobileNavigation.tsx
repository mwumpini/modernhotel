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
      ]
    },
    {
      key: 'f&b',
      title: '🍽️ Food & Beverage',
      icon: '🍽️',
      items: [
        { title: 'Restaurant Dashboard', href: '/f&b/dashboard', badge: 'Covers' },
        { title: 'Order Management', href: '/f&b/orders', badge: '1-2-3' },
        { title: 'Kitchen Display', href: '/f&b/kitchen', badge: 'Prep' },
        { title: 'Inventory Control', href: '/f&b/inventory', badge: 'Auto' },
        { title: 'Payment Processing', href: '/f&b/payments', badge: 'Mobile' },
      ]
    },
    {
      key: 'housekeeping',
      title: '🛏️ Housekeeping & Maintenance',
      icon: '🛏️',
      items: [
        { title: 'Room Status Grid', href: '/housekeeping/rooms', badge: 'Color' },
        { title: 'Inspection Checklists', href: '/housekeeping/inspections', badge: 'QC' },
        { title: 'Deep Cleaning', href: '/housekeeping/cleaning', badge: 'Scheduled' },
        { title: 'Work Orders', href: '/housekeeping/maintenance', badge: 'Vendor' },
        { title: 'Preventive Maintenance', href: '/housekeeping/preventive', badge: 'Auto' },
      ]
    },
    {
      key: 'security',
      title: '🚨 Security Operations',
      icon: '🚨',
      items: [
        { title: 'Incident Reporting', href: '/security/incidents', badge: 'Real-time' },
        { title: 'Visitor Management', href: '/security/visitors', badge: 'Track' },
        { title: 'Patrol Tracking', href: '/security/patrols', badge: 'GPS' },
        { title: 'Emergency Protocols', href: '/security/emergency', badge: 'Library' },
        { title: 'Key Control', href: '/security/keys', badge: 'Digital' },
      ]
    },
    {
      key: 'hr',
      title: '👥 HR & Payroll',
      icon: '👥',
      items: [
        { title: 'Staff Management', href: '/hr/staff', badge: 'Biometric' },
        { title: 'Shift Scheduling', href: '/hr/scheduling', badge: 'Auto' },
        { title: 'Training Records', href: '/hr/training', badge: 'Certified' },
        { title: 'Payroll Processing', href: '/hr/payroll', badge: 'PAYE/SSNIT' },
        { title: 'Benefits Admin', href: '/hr/benefits', badge: 'Comprehensive' },
      ]
    },
    {
      key: 'accounting',
      title: '🧾 Complete Accounting System',
      icon: '🧾',
      items: [
        { title: 'CFO Dashboard', href: '/accounting/cfo', badge: 'Real-time' },
        { title: 'Chart of Accounts', href: '/accounting/coa', badge: 'Ghana GAAP' },
        { title: 'Bank & Cash', href: '/accounting/banking', badge: 'Mobile Money' },
        { title: 'Accounts Payable', href: '/accounting/ap', badge: 'Vendor' },
        { title: 'Accounts Receivable', href: '/accounting/ar', badge: 'Guest Ledger' },
        { title: 'Inventory Accounting', href: '/accounting/inventory', badge: 'COGS' },
        { title: 'Fixed Assets', href: '/accounting/assets', badge: 'Ghana IRS' },
        { title: 'Financial Reports', href: '/accounting/reports', badge: 'Compliance' },
        { title: 'Audit & Controls', href: '/accounting/audit', badge: 'Logs' },
      ]
    },
    {
      key: 'reports',
      title: '📈 Reports & Analytics',
      icon: '📈',
      items: [
        { title: 'Operational Reports', href: '/reports/operational', badge: 'RevPAR' },
        { title: 'Compliance Reports', href: '/reports/compliance', badge: 'GRA' },
        { title: 'VAT/NHIL Returns', href: '/reports/vat', badge: '12.5%+2.5%' },
        { title: 'Tourism Levy', href: '/reports/tourism', badge: 'Auto' },
        { title: 'SSNIT Filings', href: '/reports/ssnit', badge: 'Monthly' },
      ]
    },
    {
      key: 'settings',
      title: '⚙️ System Settings',
      icon: '⚙️',
      items: [
        { title: 'User Role Matrix', href: '/settings/roles', badge: 'Security' },
        { title: 'Activity Logs', href: '/settings/logs', badge: 'Audit' },
        { title: 'Tax Rule Setup', href: '/settings/tax', badge: 'Ghana' },
        { title: 'Mobile Money APIs', href: '/settings/mobile-money', badge: 'MTN/Voda' },
        { title: 'Localization', href: '/settings/localization', badge: 'Twi' },
        { title: 'GRA Templates', href: '/settings/gra', badge: 'Receipts' },
      ]
    }
  ];

  const handleSelectionChange = (keys: any) => {
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
                  <div className="flex items-center justify-between w-full">
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
