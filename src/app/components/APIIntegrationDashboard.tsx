'use client';

import React, { useState } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Chip, Switch
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';

interface APIService {
  id: string;
  name: string;
  type: 'payment-gateway' | 'sms-service' | 'email-service' | 'banking-api' | 'tax-api' | 'weather-api' | 'transport-api';
  provider: string;
  status: 'active' | 'inactive' | 'error' | 'testing';
  apiKey: string;
  endpoint: string;
  lastSync: string;
  responseTime: number;
  successRate: number;
  monthlyUsage: number;
  rateLimit: number;
  isEnabled: boolean;
}

interface Webhook {
  id: string;
  name: string;
  event: 'reservation.created' | 'guest.checked-in' | 'payment.received' | 'room.status-changed' | 'invoice.generated';
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  status: 'active' | 'inactive' | 'error';
  lastTriggered: string;
  successCount: number;
  failureCount: number;
  retryCount: number;
  isEnabled: boolean;
}

interface IntegrationLog {
  id: string;
  serviceId: string;
  serviceName: string;
  operation: string;
  status: 'success' | 'failed' | 'pending';
  requestData: any;
  responseData: any;
  errorMessage?: string;
  timestamp: string;
  duration: number;
  ipAddress: string;
}

interface GhanaService {
  id: string;
  name: string;
  category: 'tax' | 'banking' | 'government' | 'utilities' | 'telecom';
  provider: string;
  status: 'active' | 'inactive' | 'maintenance';
  lastSync: string;
  compliance: 'compliant' | 'non-compliant' | 'pending';
  documentation: string[];
}

