# 🔗 Technical Integration Guide

## Overview

This document explains the technical implementation of how all modules in the Ghana Hotel Management System are interconnected. The system uses a **reactive architecture** where changes in one module automatically trigger updates across the entire ecosystem.

## 🏗️ Architecture Principles

### 1. **Single Source of Truth**
- Each data entity has one authoritative store
- All modules reference the same data
- Updates propagate automatically

### 2. **Event-Driven Communication**
- Modules communicate through events
- No direct module-to-module dependencies
- Loose coupling for maintainability

### 3. **Reactive State Management**
- Zustand stores with automatic subscriptions
- Real-time updates across all components
- Automatic re-rendering when data changes

## 🔄 Core Data Flow

### Guest Cycle Integration

```typescript
// When a guest checks in:
FrontDesk → GuestProfile → Accounting → Inventory

// When F&B charges to room:
FBPOS → GuestFolio → Accounting → NightAudit

// When guest checks out:
FrontDesk → Payment → Accounting → Reports
```

### Procurement Cycle Integration

```typescript
// When creating a purchase order:
Stores → PurchaseOrder → Accounting → Supplier

// When receiving goods:
Stores → GRN → Inventory → Accounting → COGS

// When issuing stock:
Stores → Issue → Inventory → Accounting → COGS
```

## 📊 Store Integration Map

### Stores Store (`src/app/lib/stores/store.ts`)
**Purpose**: Manages all inventory, suppliers, and purchasing
**Integrations**:
- **Accounting**: Creates journal entries for PO commitments, GRN receipts, stock issues
- **F&B**: Provides stock levels, receives usage updates
- **Front Desk**: Provides supply costs for guest charges

**Key Methods**:
```typescript
createPurchaseOrder() // Creates PO and accounting commitment
receiveGoods() // Updates inventory and creates asset entries
updateItemStock() // Updates levels and triggers alerts
```

### Accounting Store (`src/app/lib/accounting/store.ts`)
**Purpose**: Manages all financial transactions and reporting
**Integrations**:
- **All Modules**: Receives journal entries from operational activities
- **Stores**: Tracks inventory assets and COGS
- **F&B**: Records revenue and tax liabilities
- **Front Desk**: Manages guest receivables

**Key Methods**:
```typescript
addJournalEntry() // Records financial transactions
updateGLBalance() // Updates account balances
generateReports() // Creates compliance reports
```

### F&B Store (`src/app/lib/fb/ordersStore.ts`)
**Purpose**: Manages food and beverage orders
**Integrations**:
- **Stores**: Triggers inventory updates
- **Accounting**: Creates revenue entries
- **Front Desk**: Posts room charges

## 🔗 Module Communication Patterns

### 1. **Direct Store Integration**
```typescript
// F&B POS directly calls stores store
import { storesStore } from '../lib/stores/store';

// When selling an item
storesStore.createStockMovement({
  movementType: 'issue',
  itemId: item.id,
  quantity: item.qty,
  // ... other data
});
```

### 2. **Event-Based Communication**
```typescript
// Components listen to store changes
React.useEffect(() => {
  const unsubscribe = storesStore.subscribe(() => {
    // Re-render when store changes
    setTick(t => t + 1);
  });
  return unsubscribe;
}, []);
```

### 3. **Cross-Module Data Sharing**
```typescript
// Stores store provides data to accounting
const inventoryValue = storesStore.getInventoryValue();
const vatLiability = storesStore.getVATLiability();

// Accounting store uses this data for reports
accountingStore.updateGLBalance('1500', 'current', { balance: inventoryValue });
```

## 🎯 Key Integration Points

### 1. **Inventory → Accounting**
```typescript
// When inventory is received
storesStore.receiveGoods(poId, receivedItems);

// Automatically creates accounting entries:
// - Debit: Inventory Asset (1500)
// - Credit: VAT Payable (2200) 
// - Credit: Accounts Payable (2100)
```

### 2. **F&B Sales → Inventory + Accounting**
```typescript
// When F&B sale is completed
// 1. Update inventory (deduct ingredients)
storesStore.updateItemStock(itemId, -quantity);

// 2. Create revenue journal entry
accountingStore.addJournalEntry({
  // Revenue account credit
  // Tax liability credits
  // Cash/Bank debit
});
```

### 3. **Guest Charges → Accounting**
```typescript
// When charging to room
// 1. Create receivable entry
accountingStore.addJournalEntry({
  // Debit: Accounts Receivable (1300)
  // Credit: Revenue account
});

// 2. When payment received
// Debit: Cash/Bank (1100)
// Credit: Accounts Receivable (1300)
```

## 🔒 Data Consistency Guarantees

### 1. **Transaction Atomicity**
- All related operations succeed or fail together
- No partial updates that could leave system inconsistent

### 2. **Real-Time Synchronization**
- Changes propagate immediately across all modules
- No polling or manual refresh required

### 3. **Audit Trail**
- Every change is logged with timestamp and user
- Complete history for compliance and debugging

## 🚀 Performance Optimizations

### 1. **Selective Subscriptions**
```typescript
// Components only subscribe to data they need
const lowStockItems = storesStore.getLowStockItems();
const inventoryValue = storesStore.getInventoryValue();
```

### 2. **Lazy Loading**
- Data is loaded only when needed
- Large datasets are paginated
- Background updates don't block UI

### 3. **Efficient Re-renders**
- Components only re-render when their specific data changes
- Memoization prevents unnecessary calculations

## 🧪 Testing Integration

### 1. **Unit Tests**
- Test individual store methods
- Mock dependencies for isolation

### 2. **Integration Tests**
- Test module interactions
- Verify data flow between stores

### 3. **End-to-End Tests**
- Test complete user workflows
- Verify system behavior under load

## 🔧 Debugging Integration Issues

### 1. **Event Logging**
```typescript
// All major operations are logged
trackEvent('fb_sale_completed', { 
  orderId, venue, customerType, total 
});
```

### 2. **State Inspection**
- Use browser dev tools to inspect store state
- Check component subscriptions
- Verify data flow between modules

### 3. **Common Issues**
- **Missing subscriptions**: Component not updating
- **Circular dependencies**: Infinite update loops
- **Race conditions**: Data updates out of order

## 📈 Monitoring Integration Health

### 1. **Real-Time Metrics**
- Module connectivity status
- Data synchronization health
- Performance indicators

### 2. **Alert System**
- Integration failures
- Data inconsistencies
- Performance degradation

### 3. **Health Dashboard**
- System status overview
- Integration metrics
- Troubleshooting tools

## 🔮 Future Integration Enhancements

### 1. **API Integration**
- Third-party payment gateways
- External inventory systems
- GRA compliance APIs

### 2. **Real-Time Collaboration**
- Multi-user editing
- Conflict resolution
- Offline synchronization

### 3. **Advanced Analytics**
- Predictive modeling
- Machine learning insights
- Business intelligence dashboards

---

## 💡 Best Practices

1. **Always use stores** for data management
2. **Subscribe only to needed data** in components
3. **Use events** for cross-module communication
4. **Maintain single source of truth** for each data type
5. **Test integration points** thoroughly
6. **Monitor system health** continuously
7. **Document data flows** clearly
8. **Plan for scalability** from the start

This integration architecture ensures that the Ghana Hotel Management System operates as a **unified, intelligent platform** rather than a collection of disconnected tools.
