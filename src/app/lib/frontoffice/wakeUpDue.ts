import type { WakeUpCall } from './types';

export function isWakeUpDue(
  call: Pick<WakeUpCall, 'status' | 'date' | 'time'>,
  now: { date: string; hour: number; minute: number },
) {
  if (call.status !== 'scheduled') return false;
  const time = (call.time || '').slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(time) || !/^\d{4}-\d{2}-\d{2}$/.test(call.date)) return false;
  const [hour, minute] = time.split(':').map(Number);
  if (call.date < now.date) return true;
  if (call.date > now.date) return false;
  if (hour < now.hour) return true;
  if (hour > now.hour) return false;
  return minute <= now.minute;
}
