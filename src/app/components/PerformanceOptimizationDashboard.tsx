'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Progress, Switch, Alert
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';

interface PerformanceMetric {
  id: string;
  name: string;
  current: number;
  target: number;
  unit: string;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

interface CacheStatus {
  id: string;
  name: string;
  type: 'redis' | 'memory' | 'database' | 'cdn';
  status: 'active' | 'inactive' | 'error';
  hitRate: number;
  missRate: number;
  size: number;
  maxSize: number;
  lastCleared: string;
  isEnabled: boolean;
}

interface DatabasePerformance {
  id: string;
  query: string;
  executionTime: number;
  frequency: number;
  lastExecuted: string;
  optimization: 'optimized' | 'needs-optimization' | 'critical';
  suggestions: string[];
}

interface SystemResource {
  id: string;
  name: string;
  current: number;
  max: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend: 'stable' | 'increasing' | 'decreasing';
}

export default function PerformanceOptimizationDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [cacheStatuses, setCacheStatuses] = useState<CacheStatus[]>([]);
  const [databasePerformance, setDatabasePerformance] = useState<DatabasePerformance[]>([]);
  const [systemResources, setSystemResources] = useState<SystemResource[]>([]);
  
  const settings = useSettingsStore();

  // Sample data
  useEffect(() => {
    const mockPerformanceMetrics: PerformanceMetric[] = [
      {
        id: '1',
        name: 'Page Load Time',
        current: 1.2,
        target: 2.0,
        unit: 'seconds',
        status: 'excellent',
        trend: 'up',
        lastUpdated: new Date().toISOString()
      },
      {
        id: '2',
        name: 'API Response Time',
        current: 180,
        target: 500,
        unit: 'ms',
        status: 'excellent',
        trend: 'up',
        lastUpdated: new Date().toISOString()
      },
      {
        id: '3',
        name: 'Database Query Time',
        current: 45,
        target: 100,
        unit: 'ms',
        status: 'good',
        trend: 'stable',
        lastUpdated: new Date().toISOString()
      },
      {
        id: '4',
        name: 'Memory Usage',
        current: 75,
        target: 80,
        unit: '%',
        status: 'good',
        trend: 'stable',
        lastUpdated: new Date().toISOString()
      }
    ];

    const mockCacheStatuses: CacheStatus[] = [
      {
        id: '1',
        name: 'Redis Cache',
        type: 'redis',
        status: 'active',
        hitRate: 92.5,
        missRate: 7.5,
        size: 256,
        maxSize: 512,
        lastCleared: '2024-01-16T00:00:00Z',
        isEnabled: true
      },
      {
        id: '2',
        name: 'Memory Cache',
        type: 'memory',
        status: 'active',
        hitRate: 88.3,
        missRate: 11.7,
        size: 128,
        maxSize: 256,
        lastCleared: '2024-01-16T00:00:00Z',
        isEnabled: true
      }
    ];

    const mockDatabasePerformance: DatabasePerformance[] = [
      {
        id: '1',
        query: 'SELECT * FROM reservations WHERE check_in_date = ?',
        executionTime: 45,
        frequency: 1250,
        lastExecuted: '2024-01-16T14:30:00Z',
        optimization: 'optimized',
        suggestions: ['Index on check_in_date column', 'Consider query caching']
      },
      {
        id: '2',
        query: 'SELECT g.*, r.* FROM guests g JOIN reservations r ON g.id = r.guest_id',
        executionTime: 120,
        frequency: 890,
        lastExecuted: '2024-01-16T14:25:00Z',
        optimization: 'needs-optimization',
        suggestions: ['Add composite index', 'Optimize JOIN conditions', 'Consider denormalization']
      }
    ];

    const mockSystemResources: SystemResource[] = [
      {
        id: '1',
        name: 'CPU Usage',
        current: 45,
        max: 100,
        unit: '%',
        status: 'normal',
        trend: 'stable'
      },
      {
        id: '2',
        name: 'Memory Usage',
        current: 75,
        max: 100,
        unit: '%',
        status: 'warning',
        trend: 'increasing'
      },
      {
        id: '3',
        name: 'Disk Usage',
        current: 60,
        max: 100,
        unit: '%',
        status: 'normal',
        trend: 'stable'
      },
      {
        id: '4',
        name: 'Network I/O',
        current: 85,
        max: 100,
        unit: '%',
        status: 'warning',
        trend: 'increasing'
      }
    ];

    setPerformanceMetrics(mockPerformanceMetrics);
    setCacheStatuses(mockCacheStatuses);
    setDatabasePerformance(mockDatabasePerformance);
    setSystemResources(mockSystemResources);
  }, []);

