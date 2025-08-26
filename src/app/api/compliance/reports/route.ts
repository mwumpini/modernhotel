import { NextResponse } from 'next/server';
import { ReportingRule } from '@/app/lib/models';

// Mock database (replace with real DB calls)
const reportingRulesDB: ReportingRule[] = [
  // Ghana Reporting Rules
  {
    id: '1',
    countryCode: 'GH',
    reportType: 'VAT',
    frequency: 'Monthly',
    fieldsRequired: ['totalSales', 'totalPurchases', 'vatOutput', 'vatInput'],
    dueDay: 20,
    isActive: true,
    lastUpdated: '2024-01-15'
  },
  {
    id: '2',
    countryCode: 'GH',
    reportType: 'NHIL',
    frequency: 'Monthly',
    fieldsRequired: ['totalSales', 'nhilAmount'],
    dueDay: 20,
    isActive: true,
    lastUpdated: '2024-01-15'
  },
  {
    id: '3',
    countryCode: 'GH',
    reportType: 'SSNIT',
    frequency: 'Monthly',
    fieldsRequired: ['employeeCount', 'totalSalaries', 'employerContribution'],
    dueDay: 15,
    isActive: true,
    lastUpdated: '2024-01-15'
  },
  {
    id: '4',
    countryCode: 'GH',
    reportType: 'PAYE',
    frequency: 'Monthly',
    fieldsRequired: ['employeeCount', 'totalSalaries', 'taxDeducted'],
    dueDay: 15,
    isActive: true,
    lastUpdated: '2024-01-15'
  },
  {
    id: '5',
    countryCode: 'GH',
    reportType: 'Tourism',
    frequency: 'Monthly',
    fieldsRequired: ['totalRevenue', 'tourismLevy'],
    dueDay: 20,
    isActive: true,
    lastUpdated: '2024-01-15'
  },
  
  // Zimbabwe Reporting Rules
  {
    id: '6',
    countryCode: 'ZW',
    reportType: 'VAT',
    frequency: 'Monthly',
    fieldsRequired: ['totalSales', 'totalPurchases', 'vatOutput', 'vatInput'],
    dueDay: 25,
    isActive: true,
    lastUpdated: '2024-01-15'
  },
  {
    id: '7',
    countryCode: 'ZW',
    reportType: 'IncomeTax',
    frequency: 'Quarterly',
    fieldsRequired: ['totalRevenue', 'expenses', 'taxableIncome'],
    dueDay: 30,
    isActive: true,
    lastUpdated: '2024-01-15'
  },
  
  // US Reporting Rules
  {
    id: '8',
    countryCode: 'US',
    reportType: 'Sales Tax',
    frequency: 'Monthly',
    fieldsRequired: ['totalSales', 'taxableSales', 'salesTax'],
    dueDay: 20,
    isActive: true,
    lastUpdated: '2024-01-15'
  },
  {
    id: '9',
    countryCode: 'US',
    reportType: 'Hotel Tax',
    frequency: 'Monthly',
    fieldsRequired: ['roomRevenue', 'hotelTax'],
    dueDay: 20,
    isActive: true,
    lastUpdated: '2024-01-15'
  }
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country');

    if (!country) {
      return NextResponse.json({ error: 'Country parameter is required' }, { status: 400 });
    }

    const rules = reportingRulesDB.filter(rule => rule.countryCode === country);
    
    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching reporting rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
