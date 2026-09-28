'use client';

import React from 'react';

/**
 * Two-column label/value layout for a read-only "View X" modal body — the
 * shared replacement for stacking <p><strong>Label:</strong> value</p> lines,
 * which had no visual hierarchy or breathing room. Used across every Security
 * (and, going forward, other module) detail modal for a consistent look.
 */
export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">{children}</div>;
}

export function DetailField({
  label,
  value,
  full = false,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className={full ? 'sm:col-span-2 flex flex-col gap-1' : 'flex flex-col gap-1'}>
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <div className="text-sm text-ghana-black break-words">{value}</div>
    </div>
  );
}
