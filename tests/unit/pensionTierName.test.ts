import { describe, expect, it } from 'vitest';
import { pensionTierCustomName, pensionTierNamePatch, withPensionTierMarker } from '../../src/app/lib/compliance/pensionTierName';

describe('pension tier names', () => {
  it('keeps the tier on a rename and leaves a bare tier label alone', () => {
    expect(withPensionTierMarker('Enterprise Trustees', 'Tier 2')).toBe('Enterprise Trustees (Tier 2)');
    expect(withPensionTierMarker('Enterprise Trustees (Tier 2)', 'Tier 2')).toBe('Enterprise Trustees (Tier 2)');
    expect(withPensionTierMarker('Provident Fund Manager (Tier3)', 'Tier 3')).toBe('Provident Fund Manager (Tier 3)');
    expect(withPensionTierMarker('Tier 2', 'Tier 2')).toBe('Tier 2');
    expect(withPensionTierMarker('', 'Tier 3')).toBe('Tier 3');
    expect(pensionTierCustomName('SSNIT (Tier 1)', 'Tier 1')).toBe('SSNIT');
    expect(pensionTierCustomName('Tier 2', 'Tier 2')).toBe('');
  });

  it('starts an untouched Tier 1 as SSNIT and does not put SSNIT back after that', () => {
    expect(pensionTierNamePatch({ id: 'gh-ssnit-tier1', name: 'Tier 1', appliesTo: ['TIER1'] })).toEqual({
      name: 'SSNIT (Tier 1)',
      ssnitDefaultApplied: true,
    });
    expect(pensionTierNamePatch({ id: 'gh-ssnit-tier1', name: 'SSNIT', appliesTo: ['TIER1'] })).toEqual({
      name: 'SSNIT (Tier 1)',
      ssnitDefaultApplied: true,
    });
    expect(pensionTierNamePatch({
      id: 'gh-ssnit-tier1', name: 'Tier 1', appliesTo: ['TIER1'], ssnitDefaultApplied: true,
    })).toBeNull();
    expect(pensionTierNamePatch({
      id: 'gh-ssnit-tier1', name: 'SSNIT (Tier 1)', appliesTo: ['TIER1'], ssnitDefaultApplied: true,
    })).toBeNull();
  });

  it('adds the tier to a trustee or provident name the hotel already chose', () => {
    expect(pensionTierNamePatch({ id: 'gh-ssnit-tier2', name: 'Enterprise Trustees', appliesTo: ['TIER2'] })).toEqual({
      name: 'Enterprise Trustees (Tier 2)',
    });
    expect(pensionTierNamePatch({ id: 'gh-tier3-relief-cap', name: 'Provident Fund Manager', appliesTo: ['TIER3_RELIEF_CAP'] })).toEqual({
      name: 'Provident Fund Manager (Tier 3)',
    });
    expect(pensionTierNamePatch({ id: 'gh-tier3-relief-cap', name: 'Tier 3 Relief Cap', appliesTo: ['TIER3_RELIEF_CAP'] })).toEqual({
      name: 'Tier 3',
    });
    expect(pensionTierNamePatch({ id: 'gh-ssnit-tier2', name: 'Tier 2', appliesTo: ['TIER2'] })).toBeNull();
  });
});
