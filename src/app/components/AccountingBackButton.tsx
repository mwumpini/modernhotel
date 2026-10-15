'use client';

import { openAccountingOverview } from '../lib/api/appNavigation';
import ModuleBackButton from './ModuleBackButton';

export default function AccountingBackButton({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return <ModuleBackButton label="Accounting" onPress={openAccountingOverview} iconOnly={iconOnly} className={className} />;
}
