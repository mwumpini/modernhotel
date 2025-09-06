'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Chip, Progress, Switch, Alert
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';

interface SyncStatus {
  id: string;
  module: 'guest-services' | 'housekeeping' | 'f&b' | 'accounting' | 'hr' | 'inventory' | 'reports';
  lastSync: string;
  status: 'synced' | 'pending' | 'conflict' | 'error' | 'offline';
  pendingChanges: number;
  conflicts: number;
  errorMessage?: string;
}

interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  module: string;
  entity: string;
  entityId: string;
  data: any;
  timestamp: string;
  status: 'pending' | 'synced' | 'failed' | 'conflict';
  retryCount: number;
  lastAttempt?: string;
}

interface NetworkStatus {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'offline';
  signalStrength: number;
  lastCheck: string;
  syncInterval: number; // minutes
  autoSync: boolean;
}

interface ConflictResolution {
  id: string;
  entityType: string;
  entityId: string;
  localVersion: any;
  serverVersion: any;
  conflictType: 'data-mismatch' | 'deletion-conflict' | 'version-conflict';
  resolution: 'keep-local' | 'keep-server' | 'merge' | 'manual';
  resolvedBy?: string;
  resolvedAt?: string;
}

export default function OfflineManagementDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    connectionType: 'wifi',
    signalStrength: 85,
    lastCheck: new Date().toISOString(),
    syncInterval: 15,
    autoSync: true
  });
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [offlineOperations, setOfflineOperations] = useState<OfflineOperation[]>([]);
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);
  
  const settings = useSettingsStore();

  // Sample data
  useEffect(() => {
    const mockSyncStatuses: SyncStatus[] = [
      {
        id: '1',
        module: 'guest-services',
        lastSync: '2024-01-16T14:30:00Z',
        status: 'synced',
        pendingChanges: 0,
        conflicts: 0
      },
      {
        id: '2',
        module: 'housekeeping',
        lastSync: '2024-01-16T14:25:00Z',
        status: 'synced',
        pendingChanges: 0,
        conflicts: 0
      },
      {
        id: '3',
        module: 'f&b',
        lastSync: '2024-01-16T14:20:00Z',
        status: 'pending',
        pendingChanges: 3,
        conflicts: 0
      },
      {
        id: '4',
        module: 'accounting',
        lastSync: '2024-01-16T14:15:00Z',
        status: 'conflict',
        pendingChanges: 2,
        conflicts: 1
      }
    ];

    const mockOfflineOperations: OfflineOperation[] = [
      {
        id: '1',
        type: 'create',
        module: 'f&b',
        entity: 'Order',
        entityId: 'ORD-001',
        data: { tableNumber: 5, items: ['Coffee', 'Sandwich'] },
        timestamp: '2024-01-16T14:22:00Z',
        status: 'pending',
        retryCount: 0
      },
      {
        id: '2',
        type: 'update',
        module: 'accounting',
        entity: 'Invoice',
        entityId: 'INV-001',
        data: { amount: 150.00, status: 'paid' },
        timestamp: '2024-01-16T14:18:00Z',
        status: 'conflict',
        retryCount: 2
      }
    ];

    const mockConflicts: ConflictResolution[] = [
      {
        id: '1',
        entityType: 'Invoice',
        entityId: 'INV-001',
        localVersion: { amount: 150.00, status: 'paid' },
        serverVersion: { amount: 145.00, status: 'pending' },
        conflictType: 'data-mismatch',
        resolution: 'manual'
      }
    ];

    setSyncStatuses(mockSyncStatuses);
    setOfflineOperations(mockOfflineOperations);
    setConflicts(mockConflicts);
  }, []);

  // Network status monitoring
  useEffect(() => {
    const updateNetworkStatus = () => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: navigator.onLine,
        lastCheck: new Date().toISOString()
      }));
    };

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  // Calculate metrics
  const totalModules = syncStatuses.length;
  const syncedModules = syncStatuses.filter(s => s.status === 'synced').length;
  const pendingModules = syncStatuses.filter(s => s.status === 'pending').length;
  const conflictModules = syncStatuses.filter(s => s.status === 'conflict').length;
  const totalPendingChanges = syncStatuses.reduce((sum, s) => sum + s.pendingChanges, 0);
  const totalConflicts = syncStatuses.reduce((sum, s) => sum + s.conflicts, 0);

  const handleManualSync = (moduleId: string) => {
    trackEvent('OFFLINE.ManualSync', { moduleId });
    // In real app, trigger sync for specific module
  };

  const handleResolveConflict = (conflictId: string, resolution: string) => {
    trackEvent('OFFLINE.ConflictResolved', { conflictId, resolution });
    // In real app, resolve conflict with chosen resolution
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Network Status */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🌐 Network Status</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl mb-2">
                {networkStatus.isOnline ? '🟢' : '🔴'}
              </div>
              <div className="font-semibold text-lg">
                {networkStatus.isOnline ? 'Online' : 'Offline'}
              </div>
              <div className="text-sm text-gray-600">
                {networkStatus.connectionType}
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl mb-2">📶</div>
              <div className="font-semibold text-lg">
                Signal: {networkStatus.signalStrength}%
              </div>
              <div className="text-sm text-gray-600">
                Last check: {new Date(networkStatus.lastCheck).toLocaleTimeString()}
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl mb-2">⚙️</div>
              <div className="font-semibold text-lg">
                Auto-sync: {networkStatus.autoSync ? 'Enabled' : 'Disabled'}
              </div>
              <div className="text-sm text-gray-600">
                Every {networkStatus.syncInterval} minutes
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Sync Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Modules</p>
                <p className="text-2xl font-bold text-ghana-black">{totalModules}</p>
                <p className="text-sm text-blue-600">System modules</p>
              </div>
              <div className="text-3xl">🏗️</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Synced</p>
                <p className="text-2xl font-bold text-ghana-green">{syncedModules}</p>
                <p className="text-sm text-green-600">Up to date</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-orange-600">{pendingModules}</p>
                <p className="text-sm text-orange-600">Awaiting sync</p>
              </div>
              <div className="text-3xl">⏳</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conflicts</p>
                <p className="text-2xl font-bold text-red-600">{conflictModules}</p>
                <p className="text-sm text-red-600">Need resolution</p>
              </div>
              <div className="text-3xl">⚠️</div>
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
              <span className="text-sm font-medium">Sync All</span>
            </Button>
            <Button
              variant="flat"
              className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📥</span>
              <span className="text-sm font-medium">Download Data</span>
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-gold text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📤</span>
              <span className="text-sm font-medium">Upload Data</span>
            </Button>
            <Button
              variant="flat"
              className="bg-purple-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">🔧</span>
              <span className="text-sm font-medium">Settings</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Sync Status Overview */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📊 Sync Status Overview</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {syncStatuses.map((status) => (
              <div key={status.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`h-4 w-4 rounded-full ${
                    status.status === 'synced' ? 'bg-green-500' :
                    status.status === 'pending' ? 'bg-orange-500' :
                    status.status === 'conflict' ? 'bg-red-500' :
                    status.status === 'error' ? 'bg-red-600' :
                    'bg-gray-500'
                  }`}></div>
                  <div>
                    <div className="font-semibold capitalize">{status.module}</div>
                    <div className="text-sm text-gray-600">
                      Last sync: {new Date(status.lastSync).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      {status.pendingChanges} pending • {status.conflicts} conflicts
                    </div>
                    <Badge 
                      color={
                        status.status === 'synced' ? 'success' :
                        status.status === 'pending' ? 'warning' :
                        status.status === 'conflict' ? 'danger' :
                        status.status === 'error' ? 'danger' :
                        'default'
                      } 
                      size="sm"
                    >
                      {status.status}
                    </Badge>
                  </div>
                  {status.status !== 'synced' && (
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      onClick={() => handleManualSync(status.id)}
                    >
                      Sync Now
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderOfflineOperations = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">📱 Offline Operations</h3>
        </CardHeader>
        <CardBody>
          <Table aria-label="Offline operations table">
            <TableHeader>
              <TableColumn>Operation</TableColumn>
              <TableColumn>Module</TableColumn>
              <TableColumn>Entity</TableColumn>
              <TableColumn>Timestamp</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Retries</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {offlineOperations.map((operation) => (
                <TableRow key={operation.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className={`h-3 w-3 rounded-full ${
                        operation.type === 'create' ? 'bg-green-500' :
                        operation.type === 'update' ? 'bg-blue-500' :
                        'bg-red-500'
                      }`}></div>
                      <span className="font-semibold capitalize">{operation.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip color="primary" size="sm" variant="flat">
                      {operation.module}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{operation.entity}</div>
                      <div className="text-sm text-gray-500">{operation.entityId}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{new Date(operation.timestamp).toLocaleDateString()}</div>
                      <div className="text-gray-500">{new Date(operation.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        operation.status === 'synced' ? 'success' :
                        operation.status === 'pending' ? 'warning' :
                        operation.status === 'failed' ? 'danger' :
                        operation.status === 'conflict' ? 'danger' :
                        'default'
                      } 
                      size="sm"
                    >
                      {operation.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{operation.retryCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {operation.status === 'failed' && (
                        <Button size="sm" variant="flat" color="primary">
                          Retry
                        </Button>
                      )}
                      <Button size="sm" variant="flat" color="secondary">
                        View
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

  const renderConflictResolution = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">⚠️ Conflict Resolution</h3>
        </CardHeader>
        <CardBody>
          {conflicts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No conflicts detected. All data is synchronized.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {conflicts.map((conflict) => (
                <div key={conflict.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold">{conflict.entityType} - {conflict.entityId}</h4>
                      <p className="text-sm text-gray-600">
                        Conflict type: {conflict.conflictType.replace('-', ' ')}
                      </p>
                    </div>
                    <Badge color="danger" size="sm">Needs Resolution</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <h5 className="font-medium text-blue-800 mb-2">Local Version</h5>
                      <pre className="text-sm text-blue-700">
                        {JSON.stringify(conflict.localVersion, null, 2)}
                      </pre>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <h5 className="font-medium text-green-800 mb-2">Server Version</h5>
                      <pre className="text-sm text-green-700">
                        {JSON.stringify(conflict.serverVersion, null, 2)}
                      </pre>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      onClick={() => handleResolveConflict(conflict.id, 'keep-local')}
                    >
                      Keep Local
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color="success"
                      onClick={() => handleResolveConflict(conflict.id, 'keep-server')}
                    >
                      Keep Server
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color="warning"
                      onClick={() => handleResolveConflict(conflict.id, 'merge')}
                    >
                      Merge
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color="secondary"
                    >
                      Manual Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">📱 Offline Management & Sync</h1>
          <p className="text-gray-600">Manage offline operations, data synchronization, and conflict resolution</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color={networkStatus.isOnline ? 'success' : 'danger'}>
            {networkStatus.isOnline ? 'Online' : 'Offline'}
          </Badge>
          <Badge color="primary">SaaS Ready</Badge>
        </div>
      </div>

      {/* Network Status Alert */}
      {!networkStatus.isOnline && (
        <Alert className="mb-6" color="warning">
          <span className="font-medium">Offline Mode Active</span>
          <span className="block text-sm">
            You are currently offline. Changes will be queued and synchronized when connection is restored.
          </span>
        </Alert>
      )}

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="Overview" />
        <Tab key="operations" title="Offline Operations" />
        <Tab key="conflicts" title="Conflict Resolution" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'operations' && renderOfflineOperations()}
        {selectedTab === 'conflicts' && renderConflictResolution()}
      </div>
    </div>
  );
}
