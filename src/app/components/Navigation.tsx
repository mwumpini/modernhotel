'use client';

import React, { Suspense, lazy } from 'react';
import { Button, Link, Accordion, AccordionItem, Badge, Divider, Card, CardBody, CardHeader, Progress, Avatar, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";

// Lazy load heavy components to prevent chunk loading errors
const FrontdeskDashboard = lazy(() => import('./FrontdeskDashboard'));
const ExecutiveManagementDashboard = lazy(() => import('./ExecutiveManagementDashboard'));
const HousekeepingMainDashboard = lazy(() => import('./HousekeepingMainDashboard'));
const FBPOS = lazy(() => import('./FBPOS').then(module => ({ default: module.default })));
const RestaurantManagement = lazy(() => import('./RestaurantManagement'));
const BarManagement = lazy(() => import('./BarManagement'));
const KitchenDisplay = lazy(() => import('./KitchenDisplay'));
const OfflineIndicator = lazy(() => import('./OfflineIndicator'));
const OfflineManager = lazy(() => import('./OfflineManager'));
const ActivityLog = lazy(() => import('./ActivityLog'));
const SystemSettingsMainDashboard = lazy(() => import('./SystemSettingsMainDashboard'));
const UnifiedRateManagement = lazy(() => import('./UnifiedRateManagement'));
const UserPreferences = lazy(() => import('./UserPreferences'));
const AutoComplianceMainDashboard = lazy(() => import('./AutoComplianceMainDashboard'));
const AccountingMainDashboard = lazy(() => import('./AccountingMainDashboard'));
const UserManagement = lazy(() => import('./UserManagement'));
const UserManagementUnified = lazy(() => import('./UserManagementUnified'));
const ThemeTest = lazy(() => import('./ThemeTest'));
const FrontofficeRoomsBookings = lazy(() => import('./FrontofficeRoomsBookings'));
const FrontofficeClientsServices = lazy(() => import('./FrontofficeClientsServices'));
const FrontofficeEventsConferences = lazy(() => import('./FrontofficeEventsConferences'));
const EventsConferencesMainDashboard = lazy(() => import('./EventsConferencesMainDashboard'));
const RoomManagementDashboard = lazy(() => import('./RoomManagementDashboard'));
const GuestExperienceManager = lazy(() => import('./GuestExperienceManager'));
const MobileGuestServices = lazy(() => import('./MobileGuestServices'));
const HRMainDashboard = lazy(() => import('./HRMainDashboard'));
const SecurityMainDashboard = lazy(() => import('./SecurityMainDashboard'));
const SecurityComplianceDashboard = lazy(() => import('./SecurityComplianceDashboard'));
const StoresMainDashboard = lazy(() => import('./StoresMainDashboard'));
const UserManagementDashboard = lazy(() => import('./UserManagementDashboard'));
const OfflineManagementDashboard = lazy(() => import('./OfflineManagementDashboard'));
const APIIntegrationDashboard = lazy(() => import('./APIIntegrationDashboard'));
const PerformanceOptimizationDashboard = lazy(() => import('./PerformanceOptimizationDashboard'));
const TemplateBuilder = lazy(() => import('./TemplateBuilder'));
const FoodBeverageMainDashboard = lazy(() => import('./FoodBeverageMainDashboard'));
const FoodBeverageRestaurantBar = lazy(() => import('./FoodBeverageRestaurantBar'));
const FoodBeverageKitchen = lazy(() => import('./FoodBeverageKitchen'));
const FoodBeverageMenuInventory = lazy(() => import('./FoodBeverageMenuInventory'));
const FoodBeverageStaffReports = lazy(() => import('./FoodBeverageStaffReports'));
const FoodBeverageAnalyticsDashboard = lazy(() => import('./FoodBeverageAnalyticsDashboard'));
const HousekeepingAnalyticsDashboard = lazy(() => import('./HousekeepingAnalyticsDashboard'));
const InventoryAnalyticsDashboard = lazy(() => import('./InventoryAnalyticsDashboard'));
const SecurityAnalyticsDashboard = lazy(() => import('./SecurityAnalyticsDashboard'));
const HRAnalyticsDashboard = lazy(() => import('./HRAnalyticsDashboard'));
const DepartmentActivityLog = lazy(() => import('./DepartmentActivityLog').then(module => ({ default: module.default })));
const RoomConfigurationDashboard = lazy(() => import('./RoomConfigurationDashboard'));
const FrontOfficeReportsAnalysis = lazy(() => import('./FrontOfficeReportsAnalysis'));

// Lazy load accounting components
const ChartOfAccountsPage = lazy(() => import('./accounting/ChartOfAccounts'));
const BankCashReceivablesPage = lazy(() => import('./accounting/BankCashReceivables'));
const AccountsPayablePage = lazy(() => import('./accounting/AccountsPayable'));
const InventoryFixedAssetsPage = lazy(() => import('./accounting/InventoryFixedAssets'));
const FinancialReportsPage = lazy(() => import('./accounting/FinancialReports'));
const AuditControlsPage = lazy(() => import('./accounting/AuditControls'));
const AccountingViewActivitiesPage = lazy(() => import('./accounting/ViewActivities'));

interface NavigationProps {
  onLogout: () => void;
}

type ActiveSection = 'dashboard' | 'frontdesk' | 'housekeeping' | 'f&b' | 'restaurant' | 'kitchen' | 'pos' | 'security' | 'hr' | 'accounting' | 'settings' | 'user-preferences' | 'compliance' | 'inventory' | 'user-management' | 'user-management-dashboard' | 'user-management-unified' | 'theme-test' | 'offline-management' | 'api-integration' | 'performance-optimization' | 'template-builder' | 'rooms-bookings' | 'invoices-payments' | 'clients-services' | 'events-conferences' | 'events-conferences-standalone' | 'events-conferences-analytics' | 'events-conferences-preferences' | 'room-management' | 'guest-experience-manager' | 'mobile-guest-services' | 'food-beverage' | 'fb-analytics' | 'fb-preferences' | 'accounting-management' | 'hr-payroll-management' | 'security-compliance' | 'inventory-supply-chain' | 'reports-analytics' | 'fb-pos' | 'fb-restaurant-bar' | 'fb-kitchen' | 'fb-menu-inventory' | 'fb-staff-reports' | 'housekeeping-analytics' | 'housekeeping-preferences' | 'inventory-analytics' | 'inventory-preferences' | 'security-analytics' | 'security-preferences' | 'hr-analytics' | 'hr-preferences' | 'frontdesk-activities' | 'fb-activities' | 'housekeeping-activities' | 'inventory-activities' | 'security-activities' | 'hr-activities' | 'accounting-activities' | 'chart-of-accounts' | 'bank-cash-receivables' | 'accounts-payable' | 'inventory-fixed-assets' | 'financial-reports' | 'audit-controls' | 'check-ins' | 'in-house' | 'check-outs' | 'room-configuration' | 'rate-management';
export default function Navigation({ onLogout }: NavigationProps) {
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(new Set(['dashboard']));
  const [activeSection, setActiveSection] = React.useState<ActiveSection>('dashboard');

  // Log navigation component initialization and state changes
  React.useEffect(() => {
    console.log('Navigation component initialized with default section:', activeSection);
  }, []);

  React.useEffect(() => {
    console.log('Active section changed to:', activeSection);
  }, [activeSection]);

  React.useEffect(() => {
    console.log('Expanded keys changed:', Array.from(expandedKeys));
  }, [expandedKeys]);


  const getUnreadCount = (dept: string) => {
    try {
      const { announcementStore } = require('../lib/analytics/announcementStore');
      const items = announcementStore.getForDepartment(dept as any, 50);
      const last = localStorage.getItem(`ann.lastSeen.${dept}`);
      if (!last) return items.length;
      return items.filter((m: any) => m.at > last).length;
    } catch {
      return 0;
    }
  };

  const navigationSections = [
    {
      key: 'dashboard',
      title: '🏛️ Executive Management',
      icon: '📊',
      items: [
        { title: 'Main Dashboard', href: '#' }
      ]
    },
    {
      key: 'frontdesk',
      title: `🏨 Front Office Operations${getUnreadCount('frontdesk') ? ` (${getUnreadCount('frontdesk')})` : ''}`,
      icon: '🏨',
                                                               items: [
                    { title: '📊 Operations', href: '#' },
                    { title: '📈 Reports & Analysis', href: '/reports' },
                    { title: '📊 Analytics Dashboard', href: '/analytics' },
                    { title: '⚙️ User Preferences', href: '#' },
                  ]
    },
    {
      key: 'events-conferences',
      title: '🎪 Events & Conferences',
      icon: '🎪',
      items: [
        { title: '📊 Operations', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '⚙️ User Preferences', href: '#' },
      ]
    },
    {
      key: 'f&b',
      title: '🍽️ Food & Beverage',
      icon: '🍽️',
      items: [
        { title: 'R&B Operations', href: '#' },
        { title: 'Kitchen Operations', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '⚙️ User Preferences', href: '#' },
      ]
    },
    {
      key: 'housekeeping',
      title: `🛏️ Housekeeping & Maintenance${getUnreadCount('housekeeping') ? ` (${getUnreadCount('housekeeping')})` : ''}`,
      icon: '🛏️',
      items: [
        { title: '🏠 Main Dashboard', href: '/housekeeping' },
      ]
    },
    {
      key: 'inventory',
      title: `📦 Inventory & Stores${getUnreadCount('inventory') ? ` (${getUnreadCount('inventory')})` : ''}`,
      icon: '📦',
      items: [
        { title: '📊 Operations', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '⚙️ User Preferences', href: '#' },
      ]
    },
    {
      key: 'security',
      title: `🚨 Security Operations${getUnreadCount('security') ? ` (${getUnreadCount('security')})` : ''}`,
      icon: '🚨',
      items: [
        { title: '📊 Operations', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '⚙️ User Preferences', href: '#' },
      ]
    },
    {
      key: 'hr',
      title: `👥 HR & Payroll${getUnreadCount('hr') ? ` (${getUnreadCount('hr')})` : ''}`,
      icon: '👥',
      items: [
        { title: '📊 Operations', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '⚙️ User Preferences', href: '#' },
      ]
    },
    {
      key: 'accounting',
      title: '🧾 Complete Accounting System',
      icon: '🧾',
      items: [
        { title: 'Accounting Management', href: '#' },
        { title: 'Chart of Accounts', href: '#' },
        { title: 'Bank, Cash & Receivables', href: '#' },
        { title: 'Accounts Payable', href: '#' },
        { title: 'Inventory & Fixed Assets', href: '#' },
        { title: 'Financial Reports', href: '#' },
        { title: 'Audit & Controls', href: '#' },
        { title: 'View Activities', href: '#' },
      ]
    },
    {
      key: 'compliance',
      title: '⚖️ Compliance & Reports',
      icon: '⚖️',
      items: [
        { title: 'Tax Calculator & Rules', href: '#' },
        { title: 'VAT/NHIL Returns', href: '#' },
        { title: 'Tourism Levy & SSNIT', href: '#' },
        { title: 'Operational Reports', href: '#' },
      ]
    },
    {
      key: 'settings',
      title: '⚙️ System Settings',
      icon: '⚙️',
      items: [
        { title: 'Rate Management', href: '#' },
        { title: 'Reports & Analytics', href: '#' },
        { title: 'User Management & Preferences', href: '#' },
        { title: 'Theme Test', href: '#' },
        { title: 'Offline Management & Sync', href: '#' },
        { title: 'API Integration', href: '#' },
        { title: 'Performance Optimization', href: '#' },
        { title: 'Template Builder', href: '#' },
        { title: 'Activity Logs', href: '#' },
        { title: 'Tax Rules & APIs', href: '#' },
        { title: 'Localization & Templates', href: '#' },
      ]
    }
  ];

  const handleSelectionChange = (keys: any) => {
    // Handle both Set<string> and Selection types
    if (keys instanceof Set) {
      setExpandedKeys(keys);
    } else if (typeof keys === 'string') {
      setExpandedKeys(new Set([keys]));
    } else if (Array.isArray(keys)) {
      setExpandedKeys(new Set(keys));
    } else {
      setExpandedKeys(new Set(['dashboard']));
    }
  };

  // Allow deep-links/navigation triggers from inner modules (e.g., POS → Kitchen Orders)
  React.useEffect(() => {
    const handler = (ev: Event) => {
      try {
        const customEv = ev as CustomEvent<{ section?: string }>;
        const section = customEv?.detail?.section as ActiveSection | undefined;
        if (section) setActiveSection(section);
      } catch {}
    };
    window.addEventListener('app.navigate', handler);
    return () => {
      window.removeEventListener('app.navigate', handler);
    };
  }, []);

  const handleSectionClick = (sectionKey: string, itemTitle?: string) => {
    // If no itemTitle is provided, it means the main section header was clicked
    // This should navigate to the dashboard for that section
    if (!itemTitle) {
      setActiveSection(sectionKey as ActiveSection);
      return;
    }

    // Handle Front Office sub-items
    if (sectionKey === 'frontdesk' && itemTitle) {
              if (itemTitle === '📊 Operations') {
          setActiveSection('frontdesk');
        } else if (itemTitle === '📈 Reports & Analysis') {
          setActiveSection('reports-analytics');
        } else if (itemTitle === '⚙️ User Preferences') {
          setActiveSection('user-preferences');
        } else {
          setActiveSection('frontdesk');
        }
    // Handle Events & Conferences sub-items
    } else if (sectionKey === 'events-conferences' && itemTitle) {
      if (itemTitle === '📊 Operations') {
        setActiveSection('events-conferences-standalone');
      } else if (itemTitle === '📈 Reports & Analysis') {
        setActiveSection('events-conferences-analytics');
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('events-conferences-preferences');
      } else {
        setActiveSection('events-conferences-standalone');
      }
    // Handle Food & Beverage sub-items
    } else if (sectionKey === 'f&b' && itemTitle) {
      if (itemTitle === 'R&B Operations') {
        setActiveSection('food-beverage');
      } else if (itemTitle === 'Kitchen Operations') {
        setActiveSection('fb-kitchen');
      } else if (itemTitle === '📈 Reports & Analysis') {
        setActiveSection('fb-analytics');
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('fb-preferences');
      } else {
        setActiveSection('f&b');
      }
    // Handle Housekeeping sub-items
    } else if (sectionKey === 'housekeeping' && itemTitle) {
      if (itemTitle === '📊 Operations') {
        setActiveSection('housekeeping');
      } else if (itemTitle === '📈 Reports & Analysis') {
        setActiveSection('housekeeping-analytics');
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('housekeeping-preferences');
      } else {
        setActiveSection('housekeeping');
      }
    // Handle Security sub-items
    } else if (sectionKey === 'security' && itemTitle) {
      if (itemTitle === '📊 Operations') {
        setActiveSection('security');
      } else if (itemTitle === '📈 Reports & Analysis') {
        setActiveSection('security-analytics');
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('security-preferences');
      } else {
        setActiveSection('security');
      }
    // Handle Inventory sub-items
    } else if (sectionKey === 'inventory' && itemTitle) {
      if (itemTitle === '📊 Operations') {
        setActiveSection('inventory');
      } else if (itemTitle === '📈 Reports & Analysis') {
        setActiveSection('inventory-analytics');
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('inventory-preferences');
      } else {
        setActiveSection('inventory');
      }
    // Handle HR sub-items
    } else if (sectionKey === 'hr' && itemTitle) {
      if (itemTitle === '📊 Operations') {
        setActiveSection('hr');
      } else if (itemTitle === '📈 Reports & Analysis') {
        setActiveSection('hr-analytics');
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('hr-preferences');
      } else {
        setActiveSection('hr');
      }
    } else if (sectionKey === 'room-configuration' && itemTitle) {
      if (itemTitle === 'Room Types & Categories') {
        setActiveSection('room-configuration');
      } else if (itemTitle === 'Room Amenities') {
        setActiveSection('room-configuration');
      } else if (itemTitle === 'Rate Configuration') {
        setActiveSection('room-configuration');
      } else if (itemTitle === '🎯 Event & Conference Rates') {
        setActiveSection('room-configuration');
      } else if (itemTitle === 'Bulk Room Creation') {
        setActiveSection('room-configuration');
      } else {
        setActiveSection('room-configuration');
      }
    } else if (sectionKey === 'compliance') {
      setActiveSection('compliance');
    } else if (sectionKey === 'accounting' && itemTitle) {
      if (itemTitle === 'Accounting Management') {
        setActiveSection('accounting-management');
      } else if (itemTitle === 'Chart of Accounts') {
        setActiveSection('chart-of-accounts');
      } else if (itemTitle === 'Bank, Cash & Receivables') {
        setActiveSection('bank-cash-receivables');
      } else if (itemTitle === 'Accounts Payable') {
        setActiveSection('accounts-payable');
      } else if (itemTitle === 'Inventory & Fixed Assets') {
        setActiveSection('inventory-fixed-assets');
      } else if (itemTitle === 'Financial Reports') {
        setActiveSection('financial-reports');
      } else if (itemTitle === 'Audit & Controls') {
        setActiveSection('audit-controls');
      } else if (itemTitle === 'View Activities') {
        setActiveSection('accounting-activities');
      } else {
        setActiveSection('accounting');
      }
    } else if (sectionKey === 'housekeeping' && itemTitle) {
      if (itemTitle === 'Analytics Dashboard') {
        setActiveSection('housekeeping-analytics');
      } else if (itemTitle === 'View Activities') {
        setActiveSection('housekeeping-activities');
      } else {
        setActiveSection('housekeeping');
      }
    } else if (sectionKey === 'inventory' && itemTitle) {
      if (itemTitle === 'Analytics Dashboard') {
        setActiveSection('inventory-analytics');
      } else if (itemTitle === 'View Activities') {
        setActiveSection('inventory-activities');
      } else {
        setActiveSection('inventory');
      }
    } else if (sectionKey === 'settings' && itemTitle) {
      if (itemTitle === 'Rate Management') {
        setActiveSection('rate-management');
      } else if (itemTitle === 'Reports & Analytics') {
        setActiveSection('reports-analytics');
      } else if (itemTitle === 'User Management & Preferences') {
        setActiveSection('user-management-unified');
      } else if (itemTitle === 'Room Configuration') {
        setActiveSection('room-configuration');
      } else if (itemTitle === 'Theme Test') {
        setActiveSection('theme-test');
      } else if (itemTitle === 'Offline Management & Sync') {
        setActiveSection('offline-management');
      } else if (itemTitle === 'API Integration') {
        setActiveSection('api-integration');
      } else if (itemTitle === 'Performance Optimization') {
        setActiveSection('performance-optimization');
      } else if (itemTitle === 'Template Builder') {
        setActiveSection('template-builder');
      } else {
        setActiveSection('settings');
      }
    } else {
      setActiveSection(sectionKey as ActiveSection);
    }
  };

  const renderDashboardContent = () => {
    switch (activeSection) {
      case 'frontdesk':
        return <Suspense fallback={<div className="p-6 text-center">Loading Front Desk Dashboard...</div>}><FrontdeskDashboard /></Suspense>;
      case 'frontdesk-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading Front Desk Activities...</div>}><DepartmentActivityLog area="frontdesk" title="Front Office - View Activities" /></Suspense>;
      case 'rooms-bookings':
        return <Suspense fallback={<div className="p-6 text-center">Loading Rooms & Bookings...</div>}><FrontofficeRoomsBookings /></Suspense>;
      case 'invoices-payments':
        return <Suspense fallback={<div className="p-6 text-center">Redirecting...</div>}>
          <div className="p-6 text-center">
            <p>Redirecting to Invoices & Payments...</p>
            <Button color="primary" onPress={() => window.location.href = '/guest-services/check-ins?tab=billing'}>
              Go to Invoices & Payments
            </Button>
          </div>
        </Suspense>;
      case 'clients-services':
        return <Suspense fallback={<div className="p-6 text-center">Loading Clients & Services...</div>}><FrontofficeClientsServices /></Suspense>;
      case 'events-conferences':
        return <Suspense fallback={<div className="p-6 text-center">Loading Events & Conferences...</div>}><EventsConferencesMainDashboard /></Suspense>;
      case 'events-conferences-standalone':
        return <Suspense fallback={<div className="p-6 text-center">Loading Events & Conferences...</div>}><EventsConferencesMainDashboard /></Suspense>;
      case 'room-management':
        return <Suspense fallback={<div className="p-6 text-center">Loading Room Management...</div>}><RoomManagementDashboard /></Suspense>;

      case 'check-ins':
        return <Suspense fallback={<div className="p-6 text-center">Redirecting...</div>}>
          <div className="p-6 text-center">
            <p>Redirecting to Check-ins & Check-Ins Management...</p>
            <Button color="primary" onPress={() => window.location.href = '/guest-services/check-ins?tab=checkins'}>
              Go to Check-Ins Management
            </Button>
          </div>
        </Suspense>;
      case 'check-outs':
        return <Suspense fallback={<div className="p-6 text-center">Redirecting...</div>}>
          <div className="p-6 text-center">
            <p>Redirecting to Check-outs...</p>
            <Button color="primary" onPress={() => window.location.href = '/guest-services/check-ins?tab=checkouts'}>
              Go to Check-outs
            </Button>
          </div>
        </Suspense>;
      case 'guest-experience-manager':
        return <Suspense fallback={<div className="p-6 text-center">Loading Guest Experience Manager...</div>}><GuestExperienceManager /></Suspense>;
      case 'mobile-guest-services':
        return <Suspense fallback={<div className="p-6 text-center">Loading Mobile Guest Services...</div>}><MobileGuestServices /></Suspense>;
      case 'food-beverage':
        return <Suspense fallback={<div className="p-6 text-center">Loading Food & Beverage Dashboard...</div>}><FoodBeverageMainDashboard /></Suspense>;
      case 'accounting-management':
        return <Suspense fallback={<div className="p-6 text-center">Loading Accounting Dashboard...</div>}><AccountingMainDashboard /></Suspense>;
      case 'hr-payroll-management':
        return <Suspense fallback={<div className="p-6 text-center">Loading HR Dashboard...</div>}><HRMainDashboard /></Suspense>;
      case 'security-compliance':
        return <Suspense fallback={<div className="p-6 text-center">Loading Security Dashboard...</div>}><SecurityComplianceDashboard /></Suspense>;
      case 'inventory-supply-chain':
        return <Suspense fallback={<div className="p-6 text-center">Loading Inventory Dashboard...</div>}><StoresMainDashboard /></Suspense>;
      case 'reports-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading Reports & Analytics...</div>}><FrontOfficeReportsAnalysis /></Suspense>;
      case 'user-management-dashboard':
        return <Suspense fallback={<div className="p-6 text-center">Loading User Management Dashboard...</div>}><UserManagementDashboard /></Suspense>;
      case 'user-management-unified':
        return <Suspense fallback={<div className="p-6 text-center">Loading User Management...</div>}><UserManagementUnified /></Suspense>;
      case 'theme-test':
        return <Suspense fallback={<div className="p-6 text-center">Loading Theme Test...</div>}><ThemeTest /></Suspense>;
      case 'offline-management':
        return <Suspense fallback={<div className="p-6 text-center">Loading Offline Management...</div>}><OfflineManagementDashboard /></Suspense>;
      case 'api-integration':
        return <Suspense fallback={<div className="p-6 text-center">Loading API Integration...</div>}><APIIntegrationDashboard /></Suspense>;
      case 'performance-optimization':
        return <Suspense fallback={<div className="p-6 text-center">Loading Performance Optimization...</div>}><PerformanceOptimizationDashboard /></Suspense>;
      case 'template-builder':
        return <Suspense fallback={<div className="p-6 text-center">Loading Template Builder...</div>}><TemplateBuilder /></Suspense>;
      case 'housekeeping':
        return <Suspense fallback={<div className="p-6 text-center">Loading Housekeeping Dashboard...</div>}><HousekeepingMainDashboard /></Suspense>;
      case 'housekeeping-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading Housekeeping Analytics...</div>}><HousekeepingAnalyticsDashboard /></Suspense>;
      case 'f&b':
        return <Suspense fallback={<div className="p-6 text-center">Loading Food & Beverage Dashboard...</div>}><FoodBeverageMainDashboard /></Suspense>;
      case 'fb-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading Food & Beverage Activities...</div>}><DepartmentActivityLog area="f&b" title="Food & Beverage - View Activities" /></Suspense>;
      case 'fb-pos':
        return <Suspense fallback={<div className="p-6 text-center">Loading POS Terminal...</div>}><FBPOS onClose={() => setActiveSection('f&b')} /></Suspense>;
      case 'fb-restaurant-bar':
        return <Suspense fallback={<div className="p-6 text-center">Loading Restaurant & Bar...</div>}><FoodBeverageRestaurantBar /></Suspense>;
      case 'fb-kitchen':
        return <Suspense fallback={<div className="p-6 text-center">Loading Kitchen Display...</div>}><FoodBeverageKitchen /></Suspense>;
      case 'fb-menu-inventory':
        return <Suspense fallback={<div className="p-6 text-center">Loading Menu & Inventory...</div>}><FoodBeverageMenuInventory /></Suspense>;
      case 'fb-staff-reports':
        return <Suspense fallback={<div className="p-6 text-center">Loading Staff Reports...</div>}><FoodBeverageStaffReports /></Suspense>;
      case 'fb-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading Food & Beverage Analytics...</div>}><FoodBeverageAnalyticsDashboard /></Suspense>;
      case 'pos':
        return <Suspense fallback={<div className="p-6 text-center">Loading POS Terminal...</div>}><FBPOS onClose={() => setActiveSection('f&b')} /></Suspense>;
      case 'restaurant':
        return <Suspense fallback={<div className="p-6 text-center">Loading Restaurant Management...</div>}><RestaurantManagement /></Suspense>;
      case 'kitchen':
        return <Suspense fallback={<div className="p-6 text-center">Loading Kitchen Display...</div>}><KitchenDisplay /></Suspense>;
      case 'security':
        return <Suspense fallback={<div className="p-6 text-center">Loading Security Dashboard...</div>}><SecurityMainDashboard /></Suspense>;
      case 'security-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading Security Analytics...</div>}><SecurityAnalyticsDashboard /></Suspense>;
      case 'security-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading Security Activities...</div>}><DepartmentActivityLog area="security" title="Security - View Activities" /></Suspense>;
      case 'hr':
        return <Suspense fallback={<div className="p-6 text-center">Loading HR Dashboard...</div>}><HRMainDashboard /></Suspense>;
      case 'hr-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading HR Analytics...</div>}><HRAnalyticsDashboard /></Suspense>;
      case 'hr-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading HR Activities...</div>}><DepartmentActivityLog area="hr" title="HR & Payroll - View Activities" /></Suspense>;
      case 'room-configuration':
        return <Suspense fallback={<div className="p-6 text-center">Loading Room Configuration...</div>}><RoomConfigurationDashboard /></Suspense>;
      case 'accounting':
        return <Suspense fallback={<div className="p-6 text-center">Loading Accounting Dashboard...</div>}><AccountingMainDashboard /></Suspense>;
      case 'chart-of-accounts':
        return <Suspense fallback={<div className="p-6 text-center">Loading Chart of Accounts...</div>}><ChartOfAccountsPage /></Suspense>;
      case 'bank-cash-receivables':
        return <Suspense fallback={<div className="p-6 text-center">Loading Bank & Cash Receivables...</div>}><BankCashReceivablesPage /></Suspense>;
      case 'accounts-payable':
        return <Suspense fallback={<div className="p-6 text-center">Loading Accounts Payable...</div>}><AccountsPayablePage /></Suspense>;
      case 'inventory-fixed-assets':
        return <Suspense fallback={<div className="p-6 text-center">Loading Inventory & Fixed Assets...</div>}><InventoryFixedAssetsPage /></Suspense>;
      case 'financial-reports':
        return <Suspense fallback={<div className="p-6 text-center">Loading Financial Reports...</div>}><FinancialReportsPage /></Suspense>;
      case 'audit-controls':
        return <Suspense fallback={<div className="p-6 text-center">Loading Audit Controls...</div>}><AuditControlsPage /></Suspense>;
      case 'accounting-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading Accounting Activities...</div>}><DepartmentActivityLog area="accounting" title="Accounting - View Activities" /></Suspense>;
      case 'rate-management':
        return <Suspense fallback={<div className="p-6 text-center">Loading Rate Management...</div>}><UnifiedRateManagement onClose={() => setActiveSection('settings')} /></Suspense>;
      case 'settings':
        return <Suspense fallback={<div className="p-6 text-center">Loading System Settings...</div>}><SystemSettingsMainDashboard /></Suspense>;
      case 'user-preferences':
        return <Suspense fallback={<div className="p-6 text-center">Loading User Preferences...</div>}><UserPreferences /></Suspense>;
      case 'user-management':
        return <Suspense fallback={<div className="p-6 text-center">Loading User Management...</div>}><UserManagement /></Suspense>;
      case 'compliance':
        return <Suspense fallback={<div className="p-6 text-center">Loading Compliance Dashboard...</div>}><AutoComplianceMainDashboard /></Suspense>;
      case 'inventory':
        return <Suspense fallback={<div className="p-6 text-center">Loading Inventory Dashboard...</div>}><StoresMainDashboard /></Suspense>;
      case 'inventory-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading Inventory Analytics...</div>}><InventoryAnalyticsDashboard /></Suspense>;
      case 'inventory-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading Inventory Activities...</div>}><DepartmentActivityLog area="inventory" title="Inventory - View Activities" /></Suspense>;
      case 'dashboard':
      default:
        return <Suspense fallback={<div className="p-6 text-center">Loading Executive Dashboard...</div>}><ExecutiveManagementDashboard /></Suspense>;
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
              <Badge color="primary" variant="flat" size="sm" className="mt-1">Executive</Badge>
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
                    onClick={() => handleSectionClick(section.key, undefined)}
                  >
                    <div className="flex items-center">
                      <span className="text-lg mr-3">{section.icon}</span>
                    <span className="font-semibold text-ghana-black mr-2">
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
                             onClick={() => handleSectionClick(section.key, item.title)}
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
            <Button
              variant="flat"
              className="w-full mt-2 bg-ghana-green text-white"
              size="sm"
              onClick={() => {
                try {
                  const ev = new CustomEvent('open-messenger');
                  window.dispatchEvent(ev);
                } catch {}
              }}
            >
              Open Messenger (Ctrl+M)
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
