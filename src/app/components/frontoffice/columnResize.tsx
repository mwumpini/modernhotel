'use client';

import React, { useEffect, useRef, useState } from 'react';

const MIN_COLUMN_WIDTH = 56;

// The look every data table in the app should share (originally the Front
// Desk stay worksheet's classNames, generalized here so other modules —
// Security's tables included — don't each re-invent the same header/row
// styling). See StayWorksheetTable.tsx for the pilot implementation.
export const unifiedTableClassNames = {
  base: 'overflow-x-auto',
  table: 'w-full table-fixed',
  th: 'border-b border-gray-200 bg-gray-50 px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap',
  td: 'border-b border-gray-100 px-3 py-3.5 align-middle whitespace-nowrap',
};

/** Clickable column-header label with a sort direction indicator. */
export function SortLabel({
  active,
  dir,
  onPress,
  align = 'left',
  children,
}: {
  active: boolean;
  dir: 'asc' | 'desc';
  onPress: () => void;
  align?: 'left' | 'right' | 'center';
  children: string;
}) {
  const alignClass = align === 'right' ? 'ml-auto block text-right' : align === 'center' ? 'mx-auto block text-center' : 'text-left';
  return (
    <button
      type="button"
      className={`max-w-full truncate font-semibold text-ghana-black ${alignClass}`}
      onClick={onPress}
    >
      {children}{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

/** The row classes a clickable, sortable table row should use — selected/hover states match Desk's. */
export function rowClassNames(isSelected: boolean) {
  return `cursor-pointer ${isSelected ? 'bg-green-50 dark:bg-white/10' : 'hover:bg-gray-50'}`;
}

export function ColumnSizer({
  label,
  onResizeStart,
  onReset,
}: {
  label: string;
  onResizeStart: (clientX: number) => void;
  onReset: () => void;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      title="Drag to resize. Double-click to reset this column."
      className="absolute -right-2 top-0 z-10 h-full w-2 cursor-col-resize touch-none hover:bg-ghana-gold/80"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onResizeStart(event.clientX);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onReset();
      }}
    />
  );
}

export function useResizableColumns<T extends string>(defaults: Record<T, number>) {
  const [widths, setWidths] = useState(defaults);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  const dragRef = useRef<{ key: T; startX: number; startWidth: number } | null>(null);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  // A plain useRef's assignment doesn't re-run effects, and these table
  // frames live inside conditionally-rendered tabs — the div this attaches
  // to may not exist yet when the component first mounts. A state-backed
  // callback ref fires (and re-runs the effect below) every time the node
  // actually appears, including when a tab switch first mounts it.
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.max(MIN_COLUMN_WIDTH, Math.round(drag.startWidth + event.clientX - drag.startX));
      setWidths((current) => (current[drag.key] === next ? current : { ...current, [drag.key]: next }));
    };
    const stop = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // Column widths are fixed pixel values (required for drag-to-resize to mean
  // anything), which otherwise leaves every table sitting at whatever total
  // width its defaults were tuned for — cramped and swimming in empty space
  // on a wide monitor once the app is used full-screen instead of at tablet
  // width. Grow (never shrink below the authored/tablet defaults, and never
  // fight a manual drag) every column proportionally whenever the container
  // is wider than the table's current total, so it fills the space it's
  // actually given.
  useEffect(() => {
    if (!frameEl || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const containerWidth = entries[0]?.contentRect.width;
      if (!containerWidth) return;
      setWidths((current) => {
        const keys = Object.keys(defaultsRef.current) as T[];
        const currentTotal = keys.reduce((sum, k) => sum + current[k], 0);
        if (currentTotal <= 0 || containerWidth <= currentTotal + 1) return current;
        const scale = containerWidth / currentTotal;
        const next = { ...current };
        keys.forEach((k) => { next[k] = Math.round(current[k] * scale); });
        return next;
      });
    });
    observer.observe(frameEl);
    return () => observer.disconnect();
  }, [frameEl]);

  const tableWidth = (Object.keys(defaults) as T[]).reduce((sum, key) => sum + (widths[key] ?? defaults[key]), 0);

  return {
    frameRef: setFrameEl,
    frameStyle: {
      ['--col-table-width' as string]: `${tableWidth}px`,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    } as React.CSSProperties,
    style: (key: T) => ({ width: widths[key], minWidth: widths[key], maxWidth: widths[key] }),
    sizer: (key: T, label: string) => (
      <ColumnSizer
        label={label}
        onResizeStart={(clientX) => {
          dragRef.current = { key, startX: clientX, startWidth: widthsRef.current[key] };
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        onReset={() => setWidths((current) => ({ ...current, [key]: defaultsRef.current[key] }))}
      />
    ),
  };
}

export function sizedTableClassNames<T extends { th: string; td: string }>(base: T) {
  return {
    ...base,
    table: 'table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none',
    td: `${base.td} overflow-hidden`,
  };
}
