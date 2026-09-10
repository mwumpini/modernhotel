import type { PrintType } from './templates';

/**
 * No-code document template builder — block schema.
 *
 * A template stores LAYOUT ONLY (which blocks appear, in what order, with what
 * labels/columns, plus overall styling). It never stores data — every block reads
 * from the `PrintData` payload handed to the renderer at print time. This mirrors
 * how the legacy hand-written templates in templates.ts already separate `PrintData`
 * (data) from the render functions (presentation) — see blockRenderer.ts.
 */
export type BlockType =
  | 'logo'
  // Legacy bundled blocks — still fully supported so an already-saved custom
  // template keeps rendering exactly as before, but no longer offered when
  // adding a new block (see BlockEditor's ADDABLE_BLOCK_TYPES). New templates
  // use the granular blocks below instead.
  | 'company-info'
  | 'doc-meta'
  | 'recipient-info'
  | 'totals-summary'
  // Granular — each is one standalone, independently orderable/styleable line.
  | 'doc-title'
  | 'doc-number'
  | 'doc-date'
  | 'company-name'
  | 'company-address'
  | 'company-contact'
  | 'guest-details'
  | 'stay-details'
  | 'totals-subtotal'
  | 'totals-taxes'
  | 'totals-payments'
  | 'totals-balance'
  | 'totals-grandtotal'
  | 'line-items-table'
  | 'matrix-table'
  | 'schedule-table'
  | 'notes-text'
  | 'signature-block'
  | 'bank-details'
  | 'custom-text'
  | 'terms-conditions'
  // Payslip-only — an employee's earnings/deductions are genuinely two parallel
  // lists (not one items list, and not debit/credit pairs), so each gets its own
  // granular block rather than overloading line-items-table with a data-source
  // switch. Paired side-by-side via columnSpan:'half' for the classic two-column
  // payslip layout, or stacked full-width for a single-column one.
  | 'employee-details'
  | 'payslip-earnings-table'
  | 'payslip-deductions-table'
  | 'payslip-summary'
  // Structural — holds other blocks (including other containers, for arbitrary
  // nesting depth) laid out as a row or column, independent of the top-level
  // "Share a row" pairing. See BlockConfig.children/direction/gap.
  | 'container';

