'use client';

import { openHROverview } from '../lib/api/appNavigation';
import ModuleBackButton from './ModuleBackButton';

export default function HRBackButton({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return <ModuleBackButton label="HR" onPress={openHROverview} iconOnly={iconOnly} className={className} />;
}
