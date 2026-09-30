import { kitchenOpsStore } from './kitchenOpsStore';
import type { FbOrderDto } from './api';

function minutesBetween(start?: string | null, end?: string | null): number | undefined {
  if (!start || !end) return undefined;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  return Math.max(0, Math.round(ms / 60_000));
}

/** Cook time: kitchen start → ready/served (falls back to order placed time). */
export function kitchenCookMinutes(
  order: Pick<FbOrderDto, 'createdAt' | 'preparingAt' | 'servedAt'>,
  toStatus: string,
  at = new Date().toISOString(),
): number | undefined {
  const start = order.preparingAt || order.createdAt;
  if (toStatus === 'ready' || toStatus === 'served') {
    return minutesBetween(start, order.servedAt || at);
  }
  if (order.preparingAt) {
    return minutesBetween(order.preparingAt, at);
  }
  return undefined;
}

export function logKitchenStatusChange(opts: {
  order: FbOrderDto;
  fromStatus: string;
  toStatus: string;
  cookId?: string;
  cookName?: string;
}) {
  const { order, fromStatus, toStatus, cookId, cookName } = opts;
  const at = new Date().toISOString();
  const itemSummary =
    order.items
      .filter(i => (i.route ?? 'kitchen') === 'kitchen')
      .map(i => `${i.quantity}× ${i.name}`)
      .join(', ') || order.orderNumber;

  kitchenOpsStore.add({
    at,
    orderId: order.orderNumber,
    table: order.tableNumber || order.roomNumber || '-',
    waiterId: order.serverName || undefined,
    itemId: order.id,
    itemName: itemSummary,
    action:
      toStatus === 'preparing' && fromStatus === 'pending'
        ? 'assigned'
        : fromStatus === toStatus && cookId
          ? 'assigned'
          : 'status',
    fromStatus: fromStatus as any,
    toStatus: toStatus as any,
    assignedToId: cookId,
    assignedToName: cookName || order.assignedToName || undefined,
    preparedByName: toStatus === 'ready' || toStatus === 'served' ? (cookName || order.assignedToName || undefined) : undefined,
    priority: (order.priority as any) || 'normal',
    orderedAt: order.createdAt || undefined,
    cookingStartedAt: order.preparingAt || (toStatus === 'preparing' ? at : undefined),
    prepMinutes: kitchenCookMinutes(order, toStatus, at),
  });
}
