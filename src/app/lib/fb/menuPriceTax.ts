/**
 * Restaurant bill from menu prices.
 * A line with priceIncludesTax is the amount the guest pays; tax is taken out of it.
 * A line without is before tax; tax is added on top.
 * Service and packaging stay before tax and have tax added.
 */

export type MenuTaxLine = {
  taxCode: string
  name: string
  type?: string
  rate: number
  amount: number
  glAccountCode?: string | null
}

export type MenuBillLine = {
  unitPrice: number
  quantity: number
  priceIncludesTax: boolean
}

export type MenuBillQuote = {
  /** Sum of the prices as entered on the menu, before discount. */
  menuAmount: number
  /** What the guest pays. */
  guestTotal: number
  taxAmount: number
  /** Item prices turned into a before-tax amount, before discount. */
  exclusiveSubtotal: number
  /** Discount restated on that before-tax amount. */
  exclusiveDiscount: number
  taxLines: MenuTaxLine[]
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function exclusiveFromGross(
  gross: number,
  taxOnExclusive: (net: number) => { totalTax: number },
): number {
  if (gross <= 0) return 0
  const sample = taxOnExclusive(100)
  const multiplier = (100 + sample.totalTax) / 100
  if (multiplier <= 1) return round2(gross)
  return round2(gross / multiplier)
}

function scaleLines(lines: MenuTaxLine[], target: number): MenuTaxLine[] {
  if (target <= 0 || lines.length === 0) return []
  const raw = round2(lines.reduce((sum, line) => sum + line.amount, 0))
  if (raw <= 0) return []
  if (Math.abs(raw - target) < 0.001) return lines.map((line) => ({ ...line, amount: round2(line.amount) }))
  let allocated = 0
  return lines.map((line, index) => {
    const amount = index === lines.length - 1 ? round2(target - allocated) : round2((line.amount * target) / raw)
    allocated = round2(allocated + amount)
    return { ...line, amount }
  })
}

function mergeLines(groups: MenuTaxLine[][]): MenuTaxLine[] {
  const byCode = new Map<string, MenuTaxLine>()
  for (const group of groups) {
    for (const line of group) {
      if (line.amount <= 0) continue
      const key = line.taxCode || line.name
      const prev = byCode.get(key)
      if (!prev) byCode.set(key, { ...line, amount: round2(line.amount) })
      else prev.amount = round2(prev.amount + line.amount)
    }
  }
  return [...byCode.values()]
}

export function quoteMenuBill(args: {
  lines: MenuBillLine[]
  discountAmount?: number
  serviceCharge?: number
  packaging?: number
  taxOnExclusive: (net: number) => { totalTax: number; lines: MenuTaxLine[] }
}): MenuBillQuote {
  let includedGross = 0
  let exclusiveNet = 0
  for (const line of args.lines) {
    const entered = round2(Math.max(0, Number(line.unitPrice) || 0) * Math.max(0, Number(line.quantity) || 0))
    if (line.priceIncludesTax) includedGross = round2(includedGross + entered)
    else exclusiveNet = round2(exclusiveNet + entered)
  }

  const menuAmount = round2(includedGross + exclusiveNet)
  const discount = round2(Math.min(Math.max(Number(args.discountAmount) || 0, 0), menuAmount))
  const includedShare = menuAmount > 0 ? includedGross / menuAmount : 0
  const includedDiscount = round2(discount * includedShare)
  const exclusiveDiscountOnNet = round2(discount - includedDiscount)
  const includedAfter = round2(Math.max(0, includedGross - includedDiscount))
  const exclusiveAfter = round2(Math.max(0, exclusiveNet - exclusiveDiscountOnNet))

  const includedNetBefore = includedGross > 0 ? exclusiveFromGross(includedGross, args.taxOnExclusive) : 0
  const includedNetAfter = includedAfter > 0 ? exclusiveFromGross(includedAfter, args.taxOnExclusive) : 0
  const includedTax = round2(Math.max(0, includedAfter - includedNetAfter))

  const extras = round2(Math.max(0, Number(args.serviceCharge) || 0) + Math.max(0, Number(args.packaging) || 0))
  const addedBase = round2(exclusiveAfter + extras)
  const added = args.taxOnExclusive(addedBase)
  const includedStack = includedNetAfter > 0 ? scaleLines(args.taxOnExclusive(includedNetAfter).lines, includedTax) : []

  const exclusiveSubtotal = round2(includedNetBefore + exclusiveNet)
  const exclusiveDiscount = round2(Math.max(0, exclusiveSubtotal - includedNetAfter - exclusiveAfter))
  const taxAmount = round2(includedTax + added.totalTax)
  const guestTotal = round2(includedAfter + addedBase + added.totalTax)

  return {
    menuAmount,
    guestTotal,
    taxAmount,
    exclusiveSubtotal,
    exclusiveDiscount,
    taxLines: mergeLines([includedStack, added.lines]),
  }
}
