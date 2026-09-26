/**
 * Inventory E2E certification — repository + Prisma persistence smoke.
 * Run: npx tsx scripts/certify-inventory-e2e.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  upsertStockTransfer,
  listStockTransfers,
  upsertStockCount,
  listStockCounts,
  upsertGoodsIssue,
  listGoodsIssues,
  upsertGoodsReceiptNote,
  listGoodsReceiptNotes,
  recordStockTransaction,
} from '../src/app/lib/inventory/repository';

const prisma = new PrismaClient();
const stamp = Date.now().toString().slice(-6);
const results: { step: string; ok: boolean; detail?: string }[] = [];

function pass(step: string, detail?: string) {
  results.push({ step, ok: true, detail });
  console.log(`✅ ${step}${detail ? ` — ${detail}` : ''}`);
}
function fail(step: string, detail?: string) {
  results.push({ step, ok: false, detail });
  console.error(`❌ ${step}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { subdomain: 'demo' } });
  if (!tenant) {
    fail('tenant', 'demo tenant missing — run prisma seed');
    process.exit(1);
  }
  pass('tenant', tenant.subdomain);
  const tenantId = tenant.id;

  // Model presence
  for (const [label, run] of [
    ['stockTransfer', () => prisma.stockTransfer.count({ where: { tenantId } })],
    ['stockCount', () => prisma.stockCount.count({ where: { tenantId } })],
    ['goodsIssue', () => prisma.goodsIssue.count({ where: { tenantId } })],
    ['goodsReceiptNote', () => prisma.goodsReceiptNote.count({ where: { tenantId } })],
    ['purchaseOrder', () => prisma.purchaseOrder.count({ where: { tenantId } })],
    ['requisition', () => prisma.requisition.count({ where: { tenantId } })],
    ['inventoryItem', () => prisma.inventoryItem.count({ where: { tenantId } })],
  ] as const) {
    try {
      const n = await run();
      pass(`schema.${label}`, `count=${n}`);
    } catch (e: any) {
      fail(`schema.${label}`, e.message);
    }
  }

  let item = await prisma.inventoryItem.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (!item) {
    item = await prisma.inventoryItem.create({
      data: {
        tenantId,
        code: `CERT-${stamp}`,
        name: `Cert Item ${stamp}`,
        defaultCost: 10,
        quantityOnHand: 100,
        minimumStock: 5,
        maximumStock: 500,
        reorderLevel: 10,
        location: 'Main Store',
        isActive: true,
        isPerishable: false,
        isSerialized: false,
      },
    });
    pass('seed.item', item.code);
  } else {
    pass('seed.item', `${item.code} onHand=${item.quantityOnHand}`);
  }

  // --- Transfer document round-trip ---
  const transferId = `cert-st-${stamp}`;
  const transferNumber = `ST-CERT-${stamp}`;
  try {
    await upsertStockTransfer({
      id: transferId,
      tenantId,
      transferNumber,
      fromLocation: 'Main Store',
      toLocation: 'Floor Store',
      status: 'pending',
      priority: 'medium',
      createdBy: 'e2e-cert',
      items: [
        {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          quantity: 2,
          unitCost: Number(item.defaultCost || 10),
        },
      ],
    });
    const listed = await listStockTransfers(tenantId);
    const found = listed.find((t) => t.id === transferId || t.transferNumber === transferNumber);
    if (!found) fail('transfer.persist', 'not found after upsert');
    else pass('transfer.persist', found.transferNumber);

    await upsertStockTransfer({
      id: found!.id,
      tenantId,
      transferNumber: found!.transferNumber,
      fromLocation: found!.fromLocation,
      toLocation: found!.toLocation,
      status: 'delivered',
      priority: 'medium',
      createdBy: 'e2e-cert',
      actualDeliveryDate: new Date(),
      items: [
        {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          quantity: 2,
          unitCost: Number(item.defaultCost || 10),
          transferredQuantity: 2,
        },
      ],
    });
    pass('transfer.deliver-status', 'delivered');

    // Location move + net-zero transfer txns (as UI does)
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { location: 'Floor Store' },
    });
    await recordStockTransaction({
      tenantId,
      itemId: item.id,
      type: 'transfer_out',
      quantity: -2,
      referenceType: 'transfer',
      referenceId: found!.id,
      performedBy: 'e2e-cert',
      notes: 'cert transfer out',
    });
    await recordStockTransaction({
      tenantId,
      itemId: item.id,
      type: 'transfer_in',
      quantity: 2,
      referenceType: 'transfer',
      referenceId: found!.id,
      performedBy: 'e2e-cert',
      notes: 'cert transfer in',
    });
    const afterTx = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
    const onHand = Number(afterTx?.quantityOnHand ?? 0);
    if (onHand === Number(item.quantityOnHand)) pass('transfer.qty-net-zero', `onHand=${onHand}`);
    else fail('transfer.qty-net-zero', `expected ${item.quantityOnHand} got ${onHand}`);
    if (afterTx?.location === 'Floor Store') pass('transfer.location', 'Floor Store');
    else fail('transfer.location', String(afterTx?.location));
  } catch (e: any) {
    fail('transfer.flow', e.message);
  }

  // --- Stock count document ---
  try {
    const countId = `cert-cnt-${stamp}`;
    const countNumber = `CNT-CERT-${stamp}`;
    const expected = Number((await prisma.inventoryItem.findUnique({ where: { id: item.id } }))?.quantityOnHand || 0);
    const counted = expected + 1; // overcount
    await upsertStockCount({
      id: countId,
      tenantId,
      countNumber,
      countType: 'spot',
      location: 'Floor Store',
      status: 'in-progress',
      createdBy: 'e2e-cert',
      items: [
        {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          expectedQuantity: expected,
          countedQuantity: counted,
          variance: 1,
          unitCost: Number(item.defaultCost || 10),
          varianceValue: Number(item.defaultCost || 10),
        },
      ],
    });
    const counts = await listStockCounts(tenantId);
    const c = counts.find((x) => x.id === countId || x.countNumber === countNumber);
    if (!c) fail('count.persist', 'missing');
    else pass('count.persist', c.countNumber);

    await upsertStockCount({
      id: c!.id,
      tenantId,
      countNumber: c!.countNumber,
      countType: 'spot',
      location: 'Floor Store',
      status: 'completed',
      endDate: new Date(),
      createdBy: 'e2e-cert',
      items: [
        {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          expectedQuantity: expected,
          countedQuantity: counted,
          variance: 1,
          unitCost: Number(item.defaultCost || 10),
          varianceValue: Number(item.defaultCost || 10),
        },
      ],
    });
    // Apply variance like UI complete
    await recordStockTransaction({
      tenantId,
      itemId: item.id,
      type: 'count',
      quantity: 1,
      referenceType: 'adjustment',
      referenceId: c!.id,
      performedBy: 'e2e-cert',
      notes: 'cert overcount',
    });
    const afterCount = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
    if (Number(afterCount?.quantityOnHand) === expected + 1) pass('count.apply-variance', `onHand=${afterCount?.quantityOnHand}`);
    else fail('count.apply-variance', `got ${afterCount?.quantityOnHand} expected ${expected + 1}`);
  } catch (e: any) {
    fail('count.flow', e.message);
  }

  // --- Goods issue document + stock out ---
  try {
    const issueId = `cert-iss-${stamp}`;
    const issueNumber = `ISS-CERT-${stamp}`;
    const before = Number((await prisma.inventoryItem.findUnique({ where: { id: item.id } }))?.quantityOnHand || 0);
    await upsertGoodsIssue({
      id: issueId,
      tenantId,
      issueNumber,
      department: 'Housekeeping',
      issuedTo: 'E2E Tester',
      status: 'issued',
      issuedBy: 'e2e-cert',
      items: [
        {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          quantity: 3,
          unitCost: Number(item.defaultCost || 10),
          reason: 'cert issue',
        },
      ],
    });
    const issues = await listGoodsIssues(tenantId);
    const iss = issues.find((x) => x.id === issueId || x.issueNumber === issueNumber);
    if (!iss) fail('issue.persist', 'missing');
    else pass('issue.persist', iss.issueNumber);

    await recordStockTransaction({
      tenantId,
      itemId: item.id,
      type: 'issue',
      quantity: -3,
      referenceType: 'adjustment',
      referenceId: issueId,
      performedBy: 'e2e-cert',
      notes: 'Issued to E2E Tester — Housekeeping.',
    });
    const afterIss = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
    if (Number(afterIss?.quantityOnHand) === before - 3) pass('issue.stock-out', `onHand=${afterIss?.quantityOnHand}`);
    else fail('issue.stock-out', `got ${afterIss?.quantityOnHand} expected ${before - 3}`);
  } catch (e: any) {
    fail('issue.flow', e.message);
  }

  // --- GRN list endpoint shape (may be empty) ---
  try {
    const grns = await listGoodsReceiptNotes(tenantId);
    pass('grn.list', `count=${grns.length}`);
  } catch (e: any) {
    fail('grn.list', e.message);
  }

  // Cross-device hydrate simulation: re-list all docs
  try {
    const [t, c, i] = await Promise.all([
      listStockTransfers(tenantId),
      listStockCounts(tenantId),
      listGoodsIssues(tenantId),
    ]);
    const hasT = t.some((x) => String(x.transferNumber).includes(`CERT-${stamp}`));
    const hasC = c.some((x) => String(x.countNumber).includes(`CERT-${stamp}`));
    const hasI = i.some((x) => String(x.issueNumber).includes(`CERT-${stamp}`));
    if (hasT && hasC && hasI) pass('cross-device.hydrate', 'transfer+count+issue visible');
    else fail('cross-device.hydrate', `T=${hasT} C=${hasC} I=${hasI}`);
  } catch (e: any) {
    fail('cross-device.hydrate', e.message);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- SUMMARY ---');
  console.log(`passed=${results.filter((r) => r.ok).length} failed=${failed.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`FAIL: ${f.step} ${f.detail || ''}`));
    process.exit(1);
  }
  console.log('INVENTORY DATA LAYER: CERTIFIED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
