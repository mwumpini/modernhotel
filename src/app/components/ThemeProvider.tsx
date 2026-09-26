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
  const cardBackgroundLight = useSettingsStore((state) => state.currentUser?.preferences?.cardBackgroundLight);
  const cardBackgroundDark = useSettingsStore((state) => state.currentUser?.preferences?.cardBackgroundDark);
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
      cardBackgroundLight: cardBackgroundLight ?? stored.cardBackgroundLight,
      cardBackgroundDark: cardBackgroundDark ?? stored.cardBackgroundDark,
      font: font ?? stored.font,
      fontSize: fontSize ?? stored.fontSize,
    });
  }, [theme, backgroundLight, backgroundDark, cardBackgroundLight, cardBackgroundDark, font, fontSize]);

  React.useEffect(() => {
    const activeTheme = theme ?? readStoredDisplay().theme;
    if (activeTheme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyDisplay({
      theme: 'auto',
      backgroundLight,
      backgroundDark,
      cardBackgroundLight,
      cardBackgroundDark,
      font,
      fontSize,
    });

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return <>{children}</>;
}
