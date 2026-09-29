import { makeCtx } from './common'
import { loadHr, removeHr, countHr } from './hr'
import { loadFrontOffice, removeFrontOffice, countFrontOffice } from './frontOffice'
import { loadInventory, removeInventory, countInventory } from './inventory'
import { loadOperations, removeOperations, countOperations } from './operations'
import { loadRestaurant, removeRestaurant, countRestaurant } from './restaurant'
import { loadSecurity, removeSecurity, countSecurity } from './security'
import { loadAccounting, removeAccounting, countAccounting } from './accounting'

export type SampleDataStatus = {
  loaded: boolean
  counts: {
    staff: number; departments: number; guests: number; reservations: number
    stockItems: number; suppliers: number; housekeepingTasks: number; events: number; recipes: number
    restaurantOrders: number; securityIncidents: number; journalEntries: number
  }
}

export async function getSampleDataStatus(tenantId: string): Promise<SampleDataStatus> {
  const ctx = makeCtx(tenantId)
  const counts = {
    ...(await countHr(ctx)), ...(await countFrontOffice(ctx)), ...(await countInventory(ctx)), ...(await countOperations(ctx)),
    ...(await countRestaurant(ctx)), ...(await countSecurity(ctx)), ...(await countAccounting(ctx)),
  }
  return { loaded: Object.values(counts).some((n) => n > 0), counts }
}

/** Adds the starter records for one hotel. Safe to run again: existing sample records are left as they are. */
export async function loadSampleData(tenantId: string): Promise<{ notes: string[] }> {
  const ctx = makeCtx(tenantId)
  await loadHr(ctx)
  const notes = await loadFrontOffice(ctx)
  await loadInventory(ctx)
  await loadOperations(ctx)
  notes.push(...(await loadRestaurant(ctx)))
  await loadSecurity(ctx)
  // Last: it posts the stays and bills the modules above created.
  notes.push(...(await loadAccounting(ctx)))
  return { notes }
}

/** Removes every sample record for one hotel (and what testers attached to them). `kept` lists anything that had to stay. */
export async function removeSampleData(tenantId: string): Promise<{ kept: string[] }> {
  const ctx = makeCtx(tenantId)
  await removeAccounting(ctx)
  await removeRestaurant(ctx)
  await removeSecurity(ctx)
  await removeOperations(ctx)
  const kept = await removeInventory(ctx)
  await removeFrontOffice(ctx)
  await removeHr(ctx)
  return { kept }
}
