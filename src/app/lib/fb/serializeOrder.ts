/** Server-side F&B order serialization for API responses. */

function inferItemRoute(
  item: { route?: string | null; category?: string | null },
  menuRouteById?: Map<string, string>
): string {
  if (item.route) return item.route;
  const cat = (item.category || '').toLowerCase();
  if (cat.includes('drink') || cat.includes('bever') || cat.includes('bar')) return 'bar';
  return 'kitchen';
}

export function serializeFbOrderItem(
  item: any,
  menuRouteById?: Map<string, string>
) {
  const menuRoute =
    item.menuItemId && menuRouteById?.has(item.menuItemId)
      ? menuRouteById.get(item.menuItemId)
      : undefined;

  return {
    id: item.id,
    menuItemId: item.menuItemId,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    amount: Number(item.amount),
    taxAmount: Number(item.taxAmount ?? 0),
    notes: item.notes,
    route: item.route || menuRoute || inferItemRoute(item),
    createdAt: item.createdAt,
  };
}

export function serializeFbOrder(order: any, menuRouteById?: Map<string, string>) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    venue: order.venue,
    status: order.status,
    tableNumber: order.tableNumber,
    roomNumber: order.roomNumber,
    guestId: order.guestId,
    reservationId: order.reservationId,
    folioId: order.folioId,
    serverName: order.serverName,
    covers: order.covers,
    subtotal: Number(order.subtotal),
    taxAmount: Number(order.taxAmount),
    total: Number(order.total),
    taxLines: order.taxLines,
    discountAmount: Number(order.discountAmount ?? 0),
    serviceCharge: Number(order.serviceCharge ?? 0),
    notes: order.notes,
    priority: order.priority ?? 'normal',
    assignedToId: order.assignedToId,
    assignedToName: order.assignedToName,
    preparingAt: order.preparingAt ? new Date(order.preparingAt).toISOString() : null,
    billedAt: order.billedAt,
    servedAt: order.servedAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: (order.items || []).map((it: any) => serializeFbOrderItem(it, menuRouteById)),
  };
}

export function resolveItemRouteFromPayload(item: any): string {
  if (item.route === 'bar' || item.route === 'kitchen') return item.route;
  return inferItemRoute(item);
}
