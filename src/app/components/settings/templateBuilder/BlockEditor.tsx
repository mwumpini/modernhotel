'use client';

import React, { useRef, useState } from 'react';
import { Button, Input, Switch, Textarea } from '@heroui/react';
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, GripVertical, Plus, Search, Trash2 } from 'lucide-react';
import type { BlockConfig, BlockTemplate, BlockType, TemplateStyle } from '../../../lib/print/blocks';
import type { PrintData } from '../../../lib/print/templates';
import { SELF_BORDERED_TYPES } from '../../../lib/print/blockRenderer';
import TemplatePreview from './TemplatePreview';

const BLOCK_LABELS: Record<BlockType, string> = {
  'logo': 'Logo',
  'company-info': 'Company Info (legacy — bundled)',
  'doc-meta': 'Document Title / Number / Date (legacy — bundled)',
  'recipient-info': 'Guest / Client Info (legacy — bundled)',
  'totals-summary': 'Totals Summary (legacy — bundled)',
  'doc-title': 'Document Title',
  'doc-number': 'Document Number',
  'doc-date': 'Document Date',
  'company-name': 'Company Name',
  'company-address': 'Company Address',
  'company-contact': 'Company Contact (phone / email / TIN)',
  'guest-details': 'Guest Details',
  'stay-details': 'Stay Details',
  'totals-subtotal': 'Subtotal',
  'totals-taxes': 'Taxes (NHIL, VAT, Tourism Levy, …)',
  'totals-payments': 'Payments',
  'totals-balance': 'Balance',
  'totals-grandtotal': 'Grand Total',
  'line-items-table': 'Line Items Table',
  'matrix-table': 'Matrix Table (dates as columns)',
  'schedule-table': 'Schedule Table (dates as rows)',
  'notes-text': 'Notes / Footer Text',
  'signature-block': 'Signature Block',
  'bank-details': 'Bank / Payment Details',
  'custom-text': 'Custom Text',
  'terms-conditions': 'Terms & Conditions',
  'container': 'Layout',
  'employee-details': 'Employee Details',
  'payslip-earnings-table': 'Earnings Table',
  'payslip-deductions-table': 'Deductions Table',
  'payslip-summary': 'Pay Summary (Net Pay)',
};

/** Shown on the field row and on add-chips. The long label stays in the tooltip. */
function shortLabel(type: BlockType): string {
  return BLOCK_LABELS[type].replace(/ \(.*\)/, '');
}

const BLOCK_ZONE: Record<BlockType, 'header' | 'body' | 'footer'> = {
  'logo': 'header', 'company-info': 'header', 'doc-meta': 'header',
  'company-name': 'header', 'company-address': 'header', 'company-contact': 'header',
  'doc-title': 'header', 'doc-number': 'header', 'doc-date': 'header',
  'recipient-info': 'body', 'guest-details': 'body', 'stay-details': 'body',
  'line-items-table': 'body', 'matrix-table': 'body', 'schedule-table': 'body',
  'totals-summary': 'body', 'totals-subtotal': 'body', 'totals-taxes': 'body',
  'totals-payments': 'body', 'totals-balance': 'body', 'totals-grandtotal': 'body',
  'notes-text': 'footer', 'signature-block': 'footer', 'bank-details': 'footer',
  'custom-text': 'footer', 'terms-conditions': 'footer',
  'container': 'body',
  'employee-details': 'body', 'payslip-earnings-table': 'body', 'payslip-deductions-table': 'body', 'payslip-summary': 'body',
};
const ZONE_LABELS: Record<'header' | 'body' | 'footer', string> = { header: 'Header', body: 'Body', footer: 'Footer' };

const ADDABLE_BLOCK_TYPES: BlockType[] = (Object.keys(BLOCK_LABELS) as BlockType[])
  .filter(t => !(['company-info', 'doc-meta', 'recipient-info', 'totals-summary'] as BlockType[]).includes(t));

const REPEATABLE_BLOCK_TYPES: BlockType[] = ['container', 'custom-text'];

const HEADER_TYPES: BlockType[] = ['company-info', 'doc-meta'];

/** Blocks whose printed heading follows `block.heading`. Placeholder is the default. */
const LABELABLE: Partial<Record<BlockType, string>> = {
  'recipient-info': 'Guest / Client',
  'guest-details': 'Guest / Client',
  'stay-details': 'Stay Details',
  'bank-details': 'Payment Details',
  'employee-details': 'Employee',
  'payslip-earnings-table': 'Earnings',
  'payslip-deductions-table': 'Deductions',
  'payslip-summary': 'Net Pay',
  'doc-date': 'Date:',
  'doc-title': 'Document title',
  'totals-payments': 'Payments',
  'totals-grandtotal': 'Grand Total',
  'totals-balance': 'Balance',
};

const DATA_HINT: Partial<Record<BlockType, string>> = {
  'logo': 'Prints the logo from company settings.',
  'company-name': 'Prints the company name from settings.',
  'company-address': 'Prints the address from company settings.',
  'company-contact': 'Prints phone, email, and TIN from company settings.',
  'doc-title': 'Prints this document’s own title, such as Invoice or Receipt. Type a label to replace it, for example CHECK OUT BILL.',
  'doc-number': 'Prints the document number. Change the label to Ref, Quote No., and so on.',
  'doc-date': 'Prints the document date. The label is optional — “Date:” is typical on a letter.',
  'guest-details': 'Prints the guest or client on the document. Clear the label to hide the heading.',
  'stay-details': 'Prints room, dates, and nights when the document has a stay.',
  'employee-details': 'Prints the employee on a payslip.',
  'line-items-table': 'Prints the document’s lines. Payment vouchers use a debit/credit table on their own.',
  'matrix-table': 'Prints a day-by-day grid when the document has a daily schedule. Otherwise it stays blank.',
  'schedule-table': 'Prints dates as rows under each line. Otherwise it stays blank.',
  'totals-subtotal': 'Prints the pre-tax lines from the document.',
  'totals-taxes': 'Prints each tax line (NHIL, VAT, levies) from the document.',
  'totals-payments': 'Prints the amount already paid.',
  'totals-balance': 'Prints the balance due.',
  'totals-grandtotal': 'Prints the grand total. Turn on amount in words for the line underneath.',
  'payslip-earnings-table': 'Prints earnings on a payslip.',
  'payslip-deductions-table': 'Prints deductions on a payslip.',
  'payslip-summary': 'Prints net pay.',
  'bank-details': 'Prints the bank or payment details stored for the property.',
  'notes-text': 'Prints the document’s footer notes. If there are none, the text below is used.',
  'custom-text': 'A line you write. Add as many as you need. Tokens: {{org.name}}, {{docNumber}}, {{docDate}}, {{guest.name}}, {{totals.grandTotal}}, {{paymentTerms}}.',
  'container': 'A layout only — it does not print text. Put fields inside it, side by side or stacked.',
  'signature-block': 'Staff is the person signed in. The guest line can use the guest on the document, or just their name.',
  'terms-conditions': 'Your terms. They print above the footer, after the signatures.',
};

