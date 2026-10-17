/** Banks staff are paid through, and the person who signs the salary payment advice. */
export interface PayrollPaySetup {
  banks: string[];
  signerName: string;
  signerPosition: string;
  /** Handwritten signature, stored as a small PNG or JPG data URL. */
  signature: string;
  /**
   * Wording of the salary letter. {hotel}, {month}, {amount} and {words}
   * are filled in for each letter.
   */
  instruction: string;
}

/** The bank letter, until the hotel writes its own. */
export const DEFAULT_ADVICE_INSTRUCTION = 'Kindly debit our account and credit the net salaries of the underlisted staff of {hotel} for {month}. The total amount is GHS {amount} ({words}). Please pay as follows:';

function cleanName(value: unknown, max: number): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Drop blanks and repeated names. The first spelling is the one that is kept. */
export function uniqueBankNames(values: unknown[]): string[] {
  const names: string[] = [];
  for (const value of values) {
    const name = cleanName(value, 80);
    if (!name) continue;
    if (names.some((existing) => existing.toLowerCase() === name.toLowerCase())) continue;
    names.push(name);
    if (names.length >= 40) break;
  }
  return names;
}

function cleanInstruction(value: unknown): string {
  return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, 2000);
}

function cleanSignature(value: unknown): string {
  const text = String(value || '').trim();
  if (!/^data:image\/(png|jpeg|jpg);base64,[a-z0-9+/=\s]+$/i.test(text)) return '';
  if (text.length > 400_000) return '';
  return text;
}

export function normalizePaySetup(raw: unknown): PayrollPaySetup {
  const source = (raw && typeof raw === 'object') ? raw as { banks?: unknown; signerName?: unknown; signerPosition?: unknown; signature?: unknown; instruction?: unknown } : {};
  return {
    banks: uniqueBankNames(Array.isArray(source.banks) ? source.banks : []),
    signerName: cleanName(source.signerName, 120),
    signerPosition: cleanName(source.signerPosition, 120),
    signature: cleanSignature(source.signature),
    instruction: cleanInstruction(source.instruction),
  };
}

/** Banks already written on staff records. Used until the hotel saves its own list. */
export function banksInUse(names: Array<string | undefined>): string[] {
  return uniqueBankNames(names);
}

/**
 * Choices on the employee form. A saved list wins. Until then, the banks already on staff are shown.
 * A name already stored on this person stays selectable.
 */
export function salaryBankOptions(args: { saved: boolean; banks: string[]; inUse: string[]; current?: string }): string[] {
  const names = uniqueBankNames(args.saved ? args.banks : args.inUse);
  const current = cleanName(args.current, 80);
  if (current && !names.some((name) => name.toLowerCase() === current.toLowerCase())) names.unshift(current);
  return names;
}
