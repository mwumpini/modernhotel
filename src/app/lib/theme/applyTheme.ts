export type AppTheme = 'light' | 'dark' | 'auto';
export type AppFont = 'source' | 'nunito' | 'geist' | 'serif';
export type AppFontSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface DisplayPrefs {
  theme?: AppTheme | string;
  backgroundLight?: string;
  backgroundDark?: string;
  cardBackgroundLight?: string;
  cardBackgroundDark?: string;
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
  return FONTS.includes(font as AppFont) ? (font as AppFont) : 'geist';
}

export function normalizeFontSize(size: string | undefined): AppFontSize {
  return FONT_SIZES.includes(size as AppFontSize) ? (size as AppFontSize) : 'medium';
}

function pageColor(resolved: 'light' | 'dark', prefs: DisplayPrefs): string {
  const raw = resolved === 'dark' ? prefs.backgroundDark : prefs.backgroundLight;
  return raw && HEX.test(raw) ? raw : '';
}

function cardColor(resolved: 'light' | 'dark', prefs: DisplayPrefs): string {
  const raw = resolved === 'dark' ? prefs.cardBackgroundDark : prefs.cardBackgroundLight;
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
  const card = cardColor(resolved, prefs);

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

  if (card) {
    // Drives inset tiles (bg-gray-50 / bg-gray-100 metric boxes, tab bars, etc.)
    // — the surfaces people mean by "cards" inside a section. Outer HeroUI
    // panels stay on --card-background from the theme.
    root.style.setProperty('--tile-background', card);
    root.setAttribute('data-tiles', 'custom');
  } else {
    root.style.removeProperty('--tile-background');
    root.removeAttribute('data-tiles');
  }
}

export function applyTheme(theme: AppTheme): void {
  applyDisplay({ theme });
}

export function readStoredDisplay(): DisplayPrefs {
  if (typeof window === 'undefined') return { theme: 'light', font: 'geist' };

  try {
    const raw = localStorage.getItem('system.currentUser');
    if (raw) {
      const user = JSON.parse(raw) as { preferences?: DisplayPrefs };
      return user?.preferences || { theme: 'light', font: 'geist' };
    }
  } catch {
    // ignore malformed storage
  }

  return { theme: 'light', font: 'geist' };
}

export function getStoredTheme(): AppTheme {
  return normalizeTheme(readStoredDisplay().theme);
}
