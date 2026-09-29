import { PrismaClient, AccountType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { buildPrebuiltChartOfAccounts } from '../src/app/lib/accounting/prebuiltChartOfAccounts'
import { seedChartOfAccountsForTenant } from '../src/app/lib/accounting/seedChartOfAccounts'
import { ensureDefaultRolesForTenant } from '../src/app/lib/settings/roleRepository'

const prisma = new PrismaClient()

const ACCOUNT_TYPE_MAP: Record<string, AccountType> = {
  Asset: AccountType.ASSET,
  Liability: AccountType.LIABILITY,
  Equity: AccountType.EQUITY,
  Revenue: AccountType.REVENUE,
  Expense: AccountType.EXPENSE,
  'Cost of Sales': AccountType.EXPENSE,
  'Operating Expense': AccountType.EXPENSE,
  Contra: AccountType.ASSET,
}

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create demo tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      name: 'Demo Hotel',
      subdomain: 'demo',
      plan: 'professional',
      status: 'active',
      maxUsers: 10,
      maxRooms: 50,
      maxProperties: 2,
      features: {
        housekeeping: true,
        maintenance: true,
        inventory: true,
        reporting: true,
        api: true
      },
      metadata: {
        industry: 'hospitality',
        region: 'ghana',
        setupDate: new Date().toISOString()
      }
    }
  })

  console.log('✅ Created demo tenant:', demoTenant.name)

  // Create demo property
  const demoProperty = await prisma.property.upsert({
    where: { 
      tenantId_name: {
        tenantId: demoTenant.id,
        name: 'Demo Hotel Accra'
      }
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: 'Demo Hotel Accra',
      address: '123 Accra Street',
      city: 'Accra',
      state: 'Greater Accra',
      country: 'Ghana',
      postalCode: '00233',
      phone: '+233 20 123 4567',
      email: 'info@demohotel.com',
      website: 'https://demohotel.com',
      timezone: 'Africa/Accra',
      currency: 'GHS',
      isActive: true
    }
  })

  console.log('✅ Created demo property:', demoProperty.name)

  // Create demo users
  const hashedPassword = await bcrypt.hash('password123', 12)

  const adminUser = await prisma.user.upsert({
    where: { 
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'admin@demohotel.com'
      }
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: 'admin@demohotel.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'admin',
      permissions: ['all'],
      isActive: true
    }
  })

  const managerUser = await prisma.user.upsert({
    where: { 
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'manager@demohotel.com'
      }
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: 'manager@demohotel.com',
      name: 'Manager User',
      password: hashedPassword,
      role: 'manager',
      permissions: ['reservations', 'guests', 'housekeeping', 'reports'],
      isActive: true
    }
  })

  const staffUser = await prisma.user.upsert({
    where: { 
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'staff@demohotel.com'
      }
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: 'staff@demohotel.com',
      name: 'Staff User',
      password: hashedPassword,
      role: 'staff',
      permissions: ['reservations', 'guests'],
      isActive: true
    }
  })

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'night@demohotel.com',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: 'night@demohotel.com',
      name: 'Night Manager',
      password: hashedPassword,
      role: 'night_manager',
      permissions: ['frontdesk', 'reports', 'night_audit'],
      isActive: true,
    },
  })

  console.log('✅ Created demo users')

  await ensureDefaultRolesForTenant(demoTenant.id)
  console.log('✅ Created default roles')

  // Create demo rooms
  const roomTypes = ['standard', 'deluxe', 'suite']
  const floors = [1, 2, 3]
  const roomNumbers = ['101', '102', '103', '201', '202', '203', '301', '302', '303']

  for (let i = 0; i < roomNumbers.length; i++) {
    const roomNumber = roomNumbers[i]
    const floor = floors[Math.floor(i / 3)]
    const roomType = roomTypes[i % roomTypes.length]
    const features = roomType === 'suite' ? ['king_bed', 'ocean_view', 'balcony', 'jacuzzi'] :
                    roomType === 'deluxe' ? ['king_bed', 'ocean_view'] : ['queen_bed']

    await prisma.room.upsert({
      where: {
        tenantId_propertyId_roomNumber: {
          tenantId: demoTenant.id,
          propertyId: demoProperty.id,
          roomNumber
        }
      },
      update: {},
      create: {
        tenantId: demoTenant.id,
        propertyId: demoProperty.id,
        roomNumber,
        roomType,
        floor,
        features,
        status: 'clean',
        isActive: true
      }
    })
  }

  console.log('✅ Created demo rooms')

  // Create demo guests
  const demoGuests = [
    {
      name: 'John Doe',
      email: 'john.doe@email.com',
      phone: '+233 24 123 4567',
      nationality: 'Ghanaian',
      source: 'walkin',
      serialNumber: 'C001'
    },
    {
      name: 'Jane Smith',
      email: 'jane.smith@email.com',
      phone: '+233 20 987 6543',
      nationality: 'American',
      source: 'online',
      socialPlatform: 'facebook',
      socialHandle: 'janesmith',
      serialNumber: 'C002'
    },
    {
      name: 'Kwame Asante',
      email: 'kwame.asante@email.com',
      phone: '+233 26 555 1234',
      nationality: 'Ghanaian',
      source: 'referral',
      referralName: 'John Doe',
      serialNumber: 'C003'
    }
  ]

  for (const guestData of demoGuests) {
    await prisma.guest.upsert({
      where: { serialNumber: guestData.serialNumber },
      update: {},
      create: {
        tenantId: demoTenant.id,
        serialNumber: guestData.serialNumber,
        name: guestData.name,
        email: guestData.email,
        phone: guestData.phone,
        nationality: guestData.nationality,
        source: guestData.source as any,
        socialPlatform: guestData.socialPlatform as any,
        socialHandle: guestData.socialHandle,
        referralName: guestData.referralName,
        isActive: true
      }
    })
  }

  console.log('✅ Created demo guests')

  // Create system settings
  await prisma.systemSettings.upsert({
    where: { tenantId: demoTenant.id },
    update: {},
    create: {
      tenantId: demoTenant.id,
      generalSettings: {
        timezone: 'Africa/Accra',
        currency: 'GHS',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        // The seed already populates a full company profile — a fresh
        // environment shouldn't re-run the setup wizard for data that's
        // already there. See /api/settings/setup-status.
        initialSetupCompleted: true
      },
      hotelSettings: {
        hotelName: 'Demo Hotel Accra',
        address: '123 Accra Street, Accra, Ghana',
        phone: '+233 20 123 4567',
        email: 'info@demohotel.com',
        website: 'https://demohotel.com',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        lateCheckOutFee: 50
      },
      roomSettings: {
        defaultStatus: 'clean',
        statuses: ['clean', 'occupied', 'dirty', 'inspected', 'ooo'],
        // NOT `roomTypes: [...]` here — that key collides with the richer
        // {id, name, amenities: [], ...} room-type objects Settings > Rooms &
        // Pricing reads from this same JSON column via /api/settings/
        // room-management. A plain string here (the old room-status feature's
        // shape) crashes that screen the moment it tries rt.amenities.includes(...)
        // on a string. Room types are meant to be created through that screen,
        // which builds the correct shape.
        features: ['king_bed', 'queen_bed', 'ocean_view', 'balcony', 'jacuzzi'],
        postFirstNightAtCheckin: false,
        nightAuditAutoRun: true,
      },
      financialSettings: {
        currency: 'GHS',
        taxRate: 12.5,
        serviceCharge: 10,
        depositRequired: true,
        depositPercentage: 20
      },
      clientSettings: {
        serialNumberPrefix: 'C',
        serialNumberFormat: 'C###',
        autoGenerateSerial: true,
        requireGhanaCard: false,
        captureMarketingInfo: true
      },
      saasSettings: {
        plan: 'demo',
        invoiceSettings: {
          invoiceNumberPrefix: 'INV',
          invoiceNumberFormat: 'INV-####',
          autoGenerateNumber: true,
          defaultTerms: 'Payment due within 30 days',
          includeTax: true
        },
        receiptSettings: {
          receiptNumberPrefix: 'RCP',
          receiptNumberFormat: 'RCP-####',
          autoGenerateNumber: true,
          includeLogo: true,
          includeQRCode: true
        }
      }
    }
  })

  console.log('✅ Created system settings')

  const prebuiltCoa = buildPrebuiltChartOfAccounts()
  const coaCount = await seedChartOfAccountsForTenant(
    prisma,
    demoTenant.id,
    prebuiltCoa.map((a) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      level: a.level,
      category: a.category,
      parentId: a.parentId,
      position: a.position,
    })),
    ACCOUNT_TYPE_MAP
  )
  console.log(`✅ Seeded ${coaCount} prebuilt Chart of Accounts entries`)

  // ── Ghana Tax Configuration ────────────────────────────────────────────────
  const taxConfigs = [
    { code: 'VAT', name: 'Value Added Tax', rate: 15.0, type: 'VAT', glCode: '2110', isInclusive: false },
    { code: 'NHIL', name: 'National Health Insurance Levy', rate: 2.5, type: 'NHIL', glCode: '2120', isInclusive: false },
    { code: 'GETFUND', name: 'Ghana Education Trust Fund', rate: 2.5, type: 'GETFund', glCode: '2130', isInclusive: false },
    { code: 'TOURISM', name: 'Tourism Development Levy', rate: 1.0, type: 'Tourism', glCode: '2150', isInclusive: false },
    { code: 'WITHHOLDING', name: 'Withholding Tax', rate: 5.0, type: 'Withholding', glCode: '2160', isInclusive: false },
  ]

  for (const tax of taxConfigs) {
    await prisma.tax.upsert({
      where: { tenantId_code: { tenantId: demoTenant.id, code: tax.code } },
      update: { rate: tax.rate, isActive: true },
      create: {
        tenantId: demoTenant.id,
        code: tax.code,
        name: tax.name,
        rate: tax.rate,
        type: tax.type,
        isInclusive: tax.isInclusive,
        isActive: true,
      },
    })
  }
  console.log(`✅ Seeded ${taxConfigs.length} Ghana tax configurations`)

  // ── Payment Methods ────────────────────────────────────────────────────────
  const paymentMethods = [
    { code: 'CASH', name: 'Cash', type: 'cash', glAccountCode: '1110' },
    { code: 'CARD', name: 'Credit/Debit Card', type: 'card', glAccountCode: '1120' },
    { code: 'MOMO', name: 'Mobile Money', type: 'mobile', glAccountCode: '1120' },
    { code: 'BANK', name: 'Bank Transfer', type: 'bank', glAccountCode: '1120' },
    { code: 'CHEQUE', name: 'Cheque', type: 'cheque', glAccountCode: '1120' },
    { code: 'CREDIT', name: 'Credit (Guest Account)', type: 'credit', glAccountCode: '1210' },
    { code: 'CORP', name: 'Corporate Billing', type: 'corporate', glAccountCode: '1210' },
  ]

  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { tenantId_code: { tenantId: demoTenant.id, code: pm.code } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        code: pm.code,
        name: pm.name,
        type: pm.type,
        isActive: true,
      },
    })
  }
  console.log(`✅ Seeded ${paymentMethods.length} payment methods`)

  // ── F&B Menu Items ─────────────────────────────────────────────────────────
  const menuItems = [
    // ── RESTAURANT — Food (GL 4210) ──────────────────────────────────────────
    { code: 'RST-001', name: 'Jollof Rice & Chicken', category: 'food', venue: 'restaurant', route: 'kitchen', unitPrice: 85, costPrice: 28, glAccountCode: '4210', prepMinutes: 20, sortOrder: 1 },
    { code: 'RST-002', name: 'Banku & Tilapia', category: 'food', venue: 'restaurant', route: 'kitchen', unitPrice: 95, costPrice: 32, glAccountCode: '4210', prepMinutes: 25, sortOrder: 2 },
    { code: 'RST-003', name: 'Waakye with Stew', category: 'food', venue: 'restaurant', route: 'kitchen', unitPrice: 65, costPrice: 20, glAccountCode: '4210', prepMinutes: 15, sortOrder: 3 },
    { code: 'RST-004', name: 'Grilled Whole Tilapia', category: 'food', venue: 'restaurant', route: 'kitchen', unitPrice: 120, costPrice: 45, glAccountCode: '4210', prepMinutes: 30, sortOrder: 4 },
    { code: 'RST-005', name: 'Fried Rice & Chicken', category: 'food', venue: 'restaurant', route: 'kitchen', unitPrice: 80, costPrice: 25, glAccountCode: '4210', prepMinutes: 20, sortOrder: 5 },
    { code: 'RST-006', name: 'Fufu & Light Soup', category: 'food', venue: 'restaurant', route: 'kitchen', unitPrice: 75, costPrice: 22, glAccountCode: '4210', prepMinutes: 25, sortOrder: 6 },
    { code: 'RST-007', name: 'Kelewele', category: 'snack', venue: 'restaurant', route: 'kitchen', unitPrice: 30, costPrice: 8, glAccountCode: '4210', prepMinutes: 10, sortOrder: 7 },
    { code: 'RST-008', name: 'Club Sandwich', category: 'food', venue: 'restaurant', route: 'kitchen', unitPrice: 70, costPrice: 22, glAccountCode: '4210', prepMinutes: 15, sortOrder: 8 },
    { code: 'RST-009', name: 'Beef Burger & Fries', category: 'food', venue: 'restaurant', route: 'kitchen', unitPrice: 90, costPrice: 30, glAccountCode: '4210', prepMinutes: 18, sortOrder: 9 },
    { code: 'RST-010', name: 'Garden Salad', category: 'food', venue: 'restaurant', route: 'kitchen', unitPrice: 45, costPrice: 12, glAccountCode: '4210', prepMinutes: 8, sortOrder: 10 },
    { code: 'RST-011', name: 'Continental Breakfast', category: 'food', venue: 'restaurant', route: 'kitchen', unitPrice: 95, costPrice: 30, glAccountCode: '4210', prepMinutes: 15, sortOrder: 11 },
    { code: 'RST-012', name: 'Full English Breakfast', category: 'food', venue: 'restaurant', route: 'kitchen', unitPrice: 120, costPrice: 40, glAccountCode: '4210', prepMinutes: 20, sortOrder: 12 },
    // ── RESTAURANT — Desserts ──────────────────────────────────────────────
    { code: 'RST-D01', name: 'Chocolate Cake', category: 'dessert', venue: 'restaurant', route: 'kitchen', unitPrice: 40, costPrice: 12, glAccountCode: '4210', prepMinutes: 5, sortOrder: 20 },
    { code: 'RST-D02', name: 'Fruit Salad', category: 'dessert', venue: 'restaurant', route: 'kitchen', unitPrice: 35, costPrice: 10, glAccountCode: '4210', prepMinutes: 5, sortOrder: 21 },
    { code: 'RST-D03', name: 'Ice Cream (2 scoops)', category: 'dessert', venue: 'restaurant', route: 'kitchen', unitPrice: 30, costPrice: 8, glAccountCode: '4210', prepMinutes: 3, sortOrder: 22 },
    // ── BAR — Beverages (GL 4220) ─────────────────────────────────────────
    { code: 'BAR-001', name: 'Star Beer (Bottle)', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 25, costPrice: 10, glAccountCode: '4220', prepMinutes: 2, sortOrder: 1 },
    { code: 'BAR-002', name: 'Club Beer (Bottle)', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 25, costPrice: 10, glAccountCode: '4220', prepMinutes: 2, sortOrder: 2 },
    { code: 'BAR-003', name: 'Guinness (Bottle)', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 28, costPrice: 11, glAccountCode: '4220', prepMinutes: 2, sortOrder: 3 },
    { code: 'BAR-004', name: 'Whisky (Single)', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 45, costPrice: 15, glAccountCode: '4220', prepMinutes: 2, sortOrder: 4 },
    { code: 'BAR-005', name: 'Gin & Tonic', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 40, costPrice: 12, glAccountCode: '4220', prepMinutes: 3, sortOrder: 5 },
    { code: 'BAR-006', name: 'Rum & Coke', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 40, costPrice: 12, glAccountCode: '4220', prepMinutes: 3, sortOrder: 6 },
    { code: 'BAR-007', name: 'Red Wine (Glass)', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 55, costPrice: 20, glAccountCode: '4220', prepMinutes: 2, sortOrder: 7 },
    { code: 'BAR-008', name: 'White Wine (Glass)', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 55, costPrice: 20, glAccountCode: '4220', prepMinutes: 2, sortOrder: 8 },
    { code: 'BAR-009', name: 'Cocktail of the Day', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 60, costPrice: 18, glAccountCode: '4220', prepMinutes: 5, sortOrder: 9 },
    { code: 'BAR-010', name: 'Fresh Fruit Juice', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 30, costPrice: 8, glAccountCode: '4220', prepMinutes: 5, sortOrder: 10 },
    { code: 'BAR-011', name: 'Soft Drink (Can)', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 15, costPrice: 5, glAccountCode: '4220', prepMinutes: 1, sortOrder: 11 },
    { code: 'BAR-012', name: 'Water (500ml)', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 10, costPrice: 3, glAccountCode: '4220', prepMinutes: 1, sortOrder: 12 },
    { code: 'BAR-013', name: 'Water (1.5L)', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 18, costPrice: 5, glAccountCode: '4220', prepMinutes: 1, sortOrder: 13 },
    { code: 'BAR-014', name: 'Coffee', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 25, costPrice: 6, glAccountCode: '4220', prepMinutes: 5, sortOrder: 14 },
    { code: 'BAR-015', name: 'Tea', category: 'beverage', venue: 'bar', route: 'bar', unitPrice: 20, costPrice: 4, glAccountCode: '4220', prepMinutes: 4, sortOrder: 15 },
    // ── ROOM SERVICE (GL 4230) — same items, higher price ─────────────────
    { code: 'RS-001', name: 'Jollof Rice & Chicken (Room Service)', category: 'food', venue: 'room_service', route: 'kitchen', unitPrice: 100, costPrice: 28, glAccountCode: '4230', prepMinutes: 30, sortOrder: 1 },
    { code: 'RS-002', name: 'Club Sandwich (Room Service)', category: 'food', venue: 'room_service', route: 'kitchen', unitPrice: 85, costPrice: 22, glAccountCode: '4230', prepMinutes: 20, sortOrder: 2 },
    { code: 'RS-003', name: 'Beef Burger & Fries (Room Service)', category: 'food', venue: 'room_service', route: 'kitchen', unitPrice: 105, costPrice: 30, glAccountCode: '4230', prepMinutes: 25, sortOrder: 3 },
    { code: 'RS-004', name: 'Continental Breakfast (Room Service)', category: 'food', venue: 'room_service', route: 'kitchen', unitPrice: 115, costPrice: 30, glAccountCode: '4230', prepMinutes: 20, sortOrder: 4 },
    { code: 'RS-005', name: 'Beer (Room Service)', category: 'beverage', venue: 'room_service', route: 'bar', unitPrice: 35, costPrice: 10, glAccountCode: '4230', prepMinutes: 5, sortOrder: 5 },
    { code: 'RS-006', name: 'Soft Drink (Room Service)', category: 'beverage', venue: 'room_service', route: 'bar', unitPrice: 20, costPrice: 5, glAccountCode: '4230', prepMinutes: 3, sortOrder: 6 },
    { code: 'RS-007', name: 'Water (Room Service)', category: 'beverage', venue: 'room_service', route: 'bar', unitPrice: 15, costPrice: 3, glAccountCode: '4230', prepMinutes: 2, sortOrder: 7 },
  ]

  for (const item of menuItems) {
    await prisma.fBMenuItem.upsert({
      where: { tenantId_code: { tenantId: demoTenant.id, code: item.code } },
      update: { unitPrice: item.unitPrice, isAvailable: true },
      create: {
        tenantId: demoTenant.id,
        ...item,
        isAvailable: true,
      },
    })
  }
  console.log(`✅ Seeded ${menuItems.length} F&B menu items`)

  // ── Restaurant floor tables ────────────────────────────────────────────────
  const floorTables = [
    { number: '1', capacity: 2, section: 'main floor' },
    { number: '2', capacity: 4, section: 'main floor' },
    { number: '3', capacity: 4, section: 'main floor' },
    { number: '4', capacity: 6, section: 'main floor' },
    { number: '5', capacity: 2, section: 'patio' },
    { number: '6', capacity: 4, section: 'patio' },
    { number: 'B1', capacity: 2, section: 'bar' },
    { number: 'B2', capacity: 4, section: 'bar' },
  ]
  for (const t of floorTables) {
    await prisma.restaurantTable.upsert({
      where: { tenantId_number: { tenantId: demoTenant.id, number: t.number } },
      update: { capacity: t.capacity, section: t.section },
      create: {
        tenantId: demoTenant.id,
        number: t.number,
        capacity: t.capacity,
        section: t.section,
        status: 'available',
      },
    })
  }
  console.log(`✅ Seeded ${floorTables.length} restaurant tables`)

  console.log('🎉 Database seeding completed successfully!')
  // Vercel keeps build logs; don't print a working admin login into them.
  // Existing accounts are never updated above, so changed passwords survive every deploy.
  if (process.env.VERCEL) return
  console.log('\n📋 Demo Credentials:')
  console.log('Tenant: demo')
  console.log('Admin: admin@demohotel.com / password123')
  console.log('Manager: manager@demohotel.com / password123')
  console.log('Staff: staff@demohotel.com / password123')
  console.log('Night Manager: night@demohotel.com / password123')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
