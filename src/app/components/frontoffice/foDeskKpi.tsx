'use client';

import React, { createContext, useContext, useMemo } from 'react';
import CustomizeViewControl from '../dashboard/CustomizeViewControl';
import {
  useDashboardVisibility,
  type DashboardSectionDef,
} from '../../lib/dashboard/useDashboardVisibility';

export const FO_OVERVIEW_SECTIONS: DashboardSectionDef[] = [
  { id: 'availableRooms', label: 'Available Rooms' },
  { id: 'occupiedRooms', label: 'Occupied Rooms' },
  { id: 'maintenance', label: 'Maintenance & Cleaning' },
  { id: 'todayOps', label: "Today's Room Operations" },
  { id: 'recentActivities', label: 'Recent Activities' },
  { id: 'notices', label: 'Front Desk Notices' },
];

export const FO_RESERVATIONS_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'res.totalReservations', label: 'Total Reservations' },
  { id: 'res.confirmed', label: 'Confirmed' },
  { id: 'res.checkedIn', label: 'Checked In' },
  { id: 'res.businessStays', label: 'Business Stays' },
  { id: 'res.thirdPartyBilling', label: 'Third Party Billing' },
  { id: 'res.internationalGuests', label: 'International Guests' },
  { id: 'res.pending', label: 'Pending' },
];

export const FO_ROOMS_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'rooms.occupied', label: 'Occupied' },
  { id: 'rooms.reserved', label: 'Reserved' },
  { id: 'rooms.vacant', label: 'Vacant' },
  { id: 'rooms.dirty', label: 'Dirty' },
  { id: 'rooms.clean', label: 'Clean' },
  { id: 'rooms.inspected', label: 'Inspected' },
  { id: 'rooms.outOfOrder', label: 'Out of Order' },
  { id: 'rooms.maintenance', label: 'Maintenance' },
];

export const FO_DESK_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'desk.totalCharges', label: 'Total Charges (incl. tax)' },
  { id: 'desk.paidAmount', label: 'Paid Amount (incl. tax)' },
  { id: 'desk.outstanding', label: 'Outstanding (incl. tax)' },
  { id: 'desk.paidTotal', label: 'Paid/Total' },
];

export const FO_SERVICE_CHARGES_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'svc.totalCharges', label: 'Total Charges (incl. tax)' },
  { id: 'svc.paidAmount', label: 'Paid Amount (incl. tax)' },
  { id: 'svc.outstanding', label: 'Outstanding (incl. tax)' },
  { id: 'svc.paidTotal', label: 'Paid/Total' },
];

export const FO_INVOICES_KPI_SECTIONS: DashboardSectionDef[] = [
  { id: 'inv.totalInvoices', label: 'Total Invoices' },
  { id: 'inv.collected', label: 'Collected' },
  { id: 'inv.outstanding', label: 'Outstanding' },
  { id: 'inv.overdue', label: 'Overdue' },
];

export const ALL_FO_DESK_SECTIONS: DashboardSectionDef[] = [
  ...FO_OVERVIEW_SECTIONS,
  ...FO_RESERVATIONS_KPI_SECTIONS,
  ...FO_ROOMS_KPI_SECTIONS,
  ...FO_DESK_KPI_SECTIONS,
  ...FO_SERVICE_CHARGES_KPI_SECTIONS,
  ...FO_INVOICES_KPI_SECTIONS,
];

export const FO_KPI_SECTIONS_BY_TAB: Record<string, DashboardSectionDef[]> = {
  reservations: FO_RESERVATIONS_KPI_SECTIONS,
  rooms: FO_ROOMS_KPI_SECTIONS,
  desk: FO_DESK_KPI_SECTIONS,
  servicecharges: FO_SERVICE_CHARGES_KPI_SECTIONS,
  billing: FO_INVOICES_KPI_SECTIONS,
};

export type FoDeskVisibilityApi = {
  isHidden: (id: string) => boolean;
  hide: (id: string) => void;
  show: (id: string) => void;
  toggle: (id: string) => void;
  showAll: () => void;
  hiddenCount: number;
  /** True when Customize lives on the Front Office shell header. */
  isHosted: boolean;
};

const FoDeskVisibilityContext = createContext<FoDeskVisibilityApi | null>(null);

export function FrontOfficeDeskVisibilityProvider({
  value,
  children,
}: {
  value: Omit<FoDeskVisibilityApi, 'isHosted'>;
  children: React.ReactNode;
}) {
  const hosted = useMemo(() => ({ ...value, isHosted: true }), [value]);
  return (
    <FoDeskVisibilityContext.Provider value={hosted}>
      {children}
    </FoDeskVisibilityContext.Provider>
  );
}

/** Prefer FO shell visibility so ✕ and header Customize share state. */
export function useFrontOfficeDeskVisibility(
  fallbackSections: DashboardSectionDef[] = ALL_FO_DESK_SECTIONS,
  fallbackKey = 'dashboard.hidden.frontoffice',
): FoDeskVisibilityApi {
  const ctx = useContext(FoDeskVisibilityContext);
  const local = useDashboardVisibility(fallbackKey, fallbackSections);
  if (ctx) return ctx;
  return { ...local, isHosted: false };
}

/** Tab-scoped Customize for the Front Office header (or a standalone page fallback). */
export function FoDeskKpiCustomize({
  sections,
  className,
}: {
  sections: DashboardSectionDef[];
  className?: string;
}) {
  const { isHidden, show, toggle, showAll } = useFrontOfficeDeskVisibility();
  const hiddenCount = useMemo(
    () => sections.filter((s) => isHidden(s.id)).length,
    [sections, isHidden],
  );

  const showAllInScope = () => {
    if (hiddenCount === 0) {
      showAll();
      return;
    }
    sections.forEach((s) => {
      if (isHidden(s.id)) show(s.id);
    });
  };

  if (sections.length === 0) return null;

  return (
    <CustomizeViewControl
      sections={sections}
      isHidden={isHidden}
      toggle={toggle}
      showAll={showAllInScope}
      hiddenCount={hiddenCount}
      className={className}
    />
  );
}
