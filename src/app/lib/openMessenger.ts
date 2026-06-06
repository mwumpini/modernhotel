/** Time for `/` + default dashboard to mount `DeptMessenger` before opening. */
const OPEN_AFTER_NAV_MS = 480;

export function dispatchOpenMessenger() {
  try {
    window.dispatchEvent(new CustomEvent('open-messenger'));
  } catch {
    /* ignore */
  }
}

/**
 * Messenger lives inside the main app shell (`/`). From other routes, go home first, then open.
 */
export function openMessengerFromShell(
  router: { push: (href: string) => void },
  pathname: string
) {
  if (pathname === '/') {
    dispatchOpenMessenger();
    return;
  }
  router.push('/');
  window.setTimeout(dispatchOpenMessenger, OPEN_AFTER_NAV_MS);
}
