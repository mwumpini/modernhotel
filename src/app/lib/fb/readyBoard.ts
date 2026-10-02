/**
 * Ready board — what the kitchen can send immediately today.
 * Drinks pour at the bar, so they are always allowed on a quick order.
 * Food is allowed only when the kitchen marked it ready for today's service date.
 */

export class ReadyBoardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReadyBoardError'
  }
}

export function todayServiceDate(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isOnReadyBoard(
  item: {
    route?: string | null
    readyNow?: boolean | null
    readyForDate?: string | null
    readyPortions?: number | null
  },
  date = todayServiceDate(),
): boolean {
  if ((item.route || 'kitchen') === 'bar') return true
  if (!item.readyNow || item.readyForDate !== date) return false
  if (item.readyPortions === 0) return false
  return true
}
