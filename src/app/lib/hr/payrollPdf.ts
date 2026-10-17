/* eslint-disable @typescript-eslint/no-explicit-any */

export interface VoucherSectionInput {
  hotelName: string;
  monthLabel: string; // e.g. "April 2024"
  bankName: string;
  rows: Array<{ employeeName: string; accountNumber: string; net: number }>; // currency already implied
}

export interface GenerateVouchersArgs {
  sections: VoucherSectionInput[];
  fileName: string;
}

export function amountToWordsGhana(value: number) {
  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const numToWords = (n: number): string => {
    if (n === 0) return 'zero';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? '-' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '');
    if (n < 1_000_000) return numToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
    if (n < 1_000_000_000) return numToWords(Math.floor(n / 1_000_000)) + ' million' + (n % 1_000_000 ? ' ' + numToWords(n % 1_000_000) : '');
    return String(n);
  };
  const whole = Math.floor(value);
  const frac = Math.round((value - whole) * 100);
  const words = numToWords(whole) + ' Ghana cedis' + (frac ? ' and ' + numToWords(frac) + ' pesewas' : '');
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateVouchersPDF(args: GenerateVouchersArgs) {
  const JSPDF: any = (await import('jspdf')).default;
  const doc: any = new JSPDF();
  let firstPage = true;
  args.sections.forEach((section) => {
    if (!firstPage) doc.addPage();
    firstPage = false;
    let y = 20;
    doc.setFontSize(14); doc.text(section.hotelName, 105, y, { align: 'center' }); y += 8;
    doc.setFontSize(11); doc.text(`Salary Voucher - ${section.bankName}`, 105, y, { align: 'center' }); y += 6;
    doc.text(section.monthLabel, 105, y, { align: 'center' }); y += 10;
    doc.setFontSize(10);
    doc.text('Name', 14, y); doc.text('Account No.', 100, y); doc.text('Net Salary (GHS)', 170, y, { align: 'right' }); y += 6;
    let total = 0;
    section.rows.forEach((r) => {
      doc.text(r.employeeName, 14, y);
      doc.text(String(r.accountNumber || ''), 100, y);
      doc.text((r.net || 0).toFixed(2), 170, y, { align: 'right' });
      y += 6; total += (r.net || 0);
      if (y > 270) { doc.addPage(); y = 20; }
    });
    y += 4; doc.setDrawColor(0); doc.line(14, y, 196, y); y += 6;
    doc.setFont(undefined, 'bold'); doc.text('Total', 14, y);
    doc.text(total.toFixed(2), 170, y, { align: 'right' }); doc.setFont(undefined, 'normal'); y += 8;
    const words = amountToWordsGhana(total);
    const lines = doc.splitTextToSize(`Amount in words: ${words}`, 182);
    doc.text(lines, 14, y);
  });
  doc.save(args.fileName);
}

export interface GeneratePaymentAdviceArgs {
  hotelName: string;
  monthLabel: string;
  bankOrChannel: string;
  rows: Array<{ employeeName: string; accountNumber: string; net: number }>;
  signerName: string;
  signerPosition: string;
  signerSignature?: string;
  companyLogoUrl?: string; // optional http(s) or app-relative path
  bankLogoUrl?: string; // optional http(s) or app-relative path
  orgAddress?: string;
  orgPhone?: string;
  orgEmail?: string;
  orgTaxId?: string;
  /** The payment instruction already filled in for this letter. */
  instruction?: string;
  fileName: string;
}

