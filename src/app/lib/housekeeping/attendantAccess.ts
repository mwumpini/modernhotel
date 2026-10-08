import { prisma } from '@/app/lib/database/client';
import { ensureDefaultRolesForTenant, permissionGrants } from '@/app/lib/settings/roleRepository';
import { samePerson } from './attendantView';

const DESK_PERMISSIONS = [
  'housekeeping.assign-task',
  'housekeeping.manage-supplies',
  'housekeeping.manage-staff',
];

/** Supervisor, manager, or admin. A housekeeper login is not a desk. */
export async function roleIsHousekeepingDesk(tenantId: string, roleCode: string | undefined): Promise<boolean> {
  if (!tenantId || !roleCode) return false;
  await ensureDefaultRolesForTenant(tenantId);
  const role = await prisma.role.findUnique({ where: { tenantId_code: { tenantId, code: roleCode } } });
  if (!role || !role.isActive) return false;
  const permissions = Array.isArray(role.permissions)
    ? (role.permissions as unknown[]).filter((p): p is string => typeof p === 'string')
    : [];
  return permissions.some((granted) => DESK_PERMISSIONS.some((id) => permissionGrants(granted, id)));
}

export async function cleanerOwnsTask(
  tenantId: string,
  userName: string | undefined,
  task: { assignedTo: string | null; assignedName: string | null },
): Promise<boolean> {
  const staff = await prisma.housekeepingStaff.findMany({
    where: { tenantId, isActive: true, role: 'housekeeper' },
    select: { id: true, name: true },
  });
  const mine = staff.find((member) => samePerson(member.name, userName));
  if (!mine) return false;
  return task.assignedTo === mine.id || samePerson(task.assignedName, mine.name);
}
