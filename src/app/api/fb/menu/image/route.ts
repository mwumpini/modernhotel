import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/app/lib/api/tenant'
import { normalizeTenantSubdomain } from '@/app/lib/api/tenantSubdomain'
import { prisma } from '@/app/lib/database/client'
import { parseMenuImage } from '@/app/lib/fb/menuImage'

/**
 * GET /api/fb/menu/image?t=<hotel>&id=<menu item>&v=<version>
 * A menu item's photo as an image, so an <img> can load it (it can't send the tenant header,
 * hence ?t=). Menu photos are public like the menu list itself. `v` changes when the item is
 * saved, so each version can be cached for a long time.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subdomain = normalizeTenantSubdomain(searchParams.get('t') || '')
    const id = searchParams.get('id') || ''
    if (!subdomain || !id) return new NextResponse(null, { status: 404 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return new NextResponse(null, { status: 404 })

    const item = await prisma.fBMenuItem.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { imageUrl: true } })
    const image = parseMenuImage(item?.imageUrl)
    if (!image) return new NextResponse(null, { status: 404 })

    return new NextResponse(new Uint8Array(image.bytes), {
      headers: {
        'Content-Type': image.mime,
        'Cache-Control': searchParams.get('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[fb/menu/image][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
