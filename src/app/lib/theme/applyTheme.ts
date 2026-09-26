export type AppTheme = 'light' | 'dark' | 'auto';
export type AppFont = 'source' | 'nunito' | 'geist' | 'serif';
export type AppFontSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface DisplayPrefs {
  theme?: AppTheme | string;
  backgroundLight?: string;
  backgroundDark?: string;
  font?: AppFont | string;
  fontSize?: AppFontSize | string;
}

const THEMES: AppTheme[] = ['light', 'dark', 'auto'];
const FONTS: AppFont[] = ['source', 'nunito', 'geist', 'serif'];
const FONT_SIZES: AppFontSize[] = ['small', 'medium', 'large', 'xlarge'];
const HEX = /^#[0-9a-fA-F]{6}$/;

export function resolveTheme(theme: AppTheme): 'light' | 'dark' {
  if (theme === 'auto') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return theme;
}

export function normalizeTheme(theme: string | undefined): AppTheme {
  return THEMES.includes(theme as AppTheme) ? (theme as AppTheme) : 'light';
}

export function normalizeFont(font: string | undefined): AppFont {
  return FONTS.includes(font as AppFont) ? (font as AppFont) : 'source';
}

export function normalizeFontSize(size: string | undefined): AppFontSize {
  return FONT_SIZES.includes(size as AppFontSize) ? (size as AppFontSize) : 'medium';
}

function pageColor(resolved: 'light' | 'dark', prefs: DisplayPrefs): string {
  const raw = resolved === 'dark' ? prefs.backgroundDark : prefs.backgroundLight;
  return raw && HEX.test(raw) ? raw : '';
}

export function applyDisplay(prefs: DisplayPrefs = {}): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const theme = normalizeTheme(prefs.theme);
  const resolved = resolveTheme(theme);
  const font = normalizeFont(prefs.font);
  const fontSize = normalizeFontSize(prefs.fontSize);
  const background = pageColor(resolved, prefs);

  root.setAttribute('data-theme', theme);
  root.setAttribute('data-font', font);
  root.setAttribute('data-font-size', fontSize);
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
  root.style.colorScheme = resolved;

  if (background) {
    root.style.setProperty('--page-background', background);
    root.setAttribute('data-bg', 'custom');
  } else {
    root.style.removeProperty('--page-background');
    root.removeAttribute('data-bg');
  }
}

export function applyTheme(theme: AppTheme): void {
  applyDisplay({ theme });
}

export function readStoredDisplay(): DisplayPrefs {
  if (typeof window === 'undefined') return { theme: 'light', font: 'source' };

  try {
    const raw = localStorage.getItem('system.currentUser');
    if (raw) {
      const user = JSON.parse(raw) as { preferences?: DisplayPrefs };
      return user?.preferences || { theme: 'light', font: 'source' };
    }
  } catch {
    // ignore malformed storage
  }

  return { theme: 'light', font: 'source' };
}

export function getStoredTheme(): AppTheme {
  return normalizeTheme(readStoredDisplay().theme);
}
