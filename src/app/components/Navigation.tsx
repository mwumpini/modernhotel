'use client';

import React from 'react';
import { Button, Link, Accordion, AccordionItem, Badge, Divider, Card, CardBody, CardHeader, Progress, Avatar, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import FrontdeskDashboard from './FrontdeskDashboard';
import HousekeepingDashboard from './HousekeepingDashboard';
import FoodBeverageDashboard from './FoodBeverageDashboard';
import FBPOS from './FBPOS';
import RestaurantManagement from './RestaurantManagement';
import BarManagement from './BarManagement';
import KitchenDisplay from './KitchenDisplay';
import SecurityDashboard from './SecurityDashboard';
import HRPayrollDashboard from './HRPayrollDashboard';
import OfflineIndicator from './OfflineIndicator';
import OfflineManager from './OfflineManager';
import ActivityLog from './ActivityLog';
import SettingsDashboard from './SettingsDashboard';
import StoresManagement from './StoresManagement';
import UserPreferences from './UserPreferences';
import AutoComplianceDashboard from './AutoComplianceDashboard';
import InventoryDashboard from './InventoryDashboard';
import AccountingDashboard from './AccountingDashboard';
import UserManagement from './UserManagement';
import UserManagementUnified from './UserManagementUnified';
import ThemeTest from './ThemeTest';
import FrontofficeRoomsBookings from './FrontofficeRoomsBookings';
import FrontofficeInvoicesPayments from './FrontofficeInvoicesPayments';
import FrontofficeClientsServices from './FrontofficeClientsServices';
import FrontofficeEventsConferences from './FrontofficeEventsConferences';
// duplicate import removed
import RoomManagementDashboard from './RoomManagementDashboard';
import GuestExperienceManager from './GuestExperienceManager';
import MobileGuestServices from './MobileGuestServices';
import FoodBeverageManagementDashboard from './FoodBeverageManagementDashboard';
import AccountingManagementDashboard from './AccountingManagementDashboard';
import HRPayrollManagementDashboard from './HRPayrollManagementDashboard';
import SecurityComplianceDashboard from './SecurityComplianceDashboard';
import InventorySupplyChainDashboard from './InventorySupplyChainDashboard';
// Removed unused import
import UserManagementDashboard from './UserManagementDashboard';
import OfflineManagementDashboard from './OfflineManagementDashboard';
import APIIntegrationDashboard from './APIIntegrationDashboard';
import PerformanceOptimizationDashboard from './PerformanceOptimizationDashboard';
import TemplateBuilder from './TemplateBuilder';
import FoodBeverageRestaurantBar from './FoodBeverageRestaurantBar';
import FoodBeverageKitchen from './FoodBeverageKitchen';
import FoodBeverageMenuInventory from './FoodBeverageMenuInventory';
import FoodBeverageStaffReports from './FoodBeverageStaffReports';
import FoodBeverageAnalyticsDashboard from './FoodBeverageAnalyticsDashboard';
import HousekeepingAnalyticsDashboard from './HousekeepingAnalyticsDashboard';
import InventoryAnalyticsDashboard from './InventoryAnalyticsDashboard';
import SecurityAnalyticsDashboard from './SecurityAnalyticsDashboard';
import HRAnalyticsDashboard from './HRAnalyticsDashboard';
import DepartmentActivityLog from './DepartmentActivityLog';
import { 
  ChartOfAccountsPage,
  BankCashReceivablesPage,
  AccountsPayablePage,
  InventoryFixedAssetsPage,
  FinancialReportsPage,
  AuditControlsPage,
  AccountingViewActivitiesPage
} from './accounting';

interface NavigationProps {
  onLogout: () => void;
}

type ActiveSection = 'dashboard' | 'frontdesk' | 'housekeeping' | 'f&b' | 'restaurant' | 'kitchen' | 'pos' | 'security' | 'hr' | 'accounting' | 'settings' | 'user-preferences' | 'compliance' | 'inventory' | 'user-management' | 'user-management-dashboard' | 'user-management-unified' | 'theme-test' | 'offline-management' | 'api-integration' | 'performance-optimization' | 'template-builder' | 'rooms-bookings' | 'invoices-payments' | 'clients-services' | 'events-conferences' | 'events-conferences-standalone' | 'events-conferences-analytics' | 'events-conferences-preferences' | 'room-management' | 'front-office-operations' | 'guest-experience-manager' | 'mobile-guest-services' | 'food-beverage' | 'fb-analytics' | 'fb-preferences' | 'accounting-management' | 'hr-payroll-management' | 'security-compliance' | 'inventory-supply-chain' | 'reports-analytics' | 'fb-pos' | 'fb-restaurant-bar' | 'fb-kitchen' | 'fb-menu-inventory' | 'fb-staff-reports' | 'housekeeping-analytics' | 'housekeeping-preferences' | 'inventory-analytics' | 'inventory-preferences' | 'security-analytics' | 'security-preferences' | 'hr-analytics' | 'hr-preferences' | 'frontdesk-activities' | 'fb-activities' | 'housekeeping-activities' | 'inventory-activities' | 'security-activities' | 'hr-activities' | 'accounting-activities' | 'chart-of-accounts' | 'bank-cash-receivables' | 'accounts-payable' | 'inventory-fixed-assets' | 'financial-reports' | 'audit-controls' | 'check-ins' | 'in-house' | 'check-outs';
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
      title: '🛏️ Housekeeping & Maintenance',
      icon: '🛏️',
      items: [
        { title: '📊 Operations', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '⚙️ User Preferences', href: '#' },
      ]
    },
    {
      key: 'inventory',
      title: '📦 Inventory & Stores',
      icon: '📦',
      items: [
        { title: '📊 Operations', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '⚙️ User Preferences', href: '#' },
      ]
    },
    {
      key: 'security',
      title: '🚨 Security Operations',
      icon: '🚨',
      items: [
        { title: '📊 Operations', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '⚙️ User Preferences', href: '#' },
      ]
    },
    {
      key: 'hr',
      title: '👥 HR & Payroll',
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
          setActiveSection('front-office-operations');
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
      if (itemTitle === 'Reports & Analytics') {
        setActiveSection('reports-analytics');
      } else if (itemTitle === 'User Management & Preferences') {
        setActiveSection('user-management-unified');
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
        return <FrontdeskDashboard />;
      case 'frontdesk-activities':
        return <DepartmentActivityLog area="frontdesk" title="Front Office - View Activities" />;
      case 'rooms-bookings':
        return <FrontofficeRoomsBookings />;
      case 'invoices-payments':
        return <FrontofficeInvoicesPayments />;
      case 'clients-services':
        return <FrontofficeClientsServices />;
      case 'events-conferences':
        return <FrontofficeEventsConferences />;
      case 'events-conferences-standalone':
        return <FrontofficeEventsConferences />;
      case 'room-management':
        return <RoomManagementDashboard />;
              case 'front-office-operations':
          return <FrontdeskDashboard />;
      case 'check-ins':
      case 'in-house':
      case 'check-outs':
        return <FrontdeskDashboard />;
      case 'guest-experience-manager':
        return <GuestExperienceManager />;
      case 'mobile-guest-services':
        return <MobileGuestServices />;
      case 'food-beverage':
        return <FoodBeverageManagementDashboard />;
      case 'accounting-management':
        return <AccountingManagementDashboard />;
      case 'hr-payroll-management':
        return <HRPayrollManagementDashboard />;
      case 'security-compliance':
        return <SecurityComplianceDashboard />;
      case 'inventory-supply-chain':
        return <InventorySupplyChainDashboard />;
      case 'reports-analytics':
        return <FrontOfficeReportsAnalysis />;
      case 'user-management-dashboard':
        return <UserManagementDashboard />;
      case 'user-management-unified':
        return <UserManagementUnified />;
      case 'theme-test':
        return <ThemeTest />;
      case 'offline-management':
        return <OfflineManagementDashboard />;
      case 'api-integration':
        return <APIIntegrationDashboard />;
      case 'performance-optimization':
        return <PerformanceOptimizationDashboard />;
      case 'template-builder':
        return <TemplateBuilder />;
      case 'housekeeping':
        return <HousekeepingDashboard />;
      case 'housekeeping-analytics':
        return <HousekeepingAnalyticsDashboard />;
      case 'f&b':
        return <FoodBeverageDashboard />;
      case 'fb-activities':
        return <DepartmentActivityLog area="f&b" title="Food & Beverage - View Activities" />;
      case 'fb-pos':
        return <FBPOS onClose={() => setActiveSection('f&b')} />;
      case 'fb-restaurant-bar':
        return <FoodBeverageRestaurantBar />;
      case 'fb-kitchen':
        return <FoodBeverageKitchen />;
      case 'fb-menu-inventory':
        return <FoodBeverageMenuInventory />;
      case 'fb-staff-reports':
        return <FoodBeverageStaffReports />;
      case 'fb-analytics':
        return <FoodBeverageAnalyticsDashboard />;
      case 'pos':
        return <FBPOS onClose={() => setActiveSection('f&b')} />;
      case 'restaurant':
        return <RestaurantManagement />;
      case 'kitchen':
        return <KitchenDisplay />;
      case 'security':
        return <SecurityDashboard />;
      case 'security-analytics':
        return <SecurityAnalyticsDashboard />;
      case 'security-activities':
        return <DepartmentActivityLog area="security" title="Security - View Activities" />;
      case 'hr':
        return <HRPayrollDashboard />;
      case 'hr-analytics':
        return <HRAnalyticsDashboard />;
      case 'hr-activities':
        return <DepartmentActivityLog area="hr" title="HR & Payroll - View Activities" />;
      case 'accounting':
        return <AccountingDashboard />;
      case 'chart-of-accounts':
        return <ChartOfAccountsPage />;
      case 'bank-cash-receivables':
        return <BankCashReceivablesPage />;
      case 'accounts-payable':
        return <AccountsPayablePage />;
      case 'inventory-fixed-assets':
        return <InventoryFixedAssetsPage />;
      case 'financial-reports':
        return <FinancialReportsPage />;
      case 'audit-controls':
        return <AuditControlsPage />;
      case 'accounting-activities':
        return <DepartmentActivityLog area="accounting" title="Accounting - View Activities" />;
      case 'settings':
        return <SettingsDashboard />;
      case 'user-preferences':
        return <UserPreferences />;
      case 'user-management':
        return <UserManagement />;
      case 'compliance':
        return <AutoComplianceDashboard />;
      case 'inventory':
        return <InventoryDashboard />;
      case 'inventory-analytics':
        return <InventoryAnalyticsDashboard />;
      case 'inventory-activities':
        return <DepartmentActivityLog area="inventory" title="Inventory - View Activities" />;
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
                    onClick={() => handleSectionClick(section.key, undefined)}
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
