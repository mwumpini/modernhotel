export type LateCheckoutPolicy = {
  lateCheckoutFeeEnabled?: boolean;
  standardCheckOutHour?: number;
  lateCheckoutGraceMinutes?: number;
};

/** A checkout at `now` is late when the fee is on and the clock is past the standard hour, plus grace minutes in that hour. */
export function isLateCheckoutNow(policy: LateCheckoutPolicy | undefined, now = new Date()): boolean {
  if (!policy?.lateCheckoutFeeEnabled) return false;
  const hour = now.getHours();
  const standardHour = Number(policy.standardCheckOutHour ?? 11);
  const grace = Number(policy.lateCheckoutGraceMinutes ?? 0);
  return hour > standardHour || (hour === standardHour && now.getMinutes() > grace);
}
