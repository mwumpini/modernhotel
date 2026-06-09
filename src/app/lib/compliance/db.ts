import fs from 'fs';
import path from 'path';
import { getSeedReports, getSeedTaxes } from './config';

type JsonObject = Record<string, any>;

const dataDir = path.join(process.cwd(), 'prisma');
const taxesFile = path.join(dataDir, 'compliance.taxes.json');
const reportsFile = path.join(dataDir, 'compliance.reports.json');
const typesFile = path.join(dataDir, 'compliance.taxTypes.json');

function ensureFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(taxesFile)) fs.writeFileSync(taxesFile, JSON.stringify(getSeedTaxes(), null, 2));
  if (!fs.existsSync(reportsFile)) fs.writeFileSync(reportsFile, JSON.stringify(getSeedReports(), null, 2));
  if (!fs.existsSync(typesFile)) fs.writeFileSync(typesFile, JSON.stringify([], null, 2));
}

function migrateLegacyGhanaRates(items: JsonObject[]): JsonObject[] {
  let changed = false;
  const next = items.map((t) => {
    if (t.countryCode !== 'GH') return t;
    if ((t.id === 'gh-vat' || t.name === 'VAT (Standard Rate)') && Number(t.rate) === 20) {
      changed = true;
      return {
        ...t,
        rate: 15,
        description: 'VAT 15% on (subtotal + NHIL + GETFund) — Act 1151, Jan 2026',
      };
    }
    if (t.name === 'Withholding Tax (Services)' && Number(t.rate) === 5) {
      changed = true;
      return { ...t, rate: 7.5, description: 'Resident WHT on services (2026)' };
    }
    return t;
  });
  if (changed) writeJson(taxesFile, next);
  return next;
}

function migrateSeedReports(items: JsonObject[]): JsonObject[] {
  const seeds = getSeedReports();
  const seedById = new Map(seeds.map((s) => [String(s.id), s]));
  let changed = false;

  const patched = items.map((item) => {
    const seed = seedById.get(String(item.id));
    if (!seed) return item;
    const updates: JsonObject = {};
    if (!item.dueRule && seed.dueRule) {
      updates.dueRule = seed.dueRule;
      changed = true;
    }
    if (!item.description && seed.description) {
      updates.description = seed.description;
      changed = true;
    }
    if (item.dueDay === undefined && seed.dueDay !== undefined) {
      updates.dueDay = seed.dueDay;
      changed = true;
    }
    return Object.keys(updates).length ? { ...item, ...updates } : item;
  });

  const existingIds = new Set(patched.map((r) => String(r.id)));
  const missing = seeds.filter((s) => !existingIds.has(String(s.id)));
  if (missing.length) {
    changed = true;
    const merged = [...patched, ...missing];
    writeJson(reportsFile, merged);
    return merged;
  }
  if (changed) writeJson(reportsFile, patched);
  return patched;
}

export function readJson(filePath: string): any[] {
  ensureFiles();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (filePath === taxesFile && Array.isArray(parsed)) {
      return migrateLegacyGhanaRates(parsed);
    }
    if (filePath === reportsFile && Array.isArray(parsed)) {
      return migrateSeedReports(parsed);
    }
    return parsed;
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
  },
};
