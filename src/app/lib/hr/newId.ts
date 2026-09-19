let sequence = 0;

/** A unique id for a new HR record. `Date.now()` alone is not enough: anything created in a loop
 * (a payroll run saving every employee's record, enrolling several staff at once, copying a
 * week's shifts) lands in the same millisecond, and records sharing an id overwrite each other
 * when saved. The counter and random part keep ids distinct even within one millisecond. */
export function newId(prefix = ''): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  sequence = (sequence + 1) % 1_000_000;
  return `${prefix}${Date.now()}${sequence.toString(36)}${random}`;
}
