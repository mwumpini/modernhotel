import type { BlockConfig } from '../print/blocks';
import type { PrintData } from '../print/templates';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IBorderOptions,
} from 'docx';

export type ContractHotel = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
};

export type ContractModel = {
  hotel: ContractHotel;
  organization: string;
  contactName: string;
  phone: string;
  email: string;
  periodStart: string;
  periodEnd: string;
  eventName: string;
  venueName: string;
  venueCapacity: number;
  expectedPax: number;
  residential: boolean | null;
  rates: { accommodation: number; conference: number; catering: number };
  specialTerms: string;
  terms: Array<{ title: string; text: string }>;
  generatedOn: string;
};

export type ContractView = {
  hotelName: string;
  hotelLine: string;
  period: string;
  organization: string;
  parties: Array<{ label: string; value: string }>;
  event: Array<{ label: string; value: string }>;
  rates: Array<{ service: string; rate: string; unit: string }>;
  specialTerms: string;
  terms: Array<{ title: string; text: string }>;
  generatedOn: string;
};

const hairline: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' };
const rule: IBorderOptions = { style: BorderStyle.SINGLE, size: 8, color: '111827' };
const clear: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatContractDate(value?: string): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatContractPeriod(start?: string, end?: string): string {
  const from = formatContractDate(start);
  const to = formatContractDate(end);
  if (from && to && from !== to) return `${from} to ${to}`;
  return from || to || '';
}