export default function APIIntegrationDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedService, setSelectedService] = useState<APIService | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  
  const settings = useSettingsStore();

  // Sample data
  const apiServices: APIService[] = [
    {
      id: '1',
      name: 'Paystack Payment Gateway',
      type: 'payment-gateway',
      provider: 'Paystack',
      status: 'active',
      apiKey: 'pk_test_****',
      endpoint: 'https://api.paystack.co',
      lastSync: '2024-01-16T14:30:00Z',
      responseTime: 245,
      successRate: 99.8,
      monthlyUsage: 1250,
      rateLimit: 1000,
      isEnabled: true
    },
    {
      id: '2',
      name: 'Ghana Revenue Authority API',
      type: 'tax-api',
      provider: 'GRA',
      status: 'active',
      apiKey: 'gra_****',
      endpoint: 'https://api.gra.gov.gh',
      lastSync: '2024-01-16T14:25:00Z',
      responseTime: 890,
      successRate: 98.5,
      monthlyUsage: 450,
      rateLimit: 500,
      isEnabled: true
    },
    {
      id: '3',
      name: 'MTN Mobile Money API',
      type: 'payment-gateway',
      provider: 'MTN Ghana',
      status: 'active',
      apiKey: 'mtn_****',
      endpoint: 'https://api.mtn.com.gh',
      lastSync: '2024-01-16T14:20:00Z',
      responseTime: 320,
      successRate: 99.2,
      monthlyUsage: 890,
      rateLimit: 2000,
      isEnabled: true
    }
  ];

  const webhooks: Webhook[] = [
    {
      id: '1',
      name: 'Reservation Notification',
      event: 'reservation.created',
      url: 'https://webhook.site/abc123',
      method: 'POST',
      headers: { 'Authorization': 'Bearer token123', 'Content-Type': 'application/json' },
      status: 'active',
      lastTriggered: '2024-01-16T14:30:00Z',
      successCount: 1250,
      failureCount: 3,
      retryCount: 2,
      isEnabled: true
    },
    {
      id: '2',
      name: 'Payment Confirmation',
      event: 'payment.received',
      url: 'https://accounting.system.com/webhook',
      method: 'POST',
      headers: { 'X-API-Key': 'key456' },
      status: 'active',
      lastTriggered: '2024-01-16T14:25:00Z',
      successCount: 890,
      failureCount: 0,
      retryCount: 0,
      isEnabled: true
    }
  ];

  const integrationLogs: IntegrationLog[] = [
    {
      id: '1',
      serviceId: '1',
      serviceName: 'Paystack Payment Gateway',
      operation: 'Payment Processing',
      status: 'success',
      requestData: { amount: 150.00, currency: 'GHS', email: 'guest@example.com' },
      responseData: { transactionId: 'TXN123', status: 'success' },
      timestamp: '2024-01-16T14:30:00Z',
      duration: 245,
      ipAddress: '192.168.1.100'
    },
    {
      id: '2',
      serviceId: '2',
      serviceName: 'Ghana Revenue Authority API',
      operation: 'Tax Calculation',
      status: 'success',
      requestData: { amount: 150.00, taxType: 'VAT' },
      responseData: { vat: 18.75, nhil: 3.75, total: 172.50 },
      timestamp: '2024-01-16T14:25:00Z',
      duration: 890,
      ipAddress: '192.168.1.100'
    }
  ];

  const ghanaServices: GhanaService[] = [
    {
      id: '1',
      name: 'GRA Tax API',
      category: 'tax',
      provider: 'Ghana Revenue Authority',
      status: 'active',
      lastSync: '2024-01-16T14:25:00Z',
      compliance: 'compliant',
      documentation: ['Tax Calculation Guide', 'API Documentation', 'Compliance Checklist']
    },
    {
      id: '2',
      name: 'Bank of Ghana API',
      category: 'banking',
      provider: 'Bank of Ghana',
      status: 'active',
      lastSync: '2024-01-16T14:20:00Z',
      compliance: 'compliant',
      documentation: ['Banking Regulations', 'API Standards', 'Security Guidelines']
    },
    {
      id: '3',
      name: 'Ghana Tourism Authority',
      category: 'government',
      provider: 'GTA',
      status: 'active',
      lastSync: '2024-01-16T14:15:00Z',
      compliance: 'compliant',
      documentation: ['Tourism Guidelines', 'Reporting Requirements', 'Data Standards']
    }
  ];

  // Calculate metrics
  const totalServices = apiServices.length;
  const activeServices = apiServices.filter(s => s.status === 'active').length;
  const totalWebhooks = webhooks.length;
  const activeWebhooks = webhooks.filter(w => w.status === 'active').length;
  const totalGhanaServices = ghanaServices.length;
  const compliantServices = ghanaServices.filter(s => s.compliance === 'compliant').length;

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Integration Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">API Services</p>
                <p className="text-2xl font-bold text-ghana-black">{totalServices}</p>
                <p className="text-sm text-blue-600">{activeServices} active</p>
              </div>
              <div className="text-3xl">🔌</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Webhooks</p>
                <p className="text-2xl font-bold text-ghana-black">{totalWebhooks}</p>
                <p className="text-sm text-green-600">{activeWebhooks} active</p>
              </div>
              <div className="text-3xl">🔗</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ghana Services</p>
                <p className="text-2xl font-bold text-ghana-black">{totalGhanaServices}</p>
                <p className="text-sm text-purple-600">{compliantServices} compliant</p>
              </div>
              <div className="text-3xl">🇬🇭</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-ghana-green">99.2%</p>
                <p className="text-sm text-green-600">Overall performance</p>
              </div>
              <div className="text-3xl">📈</div>
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
              className="bg-ghana-green text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
              onClick={() => setIsServiceModalOpen(true)}
            >
              <span className="text-2xl">➕</span>
              <span className="text-sm font-medium">Add Service</span>
            </Button>
            <Button
              variant="flat"
              className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">🔗</span>
              <span className="text-sm font-medium">Create Webhook</span>
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-gold text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📊</span>
              <span className="text-sm font-medium">Test APIs</span>
            </Button>
            <Button
              variant="flat"
              className="bg-purple-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📋</span>
              <span className="text-sm font-medium">Documentation</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Service Performance */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Service Performance</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {apiServices.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`h-4 w-4 rounded-full ${
                    service.status === 'active' ? 'bg-green-500' :
                    service.status === 'inactive' ? 'bg-gray-500' :
                    service.status === 'error' ? 'bg-red-500' :
                    'bg-yellow-500'
                  }`}></div>
                  <div>
                    <div className="font-semibold">{service.name}</div>
                    <div className="text-sm text-gray-600">
                      {service.provider} • {service.type.replace('-', ' ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      Response: {service.responseTime}ms
                    </div>
                    <div className="text-sm text-gray-600">
                      Success: {service.successRate}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      Usage: {service.monthlyUsage}/{service.rateLimit}
                    </div>
                    <Badge 
                      color={
                        service.status === 'active' ? 'success' :
                        service.status === 'inactive' ? 'default' :
                        service.status === 'error' ? 'danger' :
                        'warning'
                      } 
                      size="sm"
                    >
                      {service.status}
                    </Badge>
                  </div>
                  <Switch
                    checked={service.isEnabled}
                    onChange={() => {
                      trackEvent('API.ServiceToggled', { serviceId: service.id, enabled: !service.isEnabled });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderAPIServices = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">🔌 API Services</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
              onClick={() => setIsServiceModalOpen(true)}
            >
              ➕ Add Service
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="API services table">
            <TableHeader>
              <TableColumn>Service</TableColumn>
              <TableColumn>Provider</TableColumn>
              <TableColumn>Type</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Performance</TableColumn>
              <TableColumn>Usage</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {apiServices.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{service.name}</div>
                      <div className="text-sm text-gray-500">{service.endpoint}</div>
                    </div>
                  </TableCell>
                  <TableCell>{service.provider}</TableCell>
                  <TableCell>
                    <Chip 
                      color={
                        service.type === 'payment-gateway' ? 'success' :
                        service.type === 'tax-api' ? 'warning' :
                        service.type === 'sms-service' ? 'primary' :
                        'default'
                      } 
                      size="sm" 
                      variant="flat"
                    >
                      {service.type.replace('-', ' ')}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        service.status === 'active' ? 'success' :
                        service.status === 'inactive' ? 'default' :
                        service.status === 'error' ? 'danger' :
                        'warning'
                      } 
                      size="sm"
                    >
                      {service.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{service.responseTime}ms response</div>
                      <div className="text-gray-500">{service.successRate}% success</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{service.monthlyUsage}/{service.rateLimit}</div>
                      <div className="text-gray-500">Monthly usage</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary" onClick={() => {
                        setSelectedService(service);
                        setIsServiceModalOpen(true);
                      }}>
                        Edit
                      </Button>
                      <Button size="sm" variant="flat" color="secondary">
                        Test
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

  const renderGhanaServices = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🇬🇭 Ghana Government Services</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ghanaServices.map((service) => (
              <div key={service.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{service.name}</h4>
                    <p className="text-sm text-gray-600">{service.provider}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      color={
                        service.status === 'active' ? 'success' :
                        service.status === 'maintenance' ? 'warning' :
                        'default'
                      } 
                      size="sm"
                    >
                      {service.status}
                    </Badge>
                    <Badge 
                      color={
                        service.compliance === 'compliant' ? 'success' :
                        service.compliance === 'non-compliant' ? 'danger' :
                        'warning'
                      } 
                      size="sm"
                    >
                      {service.compliance}
                    </Badge>
                  </div>
                </div>
                
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    Category: <span className="font-medium capitalize">{service.category}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Last sync: {new Date(service.lastSync).toLocaleString()}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Documentation:</p>
                  <div className="flex flex-wrap gap-1">
                    {service.documentation.map((doc, index) => (
                      <Chip key={index} size="sm" variant="flat" color="primary">
                        {doc}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">🔌 API Integration & Third-party Services</h1>
          <p className="text-gray-600">Manage external integrations, webhooks, and Ghana government service connections</p>
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
        <Tab key="services" title="API Services" />
        <Tab key="ghana-services" title="Ghana Services" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'services' && renderAPIServices()}
        {selectedTab === 'ghana-services' && renderGhanaServices()}
      </div>
    </div>
  );
}
