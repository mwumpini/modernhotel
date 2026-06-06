import fs from 'fs';
import path from 'path';

type JsonObject = Record<string, any>;

const dataDir = path.join(process.cwd(), 'prisma');
const taxesFile = path.join(dataDir, 'compliance.taxes.json');
const reportsFile = path.join(dataDir, 'compliance.reports.json');
const typesFile = path.join(dataDir, 'compliance.taxTypes.json');

function ensureFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(taxesFile)) fs.writeFileSync(taxesFile, JSON.stringify(seedTaxes(), null, 2));
  if (!fs.existsSync(reportsFile)) fs.writeFileSync(reportsFile, JSON.stringify(seedReports(), null, 2));
  if (!fs.existsSync(typesFile)) fs.writeFileSync(typesFile, JSON.stringify([], null, 2));
}

function seedTaxes() {
  const now = Date.now();
  return [
    { id: `${now}-nhil`, countryCode: 'GH', name: 'NHIL', rate: 2.5, glCode: '2150', appliesTo: ['ALL'] },
    { id: `${now}-getfund`, countryCode: 'GH', name: 'GETFund Levy', rate: 2.5, glCode: '2151', appliesTo: ['ALL'] },
    { id: `${now}-vat`, countryCode: 'GH', name: 'VAT (Standard Rate)', rate: 15, glCode: '2153', appliesTo: ['ALL'] },
    { id: `${now}-tourism`, countryCode: 'GH', name: 'Tourism Levy', rate: 1.0, glCode: '2154', appliesTo: ['ROOM', 'F&B'] },
  ];
}

function seedReports() {
  const today = new Date().toISOString();
  return [
    { id: 'gh-vat', countryCode: 'GH', reportType: 'VAT', frequency: 'Monthly', fieldsRequired: ['sales','purchases','vatDue'], dueDay: 15, isActive: true, lastUpdated: today },
    { id: 'gh-nhil', countryCode: 'GH', reportType: 'NHIL', frequency: 'Monthly', fieldsRequired: ['sales','nhilDue'], dueDay: 15, isActive: true, lastUpdated: today },
    { id: 'gh-tourism', countryCode: 'GH', reportType: 'Tourism', frequency: 'Monthly', fieldsRequired: ['roomSales','levyDue'], dueDay: 15, isActive: true, lastUpdated: today },
  ];
}

export function readJson(filePath: string): any[] {
  ensureFiles();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function writeJson(filePath: string, data: any[]) {
  ensureFiles();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function normalizeTypeName(s: unknown): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function templateTagsFrom(type: JsonObject): string[] {
  return (Array.isArray(type.tags) ? type.tags : []).filter(
    (x: unknown) => typeof x === 'string' && x.startsWith('template:')
  ) as string[];
}

export const ComplianceDB = {
  getTaxes(country?: string) {
    const items = readJson(taxesFile);
    return country ? items.filter((t: JsonObject) => t.countryCode === country) : items;
  },
  upsertTax(rule: JsonObject) {
    const items = readJson(taxesFile);
    let updated: any[];
    if (rule.id) {
      updated = items.map((t: JsonObject) => (t.id === rule.id ? { ...t, ...rule } : t));
    } else {
      updated = items.concat([{ ...rule, id: `${Date.now()}` }]);
    }
    writeJson(taxesFile, updated);
    return updated.find((t: JsonObject) => t.id === (rule.id || updated[updated.length - 1].id));
  },
  deleteTax(id: string) {
    const items = readJson(taxesFile);
    const remaining = items.filter((t: JsonObject) => t.id !== id);
    writeJson(taxesFile, remaining);
    return { deleted: id };
  },
  getTaxTypes(country?: string) {
    const items = readJson(typesFile);
    return country ? items.filter((t: JsonObject) => t.countryCode === country) : items;
  },
  upsertTaxType(type: JsonObject) {
    const items = readJson(typesFile);
    if (type.id) {
      const updated = items.map((t: JsonObject) => (t.id === type.id ? { ...t, ...type } : t));
      writeJson(typesFile, updated);
      return updated.find((t: JsonObject) => t.id === type.id);
    }

    const incomingTags = templateTagsFrom(type);
    const nameKey = normalizeTypeName(type.name);

    const dupIdx = items.findIndex((t: JsonObject) => {
      if (t.countryCode !== type.countryCode) return false;
      if (incomingTags.length > 0) {
        const existingTags = templateTagsFrom(t);
        return existingTags.some((tg) => incomingTags.includes(tg));
      }
      return normalizeTypeName(t.name) === nameKey;
    });

    if (dupIdx >= 0) {
      const existing = items[dupIdx];
      const merged = {
        ...existing,
        ...type,
        id: existing.id,
        tags: Array.from(
          new Set([
            ...(Array.isArray(existing.tags) ? existing.tags : []),
            ...(Array.isArray(type.tags) ? type.tags : []),
          ])
        ),
      };
      items[dupIdx] = merged;
      writeJson(typesFile, items);
      return merged;
    }

    const created = { ...type, id: `${Date.now()}` };
    const updated = items.concat([created]);
    writeJson(typesFile, updated);
    return created;
  },

  /**
   * Merge duplicate tax types for a country (same template:* tag or same normalized name).
   * Keeps the type with the most linked rules; reassigns rules from removed types.
   */
  dedupeTaxTypesForCountry(countryCode: string): { removed: number; removedIds: string[] } {
    const allTypes = readJson(typesFile) as JsonObject[];
    const allTaxes = readJson(taxesFile) as JsonObject[];

    const groupKey = (t: JsonObject) => {
      const tags = templateTagsFrom(t);
      if (tags.length) return `tag:${[...tags].sort().join('|')}`;
      return `name:${normalizeTypeName(t.name)}`;
    };

    const ruleCount = (typeId: string) =>
      allTaxes.filter((r) => String(r.typeId || '') === String(typeId)).length;

    const byKey = new Map<string, JsonObject[]>();
    for (const t of allTypes) {
      if (t.countryCode !== countryCode) continue;
      const k = groupKey(t);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(t);
    }

    const removedIds: string[] = [];

    for (const [, group] of byKey) {
      if (group.length <= 1) continue;
      group.sort((a, b) => {
        const ca = ruleCount(String(a.id));
        const cb = ruleCount(String(b.id));
        if (cb !== ca) return cb - ca;
        return String(a.id).localeCompare(String(b.id));
      });
      const keeper = group[0];
      for (let i = 1; i < group.length; i++) {
        const loserId = String(group[i].id);
        removedIds.push(loserId);
        for (let j = 0; j < allTaxes.length; j++) {
          if (String(allTaxes[j].typeId || '') === loserId) {
            allTaxes[j] = { ...allTaxes[j], typeId: keeper.id };
          }
        }
      }
    }

    if (removedIds.length === 0) {
      return { removed: 0, removedIds: [] };
    }

    const nextTypes = allTypes.filter((t) => !removedIds.includes(String(t.id)));
    writeJson(taxesFile, allTaxes);
    writeJson(typesFile, nextTypes);
    return { removed: removedIds.length, removedIds };
  },
  deleteTaxType(id: string) {
    const items = readJson(typesFile);
    const remaining = items.filter((t: JsonObject) => t.id !== id);
    writeJson(typesFile, remaining);
    return { deleted: id };
  },
  getReports(country?: string) {
    const items = readJson(reportsFile);
    return country ? items.filter((r: JsonObject) => r.countryCode === country) : items;
  }
};


