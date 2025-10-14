'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardBody, Select, SelectItem, Button, Divider } from '@heroui/react';
import { listTemplates } from '../../lib/print/templates';
import { useSettingsStore } from '../../lib/settings/store';

export default function DocumentTemplateSettings() {
  const receipts = useMemo(() => listTemplates('receipt'), []);
  const invoices = useMemo(() => listTemplates('invoice'), []);
  const proformas = useMemo(() => listTemplates('proforma'), []);
  const settings = useSettingsStore();
  const initial = (settings as any)?.printing || {};
  const [receiptTpl, setReceiptTpl] = useState<string>(initial.receipt || receipts[0]?.key || 'simple-receipt');
  const [invoiceTpl, setInvoiceTpl] = useState<string>(initial.invoice || invoices[0]?.key || 'corporate-invoice');
  const [proformaTpl, setProformaTpl] = useState<string>(initial.proforma || proformas[0]?.key || 'conference-proforma-grid');

  const save = () => {
    (useSettingsStore.getState() as any).updatePrintingTemplates?.({ receipt: receiptTpl, invoice: invoiceTpl, proforma: proformaTpl });
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <h3 className="text-xl font-semibold">Document Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Select label="Default Receipt" selectedKeys={[receiptTpl]} onSelectionChange={(k)=> setReceiptTpl(Array.from(k)[0] as string)}>
              {receipts.map(t => (<SelectItem key={t.key}>{t.name}</SelectItem>))}
            </Select>
          </div>
          <div>
            <Select label="Default Invoice" selectedKeys={[invoiceTpl]} onSelectionChange={(k)=> setInvoiceTpl(Array.from(k)[0] as string)}>
              {invoices.map(t => (<SelectItem key={t.key}>{t.name}</SelectItem>))}
            </Select>
          </div>
          <div>
            <Select label="Default Proforma/Quote" selectedKeys={[proformaTpl]} onSelectionChange={(k)=> setProformaTpl(Array.from(k)[0] as string)}>
              {proformas.map(t => (<SelectItem key={t.key}>{t.name}</SelectItem>))}
            </Select>
          </div>
        </div>
        <Divider />
        <div className="flex justify-end">
          <Button color="primary" onPress={save}>Save Templates</Button>
        </div>
      </CardBody>
    </Card>
  );
}


