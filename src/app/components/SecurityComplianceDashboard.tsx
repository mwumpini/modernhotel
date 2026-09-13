'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Tabs, Tab, Avatar, Input, Select, SelectItem, Textarea,
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
import { SecurityIncident, Visitor } from '../lib/security/models';
import { getClientTenantSubdomain } from '../lib/api/clientTenant';

function securityHeaders(): HeadersInit {
  return { 'x-tenant-subdomain': getClientTenantSubdomain() };
}

export default function SecurityComplianceDashboard() {
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

  const [selectedTab, setSelectedTab] = useState('overview');
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);
  const [isPatrolModalOpen, setIsPatrolModalOpen] = useState(false);
  const [viewingIncident, setViewingIncident] = useState<SecurityIncident | null>(null);
  const [viewingVisitor, setViewingVisitor] = useState<Visitor | null>(null);

  const { incidents, hydrateFromApi: hydrateIncidents, addIncident, assignIncident, resolveIncident } = useIncidentStore();
  const { visitors, hydrateFromApi: hydrateVisitors, addVisitor, checkOutVisitor } = useVisitorStore();
  const { patrols, hydrateFromApi: hydratePatrols, startPatrol, endPatrol, completeCheckpoint, missCheckpoint, getPatrolAnalytics } = usePatrolStore();
  const { personnel, hydrateFromApi: hydratePersonnel, addPersonnel, setPersonnelActive } = usePersonnelStore();
  const { locations: checkpointLocations, hydrateFromApi: hydrateCheckpointLocations, addLocation: addCheckpointLocation, setLocationActive: setCheckpointLocationActive } = useCheckpointLocationStore();
  const { routes: patrolRoutes, hydrateFromApi: hydratePatrolRoutes, addRoute: addPatrolRoute, setRouteActive: setPatrolRouteActive } = usePatrolRouteStore();
  const { shifts, hydrateFromApi: hydrateShifts, checkIn, checkOut } = useShiftStore();

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

  const totalIncidents = incidents.length;
  const openIncidents = incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length;
  const criticalIncidents = incidents.filter(i => i.severity === 'critical' && !['resolved', 'closed'].includes(i.status)).length;
  const currentVisitors = visitors.filter(v => v.status === 'checked_in').length;

  const submitIncident = () => {
    if (!incidentForm.location.trim() || !incidentForm.description.trim()) return;
    addIncident({
      incidentNumber: `INC-${Date.now().toString().slice(-6)}`,
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

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Incidents</p>
                <p className="text-2xl font-bold text-ghana-black">{totalIncidents}</p>
                <p className="text-sm text-orange-600">{openIncidents} open</p>
              </div>
              <div className="text-3xl">🚨</div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical Issues</p>
                <p className="text-2xl font-bold text-red-600">{criticalIncidents}</p>
                <p className="text-sm text-red-600">Requires immediate attention</p>
              </div>
              <div className="text-3xl">⚠️</div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Visitors</p>
                <p className="text-2xl font-bold text-ghana-black">{currentVisitors}</p>
                <p className="text-sm text-blue-600">On premises</p>
              </div>
              <div className="text-3xl">👥</div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🚀 Quick Actions</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button
              variant="flat"
              className="bg-red-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => { setViewingIncident(null); setIsIncidentModalOpen(true); }}
            >
              <span className="text-2xl">🚨</span>
              <span className="text-sm font-medium">Report Incident</span>
            </Button>
            <Button
              variant="flat"
              className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => { setViewingVisitor(null); setIsVisitorModalOpen(true); }}
            >
              <span className="text-2xl">👤</span>
              <span className="text-sm font-medium">Register Visitor</span>
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-green text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={openPatrolModal}
              isDisabled={!canManagePatrols}
            >
              <span className="text-2xl">🚶</span>
              <span className="text-sm font-medium">Start Patrol</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <h3 className="text-xl font-semibold text-ghana-black">🚨 Recent Security Incidents</h3>
          </CardHeader>
          <CardBody>
            {incidents.length === 0 && <p className="text-sm text-gray-500 py-4 text-center">No incidents reported.</p>}
            <div className="space-y-3">
              {incidents.slice(0, 3).map((incident) => (
                <div key={incident.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`h-3 w-3 rounded-full ${
                      incident.severity === 'critical' ? 'bg-red-500' :
                      incident.severity === 'high' ? 'bg-orange-500' :
                      incident.severity === 'medium' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}></div>
                    <div>
                      <div className="font-medium">{incident.incidentNumber}</div>
                      <div className="text-sm text-gray-600">
                        {incident.type.replace('_', ' ')} • {incident.location}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      color={
                        incident.status === 'resolved' ? 'success' :
                        incident.status === 'investigating' ? 'warning' :
                        'default'
                      }
                      size="sm"
                    >
                      {incident.status}
                    </Badge>
                    <Button size="sm" variant="flat" color="primary" onClick={() => setViewingIncident(incident)}>
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <h3 className="text-xl font-semibold text-ghana-black">👥 Current Visitors</h3>
          </CardHeader>
          <CardBody>
            {currentVisitors === 0 && <p className="text-sm text-gray-500 py-4 text-center">No visitors on premises.</p>}
            <div className="space-y-3">
              {visitors.filter(v => v.status === 'checked_in').slice(0, 3).map((visitor) => (
                <div key={visitor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar name={visitor.name} size="sm" className="bg-blue-500 text-white" />
                    <div>
                      <div className="font-medium">{visitor.name}</div>
                      <div className="text-sm text-gray-600">
                        {visitor.purpose}{visitor.hostName ? ` • Host: ${visitor.hostName}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      In: {visitor.checkInTime.toLocaleTimeString()}
                    </div>
                    <Button size="sm" variant="flat" color="success" onClick={() => checkOutVisitor(visitor.id)}>
                      Check Out
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );

  const renderIncidentManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">🚨 Security Incident Management</h3>
            <Button color="primary" className="bg-red-500 text-white" variant="flat" onClick={() => { setViewingIncident(null); setIsIncidentModalOpen(true); }}>
              🚨 Report Incident
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="max-h-[560px] overflow-y-auto">
            <Table aria-label="Security incidents table">
              <TableHeader>
                <TableColumn>Incident #</TableColumn>
                <TableColumn>Type</TableColumn>
                <TableColumn>Severity</TableColumn>
                <TableColumn>Location</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Assigned To</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No incidents reported yet.">
                {incidents.map((incident) => (
                  <TableRow key={incident.id}>
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
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="flat" color="primary" onClick={() => setViewingIncident(incident)}>
                          View
                        </Button>
                        {incident.status === 'reported' && (
                          <Button size="sm" variant="flat" color="warning" onClick={() => assignIncident(incident.id, currentUserName)}>
                            Assign to me
                          </Button>
                        )}
                        {incident.status === 'investigating' && (
                          <Button size="sm" variant="flat" color="success" onClick={() => resolveIncident(incident.id, 'Resolved')}>
                            Resolve
                          </Button>
                        )}
                      </div>
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

  const renderVisitorManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">👥 Visitor Management</h3>
            <Button color="primary" className="bg-blue-500 text-white" variant="flat" onClick={() => { setViewingVisitor(null); setIsVisitorModalOpen(true); }}>
              👤 Register Visitor
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="max-h-[560px] overflow-y-auto">
            <Table aria-label="Visitors table">
              <TableHeader>
                <TableColumn>Visitor #</TableColumn>
                <TableColumn>Name</TableColumn>
                <TableColumn>Purpose</TableColumn>
                <TableColumn>Host</TableColumn>
                <TableColumn>Check In</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No visitors registered yet.">
                {visitors.map((visitor) => (
                  <TableRow key={visitor.id}>
                    <TableCell className="font-mono font-semibold">{visitor.visitorNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar name={visitor.name} size="sm" className="bg-blue-500 text-white" />
                        <div>
                          <div className="font-semibold">{visitor.name}</div>
                          <div className="text-sm text-gray-500">{visitor.phone}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{visitor.purpose}</TableCell>
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
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="flat" color="primary" onClick={() => setViewingVisitor(visitor)}>
                          View
                        </Button>
                        {visitor.status === 'checked_in' && (
                          <Button size="sm" variant="flat" color="success" onClick={() => checkOutVisitor(visitor.id)}>
                            Check Out
                          </Button>
                        )}
                      </div>
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
    const todayAnalytics = getPatrolAnalytics('daily');
    const activePatrolsCount = patrols.filter(p => p.status === 'active').length;

    return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Patrols</p>
                <p className="text-2xl font-bold text-ghana-black">{activePatrolsCount}</p>
                <p className="text-sm text-blue-600">In progress now</p>
              </div>
              <div className="text-3xl">🚶</div>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Patrols Today</p>
                <p className="text-2xl font-bold text-ghana-black">{todayAnalytics.totalPatrols}</p>
                <p className="text-sm text-green-600">{todayAnalytics.completedPatrols} completed</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Checkpoint Compliance</p>
                <p className="text-2xl font-bold text-ghana-green">{todayAnalytics.complianceRate.toFixed(0)}%</p>
                <p className="text-sm text-gray-500">Today</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">🚶 Patrol Log</h3>
            {canManagePatrols && (
              <Button color="primary" className="bg-ghana-green text-white" variant="flat" onClick={openPatrolModal}>
                🚶 Start Patrol
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {patrols.length === 0 && <p className="text-sm text-gray-500 py-4 text-center">No patrols logged yet.</p>}
          <div className="space-y-4 max-h-[640px] overflow-y-auto">
            {patrols.map((patrol) => {
              const checkedCount = patrol.checkpoints.filter(c => c.status !== 'pending').length;
              return (
              <Card key={patrol.id} className="border border-gray-200">
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold">{patrol.patrolNumber} — {patrol.route}</div>
                      <div className="text-sm text-gray-500">
                        {patrol.officerName} • Started {patrol.startTime.toLocaleString()}
                        {patrol.endTime ? ` • Ended ${patrol.endTime.toLocaleString()}` : ''}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {checkedCount}/{patrol.checkpoints.length} checkpoints logged
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={patrol.status === 'completed' ? 'success' : patrol.status === 'interrupted' ? 'danger' : 'primary'} size="sm">
                        {patrol.status}
                      </Badge>
                      {patrol.status === 'active' && canManagePatrols && (
                        <Button size="sm" variant="flat" color="success" onClick={() => endPatrol(patrol.id)}>
                          End Patrol
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {patrol.checkpoints.map((cp) => (
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
                        {patrol.status === 'active' && cp.status === 'pending' && canManagePatrols ? (
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" isIconOnly color="success" variant="flat" title="Mark checked" onClick={() => completeCheckpoint(patrol.id, cp.id)}>
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              isIconOnly
                              color="danger"
                              variant="flat"
                              title="Mark missed"
                              onClick={() => setMissCheckpointTarget({ patrolId: patrol.id, checkpointId: cp.id, location: cp.location })}
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
                </CardBody>
              </Card>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
    );
  };

  const renderShiftLog = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkedInToday = shifts.filter((s) => s.checkInTime >= today).length;

    return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">On Duty Now</p>
                <p className="text-2xl font-bold text-ghana-black">{onDutyShifts.length}</p>
                <p className="text-sm text-blue-600">Currently on site</p>
              </div>
              <div className="text-3xl">🟢</div>
            </div>
          </CardBody>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Checked In Today</p>
                <p className="text-2xl font-bold text-ghana-black">{checkedInToday}</p>
                <p className="text-sm text-gray-500">Since midnight</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="text-xl font-semibold text-ghana-black">🕒 Shift / Attendance Log</h3>
              <p className="text-sm text-gray-500">Who's on site now, and when everyone came and left — real staff and outsourced personnel alike.</p>
            </div>
            {canManageShifts && (
              <Button color="primary" className="bg-ghana-green text-white" variant="flat" onClick={() => setIsCheckInModalOpen(true)}>
                + Check In
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Shift log table">
            <TableHeader>
              <TableColumn>Name</TableColumn>
              <TableColumn>Checked In</TableColumn>
              <TableColumn>Checked Out</TableColumn>
              <TableColumn>Duration</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No shifts logged yet.">
              {shifts.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold">{s.personName}</TableCell>
                  <TableCell>{s.checkInTime.toLocaleString()}</TableCell>
                  <TableCell>{s.checkOutTime ? s.checkOutTime.toLocaleString() : '—'}</TableCell>
                  <TableCell>{formatShiftDuration(s.checkInTime, s.checkOutTime)}</TableCell>
                  <TableCell>
                    <Badge color={s.status === 'on_duty' ? 'success' : 'default'} size="sm">
                      {s.status === 'on_duty' ? 'on duty' : 'completed'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.status === 'on_duty' && canManageShifts && (
                      <Button size="sm" variant="flat" color="danger" onClick={() => checkOut(s.id)}>
                        Check Out
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
    );
  };

  const renderStaffManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="text-xl font-semibold text-ghana-black">🧑‍✈️ Outsourced / Contracted Security Personnel</h3>
              <p className="text-sm text-gray-500">Guards without a system login. Real staff accounts already show up automatically when picking a patrol officer.</p>
            </div>
            {canManagePersonnel && (
              <Button color="primary" className="bg-ghana-green text-white" variant="flat" onClick={() => setIsPersonnelModalOpen(true)}>
                + Add Personnel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Security personnel table">
            <TableHeader>
              <TableColumn>Name</TableColumn>
              <TableColumn>Agency</TableColumn>
              <TableColumn>Role</TableColumn>
              <TableColumn>Phone</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No outsourced personnel on file yet.">
              {personnel.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell>{p.agency || '—'}</TableCell>
                  <TableCell>{p.role || '—'}</TableCell>
                  <TableCell>{p.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge color={p.isActive ? 'success' : 'default'} size="sm">{p.isActive ? 'active' : 'inactive'}</Badge>
                  </TableCell>
                  <TableCell>
                    {canManagePersonnel && (
                      <Button size="sm" variant="flat" color={p.isActive ? 'danger' : 'success'} onClick={() => setPersonnelActive(p.id, !p.isActive)}>
                        {p.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div>
            <h3 className="text-xl font-semibold text-ghana-black">📍 Checkpoint Locations</h3>
            <p className="text-sm text-gray-500">A reusable list so building a patrol route means choosing, not retyping.</p>
          </div>
        </CardHeader>
        <CardBody>
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
          <Table aria-label="Checkpoint locations table">
            <TableHeader>
              <TableColumn>Location</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No checkpoint locations yet — they're also saved automatically the first time you type a new one on a patrol.">
              {checkpointLocations.map((loc) => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell>
                    <Badge color={loc.isActive ? 'success' : 'default'} size="sm">{loc.isActive ? 'active' : 'inactive'}</Badge>
                  </TableCell>
                  <TableCell>
                    {canManageCheckpoints && (
                      <Button size="sm" variant="flat" color={loc.isActive ? 'danger' : 'success'} onClick={() => setCheckpointLocationActive(loc.id, !loc.isActive)}>
                        {loc.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div>
            <h3 className="text-xl font-semibold text-ghana-black">🗺️ Patrol Routes</h3>
            <p className="text-sm text-gray-500">A reusable list so starting a patrol means choosing a route, not retyping it.</p>
          </div>
        </CardHeader>
        <CardBody>
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
          <Table aria-label="Patrol routes table">
            <TableHeader>
              <TableColumn>Route</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No patrol routes yet — they're also saved automatically the first time you type a new one when starting a patrol.">
              {patrolRoutes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge color={r.isActive ? 'success' : 'default'} size="sm">{r.isActive ? 'active' : 'inactive'}</Badge>
                  </TableCell>
                  <TableCell>
                    {canManageRoutes && (
                      <Button size="sm" variant="flat" color={r.isActive ? 'danger' : 'success'} onClick={() => setPatrolRouteActive(r.id, !r.isActive)}>
                        {r.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🚨 Security Operations Management</h1>
          <p className="text-gray-600">Incidents, visitors, and patrols</p>
        </div>
      </div>

      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="Overview" />
        <Tab key="incidents" title="Incident Management" />
        <Tab key="visitors" title="Visitor Management" />
        <Tab key="patrols" title="Patrol Log" />
        <Tab key="shifts" title="Shift Log" />
        <Tab key="staff" title="Staff Management" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'incidents' && renderIncidentManagement()}
        {selectedTab === 'visitors' && renderVisitorManagement()}
        {selectedTab === 'patrols' && renderPatrolManagement()}
        {selectedTab === 'shifts' && renderShiftLog()}
        {selectedTab === 'staff' && renderStaffManagement()}
      </div>

      {/* Incident Modal */}
      <Modal isOpen={isIncidentModalOpen} onClose={() => setIsIncidentModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Report Security Incident</ModalHeader>
          <ModalBody className="gap-3">
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full Name" value={visitorForm.name} onChange={(e) => setVisitorForm(f => ({ ...f, name: e.target.value }))} isRequired />
              <Input label="Phone" value={visitorForm.phone} onChange={(e) => setVisitorForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="ID Type" selectedKeys={[visitorForm.idType]} onSelectionChange={(k) => setVisitorForm(f => ({ ...f, idType: Array.from(k as Set<string>)[0] as any }))}>
                <SelectItem key="ghana-card">Ghana Card</SelectItem>
                <SelectItem key="passport">Passport</SelectItem>
                <SelectItem key="drivers-license">Driver's License</SelectItem>
                <SelectItem key="other">Other</SelectItem>
              </Select>
              <Input label="ID Number" value={visitorForm.idNumber} onChange={(e) => setVisitorForm(f => ({ ...f, idNumber: e.target.value }))} />
            </div>
            <Input label="Purpose of Visit" value={visitorForm.purpose} onChange={(e) => setVisitorForm(f => ({ ...f, purpose: e.target.value }))} isRequired />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Host Name" placeholder="Staff member or guest" value={visitorForm.hostName} onChange={(e) => setVisitorForm(f => ({ ...f, hostName: e.target.value }))} />
              <Input label="Host Room" placeholder="Optional" value={visitorForm.hostRoom} onChange={(e) => setVisitorForm(f => ({ ...f, hostRoom: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full Name" value={personnelForm.name} onChange={(e) => setPersonnelForm(f => ({ ...f, name: e.target.value }))} isRequired />
              <Input label="Phone" placeholder="Optional" value={personnelForm.phone} onChange={(e) => setPersonnelForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
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

      {/* View Incident */}
      <Modal isOpen={!!viewingIncident} onClose={() => setViewingIncident(null)} size="2xl">
        <ModalContent>
          <ModalHeader>{viewingIncident?.incidentNumber}</ModalHeader>
          <ModalBody className="gap-2 pb-6">
            {viewingIncident && (
              <>
                <p><strong>Type:</strong> {viewingIncident.type.replace('_', ' ')}</p>
                <p><strong>Severity:</strong> {viewingIncident.severity}</p>
                <p><strong>Status:</strong> {viewingIncident.status}</p>
                <p><strong>Location:</strong> {viewingIncident.location}{viewingIncident.room ? `, Room ${viewingIncident.room}` : ''}</p>
                <p><strong>Reported by:</strong> {viewingIncident.reportedBy} on {viewingIncident.reportedAt.toLocaleString()}</p>
                {viewingIncident.assignedTo && <p><strong>Assigned to:</strong> {viewingIncident.assignedTo}</p>}
                <p><strong>Description:</strong> {viewingIncident.description}</p>
                {viewingIncident.resolution && <p><strong>Resolution:</strong> {viewingIncident.resolution}</p>}
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* View Visitor */}
      <Modal isOpen={!!viewingVisitor} onClose={() => setViewingVisitor(null)} size="2xl">
        <ModalContent>
          <ModalHeader>{viewingVisitor?.name}</ModalHeader>
          <ModalBody className="gap-2 pb-6">
            {viewingVisitor && (
              <>
                <p><strong>Visitor #:</strong> {viewingVisitor.visitorNumber}</p>
                <p><strong>Purpose:</strong> {viewingVisitor.purpose}</p>
                {viewingVisitor.hostName && <p><strong>Host:</strong> {viewingVisitor.hostName}{viewingVisitor.hostRoom ? ` (Room ${viewingVisitor.hostRoom})` : ''}</p>}
                <p><strong>Check-in:</strong> {viewingVisitor.checkInTime.toLocaleString()}</p>
                {viewingVisitor.checkOutTime && <p><strong>Check-out:</strong> {viewingVisitor.checkOutTime.toLocaleString()}</p>}
                <p><strong>Status:</strong> {viewingVisitor.status.replace('_', ' ')}</p>
                {viewingVisitor.idType && <p><strong>ID:</strong> {viewingVisitor.idType} {viewingVisitor.idNumber}</p>}
                {viewingVisitor.vehicleNumber && <p><strong>Vehicle:</strong> {viewingVisitor.vehicleNumber}</p>}
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
