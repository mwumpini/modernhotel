# 📦 How Stock Updates Work When Receiving Goods

## 🔄 Complete Flow: From Goods Receipt to Stock Update

### **Step-by-Step Process**

```
1. User receives goods from Purchase Order
   ↓
2. handleReceiveGoods() is called
   ↓
3. Calculate additional quantity received
   ↓
4. Create GRN (Goods Receipt Note)
   ↓
5. Update stock level: updateStockLevel(itemId, quantity, 'add')
   ↓
6. Create stock movement record for audit trail
   ↓
7. Update PO received quantities
```

---

## 📋 **Detailed Implementation**

### **1. Goods Receipt Form**
When a user fills out the goods receipt form:
- They enter **received quantities** for each item
- System tracks what was **already received** previously

### **2. Quantity Calculation** 
```typescript
// In handleReceiveGoods() - Line 2579-2580
const currentReceived = poItem.receivedQuantity || 0;  // Already received
const additionalQty = receiptItem.receivedQty - currentReceived;  // NEW quantity

// Only processes if additionalQty > 0
if (additionalQty > 0) {
  // Update stock...
}
```

**Example:**
- PO ordered: 100 units
- Previously received: 30 units
- Now receiving: 50 units
- **Additional quantity**: 50 - 30 = **20 units** (only these 20 units are added to stock)

### **3. Stock Level Update**
``` Amplifier
// Line 2585: Update stock level
updateStockLevel(receiptItem.itemId, additionalQty, 'add');
```

**What `updateStockLevel()` does:**

```typescript
// From stockStore.ts - Line 305-323
updateStockLevel: (itemId, quantity, operation) => {
  const item = get().getStockItem(itemId);
  if (!item) return;

  let newQuantity = item.currentStock;
  
  switch (operation) {
    case 'add':
      // ADD to existing stock, but respect maximumStock limit
      newQuantity = Math.min(item.maximumStock, item.currentStock + quantity);
      break;
    case 'remove':
      newQuantity = Math.max(0, item.currentStock - quantity);
      break;
    case 'set':
      newQuantity = Math.max(0, Math.min(item.maximumStock, quantity));
      break;
  }

  // Update the item's currentStock field
  get().updateStockItem(itemId, { currentStock: newQuantity });
}
```

**Key Features:**
- ✅ **Adds to existing stock**: `currentStock + quantity`
- ✅ **Respects maximum stock**: Won't exceed `maximumStock` limit
- ✅ **Immediate update**: Stock is updated instantly in the store
- ✅ **No duplicates**: Only processes additional/new quantities

---

## 📊 **Example Scenario**

### **Initial State**
```
Item: Rice (BULK-001)
├── Current Stock: 50 kg
├── Minimum Stock: 20 kg
├── Maximum Stock: 500 kg
├── Reorder Point: 50 kg
└── Unit Cost: ₵10/kg
```

### **Purchase Order**
```
PO: PO-2024-001
├── Ordered: 200 kg
├── Previously Received: 0 kg
└── Unit Cost: ₵10/kg
```

### **Receiving Goods - First Receipt**
```
User Receives: 150 kg

Processing:
1. additionalQty = 150 - 0 = 150 kg
2. updateStockLevel('item_id', 150, 'add')
3. newQuantity = Math.min(500, 50 + 150) = 200 kg

Result:
├── Current Stock: 200 kg ✅ (50 + 150)
├── PO Received: 150/200 kg
└── Stock Movement Created: "IN - 150 kg - GRN-2024-001"
```

### **Receiving Goods - Partial Receipt**
```
User Receives: 100 kg (more)

Processing:
1. additionalQty = 100 - 0 = 100 kg
   Wait... PO already has receivedQuantity = 150
   
Actually:
1. currentReceived = 150 kg (from previous receipt)
2. additionalQty = 100 - 150 = -50 kg ❌
   
CORRECT FLOW:
System tracks per receipt, so:
1. currentReceived = 150 kg
2. receivedQty = 250 kg (total now)
3. additionalQty = 250 - 150 = 100 kg ✅
4. updateStockLevel('item_id', 100, 'add')
5. newQuantity = Math.min(500, 200 + 100) = 300 kg

Result:
├── Current Stock: 300 kg ✅ (200 + 100)
├── PO Received: 250/200 kg (over-received!)
└── Stock Movement Created: "IN - 100 kg - GRN-2024-002"
```

---

## 🔍 **Stock Movement Audit Trail**

Every stock update creates a movement record:

