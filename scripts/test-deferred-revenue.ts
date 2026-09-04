/**
 * Regression test for deferred-revenue capture/recognition (integration.ts).
 * Exercises the real store (not a mock) since the logic reads/writes
 * useAccountingStore directly.
 */
import { useAccountingStore } from '../src/app/lib/accounting/store';
import { captureRevenue, recognizeDeferredRevenue } from '../src/app/lib/accounting/integration';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function main() {
  await useAccountingStore.getState().initializeAccounting();

  // 1. Deferred capture credits Deferred Revenue (2400), not Conference Revenue (4300).
  const captureResult = captureRevenue(
    {
      id: 'EVT-TEST-1',
      source: 'conference',
      customerId: 'CUST-TEST',
      customerName: 'Test Client',
      reference: 'evt-test-1',
      description: 'Test conference booking',
      items: [{ description: 'Conference package', quantity: 1, unitPrice: 1000, taxPercent: 0 }],
      subtotal: 1000,
      taxAmount: 0,
      total: 1000,
      date: new Date().toISOString(),
    },
    { deferred: true }
  );
  assert(!!captureResult, 'deferred capture posts successfully');

  const store1 = useAccountingStore.getState();
  const captureJe = store1.journalEntries.find((je) => je.id === captureResult!.journalEntryId);
  assert(!!captureJe, 'capture JE exists in store');
  const deferredLine = captureJe!.lines.find((l) => l.accountCode === '2400');
  const revenueLineAtCapture = captureJe!.lines.find((l) => l.accountCode === '4300');
  assert(!!deferredLine && deferredLine.credit === 1000, `capture credits Deferred Revenue 1000, got ${deferredLine?.credit}`);
  assert(!revenueLineAtCapture, 'capture must NOT credit Conference Revenue directly');

  // 2. Recognizing before delivery hasn't happened is exactly what we're testing FOR —
  // recognizeDeferredRevenue is only ever called at actual delivery, so calling it now
  // simulates "event completed" and should reclassify the deferred amount into revenue.
  const recognized = recognizeDeferredRevenue('conference', 'evt-test-1', 'Test event — delivered');
  assert(!!recognized, 'recognition posts successfully');
  assert(recognized!.journalEntryIds.length === 1, `recognizes exactly one entry, got ${recognized!.journalEntryIds.length}`);

  const store2 = useAccountingStore.getState();
  const recognitionJe = store2.journalEntries.find((je) => je.id === recognized!.journalEntryIds[0]);
  assert(!!recognitionJe, 'recognition JE exists in store');
  const recDeferredDebit = recognitionJe!.lines.find((l) => l.accountCode === '2400');
  const recRevenueCredit = recognitionJe!.lines.find((l) => l.accountCode === '4300');
  assert(!!recDeferredDebit && recDeferredDebit.debit === 1000, `recognition debits Deferred Revenue 1000, got ${recDeferredDebit?.debit}`);
  assert(!!recRevenueCredit && recRevenueCredit.credit === 1000, `recognition credits Conference Revenue 1000, got ${recRevenueCredit?.credit}`);
  assert(recognitionJe!.totalDebit === recognitionJe!.totalCredit, 'recognition entry is balanced');

  // 3. Idempotency — recognizing again finds nothing left to recognize.
  const secondCall = recognizeDeferredRevenue('conference', 'evt-test-1', 'Test event — delivered again');
  assert(secondCall === null, 're-recognizing an already-recognized event is a no-op');

  // 4. An event that was never captured as deferred has nothing to recognize either.
  const nothingToRecognize = recognizeDeferredRevenue('conference', 'evt-never-existed', 'N/A');
  assert(nothingToRecognize === null, 'recognizing a non-existent reference is a no-op');

  // 5. Non-deferred capture (regular departmental sale) still credits revenue directly,
  // unaffected by any of the above — confirms the `deferred` flag is truly opt-in.
  const regularResult = captureRevenue({
    id: 'RESTAURANT-TEST-1',
    source: 'restaurant',
    customerId: 'CUST-TEST-2',
    customerName: 'Walk-in',
    reference: 'order-test-1',
    description: 'Test restaurant order',
    items: [{ description: 'Dinner', quantity: 1, unitPrice: 200, taxPercent: 0 }],
    subtotal: 200,
    taxAmount: 0,
    total: 200,
    date: new Date().toISOString(),
  });
  assert(!!regularResult, 'regular (non-deferred) capture posts successfully');
  const store3 = useAccountingStore.getState();
  const regularJe = store3.journalEntries.find((je) => je.id === regularResult!.journalEntryId);
  const regularRevenueLine = regularJe!.lines.find((l) => l.accountCode === '4200');
  const regularDeferredLine = regularJe!.lines.find((l) => l.accountCode === '2400');
  assert(!!regularRevenueLine && regularRevenueLine.credit === 200, 'regular capture credits F&B Revenue directly');
  assert(!regularDeferredLine, 'regular capture never touches Deferred Revenue');

  console.log('All deferred revenue regression checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
