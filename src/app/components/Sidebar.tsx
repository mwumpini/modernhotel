'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button, Card, CardBody, Tooltip } from "@heroui/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  UsersIcon,
  CreditCardIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SparklesIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline';

interface SidebarProps {
  className?: string;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
}

interface NavGroup {
  label: string;
  items: {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Front Desk',
    items: [
      { title: 'Dashboard', href: '/', icon: HomeIcon },
      { title: 'Reservations', href: '/reservations', icon: CalendarIcon },
      { title: 'Check-In / Check-Out', href: '/guest-services/check-ins', icon: ArrowRightOnRectangleIcon },
      { title: 'Self Check-In', href: '/self-checkin', icon: SparklesIcon },
    ],
  },
  {
    label: 'Rooms',
    items: [
      { title: 'Room Status', href: '/room-status', icon: BuildingOfficeIcon },
      { title: 'Room Assignments', href: '/room-assignments', icon: ClipboardDocumentListIcon },
      { title: 'Housekeeping', href: '/housekeeping', icon: SparklesIcon },
    ],
  },
  {
    label: 'Guests',
    items: [
      { title: 'Guest Profiles', href: '/guests', icon: UsersIcon },
      { title: 'Billing Contacts', href: '/billing-persons', icon: CreditCardIcon },
      { title: 'Corporate Accounts', href: '/manage-clients', icon: UsersIcon },
    ],
  },
  {
    label: 'Finance',
    items: [
      { title: 'Accounting', href: '/accounting', icon: CalculatorIcon },
      { title: 'Reports', href: '/reports', icon: ChartBarIcon },
      { title: 'Analytics', href: '/analytics', icon: ChartBarIcon },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Inventory', href: '/tools-support', icon: CubeIcon },
      { title: 'Kitchen Display', href: '/kitchen-display', icon: ClipboardDocumentListIcon },
      { title: 'Events & Conferences', href: '/events-conferences', icon: CalendarIcon },
    ],
  },
  {
    label: 'System',
    items: [
      { title: 'Settings', href: '/settings', icon: Cog6ToothIcon },
    ],
  },
];

export default function Sidebar({ className = '', isMobileOpen = false, setIsMobileOpen }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const expanded = !isCollapsed || isHovered;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}

      <Card
        className={`h-screen sticky top-0 transition-all duration-300 ease-in-out ${
          isMobileOpen ? 'fixed left-0 z-50 lg:relative' : 'hidden lg:block'
        } ${expanded ? 'w-56' : 'w-14'} ${className}`}
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => isCollapsed && setIsHovered(false)}
      >
        <CardBody className="p-0 h-full flex flex-col overflow-hidden">

          {/* Header */}
          <div className={`flex items-center border-b border-gray-100 ${expanded ? 'px-4 py-3 justify-between' : 'px-2 py-3 justify-center'}`}>
            {expanded && <span className="text-sm font-semibold text-gray-700 truncate">Hotel Manager</span>}
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
            </Button>
          </div>

          {/* Nav Groups */}
          <nav className="flex-1 overflow-y-auto py-2">
            {navGroups.map((group) => (
              <div key={group.label} className="mb-1">
                {expanded && (
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Tooltip
                      key={item.href}
                      content={!expanded ? item.title : ''}
                      placement="right"
                      isDisabled={expanded}
                    >
                      <Button
                        variant={active ? 'flat' : 'light'}
                        color={active ? 'primary' : 'default'}
                        startContent={<Icon className="h-4 w-4 shrink-0" />}
                        onClick={() => { router.push(item.href); setIsMobileOpen?.(false); }}
                        className={`w-full rounded-none h-9 text-sm ${
                          expanded ? 'px-4 justify-start' : 'px-0 justify-center'
                        }`}
                      >
                        {expanded ? item.title : null}
                      </Button>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-100 p-2 text-center">
            <p className="text-[10px] text-gray-400">{expanded ? 'v1.0.0' : '🏨'}</p>
          </div>

        </CardBody>
      </Card>
    </>
  );
}
