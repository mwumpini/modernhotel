import fs from 'fs';

const path = 'src/app/lib/accounting/store.ts';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
const startIdx = lines.findIndex((l) => l.trim() === '// Initialize sample journal entries');
const costIdx = lines.findIndex((l) => l.trim() === '// Initialize sample cost centers');
const auditIdx = lines.findIndex((l) => l.trim() === '// Initialize sample audit trail');
const prevIdx = lines.findIndex((l) => l.trim().startsWith('const prev = get();'));

if (startIdx < 0 || costIdx < 0 || auditIdx < 0 || prevIdx < 0) {
  console.error('markers', { startIdx, costIdx, auditIdx, prevIdx });
  process.exit(1);
}

const part1 = lines.slice(startIdx + 1, costIdx);
const part2 = lines.slice(auditIdx + 1, prevIdx);
const body = [...part1, ...part2].join('\n');

const header = `'use client';

import type {
  JournalEntry,
  Invoice,
  Payment,
  WHTCertificate,
  BusinessPartner,
  BankAccount,
  BankTransaction,
  FixedAsset,
  DepreciationSchedule,
  AuditTrail,
} from './models';

export type DemoTransactionSeed = {
  journalEntries: JournalEntry[];
  invoices: Invoice[];
  payments: Payment[];
  whtCertificates: WHTCertificate[];
  businessPartners: BusinessPartner[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  fixedAssets: FixedAsset[];
  depreciationSchedules: DepreciationSchedule[];
  auditTrail: AuditTrail[];
};

/** Fictional flows for demos only — never loaded when NEXT_PUBLIC_DEMO_MODE is false. */
export function buildDemoTransactionSeed(): DemoTransactionSeed {
`;

const footer = `
  return {
    journalEntries: sampleJournalEntries,
    invoices: sampleInvoices,
    payments: samplePayments,
    whtCertificates: sampleWHTCertificates,
    businessPartners: samplePartners,
    bankAccounts: sampleBankAccounts,
    bankTransactions: sampleBankTxns,
    fixedAssets: sampleAssets,
    depreciationSchedules: sampleDepSchedules,
    auditTrail: sampleAudit,
  };
}
`;

fs.writeFileSync('src/app/lib/accounting/demoAccountingSeed.ts', header + body + footer);
console.log('wrote demoAccountingSeed.ts');

const replacement = `      const transactionSeed = isAccountingDemoMode()
        ? (await import('./demoAccountingSeed')).buildDemoTransactionSeed()
        : EMPTY_TRANSACTION_SEED;

      const {
        journalEntries: sampleJournalEntries,
        invoices: sampleInvoices,
        payments: samplePayments,
        whtCertificates: sampleWHTCertificates,
        businessPartners: samplePartners,
        bankAccounts: sampleBankAccounts,
        bankTransactions: sampleBankTxns,
        fixedAssets: sampleAssets,
        depreciationSchedules: sampleDepSchedules,
        auditTrail: sampleAudit,
      } = transactionSeed;

      const sampleCostCenters = operational.costCenters;
      const sampleRevenueCenters = operational.revenueCenters;

`;

const newLines = [
  ...lines.slice(0, startIdx),
  replacement.trimEnd(),
  ...lines.slice(prevIdx),
];
fs.writeFileSync(path, newLines.join('\n'));
console.log('updated store.ts');
