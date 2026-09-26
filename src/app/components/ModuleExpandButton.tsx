'use client';

import { Button, Tooltip } from '@heroui/react';
import { useRouter } from 'next/navigation';

/**
 * Opens the current module section as a sidebar-free full page.
 * Pair with a `/…/ops` (or reports) route that renders the same ops UI + a Back button.
 */
export default function ModuleExpandButton({
  href,
  label = 'Open full page',
}: {
  href: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <Tooltip content={label}>
      <Button
        size="sm"
        variant="flat"
        className="text-slate-600"
        onPress={() => router.push(href)}
      >
        ↗ Expand
      </Button>
    </Tooltip>
  );
}
