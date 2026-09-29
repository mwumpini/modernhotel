'use client';

import { Button } from '@heroui/react';
import { openAccountingOverview } from '../lib/api/appNavigation';

export default function AccountingBackButton({ className = '' }: { className?: string }) {
  return (
    <Button
      size="sm"
      variant="flat"
      className={`mb-0 -ml-1 h-8 min-h-8 text-sm text-ghana-green font-semibold ${className}`}
      onPress={openAccountingOverview}
    >
      ← Back to Accounting
    </Button>
  );
}
