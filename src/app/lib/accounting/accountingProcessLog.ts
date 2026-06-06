/**
 * Structured console logging for accounting process flows.
 * Mirrors the [NightAuditScheduler] pattern used in front office.
 */

export type AccountingLogChannel =
  | 'AccountingCapture'
  | 'AccountingInvoicePost'
  | 'AccountingPaymentPost'
  | 'PeriodClose'
  | 'AccountingSync';

function stamp(): string {
  return new Date().toISOString();
}

export function logAccountingProcess(
  channel: AccountingLogChannel,
  event: string,
  detail?: Record<string, unknown>,
): void {
  const payload = detail ? ` — ${JSON.stringify(detail)}` : '';
  console.log(`[${channel}] ${event}${payload} @ ${stamp()}`);
}

export function logAccountingProcessWarn(
  channel: AccountingLogChannel,
  event: string,
  detail?: Record<string, unknown>,
): void {
  const payload = detail ? ` — ${JSON.stringify(detail)}` : '';
  console.warn(`[${channel}] ${event}${payload} @ ${stamp()}`);
}

export function logAccountingProcessError(
  channel: AccountingLogChannel,
  event: string,
  detail?: Record<string, unknown>,
): void {
  const payload = detail ? ` — ${JSON.stringify(detail)}` : '';
  console.error(`[${channel}] ${event}${payload} @ ${stamp()}`);
}
