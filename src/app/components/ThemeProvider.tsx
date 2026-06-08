'use client';

import React from 'react';
import { useSettingsStore } from '../lib/settings/store';
import { applyTheme, getStoredTheme, type AppTheme } from '../lib/theme/applyTheme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useSettingsStore(
    (state) => state.currentUser?.preferences?.theme as AppTheme | undefined
  );

  React.useEffect(() => {
    applyTheme(theme ?? getStoredTheme());
  }, [theme]);

  React.useEffect(() => {
    const activeTheme = theme ?? getStoredTheme();
    if (activeTheme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('auto');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return <>{children}</>;
}
