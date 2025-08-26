'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, CardHeader, Tabs, Tab, Button, Input, Select, SelectItem, 
  Progress, Chip, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Divider
} from "@heroui/react";
import { useIncidentStore } from '../lib/security/incidentStore';
import { usePatrolStore } from '../lib/security/patrolStore';
import { useVisitorStore } from '../lib/security/visitorStore';

export default function SecurityAnalyticsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());

  const incidentStore = useIncidentStore();
  const patrolStore = usePatrolStore();
  const visitorStore = useVisitorStore();

  // Generate reports using useMemo for performance
  const incidentAnalytics = useMemo(() => 
    incidentStore.getIncidentAnalytics(selectedPeriod), [selectedPeriod, incidentStore]
  );

  const patrolAnalytics = useMemo(() => 
    patrolStore.getPatrolAnalytics(selectedPeriod), [selectedPeriod, patrolStore]
  );

  const visitorAnalytics = useMemo(() => 
    visitorStore.getVisitorAnalytics(selectedPeriod), [selectedPeriod, visitorStore]
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">🛡️ Security Analytics Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive security operations monitoring, incident analysis, and performance metrics
        </p>
      </div>

      {/* Period Selection */}
      <div className="mb-6 flex gap-4 items-center">
        <Select
          placeholder="Select Period"
          selectedKeys={[selectedPeriod]}
          onSelectionChange={(keys) => setSelectedPeriod(Array.from(keys)[0] as 'daily' | 'weekly' | 'monthly')}
          className="w-40"
        >
          <SelectItem key="daily">Daily</SelectItem>
          <SelectItem key="weekly">Weekly</SelectItem>
          <SelectItem key="monthly">Monthly</SelectItem>
        </Select>
        
        <Input
          type="date"
          value={startDate.toISOString().split('T')[0]}
          onChange={(e) => setStartDate(new Date(e.target.value))}
          className="w-40"
        />
        
        <Input
          type="date"
          value={endDate.toISOString().split('T')[0]}
          onChange={(e) => setEndDate(new Date(e.target.value))}
          className="w-40"
        />
      </div>

      <Card>
        <CardBody className="p-0">
          <Tabs 
            selectedKey="overview" 
            className="w-full"
          >
            <Tab key="overview" title="📊 Overview">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{incidentAnalytics.totalIncidents}</div>
                      <div className="text-sm text-gray-600">Total Incidents</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-green-600">{patrolAnalytics.totalPatrols}</div>
                      <div className="text-sm text-gray-600">Patrols Completed</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{visitorAnalytics.totalVisitors}</div>
                      <div className="text-sm text-gray-600">Visitors Processed</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{incidentAnalytics.resolutionRate.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600">Resolution Rate</div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>
            
            <Tab key="incidents" title="🚨 Incident Reports">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Incident Analysis</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h4 className="text-md font-semibold">Incidents by Type</h4>
                    </CardHeader>
                    <CardBody>
                      {Object.entries(incidentAnalytics.incidentsByType).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center py-2">
                          <span className="capitalize">{type.replace('_', ' ')}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <h4 className="text-md font-semibold">Incidents by Severity</h4>
                    </CardHeader>
                    <CardBody>
                      {Object.entries(incidentAnalytics.incidentsBySeverity).map(([severity, count]) => (
                        <div key={severity} className="flex justify-between items-center py-2">
                          <Chip 
                            color={severity === 'critical' ? 'danger' : 
                                   severity === 'high' ? 'warning' : 
                                   severity === 'medium' ? 'secondary' : 'success'}
                            size="sm"
                          >
                            {severity}
                          </Chip>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>
            
            <Tab key="patrols" title="👮 Patrol Reports">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Patrol Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{patrolAnalytics.totalPatrols}</div>
                      <div className="text-sm text-gray-600">Total Patrols</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-green-600">{patrolAnalytics.completedPatrols}</div>
                      <div className="text-sm text-gray-600">Completed</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{patrolAnalytics.complianceRate.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600">Compliance</div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>
            
            <Tab key="visitors" title="👥 Visitor Reports">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Visitor Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{visitorAnalytics.totalVisitors}</div>
                      <div className="text-sm text-gray-600">Total Visitors</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-green-600">{visitorAnalytics.checkedIn}</div>
                      <div className="text-sm text-gray-600">Currently In</div>
                    </CardBody>
                  </Card>
                  
                  <Card>
                    <CardBody className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{visitorAnalytics.vipVisitors}</div>
                      <div className="text-sm text-gray-600">VIP Visitors</div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
