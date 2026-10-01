'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, Button, Badge, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Tabs, Tab, Input, Select, SelectItem, Textarea,
  Autocomplete, AutocompleteItem
} from '@heroui/react';
import { useSession } from 'next-auth/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';
import { useIncidentStore } from '../lib/security/incidentStore';
import { useVisitorStore } from '../lib/security/visitorStore';
import { usePatrolStore } from '../lib/security/patrolStore';
import { usePersonnelStore } from '../lib/security/personnelStore';
import { useCheckpointLocationStore } from '../lib/security/checkpointLocationStore';
import { usePatrolRouteStore } from '../lib/security/patrolRouteStore';
import { useShiftStore } from '../lib/security/shiftStore';
import { CheckpointLocation, PatrolLog, PatrolRoute, SecurityIncident, SecurityPersonnel, SecurityShift, Visitor } from '../lib/security/models';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';
import type { DashboardSectionDef } from '../lib/dashboard/useDashboardVisibility';
import DepartmentStaffTab from './hr/DepartmentStaffTab';
// Same resizable/sortable/click-to-open table kit Front Desk's stay
// worksheet pioneered — unified here so every module's tables look and
// behave the same way (font, header sort arrows, drag-to-resize columns,
// click-anywhere-on-row to open).
import { SortLabel, unifiedTableClassNames, rowClassNames, useResizableColumns } from './frontoffice/columnResize';
import { DetailGrid, DetailField } from './frontoffice/detailView';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from './dashboard/deskTabsUi';
import SecurityReportsAnalysis from './SecurityReportsAnalysis';
import { useDashboardPeriod, isInPeriod } from '../lib/dashboard/useDashboardPeriod';

// Hideable summary cards for the whole Security module — the Recent
// Activities/Notices cards that live outside this component, in
// SecurityMainDashboard.tsx, which owns the single useDashboardVisibility
// call and passes it down as props so hiding/restoring works from one place.
// The tabs here (Incident Management, Visitor Management, etc.) are core
// navigation, not clutter, so they're deliberately not included.
export const SECURITY_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: 'recentActivities', label: 'Recent Activities' },
  { id: 'notices', label: 'Security Notices' },
];

function securityHeaders(): HeadersInit {
  return { 'x-tenant-subdomain': getClientTenantSubdomain() };
}

interface SecurityComplianceDashboardProps {
  fullPage?: boolean;
  initialTab?: string;
  onTabChange?: (tab: string) => void;
  /** Phone, tablet, and short screens start with the patrol/shift status tiles hidden. */
  summaryCollapsed?: boolean;
}

