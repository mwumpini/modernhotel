'use client';

import React, { useState } from 'react';
import { Button, Chip, Tabs, Tab } from '@heroui/react';
import { deskBookTabsClassNames } from '../dashboard/deskTabsUi';
import { useSettingsStore } from '../../lib/settings/store';
import type { BlockTemplate } from '../../lib/print/blocks';
import type { PrintType } from '../../lib/print/templates';
import { getSampleData } from '../../lib/print/sampleData';
import { buildOrgProfile } from '../../lib/print/buildOrgProfile';
import TemplateGallery from './templateBuilder/TemplateGallery';
import BlockEditor from './templateBuilder/BlockEditor';
import TemplatePreview from './templateBuilder/TemplatePreview';
import { DEFAULT_TEMPLATE_STYLE } from '../../lib/print/blocks';

interface DocTypeOption { key: PrintType; label: string }
interface LegOption { key: 'accommodation' | 'events'; label: string; icon: string; types: DocTypeOption[] }
interface FamilyOption { key: 'general' | 'restaurant' | 'events' | 'payment-voucher' | 'payroll'; label: string; icon: string; types?: DocTypeOption[]; legs?: LegOption[] }

// Three real "families" of documents, matching how the business actually thinks
// about them: guests staying/eating at the hotel, events & conferences (itself
// split into its own Accommodation and Conference & Events legs — see
// EventsConferencesMainDashboard's document splitting), and payment vouchers
// (vendor payments — not guest billing, so it stands alone).
const FAMILIES: FamilyOption[] = [
  {
    key: 'general', icon: '🏨', label: 'Accommodation & Front Desk',
    types: [
      { key: 'invoice', label: 'Invoice' },
      { key: 'receipt', label: 'Receipt' },
      { key: 'proforma', label: 'Proforma / Quotation' },
      { key: 'registration-card', label: 'Registration Card' },
    ],
  },
  {
    key: 'restaurant', icon: '🍽️', label: 'Restaurant & Bar',
    types: [
      { key: 'fb-receipt', label: 'Receipt' },
    ],
  },
  {
    key: 'events', icon: '🎪', label: 'Events & Conferences',
    legs: [
      {
        key: 'accommodation', icon: '🛏️', label: 'Accommodation',
        types: [
          { key: 'accommodation-proforma', label: 'Proforma / Quotation' },
          { key: 'accommodation-invoice', label: 'Invoice' },
          { key: 'accommodation-receipt', label: 'Receipt' },
        ],
      },
      {
        key: 'events', icon: '🎤', label: 'Conference & Events',
        types: [
          { key: 'event-proforma', label: 'Proforma / Quotation' },
          { key: 'event-invoice', label: 'Invoice' },
          { key: 'event-receipt', label: 'Receipt' },
          { key: 'event-contract', label: 'Contract' },
        ],
      },
    ],
  },
  {
    key: 'payment-voucher', icon: '🧾', label: 'Payment Voucher',
    types: [{ key: 'payment-voucher', label: 'Payment Voucher' }],
  },
  {
    key: 'payroll', icon: '💰', label: 'Payroll',
    types: [{ key: 'payslip', label: 'Payslip' }],
  },
];

function previewSample(docType: PrintType, org: Parameters<typeof getSampleData>[1], staffName?: string) {
  return {
    attendantName: 'Abena Serwaa',
    userName: staffName || 'Admin User',
    ...getSampleData(docType, org),
  };
}

function locateDocType(docType: PrintType): { family: FamilyOption; leg?: LegOption } {
  for (const family of FAMILIES) {
    if (family.types?.some(t => t.key === docType)) return { family };
    for (const leg of family.legs || []) {
      if (leg.types.some(t => t.key === docType)) return { family, leg };
    }
  }
  return { family: FAMILIES[0] };
}

