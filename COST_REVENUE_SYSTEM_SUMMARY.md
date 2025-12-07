# Cost and Revenue Centers System - Implementation Summary

## What We Built

A comprehensive **Cost and Revenue Centers** tracking system for the Ghana Hotel Management System. This allows the hotel to track expenses and revenue by department and source, enabling detailed financial analysis and reporting.

## Key Components

### 1. Enhanced Data Models
**File**: `src/app/lib/accounting/models.ts`

- **CostCenter** interface: Tracks expenses by department
  - Types: department, operation, project, support
  - Budget tracking with actual expenses
  - Variance calculation
  - Department classification

- **RevenueCenter** interface: Tracks revenue by source
  - Types: rooms, food_beverage, services, conferences, spa, gift_shop
  - Revenue targets/budgets
  - Actual revenue tracking
  - GL account code linking
  - Variance analysis

### 2. Store Management
**File**: `src/app/lib/accounting/store.ts`

**New State Fields**:
- `costCenters: CostCenter[]` - Array of cost centers
- `revenueCenters: RevenueCenter[]` - Array of revenue centers

**New Actions**:
- `setCostCenters` - Set all cost centers
- `addCostCenter` - Add new cost center
- `updateCostCenter` - Update existing cost center
- `deleteCostCenter` - Remove cost center
- `setRevenueCenters` - Set all revenue centers
- `addRevenueCenter` - Add new revenue center
- `updateRevenueCenter` - Update existing revenue center
- `deleteRevenueCenter` - Remove revenue center
- `recordExpense` - Record expense to cost center
- `recordRevenue` - Record revenue to revenue center

**Initialization**:
- Pre-configured 6 cost centers (FO, HK, FB, KT, MT, AC)
- Pre-configured 6 revenue centers (RM, REST, BAR, RS, CF, SC)

### 3. UI Component
**File**: `src/app/components/accounting/CostRevenueCenters.tsx`

**Features**:
- Tabbed interface for cost vs revenue centers
- Complete CRUD operations (Create, Read, Update, Delete)
- Real-time budget vs actual tracking
- Variance display (positive/negative with color coding)
- Modal forms for adding/editing centers
- Department and type filtering
- Active/Inactive status management

**Key UI Elements**:
- Tab navigation between cost and revenue centers
- Data tables showing all centers with metrics
- Add/Edit forms with validation
- Budget variance calculations
- Status indicators

### 4. Integration Guide
**File**: `COST_REVENUE_CENTERS_GUIDE.md`

Comprehensive documentation covering:
- System concepts and purpose
- Default cost and revenue centers
- Integration points with Front Office, F&B, Journal Entries, etc.
- Usage examples and code snippets
- Best practices
- Reporting guidelines

## Default Centers

### Cost Centers
1. **FO** - Front Office (Budget: 50,000 GHS)
2. **HK** - Housekeeping (Budget: 45,000 GHS)
3. **FB** - Food & Beverage (Budget: 80,000 GHS)
4. **KT** - Kitchen (Budget: 70,000 GHS)
5. **MT** - Maintenance (Budget: 30,000 GHS)
6. **AC** - Accounting (Budget: 35,000 GHS)

### Revenue Centers
1. **RM** - Room Revenue (Target: 500,000 GHS)
2. **REST** - Restaurant Revenue (Target: 200,000 GHS)
3. **BAR** - Bar Revenue (Target: 150,000 GHS)
4. **RS** - Room Service (Target: 80,000 GHS)
5. **CF** - Conference Revenue (Target: 120,000 GHS)
6. **SC** - Service Charges (Target: 100,000 GHS)

## Integration Points

### How to Use in Your Code

**Recording Expenses**:
```typescript
const { recordExpense } = useAccountingStore();
recordExpense('HK', 500); // Record 500 GHS to Housekeeping
```

**Recording Revenue**:
```typescript
const { recordRevenue } = useAccountingStore();
recordRevenue('RM', 450); // Record 450 GHS to Room Revenue
```

**Accessing Data**:
```typescript
const { costCenters, revenueCenters } = useAccountingStore();

// Get specific center
const housekeeping = costCenters.find(cc => cc.code === 'HK');
console.log(`Budget: ${housekeeping?.budget}, Actual: ${housekeeping?.actualExpenses}`);
```

## Next Steps for Full Integration

### 1. Front Office
When posting room revenue in checkout:
```typescript
recordRevenue('RM', roomRevenueAmount);
```

### 2. F&B System
When recording sales:
```typescript
recordRevenue('REST', restaurantSales);
recordRevenue('BAR', barSales);
```

### 3. Inventory Purchases
When receiving inventory:
```typescript
recordExpense('KT', purchaseAmount); // for kitchen inventory
recordExpense('HK', purchaseAmount); // for housekeeping supplies
```

### 4. Journal Entries
Link journal entry lines to cost/revenue centers via the existing `costCenter` field in `JournalEntryLine`

### 5. Invoices
Set `department` and `costCenter` fields in purchase invoices

## Benefits

1. **Financial Control**: Track expenses and revenue by department
2. **Budget Management**: Monitor actuals against budgets
3. **Variance Analysis**: Identify over/under budget areas
4. **Performance Metrics**: Measure department profitability
5. **Reporting**: Generate detailed financial reports by center
6. **Decision Making**: Data-driven insights for management

## Technical Details

- **Framework**: React with TypeScript
- **State Management**: Zustand store pattern
- **Component Type**: Client-side component ('use client')
- **Styling**: Tailwind CSS with modern, responsive design
- **Data Validation**: Form validation with required fields
- **Error Handling**: Try-catch blocks for async operations

## Files Modified/Created

1. `src/app/lib/accounting/models.ts` - Enhanced with CostCenter and RevenueCenter
2. `src/app/lib/accounting/store.ts` - Added state and actions
3. `src/app/components/accounting/CostRevenueCenters.tsx` - New UI component
4. `src/app/components/accounting/index.ts` - Export new component
5. `COST_REVENUE_CENTERS_GUIDE.md` - Integration guide
6. `COST_REVENUE_SYSTEM_SUMMARY.md` - This summary

## Status

✅ **Complete and Ready for Use**

All core functionality is implemented and tested. The system is ready to be integrated into the workflow throughout the hotel management system.

