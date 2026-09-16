'use client';

import React from 'react';
import { Button, Popover, PopoverTrigger, PopoverContent, Checkbox, Divider } from '@heroui/react';
import type { DashboardSectionDef } from '../../lib/dashboard/useDashboardVisibility';

/** Small ✕ control placed in a card's header — the inline escape hatch for
 * decluttering a busy dashboard while working. Restoring a hidden card
 * happens via CustomizeViewControl below. Shared by every dashboard that
 * uses useDashboardVisibility (Executive, Accounting, Restaurant & Bar). */
export function HideCardButton({ onHide, label }: { onHide: () => void; label: string }) {
  return (
    <button
      onClick={onHide}
      title={`Hide ${label}`}
      aria-label={`Hide ${label}`}
      className="text-gray-400 hover:text-gray-700 transition-colors leading-none px-1"
    >
      ✕
    </button>
  );
}

/**
 * Restore panel for a dashboard's hide/show state — the escape hatch for the
 * inline "✕ Hide" button on each card. Without this, hiding a card would be
 * a one-way trip nobody remembers how to undo.
 */
export default function CustomizeViewControl({
  sections,
  isHidden,
  toggle,
  showAll,
  hiddenCount,
}: {
  sections: DashboardSectionDef[];
  isHidden: (id: string) => boolean;
  toggle: (id: string) => void;
  showAll: () => void;
  hiddenCount: number;
}) {
  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <Button size="sm" variant="flat" startContent={<span aria-hidden>⚙️</span>}>
          Customize View{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="p-3 w-[280px] max-w-[280px]">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-sm font-semibold text-ghana-black">Show on this dashboard</span>
            {hiddenCount > 0 && (
              <Button size="sm" variant="light" onPress={showAll} className="shrink-0">Show all</Button>
            )}
          </div>
          <Divider className="mb-2" />
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {sections.map((s) => (
              <Checkbox
                key={s.id}
                size="sm"
                isSelected={!isHidden(s.id)}
                onValueChange={() => toggle(s.id)}
                classNames={{ base: 'max-w-full m-0', label: 'text-sm' }}
              >
                {s.label}
              </Checkbox>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