function newBlankTemplate(docType: PrintType): BlockTemplate {
  const now = new Date().toISOString();
  // Granular fields only — each one can be renamed, restyled, or removed.
  // Legacy bundled blocks (company-info, doc-meta, …) stay readable on old
  // templates but a new form should start as pieces the builder can actually edit.
  const blocks: BlockTemplate['blocks'] = docType === 'payslip'
    ? [
        { id: 'company-name', type: 'company-name', visible: true, order: 0, align: 'center', style: { fontSize: 'lg', bold: true } },
        { id: 'company-address', type: 'company-address', visible: true, order: 1, align: 'center' },
        { id: 'doc-title', type: 'doc-title', visible: true, order: 2, align: 'center' },
        { id: 'employee-details', type: 'employee-details', visible: true, order: 3 },
        { id: 'payslip-earnings-table', type: 'payslip-earnings-table', visible: true, order: 4, columnSpan: 'half' },
        { id: 'payslip-deductions-table', type: 'payslip-deductions-table', visible: true, order: 5, columnSpan: 'half' },
        { id: 'payslip-summary', type: 'payslip-summary', visible: true, order: 6, showAmountInWords: true },
        { id: 'signature-block', type: 'signature-block', visible: true, order: 7, signatureParties: 'custom', signatures: [{ label: 'Employer Signature' }, { label: 'Employee Signature' }] },
        { id: 'terms-conditions', type: 'terms-conditions', visible: true, order: 8, termsSections: [{ heading: 'Terms & Conditions', body: '' }] },
        { id: 'notes-text', type: 'notes-text', visible: true, order: 9 },
      ]
    : [
        { id: 'logo', type: 'logo', visible: true, order: 0, align: 'center' },
        { id: 'company-name', type: 'company-name', visible: true, order: 1, align: 'center', style: { fontSize: 'lg', bold: true } },
        { id: 'company-address', type: 'company-address', visible: true, order: 2, align: 'center' },
        { id: 'company-contact', type: 'company-contact', visible: true, order: 3, align: 'center' },
        { id: 'doc-title', type: 'doc-title', visible: true, order: 4, align: 'center', underline: true, style: { bold: true } },
        { id: 'doc-number', type: 'doc-number', visible: true, order: 5 },
        { id: 'doc-date', type: 'doc-date', visible: true, order: 6 },
        { id: 'guest-details', type: 'guest-details', visible: true, order: 7, heading: 'Bill To' },
        { id: 'line-items-table', type: 'line-items-table', visible: true, order: 8, columns: ['qty', 'unit', 'unitPrice'] },
        { id: 'totals-grandtotal', type: 'totals-grandtotal', visible: true, order: 9, showAmountInWords: true },
        { id: 'signature-block', type: 'signature-block', visible: true, order: 10, signatureParties: 'staff-guest', guestSignature: 'auto' },
        { id: 'terms-conditions', type: 'terms-conditions', visible: true, order: 11, termsSections: [{ heading: 'Terms & Conditions', body: '' }] },
        { id: 'notes-text', type: 'notes-text', visible: true, order: 12 },
      ];
  return {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    docType,
    name: 'New Template',
    isBuiltIn: false,
    blocks,
    style: { ...DEFAULT_TEMPLATE_STYLE },
    createdAt: now,
    updatedAt: now,
  };
}

