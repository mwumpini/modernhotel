'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Button, 
  Card, 
  CardBody,
  Divider,
  Tooltip
} from "@heroui/react";
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  HomeIcon,
  CalendarIcon,
  RectangleStackIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  CreditCardIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
  ArrowRightOnRectangleIcon,
  StarIcon,
  DevicePhoneMobileIcon,
  CalculatorIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  className?: string;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navigationItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: HomeIcon,
    description: 'Main dashboard overview'
  },
  {
    title: 'Reservations',
    href: '/reservations',
    icon: CalendarIcon,
    description: 'Manage bookings and reservations'
  },
  {
    title: 'Rooms & Bookings',
    href: '/room-assignments',
    icon: RectangleStackIcon,
    description: 'View and manage room assignments'
  },
  {
    title: 'Room Management',
    href: '/room-status',
    icon: WrenchScrewdriverIcon,
    description: 'Track room status and maintenance'
  },
  {
    title: 'Manage Clients',
    href: '/manage-clients',
    icon: UsersIcon,
    description: 'Client profiles and management'
  },
  {
    title: 'Check-ins',
    href: '/guest-services/check-ins',
    icon: CalendarIcon,
    description: 'Guest check-in processing'
  },
  {
    title: 'In-House',
    href: '/guest-services/in-house',
    icon: HomeIcon,
    description: 'Current guest management'
  },
  {
    title: 'Check-outs',
    href: '/guest-services/check-outs',
    icon: ArrowRightOnRectangleIcon,
    description: 'Guest check-out processing'
  },
  {
    title: 'Guest Experience',
    href: '/guest-services/guest-experience',
    icon: UsersIcon,
    description: 'Guest satisfaction and services'
  },
  {
    title: 'Mobile Services',
    href: '/guest-services/mobile-services',
    icon: DevicePhoneMobileIcon,
    description: 'Mobile app guest services'
  },
  {
    title: 'Client Services',
    href: '/guest-services/client-services/clients-services',
    icon: UsersIcon,
    description: 'Manage clients and corporate accounts'
  },
  {
    title: 'Invoices & Payments',
    href: '/guest-services/client-services/invoices-payments',
    icon: CreditCardIcon,
    description: 'Billing and payment processing'
  },
  {
    title: 'Revenue Analytics',
    href: '/guest-services/revenue-analytics',
    icon: ChartBarIcon,
    description: 'Financial reporting and analysis'
  },
  {
    title: 'Payment Methods',
    href: '/settings?tab=payment-methods',
    icon: CreditCardIcon,
    description: 'Payment options and methods'
  },
  {
    title: 'Tax Management',
    href: '/settings?tab=tax-management',
    icon: CalculatorIcon,
    description: 'VAT and tax compliance'
  },
  {
    title: 'Tools & Templates',
    href: '/tools-support/tools-templates',
    icon: WrenchScrewdriverIcon,
    description: 'Operational tools and templates'
  },
  {
    title: 'View Activities',
    href: '/tools-support/view-activities',
    icon: ChartBarIcon,
    description: 'Activity logs and audit trails'
  },
  {
    title: 'Billing Persons',
    href: '/billing-persons',
    icon: CreditCardIcon,
    description: 'Manage corporate and third-party payers'
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: ChartBarIcon,
    description: 'Reports and analytics'
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Cog6ToothIcon,
    description: 'System configuration'
  }
];

export default function Sidebar({ className = '', isMobileOpen = false, setIsMobileOpen }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed by default
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleBack = () => {
    console.log(`[Sidebar] Going back to previous page`);
    router.back();
  };

  const handleNavigation = (href: string) => {
    console.log(`[Sidebar] Navigating to: ${href}`);
    router.push(href);
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}
      
      {/* Sidebar */}
      <Card 
        className={`h-screen sticky top-0 transition-all duration-300 ease-in-out ${
          isMobileOpen ? 'fixed left-0 z-50 lg:relative' : 'hidden lg:block'
        } ${isCollapsed && !isHovered ? 'w-14' : 'w-64'} ${className}`}
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => isCollapsed && setIsHovered(false)}
      >
        <CardBody className="p-0 h-full flex flex-col">
        {/* Header with Toggle Button */}
        <div className={`flex items-center justify-between border-b border-gray-200 ${
          isCollapsed && !isHovered ? 'p-2' : 'p-4'
        }`}>
          {(isCollapsed && isHovered) || !isCollapsed ? (
            <h2 className="text-lg font-semibold text-gray-800">Hotel Management</h2>
          ) : null}
          <div className="flex items-center space-x-2">
            {/* Mobile Close Button */}
            {isMobileOpen && (
              <Button
                isIconOnly
                variant="light"
                size="sm"
                onClick={() => setIsMobileOpen?.(false)}
                className="lg:hidden"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
            )}
            {/* Collapse Toggle Button */}
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={isCollapsed ? 'mx-auto' : 'ml-auto'}
            >
              {isCollapsed ? (
                <ChevronRightIcon className="h-4 w-4" />
              ) : (
                <ChevronLeftIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Back Button */}
        <div className={`border-b border-gray-200 ${
          isCollapsed && !isHovered ? 'p-2' : 'p-4'
        }`}>
          <Button
            variant="light"
            color="primary"
            startContent={<ArrowLeftIcon className="h-4 w-4" />}
            onClick={handleBack}
            className={`w-full ${isCollapsed && !isHovered ? 'px-2' : ''}`}
          >
            {(isCollapsed && isHovered) || !isCollapsed ? 'Back' : null}
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className={`flex-1 overflow-y-auto ${
          isCollapsed && !isHovered ? 'p-2 space-y-1' : 'p-4 space-y-2'
        }`}>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <Tooltip
                key={item.href}
                content={isCollapsed ? item.description : ''}
                placement="right"
                isDisabled={!isCollapsed}
              >
                                 <Button
                   variant={active ? 'solid' : 'light'}
                   color={active ? 'primary' : 'default'}
                   startContent={<Icon className="h-4 w-4" />}
                   onClick={() => handleNavigation(item.href)}
                   className={`w-full ${
                     isCollapsed && !isHovered ? 'px-2 justify-center' : 'px-4 justify-start'
                   } ${
                     active ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'
                   }`}
                 >
                   {(isCollapsed && isHovered) || !isCollapsed ? item.title : null}
                 </Button>
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer */}
        {(isCollapsed && isHovered) || !isCollapsed ? (
          <div className={`border-t border-gray-200 ${
            isCollapsed && isHovered ? 'p-2' : 'p-4'
          }`}>
            <div className="text-xs text-gray-500 text-center">
              <p>Hotel Management System</p>
              <p>v1.0.0</p>
            </div>
          </div>
        ) : (
          <div className="p-2 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              <p>🏨</p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
    </>
  );
}
