'use client';

import { Button } from '@heroui/react';
import { openAccountingOverview } from '../lib/api/appNavigation';

export default function AccountingBackButton({ className = '' }: { className?: string }) {
  return (
    <Button
      variant="flat"
      className={`mb-3 -ml-2 text-ghana-green font-semibold ${className}`}
      onPress={openAccountingOverview}
    >
      ← Back to Accounting
    </Button>
  );
}
