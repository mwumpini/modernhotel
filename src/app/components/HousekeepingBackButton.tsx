'use client';

import { Button } from '@heroui/react';
import { openHousekeepingOverview } from '../lib/api/appNavigation';

export default function HousekeepingBackButton({ className = '' }: { className?: string }) {
  return (
    <Button
      size="sm"
      variant="flat"
      className={`mb-0 -ml-1 h-8 min-h-8 text-sm text-ghana-green font-semibold ${className}`}
      onPress={openHousekeepingOverview}
    >
      ← Back to Housekeeping
    </Button>
  );
}
