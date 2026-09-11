'use client';

import React, { Suspense, lazy } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Accordion, AccordionItem, Badge, Avatar } from "@heroui/react";
import { useSession } from 'next-auth/react';
import { isLeanAccountingUI } from '../lib/accounting/tenantAccountingConfig';
import { useComplianceStore } from '../lib/compliance/store';
import { useSettingsStore } from '../lib/settings/store';

const ROLE_LABELS: Record<string, string> = {
  admin: 'System Administrator',
  manager: 'Hotel Manager',
  staff: 'Staff Member',
  night_manager: 'Night Manager',
};

// Lazy load heavy components to prevent chunk loading errors
const FrontdeskDashboard = lazy(() => import('./FrontdeskDashboard'));
const ExecutiveManagementDashboard = lazy(() => import('./ExecutiveManagementDashboard'));
const HousekeepingMainDashboard = lazy(() => import('./HousekeepingMainDashboard'));
const FBPOS = lazy(() => import('./FBPOS').then(module => ({ default: module.default })));
// BarManagement was removed — restaurant and bar are one unified operation (same
// staff, same POS), covered by FoodBeverageRestaurantBar.tsx with venue filtering
// and FBPOS.tsx's venue toggle, which already auto-route revenue to the correct
// GL account per venue. RestaurantManagement.tsx (the older, pre-unification
// component) is no longer routed to now that 'restaurant' is the Food &
// Beverage split's primary section key.
// KitchenDisplay (old in-memory) removed — use /kitchen-display page instead
const OfflineIndicator = lazy(() => import('./OfflineIndicator'));
const OfflineManager = lazy(() => import('./OfflineManager'));
const ActivityLog = lazy(() => import('./ActivityLog'));
const SystemSettingsMainDashboard = lazy(() => import('./SystemSettingsMainDashboard'));
const AutoComplianceMainDashboard = lazy(() => import('./AutoComplianceMainDashboard'));
const AccountingMainDashboard = lazy(() => import('./AccountingMainDashboard'));
const FrontofficeRoomsBookings = lazy(() => import('./FrontofficeRoomsBookings'));
const FrontofficeClientsServices = lazy(() => import('./FrontofficeClientsServices'));
const FrontofficeEventsConferences = lazy(() => import('./FrontofficeEventsConferences'));
const EventsConferencesMainDashboard = lazy(() => import('./EventsConferencesMainDashboard'));
const GuestExperienceManager = lazy(() => import('./GuestExperienceManager'));
const MobileGuestServices = lazy(() => import('./MobileGuestServices'));
const HRMainDashboard = lazy(() => import('./HRMainDashboard'));
const SecurityMainDashboard = lazy(() => import('./SecurityMainDashboard'));
const StoresMainDashboard = lazy(() => import('./StoresMainDashboard'));
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
const FrontOfficeReportsAnalysis = lazy(() => import('./FrontOfficeReportsAnalysis'));

// Lazy load accounting components
const ChartOfAccountsPage = lazy(() => import('./accounting/ChartOfAccounts'));
const BankCashManagementPage = lazy(() => import('./accounting/BankCashReceivables'));
const AccountsPayablePage = lazy(() => import('./accounting/AccountsPayable'));
const InventoryFixedAssetsPage = lazy(() => import('./accounting/InventoryFixedAssets'));
const FinancialReportsPage = lazy(() => import('./accounting/FinancialReports'));
const AuditControlsPage = lazy(() => import('./accounting/AuditControls'));

interface NavigationProps {
  onLogout: () => void;
}

type ActiveSection = 'dashboard' | 'frontdesk' | 'housekeeping' | 'f&b' | 'restaurant' | 'kitchen' | 'pos' | 'security' | 'hr' | 'accounting' | 'settings' | 'compliance' | 'inventory' | 'rooms-bookings' | 'invoices-payments' | 'clients-services' | 'events-conferences' | 'events-conferences-standalone' | 'events-conferences-analytics' | 'events-conferences-preferences' | 'guest-experience-manager' | 'mobile-guest-services' | 'food-beverage' | 'fb-analytics' | 'fb-preferences' | 'accounting-management' | 'hr-payroll-management' | 'security-compliance' | 'inventory-supply-chain' | 'reports-analytics' | 'fb-pos' | 'fb-restaurant-bar' | 'fb-kitchen' | 'fb-menu-inventory' | 'fb-staff-reports' | 'housekeeping-analytics' | 'housekeeping-preferences' | 'inventory-analytics' | 'inventory-preferences' | 'security-analytics' | 'security-preferences' | 'hr-analytics' | 'hr-preferences' | 'frontdesk-activities' | 'fb-activities' | 'housekeeping-activities' | 'inventory-activities' | 'security-activities' | 'hr-activities' | 'accounting-activities' | 'chart-of-accounts' | 'bank-cash-management' | 'accounts-payable' | 'inventory-fixed-assets' | 'financial-reports' | 'audit-controls' | 'check-ins' | 'in-house' | 'check-outs';

