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
      'restaurant.*',
      'kitchen.*',
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
    permissions: ['dashboard.view', 'frontdesk.checkin', 'frontdesk.checkout', 'housekeeping.view', 'restaurant.pos'],
  },
  {
    code: 'night_manager',
    name: 'Night Manager',
    description: 'Night audit and end-of-day front office operations',
    permissions: ['dashboard.view', 'frontdesk.*', 'housekeeping.view', 'restaurant.*', 'kitchen.*', 'reports.view', 'settings.view'],
  },
];

/**
 * Food & Beverage used to be one 'f&b' module/permission; it's since been
 * split into separate Kitchen and Restaurant modules. Roles seeded (or
 * customized) before that split still carry the old strings, which no
 * longer match anything — this repairs them in place the next time the
 * role is touched, so access isn't silently dropped for existing tenants
 * (including production, where `ensureDefaultRolesForTenant`'s upsert
 * intentionally leaves already-existing rows alone).
 */
async function repairLegacyFbPermissions(tenantId: string): Promise<void> {
  const roles = await prisma.role.findMany({ where: { tenantId } });
  await Promise.all(
    roles
      .filter((role) => {
        const perms = Array.isArray(role.permissions) ? (role.permissions as unknown[]) : [];
        return perms.includes('f&b.*') || perms.includes('f&b.pos');
      })
      .map((role) => {
        const perms = (role.permissions as string[]).flatMap((p) => {
          if (p === 'f&b.*') return ['kitchen.*', 'restaurant.*'];
          if (p === 'f&b.pos') return ['restaurant.pos'];
          return [p];
        });
        return prisma.role.update({ where: { id: role.id }, data: { permissions: perms } });
      }),
  );
}

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
  await repairLegacyFbPermissions(tenantId);
}

/** A granted permission string covers a requested one via exact match, '*', or a 'module.*' prefix. */
export function permissionGrants(granted: string, permissionId: string): boolean {
  if (granted === '*' || granted === permissionId) return true;
  if (granted.endsWith('.*')) return permissionId.startsWith(granted.slice(0, -1));
  return false;
}

/**
 * True if a role's permission list grants any access to a module (e.g. 'kitchen') —
 * '*', 'kitchen.*', or any leaf like 'kitchen.view'. Mirrors the client's
 * hasModuleAccess() in settings/store.ts, for server-side staff-list filtering
 * (e.g. only showing kitchen-permissioned users in the "assign cook" picker).
 */
export function roleGrantsModule(permissions: string[], modulePrefix: string): boolean {
  return permissions.some((p) => p === '*' || p === `${modulePrefix}.*` || p.startsWith(`${modulePrefix}.`));
}
