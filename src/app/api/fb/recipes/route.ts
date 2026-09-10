import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { listRecipes, upsertRecipe, deleteRecipe } from '@/app/lib/fb/recipesRepository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const recipes = await listRecipes(ctx.tenantId)
    return NextResponse.json({ recipes })
  } catch (error) {
    console.error('[fb/recipes][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!body.name || !body.category) return NextResponse.json({ error: 'name and category are required' }, { status: 400 })
    const recipe = await upsertRecipe(ctx.tenantId, body.id, body)
    await createAuditLog(ctx.tenantId, null, 'RECIPE_SAVED', 'Recipe', body.id, undefined, { name: recipe.name, category: recipe.category }, request)
    return NextResponse.json({ recipe })
  } catch (error) {
    console.error('[fb/recipes][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })
    const ok = await deleteRecipe(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    await createAuditLog(ctx.tenantId, null, 'RECIPE_DELETED', 'Recipe', id, undefined, undefined, request)
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[fb/recipes][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
