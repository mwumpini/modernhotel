'use client';

import { Button } from '@heroui/react';
import { openHousekeepingOverview } from '../lib/api/appNavigation';

export default function HousekeepingBackButton({ className = '' }: { className?: string }) {
  return (
    <Button
      variant="flat"
      className={`mb-3 -ml-2 text-ghana-green font-semibold ${className}`}
      onPress={openHousekeepingOverview}
    >
      ← Back to Housekeeping
    </Button>
  );
}
