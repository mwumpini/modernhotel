/** Match a signed-in person to a housekeeper card by name. */

export function samePerson(a?: string | null, b?: string | null): boolean {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  return left.length > 0 && left === right;
}

export function cleanerStaffForUser<T extends { id: string; name: string; role: string; active: boolean }>(
  staff: T[],
  userName?: string | null,
): T | null {
  return staff.find((member) => member.active && member.role === 'housekeeper' && samePerson(member.name, userName)) || null;
}
