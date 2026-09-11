import { TaxRule } from '../models';

export interface TaxLineItem {
  // Stable identity of the rule that produced this line — use this (never `name`) to find
  // "the Tier 2 amount" etc. in code, since `name` is a user-editable display label and
  // will not match after a rename.
  ruleId: string;
  name: string;
  amount: number;
  glCode: string;
  rate: number;
  isExempt?: boolean;
  exemptionReason?: string;
  // Employer-side contribution amount, when the rule declares an `employerRate`.
  employerAmount?: number;
}

function evalCondition(context: Record<string, any>, cond: NonNullable<TaxRule['condition']>): boolean {
  const lhs = context?.[cond.field];
  const rhs = cond.value;
  switch (cond.op) {
    case 'eq': return lhs === rhs;
    case 'ne': return lhs !== rhs;
    case 'gt': return Number(lhs) > Number(rhs);
    case 'lt': return Number(lhs) < Number(rhs);
    case 'gte': return Number(lhs) >= Number(rhs);
    case 'lte': return Number(lhs) <= Number(rhs);
    case 'in': return Array.isArray(rhs) ? rhs.includes(lhs) : false;
    default: return true;
  }
}

function computeBase(
  baseType: NonNullable<TaxRule['calculationBase']> | undefined,
  subtotal: number,
  runningBase: number,
  context: Record<string, any>
): number {
  switch (baseType) {
    case 'subtotal_plus_applied':
      return runningBase;
    case 'per_person':
      return subtotal * Number(context?.numPersons ?? 1);
    case 'per_night':
      return subtotal * Number(context?.numNights ?? 1);
    case 'per_person_night':
      return subtotal * Number(context?.numPersons ?? 1) * Number(context?.numNights ?? 1);
    case 'subtotal':
    default:
      return subtotal;
  }
}

function computeTiered(
  base: number,
  tiers: NonNullable<TaxRule['tiers']>,
  rounding?: TaxRule['rounding'],
  roundTo?: number
): number {
  let remaining = base;
  let total = 0;
  for (const tier of tiers) {
    if (remaining <= 0) break;
    const tierBase = tier.upto != null ? Math.min(remaining, tier.upto) : remaining;
    let amt = 0;
    if (tier.rate != null) amt += tierBase * (tier.rate / 100);
    if (tier.fixed != null) amt += tier.fixed;
    if (rounding && roundTo) {
      const m = 1 / roundTo;
      if (rounding === 'nearest') amt = Math.round(amt * m) / m;
      if (rounding === 'down') amt = Math.floor(amt * m) / m;
      if (rounding === 'up') amt = Math.ceil(amt * m) / m;
    }
    total += amt;
    remaining -= tierBase;
  }
  return total;
}

/**
 * The one stacked-tax calculation engine — sorts rules by priority, filters by
 * enabled/effective-date/domain/operation/appliesTo/typeId/condition, then applies each in
 * turn (rate/fixed/tiered, additive or compound). Used both client-side (compliance store,
 * for live previews) and server-side (purchase order / invoice persistence, as the
 * authoritative calculation) so the two can never diverge.
 */
export function computeTaxStack(
  rules: TaxRule[],
  amount: number,
  category = 'ALL',
  context: Record<string, any> = {}
): { taxes: TaxLineItem[]; total: number } {
  const sortedRules = [...rules].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  const now = new Date();
  const isEffective = (r: TaxRule) => {
    const fromOk = !r.effectiveFrom || new Date(r.effectiveFrom) <= now;
    const toOk = !r.effectiveTo || new Date(r.effectiveTo) >= now;
    return fromOk && toOk && (r.enabled !== false);
  };
  const inScope = (r: TaxRule) => {
    const applies = !r.appliesTo || r.appliesTo.includes('ALL') || r.appliesTo.includes(category);
    const roomOk = !r.scope?.roomTypes || !context.roomType || r.scope.roomTypes.includes(context.roomType);
    const guestOk = !r.scope?.guestTypes || !context.guestType || r.scope.guestTypes.includes(context.guestType);
    const domainOk = !r.domain || r.domain === (context.domain || 'sales') || r.domain === 'custom';
    const op = (r.operation || 'both');
    const opKind = (context.operation || 'external');
    const operationOk = op === 'both' || op === opKind;
    const typeOk = !context?.typeId || (r as any).typeId === context.typeId;
    const condOk = !r.condition || evalCondition(context, r.condition);
    return applies && roomOk && guestOk && domainOk && operationOk && typeOk && condOk;
  };

  const activeRules = sortedRules.filter(r => isEffective(r) && inScope(r));

  let runningBase = amount;
  const taxes: TaxLineItem[] = [];
  let addTotal = 0;
  let subtractTotal = 0;
  for (const rule of activeRules) {
    const baseType = rule.calculationBase || 'subtotal';
    const base = computeBase(baseType, amount, runningBase, context);
    let raw = 0;
    let employerAmount: number | undefined;
    const method = rule.method || 'rate';
    if (method === 'fixed') {
      raw = rule.fixedAmount ?? 0;
    } else if (method === 'tiered' && Array.isArray(rule.tiers) && rule.tiers.length) {
      raw = computeTiered(base, rule.tiers, rule.rounding, rule.roundTo);
    } else {
      // Clamp the base for statutory schemes with an insurable-earnings floor/ceiling
      // (e.g. SSNIT). Undefined on every rule that doesn't declare them, so this is a
      // no-op for existing sales/purchases tax rules.
      let clampedBase = base;
      if (typeof rule.floor === 'number' && clampedBase > 0) clampedBase = Math.max(clampedBase, rule.floor);
      if (typeof rule.ceiling === 'number') clampedBase = Math.min(clampedBase, rule.ceiling);
      raw = clampedBase * ((rule.rate ?? 0) / 100);
      if (typeof rule.employerRate === 'number') {
        employerAmount = clampedBase * (rule.employerRate / 100);
      }
    }
    if (rule.rounding && rule.roundTo) {
      const m = 1 / rule.roundTo;
      if (rule.rounding === 'nearest') raw = Math.round(raw * m) / m;
      if (rule.rounding === 'down') raw = Math.floor(raw * m) / m;
      if (rule.rounding === 'up') raw = Math.ceil(raw * m) / m;
    }
    // Final safety-net rounding to the cent — currency amounts are never fractions of a
    // pesewa, and without this, chained percentage math accumulates float artifacts like
    // 123.44999999999998 by the time it reaches a payslip or invoice line.
    raw = Math.round(raw * 100) / 100;
    if (typeof employerAmount === 'number') employerAmount = Math.round(employerAmount * 100) / 100;
    taxes.push({
      ruleId: rule.id,
      name: rule.name,
      amount: raw,
      glCode: rule.glCode,
      rate: rule.rate ?? 0,
      employerAmount,
    });
    const effect = rule.effect || 'add';
    if (effect === 'add') addTotal += raw;
    else if (effect === 'subtract') subtractTotal += raw;
    if ((rule.stacking || 'additive') === 'compound' && effect === 'add') {
      runningBase += raw;
    }
  }
  const total = Math.round((amount + addTotal - subtractTotal) * 100) / 100;
  return { taxes, total };
}
