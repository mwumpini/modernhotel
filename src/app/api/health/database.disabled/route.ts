import { NextResponse } from 'next/server'
import { healthCheck, testConnection } from '@/app/lib/database/client'

export async function GET() {
  try {
    const startTime = Date.now()
    
    // Test database connection
    const isConnected = await testConnection()
    const responseTime = Date.now() - startTime
    
    if (!isConnected) {
      return NextResponse.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
        responseTime
      }, { status: 503 })
    }

    // Get detailed health info
    const dbHealth = await healthCheck()
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime,
      details: dbHealth,
      connection: {
        status: 'connected',
        type: 'postgresql',
        pool: 'active'
      }
    })
  } catch (error) {
    console.error('Database health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Database connection error',
      connection: {
        status: 'disconnected',
        type: 'postgresql',
        pool: 'inactive'
      }
    }, { status: 503 })
  }
}
