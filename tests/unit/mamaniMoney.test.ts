import { describe, expect, it } from 'vitest';
import { localMamaniReply } from '@/app/lib/ai/mamaniReply';

const brief = (snapshot: string[]) => ({ label: 'Executive', snapshot, notices: [] });

describe('Ask Mamani answers money questions without the model', () => {
  it('"How much did we make today?" reads the money line', () => {
    const reply = localMamaniReply('How much did we make today?', brief([
      'Money today: revenue GHS 2,450.00 before tax; received GHS 1,980.50 (Cash GHS 980.50, Mobile Money GHS 1,000.00).',
      '12 rooms: 6 occupied, 4 vacant, 2 dirty, 0 clean, 0 maintenance.',
    ]));
    expect(reply).toContain('revenue GHS 2,450.00');
    expect(reply).toContain('Mobile Money GHS 1,000.00');
  });

  it('says where to ask when this desk has no money figures', () => {
    const reply = localMamaniReply('What are our takings today?', brief(['12 rooms: 6 occupied, 4 vacant, 2 dirty, 0 clean, 0 maintenance.']));
    expect(reply).toMatch(/Executive or Accounting desk/);
  });
});
