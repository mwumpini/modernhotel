import { NextResponse } from 'next/server';
import { TaxRule } from '@/app/lib/models';

// Mock database (replace with real DB calls)
const taxRulesDB: TaxRule[] = [
  // Ghana Tax Rules (2024 Structure)
  { id: '1', countryCode: 'GH', name: 'NHIL', rate: 2.5, glCode: '2101', appliesTo: ['ALL'] },
  { id: '2', countryCode: 'GH', name: 'GETFund Levy', rate: 2.5, glCode: '2102', appliesTo: ['ALL'] },
  { id: '3', countryCode: 'GH', name: 'COVID-19 Levy', rate: 1.0, glCode: '2103', appliesTo: ['ALL'] },
  { id: '4', countryCode: 'GH', name: 'VAT (Standard Rate)', rate: 15.0, glCode: '2100', appliesTo: ['ALL'] },
  { id: '5', countryCode: 'GH', name: 'Tourism Levy', rate: 1.0, glCode: '2104', appliesTo: ['ALL'] },
  
  // Zimbabwe Tax Rules
  { id: '6', countryCode: 'ZW', name: 'VAT', rate: 15, glCode: 'ZW-VAT-001' },
  { id: '7', countryCode: 'ZW', name: 'Income Tax', rate: 20, glCode: 'ZW-IT-001' },
  
  // US Tax Rules
  { id: '8', countryCode: 'US', name: 'Sales Tax', rate: 8.25, glCode: 'US-ST-001' },
  { id: '9', countryCode: 'US', name: 'Hotel Tax', rate: 12.0, glCode: 'US-HT-001' },
  { id: '10', countryCode: 'US', name: 'Tourism Tax', rate: 3.0, glCode: 'US-TT-001' }
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country');

    if (!country) {
      return NextResponse.json({ error: 'Country parameter is required' }, { status: 400 });
    }

    const rules = taxRulesDB.filter(rule => rule.countryCode === country);
    
    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching tax rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
