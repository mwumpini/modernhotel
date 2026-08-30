'use client';

import { Button } from '@heroui/react';
import { openFrontOfficeOverview } from '../lib/api/appNavigation';

export default function FrontOfficeBackButton({ className = '' }: { className?: string }) {
  return (
    <Button
      variant="flat"
      className={`mb-3 -ml-2 text-ghana-green font-semibold ${className}`}
      onPress={openFrontOfficeOverview}
    >
      ← Back to Front Office
    </Button>
  );
}
