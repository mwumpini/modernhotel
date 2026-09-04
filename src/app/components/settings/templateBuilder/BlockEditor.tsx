'use client';

import React, { useState } from 'react';
import { Card, CardBody, Button, Input, Textarea, Switch } from '@heroui/react';
import type { BlockConfig, BlockTemplate, BlockType, TemplateStyle } from '../../../lib/print/blocks';
import { SELF_BORDERED_TYPES } from '../../../lib/print/blockRenderer';

const BLOCK_LABELS: Record<BlockType, string> = {
  'logo': 'Logo',
  // Legacy bundled types — kept here only so an already-saved template that still
  // has one of these displays a proper label; see ADDABLE_BLOCK_TYPES below for
  // what's offered when adding a *new* block.
  'company-info': 'Company Info (legacy — bundled)',
  'doc-meta': 'Document Title / Number / Date (legacy — bundled)',
  'recipient-info': 'Guest / Client Info (legacy — bundled)',
  'totals-summary': 'Totals Summary (legacy — bundled)',
  // Granular — one standalone line each.
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
  'container': 'Layout Container',
};

/**
 * Purely organizational — groups the block list into Header / Body / Footer
 * section dividers so a long list is easier to scan. Doesn't affect print
 * output at all (render order is still just each block's `order`); Chrome's
 * print can't repeat custom content across pages, so this is labeling only,
 * not a real running header/footer.
 */
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
};
const ZONE_LABELS: Record<'header' | 'body' | 'footer', string> = { header: 'Header', body: 'Body', footer: 'Footer' };

/** What "+ Add a block" offers for a brand-new block — excludes the 4 legacy
 *  bundled types (still fully supported if already present, just not offered
 *  again) now that each of their pieces has its own standalone block. */
const ADDABLE_BLOCK_TYPES: BlockType[] = (Object.keys(BLOCK_LABELS) as BlockType[])
  .filter(t => !(['company-info', 'doc-meta', 'recipient-info', 'totals-summary'] as BlockType[]).includes(t));
/** Types that can appear more than once in the same template — everything else
 *  maps to one specific data field, so only makes sense once. */
const REPEATABLE_BLOCK_TYPES: BlockType[] = ['container', 'custom-text'];
// Kept in sync with blockRenderer.ts's HEADER_BLOCK_TYPES — 'logo' is deliberately
// excluded so it gets the normal Alignment/Position/Border/Underline controls
// below and can be grouped side-by-side with other blocks via "Half width".
const HEADER_TYPES: BlockType[] = ['company-info', 'doc-meta'];

// --- Tree helpers — template.blocks is a tree now that 'container' blocks can
// hold children (which can themselves be containers), not just a flat list.
// Every one of these recurses into `children` so the block list, move/add/
// remove, and the uniqueness check all work no matter how deep a block lives. ---

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

/** Swaps `order` with the adjacent sibling in whichever array (top-level or some
 *  container's children) the block actually lives in — a no-op past either end. */
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

function collectAllTypes(blocks: BlockConfig[], acc: Set<BlockType> = new Set()): Set<BlockType> {
  for (const b of blocks) {
    acc.add(b.type);
    if (b.children) collectAllTypes(b.children, acc);
  }
  return acc;
}

interface BlockEditorProps {
  template: BlockTemplate;
  onChange: (template: BlockTemplate) => void;
}

