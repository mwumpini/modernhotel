import { describe, expect, it } from 'vitest';
import { findHelp } from '../../src/app/lib/ai/helpSearch';

describe('Ask Mamani help search', () => {
  it('answers from a module operations chapter, not only the short Help steps', () => {
    const hits = findHelp('what is goods received not invoiced', 'frontdesk');
    expect(hits[0]?.title).toMatch(/goods received/i);
    expect(hits[0]?.href).toBe('/help/operations#topic-ops-grni');
    expect(hits[0]?.text).toMatch(/2350/);
  });

  it('answers from another module process flow while standing on the front desk', () => {
    const hits = findHelp('how does monthly payroll get prepared and approved');
    expect(hits.some((hit) => hit.href === '/help/process-flows#topic-flow-payroll')).toBe(true);
  });
});
