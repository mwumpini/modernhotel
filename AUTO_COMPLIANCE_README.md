# Auto Compliance System - Ghana Hotel Management

## Overview

The Auto Compliance System is a comprehensive solution for managing tax calculations and regulatory compliance across multiple countries. It automatically applies the correct tax rules based on the selected country and provides real-time compliance monitoring.

## Key Features

### 🌍 Country-Switch Automation
- **Dynamic Tax Rules**: Changing country updates all tax calculations instantly
- **Multi-Country Support**: Currently supports Ghana (GH), Zimbabwe (ZW), and United States (US)
- **Real-Time Updates**: Tax rates and rules update automatically when country changes

### 🧮 Real-Time Tax Calculation
- **Automatic Application**: Applies correct rates based on active country
- **Category-Specific Rules**: Supports product-specific tax rules (Food & Beverage, Room Service, etc.)
- **GL Code Integration**: Includes accounting codes for seamless bookkeeping

### 📊 Compliance Reporting
- **Reporting Requirements**: Tracks due dates and requirements for each country
- **Compliance Score**: Real-time compliance percentage calculation
- **Automated Tracking**: Monitors pending and submitted reports

### 🔧 Extensible Architecture
- **Modular Design**: Easy to add new countries and tax rules
- **API-Driven**: RESTful APIs for tax rules and reporting requirements
- **State Management**: Zustand store for reactive state management

## System Architecture

### Database Models (`/lib/models.ts`)
```typescript
// Tax Rule Definition
interface TaxRule {
  id: string;
  countryCode: string; // 'GH', 'ZW', 'US'
  name: string;        // 'NHIL', 'VAT'
  rate: number;        // 2.5 for 2.5%
  glCode: string;      // Accounting code
  appliesTo?: string[] // Optional: product categories
}

// Reporting Requirements
interface ReportingRule {
  id: string;
  countryCode: string;
  reportType: 'VAT' | 'IncomeTax' | 'NHIL' | 'Tourism' | 'SSNIT' | 'PAYE' | 'Sales Tax' | 'Hotel Tax';
  frequency: 'Monthly' | 'Quarterly' | 'Annually';
  fieldsRequired: string[];
  dueDay: number;
  isActive: boolean;
  lastUpdated: string;
}
```

### State Management (`/lib/compliance/store.ts`)
- **Zustand Store**: Centralized state management
- **Country Switching**: Async country updates with API calls
- **Tax Calculation**: Real-time tax computation
- **Transaction Recording**: Automatic transaction logging

### API Routes
- **`/api/compliance/taxes`**: Fetch tax rules by country
- **`/api/compliance/taxes/manage`**: Create, update, and delete tax rules (POST, PUT, DELETE)
- **`/api/compliance/reports`**: Fetch reporting requirements by country

## Components

### 1. Country Selector (`/components/CountrySelector.tsx`)
- Dropdown for country selection
- Loading states during country switches
- Visual country flags and names

### 2. Tax Calculator (`/components/Checkout.tsx`)
- Real-time tax calculation
- Category-specific tax application
- Transaction recording
- GL code display

### 3. Compliance Reports (`/components/ComplianceReports.tsx`)
- Active reporting requirements
- Due date calculations
- Compliance score tracking
- Required fields summary

### 4. Auto Compliance Dashboard (`/components/AutoComplianceDashboard.tsx`)
- Comprehensive dashboard view
- Multiple tabs for different functions
- Integration of all compliance components

### 5. Tax Rate Builder (`/components/TaxRateBuilder.tsx`)
- **Visual Tax Rule Management**: Create, edit, and delete tax rules with a user-friendly interface
- **Multi-Country Support**: Manage tax rules for different countries (Ghana, Zimbabwe, US, Nigeria, Kenya, South Africa)
- **Category-Specific Rules**: Apply taxes to specific product/service categories
- **Real-Time Preview**: See tax calculation results as you build rules
- **GL Code Management**: Assign proper accounting codes to each tax rule
- **Validation & Error Handling**: Built-in validation for duplicate GL codes and required fields

## Tax Rules by Country

### Ghana (GH) - 2024 Tax Structure
- **NHIL**: 2.5% - National Health Insurance Levy (on subtotal)
- **GETFund Levy**: 2.5% - Ghana Education Trust Fund (on subtotal)
- **COVID-19 Levy**: 1.0% - COVID-19 Recovery Levy (on subtotal)
- **VAT (Standard Rate)**: 15.0% - Value Added Tax (on amount after levies)
- **Tourism Levy**: 1.0% - Tourism Development Levy (on original subtotal)

