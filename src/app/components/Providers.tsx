'use client';

import React from 'react';
import { HeroUIProvider } from "@heroui/react";
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import '../lib/demo/init';
import HelpF12Shortcut from './HelpF12Shortcut';
import NightAuditScheduler from './NightAuditScheduler';
import ThemeProvider from './ThemeProvider';

interface ProvidersProps {
  children: React.ReactNode;
  session?: Session | null;
}

export default function Providers({ children, session = null }: ProvidersProps) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <HeroUIProvider>
        <ThemeProvider>
          <HelpF12Shortcut />
          <NightAuditScheduler />
          {children}
        </ThemeProvider>
      </HeroUIProvider>
    </SessionProvider>
  );
}
