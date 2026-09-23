'use client';

import { Button } from '@heroui/react';
import { openInventoryOverview } from '../lib/api/appNavigation';

export default function InventoryBackButton({ className = '' }: { className?: string }) {
  return (
    <Button
      variant="flat"
      className={`mb-3 -ml-2 text-ghana-green font-semibold ${className}`}
      onPress={openInventoryOverview}
    >
      ← Back to Inventory
    </Button>
  );
}