/** Maps any ActiveSection (including deep sub-pages) to the top-level module key used for
 *  nav-menu access control (navigationSections[].key / hasModuleAccess). */
function sectionToModuleKey(section: ActiveSection): string {
  const frontdesk = new Set(['frontdesk', 'rooms-bookings', 'invoices-payments', 'clients-services', 'guest-experience-manager', 'mobile-guest-services', 'frontdesk-activities', 'check-ins', 'in-house', 'check-outs']);
  const events = new Set(['events-conferences', 'events-conferences-standalone', 'events-conferences-analytics', 'events-conferences-preferences']);
  // Food & Beverage used to be one combined module ('f&b') -- split into Restaurant
  // (front-of-house: POS, tables, menu, bar) and Kitchen (ticket fulfillment, KDS).
  // Legacy aliases ('f&b', 'food-beverage') map to Restaurant since that's the module
  // the old combined hub's main tab represented.
  const restaurant = new Set(['f&b', 'restaurant', 'pos', 'food-beverage', 'fb-analytics', 'fb-preferences', 'fb-pos', 'fb-restaurant-bar', 'fb-menu-inventory', 'fb-staff-reports', 'fb-activities']);
  const kitchen = new Set(['kitchen', 'fb-kitchen']);
  const housekeeping = new Set(['housekeeping', 'housekeeping-analytics', 'housekeeping-preferences', 'housekeeping-activities']);
  const inventory = new Set(['inventory', 'inventory-supply-chain', 'inventory-analytics', 'inventory-preferences', 'inventory-activities']);
  const security = new Set(['security', 'security-compliance', 'security-analytics', 'security-preferences', 'security-activities']);
  const hr = new Set(['hr', 'hr-payroll-management', 'hr-analytics', 'hr-preferences', 'hr-activities']);
  const accounting = new Set(['accounting', 'accounting-management', 'accounting-activities', 'chart-of-accounts', 'bank-cash-management', 'accounts-payable', 'inventory-fixed-assets', 'financial-reports', 'audit-controls']);
  const compliance = new Set(['compliance', 'reports-analytics']);

  if (section === 'dashboard') return 'dashboard';
  if (frontdesk.has(section)) return 'frontdesk';
  if (events.has(section)) return 'events-conferences';
  if (restaurant.has(section)) return 'restaurant';
  if (kitchen.has(section)) return 'kitchen';
  if (housekeeping.has(section)) return 'housekeeping';
  if (inventory.has(section)) return 'inventory';
  if (security.has(section)) return 'security';
  if (hr.has(section)) return 'hr';
  if (accounting.has(section)) return 'accounting';
  if (compliance.has(section)) return 'compliance';
  if (section === 'settings') return 'settings';
  return 'dashboard';
}

function resolveNavSection(target: string): ActiveSection {
  switch (target) {
    case 'user-management-unified':
    case 'user-management':
    case 'user-management-dashboard':
      try { localStorage.setItem('settings.tab', 'users'); } catch {}
      return 'settings';
    case 'user-preferences':
      try {
        localStorage.setItem('settings.tab', 'users');
        localStorage.setItem('settings.usersSubTab', 'preferences');
      } catch {}
      return 'settings';
    case 'room-configuration':
      try { localStorage.setItem('settings.tab', 'rooms'); } catch {}
      return 'settings';
    case 'offline-management':
    case 'api-integration':
    case 'performance-optimization':
    case 'template-builder':
    case 'theme-test':
    case 'room-management':
      return 'settings';
    default:
      return target as ActiveSection;
  }
}
/** Full-page kitchen display — use assign so navigation is not blocked by the main shell. */
function KitchenRedirect() {
  React.useEffect(() => {
    window.location.assign('/kitchen-display');
  }, []);
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8">
      <p className="text-gray-500 animate-pulse">Opening Kitchen Display…</p>
      <a
        href="/kitchen-display"
        className="text-ghana-green font-semibold underline"
      >
        Click here if it does not open
      </a>
    </div>
  );
}

