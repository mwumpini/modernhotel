'use client';

import { useSession } from 'next-auth/react';

/** The real logged-in user's display name — for attributing an action (a
 * payment, a cashier shift, ...) to the person who actually did it, instead
 * of a generic placeholder like "Front Desk". */
export function useCurrentUserName(): string {
  const { data: session } = useSession();
  return (session?.user as any)?.name || (session?.user as any)?.email || 'Front Desk';
}
