'use client';

import { COMPLIANCE_COUNTRIES, type ComplianceCountry } from './config';
import { useSettingsStore } from '../settings/store';

/** Country from Setup wizard (defaultCountry → company address → supported list). */
export function resolveComplianceCountry(): string {
  try {
    const settings = useSettingsStore.getState();
    const candidates = [
      settings.defaultCountry,
      settings.companySettings?.address?.country,
      ...(settings.supportedCountries ?? []),
    ].filter(Boolean) as string[];

    for (const code of candidates) {
      if (COMPLIANCE_COUNTRIES.some((c) => c.code === code)) {
        return code;
      }
    }
  } catch {
    /* settings store not ready */
  }
  return COMPLIANCE_COUNTRIES[0]?.code ?? 'GH';
}

/** Countries enabled in Setup, intersected with compliance-supported list. */
export function resolveSupportedComplianceCountries(): ComplianceCountry[] {
  try {
    const supported = useSettingsStore.getState().supportedCountries ?? [];
    if (supported.length) {
      const filtered = COMPLIANCE_COUNTRIES.filter((c) => supported.includes(c.code));
      if (filtered.length) return filtered;
    }
  } catch {
    /* ignore */
  }
  return COMPLIANCE_COUNTRIES;
}