export default function Navigation({ onLogout }: NavigationProps) {
  const router = useRouter();
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(new Set(['dashboard']));
  const [activeSection, setActiveSection] = React.useState<ActiveSection>('dashboard');
  const [hasMounted, setHasMounted] = React.useState(false);
  React.useEffect(() => { setHasMounted(true); }, []);
  const leanMode = isLeanAccountingUI();
  // Re-render the menu (and re-evaluate hasModuleAccess) whenever the real session role
  // or the editable role/permission list changes.
  useSettingsStore(s => s.sessionRoleId);
  useSettingsStore(s => s.roles);
  const hasModuleAccess = useSettingsStore.getState().hasModuleAccess;
  const { data: session } = useSession();
  const currentUserName = session?.user?.name || 'User';
  const currentUserRoleLabel = ROLE_LABELS[(session?.user as any)?.role] || (session?.user as any)?.role || '';

  // Settings (role/session, branding, etc.) load from localStorage here, once,
  // after mount — not synchronously at module-import time (see the comment
  // above settingsStore's old top-level loadSettings() call). The server has
  // no localStorage, so loading it before the first client render ever
  // reconciles against the server HTML causes a hydration mismatch on every
  // page load; doing it in an effect guarantees the first client render
  // matches the server, then updates a tick later once real settings apply.
  React.useEffect(() => {
    useSettingsStore.getState().loadSettings();
  }, []);

  // Every revenue centre (Front Office, F&B, Events & Conferences, Room Configuration,
  // checkout) reads tax rates via getActiveTaxConfigs(), which falls back to a hardcoded
  // default table (GHANA_TAX_CODES) whenever the accounting store's taxConfigs is empty —
  // and it starts empty until something syncs the configured compliance rules into it.
  // Previously only Accounting/Compliance/HR screens triggered that sync, so a guest could
  // be billed at hardcoded rates just by landing straight in Front Office or F&B. Doing it
  // once here, at the app shell, guarantees every module has real rates before it renders.
  React.useEffect(() => {
    void useComplianceStore.getState().syncCountryFromSetup();
  }, []);

  // Log navigation component initialization and state changes
  React.useEffect(() => {
    console.log('Navigation component initialized with default section:', activeSection);
    try {
      const target = localStorage.getItem('nav.section');
      if (target) {
        setActiveSection(resolveNavSection(target));
        localStorage.removeItem('nav.section');
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    console.log('Active section changed to:', activeSection);
  }, [activeSection]);

  React.useEffect(() => {
    console.log('Expanded keys changed:', Array.from(expandedKeys));
  }, [expandedKeys]);


  const getUnreadCount = (dept: string) => {
    // The server has no localStorage, so this must return the same thing (0, no
    // unread badge) on the first client render too — otherwise a genuinely unread
    // announcement makes a section title (and its aria-label) differ from what the
    // server sent, which is exactly the kind of mismatch that blows away this whole
    // accordion subtree on hydration. Real counts kick in a tick later, after mount.
    if (!hasMounted) return 0;
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
      items: []
    },
    {
      key: 'events-conferences',
      title: '🎪 Events & Conferences',
      icon: '🎪',
      items: []
    },
    {
      key: 'restaurant',
      title: '🍽️ Restaurant & Bar',
      icon: '🍽️',
      items: []
    },
    {
      key: 'kitchen',
      title: '👨‍🍳 Kitchen',
      icon: '👨‍🍳',
      items: [
        { title: 'Kitchen Display', href: '#' }
      ]
    },
    {
      key: 'housekeeping',
      title: `🛏️ Housekeeping & Maintenance${getUnreadCount('housekeeping') ? ` (${getUnreadCount('housekeeping')})` : ''}`,
      icon: '🛏️',
      items: [
        { title: '🏠 Main Dashboard', href: '/housekeeping' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '👁️ View Activities', href: '#' },
      ]
    },
    {
      key: 'inventory',
      title: `📦 Inventory & Stores${getUnreadCount('inventory') ? ` (${getUnreadCount('inventory')})` : ''}`,
      icon: '📦',
      items: []
    },
    {
      key: 'security',
      title: `🚨 Security Operations${getUnreadCount('security') ? ` (${getUnreadCount('security')})` : ''}`,
      icon: '🚨',
      items: [
        { title: '📊 Operations', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '👁️ View Activities', href: '#' },
      ]
    },
    {
      key: 'hr',
      title: `👥 HR & Payroll${getUnreadCount('hr') ? ` (${getUnreadCount('hr')})` : ''}`,
      icon: '👥',
      items: []
    },
    {
      key: 'accounting',
      title: '🧾 Accounting & Finance',
      icon: '🧾',
      items: [
        { title: 'Accounting Management', href: '#' },
        ...(leanMode ? [] : [{ title: 'Chart of Accounts', href: '#' }]),
        ...(leanMode ? [] : [{ title: 'Bank & Cash Management', href: '#' }]),
        { title: 'Accounts Payable', href: '#' },
        { title: 'Accounts Receivable', href: '#' },
        ...(leanMode ? [] : [{ title: 'Financial Reports', href: '#' }]),
        ...(leanMode ? [] : [{ title: 'Audit & Controls', href: '#' }])
      ].filter(Boolean as any)
    },
    {
      key: 'compliance',
      title: '⚖️ Compliance & Reports',
      icon: '⚖️',
      items: []
    },
    {
      key: 'settings',
      title: '⚙️ System Settings',
      icon: '⚙️',
      items: []
    }
  ];

  const visibleNavigationSections = navigationSections.filter(section => hasModuleAccess(section.key));

  // If the current role loses access to whatever section is active (role changed, or a
  // stale deep link from a previous, more-privileged session), fall back to the dashboard
  // instead of silently continuing to render restricted content.
  React.useEffect(() => {
    const activeModuleKey = sectionToModuleKey(activeSection);
    if (activeModuleKey !== 'dashboard' && !hasModuleAccess(activeModuleKey)) {
      setActiveSection('dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, hasModuleAccess]);

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

    // Handle Restaurant & Bar sub-items
    if (sectionKey === 'restaurant' && itemTitle) {
      if (itemTitle === '📈 Reports & Analysis') {
        setActiveSection('fb-analytics');
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('fb-preferences');
      } else {
        setActiveSection('restaurant');
      }
    // Handle Kitchen sub-items
    } else if (sectionKey === 'kitchen' && itemTitle) {
      if (itemTitle === 'Kitchen Display') {
        window.location.assign('/kitchen-display');
        return;
      } else {
        setActiveSection('kitchen');
      }
    // Handle Housekeeping sub-items
    } else if (sectionKey === 'housekeeping' && itemTitle) {
      if (itemTitle === '📊 Operations') {
        setActiveSection('housekeeping');
      } else if (itemTitle === '📈 Reports & Analysis') {
        setActiveSection('housekeeping-analytics');
      } else if (itemTitle === '👁️ View Activities') {
        setActiveSection('housekeeping-activities');
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
      } else if (itemTitle === '👁️ View Activities') {
        setActiveSection('security-activities');
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
      } else if (itemTitle === 'Bank & Cash Management') {
        setActiveSection('bank-cash-management');
      } else if (itemTitle === 'Accounts Payable') {
        setActiveSection('accounts-payable');
      } else if (itemTitle === 'Accounts Receivable') {
        try { localStorage.setItem('accounting.tab', 'receivables'); } catch {}
        setActiveSection('accounting-management');
        return;
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
      if (itemTitle === 'System Setup Wizard') {
        try { window.location.href = '/setup'; } catch {}
      } else if (itemTitle === 'Reports & Analytics') {
        setActiveSection('reports-analytics');
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
      // 'food-beverage' alias handled in the F&B section below
      case 'accounting-management':
        return <Suspense fallback={<div className="p-6 text-center">Loading Accounting Dashboard...</div>}><AccountingMainDashboard /></Suspense>;
      case 'hr-payroll-management':
        return <Suspense fallback={<div className="p-6 text-center">Loading HR Dashboard...</div>}><HRMainDashboard /></Suspense>;
      case 'inventory-supply-chain':
        return <Suspense fallback={<div className="p-6 text-center">Loading Inventory Dashboard...</div>}><StoresMainDashboard /></Suspense>;
      case 'reports-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading Reports & Analytics...</div>}><FrontOfficeReportsAnalysis /></Suspense>;
      case 'housekeeping':
        return <Suspense fallback={<div className="p-6 text-center">Loading Housekeeping Dashboard...</div>}><HousekeepingMainDashboard /></Suspense>;
      case 'housekeeping-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading Housekeeping Analytics...</div>}><HousekeepingAnalyticsDashboard /></Suspense>;
      case 'housekeeping-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading Housekeeping Activities...</div>}><DepartmentActivityLog area="housekeeping" title="Housekeeping - View Activities" /></Suspense>;
      // ── Restaurant & Bar (front-of-house: POS, tables, menu, bar) ───────────
      // 'f&b'/'food-beverage' kept as deep-link aliases — Restaurant is the
      // module that combined "Food & Beverage" hub used to represent before
      // Kitchen split out into its own top-level section below.
      case 'restaurant':
      case 'f&b':
      case 'food-beverage':
        return <Suspense fallback={<div className="p-6 text-center">Loading Restaurant & Bar Dashboard...</div>}><FoodBeverageMainDashboard /></Suspense>;
      case 'fb-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading Restaurant & Bar Activities...</div>}><DepartmentActivityLog area="f&b" title="Restaurant & Bar - View Activities" /></Suspense>;
      case 'fb-pos':
      case 'pos': // alias
        return <Suspense fallback={<div className="p-6 text-center">Loading POS Terminal...</div>}><FBPOS onClose={() => setActiveSection('restaurant')} /></Suspense>;
      case 'fb-restaurant-bar':
        return <Suspense fallback={<div className="p-6 text-center">Loading Restaurant & Bar...</div>}><FoodBeverageRestaurantBar /></Suspense>;
      case 'fb-menu-inventory':
        return <Suspense fallback={<div className="p-6 text-center">Loading Menu & Inventory...</div>}><FoodBeverageMenuInventory /></Suspense>;
      case 'fb-staff-reports':
        return <Suspense fallback={<div className="p-6 text-center">Loading Staff Reports...</div>}><FoodBeverageStaffReports /></Suspense>;
      case 'fb-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading Restaurant & Bar Analytics...</div>}><FoodBeverageAnalyticsDashboard /></Suspense>;
      // ── Kitchen (ticket fulfillment) — always the standalone KDS page ───────
      case 'fb-kitchen':
      case 'kitchen':
        return <KitchenRedirect />;
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
      case 'accounting':
        return <Suspense fallback={<div className="p-6 text-center">Loading Accounting Dashboard...</div>}><AccountingMainDashboard /></Suspense>;
      case 'chart-of-accounts':
        return <Suspense fallback={<div className="p-6 text-center">Loading Chart of Accounts...</div>}><ChartOfAccountsPage /></Suspense>;
      case 'bank-cash-management':
        return <Suspense fallback={<div className="p-6 text-center">Loading Bank & Cash Management...</div>}><BankCashManagementPage /></Suspense>;
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
      case 'settings':
        return <Suspense fallback={<div className="p-6 text-center">Loading System Settings...</div>}><SystemSettingsMainDashboard /></Suspense>;
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
            {visibleNavigationSections.map((section) => (
              <AccordionItem
                key={section.key}
                aria-label={section.title}
                hideIndicator={section.items.length === 0}
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
                {section.items.length > 0 && (
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
                )}
              </AccordionItem>
            ))}
          </Accordion>

          <Button
            variant="bordered"
            className="w-full mt-6 border-slate-300 bg-white text-ghana-black"
            size="sm"
            onPress={() => router.push('/help')}
          >
            Help (F1 / F12)
          </Button>

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
                name={currentUserName}
                className="h-10 w-10 bg-gradient-to-br from-ghana-green to-ghana-gold text-white mr-3"
              />
              <div>
                <p className="font-semibold text-ghana-black">{currentUserName}</p>
                <p className="text-xs text-gray-600">{currentUserRoleLabel || 'Ghana Hotel Management'}</p>
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
