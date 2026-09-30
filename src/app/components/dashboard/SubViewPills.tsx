'use client';

import React from 'react';

/** Secondary pills under a primary desk tab (Supplies, Floor, Work, …). */
export default function SubViewPills<T extends string>({
  views,
  selected,
  onSelect,
  ariaLabel,
}: {
  views: { key: T; label: string }[];
  selected: T;
  onSelect: (key: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="mb-4 flex w-full flex-nowrap gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 scrollbar-thin"
    >
      {views.map((view) => (
        <button
          key={view.key}
          type="button"
          role="tab"
          aria-selected={selected === view.key}
          onClick={() => onSelect(view.key)}
          className={`min-h-11 flex-shrink-0 whitespace-nowrap rounded-md px-3 text-sm transition-colors ${
            selected === view.key
              ? 'bg-white font-semibold text-ghana-black shadow-sm'
              : 'text-gray-600 hover:bg-white/60 hover:text-ghana-black'
          }`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
