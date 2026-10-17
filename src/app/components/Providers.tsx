'use client';

import React from 'react';
import { HeroUIProvider } from "@heroui/react";
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import '../lib/demo/init';
import HelpF12Shortcut from './HelpF12Shortcut';
import NightAuditScheduler from './NightAuditScheduler';
import WakeUpWatcher from './WakeUpWatcher';
import SessionIdleGuard from './SessionIdleGuard';
import NotificationToaster from './NotificationToaster';
import DangerConfirmHost from './DangerConfirm';
import ThemeProvider from './ThemeProvider';
import DataResetWatcher from './DataResetWatcher';
import OldBrowserNotice from './OldBrowserNotice';

interface ProvidersProps {
  children: React.ReactNode;
  session?: Session | null;
}

export default function Providers({ children, session = null }: ProvidersProps) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <HeroUIProvider>
        <ThemeProvider>
          <NotificationToaster />
          <DangerConfirmHost />
          <HelpF12Shortcut />
          <NightAuditScheduler />
          <WakeUpWatcher />
          <SessionIdleGuard />
          <DataResetWatcher />
          <OldBrowserNotice />
          {children}
        </ThemeProvider>
      </HeroUIProvider>
    </SessionProvider>
  );
}
