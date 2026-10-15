'use client';

import { ArrowLeft } from 'lucide-react';

/**
 * The way back to a module's overview. Beside a title (`iconOnly`) it is a round arrow
 * button; on its own it is a slim pill that names where it goes.
 */
export default function ModuleBackButton({
  label,
  onPress,
  iconOnly = false,
  className = '',
}: {
  label: string;
  onPress: () => void;
  iconOnly?: boolean;
  className?: string;
}) {
  const text = `Back to ${label}`;
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onPress}
        aria-label={text}
        title={text}
        className={`group inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-600 ${className}`}
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onPress}
      className={`group inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white py-0 pl-1 pr-3 text-[13px] font-medium text-gray-700 shadow-sm transition-all hover:border-teal-300 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-teal-600 ${className}`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 transition-all group-hover:-translate-x-0.5 group-hover:bg-teal-50">
        <ArrowLeft className="h-3.5 w-3.5" />
      </span>
      {text}
    </button>
  );
}
