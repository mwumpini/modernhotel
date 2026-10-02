'use client';

import React from 'react';
import { HeroUIProvider } from "@heroui/react";
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import '../lib/demo/init';
import HelpF12Shortcut from './HelpF12Shortcut';
import NightAuditScheduler from './NightAuditScheduler';
import SessionIdleGuard from './SessionIdleGuard';
import NotificationToaster from './NotificationToaster';
import DangerConfirmHost from './DangerConfirm';
import ThemeProvider from './ThemeProvider';
import DataResetWatcher from './DataResetWatcher';

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
          <SessionIdleGuard />
          <DataResetWatcher />
          {children}
        </ThemeProvider>
      </HeroUIProvider>
    </SessionProvider>
  );
}
