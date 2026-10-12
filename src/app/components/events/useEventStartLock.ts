'use client';

import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../lib/settings/store';
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { BACKDATE_MESSAGE, arrivalFloor, calendarDay, eventStartBackdateError } from '../../lib/frontoffice/backdate';

/** Earliest start for a new stay, event, or table booking while Allow backdating is off. */
export function useArrivalDateLock() {
  const allowBackdating = useSettingsStore((s) => s.roomManagement.allowBackdating === true);
  const [businessDate, setBusinessDate] = useState('');

  useEffect(() => {
    setBusinessDate(frontOfficeStore.getBusinessDate());
    return frontOfficeStore.subscribe(() => setBusinessDate(frontOfficeStore.getBusinessDate()));
  }, []);

  const openDay = businessDate || frontOfficeStore.getBusinessDate();
  const floor = allowBackdating ? undefined : arrivalFloor(openDay);
  const errorFor = (value: unknown, kept?: unknown) =>
    eventStartBackdateError(value, allowBackdating, openDay, kept);

  return { floor, errorFor, message: BACKDATE_MESSAGE, calendarDay };
}

/** Earliest check-in for a new event while Allow backdating is off. */
export const useEventStartLock = useArrivalDateLock;
