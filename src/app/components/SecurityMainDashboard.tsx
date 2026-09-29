'use client';

import React from 'react';
import { Card, CardBody, CardHeader } from "@heroui/react";
import RecentActivities from './RecentActivities';
import DeptNotices from './DeptNotices';
import DeptMessenger from './DeptMessenger';
import SecurityComplianceDashboard, { SECURITY_DASHBOARD_SECTIONS } from './SecurityComplianceDashboard';
import CustomizeViewControl, { HideCardButton } from './dashboard/CustomizeViewControl';
import ModuleExpandButton from './ModuleExpandButton';
import { useDashboardVisibility } from '../lib/dashboard/useDashboardVisibility';

export default function SecurityMainDashboard({
  fullPage = false,
}: {
  fullPage?: boolean;
} = {}) {
  // Controls the Recent Activities/Notices cards below — the only hideable
  // sections left in the Security module now that Overview (with its own
  // hideable stat/quick-action cards) has been removed.
  const { isHidden, hide, toggle, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.security', SECURITY_DASHBOARD_SECTIONS);

  return (
    <div className={fullPage ? 'px-3 pt-1 pb-3' : 'p-6'}>
      <div className={`flex items-center justify-between ${fullPage ? 'mb-2' : 'mb-6'}`}>
        <h2 className={`${fullPage ? 'text-xl' : 'text-2xl'} font-bold text-ghana-black`}>🚨 Security Operations</h2>
        <div className="flex items-center gap-2">
          <CustomizeViewControl
            sections={SECURITY_DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggle}
            showAll={showAll}
            hiddenCount={hiddenCount}
          />
          {!fullPage && (
            <ModuleExpandButton
              href="/security/ops"
              label="Open security full page"
            />
          )}
        </div>
      </div>
      {!fullPage && <DeptMessenger from="security" mode="drawer" />}

      <SecurityComplianceDashboard fullPage={fullPage} />

      {!fullPage && (!isHidden('recentActivities') || !isHidden('notices')) && (
      <div className="mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {!isHidden('recentActivities') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">📋 Recent Activities</h3>
              <HideCardButton onHide={() => hide('recentActivities')} label="Recent Activities" />
            </CardHeader>
            <CardBody>
              <RecentActivities area="security" />
            </CardBody>
          </Card>
          )}

          {!isHidden('notices') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ghana-black">🔔 Security Notices</h3>
              <HideCardButton onHide={() => hide('notices')} label="Security Notices" />
            </CardHeader>
            <CardBody>
              <DeptNotices dept="security" title="" defaultTab="alerts" />
            </CardBody>
          </Card>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
