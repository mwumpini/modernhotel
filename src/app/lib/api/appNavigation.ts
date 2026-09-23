'use client';

/** Return to the main app shell on Front Office Operations. */
export function openFrontOfficeOverview() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('nav.section', 'frontdesk');
    } catch {
      /* ignore */
    }
    window.location.assign('/');
  }
}

/** Return to the main app shell on Restaurant & Bar. */
export function openFoodBeverageOverview() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('nav.section', 'restaurant');
    } catch {
      /* ignore */
    }
    window.location.assign('/');
  }
}

/** Return to the main app shell on Kitchen Operations. */
export function openKitchenOperationsOverview() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('nav.section', 'kitchen');
    } catch {
      /* ignore */
    }
    window.location.assign('/');
  }
}

/** Return to the main app shell on Housekeeping & Maintenance. */
export function openHousekeepingOverview() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('nav.section', 'housekeeping');
    } catch {
      /* ignore */
    }
    window.location.assign('/');
  }
}

/** Return to the main app shell on Accounting & Finance. */
export function openAccountingOverview() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('nav.section', 'accounting');
    } catch {
      /* ignore */
    }
    window.location.assign('/');
  }
}

/** Return to the main app shell on HR & Payroll. */
export function openHROverview() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('nav.section', 'hr');
    } catch {
      /* ignore */
    }
    window.location.assign('/');
  }
}

/** Return to the main app shell on Inventory & Stores. */
export function openInventoryOverview() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('nav.section', 'inventory');
    } catch {
      /* ignore */
    }
    window.location.assign('/');
  }
}

/** Return to the main app shell on Security Operations. */
export function openSecurityOverview() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('nav.section', 'security');
    } catch {
      /* ignore */
    }
    window.location.assign('/');
  }
}

/** Return to the main app shell on Events & Conferences. */
export function openEventsOverview() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('nav.section', 'events-conferences');
    } catch {
      /* ignore */
    }
    window.location.assign('/');
  }
}
