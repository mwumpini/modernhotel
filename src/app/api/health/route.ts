import { NextResponse } from 'next/server'
import { healthCheck } from '@/app/lib/database/client'

export async function GET() {
  try {
    const dbHealth = await healthCheck()
    
    const systemHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: dbHealth,
        api: { status: 'healthy', responseTime: Date.now() }
      }
    }

    const statusCode = dbHealth.status === 'healthy' ? 200 : 503

    return NextResponse.json(systemHealth, { status: statusCode })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {
        database: { status: 'unhealthy', error: 'Connection failed' },
        api: { status: 'unhealthy', error: 'Health check failed' }
      }
    }, { status: 503 })
  }
}
