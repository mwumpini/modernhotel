'use client';

import React, { useState } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip,
  Tabs, Tab, Progress, Avatar
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';

interface SecurityIncident {
  id: string;
  incidentNumber: string;
  type: 'theft' | 'fire' | 'medical' | 'security-breach' | 'suspicious-activity' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  reportedBy: string;
  reportedAt: string;
  description: string;
  status: 'reported' | 'investigating' | 'resolved' | 'closed';
  assignedTo?: string;
  resolution?: string;
  resolvedAt?: string;
  policeReport?: string;
  insuranceClaim?: string;
}

interface Visitor {
  id: string;
  visitorId: string;
  name: string;
  phone: string;
  idType: 'ghana-card' | 'passport' | 'driver-license' | 'other';
  idNumber: string;
  purpose: string;
  hostEmployee: string;
  checkInTime: string;
  checkOutTime?: string;
  status: 'checked-in' | 'checked-out' | 'expired';
  photo?: string;
  vehicleNumber?: string;
  notes?: string;
}

interface SecurityCheck {
  id: string;
  location: string;
  type: 'patrol' | 'inspection' | 'emergency-response';
  officer: string;
  startTime: string;
  endTime?: string;
  status: 'in-progress' | 'completed' | 'cancelled';
  findings: string[];
  issues: string[];
  recommendations: string[];
  photos?: string[];
}

interface ComplianceRequirement {
  id: string;
  category: 'fire-safety' | 'food-safety' | 'labor-law' | 'tax-compliance' | 'data-protection' | 'environmental';
  requirement: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  lastChecked: string;
  nextDue: string;
  status: 'compliant' | 'non-compliant' | 'pending-review';
  responsiblePerson: string;
  documentation: string[];
  penalties: string[];
}

interface SecurityTraining {
  id: string;
  title: string;
  type: 'fire-safety' | 'first-aid' | 'security-protocol' | 'compliance' | 'emergency-response';
  instructor: string;
  scheduledDate: string;
  duration: number; // hours
  maxParticipants: number;
  currentParticipants: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  materials: string[];
  certification: boolean;
}

