import { describe, expect, it } from 'vitest';
import { embedTicketTag, parseTicketTag, withReceiptTag } from '@/app/lib/fb/ticketTag';
import { formatDocumentNumber, sequenceOf } from '@/app/lib/settings/store';
import { formatHotelDate } from '@/app/lib/settings/hotelDates';

describe('Kitchen, bar and receipt numbers on an order', () => {
  it('keeps the KOT and BOT numbers when the receipt number is added', () => {
    const notes = embedTicketTag('No onions', 'KOT100012', 'BOT100004');
    const paid = withReceiptTag(notes, 'RCT100031');
    expect(parseTicketTag(paid)).toEqual({ kot: 'KOT100012', bot: 'BOT100004', rct: 'RCT100031', notes: 'No onions' });
  });

  it('replaces an old tag rather than stacking a second one', () => {
    const once = embedTicketTag('Table 4', 'KOT1');
    const twice = embedTicketTag(once, 'KOT2');
    expect(twice).toBe('Table 4\n[[KOT=KOT2]]');
  });

  it('leaves plain notes alone', () => {
    expect(parseTicketTag('Extra spicy')).toEqual({ notes: 'Extra spicy' });
  });
});

describe('Document numbering', () => {
  it('pads the simple format to six digits', () => {
    expect(formatDocumentNumber({ prefix: 'RCT', nextNumber: 31, numberFormat: '{PREFIX}{NUMBER}' })).toBe('RCT000031');
  });

  it('builds year formats', () => {
    const year = new Date().getFullYear();
    expect(formatDocumentNumber({ prefix: 'INV', nextNumber: 108, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' })).toBe(`INV-${year}-0108`);
  });

  it('never issues number zero or a negative number', () => {
    expect(formatDocumentNumber({ prefix: 'INV', nextNumber: 0, numberFormat: '{PREFIX}-{NUMBER}' })).toBe('INV-0001');
  });

  it('reads the sequence back only from numbers this series issued', () => {
    expect(sequenceOf('INV-2026-0108', { prefix: 'INV', numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' })).toBe(108);
    expect(sequenceOf('A-INV-969230', { prefix: 'INV', numberFormat: '{PREFIX}-{NUMBER}' })).toBeNull();
  });
});

describe('Dates on printed documents', () => {
  it('writes a stay date in each layout a hotel can choose', () => {
    expect(formatHotelDate('2026-10-15', 'DD/MM/YYYY')).toBe('15/10/2026');
    expect(formatHotelDate('2026-10-15', 'DD-MMM-YYYY')).toBe('15-Oct-2026');
    expect(formatHotelDate('2026-10-15', 'DD MMM YYYY')).toBe('15 Oct 2026');
    expect(formatHotelDate('2026-10-15', 'YYYY-MM-DD')).toBe('2026-10-15');
    expect(formatHotelDate('2026-10-15', 'MM/DD/YYYY')).toBe('10/15/2026');
  });

  it('defaults to the Ghana day-first layout', () => {
    expect(formatHotelDate('2026-03-04')).toBe('04/03/2026');
  });

  it('prints nothing for a missing or broken date', () => {
    expect(formatHotelDate('')).toBe('');
    expect(formatHotelDate(null)).toBe('');
    expect(formatHotelDate('not a date')).toBe('');
  });
});