export function formatContractMoney(value: number): string {
  return `₵${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildContractModel(client: any, eventInfo: any, hotel: ContractHotel, terms: Array<{ title: string; text: string }> = []): ContractModel {
  const organization = String(client?.organization || eventInfo?.organization || client?.name || '').trim();
  const rawName = String(client?.name || '').trim();
  const contactName = rawName && rawName !== organization ? rawName : '';
  const special = String(client?.specialTerms || '').trim();
  const generatedNote = /^Contract generated from event\b/i.test(special);
  return {
    hotel: {
      name: hotel?.name?.trim() || 'Hotel',
      address: hotel?.address || '',
      phone: hotel?.phone || '',
      email: hotel?.email || '',
    },
    organization,
    contactName,
    phone: String(client?.contact || eventInfo?.contactPhone || '').trim(),
    email: String(client?.email || eventInfo?.contactEmail || '').trim(),
    periodStart: String(client?.contractStart || eventInfo?.startDate || ''),
    periodEnd: String(client?.contractEnd || eventInfo?.endDate || ''),
    eventName: String(eventInfo?.eventName || '').trim(),
    venueName: String(eventInfo?.venueName || '').trim(),
    venueCapacity: Number(eventInfo?.venueCapacity || 0),
    expectedPax: Number(eventInfo?.expectedPax || 0),
    residential: typeof eventInfo?.isResidential === 'boolean' ? eventInfo.isResidential : null,
    rates: {
      accommodation: Number(client?.rates?.accommodation || 0),
      conference: Number(client?.rates?.conference || 0),
      catering: Number(client?.rates?.catering || 0),
    },
    specialTerms: generatedNote ? '' : special,
    terms: terms.filter((term) => term.title.trim() || term.text.trim()),
    generatedOn: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

function fillHotelName(text: string, hotelName: string): string {
  const name = hotelName.trim() || 'Hotel';
  return text.split('{{org.name}}').join(name).split('{hotel}').join(name);
}

function collectTerms(blocks: BlockConfig[] | undefined, out: Array<{ heading: string; body: string }>) {
  for (const block of blocks || []) {
    if (block.type === 'terms-conditions') {
      for (const section of block.termsSections || []) out.push(section);
    }
    if (block.children?.length) collectTerms(block.children, out);
  }
}

/** The terms written on a contract template, with the hotel name filled in. */
export function contractTermsFromBlocks(blocks: BlockConfig[] | undefined, hotelName: string): Array<{ title: string; text: string }> {
  const found: Array<{ heading: string; body: string }> = [];
  collectTerms(blocks, found);
  return found
    .map((section) => ({
      title: fillHotelName(section.heading || '', hotelName).trim(),
      text: fillHotelName(section.body || '', hotelName).trim(),
    }))
    .filter((term) => term.title || term.text);
}

/** Facts the contract templates print: the client, the event, and the rates. */
export function buildContractPrintData(client: any, eventInfo: any, hotel: ContractHotel): PrintData {
  const model = buildContractModel(client, eventInfo, hotel);
  const venue = model.venueName
    ? model.venueCapacity > 0 ? `${model.venueName} (${model.venueCapacity} seats)` : model.venueName
    : '';
  const summary = [
    model.eventName,
    formatContractPeriod(model.periodStart, model.periodEnd),
    venue,
    model.expectedPax > 0 ? `${model.expectedPax} guests` : '',
    model.residential === null ? '' : model.residential ? 'Rooms included' : 'Day event',
  ].filter(Boolean).join('\n');
  const contact = [model.phone, model.email].filter(Boolean).join('\n');
  return {
    org: {
      name: model.hotel.name,
      address: model.hotel.address,
      phone: model.hotel.phone,
      email: model.hotel.email,
    },
    guest: {
      name: model.contactName || model.organization,
      company: model.organization,
      address: contact,
    },
    docDate: new Date().toISOString(),
    title: 'Event Services Contract',
    items: [
      { description: 'Accommodation', unit: 'per night', unitPrice: model.rates.accommodation, amount: model.rates.accommodation },
      { description: 'Conference', unit: 'per person', unitPrice: model.rates.conference, amount: model.rates.conference },
      { description: 'Catering', unit: 'per person', unitPrice: model.rates.catering, amount: model.rates.catering },
    ],
    totals: { subTotal: 0, grandTotal: 0 },
    event: { summary },
    currency: '₵',
  };
}

export function contractView(model: ContractModel): ContractView {
  const parties = [
    model.organization ? { label: 'Organization', value: model.organization } : null,
    model.contactName ? { label: 'Contact', value: model.contactName } : null,
    model.phone ? { label: 'Phone', value: model.phone } : null,
    model.email ? { label: 'Email', value: model.email } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  const venue = model.venueName
    ? model.venueCapacity > 0
      ? `${model.venueName} (${model.venueCapacity} seats)`
      : model.venueName
    : '';
  const event = [
    model.eventName ? { label: 'Event', value: model.eventName } : null,
    formatContractPeriod(model.periodStart, model.periodEnd)
      ? { label: 'Dates', value: formatContractPeriod(model.periodStart, model.periodEnd) }
      : null,
    venue ? { label: 'Venue', value: venue } : null,
    model.expectedPax > 0 ? { label: 'Guests', value: String(model.expectedPax) } : null,
    model.residential === null ? null : { label: 'Stay', value: model.residential ? 'Rooms included' : 'Day event' },
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  return {
    hotelName: model.hotel.name,
    hotelLine: [model.hotel.address, model.hotel.phone, model.hotel.email].filter(Boolean).join('  ·  '),
    period: formatContractPeriod(model.periodStart, model.periodEnd),
    organization: model.organization || 'the client',
    parties,
    event,
    rates: [
      { service: 'Accommodation', rate: formatContractMoney(model.rates.accommodation), unit: 'per night' },
      { service: 'Conference', rate: formatContractMoney(model.rates.conference), unit: 'per person' },
      { service: 'Catering', rate: formatContractMoney(model.rates.catering), unit: 'per person' },
    ],
    specialTerms: model.specialTerms,
    terms: model.terms,
    generatedOn: model.generatedOn,
  };
}

export function renderContractHtml(model: ContractModel): string {
  const view = contractView(model);
  const rows = (items: Array<{ label: string; value: string }>) =>
    items.map((row) => `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`).join('');
  const rateRows = view.rates
    .map((row) => `<tr><td>${escapeHtml(row.service)}</td><td>${escapeHtml(row.rate)}</td><td>${escapeHtml(row.unit)}</td></tr>`)
    .join('');
  const terms = view.terms
    .map((term) => `<li><strong>${escapeHtml(term.title)}.</strong> ${escapeHtml(term.text)}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Event Services Contract - ${escapeHtml(view.organization)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #111827; margin: 48px; line-height: 1.5; }
    header { text-align: center; }
    .hotel { letter-spacing: 0.18em; text-transform: uppercase; font-size: 12px; color: #4b5563; margin: 0; }
    .hotel-line { font-size: 12px; color: #6b7280; margin: 6px 0 0; }
    h1 { font-size: 26px; font-weight: 600; margin: 22px 0 8px; }
    .between, .period { margin: 0; font-size: 14px; }
    .period { color: #4b5563; margin-top: 4px; }
    h2 { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 1px solid #111827; padding-bottom: 4px; margin: 32px 0 8px; }
    .pair { width: 100%; margin-top: 28px; border-collapse: separate; }
    .pair > tbody > tr > td.col { width: 50%; vertical-align: top; border: 0; padding: 0; }
    .pair > tbody > tr > td.col + td.col { padding-left: 28px; }
    .pair h2 { margin-top: 0; }
    .pair .facts th { width: 88px; padding-right: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .facts th { width: 150px; text-align: left; font-weight: normal; color: #4b5563; padding: 7px 12px 7px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .facts td { padding: 7px 0; border-bottom: 1px solid #e5e7eb; }
    .rates th { text-align: left; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #4b5563; border-bottom: 1px solid #111827; padding: 6px 8px; }
    .rates td { border-bottom: 1px solid #e5e7eb; padding: 8px; }
    ol { margin: 8px 0 0; padding-left: 18px; }
    li { margin: 6px 0; }
    .signs { width: 100%; margin-top: 36px; }
    .signs td { width: 50%; vertical-align: top; padding-right: 28px; border: 0; }
    .line { border-bottom: 1px solid #111827; height: 42px; margin-top: 18px; }
    .hint { font-size: 12px; color: #6b7280; margin: 4px 0 0; }
    .foot { margin-top: 36px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <header>
    <p class="hotel">${escapeHtml(view.hotelName)}</p>
    ${view.hotelLine ? `<p class="hotel-line">${escapeHtml(view.hotelLine)}</p>` : ''}
    <h1>Event Services Contract</h1>
    <p class="between">Between ${escapeHtml(view.hotelName)} and ${escapeHtml(view.organization)}</p>
    ${view.period ? `<p class="period">${escapeHtml(view.period)}</p>` : ''}
  </header>
  ${(view.parties.length && view.event.length) ? `<table class="pair"><tr><td class="col"><h2>Parties</h2><table class="facts">${rows(view.parties)}</table></td><td class="col"><h2>Event</h2><table class="facts">${rows(view.event)}</table></td></tr></table>` : `${view.parties.length ? `<h2>Parties</h2><table class="facts">${rows(view.parties)}</table>` : ''}${view.event.length ? `<h2>Event</h2><table class="facts">${rows(view.event)}</table>` : ''}`}
  <h2>Rates</h2>
  <table class="rates">
    <thead><tr><th>Service</th><th>Rate</th><th>Charged</th></tr></thead>
    <tbody>${rateRows}</tbody>
  </table>
  ${view.specialTerms ? `<h2>Special terms</h2><p>${escapeHtml(view.specialTerms)}</p>` : ''}
  ${view.terms.length ? `<h2>Terms</h2><ol>${terms}</ol>` : ''}
  <table class="signs">
    <tr>
      <td>
        <strong>Client</strong>
        <div class="line"></div>
        <p class="hint">Signature</p>
        <div class="line"></div>
        <p class="hint">Name and date</p>
      </td>
      <td>
        <strong>For ${escapeHtml(view.hotelName)}</strong>
        <div class="line"></div>
        <p class="hint">Signature</p>
        <div class="line"></div>
        <p class="hint">Name and date</p>
      </td>
    </tr>
  </table>
  <p class="foot">Prepared ${escapeHtml(view.generatedOn)}</p>
</body>
</html>`;
}

function run(text: string, options: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text,
    bold: options.bold,
    italics: options.italics,
    size: options.size ?? 22,
    color: options.color,
    font: 'Times New Roman',
  });
}

function paragraph(text: string, options: { bold?: boolean; italics?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) {
  return new Paragraph({
    alignment: options.align,
    spacing: { before: options.before ?? 0, after: options.after ?? 80 },
    children: [run(text, options)],
  });
}

function sectionTitle(text: string, before = 360) {
  return new Paragraph({
    spacing: { before, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '111827', space: 1 } },
    children: [run(text.toUpperCase(), { bold: true, size: 20 })],
  });
}

function factsTable(rows: Array<{ label: string; value: string }>, labelWidth = 28) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row) => new TableRow({
      children: [
        new TableCell({
          width: { size: labelWidth, type: WidthType.PERCENTAGE },
          borders: { top: clear, bottom: hairline, left: clear, right: clear },
          children: [paragraph(row.label, { italics: true, color: '4B5563', after: 40 })],
        }),
        new TableCell({
          width: { size: 100 - labelWidth, type: WidthType.PERCENTAGE },
          borders: { top: clear, bottom: hairline, left: clear, right: clear },
          children: [paragraph(row.value, { after: 40 })],
        }),
      ],
    })),
  });
}

export function buildContractDocument(model: ContractModel) {
  const view = contractView(model);
  const children: Array<Paragraph | Table> = [
    paragraph(view.hotelName.toUpperCase(), { bold: true, size: 18, color: '4B5563', align: AlignmentType.CENTER, after: 60 }),
  ];
  if (view.hotelLine) {
    children.push(paragraph(view.hotelLine, { size: 18, color: '6B7280', align: AlignmentType.CENTER, after: 200 }));
  }
  children.push(
    paragraph('Event Services Contract', { bold: true, size: 36, align: AlignmentType.CENTER, before: 200, after: 80 }),
    paragraph(`Between ${view.hotelName} and ${view.organization}`, { align: AlignmentType.CENTER, after: 40 }),
  );
  if (view.period) children.push(paragraph(view.period, { color: '4B5563', align: AlignmentType.CENTER, after: 120 }));
  if (view.parties.length && view.event.length) {
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [
          [
            sectionTitle('Parties', 280),
            factsTable(view.parties, 42),
          ],
          [
            sectionTitle('Event', 280),
            factsTable(view.event, 34),
          ],
        ].map((content, index) => new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: { top: clear, bottom: clear, left: clear, right: clear },
          margins: index === 0 ? { right: 180 } : { left: 180 },
          children: content,
        })),
      })],
    }));
  } else {
    if (view.parties.length) children.push(sectionTitle('Parties'), factsTable(view.parties));
    if (view.event.length) children.push(sectionTitle('Event'), factsTable(view.event));
  }
  children.push(
    sectionTitle('Rates'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ['Service', 'Rate', 'Charged'].map((heading) => new TableCell({
            borders: { top: clear, bottom: rule, left: clear, right: clear },
            children: [paragraph(heading.toUpperCase(), { bold: true, size: 18, color: '4B5563', after: 40 })],
          })),
        }),
        ...view.rates.map((row) => new TableRow({
          children: [row.service, row.rate, row.unit].map((value) => new TableCell({
            borders: { top: clear, bottom: hairline, left: clear, right: clear },
            children: [paragraph(value, { after: 40 })],
          })),
        })),
      ],
    }),
  );
  if (view.specialTerms) {
    children.push(sectionTitle('Special terms'), paragraph(view.specialTerms, { after: 80 }));
  }
  if (view.terms.length) {
    children.push(sectionTitle('Terms'));
    view.terms.forEach((term, index) => {
      const line = term.title && term.text ? `${term.title}. ${term.text}` : (term.title || term.text);
      children.push(paragraph(`${index + 1}. ${line}`, { after: 60 }));
    });
  }
  children.push(
    new Paragraph({ spacing: { before: 400 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ['Client', `For ${view.hotelName}`].map((title) => new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: { top: clear, bottom: clear, left: clear, right: clear },
            margins: { right: 200 },
            children: [
              paragraph(title, { bold: true, after: 60 }),
              new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '111827', space: 1 } }, spacing: { before: 300 } }),
              paragraph('Signature', { size: 18, color: '6B7280', after: 40 }),
              new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D1D5DB', space: 1 } }, spacing: { before: 280 } }),
              paragraph('Name and date', { size: 18, color: '6B7280', after: 40 }),
            ],
          })),
        }),
      ],
    }),
    paragraph(`Prepared ${view.generatedOn}`, { size: 18, color: '9CA3AF', before: 360 }),
  );

  return new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1008, bottom: 1008, left: 1080, right: 1080 } },
      },
      children,
    }],
  });
}

export async function downloadContractDocx(model: ContractModel) {
  const blob = await Packer.toBlob(buildContractDocument(model));
  const slug = (model.organization || model.eventName || 'event')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-') || 'event';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Event-Contract-${slug}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