export default function SecurityComplianceDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<SecurityCheck | null>(null);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  
  const settings = useSettingsStore();

  // Sample data - in real app, this would come from stores
  const securityIncidents: SecurityIncident[] = [
    {
      id: '1',
      incidentNumber: 'INC-2024-001',
      type: 'suspicious-activity',
      severity: 'medium',
      location: 'Main Lobby',
      reportedBy: 'Front Desk Staff',
      reportedAt: '2024-01-16T14:30:00Z',
      description: 'Suspicious person loitering in lobby area, refusing to leave when asked',
      status: 'investigating',
      assignedTo: 'Security Officer Kwame',
      resolution: 'Person was escorted out by security, no further issues',
      resolvedAt: '2024-01-16T15:15:00Z'
    },
    {
      id: '2',
      incidentNumber: 'INC-2024-002',
      type: 'medical',
      severity: 'high',
      location: 'Restaurant',
      reportedBy: 'Restaurant Manager',
      reportedAt: '2024-01-16T18:45:00Z',
      description: 'Guest collapsed in restaurant, appears to be having a heart attack',
      status: 'resolved',
      assignedTo: 'Security Team',
      resolution: 'Ambulance called, guest transported to hospital, condition stable',
      resolvedAt: '2024-01-16T19:30:00Z'
    }
  ];

  const visitors: Visitor[] = [
    {
      id: '1',
      visitorId: 'VIS-001',
      name: 'John Smith',
      phone: '+1 555-123-4567',
      idType: 'passport',
      idNumber: 'US123456789',
      purpose: 'Business meeting with General Manager',
      hostEmployee: 'General Manager',
      checkInTime: '2024-01-16T09:00:00Z',
      status: 'checked-in'
    },
    {
      id: '2',
      visitorId: 'VIS-002',
      name: 'Ama Osei',
      phone: '+233 24 987 6543',
      idType: 'ghana-card',
      idNumber: 'GHA-123456789-0',
      purpose: 'Job interview for Housekeeping position',
      hostEmployee: 'HR Manager',
      checkInTime: '2024-01-16T10:30:00Z',
      checkOutTime: '2024-01-16T12:00:00Z',
      status: 'checked-out'
    }
  ];

  const securityChecks: SecurityCheck[] = [
    {
      id: '1',
      location: 'Perimeter Fence',
      type: 'patrol',
      officer: 'Security Officer Kwame',
      startTime: '2024-01-16T06:00:00Z',
      endTime: '2024-01-16T06:45:00Z',
      status: 'completed',
      findings: ['All gates secure', 'No suspicious activity', 'Lighting working properly'],
      issues: ['Minor damage to fence near parking area'],
      recommendations: ['Schedule fence repair', 'Increase lighting in parking area']
    },
    {
      id: '2',
      location: 'Kitchen Area',
      type: 'inspection',
      officer: 'Security Supervisor Ama',
      startTime: '2024-01-16T14:00:00Z',
      status: 'in-progress',
      findings: ['Fire extinguishers in place', 'Emergency exits clear'],
      issues: ['Fire suppression system needs maintenance'],
      recommendations: ['Schedule fire system inspection', 'Update emergency contact list']
    }
  ];

  const complianceRequirements: ComplianceRequirement[] = [
    {
      id: '1',
      category: 'fire-safety',
      requirement: 'Fire Extinguisher Inspection',
      description: 'Monthly inspection of all fire extinguishers and fire suppression systems',
      frequency: 'monthly',
      lastChecked: '2024-01-01',
      nextDue: '2024-02-01',
      status: 'compliant',
      responsiblePerson: 'Security Supervisor Ama',
      documentation: ['Inspection checklist', 'Maintenance records', 'Certification documents'],
      penalties: ['Fine up to ₵50,000', 'Business closure for serious violations']
    },
    {
      id: '2',
      category: 'food-safety',
      requirement: 'Kitchen Hygiene Audit',
      description: 'Weekly inspection of kitchen cleanliness and food handling practices',
      frequency: 'weekly',
      lastChecked: '2024-01-15',
      nextDue: '2024-01-22',
      status: 'compliant',
      responsiblePerson: 'Kitchen Manager Kofi',
      documentation: ['Hygiene checklist', 'Staff training records', 'Health certificates'],
      penalties: ['Fine up to ₵100,000', 'Kitchen closure', 'Legal action']
    },
    {
      id: '3',
      category: 'labor-law',
      requirement: 'Employee Contract Compliance',
      description: 'Ensure all employees have valid contracts and required documentation',
      frequency: 'monthly',
      lastChecked: '2024-01-01',
      nextDue: '2024-02-01',
      status: 'pending-review',
      responsiblePerson: 'HR Manager',
      documentation: ['Employment contracts', 'SSNIT records', 'Tax documentation'],
      penalties: ['Fine up to ₵200,000', 'Legal action', 'Business license suspension']
    }
  ];

  const securityTraining: SecurityTraining[] = [
    {
      id: '1',
      title: 'Fire Safety & Emergency Response',
      type: 'fire-safety',
      instructor: 'Fire Safety Officer',
      scheduledDate: '2024-01-25T09:00:00Z',
      duration: 4,
      maxParticipants: 30,
      currentParticipants: 25,
      status: 'scheduled',
      materials: ['Fire safety manual', 'Emergency procedures', 'Evacuation maps'],
      certification: true
    },
    {
      id: '2',
      title: 'First Aid & CPR Training',
      type: 'first-aid',
      instructor: 'Certified First Aid Instructor',
      scheduledDate: '2024-01-30T10:00:00Z',
      duration: 6,
      maxParticipants: 20,
      currentParticipants: 18,
      status: 'scheduled',
      materials: ['First aid manual', 'CPR practice equipment', 'Emergency response guide'],
      certification: true
    }
  ];

  // Calculate security metrics
  const totalIncidents = securityIncidents.length;
  const openIncidents = securityIncidents.filter(i => i.status !== 'closed').length;
  const criticalIncidents = securityIncidents.filter(i => i.severity === 'critical').length;
  const currentVisitors = visitors.filter(v => v.status === 'checked-in').length;
  const complianceScore = (complianceRequirements.filter(r => r.status === 'compliant').length / complianceRequirements.length) * 100;
  const upcomingTraining = securityTraining.filter(t => t.status === 'scheduled').length;

  const handleIncidentStatusUpdate = (incidentId: string, status: SecurityIncident['status']) => {
    trackEvent('SECURITY.IncidentStatusChanged', { incidentId, status });
    // In real app, update the incident status in the store
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Security Summary */}
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

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🚀 Quick Actions</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="flat"
              className="bg-red-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsIncidentModalOpen(true)}
            >
              <span className="text-2xl">🚨</span>
              <span className="text-sm font-medium">Report Incident</span>
            </Button>
            <Button
              variant="flat"
              className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsVisitorModalOpen(true)}
            >
              <span className="text-2xl">👤</span>
              <span className="text-sm font-medium">Register Visitor</span>
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-green text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsCheckModalOpen(true)}
            >
              <span className="text-2xl">🔍</span>
              <span className="text-sm font-medium">Security Check</span>
            </Button>
            <Button
              variant="flat"
              className="bg-purple-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📋</span>
              <span className="text-sm font-medium">Compliance Audit</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Incidents */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <h3 className="text-xl font-semibold text-ghana-black">🚨 Recent Security Incidents</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {securityIncidents.slice(0, 3).map((incident) => (
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
                        {incident.type} • {incident.location}
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
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      onClick={() => {
                        setSelectedIncident(incident);
                        setIsIncidentModalOpen(true);
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Current Visitors */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <h3 className="text-xl font-semibold text-ghana-black">👥 Current Visitors</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {visitors.filter(v => v.status === 'checked-in').slice(0, 3).map((visitor) => (
                <div key={visitor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar 
                      name={visitor.name} 
                      size="sm"
                      className="bg-blue-500 text-white"
                    />
                    <div>
                      <div className="font-medium">{visitor.name}</div>
                      <div className="text-sm text-gray-600">
                        {visitor.purpose} • Host: {visitor.hostEmployee}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      Checked in: {new Date(visitor.checkInTime).toLocaleTimeString()}
                    </div>
                    <Button
                      size="sm"
                      variant="flat"
                      color="success"
                      onClick={() => {
                        setSelectedVisitor(visitor);
                        setIsVisitorModalOpen(true);
                      }}
                    >
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
            <Button
              color="primary"
              className="bg-red-500 text-white"
              variant="flat"
              onClick={() => setIsIncidentModalOpen(true)}
            >
              🚨 Report Incident
            </Button>
          </div>
        </CardHeader>
        <CardBody>
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
            <TableBody>
              {securityIncidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell className="font-mono font-semibold">{incident.incidentNumber}</TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        incident.type === 'theft' ? 'danger' :
                        incident.type === 'fire' ? 'warning' :
                        incident.type === 'medical' ? 'primary' :
                        incident.type === 'security-breach' ? 'danger' :
                        'default'
                      } 
                      size="sm"
                    >
                      {incident.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        incident.severity === 'critical' ? 'danger' :
                        incident.severity === 'high' ? 'warning' :
                        incident.severity === 'medium' ? 'secondary' :
                        'success'
                      } 
                      size="sm"
                    >
                      {incident.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{incident.location}</TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        incident.status === 'resolved' ? 'success' :
                        incident.status === 'investigating' ? 'warning' :
                        incident.status === 'closed' ? 'default' :
                        'primary'
                      } 
                      size="sm"
                    >
                      {incident.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{incident.assignedTo || 'Unassigned'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary" onClick={() => {
                        setSelectedIncident(incident);
                        setIsIncidentModalOpen(true);
                      }}>
                        View
                      </Button>
                      {incident.status === 'reported' && (
                        <Button size="sm" variant="flat" color="warning">
                          Assign
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
            <Button
              color="primary"
              className="bg-blue-500 text-white"
              variant="flat"
              onClick={() => setIsVisitorModalOpen(true)}
            >
              👤 Register Visitor
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Visitors table">
            <TableHeader>
              <TableColumn>Visitor ID</TableColumn>
              <TableColumn>Name</TableColumn>
              <TableColumn>Purpose</TableColumn>
              <TableColumn>Host</TableColumn>
              <TableColumn>Check In</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {visitors.map((visitor) => (
                <TableRow key={visitor.id}>
                  <TableCell className="font-mono font-semibold">{visitor.visitorId}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar 
                        name={visitor.name} 
                        size="sm"
                        className="bg-blue-500 text-white"
                      />
                      <div>
                        <div className="font-semibold">{visitor.name}</div>
                        <div className="text-sm text-gray-500">{visitor.phone}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{visitor.purpose}</TableCell>
                  <TableCell>{visitor.hostEmployee}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{new Date(visitor.checkInTime).toLocaleDateString()}</div>
                      <div className="text-gray-500">{new Date(visitor.checkInTime).toLocaleTimeString()}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        visitor.status === 'checked-in' ? 'success' :
                        visitor.status === 'checked-out' ? 'default' :
                        'warning'
                      } 
                      size="sm"
                    >
                      {visitor.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary" onClick={() => {
                        setSelectedVisitor(visitor);
                        setIsVisitorModalOpen(true);
                      }}>
                        View
                      </Button>
                      {visitor.status === 'checked-in' && (
                        <Button size="sm" variant="flat" color="success">
                          Check Out
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderComplianceMonitoring = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">⚖️ Compliance Monitoring</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Compliance requirements table">
            <TableHeader>
              <TableColumn>Category</TableColumn>
              <TableColumn>Requirement</TableColumn>
              <TableColumn>Frequency</TableColumn>
              <TableColumn>Last Checked</TableColumn>
              <TableColumn>Next Due</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {complianceRequirements.map((requirement) => (
                <TableRow key={requirement.id}>
                  <TableCell>
                    <Chip 
                      color={
                        requirement.category === 'fire-safety' ? 'danger' :
                        requirement.category === 'food-safety' ? 'warning' :
                        requirement.category === 'labor-law' ? 'primary' :
                        requirement.category === 'tax-compliance' ? 'secondary' :
                        'default'
                      } 
                      size="sm" 
                      variant="flat"
                    >
                      {requirement.category}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{requirement.requirement}</div>
                      <div className="text-sm text-gray-500 max-w-xs truncate">{requirement.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge color="primary" size="sm">
                      {requirement.frequency}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(requirement.lastChecked).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className={`font-semibold ${
                      new Date(requirement.nextDue) < new Date() ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {new Date(requirement.nextDue).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        requirement.status === 'compliant' ? 'success' :
                        requirement.status === 'non-compliant' ? 'danger' :
                        'warning'
                      } 
                      size="sm"
                    >
                      {requirement.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        Review
                      </Button>
                      <Button size="sm" variant="flat" color="secondary">
                        Documents
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderSecurityTraining = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📚 Security Training & Certification</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Security training table">
            <TableHeader>
              <TableColumn>Training</TableColumn>
              <TableColumn>Type</TableColumn>
              <TableColumn>Instructor</TableColumn>
              <TableColumn>Date</TableColumn>
              <TableColumn>Duration</TableColumn>
              <TableColumn>Participants</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {securityTraining.map((training) => (
                <TableRow key={training.id}>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{training.title}</div>
                      <div className="text-sm text-gray-500">
                        {training.certification ? '📜 Certification Available' : 'No certification'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        training.type === 'fire-safety' ? 'danger' :
                        training.type === 'first-aid' ? 'primary' :
                        training.type === 'security-protocol' ? 'warning' :
                        training.type === 'compliance' ? 'secondary' :
                        'default'
                      } 
                      size="sm"
                    >
                      {training.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{training.instructor}</TableCell>
                  <TableCell>{new Date(training.scheduledDate).toLocaleDateString()}</TableCell>
                  <TableCell>{training.duration} hours</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{training.currentParticipants}/{training.maxParticipants}</div>
                      <Progress 
                        value={(training.currentParticipants / training.maxParticipants) * 100} 
                        size="sm"
                        className="mt-1"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        training.status === 'completed' ? 'success' :
                        training.status === 'in-progress' ? 'warning' :
                        training.status === 'cancelled' ? 'danger' :
                        'primary'
                      } 
                      size="sm"
                    >
                      {training.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        View
                      </Button>
                      {training.status === 'scheduled' && (
                        <Button size="sm" variant="flat" color="success">
                          Register
                        </Button>
                      )}
                    </div>
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
          <h1 className="text-3xl font-bold text-ghana-black">🚨 Security & Compliance Management</h1>
          <p className="text-gray-600">Complete security operations with Ghana regulatory compliance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">SaaS Ready</Badge>
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
        <Tab key="compliance" title="Compliance Monitoring" />
        <Tab key="training" title="Security Training" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'incidents' && renderIncidentManagement()}
        {selectedTab === 'visitors' && renderVisitorManagement()}
        {selectedTab === 'compliance' && renderComplianceMonitoring()}
        {selectedTab === 'training' && renderSecurityTraining()}
      </div>

      {/* Incident Modal */}
      <Modal isOpen={isIncidentModalOpen} onClose={() => setIsIncidentModalOpen(false)} size="4xl">
        <ModalContent>
          <ModalHeader>
            {selectedIncident ? 'View Security Incident' : 'Report Security Incident'}
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Incident form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsIncidentModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsIncidentModalOpen(false)}>
              {selectedIncident ? 'Close' : 'Report Incident'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Visitor Modal */}
      <Modal isOpen={isVisitorModalOpen} onClose={() => setIsVisitorModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {selectedVisitor ? 'View Visitor Details' : 'Register New Visitor'}
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Visitor form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsVisitorModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsVisitorModalOpen(false)}>
              {selectedVisitor ? 'Close' : 'Register Visitor'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Security Check Modal */}
      <Modal isOpen={isCheckModalOpen} onClose={() => setIsCheckModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>
            {selectedCheck ? 'View Security Check' : 'New Security Check'}
          </ModalHeader>
          <ModalBody>
            <div className="text-center py-8 text-gray-500">
              <p>Security check form will be implemented here</p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={() => setIsCheckModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => setIsCheckModalOpen(false)}>
              {selectedCheck ? 'Close' : 'Start Check'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
