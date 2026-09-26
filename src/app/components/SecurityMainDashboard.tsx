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
  // Owns the one useDashboardVisibility call for the whole Security module —
  // passed down to SecurityComplianceDashboard, which renders the actual
  // "Customize View" control, so there's a single source of truth instead of
  // two components each keeping their own stale copy of the same storage key.
  const { isHidden, hide, toggle, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.security', SECURITY_DASHBOARD_SECTIONS);

  return (
    <div className={fullPage ? 'p-6 pt-2' : 'p-6'}>
      {!fullPage && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-ghana-black">🚨 Security Operations</h2>
            <div className="flex items-center gap-2">
              <CustomizeViewControl
                sections={SECURITY_DASHBOARD_SECTIONS}
                isHidden={isHidden}
                toggle={toggle}
                showAll={showAll}
                hiddenCount={hiddenCount}
              />
              <ModuleExpandButton
                href="/security/ops"
                label="Open security full page"
              />
            </div>
          </div>
          <DeptMessenger from="security" mode="drawer" />
        </>
      )}

      <SecurityComplianceDashboard
        fullPage={fullPage}
        isHidden={isHidden}
        hide={hide}
        toggle={toggle}
        showAll={showAll}
        hiddenCount={hiddenCount}
      />

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
