import type { Department, Employee, LeaveRequest } from './models';

export type LeaveBandId = 'staff' | 'management';

export type LeaveEntitlements = Record<LeaveRequest['leaveType'], number>;

export interface LeaveBand {
  id: LeaveBandId;
  name: string;
  entitlements: LeaveEntitlements;
}

export interface LeavePolicy {
  bands: LeaveBand[];
  /** Leave types this hotel does not offer. Hidden from balances and new requests. */
  closedTypes: Array<LeaveRequest['leaveType']>;
}

/** Starting days when a hotel has not set its own numbers. Annual matches the common 21-day policy (Ghana Labour Act 2003 minimum is 15 working days). */
export const DEFAULT_LEAVE_ENTITLEMENTS: LeaveEntitlements = {
  annual: 21,
  sick: 10,
  personal: 5,
  maternity: 84,
  paternity: 7,
  bereavement: 5,
  unpaid: 0,
  other: 0,
};

const MANAGEMENT_ENTITLEMENTS: LeaveEntitlements = {
  annual: 28,
  sick: 14,
  personal: 7,
  maternity: 84,
  paternity: 10,
  bereavement: 5,
  unpaid: 0,
  other: 0,
};

export const LEAVE_BANDS: LeaveBandId[] = ['staff', 'management'];

const LEAVE_TYPES = Object.keys(DEFAULT_LEAVE_ENTITLEMENTS) as Array<LeaveRequest['leaveType']>;

export const LEAVE_TYPE_OPTIONS: Array<{ key: LeaveRequest['leaveType']; label: string }> = [
  { key: 'annual', label: 'Annual' },
  { key: 'sick', label: 'Sick' },
  { key: 'personal', label: 'Personal' },
  { key: 'maternity', label: 'Maternity' },
  { key: 'paternity', label: 'Paternity' },
  { key: 'bereavement', label: 'Bereavement' },
  { key: 'unpaid', label: 'Unpaid' },
];

export const DEFAULT_LEAVE_POLICY: LeavePolicy = {
  bands: [
    { id: 'staff', name: 'Staff', entitlements: { ...DEFAULT_LEAVE_ENTITLEMENTS } },
    { id: 'management', name: 'Management', entitlements: { ...MANAGEMENT_ENTITLEMENTS } },
  ],
  closedTypes: [],
};

export function isLeaveTypeOpen(policy: LeavePolicy, leaveType: LeaveRequest['leaveType']): boolean {
  return !(policy.closedTypes || []).includes(leaveType);
}

export function openLeaveTypes(policy: LeavePolicy): Array<{ key: LeaveRequest['leaveType']; label: string }> {
  return LEAVE_TYPE_OPTIONS.filter((type) => isLeaveTypeOpen(policy, type.key));
}

function clampDays(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 366) return fallback;
  return Math.round(n);
}

/** Keep both groups and every leave type, filling gaps from the starting policy. */
export function normalizeLeavePolicy(raw: unknown): LeavePolicy {
  const source = (raw && typeof raw === 'object') ? raw as { bands?: unknown; closedTypes?: unknown } : {};
  const bands = Array.isArray(source.bands) ? source.bands : [];
  const closedRaw = Array.isArray(source.closedTypes) ? source.closedTypes : [];
  const allowed = new Set(LEAVE_TYPE_OPTIONS.map((type) => type.key));
  const closedTypes = LEAVE_TYPE_OPTIONS
    .map((type) => type.key)
    .filter((key) => closedRaw.includes(key) && allowed.has(key));
  const openCount = LEAVE_TYPE_OPTIONS.length - closedTypes.length;
  return {
    closedTypes: openCount > 0 ? closedTypes : [],
    bands: LEAVE_BANDS.map((id) => {
      const base = DEFAULT_LEAVE_POLICY.bands.find((b) => b.id === id)!;
      const found = bands.find((b) => b && typeof b === 'object' && (b as { id?: string }).id === id) as { entitlements?: Record<string, unknown> } | undefined;
      const entitlements = { ...base.entitlements };
      for (const type of LEAVE_TYPES) {
        if (found?.entitlements && type in found.entitlements) {
          entitlements[type] = clampDays(found.entitlements[type], base.entitlements[type]);
        }
      }
      return { id, name: base.name, entitlements };
    }),
  };
}

/** Saved choice wins. Otherwise a department named Management uses the management days. */
export function resolveLeaveBandId(
  employee: Pick<Employee, 'leaveBand' | 'departmentId'>,
  departments: Array<Pick<Department, 'id' | 'name'>>,
): LeaveBandId {
  if (employee.leaveBand === 'management' || employee.leaveBand === 'staff') return employee.leaveBand;
  const department = departments.find((d) => d.id === employee.departmentId);
  const name = department?.name?.trim().toLowerCase() || '';
  if (name === 'management' || name.startsWith('management ')) return 'management';
  return 'staff';
}

export function bandName(policy: LeavePolicy, bandId: LeaveBandId): string {
  return policy.bands.find((b) => b.id === bandId)?.name || (bandId === 'management' ? 'Management' : 'Staff');
}

/** A person's own leaveEntitlements entry wins over the group. */
export function entitlementDays(
  policy: LeavePolicy,
  bandId: LeaveBandId,
  leaveType: LeaveRequest['leaveType'],
  personalOverride?: number,
): number {
  if (personalOverride != null && Number.isFinite(personalOverride)) return personalOverride;
  const band = policy.bands.find((b) => b.id === bandId);
  const days = band?.entitlements?.[leaveType];
  if (days != null && Number.isFinite(days)) return days;
  return DEFAULT_LEAVE_ENTITLEMENTS[leaveType] ?? 0;
}
