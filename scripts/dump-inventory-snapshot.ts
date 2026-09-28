import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const t = await p.tenant.findFirst({ where: { subdomain: 'demo' } });
  if (!t) throw new Error('no demo');
  const tid = t.id;
  const out = {
    items: await p.inventoryItem.findMany({
      where: { tenantId: tid },
      select: { code: true, name: true, quantityOnHand: true, location: true },
      orderBy: { code: 'asc' },
    }),
    suppliers: await p.supplier.findMany({
      where: { tenantId: tid },
      select: { code: true, name: true },
    }),
    pos: await p.purchaseOrder.findMany({
      where: { tenantId: tid },
      select: { poNumber: true, status: true },
    }),
    reqs: await p.requisition.findMany({
      where: { tenantId: tid },
      select: { requisitionNumber: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    transfers: await p.stockTransfer.findMany({
      where: { tenantId: tid },
      select: { transferNumber: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    issues: await p.goodsIssue.findMany({
      where: { tenantId: tid },
      select: { issueNumber: true, status: true },
    }),
    invoices: await p.supplierInvoice.findMany({
      where: { tenantId: tid },
      select: { invoiceNumber: true, status: true },
    }),
    counts: await p.stockCount.findMany({
      where: { tenantId: tid },
      select: { countNumber: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    grns: await p.goodsReceiptNote.findMany({
      where: { tenantId: tid },
      select: { grnNumber: true, status: true },
    }),
  };
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await p.$disconnect();
  });
