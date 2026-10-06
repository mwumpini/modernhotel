'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HeadingInfo from './HeadingInfo';
import { chooseDanger, confirmDanger, confirmDelete, confirmVoid } from './DangerConfirm';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Input,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Chip,
  Textarea,
  Tabs,
  Tab,
  Switch,
  Pagination as HeroPagination
} from "@heroui/react";
import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import GuestSearchEmptyState from './frontoffice/GuestSearchEmptyState';
import AttachmentUpload from './shared/AttachmentUpload';
import { HideCardButton } from './dashboard/CustomizeViewControl';
import { FoDeskKpiCustomize, FO_RESERVATIONS_KPI_SECTIONS, useFrontOfficeDeskVisibility, useFrontOfficeDeskPeriod } from './frontoffice/foDeskKpi';
import { useHostSummaryCollapsed } from '../lib/dashboard/useSummaryCollapsed';
import { stayOverlapsPeriod } from '../lib/dashboard/useDashboardPeriod';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { resolveGuestAddress } from '../lib/frontoffice/helpers/guests';
import { useSettingsStore } from '../lib/settings/store';
import { useComplianceStore } from '../lib/compliance/store';
import { housekeepingStore } from '../lib/housekeeping/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import { Reservation, GuestProfile, StayReason, Nationality, IdType } from '../lib/frontoffice/types';
import {
  computeSalesTax,
  effectiveSalesTaxRate,
  exclusiveFromGross,
  grossFromExclusive,
} from '../lib/tax/engine';
import { calculateStayNights, resolveNightlyGross } from '../lib/frontoffice/helpers/rates';
import { canMarkNoShow } from '../lib/frontoffice/arrivals';
import { localStayDay, sortStays, type StaySortKey } from '../lib/frontoffice/stayWorksheet';
import StayWorksheetTable from './frontoffice/StayWorksheetTable';
import { findMainFolio, getFolioDisplayTotals } from '../lib/frontoffice/helpers/folio';
import { DateFilterPills } from './fb/DateFilterPills';
import { openPrintPreview, renderPrint } from '../lib/print/engine';
import { buildOrgProfile } from '../lib/print/buildOrgProfile';
import { notifySuccess } from '../lib/notifications/notify';

interface ReservationFormData {
  guestName: string;
  phone?: string;
  email?: string;
  nationality: Nationality;
  idType: IdType;
  idNumber: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  
  // Emergency contact
  emergencyContactName: string;
  emergencyContactRelationship: 'spouse' | 'parent' | 'child' | 'sibling' | 'friend' | 'colleague' | 'other';
  emergencyContactPhone: string;
  emergencyContactEmail?: string;
  emergencyContactAddress?: string;
  
  roomTypeId: string;
  ratePlanId?: string;
  customRate?: number;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  source?: string;
  isGuaranteed: boolean;
  remarksToGuest?: string;
  internalNotes?: string;
  marketCodes: string[];
  
  // New fields for billing and stay purpose
  stayReason: StayReason;
  stayReasonDetails?: string;
  billingPersonId?: string;
  companyName?: string;
  projectCode?: string;
  costCenter?: string;

  // Tax exemption — government/diplomatic/NGO guests exempt from VAT/NHIL/GETFund/Tourism Levy
  taxExempt?: boolean;
  taxExemptionType?: 'government' | 'ngo' | 'diplomatic' | 'other';
  taxExemptionNumber?: string;
  taxExemptionAuthority?: string;
  taxExemptionExpiry?: string;
  taxExemptionDocuments?: string[];
  taxExemptionNotes?: string;
}

interface ReservationsManagerProps {
  mode?: 'reservation' | 'checkin';
  embed?: boolean; // when true, hide lists and auto-open modal if requested
  autoOpenNew?: boolean; // when embed, auto-open new form
  onAutoOpenConsumed?: () => void;
  /** YYYY-MM-DD. Used when the desk opens this form for a walk-in. */
  defaultArrival?: string;
  defaultDeparture?: string;
  /** Called when the form closes. Ids are the stays just created, empty on cancel. */
  onFinished?: (reservationIds: string[]) => void;
}

