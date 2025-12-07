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

export interface PayslipRow {
  label: string;
  value: string;
}

export interface PayslipInput {
  hotelName: string;
  monthLabel: string;
  employeeName: string;
  ssn?: string;
  position?: string;
  rows: PayslipRow[]; // left label / right amount
}

export interface GeneratePayslipsArgs {
  slips: PayslipInput[];
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

export async function generatePayslipsPDF(args: GeneratePayslipsArgs) {
  const JSPDF: any = (await import('jspdf')).default;
  const doc: any = new JSPDF();
  let firstPage = true;
  args.slips.forEach((s) => {
    if (!firstPage) doc.addPage();
    firstPage = false;
    let y = 20; doc.setFontSize(14); doc.text(s.hotelName, 105, y, { align: 'center' }); y += 8;
    doc.setFontSize(11); doc.text('Employee Salary Advice', 105, y, { align: 'center' }); y += 6;
    doc.text(s.monthLabel, 105, y, { align: 'center' }); y += 10;
    doc.setFontSize(10);
    doc.text(`Name: ${s.employeeName}`, 14, y); y += 6;
    if (s.ssn) { doc.text(`SS No.: ${s.ssn}`, 14, y); y += 6; }
    if (s.position) { doc.text(`Position: ${s.position}`, 14, y); y += 10; }
    s.rows.forEach((row) => { doc.text(row.label, 14, y); doc.text(row.value, 196, y, { align: 'right' }); y += 8; });
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
  companyLogoUrl?: string; // optional http(s) or app-relative path
  bankLogoUrl?: string; // optional http(s) or app-relative path
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

  const companyLogoData = await loadImageAsDataUrl(args.companyLogoUrl);
  const bankLogoData = await loadImageAsDataUrl(args.bankLogoUrl);

  let y = 20;
  // draw logos if available
  if (companyLogoData) { try { doc.addImage(companyLogoData, 'PNG', 14, 10, 20, 20); } catch {} }
  if (bankLogoData) { try { doc.addImage(bankLogoData, 'PNG', 176, 10, 20, 20); } catch {} }
  if (companyLogoData || bankLogoData) { y = 40; }
  doc.setFontSize(14); doc.text(args.hotelName, 105, y, { align: 'center' }); y += 8;
  doc.setFontSize(11); doc.text(`Salary Payment Advice - ${args.bankOrChannel}`, 105, y, { align: 'center' }); y += 6;
  doc.text(args.monthLabel, 105, y, { align: 'center' }); y += 10;

  // Letter intro
  doc.setFontSize(10);
  const total = (args.rows || []).reduce((s, r) => s + (r.net || 0), 0);
  const words = amountToWordsGhana(total);
  const intro = `Please pay the underlisted staff of ${args.hotelName} their net salaries via ${args.bankOrChannel} for ${args.monthLabel}. The total amount is GHS ${total.toFixed(2)} (${words}).`;
  const introLines = doc.splitTextToSize(intro, 182);
  doc.text(introLines, 14, y); y += introLines.length * 6 + 6;

  // Table with full borders (verticals + top/bottom lines) including No. column
  const colX = { no: 14, name: 28, acct: 110, net: 164, end: 196 } as const;
  const rowH = 8;
  doc.setLineWidth(0.2); doc.setDrawColor(0);
  // Header box lines
  const headerTop = y - 5;
  doc.line(colX.no, headerTop, colX.end, headerTop); // top line over headings
  doc.line(colX.no, headerTop + rowH, colX.end, headerTop + rowH); // bottom of header
  // verticals for header
  doc.line(colX.no, headerTop, colX.no, headerTop + rowH);
  doc.line(colX.name, headerTop, colX.name, headerTop + rowH);
  doc.line(colX.acct, headerTop, colX.acct, headerTop + rowH);
  doc.line(colX.net, headerTop, colX.net, headerTop + rowH);
  doc.line(colX.end, headerTop, colX.end, headerTop + rowH);
  // Header text
  doc.setFont(undefined, 'bold');
  const headerTextY = headerTop + rowH / 2 + 3;
  // Center No., left-align Name/Account, right-align Net
  const noMid = (colX.no + colX.name) / 2;
  doc.text('No.', noMid, headerTextY, { align: 'center' });
  doc.text('Name', colX.name + 2, headerTextY);
  doc.text('Account / Wallet', colX.acct + 2, headerTextY);
  doc.text('Net Salary (GHS)', colX.end - 2, headerTextY, { align: 'right' });
  doc.setFont(undefined, 'normal');
  y += 6;
  let pageTotal = 0;
  (args.rows || []).forEach((r, idx) => {
    if (y > 270) { doc.addPage(); y = 20; }
    const top = y - 5;
    // verticals per row
    doc.line(colX.no, top, colX.no, top + rowH);
    doc.line(colX.name, top, colX.name, top + rowH);
    doc.line(colX.acct, top, colX.acct, top + rowH);
    doc.line(colX.net, top, colX.net, top + rowH);
    doc.line(colX.end, top, colX.end, top + rowH);
    // row text: left-align first two, right-align numeric; vertically centered
    const yCenter = top + rowH / 2 + 3;
    const noStr = String(idx + 1);
    doc.text(noStr, noMid, yCenter, { align: 'center' });
    doc.text(r.employeeName, colX.name + 2, yCenter);
    doc.text(String(r.accountNumber || ''), colX.acct + 2, yCenter);
    doc.text((r.net || 0).toFixed(2), colX.end - 2, yCenter, { align: 'right' });
    // bottom line for the row
    doc.line(colX.no, top + rowH, colX.end, top + rowH);
    y += 6; pageTotal += (r.net || 0);
  });
  y += 4; doc.setDrawColor(0); doc.line(14, y, 196, y); y += 6;
  doc.setFont(undefined, 'bold'); doc.text('Total', 14, y);
  doc.text(pageTotal.toFixed(2), 170, y, { align: 'right' });
  doc.setFont(undefined, 'normal'); y += 12;

  // Closing & signature
  const closing = 'Counting on your usual cooperation';
  const closingLines = doc.splitTextToSize(closing, 182);
  doc.text(closingLines, 14, y); y += closingLines.length * 6 + 12;

  doc.text('Signed:', 14, y); y += 8;
  doc.text(args.signerName, 14, y); y += 6;
  doc.text(args.signerPosition, 14, y); y += 6;
  const printed = new Date().toLocaleDateString('en-GB');
  doc.text(`Date: ${printed}`, 14, y);

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


