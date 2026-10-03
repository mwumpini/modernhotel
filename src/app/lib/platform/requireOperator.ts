import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth/auth';
import { OPERATOR_ROLE, PLATFORM_SUBDOMAIN } from './operator';

export async function requireOperator() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user || user.role !== OPERATOR_ROLE || user.tenant?.subdomain !== PLATFORM_SUBDOMAIN) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}