export interface BlockConfig {
  id: string;
  type: BlockType;
  visible: boolean;
  order: number;
  /** Relabel a block's default heading, e.g. "Guest / Client" -> "Bill To" / "Payee".
   *  An explicit empty string suppresses the heading line entirely (guest-details only). */
  heading?: string;
  /** line-items-table: which optional columns to show alongside description + amount. */
  columns?: Array<'qty' | 'unit' | 'unitPrice' | 'date'>;
  /** line-items-table: 'table' (default, grid with columns) or 'list' — each item as a
   *  plain text line with a dotted leader to the amount, e.g. "Room x 2 nights .... ₵500".
   *  'simple' drops both the table grid and the leader dots — just "Description" left,
   *  amount right, on one plain line (matches a manually-typed bill format). */
  lineItemsDisplay?: 'table' | 'list' | 'simple';
  /** stay-details: 'lines' (default) — "Room: X • Type: Y" / "Arrival: … • Departure: … •
   *  Nights: N" as two stacked lines. 'grid' — a 2-column x 3-row grid inside the box:
   *  Room No / Room Type / Nights on the left, Room Rate / Arrival / Departure on the right. */
  stayDetailsDisplay?: 'lines' | 'grid';
  /** signature-block: 'box' (default) — bordered card, label centered below the line.
   *  'line' — plain "Label: __________" underline blank, left-aligned, laid out side by
   *  side (no box) — matches a hand-signed paper form. */
  signatureDisplay?: 'box' | 'line';
  /** payslip-earnings-table / payslip-deductions-table: 'table' (default) — bordered
   *  grid. 'list' — each line as a plain "Description .... Amount" row with a dotted
   *  leader, no table borders — for a minimal, memo-style payslip. */
  payslipItemsDisplay?: 'table' | 'list';
  /** totals-summary: 'table' (default), 'numbered-list' — "(i) Tax Exclusive Value",
   *  "(ii) VAT", … — or 'compact-taxes' — just 3 lines: Taxes Exclusive, all taxes
   *  combined into one "Sales Taxes Incl." line, Total Taxes Inclusive. Matches how
   *  different Ghanaian hotels format their tax breakdown at varying detail levels. */
  totalsDisplay?: 'table' | 'numbered-list' | 'compact-taxes';
  /** totals-summary / payslip-summary: append "Ghana Cedis Five Hundred only" under
   *  the grand total / net pay. */
  showAmountInWords?: boolean;
  /** signature-block: one box per entry. */
  signatures?: Array<{ label: string; role?: string }>;
  /** custom-text / notes-text static content. */
  text?: string;
  /** recipient-info: 'box' (default) is the bordered Guest/Client card; 'letter'
   *  drops the box and appends "Dear Sir/Madam," — for a cover-letter-style invoice. */
  recipientDisplay?: 'box' | 'letter';
  /** doc-meta: relabel the document-number badge, e.g. "CheckOut No." instead of "No." */
  docNumberLabel?: string;
  /** terms-conditions: named sections, each rendered as a bold heading + paragraph. */
  termsSections?: Array<{ heading: string; body: string }>;
  /** Horizontal text alignment — applies to any block, not just text ones. */
  align?: 'left' | 'center' | 'right';
  /** Push this block's content inward from the left edge, like Word's Increase/
   *  Decrease Indent — independent of Alignment, which repositions the whole line
   *  rather than nudging its starting point (useful for nesting, e.g. a sub-line
   *  under a heading). */
  indent?: 'none' | 'small' | 'medium' | 'large';
  /** Body blocks only: 'half' pairs this block side-by-side with the next 'half'
   *  block (e.g. Recipient Info left, Bank Details right); 'full' (default) stacks. */
  columnSpan?: 'full' | 'half';
  /** Box border around this block — 'none' (default for most blocks) shows no box;
   *  'thin'/'thick' draws one. recipient-info/bank-details use this for their own
   *  built-in box instead (see wrapBlock in blockRenderer.ts). */
  border?: 'none' | 'thin' | 'thick';
  /** Underline this block's content — the "format a single line" control, independent of border. */
  underline?: boolean;
  /** Draw a horizontal rule below this block — e.g. separating a header group
   *  (logo/company info) from the rest of the document. Independent of border
   *  (which boxes all 4 sides) and underline (which underlines the text itself). */
  dividerBelow?: boolean;
  /** Extra space above this block, beyond its normal gap from the block before it —
   *  'none' collapses it flush against the previous block. Unset = default spacing. */
  spacing?: 'none' | 'small' | 'medium' | 'large';
  style?: { fontSize?: 'sm' | 'md' | 'lg'; bold?: boolean };
  /** container only: the blocks laid out inside it — each a full BlockConfig,
   *  so a container can itself hold another container (arbitrary nesting). */
  children?: BlockConfig[];
  /** container only: 'row' (default) lays children side-by-side, 'column' stacks
   *  them — independent of the top-level columnSpan:'half' pairing above, which
   *  containers supersede for anything more complex than a simple 1:1 pair. */
  direction?: 'row' | 'column';
  /** container only: gap between children — same scale as spacing/indent. */
  gap?: 'none' | 'small' | 'medium' | 'large';
  /** Relative width when this block is a direct child of a 'row' container —
   *  e.g. 2 next to a sibling's 1 splits roughly 67/33 instead of the default
   *  even split. 0 means "size to content, don't stretch" (e.g. a logo image
   *  next to a text column that should take the remaining space). Ignored
   *  everywhere else, including columnSpan pairs. */
  flexWeight?: 0 | 1 | 2 | 3;
}

export interface TemplateStyle {
  primaryColor: string;
  textColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  /** Base body text size — per-block `style.fontSize` overrides this for that block. */
  bodyFontSize: 'sm' | 'md' | 'lg';
  logoPosition: 'left' | 'center' | 'right';
  logoSize: 'sm' | 'md' | 'lg';
  pageMargin: 'compact' | 'normal' | 'spacious';
  borderColor: string;
  borderWidth: 'thin' | 'thick';
  showWatermark?: boolean;
  watermarkText?: string;
}

export interface BlockTemplate {
  /** 'builtin-<type>-<slug>' for shipped defaults, 'custom-<nanoid>' for tenant-created. */
  id: string;
  docType: PrintType;
  name: string;
  isBuiltIn: boolean;
  blocks: BlockConfig[];
  style: TemplateStyle;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_TEMPLATE_STYLE: TemplateStyle = {
  primaryColor: '#222222',
  textColor: '#111111',
  fontFamily: 'sans',
  bodyFontSize: 'md',
  logoPosition: 'left',
  logoSize: 'md',
  pageMargin: 'normal',
  borderColor: '#dddddd',
  borderWidth: 'thin',
  showWatermark: false,
};
