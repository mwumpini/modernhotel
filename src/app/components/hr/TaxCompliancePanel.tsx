'use client';

import React, { useMemo, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { computeSalesTax } from '@/app/lib/tax/engine';

export default function TaxCompliancePanel() {
  const country = useComplianceStore((s) => s.country);
  const setCountry = useComplianceStore((s) => s.setCountry);

  const [amount, setAmount] = React.useState(1000);
  const [result, setResult] = React.useState<{ taxes: Array<{ name: string; amount: number; glCode: string }>; total: number } | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    void useComplianceStore.getState().syncCountryFromSetup();
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const { lines, totalTax, gross } = computeSalesTax(amount);
      setResult({
        taxes: lines.map((l) => ({ name: l.name, amount: l.amount, glCode: l.glAccountCode })),
        total: gross,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Tax Compliance</div>
          <div className="flex items-center gap-2">
            <Select label="Country" selectedKeys={[country]} onSelectionChange={(k) => setCountry(Array.from(k)[0] as string)} variant="bordered" className="w-40">
              <SelectItem key="GH">Ghana</SelectItem>
              <SelectItem key="NG">Nigeria</SelectItem>
              <SelectItem key="ZA">South Africa</SelectItem>
            </Select>
            <Input label="Amount" type="number" value={String(amount)} onChange={(e) => setAmount(parseFloat(e.target.value || '0'))} variant="bordered" className="w-40" />
            <Button color="primary" onPress={run} isLoading={loading}>Calculate</Button>
          </div>
        </CardHeader>
        <CardBody>
          {!result && <div className="text-sm text-gray-600">Choose a country and calculate to view applied taxes.</div>}
          {result && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Subtotal</div><div className="text-xl font-semibold">{amount.toFixed(2)}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Tax Total</div><div className="text-xl font-semibold">{(result.taxes.reduce((s,t)=>s+t.amount,0)).toFixed(2)}</div></div>
                <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Total</div><div className="text-xl font-semibold">{result.total.toFixed(2)}</div></div>
              </div>
              <Table aria-label="taxes">
                <TableHeader>
                  <TableColumn>TAX</TableColumn>
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


