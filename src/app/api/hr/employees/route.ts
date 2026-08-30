import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromRequest, getTenantContext, createAuditLog } from '@/app/lib/api/tenant'
import { listHrEmployees, upsertHrEmployee, deleteHrEmployee } from '@/app/lib/hr/repository'

async function resolveTenant(req: NextRequest) {
  const subdomain = getTenantFromRequest(req)
  if (!subdomain) return null
  return getTenantContext(subdomain)
}

// GET /api/hr/employees — all employees for the tenant
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })
    const employees = await listHrEmployees(ctx.tenantId)
    return NextResponse.json({ employees })
  } catch (error) {
    console.error('[hr/employees][GET] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/hr/employees — create or update one employee record (body.id required —
// the client generates it optimistically before this call resolves)
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const employee = await upsertHrEmployee(ctx.tenantId, body.id, body)

    await createAuditLog(
      ctx.tenantId, null,
      'HR_EMPLOYEE_SAVED', 'HrEmployee', body.id,
      undefined,
      { employeeNumber: employee.employeeNumber, status: employee.status },
      request
    )

    return NextResponse.json({ employee })
  } catch (error) {
    console.error('[hr/employees][POST] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/hr/employees?id=... — remove an employee record
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await resolveTenant(request)
    if (!ctx) return NextResponse.json({ error: 'Missing or unknown tenant' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 })

    const ok = await deleteHrEmployee(ctx.tenantId, id)
    if (!ok) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    await createAuditLog(ctx.tenantId, null, 'HR_EMPLOYEE_DELETED', 'HrEmployee', id, undefined, undefined, request)

    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[hr/employees][DELETE] error', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
