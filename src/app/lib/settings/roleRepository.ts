import { prisma } from '@/app/lib/database/client';

/**
 * The single source of truth for what each default role grants — copied
 * verbatim from `defaultRoles` in settings/store.ts (the client-side seed)
 * so the server and the Settings UI never drift apart. Any role a tenant
 * creates/edits beyond these four lives only in the `roles` table from then on.
 */
export const DEFAULT_ROLES: { code: string; name: string; description: string; permissions: string[] }[] = [
  {
    code: 'admin',
    name: 'System Administrator',
    description: 'Full system access and control',
    permissions: ['*'],
  },
  {
    code: 'manager',
    name: 'Hotel Manager',
    description: 'Hotel operations management',
    permissions: [
      'dashboard.view',
      'frontdesk.*',
      'events-conferences.*',
      'housekeeping.*',
      'f&b.*',
      'inventory.*',
      'security.*',
      'hr.*',
      'accounting.*',
      'compliance.*',
      'reports.view',
      'settings.view',
    ],
  },
  {
    code: 'staff',
    name: 'Staff Member',
    description: 'Basic operational access',
    permissions: ['dashboard.view', 'frontdesk.checkin', 'frontdesk.checkout', 'housekeeping.view', 'f&b.pos'],
  },
  {
    code: 'night_manager',
    name: 'Night Manager',
    description: 'Night audit and end-of-day front office operations',
    permissions: ['dashboard.view', 'frontdesk.*', 'housekeeping.view', 'f&b.*', 'reports.view', 'settings.view'],
  },
];

/**
 * Idempotent, race-safe: upserts each default role individually rather than
 * count-then-create, so two concurrent first-requests for a brand-new tenant
 * (e.g. the permission check below and the roles list GET) can't both decide
 * "no roles yet" and double-insert.
 */
export async function ensureDefaultRolesForTenant(tenantId: string): Promise<void> {
  await Promise.all(
    DEFAULT_ROLES.map((role) =>
      prisma.role.upsert({
        where: { tenantId_code: { tenantId, code: role.code } },
        update: {},
        create: {
          tenantId,
          code: role.code,
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isActive: true,
        },
      }),
    ),
  );
}

/** A granted permission string covers a requested one via exact match, '*', or a 'module.*' prefix. */
export function permissionGrants(granted: string, permissionId: string): boolean {
  if (granted === '*' || granted === permissionId) return true;
  if (granted.endsWith('.*')) return permissionId.startsWith(granted.slice(0, -1));
  return false;
}
