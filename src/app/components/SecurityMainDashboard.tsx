'use client';

import React from 'react';
import { Card, CardBody, CardHeader } from "@heroui/react";
import RecentActivities from './RecentActivities';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import SecurityComplianceDashboard from './SecurityComplianceDashboard';

export default function SecurityMainDashboard() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ghana-black">🛡️ Security & Compliance</h2>
      </div>

      <DeptMessenger from="security" mode="drawer" />

      <SecurityComplianceDashboard />

      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
            </CardHeader>
            <CardBody>
              <RecentActivities area="security" />
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 Security Notices</h3>
            </CardHeader>
            <CardBody>
              <DeptNotices dept="security" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
