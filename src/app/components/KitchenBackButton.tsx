'use client';

import { Button } from '@heroui/react';
import { openKitchenOperationsOverview } from '../lib/api/appNavigation';

export default function KitchenBackButton({ className = '' }: { className?: string }) {
  return (
    <Button
      variant="flat"
      className={`mb-3 -ml-2 text-ghana-green font-semibold ${className}`}
      onPress={openKitchenOperationsOverview}
    >
      ← Back to Kitchen
    </Button>
  );
}
