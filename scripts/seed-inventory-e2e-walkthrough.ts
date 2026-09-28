/**
 * Seed multiple inventory docs for UI walkthrough testing.
 * Run: npx tsx scripts/seed-inventory-e2e-walkthrough.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { subdomain: 'demo' } });
  if (!tenant) throw new Error('demo tenant missing');
  const tid = tenant.id;
  const stamp = Date.now().toString().slice(-6);

  const s1 = await prisma.supplier.upsert({
    where: { tenantId_code: { tenantId: tid, code: 'SUP-E2E-FP' } },
    update: {
      name: 'E2E Fresh Produce Co',
      email: 'fresh@e2e.test',
      phone: '0244000001',
      isActive: true,
    },
    create: {
      tenantId: tid,
      code: 'SUP-E2E-FP',
      name: 'E2E Fresh Produce Co',
      email: 'fresh@e2e.test',
      phone: '0244000001',
      contactPerson: 'Ama Mensah',
      isActive: true,
    },
  });
  const s2 = await prisma.supplier.upsert({
    where: { tenantId_code: { tenantId: tid, code: 'SUP-E2E-CL' } },
    update: {
      name: 'E2E Cleaning Supplies GH',
      email: 'clean@e2e.test',
      phone: '0244000002',
      isActive: true,
    },
    create: {
      tenantId: tid,
      code: 'SUP-E2E-CL',
      name: 'E2E Cleaning Supplies GH',
      email: 'clean@e2e.test',
      phone: '0244000002',
      contactPerson: 'Kwesi Boateng',
      isActive: true,
    },
  });
  console.log('suppliers', s1.code, s2.code);

  const cat = await prisma.itemCategory.findFirst({ where: { tenantId: tid } });
  const unit = await prisma.unitOfMeasure.findFirst({ where: { tenantId: tid } });
  const items = [];
  for (const [code, name, cost, qty, loc, sid] of [
    ['E2E-TOMATO-400G', 'E2E Tomato Paste 400g', 12, 50, 'Main Store', s1.id],
    ['E2E-DETERGENT-5L', 'E2E Detergent 5L', 35, 20, 'Main Store', s2.id],
    ['E2E-CHICKEN-KG', 'E2E Chicken Breast kg', 55, 15, 'Cold Room', s1.id],
  ] as const) {
    const it = await prisma.inventoryItem.upsert({
      where: { tenantId_code: { tenantId: tid, code } },
      update: {
        name,
        defaultCost: cost,
        quantityOnHand: qty,
        location: loc,
        supplierId: sid,
        isActive: true,
        reorderLevel: 5,
        maximumStock: 200,
      },
      create: {
        tenantId: tid,
        code,
        name,
        defaultCost: cost,
        quantityOnHand: qty,
        location: loc,
        supplierId: sid,
        isActive: true,
        reorderLevel: 5,
        minimumStock: 2,
        maximumStock: 200,
        categoryId: cat?.id,
        unitId: unit?.id,
      },
    });
    items.push(it);
    console.log('item', it.code);
  }

  const palm = await prisma.inventoryItem.findFirst({ where: { tenantId: tid, code: 'ITM100004' } });
  const lineItem = palm || items[0];
  const unitCost = Number(lineItem.defaultCost || 10);

  for (const [num, dept, status] of [
    [`REQ-E2E-${stamp}-A`, 'kitchen', 'approved'],
    [`REQ-E2E-${stamp}-B`, 'restaurant', 'pending'],
  ] as const) {
    const req = await prisma.requisition.create({
      data: {
        tenantId: tid,
        requisitionNumber: num,
        requestedBy: 'E2E Tester',
        status,
        department: dept,
        approvedBy: status === 'approved' ? 'Admin' : undefined,
        approvedAt: status === 'approved' ? new Date() : undefined,
        notes: 'E2E walkthrough',
        items: {
          create: [
            {
              tenantId: tid,
              itemId: lineItem.id,
              itemCode: lineItem.code,
              itemName: lineItem.name,
              quantity: 10,
              estimatedPrice: unitCost,
              totalCost: 10 * unitCost,
              preferredSupplierId: s1.id,
              preferredSupplierName: s1.name,
            },
          ],
        },
      },
    });
    console.log('req', req.requisitionNumber, req.status);
  }

  const po = await prisma.purchaseOrder.create({
    data: {
      tenantId: tid,
      poNumber: `PO-E2E-${stamp}`,
      supplierId: s1.id,
      supplierName: s1.name,
      status: 'confirmed',
      priority: 'high',
      totalAmount: 20 * unitCost,
      taxAmount: 0,
      finalAmount: 20 * unitCost,
      notes: 'E2E receivable PO',
      createdBy: 'E2E',
      items: {
        create: [
          {
            tenantId: tid,
            itemId: lineItem.id,
            itemCode: lineItem.code,
            itemName: lineItem.name,
            quantity: 20,
            unitCost,
            totalCost: 20 * unitCost,
            receivedQuantity: 0,
          },
        ],
      },
    },
    include: { items: true },
  });
  console.log('po', po.poNumber, po.status);

  const poDraft = await prisma.purchaseOrder.create({
    data: {
      tenantId: tid,
      poNumber: `PO-E2E-${stamp}-D`,
      supplierId: s2.id,
      supplierName: s2.name,
      status: 'draft',
      priority: 'medium',
      totalAmount: 175,
      finalAmount: 175,
      createdBy: 'E2E',
      items: {
        create: [
          {
            tenantId: tid,
            itemId: items[1].id,
            itemCode: items[1].code,
            itemName: items[1].name,
            quantity: 5,
            unitCost: 35,
            totalCost: 175,
          },
        ],
      },
    },
  });
  console.log('po draft', poDraft.poNumber);

  const inv = await prisma.supplierInvoice.create({
    data: {
      tenantId: tid,
      invoiceNumber: `INV-E2E-${stamp}`,
      supplierId: s1.id,
      supplierName: s1.name,
      poId: po.id,
      poNumber: po.poNumber,
      dueDate: new Date(Date.now() + 14 * 864e5),
      subtotal: Number(po.finalAmount),
      totalAmount: Number(po.finalAmount),
      status: 'pending',
      notes: 'E2E invoice',
      items: {
        create: [
          {
            tenantId: tid,
            poItemId: po.items[0].id,
            itemId: lineItem.id,
            itemCode: lineItem.code,
            itemName: lineItem.name,
            quantity: 20,
            unitPrice: unitCost,
            totalPrice: 20 * unitCost,
          },
        ],
      },
    },
  });
  console.log('invoice', inv.invoiceNumber);

  const counts = {
    items: await prisma.inventoryItem.count({ where: { tenantId: tid } }),
    suppliers: await prisma.supplier.count({ where: { tenantId: tid } }),
    reqs: await prisma.requisition.count({ where: { tenantId: tid } }),
    pos: await prisma.purchaseOrder.count({ where: { tenantId: tid } }),
    transfers: await prisma.stockTransfer.count({ where: { tenantId: tid } }),
    issues: await prisma.goodsIssue.count({ where: { tenantId: tid } }),
    invoices: await prisma.supplierInvoice.count({ where: { tenantId: tid } }),
    stockCounts: await prisma.stockCount.count({ where: { tenantId: tid } }),
    grns: await prisma.goodsReceiptNote.count({ where: { tenantId: tid } }),
  };
  console.log('COUNTS', JSON.stringify(counts, null, 2));
  console.log('SEED_OK', stamp);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
