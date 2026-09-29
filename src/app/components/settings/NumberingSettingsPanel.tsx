'use client';

import React from 'react';
import HeadingInfo from '../HeadingInfo';
import { Card, CardBody, Input, Button, Chip, Tabs, Tab } from '@heroui/react';
import { formatDocumentNumber, useSettingsStore } from '../../lib/settings/store';
import { deskBookTabsClassNames } from '../dashboard/deskTabsUi';

/**
 * Common numbering patterns so most series can be set without typing token syntax
 * by hand. Values use the {PREFIX} token (not the literal prefix text) so a preset
 * stays selected — and correct — if the Prefix field is edited afterwards; the
 * prefix only appears in the human-readable example.
 */
const FORMAT_PRESETS = (prefix: string) => {
  const p = prefix || 'PREFIX';
  const yy = String(new Date().getFullYear()).slice(-2);
  return [
    { value: '{PREFIX}{NUMBER}', label: `Number (e.g. ${p}100001)` },
    { value: '{PREFIX}{YY}{NUMBER}', label: `Year number (e.g. ${p}${yy}00001)` },
    { value: '{PREFIX}-{YEAR}-{NUMBER}', label: `Long year (e.g. ${p}-2026-1002)` },
    { value: '{PREFIX}-{NUMBER}', label: `Prefix-Number (e.g. ${p}-1002)` },
    { value: '{YEAR}-{PREFIX}-{NUMBER}', label: `Year-Prefix-Number (e.g. 2026-${p}-1002)` },
    { value: '{PREFIX}/{YEAR}/{NUMBER}', label: `Prefix/Year/Number (e.g. ${p}/2026/1002)` },
  ];
};

function simpleSeries(prefix: string) {
  return { prefix, suffix: '', nextNumber: 100001, numberFormat: '{PREFIX}{NUMBER}' };
}

/**
 * System-wide document numbering. Relocated out of the first-run setup wizard so
 * the wizard stays lean — every series has a sensible default and is rarely
 * changed, which makes Settings the right home for it.
 */
const DEFAULT_MODULE_NUMBERING = {
  frontOffice: {
    folio: simpleSeries('FOL'),
    housekeepingTicket: simpleSeries('HK'),
    serviceCharge: simpleSeries('SC'),
    corporateGuest: simpleSeries('C'),
    personalGuest: simpleSeries('P'),
  },
  foodBeverage: {
    order: simpleSeries('ORD'),
    kitchenOrderTicket: simpleSeries('KOT'),
    barOrderTicket: simpleSeries('BOT'),
  },
  inventory: {
    stockItem: simpleSeries('ITM'),
    purchaseOrder: simpleSeries('PO'),
    requisition: simpleSeries('REQ'),
    stockTransfer: simpleSeries('ST'),
    goodsIssue: simpleSeries('ISS'),
    goodsReceipt: simpleSeries('GRN'),
    stockCount: simpleSeries('CNT'),
  },
  accounting: {
    creditNote: simpleSeries('CN'),
    debitNote: simpleSeries('DN'),
  },
  events: {
    eventBooking: simpleSeries('EVT'),
    quotation: simpleSeries('QT'),
  },
  maintenance: {
    workOrder: simpleSeries('WO'),
    inspection: simpleSeries('INSP'),
  },
  security: {
    incidentReport: simpleSeries('INC'),
    accessPass: simpleSeries('PASS'),
  },
  hr: {
    employeeId: simpleSeries('EMP'),
    timesheet: simpleSeries('TS'),
  },
};

type NumberingTab =
  | 'accounting'
  | 'frontOffice'
  | 'fb'
  | 'inventory'
  | 'events'
  | 'ops';

