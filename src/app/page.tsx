'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Spinner } from '@heroui/react';
import { useSettingsStore } from './lib/settings/store';
import Navigation from './components/Navigation';
import LoginForm from './components/LoginForm';

function readLocalSetupCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem('system.settings');
    return !!(raw && JSON.parse(raw)?.initialSetupCompleted);
  } catch {
    return false;
  }
}

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const initialSetupCompleted = useSettingsStore(s => s.initialSetupCompleted);
  // Whether this tenant's setup-wizard status has been confirmed against the
  // server yet (see /api/settings/setup-status, checked from loadSettings() —
  // triggered by Navigation's own mount effect, not duplicated here). Setup
  // completion is shared per tenant, not per browser: a device with no local
  // record of it must wait for this before deciding the wizard is needed,
  // otherwise every new device would repeat a wizard another device already
  // finished.
  const setupStatusChecked = useSettingsStore(s => s.setupStatusChecked);
  const setSessionRole = useSettingsStore(s => s.setSessionRole);

  // Read once, synchronously, on first render — so a browser that already has
  // a local record renders the dashboard immediately instead of waiting on
  // the async server check (which still runs, but only matters for a browser
  // with no local record at all).
  const [localPersistedComplete] = React.useState(readLocalSetupCompleted);

  // getServerSession() at SSR time and the client's own useSession() can
  // resolve `status` differently for the same request (cookie/edge timing),
  // which made the branch below render different trees server- vs
  // client-side — a hydration mismatch. Not evaluating that branch until
  // after the client has actually mounted guarantees the first client render
  // always matches the SSR output (both show the spinner); the real
  // session-aware render only happens on the second, purely-client pass.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  // Keep the settings store's RBAC engine pointed at the real logged-in user's
  // role from the NextAuth session, not a disconnected local "current user".
  React.useEffect(() => {
    setSessionRole(status === 'authenticated' ? (session?.user as any)?.role ?? null : null);
  }, [status, session, setSessionRole]);

  // Role-based landing (client-safe, runs after mount)
  React.useEffect(() => {
    if (status !== 'authenticated') return;
    if (initialSetupCompleted || localPersistedComplete) return;
    // No local record — wait for the server check (kicked off by Navigation's
    // mount effect via loadSettings()) before deciding. Only a tenant the
    // server also has no record for is genuinely new.
    if (!setupStatusChecked) return;
    router.replace('/setup');
  }, [status, initialSetupCompleted, localPersistedComplete, setupStatusChecked, router]);

  // While a device with no local setup record waits on the server's answer,
  // show a spinner rather than flashing the dashboard (or the wizard) before
  // the real, shared answer is known.
  const awaitingSetupCheck = status === 'authenticated' && !initialSetupCompleted && !localPersistedComplete && !setupStatusChecked;

  if (!mounted || status === 'loading' || awaitingSetupCheck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onLogout={() => signOut({ callbackUrl: '/' })} />
    </div>
  );
}
