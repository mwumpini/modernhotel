'use client';

import DepartmentInventoryPanel from '../inventory/DepartmentInventoryPanel';

export default function HousekeepingInventoryPanel({
  hideStats = false,
  onHideStats,
}: {
  hideStats?: boolean;
  onHideStats?: () => void;
} = {}) {
  return (
    <DepartmentInventoryPanel
      department="housekeeping"
      hideStats={hideStats}
      onHideStats={onHideStats}
    />
  );
}
