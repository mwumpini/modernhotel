import { amountToWordsGhana } from './payrollPdf';
import { DEFAULT_ADVICE_INSTRUCTION } from './salaryBanks';
import { openHtmlPrintWindow } from '../print/engine';
import type { PrintOrgInfo } from '../print/templates';

export interface AdviceLetterRow {
  employeeName: string;
  accountNumber: string;
  net: number;
}

export interface AdviceLetterInput {
  org: PrintOrgInfo;
  bankOrChannel: string;
  monthLabel: string;
  rows: AdviceLetterRow[];
  signerName: string;
  signerPosition: string;
  signature?: string;
  bankLogoUrl?: string;
  dateLabel?: string;
  /** Saved wording from Pay setup. Blank uses the standard salary instruction. */
  instruction?: string;
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ));
}

export function adviceMoney(amount: number): string {
  return Number(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Who the letter is written to. A bank letter goes to the branch manager. */
export function adviceAddressee(channel: string): string[] {
  if (channel === 'Cash') return ['The Cashier'];
  if (channel === 'MoMo') return ['Mobile Money'];
  return ['The Manager', channel];
}

export function adviceAccountHeading(channel: string): string {
  if (channel === 'Cash') return 'Reference';
  if (channel === 'MoMo') return 'Wallet number';
  return 'Account number';
}

/** The instruction the bank, MoMo desk, or cashier is asked to carry out. */
export function adviceInstruction(channel: string, hotelName: string, monthLabel: string, total: number, template?: string): string {
  const amount = adviceMoney(total);
  const words = amountToWordsGhana(total);
  const saved = (template || '').trim();
  if (saved && saved !== DEFAULT_ADVICE_INSTRUCTION) {
    return saved
      .replaceAll('{hotel}', hotelName)
      .replaceAll('{month}', monthLabel)
      .replaceAll('{amount}', amount)
      .replaceAll('{words}', words);
  }
  const money = `The total amount is GHS ${amount} (${words}).`;
  const opening = channel === 'Cash'
    ? `Kindly pay the net salaries of the underlisted staff of ${hotelName} in cash for ${monthLabel}.`
    : channel === 'MoMo'
      ? `Kindly pay the net salaries of the underlisted staff of ${hotelName} through Mobile Money for ${monthLabel}.`
      : `Kindly debit our account and credit the net salaries of the underlisted staff of ${hotelName} for ${monthLabel}.`;
  return `${opening} ${money} Please pay as follows:`;
}

function safeSignature(value?: string): string {
  const text = String(value || '').trim();
  if (!/^data:image\/(png|jpeg|jpg);base64,[a-z0-9+/=\s]+$/i.test(text)) return '';
  if (text.length > 400_000) return '';
  return text;
}

/** Printable salary letter: letterhead, the payment instruction, the schedule, and the signature. */
export function paymentAdviceLetterHtml(input: AdviceLetterInput): string {
  const org = input.org;
  const total = input.rows.reduce((sum, row) => sum + (row.net || 0), 0);
  const words = amountToWordsGhana(total);
  const dateLabel = input.dateLabel || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const heading = adviceAccountHeading(input.bankOrChannel);
  const logo = org.logoUrl ? `<img class="logo" src="${esc(org.logoUrl)}" alt="" onerror="this.style.display='none'" />` : '';
  const bankLogo = input.bankLogoUrl ? `<img class="bank" src="${esc(input.bankLogoUrl)}" alt="" onerror="this.style.display='none'" />` : '';
  const contacts = [
    org.address ? esc(org.address) : '',
    [org.phone ? `Tel. ${esc(org.phone)}` : '', org.email ? esc(org.email) : ''].filter(Boolean).join(' · '),
    org.taxId ? `TIN ${esc(org.taxId)}` : '',
  ].filter(Boolean).map((line) => `<div>${line}</div>`).join('');
  const signature = safeSignature(input.signature);
  const rows = input.rows.map((row, index) => `<tr>
    <td class="no">${index + 1}</td>
    <td class="name">${esc(row.employeeName)}</td>
    <td class="acct">${esc(row.accountNumber || '—')}</td>
    <td class="amt">${adviceMoney(row.net)}</td>
  </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>Salary Payment Advice — ${esc(input.bankOrChannel)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 22px 28px; color: #111; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; }
  .head { display: flex; gap: 16px; align-items: flex-start; }
  .logo { width: 84px; height: auto; object-fit: contain; }
  .bank { width: 72px; height: auto; object-fit: contain; margin-left: auto; }
  .contacts { flex: 1; text-align: center; line-height: 1.4; }
  .org-name { font-weight: 800; font-size: 16px; }
  .rule { border: 0; border-top: 1.5px solid #111; margin: 10px 0 14px; }
  .date { text-align: right; margin-bottom: 12px; }
  .to { line-height: 1.4; margin-bottom: 12px; }
  h1 { margin: 12px 0; text-align: center; font-size: 14px; letter-spacing: 0.04em; }
  .instruction { margin: 0 0 12px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 5px 8px; vertical-align: top; }
  th { text-align: left; font-size: 11px; }
  td.no, th.no { width: 42px; text-align: center; }
  th.name { width: auto; }
  td.acct, th.acct { width: 32%; }
  td.amt, th.amt { width: 18%; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  td.name { font-weight: 600; }
  tfoot td { font-weight: 800; }
  .words { margin-top: 10px; line-height: 1.45; }
  .close { margin-top: 16px; line-height: 1.5; }
  .sign { margin-top: 18px; }
  .sign img { height: 52px; max-width: 180px; object-fit: contain; }
  .who { font-weight: 700; margin-top: 2px; }
  .role { color: #333; }
</style></head><body>
<div class="head">
  ${logo}
  <div class="contacts">
    <div class="org-name">${esc(org.name || '')}</div>
    ${contacts}
  </div>
  ${bankLogo}
</div>
<hr class="rule" />
<div class="date">${esc(dateLabel)}</div>
<div class="to">${adviceAddressee(input.bankOrChannel).map((line) => `<div>${esc(line)}</div>`).join('')}</div>
<div>Dear Sir/Madam,</div>
<h1>SALARY PAYMENT ADVICE</h1>
<p class="instruction">${esc(adviceInstruction(input.bankOrChannel, org.name || '', input.monthLabel, total, input.instruction))}</p>
<table>
  <colgroup>
    <col style="width:42px" />
    <col />
    <col style="width:32%" />
    <col style="width:18%" />
  </colgroup>
  <thead>
    <tr>
      <th class="no">No.</th>
      <th class="name">Staff name</th>
      <th class="acct">${esc(heading)}</th>
      <th class="amt">Amount (GHS)</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr>
      <td></td>
      <td>Total</td>
      <td></td>
      <td class="amt">${adviceMoney(total)}</td>
    </tr>
  </tfoot>
</table>
<div class="words"><strong>Amount in words:</strong> ${esc(words)}</div>
<div class="close">Counting on your usual cooperation.<br />Yours faithfully,</div>
<div class="sign">
  ${signature ? `<img src="${signature}" alt="" />` : '<div style="height:36px"></div>'}
  <div class="who">${esc(input.signerName || 'Authorized Signatory')}</div>
  <div class="role">${esc(input.signerPosition || '')}</div>
</div>
</body></html>`;
}

export function printPaymentAdviceLetter(input: AdviceLetterInput): boolean {
  return openHtmlPrintWindow(paymentAdviceLetterHtml(input));
}