export default function SecurityComplianceDashboard({
  fullPage = false,
  initialTab,
  onTabChange,
  summaryCollapsed = false,
}: SecurityComplianceDashboardProps) {
  const { data: session } = useSession();
  const currentUserName = session?.user?.name || 'User';
  const currentUserId = (session?.user as any)?.id as string | undefined;
  const settings = useSettingsStore();
  // Mirrors the server-side requirePermission() checks on the security/* API
  // routes, so someone who can't act just doesn't see the button rather than
  // clicking it and hitting a 403 with no explanation.
  const canManagePatrols = settings.hasPermission('security.manage-patrols');
  const canManagePersonnel = settings.hasPermission('security.manage-personnel');
  const canManageShifts = settings.hasPermission('security.manage-shifts');
  // Matches the server's requireAnyPermission fallback — anyone who can run a
  // patrol can also save a checkpoint/route they typed fresh while starting one.
  const canManageCheckpoints = settings.hasPermission('security.manage-checkpoints') || canManagePatrols;
  const canManageRoutes = settings.hasPermission('security.manage-routes') || canManagePatrols;

  const deskPeriod = useDashboardPeriod('dashboard.period.security', 'today');

  const [selectedTab, setSelectedTab] = useState(initialTab || 'patrols');

  useEffect(() => {
    if (initialTab) {
      setSelectedTab(initialTab);
      onTabChange?.(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    try {
      const wanted = localStorage.getItem('security.tab');
      if (wanted) {
        setSelectedTab(wanted);
        onTabChange?.(wanted);
        localStorage.removeItem('security.tab');
      }
    } catch {}
  }, []);

  useEffect(() => {
    const onNavigate = () => {
      try {
        const wanted = localStorage.getItem('security.tab');
        if (wanted) {
          setSelectedTab(wanted);
          onTabChange?.(wanted);
          localStorage.removeItem('security.tab');
        }
      } catch {}
    };
    window.addEventListener('security-navigate', onNavigate);
    return () => window.removeEventListener('security-navigate', onNavigate);
  }, [onTabChange]);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);
  const [isPatrolModalOpen, setIsPatrolModalOpen] = useState(false);
  const [viewingIncident, setViewingIncident] = useState<SecurityIncident | null>(null);
  const [viewingVisitor, setViewingVisitor] = useState<Visitor | null>(null);
  const [viewingPatrol, setViewingPatrol] = useState<PatrolLog | null>(null);
  const [viewingShift, setViewingShift] = useState<SecurityShift | null>(null);
  const [viewingPersonnel, setViewingPersonnel] = useState<SecurityPersonnel | null>(null);
  const [viewingLocation, setViewingLocation] = useState<CheckpointLocation | null>(null);
  const [viewingRoute, setViewingRoute] = useState<PatrolRoute | null>(null);

  // Each "View X" modal doubles as its own editor — flip to a form in place
  // rather than opening a second modal, so there's one modal per record, not
  // two. Edit-form state is seeded from the record when Edit is pressed.
  const [isEditingIncident, setIsEditingIncident] = useState(false);
  const [incidentEditForm, setIncidentEditForm] = useState<{
    type: SecurityIncident['type']; severity: SecurityIncident['severity']; status: SecurityIncident['status'];
    location: string; floor: string; room: string; description: string; assignedTo: string; resolution: string;
  } | null>(null);
  const [isEditingVisitor, setIsEditingVisitor] = useState(false);
  const [visitorEditForm, setVisitorEditForm] = useState<{
    name: string; phone: string; idType: NonNullable<Visitor['idType']>; idNumber: string;
    purpose: string; hostName: string; hostRoom: string; vehicleNumber: string;
  } | null>(null);
  const [isEditingPatrol, setIsEditingPatrol] = useState(false);
  const [patrolEditForm, setPatrolEditForm] = useState<{ route: string; notes: string } | null>(null);
  const [isEditingShift, setIsEditingShift] = useState(false);
  const [shiftEditForm, setShiftEditForm] = useState<{ notes: string } | null>(null);
  const [isEditingPersonnel, setIsEditingPersonnel] = useState(false);
  const [personnelEditForm, setPersonnelEditForm] = useState<{ name: string; phone: string; agency: string; role: string; notes: string } | null>(null);

  const closeIncidentView = () => { setViewingIncident(null); setIsEditingIncident(false); };
  const closeVisitorView = () => { setViewingVisitor(null); setIsEditingVisitor(false); };
  const closePatrolView = () => { setViewingPatrol(null); setIsEditingPatrol(false); };
  const closeShiftView = () => { setViewingShift(null); setIsEditingShift(false); };
  const closePersonnelView = () => { setViewingPersonnel(null); setIsEditingPersonnel(false); };

  // Sort state for each table — one key/dir pair per table, matching the
  // click-header-to-sort behavior Front Desk's stay worksheet uses.
  type IncidentSortKey = 'incidentNumber' | 'type' | 'severity' | 'location' | 'status' | 'assignedTo';
  const [incidentSort, setIncidentSort] = useState<{ key: IncidentSortKey; dir: 'asc' | 'desc' }>({ key: 'incidentNumber', dir: 'desc' });
  type VisitorSortKey = 'visitorNumber' | 'name' | 'purpose' | 'hostName' | 'checkInTime' | 'status';
  const [visitorSort, setVisitorSort] = useState<{ key: VisitorSortKey; dir: 'asc' | 'desc' }>({ key: 'checkInTime', dir: 'desc' });
  type PatrolSortKey = 'patrolNumber' | 'officerName' | 'route' | 'startTime' | 'checkpoints' | 'status';
  const [patrolSort, setPatrolSort] = useState<{ key: PatrolSortKey; dir: 'asc' | 'desc' }>({ key: 'startTime', dir: 'desc' });
  type ShiftSortKey = 'personName' | 'checkInTime' | 'checkOutTime' | 'duration' | 'status';
  const [shiftSort, setShiftSort] = useState<{ key: ShiftSortKey; dir: 'asc' | 'desc' }>({ key: 'checkInTime', dir: 'desc' });
  type PersonnelSortKey = 'name' | 'agency' | 'role' | 'phone' | 'status';
  const [personnelSort, setPersonnelSort] = useState<{ key: PersonnelSortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  type NamedRefSortKey = 'name' | 'status';
  const [checkpointSort, setCheckpointSort] = useState<{ key: NamedRefSortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [routeSort, setRouteSort] = useState<{ key: NamedRefSortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });

  const incidentColumns = useResizableColumns<IncidentSortKey>({ incidentNumber: 132, type: 140, severity: 108, location: 140, status: 120, assignedTo: 132 });
  const visitorColumns = useResizableColumns<VisitorSortKey>({ visitorNumber: 120, name: 176, purpose: 176, hostName: 132, checkInTime: 140, status: 120 });
  const patrolColumns = useResizableColumns<PatrolSortKey>({ patrolNumber: 120, officerName: 140, route: 160, startTime: 160, checkpoints: 108, status: 108 });
  const shiftColumns = useResizableColumns<ShiftSortKey>({ personName: 160, checkInTime: 160, checkOutTime: 160, duration: 108, status: 108 });
  const personnelColumns = useResizableColumns<PersonnelSortKey>({ name: 160, agency: 140, role: 140, phone: 132, status: 108 });
  const checkpointColumns = useResizableColumns<NamedRefSortKey>({ name: 240, status: 120 });
  const routeColumns = useResizableColumns<NamedRefSortKey>({ name: 240, status: 120 });

  function sortRows<T, K extends string>(rows: T[], sort: { key: K; dir: 'asc' | 'desc' }, getValue: (row: T, key: K) => string | number): T[] {
    const sorted = [...rows].sort((a, b) => {
      const av = getValue(a, sort.key);
      const bv = getValue(b, sort.key);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return sort.dir === 'asc' ? sorted : sorted.reverse();
  }

  const { incidents, hydrateFromApi: hydrateIncidents, addIncident, updateIncident, assignIncident, resolveIncident } = useIncidentStore();
  const { visitors, hydrateFromApi: hydrateVisitors, addVisitor, updateVisitor, checkOutVisitor } = useVisitorStore();
  const { patrols, hydrateFromApi: hydratePatrols, startPatrol, updatePatrol, endPatrol, completeCheckpoint, missCheckpoint } = usePatrolStore();
  const { personnel, hydrateFromApi: hydratePersonnel, addPersonnel, updatePersonnel, setPersonnelActive } = usePersonnelStore();
  const { locations: checkpointLocations, hydrateFromApi: hydrateCheckpointLocations, addLocation: addCheckpointLocation, setLocationActive: setCheckpointLocationActive } = useCheckpointLocationStore();
  const { routes: patrolRoutes, hydrateFromApi: hydratePatrolRoutes, addRoute: addPatrolRoute, setRouteActive: setPatrolRouteActive } = usePatrolRouteStore();
  const { shifts, hydrateFromApi: hydrateShifts, checkIn, checkOut, updateShift } = useShiftStore();

  const openIncident = viewingIncident ? incidents.find((i) => i.id === viewingIncident.id) ?? null : null;
  const openVisitor = viewingVisitor ? visitors.find((v) => v.id === viewingVisitor.id) ?? null : null;
  const openPatrol = viewingPatrol ? patrols.find((p) => p.id === viewingPatrol.id) ?? null : null;
  const openShift = viewingShift ? shifts.find((s) => s.id === viewingShift.id) ?? null : null;
  const openPersonnel = viewingPersonnel ? personnel.find((p) => p.id === viewingPersonnel.id) ?? null : null;
  const openLocation = viewingLocation ? checkpointLocations.find((l) => l.id === viewingLocation.id) ?? null : null;
  const openRoute = viewingRoute ? patrolRoutes.find((r) => r.id === viewingRoute.id) ?? null : null;

  const startEditIncident = () => {
    if (!openIncident) return;
    setIncidentEditForm({
      type: openIncident.type, severity: openIncident.severity, status: openIncident.status,
      location: openIncident.location, floor: openIncident.floor || '', room: openIncident.room || '',
      description: openIncident.description, assignedTo: openIncident.assignedTo || '', resolution: openIncident.resolution || '',
    });
    setIsEditingIncident(true);
  };
  const saveEditIncident = () => {
    if (!openIncident || !incidentEditForm) return;
    if (!incidentEditForm.location.trim() || !incidentEditForm.description.trim()) return;
    updateIncident(openIncident.id, {
      type: incidentEditForm.type,
      severity: incidentEditForm.severity,
      status: incidentEditForm.status,
      location: incidentEditForm.location.trim(),
      floor: incidentEditForm.floor.trim() || undefined,
      room: incidentEditForm.room.trim() || undefined,
      description: incidentEditForm.description.trim(),
      assignedTo: incidentEditForm.assignedTo.trim() || undefined,
      resolution: incidentEditForm.resolution.trim() || undefined,
    });
    setIsEditingIncident(false);
  };

  const startEditVisitor = () => {
    if (!openVisitor) return;
    setVisitorEditForm({
      name: openVisitor.name, phone: openVisitor.phone || '', idType: openVisitor.idType || 'ghana-card',
      idNumber: openVisitor.idNumber || '', purpose: openVisitor.purpose, hostName: openVisitor.hostName || '',
      hostRoom: openVisitor.hostRoom || '', vehicleNumber: openVisitor.vehicleNumber || '',
    });
    setIsEditingVisitor(true);
  };
  const saveEditVisitor = () => {
    if (!openVisitor || !visitorEditForm) return;
    if (!visitorEditForm.name.trim() || !visitorEditForm.purpose.trim()) return;
    updateVisitor(openVisitor.id, {
      name: visitorEditForm.name.trim(),
      phone: visitorEditForm.phone.trim() || undefined,
      idType: visitorEditForm.idType,
      idNumber: visitorEditForm.idNumber.trim() || undefined,
      purpose: visitorEditForm.purpose.trim(),
      hostName: visitorEditForm.hostName.trim() || undefined,
      hostRoom: visitorEditForm.hostRoom.trim() || undefined,
      vehicleNumber: visitorEditForm.vehicleNumber.trim() || undefined,
    });
    setIsEditingVisitor(false);
  };

  const startEditPatrol = () => {
    if (!openPatrol) return;
    setPatrolEditForm({ route: openPatrol.route, notes: openPatrol.notes || '' });
    setIsEditingPatrol(true);
  };
  const saveEditPatrol = () => {
    if (!openPatrol || !patrolEditForm || !patrolEditForm.route.trim()) return;
    updatePatrol(openPatrol.id, { route: patrolEditForm.route.trim(), notes: patrolEditForm.notes.trim() || undefined });
    setIsEditingPatrol(false);
  };

  const startEditShift = () => {
    if (!openShift) return;
    setShiftEditForm({ notes: openShift.notes || '' });
    setIsEditingShift(true);
  };
  const saveEditShift = () => {
    if (!openShift || !shiftEditForm) return;
    updateShift(openShift.id, { notes: shiftEditForm.notes.trim() || undefined });
    setIsEditingShift(false);
  };

  const startEditPersonnel = () => {
    if (!openPersonnel) return;
    setPersonnelEditForm({
      name: openPersonnel.name, phone: openPersonnel.phone || '', agency: openPersonnel.agency || '',
      role: openPersonnel.role || '', notes: openPersonnel.notes || '',
    });
    setIsEditingPersonnel(true);
  };
  const saveEditPersonnel = () => {
    if (!openPersonnel || !personnelEditForm || !personnelEditForm.name.trim()) return;
    updatePersonnel(openPersonnel.id, {
      name: personnelEditForm.name.trim(),
      phone: personnelEditForm.phone.trim() || undefined,
      agency: personnelEditForm.agency.trim() || undefined,
      role: personnelEditForm.role.trim() || undefined,
      notes: personnelEditForm.notes.trim() || undefined,
    });
    setIsEditingPersonnel(false);
  };

  useEffect(() => {
    hydrateIncidents();
    hydrateVisitors();
    hydratePatrols();
    hydratePersonnel();
    hydrateCheckpointLocations();
    hydratePatrolRoutes();
    hydrateShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real security-permissioned staff, so a patrol's officer is a real account
  // (officerId) rather than a freely-typed name nobody can reliably report on.
  const [securityStaff, setSecurityStaff] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch('/api/tenant?module=security', { headers: securityHeaders() })
      .then((r) => (r.ok ? r.json() : { staff: [] }))
      .then((data) => setSecurityStaff(data.staff || []))
      .catch(() => setSecurityStaff([]));
  }, []);

  const [incidentForm, setIncidentForm] = useState({
    type: 'suspicious_activity' as SecurityIncident['type'],
    severity: 'medium' as SecurityIncident['severity'],
    location: '', floor: '', room: '', description: '',
  });

  const [visitorForm, setVisitorForm] = useState({
    name: '', phone: '', idType: 'ghana-card' as NonNullable<Visitor['idType']>, idNumber: '',
    purpose: '', hostName: '', hostRoom: '', vehicleNumber: '', escortRequired: 'no',
  });

  // officerKey is 'staff:<userId>' for a real account or 'person:<personnelId>' for
  // an outsourced/contracted guard managed in the Staff Management tab — merged into
  // one picker so either kind can run a patrol.
  const [patrolForm, setPatrolForm] = useState<{ officerKey: string; route: string; checkpoints: string[] }>({ officerKey: '', route: '', checkpoints: [''] });
  const activePersonnel = personnel.filter((p) => p.isActive);
  const activeCheckpointLocations = checkpointLocations.filter((l) => l.isActive);
  const activePatrolRoutes = patrolRoutes.filter((r) => r.isActive);
  const openPatrolModal = () => {
    const defaultOfficerKey = currentUserId && securityStaff.some((s) => s.id === currentUserId) ? `staff:${currentUserId}` : (securityStaff[0] ? `staff:${securityStaff[0].id}` : '');
    setPatrolForm({ officerKey: defaultOfficerKey, route: '', checkpoints: [''] });
    setIsPatrolModalOpen(true);
  };
  const addPatrolCheckpointRow = () => setPatrolForm(f => ({ ...f, checkpoints: [...f.checkpoints, ''] }));
  const updatePatrolCheckpointRow = (index: number, value: string) =>
    setPatrolForm(f => ({ ...f, checkpoints: f.checkpoints.map((c, i) => (i === index ? value : c)) }));
  const removePatrolCheckpointRow = (index: number) =>
    setPatrolForm(f => ({ ...f, checkpoints: f.checkpoints.filter((_, i) => i !== index) }));

  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [personnelForm, setPersonnelForm] = useState({ name: '', phone: '', agency: '', role: '', notes: '' });
  const submitPersonnel = () => {
    const name = personnelForm.name.trim();
    if (!name) return;
    addPersonnel({
      name,
      phone: personnelForm.phone.trim() || undefined,
      agency: personnelForm.agency.trim() || undefined,
      role: personnelForm.role.trim() || undefined,
      notes: personnelForm.notes.trim() || undefined,
    });
    trackEvent('SECURITY.PersonnelAdded', { name, agency: personnelForm.agency });
    setPersonnelForm({ name: '', phone: '', agency: '', role: '', notes: '' });
    setIsPersonnelModalOpen(false);
  };

  const [newCheckpointName, setNewCheckpointName] = useState('');
  const submitCheckpointLocation = () => {
    const name = newCheckpointName.trim();
    if (!name || checkpointLocations.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      setNewCheckpointName('');
      return;
    }
    addCheckpointLocation(name);
    setNewCheckpointName('');
  };

  const [newRouteName, setNewRouteName] = useState('');
  const submitPatrolRoute = () => {
    const name = newRouteName.trim();
    if (!name || patrolRoutes.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      setNewRouteName('');
      return;
    }
    addPatrolRoute(name);
    setNewRouteName('');
  };

  // Duty shifts — who is on site right now, and a real attendance history.
  const onDutyShifts = shifts.filter((s) => s.status === 'on_duty');
  const onDutyPersonKeys = new Set(onDutyShifts.map((s) => s.personKey));
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInForm, setCheckInForm] = useState({ personKey: '', notes: '' });
  const submitCheckIn = () => {
    const [kind, refId] = checkInForm.personKey.split(':');
    const staffPerson = kind === 'staff' ? securityStaff.find((s) => s.id === refId) : undefined;
    const contractedPerson = kind === 'person' ? activePersonnel.find((p) => p.id === refId) : undefined;
    const name = staffPerson?.name || contractedPerson?.name;
    if (!checkInForm.personKey || !name) return;
    checkIn(checkInForm.personKey, name, checkInForm.notes.trim() || undefined);
    trackEvent('SECURITY.ShiftCheckedIn', { name });
    setCheckInForm({ personKey: '', notes: '' });
    setIsCheckInModalOpen(false);
  };
  const formatShiftDuration = (start: Date, end?: Date) => {
    const ms = (end || new Date()).getTime() - start.getTime();
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const [missCheckpointTarget, setMissCheckpointTarget] = useState<{ patrolId: string; checkpointId: string; location: string } | null>(null);
  const [missReason, setMissReason] = useState('');
  const closeMissCheckpoint = () => { setMissCheckpointTarget(null); setMissReason(''); };
  const confirmMissCheckpoint = () => {
    if (!missCheckpointTarget) return;
    missCheckpoint(missCheckpointTarget.patrolId, missCheckpointTarget.checkpointId, missReason.trim() || 'No reason given');
    trackEvent('SECURITY.CheckpointMissed', { location: missCheckpointTarget.location });
    closeMissCheckpoint();
  };

  const submitIncident = () => {
    if (!incidentForm.location.trim() || !incidentForm.description.trim()) return;
    addIncident({
      incidentNumber: useSettingsStore.getState().getNextModuleNumber('security', 'incidentReport'),
      type: incidentForm.type,
      severity: incidentForm.severity,
      status: 'reported',
      location: incidentForm.location.trim(),
      floor: incidentForm.floor.trim() || undefined,
      room: incidentForm.room.trim() || undefined,
      description: incidentForm.description.trim(),
      reportedBy: currentUserName,
      reportedAt: new Date(),
    });
    trackEvent('SECURITY.IncidentReported', { location: incidentForm.location, severity: incidentForm.severity });
    setIncidentForm({ type: 'suspicious_activity', severity: 'medium', location: '', floor: '', room: '', description: '' });
    setIsIncidentModalOpen(false);
  };

  const submitVisitor = () => {
    if (!visitorForm.name.trim() || !visitorForm.purpose.trim()) return;
    addVisitor({
      name: visitorForm.name.trim(),
      phone: visitorForm.phone.trim() || undefined,
      idType: visitorForm.idType,
      idNumber: visitorForm.idNumber.trim() || undefined,
      purpose: visitorForm.purpose.trim(),
      hostName: visitorForm.hostName.trim() || undefined,
      hostRoom: visitorForm.hostRoom.trim() || undefined,
      vehicleNumber: visitorForm.vehicleNumber.trim() || undefined,
      escortRequired: visitorForm.escortRequired === 'yes',
      approvedBy: currentUserName,
    });
    trackEvent('SECURITY.VisitorRegistered', { purpose: visitorForm.purpose });
    setVisitorForm({ name: '', phone: '', idType: 'ghana-card', idNumber: '', purpose: '', hostName: '', hostRoom: '', vehicleNumber: '', escortRequired: 'no' });
    setIsVisitorModalOpen(false);
  };

  const submitPatrol = () => {
    const route = patrolForm.route.trim();
    const checkpointNames = patrolForm.checkpoints.map(c => c.trim()).filter(Boolean);
    if (!route || checkpointNames.length === 0) return;

    const [kind, refId] = patrolForm.officerKey.split(':');
    const staffOfficer = kind === 'staff' ? securityStaff.find((s) => s.id === refId) : undefined;
    const contractedOfficer = kind === 'person' ? activePersonnel.find((p) => p.id === refId) : undefined;
    const officerName = staffOfficer?.name || contractedOfficer?.name || currentUserName;

    // New route/checkpoint names typed in the moment are worth keeping for next time.
    if (!patrolRoutes.some((r) => r.name.toLowerCase() === route.toLowerCase())) {
      addPatrolRoute(route);
    }
    checkpointNames.forEach((name) => {
      if (!checkpointLocations.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
        addCheckpointLocation(name);
      }
    });

    const now = new Date();
    startPatrol({
      officerId: staffOfficer?.id,
      officerName,
      route,
      checkpoints: checkpointNames.map(location => ({ location, scheduledTime: now })),
    });
    trackEvent('SECURITY.PatrolStarted', { route, checkpoints: checkpointNames.length });
    setPatrolForm({ officerKey: '', route: '', checkpoints: [''] });
    setIsPatrolModalOpen(false);
  };

  const renderIncidentManagement = () => (
    <div className="space-y-3">
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="px-3 py-2">
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <h3 className="min-w-0 text-sm font-semibold text-gray-800">🚨 Security Incident Management</h3>
            <Button size="sm" color="primary" className="bg-red-500 text-white shrink-0" variant="flat" onClick={() => { setViewingIncident(null); setIsIncidentModalOpen(true); }}>
              🚨 Report Incident
            </Button>
          </div>
        </CardHeader>
        <CardBody className="px-3 pt-0 pb-3">
          <div className="max-h-[560px] overflow-y-auto" ref={incidentColumns.frameRef} style={incidentColumns.frameStyle}>
            <Table
              aria-label="Security incidents table"
              removeWrapper
              classNames={{
                ...unifiedTableClassNames,
                table: `${unifiedTableClassNames.table} table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none`,
                th: `${unifiedTableClassNames.th} relative`,
                td: `${unifiedTableClassNames.td} overflow-hidden`,
              }}
            >
              <TableHeader>
                {(['incidentNumber', 'type', 'severity', 'location', 'status', 'assignedTo'] as IncidentSortKey[]).map((key) => (
                  <TableColumn key={key} className="relative" style={incidentColumns.style(key)}>
                    <SortLabel
                      active={incidentSort.key === key}
                      dir={incidentSort.dir}
                      onPress={() => setIncidentSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
                    >
                      {{ incidentNumber: 'Incident #', type: 'Type', severity: 'Severity', location: 'Location', status: 'Status', assignedTo: 'Assigned To' }[key]}
                    </SortLabel>
                    {incidentColumns.sizer(key, key)}
                  </TableColumn>
                ))}
              </TableHeader>
              <TableBody emptyContent="No incidents reported yet.">
                {sortRows(incidents, incidentSort, (row, key) => (key === 'assignedTo' ? row.assignedTo || 'Unassigned' : (row[key] as string) ?? '')).map((incident) => (
                  <TableRow key={incident.id} className={rowClassNames(viewingIncident?.id === incident.id)} onClick={() => setViewingIncident(incident)}>
                    <TableCell className="font-mono font-semibold">{incident.incidentNumber}</TableCell>
                    <TableCell>
                      <Badge color={incident.type === 'theft' ? 'danger' : incident.type === 'fire_alarm' ? 'warning' : incident.type === 'medical_emergency' ? 'primary' : 'default'} size="sm">
                        {incident.type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge color={incident.severity === 'critical' ? 'danger' : incident.severity === 'high' ? 'warning' : incident.severity === 'medium' ? 'secondary' : 'success'} size="sm">
                        {incident.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{incident.location}</TableCell>
                    <TableCell>
                      <Badge color={incident.status === 'resolved' ? 'success' : incident.status === 'investigating' ? 'warning' : incident.status === 'closed' ? 'default' : 'primary'} size="sm">
                        {incident.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{incident.assignedTo || 'Unassigned'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderVisitorManagement = () => (
    <div className="space-y-3">
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="px-3 py-2">
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <h3 className="min-w-0 text-sm font-semibold text-gray-800">👥 Visitor Management</h3>
            <Button size="sm" color="primary" className="bg-blue-500 text-white shrink-0" variant="flat" onClick={() => { setViewingVisitor(null); setIsVisitorModalOpen(true); }}>
              👤 Register Visitor
            </Button>
          </div>
        </CardHeader>
        <CardBody className="px-3 pt-0 pb-3">
          <div className="max-h-[560px] overflow-y-auto" ref={visitorColumns.frameRef} style={visitorColumns.frameStyle}>
            <Table
              aria-label="Visitors table"
              removeWrapper
              classNames={{
                ...unifiedTableClassNames,
                table: `${unifiedTableClassNames.table} table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none`,
                th: `${unifiedTableClassNames.th} relative`,
                td: `${unifiedTableClassNames.td} overflow-hidden`,
              }}
            >
              <TableHeader>
                {(['visitorNumber', 'name', 'purpose', 'hostName', 'checkInTime', 'status'] as VisitorSortKey[]).map((key) => (
                  <TableColumn key={key} className="relative" style={visitorColumns.style(key)}>
                    <SortLabel
                      active={visitorSort.key === key}
                      dir={visitorSort.dir}
                      onPress={() => setVisitorSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
                    >
                      {{ visitorNumber: 'Visitor #', name: 'Name', purpose: 'Purpose', hostName: 'Host', checkInTime: 'Check In', status: 'Status' }[key]}
                    </SortLabel>
                    {visitorColumns.sizer(key, key)}
                  </TableColumn>
                ))}
              </TableHeader>
              <TableBody emptyContent="No visitors registered yet.">
                {sortRows(visitors, visitorSort, (row, key) => {
                  if (key === 'checkInTime') return row.checkInTime.getTime();
                  if (key === 'hostName') return row.hostName || '';
                  return (row[key] as string) ?? '';
                }).map((visitor) => (
                  <TableRow key={visitor.id} className={rowClassNames(viewingVisitor?.id === visitor.id)} onClick={() => setViewingVisitor(visitor)}>
                    <TableCell className="font-mono font-semibold">{visitor.visitorNumber}</TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{visitor.name}</div>
                        <div className="text-sm text-gray-500 truncate">{visitor.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell className="truncate">{visitor.purpose}</TableCell>
                    <TableCell>{visitor.hostName || '-'}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{visitor.checkInTime.toLocaleDateString()}</div>
                        <div className="text-gray-500">{visitor.checkInTime.toLocaleTimeString()}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge color={visitor.status === 'checked_in' ? 'success' : visitor.status === 'checked_out' ? 'default' : 'warning'} size="sm">
                        {visitor.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderPatrolManagement = () => {
    const periodPatrols = patrols.filter((p) =>
      isInPeriod(p.startTime, deskPeriod.period, deskPeriod.todayISO),
    );
    const completedPatrols = periodPatrols.filter((p) => p.status === 'completed').length;
    let checkpointsCompleted = 0;
    let checkpointsTotal = 0;
    periodPatrols.forEach((p) => {
      checkpointsTotal += p.checkpoints.length;
      checkpointsCompleted += p.checkpoints.filter((c) => c.status === 'completed').length;
    });
    const complianceRate = checkpointsTotal > 0 ? (checkpointsCompleted / checkpointsTotal) * 100 : 0;
    const activePatrolsCount = patrols.filter((p) => p.status === 'active').length;

    return (
    <div className="space-y-3">
      {!summaryCollapsed && (
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <Card className="border border-gray-200 shadow-none">
          <CardBody className="px-2 py-1.5 text-center">
            <div className="text-base font-semibold tabular-nums text-blue-700">{activePatrolsCount}</div>
            <div className="text-xs leading-tight text-gray-500">Active Patrols</div>
          </CardBody>
        </Card>
        <Card className="border border-gray-200 shadow-none">
          <CardBody className="px-2 py-1.5 text-center">
            <div className="text-base font-semibold tabular-nums text-gray-900">{periodPatrols.length}</div>
            <div className="text-xs leading-tight text-gray-500">
              Patrols · {deskPeriod.label} · {completedPatrols} done
            </div>
          </CardBody>
        </Card>
        <Card className="border border-gray-200 shadow-none">
          <CardBody className="px-2 py-1.5 text-center">
            <div className="text-base font-semibold tabular-nums text-green-700">{complianceRate.toFixed(0)}%</div>
            <div className="text-xs leading-tight text-gray-500">Checkpoint Compliance</div>
          </CardBody>
        </Card>
      </div>
      )}

      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="px-3 py-2">
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <h3 className="min-w-0 text-sm font-semibold text-gray-800">🚶 Patrol Log</h3>
            {canManagePatrols && (
              <Button size="sm" color="primary" className="bg-ghana-green text-white shrink-0" variant="flat" onClick={openPatrolModal}>
                🚶 Start Patrol
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody className="px-3 pt-0 pb-3">
          <div className="max-h-[560px] overflow-y-auto" ref={patrolColumns.frameRef} style={patrolColumns.frameStyle}>
            <Table
              aria-label="Patrol log table"
              removeWrapper
              classNames={{
                ...unifiedTableClassNames,
                table: `${unifiedTableClassNames.table} table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none`,
                th: `${unifiedTableClassNames.th} relative`,
                td: `${unifiedTableClassNames.td} overflow-hidden`,
              }}
            >
              <TableHeader>
                {(['patrolNumber', 'officerName', 'route', 'startTime', 'checkpoints', 'status'] as PatrolSortKey[]).map((key) => (
                  <TableColumn key={key} className="relative" style={patrolColumns.style(key)}>
                    <SortLabel
                      active={patrolSort.key === key}
                      dir={patrolSort.dir}
                      onPress={() => setPatrolSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
                    >
                      {{ patrolNumber: 'Patrol #', officerName: 'Officer', route: 'Route', startTime: 'Started', checkpoints: 'Checkpoints', status: 'Status' }[key]}
                    </SortLabel>
                    {patrolColumns.sizer(key, key)}
                  </TableColumn>
                ))}
              </TableHeader>
              <TableBody emptyContent="No patrols logged yet.">
                {sortRows(patrols, patrolSort, (row, key) => {
                  if (key === 'startTime') return row.startTime.getTime();
                  if (key === 'checkpoints') return row.checkpoints.filter((c) => c.status !== 'pending').length;
                  return (row[key] as string) ?? '';
                }).map((patrol) => {
                  const logged = patrol.checkpoints.filter((c) => c.status !== 'pending').length;
                  return (
                    <TableRow key={patrol.id} className={rowClassNames(viewingPatrol?.id === patrol.id)} onClick={() => setViewingPatrol(patrol)}>
                      <TableCell className="font-mono font-semibold">{patrol.patrolNumber}</TableCell>
                      <TableCell>{patrol.officerName}</TableCell>
                      <TableCell>{patrol.route}</TableCell>
                      <TableCell>{patrol.startTime.toLocaleString()}</TableCell>
                      <TableCell>{logged}/{patrol.checkpoints.length}</TableCell>
                      <TableCell>
                        <Badge color={patrol.status === 'completed' ? 'success' : patrol.status === 'interrupted' ? 'danger' : 'primary'} size="sm">
                          {patrol.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
    );
  };

  const renderShiftLog = () => {
    const checkedInPeriod = shifts.filter((s) =>
      isInPeriod(s.checkInTime, deskPeriod.period, deskPeriod.todayISO),
    ).length;

    return (
    <div className="space-y-3">
      {!summaryCollapsed && (
      <div className="grid grid-cols-2 gap-2">
        <Card className="border border-gray-200 shadow-none">
          <CardBody className="px-2 py-1.5 text-center">
            <div className="text-base font-semibold tabular-nums text-blue-700">{onDutyShifts.length}</div>
            <div className="text-xs leading-tight text-gray-500">On Duty Now</div>
          </CardBody>
        </Card>
        <Card className="border border-gray-200 shadow-none">
          <CardBody className="px-2 py-1.5 text-center">
            <div className="text-base font-semibold tabular-nums text-gray-900">{checkedInPeriod}</div>
            <div className="text-xs leading-tight text-gray-500">Checked In · {deskPeriod.label}</div>
          </CardBody>
        </Card>
      </div>
      )}

      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="px-3 py-2">
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-800">🕒 Shift / Attendance Log</h3>
              <p className="text-xs text-gray-500 truncate">Who's on site now, and when everyone came and left.</p>
            </div>
            {canManageShifts && (
              <Button size="sm" color="primary" className="bg-ghana-green text-white shrink-0" variant="flat" onClick={() => setIsCheckInModalOpen(true)}>
                + Check In
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody className="px-3 pt-0 pb-3">
          <div ref={shiftColumns.frameRef} style={shiftColumns.frameStyle}>
          <Table
            aria-label="Shift log table"
            removeWrapper
            classNames={{
              ...unifiedTableClassNames,
              table: `${unifiedTableClassNames.table} table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none`,
              th: `${unifiedTableClassNames.th} relative`,
              td: `${unifiedTableClassNames.td} overflow-hidden`,
            }}
          >
            <TableHeader>
              {(['personName', 'checkInTime', 'checkOutTime', 'duration', 'status'] as ShiftSortKey[]).map((key) => (
                <TableColumn key={key} className="relative" style={shiftColumns.style(key)}>
                  <SortLabel
                    active={shiftSort.key === key}
                    dir={shiftSort.dir}
                    onPress={() => setShiftSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
                  >
                    {{ personName: 'Name', checkInTime: 'Checked In', checkOutTime: 'Checked Out', duration: 'Duration', status: 'Status' }[key]}
                  </SortLabel>
                  {shiftColumns.sizer(key, key)}
                </TableColumn>
              ))}
            </TableHeader>
            <TableBody emptyContent="No shifts logged yet.">
              {sortRows(shifts, shiftSort, (row, key) => {
                if (key === 'checkInTime') return row.checkInTime.getTime();
                if (key === 'checkOutTime') return row.checkOutTime ? row.checkOutTime.getTime() : Number.MAX_SAFE_INTEGER;
                if (key === 'duration') return (row.checkOutTime ?? new Date()).getTime() - row.checkInTime.getTime();
                return (row[key] as string) ?? '';
              }).map((s) => (
                <TableRow key={s.id} className={rowClassNames(viewingShift?.id === s.id)} onClick={() => setViewingShift(s)}>
                  <TableCell className="font-semibold">{s.personName}</TableCell>
                  <TableCell>{s.checkInTime.toLocaleString()}</TableCell>
                  <TableCell>{s.checkOutTime ? s.checkOutTime.toLocaleString() : '—'}</TableCell>
                  <TableCell>{formatShiftDuration(s.checkInTime, s.checkOutTime)}</TableCell>
                  <TableCell>
                    <Badge color={s.status === 'on_duty' ? 'success' : 'default'} size="sm">
                      {s.status === 'on_duty' ? 'on duty' : 'completed'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardBody>
      </Card>
    </div>
    );
  };

  const renderStaffManagement = () => (
    <div className="space-y-3">
      <DepartmentStaffTab
        departmentLabel="Security Operations"
        overtimePermissionId="security.log-overtime"
        departmentNameHints={['security']}
        helperText="HR staff in a Security department. Names come from the HR file — this tab does not invent staff. Contracted guards sit below and are not on payroll."
      />
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="px-3 py-2">
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-800">🧑‍✈️ Outsourced / Contracted Security Personnel</h3>
              <p className="hidden text-xs text-gray-500 truncate sm:block">Guards without a system login — not on payroll.</p>
            </div>
            {canManagePersonnel && (
              <Button size="sm" color="primary" className="bg-ghana-green text-white shrink-0" variant="flat" onClick={() => setIsPersonnelModalOpen(true)}>
                + Add Personnel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody className="px-3 pt-0 pb-3">
          <div ref={personnelColumns.frameRef} style={personnelColumns.frameStyle}>
          <Table
            aria-label="Security personnel table"
            removeWrapper
            classNames={{
              ...unifiedTableClassNames,
              table: `${unifiedTableClassNames.table} table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none`,
              th: `${unifiedTableClassNames.th} relative`,
              td: `${unifiedTableClassNames.td} overflow-hidden`,
            }}
          >
            <TableHeader>
              {(['name', 'agency', 'role', 'phone', 'status'] as PersonnelSortKey[]).map((key) => (
                <TableColumn key={key} className="relative" style={personnelColumns.style(key)}>
                  <SortLabel
                    active={personnelSort.key === key}
                    dir={personnelSort.dir}
                    onPress={() => setPersonnelSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
                  >
                    {{ name: 'Name', agency: 'Agency', role: 'Role', phone: 'Phone', status: 'Status' }[key]}
                  </SortLabel>
                  {personnelColumns.sizer(key, key)}
                </TableColumn>
              ))}
            </TableHeader>
            <TableBody emptyContent="No outsourced personnel on file yet.">
              {sortRows(personnel, personnelSort, (row, key) => {
                if (key === 'status') return row.isActive ? 'active' : 'inactive';
                return (row[key] as string) || '';
              }).map((p) => (
                <TableRow key={p.id} className={rowClassNames(viewingPersonnel?.id === p.id)} onClick={() => setViewingPersonnel(p)}>
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell>{p.agency || '—'}</TableCell>
                  <TableCell>{p.role || '—'}</TableCell>
                  <TableCell>{p.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge color={p.isActive ? 'success' : 'default'} size="sm">{p.isActive ? 'active' : 'inactive'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardBody>
      </Card>

      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="px-3 py-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800">📍 Checkpoint Locations</h3>
            <p className="text-xs text-gray-500">Reusable list so building a patrol route means choosing, not retyping.</p>
          </div>
        </CardHeader>
        <CardBody className="px-3 pt-0 pb-3">
          {canManageCheckpoints && (
            <div className="flex items-center gap-2 mb-4">
              <Input
                size="sm"
                placeholder="e.g. Main Entrance"
                value={newCheckpointName}
                onChange={(e) => setNewCheckpointName(e.target.value)}
                className="max-w-xs"
              />
              <Button size="sm" color="primary" variant="flat" onPress={submitCheckpointLocation} isDisabled={!newCheckpointName.trim()}>
                + Add Location
              </Button>
            </div>
          )}
          <div ref={checkpointColumns.frameRef} style={checkpointColumns.frameStyle}>
          <Table
            aria-label="Checkpoint locations table"
            removeWrapper
            classNames={{
              ...unifiedTableClassNames,
              table: `${unifiedTableClassNames.table} table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none`,
              th: `${unifiedTableClassNames.th} relative`,
              td: `${unifiedTableClassNames.td} overflow-hidden`,
            }}
          >
            <TableHeader>
              {(['name', 'status'] as NamedRefSortKey[]).map((key) => (
                <TableColumn key={key} className="relative" style={checkpointColumns.style(key)}>
                  <SortLabel
                    active={checkpointSort.key === key}
                    dir={checkpointSort.dir}
                    onPress={() => setCheckpointSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
                  >
                    {{ name: 'Location', status: 'Status' }[key]}
                  </SortLabel>
                  {checkpointColumns.sizer(key, key)}
                </TableColumn>
              ))}
            </TableHeader>
            <TableBody emptyContent="No checkpoint locations yet — they're also saved automatically the first time you type a new one on a patrol.">
              {sortRows(checkpointLocations, checkpointSort, (row, key) => (key === 'status' ? (row.isActive ? 'active' : 'inactive') : row.name)).map((loc) => (
                <TableRow key={loc.id} className={rowClassNames(viewingLocation?.id === loc.id)} onClick={() => setViewingLocation(loc)}>
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell>
                    <Badge color={loc.isActive ? 'success' : 'default'} size="sm">{loc.isActive ? 'active' : 'inactive'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardBody>
      </Card>

      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="px-3 py-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800">🗺️ Patrol Routes</h3>
            <p className="text-xs text-gray-500">Reusable list so starting a patrol means choosing a route, not retyping it.</p>
          </div>
        </CardHeader>
        <CardBody className="px-3 pt-0 pb-3">
          {canManageRoutes && (
            <div className="flex items-center gap-2 mb-4">
              <Input
                size="sm"
                placeholder="e.g. Main Building Perimeter"
                value={newRouteName}
                onChange={(e) => setNewRouteName(e.target.value)}
                className="max-w-xs"
              />
              <Button size="sm" color="primary" variant="flat" onPress={submitPatrolRoute} isDisabled={!newRouteName.trim()}>
                + Add Route
              </Button>
            </div>
          )}
          <div ref={routeColumns.frameRef} style={routeColumns.frameStyle}>
          <Table
            aria-label="Patrol routes table"
            removeWrapper
            classNames={{
              ...unifiedTableClassNames,
              table: `${unifiedTableClassNames.table} table-fixed w-[var(--col-table-width)] min-w-[var(--col-table-width)] max-w-none`,
              th: `${unifiedTableClassNames.th} relative`,
              td: `${unifiedTableClassNames.td} overflow-hidden`,
            }}
          >
            <TableHeader>
              {(['name', 'status'] as NamedRefSortKey[]).map((key) => (
                <TableColumn key={key} className="relative" style={routeColumns.style(key)}>
                  <SortLabel
                    active={routeSort.key === key}
                    dir={routeSort.dir}
                    onPress={() => setRouteSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
                  >
                    {{ name: 'Route', status: 'Status' }[key]}
                  </SortLabel>
                  {routeColumns.sizer(key, key)}
                </TableColumn>
              ))}
            </TableHeader>
            <TableBody emptyContent="No patrol routes yet — they're also saved automatically the first time you type a new one when starting a patrol.">
              {sortRows(patrolRoutes, routeSort, (row, key) => (key === 'status' ? (row.isActive ? 'active' : 'inactive') : row.name)).map((r) => (
                <TableRow key={r.id} className={rowClassNames(viewingRoute?.id === r.id)} onClick={() => setViewingRoute(r)}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge color={r.isActive ? 'success' : 'default'} size="sm">{r.isActive ? 'active' : 'inactive'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div>
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => {
              const next = key as string;
              setSelectedTab(next);
              onTabChange?.(next);
            }}
            className="w-full max-w-full"
            size="sm"
            variant="solid"
            classNames={deskBookTabsClassNames}
            aria-label="Security operations"
          >
            <Tab
              key="patrols"
              title={
                <>
                  <span className="sm:hidden">Patrols</span>
                  <span className="hidden sm:inline">Patrol Log</span>
                </>
              }
            />
            <Tab
              key="incidents"
              title={
                <>
                  <span className="sm:hidden">Incidents</span>
                  <span className="hidden sm:inline">Incident Management</span>
                </>
              }
            />
            <Tab
              key="visitors"
              title={
                <>
                  <span className="sm:hidden">Visitors</span>
                  <span className="hidden sm:inline">Visitor Management</span>
                </>
              }
            />
            <Tab
              key="shifts"
              title={
                <>
                  <span className="sm:hidden">Shifts</span>
                  <span className="hidden sm:inline">Shift Log</span>
                </>
              }
            />
            <Tab
              key="staff"
              title={
                <>
                  <span className="sm:hidden">Staff</span>
                  <span className="hidden sm:inline">Staff Management</span>
                </>
              }
            />
            <Tab
              key="reports"
              title={
                <>
                  <span className="sm:hidden">📈 Reports</span>
                  <span className="hidden sm:inline">📈 Reports & Analysis</span>
                </>
              }
            />
          </Tabs>

          <div className={deskBookTabPanelClassName}>
            {selectedTab === 'patrols' && renderPatrolManagement()}
            {selectedTab === 'incidents' && renderIncidentManagement()}
            {selectedTab === 'visitors' && renderVisitorManagement()}
            {selectedTab === 'shifts' && renderShiftLog()}
            {selectedTab === 'staff' && renderStaffManagement()}
            {selectedTab === 'reports' && <SecurityReportsAnalysis embedded />}
          </div>
        </CardBody>
      </Card>

      {/* Incident Modal */}
      <Modal isOpen={isIncidentModalOpen} onClose={() => setIsIncidentModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Report Security Incident</ModalHeader>
          <ModalBody className="gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select label="Type" selectedKeys={[incidentForm.type]} onSelectionChange={(k) => setIncidentForm(f => ({ ...f, type: Array.from(k as Set<string>)[0] as SecurityIncident['type'] }))}>
                <SelectItem key="theft">Theft</SelectItem>
                <SelectItem key="vandalism">Vandalism</SelectItem>
                <SelectItem key="trespassing">Trespassing</SelectItem>
                <SelectItem key="suspicious_activity">Suspicious activity</SelectItem>
                <SelectItem key="medical_emergency">Medical emergency</SelectItem>
                <SelectItem key="fire_alarm">Fire alarm</SelectItem>
                <SelectItem key="power_outage">Power outage</SelectItem>
                <SelectItem key="water_leak">Water leak</SelectItem>
                <SelectItem key="equipment_failure">Equipment failure</SelectItem>
                <SelectItem key="other">Other</SelectItem>
              </Select>
              <Select label="Severity" selectedKeys={[incidentForm.severity]} onSelectionChange={(k) => setIncidentForm(f => ({ ...f, severity: Array.from(k as Set<string>)[0] as SecurityIncident['severity'] }))}>
                <SelectItem key="low">Low</SelectItem>
                <SelectItem key="medium">Medium</SelectItem>
                <SelectItem key="high">High</SelectItem>
                <SelectItem key="critical">Critical</SelectItem>
              </Select>
            </div>
            <Input label="Location" placeholder="e.g. Main Lobby" value={incidentForm.location} onChange={(e) => setIncidentForm(f => ({ ...f, location: e.target.value }))} isRequired />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Floor" placeholder="Optional" value={incidentForm.floor} onChange={(e) => setIncidentForm(f => ({ ...f, floor: e.target.value }))} />
              <Input label="Room" placeholder="Optional" value={incidentForm.room} onChange={(e) => setIncidentForm(f => ({ ...f, room: e.target.value }))} />
            </div>
            <Textarea label="Description" placeholder="What happened?" value={incidentForm.description} onChange={(e) => setIncidentForm(f => ({ ...f, description: e.target.value }))} isRequired />
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsIncidentModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={submitIncident} isDisabled={!incidentForm.location.trim() || !incidentForm.description.trim()}>
              Report Incident
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Visitor Modal */}
      <Modal isOpen={isVisitorModalOpen} onClose={() => setIsVisitorModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Register New Visitor</ModalHeader>
          <ModalBody className="gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Full Name" value={visitorForm.name} onChange={(e) => setVisitorForm(f => ({ ...f, name: e.target.value }))} isRequired />
              <Input label="Phone" value={visitorForm.phone} onChange={(e) => setVisitorForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select label="ID Type" selectedKeys={[visitorForm.idType]} onSelectionChange={(k) => setVisitorForm(f => ({ ...f, idType: Array.from(k as Set<string>)[0] as any }))}>
                <SelectItem key="ghana-card">Ghana Card</SelectItem>
                <SelectItem key="passport">Passport</SelectItem>
                <SelectItem key="drivers-license">Driver's License</SelectItem>
                <SelectItem key="other">Other</SelectItem>
              </Select>
              <Input label="ID Number" value={visitorForm.idNumber} onChange={(e) => setVisitorForm(f => ({ ...f, idNumber: e.target.value }))} />
            </div>
            <Input label="Purpose of Visit" value={visitorForm.purpose} onChange={(e) => setVisitorForm(f => ({ ...f, purpose: e.target.value }))} isRequired />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Host Name" placeholder="Staff member or guest" value={visitorForm.hostName} onChange={(e) => setVisitorForm(f => ({ ...f, hostName: e.target.value }))} />
              <Input label="Host Room" placeholder="Optional" value={visitorForm.hostRoom} onChange={(e) => setVisitorForm(f => ({ ...f, hostRoom: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Vehicle Number" placeholder="Optional" value={visitorForm.vehicleNumber} onChange={(e) => setVisitorForm(f => ({ ...f, vehicleNumber: e.target.value }))} />
              <Select label="Escort Required" selectedKeys={[visitorForm.escortRequired]} onSelectionChange={(k) => setVisitorForm(f => ({ ...f, escortRequired: Array.from(k as Set<string>)[0] as string }))}>
                <SelectItem key="no">No</SelectItem>
                <SelectItem key="yes">Yes</SelectItem>
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsVisitorModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={submitVisitor} isDisabled={!visitorForm.name.trim() || !visitorForm.purpose.trim()}>
              Register Visitor
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Start Patrol Modal */}
      <Modal isOpen={isPatrolModalOpen} onClose={() => setIsPatrolModalOpen(false)} size="lg">
        <ModalContent>
          <ModalHeader>Start Security Patrol</ModalHeader>
          <ModalBody className="gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Officer"
                placeholder="Select officer"
                selectedKeys={patrolForm.officerKey ? [patrolForm.officerKey] : []}
                onSelectionChange={(keys) => setPatrolForm(f => ({ ...f, officerKey: (Array.from(keys)[0] as string) || '' }))}
                isRequired
              >
                <>
                  {[
                    ...securityStaff.map((s) => (
                      <SelectItem key={`staff:${s.id}`}>{s.name}</SelectItem>
                    )),
                    ...activePersonnel.map((p) => {
                      const label = p.agency ? `${p.name} — ${p.agency}` : `${p.name} (contracted)`;
                      return <SelectItem key={`person:${p.id}`}>{label}</SelectItem>;
                    }),
                  ]}
                </>
              </Select>
              <Autocomplete
                label="Route Name"
                placeholder="Choose or type a new route"
                inputValue={patrolForm.route}
                onInputChange={(value) => setPatrolForm(f => ({ ...f, route: value }))}
                onSelectionChange={(key) => { if (key) setPatrolForm(f => ({ ...f, route: String(key) })); }}
                allowsCustomValue
                isRequired
              >
                {activePatrolRoutes.map((r) => (
                  <AutocompleteItem key={r.name}>{r.name}</AutocompleteItem>
                ))}
              </Autocomplete>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Checkpoints</p>
                <Button size="sm" color="primary" variant="flat" onPress={addPatrolCheckpointRow}>+ Add Checkpoint</Button>
              </div>
              <div className="space-y-2">
                {patrolForm.checkpoints.map((cp, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Autocomplete
                      size="sm"
                      placeholder={`Checkpoint ${index + 1} — choose or type a new one`}
                      inputValue={cp}
                      onInputChange={(value) => updatePatrolCheckpointRow(index, value)}
                      onSelectionChange={(key) => { if (key) updatePatrolCheckpointRow(index, String(key)); }}
                      allowsCustomValue
                    >
                      {activeCheckpointLocations.map((loc) => (
                        <AutocompleteItem key={loc.name}>{loc.name}</AutocompleteItem>
                      ))}
                    </Autocomplete>
                    <Button
                      size="sm"
                      isIconOnly
                      color="danger"
                      variant="flat"
                      onPress={() => removePatrolCheckpointRow(index)}
                      isDisabled={patrolForm.checkpoints.length === 1}
                    >
                      🗑️
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsPatrolModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={submitPatrol} isDisabled={!patrolForm.officerKey || !patrolForm.route.trim() || !patrolForm.checkpoints.some(c => c.trim())}>
              Start Patrol
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Mark Checkpoint Missed Modal */}
      <Modal isOpen={!!missCheckpointTarget} onClose={closeMissCheckpoint} size="md">
        <ModalContent>
          <ModalHeader>Mark Checkpoint Missed</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600 mb-2">
              Mark <strong>{missCheckpointTarget?.location}</strong> as missed on this patrol?
            </p>
            <Textarea
              label="Reason"
              placeholder="Why was this checkpoint missed?"
              value={missReason}
              onChange={(e) => setMissReason(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeMissCheckpoint}>Cancel</Button>
            <Button color="danger" onPress={confirmMissCheckpoint}>Mark Missed</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Security Personnel Modal */}
      <Modal isOpen={isPersonnelModalOpen} onClose={() => setIsPersonnelModalOpen(false)} size="lg">
        <ModalContent>
          <ModalHeader>Add Security Personnel</ModalHeader>
          <ModalBody className="gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Full Name" value={personnelForm.name} onChange={(e) => setPersonnelForm(f => ({ ...f, name: e.target.value }))} isRequired />
              <Input label="Phone" placeholder="Optional" value={personnelForm.phone} onChange={(e) => setPersonnelForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Agency / Company"
                placeholder="Leave blank if independently contracted"
                value={personnelForm.agency}
                onChange={(e) => setPersonnelForm(f => ({ ...f, agency: e.target.value }))}
              />
              <Input label="Role" placeholder="e.g. Guard, Supervisor" value={personnelForm.role} onChange={(e) => setPersonnelForm(f => ({ ...f, role: e.target.value }))} />
            </div>
            <Textarea label="Notes" placeholder="Optional" value={personnelForm.notes} onChange={(e) => setPersonnelForm(f => ({ ...f, notes: e.target.value }))} />
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsPersonnelModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={submitPersonnel} isDisabled={!personnelForm.name.trim()}>Add Personnel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Shift Check-In Modal */}
      <Modal isOpen={isCheckInModalOpen} onClose={() => setIsCheckInModalOpen(false)} size="lg">
        <ModalContent>
          <ModalHeader>Check In</ModalHeader>
          <ModalBody className="gap-3">
            <Select
              label="Who's checking in?"
              placeholder="Select person"
              selectedKeys={checkInForm.personKey ? [checkInForm.personKey] : []}
              onSelectionChange={(keys) => setCheckInForm(f => ({ ...f, personKey: (Array.from(keys)[0] as string) || '' }))}
              isRequired
            >
              <>
                {[
                  ...securityStaff.filter((s) => !onDutyPersonKeys.has(`staff:${s.id}`)).map((s) => (
                    <SelectItem key={`staff:${s.id}`}>{s.name}</SelectItem>
                  )),
                  ...activePersonnel.filter((p) => !onDutyPersonKeys.has(`person:${p.id}`)).map((p) => {
                    const label = p.agency ? `${p.name} — ${p.agency}` : `${p.name} (contracted)`;
                    return <SelectItem key={`person:${p.id}`}>{label}</SelectItem>;
                  }),
                ]}
              </>
            </Select>
            <Textarea
              label="Notes"
              placeholder="Optional"
              value={checkInForm.notes}
              onChange={(e) => setCheckInForm(f => ({ ...f, notes: e.target.value }))}
            />
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsCheckInModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={submitCheckIn} isDisabled={!checkInForm.personKey}>Check In</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View / Edit Incident */}
      <Modal isOpen={!!openIncident} onClose={closeIncidentView} size="2xl">
        <ModalContent>
          <ModalHeader>{openIncident?.incidentNumber}{isEditingIncident ? ' — Edit' : ''}</ModalHeader>
          <ModalBody className="gap-4">
            {openIncident && !isEditingIncident && (
              <DetailGrid>
                <DetailField label="Type" value={openIncident.type.replace(/_/g, ' ')} />
                <DetailField label="Severity" value={
                  <Chip variant="flat" color={openIncident.severity === 'critical' ? 'danger' : openIncident.severity === 'high' ? 'warning' : openIncident.severity === 'medium' ? 'secondary' : 'success'} size="sm">{openIncident.severity}</Chip>
                } />
                <DetailField label="Status" value={
                  <Chip variant="flat" color={openIncident.status === 'resolved' ? 'success' : openIncident.status === 'investigating' ? 'warning' : openIncident.status === 'closed' ? 'default' : 'primary'} size="sm">{openIncident.status}</Chip>
                } />
                <DetailField label="Location" value={openIncident.location + (openIncident.room ? `, Room ${openIncident.room}` : '')} />
                <DetailField label="Reported by" value={`${openIncident.reportedBy} on ${openIncident.reportedAt.toLocaleString()}`} full />
                <DetailField label="Assigned to" value={openIncident.assignedTo} />
                <DetailField label="Description" value={openIncident.description} full />
                <DetailField label="Resolution" value={openIncident.resolution} full />
              </DetailGrid>
            )}
            {openIncident && isEditingIncident && incidentEditForm && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select label="Type" selectedKeys={[incidentEditForm.type]} onSelectionChange={(k) => setIncidentEditForm((f) => f && ({ ...f, type: Array.from(k as Set<string>)[0] as SecurityIncident['type'] }))}>
                    <SelectItem key="theft">Theft</SelectItem>
                    <SelectItem key="vandalism">Vandalism</SelectItem>
                    <SelectItem key="trespassing">Trespassing</SelectItem>
                    <SelectItem key="suspicious_activity">Suspicious activity</SelectItem>
                    <SelectItem key="medical_emergency">Medical emergency</SelectItem>
                    <SelectItem key="fire_alarm">Fire alarm</SelectItem>
                    <SelectItem key="power_outage">Power outage</SelectItem>
                    <SelectItem key="water_leak">Water leak</SelectItem>
                    <SelectItem key="equipment_failure">Equipment failure</SelectItem>
                    <SelectItem key="other">Other</SelectItem>
                  </Select>
                  <Select label="Severity" selectedKeys={[incidentEditForm.severity]} onSelectionChange={(k) => setIncidentEditForm((f) => f && ({ ...f, severity: Array.from(k as Set<string>)[0] as SecurityIncident['severity'] }))}>
                    <SelectItem key="low">Low</SelectItem>
                    <SelectItem key="medium">Medium</SelectItem>
                    <SelectItem key="high">High</SelectItem>
                    <SelectItem key="critical">Critical</SelectItem>
                  </Select>
                </div>
                <Select label="Status" selectedKeys={[incidentEditForm.status]} onSelectionChange={(k) => setIncidentEditForm((f) => f && ({ ...f, status: Array.from(k as Set<string>)[0] as SecurityIncident['status'] }))}>
                  <SelectItem key="reported">Reported</SelectItem>
                  <SelectItem key="investigating">Investigating</SelectItem>
                  <SelectItem key="resolved">Resolved</SelectItem>
                  <SelectItem key="closed">Closed</SelectItem>
                  <SelectItem key="escalated">Escalated</SelectItem>
                </Select>
                <Input label="Location" value={incidentEditForm.location} onChange={(e) => setIncidentEditForm((f) => f && ({ ...f, location: e.target.value }))} isRequired />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Floor" value={incidentEditForm.floor} onChange={(e) => setIncidentEditForm((f) => f && ({ ...f, floor: e.target.value }))} />
                  <Input label="Room" value={incidentEditForm.room} onChange={(e) => setIncidentEditForm((f) => f && ({ ...f, room: e.target.value }))} />
                </div>
                <Input label="Assigned To" placeholder="Optional" value={incidentEditForm.assignedTo} onChange={(e) => setIncidentEditForm((f) => f && ({ ...f, assignedTo: e.target.value }))} />
                <Textarea label="Description" value={incidentEditForm.description} onChange={(e) => setIncidentEditForm((f) => f && ({ ...f, description: e.target.value }))} isRequired />
                <Textarea label="Resolution" placeholder="Optional" value={incidentEditForm.resolution} onChange={(e) => setIncidentEditForm((f) => f && ({ ...f, resolution: e.target.value }))} />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            {!isEditingIncident && openIncident?.status === 'reported' && (
              <Button color="warning" variant="flat" onPress={() => assignIncident(openIncident.id, currentUserName)}>
                Assign to me
              </Button>
            )}
            {!isEditingIncident && openIncident?.status === 'investigating' && (
              <Button color="success" variant="flat" onPress={() => resolveIncident(openIncident.id, 'Resolved')}>
                Resolve
              </Button>
            )}
            {!isEditingIncident && openIncident && (
              <Button color="primary" variant="flat" onPress={startEditIncident}>Edit</Button>
            )}
            {isEditingIncident ? (
              <>
                <Button variant="light" onPress={() => setIsEditingIncident(false)}>Cancel</Button>
                <Button color="primary" onPress={saveEditIncident} isDisabled={!incidentEditForm?.location.trim() || !incidentEditForm?.description.trim()}>Save Changes</Button>
              </>
            ) : (
              <Button variant="light" onPress={closeIncidentView}>Close</Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View / Edit Visitor */}
      <Modal isOpen={!!openVisitor} onClose={closeVisitorView} size="2xl">
        <ModalContent>
          <ModalHeader>{openVisitor?.name}{isEditingVisitor ? ' — Edit' : ''}</ModalHeader>
          <ModalBody className="gap-4">
            {openVisitor && !isEditingVisitor && (
              <DetailGrid>
                <DetailField label="Visitor #" value={openVisitor.visitorNumber} />
                <DetailField label="Status" value={
                  <Chip variant="flat" color={openVisitor.status === 'checked_in' ? 'success' : openVisitor.status === 'checked_out' ? 'default' : 'warning'} size="sm">{openVisitor.status.replace('_', ' ')}</Chip>
                } />
                <DetailField label="Purpose" value={openVisitor.purpose} full />
                <DetailField label="Host" value={openVisitor.hostName ? `${openVisitor.hostName}${openVisitor.hostRoom ? ` (Room ${openVisitor.hostRoom})` : ''}` : undefined} />
                <DetailField label="Vehicle" value={openVisitor.vehicleNumber} />
                <DetailField label="Check-in" value={openVisitor.checkInTime.toLocaleString()} />
                <DetailField label="Check-out" value={openVisitor.checkOutTime?.toLocaleString()} />
                <DetailField label="ID" value={openVisitor.idType ? `${openVisitor.idType} ${openVisitor.idNumber || ''}`.trim() : undefined} />
              </DetailGrid>
            )}
            {openVisitor && isEditingVisitor && visitorEditForm && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Full Name" value={visitorEditForm.name} onChange={(e) => setVisitorEditForm((f) => f && ({ ...f, name: e.target.value }))} isRequired />
                  <Input label="Phone" value={visitorEditForm.phone} onChange={(e) => setVisitorEditForm((f) => f && ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select label="ID Type" selectedKeys={[visitorEditForm.idType]} onSelectionChange={(k) => setVisitorEditForm((f) => f && ({ ...f, idType: Array.from(k as Set<string>)[0] as any }))}>
                    <SelectItem key="ghana-card">Ghana Card</SelectItem>
                    <SelectItem key="passport">Passport</SelectItem>
                    <SelectItem key="drivers-license">Driver's License</SelectItem>
                    <SelectItem key="other">Other</SelectItem>
                  </Select>
                  <Input label="ID Number" value={visitorEditForm.idNumber} onChange={(e) => setVisitorEditForm((f) => f && ({ ...f, idNumber: e.target.value }))} />
                </div>
                <Input label="Purpose of Visit" value={visitorEditForm.purpose} onChange={(e) => setVisitorEditForm((f) => f && ({ ...f, purpose: e.target.value }))} isRequired />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Host Name" placeholder="Optional" value={visitorEditForm.hostName} onChange={(e) => setVisitorEditForm((f) => f && ({ ...f, hostName: e.target.value }))} />
                  <Input label="Host Room" placeholder="Optional" value={visitorEditForm.hostRoom} onChange={(e) => setVisitorEditForm((f) => f && ({ ...f, hostRoom: e.target.value }))} />
                </div>
                <Input label="Vehicle Number" placeholder="Optional" value={visitorEditForm.vehicleNumber} onChange={(e) => setVisitorEditForm((f) => f && ({ ...f, vehicleNumber: e.target.value }))} />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            {!isEditingVisitor && openVisitor?.status === 'checked_in' && (
              <Button color="success" variant="flat" onPress={() => checkOutVisitor(openVisitor.id)}>
                Check Out
              </Button>
            )}
            {!isEditingVisitor && openVisitor && (
              <Button color="primary" variant="flat" onPress={startEditVisitor}>Edit</Button>
            )}
            {isEditingVisitor ? (
              <>
                <Button variant="light" onPress={() => setIsEditingVisitor(false)}>Cancel</Button>
                <Button color="primary" onPress={saveEditVisitor} isDisabled={!visitorEditForm?.name.trim() || !visitorEditForm?.purpose.trim()}>Save Changes</Button>
              </>
            ) : (
              <Button variant="light" onPress={closeVisitorView}>Close</Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View / Edit Patrol */}
      <Modal isOpen={!!openPatrol} onClose={closePatrolView} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{openPatrol ? `${openPatrol.patrolNumber} — ${openPatrol.route}` : 'Patrol'}{isEditingPatrol ? ' — Edit' : ''}</ModalHeader>
          <ModalBody className="gap-4">
            {openPatrol && !isEditingPatrol && (
              <>
                <DetailGrid>
                  <DetailField label="Officer" value={openPatrol.officerName} />
                  <DetailField label="Status" value={
                    <Chip variant="flat" color={openPatrol.status === 'completed' ? 'success' : openPatrol.status === 'interrupted' ? 'danger' : 'primary'} size="sm">{openPatrol.status}</Chip>
                  } />
                  <DetailField label="Started" value={openPatrol.startTime.toLocaleString()} />
                  <DetailField label="Ended" value={openPatrol.endTime?.toLocaleString()} />
                  <DetailField label="Notes" value={openPatrol.notes} full />
                </DetailGrid>
                <div className="space-y-1.5">
                  {openPatrol.checkpoints.map((cp) => (
                    <div key={cp.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ghana-black truncate">{cp.location}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {cp.status === 'completed' && cp.actualTime
                            ? `Checked ${cp.actualTime.toLocaleTimeString()}`
                            : cp.status === 'missed'
                              ? (cp.notes || 'Missed — no reason given')
                              : `Scheduled ${cp.scheduledTime.toLocaleTimeString()}`}
                        </div>
                      </div>
                      {openPatrol.status === 'active' && cp.status === 'pending' && canManagePatrols ? (
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" isIconOnly color="success" variant="flat" title="Mark checked" onClick={() => completeCheckpoint(openPatrol.id, cp.id)}>
                            ✓
                          </Button>
                          <Button
                            size="sm"
                            isIconOnly
                            color="danger"
                            variant="flat"
                            title="Mark missed"
                            onClick={() => setMissCheckpointTarget({ patrolId: openPatrol.id, checkpointId: cp.id, location: cp.location })}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <Badge color={cp.status === 'completed' ? 'success' : cp.status === 'missed' ? 'danger' : 'default'} size="sm" className="shrink-0">
                          {cp.status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {openPatrol && isEditingPatrol && patrolEditForm && (
              <>
                <Input label="Route Name" value={patrolEditForm.route} onChange={(e) => setPatrolEditForm((f) => f && ({ ...f, route: e.target.value }))} isRequired />
                <Textarea label="Notes" placeholder="Optional" value={patrolEditForm.notes} onChange={(e) => setPatrolEditForm((f) => f && ({ ...f, notes: e.target.value }))} />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            {!isEditingPatrol && openPatrol?.status === 'active' && canManagePatrols && (
              <Button color="success" variant="flat" onPress={() => endPatrol(openPatrol.id)}>
                End Patrol
              </Button>
            )}
            {!isEditingPatrol && openPatrol && canManagePatrols && (
              <Button color="primary" variant="flat" onPress={startEditPatrol}>Edit</Button>
            )}
            {isEditingPatrol ? (
              <>
                <Button variant="light" onPress={() => setIsEditingPatrol(false)}>Cancel</Button>
                <Button color="primary" onPress={saveEditPatrol} isDisabled={!patrolEditForm?.route.trim()}>Save Changes</Button>
              </>
            ) : (
              <Button variant="light" onPress={closePatrolView}>Close</Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View / Edit Shift */}
      <Modal isOpen={!!openShift} onClose={closeShiftView} size="lg">
        <ModalContent>
          <ModalHeader>{openShift?.personName}{isEditingShift ? ' — Edit' : ''}</ModalHeader>
          <ModalBody className="gap-4">
            {openShift && !isEditingShift && (
              <DetailGrid>
                <DetailField label="Status" value={
                  <Chip variant="flat" color={openShift.status === 'on_duty' ? 'success' : 'default'} size="sm">{openShift.status === 'on_duty' ? 'on duty' : 'completed'}</Chip>
                } />
                <DetailField label="Duration" value={formatShiftDuration(openShift.checkInTime, openShift.checkOutTime)} />
                <DetailField label="Checked in" value={openShift.checkInTime.toLocaleString()} />
                <DetailField label="Checked out" value={openShift.checkOutTime?.toLocaleString()} />
                <DetailField label="Notes" value={openShift.notes} full />
              </DetailGrid>
            )}
            {openShift && isEditingShift && shiftEditForm && (
              <Textarea label="Notes" placeholder="Optional" value={shiftEditForm.notes} onChange={(e) => setShiftEditForm({ notes: e.target.value })} />
            )}
          </ModalBody>
          <ModalFooter>
            {!isEditingShift && openShift?.status === 'on_duty' && canManageShifts && (
              <Button color="danger" variant="flat" onPress={() => checkOut(openShift.id)}>
                Check Out
              </Button>
            )}
            {!isEditingShift && openShift && canManageShifts && (
              <Button color="primary" variant="flat" onPress={startEditShift}>Edit</Button>
            )}
            {isEditingShift ? (
              <>
                <Button variant="light" onPress={() => setIsEditingShift(false)}>Cancel</Button>
                <Button color="primary" onPress={saveEditShift}>Save Changes</Button>
              </>
            ) : (
              <Button variant="light" onPress={closeShiftView}>Close</Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View / Edit personnel */}
      <Modal isOpen={!!openPersonnel} onClose={closePersonnelView} size="lg">
        <ModalContent>
          <ModalHeader>{openPersonnel?.name}{isEditingPersonnel ? ' — Edit' : ''}</ModalHeader>
          <ModalBody className="gap-4">
            {openPersonnel && !isEditingPersonnel && (
              <DetailGrid>
                <DetailField label="Status" value={
                  <Chip variant="flat" color={openPersonnel.isActive ? 'success' : 'default'} size="sm">{openPersonnel.isActive ? 'active' : 'inactive'}</Chip>
                } />
                <DetailField label="Role" value={openPersonnel.role} />
                <DetailField label="Agency" value={openPersonnel.agency} />
                <DetailField label="Phone" value={openPersonnel.phone} />
                <DetailField label="Notes" value={openPersonnel.notes} full />
              </DetailGrid>
            )}
            {openPersonnel && isEditingPersonnel && personnelEditForm && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Full Name" value={personnelEditForm.name} onChange={(e) => setPersonnelEditForm((f) => f && ({ ...f, name: e.target.value }))} isRequired />
                  <Input label="Phone" placeholder="Optional" value={personnelEditForm.phone} onChange={(e) => setPersonnelEditForm((f) => f && ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Agency / Company" placeholder="Leave blank if independently contracted" value={personnelEditForm.agency} onChange={(e) => setPersonnelEditForm((f) => f && ({ ...f, agency: e.target.value }))} />
                  <Input label="Role" placeholder="e.g. Guard, Supervisor" value={personnelEditForm.role} onChange={(e) => setPersonnelEditForm((f) => f && ({ ...f, role: e.target.value }))} />
                </div>
                <Textarea label="Notes" placeholder="Optional" value={personnelEditForm.notes} onChange={(e) => setPersonnelEditForm((f) => f && ({ ...f, notes: e.target.value }))} />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            {!isEditingPersonnel && openPersonnel && canManagePersonnel && (
              <Button
                color={openPersonnel.isActive ? 'danger' : 'success'}
                variant="flat"
                onPress={() => setPersonnelActive(openPersonnel.id, !openPersonnel.isActive)}
              >
                {openPersonnel.isActive ? 'Deactivate' : 'Reactivate'}
              </Button>
            )}
            {!isEditingPersonnel && openPersonnel && canManagePersonnel && (
              <Button color="primary" variant="flat" onPress={startEditPersonnel}>Edit</Button>
            )}
            {isEditingPersonnel ? (
              <>
                <Button variant="light" onPress={() => setIsEditingPersonnel(false)}>Cancel</Button>
                <Button color="primary" onPress={saveEditPersonnel} isDisabled={!personnelEditForm?.name.trim()}>Save Changes</Button>
              </>
            ) : (
              <Button variant="light" onPress={closePersonnelView}>Close</Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View checkpoint location */}
      <Modal isOpen={!!openLocation} onClose={() => setViewingLocation(null)} size="md">
        <ModalContent>
          <ModalHeader>{openLocation?.name}</ModalHeader>
          <ModalBody>
            {openLocation && (
              <DetailGrid>
                <DetailField label="Status" value={
                  <Chip variant="flat" color={openLocation.isActive ? 'success' : 'default'} size="sm">{openLocation.isActive ? 'active' : 'inactive'}</Chip>
                } />
              </DetailGrid>
            )}
          </ModalBody>
          <ModalFooter>
            {openLocation && canManageCheckpoints && (
              <Button
                color={openLocation.isActive ? 'danger' : 'success'}
                variant="flat"
                onPress={() => setCheckpointLocationActive(openLocation.id, !openLocation.isActive)}
              >
                {openLocation.isActive ? 'Deactivate' : 'Reactivate'}
              </Button>
            )}
            <Button variant="light" onPress={() => setViewingLocation(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View patrol route */}
      <Modal isOpen={!!openRoute} onClose={() => setViewingRoute(null)} size="md">
        <ModalContent>
          <ModalHeader>{openRoute?.name}</ModalHeader>
          <ModalBody>
            {openRoute && (
              <DetailGrid>
                <DetailField label="Status" value={
                  <Chip variant="flat" color={openRoute.isActive ? 'success' : 'default'} size="sm">{openRoute.isActive ? 'active' : 'inactive'}</Chip>
                } />
              </DetailGrid>
            )}
          </ModalBody>
          <ModalFooter>
            {openRoute && canManageRoutes && (
              <Button
                color={openRoute.isActive ? 'danger' : 'success'}
                variant="flat"
                onPress={() => setPatrolRouteActive(openRoute.id, !openRoute.isActive)}
              >
                {openRoute.isActive ? 'Deactivate' : 'Reactivate'}
              </Button>
            )}
            <Button variant="light" onPress={() => setViewingRoute(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
