'use client';

import { Button } from '@heroui/react';
import { openEventsOverview } from '../lib/api/appNavigation';

export default function EventsBackButton({ className = '' }: { className?: string }) {
  return (
    <Button
      variant="flat"
      className={`mb-3 -ml-2 text-ghana-green font-semibold ${className}`}
      onPress={openEventsOverview}
    >
      ← Back to Events
    </Button>
  );
}
