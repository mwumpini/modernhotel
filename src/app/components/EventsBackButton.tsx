'use client';

import { openEventsOverview } from '../lib/api/appNavigation';
import ModuleBackButton from './ModuleBackButton';

export default function EventsBackButton({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return <ModuleBackButton label="Events" onPress={openEventsOverview} iconOnly={iconOnly} className={className} />;
}
