'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardBody, Button, Input, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Divider, Tooltip } from '@heroui/react';
import UniversalPayrollBuilder from '@/app/lib/payroll/builder';
import { useComplianceStore } from '@/app/lib/compliance/store';
import PayrollTaxRatesEditor from './PayrollTaxRatesEditor';
import { saveRecord } from '../lib/api/tenantRecords';

export default function PayrollBuilderPanel() {
  const builder = useMemo(() => new UniversalPayrollBuilder(), []);
  const complianceCountry = useComplianceStore((s) => s.country);
  const [selectedTemplate, setSelectedTemplate] = useState(complianceCountry);
  const [editableConfig, setEditableConfig] = useState<any>(null);

  React.useEffect(() => {
    void useComplianceStore.getState().syncCountryFromSetup();
  }, []);

  React.useEffect(() => {
    setSelectedTemplate(complianceCountry);
  }, [complianceCountry]);

  React.useEffect(() => {
    if (!editableConfig && complianceCountry) {
      try {
        const cfg = builder.getCountryTemplate(complianceCountry);
        const saved = typeof window !== 'undefined' ? localStorage.getItem(`payroll.config.${cfg.country}`) : null;
        setEditableConfig(saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(cfg)));
      } catch {
        /* template not available for country */
      }
    }
  }, [complianceCountry, editableConfig, builder]);
  const templateOptions = useMemo(() => builder.listCountryTemplates(), [builder]);

  const resetFromTemplate = () => {
    const cfg = builder.getCountryTemplate(selectedTemplate || complianceCountry);
    setEditableConfig(JSON.parse(JSON.stringify(cfg)));
  };

  const incomeBracketSummary = useMemo(() => {
    const brackets = editableConfig?.taxConfig?.income?.brackets || [];
    if (!brackets.length) return null;
    return brackets.map((b: { threshold: number; rate: number }) => `${b.threshold} @ ${b.rate}%`).join(' → ');
  }, [editableConfig]);

  const socialSecurityPresets = useMemo(() => {
    if (!editableConfig?.socialSecurity) return [];
    return Object.entries(editableConfig.socialSecurity).map(([key, ss]: [string, any]) => ({
      key,
      name: ss.name,
      employeeRate: ss.employeeRate,
      employerRate: ss.employerRate,
      ceiling: ss.ceiling,
    }));
  }, [editableConfig]);

  const earningOptions = [
    { key: 'BASIC', name: 'Basic Salary', calculationType: 'fixed', amount: 0, taxable: true },
    { key: 'TRANSPORT', name: 'Transport Allowance', calculationType: 'fixed', amount: 0, taxable: true },
    { key: 'OVERTIME', name: 'Overtime', calculationType: 'hourly', rate: 1.5, amount: 0, taxable: true },
  ];

  const deductionOptions = [
    { key: 'SSNIT_EMP', name: 'Social Security (Employee)', calculationType: 'percentage', rate: 5.5, base: 'gross' },
    { key: 'HEALTH', name: 'Health Insurance', calculationType: 'fixed', amount: 100, base: 'gross' },
  ];

  const handleLoadTemplate = () => {
    const cfg = builder.getCountryTemplate(selectedTemplate || complianceCountry);
    const saved = typeof window !== 'undefined' ? localStorage.getItem(`payroll.config.${cfg.country}`) : null;
    setEditableConfig(saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(cfg)));
  };

  // Auto-save edits: the server keeps the hotel's copy; this browser's copy is what a payroll run reads.
  React.useEffect(() => {
    if (!editableConfig?.country) return;
    const json = JSON.stringify(editableConfig);
    let previous: string | null = null;
    try { previous = localStorage.getItem(`payroll.config.${editableConfig.country}`); localStorage.setItem(`payroll.config.${editableConfig.country}`, json); } catch {}
    if (previous !== json) void saveRecord('setting.payrollConfig', editableConfig.country, { id: editableConfig.country, config: editableConfig });
  }, [editableConfig]);

  const addBracket = () => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.taxConfig = next.taxConfig || {};
    next.taxConfig.income = next.taxConfig.income || { brackets: [] };
    next.taxConfig.income.brackets = [...(next.taxConfig.income.brackets || []), { threshold: 0, rate: 0 }];
    setEditableConfig(next);
  };

  const removeBracket = (idx: number) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.taxConfig.income.brackets = next.taxConfig.income.brackets.filter((_: any, i: number) => i !== idx);
    setEditableConfig(next);
  };

  const updateBracket = (idx: number, field: 'threshold' | 'rate', value: number) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.taxConfig.income.brackets = next.taxConfig.income.brackets.map((b: any, i: number) => i === idx ? { ...b, [field]: value } : b);
    setEditableConfig(next);
  };

  const addEarning = () => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.earnings = next.earnings || [];
    next.earnings.push({ name: 'Allowance', code: `ALLW_${next.earnings.length + 1}`, calculationType: 'fixed', amount: 100, taxable: false });
    setEditableConfig(next);
  };

  const removeEarning = (idx: number) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.earnings = (next.earnings || []).filter((_: any, i: number) => i !== idx);
    setEditableConfig(next);
  };

  const updateEarning = (idx: number, field: 'name' | 'amount' | 'taxable', value: any) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.earnings[idx] = { ...next.earnings[idx], [field]: value };
    setEditableConfig(next);
  };

  const addDeduction = () => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.deductions = next.deductions || [];
    next.deductions.push({ name: 'Pre-tax Deduction', code: `DED_${next.deductions.length + 1}`, calculationType: 'percentage', rate: 2.5, base: 'gross', taxable: false });
    setEditableConfig(next);
  };

  const updateDeduction = (idx: number, field: 'name' | 'rate' | 'base', value: any) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.deductions[idx] = { ...next.deductions[idx], [field]: value };
    setEditableConfig(next);
  };

  const removeDeduction = (idx: number) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.deductions = (next.deductions || []).filter((_: any, i: number) => i !== idx);
    setEditableConfig(next);
  };

  const addSSItem = () => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    next.socialSecurity = next.socialSecurity || {};
    const key = `ss_${Date.now()}`;
    next.socialSecurity[key] = { name: 'Custom SS', employeeRate: 0, employerRate: 0, ceiling: null };
    setEditableConfig(next);
  };

  const removeSSItem = (key: string) => {
    if (!editableConfig) return;
    const next = { ...editableConfig };
    if (next.socialSecurity && next.socialSecurity[key]) {
      delete next.socialSecurity[key];
      setEditableConfig(next);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <h4 className="font-semibold">Income tax &amp; payroll</h4>
          <div className="flex gap-2">
            <Select disallowEmptySelection selectedKeys={[selectedTemplate]} onSelectionChange={(k) => setSelectedTemplate(Array.from(k)[0] as string)} className="w-48" variant="bordered">
              {templateOptions.map((t) => (
                <SelectItem key={t.country}>{t.name}</SelectItem>
              ))}
            </Select>
            <Button className="bg-ghana-green text-white" onPress={handleLoadTemplate}>Load Template</Button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {!editableConfig && (
          <div className="text-sm text-gray-600">Load a template, then adjust PAYE brackets, SSNIT, earnings and deductions. The monthly pay run is HR &amp; Payroll → Payroll.</div>
        )}
        {editableConfig && (
          <div className="space-y-4">
            {/* Editors */}
            {editableConfig?.country === 'GH' && (
              <PayrollTaxRatesEditor />
            )}
            {editableConfig?.country !== 'GH' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <h5 className="font-medium">Income Tax Brackets</h5>
                </CardHeader>
                <CardBody>
                  <div>
                    {incomeBracketSummary && (
                      <p className="mb-3 text-xs text-gray-500 bg-gray-50 rounded p-2">
                        Current bands: {incomeBracketSummary}
                      </p>
                    )}
                    <Table aria-label="brackets">
                      <TableHeader>
                        <TableColumn>
                          <div className="flex items-center gap-1">THRESHOLD
                            <Tooltip content="Cumulative upper bound for this bracket. Order top-to-bottom; remaining income falls into the last tier.">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
                            </Tooltip>
                          </div>
                        </TableColumn>
                        <TableColumn>
                          <div className="flex items-center gap-1">RATE %
                            <Tooltip content="Percentage applied to income within this bracket.">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
                            </Tooltip>
                          </div>
                        </TableColumn>
                        <TableColumn>ACTIONS</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {(editableConfig.taxConfig?.income?.brackets || []).map((b: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Input type="number" value={String(b.threshold)} onChange={(e) => updateBracket(idx, 'threshold', parseFloat(e.target.value || '0'))} variant="bordered" />
                            </TableCell>
                            <TableCell>
                              <Input type="number" value={String(b.rate)} onChange={(e) => updateBracket(idx, 'rate', parseFloat(e.target.value || '0'))} variant="bordered" />
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="flat" color="danger" onPress={() => removeBracket(idx)}>Remove</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <Button size="sm" variant="flat" onPress={addBracket}>+ Add Bracket</Button>
                      <Button size="sm" variant="flat" onPress={resetFromTemplate}>Reset from template</Button>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <h5 className="font-medium">Social Security</h5>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Items</span>
                      <Button size="sm" variant="flat" onPress={addSSItem}>+ Add SS Item</Button>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(editableConfig.socialSecurity || {}).map(([key, ss]: any) => (
                        <div key={key} className="grid grid-cols-6 gap-2 items-start">
                          <Select label="Name" selectedKeys={[String((() => { const m = socialSecurityPresets.find(o => o.name === ss.name || o.key === ss.name); return m?.name || ss.name || key; })())]} onSelectionChange={(k) => {
                            const selected = String(Array.from(k)[0] || 'Social Security');
                            const preset = socialSecurityPresets.find(o => o.name === selected || o.key === selected);
                            const next = { ...editableConfig } as any;
                            next.socialSecurity[key] = {
                              ...(next.socialSecurity[key] || {}),
                              name: preset?.name || selected,
                              employeeRate: preset ? preset.employeeRate : (next.socialSecurity[key]?.employeeRate || 0),
                              employerRate: preset ? preset.employerRate : (next.socialSecurity[key]?.employerRate || 0),
                              ceiling: preset ? preset.ceiling : (next.socialSecurity[key]?.ceiling ?? 0)
                            };
                            setEditableConfig(next);
                          }} variant="bordered">
                            {socialSecurityPresets.map(opt => (
                              <SelectItem key={opt.name}>{opt.name}</SelectItem>
                            ))}
                          </Select>
                          <Input label="Emp %" type="number" value={String(ss.employeeRate || 0)} onChange={(e) => { const next = { ...editableConfig } as any; next.socialSecurity[key] = { ...(next.socialSecurity[key] || {}), employeeRate: parseFloat(e.target.value || '0') }; setEditableConfig(next); }} variant="bordered" />
                          <Input label="Er %" type="number" value={String(ss.employerRate || 0)} onChange={(e) => { const next = { ...editableConfig } as any; next.socialSecurity[key] = { ...(next.socialSecurity[key] || {}), employerRate: parseFloat(e.target.value || '0') }; setEditableConfig(next); }} variant="bordered" />
                          <Input label="Ceiling" type="number" value={String(ss.ceiling ?? 0)} onChange={(e) => { const next = { ...editableConfig } as any; next.socialSecurity[key] = { ...(next.socialSecurity[key] || {}), ceiling: parseFloat(e.target.value || '0') || null }; setEditableConfig(next); }} variant="bordered" />
                          <Button size="sm" variant="flat" color="danger" onPress={() => removeSSItem(key)}>Remove</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
            )}

            <Card>
                <CardHeader>
                  <h5 className="font-medium">Components</h5>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium">Earnings</span><Button size="sm" variant="flat" onPress={addEarning}>+ Add</Button></div>
                      <div className="space-y-2">
                        {(editableConfig.earnings || []).map((e: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-6 gap-2 items-start">
                            <Select selectedKeys={[e.name || '']} onSelectionChange={(k) => {
                              const key = String(Array.from(k)[0] || '');
                              const preset = earningOptions.find(o => o.name === key);
                              const val: any = preset ? { name: preset.name, calculationType: preset.calculationType, amount: preset.amount || 0, rate: preset.rate || 0, taxable: preset.taxable !== false } : { name: key };
                              updateEarning(idx, 'name', val.name);
                              // update related fields
                              const next = { ...editableConfig } as any; next.earnings[idx] = { ...(next.earnings[idx] || {}), ...val }; setEditableConfig(next);
                            }} variant="bordered">
                              {earningOptions.map(opt => (<SelectItem key={opt.name}>{opt.name}</SelectItem>))}
                            </Select>
                            <Input type="number" value={String(e.amount || 0)} onChange={(ev) => updateEarning(idx, 'amount', parseFloat(ev.target.value || '0'))} variant="bordered" />
                            <Select disallowEmptySelection selectedKeys={[e.taxable ? 'yes' : 'no']} onSelectionChange={(k) => updateEarning(idx, 'taxable', Array.from(k)[0] === 'yes')} variant="bordered">
                              <SelectItem key="yes">Taxable</SelectItem>
                              <SelectItem key="no">Non-taxable</SelectItem>
                            </Select>
                            <div className="col-span-2"></div>
                            <Button size="sm" variant="flat" color="danger" onPress={() => removeEarning(idx)}>Remove</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Divider />
                    <div>
                      <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium">Deductions (Pre-tax)</span><Button size="sm" variant="flat" onPress={addDeduction}>+ Add</Button></div>
                      <div className="space-y-2">
                        {(editableConfig.deductions || []).map((d: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-6 gap-2 items-start">
                            <Select selectedKeys={[(() => { const m = deductionOptions.find(o => o.name === d.name || o.key === d.name); return m?.name || d.name || ''; })()]} onSelectionChange={(k) => {
                              const key = String(Array.from(k)[0] || '');
                              const preset = deductionOptions.find(o => o.name === key || o.key === key);
                              const next = { ...editableConfig } as any;
                              next.deductions[idx] = { ...(next.deductions[idx] || {}), name: key, calculationType: preset?.calculationType || next.deductions[idx]?.calculationType || 'percentage', rate: preset?.rate ?? next.deductions[idx]?.rate ?? 0, amount: preset?.amount ?? next.deductions[idx]?.amount ?? 0, base: preset?.base || next.deductions[idx]?.base || 'gross' };
                              setEditableConfig(next);
                            }} variant="bordered">
                              {deductionOptions.map(opt => (<SelectItem key={opt.name}>{opt.name}</SelectItem>))}
                            </Select>
                            <Input type="number" value={String(d.rate || 0)} onChange={(ev) => updateDeduction(idx, 'rate', parseFloat(ev.target.value || '0'))} variant="bordered" />
                            <Select disallowEmptySelection selectedKeys={[d.base || 'gross']} onSelectionChange={(k) => updateDeduction(idx, 'base', Array.from(k)[0])} variant="bordered">
                              <SelectItem key="gross">Gross</SelectItem>
                              <SelectItem key="taxable">Taxable</SelectItem>
                              <SelectItem key="net">Net</SelectItem>
                            </Select>
                            <div className="col-span-2"></div>
                            <Button size="sm" variant="flat" color="danger" onPress={() => removeDeduction(idx)}>Remove</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
        </div>
        )}
      </CardBody>
    </Card>
  );
}

