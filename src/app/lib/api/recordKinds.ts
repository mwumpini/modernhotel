/**
 * What may be stored in TenantRecord. "setting." kinds are set-up and survive Clear test data;
 * the rest are activity and are cleared with the test data.
 */
export const RECORD_KINDS = [
  'events.invoice',
  'events.receipt',
  'events.folio',
  'fo.clientService',
  'fo.serviceCharge',
  'fo.inHouseGroup',
  'kitchen.op',
  'setting.system',
  'setting.eventRates',
  'setting.payrollConfig',
] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

export const isRecordKind = (kind: string): kind is RecordKind => (RECORD_KINDS as readonly string[]).includes(kind);
export const isSettingKind = (kind: string) => kind.startsWith('setting.');
