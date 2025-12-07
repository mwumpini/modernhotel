# Cost and Revenue Centers Guide

## Overview

The Cost and Revenue Centers system tracks financial performance by department and revenue source in the hotel management system. This enables detailed financial analysis, budgeting, and reporting.

## Key Concepts

### Cost Centers
**Purpose**: Track expenses by department or operational area

**Categories**:
- **Department**: Direct operational departments (Front Office, Housekeeping, F&B)
- **Operation**: Specific operational activities
- **Project**: Project-based expenses
- **Support**: Administrative and support departments

**Tracking**:
- Budget allocation
- Actual expenses incurred
- Variance (budget - actual)
- Percentage of budget utilized

### Revenue Centers
**Purpose**: Track revenue by source

**Categories**:
- **Rooms**: Accommodation revenue
- **Food & Beverage**: Restaurant, bar, room service revenue
- **Services**: Additional guest services
- **Conferences**: Meeting and conference revenue
- **Spa**: Spa and wellness revenue
- **Gift Shop**: Retail revenue
- **Other**: Miscellaneous revenue

**Tracking**:
- Revenue target/budget
- Actual revenue generated
- Variance (actual - budget)
- Performance against targets

## Integration Points

### 1. Front Office Integration
When posting room revenue, automatically record to revenue center:

```typescript
// Example: When posting room revenue
const { recordRevenue } = useAccountingStore();

// After posting room revenue
recordRevenue('RM', roomRevenue); // RM = Room Revenue Center
```

### 2. Food & Beverage Integration
When recording F&B sales, record to appropriate revenue center:

```typescript
// Restaurant sales
recordRevenue('REST', restaurantRevenue);

// Bar sales
recordRevenue('BAR', barRevenue);

// Room service sales
recordRevenue('RS', roomServiceRevenue);
```

### 3. Expense Tracking
When recording expenses (purchases, invoices, etc.), record to cost center:

```typescript
// Example: When posting housekeeping expenses
const { recordExpense } = useAccountingStore();

recordExpense('HK', expenseAmount); // HK = Housekeeping Cost Center
```

### 4. Journal Entry Integration
When creating journal entries, include cost/revenue center information:

```typescript
// Journal Entry with Cost Center
const journalEntry = {
  id: 'JE-001',
  date: new Date().toISOString(),
  description: 'Housekeeping supplies purchase',
  lines: [
    {
      accountCode: '5300', // Expense account
      description: 'Cleaning supplies',
      debit: 500,
      credit: 0,
      costCenter: 'HK' // Cost Center reference
    },
    // ... other lines
  ]
};
```

### 5. Invoice Integration
When creating invoices, specify department and cost/revenue center:

```typescript
// Purchase Invoice with Cost Center
const invoice = {
  invoiceNumber: 'INV-001',
  type: 'Purchase',
  department: 'housekeeping',
  costCenter: 'HK',
  // ... other fields
};
```

### 6. Reporting Integration
Generate reports by cost/revenue center:

```typescript
// Get cost center expenses
const housekeepingExpenses = costCenters.find(cc => cc.code === 'HK')?.actualExpenses;

// Get revenue by center
const roomRevenue = revenueCenters.find(rc => rc.code === 'RM')?.actualRevenue;

// Calculate variance
const variance = (budget - actual) / budget * 100;
```

## Default Cost Centers

1. **FO - Front Office**: Front desk operations and guest services
2. **HK - Housekeeping**: Housekeeping operations
3. **FB - Food & Beverage**: Restaurant and bar operations
4. **KT - Kitchen**: Kitchen operations and food preparation
5. **MT - Maintenance**: Engineering and maintenance
6. **AC - Accounting**: Finance and accounting department

## Default Revenue Centers

1. **RM - Room Revenue**: Accommodation revenue from all room types
2. **REST - Restaurant Revenue**: Restaurant food and dining revenue
3. **BAR - Bar Revenue**: Beverage and bar revenue
4. **RS - Room Service**: Room service revenue
5. **CF - Conference Revenue**: Conference and meeting room revenue
6. **SC - Service Charges**: Service charges and gratuities

## Usage Examples

### Recording Room Revenue
```typescript
import { useAccountingStore } from '@/app/lib/accounting/store';

const { recordRevenue } = useAccountingStore();

// When guest checks out and pays for room
const roomRevenue = 450.00;
recordRevenue('RM', roomRevenue);
```

### Recording F&B Expenses
```typescript
import { useAccountingStore } from '@/app/lib/accounting/store';

const { recordExpense } = useAccountingStore();

// When purchasing F&B supplies
const foodCost = 1250.00;
recordExpense('KT', foodCost);
```

### Checking Budget Variance
```typescript
import { useAccountingStore } from '@/app/lib/accounting/store';

const { costCenters } = useAccountingStore();

const housekeeping = costCenters.find(cc => cc.code === 'HK');
const budget = housekeeping?.budget || 0;
const actual = housekeeping?.actualExpenses || 0;
const variance = budget - actual;
const variancePercent = (variance / budget * 100).toFixed(1);

console.log(`Housekeeping budget variance: ${variancePercent}%`);
```

## Reporting

### Department Performance Report
Generate reports showing:
- Budget vs. Actual expenses for each cost center
- Budget vs. Actual revenue for each revenue center
- Variance analysis
- Percent of budget utilized

### Profitability Analysis
- Revenue by source
- Costs by department
- Net profit by department
- Contribution margin analysis

## Best Practices

1. **Consistent Coding**: Use consistent codes for centers across all transactions
2. **Regular Updates**: Update actuals in real-time as transactions occur
3. **Budget Reviews**: Regularly review and adjust budgets based on actuals
4. **Variance Analysis**: Investigate significant variances (typically >10%)
5. **Department Allocation**: Allocate shared costs appropriately across centers

## Future Enhancements

- Multi-period tracking and comparison
- Historical trend analysis
- Automated budget recommendations
- Department profitability dashboards
- Integration with forecasting tools

