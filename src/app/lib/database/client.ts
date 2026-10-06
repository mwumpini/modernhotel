import path from 'path'
import { PrismaClient } from '@prisma/client'

// The hotel launcher sets an absolute path. Dev and seed fall back to prisma/test.db.
if (!process.env.SQLITE_DATABASE_URL) {
  const db = path.join(process.cwd(), 'prisma', 'test.db').replace(/\\/g, '/')
  process.env.SQLITE_DATABASE_URL = `file:${db}`
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Database connection test
export async function testConnection() {
  try {
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

// Graceful shutdown
export async function disconnect() {
  await prisma.$disconnect()
}

// Health check
export async function healthCheck() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'healthy', timestamp: new Date().toISOString() }
  } catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
