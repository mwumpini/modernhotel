import { NextRequest, NextResponse } from 'next/server';
import { TaxRule } from '@/app/lib/models';

// Mock database (replace with real DB calls)
let taxRulesDB: TaxRule[] = [
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

// GET - Fetch all tax rules
export async function GET() {
  try {
    return NextResponse.json(taxRulesDB);
  } catch (error) {
    console.error('Error fetching tax rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new tax rule
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { countryCode, name, rate, glCode, appliesTo } = body;

    // Validation
    if (!countryCode || !name || rate === undefined || !glCode) {
      return NextResponse.json({ 
        error: 'Missing required fields: countryCode, name, rate, glCode' 
      }, { status: 400 });
    }

    // Check for duplicate GL code in the same country
    const existingRule = taxRulesDB.find(rule => 
      rule.countryCode === countryCode && rule.glCode === glCode
    );
    
    if (existingRule) {
      return NextResponse.json({ 
        error: 'GL code already exists for this country' 
      }, { status: 409 });
    }

    // Create new tax rule
    const newRule: TaxRule = {
      id: Date.now().toString(),
      countryCode,
      name,
      rate: parseFloat(rate),
      glCode,
      appliesTo: appliesTo || ['ALL']
    };

    taxRulesDB.push(newRule);

    return NextResponse.json(newRule, { status: 201 });
  } catch (error) {
    console.error('Error creating tax rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update existing tax rule
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, countryCode, name, rate, glCode, appliesTo } = body;

    // Validation
    if (!id || !countryCode || !name || rate === undefined || !glCode) {
      return NextResponse.json({ 
        error: 'Missing required fields: id, countryCode, name, rate, glCode' 
      }, { status: 400 });
    }

    // Find existing rule
    const ruleIndex = taxRulesDB.findIndex(rule => rule.id === id);
    if (ruleIndex === -1) {
      return NextResponse.json({ error: 'Tax rule not found' }, { status: 404 });
    }

    // Check for duplicate GL code (excluding current rule)
    const existingRule = taxRulesDB.find(rule => 
      rule.id !== id && rule.countryCode === countryCode && rule.glCode === glCode
    );
    
    if (existingRule) {
      return NextResponse.json({ 
        error: 'GL code already exists for this country' 
      }, { status: 409 });
    }

    // Update rule
    const updatedRule: TaxRule = {
      id,
      countryCode,
      name,
      rate: parseFloat(rate),
      glCode,
      appliesTo: appliesTo || ['ALL']
    };

    taxRulesDB[ruleIndex] = updatedRule;

    return NextResponse.json(updatedRule);
  } catch (error) {
    console.error('Error updating tax rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete tax rule
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Tax rule ID is required' }, { status: 400 });
    }

    // Find and remove rule
    const ruleIndex = taxRulesDB.findIndex(rule => rule.id === id);
    if (ruleIndex === -1) {
      return NextResponse.json({ error: 'Tax rule not found' }, { status: 404 });
    }

    const deletedRule = taxRulesDB[ruleIndex];
    taxRulesDB.splice(ruleIndex, 1);

    return NextResponse.json({ 
      message: 'Tax rule deleted successfully',
      deletedRule 
    });
  } catch (error) {
    console.error('Error deleting tax rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