  // Calculate metrics
  const totalMetrics = performanceMetrics.length;
  const excellentMetrics = performanceMetrics.filter(m => m.status === 'excellent').length;
  const warningMetrics = performanceMetrics.filter(m => m.status === 'warning').length;
  const criticalMetrics = performanceMetrics.filter(m => m.status === 'critical').length;
  const overallPerformance = (excellentMetrics / totalMetrics) * 100;

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overall Performance</p>
                <p className="text-2xl font-bold text-ghana-green">{overallPerformance.toFixed(1)}%</p>
                <p className="text-sm text-green-600">Excellent metrics</p>
              </div>
              <div className="text-3xl">📈</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cache Hit Rate</p>
                <p className="text-2xl font-bold text-ghana-black">90.4%</p>
                <p className="text-sm text-blue-600">Efficient caching</p>
              </div>
              <div className="text-3xl">⚡</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <p className="text-2xl font-bold text-ghana-green">95%</p>
                <p className="text-sm text-green-600">Optimal operation</p>
              </div>
              <div className="text-3xl">🟢</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Uptime</p>
                <p className="text-2xl font-bold text-ghana-black">99.9%</p>
                <p className="text-sm text-purple-600">High availability</p>
              </div>
              <div className="text-3xl">⏰</div>
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
            >
              <span className="text-2xl">🔄</span>
              <span className="text-sm font-medium">Clear Cache</span>
            </Button>
            <Button
              variant="flat"
              className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📊</span>
              <span className="text-sm font-medium">Run Diagnostics</span>
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-gold text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">⚡</span>
              <span className="text-sm font-medium">Optimize DB</span>
            </Button>
            <Button
              variant="flat"
              className="bg-purple-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📋</span>
              <span className="text-sm font-medium">Performance Report</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Performance Metrics */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Performance Metrics</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {performanceMetrics.map((metric) => (
              <div key={metric.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`h-4 w-4 rounded-full ${
                    metric.status === 'excellent' ? 'bg-green-500' :
                    metric.status === 'good' ? 'bg-blue-500' :
                    metric.status === 'warning' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}></div>
                  <div>
                    <div className="font-semibold">{metric.name}</div>
                    <div className="text-sm text-gray-600">
                      Target: {metric.target} {metric.unit}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {metric.current} {metric.unit}
                    </div>
                    <div className="text-sm text-gray-600">
                      {metric.trend === 'up' ? '↗ Improving' : 
                       metric.trend === 'down' ? '↘ Declining' : '→ Stable'}
                    </div>
                  </div>
                  <Badge 
                    color={
                      metric.status === 'excellent' ? 'success' :
                      metric.status === 'good' ? 'primary' :
                      metric.status === 'warning' ? 'warning' :
                      'danger'
                    } 
                    size="sm"
                  >
                    {metric.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderCacheManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">⚡ Cache Management</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {cacheStatuses.map((cache) => (
              <div key={cache.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold">{cache.name}</h4>
                    <p className="text-sm text-gray-600">
                      Type: {cache.type} • Status: {cache.status}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge 
                      color={
                        cache.status === 'active' ? 'success' :
                        cache.status === 'inactive' ? 'default' :
                        'danger'
                      } 
                      size="sm"
                    >
                      {cache.status}
                    </Badge>
                    <Switch
                      checked={cache.isEnabled}
                      onChange={() => {
                        trackEvent('PERFORMANCE.CacheToggled', { cacheId: cache.id, enabled: !cache.isEnabled });
                      }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{cache.hitRate}%</div>
                    <div className="text-sm text-blue-800">Hit Rate</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{cache.missRate}%</div>
                    <div className="text-sm text-green-800">Miss Rate</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {cache.size}MB / {cache.maxSize}MB
                    </div>
                    <div className="text-sm text-purple-800">Usage</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Last cleared: {new Date(cache.lastCleared).toLocaleString()}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="flat" color="primary">
                      Clear Cache
                    </Button>
                    <Button size="sm" variant="flat" color="secondary">
                      View Stats
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderDatabaseOptimization = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🗄️ Database Performance</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Database performance table">
            <TableHeader>
              <TableColumn>Query</TableColumn>
              <TableColumn>Execution Time</TableColumn>
              <TableColumn>Frequency</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Suggestions</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {databasePerformance.map((query) => (
                <TableRow key={query.id}>
                  <TableCell>
                    <div className="max-w-xs">
                      <div className="font-mono text-sm bg-gray-100 p-2 rounded">
                        {query.query}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`font-semibold ${
                      query.executionTime < 50 ? 'text-green-600' :
                      query.executionTime < 100 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {query.executionTime}ms
                    </div>
                  </TableCell>
                  <TableCell>{query.frequency.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        query.optimization === 'optimized' ? 'success' :
                        query.optimization === 'needs-optimization' ? 'warning' :
                        'danger'
                      } 
                      size="sm"
                    >
                      {query.optimization.replace('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      {query.suggestions.map((suggestion, index) => (
                        <div key={index} className="text-sm text-gray-600 mb-1">
                          • {suggestion}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        Optimize
                      </Button>
                      <Button size="sm" variant="flat" color="secondary">
                        Analyze
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

  const renderSystemResources = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">💻 System Resources</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {systemResources.map((resource) => (
              <div key={resource.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{resource.name}</h4>
                  <Badge 
                    color={
                      resource.status === 'normal' ? 'success' :
                      resource.status === 'warning' ? 'warning' :
                      'danger'
                    } 
                    size="sm"
                  >
                    {resource.status}
                  </Badge>
                </div>
                
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Current: {resource.current}{resource.unit}</span>
                    <span>Max: {resource.max}{resource.unit}</span>
                  </div>
                  <Progress 
                    value={(resource.current / resource.max) * 100}
                    color={
                      resource.status === 'normal' ? 'success' :
                      resource.status === 'warning' ? 'warning' :
                      'danger'
                    }
                    className="w-full"
                  />
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Trend: {resource.trend}</span>
                  <span>
                    {resource.trend === 'increasing' ? '↗' : 
                     resource.trend === 'decreasing' ? '↘' : '→'}
                  </span>
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
          <h1 className="text-3xl font-bold text-ghana-black">⚡ Performance Optimization & Caching</h1>
          <p className="text-gray-600">Monitor and optimize system performance, caching, and resource utilization</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">SaaS Ready</Badge>
        </div>
      </div>

      {/* Performance Alert */}
      {criticalMetrics > 0 && (
        <Alert className="mb-6" color="danger">
          <span className="font-medium">Performance Alert</span>
          <span className="block text-sm">
            {criticalMetrics} critical performance metrics detected. Immediate attention required.
          </span>
        </Alert>
      )}

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="Overview" />
        <Tab key="cache" title="Cache Management" />
        <Tab key="database" title="Database Optimization" />
        <Tab key="resources" title="System Resources" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'cache' && renderCacheManagement()}
        {selectedTab === 'database' && renderDatabaseOptimization()}
        {selectedTab === 'resources' && renderSystemResources()}
      </div>
    </div>
  );
}
