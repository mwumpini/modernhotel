import type { PrintData, PrintSignature } from './templates';
import { money } from './templates';
import { formatHotelDate } from '../settings/hotelDates';

/**
 * Boxed payment voucher in the account-ledger form: number and date,
 * payee, account code / particulars / debit / credit, bank and cheque,
 * then prepared, approved, and recorded.
 */
export function renderLedgerVoucherDocument(data: PrintData): string {
  const currency = data.currency || '₵';
  const lines = data.debitCreditLines || [];
  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const rowCount = Math.max(5, lines.length);
  const body = Array.from({ length: rowCount }, (_, index) => {
    const line = lines[index];
    if (!line) return '<tr><td></td><td></td><td></td><td></td></tr>';
    const particulars = line.details?.trim() || line.accountName || '';
    return `<tr>
      <td class="code">${esc(line.accountCode || '')}</td>
      <td>${esc(particulars)}</td>
      <td class="amt">${line.debit ? esc(money(line.debit, currency)) : ''}</td>
      <td class="amt">${line.credit ? esc(money(line.credit, currency)) : ''}</td>
    </tr>`;
  }).join('');
  const bank = data.bankDetails;
  const bankText = [bank?.bankName, bank?.accountName, bank?.accountNumber].filter(Boolean).join(' · ');
  const notes = (data.footerNotes || []).filter(Boolean);

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(data.title || 'Payment Voucher')}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; color: #111; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; }
  .sheet { border: 1px solid #111; padding: 18px 16px 14px; }
  h1 { margin: 0; text-align: center; font-size: 22px; letter-spacing: 0.04em; }
  .org { text-align: center; margin-top: 2px; font-size: 14px; }
  .meta { margin-top: 14px; text-align: right; }
  .meta div { margin: 4px 0; }
  .payto { display: flex; gap: 8px; align-items: flex-start; margin: 14px 0 8px; }
  .payto-body { display: flex; flex-direction: column; gap: 1px; }
  .payto-more { line-height: 1.35; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #111; padding: 6px 8px; vertical-align: top; height: 28px; }
  th { background: #f3f4f6; font-weight: 600; text-align: center; }
  td.code { width: 18%; font-variant-numeric: tabular-nums; }
  td.amt, th.amt { width: 16%; text-align: right; font-variant-numeric: tabular-nums; }
  tr.total td { font-weight: 700; height: 32px; }
  .total-label { text-align: right; }
  .bank { display: flex; justify-content: space-between; gap: 24px; margin-top: 14px; }
  .sign { margin-top: 10px; }
  .blank, .filled { display: inline-block; min-width: 140px; border-bottom: 1px solid #111; padding: 0 6px 1px; line-height: 1.3; }
  .blank { min-height: 1em; }
  .short { min-width: 110px; }
  .notes { margin-top: 8px; font-size: 12px; color: #374151; }
</style></head><body>
<div class="sheet">
  <h1>PAYMENT VOUCHER</h1>
  <div class="org">${esc(data.org.name || '')}</div>
  <div class="meta">
    <div>No. : ${field(data.docNumber, 160)}</div>
    <div>Date : ${field(data.docDate ? formatHotelDate(data.docDate) : '', 160)}</div>
  </div>
  <div class="payto"><span>Pay To :</span><span class="payto-body">${payToHtml(data)}</span></div>
  <table>
    <thead>
      <tr>
        <th>Account Code</th>
        <th>Particulars</th>
        <th class="amt">Debit<br>${esc(currency)}</th>
        <th class="amt">Credit<br>${esc(currency)}</th>
      </tr>
    </thead>
    <tbody>
      ${body}
      <tr class="total">
        <td></td>
        <td class="total-label">TOTAL</td>
        <td class="amt">${esc(money(totalDebit, currency))}</td>
        <td class="amt">${esc(money(totalCredit, currency))}</td>
      </tr>
    </tbody>
  </table>
  <div class="bank">
    <div>Bank Account : ${field(bankText, 220)}</div>
    <div>Cheque No. : ${field(data.chequeNumber, 140)}</div>
  </div>
  ${signRow('Prepared by', signFor(data, 'prepared'))}
  ${signRow('Approved by', signFor(data, 'approved'))}
  ${signRow('Recorded by', signFor(data, 'recorded'))}
</div>
${notes.length ? `<div class="notes">${notes.map(note => esc(note)).join(' · ')}</div>` : ''}
</body></html>`;
}

function payToHtml(data: PrintData): string {
  const guest = data.guest;
  const extra = (guest?.address || '').split('\n').map(line => line.trim()).filter(Boolean);
  const more = extra.map(line => `<div class="payto-more">${esc(line)}</div>`).join('');
  return `${field(guest?.name, 280)}${more}`;
}

function signFor(data: PrintData, key: string): PrintSignature | undefined {
  return (data.signatures || []).find(line => line.label.toLowerCase().includes(key));
}

function signRow(label: string, sign?: PrintSignature): string {
  const when = sign?.signedDate ? formatHotelDate(sign.signedDate) : '';
  return `<div class="sign">${esc(label)} : ${field(sign?.name, 150)} Signature : ${field('', 150, 'short')} Date : ${field(when, 110, 'short')}</div>`;
}

function field(value: string | undefined, width: number, extra = ''): string {
  const text = (value || '').trim();
  if (!text) return `<span class="blank ${extra}" style="min-width:${width}px"></span>`;
  return `<span class="filled ${extra}" style="min-width:${width}px">${esc(text)}</span>`;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ));
}
