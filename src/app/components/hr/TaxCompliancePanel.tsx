'use client';

import React, { useMemo, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useComplianceStore } from '@/app/lib/compliance/store';

export default function TaxCompliancePanel() {
  const country = useComplianceStore((s) => s.country);
  const setCountry = useComplianceStore((s) => s.setCountry);
  const taxRules = useComplianceStore((s) => s.taxRules);

  const [amount, setAmount] = React.useState(1000);
  const [result, setResult] = React.useState<{ taxes: Array<{ name: string; amount: number; glCode: string }>; total: number; netPay: number } | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    void useComplianceStore.getState().syncCountryFromSetup();
  }, []);

  // Employee statutory withholdings on a salary (PAYE + pension tiers), same domain='payroll'
  // rule engine already used by the real payroll run (src/app/lib/payroll/builder.ts) and by
  // PayrollProcessingPanel.tsx -- previously this panel called computeSalesTax(), the hotel's
  // VAT/NHIL/GETFund/Tourism Levy stack, which has nothing to do with employee payroll tax.
  const findRule = (tag: string) =>
    taxRules.find((r) => r.countryCode === country && r.domain === 'payroll' && (r.appliesTo || []).includes(tag));

  const run = () => {
    setLoading(true);
    try {
      const compliance = useComplianceStore.getState();
      const tier1Rule = findRule('TIER1');
      const tier2Rule = findRule('TIER2');
      const tier1Amount = tier1Rule ? amount * ((tier1Rule.rate ?? 0) / 100) : 0;
      const tier2Amount = tier2Rule ? amount * ((tier2Rule.rate ?? 0) / 100) : 0;
      // Ghana's PAYE base nets off the Tier 1 (SSNIT) employee contribution first, same as
      // the real payroll run -- other countries with no TIER1 rule just tax the full amount.
      const taxablePay = Math.max(0, amount - tier1Amount);
      const paye = compliance.calculateTax(taxablePay, 'PAYE', { domain: 'payroll', operation: 'internal' });

      const taxes: Array<{ name: string; amount: number; glCode: string }> = [];
      if (tier1Rule) taxes.push({ name: tier1Rule.name || 'Tier 1 (SSNIT)', amount: tier1Amount, glCode: tier1Rule.glCode || '' });
      if (tier2Rule) taxes.push({ name: tier2Rule.name || 'Tier 2 Pension', amount: tier2Amount, glCode: tier2Rule.glCode || '' });
      paye.taxes.forEach((t) => taxes.push({ name: t.name, amount: t.amount, glCode: t.glCode }));

      const total = taxes.reduce((s, t) => s + t.amount, 0);
      setResult({ taxes, total, netPay: amount - total });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Tax Compliance — Payroll Withholding Preview</div>
          <div className="flex items-center gap-2">
            <Select label="Country" selectedKeys={[country]} onSelectionChange={(k) => setCountry(Array.from(k)[0] as string)} variant="bordered" className="w-40">
              <SelectItem key="GH">Ghana</SelectItem>
              <SelectItem key="NG">Nigeria</SelectItem>
              <SelectItem key="ZA">South Africa</SelectItem>
            </Select>
            <Input label="Gross Salary" type="number" value={String(amount)} onChange={(e) => setAmount(parseFloat(e.target.value || '0'))} variant="bordered" className="w-40" />
            <Button color="primary" onPress={run} isLoading={loading}>Calculate</Button>
          </div>
        </CardHeader>
        <CardBody>
          {!result && <div className="text-sm text-gray-600">Choose a country and calculate to preview PAYE/SSNIT withholding on a gross salary.</div>}
          {result && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Gross Salary</div><div className="text-xl font-semibold">{amount.toFixed(2)}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Total Statutory Deductions</div><div className="text-xl font-semibold">{result.total.toFixed(2)}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Net Pay</div><div className="text-xl font-semibold">{result.netPay.toFixed(2)}</div></div>
              </div>
              <Table aria-label="taxes">
                <TableHeader>
                  <TableColumn>WITHHOLDING</TableColumn>
                  <TableColumn>AMOUNT</TableColumn>
                  <TableColumn>GL CODE</TableColumn>
                </TableHeader>
                <TableBody>
                  {result.taxes.map((t, i) => (
                    <TableRow key={i}><TableCell>{t.name}</TableCell><TableCell>{t.amount.toFixed(2)}</TableCell><TableCell>{t.glCode}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}