**Calculation Example for $100:**
1. Subtotal: $100.00
2. Levies (NHIL + GETFund + COVID-19): $6.00 (2.5% + 2.5% + 1.0% = 6% of $100)
3. Amount after levies: $106.00
4. VAT: $15.90 (15% of $106.00)
5. Tourism Levy: $1.00 (1% of $100.00)
6. **Total: $122.90**

### Zimbabwe (ZW)
- **VAT**: 15% - Value Added Tax
- **Income Tax**: 20% - Income Tax

### United States (US)
- **Sales Tax**: 8.25% - General Sales Tax
- **Hotel Tax**: 12.0% - Hotel Accommodation Tax
- **Tourism Tax**: 3.0% - Tourism Development Tax

## Usage Examples

### Basic Tax Calculation
```typescript
import { useCalculateTax } from '@/app/hooks/useCalculateTax';

const calculateTax = useCalculateTax();
const { taxes, total } = calculateTax(100, 'FOOD'); // $100 food purchase
// Returns: { taxes: [{ name: 'VAT', amount: 12.5, glCode: 'GL-4203' }], total: 112.5 }
```

### Country Switching
```typescript
import { useComplianceStore } from '@/app/lib/compliance/store';

const { setCountry } = useComplianceStore();
await setCountry('ZW'); // Switches to Zimbabwe tax rules
```

### Tax Rule Management
```typescript
// Create new tax rule
const response = await fetch('/api/compliance/taxes/manage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    countryCode: 'GH',
    name: 'Custom Tax',
    rate: 5.0,
    glCode: '2105',
    appliesTo: ['FOOD', 'SERVICE']
  })
});

// Update existing tax rule
const response = await fetch('/api/compliance/taxes/manage', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'existing-id',
    countryCode: 'GH',
    name: 'Updated Tax',
    rate: 6.0,
    glCode: '2105',
    appliesTo: ['ALL']
  })
});

// Delete tax rule
const response = await fetch('/api/compliance/taxes/manage?id=rule-id', {
  method: 'DELETE'
});
```

### Compliance Summary
```typescript
import { useComplianceSummary } from '@/app/hooks/useCalculateTax';

const getComplianceSummary = useComplianceSummary();
const summary = getComplianceSummary();
// Returns: { complianceScore: 87, activeTaxRules: 5, pendingReports: 2, ... }
```

## Integration Points

### LINK to Other Modules
The auto compliance system is **LINKED** to other hotel management modules:

1. **POS System**: Automatic tax calculation during checkout
2. **Accounting**: GL codes for seamless bookkeeping
3. **Reporting**: Compliance data for regulatory reports
4. **Settings**: Country and tax rule configuration

### Database Integration
To connect to a real database:

1. **Replace Mock APIs**: Update `/api/compliance/taxes` and `/api/compliance/reports`
2. **Add Database Models**: Use Prisma/Mongoose for data persistence
3. **Implement Cron Jobs**: Auto-update tax rates and compliance status
4. **Add Admin UI**: Rule management and overrides

## Testing

### Test the System
1. Navigate to the main application
2. Go to "⚖️ Auto Compliance System" in the navigation
3. Try switching between countries (Ghana, Zimbabwe, US)
4. Use the Tax Calculator to test different amounts and categories
5. Check the Compliance Reports for due dates and requirements
6. Use the Tax Rate Builder to create and manage tax rules

### Direct Test Pages
- Visit `/compliance-test` for a standalone test of the compliance system
- Visit `/tax-builder-test` for a standalone test of the tax rate builder

## Future Enhancements

1. **Real Database Integration**: Replace mock data with actual database
2. **API Rate Updates**: Automatic tax rate updates from government APIs
3. **Document Generation**: Auto-generate compliance reports
4. **Email Notifications**: Alert system for due dates
5. **Audit Trail**: Complete transaction and compliance history
6. **Multi-Currency Support**: Handle different currencies per country
7. **Advanced Reporting**: Custom compliance dashboards
8. **Mobile App**: Compliance monitoring on mobile devices

## Technical Requirements

- **Next.js 15**: React framework
- **TypeScript**: Type safety
- **Zustand**: State management
- **HeroUI**: UI components
- **Tailwind CSS**: Styling

## Security Considerations

- **API Key Management**: Secure storage of government API keys
- **Data Encryption**: Sensitive compliance data encryption
- **Access Control**: Role-based access to compliance features
- **Audit Logging**: Complete audit trail for compliance actions

## Support

For questions or issues with the Auto Compliance System, please refer to the main hotel management system documentation or contact the development team.
