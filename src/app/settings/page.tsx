'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Tabs, Tab, Button, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { useSearchParams } from 'next/navigation';
import PaymentMethodsSettings from '../components/settings/PaymentMethodsSettings';
import TaxManagementSettings from '../components/settings/TaxManagementSettings';
import ClientSettingsPanel from '../components/settings/ClientSettingsPanel';

function SettingsContent() {
  const [activeTab, setActiveTab] = useState('general');
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['general', 'room-configuration', 'payment-methods', 'tax-management', 'client-settings', 'system-health'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
      </div>
      
      <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as string)}>
        <Tab key="general" title="General Settings">
          <div className="p-4">
            <p>General system settings go here...</p>
          </div>
        </Tab>
        
        <Tab key="room-configuration" title="Room Configuration">
          <div className="p-4">
            <h3 className="text-xl font-semibold mb-4">Room Management</h3>
            <p>Configure room types, numbering, and availability...</p>
            {/* Your existing room configuration content */}
          </div>
        </Tab>
        
        <Tab key="payment-methods" title="Payment Methods">
          <div className="p-4">
            <PaymentMethodsSettings />
          </div>
        </Tab>
        
        <Tab key="tax-management" title="Tax Management">
          <div className="p-4">
            <TaxManagementSettings />
          </div>
        </Tab>
        
        <Tab key="client-settings" title="Client Settings">
          <div className="p-4">
            <ClientSettingsPanel />
          </div>
        </Tab>
        
        <Tab key="system-health" title="System Health">
          <div className="p-4">
            <h3 className="text-xl font-semibold mb-4">System Health</h3>
            <p>Monitor system performance, database status, and logs...</p>
            {/* Your existing system health content */}
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading Settings...</h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