// Audit Log Section Component
const AuditLogSection = ({ reservationId }: { reservationId: string }) => {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const response = await fetch(`/api/audit/reservation/${reservationId}`);
        if (response.ok) {
          const data = await response.json();
          setAuditLogs(data.logs || []);
        }
      } catch (error) {
        console.error('Error fetching audit logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, [reservationId]);

  if (loading) {
    return <div className="py-8 text-center text-gray-500">Loading audit logs...</div>;
  }

  if (auditLogs.length === 0) {
    return <div className="py-8 text-center text-gray-500">No audit logs found for this reservation.</div>;
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="text-sm text-gray-600 mb-4">
        Showing {auditLogs.length} proforma-related activity logs
      </div>
      
      <div className="space-y-3">
        {auditLogs.map((log, index) => (
          <Card key={log.id || index}>
            <CardBody>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      color={
                        log.action === 'proforma_sent' ? 'success' :
                        log.action === 'proforma_generated' ? 'primary' :
                        log.action === 'proforma_downloaded' ? 'warning' :
                        log.action === 'proforma_printed' ? 'secondary' : 'default'
                      }
                      variant="flat"
                    >
                      {log.action.replace('proforma_', '').replace('_', ' ').toUpperCase()}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown time'}
                    </span>
                  </div>
                  
                  {log.details && (
                    <div className="text-sm text-gray-700 space-y-1">
                      {log.details.guestEmail && (
                        <div>Guest: {log.details.guestEmail}</div>
                      )}
                      {log.details.guestName && (
                        <div>Guest Name: {log.details.guestName}</div>
                      )}
                      {log.details.messageId && (
                        <div>Email ID: {log.details.messageId}</div>
                      )}
                      {log.details.filename && (
                        <div>File: {log.details.filename}</div>
                      )}
                      {log.details.pdfSize && (
                        <div>PDF Size: {(log.details.pdfSize / 1024).toFixed(1)} KB</div>
                      )}
                      {log.details.fallbackToPrint && (
                        <div className="text-orange-600">Fallback to print due to PDF generation error</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
};

const RESERVATIONS_DASHBOARD_SECTIONS = FO_RESERVATIONS_KPI_SECTIONS;

/** Guest profiles carry either `name` or first/last name. */
function guestDisplayName(guest: GuestProfile): string {
  const g = guest as any;
  return String(g.name || `${g.firstName || ''} ${g.lastName || ''}`).trim();
}

const POSTED_STAY_VOID_MESSAGE =
  'This stay is already in the books (its bill went to Accounting at checkout). Void its receipts and invoice in Accounting → Accounts Receivable instead, so the reversal is posted there.';

export default function ReservationsBookingsManager({ mode = 'reservation', embed = false, autoOpenNew = false, onAutoOpenConsumed, defaultArrival = '', defaultDeparture = '', onFinished }: ReservationsManagerProps) {
  // Hard delete of a pending reservation; the server checks frontdesk.delete too.
  const canDeleteReservation = useSettingsStore((s) => s.hasPermission('frontdesk.delete'));
  const router = useRouter();
  const { isHidden, hide, hiddenCount: hiddenStatsCount, isHosted } =
    useFrontOfficeDeskVisibility(FO_RESERVATIONS_KPI_SECTIONS);
  const summaryCollapsed = useHostSummaryCollapsed();
  const { period: kpiPeriod, todayISO: kpiToday } = useFrontOfficeDeskPeriod();
  // Starts null (matching SSR) and is only ever set from an effect — see the
  // load-reservations effect below — so this component's first render can't
  // diverge from the server-rendered HTML.
  const [businessDate, setBusinessDate] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [resPage, setResPage] = useState(1);
  const resRowsPerPage = 10;
  const [resSortKey, setResSortKey] = useState<StaySortKey>('arrival');
  const [resSortDir, setResSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [purposeFilter, setPurposeFilter] = useState<string>('all');
  const [billingFilter, setBillingFilter] = useState<string>('all');
  // Date filter: 'all' | 'today' | 'specific' | 'range'
  const [dateFilterMode, setDateFilterMode]   = useState<'all' | 'today' | 'specific' | 'range'>('all');
  const [dateFilterSingle, setDateFilterSingle] = useState<string>('');   // YYYY-MM-DD
  const [dateFilterFrom,   setDateFilterFrom]   = useState<string>('');   // YYYY-MM-DD
  const [dateFilterTo,     setDateFilterTo]     = useState<string>('');   // YYYY-MM-DD
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [tabKey, setTabKey] = useState<string>('guest');
  // Assign room modal state
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  /** The assign pop-up was opened from "Check in" — check the guest in once a room is assigned. */
  const [checkInAfterAssign, setCheckInAfterAssign] = useState(false);
  /** Which new-booking guest card has its small room pop-up open, and its choices. */
  const [roomPickerFor, setRoomPickerFor] = useState<string | null>(null);
  const [roomPickerChoice, setRoomPickerChoice] = useState('');
  const [roomPickerMatchType, setRoomPickerMatchType] = useState(true);
  /** Assign room pop-up on an existing booking (Guest row of the Reservation tab). */
  const [editRoomPickerOpen, setEditRoomPickerOpen] = useState(false);
  const [assignReservation, setAssignReservation] = useState<Reservation | null>(null);
  const [assignRoomId, setAssignRoomId] = useState<string>('');
  const [assignRoomSearch, setAssignRoomSearch] = useState<string>('');
  const [assignMatchTypeOnly, setAssignMatchTypeOnly] = useState<boolean>(true);
  const [editRateInput, setEditRateInput] = useState('');
  const [noShowTarget, setNoShowTarget] = useState<Reservation | null>(null);
  const { isOpen: isNoShowOpen, onOpen: onNoShowOpen, onClose: onNoShowClose } = useDisclosure();
  
  // Derived pricing helpers (bulk-only usage now)
  const getSelectedRoomType = (roomTypeId: string) =>
    useSettingsStore.getState().roomManagement.roomTypes.find(rt => rt.id === roomTypeId);
  const getNightlyRate = (roomTypeId: string) => {
    const settingsState = useSettingsStore.getState();
    const defaultRpId = (settingsState.roomManagement.defaultRatePlanByRoomType || {})[roomTypeId];
    if (defaultRpId) {
      const rp = settingsState.roomManagement.ratePlans.find(rp => rp.id === defaultRpId);
      if (rp) return rp.basePrice || 0;
    }
    const anyRp = settingsState.roomManagement.ratePlans.find(rp => rp.roomTypeId === roomTypeId && rp.isActive);
    if (anyRp) return anyRp.basePrice || 0;
    const roomType = getSelectedRoomType(roomTypeId);
    if (roomType?.baseRate) return roomType.baseRate;
    return 0;
  };
  const getPlanGross = (plan: any): number => {
    if (!plan) return 0;
    return resolveNightlyGross(Number(plan.basePrice || 0), (plan as any).priceType);
  };

  const getPriceTypeFromSelection = (roomTypeId: string, ratePlanId?: string) => {
    const settingsState = useSettingsStore.getState();
    if (ratePlanId && ratePlanId !== 'custom') {
      const rp = (settingsState.roomManagement.ratePlans || []).find((r: any) => r.id === ratePlanId);
      if (rp) return (rp as any).priceType || 'subtotal';
    }
    const defaultRpId = (settingsState.roomManagement.defaultRatePlanByRoomType || {})[roomTypeId];
    if (defaultRpId) {
      const rp = (settingsState.roomManagement.ratePlans || []).find((r: any) => r.id === defaultRpId);
      if (rp) return (rp as any).priceType || 'subtotal';
    }
    return 'subtotal';
  };

  // Compute nightly rate for a specific reservation (independent of form state)
  const getNightlyRateForReservation = (reservation: Reservation) => {
    const settingsState = useSettingsStore.getState();
    // Prefer stored breakdown
    if (reservation.rateBreakdown && reservation.rateBreakdown.length > 0) {
      return reservation.rateBreakdown[0]?.total || reservation.rateBreakdown[0]?.base || 0;
    }
    // Use reservation's selected rate plan
    if (reservation.ratePlanId) {
      const rp = (settingsState.roomManagement.ratePlans || []).find(r => r.id === reservation.ratePlanId);
      if (rp) return rp.basePrice || 0;
    }
    // Fallback: default mapping for this room type
    const defaultRpId = (settingsState.roomManagement.defaultRatePlanByRoomType || {})[reservation.roomTypeId];
    if (defaultRpId) {
      const rp = (settingsState.roomManagement.ratePlans || []).find(r => r.id === defaultRpId);
      if (rp) return rp.basePrice || 0;
    }
    // Finally, room type base
    const rt = (settingsState.roomManagement.roomTypes || []).find(rt => rt.id === reservation.roomTypeId);
    return rt?.baseRate || 0;
  };

  const getComputedTotalsForReservation = (reservation: Reservation) => {
    if (reservation.rateBreakdown && reservation.rateBreakdown.length > 0) {
      const nights = reservation.rateBreakdown.length;
      const subtotal = reservation.rateBreakdown.reduce((s, d) => s + (d.base || 0), 0);
      const grandTotal = reservation.rateBreakdown.reduce((s, d) => s + (d.total || 0), 0);
      const tax = grandTotal - subtotal;
      const nightly = reservation.rateBreakdown[0]?.total || 0;
      const taxRate = subtotal > 0 ? tax / subtotal : effectiveSalesTaxRate();
      return { nights, nightly, subtotal, taxRate, tax, grandTotal };
    }
    const settingsState = useSettingsStore.getState();
    const plan = reservation.ratePlanId
      ? (settingsState.roomManagement.ratePlans || []).find((r: any) => r.id === reservation.ratePlanId)
      : undefined;
    if (plan?.basePrice) {
      const breakdown = frontOfficeStore.calculateRateBreakdown(
        reservation.roomTypeId,
        reservation.arrival,
        reservation.departure,
        plan.basePrice,
        (plan as any).priceType || 'subtotal'
      );
      const nights = breakdown.length;
      const subtotal = breakdown.reduce((s, d) => s + (d.base || 0), 0);
      const grandTotal = breakdown.reduce((s, d) => s + (d.total || 0), 0);
      const tax = grandTotal - subtotal;
      const taxRate = subtotal > 0 ? tax / subtotal : effectiveSalesTaxRate();
      return { nights, nightly: breakdown[0]?.total || 0, subtotal, taxRate, tax, grandTotal };
    }
    return getComputedTotals(reservation.arrival, reservation.departure, reservation.roomTypeId);
  };

  // Reservation confirmation via the Document Templates engine (logo, granular
  // guest/stay-details, proper tax breakdown) rather than the raw window.print()
  // of this tab's own DOM below — printed as 'accommodation-proforma' since a
  // confirmation is functionally a quote for the stay, same document family as
  // Events & Conferences' accommodation leg.
  const buildReservationConfirmationPrintData = (reservation: Reservation) => {
    const settingsState = useSettingsStore.getState();
    const address = resolveGuestAddress(frontOfficeStore.guests, reservation.guestId);
    const roomTypeName = frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Room';
    const { nights, nightly, subtotal, tax, grandTotal } = getComputedTotalsForReservation(reservation);
    // Scale the levy lines to the tax already on the quote, so VAT + NHIL + GETFund + Tourism
    // equals the tax the confirmation total was built from.
    const quoted = computeSalesTax(subtotal, tax);
    const pickTax = (type: string) =>
      quoted.lines.find((l) => l.type === type || l.taxCode.toUpperCase().includes(type.toUpperCase()))?.amount ?? 0;
    const company = reservation.companyName || reservation.billingPersonName;
    return {
      org: buildOrgProfile(settingsState),
      guest: {
        name: reservation.guestName,
        company: company || undefined,
        address,
        roomType: roomTypeName,
        roomRate: nightly,
        arrivalDate: reservation.arrival,
        departureDate: reservation.departure,
        nights,
      },
      docNumber: reservation.resId || reservation.id,
      docDate: new Date().toISOString(),
      title: 'Reservation Confirmation',
      items: [{ description: roomTypeName, qty: nights, unit: nights === 1 ? 'night' : 'nights', unitPrice: nights ? subtotal / nights : subtotal, amount: subtotal }],
      totals: {
        subTotal: subtotal,
        taxes: { vat: pickTax('VAT'), nhil: pickTax('NHIL'), levy: pickTax('Tourism'), gefl: pickTax('GETFund') },
        grandTotal,
      },
      footerNotes: [reservation.remarksToGuest || 'We look forward to welcoming you.'],
      currency: '₵',
    } as any;
  };

  // html2canvas (bundled inside html2pdf.js) can't parse the oklch() color
  // functions Tailwind v4 emits, so screenshotting this tab's own live DOM
  // (the "Summary / Print" panel above, styled with Tailwind classes) throws
  // "Attempting to parse an unsupported color function oklch" and silently
  // produces no PDF. Rendering the Document Templates engine's HTML instead —
  // same content, but with the hardcoded hex/rgb CSS every built-in template
  // uses, no Tailwind involved — into an off-screen iframe sidesteps that
  // entirely; html2canvas rasterizes the iframe's real, laid-out document.
  const renderReservationPdfSource = async (reservation: Reservation): Promise<{ el: HTMLElement; cleanup: () => void }> => {
    const settingsState = useSettingsStore.getState();
    const html = renderPrint(
      'accommodation-proforma' as any,
      settingsState.printing['accommodation-proforma'] || 'builtin-accommodation-proforma-standard',
      buildReservationConfirmationPrintData(reservation)
    );
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '800px';
    iframe.style.height = '1200px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.srcdoc = html;
    });
    const body = iframe.contentDocument?.body;
    if (!body) {
      iframe.remove();
      throw new Error('Failed to render PDF source');
    }
    return { el: body, cleanup: () => iframe.remove() };
  };

  const printConfirmation = (reservation: Reservation) => {
    trackEvent('Proforma.Printed', { reservationId: reservation.id, guestName: reservation.guestName, via: 'template' }, { sourceModule: 'FrontOffice' });
    const settingsState = useSettingsStore.getState();
    openPrintPreview('accommodation-proforma' as any, settingsState.printing['accommodation-proforma'] || 'builtin-accommodation-proforma-standard', buildReservationConfirmationPrintData(reservation));
  };

  const sendConfirmation = async (reservation: Reservation) => {
    const guestEmail = (formData.email || '').trim()
      || (frontOfficeStore.guests.find(g => g.id === reservation.guestId)?.email || '').trim();
    if (!guestEmail) return;
    let cleanup: (() => void) | undefined;
    try {
      const { el, cleanup: c } = await renderReservationPdfSource(reservation);
      cleanup = c;
      // @ts-ignore
      const ensure = async () => (window as any).html2pdf || await new Promise((res, rej) => { const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'; s.onload=()=>res((window as any).html2pdf); s.onerror=()=>rej(); document.body.appendChild(s); });
      // @ts-ignore
      const h2p = await ensure();
      const pdfBuffer = await h2p().set({ jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }, margin: 16 }).from(el).outputPdf('datauristring');
      cleanup();
      const response = await fetch('/api/email/send-proforma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: reservation.resId || reservation.id,
          guestEmail,
          guestName: reservation.guestName || '',
          pdfBuffer: pdfBuffer.split(',')[1],
          hotelName: useSettingsStore.getState().saasSettings.customBranding.companyName || 'Hotel',
          reservationDetails: {
            checkIn: new Date(reservation.arrival).toLocaleDateString(),
            checkOut: new Date(reservation.departure).toLocaleDateString(),
            roomType: frontOfficeStore.roomTypes.find(rt => rt.id === reservation.roomTypeId)?.name || 'Unknown',
            totalAmount: getComputedTotalsForReservation(reservation).grandTotal,
            currency: 'GHS'
          }
        })
      });
      if (response.ok) {
        alert('Confirmation sent to the guest.');
      } else {
        const error = await response.json();
        alert(`Failed to send: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      cleanup?.();
      console.error('Error sending confirmation:', error);
      alert('Failed to send. Please try again.');
    }
  };

  // Display helper: nightly rate including taxes for reservation
  const getDisplayNightlyRateGross = (reservation: Reservation) => {
    return frontOfficeStore.getReservationQuote(reservation).nightlyGross;
  };

  const getDisplayStayTotal = (reservation: Reservation) => {
    return frontOfficeStore.getReservationQuote(reservation).grandTotal;
  };

  const getComputedTotals = (
    arrival: string,
    departure: string,
    roomTypeId: string,
    ratePlanId?: string,
    customRate?: number
  ) => {
    const settingsState = useSettingsStore.getState();
    const selectedPlan = ratePlanId && ratePlanId !== 'custom'
      ? (settingsState.roomManagement.ratePlans || []).find((r: any) => r.id === ratePlanId)
      : undefined;
    const breakdown = buildRateBreakdown(
      roomTypeId,
      arrival,
      departure,
      selectedPlan,
      typeof customRate === 'number' ? customRate : undefined
    );
    const nights = breakdown.length || calculateNights(arrival, departure) || 1;
    const subtotal = breakdown.reduce((s, d) => s + (d.base || 0), 0);
    const grandTotal = breakdown.reduce((s, d) => s + (d.total || 0), 0);
    const tax = grandTotal - subtotal;
    const nightly = breakdown[0]?.total || 0;
    const taxRate = subtotal > 0 ? tax / subtotal : effectiveSalesTaxRate();
    return { nights, nightly, subtotal, taxRate, tax, grandTotal };
  };

  const buildRateBreakdown = (
    roomTypeId: string,
    arrival: string,
    departure: string,
    selectedPlan?: { basePrice?: number; priceType?: string },
    customAmount?: number,
    customPriceType?: 'subtotal' | 'gross_total'
  ) => {
    // A blank custom rate is 0. Passing that through priced the whole stay at ₵0
    // while the form still showed the room's normal rate. Fall through instead.
    if (typeof customAmount === 'number' && customAmount > 0) {
      return frontOfficeStore.calculateRateBreakdown(roomTypeId, arrival, departure, customAmount, customPriceType || 'subtotal');
    }
    if (selectedPlan?.basePrice) {
      return frontOfficeStore.calculateRateBreakdown(
        roomTypeId,
        arrival,
        departure,
        selectedPlan.basePrice,
        selectedPlan.priceType || 'subtotal'
      );
    }
    return frontOfficeStore.calculateRateBreakdown(roomTypeId, arrival, departure);
  };

  // Helper to derive nightly base from a room type + selection
  const getNightlyBaseFromSelection = (roomTypeId: string, ratePlanId?: string, custom?: number) => {
    const settingsState = useSettingsStore.getState();
    if (ratePlanId && ratePlanId !== 'custom') {
      const rp = (settingsState.roomManagement.ratePlans || []).find((r: any) => r.id === ratePlanId);
      if (rp) return rp.basePrice || 0;
    }
    if (typeof custom === 'number' && !isNaN(custom)) return custom;
    const defaultRpId = (settingsState.roomManagement.defaultRatePlanByRoomType || {})[roomTypeId as any];
    if (defaultRpId) {
      const rp = (settingsState.roomManagement.ratePlans || []).find((r: any) => r.id === defaultRpId);
      if (rp) return rp.basePrice || 0;
    }
    const anyRp = (settingsState.roomManagement.ratePlans || []).find((r: any) => r.roomTypeId === roomTypeId && r.isActive);
    if (anyRp) return anyRp.basePrice || 0;
    const rt = (settingsState.roomManagement.roomTypes || []).find((rt: any) => rt.id === roomTypeId);
    return rt?.baseRate || 0;
  };
  
  // New state for guest selection (default to existing guest search)
  const [useExistingGuest, setUseExistingGuest] = useState(true);
  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [filteredGuests, setFilteredGuests] = useState<GuestProfile[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null);
  const [showGuestSearch, setShowGuestSearch] = useState(false);
  const [isGuestSearching, setIsGuestSearching] = useState(false);
  const [guestSearchError, setGuestSearchError] = useState<string | null>(null);
  
  // New state for billing person selection
  const [useBillingPerson, setUseBillingPerson] = useState(false);
  const [billingPersonSearchTerm, setBillingPersonSearchTerm] = useState('');
  const [filteredBillingPersons, setFilteredBillingPersons] = useState<GuestProfile[]>([]);
  const [selectedBillingPerson, setSelectedBillingPerson] = useState<GuestProfile | null>(null);
  const [showBillingPersonSearch, setShowBillingPersonSearch] = useState(false);
  const [isBillingPersonSearching, setIsBillingPersonSearching] = useState(false);
  const [billingPersonSearchError, setBillingPersonSearchError] = useState<string | null>(null);
  const [showNewBillingPersonModal, setShowNewBillingPersonModal] = useState(false);
  const [newBillingPersonForm, setNewBillingPersonForm] = useState({ name: '', company: '', jobTitle: '', phone: '', email: '' });
  const [newBillingPersonError, setNewBillingPersonError] = useState<string | null>(null);
  
  // Bulk reservation state
  // Single-guest flow removed; always use bulk reservations
  const [isBulkReservation, setIsBulkReservation] = useState(true);
  const [bulkGuests, setBulkGuests] = useState<Array<{
    id: string;
    guest: GuestProfile;
    roomTypeId: string;
    roomId?: string;
    ratePlanId?: string;
    customRate?: number;
    // Raw text of the "Enter Custom Rate" input, tracked separately from the
    // derived tax-exclusive `customRate` it's converted to — without this,
    // the input's displayed value was recomputed from customRate on every
    // keystroke (gross -> net -> gross again), and rounding in that round
    // trip silently nudged whatever the guest typed (e.g. typing "50" would
    // redisplay as "50.07"). Now the field shows exactly what was typed.
    customRateInput?: string;
    specialRequests?: string;
    adults: number;
    children: number;
    arrival: string;
    departure: string;
  }>>([]);

  // Re-quote when tax rules finish loading. The amount is computed during render
  // from the compliance store, which starts empty on this page.
  const complianceRuleCount = useComplianceStore((s) => s.taxRules.length);

  // Link multiple guests under a shared group (shared groupId + leader)
  const [linkAsGroup, setLinkAsGroup] = useState(false);

  // If multiple guests and third party is not selected, default to Guest Pays with optional confirmation
  useEffect(() => {
    if (bulkGuests.length <= 1 || !useBillingPerson) return;
    let cancelled = false;
    void (async () => {
      const { confirmChoice } = await import('./DangerConfirm');
      const proceed = await confirmChoice(
        'Bill a third party for all guests?',
        'Several guests are on this reservation. Keep as is to leave each guest paying their own bill.',
        'Bill third party',
      );
      if (!cancelled && !proceed) setUseBillingPerson(false);
    })();
    return () => { cancelled = true; };
  }, [bulkGuests.length]);
  
  const [formData, setFormData] = useState<ReservationFormData>({
    guestName: '',
    phone: '',
    email: '',
    nationality: 'ghanaian',
    idType: 'ghana_card',
    idNumber: '',
    dateOfBirth: '',
    gender: 'prefer_not_to_say',
    emergencyContactName: '',
    emergencyContactRelationship: 'other',
    emergencyContactPhone: '',
    emergencyContactEmail: '',
    emergencyContactAddress: '',
    roomTypeId: '',
    ratePlanId: '',
    arrival: '',
    departure: '',
    adults: 1,
    children: 0,
    source: 'walkin',
    isGuaranteed: false,
    remarksToGuest: '',
    internalNotes: '',
    marketCodes: [],
    stayReason: 'personal' as StayReason,
    stayReasonDetails: '',
    billingPersonId: undefined,
    companyName: '',
    projectCode: '',
    costCenter: '',
    taxExempt: false,
    taxExemptionType: undefined,
    taxExemptionNumber: '',
    taxExemptionAuthority: '',
    taxExemptionExpiry: '',
    taxExemptionDocuments: [],
    taxExemptionNotes: ''
  });

  useEffect(() => {
    loadReservations();
    setBusinessDate(frontOfficeStore.getBusinessDate());
    const unsubscribe = frontOfficeStore.subscribe(() => {
      loadReservations();
      setBusinessDate(frontOfficeStore.getBusinessDate());
    });
    return unsubscribe;
  }, []);

  // When embedded as a New Check-In form, or opened from Rooms, auto-open the modal in create mode
  useEffect(() => {
    if (!autoOpenNew) return;
    handleCreateReservation();
    if (!embed) onAutoOpenConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embed, autoOpenNew]);

  useEffect(() => {
    filterReservations();
  }, [reservations, searchTerm, statusFilter, purposeFilter, billingFilter, dateFilterMode, dateFilterSingle, dateFilterFrom, dateFilterTo]);

  // Filter guests based on search term with enhanced validation
  useEffect(() => {
    if (guestSearchTerm.trim()) {
      const term = guestSearchTerm.toLowerCase().trim();
      
      // Validate search term length
      if (term.length < 2) {
        setFilteredGuests([]);
        setGuestSearchError('Please enter at least 2 characters to search');
        setIsGuestSearching(false);
        return;
      }
      
      setIsGuestSearching(true);
      setGuestSearchError(null);
      
      // Add small delay to prevent excessive filtering
      const timeoutId = setTimeout(() => {
        try {
      const filtered = frontOfficeStore.guests.filter((guest: any) => {
            // Ensure guest has required fields
            if (!guest || !guest.id || guest.isActive === false) return false;
            
            const name = guest.name || `${guest.firstName || ''} ${guest.lastName || ''}`.trim();
        const phone = guest.phone || '';
        const email = guest.email || '';
        const idNum = guest.idNumber || '';
            const serialNum = guest.serialNumber || '';
            
            // Enhanced search criteria
        return (
          (name && String(name).toLowerCase().includes(term)) ||
              (phone && String(phone).replace(/\s+/g, '').includes(term.replace(/\s+/g, ''))) ||
          (email && String(email).toLowerCase().includes(term)) ||
              (idNum && String(idNum).toLowerCase().includes(term)) ||
              (serialNum && String(serialNum).toLowerCase().includes(term))
        );
      });
          
          // Sort by relevance (exact matches first, then partial matches)
          const sortedFiltered = filtered.sort((a, b) => {
            const aName = (a as any).name || `${(a as any).firstName || ''} ${(a as any).lastName || ''}`.trim();
            const bName = (b as any).name || `${(b as any).firstName || ''} ${(b as any).lastName || ''}`.trim();
            
            const aExactMatch = aName.toLowerCase().startsWith(term);
            const bExactMatch = bName.toLowerCase().startsWith(term);
            
            if (aExactMatch && !bExactMatch) return -1;
            if (!aExactMatch && bExactMatch) return 1;
            return aName.localeCompare(bName);
          });
          
          setFilteredGuests(sortedFiltered);
          setIsGuestSearching(false);
          
          if (sortedFiltered.length === 0) {
            setGuestSearchError('No guests found matching your search');
          }
        } catch (error) {
          console.error('Error filtering guests:', error);
          setFilteredGuests([]);
          setGuestSearchError('Error searching guests. Please try again.');
          setIsGuestSearching(false);
        }
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timeoutId);
    } else {
      setFilteredGuests([]);
      setGuestSearchError(null);
      setIsGuestSearching(false);
    }
  }, [guestSearchTerm]);

  // Filter billing persons based on search term with enhanced validation
  useEffect(() => {
    if (billingPersonSearchTerm.trim()) {
      const term = billingPersonSearchTerm.toLowerCase().trim();
      
      // Validate search term length
      if (term.length < 2) {
        setFilteredBillingPersons([]);
        setBillingPersonSearchError('Please enter at least 2 characters to search');
        setIsBillingPersonSearching(false);
        return;
      }
      
      setIsBillingPersonSearching(true);
      setBillingPersonSearchError(null);
      
      // Add small delay to prevent excessive filtering
      const timeoutId = setTimeout(() => {
        try {
          const filtered = frontOfficeStore.guests.filter((g: any) => {
            // Ensure guest has required fields
            if (!g || !g.id || g.isActive === false) return false;
            
            const name = g.name || `${g.firstName || ''} ${g.lastName || ''}`.trim();
            const company = g.employerCompany || g.companyName || '';
            const email = g.email || '';
            const phone = g.phone || '';
            const jobTitle = g.jobTitle || '';
            const serialNum = g.serialNumber || '';
            
            // Enhanced search criteria for billing persons
        return (
          (name && String(name).toLowerCase().includes(term)) ||
          (company && String(company).toLowerCase().includes(term)) ||
          (email && String(email).toLowerCase().includes(term)) ||
              (phone && String(phone).replace(/\s+/g, '').includes(term.replace(/\s+/g, ''))) ||
              (jobTitle && String(jobTitle).toLowerCase().includes(term)) ||
              (serialNum && String(serialNum).toLowerCase().includes(term))
        );
      });
          
          // Sort by relevance (company matches first, then name matches)
          const sortedFiltered = filtered.sort((a, b) => {
            const aName = (a as any).name || `${(a as any).firstName || ''} ${(a as any).lastName || ''}`.trim();
            const bName = (b as any).name || `${(b as any).firstName || ''} ${(b as any).lastName || ''}`.trim();
            const aCompany = (a as any).employerCompany || (a as any).companyName || '';
            const bCompany = (b as any).employerCompany || (b as any).companyName || '';
            
            const aCompanyMatch = aCompany.toLowerCase().includes(term);
            const bCompanyMatch = bCompany.toLowerCase().includes(term);
            const aNameMatch = aName.toLowerCase().startsWith(term);
            const bNameMatch = bName.toLowerCase().startsWith(term);
            
            // Prioritize company matches, then name matches
            if (aCompanyMatch && !bCompanyMatch) return -1;
            if (!aCompanyMatch && bCompanyMatch) return 1;
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            
            return aName.localeCompare(bName);
          });
          
          setFilteredBillingPersons(sortedFiltered);
          setIsBillingPersonSearching(false);
          
          if (sortedFiltered.length === 0) {
            setBillingPersonSearchError('No billing persons found matching your search');
          }
        } catch (error) {
          console.error('Error filtering billing persons:', error);
          setFilteredBillingPersons([]);
          setBillingPersonSearchError('Error searching billing persons. Please try again.');
          setIsBillingPersonSearching(false);
        }
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timeoutId);
    } else {
      setFilteredBillingPersons([]);
      setBillingPersonSearchError(null);
      setIsBillingPersonSearching(false);
    }
  }, [billingPersonSearchTerm]);

  // Close guest search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.guest-search-container')) {
        setShowGuestSearch(false);
      }
      if (!target.closest('.billing-person-search-container')) {
        setShowBillingPersonSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadReservations = () => {
    setReservations([...frontOfficeStore.reservations]);
  };

  const filterReservations = () => {
    let filtered = reservations;

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.guestName.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term) ||
        (r.roomId ?? '').toLowerCase().includes(term)
      );
    }

    // Status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Purpose
    if (purposeFilter !== 'all') {
      filtered = filtered.filter(r => (r as any).stayReason === purposeFilter);
    }

    // Billing
    if (billingFilter !== 'all') {
      if (billingFilter === 'third_party') {
        filtered = filtered.filter(r => !!(r as any).billingPersonId);
      } else if (billingFilter === 'guest') {
        filtered = filtered.filter(r => !(r as any).billingPersonId);
      }
    }

    // Date filter — filters by arrival (check-in) date
    const today = new Date().toISOString().slice(0, 10);
    if (dateFilterMode === 'today') {
      filtered = filtered.filter(r => r.arrival?.slice(0, 10) === today);
    } else if (dateFilterMode === 'specific' && dateFilterSingle) {
      filtered = filtered.filter(r => r.arrival?.slice(0, 10) === dateFilterSingle);
    } else if (dateFilterMode === 'range' && (dateFilterFrom || dateFilterTo)) {
      filtered = filtered.filter(r => {
        const arrDate = r.arrival?.slice(0, 10) ?? '';
        if (dateFilterFrom && arrDate < dateFilterFrom) return false;
        if (dateFilterTo   && arrDate > dateFilterTo)   return false;
        return true;
      });
    }

    setFilteredReservations(filtered);
  };

  const handleCreateReservation = () => {
    setIsCreatingNew(true);
    setIsBulkReservation(true); // Always use bulk form - it can handle single guests too
    setUseExistingGuest(false);
    setSelectedGuest(null);
    setGuestSearchTerm('');
    setUseBillingPerson(false); // Let user choose billing person
    setSelectedBillingPerson(null);
    setBillingPersonSearchTerm('');
    setBulkGuests([]);
    setLinkAsGroup(false);
    setFormData({
      guestName: '',
      phone: '',
      email: '',
      nationality: 'ghanaian',
      idType: 'ghana_card',
      idNumber: '',
      dateOfBirth: '',
      gender: 'prefer_not_to_say',
      emergencyContactName: '',
      emergencyContactRelationship: 'other',
      emergencyContactPhone: '',
      emergencyContactEmail: '',
      emergencyContactAddress: '',
      roomTypeId: '',
      ratePlanId: '',
      arrival: defaultArrival,
      departure: defaultDeparture,
      adults: 1,
      children: 0,
      source: 'walkin',
      isGuaranteed: false,
      remarksToGuest: '',
      internalNotes: '',
      marketCodes: [],
      stayReason: 'personal' as StayReason,
      stayReasonDetails: '',
      billingPersonId: undefined,
      companyName: '',
      projectCode: '',
      costCenter: '',
      taxExempt: false,
      taxExemptionType: undefined,
      taxExemptionNumber: '',
      taxExemptionAuthority: '',
      taxExemptionExpiry: '',
      taxExemptionDocuments: [],
      taxExemptionNotes: ''
    });
    // Start on the form, not the summary of whichever reservation was open last.
    setTabKey('guest');
    onOpen();
    // Auto-select default rate plan when room type picked later
  };

  const addGuestToBulk = (guest: GuestProfile) => {
    // Check if guest is already added
    if (bulkGuests.some(bg => bg.guest.id === guest.id)) {
      alert('This guest is already added to the bulk reservation');
      return;
    }

    const newId = (bulkGuests.length + 1).toString();
    const roomTypeId = formData.roomTypeId || useSettingsStore.getState().roomManagement.roomTypes[0]?.id || '';
    const settings = useSettingsStore.getState();
    const defaultRpId = (settings.roomManagement.defaultRatePlanByRoomType || {})[roomTypeId];
    const baseRate = getNightlyRate(roomTypeId);

    setBulkGuests([...bulkGuests, {
      id: newId,
      guest: guest,
      roomTypeId: roomTypeId,
      roomId: '',
      ratePlanId: 'custom',
      customRate: 0,
      specialRequests: '',
      adults: 1,
      children: 0,
      arrival: formData.arrival || '',
      departure: formData.departure || ''
    }]);

    // Clear search
    setGuestSearchTerm('');
    setFilteredGuests([]);
    setShowGuestSearch(false);
  };

  const removeBulkGuest = (id: string) => {
    setBulkGuests(bulkGuests.filter(guest => guest.id !== id));
  };

  const updateBulkGuest = (id: string, field: string, value: string | number) => {
  setBulkGuests(prev => prev.map(guest => 
      guest.id === id ? { ...guest, [field]: value } : guest
    ));
  try { trackEvent('FO.NewRes.BulkGuestUpdated' as any, { id, field, value }); } catch {}
  };

  const handleEditReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsCreatingNew(false);
    setUseExistingGuest(false);
    setSelectedGuest(null);
    
          const guestRecord = frontOfficeStore.guests.find(g => g.id === reservation.guestId);
          // Convert reservation to form data
      setFormData({
        guestName: reservation.guestName,
        phone: guestRecord?.phone || '',
        email: guestRecord?.email || '',
        nationality: 'ghanaian', // Default value since reservation doesn't store this
        idType: 'ghana_card', // Default value since reservation doesn't store this
        idNumber: '',
        dateOfBirth: '',
        gender: 'prefer_not_to_say',
        emergencyContactName: '',
        emergencyContactRelationship: 'other',
        emergencyContactPhone: '',
        emergencyContactEmail: '',
        emergencyContactAddress: '',
        roomTypeId: reservation.roomTypeId,
        ratePlanId: reservation.ratePlanId || '',
        arrival: (reservation.arrival || '').slice(0, 10),
        departure: (reservation.departure || '').slice(0, 10),
        adults: reservation.adults || 1,
        children: reservation.children || 0,
        source: reservation.source || 'walkin',
        isGuaranteed: reservation.isGuaranteed || false,
        remarksToGuest: reservation.remarksToGuest || '',
        internalNotes: reservation.internalNotes || '',
        marketCodes: reservation.marketCodes || [],
        stayReason: reservation.stayReason || 'personal' as StayReason,
        stayReasonDetails: reservation.stayReasonDetails || '',
        billingPersonId: reservation.billingPersonId || undefined,
        companyName: reservation.companyName || '',
        projectCode: reservation.projectCode || '',
        costCenter: reservation.costCenter || '',
        taxExempt: reservation.taxExempt || false,
        taxExemptionType: reservation.taxExemptionType || undefined,
        taxExemptionNumber: reservation.taxExemptionNumber || '',
        taxExemptionAuthority: reservation.taxExemptionAuthority || '',
        taxExemptionExpiry: reservation.taxExemptionExpiry || '',
        taxExemptionDocuments: reservation.taxExemptionDocuments || [],
        taxExemptionNotes: reservation.taxExemptionNotes || ''
      });
    
    setAssignReservation(reservation);
    setEditRateInput(reservation.ratePlanId ? '' : frontOfficeStore.getReservationQuote(reservation).nightlyGross.toFixed(2));
    setAssignRoomId(reservation.roomId && reservation.roomId !== 'TBD' ? reservation.roomId : '');
    setAssignRoomSearch('');
    setAssignMatchTypeOnly(true);
    setTabKey('guest');
    onOpen();
  };

  const handleViewReservation = (reservation: Reservation) => {
    // Load into form then switch to summary tab for printable view
    handleEditReservation(reservation);
    setTabKey('summary');
  };

  /** A guest picked on the Reservation tab that differs from the booking's current guest. */
  const switchedGuest =
    selectedGuest && selectedReservation && selectedGuest.id !== selectedReservation.guestId ? selectedGuest : null;
  // Changing the guest after check-out would leave the posted bill under the old name.
  const canChangeGuest = !!selectedReservation && ['pending', 'confirmed', 'checked-in'].includes(selectedReservation.status);

  const handleGuestSelection = (guest: GuestProfile) => {
    setSelectedGuest(guest);
    setFormData(prev => ({
      ...prev,
      guestName: guest.name || '',
      phone: guest.phone || '',
      email: guest.email || '',
      nationality: guest.nationality || 'ghanaian',
      idType: guest.idType || 'ghana_card',
      idNumber: guest.idNumber || '',
      dateOfBirth: guest.dateOfBirth || '',
      gender: guest.gender || 'prefer_not_to_say',
      emergencyContactName: guest.emergencyContact?.name || '',
      emergencyContactRelationship: guest.emergencyContact?.relationship || 'other',
      emergencyContactPhone: guest.emergencyContact?.phone || '',
      emergencyContactEmail: guest.emergencyContact?.email || '',
      emergencyContactAddress: guest.emergencyContact?.address || '',
    }));
    setShowGuestSearch(false);
    setGuestSearchTerm('');
  };

  const handleBillingPersonSelection = (billingPerson: GuestProfile) => {
    setSelectedBillingPerson(billingPerson);
    setFormData(prev => ({
      ...prev,
      billingPersonId: billingPerson.id,
      companyName: (billingPerson as any).employerCompany || prev.companyName || '',
      // Store a display name for downstream UI like Check-in/Check-out BILLED TO
      // without changing existing companyName usage
      // @ts-ignore
      billingPersonName: (billingPerson as any).name || `${(billingPerson as any).firstName || ''} ${(billingPerson as any).lastName || ''}`.trim()
    }));
    setShowBillingPersonSearch(false);
    setBillingPersonSearchTerm('');
    
    console.log(`[FO.Reservation] Billing person selected: ${(billingPerson as any).name} for reservation`);
    trackEvent('FO.Reservation.BillingPersonSelected', {
      billingPersonId: (billingPerson as any).id,
      billingPersonName: (billingPerson as any).name,
      company: (billingPerson as any).employerCompany
    });
  };

  const openNewBillingPersonModal = () => {
    setNewBillingPersonForm({ name: '', company: '', jobTitle: '', phone: '', email: '' });
    setNewBillingPersonError(null);
    setShowNewBillingPersonModal(true);
  };

  const handleCreateBillingPerson = () => {
    const name = newBillingPersonForm.name.trim();
    if (!name) {
      setNewBillingPersonError('Name is required');
      return;
    }
    const [firstName, ...rest] = name.split(' ');
    // Billing persons are third-party payers (a company contact, travel agent, etc.), not
    // hotel guests — createGuest's KYC fields (nationality/idType/idNumber/emergencyContact)
    // don't apply here, so they're filled with harmless placeholders (same escape hatch
    // FrontofficeCalendar.tsx already uses for walk-in guest creation).
    const guest = frontOfficeStore.createGuest({
      firstName: firstName || name,
      lastName: rest.join(' ') || '-',
      name,
      employerCompany: newBillingPersonForm.company.trim() || undefined,
      jobTitle: newBillingPersonForm.jobTitle.trim() || undefined,
      phone: newBillingPersonForm.phone.trim() || undefined,
      email: newBillingPersonForm.email.trim() || undefined,
      nationality: 'ghanaian',
      idType: 'other',
      idNumber: '',
      emergencyContact: { name: '', relationship: 'other', phone: '' },
    } as any);
    handleBillingPersonSelection(guest);
    setShowNewBillingPersonModal(false);
  };

  const handleSaveReservation = async () => {
    if (isCreatingNew) {
      // Handle reservation (single or multiple guests)
      if (bulkGuests.length === 0) {
        alert('Please add at least one guest to the reservation');
        return;
      }
      
      // Validate billing person for multiple guests only when third party pays
      if (bulkGuests.length > 1 && useBillingPerson && !selectedBillingPerson) {
        alert('Please select a billing person for multiple guest reservations (Third Party Pays selected).');
        return;
      }

      // Walk-in with no room: ask before anything is saved, so "Assign room"
      // can go back to the form and open that guest's room pop-up.
      let walkInLeaveOpen = false;
      if (mode === 'checkin') {
        const roomless = bulkGuests.filter((g) => !g.roomId);
        if (roomless.length > 0) {
          const who = roomless.map((g) => guestDisplayName(g.guest)).filter(Boolean).join(', ') || 'This guest';
          const choice = await chooseDanger({
            tone: 'void',
            title: roomless.length === 1 ? `Check in ${who} without a room?` : `Check in ${roomless.length} guests without a room?`,
            message: 'No room is assigned. Assign one now, or check them in anyway and assign the room later.',
            confirmLabel: 'Check in anyway',
            altLabel: 'Assign room',
          });
          if (choice === 'alt') {
            setTabKey('guest');
            setRoomPickerChoice('');
            setRoomPickerMatchType(true);
            setRoomPickerFor(roomless[0].id);
            return;
          }
          walkInLeaveOpen = choice === 'confirm';
        }
      }

        // Create reservations for each guest
        const createdReservations: any[] = [];
        for (const bulkGuest of bulkGuests) {
          // Use the selected guest (already exists in system)
          const guest = bulkGuest.guest;

          // Determine nightly base from selected rate plan or custom
          const planId = bulkGuest.ratePlanId && bulkGuest.ratePlanId !== 'custom' ? bulkGuest.ratePlanId : undefined;
          const selectedPlan = planId
            ? (useSettingsStore.getState().roomManagement.ratePlans || []).find((r: any) => r.id === planId)
            : undefined;
          const typedGross = parseFloat(String(bulkGuest.customRateInput ?? ''));
          const rateBreakdown = buildRateBreakdown(
            bulkGuest.roomTypeId,
            bulkGuest.arrival,
            bulkGuest.departure,
            selectedPlan,
            selectedPlan ? undefined : (Number.isFinite(typedGross) && typedGross > 0 ? typedGross : undefined),
            'gross_total'
          );

          // Create reservation with personal details from each guest
      const reservation = frontOfficeStore.createReservation({
        guestId: guest.id,
        guestName: (guest as any).name || `${(guest as any).firstName || ''} ${(guest as any).lastName || ''}`.trim() || 'Guest',
            roomTypeId: bulkGuest.roomTypeId,
        ratePlanId: (() => {
          if (bulkGuest.ratePlanId && bulkGuest.ratePlanId !== 'custom') return bulkGuest.ratePlanId;
          if (formData.ratePlanId) return formData.ratePlanId;
          try {
            const settings = useSettingsStore.getState();
            return (settings.roomManagement.defaultRatePlanByRoomType || {})[bulkGuest.roomTypeId || ''];
          } catch { return undefined; }
        })() || undefined,
            arrival: bulkGuest.arrival,
            departure: bulkGuest.departure,
            adults: bulkGuest.adults,
            children: bulkGuest.children,
        source: formData.source,
        isGuaranteed: formData.isGuaranteed,
            remarksToGuest: bulkGuest.specialRequests || formData.remarksToGuest,
        internalNotes: formData.internalNotes,
        marketCodes: formData.marketCodes,
        status: 'confirmed',
        stayReason: formData.stayReason,
        stayReasonDetails: formData.stayReasonDetails,
        billingPersonId: formData.billingPersonId,
        billingPersonName: (useBillingPerson && selectedBillingPerson)
          ? ((selectedBillingPerson as any).name || `${(selectedBillingPerson as any).firstName || ''} ${(selectedBillingPerson as any).lastName || ''}`.trim())
          : undefined,
        companyName: formData.companyName,
        projectCode: formData.projectCode,
            costCenter: formData.costCenter,
            taxExempt: formData.taxExempt,
            taxExemptionType: formData.taxExemptionType,
            taxExemptionNumber: formData.taxExemptionNumber,
            taxExemptionAuthority: formData.taxExemptionAuthority,
            taxExemptionExpiry: formData.taxExemptionExpiry,
            taxExemptionDocuments: formData.taxExemptionDocuments,
            taxExemptionNotes: formData.taxExemptionNotes,
            roomId: bulkGuest.roomId,
            rateBreakdown
          });

          createdReservations.push(reservation);
        }

        trackEvent('FO.Reservation.BulkCreated', {
          count: createdReservations.length,
          companyName: formData.companyName,
          billingPersonId: formData.billingPersonId,
          stayReason: formData.stayReason
        });

        // Link the created reservations as a group when requested
        if (linkAsGroup && createdReservations.length > 1) {
          frontOfficeStore.linkReservationsAsGroup(createdReservations.map(r => r.id));
        }

        // If in check-in mode, immediately check-in each created reservation.
        // A walk-in with no room asks before the stay is marked in house.
        if (mode === 'checkin') {
          // Asked before saving (see walkInLeaveOpen above).
          const leaveOpen = walkInLeaveOpen;
          createdReservations.forEach((r) => {
            const open = !r.roomId || r.roomId === 'TBD';
            if (open && !leaveOpen) return;
            try { frontOfficeStore.checkIn(r.id, open ? { leaveRoomOpen: true } : undefined); } catch {}
          });
          const updated = createdReservations.map((r) => frontOfficeStore.reservations.find((stay) => stay.id === r.id) || r);
          const housed = updated.filter((r) => r.status === 'checked-in');
          const waiting = updated.filter((r) => r.status !== 'checked-in');
          if (housed.length > 0) {
            const who = housed.map((r) => r.guestName).filter(Boolean).join(', ') || 'Guest';
            const rooms = housed.map((r) => (r.roomId && r.roomId !== 'TBD' ? `Room ${r.roomId}` : 'room still to assign')).join(', ');
            notifySuccess(`${who} is in house — ${rooms}`, 'Walk-in');
          }
          if (waiting.length > 0) {
            const who = waiting.map((r) => r.guestName).filter(Boolean).join(', ') || 'Guest';
            notifySuccess(`${who} is still on Check-in. Assign a room, then check them in.`, 'Walk-in');
          }
          onFinished?.(createdReservations.map((r) => r.id));
        } else {
        alert(`Successfully created ${createdReservations.length} reservation${createdReservations.length !== 1 ? 's' : ''}${formData.companyName ? ` for ${formData.companyName}` : ''}`);
        }
    } else if (selectedReservation) {
      // Update existing reservation + recompute rate breakdown for folio/check-in
      const selectedPlan = formData.ratePlanId && formData.ratePlanId !== 'custom'
        ? (useSettingsStore.getState().roomManagement.ratePlans || []).find((r: any) => r.id === formData.ratePlanId)
        : undefined;
      const rateBreakdown = buildRateBreakdown(
        formData.roomTypeId,
        formData.arrival,
        formData.departure,
        selectedPlan,
        typeof formData.customRate === 'number' ? formData.customRate : undefined
      );

      const updatedReservation = {
        ...selectedReservation,
        // The guest is picked from the guest list (Reservation tab), never typed in.
        guestId: switchedGuest ? switchedGuest.id : selectedReservation.guestId,
        guestName: switchedGuest ? guestDisplayName(switchedGuest) : selectedReservation.guestName,
        roomTypeId: formData.roomTypeId,
        ratePlanId: (formData.ratePlanId === 'custom' ? undefined : (formData.ratePlanId || undefined)),
        arrival: formData.arrival,
        departure: formData.departure,
        adults: formData.adults,
        children: formData.children,
        source: formData.source,
        isGuaranteed: formData.isGuaranteed,
        remarksToGuest: formData.remarksToGuest,
        internalNotes: formData.internalNotes,
        marketCodes: formData.marketCodes,
        stayReason: formData.stayReason,
        stayReasonDetails: formData.stayReasonDetails,
        billingPersonId: formData.billingPersonId,
        billingPersonName: (useBillingPerson && selectedBillingPerson)
          ? ((selectedBillingPerson as any).name || `${(selectedBillingPerson as any).firstName || ''} ${(selectedBillingPerson as any).lastName || ''}`.trim())
          : undefined,
        companyName: formData.companyName,
        projectCode: formData.projectCode,
        costCenter: formData.costCenter,
        taxExempt: formData.taxExempt,
        taxExemptionType: formData.taxExemptionType,
        taxExemptionNumber: formData.taxExemptionNumber,
        taxExemptionAuthority: formData.taxExemptionAuthority,
        taxExemptionExpiry: formData.taxExemptionExpiry,
        taxExemptionDocuments: formData.taxExemptionDocuments,
        taxExemptionNotes: formData.taxExemptionNotes,
        rateBreakdown
      };

      // Guest profiles are edited in Clients, not from a booking — typing here
      // used to rename the guest's record for every stay.
      frontOfficeStore.updateReservation(updatedReservation);
      
      trackEvent('FO.Reservation.Updated', {
        id: selectedReservation.id,
        guest: updatedReservation.guestName
      });
    }

    onClose();
    loadReservations();
  };

  const handleQuickAction = (action: string, reservation: Reservation) => {
    switch (action) {
      case 'checkin':
        {
          const hasRoom = !!reservation.roomId && reservation.roomId !== 'TBD';
          void (async () => {
            if (!hasRoom) {
              const readyRooms = getRoomsFreeForStay(null, reservation.arrival, reservation.departure, undefined, reservation.id, true);
              const choice = await chooseDanger({
                tone: 'void',
                title: `Check in ${reservation.guestName} without a room?`,
                message: readyRooms.length > 0
                  ? 'No room is assigned. Assign one now, or check this guest in anyway and assign the room later.'
                  : 'No room is assigned, and no room is empty for this stay right now. You can check this guest in anyway and assign the room later.',
                confirmLabel: 'Check in anyway',
                altLabel: readyRooms.length > 0 ? 'Assign room' : undefined,
              });
              if (choice === 'cancel') return;
              if (choice === 'alt') {
                // Pick a room, then the same pop-up checks the guest in.
                setCheckInAfterAssign(true);
                setAssignReservation(reservation);
                setAssignRoomId('');
                setIsAssignOpen(true);
                return;
              }
            }
            frontOfficeStore.checkIn(reservation.id, hasRoom ? undefined : { leaveRoomOpen: true });
            const updated = frontOfficeStore.reservations.find(r => r.id === reservation.id);
            const roomLabel = updated?.roomId && updated.roomId !== 'TBD' ? `Room ${updated.roomId}` : 'room still to assign';
            notifySuccess(`${reservation.guestName} checked in — ${roomLabel}`, 'Checked in');
          })();
        }
        break;
      case 'checkout':
        frontOfficeStore.checkOut(reservation.id);
        break;
      case 'cancel':
        frontOfficeStore.cancelReservation(reservation.id);
        break;
      case 'assign':
        setAssignReservation(reservation);
        // Prefill first available room
        const avail = getRoomsFreeForStay(reservation.roomTypeId, reservation.arrival, reservation.departure, undefined, reservation.id);
        setAssignRoomId(avail[0] || '');
        setIsAssignOpen(true);
        break;
    }
    
    trackEvent('FO.Reservation.QuickAction', {
      action,
      reservationId: reservation.id
    });
    
    loadReservations();
  };

  const openNoShowConfirm = (reservation: Reservation) => {
    setNoShowTarget(reservation);
    onNoShowOpen();
  };

  const confirmNoShow = () => {
    if (!noShowTarget) return;
    frontOfficeStore.markNoShow(noShowTarget.id);
    trackEvent('FO.Reservation.NoShowManual' as any, { reservationId: noShowTarget.id, guestName: noShowTarget.guestName });
    onNoShowClose();
    setNoShowTarget(null);
    loadReservations();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'checked-in': return 'primary';
      case 'checked-out': return 'secondary';
      case 'cancelled': return 'danger';
      case 'void': return 'danger';
      case 'no-show': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return '✅';
      case 'pending': return '⏳';
      case 'checked-in': return '🔑';
      case 'checked-out': return '🚪';
      case 'cancelled': return '❌';
      case 'void': return '🚫';
      case 'no-show': return '👻';
      default: return '❓';
    }
  };

  const calculateNights = (arrival: string, departure: string) => calculateStayNights(arrival, departure);

  /**
   * Rooms (of a type, or any) free for the whole stay. Date-aware, not
   * "vacant right now": a room occupied today can be free next month, and an
   * empty one may already be booked for these dates.
   * Rooms picked for other guests on this same new booking are left out too.
   */
  const getRoomsFreeForStay = (
    roomTypeId: string | null, // null = any room type (Match type off)
    arrival: string,
    departure: string,
    exceptBulkGuestId?: string,
    excludeReservationId?: string, // the booking being assigned, so its own room still counts as free
    readyNow = false, // checking in now: the room must also be empty today (same rule as the Desk)
  ) => {
    if (roomTypeId === '' || !arrival || !departure || departure <= arrival) return [] as string[];
    const vacantNow = readyNow ? new Set(housekeepingStore.getRoomsReadyToAssign().map((r) => r.roomNumber)) : null;
    const start = new Date(arrival).getTime();
    const end = new Date(departure).getTime();
    const takenHere = new Set(
      bulkGuests
        .filter((g) => g.id !== exceptBulkGuestId && g.roomId && g.arrival && g.departure
          && new Date(g.arrival).getTime() < end && new Date(g.departure).getTime() > start)
        .map((g) => g.roomId as string),
    );
    return housekeepingStore.getAllRooms()
      .filter((room) => (roomTypeId === null || room.roomTypeId === roomTypeId)
        && room.status !== 'out-of-order'
        && (!vacantNow || vacantNow.has(room.roomNumber))
        && frontOfficeStore.isRoomBookable(room.roomNumber)
        && frontOfficeStore.isRoomFreeForRange(room.roomNumber, arrival, departure, excludeReservationId)
        && !takenHere.has(room.roomNumber))
      .map((room) => room.roomNumber)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };

  /** Drop a guest's chosen room once new dates make it unavailable (any type — it may be an upgrade). */
  const keepRoomIfStillFree = (bulkGuestId: string, roomId: string | undefined, _roomTypeId: string, arrival: string, departure: string) => {
    if (roomId && !getRoomsFreeForStay(null, arrival, departure, bulkGuestId).includes(roomId)) {
      updateBulkGuest(bulkGuestId, 'roomId', '');
    }
  };

  const dismissForm = () => {
    onClose();
    onFinished?.([]);
  };

  return (
    <div className={embed ? '' : 'space-y-6'}>
      {!embed && <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-xl sm:text-2xl font-bold text-ghana-black">📅 Reservations & Bookings</h2>
          <HeadingInfo label="About reservations">Create, view, and manage room reservations and bookings</HeadingInfo>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          {!isHosted && (
            <FoDeskKpiCustomize sections={FO_RESERVATIONS_KPI_SECTIONS} />
          )}
          <Button
            color="primary"
            variant="flat"
            onClick={handleCreateReservation}
            className="text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-3"
          >
            ➕ New Reservation
          </Button>
        </div>
      </div>

      {/* Quick Stats — stay-overlap follows Customize KPI period; checked-in is current snapshot */}
      {!summaryCollapsed && hiddenStatsCount < RESERVATIONS_DASHBOARD_SECTIONS.length && (
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-7">
        {(() => {
          const inPeriod = (r: Reservation) =>
            stayOverlapsPeriod(r.arrival, r.departure, kpiPeriod, kpiToday);
          const periodRes = reservations.filter(inPeriod);
          return ([
            ['res.totalReservations', periodRes.length, 'text-gray-900'],
            ['res.confirmed', periodRes.filter((r) => r.status === 'confirmed').length, 'text-green-700'],
            ['res.checkedIn', reservations.filter((r) => r.status === 'checked-in').length, 'text-blue-700'],
            ['res.businessStays', periodRes.filter((r) => ['business', 'corporate', 'conference', 'training'].includes(r.stayReason || 'personal')).length, 'text-purple-700'],
            ['res.thirdPartyBilling', periodRes.filter((r) => r.billingPersonId).length, 'text-orange-700'],
            ['res.internationalGuests', periodRes.filter((r) => frontOfficeStore.guests.find((g) => g.id === r.guestId)?.nationality !== 'ghanaian').length, 'text-indigo-700'],
            ['res.pending', periodRes.filter((r) => r.status === 'pending').length, 'text-yellow-700'],
          ] as const).map(([id, value, tone]) => {
          if (isHidden(id)) return null;
          const label = RESERVATIONS_DASHBOARD_SECTIONS.find((card) => card.id === id)?.label || id;
          return (
            <Card key={id} className="relative border border-gray-200 shadow-none">
              <CardBody className="px-2 py-1.5 text-center">
                <div className="absolute right-1 top-0.5">
                  <HideCardButton onHide={() => hide(id)} label={label} />
                </div>
                <div className={`text-base font-semibold tabular-nums ${tone}`}>{value}</div>
                <div className="text-xs leading-tight text-gray-500">{label}</div>
              </CardBody>
            </Card>
          );
        });
        })()}
      </div>
      )}

      {/* Filters — wrap on phone / zoom; date chips → Select under lg */}
      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        <Input
          size="sm"
          aria-label="Search reservations"
          placeholder="Search reservations, guests, or room numbers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startContent={<span className="text-gray-400">🔍</span>}
          className="w-full max-w-full sm:w-64 sm:max-w-[16rem] shrink-0"
        />
        <Select
          size="sm"
          aria-label="Filter by status"
          placeholder="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full max-w-full sm:w-44 sm:max-w-[11rem] shrink-0"
        >
          <SelectItem key="all">All Statuses</SelectItem>
          <SelectItem key="pending">⏳ Pending</SelectItem>
          <SelectItem key="confirmed">✅ Confirmed</SelectItem>
          <SelectItem key="checked-in">🔑 Checked In</SelectItem>
          <SelectItem key="checked-out">🚪 Checked Out</SelectItem>
          <SelectItem key="cancelled">❌ Cancelled</SelectItem>
          <SelectItem key="no-show">👻 No Show</SelectItem>
        </Select>
        <Select
          size="sm"
          aria-label="Filter by purpose"
          placeholder="Filter by purpose"
          value={purposeFilter}
          onChange={(e) => setPurposeFilter(e.target.value)}
          className="w-full max-w-full sm:w-44 sm:max-w-[11rem] shrink-0"
        >
          <SelectItem key="all">All Purposes</SelectItem>
          <SelectItem key="personal">👤 Personal</SelectItem>
          <SelectItem key="business">💼 Business</SelectItem>
          <SelectItem key="corporate">🏢 Corporate</SelectItem>
          <SelectItem key="conference">🎤 Conference</SelectItem>
          <SelectItem key="training">📚 Training</SelectItem>
          <SelectItem key="medical">🏥 Medical</SelectItem>
          <SelectItem key="tourism">🌍 Tourism</SelectItem>
          <SelectItem key="other">📋 Other</SelectItem>
        </Select>
        <Select
          size="sm"
          aria-label="Filter by billing"
          placeholder="Filter by billing"
          value={billingFilter}
          onChange={(e) => setBillingFilter(e.target.value)}
          className="w-full max-w-full sm:w-44 sm:max-w-[11rem] shrink-0"
        >
          <SelectItem key="all">All Billing Types</SelectItem>
          <SelectItem key="guest">Guest Pays</SelectItem>
          <SelectItem key="third_party">Third Party Pays</SelectItem>
        </Select>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-600">Filtered:</span>
          <Badge color="primary" variant="flat">{filteredReservations.length}</Badge>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <DateFilterPills
            mode={dateFilterMode}
            onMode={setDateFilterMode}
            single={dateFilterSingle}
            onSingle={setDateFilterSingle}
            from={dateFilterFrom}
            onFrom={setDateFilterFrom}
            to={dateFilterTo}
            onTo={setDateFilterTo}
          />
        </div>
      </div>

      {/* Reservations Table */}
      <Card className="border-0 shadow-lg">
        <CardBody className="px-2 py-3">
          <StayWorksheetTable
            stays={sortStays(filteredReservations, resSortKey, resSortDir).slice((resPage - 1) * resRowsPerPage, resPage * resRowsPerPage)}
            today={localStayDay()}
            selectedId={selectedReservation?.id}
            sortKey={resSortKey}
            sortDir={resSortDir}
            onSort={(key) => {
              setResPage(1);
              if (resSortKey === key) setResSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
              else {
                setResSortKey(key);
                setResSortDir('asc');
              }
            }}
            onOpen={(id) => {
              const stay = filteredReservations.find((reservation) => reservation.id === id);
              if (stay) handleEditReservation(stay);
            }}
            emptyContent="No reservation matches these filters."
          />
        </CardBody>
      </Card>
      <div className="flex justify-end mt-3">
        <HeroPagination
          page={resPage}
          total={Math.max(1, Math.ceil(filteredReservations.length / resRowsPerPage))}
          onChange={setResPage}
          showControls
          size="sm"
        />
      </div>
      </>}

      {/* Reservation Form Modal */}
      <Modal isOpen={isOpen} onClose={dismissForm} size="4xl" className="mx-2 sm:mx-4">
        <ModalContent className="max-h-[90vh]">
          <ModalHeader className="pb-2">
            {isCreatingNew ? (mode === 'checkin' ? 'Walk-in' : 'Create New Reservation') : 'View / Edit Reservation'}
          </ModalHeader>
          <ModalBody className="overflow-y-auto pt-1">
            <Tabs aria-label="Reservation details" classNames={{ panel: "py-1" }} selectedKey={tabKey} onSelectionChange={(key)=> setTabKey(key as string)}>
              <Tab key="summary" title="🧾 Summary / Print">
                {selectedReservation && !isCreatingNew ? (
                  <div className="space-y-3 pt-1" id="reservation-summary">
                    {/* Same coloured sections as the Guest & stay tab. */}
                    <div className="bg-purple-50 p-3 rounded-lg border">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h4 className="font-medium text-purple-900">📋 Reservation Details</h4>
                        <Chip size="sm" variant="flat" color={getStatusColor(selectedReservation.status) as any}>{selectedReservation.status}</Chip>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {[
                          ['Reservation ID', selectedReservation.resId || selectedReservation.id],
                          ['Guest', selectedReservation.guestName],
                          ['Room Type', frontOfficeStore.roomTypes.find(rt => rt.id === selectedReservation.roomTypeId)?.name || 'Unknown'],
                          ['Check-in', new Date(selectedReservation.arrival).toLocaleDateString()],
                          ['Check-out', new Date(selectedReservation.departure).toLocaleDateString()],
                          ['Nights', String(calculateNights(selectedReservation.arrival, selectedReservation.departure))],
                        ].map(([label, value]) => (
                          <div key={label} className="bg-white px-3 py-2 rounded-lg border border-purple-200">
                            <div className="text-xs text-gray-600">{label}</div>
                            <div className="truncate font-semibold text-ghana-black" title={value}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {(() => { const { nights, nightly, subtotal, taxRate, tax, grandTotal } = getComputedTotalsForReservation(selectedReservation); return (
                      <div className="bg-blue-50 p-3 rounded-lg border">
                        <h4 className="mb-2 font-medium text-blue-900">💰 Rate Quote <span className="text-xs font-normal text-blue-800">· contracted rate × nights, not the live folio</span></h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                          {[
                            ['Nightly', `₵${nightly.toFixed(2)}`],
                            ['Nights', String(nights)],
                            ['Subtotal', `₵${subtotal.toFixed(2)}`],
                            [`Taxes (${Math.round(taxRate * 100)}%)`, `₵${tax.toFixed(2)}`],
                            ['Quoted Total', `₵${grandTotal.toFixed(2)}`],
                          ].map(([label, value]) => (
                            <div key={label} className="bg-white px-3 py-2 rounded-lg border border-blue-200">
                              <div className="text-xs text-gray-600">{label}</div>
                              <div className="whitespace-nowrap text-base font-semibold tabular-nums">{value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ); })()}

                    {(() => {
                      const folio = findMainFolio(frontOfficeStore.folios, selectedReservation.id);
                      if (!folio) return null;
                      const { totalCharges, totalPayments, outstandingBalance } = getFolioDisplayTotals(folio);
                      return (
                        <div className="bg-green-50 p-3 rounded-lg border">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h4 className="font-medium text-green-900">🧾 Folio <span className="text-xs font-normal text-green-800">· actually posted to date</span></h4>
                            <Button
                              size="sm"
                              color="success"
                              variant="flat"
                              onClick={() => { onClose(); router.push('/guest-services/client-services/invoices-payments'); }}
                            >
                              View Folio →
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white px-3 py-2 rounded-lg border border-green-200">
                              <div className="text-xs text-gray-600">Charged</div>
                              <div className="whitespace-nowrap text-base font-semibold tabular-nums">₵{totalCharges.toFixed(2)}</div>
                            </div>
                            <div className="bg-white px-3 py-2 rounded-lg border border-green-200">
                              <div className="text-xs text-gray-600">Paid</div>
                              <div className="whitespace-nowrap text-base font-semibold tabular-nums">₵{totalPayments.toFixed(2)}</div>
                            </div>
                            <div className="bg-white px-3 py-2 rounded-lg border border-green-200">
                              <div className="text-xs text-gray-600">Balance</div>
                              <div className={`whitespace-nowrap text-base font-semibold tabular-nums ${outstandingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>₵{outstandingBalance.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {(selectedReservation.remarksToGuest || selectedReservation.internalNotes) && (
                      <div className="bg-amber-50 p-3 rounded-lg border">
                        <h4 className="mb-2 font-medium text-amber-900">📝 Notes</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                          {selectedReservation.remarksToGuest && (
                            <div className="bg-white px-3 py-2 rounded-lg border border-amber-200">
                              <div className="text-xs text-gray-600">Remarks to Guest</div>
                              <div className="text-ghana-black">{selectedReservation.remarksToGuest}</div>
                            </div>
                          )}
                          {selectedReservation.internalNotes && (
                            <div className="bg-white px-3 py-2 rounded-lg border border-amber-200">
                              <div className="text-xs text-gray-600">Internal Notes</div>
                              <div className="text-ghana-black">{selectedReservation.internalNotes}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Print, PDF and Send to guest live here only (not in the footer). */}
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button size="sm" variant="flat" onClick={async () => {
                        let cleanup: (() => void) | undefined;
                        try {
                          const { el, cleanup: c } = await renderReservationPdfSource(selectedReservation!);
                          cleanup = c;
                          // lazy load html2pdf.js
                          // @ts-ignore
                          const ensure = async () => (window as any).html2pdf || await new Promise((res, rej) => { const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'; s.onload=()=>res((window as any).html2pdf); s.onerror=()=>rej(); document.body.appendChild(s); });
                          // @ts-ignore
                          const h2p = await ensure();
                          const filename = `reservation-${selectedReservation?.resId || selectedReservation?.id || 'summary'}.pdf`;
                          await h2p().set({ filename, jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }, margin: 16 }).from(el).save();
                          cleanup();

                          trackEvent('Proforma.Downloaded', { reservationId: selectedReservation?.id, guestName: selectedReservation?.guestName, filename }, { sourceModule: 'FrontOffice' });
                        } catch {
                          cleanup?.();
                          trackEvent('Proforma.Printed', { reservationId: selectedReservation?.id, guestName: selectedReservation?.guestName, fallbackToPrint: true }, { sourceModule: 'FrontOffice' });
                          window.print();
                        }
                      }}>Download PDF</Button>
                      <Button size="sm" color="primary" variant="flat" onPress={() => printConfirmation(selectedReservation)}>Print</Button>
                      {((formData.email || '').trim() || (frontOfficeStore.guests.find(g => g.id === selectedReservation.guestId)?.email || '').trim()) && (
                        <Button size="sm" color="primary" onPress={() => sendConfirmation(selectedReservation)}>Send to guest</Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">{isCreatingNew ? 'The summary appears here once the reservation is saved.' : 'Select a reservation to view'}</div>
                )}
              </Tab>
              
              {/* Audit Log Tab - only show when viewing existing reservation */}
              {!isCreatingNew && selectedReservation && (
                <Tab key="audit" title="📋 Audit Log">
                  <AuditLogSection reservationId={selectedReservation.id} />
                </Tab>
              )}
              
              <Tab key="guest" title={isCreatingNew ? 'Guest & stay' : 'Reservation'}>
                <div className="space-y-4 pt-2">
                  {!isCreatingNew && selectedReservation && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-semibold text-gray-900">{selectedReservation.resId || selectedReservation.id}</span>
                        <Chip size="sm" variant="flat" color={getStatusColor(selectedReservation.status) as any}>{selectedReservation.status}</Chip>
                        <span className="text-gray-500">
                          {selectedReservation.roomId && selectedReservation.roomId !== 'TBD' ? `Room ${selectedReservation.roomId}` : 'Room not assigned'}
                        </span>
                      </div>
                      {/* Raised so the guest search results sit above (and take clicks over) the sections below. */}
                      <div className="relative z-20 bg-purple-50 p-3 rounded-lg border">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-medium text-purple-900">👤 Guest</h4>
                          <div className="flex flex-wrap items-center gap-2">
                          {switchedGuest && (
                            <div className="flex items-center gap-2">
                              <Chip size="sm" color="warning" variant="flat">Changes when you update</Chip>
                              <Button size="sm" variant="light" onPress={() => { setSelectedGuest(null); setFormData((prev) => ({ ...prev, guestName: selectedReservation.guestName, phone: (selectedReservation as any).guestPhone || '', email: (selectedReservation as any).guestEmail || '' })); }}>
                                Undo
                              </Button>
                            </div>
                          )}
                          {['pending', 'confirmed'].includes(selectedReservation.status) && (() => {
                            // Same pop-up as a new booking's guest card. Assigns straight away,
                            // for this booking's saved dates (like the old Assign Room tab).
                            const current = selectedReservation.roomId && selectedReservation.roomId !== 'TBD' ? selectedReservation.roomId : '';
                            const bookedTypeId = formData.roomTypeId || selectedReservation.roomTypeId;
                            const bookedTypeName = useSettingsStore.getState().roomManagement.roomTypes.find((rt) => rt.id === bookedTypeId)?.name || '';
                            const free = getRoomsFreeForStay(
                              assignMatchTypeOnly ? bookedTypeId : null,
                              selectedReservation.arrival,
                              selectedReservation.departure,
                              undefined,
                              selectedReservation.id,
                            );
                            const typeName = (num: string) => {
                              const typeId = housekeepingStore.getAllRooms().find((r) => r.roomNumber === num)?.roomTypeId;
                              return useSettingsStore.getState().roomManagement.roomTypes.find((rt) => rt.id === typeId)?.name || '';
                            };
                            const apply = (roomId: string) => {
                              frontOfficeStore.assignRoom(selectedReservation.id, roomId);
                              const updated = frontOfficeStore.reservations.find((r) => r.id === selectedReservation.id);
                              if (updated) {
                                setSelectedReservation(updated);
                                setAssignReservation(updated);
                              }
                              setAssignRoomId(roomId);
                              loadReservations();
                              setEditRoomPickerOpen(false);
                            };
                            return (
                              <Popover
                                placement="bottom-end"
                                isOpen={editRoomPickerOpen}
                                onOpenChange={(open) => {
                                  setEditRoomPickerOpen(open);
                                  if (open) setAssignRoomId(current);
                                }}
                              >
                                <PopoverTrigger>
                                  <Button size="sm" variant="flat" color={current ? 'success' : 'primary'}>
                                    🛏️ {current ? `Room ${current}` : 'Assign room'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent>
                                  <div className="w-[22rem] max-w-[90vw] space-y-3 p-2">
                                    <div className="text-sm text-gray-700">
                                      {selectedReservation.guestName} · {selectedReservation.resId || selectedReservation.id}
                                      <span className="text-gray-500">{current ? ` · Room ${current}` : ' · No room assigned'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-sm text-gray-600">
                                        {assignMatchTypeOnly ? `Free ${bookedTypeName} rooms for these dates` : 'All free rooms for these dates'}
                                      </div>
                                      <Switch size="sm" classNames={{ label: 'whitespace-nowrap' }} isSelected={assignMatchTypeOnly} onValueChange={setAssignMatchTypeOnly}>Match type</Switch>
                                    </div>
                                    <Autocomplete<any>
                                      label="Room"
                                      placeholder="Search a free room"
                                      selectedKey={assignRoomId || null}
                                      onSelectionChange={(key) => setAssignRoomId(typeof key === 'string' ? key : '')}
                                    >
                                      {(() => {
                                        const list = current && !free.includes(current) ? [current, ...free] : free;
                                        return (list.length ? list : ['__none']).map((num) => (
                                          <AutocompleteItem key={num} textValue={num === '__none' ? 'No free rooms' : num} isDisabled={num === '__none'}>
                                            {num === '__none' ? 'No free rooms for these dates' : assignMatchTypeOnly ? num : `${num} · ${typeName(num)}`}
                                          </AutocompleteItem>
                                        ));
                                      })()}
                                    </Autocomplete>
                                    <div className="flex justify-end gap-2">
                                      {current && (
                                        <Button size="sm" color="danger" variant="flat" onPress={() => apply('')}>Unassign</Button>
                                      )}
                                      <Button size="sm" variant="light" onPress={() => setEditRoomPickerOpen(false)}>Close</Button>
                                      <Button size="sm" color="primary" isDisabled={!assignRoomId || assignRoomId === current} onPress={() => apply(assignRoomId)}>Assign</Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          })()}
                          </div>
                        </div>
                        {/* Current guest and the search share one row (stacked on phones). */}
                        <div className="keep-cols grid grid-cols-1 gap-2 md:grid-cols-2 md:items-center">
                        <div className="min-w-0 bg-white px-3 py-2 rounded-lg border border-purple-200">
                          <div className="truncate font-semibold text-ghana-black">{(switchedGuest ? guestDisplayName(switchedGuest) : selectedReservation.guestName) || 'No guest'}</div>
                          <div className="truncate text-sm text-gray-600">
                            {[formData.phone && `📱 ${formData.phone}`, formData.email && `📧 ${formData.email}`].filter(Boolean).join('   ') || 'No phone or email on file'}
                          </div>
                        </div>
                        {canChangeGuest ? (
                          <div className="relative min-w-0">
                            <Input
                              value={guestSearchTerm}
                              onChange={(e) => { setGuestSearchTerm(e.target.value); setGuestSearchError(null); }}
                              placeholder="Change guest: name, phone, email, Ghana Card"
                              aria-label="Change guest: search by name, phone, email, or Ghana Card"
                              startContent={isGuestSearching
                                ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                                : <span className="text-gray-400">🔍</span>}
                              isClearable
                              onClear={() => { setGuestSearchTerm(''); setFilteredGuests([]); }}
                            />
                            {guestSearchTerm.trim() && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {isGuestSearching ? (
                                  <div className="p-4 text-center text-sm text-gray-600">Searching guests...</div>
                                ) : filteredGuests.length > 0 ? (
                                  filteredGuests.map((guest) => (
                                    <div
                                      key={guest.id}
                                      role="button"
                                      tabIndex={0}
                                      className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                                      onClick={() => handleGuestSelection(guest)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleGuestSelection(guest); }}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="truncate font-medium text-gray-900">{guestDisplayName(guest) || 'Unknown guest'}</div>
                                          <div className="text-sm text-gray-600">
                                            {(guest as any).phone && `📱 ${(guest as any).phone}`}
                                            {(guest as any).email && ` 📧 ${(guest as any).email}`}
                                          </div>
                                        </div>
                                        <Button size="sm" color="primary" variant="flat" onClick={(e) => { e.stopPropagation(); handleGuestSelection(guest); }}>
                                          Use
                                        </Button>
                                      </div>
                                    </div>
                                  ))
                                ) : guestSearchError === 'No guests found matching your search' ? (
                                  <GuestSearchEmptyState searchTerm={guestSearchTerm} />
                                ) : guestSearchError ? (
                                  <div className="p-3 text-center text-sm text-red-600">⚠️ {guestSearchError}</div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-purple-800">The guest can't be changed once the stay is checked out. Edit guest details in Clients.</p>
                        )}
                        </div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg border">
                        <h4 className="mb-2 font-medium text-blue-900">📅 Stay</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          <Input label="Arrival" type="date" value={formData.arrival} onChange={(e) => setFormData({...formData, arrival: e.target.value})} />
                          <Input label="Departure" type="date" value={formData.departure} onChange={(e) => setFormData({...formData, departure: e.target.value})} />
                          <Input label="Nights" value={String(calculateNights(formData.arrival, formData.departure))} isReadOnly />
                          <Input label="Adults" type="number" value={String(formData.adults)} onChange={(e) => setFormData({...formData, adults: parseInt(e.target.value) || 1})} />
                          <Input label="Children" type="number" value={String(formData.children)} onChange={(e) => setFormData({...formData, children: parseInt(e.target.value) || 0})} />
                        </div>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg border">
                        <h4 className="mb-2 font-medium text-green-900">🛏️ Room and rate</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Select
                            label="Room type"
                            selectedKeys={formData.roomTypeId ? new Set([formData.roomTypeId]) : new Set()}
                            onSelectionChange={(keys) => {
                              const id = Array.from(keys as Set<string>)[0] || '';
                              const settings = useSettingsStore.getState();
                              const defaultId = (settings.roomManagement.defaultRatePlanByRoomType || {})[id] || '';
                              setFormData({ ...formData, roomTypeId: id, ratePlanId: defaultId || 'custom', customRate: defaultId ? undefined : 0 });
                              if (!defaultId) setEditRateInput('0.00');
                            }}
                          >
                            {(useSettingsStore.getState().roomManagement.roomTypes || []).filter((rt: any) => rt.isActive !== false || rt.id === formData.roomTypeId).map((rt: any) => (
                              <SelectItem key={rt.id} textValue={rt.name}>{rt.name}</SelectItem>
                            ))}
                          </Select>
                          <Select<any>
                            label="Rate"
                            isDisabled={!formData.roomTypeId}
                            selectedKeys={new Set([formData.ratePlanId || 'custom'])}
                            onSelectionChange={(keys) => {
                              const selected = Array.from(keys as Set<string>)[0] || 'custom';
                              setFormData({ ...formData, ratePlanId: selected, customRate: selected === 'custom' ? (formData.customRate || 0) : undefined });
                              if (selected === 'custom' && !editRateInput) setEditRateInput('0.00');
                            }}
                          >
                            {(() => {
                              const items = (useSettingsStore.getState().roomManagement.ratePlans || [])
                                .filter((rp: any) => rp.roomTypeId === formData.roomTypeId)
                                .map((rp: any) => (
                                  <SelectItem key={rp.id} textValue={rp.name}>{`${rp.name} — ₵${getPlanGross(rp).toFixed(2)}`}</SelectItem>
                                ));
                              items.push(<SelectItem key="custom" textValue="Custom rate">Custom rate</SelectItem>);
                              return items as unknown as any;
                            })()}
                          </Select>
                          {formData.ratePlanId === 'custom' || !formData.ratePlanId ? (
                            <Input
                              label="Custom rate (₵ incl. taxes)"
                              type="number"
                              startContent="₵"
                              value={editRateInput}
                              onChange={(e) => {
                                setEditRateInput(e.target.value);
                                const gross = parseFloat(e.target.value);
                                setFormData({ ...formData, ratePlanId: 'custom', customRate: !isNaN(gross) && gross > 0 ? Number(exclusiveFromGross(gross).toFixed(2)) : 0 });
                              }}
                            />
                          ) : (
                            <Input
                              label="Rate"
                              isReadOnly
                              startContent="₵"
                              value={(() => {
                                const rp = useSettingsStore.getState().roomManagement.ratePlans.find(r => r.id === formData.ratePlanId);
                                return rp ? getPlanGross(rp).toFixed(2) : '0.00';
                              })()}
                            />
                          )}
                        </div>
                        {(() => {
                          const { nights, nightly, grandTotal } = getComputedTotals(formData.arrival, formData.departure, formData.roomTypeId || '', formData.ratePlanId, formData.customRate);
                          return (
                            <div className="mt-2 text-sm text-green-900">
                              {nights} night{nights === 1 ? '' : 's'} · ₵{nightly.toFixed(2)} a night · Total <strong>₵{grandTotal.toFixed(2)}</strong>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  {/* Guest Management - Unified for Single and Multiple */}
                  {isCreatingNew && (
                    <div className="relative z-20 bg-purple-50 p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-purple-900">👥 Guest List ({bulkGuests.length} guest{bulkGuests.length !== 1 ? 's' : ''})</h4>
                        {bulkGuests.length > 1 ? (
                          <label className="flex items-center gap-2 text-sm text-purple-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={linkAsGroup}
                              onChange={(e) => setLinkAsGroup(e.target.checked)}
                              className="rounded"
                            />
                            🔗 Link as one group booking
                          </label>
                        ) : (
                          <div className="text-sm text-purple-700">
                            Search and add guests from the system
                          </div>
                        )}
                      </div>
                      
                      {/* Guest Search for Bulk */}
                      <div className="mb-4 flex flex-wrap items-end gap-3">
                        <div className="relative guest-search-container min-w-0 grow basis-0">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                          Search and Add Guests
                            </label>
                            <div className="relative">
                              <div className="flex">
                                <Input
                                  value={guestSearchTerm}
                              onChange={(e) => {
                                setGuestSearchTerm(e.target.value);
                                setGuestSearchError(null);
                              }}
                              placeholder="Search for existing guests by name, phone, email, or Ghana Card"
                                  onFocus={() => setShowGuestSearch(true)}
                                  className="flex-1"
                              isInvalid={!!guestSearchError && guestSearchTerm.length >= 2 && guestSearchError !== 'No guests found matching your search'}
                              errorMessage={guestSearchError && guestSearchTerm.length >= 2 && guestSearchError !== 'No guests found matching your search' ? guestSearchError : undefined}
                              startContent={
                                isGuestSearching ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                                ) : (
                                  <span className="text-gray-400">🔍</span>
                                )
                              }
                                />
                                {guestSearchTerm && (
                                  <Button
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    onClick={() => {
                                      setGuestSearchTerm('');
                                      setFilteredGuests([]);
                                    }}
                                    className="ml-2"
                                  >
                                    ✕
                                  </Button>
                                )}
                              </div>
                              {guestSearchTerm.trim() && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {isGuestSearching ? (
                                <div className="p-4 text-center">
                                  <div className="flex items-center justify-center space-x-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                                    <span className="text-sm text-gray-600">Searching guests...</span>
                                  </div>
                                </div>
                              ) : filteredGuests.length > 0 ? (
                                    filteredGuests.map(guest => (
                                      <div
                                        key={guest.id}
                                        role="button"
                                        tabIndex={0}
                                        className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                                    onClick={() => addGuestToBulk(guest)}
                                  >
                                    <div className="flex items-center justify-between">
                                <div>
                                        <div className="font-medium text-gray-900">
                                          {(guest as any).name || `${(guest as any).firstName || ''} ${(guest as any).lastName || ''}`.trim() || 'Unknown guest'}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          {(guest as any).phone && `📱 ${(guest as any).phone}`}
                                          {(guest as any).email && ` 📧 ${(guest as any).email}`}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                        color="primary"
                                        variant="flat"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addGuestToBulk(guest);
                                        }}
                                      >
                                        ➕ Add
                                </Button>
                              </div>
                              </div>
                                ))
                              ) : guestSearchError === 'No guests found matching your search' ? (
                                <GuestSearchEmptyState searchTerm={guestSearchTerm} />
                              ) : guestSearchError ? (
                                <div className="p-3 text-center">
                                  <div className="text-red-600 text-sm mb-2">⚠️ {guestSearchError}</div>
                                </div>
                              ) : null}
                        </div>
                      )}
                    </div>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0 px-1 py-2">
                          <span className="text-sm text-gray-600 whitespace-nowrap">Guest Pays</span>
                          <input
                            type="checkbox"
                            id="useBillingPerson"
                            checked={useBillingPerson}
                            onChange={(e) => {
                              setUseBillingPerson(e.target.checked);
                              if (e.target.checked) {
                                setSelectedBillingPerson(null);
                                setFormData(prev => ({
                                  ...prev,
                                  billingPersonId: undefined,
                                  companyName: ''
                                }));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-600 whitespace-nowrap">Third Party Pays</span>
                        </div>
                    </div>
                      
                      {/* Selected Guests List */}
                      {bulkGuests.length > 0 && (
                        <div className="space-y-3">
                          {bulkGuests.map((bulkGuest, index) => {
                            const roomType = useSettingsStore.getState().roomManagement.roomTypes.find(rt => rt.id === bulkGuest.roomTypeId);
                            const baseRate = getNightlyRate(bulkGuest.roomTypeId);
                            const finalRate = bulkGuest.customRate || baseRate;
                            
                            return (
                              <div key={bulkGuest.id} className="bg-white p-4 rounded-lg border border-purple-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-sm font-medium text-purple-700">
                                      {index + 1}
                    </div>
                      <div>
                                      <h5 className="font-medium text-gray-900">
                                        {bulkGuest.guest.name || `${(bulkGuest.guest as any).firstName || ''} ${(bulkGuest.guest as any).lastName || ''}`.trim() || 'Guest'}
                                      </h5>
                      </div>
                      </div>
                                  <div className="flex items-center gap-1">
                                    {/* Optional room: most bookings get a room nearer arrival. The pop-up lists
                                        only rooms of this type that are free for this guest's dates. */}
                                    <Popover
                                      placement="bottom-end"
                                      isOpen={roomPickerFor === bulkGuest.id}
                                      onOpenChange={(open) => {
                                        setRoomPickerFor(open ? bulkGuest.id : null);
                                        if (open) { setRoomPickerChoice(bulkGuest.roomId || ''); setRoomPickerMatchType(true); }
                                      }}
                                    >
                                      <PopoverTrigger>
                                        <Button size="sm" variant="flat" color={bulkGuest.roomId ? 'success' : 'primary'}>
                                          🛏️ {bulkGuest.roomId ? `Room ${bulkGuest.roomId}` : 'Assign room'}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent>
                                        {(() => {
                                          // Same layout as the Assign Room tab: Match type switch, room search, Assign.
                                          const hasDates = !!bulkGuest.arrival && !!bulkGuest.departure && bulkGuest.departure > bulkGuest.arrival;
                                          const free = getRoomsFreeForStay(
                                            roomPickerMatchType ? bulkGuest.roomTypeId : null,
                                            bulkGuest.arrival,
                                            bulkGuest.departure,
                                            bulkGuest.id,
                                            undefined,
                                            mode === 'checkin', // walk-in checks in now: only rooms empty today
                                          );
                                          const typeName = (num: string) => {
                                            const typeId = housekeepingStore.getAllRooms().find((r) => r.roomNumber === num)?.roomTypeId;
                                            return useSettingsStore.getState().roomManagement.roomTypes.find((rt) => rt.id === typeId)?.name || '';
                                          };
                                          const pick = (roomId: string) => { updateBulkGuest(bulkGuest.id, 'roomId', roomId); setRoomPickerFor(null); };
                                          return (
                                            <div className="w-[22rem] max-w-[90vw] space-y-3 p-2">
                                              <div className="text-sm text-gray-700">
                                                {bulkGuest.guest.name || 'Guest'}
                                                <span className="text-gray-500">
                                                  {' · '}{hasDates ? `${bulkGuest.arrival} → ${bulkGuest.departure}` : 'no dates yet'}
                                                  {bulkGuest.roomId ? ` · Room ${bulkGuest.roomId}` : ' · No room assigned'}
                                                </span>
                                              </div>
                                              <div className="flex items-center justify-between gap-3">
                                                <div className="text-sm text-gray-600">
                                                  {roomPickerMatchType ? `Free ${roomType?.name || ''} rooms` : 'All free rooms'}
                                                </div>
                                                <Switch size="sm" classNames={{ label: 'whitespace-nowrap' }} isSelected={roomPickerMatchType} onValueChange={setRoomPickerMatchType}>Match type</Switch>
                                              </div>
                                              {!hasDates ? (
                                                <p className="text-sm text-gray-600">Set the arrival and departure dates first.</p>
                                              ) : (
                                                <Autocomplete<any>
                                                  label="Room"
                                                  placeholder="Search a free room"
                                                  selectedKey={roomPickerChoice || null}
                                                  onSelectionChange={(key) => setRoomPickerChoice(typeof key === 'string' ? key : '')}
                                                >
                                                  {(free.length ? free : ['__none']).map((num) => (
                                                    <AutocompleteItem key={num} textValue={num === '__none' ? 'No free rooms' : num} isDisabled={num === '__none'}>
                                                      {num === '__none'
                                                        ? 'No free rooms for these dates'
                                                        : roomPickerMatchType ? num : `${num} · ${typeName(num)}`}
                                                    </AutocompleteItem>
                                                  ))}
                                                </Autocomplete>
                                              )}
                                              <div className="flex justify-end gap-2">
                                                {bulkGuest.roomId && (
                                                  <Button size="sm" color="danger" variant="flat" onPress={() => pick('')}>Unassign</Button>
                                                )}
                                                <Button size="sm" variant="light" onPress={() => setRoomPickerFor(null)}>Assign later</Button>
                                                <Button size="sm" color="primary" isDisabled={!roomPickerChoice} onPress={() => pick(roomPickerChoice)}>Assign</Button>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </PopoverContent>
                                    </Popover>
                                  <Button
                          size="sm"
                                    color="danger"
                                    variant="light"
                                    onClick={() => removeBulkGuest(bulkGuest.id)}
                                  >
                                    🗑️ Remove
                                  </Button>
                                  </div>
                      </div>
                                
                                {/* Personal Details */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                        <Input
                                    label="Adults"
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={bulkGuest.adults.toString()}
                                    onChange={(e) => updateBulkGuest(bulkGuest.id, 'adults', parseInt(e.target.value) || 1)}
                          size="sm"
                                  />
                        <Input
                                    label="Children"
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={bulkGuest.children.toString()}
                                    onChange={(e) => updateBulkGuest(bulkGuest.id, 'children', parseInt(e.target.value) || 0)}
                          size="sm"
                        />
                        <Input
                                    label="Arrival Date"
                                    type="date"
                                    value={bulkGuest.arrival}
                                    onChange={(e) => {
                                      updateBulkGuest(bulkGuest.id, 'arrival', e.target.value);
                                      keepRoomIfStillFree(bulkGuest.id, bulkGuest.roomId, bulkGuest.roomTypeId, e.target.value, bulkGuest.departure);
                                    }}
                          size="sm"
                                  />
                      <Input
                                    label="Departure Date"
                                    type="date"
                                    value={bulkGuest.departure}
                                    onChange={(e) => {
                                      updateBulkGuest(bulkGuest.id, 'departure', e.target.value);
                                      keepRoomIfStillFree(bulkGuest.id, bulkGuest.roomId, bulkGuest.roomTypeId, bulkGuest.arrival, e.target.value);
                                    }}
                        size="sm"
                      />
                      <Input
                                    label="Nights"
                                    value={String(calculateNights(bulkGuest.arrival, bulkGuest.departure))}
                                    isReadOnly
                                    size="sm"
                      />
                    </div>

                                {/* Room Configuration */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Select
                                    label="Room Type"
                                    selectedKeys={bulkGuest.roomTypeId ? new Set([bulkGuest.roomTypeId]) : new Set()}
                                    onSelectionChange={(keys) => {
                                      const id = Array.from(keys as Set<string>)[0] || '';
                                      updateBulkGuest(bulkGuest.id, 'roomTypeId', id);
                                      // A room belongs to one type — a new type means pick again (or assign later).
                                      if (id !== bulkGuest.roomTypeId) updateBulkGuest(bulkGuest.id, 'roomId', '');
                                      const settings = useSettingsStore.getState();
                                      const plans = (settings.roomManagement.ratePlans || []).filter((rp: any) => rp.roomTypeId === id);
                          const defaultId = (settings.roomManagement.defaultRatePlanByRoomType || {})[id];
                          // Default to Custom Rate at 0.00 on room type change
                          updateBulkGuest(bulkGuest.id, 'ratePlanId', 'custom');
                          updateBulkGuest(bulkGuest.id, 'customRate', 0);
                          updateBulkGuest(bulkGuest.id, 'customRateInput', '0.00');
                                    }}
                        placeholder="Select room type"
                                  >
                        {(useSettingsStore.getState().roomManagement.roomTypes || []).filter((rt: any) => rt.isActive !== false || rt.id === bulkGuest.roomTypeId).map((rt: any) => {
                          return (
                            <SelectItem key={rt.id} textValue={rt.name}>
                              {rt.name}
                          </SelectItem>
                          );
                        })}
                      </Select>
                      {/* Selected Room Type chip removed per request */}

                                  
                      {/* Rate selector: list rate plans for selected room type + Custom Rate */}
                      <Select<any>
                        label="Rate"
                        isDisabled={!bulkGuest.roomTypeId}
                        placeholder="Select rate"
                        selectedKeys={new Set([bulkGuest.ratePlanId || 'custom'])}
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys as Set<string>)[0] || '';
                          if (selected === 'custom') {
                            // Switch to editable custom mode and reset to 0.00 gross
                            updateBulkGuest(bulkGuest.id, 'ratePlanId', 'custom');
                            updateBulkGuest(bulkGuest.id, 'customRate', 0);
                            updateBulkGuest(bulkGuest.id, 'customRateInput', '0.00');
                          } else {
                            updateBulkGuest(bulkGuest.id, 'ratePlanId', selected);
                            // Store plan into customRate as NET is not needed; keep zero so custom is independent
                            updateBulkGuest(bulkGuest.id, 'customRate', 0);
                            updateBulkGuest(bulkGuest.id, 'customRateInput', '0.00');
                          }
                        }}
                      >
                        {(() => {
                          const items = (useSettingsStore.getState().roomManagement.ratePlans || [])
                            .filter((rp: any) => rp.roomTypeId === bulkGuest.roomTypeId)
                            .map((rp: any) => (
                              <SelectItem key={rp.id} textValue={rp.name}>{`${rp.name} — ₵${getPlanGross(rp).toFixed(2)}`}</SelectItem>
                            ));
                          items.push(<SelectItem key="custom" textValue="Custom Rate">Custom Rate</SelectItem>);
                          return items as unknown as any;
                        })()}
                      </Select>
                      {/* Selected Rate chip removed per request */}
                      {bulkGuest.ratePlanId === 'custom' ? (
                        <Input
                          label="Enter Custom Rate (₵ incl. taxes)"
                          type="number"
                          placeholder="Override rate"
                          value={bulkGuest.customRateInput ?? (() => { const gross = grossFromExclusive(bulkGuest.customRate || 0); return Number.isFinite(gross) ? gross.toFixed(2) : '0.00'; })()}
                          onChange={(e) => {
                            // Shown value always mirrors exactly what was typed — no
                            // round-trip through the net conversion, so entering any
                            // amount sticks instead of drifting to a rounded value.
                            updateBulkGuest(bulkGuest.id, 'customRateInput', e.target.value);
                            const gross = parseFloat(e.target.value);
                            if (isNaN(gross) || gross < 0) { updateBulkGuest(bulkGuest.id, 'customRate', 0); return; }
                            const net = exclusiveFromGross(gross);
                            updateBulkGuest(bulkGuest.id, 'customRate', Number(net.toFixed(2)));
                          }}
                          startContent="₵"
                        />
                      ) : (
                        <Input
                          label="Enter Custom Rate (₵)"
                          type="number"
                          value={(() => { 
                            const rp = useSettingsStore.getState().roomManagement.ratePlans.find(r => r.id === bulkGuest.ratePlanId); 
                            const gross = rp ? getPlanGross(rp) : 0;
                            return Number(gross).toFixed(2);
                          })()}
                          isDisabled
                          startContent="₵"
                          endContent={<span title="Locked by rate plan">🔒</span>}
                        />
                      )}
                      
                  </div>
                  
                  {/* Special Requests and Amount on the same row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                  <Textarea
                                    label="Special Requests"
                                    placeholder="Any special requests for this guest"
                                    value={bulkGuest.specialRequests || ''}
                                    onChange={(e) => updateBulkGuest(bulkGuest.id, 'specialRequests', e.target.value)}
                                    rows={2}
                      />
                      <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">Amount (incl. taxes)</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {(() => {
                          const planId = bulkGuest.ratePlanId && bulkGuest.ratePlanId !== 'custom' ? bulkGuest.ratePlanId : undefined;
                          const rp = planId ? useSettingsStore.getState().roomManagement.ratePlans.find(r => r.id === planId) : undefined;
                          const typedGross = parseFloat(String(bulkGuest.customRateInput ?? ''));
                          const breakdown = buildRateBreakdown(
                            bulkGuest.roomTypeId,
                            bulkGuest.arrival,
                            bulkGuest.departure,
                            rp,
                            rp ? undefined : (Number.isFinite(typedGross) && typedGross > 0 ? typedGross : undefined),
                            'gross_total'
                          );
                          const amount = breakdown.reduce((s, d) => s + (d.total || 0), 0);
                          void complianceRuleCount;
                          return `₵${amount.toFixed(2)}`;
                        })()}
                      </div>
                    </div>
                    </div>
                    </div>
                            );
                          })}
                  </div>
                      )}
                      
                      {bulkGuests.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <div className="text-4xl mb-2">👥</div>
                          <div className="text-lg font-medium">No guests added yet</div>
                          <div className="text-sm">Search for guests above and click "Add" to include them</div>
                  </div>
                      )}
                      <div className="mt-2 pt-3 border-t border-purple-200 text-sm text-purple-800 flex items-center justify-between flex-wrap gap-2">
                        <span>🏨 Booking a large group by headcount, without individual guest names?</span>
                        <Button
                          size="sm"
                          variant="flat"
                          color="secondary"
                          onPress={() => {
                            try { localStorage.setItem('nav.section', 'events-conferences'); } catch {}
                            onClose();
                            router.push('/');
                          }}
                        >
                          Use Bulk Accommodation (Events & Conferences) →
                        </Button>
                      </div>
                </div>
                  )}
              
                  {/* Stay Purpose & Billing moved here from the separate tab */}
                  {/* Stay Purpose Section */}
                  <div className="bg-blue-50 p-3 rounded-lg border">
                    <h4 className="font-medium text-blue-900 mb-2">Purpose of Stay</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Stay *</label>
                        <Select
                          value={formData.stayReason}
                          onChange={(e) => setFormData({...formData, stayReason: e.target.value as StayReason})}
                          isRequired
                        >
                          <SelectItem key="personal">👤 Personal</SelectItem>
                          <SelectItem key="business">💼 Business</SelectItem>
                          <SelectItem key="corporate">🏢 Corporate</SelectItem>
                          <SelectItem key="conference">🎤 Conference</SelectItem>
                          <SelectItem key="training">📚 Training</SelectItem>
                          <SelectItem key="medical">🏥 Medical</SelectItem>
                          <SelectItem key="tourism">🌍 Tourism</SelectItem>
                          <SelectItem key="other">📋 Other</SelectItem>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Additional Details</label>
                        <Input
                          value={formData.stayReasonDetails}
                          onChange={(e) => setFormData({...formData, stayReasonDetails: e.target.value})}
                          placeholder="More details about the purpose"
                        />
                      </div>
                    </div>
                    {/* Business/Corporate specific fields */}
                    {['business', 'corporate', 'conference', 'training'].includes(formData.stayReason) && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                          <Input
                            value={formData.companyName}
                            onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                            placeholder="Company or organization name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Project Code</label>
                          <Input
                            value={formData.projectCode}
                            onChange={(e) => setFormData({...formData, projectCode: e.target.value})}
                            placeholder="Project or cost center code"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Billing Person Section */}
                  {useBillingPerson && (
                  <div className="bg-green-50 p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-green-900">Billing Information</h4>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">
                      Select who will be responsible for payment (company, travel agent, etc.)
                    </p>
                    
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search for Billing Person
                          </label>
                          <div className="relative billing-person-search-container">
                            <div className="flex">
                              <Input
                                value={billingPersonSearchTerm}
                                onChange={(e) => {
                                  setBillingPersonSearchTerm(e.target.value);
                                  setBillingPersonSearchError(null);
                                }}
                                placeholder="Search by name, company, or email"
                                onFocus={() => setShowBillingPersonSearch(true)}
                                className="flex-1"
                                isInvalid={!!billingPersonSearchError && billingPersonSearchTerm.length >= 2}
                                errorMessage={billingPersonSearchError && billingPersonSearchTerm.length >= 2 ? billingPersonSearchError : undefined}
                                startContent={
                                  isBillingPersonSearching ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                  ) : (
                                    <span className="text-gray-400">🔍</span>
                                  )
                                }
                              />
                              {billingPersonSearchTerm && (
                                <Button
                                  size="sm"
                                  variant="light"
                                  color="danger"
                                  onClick={() => {
                                    setBillingPersonSearchTerm('');
                                    setFilteredBillingPersons([]);
                                  }}
                                  className="ml-2"
                                >
                                  ✕
                                </Button>
                              )}
                            </div>
                            {showBillingPersonSearch && billingPersonSearchTerm.trim() && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {isBillingPersonSearching ? (
                                  <div className="p-4 text-center">
                                    <div className="flex items-center justify-center space-x-2">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                      <span className="text-sm text-gray-600">Searching billing persons...</span>
                                    </div>
                                  </div>
                                ) : billingPersonSearchError ? (
                                  <div className="p-3 text-center">
                                    <div className="text-red-600 text-sm mb-2">⚠️ {billingPersonSearchError}</div>
                                    {billingPersonSearchTerm.length < 2 && (
                                      <div className="text-xs text-gray-500">
                                        Enter at least 2 characters to search
                                      </div>
                                    )}
                                  </div>
                                ) : filteredBillingPersons.length > 0 ? (
                                  (filteredBillingPersons as any[]).map((bp: any) => (
                                    <div
                                      key={bp.id}
                                      className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                                      onClick={() => handleBillingPersonSelection(bp)}
                                    >
                                      <div className="font-medium text-gray-900">
                                        {bp.name || `${bp.firstName || ''} ${bp.lastName || ''}`}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {bp.employerCompany && `🏢 ${bp.employerCompany}`}
                                        {bp.jobTitle && ` 👤 ${bp.jobTitle}`}
                                        {bp.phone && ` 📱 ${bp.phone}`}
                                        {bp.email && ` 📧 ${bp.email}`}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        Serial: {bp.serialNumber || 'N/A'}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-3 text-gray-500 text-center">
                                    <div className="text-sm">No billing persons found</div>
                                    <div className="text-xs mt-1">Try searching by name, company, or email</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {selectedBillingPerson && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="font-medium text-green-900">✅ Billing Person Selected</div>
                                <div className="text-sm text-green-700">
                                  {(selectedBillingPerson as any).name || `${(selectedBillingPerson as any).firstName || ''} ${(selectedBillingPerson as any).lastName || ''}`.trim()}
                                </div>
                                <div className="text-xs text-green-700">
                                  {(selectedBillingPerson as any).employerCompany || formData.companyName || '—'}
                                  {((selectedBillingPerson as any).jobTitle ? ` • ${(selectedBillingPerson as any).jobTitle}` : '')}
                                </div>
                                <div className="text-xs text-green-600">
                                  {((selectedBillingPerson as any).email || '—')}
                                  {((selectedBillingPerson as any).phone ? ` • ${(selectedBillingPerson as any).phone}` : '')}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                color="danger"
                                variant="light"
                                onClick={() => {
                                  setSelectedBillingPerson(null);
                                  setFormData(prev => ({
                                    ...prev,
                                    billingPersonId: undefined,
                                    companyName: ''
                                  }));
                                }}
                              >
                                Change
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {/* Quick add new billing person */}
                        <div className="text-center">
                          <Button
                            size="sm"
                            color="primary"
                            variant="bordered"
                            onClick={openNewBillingPersonModal}
                          >
                            ➕ Add New Billing Person
                          </Button>
                        </div>
                      </div>
                  </div>
                  )}

                  {showNewBillingPersonModal && (
                    <Modal isOpen={showNewBillingPersonModal} onClose={() => setShowNewBillingPersonModal(false)}>
                      <ModalContent>
                        <ModalHeader>Add New Billing Person</ModalHeader>
                        <ModalBody>
                          <div className="space-y-3 pb-2">
                            <Input
                              label="Name *"
                              value={newBillingPersonForm.name}
                              onChange={(e) => { setNewBillingPersonForm(prev => ({ ...prev, name: e.target.value })); setNewBillingPersonError(null); }}
                              isInvalid={!!newBillingPersonError}
                              errorMessage={newBillingPersonError || undefined}
                            />
                            <Input
                              label="Company"
                              value={newBillingPersonForm.company}
                              onChange={(e) => setNewBillingPersonForm(prev => ({ ...prev, company: e.target.value }))}
                            />
                            <Input
                              label="Job Title"
                              value={newBillingPersonForm.jobTitle}
                              onChange={(e) => setNewBillingPersonForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                            />
                            <Input
                              label="Phone"
                              value={newBillingPersonForm.phone}
                              onChange={(e) => setNewBillingPersonForm(prev => ({ ...prev, phone: e.target.value }))}
                            />
                            <Input
                              label="Email"
                              type="email"
                              value={newBillingPersonForm.email}
                              onChange={(e) => setNewBillingPersonForm(prev => ({ ...prev, email: e.target.value }))}
                            />
                          </div>
                        </ModalBody>
                        <ModalFooter>
                          <Button variant="light" onClick={() => setShowNewBillingPersonModal(false)}>Cancel</Button>
                          <Button color="primary" onClick={handleCreateBillingPerson}>Save & Select</Button>
                        </ModalFooter>
                      </ModalContent>
                    </Modal>
                  )}

                  {/* Source */}
                  <div className="mb-4 p-3 bg-yellow-50 rounded-lg flex flex-wrap items-center gap-3">
                    <label className="text-sm font-medium text-gray-700 shrink-0">
                      Source
                    </label>
                    <div className="min-w-[12rem] grow basis-[12rem]">
                    <Select
                      value={formData.source}
                      onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                      aria-label="Source"
                    >
                      <SelectItem key="walkin">🚶 Walk-in</SelectItem>
                      <SelectItem key="online">🌐 Online</SelectItem>
                      <SelectItem key="booking">📱 Booking.com</SelectItem>
                      <SelectItem key="corporate">🏢 Corporate</SelectItem>
                      <SelectItem key="referral">👥 Referral</SelectItem>
                    </Select>
                    </div>
                    {!isCreatingNew && (
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-sm text-gray-600 whitespace-nowrap">Guest Pays</span>
                        <input
                          type="checkbox"
                          id="useBillingPerson"
                          checked={useBillingPerson}
                          onChange={(e) => {
                            setUseBillingPerson(e.target.checked);
                            if (e.target.checked) {
                              setSelectedBillingPerson(null);
                              setFormData(prev => ({
                                ...prev,
                                billingPersonId: undefined,
                                companyName: ''
                              }));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-600 whitespace-nowrap">Third Party Pays</span>
                      </div>
                    )}
                    <div className="bg-amber-50 px-3 py-2 rounded-lg border flex items-center gap-3 shrink-0">
                      <span className="font-medium text-amber-900 whitespace-nowrap">Tax Exemption</span>
                      <span className="text-sm text-gray-600 whitespace-nowrap">Tax Exempt</span>
                      <Switch
                        isSelected={!!formData.taxExempt}
                        onValueChange={(val) => setFormData({...formData, taxExempt: val})}
                      />
                    </div>
                  </div>
                  {formData.taxExempt && (
                    <div className="bg-amber-50 p-3 rounded-lg border mb-4">
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Exemption Type</label>
                            <Select
                              value={formData.taxExemptionType || ''}
                              onChange={(e) => setFormData({...formData, taxExemptionType: e.target.value as any})}
                            >
                              <SelectItem key="government">🏛️ Government</SelectItem>
                              <SelectItem key="ngo">🤝 NGO</SelectItem>
                              <SelectItem key="diplomatic">🌐 Diplomatic</SelectItem>
                              <SelectItem key="other">📋 Other</SelectItem>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Number</label>
                            <Input
                              value={formData.taxExemptionNumber || ''}
                              onChange={(e) => setFormData({...formData, taxExemptionNumber: e.target.value})}
                              placeholder="Exemption certificate number"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Authority</label>
                            <Input
                              value={formData.taxExemptionAuthority || ''}
                              onChange={(e) => setFormData({...formData, taxExemptionAuthority: e.target.value})}
                              placeholder="e.g. Ghana Revenue Authority"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                            <Input
                              type="date"
                              value={formData.taxExemptionExpiry || ''}
                              onChange={(e) => setFormData({...formData, taxExemptionExpiry: e.target.value})}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                          <Textarea
                            value={formData.taxExemptionNotes || ''}
                            onChange={(e) => setFormData({...formData, taxExemptionNotes: e.target.value})}
                            placeholder="Additional notes about this exemption"
                          />
                        </div>
                        <AttachmentUpload
                          label="Exemption Documents"
                          attachments={formData.taxExemptionDocuments || []}
                          onChange={(attachments) => setFormData({...formData, taxExemptionDocuments: attachments})}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Tab>
              
              

              <Tab key="additional" title="Additional">
                <div className="space-y-3 pt-1">
                  <div className="bg-amber-50 p-3 rounded-lg border space-y-3">
                  <h4 className="font-medium text-amber-900">📝 Notes</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks to Guest</label>
                    <Textarea
                      value={formData.remarksToGuest}
                      onChange={(e) => setFormData({...formData, remarksToGuest: e.target.value})}
                      placeholder="Special requests, preferences, or notes for the guest"
                      rows={2}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
                    <Textarea
                      value={formData.internalNotes}
                      onChange={(e) => setFormData({...formData, internalNotes: e.target.value})}
                      placeholder="Internal notes for staff (not visible to guest)"
                      rows={2}
                    />
                  </div>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-lg border space-y-3">
                  <h4 className="font-medium text-blue-900">🏷️ Booking Details</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Market Codes</label>
                    <div className="flex flex-wrap gap-2">
                      {frontOfficeStore.marketCodes.map(code => (
                        <Chip
                          key={code}
                          variant={formData.marketCodes.includes(code) ? "solid" : "bordered"}
                          color={formData.marketCodes.includes(code) ? "primary" : "default"}
                          className="cursor-pointer"
                          onClick={() => {
                            const newCodes = formData.marketCodes.includes(code)
                              ? formData.marketCodes.filter(c => c !== code)
                              : [...formData.marketCodes, code];
                            setFormData({...formData, marketCodes: newCodes});
                          }}
                        >
                          {code}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="guaranteed"
                      checked={formData.isGuaranteed}
                      onChange={(e) => setFormData({...formData, isGuaranteed: e.target.checked})}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="guaranteed" className="text-sm font-medium text-gray-700">
                      Reservation is guaranteed (deposit received)
                    </label>
                  </div>
                  </div>
                </div>
              </Tab>
            </Tabs>
          </ModalBody>
          <ModalFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-end">
            {!isCreatingNew && selectedReservation && (selectedReservation.status === 'confirmed' || selectedReservation.status === 'pending') && (
              <Button color="success" variant="flat" className="w-full sm:w-auto" onClick={() => handleQuickAction('checkin', selectedReservation)}>
                Check in
              </Button>
            )}

            {!isCreatingNew && selectedReservation && canMarkNoShow(selectedReservation, businessDate ?? '') && (
              <Button color="danger" variant="bordered" className="w-full sm:w-auto" onClick={() => openNoShowConfirm(selectedReservation)}>
                No-show
              </Button>
            )}
            {!isCreatingNew && selectedReservation && ['pending', 'confirmed'].includes(selectedReservation.status) && (
              <Button color="danger" variant="flat" className="w-full sm:w-auto" onClick={() => handleQuickAction('cancel', selectedReservation)}>
                Cancel reservation
              </Button>
            )}
            {!isCreatingNew && selectedReservation && canDeleteReservation && !['void', 'cancelled'].includes(selectedReservation.status) && (
              <Button color="danger" variant="light" className="w-full sm:w-auto" onPress={async () => {
                const posted = selectedReservation.status !== 'pending';
                if (posted) {
                  await confirmDanger({
                    tone: 'delete',
                    title: `Delete ${selectedReservation.resId || 'this stay'}?`,
                    message: 'This stay already counted, so it cannot be deleted. Use Void. The original stays on file and the books stay even.',
                    confirmLabel: 'OK',
                  });
                  return;
                }
                const ok = await confirmDelete(selectedReservation.resId || 'this reservation', 'A pending reservation that never became a stay will be permanently removed.');
                if (!ok) return;
                const removed = frontOfficeStore.deleteReservation(selectedReservation.id);
                if (!removed) {
                  alert('This reservation already has charges or payments. Void it instead.');
                  return;
                }
                loadReservations();
                dismissForm();
              }}>
                Delete
              </Button>
            )}
            {!isCreatingNew && selectedReservation && ['checked-in', 'checked-out', 'no-show'].includes(selectedReservation.status) && (
              <Button color="warning" variant="flat" className="w-full sm:w-auto" onPress={async () => {
                if (frontOfficeStore.stayPostedToBooks(selectedReservation.id)) {
                  alert(POSTED_STAY_VOID_MESSAGE);
                  return;
                }
                const ok = await confirmVoid(selectedReservation.resId || 'this stay', 'The stay stays on file as Void. Charges are reversed and any payment is refunded so the books stay even.');
                if (!ok) return;
                if (!frontOfficeStore.voidReservation(selectedReservation.id, 'Void stay')) {
                  alert(POSTED_STAY_VOID_MESSAGE);
                  return;
                }
                loadReservations();
                dismissForm();
              }}>
                Void
              </Button>
            )}
            <Button 
              color="primary" 
              onClick={handleSaveReservation} 
              className="w-full sm:w-auto"
              isDisabled={isCreatingNew && bulkGuests.length === 0}
            >
              {isCreatingNew
                ? (bulkGuests.length > 0
                    ? (mode === 'checkin'
                        ? `Check in ${bulkGuests.length} guest${bulkGuests.length !== 1 ? 's' : ''}`
                        : `💾 Create ${bulkGuests.length} Reservation${bulkGuests.length !== 1 ? 's' : ''}`)
                    : (mode === 'checkin' ? 'Add guest first' : '💾 Add Guest First'))
                : '💾 Update Reservation'
              }
            </Button>

            <Button variant="light" onClick={dismissForm} className="w-full sm:w-auto">
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Assign Room Modal */}
      <Modal isOpen={isAssignOpen} onClose={() => { setIsAssignOpen(false); setCheckInAfterAssign(false); }}>
        <ModalContent>
          <ModalHeader>{checkInAfterAssign ? 'Assign room and check in' : 'Assign Room'}</ModalHeader>
          <ModalBody>
            {assignReservation ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">Reservation</div>
                <div className="font-medium">{assignReservation.guestName} • {assignReservation.resId || assignReservation.id}</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-600">
                      {assignMatchTypeOnly ? 'Free rooms of this type for these dates' : 'All free rooms for these dates'}
                    </div>
                    <Switch isSelected={assignMatchTypeOnly} onValueChange={setAssignMatchTypeOnly}>
                      Match Type
                    </Switch>
                  </div>
                  <Autocomplete<any>
                    label="Assign to Room"
                    placeholder="Search or select a free room"
                    selectedKey={assignRoomId || undefined}
                    onSelectionChange={(key) => setAssignRoomId(typeof key === 'string' ? key : (key as any) || '')}
                    onInputChange={(value) => setAssignRoomSearch(value)}
                  >
                    {(() => {
                      const all = getRoomsFreeForStay(
                        assignMatchTypeOnly ? assignReservation.roomTypeId : null,
                        assignReservation.arrival,
                        assignReservation.departure,
                        undefined,
                        assignReservation.id,
                        checkInAfterAssign, // checking in now: only rooms empty today
                      );
                      const filtered = assignRoomSearch
                        ? all.filter(n => n.toLowerCase().includes((assignRoomSearch || '').toLowerCase()))
                        : all;
                      const list = filtered.length ? filtered : ['No vacant rooms'];
                      return list.map((num) => (
                        <AutocompleteItem key={num} textValue={num} isDisabled={num === 'No vacant rooms'}>
                          {num}
                        </AutocompleteItem>
                      ));
                    })()}
                  </Autocomplete>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No reservation selected.</div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={() => { setIsAssignOpen(false); setCheckInAfterAssign(false); }}>Cancel</Button>
            <Button
              color="primary"
              isDisabled={!assignReservation || !assignRoomId}
              onClick={() => {
                if (!assignReservation || !assignRoomId) return;
                frontOfficeStore.assignRoom(assignReservation.id, assignRoomId);
                if (checkInAfterAssign) {
                  frontOfficeStore.checkIn(assignReservation.id);
                  notifySuccess(`${assignReservation.guestName} checked in — Room ${assignRoomId}`, 'Checked in');
                  const updated = frontOfficeStore.reservations.find((r) => r.id === assignReservation.id);
                  if (updated && selectedReservation?.id === updated.id) setSelectedReservation(updated);
                }
                setCheckInAfterAssign(false);
                setIsAssignOpen(false);
                loadReservations();
              }}
            >
              {checkInAfterAssign ? 'Assign & check in' : 'Assign'}
            </Button>
            {assignReservation?.roomId && assignReservation?.status !== 'checked-in' && (
              <Button
                color="danger"
                variant="flat"
                onClick={() => {
                  // Unassign the room if assigned wrongly
                  frontOfficeStore.assignRoom(assignReservation!.id, '');
                  loadReservations();
                  setIsAssignOpen(false);
                }}
              >
                Unassign
              </Button>
            )}
            {assignReservation?.status === 'checked-in' && (
              <Button isDisabled variant="flat">Unassign (not allowed while checked-in)</Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isNoShowOpen} onClose={onNoShowClose}>
        <ModalContent>
          <ModalHeader>Mark no-show</ModalHeader>
          <ModalBody>
            {noShowTarget && (
              <div className="space-y-3 text-sm">
                <p>
                  Mark <strong>{noShowTarget.guestName}</strong> ({noShowTarget.resId || noShowTarget.id}) as a no-show?
                </p>
                <p className="text-gray-600">
                  This posts the no-show penalty to the folio, records GL directly (not checkout), closes the folio
                  {noShowTarget.isGuaranteed ? ', and charges the guaranteed card if applicable' : ''}.
                </p>
                {!useSettingsStore.getState().roomManagement.noShowPolicyEnabled && (
                  <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 text-xs">
                    No-show policy is disabled — status will update but no penalty charge will apply.
                  </p>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onNoShowClose}>Cancel</Button>
            <Button color="danger" onPress={confirmNoShow}>Confirm no-show</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