```typescript
// Line 2588-2604
addStockMovement({
  itemId: receiptItem.itemId,
  itemCode: receiptItem.itemCode,
  itemName: receiptItem.itemName,
  movementType: 'in',  // ✅ IN transaction
  quantity: additionalQty,
  unitCost: receiptItem.unitCost,
  totalValue: additionalQty * receiptItem.unitCost,
  toLocation: stockItems.find(i => i.id === receiptItem.itemId)?.location || '',
  referenceType: 'purchase',
  referenceId: grn.id,  // Links to GRN
  referenceNumber: grn.grnNumber,  // GRN-2024-001
  batchNumber: receiptItem.batchNumber,
  expiryDate: receiptItem.expiryDate,
  performedBy: 'Current User',
  notes: `Received from ${selectedPOForReceipt.poNumber} - GRN ${grn.grnNumber}`
});
```

**Benefits:**
- ✅ **Complete audit trail**: Every stock change is recorded
- ✅ **Linked to GRN**: Can trace back to receipt document
- ✅ **Batch/Expiry tracking**: Tracks batch numbers and expiry dates
- ✅ **Financial tracking**: Records unit cost and total value

---

## ⚠️ **Important Notes**

### **1. Maximum Stock Limit**
```typescript
newQuantity = Math.min(item.maximumStock, item.currentStock + quantity);
```
- Stock **won't exceed** the item's `maximumStock` setting
- Example: If max is 500 kg and current is 450 kg, receiving 100 kg will only add 50 kg

### **2. Partial Receipts**
- System supports **multiple partial receipts** for the same PO
- Each receipt calculates **only the additional quantity**
- PO tracks **cumulative received quantity**

### **3. Quality Check Impact**
- Stock is updated **immediately** on receipt
- Quality check happens **after** stock is updated
- Rejected items would need a separate adjustment (future enhancement)

### **4. Real-Time Updates**
- Stock updates are **immediate** and **synchronous**
- All UI components using `useStockStore()` will **automatically re-render**
- No manual refresh needed

---

## 📈 **Complete Stock Update Flow Diagram**

```
┌─────────────────────────────────────────────────────────┐
│           GOODS RECEIPT → STOCK UPDATE FLOW              │
└─────────────────────────────────────────────────────────┘

1. USER ACTION
   User fills Goods Receipt form
   ├── Enter received quantities
   ├── Optional: Batch numbers
   └── Optional: Expiry dates
           ↓

2. VALIDATION
   handleReceiveGoods() validates:
   ├── ✓ PO exists
   ├── ✓ Has items to receive
   └── ✓ Quantities > 0
           ↓

3. CALCULATE ADDITIONAL QUANTITY
   additionalQty = receivedQty - currentReceived
   ├── Example: 100 - 30 = 70 units
   └── Only processes if > 0
           ↓

4. CREATE GRN
   createGRN() creates Goods Receipt Note
   ├── GRN Number: GRN-YYYY-001
   ├── Links to PO
   └── Stores all receipt details
           ↓

5. UPDATE STOCK LEVEL
   updateStockLevel(itemId, additionalQty, 'add')
   ├── Finds item by ID
   ├── Adds: currentStock + additionalQty
   ├── Respects: Math.min(maximumStock, newQty)
   └── Updates: item.currentStock = newQuantity
           ↓

6. CREATE STOCK MOVEMENT
   addStockMovement() creates audit record
   ├── Type: 'in'
   ├── Quantity: additionalQty
   ├── Links to: GRN ID & Number
   ├── Includes: Batch, Expiry, Cost
   └── Stores: Who, When, Why
           ↓

7. UPDATE PO STATUS
   Updates Purchase Order:
   ├── receivedQuantity per item
   ├── Status: 'in-transit' or 'delivered'
   └── actualDeliveryDate if complete
           ↓

8. RESULT
   ✅ Stock increased by additional quantity
   ✅ GRN created for documentation
   ✅ Stock movement recorded for audit
   ✅ PO status updated
   ✅ Real-time UI updates
```

---

## 🎯 **Summary**

**How stock is added:**
1. System calculates **only new/additional quantities** (not duplicates)
2. Calls `updateStockLevel(itemId, quantity, 'add')`
3. Function adds: `currentStock = currentStock + quantity`
4. Respects `maximumStock` limit
5. Creates audit trail via stock movement
6. Updates happen **immediately** and **automatically**

**Key Benefits:**
- ✅ Prevents duplicate additions
- ✅ Supports partial receipts
- ✅ Respects stock limits
- ✅ Complete audit trail
- ✅ Real-time updates

