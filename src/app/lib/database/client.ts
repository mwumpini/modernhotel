import path from 'path'
import { PrismaClient } from '@prisma/client'
import { afterWrite } from '../realtime/publish'

// The hotel launcher sets an absolute path. Dev and seed fall back to prisma/test.db.
if (!process.env.SQLITE_DATABASE_URL) {
  const db = path.join(process.cwd(), 'prisma', 'test.db').replace(/\\/g, '/')
  process.env.SQLITE_DATABASE_URL = `file:${db}`
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient(): PrismaClient {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  // Every write tells that hotel's open screens to refresh (live updates).
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args)
          afterWrite(model, operation, args, result)
          return result
        },
      },
    },
  }) as unknown as PrismaClient
}

export const prisma = globalForPrisma.prisma ?? createClient()

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
    const started = Date.now()
    await prisma.$queryRaw`SELECT 1`
    // Round trip server → database; with both in the same region this should be a few ms.
    const latencyMs = Date.now() - started
    return { status: 'healthy', latencyMs, region: process.env.VERCEL_REGION ?? 'local', timestamp: new Date().toISOString() }
  } catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