export async function generatePaymentAdvicePDF(args: GeneratePaymentAdviceArgs) {
  const JSPDF: any = (await import('jspdf')).default;
  const doc: any = new JSPDF();

  // helper to load image as data URL
  const loadImageAsDataUrl = async (url?: string) => {
    try {
      if (!url) return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const imageData = async (url?: string) => {
    if (!url) return null;
    if (url.startsWith('data:image/')) return url;
    return loadImageAsDataUrl(url);
  };
  const companyLogoData = await imageData(args.companyLogoUrl);
  const bankLogoData = await imageData(args.bankLogoUrl);
  const paint = (data: string | null, x: number, yPos: number, w: number, h: number) => {
    if (!data) return;
    try {
      const format = data.includes('image/jpeg') || data.includes('image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(data, format, x, yPos, w, h);
    } catch { /* a missing logo still leaves the letter */ }
  };

  paint(companyLogoData, 14, 10, 22, 22);
  paint(bankLogoData, 174, 12, 22, 14);
  let y = 16;
  doc.setFontSize(14); doc.setFont(undefined, 'bold');
  doc.text(args.hotelName, 105, y, { align: 'center' }); y += 6;
  doc.setFontSize(9); doc.setFont(undefined, 'normal');
  const letterhead = [args.orgAddress, [args.orgPhone ? `Tel. ${args.orgPhone}` : '', args.orgEmail || ''].filter(Boolean).join('  ·  '), args.orgTaxId ? `TIN ${args.orgTaxId}` : ''].filter(Boolean);
  letterhead.forEach((line) => { doc.text(line, 105, y, { align: 'center' }); y += 4.5; });
  y = Math.max(y + 2, 36);
  doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(14, y, 196, y); y += 8;

  const dateLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFontSize(10); doc.text(dateLabel, 196, y, { align: 'right' }); y += 8;
  const addressee = args.bankOrChannel === 'Cash' ? ['The Cashier'] : args.bankOrChannel === 'MoMo' ? ['Mobile Money'] : ['The Manager', args.bankOrChannel];
  addressee.forEach((line) => { doc.text(line, 14, y); y += 5; });
  y += 3;
  doc.text('Dear Sir/Madam,', 14, y); y += 8;
  doc.setFont(undefined, 'bold'); doc.text('SALARY PAYMENT ADVICE', 105, y, { align: 'center' }); y += 8;
  doc.setFont(undefined, 'normal');

  const total = (args.rows || []).reduce((s, r) => s + (r.net || 0), 0);
  const words = amountToWordsGhana(total);
  const payHow = args.bankOrChannel === 'Cash'
    ? `Kindly pay the net salaries of the underlisted staff of ${args.hotelName} in cash for ${args.monthLabel}.`
    : args.bankOrChannel === 'MoMo'
      ? `Kindly pay the net salaries of the underlisted staff of ${args.hotelName} through Mobile Money for ${args.monthLabel}.`
      : `Kindly debit our account and credit the net salaries of the underlisted staff of ${args.hotelName} for ${args.monthLabel}.`;
  const intro = (args.instruction || '').trim()
    || `${payHow} The total amount is GHS ${total.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${words}). Please pay as follows:`;
  const introLines = doc.splitTextToSize(intro, 182);
  doc.text(introLines, 14, y); y += introLines.length * 5 + 6;

  const colX = { no: 14, name: 28, acct: 112, net: 162, end: 196 } as const;
  const accountHeading = args.bankOrChannel === 'Cash' ? 'Reference' : args.bankOrChannel === 'MoMo' ? 'Wallet number' : 'Account number';
  const drawHeader = () => {
    const rowH = 8;
    const headerTop = y;
    doc.setLineWidth(0.2); doc.setDrawColor(0);
    doc.line(colX.no, headerTop, colX.end, headerTop);
    doc.line(colX.no, headerTop + rowH, colX.end, headerTop + rowH);
    [colX.no, colX.name, colX.acct, colX.net, colX.end].forEach((x) => doc.line(x, headerTop, x, headerTop + rowH));
    doc.setFontSize(9); doc.setFont(undefined, 'bold');
    const headerTextY = headerTop + 5.4;
    doc.text('No.', (colX.no + colX.name) / 2, headerTextY, { align: 'center' });
    doc.text('Staff name', colX.name + 2, headerTextY);
    doc.text(accountHeading, colX.acct + 2, headerTextY);
    doc.text('Amount (GHS)', colX.end - 2, headerTextY, { align: 'right' });
    doc.setFont(undefined, 'normal');
    y += rowH;
  };
  drawHeader();

  let grand = 0;
  (args.rows || []).forEach((r, idx) => {
    const nameLines = doc.splitTextToSize(String(r.employeeName || ''), colX.acct - colX.name - 4);
    const acctLines = doc.splitTextToSize(String(r.accountNumber || '—'), colX.net - colX.acct - 4);
    const lineCount = Math.max(nameLines.length, acctLines.length, 1);
    const rowH = Math.max(8, lineCount * 4.2 + 3);
    if (y + rowH > 272) { doc.addPage(); y = 16; drawHeader(); }
    const top = y;
    doc.setLineWidth(0.2);
    [colX.no, colX.name, colX.acct, colX.net, colX.end].forEach((x) => doc.line(x, top, x, top + rowH));
    doc.line(colX.no, top + rowH, colX.end, top + rowH);
    doc.setFontSize(9);
    doc.text(String(idx + 1), (colX.no + colX.name) / 2, top + 5.2, { align: 'center' });
    doc.text(nameLines, colX.name + 2, top + 5.2);
    doc.text(acctLines, colX.acct + 2, top + 5.2);
    doc.text((r.net || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX.end - 2, top + 5.2, { align: 'right' });
    y += rowH;
    grand += (r.net || 0);
  });

  const totalH = 8;
  if (y + totalH > 272) { doc.addPage(); y = 16; }
  doc.setFont(undefined, 'bold');
  [colX.no, colX.name, colX.acct, colX.net, colX.end].forEach((x) => doc.line(x, y, x, y + totalH));
  doc.line(colX.no, y + totalH, colX.end, y + totalH);
  doc.text('Total', colX.name + 2, y + 5.2);
  doc.text(grand.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX.end - 2, y + 5.2, { align: 'right' });
  doc.setFont(undefined, 'normal');
  y += totalH + 8;

  if (y > 250) { doc.addPage(); y = 20; }
  const wordLines = doc.splitTextToSize(`Amount in words: ${words}`, 182);
  doc.text(wordLines, 14, y); y += wordLines.length * 5 + 8;
  doc.text('Counting on your usual cooperation.', 14, y); y += 5;
  doc.text('Yours faithfully,', 14, y); y += 8;

  if (args.signerSignature && args.signerSignature.startsWith('data:image/')) {
    try {
      const format = args.signerSignature.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(args.signerSignature, format, 14, y, 42, 16);
      y += 18;
    } catch { /* a bad image still leaves the name and position */ }
  }
  doc.setFont(undefined, 'bold'); doc.text(args.signerName, 14, y); y += 5;
  doc.setFont(undefined, 'normal'); doc.text(args.signerPosition, 14, y);

  doc.save(args.fileName);
}

export interface GeneratePaymentAdviceTableArgs {
  title?: string; // optional heading
  monthLabel?: string; // optional
  bankOrChannel: string;
  rows: Array<{ employeeName: string; accountNumber: string; net: number }>;
  companyLogoUrl?: string;
  bankLogoUrl?: string;
  fileName: string;
}

export async function generatePaymentAdviceTablePDF(args: GeneratePaymentAdviceTableArgs) {
  const JSPDF: any = (await import('jspdf')).default;
  const doc: any = new JSPDF();
  // optional logos
  const load = async (url?: string) => {
    try {
      if (!url) return null;
      const res = await fetch(url); if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(blob); });
    } catch { return null; }
  };
  const comp = await load(args.companyLogoUrl);
  const bank = await load(args.bankLogoUrl);
  let y = 20;
  if (comp) { try { doc.addImage(comp, 'PNG', 14, 10, 20, 20); } catch {} }
  if (bank) { try { doc.addImage(bank, 'PNG', 176, 10, 20, 20); } catch {} }
  if (comp || bank) { y = 40; }
  if (args.title) { doc.setFontSize(12); doc.text(args.title, 105, y, { align: 'center' }); y += 8; }
  if (args.monthLabel) { doc.setFontSize(10); doc.text(args.monthLabel, 105, y, { align: 'center' }); y += 8; }
  // Printed date (top-right)
  doc.setFontSize(9);
  const printed = new Date().toLocaleString('en-GB');
  doc.text(`Printed: ${printed}`, 196, y - 8, { align: 'right' });
  doc.setFontSize(10);
  // Full borders table (table-only) with No. column
  const colX2 = { no: 14, name: 28, acct: 110, net: 164, end: 196 } as const; // widened net
  const rowH2 = 8;
  doc.setLineWidth(0.2); doc.setDrawColor(0);
  const headerTop2 = y - 5;
  doc.line(colX2.no, headerTop2, colX2.end, headerTop2); // top line
  doc.line(colX2.no, headerTop2 + rowH2, colX2.end, headerTop2 + rowH2); // bottom header line
  doc.line(colX2.no, headerTop2, colX2.no, headerTop2 + rowH2);
  doc.line(colX2.name, headerTop2, colX2.name, headerTop2 + rowH2);
  doc.line(colX2.acct, headerTop2, colX2.acct, headerTop2 + rowH2);
  doc.line(colX2.net, headerTop2, colX2.net, headerTop2 + rowH2);
  doc.line(colX2.end, headerTop2, colX2.end, headerTop2 + rowH2);
  doc.setFont(undefined, 'bold');
  const headerTextY2 = headerTop2 + rowH2 / 2 + 3;
  const noMid2 = (colX2.no + colX2.name) / 2;
  doc.text('No.', noMid2, headerTextY2, { align: 'center' });
  doc.text('Name', colX2.name + 2, headerTextY2);
  doc.text('Account / Wallet', colX2.acct + 2, headerTextY2);
  doc.text('Net (GHS)', colX2.end - 2, headerTextY2, { align: 'right' });
  doc.setFont(undefined, 'normal');
  y += 6;
  (args.rows || []).forEach((r, idx) => {
    if (y > 270) { doc.addPage(); y = 20; }
    const top = y - 5;
    doc.line(colX2.no, top, colX2.no, top + rowH2);
    doc.line(colX2.name, top, colX2.name, top + rowH2);
    doc.line(colX2.acct, top, colX2.acct, top + rowH2);
    doc.line(colX2.net, top, colX2.net, top + rowH2);
    doc.line(colX2.end, top, colX2.end, top + rowH2);
    const yCenter2 = top + rowH2 / 2 + 3;
    const noStr2 = String(idx + 1);
    doc.text(noStr2, noMid2, yCenter2, { align: 'center' });
    doc.text(r.employeeName, colX2.name + 2, yCenter2);
    doc.text(String(r.accountNumber || ''), colX2.acct + 2, yCenter2);
    doc.text((r.net || 0).toFixed(2), colX2.end - 2, yCenter2, { align: 'right' });
    doc.line(colX2.no, top + rowH2, colX2.end, top + rowH2);
    y += 6;
  });
  doc.save(args.fileName);
}


