'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@heroui/react';

export function SummaryToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="flat"
      onPress={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Show summary' : 'Hide summary'}
      className="h-10 md:h-8"
      startContent={collapsed ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronUp className="h-3.5 w-3.5" aria-hidden />}
    >
      {collapsed ? 'Show' : 'Hide'}<span className="hidden sm:inline">&nbsp;summary</span>
    </Button>
  );
}
