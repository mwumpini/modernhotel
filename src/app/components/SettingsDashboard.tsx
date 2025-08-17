'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Tabs, 
  Tab,
  Button,
  Input,
  Select,
  SelectItem,
  Switch,
  Divider
} from "@heroui/react";
import OfflineManager from './OfflineManager';
import ActivityLog from './ActivityLog';

export default function SettingsDashboard() {
  const [selectedTab, setSelectedTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ghana-black">System Settings</h1>
              <p className="text-gray-600 mt-2">Configure system parameters, security, and monitoring</p>
            </div>
          </div>
        </div>

        {/* Settings Tabs */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <Tabs 
              selectedKey={selectedTab} 
              onSelectionChange={(key) => setSelectedTab(key as string)}
              className="w-full"
            >
              <Tab key="overview" title="Overview" />
              <Tab key="activity-logs" title="Activity Logs" />
              <Tab key="offline-management" title="Offline Management" />
              <Tab key="user-management" title="User Management" />
              <Tab key="security" title="Security Settings" />
              <Tab key="ghana-compliance" title="Ghana Compliance" />
              <Tab key="integrations" title="Integrations" />
            </Tabs>
          </CardHeader>
          <CardBody>
            {selectedTab === "overview" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">System Overview</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="border-0 shadow-lg">
                    <CardBody className="p-4">
                      <div className="text-center">
                        <h4 className="font-semibold text-ghana-black">Security Status</h4>
                        <p className="text-sm text-gray-600">All systems secure</p>
                        <div className="mt-2">
                          <span className="inline-block h-3 w-3 bg-green-500 rounded-full"></span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardBody className="p-4">
                      <div className="text-center">
                        <h4 className="font-semibold text-ghana-black">Offline Status</h4>
                        <p className="text-sm text-gray-600">Ready for offline use</p>
                        <div className="mt-2">
                          <span className="inline-block h-3 w-3 bg-green-500 rounded-full"></span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardBody className="p-4">
                      <div className="text-center">
                        <h4 className="font-semibold text-ghana-black">Ghana Compliance</h4>
                        <p className="text-sm text-gray-600">Up to date</p>
                        <div className="mt-2">
                          <span className="inline-block h-3 w-3 bg-green-500 rounded-full"></span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <h4 className="text-lg font-semibold text-ghana-black">Quick Actions</h4>
                    </CardHeader>
                    <CardBody className="space-y-3">
                      <Button
                        variant="light"
                        className="w-full justify-start"
                        onClick={() => setSelectedTab("activity-logs")}
                      >
                        📋 View Activity Logs
                      </Button>
                      <Button
                        variant="light"
                        className="w-full justify-start"
                        onClick={() => setSelectedTab("offline-management")}
                      >
                        🌐 Manage Offline Settings
                      </Button>
                      <Button
                        variant="light"
                        className="w-full justify-start"
                        onClick={() => setSelectedTab("security")}
                      >
                        🔒 Security Settings
                      </Button>
                    </CardBody>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <h4 className="text-lg font-semibold text-ghana-black">System Information</h4>
                    </CardHeader>
                    <CardBody className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Version</span>
                        <span className="text-sm font-medium">2.1.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Last Updated</span>
                        <span className="text-sm font-medium">2024-01-15</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Database</span>
                        <span className="text-sm font-medium">PostgreSQL 15</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Environment</span>
                        <span className="text-sm font-medium">Production</span>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            )}

            {selectedTab === "activity-logs" && (
              <ActivityLog />
            )}

            {selectedTab === "offline-management" && (
              <OfflineManager />
            )}

            {selectedTab === "user-management" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">User Management</h3>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">User Role Matrix</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label="Search Users"
                          placeholder="Search by name or email"
                        />
                        <Select
                          label="Role Filter"
                          placeholder="All Roles"
                        >
                          <SelectItem key="admin">Administrator</SelectItem>
                          <SelectItem key="manager">Manager</SelectItem>
                          <SelectItem key="staff">Staff</SelectItem>
                          <SelectItem key="viewer">Viewer</SelectItem>
                        </Select>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">
                          User management interface will be implemented here with role-based access control,
                          user creation, editing, and permission management.
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {selectedTab === "security" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">Security Settings</h3>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Authentication & Access</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-ghana-black">Two-Factor Authentication</h5>
                        <p className="text-sm text-gray-600">Require 2FA for all users</p>
                      </div>
                      <Switch defaultSelected />
                    </div>
                    
                    <Divider />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-ghana-black">Session Timeout</h5>
                        <p className="text-sm text-gray-600">Auto-logout after inactivity</p>
                      </div>
                      <Select
                        defaultSelectedKeys={["30"]}
                        className="w-32"
                      >
                        <SelectItem key="15">15 min</SelectItem>
                        <SelectItem key="30">30 min</SelectItem>
                        <SelectItem key="60">1 hour</SelectItem>
                        <SelectItem key="120">2 hours</SelectItem>
                      </Select>
                    </div>
                    
                    <Divider />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-ghana-black">IP Whitelist</h5>
                        <p className="text-sm text-gray-600">Restrict access to specific IP addresses</p>
                      </div>
                      <Switch />
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {selectedTab === "ghana-compliance" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">Ghana Compliance Settings</h3>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Tax Configuration</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="VAT Rate (%)"
                        placeholder="12.5"
                        type="number"
                        step="0.1"
                      />
                      <Input
                        label="NHIL Rate (%)"
                        placeholder="2.5"
                        type="number"
                        step="0.1"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Tourism Levy (%)"
                        placeholder="1.0"
                        type="number"
                        step="0.1"
                      />
                      <Input
                        label="SSNIT Rate (%)"
                        placeholder="5.5"
                        type="number"
                        step="0.1"
                      />
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> These rates are automatically applied to all transactions
                        and can be overridden for specific cases. Changes require administrator approval.
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {selectedTab === "integrations" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">System Integrations</h3>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Payment Gateways</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">📱</span>
                          <div>
                            <h5 className="font-medium text-ghana-black">Mobile Money APIs</h5>
                            <p className="text-sm text-gray-600">MTN, Vodafone, AirtelTigo integration</p>
                          </div>
                        </div>
                        <Switch defaultSelected />
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">🏦</span>
                          <div>
                            <h5 className="font-medium text-ghana-black">Bank Integration</h5>
                            <p className="text-sm text-gray-600">Local bank payment processing</p>
                          </div>
                        </div>
                        <Switch />
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">💳</span>
                          <div>
                            <h5 className="font-medium text-ghana-black">Credit Card Processing</h5>
                            <p className="text-sm text-gray-600">International payment support</p>
                          </div>
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
