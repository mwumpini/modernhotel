/** Settings → Security session timeout. Values under 1 minute do not log anyone out. */
export function idleTimedOut(lastActivityMs: number, nowMs: number, timeoutMinutes: number): boolean {
  if (!Number.isFinite(timeoutMinutes) || timeoutMinutes < 1) return false;
  if (!Number.isFinite(lastActivityMs) || !Number.isFinite(nowMs)) return false;
  return nowMs - lastActivityMs >= timeoutMinutes * 60 * 1000;
}