interface PaletteGroup { id: string; label: string; types: BlockType[] }

const PALETTE_GROUPS: PaletteGroup[] = [
  { id: 'layout', label: 'Layout', types: ['container'] },
  { id: 'header', label: 'Letterhead', types: ['logo', 'company-name', 'company-address', 'company-contact'] },
  { id: 'document', label: 'Document', types: ['doc-title', 'doc-number', 'doc-date'] },
  { id: 'people', label: 'People', types: ['guest-details', 'stay-details', 'employee-details'] },
  { id: 'lines', label: 'Lines', types: ['line-items-table', 'matrix-table', 'schedule-table', 'payslip-earnings-table', 'payslip-deductions-table'] },
  { id: 'amounts', label: 'Amounts', types: ['totals-subtotal', 'totals-taxes', 'totals-payments', 'totals-balance', 'totals-grandtotal', 'payslip-summary'] },
  { id: 'closing', label: 'Closing', types: ['signature-block', 'terms-conditions', 'notes-text', 'custom-text', 'bank-details'] },
];

const selectClass = 'mt-1 w-full rounded-md border bg-white p-2 text-sm';
const fieldLabelClass = 'text-xs font-medium text-gray-600';

function newId(type: BlockType): string {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function findBlockInTree(blocks: BlockConfig[], id: string): BlockConfig | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.children) {
      const found = findBlockInTree(b.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findParentInTree(blocks: BlockConfig[], id: string): BlockConfig | null {
  for (const b of blocks) {
    if (b.children?.some(c => c.id === id)) return b;
    if (b.children) {
      const found = findParentInTree(b.children, id);
      if (found) return found;
    }
  }
  return null;
}

function containsId(block: BlockConfig, id: string): boolean {
  if (block.id === id) return true;
  return (block.children || []).some(c => containsId(c, id));
}

function updateBlockInTree(blocks: BlockConfig[], id: string, patch: Partial<BlockConfig>): BlockConfig[] {
  return blocks.map(b => {
    if (b.id === id) return { ...b, ...patch };
    if (b.children) return { ...b, children: updateBlockInTree(b.children, id, patch) };
    return b;
  });
}

function removeBlockFromTree(blocks: BlockConfig[], id: string): BlockConfig[] {
  return blocks
    .filter(b => b.id !== id)
    .map(b => (b.children ? { ...b, children: removeBlockFromTree(b.children, id) } : b));
}

function moveInTree(blocks: BlockConfig[], id: string, dir: -1 | 1): BlockConfig[] {
  if (blocks.some(b => b.id === id)) {
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(b => b.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return blocks;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    return blocks.map(x => {
      if (x.id === a.id) return { ...x, order: b.order };
      if (x.id === b.id) return { ...x, order: a.order };
      return x;
    });
  }
  return blocks.map(b => (b.children ? { ...b, children: moveInTree(b.children, id, dir) } : b));
}

/** Signatures go above terms; terms go above the footer notes. */
const PLACE_BEFORE: Partial<Record<BlockType, BlockType[]>> = {
  'signature-block': ['terms-conditions', 'notes-text'],
  'terms-conditions': ['notes-text'],
};

function siblingList(blocks: BlockConfig[], parentId: string | null): BlockConfig[] {
  if (parentId === null) return blocks;
  return findBlockInTree(blocks, parentId)?.children || [];
}

function addBlockToTree(blocks: BlockConfig[], parentId: string | null, newBlock: BlockConfig): BlockConfig[] {
  if (parentId === null) {
    const maxOrder = blocks.reduce((m, b) => Math.max(m, b.order), -1);
    return [...blocks, { ...newBlock, order: maxOrder + 1 }];
  }
  return blocks.map(b => {
    if (b.id === parentId) {
      const children = b.children || [];
      const maxOrder = children.reduce((m, c) => Math.max(m, c.order), -1);
      return { ...b, children: [...children, { ...newBlock, order: maxOrder + 1 }] };
    }
    if (b.children) return { ...b, children: addBlockToTree(b.children, parentId, newBlock) };
    return b;
  });
}

function detach(blocks: BlockConfig[], id: string): { next: BlockConfig[]; block: BlockConfig | null } {
  let found: BlockConfig | null = null;
  const walk = (list: BlockConfig[]): BlockConfig[] => list.flatMap(b => {
    if (b.id === id) {
      found = b;
      return [];
    }
    if (b.children) return [{ ...b, children: walk(b.children) }];
    return [b];
  });
  return { next: walk(blocks), block: found };
}

function normalizeOrders(blocks: BlockConfig[]): BlockConfig[] {
  return [...blocks]
    .sort((a, b) => a.order - b.order)
    .map((b, i) => ({
      ...b,
      order: i,
      children: b.children ? normalizeOrders(b.children) : b.children,
    }));
}

function insertInto(blocks: BlockConfig[], parentId: string | null, beforeId: string | null, block: BlockConfig): BlockConfig[] {
  const place = (list: BlockConfig[]) => {
    const sorted = [...list].sort((a, b) => a.order - b.order).filter(b => b.id !== block.id);
    let idx = beforeId ? sorted.findIndex(b => b.id === beforeId) : sorted.length;
    if (idx < 0) idx = sorted.length;
    sorted.splice(idx, 0, block);
    return sorted.map((b, i) => ({ ...b, order: i }));
  };
  if (parentId === null) return place(blocks);
  return blocks.map(b => {
    if (b.id === parentId) return { ...b, children: place(b.children || []) };
    if (b.children) return { ...b, children: insertInto(b.children, parentId, beforeId, block) };
    return b;
  });
}

/** Moves a block before `beforeId` in `parentId` (null = root). `beforeId` null appends. */
function moveBlock(blocks: BlockConfig[], id: string, parentId: string | null, beforeId: string | null): BlockConfig[] | null {
  const moving = findBlockInTree(blocks, id);
  if (!moving) return null;
  if (parentId && (containsId(moving, parentId) || !findBlockInTree(blocks, parentId))) return null;
  const { next, block } = detach(blocks, id);
  if (!block) return null;
  return normalizeOrders(insertInto(next, parentId, beforeId, block));
}

function collectAllTypes(blocks: BlockConfig[], acc: Set<BlockType> = new Set()): Set<BlockType> {
  for (const b of blocks) {
    acc.add(b.type);
    if (b.children) collectAllTypes(b.children, acc);
  }
  return acc;
}

function blockTitle(block: BlockConfig): { title: string; subtitle?: string } {
  const base = shortLabel(block.type);
  if ((block.type === 'custom-text' || block.type === 'notes-text') && block.text?.trim()) {
    const line = block.text.trim().split('\n')[0];
    const clipped = line.length > 48 ? `${line.slice(0, 48)}…` : line;
    return { title: clipped, subtitle: base };
  }
  if (block.heading?.trim()) return { title: block.heading.trim(), subtitle: base };
  return { title: base };
}

interface BlockEditorProps {
  template: BlockTemplate;
  onChange: (template: BlockTemplate) => void;
  sampleData: PrintData;
}

type EditorView = 'layout' | 'page';
/** `false` = palette closed. `null` = adding at the root. A string adds inside that layout. */
type AdderTarget = string | null | false;

export default function BlockEditor({ template, onChange, sampleData }: BlockEditorProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [view, setView] = useState<EditorView>('layout');
  const [adderParent, setAdderParent] = useState<AdderTarget>(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; mode: 'before' | 'inside' } | null>(null);

  const selectedBlock = selectedBlockId ? findBlockInTree(template.blocks, selectedBlockId) : null;
  const usedTypes = collectAllTypes(template.blocks);
  const availableTypes = ADDABLE_BLOCK_TYPES.filter(t => REPEATABLE_BLOCK_TYPES.includes(t) || !usedTypes.has(t));

  const updateBlocks = (blocks: BlockConfig[]) => {
    onChange({ ...template, blocks, updatedAt: new Date().toISOString() });
  };

  const updateBlock = (id: string, patch: Partial<BlockConfig>) => {
    updateBlocks(updateBlockInTree(template.blocks, id, patch));
  };

  const toggleVisible = (id: string) => {
    const b = findBlockInTree(template.blocks, id);
    if (b) updateBlock(id, { visible: !b.visible });
  };

  const move = (id: string, dir: -1 | 1) => {
    updateBlocks(moveInTree(template.blocks, id, dir));
  };

  const removeBlock = (id: string) => {
    updateBlocks(removeBlockFromTree(template.blocks, id));
    if (selectedBlockId === id) setSelectedBlockId(null);
    if (adderParent === id) setAdderParent(false);
  };

  const addBlock = (type: BlockType, parentId: string | null) => {
    if (!REPEATABLE_BLOCK_TYPES.includes(type) && usedTypes.has(type)) return;
    const block: BlockConfig = { id: newId(type), type, visible: true, order: 0 };
    if (type === 'signature-block') {
      block.signatureParties = template.docType === 'payslip' ? 'custom' : 'staff-guest';
      if (block.signatureParties === 'staff-guest') block.guestSignature = 'auto';
      if (block.signatureParties === 'custom') block.signatures = [{ label: 'Signature' }];
    }
    if (type === 'terms-conditions') {
      block.termsSections = [{ heading: 'Terms & Conditions', body: '' }];
    }
    if (type === 'container') block.direction = 'row';
    const anchors = PLACE_BEFORE[type];
    if (anchors) {
      const siblings = [...siblingList(template.blocks, parentId)].sort((a, b) => a.order - b.order);
      const anchor = siblings.find(b => anchors.includes(b.type));
      updateBlocks(insertInto(template.blocks, parentId, anchor?.id ?? null, block));
    } else {
      updateBlocks(addBlockToTree(template.blocks, parentId, block));
    }
    setSelectedBlockId(block.id);
    setAdderParent(false);
    setPaletteQuery('');
  };

  const duplicateCustomText = (id: string) => {
    const source = findBlockInTree(template.blocks, id);
    if (!source || source.type !== 'custom-text') return;
    const parent = findParentInTree(template.blocks, id);
    const copy: BlockConfig = { ...source, id: newId('custom-text'), text: source.text };
    updateBlocks(addBlockToTree(template.blocks, parent?.id ?? null, copy));
    setSelectedBlockId(copy.id);
  };

  const dropOn = (targetId: string, mode: 'before' | 'inside') => {
    const id = draggingId;
    setDraggingId(null);
    setDropHint(null);
    if (!id || id === targetId) return;
    const parentId = mode === 'inside'
      ? targetId
      : (findParentInTree(template.blocks, targetId)?.id ?? null);
    const beforeId = mode === 'inside' ? null : targetId;
    const next = moveBlock(template.blocks, id, parentId, beforeId);
    if (next) updateBlocks(next);
  };

  const toggleAdder = (parent: string | null) => {
    setAdderParent(curr => (curr === parent ? false : parent));
    setPaletteQuery('');
  };

  const renderBlockList = (blocks: BlockConfig[], depth: number): React.ReactNode => {
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    return sorted.map((b, i) => {
      const zone = depth === 0 ? BLOCK_ZONE[b.type] : null;
      const prevZone = depth === 0 && i > 0 ? BLOCK_ZONE[sorted[i - 1].type] : null;
      const showZoneDivider = depth === 0 && zone !== prevZone;
      const isContainer = b.type === 'container';
      const { title, subtitle } = blockTitle(b);
      const selected = selectedBlockId === b.id;
      const meta: string[] = [];
      if (!b.visible) meta.push('Hidden');
      if (b.align && b.align !== 'left') meta.push(b.align === 'center' ? 'Centered' : 'Right');
      if (b.columnSpan === 'half') meta.push('Shares a row');
      return (
        <React.Fragment key={b.id}>
          {showZoneDivider && (
            <div className="pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 first:pt-0">{ZONE_LABELS[zone!]}</div>
          )}
          <div
            className={`rounded-lg border bg-white ${selected ? 'border-ghana-green shadow-sm' : 'border-gray-200'} ${dropHint?.id === b.id && dropHint.mode === 'before' ? 'ring-2 ring-ghana-green' : ''} ${b.visible ? '' : 'opacity-60'}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggingId && draggingId !== b.id) setDropHint({ id: b.id, mode: 'before' });
            }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropOn(b.id, 'before'); }}
          >
            <div className="flex items-center gap-0.5 px-1.5 py-1">
              <span
                draggable
                title="Drag to reorder"
                className="cursor-grab text-gray-400 active:cursor-grabbing"
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', b.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggingId(b.id);
                }}
                onDragEnd={() => { setDraggingId(null); setDropHint(null); }}
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 py-1 text-left"
                onClick={() => setSelectedBlockId(selected ? null : b.id)}
              >
                <span className="block truncate text-sm font-medium text-gray-900">{title}</span>
                {(subtitle || meta.length > 0) && (
                  <span className="block truncate text-[11px] text-gray-400">
                    {[subtitle, ...meta].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
              <button type="button" className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100" title={b.visible ? 'Hide on the printed form' : 'Show on the printed form'} onClick={() => toggleVisible(b.id)}>
                {b.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button type="button" className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30" disabled={i === 0} title="Move up" onClick={() => move(b.id, -1)}>
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30" disabled={i === sorted.length - 1} title="Move down" onClick={() => move(b.id, 1)}>
                <ChevronDown className="h-4 w-4" />
              </button>
              {b.type === 'custom-text' && (
                <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100" title="Duplicate" onClick={() => duplicateCustomText(b.id)}>
                  <Copy className="h-4 w-4" />
                </button>
              )}
              <button type="button" className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50" title="Remove" onClick={() => removeBlock(b.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {selected && selectedBlock && (
              <div className="border-t bg-gray-50 px-3 py-2">
                <BlockSettings
                  block={selectedBlock}
                  onChange={(patch) => updateBlock(selectedBlock.id, patch)}
                  hasLegacyHeaderBlock={template.blocks.some(x => HEADER_TYPES.includes(x.type))}
                  parentDirection={(() => {
                    const parent = findParentInTree(template.blocks, selectedBlock.id);
                    return parent?.type === 'container' ? (parent.direction || 'row') : null;
                  })()}
                />
              </div>
            )}

            {isContainer && (
              <div
                className={`mx-3 mb-3 space-y-2 border-l-2 pl-3 ${dropHint?.id === b.id && dropHint.mode === 'inside' ? 'border-ghana-green bg-green-50/70' : 'border-gray-200'}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggingId && draggingId !== b.id) setDropHint({ id: b.id, mode: 'inside' });
                }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropOn(b.id, 'inside'); }}
              >
                {renderBlockList(b.children || [], depth + 1)}
                {(b.children || []).length === 0 && (
                  <p className="py-2 text-xs text-gray-400">Empty layout. Add a field, or drop one here.</p>
                )}
                <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-ghana-green" onClick={() => toggleAdder(b.id)}>
                  <Plus className="h-3.5 w-3.5" /> Add field inside
                </button>
                {adderParent === b.id && (
                  <FieldPalette
                    query={paletteQuery}
                    onQuery={setPaletteQuery}
                    availableTypes={availableTypes}
                    onAdd={(type) => addBlock(type, b.id)}
                  />
                )}
              </div>
            )}
          </div>
        </React.Fragment>
      );
    });
  };

  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-1 items-start gap-3 overflow-x-hidden lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <Input
          label="Template name"
          value={template.name}
          onChange={(e) => onChange({ ...template, name: e.target.value, updatedAt: new Date().toISOString() })}
        />
        <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Template editor">
          {([
            ['layout', 'Layout'],
            ['page', 'Page style'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {view === 'layout' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Drag to reorder, drop a field into a Layout to place them side by side, and rename labels. The preview updates as you go.
            </p>
            {template.blocks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
                This form is empty. Add a letterhead, a title, or a layout to start.
              </div>
            ) : (
              <div className="space-y-2">{renderBlockList(template.blocks, 0)}</div>
            )}
            <Button variant="flat" startContent={<Plus className="h-4 w-4" />} onPress={() => toggleAdder(null)}>
              Add field
            </Button>
            {adderParent === null && (
              <FieldPalette
                query={paletteQuery}
                onQuery={setPaletteQuery}
                availableTypes={availableTypes}
                onAdd={(type) => addBlock(type, null)}
              />
            )}
          </div>
        )}

        {view === 'page' && (
          <PageStyleFields style={template.style} onChange={(patch) => onChange({ ...template, style: { ...template.style, ...patch }, updatedAt: new Date().toISOString() })} />
        )}
      </div>

      <div className="min-w-0 max-w-full space-y-2 overflow-hidden">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Live preview · sample data</p>
        <TemplatePreview template={template} sampleData={sampleData} />
      </div>
    </div>
  );
}

