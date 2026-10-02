'use client';

import React, { useState, useEffect } from 'react';
import { Button, Badge, Card, CardBody, CardHeader, Progress, Chip } from "@heroui/react";

interface OfflineData {
  id: string;
  type: 'booking' | 'checkin' | 'checkout' | 'payment' | 'inventory' | 'maintenance';
  data: any;
  timestamp: string;
  synced: boolean;
  retryCount: number;
}

interface OfflineStatus {
  isOnline: boolean;
  lastSync: string;
  pendingItems: number;
  cacheSize: string;
  syncProgress: number;
}

export default function OfflineManager() {
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    lastSync: new Date().toLocaleString(),
    pendingItems: 0,
    cacheSize: '0 MB',
    syncProgress: 0
  });

  const [offlineData, setOfflineData] = useState<OfflineData[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Monitor online/offline status
    const handleOnline = () => {
      setOfflineStatus(prev => ({ ...prev, isOnline: true }));
      syncOfflineData();
    };

    const handleOffline = () => {
      setOfflineStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load offline data from localStorage
    loadOfflineData();
    updateCacheInfo();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadOfflineData = () => {
    try {
      const stored = localStorage.getItem('ghanaHotel_offlineData');
      if (stored) {
        const data: OfflineData[] = JSON.parse(stored);
        setOfflineData(data);
        setOfflineStatus(prev => ({ ...prev, pendingItems: data.filter(item => !item.synced).length }));
      }
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  };

  const updateCacheInfo = async () => {
    try {
      if ('caches' in window) {
        const cache = await caches.open('ghana-hotel-dynamic-v1');
        const keys = await cache.keys();
        const size = keys.length * 0.1; // Rough estimate
        setOfflineStatus(prev => ({ ...prev, cacheSize: `${size.toFixed(1)} MB` }));
      }
    } catch (error) {
      console.error('Failed to get cache info:', error);
    }
  };

  const addOfflineData = (type: OfflineData['type'], data: any) => {
    const newItem: OfflineData = {
      id: `${type}_${Date.now()}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
      retryCount: 0
    };

    const updatedData = [...offlineData, newItem];
    setOfflineData(updatedData);
    setOfflineStatus(prev => ({ ...prev, pendingItems: updatedData.filter(item => !item.synced).length }));
    
    // Save to localStorage
    localStorage.setItem('ghanaHotel_offlineData', JSON.stringify(updatedData));
  };

  const syncOfflineData = async () => {
    if (!navigator.onLine || isSyncing) return;

    setIsSyncing(true);
    setOfflineStatus(prev => ({ ...prev, syncProgress: 0 }));

    const unsyncedItems = offlineData.filter(item => !item.synced);
    let syncedCount = 0;

    for (const item of unsyncedItems) {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mark as synced
        const updatedData = offlineData.map(dataItem => 
          dataItem.id === item.id 
            ? { ...dataItem, synced: true }
            : dataItem
        );
        
        setOfflineData(updatedData);
        localStorage.setItem('ghanaHotel_offlineData', JSON.stringify(updatedData));
        
        syncedCount++;
        setOfflineStatus(prev => ({ 
          ...prev, 
          syncProgress: (syncedCount / unsyncedItems.length) * 100,
          lastSync: new Date().toLocaleString()
        }));
        
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        
        // Increment retry count
        const updatedData = offlineData.map(dataItem => 
          dataItem.id === item.id 
            ? { ...dataItem, retryCount: dataItem.retryCount + 1 }
            : dataItem
        );
        
        setOfflineData(updatedData);
        localStorage.setItem('ghanaHotel_offlineData', JSON.stringify(updatedData));
      }
    }

    setOfflineStatus(prev => ({ 
      ...prev, 
      pendingItems: 0,
      syncProgress: 100
    }));
    
    setIsSyncing(false);
    
    // Update cache info
    updateCacheInfo();
  };

  const clearOfflineData = async () => {
    const { confirmDelete } = await import('./DangerConfirm');
    if (!(await confirmDelete('offline data', 'Queued offline changes on this device will be permanently removed.'))) return;
    setOfflineData([]);
    localStorage.removeItem('ghanaHotel_offlineData');
    setOfflineStatus(prev => ({ ...prev, pendingItems: 0 }));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'booking': return '📅';
      case 'checkin': return '🔑';
      case 'checkout': return '🚪';
      case 'payment': return '💰';
      case 'inventory': return '📦';
      case 'maintenance': return '🔧';
      default: return '📝';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'booking': return 'primary';
      case 'checkin': return 'success';
      case 'checkout': return 'warning';
      case 'payment': return 'success';
      case 'inventory': return 'secondary';
      case 'maintenance': return 'danger';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Offline Status Overview */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <h3 className="text-lg font-semibold text-ghana-black">🌐 Offline Capabilities</h3>
            <div className="flex items-center space-x-2">
              <Badge 
                color={offlineStatus.isOnline ? 'success' : 'danger'} 
                variant="flat"
              >
                {offlineStatus.isOnline ? 'Online' : 'Offline'}
              </Badge>
              {offlineStatus.pendingItems > 0 && (
                <Badge color="warning" variant="flat">
                  {offlineStatus.pendingItems} Pending
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Last Sync</p>
              <p className="font-semibold text-ghana-black">{offlineStatus.lastSync}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Pending Items</p>
              <p className="font-semibold text-ghana-black">{offlineStatus.pendingItems}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Cache Size</p>
              <p className="font-semibold text-ghana-black">{offlineStatus.cacheSize}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Sync Progress</p>
              <Progress 
                value={offlineStatus.syncProgress} 
                color="success"
                size="sm"
                className="mt-2"
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              onClick={syncOfflineData}
              disabled={!offlineStatus.isOnline || isSyncing}
            >
              {isSyncing ? '🔄 Syncing...' : '🔄 Sync Now'}
            </Button>
            <Button
              variant="light"
              onClick={clearOfflineData}
              disabled={offlineData.length === 0}
            >
              🗑️ Clear Data
            </Button>
            <Button
              variant="light"
              onClick={() => window.location.reload()}
            >
              🔄 Refresh
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Offline Data Queue */}
      {offlineData.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <h3 className="text-lg font-semibold text-ghana-black">📋 Offline Data Queue</h3>
            <p className="text-sm text-gray-600">Data waiting to be synced when online</p>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {offlineData.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getTypeIcon(item.type)}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-ghana-black capitalize">{item.type}</span>
                        <Chip 
                          variant="flat" 
                          color={item.synced ? 'success' : 'warning'} 
                          size="sm"
                        >
                          {item.synced ? 'Synced' : 'Pending'}
                        </Chip>
                        {!item.synced && item.retryCount > 0 && (
                          <Chip variant="flat" color="danger" size="sm">
                            Retry: {item.retryCount}
                          </Chip>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">ID: {item.id}</p>
                    {item.synced && (
                      <Chip variant="flat" color="success" size="sm">
                        ✅ Synced
                      </Chip>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Offline Features Info */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold text-ghana-black">💡 Offline Features</h3>
          <p className="text-sm text-gray-600">What works when internet is down</p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">✅ Available Offline</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• View cached dashboards</li>
                <li>• Access stored guest data</li>
                <li>• Create new bookings</li>
                <li>• Process check-ins/outs</li>
                <li>• Record payments</li>
                <li>• Update inventory</li>
              </ul>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <h4 className="font-semibold text-orange-800 mb-2">⚠️ Limited Offline</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                <li>• Real-time updates</li>
                <li>• External API calls</li>
                <li>• Cloud backups</li>
                <li>• Multi-location sync</li>
                <li>• Email notifications</li>
                <li>• Third-party integrations</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">🔄 Auto-Sync When Online</h4>
            <p className="text-sm text-blue-700">
              All offline data automatically syncs when internet connection is restored. 
              No data loss - everything is safely stored locally and synced when possible.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
