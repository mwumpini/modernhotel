'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, Tabs, Tab, Avatar, Input, Select, SelectItem, Textarea
} from '@heroui/react';
import { useSession } from 'next-auth/react';
import { trackEvent } from '../lib/analytics/trackEvent';
import { useIncidentStore } from '../lib/security/incidentStore';
import { useVisitorStore } from '../lib/security/visitorStore';
import { usePatrolStore } from '../lib/security/patrolStore';
import { useComplianceStore } from '../lib/security/complianceStore';
import { SecurityIncident, Visitor, ComplianceRequirement } from '../lib/security/models';

const DEFAULT_COMPLIANCE_REQUIREMENTS: Array<Omit<ComplianceRequirement, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    title: 'Fire Extinguisher & Suppression System Inspection',
    category: 'fire_safety',
    frequency: 'monthly',
    nextDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
    responsiblePerson: 'Security Supervisor',
    penaltyAmount: 50000,
    notes: 'Fine up to ₵50,000; business closure for serious violations.',
  },
  {
    title: 'Kitchen Hygiene & Food Handling Audit',
    category: 'health_hygiene',
    frequency: 'monthly',
    nextDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
    responsiblePerson: 'Kitchen Manager',
    penaltyAmount: 100000,
    notes: 'Fine up to ₵100,000; kitchen closure; legal action.',
  },
  {
    title: 'Employee Contract & SSNIT Compliance',
    category: 'employment',
    frequency: 'quarterly',
    nextDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
    responsiblePerson: 'HR Manager',
    penaltyAmount: 200000,
    notes: 'Fine up to ₵200,000; legal action; business license suspension.',
  },
];

const nextDueDateFor = (frequency: ComplianceRequirement['frequency'], from: Date): Date => {
  const d = new Date(from);
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (frequency === 'annually') d.setFullYear(d.getFullYear() + 1);
  return d;
};

