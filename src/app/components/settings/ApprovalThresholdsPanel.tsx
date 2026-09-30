'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Input, Switch, Button, Chip } from '@heroui/react';
import { useSettingsStore } from '../../lib/settings/store';

/**
 * Director/GM approval thresholds — the amount at/above which posting a journal
 * entry, approving a requisition (purchase order), or posting a payment is routed
 * to someone with the matching approve-level permission instead of completing
 * immediately. Enforced server-side in src/app/lib/api/approvalThresholds.ts;
 * this panel just edits the tenant's values.
 */
function ThresholdRow({ label, description, required, threshold, onRequired, onThreshold, disabled, unit = 'GHS' }: {
  label: string; description: string; required: boolean; threshold: number;
  onRequired: (v: boolean) => void; onThreshold: (v: number) => void; disabled: boolean; unit?: string;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border rounded-lg">
      <div>
        <h4 className="font-medium">{label}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <div className="flex items-center gap-4">
        <Input
          type="number"
          label={`Threshold (${unit})`}
          className="max-w-[160px]"
          value={String(threshold)}
          onChange={(e) => onThreshold(Number(e.target.value))}
          isDisabled={disabled || !required}
        />
        <Switch isSelected={required} onValueChange={onRequired} isDisabled={disabled}>
          Require approval
        </Switch>
      </div>
    </div>
  );
}

