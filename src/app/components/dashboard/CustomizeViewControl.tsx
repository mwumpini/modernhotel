'use client';

import React from 'react';
import { Button, Popover, PopoverTrigger, PopoverContent, Checkbox, Divider } from '@heroui/react';
import { SlidersHorizontal } from 'lucide-react';
import type { DashboardSectionDef } from '../../lib/dashboard/useDashboardVisibility';
import {
  DASHBOARD_PERIOD_OPTIONS,
  periodShortLabel,
  type DashboardPeriod,
} from '../../lib/dashboard/useDashboardPeriod';

/** Small ✕ control placed in a card's header — the inline escape hatch for
 * decluttering a busy dashboard while working. Restoring a hidden card
 * happens via CustomizeViewControl below. Shared by every dashboard that
 * uses useDashboardVisibility (Executive, Accounting, Restaurant & Bar). */
export function HideCardButton({
  onHide,
  label,
  size = 'sm',
}: {
  onHide: () => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      onClick={onHide}
      title={`Hide ${label}`}
      aria-label={`Hide ${label}`}
      className={
        // The glyph stays small; the hit area does not (9px was untappable).
        size === 'sm'
          ? 'inline-flex min-h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-md text-xs leading-none text-gray-400 transition-colors hover:bg-default-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          : 'inline-flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-md text-sm leading-none text-gray-400 transition-colors hover:bg-default-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      }
    >
      ✕
    </button>
  );
}

/**
 * Restore panel for a dashboard's hide/show state — the escape hatch for the
 * inline "✕ Hide" button on each card. Without this, hiding a card would be
 * a one-way trip nobody remembers how to undo.
 *
 * Optional period controls live here too (not on KPI tiles) so each module can
 * scope activity numbers without cluttering the cards.
 */
export default function CustomizeViewControl({
  sections,
  isHidden,
  toggle,
  showAll,
  hiddenCount,
  className,
  period,
  onPeriodChange,
  defaultPeriod,
}: {
  sections: DashboardSectionDef[];
  isHidden: (id: string) => boolean;
  toggle: (id: string) => void;
  showAll: () => void;
  hiddenCount: number;
  className?: string;
  period?: DashboardPeriod;
  onPeriodChange?: (period: DashboardPeriod) => void;
  /** Used only for the button label hint when period differs from default. */
  defaultPeriod?: DashboardPeriod;
}) {
  const showPeriod = Boolean(period && onPeriodChange);
  const periodHint =
    showPeriod && period && defaultPeriod && period !== defaultPeriod
      ? ` · ${periodShortLabel(period)}`
      : showPeriod && period && !defaultPeriod && period !== 'today'
        ? ` · ${periodShortLabel(period)}`
        : '';

  const buttonLabel = `Customize${periodHint}${hiddenCount > 0 ? ` (${hiddenCount})` : ''}`;

  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <Button size="sm" variant="flat" className={className} startContent={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />}>
          {buttonLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="p-3 w-[280px] max-w-[280px]">
          {showPeriod && period && onPeriodChange && (
            <>
              <div className="mb-2">
                <span className="text-sm font-semibold text-ghana-black">KPI period</span>
                <p className="mt-0.5 text-xs text-gray-500">
                  Activity numbers follow this window. Balances stay current.
                </p>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="KPI period">
                {DASHBOARD_PERIOD_OPTIONS.map((opt) => {
                  const active = period === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onPeriodChange(opt.id)}
                      className={
                        active
                          ? 'rounded-lg bg-ghana-green px-2 py-1.5 text-xs font-semibold text-white'
                          : 'rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50'
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <Divider className="mb-2" />
            </>
          )}
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-sm font-semibold text-ghana-black">Show on this dashboard</span>
            {hiddenCount > 0 && (
              <Button size="sm" variant="light" onPress={showAll} className="shrink-0">Show all</Button>
            )}
          </div>
          <Divider className="mb-2" />
          <div className="flex max-h-[min(20rem,55vh)] flex-col gap-1.5 overflow-y-auto">
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
