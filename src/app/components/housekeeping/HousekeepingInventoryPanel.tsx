'use client';

import DepartmentInventoryPanel from '../inventory/DepartmentInventoryPanel';

/** Housekeeping Inventory tab — SKUs from Stores, levels editable here. */
export default function HousekeepingInventoryPanel() {
  return <DepartmentInventoryPanel department="housekeeping" />;
}