export default function ApprovalThresholdsPanel() {
  const settings = useSettingsStore();
  const updateFinancialSettings = useSettingsStore((s) => s.updateFinancialSettings);
  const canManage = settings.hasPermission('settings.manage-approval-thresholds');

  const [form, setForm] = React.useState(() => ({
    requireApprovalForExpenses: settings.financialSettings.requireApprovalForExpenses,
    expenseApprovalThreshold: settings.financialSettings.expenseApprovalThreshold,
    requireApprovalForPurchaseOrders: settings.financialSettings.requireApprovalForPurchaseOrders,
    purchaseOrderApprovalThreshold: settings.financialSettings.purchaseOrderApprovalThreshold,
    requireApprovalForPayments: settings.financialSettings.requireApprovalForPayments,
    paymentApprovalThreshold: settings.financialSettings.paymentApprovalThreshold,
    requireApprovalForOvertime: settings.financialSettings.requireApprovalForOvertime,
    overtimeApprovalThreshold: settings.financialSettings.overtimeApprovalThreshold,
    requireApprovalForPayroll: settings.financialSettings.requireApprovalForPayroll ?? true,
  }));
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  // Re-sync local form state once the tenant's real values arrive from the server
  // (loadSettings() hydrates financialSettings asynchronously after mount).
  React.useEffect(() => {
    setForm({
      requireApprovalForExpenses: settings.financialSettings.requireApprovalForExpenses,
      expenseApprovalThreshold: settings.financialSettings.expenseApprovalThreshold,
      requireApprovalForPurchaseOrders: settings.financialSettings.requireApprovalForPurchaseOrders,
      purchaseOrderApprovalThreshold: settings.financialSettings.purchaseOrderApprovalThreshold,
      requireApprovalForPayments: settings.financialSettings.requireApprovalForPayments,
      paymentApprovalThreshold: settings.financialSettings.paymentApprovalThreshold,
      requireApprovalForOvertime: settings.financialSettings.requireApprovalForOvertime,
      overtimeApprovalThreshold: settings.financialSettings.overtimeApprovalThreshold,
      requireApprovalForPayroll: settings.financialSettings.requireApprovalForPayroll ?? true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.financialSettings.requireApprovalForExpenses,
    settings.financialSettings.expenseApprovalThreshold,
    settings.financialSettings.requireApprovalForPurchaseOrders,
    settings.financialSettings.purchaseOrderApprovalThreshold,
    settings.financialSettings.requireApprovalForPayments,
    settings.financialSettings.paymentApprovalThreshold,
    settings.financialSettings.requireApprovalForOvertime,
    settings.financialSettings.overtimeApprovalThreshold,
    settings.financialSettings.requireApprovalForPayroll,
  ]);

  const handleSave = () => {
    if (!canManage) { alert('You do not have permission to configure approval thresholds.'); return; }
    for (const [key, value] of Object.entries(form)) {
      if (key.endsWith('Threshold') && (!Number.isFinite(value) || (value as number) < 0)) {
        alert('Thresholds must be zero or a positive number.');
        return;
      }
    }
    updateFinancialSettings(form);
    setSavedAt(Date.now());
  };

  return (
    <div className="mt-2 max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Director Approval Thresholds</h3>
          <p className="text-xs text-gray-600">
            Transactions at or above these amounts require director/GM sign-off before they post.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <Chip color="success" variant="flat" size="sm">Saved</Chip>}
          <Button color="primary" size="sm" onPress={handleSave} isDisabled={!canManage}>Save Thresholds</Button>
        </div>
      </div>

      <Card>
        <CardHeader><h4 className="font-semibold">Expenses &amp; Journal Entries</h4></CardHeader>
        <CardBody>
          <ThresholdRow
            label="Journal entry posting"
            description="Posting a journal entry at or above this amount needs a director's approval."
            required={form.requireApprovalForExpenses}
            threshold={form.expenseApprovalThreshold}
            onRequired={(v) => setForm((f) => ({ ...f, requireApprovalForExpenses: v }))}
            onThreshold={(v) => setForm((f) => ({ ...f, expenseApprovalThreshold: v }))}
            disabled={!canManage}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h4 className="font-semibold">Purchase Orders &amp; Requisitions</h4></CardHeader>
        <CardBody>
          <ThresholdRow
            label="Requisition approval"
            description="Approving a requisition whose total value is at or above this amount needs a director's approval."
            required={form.requireApprovalForPurchaseOrders}
            threshold={form.purchaseOrderApprovalThreshold}
            onRequired={(v) => setForm((f) => ({ ...f, requireApprovalForPurchaseOrders: v }))}
            onThreshold={(v) => setForm((f) => ({ ...f, purchaseOrderApprovalThreshold: v }))}
            disabled={!canManage}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h4 className="font-semibold">Payments</h4></CardHeader>
        <CardBody>
          <ThresholdRow
            label="Payment posting"
            description="Posting a payment at or above this amount needs a director's approval."
            required={form.requireApprovalForPayments}
            threshold={form.paymentApprovalThreshold}
            onRequired={(v) => setForm((f) => ({ ...f, requireApprovalForPayments: v }))}
            onThreshold={(v) => setForm((f) => ({ ...f, paymentApprovalThreshold: v }))}
            disabled={!canManage}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h4 className="font-semibold">Overtime</h4></CardHeader>
        <CardBody>
          <ThresholdRow
            label="Overtime approval"
            description="An overtime request at or above this many hours needs a director's approval instead of Payroll/HR approving it directly."
            required={form.requireApprovalForOvertime}
            threshold={form.overtimeApprovalThreshold}
            onRequired={(v) => setForm((f) => ({ ...f, requireApprovalForOvertime: v }))}
            onThreshold={(v) => setForm((f) => ({ ...f, overtimeApprovalThreshold: v }))}
            disabled={!canManage}
            unit="hours"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h4 className="font-semibold">Payroll</h4></CardHeader>
        <CardBody>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Payroll — require manager approval before paying</h4>
              <p className="text-sm text-gray-600">
                When on, a prepared month waits in Executive → Approvals (and Payment Advice) until someone with payroll-approval permission signs it off. When off, preparing a month makes it ready to pay immediately.
              </p>
            </div>
            <Switch
              isSelected={form.requireApprovalForPayroll}
              onValueChange={(v) => setForm((f) => ({ ...f, requireApprovalForPayroll: v }))}
              isDisabled={!canManage}
            >
              Require approval
            </Switch>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
