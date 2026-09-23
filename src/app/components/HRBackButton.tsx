'use client';

import { Button } from '@heroui/react';
import { openHROverview } from '../lib/api/appNavigation';

export default function HRBackButton({ className = '' }: { className?: string }) {
  return (
    <Button
      variant="flat"
      className={`mb-3 -ml-2 text-ghana-green font-semibold ${className}`}
      onPress={openHROverview}
    >
      ← Back to HR
    </Button>
  );
}