export default function DocumentTemplatesPanel() {
  const settingsStore = useSettingsStore();
  const canManageTemplates = settingsStore.hasPermission('settings.manage-templates');
  const [docType, setDocType] = useState<PrintType>('invoice');
  const [draft, setDraft] = useState<BlockTemplate | null>(null);
  const [previewing, setPreviewing] = useState<BlockTemplate | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const { family: activeFamily, leg: activeLeg } = locateDocType(docType);
  // Real org profile (name, address, logo, …) so the preview shows what will
  // actually print, not a placeholder — reactive since settingsStore is the
  // full store subscription above.
  const previewOrg = buildOrgProfile(settingsStore);
  const signedIn = settingsStore.currentUser;
  const staffName = `${signedIn?.firstName || ''} ${signedIn?.lastName || ''}`.trim() || signedIn?.email || signedIn?.username;

  const goToDocType = (key: PrintType) => {
    setDocType(key);
    setDraft(null);
    setPreviewing(null);
  };

  const selectFamily = (family: FamilyOption) => {
    const firstType = family.legs ? family.legs[0].types[0] : family.types?.[0];
    if (firstType) goToDocType(firstType.key);
  };

  const selectLeg = (leg: LegOption) => {
    goToDocType(leg.types[0].key);
  };

  const startView = (template: BlockTemplate) => {
    setPreviewing(template);
    setDraft(null);
  };

  const startEdit = (template: BlockTemplate) => {
    if (template.isBuiltIn) {
      // Built-ins are read-only — editing clones into a new custom template.
      const now = new Date().toISOString();
      setDraft({
        ...template,
        id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${template.name} (Custom)`,
        isBuiltIn: false,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      setDraft(template);
    }
    setPreviewing(null);
    setSavedAt(null);
  };

  const startNew = () => {
    setDraft(newBlankTemplate(docType));
    setPreviewing(null);
    setSavedAt(null);
  };

  const setActiveTemplate = (template: BlockTemplate) => {
    if (!canManageTemplates) { alert('You do not have permission to manage document templates.'); return; }
    settingsStore.updateNestedSetting(`printing.${template.docType}`, template.id);
  };

  const save = (setActive: boolean) => {
    if (!canManageTemplates) { alert('You do not have permission to manage document templates.'); return; }
    if (!draft) return;
    const exists = settingsStore.getDocBuilderTemplate(draft.id);
    if (exists) {
      settingsStore.updateDocBuilderTemplate(draft.id, draft);
    } else {
      settingsStore.addDocBuilderTemplate(draft);
    }
    if (setActive) {
      settingsStore.updateNestedSetting(`printing.${draft.docType}`, draft.id);
    }
    setSavedAt(Date.now());
  };

  return (
    <div className="mt-2 space-y-3">
      <div>
        <h3 className="text-lg font-semibold">Document Templates</h3>
        <p className="text-xs text-gray-600">
          <strong>Accommodation &amp; Front Desk</strong> covers room and front-desk documents.{' '}
          <strong>Restaurant &amp; Bar</strong> has its own receipt, and that is the one the POS prints.{' '}
          <strong>Events &amp; Conferences</strong> stays separate, split into Accommodation and Conference &amp; Events.
        </p>
      </div>

      <div className="space-y-2 border-b pb-3">
        <Tabs
          aria-label="Document family"
          size="sm"
          variant="solid"
          classNames={deskBookTabsClassNames}
          selectedKey={activeFamily.key}
          onSelectionChange={(key) => {
            const family = FAMILIES.find(f => f.key === key);
            if (family) selectFamily(family);
          }}
        >
          {FAMILIES.map(family => {
            const isActiveFamily = family.key === activeFamily.key;
            const legForTab = isActiveFamily ? activeLeg : family.legs?.[0];
            const typesForTab = legForTab?.types || family.types || [];
            return (
              <Tab key={family.key} title={`${family.icon} ${family.label}`}>
                <div className="space-y-2 pt-2">
                  {family.legs && (
                    <div className="flex w-fit items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 p-1">
                      {family.legs.map(leg => (
                        <button
                          key={leg.key}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            legForTab?.key === leg.key ? 'bg-white shadow-sm text-ghana-black' : 'text-amber-900/70 hover:text-amber-900'
                          }`}
                          onClick={() => selectLeg(leg)}
                        >
                          {leg.icon} {leg.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {typesForTab.map(dt => (
                      <button
                        key={dt.key}
                        className={`text-sm px-3 py-1.5 rounded-full ${docType === dt.key && !draft ? 'bg-ghana-green text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => goToDocType(dt.key)}
                      >
                        {dt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Tab>
            );
          })}
        </Tabs>
      </div>

      {draft ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="light" onPress={() => setDraft(null)}>← Back to Gallery</Button>
              {savedAt && <Chip color="success" variant="flat" size="sm">Saved</Chip>}
            </div>
            <div className="flex gap-2">
              <Button variant="flat" onPress={() => save(false)} isDisabled={!canManageTemplates}>Save</Button>
              <Button color="primary" onPress={() => save(true)} isDisabled={!canManageTemplates}>Save &amp; Set Active</Button>
            </div>
          </div>
          <BlockEditor
            template={draft}
            onChange={setDraft}
            sampleData={previewSample(draft.docType, previewOrg, staffName)}
          />
        </div>
      ) : previewing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="light" onPress={() => setPreviewing(null)}>← Back to Gallery</Button>
              <h4 className="font-semibold text-ghana-black">{previewing.name}</h4>
              {settingsStore.printing[previewing.docType] === previewing.id && (
                <Chip color="success" variant="flat" size="sm">Active</Chip>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="flat" onPress={() => startEdit(previewing)}>Edit this template</Button>
              <Button color="primary" onPress={() => setActiveTemplate(previewing)} isDisabled={!canManageTemplates}>Set Active</Button>
            </div>
          </div>
          <TemplatePreview template={previewing} sampleData={previewSample(previewing.docType, previewOrg, staffName)} />
        </div>
      ) : (
        <TemplateGallery docType={docType} onEdit={startEdit} onView={startView} onCreateNew={startNew} />
      )}
    </div>
  );
}
