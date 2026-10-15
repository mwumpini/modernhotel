'use client';

import { openHousekeepingOverview } from '../lib/api/appNavigation';
import ModuleBackButton from './ModuleBackButton';

export default function HousekeepingBackButton({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return <ModuleBackButton label="Housekeeping" onPress={openHousekeepingOverview} iconOnly={iconOnly} className={className} />;
}
