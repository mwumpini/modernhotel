'use client';

import React from 'react';
import { useSettingsStore } from '../lib/settings/store';
import { applyDisplay, readStoredDisplay, type AppFont, type AppFontSize, type AppTheme } from '../lib/theme/applyTheme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useSettingsStore(
    (state) => state.currentUser?.preferences?.theme as AppTheme | undefined
  );
  const backgroundLight = useSettingsStore((state) => state.currentUser?.preferences?.backgroundLight);
  const backgroundDark = useSettingsStore((state) => state.currentUser?.preferences?.backgroundDark);
  const font = useSettingsStore(
    (state) => state.currentUser?.preferences?.font as AppFont | undefined
  );
  const fontSize = useSettingsStore(
    (state) => state.currentUser?.preferences?.fontSize as AppFontSize | undefined
  );

  React.useEffect(() => {
    const stored = readStoredDisplay();
    applyDisplay({
      theme: theme ?? stored.theme,
      backgroundLight: backgroundLight ?? stored.backgroundLight,
      backgroundDark: backgroundDark ?? stored.backgroundDark,
      font: font ?? stored.font,
      fontSize: fontSize ?? stored.fontSize,
    });
  }, [theme, backgroundLight, backgroundDark, font, fontSize]);

  React.useEffect(() => {
    const activeTheme = theme ?? readStoredDisplay().theme;
    if (activeTheme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyDisplay({
      theme: 'auto',
      backgroundLight,
      backgroundDark,
      font,
      fontSize,
    });

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return <>{children}</>;
}
