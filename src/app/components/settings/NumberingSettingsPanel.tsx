'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody, Input, Button, Chip } from '@heroui/react';
import { useSettingsStore } from '../../lib/settings/store';

/**
 * Common numbering patterns so most series can be set without typing token syntax
 * by hand. Values use the {PREFIX} token (not the literal prefix text) so a preset
 * stays selected — and correct — if the Prefix field is edited afterwards; the
 * prefix only appears in the human-readable example.
 */
const FORMAT_PRESETS = (prefix: string) => {
  const p = prefix || 'PREFIX';
  return [
    { value: '{PREFIX}-{YEAR}-{NUMBER}', label: `Prefix-Year-Number (e.g. ${p}-2026-1002)` },
    { value: '{PREFIX}-{NUMBER}', label: `Prefix-Number (e.g. ${p}-1002)` },
    { value: '{PREFIX}{NUMBER}', label: `PrefixNumber (e.g. ${p}1002)` },
    { value: '{YEAR}-{PREFIX}-{NUMBER}', label: `Year-Prefix-Number (e.g. 2026-${p}-1002)` },
    { value: '{PREFIX}/{YEAR}/{NUMBER}', label: `Prefix/Year/Number (e.g. ${p}/2026/1002)` },
  ];
};

/**
 * System-wide document numbering. Relocated out of the first-run setup wizard so
 * the wizard stays lean — every series has a sensible default and is rarely
 * changed, which makes Settings the right home for it.
 */
