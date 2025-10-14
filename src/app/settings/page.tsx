'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Tabs, Tab, Button, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { useSearchParams } from 'next/navigation';
import PaymentMethodsSettings from '../components/settings/PaymentMethodsSettings';
import TaxManagementSettings from '../components/settings/TaxManagementSettings';
import ClientSettingsPanel from '../components/settings/ClientSettingsPanel';
import TemplateBuilder from '../components/TemplateBuilder';
import DocumentTemplateSettings from '../components/settings/DocumentTemplateSettings';

function SettingsPageContent() {
  const [activeTab, setActiveTab] = useState('general');
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['general', 'room-configuration', 'payment-methods', 'tax-management', 'client-settings', 'templates', 'system-health'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
      </div>
      
      <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as string)}>
        <Tab key="general" title="📊 Overview">
          <div className="p-4">
            <p>General system settings go here...</p>
          </div>
        </Tab>
        <Tab key="user-management" title="👥 User Management">
          <div className="p-4">
            <p>User management settings...</p>
          </div>
        </Tab>
        <Tab key="templates" title="Document Templates">
          <div className="p-4">
            <DocumentTemplateSettings />
          </div>
        </Tab>
        <Tab key="template-builder" title="Template Builder">
          <div className="p-4">
            <TemplateBuilder />
          </div>
        </Tab>
        
        <Tab key="room-configuration" title="🏠 Room Configuration">
          <div className="p-4">
            <h3 className="text-xl font-semibold mb-4">Room Management</h3>
            <p>Configure room types, numbering, and availability...</p>
            {/* Your existing room configuration content */}
          </div>
        </Tab>
        
        <Tab key="rate-management" title="💰 Rate Management">
          <div className="p-4">
            <p>Rate management settings...</p>
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
        
        <Tab key="system-health" title="💚 System Health">
          <div className="p-4">
            <h3 className="text-xl font-semibold mb-4">System Health</h3>
            <p>Monitor system performance, database status, and logs...</p>
            {/* Your existing system health content */}
          </div>
        </Tab>
        <Tab key="security-settings" title="🔒 Security Setting">
          <div className="p-4">
            <p>Security settings...</p>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsPageContent />
    </Suspense>
  );
}