function Trio({
  label,
  prefix,
  suffix = '',
  format,
  next,
  pad = 4,
  onPrefix,
  onSuffix,
  onFormat,
  onNext,
}: {
  label: string;
  prefix: string;
  suffix?: string;
  format: string;
  next: number;
  pad?: number;
  onPrefix: (v: string) => void;
  onSuffix: (v: string) => void;
  onFormat: (v: string) => void;
  onNext: (v: number) => void;
}) {
  const presets = FORMAT_PRESETS(prefix);
  const matchesPreset = presets.some((p) => p.value === format);
  const [customOn, setCustomOn] = React.useState(!matchesPreset);
  const showCustom = customOn || !matchesPreset;
  const preview = formatDocumentNumber(
    { prefix, suffix, numberFormat: format || '{PREFIX}-{NUMBER}', nextNumber: next },
    pad
  );
  const missingNumber = !String(format || '').includes('{NUMBER}');
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 space-y-1.5">
      <p className="text-xs font-semibold text-ghana-black">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          size="sm"
          label="Prefix"
          labelPlacement="outside"
          value={prefix}
          onChange={(e) => onPrefix(e.target.value)}
        />
        <Input
          size="sm"
          type="number"
          label="Next"
          labelPlacement="outside"
          value={String(next ?? '')}
          onChange={(e) => onNext(Number(e.target.value))}
        />
      </div>
      <div>
        <label className="text-[11px] text-gray-600">Format</label>
        <select
          className="mt-0.5 w-full rounded-md border p-1.5 text-xs"
          aria-label={`${label} Format`}
          value={showCustom ? 'custom' : format}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              setCustomOn(true);
              return;
            }
            setCustomOn(false);
            onFormat(e.target.value);
          }}
        >
          {presets.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {showCustom && (
          <>
            <input
              type="text"
              aria-label={`${label} custom format`}
              className="mt-1.5 w-full rounded-md border p-1.5 text-xs"
              value={format}
              onChange={(e) => onFormat(e.target.value)}
              placeholder="{PREFIX}-{YEAR}-{NUMBER}{SUFFIX}"
            />
            <input
              type="text"
              aria-label={`${label} Suffix`}
              className="mt-1.5 w-full rounded-md border p-1.5 text-xs"
              value={suffix}
              onChange={(e) => onSuffix(e.target.value)}
              placeholder="Suffix — used by {SUFFIX}"
            />
          </>
        )}
        <p className={`mt-0.5 text-[11px] ${missingNumber ? 'text-danger' : 'text-gray-500'}`}>
          {missingNumber ? 'Format must include {NUMBER}. ' : ''}
          Next: <span className="font-mono">{preview}</span>
        </p>
      </div>
    </div>
  );
}

function SeriesGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export default function NumberingSettingsPanel() {
  const settings = useSettingsStore();
  const updateNestedSetting = useSettingsStore((s) => s.updateNestedSetting);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const canManageNumbering = settings.hasPermission('settings.manage-document-numbering');
  const [activeTab, setActiveTab] = React.useState<NumberingTab>('accounting');

  const [core, setCore] = React.useState(() => ({
    invoicePrefix: settings.invoiceSettings.prefix,
    invoiceSuffix: settings.invoiceSettings.suffix || '',
    invoiceFormat: settings.invoiceSettings.numberFormat,
    invoiceNext: settings.invoiceSettings.nextNumber,
    receiptPrefix: settings.receiptSettings.prefix || 'RCP',
    receiptSuffix: settings.receiptSettings.suffix || '',
    receiptFormat: settings.receiptSettings.numberFormat || '{PREFIX}{NUMBER}',
    receiptNext: settings.receiptSettings.nextNumber || 1,
    proformaPrefix: settings.proformaInvoiceSettings.prefix || 'PRO',
    proformaSuffix: settings.proformaInvoiceSettings.suffix || '',
    proformaFormat: settings.proformaInvoiceSettings.numberFormat || '{PREFIX}{NUMBER}',
    proformaNext: settings.proformaInvoiceSettings.nextNumber || 1,
    reservationPrefix: settings.reservationSettings.prefix,
    reservationSuffix: settings.reservationSettings.suffix || '',
    reservationFormat: settings.reservationSettings.numberFormat,
    reservationNext: settings.reservationSettings.nextNumber,
    clientPrefix: settings.clientSettings.prefix,
    clientSuffix: settings.clientSettings.suffix || '',
    clientFormat: settings.clientSettings.numberFormat,
    clientNext: settings.clientSettings.nextNumber,
  }));

  const [moduleNumbering, setModuleNumbering] = React.useState<any>(() => {
    const saved = (settings as any).moduleNumbering || {};
    const merged: any = { ...DEFAULT_MODULE_NUMBERING };
    for (const category of Object.keys(DEFAULT_MODULE_NUMBERING)) {
      const savedCategory = saved[category] || {};
      merged[category] = { ...(DEFAULT_MODULE_NUMBERING as any)[category] };
      for (const series of Object.keys((DEFAULT_MODULE_NUMBERING as any)[category])) {
        merged[category][series] = {
          ...(DEFAULT_MODULE_NUMBERING as any)[category][series],
          ...(savedCategory[series] || {}),
        };
      }
    }
    return merged;
  });

  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    let done = false;
    const sync = () => {
      const live = useSettingsStore.getState();
      if (!live.hydrated || done) return;
      done = true;
      live.adoptSimpleNumberDefaults();
      const next = useSettingsStore.getState();
      setCore({
        invoicePrefix: next.invoiceSettings.prefix,
        invoiceSuffix: next.invoiceSettings.suffix || '',
        invoiceFormat: next.invoiceSettings.numberFormat,
        invoiceNext: next.invoiceSettings.nextNumber,
        receiptPrefix: next.receiptSettings.prefix || 'RCP',
        receiptSuffix: next.receiptSettings.suffix || '',
        receiptFormat: next.receiptSettings.numberFormat || '{PREFIX}{NUMBER}',
        receiptNext: next.receiptSettings.nextNumber || 1,
        proformaPrefix: next.proformaInvoiceSettings.prefix || 'PRO',
        proformaSuffix: next.proformaInvoiceSettings.suffix || '',
        proformaFormat: next.proformaInvoiceSettings.numberFormat || '{PREFIX}{NUMBER}',
        proformaNext: next.proformaInvoiceSettings.nextNumber || 1,
        reservationPrefix: next.reservationSettings.prefix,
        reservationSuffix: next.reservationSettings.suffix || '',
        reservationFormat: next.reservationSettings.numberFormat,
        reservationNext: next.reservationSettings.nextNumber,
        clientPrefix: next.clientSettings.prefix,
        clientSuffix: next.clientSettings.suffix || '',
        clientFormat: next.clientSettings.numberFormat,
        clientNext: next.clientSettings.nextNumber,
      });
      const saved = (next as any).moduleNumbering || {};
      const merged: any = {};
      for (const category of Object.keys(DEFAULT_MODULE_NUMBERING)) {
        const savedCategory = saved[category] || {};
        merged[category] = {};
        for (const series of Object.keys((DEFAULT_MODULE_NUMBERING as any)[category])) {
          merged[category][series] = {
            ...(DEFAULT_MODULE_NUMBERING as any)[category][series],
            ...(savedCategory[series] || {}),
          };
        }
      }
      setModuleNumbering(merged);
    };
    sync();
    return useSettingsStore.subscribe(sync);
  }, []);

  const setMod = (path: (m: any) => any) => setModuleNumbering((m: any) => path({ ...m }));

  const validateSeries = (label: string, format: string, next: number, priorNext: number, errors: string[]) => {
    if (!format || format.trim() === '') {
      errors.push(`${label}: format cannot be empty`);
    } else if (!format.includes('{NUMBER}')) {
      errors.push(`${label}: format must include {NUMBER}`);
    }
    if (!Number.isFinite(next) || next < 1) {
      errors.push(`${label}: next number must be at least 1`);
    } else if (next < priorNext) {
      errors.push(
        `${label}: next number can't go backwards (currently ${priorNext}) — that would reissue a number already used`
      );
    }
  };

  const handleSave = () => {
    if (!canManageNumbering) {
      alert('You do not have permission to configure document numbering.');
      return;
    }
    const errors: string[] = [];
    validateSeries('Invoice', core.invoiceFormat, Number(core.invoiceNext), settings.invoiceSettings.nextNumber, errors);
    validateSeries('Receipt', core.receiptFormat, Number(core.receiptNext), settings.receiptSettings.nextNumber || 1, errors);
    validateSeries(
      'Proforma',
      core.proformaFormat,
      Number(core.proformaNext),
      settings.proformaInvoiceSettings.nextNumber || 1,
      errors
    );
    validateSeries(
      'Reservation',
      core.reservationFormat,
      Number(core.reservationNext),
      settings.reservationSettings.nextNumber,
      errors
    );
    validateSeries('Guest Profile', core.clientFormat, Number(core.clientNext), settings.clientSettings.nextNumber, errors);
    const priorMod = (settings as any).moduleNumbering || DEFAULT_MODULE_NUMBERING;
    for (const category of Object.keys(moduleNumbering)) {
      for (const series of Object.keys(moduleNumbering[category])) {
        const pattern = moduleNumbering[category][series];
        const priorNext = priorMod?.[category]?.[series]?.nextNumber ?? 1;
        validateSeries(`${category}.${series}`, pattern.numberFormat, Number(pattern.nextNumber), priorNext, errors);
      }
    }
    if (errors.length > 0) {
      alert(`Please fix the following before saving:\n\n${errors.join('\n')}`);
      return;
    }
    updateNestedSetting('invoiceSettings.prefix', core.invoicePrefix);
    updateNestedSetting('invoiceSettings.suffix', core.invoiceSuffix);
    updateNestedSetting('invoiceSettings.numberFormat', core.invoiceFormat);
    updateNestedSetting('invoiceSettings.nextNumber', Number(core.invoiceNext));
    updateNestedSetting('receiptSettings.prefix', core.receiptPrefix);
    updateNestedSetting('receiptSettings.suffix', core.receiptSuffix);
    updateNestedSetting('receiptSettings.numberFormat', core.receiptFormat);
    updateNestedSetting('receiptSettings.nextNumber', Number(core.receiptNext));
    updateNestedSetting('proformaInvoiceSettings.prefix', core.proformaPrefix);
    updateNestedSetting('proformaInvoiceSettings.suffix', core.proformaSuffix);
    updateNestedSetting('proformaInvoiceSettings.numberFormat', core.proformaFormat);
    updateNestedSetting('proformaInvoiceSettings.nextNumber', Number(core.proformaNext));
    updateNestedSetting('reservationSettings.prefix', core.reservationPrefix);
    updateNestedSetting('reservationSettings.suffix', core.reservationSuffix);
    updateNestedSetting('reservationSettings.numberFormat', core.reservationFormat);
    updateNestedSetting('reservationSettings.nextNumber', Number(core.reservationNext));
    updateNestedSetting('clientSettings.prefix', core.clientPrefix);
    updateNestedSetting('clientSettings.suffix', core.clientSuffix);
    updateNestedSetting('clientSettings.numberFormat', core.clientFormat);
    updateNestedSetting('clientSettings.nextNumber', Number(core.clientNext));
    updateSetting('moduleNumbering', moduleNumbering as any);
    saveSettings();
    setSavedAt(Date.now());
  };

  const modRow = (label: string, category: string, series: string) => {
    const row = moduleNumbering[category][series];
    const set = (patch: Record<string, unknown>) =>
      setMod((m: any) => ({
        ...m,
        [category]: { ...m[category], [series]: { ...m[category][series], ...patch } },
      }));
    return (
      <Trio
        key={`${category}.${series}`}
        label={label}
        prefix={row.prefix}
        suffix={row.suffix || ''}
        format={row.numberFormat}
        next={row.nextNumber}
        onPrefix={(v) => set({ prefix: v })}
        onSuffix={(v) => set({ suffix: v })}
        onFormat={(v) => set({ numberFormat: v })}
        onNext={(v) => set({ nextNumber: v })}
      />
    );
  };

  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg font-semibold">Document Numbering</h3>
          <HeadingInfo label="About document numbering">
            Prefixes, formats, and next numbers for every document series. Tokens: {'{PREFIX}'}, {'{YEAR}'},{' '}
            {'{NUMBER}'}, {'{SUFFIX}'}.
          </HeadingInfo>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <Chip color="success" variant="flat" size="sm">
              Saved
            </Chip>
          )}
          <Button color="primary" size="sm" onPress={handleSave} isDisabled={!canManageNumbering}>
            Save Numbering
          </Button>
        </div>
      </div>

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as NumberingTab)}
        size="sm"
        variant="solid"
        classNames={deskBookTabsClassNames}
        aria-label="Document numbering modules"
      >
        <Tab key="accounting" title="Accounting" />
        <Tab key="frontOffice" title="Front Office" />
        <Tab key="fb" title="F&B" />
        <Tab key="inventory" title="Inventory" />
        <Tab key="events" title="Events" />
        <Tab key="ops" title="Maint. / Security / HR" />
      </Tabs>

      <Card className="border border-gray-200 shadow-none">
        <CardBody className="p-3">
          {activeTab === 'accounting' && (
            <SeriesGrid>
              <Trio
                label="Invoice"
                prefix={core.invoicePrefix}
                suffix={core.invoiceSuffix}
                format={core.invoiceFormat}
                next={core.invoiceNext}
                onPrefix={(v) => setCore((c) => ({ ...c, invoicePrefix: v }))}
                onSuffix={(v) => setCore((c) => ({ ...c, invoiceSuffix: v }))}
                onFormat={(v) => setCore((c) => ({ ...c, invoiceFormat: v }))}
                onNext={(v) => setCore((c) => ({ ...c, invoiceNext: v }))}
              />
              <Trio
                label="Receipt"
                prefix={core.receiptPrefix}
                suffix={core.receiptSuffix}
                format={core.receiptFormat}
                next={core.receiptNext}
                onPrefix={(v) => setCore((c) => ({ ...c, receiptPrefix: v }))}
                onSuffix={(v) => setCore((c) => ({ ...c, receiptSuffix: v }))}
                onFormat={(v) => setCore((c) => ({ ...c, receiptFormat: v }))}
                onNext={(v) => setCore((c) => ({ ...c, receiptNext: v }))}
              />
              <Trio
                label="Proforma"
                prefix={core.proformaPrefix}
                suffix={core.proformaSuffix}
                format={core.proformaFormat}
                next={core.proformaNext}
                onPrefix={(v) => setCore((c) => ({ ...c, proformaPrefix: v }))}
                onSuffix={(v) => setCore((c) => ({ ...c, proformaSuffix: v }))}
                onFormat={(v) => setCore((c) => ({ ...c, proformaFormat: v }))}
                onNext={(v) => setCore((c) => ({ ...c, proformaNext: v }))}
              />
              {modRow('Credit Note', 'accounting', 'creditNote')}
              {modRow('Debit Note', 'accounting', 'debitNote')}
            </SeriesGrid>
          )}

          {activeTab === 'frontOffice' && (
            <SeriesGrid>
              <Trio
                label="Reservation"
                pad={5}
                prefix={core.reservationPrefix}
                suffix={core.reservationSuffix}
                format={core.reservationFormat}
                next={core.reservationNext}
                onPrefix={(v) => setCore((c) => ({ ...c, reservationPrefix: v }))}
                onSuffix={(v) => setCore((c) => ({ ...c, reservationSuffix: v }))}
                onFormat={(v) => setCore((c) => ({ ...c, reservationFormat: v }))}
                onNext={(v) => setCore((c) => ({ ...c, reservationNext: v }))}
              />
              {modRow('Folio', 'frontOffice', 'folio')}
              {modRow('Housekeeping', 'frontOffice', 'housekeepingTicket')}
              {modRow('Service Charge', 'frontOffice', 'serviceCharge')}
              {modRow('Corporate Guest', 'frontOffice', 'corporateGuest')}
              {modRow('Personal Guest', 'frontOffice', 'personalGuest')}
              <Trio
                label="Guest Profile"
                prefix={core.clientPrefix}
                suffix={core.clientSuffix}
                format={core.clientFormat}
                next={core.clientNext}
                onPrefix={(v) => setCore((c) => ({ ...c, clientPrefix: v }))}
                onSuffix={(v) => setCore((c) => ({ ...c, clientSuffix: v }))}
                onFormat={(v) => setCore((c) => ({ ...c, clientFormat: v }))}
                onNext={(v) => setCore((c) => ({ ...c, clientNext: v }))}
              />
            </SeriesGrid>
          )}

          {activeTab === 'fb' && (
            <SeriesGrid>
              {modRow('Order', 'foodBeverage', 'order')}
              {modRow('KOT', 'foodBeverage', 'kitchenOrderTicket')}
              {modRow('BOT', 'foodBeverage', 'barOrderTicket')}
            </SeriesGrid>
          )}

          {activeTab === 'inventory' && (
            <SeriesGrid>
              {modRow('Stock Item', 'inventory', 'stockItem')}
              {modRow('Purchase Order', 'inventory', 'purchaseOrder')}
              {modRow('Requisition', 'inventory', 'requisition')}
              {modRow('Stock Transfer', 'inventory', 'stockTransfer')}
              {modRow('Goods Issue', 'inventory', 'goodsIssue')}
              {modRow('Goods Receipt', 'inventory', 'goodsReceipt')}
              {modRow('Stock Count', 'inventory', 'stockCount')}
            </SeriesGrid>
          )}

          {activeTab === 'events' && (
            <SeriesGrid>
              {modRow('Event Booking', 'events', 'eventBooking')}
              {modRow('Quotation', 'events', 'quotation')}
            </SeriesGrid>
          )}

          {activeTab === 'ops' && (
            <SeriesGrid>
              {modRow('Work Order', 'maintenance', 'workOrder')}
              {modRow('Inspection', 'maintenance', 'inspection')}
              {modRow('Incident Report', 'security', 'incidentReport')}
              {modRow('Access Pass', 'security', 'accessPass')}
              {modRow('Employee ID', 'hr', 'employeeId')}
              {modRow('Timesheet', 'hr', 'timesheet')}
            </SeriesGrid>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
