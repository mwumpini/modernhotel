import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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

  console.log('✅ Created demo users')

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
        timeFormat: '24h'
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
        roomTypes: ['standard', 'deluxe', 'suite'],
        features: ['king_bed', 'queen_bed', 'ocean_view', 'balcony', 'jacuzzi']
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
  })

  console.log('✅ Created system settings')

  console.log('🎉 Database seeding completed successfully!')
  console.log('\n📋 Demo Credentials:')
  console.log('Tenant: demo')
  console.log('Admin: admin@demohotel.com / password123')
  console.log('Manager: manager@demohotel.com / password123')
  console.log('Staff: staff@demohotel.com / password123')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
