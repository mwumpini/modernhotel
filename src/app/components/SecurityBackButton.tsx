'use client';

import { openSecurityOverview } from '../lib/api/appNavigation';
import ModuleBackButton from './ModuleBackButton';

export default function SecurityBackButton({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return <ModuleBackButton label="Security" onPress={openSecurityOverview} iconOnly={iconOnly} className={className} />;
}
