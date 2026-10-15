'use client';

import { openKitchenOperationsOverview } from '../lib/api/appNavigation';
import ModuleBackButton from './ModuleBackButton';

export default function KitchenBackButton({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return <ModuleBackButton label="Kitchen" onPress={openKitchenOperationsOverview} iconOnly={iconOnly} className={className} />;
}
