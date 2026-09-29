'use client';

import React, { useMemo, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { formatMoney } from '@/app/lib/format/currency';
import { deskResizableTableClassNames, useResizableColumns } from '../frontoffice/columnResize';

const taxColWidths = { name: 200, amount: 120, glCode: 100 };

export default function TaxCompliancePanel() {
  const taxCols = useResizableColumns(taxColWidths);
  const country = useComplianceStore((s) => s.country);
  const setCountry = useComplianceStore((s) => s.setCountry);
  const taxRules = useComplianceStore((s) => s.taxRules);

  const [basic, setBasic] = React.useState(2500);
  const [allowances, setAllowances] = React.useState(0);
  const [result, setResult] = React.useState<{ taxes: Array<{ name: string; amount: number; glCode: string }>; total: number; netPay: number; gross: number } | null>(null);
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
      const gross = Math.round((basic + allowances) * 100) / 100;
      // Same bases as the payroll run: Tier 1 and Tier 2 are on basic salary only.
      // Cash allowances are PAYE-taxable and are not part of the SSNIT base.
      const employeeAmount = (category: string) =>
        compliance.calculateTax(basic, category, { domain: 'payroll', operation: 'internal' }).taxes
          .reduce((sum, line) => sum + (line.amount || 0), 0);
      const tier1Amount = findRule('TIER1') ? employeeAmount('TIER1') : 0;
      const tier2Amount = findRule('TIER2') ? employeeAmount('TIER2') : 0;
      const taxablePay = Math.max(0, gross - tier1Amount - tier2Amount);
      const paye = compliance.calculateTax(taxablePay, 'PAYE', { domain: 'payroll', operation: 'internal' });

      const taxes: Array<{ name: string; amount: number; glCode: string }> = [];
      const pushTier = (tag: string, amount: number, fallback: string) => {
        const rule = findRule(tag);
        if (rule && amount > 0) taxes.push({ name: rule.name || fallback, amount, glCode: rule.glCode || '' });
      };
      pushTier('TIER1', tier1Amount, 'Tier 1 (SSNIT)');
      pushTier('TIER2', tier2Amount, 'Tier 2 Pension');
      paye.taxes.forEach((t) => taxes.push({ name: t.name, amount: t.amount, glCode: t.glCode }));

      const total = Math.round(taxes.reduce((s, t) => s + t.amount, 0) * 100) / 100;
      setResult({ taxes, total, gross, netPay: Math.round((gross - total) * 100) / 100 });
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
            <Input label="Basic salary" type="number" value={String(basic)} onChange={(e) => setBasic(parseFloat(e.target.value || '0'))} variant="bordered" className="w-36" />
            <Input label="Cash allowances" type="number" value={String(allowances)} onChange={(e) => setAllowances(parseFloat(e.target.value || '0'))} variant="bordered" className="w-36" />
            <Button color="primary" onPress={run} isLoading={loading}>Calculate</Button>
          </div>
        </CardHeader>
        <CardBody>
          {!result && <div className="text-sm text-gray-600">Tier 1 (SSNIT) is charged on basic salary. Cash allowances are added for PAYE and are not part of the SSNIT base — the same split the payroll run uses.</div>}
          {result && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Gross (basic + allowances)</div><div className="text-xl font-semibold">{result.gross.toFixed(2)}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Total Statutory Deductions</div><div className="text-xl font-semibold">{result.total.toFixed(2)}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Net Pay</div><div className="text-xl font-semibold">{result.netPay.toFixed(2)}</div></div>
              </div>
              <div ref={taxCols.frameRef} style={taxCols.frameStyle}>
                <Table aria-label="taxes" removeWrapper classNames={deskResizableTableClassNames()}>
                  <TableHeader>
                    <TableColumn style={taxCols.style('name')}>Withholding</TableColumn>
                    <TableColumn style={taxCols.style('amount')}>Amount</TableColumn>
                    <TableColumn style={taxCols.style('glCode')}>GL code</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {result.taxes.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(t.amount)}</TableCell>
                        <TableCell>{t.glCode}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}


