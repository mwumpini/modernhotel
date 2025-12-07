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
    { id: `${now}-covid`, countryCode: 'GH', name: 'COVID-19 Levy', rate: 1.0, glCode: '2152', appliesTo: ['ALL'] },
    { id: `${now}-vat`, countryCode: 'GH', name: 'VAT (Standard Rate)', rate: 12.5, glCode: '2153', appliesTo: ['ALL'] },
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
    let updated: any[];
    if (type.id) {
      updated = items.map((t: JsonObject) => (t.id === type.id ? { ...t, ...type } : t));
    } else {
      updated = items.concat([{ ...type, id: `${Date.now()}` }]);
    }
    writeJson(typesFile, updated);
    return updated.find((t: JsonObject) => t.id === (type.id || updated[updated.length - 1].id));
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


