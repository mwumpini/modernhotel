'use client';

import React from 'react';

/**
 * Two-column label/value layout for a read-only "View X" modal body — the
 * shared replacement for stacking <p><strong>Label:</strong> value</p> lines,
 * which had no visual hierarchy or breathing room. Used across every Security
 * (and, going forward, other module) detail modal for a consistent look.
 */
export function DetailGrid({
  children,
  className = '',
}: {
  children: React.ReactNode;
  /** Optional override — e.g. denser gap for tall forms. */
  className?: string;
}) {
  return <div className={`grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 ${className}`.trim()}>{children}</div>;
}

export function DetailField({
  label,
  value,
  full = false,
  dense = false,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
  /** Slightly tighter label/value stack (~20% less vertical space). */
  dense?: boolean;
}) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className={`${full ? 'sm:col-span-2' : ''} flex flex-col ${dense ? 'gap-0.5' : 'gap-1'}`.trim()}>
      <span className={`font-semibold uppercase tracking-wide text-gray-500 ${dense ? 'text-[11px] leading-tight' : 'text-xs'}`}>{label}</span>
      <div className={`text-ghana-black break-words ${dense ? 'text-sm leading-snug' : 'text-sm'}`}>{value}</div>
    </div>
  );
}