export default function SecurityComplianceDashboard() {
  const { data: session } = useSession();
  const currentUserName = session?.user?.name || 'User';

  const [selectedTab, setSelectedTab] = useState('overview');
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);
  const [isPatrolModalOpen, setIsPatrolModalOpen] = useState(false);
  const [viewingIncident, setViewingIncident] = useState<SecurityIncident | null>(null);
  const [viewingVisitor, setViewingVisitor] = useState<Visitor | null>(null);

  const { incidents, hydrateFromApi: hydrateIncidents, addIncident, assignIncident, resolveIncident } = useIncidentStore();
  const { visitors, hydrateFromApi: hydrateVisitors, addVisitor, checkOutVisitor } = useVisitorStore();
  const { patrols, hydrateFromApi: hydratePatrols, startPatrol, endPatrol, completeCheckpoint } = usePatrolStore();
  const { requirements, hydrateFromApi: hydrateCompliance, addRequirement, markCompleted } = useComplianceStore();

  useEffect(() => {
    hydrateIncidents();
    hydrateVisitors();
    hydratePatrols();
    hydrateCompliance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seed the standard Ghana compliance register once, if the tenant has none yet.
  const seededRef = React.useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (requirements.length > 0) { seededRef.current = true; return; }
    const timer = setTimeout(() => {
      if (requirements.length === 0 && !seededRef.current) {
        seededRef.current = true;
        DEFAULT_COMPLIANCE_REQUIREMENTS.forEach((r) => addRequirement(r));
      }
    }, 1500); // give hydrateFromApi a chance to resolve first
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirements.length]);

  const [incidentForm, setIncidentForm] = useState({
    type: 'suspicious_activity' as SecurityIncident['type'],
    severity: 'medium' as SecurityIncident['severity'],
    location: '', floor: '', room: '', description: '',
  });

  const [visitorForm, setVisitorForm] = useState({
    name: '', phone: '', idType: 'ghana-card' as NonNullable<Visitor['idType']>, idNumber: '',
    purpose: '', hostName: '', hostRoom: '', vehicleNumber: '', escortRequired: 'no',
  });

  const [patrolForm, setPatrolForm] = useState({ route: '', checkpoints: '' });

  const totalIncidents = incidents.length;
  const openIncidents = incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length;
  const criticalIncidents = incidents.filter(i => i.severity === 'critical' && !['resolved', 'closed'].includes(i.status)).length;
  const currentVisitors = visitors.filter(v => v.status === 'checked_in').length;
  const now = new Date();
  const compliantCount = requirements.filter(r => r.nextDueDate >= now).length;
  const complianceScore = requirements.length > 0 ? (compliantCount / requirements.length) * 100 : 100;

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
    const checkpointNames = patrolForm.checkpoints.split(',').map(s => s.trim()).filter(Boolean);
    if (!route || checkpointNames.length === 0) return;
    const now = new Date();
    startPatrol({
      officerName: currentUserName,
      route,
      checkpoints: checkpointNames.map(location => ({ location, scheduledTime: now })),
    });
    trackEvent('SECURITY.PatrolStarted', { route, checkpoints: checkpointNames.length });
    setPatrolForm({ route: '', checkpoints: '' });
    setIsPatrolModalOpen(false);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliance Score</p>
                <p className="text-2xl font-bold text-ghana-green">{complianceScore.toFixed(0)}%</p>
                <p className="text-sm text-green-600">Regulatory compliance</p>
              </div>
              <div className="text-3xl">✅</div>
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
              onClick={() => setIsPatrolModalOpen(true)}
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

  const renderPatrolManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">🚶 Patrol Log</h3>
            <Button color="primary" className="bg-ghana-green text-white" variant="flat" onClick={() => setIsPatrolModalOpen(true)}>
              🚶 Start Patrol
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {patrols.length === 0 && <p className="text-sm text-gray-500 py-4 text-center">No patrols logged yet.</p>}
          <div className="space-y-4 max-h-[560px] overflow-y-auto">
            {patrols.map((patrol) => (
              <Card key={patrol.id} className="border border-gray-200">
                <CardBody>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold">{patrol.patrolNumber} — {patrol.route}</div>
                      <div className="text-sm text-gray-500">
                        {patrol.officerName} • Started {patrol.startTime.toLocaleString()}
                        {patrol.endTime ? ` • Ended ${patrol.endTime.toLocaleString()}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={patrol.status === 'completed' ? 'success' : patrol.status === 'interrupted' ? 'danger' : 'primary'} size="sm">
                        {patrol.status}
                      </Badge>
                      {patrol.status === 'active' && (
                        <Button size="sm" variant="flat" color="success" onClick={() => endPatrol(patrol.id)}>
                          End Patrol
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {patrol.checkpoints.map((cp) => (
                      <Chip
                        key={cp.id}
                        size="sm"
                        variant="flat"
                        color={cp.status === 'completed' ? 'success' : cp.status === 'missed' ? 'danger' : 'default'}
                        className={patrol.status === 'active' && cp.status === 'pending' ? 'cursor-pointer' : ''}
                        onClick={() => {
                          if (patrol.status !== 'active' || cp.status !== 'pending') return;
                          completeCheckpoint(patrol.id, cp.id);
                        }}
                      >
                        {cp.location}{cp.status === 'pending' && patrol.status === 'active' ? ' (tap to check)' : ''}
                      </Chip>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderComplianceMonitoring = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">⚖️ Ghana Regulatory Compliance</h3>
        </CardHeader>
        <CardBody>
          <div className="max-h-[560px] overflow-y-auto">
            <Table aria-label="Compliance requirements table">
              <TableHeader>
                <TableColumn>Category</TableColumn>
                <TableColumn>Requirement</TableColumn>
                <TableColumn>Frequency</TableColumn>
                <TableColumn>Last Completed</TableColumn>
                <TableColumn>Next Due</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No compliance requirements on file.">
                {requirements.map((requirement) => {
                  const overdue = requirement.nextDueDate < now;
                  return (
                    <TableRow key={requirement.id}>
                      <TableCell>
                        <Chip color={requirement.category === 'fire_safety' ? 'danger' : requirement.category === 'health_hygiene' ? 'warning' : requirement.category === 'employment' ? 'primary' : 'default'} size="sm" variant="flat">
                          {requirement.category.replace('_', ' ')}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-semibold">{requirement.title}</div>
                          {requirement.responsiblePerson && <div className="text-sm text-gray-500">Owner: {requirement.responsiblePerson}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge color="primary" size="sm">{requirement.frequency}</Badge>
                      </TableCell>
                      <TableCell>{requirement.lastCompletedAt ? requirement.lastCompletedAt.toLocaleDateString() : 'Never'}</TableCell>
                      <TableCell>
                        <div className={`font-semibold ${overdue ? 'text-red-600' : 'text-green-600'}`}>
                          {requirement.nextDueDate.toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge color={overdue ? 'danger' : 'success'} size="sm">
                          {overdue ? 'overdue' : 'compliant'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onClick={() => markCompleted(requirement.id, nextDueDateFor(requirement.frequency, new Date()))}
                        >
                          Mark Reviewed
                        </Button>
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🚨 Security & Compliance Management</h1>
          <p className="text-gray-600">Security operations with Ghana regulatory compliance</p>
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
        <Tab key="compliance" title="Compliance Monitoring" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'incidents' && renderIncidentManagement()}
        {selectedTab === 'visitors' && renderVisitorManagement()}
        {selectedTab === 'patrols' && renderPatrolManagement()}
        {selectedTab === 'compliance' && renderComplianceMonitoring()}
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
            <Input label="Route Name" placeholder="e.g. Main Building Perimeter" value={patrolForm.route} onChange={(e) => setPatrolForm(f => ({ ...f, route: e.target.value }))} isRequired />
            <Textarea
              label="Checkpoints"
              placeholder="Comma-separated, e.g. Main Entrance, Loading Dock, Parking Lot A"
              value={patrolForm.checkpoints}
              onChange={(e) => setPatrolForm(f => ({ ...f, checkpoints: e.target.value }))}
              isRequired
            />
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsPatrolModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={submitPatrol} isDisabled={!patrolForm.route.trim() || !patrolForm.checkpoints.trim()}>
              Start Patrol
            </Button>
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
