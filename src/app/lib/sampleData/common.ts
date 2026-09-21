import { prisma } from '../database/client'

/**
 * Sample ("starter") data for testers. Every record it creates gets an id that starts with
 * `smp_<tenant tag>_`, so "Remove sample data" can find exactly what was loaded — and nothing a
 * hotel entered itself. The tenant tag keeps ids unique across hotels (ids are globally unique keys).
 */
export interface SampleCtx {
  tenantId: string
  /** id prefix for this tenant's sample records */
  p: string
  /** today, as UTC midnight (date-only values are stored as UTC midnight) */
  today: Date
}

export function makeCtx(tenantId: string): SampleCtx {
  const now = new Date()
  return {
    tenantId,
    p: `smp_${tenantId.slice(-6)}_`,
    today: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  }
}

/** The date `offset` days from today, at UTC midnight. */
export function dayOffset(ctx: SampleCtx, offset: number): Date {
  return new Date(ctx.today.getTime() + offset * 86_400_000)
}

/** YYYY-MM-DD for a day offset (what the stores keep for date-only strings). */
export function dayString(ctx: SampleCtx, offset: number): string {
  return dayOffset(ctx, offset).toISOString().slice(0, 10)
}

/** A moment on a given day, e.g. atTime(ctx, -1, 7, 55) = yesterday 07:55 UTC. */
export function atTime(ctx: SampleCtx, offset: number, hour: number, minute = 0): Date {
  return new Date(dayOffset(ctx, offset).getTime() + (hour * 60 + minute) * 60_000)
}

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Create each row unless its id already exists — never overwrites what a tester has since edited. */
export async function seedRows(model: any, rows: Array<Record<string, any>>): Promise<void> {
  for (const row of rows) {
    await model.upsert({ where: { id: row.id }, update: {}, create: row })
  }
}

/** Rows this tenant holds whose id is one of the sample ids. */
export const bySampleId = (ctx: SampleCtx) => ({ tenantId: ctx.tenantId, id: { startsWith: ctx.p } })

/** Ids of this tenant's sample rows in a model — for deleting records that point at them. */
export async function sampleIds(model: any, ctx: SampleCtx): Promise<string[]> {
  const rows = await model.findMany({ where: bySampleId(ctx), select: { id: true } })
  return rows.map((r: { id: string }) => r.id)
}

export { prisma }
