import type { Prisma } from '@prisma/client'
import { ReadyBoardError, todayServiceDate } from './readyBoard'

type AskedItem = {
  menuItemId?: string
  id?: string
  catalogId?: string
  name?: string
  quantity?: number
  route?: string
}

/** Reject a quick order that asks for food the kitchen has not marked ready, then draw finite portions. */
export async function drawReadyBoard(
  tx: Prisma.TransactionClient,
  tenantId: string,
  items: AskedItem[],
) {
  const today = todayServiceDate()
  const groups = new Map<string, { name: string; qty: number; route?: string }>()

  for (const item of items) {
    const id = item.menuItemId || item.catalogId || item.id
    const qty = Math.max(1, Math.floor(Number(item.quantity ?? 1)) || 1)
    if (!id) {
      if ((item.route || 'kitchen') !== 'bar') {
        throw new ReadyBoardError(
          `${item.name || 'A dish'} is not on today's ready board. The kitchen has to mark it Ready now before a quick order can take it.`,
        )
      }
      continue
    }
    const prev = groups.get(id)
    if (prev) prev.qty += qty
    else groups.set(id, { name: item.name || 'A dish', qty, route: item.route })
  }

  const ids = [...groups.keys()]
  if (!ids.length) return

  const menu = await tx.fBMenuItem.findMany({ where: { tenantId, id: { in: ids } } })
  const byId = new Map(menu.map((dish) => [dish.id, dish]))

  for (const [id, ask] of groups) {
    const dish = byId.get(id)
    const route = dish?.route || ask.route || 'kitchen'
    if (route === 'bar') continue
    const name = dish?.name || ask.name
    if (!dish || !dish.readyNow || dish.readyForDate !== today || dish.readyPortions === 0) {
      throw new ReadyBoardError(
        `${name} is not on today's ready board. The kitchen has to mark it Ready now before a quick order can take it.`,
      )
    }
    if (dish.readyPortions != null && ask.qty > dish.readyPortions) {
      const left = dish.readyPortions
      throw new ReadyBoardError(
        `${name} has ${left} ready portion${left === 1 ? '' : 's'} left. This quick order asks for ${ask.qty}.`,
      )
    }
  }

  for (const [id, ask] of groups) {
    const dish = byId.get(id)
    if (!dish || dish.route === 'bar' || dish.readyPortions == null) continue
    const left = dish.readyPortions - ask.qty
    await tx.fBMenuItem.update({
      where: { id },
      data: {
        readyPortions: Math.max(0, left),
        readyNow: left > 0,
        readyForDate: left > 0 ? dish.readyForDate : null,
      },
    })
  }
}
