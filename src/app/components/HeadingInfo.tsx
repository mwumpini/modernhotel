'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@heroui/react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

export default function HeadingInfo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Popover placement="bottom">
      <PopoverTrigger>
        <button type="button" className="inline-flex shrink-0 text-gray-400 hover:text-gray-600" aria-label={label}>
          <InformationCircleIcon className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="max-w-xs px-1 py-1 text-xs text-gray-600">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