function FieldPalette({ query, onQuery, availableTypes, onAdd }: {
  query: string;
  onQuery: (value: string) => void;
  availableTypes: BlockType[];
  onAdd: (type: BlockType) => void;
}) {
  const q = query.trim().toLowerCase();
  const matches = (type: BlockType) => !q || shortLabel(type).toLowerCase().includes(q) || BLOCK_LABELS[type].toLowerCase().includes(q);
  const known = new Set(PALETTE_GROUPS.flatMap(g => g.types));
  const groups = PALETTE_GROUPS
    .map(g => ({ ...g, types: g.types.filter(t => ADDABLE_BLOCK_TYPES.includes(t) && matches(t)) }))
    .filter(g => g.types.length > 0);
  const other = ADDABLE_BLOCK_TYPES.filter(t => !known.has(t) && matches(t));

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-gray-300 bg-white p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search fields — title, table, signature…"
          className="w-full rounded-md border py-2 pl-8 pr-2 text-sm"
        />
      </div>
      <p className="text-xs text-gray-500">
        The same fields work on any document. Layout and Custom Text can be used more than once. A field already on the form is marked.
      </p>
      {groups.map(group => (
        <div key={group.id}>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{group.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {group.types.map(type => {
              const enabled = availableTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  disabled={!enabled}
                  title={enabled ? BLOCK_LABELS[type] : `${BLOCK_LABELS[type]} is already on this form`}
                  className="rounded-full border px-2.5 py-1 text-xs font-medium hover:border-ghana-green hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => onAdd(type)}
                >
                  {shortLabel(type)}{enabled ? '' : ' · added'}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {other.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {other.map(type => {
            const enabled = availableTypes.includes(type);
            return (
              <button key={type} type="button" disabled={!enabled} className="rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-40" onClick={() => onAdd(type)}>
                {shortLabel(type)}{enabled ? '' : ' · added'}
              </button>
            );
          })}
        </div>
      )}
      {groups.length === 0 && other.length === 0 && (
        <p className="text-sm text-gray-500">No fields match that search.</p>
      )}
    </div>
  );
}

function PageStyleFields({ style, onChange }: { style: TemplateStyle; onChange: (patch: Partial<TemplateStyle>) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <StyleColor label="Primary color" value={style.primaryColor} onChange={(primaryColor) => onChange({ primaryColor })} />
      <StyleColor label="Text color" value={style.textColor} onChange={(textColor) => onChange({ textColor })} />
      <StyleSelect label="Font" value={style.fontFamily} onChange={(fontFamily) => onChange({ fontFamily: fontFamily as TemplateStyle['fontFamily'] })} options={[['sans', 'Sans-serif'], ['serif', 'Serif'], ['mono', 'Monospace']]} />
      <StyleSelect label="Document font size" value={style.bodyFontSize} onChange={(bodyFontSize) => onChange({ bodyFontSize: bodyFontSize as TemplateStyle['bodyFontSize'] })} options={[['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']]} />
      <StyleColor label="Border color" value={style.borderColor} onChange={(borderColor) => onChange({ borderColor })} />
      <StyleSelect label="Border width" value={style.borderWidth} onChange={(borderWidth) => onChange({ borderWidth: borderWidth as TemplateStyle['borderWidth'] })} options={[['thin', 'Thin'], ['thick', 'Thick']]} />
      <StyleSelect label="Logo position" value={style.logoPosition} onChange={(logoPosition) => onChange({ logoPosition: logoPosition as TemplateStyle['logoPosition'] })} options={[['left', 'Left'], ['center', 'Center'], ['right', 'Right']]} />
      <StyleSelect label="Logo size" value={style.logoSize} onChange={(logoSize) => onChange({ logoSize: logoSize as TemplateStyle['logoSize'] })} options={[['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']]} />
      <StyleSelect label="Page margin" value={style.pageMargin} onChange={(pageMargin) => onChange({ pageMargin: pageMargin as TemplateStyle['pageMargin'] })} options={[['compact', 'Compact'], ['normal', 'Normal'], ['spacious', 'Spacious']]} />
      <StyleSelect label="Corners" value={style.corners || 'rounded'} onChange={(corners) => onChange({ corners: corners as TemplateStyle['corners'] })} options={[['rounded', 'Rounded'], ['square', 'Square']]} />
      <StyleSelect label="Page width" value={style.pageWidth || 'full'} onChange={(pageWidth) => onChange({ pageWidth: pageWidth as TemplateStyle['pageWidth'] })} options={[['full', 'Full page'], ['narrow', 'Narrow (80mm receipt)']]} />
      <div className="flex items-center justify-between rounded-md border bg-white px-3 py-2">
        <span className="text-sm text-gray-700">Watermark</span>
        <Switch isSelected={!!style.showWatermark} onValueChange={(showWatermark) => onChange({ showWatermark })} />
      </div>
      {style.showWatermark && (
        <Input label="Watermark text" value={style.watermarkText || ''} onChange={(e) => onChange({ watermarkText: e.target.value })} />
      )}
    </div>
  );
}

function StyleColor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className={fieldLabelClass}>{label}</label>
      <input type="color" className="mt-1 h-9 w-full rounded-md border" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function StyleSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return (
    <div>
      <label className={fieldLabelClass}>{label}</label>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </div>
  );
}

function clampStep(n: number): number {
  return Math.max(-12, Math.min(12, n));
}

function stepLabel(steps: number, lessName: string, moreName: string): string {
  if (!steps) return '0';
  return steps < 0 ? `${-steps} ${lessName}` : `${steps} ${moreName}`;
}

function NudgeControl({ label, less, more, lessName, moreName, value, onChange }: {
  label: string;
  less: string;
  more: string;
  lessName: string;
  moreName: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const step = (dir: -1 | 1) => {
    const next = clampStep(valueRef.current + dir);
    valueRef.current = next;
    onChange(next);
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={fieldLabelClass}>{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="rounded border bg-white px-2 py-1 text-xs" onClick={() => step(-1)}>{less}</button>
        <span className="w-14 text-center text-xs tabular-nums text-gray-700">{stepLabel(value, lessName, moreName)}</span>
        <button type="button" className="rounded border bg-white px-2 py-1 text-xs" onClick={() => step(1)}>{more}</button>
      </div>
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button type="button" className="flex w-full items-center justify-between py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500" onClick={() => setOpen(v => !v)}>
        {title}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="space-y-3 pb-3">{children}</div>}
    </div>
  );
}

function BlockSettings({ block, onChange, hasLegacyHeaderBlock, parentDirection }: {
  block: BlockConfig;
  onChange: (patch: Partial<BlockConfig>) => void;
  hasLegacyHeaderBlock: boolean;
  parentDirection: 'row' | 'column' | null;
}) {
  const isHeaderBlock = HEADER_TYPES.includes(block.type) || (hasLegacyHeaderBlock && block.type === 'logo');
  const labelDefault = LABELABLE[block.type];

  if (isHeaderBlock) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          {block.type === 'logo'
            ? 'This template still has a legacy Company Info or Document block, so the logo shares their row. Remove those and use Company Name, Document Title, and the other single fields to place the logo yourself.'
            : 'This is a legacy bundled block. Remove it and add the single fields (Company Name, Document Title, and so on) if you want to arrange each line.'}
        </p>
        {block.type === 'doc-meta' && (
          <Input label="Number label" value={block.docNumberLabel || ''} onChange={(e) => onChange({ docNumberLabel: e.target.value })} placeholder="No." />
        )}
      </div>
    );
  }

  return (
    <div>
      <Section title="Content" defaultOpen>
        {block.type === 'container' && (
          <p className="text-xs text-gray-500">Add fields inside this layout. Column width only applies when the direction is a row.</p>
        )}

        {labelDefault && !(block.type === 'recipient-info' && block.recipientDisplay === 'letter') && (
          <Input
            label={block.type === 'doc-date' ? 'Date label' : 'Label'}
            value={block.heading || ''}
            placeholder={labelDefault}
            onChange={(e) => onChange({ heading: e.target.value })}
          />
        )}

        {block.type === 'recipient-info' && (
          <div>
            <label className={fieldLabelClass}>Display as</label>
            <select className={selectClass} value={block.recipientDisplay || 'box'} onChange={(e) => onChange({ recipientDisplay: e.target.value as BlockConfig['recipientDisplay'] })}>
              <option value="box">Bordered card</option>
              <option value="letter">Cover letter (name, attention line, greeting)</option>
            </select>
          </div>
        )}
        {block.type === 'recipient-info' && block.recipientDisplay === 'letter' && (
          <Input label="Attention line label" value={block.heading || ''} placeholder="ATTN" onChange={(e) => onChange({ heading: e.target.value })} />
        )}

        {block.type === 'guest-details' && (
          <div>
            <label className={fieldLabelClass}>Display as</label>
            <select className={selectClass} value={block.guestDetailsDisplay || 'card'} onChange={(e) => onChange({ guestDetailsDisplay: e.target.value as BlockConfig['guestDetailsDisplay'] })}>
              <option value="card">Card</option>
              <option value="lines">Billing lines (person, guest, address)</option>
            </select>
          </div>
        )}

        {block.type === 'stay-details' && (
          <div>
            <label className={fieldLabelClass}>Display as</label>
            <select className={selectClass} value={block.stayDetailsDisplay || 'lines'} onChange={(e) => onChange({ stayDetailsDisplay: e.target.value as BlockConfig['stayDetailsDisplay'] })}>
              <option value="lines">Two lines</option>
              <option value="grid">Grid (room, rate, dates)</option>
            </select>
          </div>
        )}

        {block.type === 'line-items-table' && (
          <div className="space-y-3">
            <div>
              <label className={fieldLabelClass}>Display as</label>
              <select className={selectClass} value={block.lineItemsDisplay || 'table'} onChange={(e) => onChange({ lineItemsDisplay: e.target.value as BlockConfig['lineItemsDisplay'] })}>
                <option value="table">Table</option>
                <option value="list">Itemized list with a dotted leader</option>
                <option value="simple">Plain lines (description and amount)</option>
              </select>
            </div>
            <div>
              <label className={fieldLabelClass}>{block.lineItemsDisplay === 'table' || !block.lineItemsDisplay ? 'Columns' : 'Details on each line'}</label>
              <div className="mt-1 flex flex-wrap gap-3">
                {(['qty', 'unit', 'unitPrice', 'date'] as const).map(col => (
                  <label key={col} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={(block.columns || []).includes(col)}
                      onChange={(e) => {
                        const cur = new Set(block.columns || []);
                        if (e.target.checked) cur.add(col); else cur.delete(col);
                        onChange({ columns: Array.from(cur) });
                      }}
                    />
                    {col === 'unitPrice' ? 'Rate' : col.charAt(0).toUpperCase() + col.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {(block.type === 'payslip-earnings-table' || block.type === 'payslip-deductions-table') && (
          <div>
            <label className={fieldLabelClass}>Display as</label>
            <select className={selectClass} value={block.payslipItemsDisplay || 'table'} onChange={(e) => onChange({ payslipItemsDisplay: e.target.value as BlockConfig['payslipItemsDisplay'] })}>
              <option value="table">Table</option>
              <option value="list">Itemized list</option>
            </select>
          </div>
        )}

        {block.type === 'signature-block' && (
          <div className="space-y-2">
            <div>
              <label className={fieldLabelClass}>Who signs</label>
              <select
                className={selectClass}
                value={block.signatureParties || 'custom'}
                onChange={(e) => {
                  const signatureParties = e.target.value as BlockConfig['signatureParties'];
                  if (signatureParties === 'custom') {
                    onChange({
                      signatureParties,
                      signatures: block.signatures?.length ? block.signatures : [{ label: 'Signature' }],
                    });
                  } else {
                    onChange({ signatureParties });
                  }
                }}
              >
                <option value="staff-guest">Staff and guest</option>
                <option value="guest">Guest only</option>
                <option value="staff">Staff only</option>
                <option value="customer-attendant">Customer and attendant</option>
                <option value="user">User</option>
                <option value="both">Customer, attendant, and user</option>
                <option value="custom">Custom labels</option>
              </select>
              {(block.signatureParties === 'staff' || block.signatureParties === 'staff-guest') && (
                <p className="mt-1 text-xs text-gray-500">
                  Staff is whoever is signed in. Their name is filled in automatically.
                </p>
              )}
              {block.signatureParties && !['custom', 'staff-guest', 'guest', 'staff'].includes(block.signatureParties) && (
                <p className="mt-1 text-xs text-gray-500">
                  Prints above the footer. The customer line uses the guest name. Attendant and user are filled when the document has them.
                </p>
              )}
            </div>
            {(block.signatureParties === 'staff-guest' || block.signatureParties === 'guest') && (
              <div>
                <label className={fieldLabelClass}>Guest line</label>
                <select
                  className={selectClass}
                  value={block.guestSignature || 'auto'}
                  onChange={(e) => onChange({ guestSignature: e.target.value as BlockConfig['guestSignature'] })}
                >
                  <option value="auto">Auto — the guest on the document</option>
                  <option value="name">Guest name only</option>
                </select>
              </div>
            )}
            {(block.signatureParties === 'staff-guest' || block.signatureParties === 'guest') && (
              <Input label="Guest caption" value={block.guestSignLabel || ''} placeholder="Guest" onChange={(e) => onChange({ guestSignLabel: e.target.value || undefined })} />
            )}
            {(block.signatureParties === 'staff-guest' || block.signatureParties === 'staff') && (
              <Input label="Staff caption" value={block.staffSignLabel || ''} placeholder="Staff" onChange={(e) => onChange({ staffSignLabel: e.target.value || undefined })} />
            )}
            <div>
              <label className={fieldLabelClass}>Display as</label>
              <select className={selectClass} value={block.signatureDisplay || 'box'} onChange={(e) => onChange({ signatureDisplay: e.target.value as BlockConfig['signatureDisplay'] })}>
                <option value="box">Boxed</option>
                <option value="line">Signature line</option>
              </select>
            </div>
            {block.signatureDisplay === 'line' && (
              <Input label="Line under the first signature" value={block.signatureNote || ''} placeholder="Phone No:" onChange={(e) => onChange({ signatureNote: e.target.value || undefined })} />
            )}
            {(block.signatureParties === 'custom' || !block.signatureParties) && (
              <>
                <label className={fieldLabelClass}>Signers</label>
                {(block.signatures || []).map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border p-2 text-sm"
                      placeholder="Label"
                      value={s.label}
                      onChange={(e) => {
                        const next = [...(block.signatures || [])];
                        next[i] = { ...next[i], label: e.target.value };
                        onChange({ signatures: next });
                      }}
                    />
                    <input
                      className="flex-1 rounded-md border p-2 text-sm"
                      placeholder="Role (optional)"
                      value={s.role || ''}
                      onChange={(e) => {
                        const next = [...(block.signatures || [])];
                        next[i] = { ...next[i], role: e.target.value };
                        onChange({ signatures: next });
                      }}
                    />
                    <button type="button" className="px-2 text-sm text-red-500" onClick={() => onChange({ signatures: (block.signatures || []).filter((_, j) => j !== i) })}>
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="text-sm font-medium text-ghana-green" onClick={() => onChange({ signatures: [...(block.signatures || []), { label: 'Signature' }] })}>
                  + Add signer
                </button>
              </>
            )}
          </div>
        )}

        {block.type === 'terms-conditions' && (
          <div className="space-y-3">
            {(block.termsSections || []).map((s, i) => (
              <div key={i} className="space-y-2 rounded-md border bg-white p-2">
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border p-2 text-sm"
                    placeholder="Section heading"
                    value={s.heading}
                    onChange={(e) => {
                      const next = [...(block.termsSections || [])];
                      next[i] = { ...next[i], heading: e.target.value };
                      onChange({ termsSections: next });
                    }}
                  />
                  <button type="button" className="px-2 text-sm text-red-500" onClick={() => onChange({ termsSections: (block.termsSections || []).filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                </div>
                <textarea
                  className="w-full rounded-md border p-2 text-sm"
                  rows={2}
                  placeholder="Section text"
                  value={s.body}
                  onChange={(e) => {
                    const next = [...(block.termsSections || [])];
                    next[i] = { ...next[i], body: e.target.value };
                    onChange({ termsSections: next });
                  }}
                />
              </div>
            ))}
            <button type="button" className="text-sm font-medium text-ghana-green" onClick={() => onChange({ termsSections: [...(block.termsSections || []), { heading: 'New section', body: '' }] })}>
              + Add section
            </button>
          </div>
        )}

        {(block.type === 'notes-text' || block.type === 'custom-text') && (
          <Textarea
            label={block.type === 'notes-text' ? 'Text used when the document has no footer notes' : 'Text'}
            value={block.text || ''}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="You can use {{org.name}}, {{docNumber}}, {{guest.name}}, {{totals.grandTotal}}"
          />
        )}

        {(block.type === 'doc-meta' || block.type === 'doc-number') && (
          <Input label="Number label" value={block.docNumberLabel || ''} onChange={(e) => onChange({ docNumberLabel: e.target.value })} placeholder="No." />
        )}

        {block.type === 'totals-summary' && (
          <div className="space-y-3">
            <div>
              <label className={fieldLabelClass}>Display as</label>
              <select className={selectClass} value={block.totalsDisplay || 'table'} onChange={(e) => onChange({ totalsDisplay: e.target.value as BlockConfig['totalsDisplay'] })}>
                <option value="table">Table</option>
                <option value="numbered-list">Numbered list — (i) Tax exclusive value…</option>
                <option value="compact-taxes">Compact — exclusive, taxes included, total</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Amount in words</span>
              <Switch isSelected={!!block.showAmountInWords} onValueChange={(v) => onChange({ showAmountInWords: v })} />
            </div>
          </div>
        )}

        {(block.type === 'totals-grandtotal' || block.type === 'payslip-summary') && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Amount in words</span>
            <Switch isSelected={!!block.showAmountInWords} onValueChange={(v) => onChange({ showAmountInWords: v })} />
          </div>
        )}

        {DATA_HINT[block.type] && <p className="text-xs text-gray-500">{DATA_HINT[block.type]}</p>}
      </Section>

      <Section title="Arrange">
        {block.type === 'container' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fieldLabelClass}>Direction</label>
              <select className={selectClass} value={block.direction || 'row'} onChange={(e) => onChange({ direction: e.target.value as BlockConfig['direction'] })}>
                <option value="row">Side by side</option>
                <option value="column">Stacked</option>
              </select>
            </div>
            <div>
              <label className={fieldLabelClass}>Gap</label>
              <select className={selectClass} value={block.gap || 'medium'} onChange={(e) => onChange({ gap: e.target.value as BlockConfig['gap'] })}>
                <option value="none">None</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div className="col-span-2 flex items-center justify-between">
              <span className="text-sm text-gray-700">One table</span>
              <Switch isSelected={!!block.joinTable} onValueChange={(joinTable) => onChange({ joinTable })} />
            </div>
          </div>
        )}
        {block.type === 'container' && block.joinTable && (
          <p className="text-xs text-gray-500">Subtotal, taxes, and the total share one grid. The order is the order of the fields inside this layout.</p>
        )}
        {parentDirection === 'row' && (
          <div>
            <label className={fieldLabelClass}>Column width</label>
            <select className={selectClass} value={block.flexWeight ?? 1} onChange={(e) => onChange({ flexWeight: Number(e.target.value) as BlockConfig['flexWeight'] })}>
              <option value={0}>Fit content</option>
              <option value={1}>1×</option>
              <option value={2}>2× wider</option>
              <option value={3}>3× wider</option>
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={fieldLabelClass}>Alignment</label>
            <select className={selectClass} value={block.align || 'left'} onChange={(e) => onChange({ align: e.target.value as BlockConfig['align'] })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className={fieldLabelClass}>Width</label>
            <select className={selectClass} value={block.columnSpan || 'full'} onChange={(e) => onChange({ columnSpan: e.target.value as BlockConfig['columnSpan'] })}>
              <option value="full">Full width</option>
              <option value="half">Share a row</option>
            </select>
          </div>
          <div>
            <label className={fieldLabelClass}>Space above</label>
            <select className={selectClass} value={block.spacing || 'default'} onChange={(e) => onChange({ spacing: e.target.value === 'default' ? undefined : e.target.value as BlockConfig['spacing'] })}>
              <option value="default">Default</option>
              <option value="none">None</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="bottom">Bottom of the page</option>
            </select>
          </div>
          <div>
            <label className={fieldLabelClass}>Indent</label>
            <select className={selectClass} value={block.indent || 'none'} onChange={(e) => onChange({ indent: e.target.value === 'none' ? undefined : e.target.value as BlockConfig['indent'] })}>
              <option value="none">None</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>
        <NudgeControl
          label="Up / down"
          less="Up"
          more="Down"
          lessName="up"
          moreName="down"
          value={block.offsetY || 0}
          onChange={(offsetY) => onChange({ offsetY })}
        />
        <NudgeControl
          label="Left / right"
          less="Left"
          more="Right"
          lessName="left"
          moreName="right"
          value={block.offsetX || 0}
          onChange={(offsetX) => onChange({ offsetX })}
        />
        {block.columnSpan === 'half' && (
          <p className="text-xs text-gray-500">Neighbors also set to “Share a row” sit on one line. For uneven columns, or a column with several fields, use a Layout instead.</p>
        )}
      </Section>

      <Section title="Look">
        {(() => {
          const selfBoxed = SELF_BORDERED_TYPES.includes(block.type);
          const borderValue = block.border || (selfBoxed ? 'thin' : 'none');
          return (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={fieldLabelClass}>Border</label>
                <select className={selectClass} value={borderValue} onChange={(e) => onChange({ border: e.target.value as BlockConfig['border'] })}>
                  <option value="none">None</option>
                  <option value="thin">Thin{selfBoxed ? ' (default)' : ''}</option>
                  <option value="thick">Thick</option>
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>Font size</label>
                <select className={selectClass} value={block.style?.fontSize || 'md'} onChange={(e) => onChange({ style: { ...block.style, fontSize: e.target.value as 'sm' | 'md' | 'lg' } })}>
                  <option value="sm">Small</option>
                  <option value="md">Default</option>
                  <option value="lg">Large</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Bold</span>
                <Switch isSelected={!!block.style?.bold} onValueChange={(v) => onChange({ style: { ...block.style, bold: v } })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Underline</span>
                <Switch isSelected={!!block.underline} onValueChange={(v) => onChange({ underline: v })} />
              </div>
              <div className="flex items-center justify-between sm:col-span-2">
                <span className="text-sm text-gray-700">Divider below</span>
                <Switch isSelected={!!block.dividerBelow} onValueChange={(v) => onChange({ dividerBelow: v })} />
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Background</span>
                  <div className="flex items-center gap-2">
                    {block.background && (
                      <button type="button" className="text-xs text-red-500" onClick={() => onChange({ background: undefined, backgroundTextColor: undefined })}>Clear</button>
                    )}
                    <input type="color" className="h-9 w-12 rounded-md border" value={block.background || '#ffffff'} onChange={(e) => onChange({ background: e.target.value })} />
                  </div>
                </div>
              </div>
              {block.background && (
                <div className="sm:col-span-2">
                  <label className={fieldLabelClass}>Text on background</label>
                  <input type="color" className="mt-1 h-9 w-full rounded-md border" value={block.backgroundTextColor || '#ffffff'} onChange={(e) => onChange({ backgroundTextColor: e.target.value })} />
                </div>
              )}
            </div>
          );
        })()}
      </Section>
    </div>
  );
}
