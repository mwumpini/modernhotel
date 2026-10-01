'use client';

import { Tooltip } from '@heroui/react';
import { Info } from 'lucide-react';

/** Compact “i” tip that replaces long Reports & Analysis page blurbs. */
export default function ReportPageInfoTip({
  text,
  label = 'About this workspace',
}: {
  text: string;
  label?: string;
}) {
  return (
    <Tooltip content={text} classNames={{ content: 'max-w-xs text-xs' }} placement="bottom">
      <button
        type="button"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        aria-label={label}
      >
        <Info size={14} strokeWidth={2.25} aria-hidden />
      </button>
    </Tooltip>
  );
}
