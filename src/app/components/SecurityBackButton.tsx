'use client';

import { Button } from '@heroui/react';
import { openSecurityOverview } from '../lib/api/appNavigation';

export default function SecurityBackButton({ className = '' }: { className?: string }) {
  return (
    <Button
      variant="flat"
      className={`mb-3 -ml-2 text-ghana-green font-semibold ${className}`}
      onPress={openSecurityOverview}
    >
      ← Back to Security
    </Button>
  );
}