const DEFAULT_MODULE_NUMBERING = {
  frontOffice: {
    folio: { prefix: 'FOL', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
    housekeepingTicket: { prefix: 'HK', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
  },
  foodBeverage: {
    order: { prefix: 'ORD', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
    kitchenOrderTicket: { prefix: 'KOT', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
  },
  inventory: {
    requisition: { prefix: 'REQ', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
    stockTransfer: { prefix: 'ST', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
    goodsReceipt: { prefix: 'GRN', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
  },
  accounting: {
    creditNote: { prefix: 'CN', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
    debitNote: { prefix: 'DN', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
  },
  events: {
    eventBooking: { prefix: 'EVT', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
    quotation: { prefix: 'QT', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
  },
  maintenance: {
    workOrder: { prefix: 'WO', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
    inspection: { prefix: 'INSP', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
  },
  security: {
    incidentReport: { prefix: 'INC', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
    accessPass: { prefix: 'PASS', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
  },
  hr: {
    employeeId: { prefix: 'EMP', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}{NUMBER}' },
    timesheet: { prefix: 'TS', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
  },
};

function Trio({ label, prefix, format, next, onPrefix, onFormat, onNext }: {
  label: string; prefix: string; format: string; next: number;
  onPrefix: (v: string) => void; onFormat: (v: string) => void; onNext: (v: number) => void;
}) {
  const presets = FORMAT_PRESETS(prefix);
  const isPreset = presets.some(p => p.value === format);
  return (
    <>
      <Input label={`${label} Prefix`} value={prefix} onChange={e => onPrefix(e.target.value)} />
      <div>
        <label className="text-xs text-gray-600">{label} Format</label>
        <select
          className="mt-1 w-full border rounded-md p-2 text-sm"
          value={isPreset ? format : 'custom'}
          onChange={e => { if (e.target.value !== 'custom') onFormat(e.target.value); }}
        >
          {presets.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          <option value="custom">Custom…</option>
        </select>
        {!isPreset && (
          <input
            type="text"
            className="mt-2 w-full border rounded-md p-2 text-sm"
            value={format}
            onChange={e => onFormat(e.target.value)}
            placeholder="e.g. {PREFIX}-{YEAR}-{NUMBER}"
          />
        )}
      </div>
      <Input type="number" label={`${label} Next`} value={String(next)} onChange={e => onNext(Number(e.target.value))} />
    </>
  );
}

export default function NumberingSettingsPanel() {
  const router = useRouter();
  const settings = useSettingsStore();
  const updateNestedSetting = useSettingsStore(s => s.updateNestedSetting);
  const updateSetting = useSettingsStore(s => s.updateSetting);
  const saveSettings = useSettingsStore(s => s.saveSettings);

  const [core, setCore] = React.useState(() => ({
    invoicePrefix: settings.invoiceSettings.prefix,
    invoiceFormat: settings.invoiceSettings.numberFormat,
    invoiceNext: settings.invoiceSettings.nextNumber,
    receiptPrefix: settings.receiptSettings.prefix || 'RCP',
    receiptFormat: settings.receiptSettings.numberFormat || 'RCP-{YEAR}-{NUMBER}',
    receiptNext: settings.receiptSettings.nextNumber || 1,
    reservationPrefix: settings.reservationSettings.prefix,
    reservationFormat: settings.reservationSettings.numberFormat,
    reservationNext: settings.reservationSettings.nextNumber,
    clientPrefix: settings.clientSettings.prefix,
    clientFormat: settings.clientSettings.numberFormat,
    clientNext: settings.clientSettings.nextNumber,
  }));

  const [moduleNumbering, setModuleNumbering] = React.useState<any>(
    () => (settings as any).moduleNumbering || DEFAULT_MODULE_NUMBERING,
  );

  const [savedAt, setSavedAt] = React.useState<number | null>(null);

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
      errors.push(`${label}: next number can't go backwards (currently ${priorNext}) — that would reissue a number already used`);
    }
  };

  const handleSave = () => {
    const errors: string[] = [];
    validateSeries('Invoice', core.invoiceFormat, Number(core.invoiceNext), settings.invoiceSettings.nextNumber, errors);
    validateSeries('Receipt', core.receiptFormat, Number(core.receiptNext), settings.receiptSettings.nextNumber || 1, errors);
    validateSeries('Reservation', core.reservationFormat, Number(core.reservationNext), settings.reservationSettings.nextNumber, errors);
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
    updateNestedSetting('invoiceSettings.numberFormat', core.invoiceFormat);
    updateNestedSetting('invoiceSettings.nextNumber', Number(core.invoiceNext));
    updateNestedSetting('receiptSettings.prefix', core.receiptPrefix);
    updateNestedSetting('receiptSettings.numberFormat', core.receiptFormat);
    updateNestedSetting('receiptSettings.nextNumber', Number(core.receiptNext));
    updateNestedSetting('reservationSettings.prefix', core.reservationPrefix);
    updateNestedSetting('reservationSettings.numberFormat', core.reservationFormat);
    updateNestedSetting('reservationSettings.nextNumber', Number(core.reservationNext));
    updateNestedSetting('clientSettings.prefix', core.clientPrefix);
    updateNestedSetting('clientSettings.numberFormat', core.clientFormat);
    updateNestedSetting('clientSettings.nextNumber', Number(core.clientNext));
    updateSetting('moduleNumbering', moduleNumbering as any);
    saveSettings();
    setSavedAt(Date.now());
  };

  return (
    <div className="space-y-6 mt-4 relative">
      <Button
        isIconOnly
        variant="light"
        className="!absolute right-0 -top-2"
        aria-label="Close document numbering"
        onPress={() => router.replace('/')}
      >
        ×
      </Button>
      <div className="flex items-center justify-between pr-10">
        <div>
          <h3 className="text-xl font-semibold">Document Numbering</h3>
          <p className="text-sm text-gray-600">Prefixes, formats, and next numbers for every document series. Tokens: {'{PREFIX}'}, {'{YEAR}'}, {'{NUMBER}'}, {'{SUFFIX}'}.</p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && <Chip color="success" variant="flat" size="sm">Saved</Chip>}
          <Button color="primary" onPress={handleSave}>Save Numbering</Button>
        </div>
      </div>

      <Card>
        <CardHeader><h4 className="font-semibold">Accounting &amp; Finance</h4></CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Trio label="Invoice" prefix={core.invoicePrefix} format={core.invoiceFormat} next={core.invoiceNext}
            onPrefix={v => setCore(c => ({ ...c, invoicePrefix: v }))} onFormat={v => setCore(c => ({ ...c, invoiceFormat: v }))} onNext={v => setCore(c => ({ ...c, invoiceNext: v }))} />
          <Trio label="Receipt" prefix={core.receiptPrefix} format={core.receiptFormat} next={core.receiptNext}
            onPrefix={v => setCore(c => ({ ...c, receiptPrefix: v }))} onFormat={v => setCore(c => ({ ...c, receiptFormat: v }))} onNext={v => setCore(c => ({ ...c, receiptNext: v }))} />
          <Trio label="Credit Note" prefix={moduleNumbering.accounting.creditNote.prefix} format={moduleNumbering.accounting.creditNote.numberFormat} next={moduleNumbering.accounting.creditNote.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, accounting: { ...m.accounting, creditNote: { ...m.accounting.creditNote, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, accounting: { ...m.accounting, creditNote: { ...m.accounting.creditNote, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, accounting: { ...m.accounting, creditNote: { ...m.accounting.creditNote, nextNumber: v } } }))} />
          <Trio label="Debit Note" prefix={moduleNumbering.accounting.debitNote.prefix} format={moduleNumbering.accounting.debitNote.numberFormat} next={moduleNumbering.accounting.debitNote.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, accounting: { ...m.accounting, debitNote: { ...m.accounting.debitNote, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, accounting: { ...m.accounting, debitNote: { ...m.accounting.debitNote, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, accounting: { ...m.accounting, debitNote: { ...m.accounting.debitNote, nextNumber: v } } }))} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h4 className="font-semibold">Front Office &amp; Guests</h4></CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Trio label="Reservation" prefix={core.reservationPrefix} format={core.reservationFormat} next={core.reservationNext}
            onPrefix={v => setCore(c => ({ ...c, reservationPrefix: v }))} onFormat={v => setCore(c => ({ ...c, reservationFormat: v }))} onNext={v => setCore(c => ({ ...c, reservationNext: v }))} />
          <Trio label="Folio" prefix={moduleNumbering.frontOffice.folio.prefix} format={moduleNumbering.frontOffice.folio.numberFormat} next={moduleNumbering.frontOffice.folio.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, frontOffice: { ...m.frontOffice, folio: { ...m.frontOffice.folio, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, frontOffice: { ...m.frontOffice, folio: { ...m.frontOffice.folio, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, frontOffice: { ...m.frontOffice, folio: { ...m.frontOffice.folio, nextNumber: v } } }))} />
          <Trio label="Guest Profile" prefix={core.clientPrefix} format={core.clientFormat} next={core.clientNext}
            onPrefix={v => setCore(c => ({ ...c, clientPrefix: v }))} onFormat={v => setCore(c => ({ ...c, clientFormat: v }))} onNext={v => setCore(c => ({ ...c, clientNext: v }))} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h4 className="font-semibold">Food &amp; Beverage</h4></CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Trio label="Order" prefix={moduleNumbering.foodBeverage.order.prefix} format={moduleNumbering.foodBeverage.order.numberFormat} next={moduleNumbering.foodBeverage.order.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, foodBeverage: { ...m.foodBeverage, order: { ...m.foodBeverage.order, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, foodBeverage: { ...m.foodBeverage, order: { ...m.foodBeverage.order, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, foodBeverage: { ...m.foodBeverage, order: { ...m.foodBeverage.order, nextNumber: v } } }))} />
          <Trio label="KOT" prefix={moduleNumbering.foodBeverage.kitchenOrderTicket.prefix} format={moduleNumbering.foodBeverage.kitchenOrderTicket.numberFormat} next={moduleNumbering.foodBeverage.kitchenOrderTicket.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, foodBeverage: { ...m.foodBeverage, kitchenOrderTicket: { ...m.foodBeverage.kitchenOrderTicket, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, foodBeverage: { ...m.foodBeverage, kitchenOrderTicket: { ...m.foodBeverage.kitchenOrderTicket, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, foodBeverage: { ...m.foodBeverage, kitchenOrderTicket: { ...m.foodBeverage.kitchenOrderTicket, nextNumber: v } } }))} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h4 className="font-semibold">Inventory &amp; Stores</h4></CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Trio label="Requisition" prefix={moduleNumbering.inventory.requisition.prefix} format={moduleNumbering.inventory.requisition.numberFormat} next={moduleNumbering.inventory.requisition.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, inventory: { ...m.inventory, requisition: { ...m.inventory.requisition, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, inventory: { ...m.inventory, requisition: { ...m.inventory.requisition, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, inventory: { ...m.inventory, requisition: { ...m.inventory.requisition, nextNumber: v } } }))} />
          <Trio label="Stock Transfer" prefix={moduleNumbering.inventory.stockTransfer.prefix} format={moduleNumbering.inventory.stockTransfer.numberFormat} next={moduleNumbering.inventory.stockTransfer.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, inventory: { ...m.inventory, stockTransfer: { ...m.inventory.stockTransfer, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, inventory: { ...m.inventory, stockTransfer: { ...m.inventory.stockTransfer, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, inventory: { ...m.inventory, stockTransfer: { ...m.inventory.stockTransfer, nextNumber: v } } }))} />
          <Trio label="Goods Receipt" prefix={moduleNumbering.inventory.goodsReceipt.prefix} format={moduleNumbering.inventory.goodsReceipt.numberFormat} next={moduleNumbering.inventory.goodsReceipt.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, inventory: { ...m.inventory, goodsReceipt: { ...m.inventory.goodsReceipt, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, inventory: { ...m.inventory, goodsReceipt: { ...m.inventory.goodsReceipt, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, inventory: { ...m.inventory, goodsReceipt: { ...m.inventory.goodsReceipt, nextNumber: v } } }))} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h4 className="font-semibold">Events, Maintenance, Security &amp; HR</h4></CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Trio label="Event Booking" prefix={moduleNumbering.events.eventBooking.prefix} format={moduleNumbering.events.eventBooking.numberFormat} next={moduleNumbering.events.eventBooking.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, events: { ...m.events, eventBooking: { ...m.events.eventBooking, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, events: { ...m.events, eventBooking: { ...m.events.eventBooking, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, events: { ...m.events, eventBooking: { ...m.events.eventBooking, nextNumber: v } } }))} />
          <Trio label="Work Order" prefix={moduleNumbering.maintenance.workOrder.prefix} format={moduleNumbering.maintenance.workOrder.numberFormat} next={moduleNumbering.maintenance.workOrder.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, maintenance: { ...m.maintenance, workOrder: { ...m.maintenance.workOrder, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, maintenance: { ...m.maintenance, workOrder: { ...m.maintenance.workOrder, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, maintenance: { ...m.maintenance, workOrder: { ...m.maintenance.workOrder, nextNumber: v } } }))} />
          <Trio label="Incident Report" prefix={moduleNumbering.security.incidentReport.prefix} format={moduleNumbering.security.incidentReport.numberFormat} next={moduleNumbering.security.incidentReport.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, security: { ...m.security, incidentReport: { ...m.security.incidentReport, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, security: { ...m.security, incidentReport: { ...m.security.incidentReport, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, security: { ...m.security, incidentReport: { ...m.security.incidentReport, nextNumber: v } } }))} />
          <Trio label="Employee ID" prefix={moduleNumbering.hr.employeeId.prefix} format={moduleNumbering.hr.employeeId.numberFormat} next={moduleNumbering.hr.employeeId.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, hr: { ...m.hr, employeeId: { ...m.hr.employeeId, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, hr: { ...m.hr, employeeId: { ...m.hr.employeeId, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, hr: { ...m.hr, employeeId: { ...m.hr.employeeId, nextNumber: v } } }))} />
          <Trio label="Timesheet" prefix={moduleNumbering.hr.timesheet.prefix} format={moduleNumbering.hr.timesheet.numberFormat} next={moduleNumbering.hr.timesheet.nextNumber}
            onPrefix={v => setMod(m => ({ ...m, hr: { ...m.hr, timesheet: { ...m.hr.timesheet, prefix: v } } }))}
            onFormat={v => setMod(m => ({ ...m, hr: { ...m.hr, timesheet: { ...m.hr.timesheet, numberFormat: v } } }))}
            onNext={v => setMod(m => ({ ...m, hr: { ...m.hr, timesheet: { ...m.hr.timesheet, nextNumber: v } } }))} />
        </CardBody>
      </Card>
    </div>
  );
}
