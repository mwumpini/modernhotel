/**
 * Ghana PAYE parts taxed at a flat rate instead of the graduated bands (Income Tax Act, as
 * amended; rates per GRA / Act 1178 schedule, 2026):
 * - Bonus up to 15% of annual basic salary: 5% final tax. The excess joins graduated income.
 * - Overtime of a qualifying junior employee (annual employment income up to GHS 18,000):
 *   5% on overtime up to 50% of monthly basic, 10% above that. Anyone else's overtime is
 *   graduated income.
 * - Casual worker: 5% final withholding on the payment.
 * - Non-resident employee: 25% flat; bonus and overtime 20%.
 * A hotel can override any of these on its PAYE rule (`specialRates`); missing values fall
 * back to the defaults below.
 */
export interface GhanaSpecialRates {
  bonusRate: number;
  bonusCapPctOfAnnualBasic: number;
  qualifyingAnnualIncomeCap: number;
  overtimeRate: number;
  overtimeExcessRate: number;
  overtimeThresholdPctOfBasic: number;
  casualRate: number;
  nonResidentRate: number;
  nonResidentBonusOvertimeRate: number;
}

export const GH_SPECIAL_RATE_DEFAULTS: GhanaSpecialRates = {
  bonusRate: 5,
  bonusCapPctOfAnnualBasic: 15,
  qualifyingAnnualIncomeCap: 18000,
  overtimeRate: 5,
  overtimeExcessRate: 10,
  overtimeThresholdPctOfBasic: 50,
  casualRate: 5,
  nonResidentRate: 25,
  nonResidentBonusOvertimeRate: 20,
};

export function resolveGhanaSpecialRates(rule?: { specialRates?: Partial<GhanaSpecialRates> } | null): GhanaSpecialRates {
  const out = { ...GH_SPECIAL_RATE_DEFAULTS };
  const custom = rule?.specialRates || {};
  for (const key of Object.keys(out) as Array<keyof GhanaSpecialRates>) {
    const v = Number(custom[key]);
    if (custom[key] != null && Number.isFinite(v) && v >= 0) out[key] = v;
  }
  return out;
}

export interface GhanaPayeInput {
  /** Taxable pay after pre-tax deductions (Tier 1/2/3). */
  taxable: number;
  /** Taxable earnings before pre-tax deductions — the casual worker's payment. */
  taxableEarnings: number;
  monthlyBasic: number;
  monthlyAllowances: number;
  bonus: number;
  overtime: number;
  /** Bonus already paid to this employee earlier in the same year. */
  bonusEarlierThisYear: number;
  employmentClass?: string;
  residencyStatus?: string;
}

export interface GhanaFlatLine {
  name: string;
  base: number;
  rate: number;
  amount: number;
}

export interface GhanaPayeSplit {
  /** Pay left for the graduated PAYE bands; 0 when the person isn't on the bands at all. */
  graduatedBase: number;
  flatLines: GhanaFlatLine[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const line = (name: string, base: number, rate: number): GhanaFlatLine => ({ name, base: r2(base), rate, amount: r2(base * (rate / 100)) });

export function splitGhanaPaye(input: GhanaPayeInput, rates: GhanaSpecialRates): GhanaPayeSplit {
  const taxable = Math.max(0, input.taxable);
  const bonus = Math.max(0, input.bonus);
  const overtime = Math.max(0, input.overtime);

  if (input.residencyStatus === 'non_resident') {
    const extra = Math.min(bonus + overtime, taxable);
    const lines = [line(`Non-resident tax (${rates.nonResidentRate}%)`, taxable - extra, rates.nonResidentRate)];
    if (extra > 0) lines.push(line(`Non-resident bonus/overtime tax (${rates.nonResidentBonusOvertimeRate}%)`, extra, rates.nonResidentBonusOvertimeRate));
    return { graduatedBase: 0, flatLines: lines.filter((l) => l.base > 0) };
  }

  if (input.employmentClass === 'casual') {
    const payment = Math.max(0, input.taxableEarnings);
    return { graduatedBase: 0, flatLines: payment > 0 ? [line(`Casual worker tax (${rates.casualRate}%)`, payment, rates.casualRate)] : [] };
  }

  const flatLines: GhanaFlatLine[] = [];
  let flatTotal = 0;

  const bonusCap = input.monthlyBasic * 12 * (rates.bonusCapPctOfAnnualBasic / 100);
  const bonusFlat = Math.min(bonus, Math.max(0, bonusCap - Math.max(0, input.bonusEarlierThisYear)));
  if (bonusFlat > 0) {
    flatLines.push(line(`Bonus tax (${rates.bonusRate}%)`, bonusFlat, rates.bonusRate));
    flatTotal += bonusFlat;
  }

  const annualIncome = (input.monthlyBasic + Math.max(0, input.monthlyAllowances)) * 12;
  if (overtime > 0 && annualIncome <= rates.qualifyingAnnualIncomeCap) {
    const lower = Math.min(overtime, input.monthlyBasic * (rates.overtimeThresholdPctOfBasic / 100));
    const upper = overtime - lower;
    if (lower > 0) flatLines.push(line(`Overtime tax (${rates.overtimeRate}%)`, lower, rates.overtimeRate));
    if (upper > 0) flatLines.push(line(`Overtime tax (${rates.overtimeExcessRate}%)`, upper, rates.overtimeExcessRate));
    flatTotal += overtime;
  }

  return { graduatedBase: r2(Math.max(0, taxable - flatTotal)), flatLines };
}
