import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { requireAuth } from '@/app/lib/api/auth-guard'
import { rejectIfBackdated } from '@/app/lib/frontoffice/postingDateGuard'
import { businessToday } from '@/app/lib/frontoffice/backdate'
import {
  createCashTransfer,
  getCashCustody,
  listCashTransfers,
  voidCashTransfer,
} from '@/app/lib/frontoffice/cashTransferRepository'
import type { CashierOutlet } from '@/app/lib/frontoffice/cashierShiftRepository'

function parseOutlet(raw: unknown): CashierOutlet {
  return raw === 'restaurant' ? 'restaurant' : 'frontoffice'
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const outlet = parseOutlet(request.nextUrl.searchParams.get('outlet'))
    const mine = request.nextUrl.searchParams.get('mine') === '1'
    const userId = (auth.session as any).user?.id as string | undefined

    if (mine) {
      if (!userId) return NextResponse.json({ error: 'No session user id' }, { status: 400 })
      const custody = await getCashCustody(ctx.tenantId, userId, outlet)
      return NextResponse.json({ custody })
    }

    const transfers = await listCashTransfers(ctx.tenantId, { outlet, limit: 100 })
    return NextResponse.json({ transfers })
  } catch (error) {
    console.error('[frontoffice/cash-transfers][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const user = (auth.session as any).user
    const fromUserId: string | undefined = user?.id
    const fromName: string = user?.name || user?.email || 'Cashier'
    if (!fromUserId) return NextResponse.json({ error: 'No session user id' }, { status: 400 })

    const body = await request.json()
    const outlet = parseOutlet(body.outlet)
    const toType = body.toType === 'cashier' ? 'cashier' : 'accounts'
    const businessDate =
      /^\d{4}-\d{2}-\d{2}$/.test(String(body.businessDate || ''))
        ? String(body.businessDate)
        : businessToday()
    const blocked = await rejectIfBackdated(ctx.tenantId, businessDate)
    if (blocked) return blocked

    try {
      // Optional: refuse forwarding more than current holding (head cashier weekly drop).
      if (body.enforceHolding !== false) {
        const custody = await getCashCustody(ctx.tenantId, fromUserId, outlet)
        const amount = Number(body.amount)
        if (Number.isFinite(amount) && amount > custody.holding + 0.001) {
          return NextResponse.json(
            {
              error: `Amount exceeds your holding (${custody.holding.toFixed(2)}). Receive drops first, or lower the amount.`,
              custody,
            },
            { status: 400 },
          )
        }
      }

      const transfer = await createCashTransfer(ctx.tenantId, {
        outlet,
        businessDate,
        fromUserId,
        fromName,
        toType,
        toUserId: body.toUserId,
        toName: body.toName,
        amount: Number(body.amount),
        shiftId: body.shiftId || null,
        kind: 'custody_forward',
        notes: body.notes || null,
      })

      await createAuditLog(
        ctx.tenantId,
        fromUserId,
        'CASH_TRANSFER_POSTED',
        'CashTransfer',
        transfer.id,
        undefined,
        {
          amount: transfer.amount,
          toType: transfer.toType,
          toName: transfer.toName,
          outlet,
        },
        request,
      )

      const custody = await getCashCustody(ctx.tenantId, fromUserId, outlet)
      return NextResponse.json({ transfer, custody }, { status: 201 })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Invalid transfer' }, { status: 400 })
    }
  } catch (error) {
    console.error('[frontoffice/cash-transfers][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.ok) return auth.response
    const subdomain = getTenantFromRequest(request)
    if (!subdomain) return NextResponse.json({ error: 'Missing tenant header' }, { status: 400 })
    const ctx = await getTenantContext(subdomain)
    if (!ctx) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const body = await request.json()
    if (body.action !== 'void' || !body.id) {
      return NextResponse.json({ error: 'action=void and id required' }, { status: 400 })
    }
    const transfer = await voidCashTransfer(ctx.tenantId, String(body.id))
    if (!transfer) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    const sessionUserId = (auth.session as any).user?.id
    await createAuditLog(
      ctx.tenantId,
      sessionUserId ?? null,
      'CASH_TRANSFER_VOIDED',
      'CashTransfer',
      transfer.id,
      undefined,
      undefined,
      request,
    )
    return NextResponse.json({ transfer })
  } catch (error) {
    console.error('[frontoffice/cash-transfers][PATCH] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
