import { useSettingsStore } from './store';

/** PIN saved under Settings → POS. Empty storage falls back to the demo PIN. */
export function configuredManagerPin(): string {
  const pin = useSettingsStore.getState().posSettings?.managerPin;
  return pin ? String(pin) : '1234';
}

export function managerPinMatches(entered: string): boolean {
  return entered === configuredManagerPin();
}
