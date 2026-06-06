'use client';

import React from 'react';
import { HeroUIProvider } from "@heroui/react";
import { SessionProvider } from 'next-auth/react';
import HelpF12Shortcut from './HelpF12Shortcut';
import NightAuditScheduler from './NightAuditScheduler';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <HeroUIProvider>
        <HelpF12Shortcut />
        <NightAuditScheduler />
        {children}
      </HeroUIProvider>
    </SessionProvider>
  );
}
