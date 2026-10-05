'use client';

import React, { Suspense, lazy } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { Button, Accordion, AccordionItem, Badge, Avatar, Tooltip } from "@heroui/react";
import { useSession } from 'next-auth/react';
import { useComplianceStore } from '../lib/compliance/store';
import { useSettingsStore } from '../lib/settings/store';
import { moduleEnabled, reportsEnabled } from '../lib/settings/moduleAccess';
import { openMessengerFromShell } from '../lib/openMessenger';
import SidebarSticky from './SidebarSticky';

/** After a dev-server restart the old chunk URLs 404. Reload once so the new build is picked up. */
function isChunkLoadError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String((error as { name?: string }).name) : '';
  const message = 'message' in error ? String((error as { message?: string }).message) : '';
  return name === 'ChunkLoadError' || /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(message);
}

function lazyRetry<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (typeof window !== 'undefined' && isChunkLoadError(error) && !sessionStorage.getItem('chunk-reload')) {
        sessionStorage.setItem('chunk-reload', '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }),
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'System Administrator',
  manager: 'Hotel Manager',
  staff: 'Staff Member',
  night_manager: 'Night Manager',
};

// Lazy load heavy components to prevent chunk loading errors
const FrontdeskDashboard = lazyRetry(() => import('./FrontdeskDashboard'));
const ExecutiveManagementDashboard = lazyRetry(() => import('./ExecutiveManagementDashboard'));
const ExecutiveApprovalsInbox = lazyRetry(() => import('./ExecutiveApprovalsInbox'));
const HousekeepingMainDashboard = lazyRetry(() => import('./HousekeepingMainDashboard'));
const FBPOS = lazyRetry(() => import('./FBPOS').then(module => ({ default: module.default })));
// BarManagement was removed — restaurant and bar are one unified operation (same
// staff, same POS), covered by FoodBeverageRestaurantBar.tsx with venue filtering
// and FBPOS.tsx's venue toggle, which already auto-route revenue to the correct
// GL account per venue. RestaurantManagement.tsx (the older, pre-unification
// component) is no longer routed to now that 'restaurant' is the Food &
// Beverage split's primary section key.
// KitchenDisplay (old in-memory) removed — use /kitchen-display page instead
const OfflineIndicator = lazyRetry(() => import('./OfflineIndicator'));
const OfflineManager = lazyRetry(() => import('./OfflineManager'));
const ActivityLog = lazyRetry(() => import('./ActivityLog'));
const SystemSettingsMainDashboard = lazyRetry(() => import('./SystemSettingsMainDashboard'));
const AutoComplianceMainDashboard = lazyRetry(() => import('./AutoComplianceMainDashboard'));
const AccountingMainDashboard = lazyRetry(() => import('./AccountingMainDashboard'));
const FrontofficeEventsConferences = lazyRetry(() => import('./FrontofficeEventsConferences'));
const EventsConferencesMainDashboard = lazyRetry(() => import('./EventsConferencesMainDashboard'));
const HRMainDashboard = lazyRetry(() => import('./HRMainDashboard'));
const SecurityMainDashboard = lazyRetry(() => import('./SecurityMainDashboard'));
const StoresMainDashboard = lazyRetry(() => import('./StoresMainDashboard'));
const FoodBeverageMainDashboard = lazyRetry(() => import('./FoodBeverageMainDashboard'));
const FoodBeverageKitchen = lazyRetry(() => import('./FoodBeverageKitchen'));
const DepartmentActivityLog = lazyRetry(() => import('./DepartmentActivityLog').then(module => ({ default: module.default })));
const FrontOfficeReportsAnalysis = lazyRetry(() => import('./FrontOfficeReportsAnalysis'));

interface NavigationProps {
  onLogout: () => void;
}

type ActiveSection = 'dashboard' | 'frontdesk' | 'housekeeping' | 'f&b' | 'restaurant' | 'kitchen' | 'pos' | 'security' | 'hr' | 'accounting' | 'settings' | 'compliance' | 'inventory' | 'rooms-bookings' | 'invoices-payments' | 'clients-services' | 'events-conferences' | 'events-conferences-standalone' | 'events-conferences-analytics' | 'events-conferences-preferences' | 'food-beverage' | 'fb-analytics' | 'fb-preferences' | 'accounting-management' | 'hr-payroll-management' | 'security-compliance' | 'inventory-supply-chain' | 'reports-analytics' | 'fb-pos' | 'fb-restaurant-bar' | 'fb-kitchen' | 'fb-menu-inventory' | 'fb-staff-reports' | 'housekeeping-analytics' | 'housekeeping-preferences' | 'inventory-analytics' | 'inventory-preferences' | 'security-analytics' | 'security-preferences' | 'hr-analytics' | 'hr-preferences' | 'frontdesk-activities' | 'fb-activities' | 'housekeeping-activities' | 'inventory-activities' | 'security-activities' | 'hr-activities' | 'accounting-activities' | 'chart-of-accounts' | 'bank-cash-management' | 'accounts-payable' | 'inventory-fixed-assets' | 'financial-reports' | 'audit-controls' | 'check-ins' | 'in-house' | 'check-outs' | 'executive-approvals';

/** Maps any ActiveSection (including deep sub-pages) to the top-level module key used for
 *  nav-menu access control (navigationSections[].key / hasModuleAccess). */
function sectionToModuleKey(section: ActiveSection): string {
  const frontdesk = new Set(['frontdesk', 'rooms-bookings', 'invoices-payments', 'clients-services', 'frontdesk-activities', 'check-ins', 'in-house', 'check-outs']);
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
export default function Navigation({ onLogout }: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(new Set(['dashboard']));
  const [activeSection, setActiveSection] = React.useState<ActiveSection>('dashboard');
  // (narrow screens: choosing a section closes the open pane — see the effect after the sidebar state)
  const [hasMounted, setHasMounted] = React.useState(false);
  React.useEffect(() => {
    setHasMounted(true);
    try { sessionStorage.removeItem('chunk-reload'); } catch { /* ignore */ }
  }, []);
  // The side pane can be tucked away to give the work area the full width. The choice is a
  // per-device convenience, remembered between visits; Ctrl/Cmd+B toggles it from anywhere.
  // On phones and tablets the pane always starts tucked away and opens OVER the content (tap
  // outside or pick a section to close it), so the work area keeps the full width.
  const NARROW_QUERY = '(max-width: 1023px)';
  const [narrow, setNarrow] = React.useState(() => {
    try { return window.matchMedia(NARROW_QUERY).matches; } catch { return false; }
  });
  React.useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    try {
      if (window.matchMedia(NARROW_QUERY).matches) return true;
      return localStorage.getItem('nav.collapsed') === '1';
    } catch { return false; }
  });
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    if (!narrow) { try { localStorage.setItem('nav.collapsed', next ? '1' : '0'); } catch {} } // only the desktop choice is remembered
  };
  React.useEffect(() => { if (narrow) setSidebarCollapsed(true); }, [narrow, activeSection]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarCollapsed]);
  // Re-render the menu (and re-evaluate hasModuleAccess) whenever the real session role
  // or the editable role/permission list changes.
  useSettingsStore(s => s.sessionRoleId);
  useSettingsStore(s => s.roles);
  const moduleSettings = useSettingsStore(s => s.moduleSettings);
  const settingsHydrated = useSettingsStore(s => s.hydrated);
  const hasModuleAccess = useSettingsStore.getState().hasModuleAccess;
  const hasPermission = useSettingsStore.getState().hasPermission;
  // The Approvals inbox (pending journal entries/payments/high-value
  // requisitions/overtime/payroll) is only useful to someone who can actually
  // approve at least one of those — gated by permission, not a role name.
  const canSeeApprovals =
    hasPermission('accounting.approve-journal-entry') ||
    hasPermission('accounting.approve-payment') ||
    hasPermission('inventory.approve-high-value-requisition') ||
    hasPermission('hr.approve-overtime') ||
    hasPermission('hr.approve-payroll');
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

  // The settings store's `currentUser` (used by the Settings > User Preferences
  // self-service screen) previously defaulted to a hardcoded demo record
  // ('admin_001' / admin@ghana-hotel.com) and setCurrentUser() was never
  // called anywhere — so that screen always showed/edited a phantom user
  // disconnected from whoever was actually logged in, no matter their real
  // account. Once the real user list arrives (loadSettings()'s /api/users
  // fetch), match it against the real NextAuth session by id and adopt it.
  const users = useSettingsStore(s => s.users);
  const setCurrentUser = useSettingsStore(s => s.setCurrentUser);
  React.useEffect(() => {
    const sessionUserId = (session?.user as any)?.id;
    if (!sessionUserId) return;
    const real = users.find(u => u.id === sessionUserId);
    if (real) setCurrentUser(real);
  }, [session, users, setCurrentUser]);

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
        { title: 'Main Dashboard', href: '#' },
        ...(canSeeApprovals ? [{ title: '✅ Approvals', href: '#' }] : []),
      ]
    },
    {
      key: 'frontdesk',
      title: `🏨 Front Office Operations${getUnreadCount('frontdesk') ? ` (${getUnreadCount('frontdesk')})` : ''}`,
      icon: '🏨',
      items: [
        { title: '🛎️ Desk', href: '#' },
        { title: '🛏️ Rooms', href: '#' },
        { title: '💳 Billing', href: '#' },
        { title: '👥 Clients', href: '#' },
        { title: '🌙 Night', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
      ]
    },
    {
      key: 'events-conferences',
      title: '🎪 Events & Conferences',
      icon: '🎪',
      items: [
        { title: '📋 Events', href: '#' },
        { title: '🏢 Venues', href: '#' },
        { title: '💰 Rates', href: '#' },
        { title: '👥 Staff', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
      ]
    },
    {
      key: 'restaurant',
      title: '🍽️ Restaurant & Bar',
      icon: '🍽️',
      items: [
        { title: '💳 POS Terminal', href: '#' },
        { title: '🪑 Service', href: '#' },
        { title: '🍽️ Menu', href: '#' },
        { title: '💵 Cash', href: '#' },
        { title: '📦 Supplies', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
      ]
    },
    {
      key: 'kitchen',
      title: '👨‍🍳 Kitchen',
      icon: '👨‍🍳',
      items: [
        { title: 'Kitchen Display', href: '#' },
        { title: '🍳 Board', href: '#' },
        { title: '📖 Recipes', href: '#' },
        { title: '📦 Supplies', href: '#' },
        { title: '👥 Staff', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
      ]
    },
    {
      key: 'housekeeping',
      title: `🛏️ Housekeeping & Maintenance${getUnreadCount('housekeeping') ? ` (${getUnreadCount('housekeeping')})` : ''}`,
      icon: '🛏️',
      items: [
        { title: '🏠 Floor', href: '#' },
        { title: '🧹 Work', href: '#' },
        { title: '📦 Supplies', href: '#' },
        { title: '👥 Staff', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '👁️ View Activities', href: '#' },
      ]
    },
    {
      key: 'inventory',
      title: `📦 Inventory & Stores${getUnreadCount('inventory') ? ` (${getUnreadCount('inventory')})` : ''}`,
      icon: '📦',
      items: [
        { title: '📦 Stock', href: '#' },
        { title: '👥 Staff', href: '#' },
        { title: '📈 Reports & Analysis', href: '/inventory/reports' },
      ]
    },
    {
      key: 'security',
      title: `🚨 Security Operations${getUnreadCount('security') ? ` (${getUnreadCount('security')})` : ''}`,
      icon: '🚨',
      items: [
        { title: '🚶 Watch', href: '#' },
        { title: '🚨 Incidents', href: '#' },
        { title: '🎟️ Visitors', href: '#' },
        { title: '👥 Staff', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
        { title: '👁️ View Activities', href: '#' },
      ]
    },
    {
      key: 'hr',
      title: `👥 HR & Payroll${getUnreadCount('hr') ? ` (${getUnreadCount('hr')})` : ''}`,
      icon: '👥',
      items: [
        { title: '👥 People', href: '#' },
        { title: '🌴 Leave', href: '#' },
        { title: '⏰ Time', href: '#' },
        { title: '💰 Payroll', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
      ]
    },
    {
      key: 'accounting',
      title: '🧾 Accounting & Finance',
      icon: '🧾',
      items: [
        { title: '📝 Receivable', href: '#' },
        { title: '🧾 Payable', href: '#' },
        { title: '💰 Cash', href: '#' },
        { title: '📒 Books', href: '#' },
        { title: '📑 Statements', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
      ]
    },
    {
      key: 'compliance',
      title: '⚖️ Compliance & Reports',
      icon: '⚖️',
      items: [
        { title: '🧮 Tax', href: '#' },
        { title: '💰 Payroll', href: '#' },
        { title: '📈 Reports & Analysis', href: '#' },
      ]
    },
    {
      key: 'settings',
      title: '⚙️ System Settings',
      icon: '⚙️',
      items: [
        { title: '👥 People', href: '#' },
        { title: '🛏️ Rooms', href: '#' },
        { title: '📄 Documents', href: '#' },
        { title: '📦 Stock', href: '#' },
        { title: '🔒 Security', href: '#' },
        { title: '⚙️ System Setup', href: '#' },
      ]
    }
  ];

  const visibleNavigationSections = navigationSections
    .filter(section => hasModuleAccess(section.key) && moduleEnabled(section.key, moduleSettings))
    .map(section => reportsEnabled(moduleSettings)
      ? section
      : { ...section, items: section.items.filter(item => !item.title.includes('Reports')) });

  // If the current role loses access to whatever section is active (role changed, or a
  // stale deep link from a previous, more-privileged session), fall back to the dashboard
  // instead of silently continuing to render restricted content.
  React.useEffect(() => {
    if (!settingsHydrated) return;
    const activeModuleKey = sectionToModuleKey(activeSection);
    const allowed = hasModuleAccess(activeModuleKey) && moduleEnabled(activeModuleKey, moduleSettings);
    if (activeModuleKey !== 'dashboard' && !allowed) {
      setActiveSection('dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, hasModuleAccess, moduleSettings, settingsHydrated]);

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

  const openStoredTab = (section: ActiveSection, storageKey: string, tab: string, eventName: string) => {
    try { localStorage.setItem(storageKey, tab); } catch {}
    setActiveSection(section);
    try { window.dispatchEvent(new Event(eventName)); } catch {}
  };

  const handleSectionClick = (sectionKey: string, itemTitle?: string) => {
    // If no itemTitle is provided, it means the main section header was clicked
    // This should navigate to the dashboard for that section
    if (!itemTitle) {
      setActiveSection(sectionKey as ActiveSection);
      return;
    }

    // Handle Executive Management sub-items
    if (sectionKey === 'dashboard' && itemTitle) {
      if (itemTitle === '✅ Approvals') {
        setActiveSection('executive-approvals');
      } else {
        setActiveSection('dashboard');
      }
    // Handle Restaurant & Bar sub-items
    } else if (sectionKey === 'restaurant' && itemTitle) {
      const fbTab =
        itemTitle === '🪑 Service' ? 'tables'
        : itemTitle === '🍽️ Menu' ? 'menu'
        : itemTitle === '💵 Cash' ? 'cashiering'
        : itemTitle === '📦 Supplies' ? 'supplies'
        : itemTitle === '📈 Reports & Analysis' ? 'reports'
        : null;
      if (itemTitle === '💳 POS Terminal') {
        setActiveSection('fb-pos');
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('fb-preferences');
      } else if (fbTab) {
        openStoredTab('restaurant', 'fb.tab', fbTab, 'fb-navigate');
      } else {
        setActiveSection('restaurant');
      }
    // Handle Kitchen sub-items
    } else if (sectionKey === 'kitchen' && itemTitle) {
      const kitchenTab =
        itemTitle === '🍳 Board' ? 'kds'
        : itemTitle === '📖 Recipes' ? 'recipes'
        : itemTitle === '📦 Supplies' ? 'supplies'
        : itemTitle === '👥 Staff' ? 'staff'
        : itemTitle === '📈 Reports & Analysis' ? 'reports'
        : null;
      if (itemTitle === 'Kitchen Display') {
        window.location.assign('/kitchen-display');
        return;
      } else if (kitchenTab) {
        openStoredTab('kitchen', 'kitchen.tab', kitchenTab, 'kitchen-navigate');
      } else {
        setActiveSection('kitchen');
      }
    // Handle Housekeeping sub-items
    } else if (sectionKey === 'housekeeping' && itemTitle) {
      const hkTab =
        itemTitle === '🏠 Floor' ? 'floor'
        : itemTitle === '🧹 Work' ? 'work'
        : itemTitle === '📦 Supplies' ? 'supplies'
        : itemTitle === '👥 Staff' ? 'staff'
        : itemTitle === '📈 Reports & Analysis' ? 'reports'
        : null;
      if (hkTab) {
        openStoredTab('housekeeping', 'hk.tab', hkTab, 'hk-navigate');
      } else if (itemTitle === '👁️ View Activities') {
        setActiveSection('housekeeping-activities');
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('housekeeping-preferences');
      } else {
        setActiveSection('housekeeping');
      }
    // Handle Security sub-items
    } else if (sectionKey === 'security' && itemTitle) {
      const securityTab =
        itemTitle === '🚶 Watch' ? 'patrols'
        : itemTitle === '🚨 Incidents' ? 'incidents'
        : itemTitle === '🎟️ Visitors' ? 'visitors'
        : itemTitle === '👥 Staff' ? 'staff'
        : itemTitle === '📈 Reports & Analysis' ? 'reports'
        : null;
      if (securityTab) {
        openStoredTab('security', 'security.tab', securityTab, 'security-navigate');
      } else if (itemTitle === '👁️ View Activities') {
        setActiveSection('security-activities');
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('security-preferences');
      } else {
        setActiveSection('security');
      }
    // Handle Inventory sub-items
    } else if (sectionKey === 'inventory' && itemTitle) {
      const invTab =
        itemTitle === '📦 Stock' ? 'items'
        : itemTitle === '👥 Staff' ? 'staff'
        : null;
      if (itemTitle === '📈 Reports & Analysis') {
        window.location.assign('/inventory/reports');
        return;
      } else if (invTab) {
        try { localStorage.setItem('inventory.tab', invTab); } catch {}
        setActiveSection('inventory');
        try { window.dispatchEvent(new CustomEvent('inv-navigate', { detail: { tab: invTab } })); } catch {}
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('inventory-preferences');
      } else {
        setActiveSection('inventory');
      }
    // Handle HR sub-items
    } else if (sectionKey === 'hr' && itemTitle) {
      const hrTab =
        itemTitle === '👥 People' ? 'employees'
        : itemTitle === '🌴 Leave' ? 'leave'
        : itemTitle === '⏰ Time' ? 'time'
        : itemTitle === '💰 Payroll' ? 'payroll'
        : itemTitle === '📈 Reports & Analysis' ? 'reports'
        : null;
      if (hrTab) {
        openStoredTab('hr', 'hr.tab', hrTab, 'hr-navigate');
      } else if (itemTitle === '⚙️ User Preferences') {
        setActiveSection('hr-preferences');
      } else {
        setActiveSection('hr');
      }
    } else if (sectionKey === 'events-conferences' && itemTitle) {
      const eventsTab =
        itemTitle === '📋 Events' ? 'confirmed'
        : itemTitle === '🏢 Venues' ? 'venues'
        : itemTitle === '💰 Rates' ? 'quoting'
        : itemTitle === '👥 Staff' ? 'staff'
        : itemTitle === '📈 Reports & Analysis' ? 'reports'
        : null;
      if (eventsTab) {
        openStoredTab('events-conferences', 'events.tab', eventsTab, 'events-navigate');
      } else {
        setActiveSection('events-conferences');
      }
    } else if (sectionKey === 'compliance') {
      const complianceTab =
        itemTitle === '🧮 Tax' ? 'tax'
        : itemTitle === '💰 Payroll' ? 'payroll'
        : itemTitle === '📈 Reports & Analysis' ? 'reports'
        : null;
      if (complianceTab) {
        try { localStorage.setItem('compliance.tab', complianceTab); } catch {}
        try { window.dispatchEvent(new CustomEvent('compliance.openTab', { detail: { tab: complianceTab } })); } catch {}
      }
      setActiveSection('compliance');
    } else if (sectionKey === 'accounting' && itemTitle) {
      const accountingTab =
        itemTitle === '📝 Receivable' ? 'receivables'
        : itemTitle === '🧾 Payable' ? 'payables'
        : itemTitle === '💰 Cash' ? 'banking'
        : itemTitle === '📒 Books' ? 'journal'
        : itemTitle === '📑 Statements' || itemTitle === '📑 Financial Statements' ? 'statements'
        : itemTitle === '📈 Reports & Analysis' ? 'reports'
        : null;
      if (itemTitle === 'View Activities') {
        setActiveSection('accounting-activities');
      } else if (accountingTab) {
        openStoredTab('accounting-management', 'accounting.tab', accountingTab, 'accounting-navigate');
      } else {
        setActiveSection('accounting-management');
      }
    } else if (sectionKey === 'housekeeping' && itemTitle) {
      if (itemTitle === 'Analytics Dashboard' || itemTitle === '📈 Reports & Analysis') {
        try { localStorage.setItem('hk.tab', 'reports'); } catch {}
        setActiveSection('housekeeping');
        try { window.dispatchEvent(new Event('hk-navigate')); } catch {}
        return;
      } else if (itemTitle === 'View Activities') {
        setActiveSection('housekeeping-activities');
      } else {
        setActiveSection('housekeeping');
      }
    } else if (sectionKey === 'inventory' && itemTitle) {
      if (itemTitle === 'Analytics Dashboard' || itemTitle === '📈 Reports & Analysis') {
        window.location.assign('/inventory/reports');
        return;
      } else if (itemTitle === 'View Activities') {
        setActiveSection('inventory-activities');
      } else {
        setActiveSection('inventory');
      }
    } else if (sectionKey === 'frontdesk' && itemTitle) {
      const foTab =
        itemTitle === '🛎️ Desk' ? 'desk'
        : itemTitle === '🛏️ Rooms' ? 'rooms'
        : itemTitle === '💳 Billing' ? 'billing'
        : itemTitle === '👥 Clients' ? 'clients'
        : itemTitle === '🌙 Night' ? 'night-audit'
        : itemTitle === '📈 Reports & Analysis' ? 'reports'
        : null;
      if (foTab) {
        try { localStorage.setItem('fo.tab', foTab); } catch {}
        setActiveSection('frontdesk');
        try { window.dispatchEvent(new Event('fo-navigate')); } catch {}
      } else {
        setActiveSection('frontdesk');
      }
    } else if (sectionKey === 'settings' && itemTitle) {
      const settingsTab =
        itemTitle === '👥 People' ? 'users'
        : itemTitle === '🛏️ Rooms' ? 'rooms'
        : itemTitle === '📄 Documents' ? 'numbering'
        : itemTitle === '📦 Stock' ? 'locations'
        : itemTitle === '🔒 Security' ? 'security'
        : null;
      if (itemTitle === '⚙️ System Setup' || itemTitle === '🏢 Setup' || itemTitle === 'System Setup Wizard') {
        try { window.location.href = '/setup'; } catch {}
      } else if (itemTitle === 'Reports & Analytics') {
        setActiveSection('reports-analytics');
      } else if (settingsTab) {
        openStoredTab('settings', 'settings.tab', settingsTab, 'settings-navigate');
      } else {
        setActiveSection('settings');
      }
    } else {
      setActiveSection(sectionKey as ActiveSection);
    }
  };

  const renderDashboardContent = () => {
    switch (activeSection) {
      case 'executive-approvals':
        return <Suspense fallback={<div className="p-6 text-center">Loading Approvals...</div>}><ExecutiveApprovalsInbox /></Suspense>;
      case 'frontdesk':
        return <Suspense fallback={<div className="p-6 text-center">Loading Front Desk Dashboard...</div>}><FrontdeskDashboard /></Suspense>;
      case 'frontdesk-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading Front Desk Activities...</div>}><DepartmentActivityLog area="frontdesk" title="Front Office - View Activities" /></Suspense>;
      case 'rooms-bookings':
        return <Suspense fallback={<div className="p-6 text-center">Loading Rooms...</div>}><FrontdeskDashboard initialTab="rooms" /></Suspense>;
      case 'invoices-payments':
        return <Suspense fallback={<div className="p-6 text-center">Loading Invoices & Payments...</div>}><FrontdeskDashboard initialTab="billing" /></Suspense>;
      case 'clients-services':
        return <Suspense fallback={<div className="p-6 text-center">Loading Clients...</div>}><FrontdeskDashboard initialTab="clients" /></Suspense>;
      case 'events-conferences':
        return <Suspense fallback={<div className="p-6 text-center">Loading Events & Conferences...</div>}><EventsConferencesMainDashboard /></Suspense>;
      case 'events-conferences-standalone':
        return <Suspense fallback={<div className="p-6 text-center">Loading Events & Conferences...</div>}><EventsConferencesMainDashboard /></Suspense>;
      case 'events-conferences-analytics':
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('events.tab', 'reports'); } catch {}
          return <Suspense fallback={<div className="p-6 text-center">Loading Events & Conferences...</div>}><EventsConferencesMainDashboard /></Suspense>;
        }
        return <div className="p-6 text-center">Opening Reports & Analysis...</div>;

      case 'check-ins':
      case 'check-outs':
        return <Suspense fallback={<div className="p-6 text-center">Loading the desk...</div>}><FrontdeskDashboard initialTab="desk" /></Suspense>;
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
        return <Suspense fallback={<div className="p-6 text-center">Loading Housekeeping Dashboard...</div>}><HousekeepingMainDashboard initialTab="reports" /></Suspense>;
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
        return <Suspense fallback={<div className="p-6 text-center">Loading Restaurant & Bar...</div>}><FoodBeverageMainDashboard initialTab="tables" /></Suspense>;
      case 'fb-menu-inventory':
        return <Suspense fallback={<div className="p-6 text-center">Loading Menu & Inventory...</div>}><FoodBeverageMainDashboard initialTab="menu" /></Suspense>;
      case 'fb-staff-reports':
        return <Suspense fallback={<div className="p-6 text-center">Loading Restaurant & Bar...</div>}><FoodBeverageMainDashboard initialTab="tables" /></Suspense>;
      case 'fb-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading Reports & Analysis...</div>}><FoodBeverageMainDashboard initialTab="reports" /></Suspense>;
      // ── Kitchen (ticket fulfillment) — its own top-level dashboard, no longer
      // nested inside Restaurant & Bar's tabs. Embeds the live KDS as its first tab.
      case 'fb-kitchen':
      case 'kitchen':
        return <Suspense fallback={<div className="p-6 text-center">Loading Kitchen Dashboard...</div>}><FoodBeverageKitchen /></Suspense>;
      case 'security':
      case 'security-compliance':
        return <Suspense fallback={<div className="p-6 text-center">Loading Security Dashboard...</div>}><SecurityMainDashboard /></Suspense>;
      case 'security-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading Security Dashboard...</div>}><SecurityMainDashboard initialTab="reports" /></Suspense>;
      case 'security-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading Security Activities...</div>}><DepartmentActivityLog area="security" title="Security - View Activities" /></Suspense>;
      case 'hr':
        return <Suspense fallback={<div className="p-6 text-center">Loading HR Dashboard...</div>}><HRMainDashboard /></Suspense>;
      case 'hr-analytics':
        return <Suspense fallback={<div className="p-6 text-center">Loading HR Dashboard...</div>}><HRMainDashboard initialTab="reports" /></Suspense>;
      case 'hr-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading HR Activities...</div>}><DepartmentActivityLog area="hr" title="HR & Payroll - View Activities" /></Suspense>;
      case 'accounting':
      case 'chart-of-accounts':
      case 'bank-cash-management':
      case 'accounts-payable':
      case 'inventory-fixed-assets':
      case 'financial-reports':
      case 'audit-controls':
        return <Suspense fallback={<div className="p-6 text-center">Loading Accounting Dashboard...</div>}><AccountingMainDashboard /></Suspense>;
      case 'accounting-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading Accounting Activities...</div>}><DepartmentActivityLog area="accounting" title="Accounting - View Activities" /></Suspense>;
      case 'settings':
        return <Suspense fallback={<div className="p-6 text-center">Loading System Settings...</div>}><SystemSettingsMainDashboard /></Suspense>;
      case 'compliance':
        return <Suspense fallback={<div className="p-6 text-center">Loading Compliance Dashboard...</div>}><AutoComplianceMainDashboard /></Suspense>;
      case 'inventory':
        return <Suspense fallback={<div className="p-6 text-center">Loading Inventory Dashboard...</div>}><StoresMainDashboard /></Suspense>;
      case 'inventory-analytics':
        if (typeof window !== 'undefined') {
          window.location.replace('/inventory/reports');
        }
        return <div className="p-6 text-center">Opening Reports & Analysis...</div>;
      case 'inventory-activities':
        return <Suspense fallback={<div className="p-6 text-center">Loading Inventory Activities...</div>}><DepartmentActivityLog area="inventory" title="Inventory - View Activities" /></Suspense>;
      case 'dashboard':
      default:
        return <Suspense fallback={<div className="p-6 text-center">Loading Executive Dashboard...</div>}><ExecutiveManagementDashboard /></Suspense>;
    }
  };

  return (
    <div className="flex h-dvh max-w-[100vw] overflow-hidden">
      {narrow && !sidebarCollapsed && (
        <>
          {/* the open pane floats over the content: keep the rail's space, and dim the page behind it */}
          <div className="w-14 shrink-0" aria-hidden />
          <div className="fixed inset-0 z-30 bg-black/40" onClick={toggleSidebar} aria-hidden />
        </>
      )}
      {/* Sidebar */}
      <nav className={`${sidebarCollapsed ? 'w-14' : 'w-80'} ${narrow && !sidebarCollapsed ? 'fixed inset-y-0 left-0 z-40 max-w-[85vw]' : ''} shrink-0 bg-white shadow-xl h-dvh overflow-y-auto overflow-x-hidden transition-[width] duration-200`}>
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-1 py-3">
            <Tooltip content="Show side pane (Ctrl+B)" placement="right">
              <Button isIconOnly size="sm" variant="flat" aria-label="Show side pane" onPress={toggleSidebar}>»</Button>
            </Tooltip>
            {visibleNavigationSections.map((section) => (
              <Tooltip key={section.key} content={section.title.replace(/^[^\s]+\s/, '')} placement="right">
                <button
                  className="h-10 w-10 rounded-lg text-lg hover:bg-ghana-gold/20 transition-colors"
                  aria-label={section.title.replace(/^[^\s]+\s/, '')}
                  onClick={() => handleSectionClick(section.key, undefined)}
                >
                  {section.icon}
                </button>
              </Tooltip>
            ))}
          </div>
        ) : (
        <div className="p-6 w-80">
          {/* Logo Header */}
          <div
            className="flex items-center mb-8 cursor-pointer"
            role="button"
            aria-label="Go to main dashboard"
            onClick={() => setActiveSection('dashboard')}
          >
            <div className="h-12 w-12 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-2xl flex items-center justify-center mr-4">
              <span className="text-3xl">🏨</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-ghana-black">Ghana Hotel</h1>
              <p className="text-sm text-gray-600">Management System</p>
              <Badge color="primary" variant="flat" size="sm" className="mt-1">Executive</Badge>
            </div>
            <Tooltip content="Hide side pane (Ctrl+B)" placement="bottom">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="ml-auto self-start"
                aria-label="Hide side pane"
                onPress={() => toggleSidebar()}
              >
                «
              </Button>
            </Tooltip>
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

          <SidebarSticky />

          {/* User Profile & Logout */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div
              className="flex items-center mb-4 cursor-pointer"
              role="button"
              aria-label="Go to user profile and preferences"
              onClick={() => {
                try {
                  localStorage.setItem('settings.tab', 'users');
                  localStorage.setItem('settings.usersSubTab', 'preferences');
                } catch {}
                setActiveSection('settings');
              }}
            >
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
              variant="bordered"
              size="sm"
              className="mt-2 h-9 w-full justify-between border-gray-200 bg-white px-3 text-sm font-medium text-ghana-black"
              startContent={<MessageSquare className="h-4 w-4 text-ghana-green" aria-hidden />}
              onPress={() => openMessengerFromShell(router, pathname || '/')}
            >
              <span className="flex-1 text-left">Messenger</span>
              <span className="text-[10px] font-normal text-gray-400">Ctrl+M</span>
            </Button>
          </div>
        </div>
        )}
      </nav>

      {/* Main Content Area */}
      <div className="work-pane flex-1 min-w-0 bg-gray-50 overflow-x-clip overflow-y-auto">
        {renderDashboardContent()}
      </div>
    </div>
  );
}
