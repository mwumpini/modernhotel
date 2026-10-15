'use client';

import { openFrontOfficeOverview } from '../lib/api/appNavigation';
import ModuleBackButton from './ModuleBackButton';

export default function FrontOfficeBackButton({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return <ModuleBackButton label="Front Office" onPress={openFrontOfficeOverview} iconOnly={iconOnly} className={className} />;
}
