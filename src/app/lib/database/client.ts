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

/**
 * On Vercel every running server copy opens its own database pool (about 5 connections by
 * default). Several copies at once (busy hours, or old and new copies after a deploy) used up
 * the database's connection limit and took the whole site down ("too many connections").
 * One connection per copy keeps them inside the limit; a request waits briefly instead.
 */
function serverlessDatabaseUrl(): string | undefined {
  const url = process.env.AGM_DB_POSTGRES_URL || process.env.DATABASE_URL
  if (!process.env.VERCEL || !url || !/^postgres(ql)?:\/\//.test(url) || /[?&]connection_limit=/.test(url)) return undefined
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=1&pool_timeout=20`
}

function createClient(): PrismaClient {
  const datasourceUrl = serverlessDatabaseUrl()
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  })
  // Every write tells that hotel's open screens to refresh (live updates).
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args)
          // Not awaited: a sync or realtime note must never hold up (or deadlock) the write itself.
          void afterWrite(model, operation, args, result)
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
