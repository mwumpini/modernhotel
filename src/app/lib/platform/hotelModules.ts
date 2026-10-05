/** Paid areas the operator sells. The hotel cannot turn these on. */

export const PAID_MODULES = [
  { key: 'frontOffice', label: 'Front desk' },
  { key: 'foodBeverage', label: 'Restaurant & bar' },
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'hr', label: 'Payroll' },
  { key: 'compliance', label: 'Compliance' },
] as const;

export type PaidModuleKey = (typeof PAID_MODULES)[number]['key'];
export type PaidModules = Record<PaidModuleKey, boolean>;

const PAID_KEYS: PaidModuleKey[] = PAID_MODULES.map((item) => item.key);

export function allPaidModulesOn(): PaidModules {
  return {
    frontOffice: true,
    foodBeverage: true,
    housekeeping: true,
    inventory: true,
    accounting: true,
    hr: true,
    compliance: true,
  };
}

/** A new hotel starts with the front desk only. The operator turns the rest on. */
export function frontDeskOnly(): PaidModules {
  return {
    frontOffice: true,
    foodBeverage: false,
    housekeeping: false,
    inventory: false,
    accounting: false,
    hr: false,
    compliance: false,
  };
}

export function isPaidModuleKey(key: string): key is PaidModuleKey {
  return (PAID_KEYS as string[]).includes(key);
}

/** A saved choice. Missing keys stay off, so a partial save cannot turn everything on. */
export function normalizePaidModules(raw: unknown): PaidModules {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as PaidModules;
  for (const key of PAID_KEYS) out[key] = src[key] === true;
  return out;
}

/**
 * What this hotel is allowed to use.
 * No `modules` object means the hotel was opened before this choice existed, so every area stays on.
 */
export function readPaidModules(metadata: unknown): PaidModules {
  const bag = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
  if (!bag.modules || typeof bag.modules !== 'object' || Array.isArray(bag.modules)) return allPaidModulesOn();
  return normalizePaidModules(bag.modules);
}

type ModuleFlags = {
  maintenance: boolean;
  kitchenTerminal: boolean;
} & PaidModules;

/** Copy the operator's choice onto the switches the menus actually read. */
export function applyPaidModules<T extends ModuleFlags>(current: T, paid: PaidModules): T {
  return {
    ...current,
    ...paid,
    maintenance: paid.housekeeping,
    kitchenTerminal: paid.foodBeverage ? current.kitchenTerminal !== false : false,
  };
}
