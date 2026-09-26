import type { ModuleSettings } from './store';

/** Settings → Modules. A missing flag stays on so a partial save does not hide the hotel. */
export function moduleEnabled(navKey: string, modules: Partial<ModuleSettings> | undefined): boolean {
  const on = (key: keyof ModuleSettings) => modules?.[key] !== false;
  switch (navKey) {
    case 'frontdesk':
      return on('frontOffice');
    case 'restaurant':
    case 'kitchen':
      return on('foodBeverage');
    case 'housekeeping':
      return on('housekeeping') || on('maintenance');
    case 'inventory':
      return on('inventory');
    case 'security':
      return on('security');
    case 'hr':
      return on('hr');
    case 'accounting':
      return on('accounting');
    case 'compliance':
      return on('compliance');
    default:
      return true;
  }
}

export function reportsEnabled(modules: Partial<ModuleSettings> | undefined): boolean {
  return modules?.analytics !== false;
}
