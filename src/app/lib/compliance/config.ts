import countriesJson from './config/countries.json';
import categoriesJson from './config/categories.json';
import templatesJson from './config/templates.json';
import seedTaxesJson from './config/seed-taxes.json';
import seedReportsJson from './config/seed-reports.json';
import ghHospitalityRef from './config/hospitality/gh-2026.json';

export type ComplianceCountry = {
  code: string;
  name: string;
  flag: string;
  default?: boolean;
};

export type ComplianceCategory = { key: string; label: string };

export type TemplateMeta = {
  title: string;
  domain: 'sales' | 'purchases' | 'payroll' | 'corporate';
  operation: 'internal' | 'external';
  effect: 'all' | 'add' | 'subtract' | 'exclude_total' | 'informational';
};

type TemplateRule = Record<string, unknown>;

type TemplatesFile = {
  countryDefaults: Record<string, string[]>;
  countryQuickApply?: Record<string, { templateKey: string; note?: string }>;
  templates: Record<string, { meta: TemplateMeta; rules: TemplateRule[] }>;
};

const templates = templatesJson as TemplatesFile;

export const COMPLIANCE_COUNTRIES = countriesJson as ComplianceCountry[];
export const COMPLIANCE_CATEGORIES = categoriesJson as ComplianceCategory[];

export const DEFAULT_COMPLIANCE_COUNTRY = COMPLIANCE_COUNTRIES[0]?.code ?? 'GH';

export function getComplianceCountry(code: string): ComplianceCountry | undefined {
  return COMPLIANCE_COUNTRIES.find((c) => c.code === code);
}

export function getCountryDisplayName(code: string): string {
  const c = getComplianceCountry(code);
  return c ? `${c.flag} ${c.name}` : code;
}

export function getSeedTaxes(): Record<string, unknown>[] {
  return seedTaxesJson as Record<string, unknown>[];
}

export function getSeedReports(): Record<string, unknown>[] {
  const today = new Date().toISOString();
  return (seedReportsJson as Record<string, unknown>[]).map((r) => ({
    ...r,
    lastUpdated: r.lastUpdated ?? today,
  }));
}

export function getTemplateMeta(templateKey: string): TemplateMeta | undefined {
  return templates.templates[templateKey]?.meta;
}

export function getTemplateKeys(): string[] {
  return Object.keys(templates.templates);
}

export function getDefaultTemplatesForCountry(countryCode: string): string[] {
  return templates.countryDefaults[countryCode] ?? [];
}

export function getCountryQuickApply(countryCode: string) {
  return templates.countryQuickApply?.[countryCode];
}

export function buildTemplateRules(templateKey: string, countryCode: string): Record<string, unknown>[] {
  const entry = templates.templates[templateKey];
  if (!entry?.rules?.length) return [];
  return entry.rules.map((rule) => ({ ...rule, countryCode }));
}

export function formatRulesReferenceSummary(
  rules: Array<{ name: string; rate: number; glCode: string }>
): string {
  if (!rules.length) return 'No rules loaded yet.';
  return rules
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => `${r.name} ${r.rate}% · GL ${r.glCode}`)
    .join(' · ');
}

export function findTemplateKeyForTypeName(typeName: string, tags?: string[]): string | null {
  const tag = (tags ?? []).find((t) => typeof t === 'string' && t.startsWith('template:'));
  if (tag) return tag.split(':')[1] ?? null;
  for (const key of getTemplateKeys()) {
    if (getTemplateMeta(key)?.title === typeName) return key;
  }
  return null;
}

export type HospitalityReference = typeof ghHospitalityRef;

const hospitalityByCountry: Record<string, HospitalityReference> = {
  GH: ghHospitalityRef as HospitalityReference,
};

export function getHospitalityReference(countryCode: string): HospitalityReference | undefined {
  return hospitalityByCountry[countryCode];
}
