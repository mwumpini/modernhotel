'use client';

import { openInventoryOverview } from '../lib/api/appNavigation';
import ModuleBackButton from './ModuleBackButton';

export default function InventoryBackButton({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return <ModuleBackButton label="Inventory" onPress={openInventoryOverview} iconOnly={iconOnly} className={className} />;
}
