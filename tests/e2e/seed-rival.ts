/**
 * A second hotel for the data-separation tests: its own Organization ID, one user, and a
 * menu item that Demo Hotel's staff must never see.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const rival = await prisma.tenant.upsert({
    where: { subdomain: 'rival' },
    update: {},
    create: { name: 'Rival Lodge', subdomain: 'rival', plan: 'professional', status: 'active', maxUsers: 5, maxRooms: 20, maxProperties: 1, features: { inventory: true, reporting: true }, metadata: { region: 'ghana' } },
  });
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: rival.id, email: 'admin@rival.test' } },
    update: {},
    create: {
      tenantId: rival.id,
      email: 'admin@rival.test',
      name: 'Rival Admin',
      password: await bcrypt.hash('rival-pass-123', 12),
      role: 'admin',
      permissions: ['all'],
      isActive: true,
    },
  });
  await prisma.fBMenuItem.upsert({
    where: { tenantId_code: { tenantId: rival.id, code: 'RIVAL-SECRET' } },
    update: {},
    create: {
      tenantId: rival.id,
      code: 'RIVAL-SECRET',
      name: 'Rival Secret Cocktail',
      category: 'beverage',
      venue: 'bar',
      route: 'bar',
      unitPrice: 99,
    },
  });
  console.log('Rival Lodge ready');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
