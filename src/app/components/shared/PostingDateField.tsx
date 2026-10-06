'use client';

import React, { useState } from 'react';
import { Input } from '@heroui/react';
import { useSettingsStore } from '@/app/lib/settings/store';
import { postingDateError, postingDateMin } from '@/app/lib/frontoffice/backdate';

type InputProps = React.ComponentProps<typeof Input>;

/** Date field for a posting. When backdating is off, a date before today is refused. */
export default function PostingDateField(props: InputProps) {
  const allowBackdating = useSettingsStore((s) => s.roomManagement.allowBackdating === true);
  const [blocked, setBlocked] = useState('');

  const reject = (value: string) => {
    const error = postingDateError(value, allowBackdating);
    setBlocked(error || '');
    return Boolean(error);
  };

  return (
    <Input
      {...props}
      type="date"
      min={allowBackdating ? props.min : postingDateMin(false)}
      isInvalid={Boolean(props.isInvalid) || Boolean(blocked)}
      errorMessage={blocked || props.errorMessage}
      onValueChange={(value) => {
        if (reject(String(value ?? ''))) return;
        props.onValueChange?.(value);
      }}
      onChange={(event) => {
        if (reject(event.target.value)) return;
        props.onChange?.(event);
      }}
    />
  );
}
