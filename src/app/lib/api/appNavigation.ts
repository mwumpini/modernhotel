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
