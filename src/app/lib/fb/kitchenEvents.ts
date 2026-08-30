import { kitchenOpsStore } from './kitchenOpsStore';
import type { FbOrderDto } from './api';

export function logKitchenStatusChange(opts: {
  order: FbOrderDto;
  fromStatus: string;
  toStatus: string;
  cookId?: string;
  cookName?: string;
}) {
  const { order, fromStatus, toStatus, cookId, cookName } = opts;
  const itemSummary =
    order.items
      .filter(i => (i.route ?? 'kitchen') === 'kitchen')
      .map(i => `${i.quantity}× ${i.name}`)
      .join(', ') || order.orderNumber;

  kitchenOpsStore.add({
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
  });
}
