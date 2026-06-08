export type AppTheme = 'light' | 'dark' | 'auto';

export function resolveTheme(theme: AppTheme): 'light' | 'dark' {
  if (theme === 'auto') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return theme;
}

export function applyTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const resolved = resolveTheme(theme);

  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
  root.style.colorScheme = resolved;
}

export function getStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';

  try {
    const raw = localStorage.getItem('system.currentUser');
    if (raw) {
      const user = JSON.parse(raw) as { preferences?: { theme?: AppTheme } };
      const theme = user?.preferences?.theme;
      if (theme === 'light' || theme === 'dark' || theme === 'auto') {
        return theme;
      }
    }
  } catch {
    // ignore malformed storage
  }

  return 'light';
}
