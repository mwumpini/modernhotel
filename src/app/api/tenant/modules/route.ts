import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth/auth';
import { prisma } from '@/app/lib/database/client';
import { readPaidModules } from '@/app/lib/platform/hotelModules';

/** The areas this hotel has paid for. Comes from the sign-in, not from a header the browser can change. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const tenantId = session?.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { metadata: true },
  });
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ modules: readPaidModules(tenant.metadata) });
}
