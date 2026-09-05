import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getTenantFromRequest, getTenantContext } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB — plenty for a scanned receipt/certificate/photo

/**
 * Shared upload endpoint for attachment fields across the app (accounting receipts,
 * WHT certificates, purchase invoices, payments — any module that previously just
 * captured a typed filename). Stores the file in Vercel Blob and returns its public URL.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 413 })
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pathname = `${ctx.tenantId}/${Date.now()}-${safeName}`

    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: false,
    })

    return NextResponse.json({ url: blob.url, filename: file.name }, { status: 201 })
  } catch (error) {
    console.error('[upload][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