export default function BlockEditor({ template, onChange }: BlockEditorProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(template.blocks[0]?.id || null);
  const [tab, setTab] = useState<'blocks' | 'style'>('blocks');

  const selectedBlock = selectedBlockId ? findBlockInTree(template.blocks, selectedBlockId) : null;
  const usedTypes = collectAllTypes(template.blocks);
  // 'container' is structural and 'custom-text' is free-form content — neither
  // is tied to one specific data field, so both are always offered, unlike
  // every other type which can only appear once anywhere in the tree (e.g. an
  // intro line under the header AND a closing tagline both being custom-text).
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
  };

  const addBlock = (type: BlockType, parentId: string | null = null) => {
    const newBlock: BlockConfig = { id: `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, type, visible: true, order: 0 };
    updateBlocks(addBlockToTree(template.blocks, parentId, newBlock));
    setSelectedBlockId(newBlock.id);
  };

  const updateStyle = (patch: Partial<TemplateStyle>) => {
    onChange({ ...template, style: { ...template.style, ...patch }, updatedAt: new Date().toISOString() });
  };

  /** Recursive block-list rendering — a container's children render nested
   *  beneath it, indented, with their own "+ Add a block" picker. Zone
   *  (Header/Body/Footer) dividers only make sense at the top level. */
  const renderBlockList = (blocks: BlockConfig[], depth: number): React.ReactNode => {
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    return sorted.map((b, i) => {
      const zone = depth === 0 ? BLOCK_ZONE[b.type] : null;
      const prevZone = depth === 0 && i > 0 ? BLOCK_ZONE[sorted[i - 1].type] : null;
      const showZoneDivider = depth === 0 && zone !== prevZone;
      const isContainer = b.type === 'container';
      return (
        <React.Fragment key={b.id}>
          {showZoneDivider && (
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 pt-2 first:pt-0">{ZONE_LABELS[zone!]}</div>
          )}
          <div
            style={depth > 0 ? { marginLeft: depth * 16 } : undefined}
            className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${selectedBlockId === b.id ? 'border-ghana-green bg-green-50' : 'border-gray-200'}`}
            onClick={() => setSelectedBlockId(b.id)}
          >
            <input
              type="checkbox"
              checked={b.visible}
              onChange={(e) => { e.stopPropagation(); toggleVisible(b.id); }}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="flex-1 text-sm">
              {BLOCK_LABELS[b.type]}
              {isContainer && <span className="text-gray-400"> ({(b.children || []).length})</span>}
            </span>
            <button className="text-xs text-gray-500 disabled:opacity-30" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(b.id, -1); }}>▲</button>
            <button className="text-xs text-gray-500 disabled:opacity-30" disabled={i === sorted.length - 1} onClick={(e) => { e.stopPropagation(); move(b.id, 1); }}>▼</button>
            <button className="text-xs text-red-500" onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }}>✕</button>
          </div>
          {isContainer && (
            <div style={{ marginLeft: (depth + 1) * 16 }} className="space-y-2 border-l-2 border-gray-100 pl-2">
              {renderBlockList(b.children || [], depth + 1)}
              {availableTypes.length > 0 && (
                <select
                  className="w-full border rounded-md p-2 text-xs"
                  value=""
                  onChange={(e) => { if (e.target.value) addBlock(e.target.value as BlockType, b.id); }}
                >
                  <option value="">+ Add a block to this container…</option>
                  {availableTypes.map(t => <option key={t} value={t}>{BLOCK_LABELS[t]}</option>)}
                </select>
              )}
            </div>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-0 shadow-md md:col-span-1">
        <CardBody className="space-y-3">
          <Input
            label="Template Name"
            value={template.name}
            onChange={(e) => onChange({ ...template, name: e.target.value, updatedAt: new Date().toISOString() })}
          />
          <div className="flex gap-2 border-b pb-2">
            <button
              className={`text-sm px-2 py-1 rounded ${tab === 'blocks' ? 'bg-ghana-green text-white' : 'bg-gray-100'}`}
              onClick={() => setTab('blocks')}
            >
              Blocks
            </button>
            <button
              className={`text-sm px-2 py-1 rounded ${tab === 'style' ? 'bg-ghana-green text-white' : 'bg-gray-100'}`}
              onClick={() => setTab('style')}
            >
              Style
            </button>
          </div>

          {tab === 'blocks' && (
            <div className="space-y-2">
              {renderBlockList(template.blocks, 0)}
              {availableTypes.length > 0 && (
                <select
                  className="mt-2 w-full border rounded-md p-2 text-sm"
                  value=""
                  onChange={(e) => { if (e.target.value) addBlock(e.target.value as BlockType); }}
                >
                  <option value="">+ Add a block…</option>
                  {availableTypes.map(t => <option key={t} value={t}>{BLOCK_LABELS[t]}</option>)}
                </select>
              )}
            </div>
          )}

          {tab === 'style' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Primary Color</label>
                  <input type="color" className="w-full h-9 border rounded-md" value={template.style.primaryColor} onChange={(e) => updateStyle({ primaryColor: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Text Color</label>
                  <input type="color" className="w-full h-9 border rounded-md" value={template.style.textColor} onChange={(e) => updateStyle({ textColor: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Font</label>
                  <select className="mt-1 w-full border rounded-md p-2 text-sm" value={template.style.fontFamily} onChange={(e) => updateStyle({ fontFamily: e.target.value as TemplateStyle['fontFamily'] })}>
                    <option value="sans">Sans-serif</option>
                    <option value="serif">Serif</option>
                    <option value="mono">Monospace</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Document Font Size</label>
                  <select className="mt-1 w-full border rounded-md p-2 text-sm" value={template.style.bodyFontSize} onChange={(e) => updateStyle({ bodyFontSize: e.target.value as TemplateStyle['bodyFontSize'] })}>
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Border Color</label>
                  <input type="color" className="w-full h-9 border rounded-md" value={template.style.borderColor} onChange={(e) => updateStyle({ borderColor: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Border Width</label>
                  <select className="mt-1 w-full border rounded-md p-2 text-sm" value={template.style.borderWidth} onChange={(e) => updateStyle({ borderWidth: e.target.value as TemplateStyle['borderWidth'] })}>
                    <option value="thin">Thin</option>
                    <option value="thick">Thick</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Logo Position</label>
                  <select className="mt-1 w-full border rounded-md p-2 text-sm" value={template.style.logoPosition} onChange={(e) => updateStyle({ logoPosition: e.target.value as TemplateStyle['logoPosition'] })}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Logo Size</label>
                  <select className="mt-1 w-full border rounded-md p-2 text-sm" value={template.style.logoSize} onChange={(e) => updateStyle({ logoSize: e.target.value as TemplateStyle['logoSize'] })}>
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Page Margin</label>
                <select className="mt-1 w-full border rounded-md p-2 text-sm" value={template.style.pageMargin} onChange={(e) => updateStyle({ pageMargin: e.target.value as TemplateStyle['pageMargin'] })}>
                  <option value="compact">Compact</option>
                  <option value="normal">Normal</option>
                  <option value="spacious">Spacious</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Watermark</span>
                <Switch isSelected={!!template.style.showWatermark} onValueChange={(v) => updateStyle({ showWatermark: v })} />
              </div>
              {template.style.showWatermark && (
                <Input
                  label="Watermark Text"
                  value={template.style.watermarkText || ''}
                  onChange={(e) => updateStyle({ watermarkText: e.target.value })}
                />
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="border-0 shadow-md md:col-span-2">
        <CardBody>
          {tab === 'style' ? (
            <p className="text-sm text-gray-500">Global style controls are on the left — switch to the "Blocks" tab to configure an individual block.</p>
          ) : selectedBlock ? (
            <BlockSettings
              block={selectedBlock}
              onChange={(patch) => updateBlock(selectedBlock.id, patch)}
              hasLegacyHeaderBlock={template.blocks.some(b => HEADER_TYPES.includes(b.type))}
              parentDirection={(() => {
                const parent = findParentInTree(template.blocks, selectedBlock.id);
                return parent?.type === 'container' ? (parent.direction || 'row') : null;
              })()}
            />
          ) : (
            <p className="text-sm text-gray-500">Select a block on the left to configure it.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function BlockSettings({ block, onChange, hasLegacyHeaderBlock, parentDirection }: {
  block: BlockConfig;
  onChange: (patch: Partial<BlockConfig>) => void;
  hasLegacyHeaderBlock: boolean;
  /** 'row' | 'column' if this block's immediate parent is a container, else null. */
  parentDirection: 'row' | 'column' | null;
}) {
  // Mirrors blockRenderer.ts's conditional: 'logo' only joins the legacy header
  // row (and thus loses the normal per-block controls) when a legacy
  // company-info/doc-meta block is also present in this same template.
  const isHeaderBlock = HEADER_TYPES.includes(block.type) || (hasLegacyHeaderBlock && block.type === 'logo');
  return (
    <div className="space-y-4">
      <h4 className="font-semibold">{BLOCK_LABELS[block.type]}</h4>

      {block.type === 'container' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600">Direction</label>
            <select className="mt-1 w-full border rounded-md p-2 text-sm" value={block.direction || 'row'} onChange={(e) => onChange({ direction: e.target.value as BlockConfig['direction'] })}>
              <option value="row">Row (side-by-side)</option>
              <option value="column">Column (stacked)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Gap</label>
            <select className="mt-1 w-full border rounded-md p-2 text-sm" value={block.gap || 'medium'} onChange={(e) => onChange({ gap: e.target.value as BlockConfig['gap'] })}>
              <option value="none">None</option>
              <option value="small">Small</option>
              <option value="medium">Medium (default)</option>
              <option value="large">Large</option>
            </select>
          </div>
          <p className="text-xs text-gray-500 col-span-2">Add blocks inside it below — each can be a Column Width too (only matters in Row direction), and can itself be another Layout Container for nested layouts.</p>
        </div>
      )}

      {parentDirection === 'row' && (
        <div>
          <label className="text-xs text-gray-600">Column Width</label>
          <select className="mt-1 w-full border rounded-md p-2 text-sm" value={block.flexWeight || 1} onChange={(e) => onChange({ flexWeight: Number(e.target.value) as BlockConfig['flexWeight'] })}>
            <option value={1}>1x (default)</option>
            <option value={2}>2x wider</option>
            <option value={3}>3x wider</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Relative to its siblings in this row — e.g. 2x next to a 1x sibling splits roughly 67/33.</p>
        </div>
      )}

      {(block.type === 'recipient-info' || block.type === 'bank-details' || block.type === 'guest-details' || block.type === 'stay-details') && (
        <Input
          label={block.type === 'recipient-info' && block.recipientDisplay === 'letter' ? 'Attention Line Label (e.g. "ATTN")' : 'Heading'}
          value={block.heading || ''}
          onChange={(e) => onChange({ heading: e.target.value })}
        />
      )}

      {block.type === 'recipient-info' && (
        <div>
          <label className="text-xs text-gray-600">Display As</label>
          <select className="mt-1 w-full border rounded-md p-2 text-sm" value={block.recipientDisplay || 'box'} onChange={(e) => onChange({ recipientDisplay: e.target.value as BlockConfig['recipientDisplay'] })}>
            <option value="box">Bordered Card (default)</option>
            <option value="letter">Cover Letter (name, attention line, "Dear Sir/Madam,")</option>
          </select>
        </div>
      )}

      {block.type === 'line-items-table' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">Display As</label>
            <select className="mt-1 w-full border rounded-md p-2 text-sm" value={block.lineItemsDisplay || 'table'} onChange={(e) => onChange({ lineItemsDisplay: e.target.value as BlockConfig['lineItemsDisplay'] })}>
              <option value="table">Table (grid with columns)</option>
              <option value="list">Itemized List (line + dotted leader + amount)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">{block.lineItemsDisplay === 'list' ? 'Details Shown Per Line' : 'Visible Columns'}</label>
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
          <p className="text-xs text-gray-500">Payment Voucher data automatically renders as a Debit/Credit table instead, regardless of these settings.</p>
        </div>
      )}

      {block.type === 'signature-block' && (
        <div>
          <label className="text-xs text-gray-600">Signature Boxes</label>
          <div className="space-y-2 mt-1">
            {(block.signatures || []).map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 border rounded-md p-2 text-sm"
                  placeholder="Label"
                  value={s.label}
                  onChange={(e) => {
                    const next = [...(block.signatures || [])];
                    next[i] = { ...next[i], label: e.target.value };
                    onChange({ signatures: next });
                  }}
                />
                <input
                  className="flex-1 border rounded-md p-2 text-sm"
                  placeholder="Role (optional)"
                  value={s.role || ''}
                  onChange={(e) => {
                    const next = [...(block.signatures || [])];
                    next[i] = { ...next[i], role: e.target.value };
                    onChange({ signatures: next });
                  }}
                />
                <button
                  className="text-red-500 text-sm px-2"
                  onClick={() => onChange({ signatures: (block.signatures || []).filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="text-sm text-ghana-green"
              onClick={() => onChange({ signatures: [...(block.signatures || []), { label: 'Signature' }] })}
            >
              + Add signature box
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">If the document being printed carries actual signed names/dates, those are shown instead of blank boxes automatically.</p>
        </div>
      )}

      {block.type === 'terms-conditions' && (
        <div>
          <label className="text-xs text-gray-600">Sections</label>
          <div className="space-y-3 mt-1">
            {(block.termsSections || []).map((s, i) => (
              <div key={i} className="border rounded-md p-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    className="flex-1 border rounded-md p-2 text-sm"
                    placeholder="Section heading, e.g. Checkout Protocol"
                    value={s.heading}
                    onChange={(e) => {
                      const next = [...(block.termsSections || [])];
                      next[i] = { ...next[i], heading: e.target.value };
                      onChange({ termsSections: next });
                    }}
                  />
                  <button
                    className="text-red-500 text-sm px-2"
                    onClick={() => onChange({ termsSections: (block.termsSections || []).filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  className="w-full border rounded-md p-2 text-sm"
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
            <button
              className="text-sm text-ghana-green"
              onClick={() => onChange({ termsSections: [...(block.termsSections || []), { heading: 'New Section', body: '' }] })}
            >
              + Add section
            </button>
          </div>
        </div>
      )}

      {(block.type === 'notes-text' || block.type === 'custom-text') && (
        <Textarea
          label={block.type === 'notes-text' ? 'Static text (used when no footer notes are supplied)' : 'Text'}
          value={block.text || ''}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="You can use {{org.name}}, {{docNumber}}, {{docDate}}, {{guest.name}}, {{totals.grandTotal}}, {{paymentTerms}}"
        />
      )}

      {(block.type === 'doc-meta' || block.type === 'doc-number') && (
        <Input label='Document Number Label (default "No.")' value={block.docNumberLabel || ''} onChange={(e) => onChange({ docNumberLabel: e.target.value })} placeholder="e.g. CheckOut No., Ref No., Quote No." />
      )}

      {block.type === 'matrix-table' && (
        <p className="text-sm text-gray-500">Renders a day-by-day breakdown (dates as columns, e.g. Accommodation/Dinner/Lunch as rows) when the document was built from a daily schedule with "Rate by package" off — falls back to nothing if the document has no daily schedule.</p>
      )}

      {block.type === 'schedule-table' && (
        <p className="text-sm text-gray-500">The mirror image of Matrix Table — dates as rows grouped under each line item (e.g. Lodging spanning 4 nights) instead of dates as columns. Falls back to nothing if the document has no row-based schedule data.</p>
      )}

      {block.type === 'totals-summary' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">Display As</label>
            <select className="mt-1 w-full border rounded-md p-2 text-sm" value={block.totalsDisplay || 'table'} onChange={(e) => onChange({ totalsDisplay: e.target.value as BlockConfig['totalsDisplay'] })}>
              <option value="table">Table</option>
              <option value="numbered-list">Numbered List — "(i) Tax Exclusive Value…"</option>
              <option value="compact-taxes">Compact — Taxes Exclusive / Sales Taxes Incl. / Total Inclusive</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Show amount in words</span>
            <Switch isSelected={!!block.showAmountInWords} onValueChange={(v) => onChange({ showAmountInWords: v })} />
          </div>
        </div>
      )}

      {block.type === 'totals-grandtotal' && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Show amount in words</span>
          <Switch isSelected={!!block.showAmountInWords} onValueChange={(v) => onChange({ showAmountInWords: v })} />
        </div>
      )}

      {isHeaderBlock ? (
        <p className="text-sm text-gray-500">
          {block.type === 'logo'
            ? 'This template still has a legacy Company Info / Document Meta block, so Logo shares its row with them. Remove those legacy blocks (replace with the granular Company Name / Document Title, …) to unlock Logo\'s own Alignment/Border/Position controls and group it with any block you choose.'
            : 'This is a legacy bundled block (Company Info / Document Meta) — it shares its own row with Logo and any other legacy bundled blocks. Use the granular blocks (Company Name, Document Title, …) instead for full control.'}
        </p>
      ) : (
        <>
          <div className="border-t pt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Alignment</label>
              <select className="mt-1 w-full border rounded-md p-2 text-sm" value={block.align || 'left'} onChange={(e) => onChange({ align: e.target.value as BlockConfig['align'] })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Position</label>
              <select className="mt-1 w-full border rounded-md p-2 text-sm" value={block.columnSpan || 'full'} onChange={(e) => onChange({ columnSpan: e.target.value as BlockConfig['columnSpan'] })}>
                <option value="full">Full width</option>
                <option value="half">Share a row</option>
              </select>
            </div>
          </div>
          {block.columnSpan === 'half' && (
            <p className="text-xs text-gray-500">Groups with any neighboring blocks above/below it also set to "Share a row" — 2 makes 2 columns, 3 makes 3, and so on, split evenly. For a column that holds more than one stacked block, or uneven widths, use a Layout Container instead.</p>
          )}
          {(() => {
            const selfBoxed = SELF_BORDERED_TYPES.includes(block.type);
            const borderValue = block.border || (selfBoxed ? 'thin' : 'none');
            return (
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="text-xs text-gray-600">Border</label>
                  <select className="mt-1 w-full border rounded-md p-2 text-sm" value={borderValue} onChange={(e) => onChange({ border: e.target.value as BlockConfig['border'] })}>
                    <option value="none">None</option>
                    <option value="thin">Thin{selfBoxed ? ' (default)' : ''}</option>
                    <option value="thick">Thick</option>
                  </select>
                </div>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm text-gray-700">Underline</span>
                  <Switch isSelected={!!block.underline} onValueChange={(v) => onChange({ underline: v })} />
                </div>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm text-gray-700">Divider Below</span>
                  <Switch isSelected={!!block.dividerBelow} onValueChange={(v) => onChange({ dividerBelow: v })} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Spacing Above</label>
                  <select className="mt-1 w-full border rounded-md p-2 text-sm" value={block.spacing || 'default'} onChange={(e) => onChange({ spacing: e.target.value === 'default' ? undefined : e.target.value as BlockConfig['spacing'] })}>
                    <option value="default">Default</option>
                    <option value="none">None (flush against previous block)</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Indent</label>
                  <select className="mt-1 w-full border rounded-md p-2 text-sm" value={block.indent || 'none'} onChange={(e) => onChange({ indent: e.target.value === 'none' ? undefined : e.target.value as BlockConfig['indent'] })}>
                    <option value="none">None</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Font Size</label>
                  <select className="mt-1 w-full border rounded-md p-2 text-sm" value={block.style?.fontSize || 'md'} onChange={(e) => onChange({ style: { ...block.style, fontSize: e.target.value as 'sm' | 'md' | 'lg' } })}>
                    <option value="sm">Small</option>
                    <option value="md">Default</option>
                    <option value="lg">Large</option>
                  </select>
                </div>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm text-gray-700">Bold</span>
                  <Switch isSelected={!!block.style?.bold} onValueChange={(v) => onChange({ style: { ...block.style, bold: v } })} />
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
