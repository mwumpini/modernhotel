'use client';

import React, { useState, useEffect } from 'react';
import { Badge, Button, Tooltip } from "@heroui/react";
import { useServiceWorker } from '../hooks/useServiceWorker';

interface OfflineIndicatorProps {
  className?: string;
}

export default function OfflineIndicator({ className = '' }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingItems, setPendingItems] = useState(0);
  const { isRegistered, hasUpdate } = useServiceWorker();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for pending offline data
    const checkPendingData = () => {
      try {
        const stored = localStorage.getItem('ghanaHotel_offlineData');
        if (stored) {
          const data = JSON.parse(stored);
          const pending = data.filter((item: any) => !item.synced).length;
          setPendingItems(pending);
        }
      } catch (error) {
        console.error('Failed to check pending data:', error);
      }
    };

    checkPendingData();
    const interval = setInterval(checkPendingData, 5000); // Check every 5 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = () => {
    if (!isOnline) return 'danger';
    if (pendingItems > 0) return 'warning';
    if (hasUpdate) return 'secondary';
    return 'success';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (pendingItems > 0) return `${pendingItems} Pending`;
    if (hasUpdate) return 'Update Available';
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!isOnline) return '📡';
    if (pendingItems > 0) return '⏳';
    if (hasUpdate) return '🔄';
    return '✅';
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Tooltip content={getStatusText()}>
        <Badge 
          color={getStatusColor()} 
          variant="flat"
          className="cursor-pointer"
        >
          <span className="mr-1">{getStatusIcon()}</span>
          {getStatusText()}
        </Badge>
      </Tooltip>
      
      {!isOnline && (
        <Tooltip content="You're currently offline. Some features may be limited.">
          <Badge color="danger" variant="flat" size="sm">
            ⚠️ Limited
          </Badge>
        </Tooltip>
      )}
      
      {pendingItems > 0 && isOnline && (
        <Tooltip content={`${pendingItems} items waiting to sync`}>
          <Badge color="warning" variant="flat" size="sm">
            🔄 {pendingItems}
          </Badge>
        </Tooltip>
      )}
      
      {hasUpdate && (
        <Tooltip content="New version available. Click to update.">
          <Button
            size="sm"
            color="secondary"
            variant="flat"
            className="h-6 px-2 text-xs"
            onClick={() => window.location.reload()}
          >
            Update
          </Button>
        </Tooltip>
      )}
    </div>
  );
}
