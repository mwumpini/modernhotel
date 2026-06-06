'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button,
  Tabs,
  Tab
} from "@heroui/react";
import { 
  BuildingOfficeIcon,
  HomeIcon,
  CalculatorIcon,
  CogIcon
} from '@heroicons/react/24/outline';
// Temporarily comment out imports to isolate the issue
// import CorporateRateManagement from './CorporateRateManagement';
import RoomRateManagement from './RoomRateManagement';
import RateCalculator from './RateCalculator';
import RateSettings from './RateSettings';

interface UnifiedRateManagementProps {
  onClose: () => void;
}

export default function UnifiedRateManagement({ onClose }: UnifiedRateManagementProps) {
  const [activeTab, setActiveTab] = useState('corporate-rates');
  
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rate Management System</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive pricing management for rooms, corporate clients, and events
          </p>
        </div>
        <Button 
          color="primary" 
          variant="flat" 
          onPress={onClose}
        >
          Close
        </Button>
      </div>

      <Tabs 
        selectedKey={activeTab} 
        onSelectionChange={(key) => setActiveTab(key as string)}
        className="w-full"
      >
        <Tab 
          key="corporate-rates" 
          title={
            <div className="flex items-center gap-2">
              <BuildingOfficeIcon className="w-4 h-4" />
              Corporate Rates
            </div>
          }
        >
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Corporate Rate Management</h2>
              <p className="text-sm text-gray-600">
                Manage corporate clients, rate agreements, and calculate event pricing
              </p>
            </CardHeader>
            <CardBody>
              {/* CorporateRateManagement removed during cleanup */}
              <div className="text-sm text-gray-500">Corporate rate module temporarily removed.</div>
            </CardBody>
          </Card>
        </Tab>

        <Tab 
          key="room-rates" 
          title={
            <div className="flex items-center gap-2">
              <HomeIcon className="w-4 h-4" />
              Room Rates
            </div>
          }
        >
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Room Rate Management</h2>
              <p className="text-sm text-gray-600">
                Configure base room rates, seasonal adjustments, and day-of-week pricing
              </p>
            </CardHeader>
            <CardBody>
              <RoomRateManagement />
            </CardBody>
          </Card>
        </Tab>

        <Tab 
          key="rate-calculator" 
          title={
            <div className="flex items-center gap-2">
              <CalculatorIcon className="w-4 h-4" />
              Rate Calculator
            </div>
          }
        >
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Rate Calculator</h2>
              <p className="text-sm text-gray-600">
                Calculate final rates for any combination of rooms, clients, and events
              </p>
            </CardHeader>
            <CardBody>
              <RateCalculator />
            </CardBody>
          </Card>
        </Tab>

        <Tab 
          key="rate-settings" 
          title={
            <div className="flex items-center gap-2">
              <CogIcon className="w-4 h-4" />
              Rate Settings
            </div>
          }
        >
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Rate Configuration</h2>
              <p className="text-sm text-gray-600">
                Global rate settings, tax configurations, and pricing rules
              </p>
            </CardHeader>
            <CardBody>
              <RateSettings />
            </CardBody>
          </Card>
        </Tab>
      </Tabs>
    </div>
  );
}
