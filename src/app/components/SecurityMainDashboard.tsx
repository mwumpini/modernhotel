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
import { useDashboardPeriod } from '../lib/dashboard/useDashboardPeriod';
import { useSummaryCollapsed } from '../lib/dashboard/useSummaryCollapsed';
import { SummaryToggle } from './dashboard/SummaryToggle';

export default function SecurityMainDashboard({
  fullPage = false,
  initialTab,
}: {
  fullPage?: boolean;
  initialTab?: string;
} = {}) {
  // Controls the Recent Activities/Notices cards below — the only hideable
  // sections left in the Security module now that Overview (with its own
  // hideable stat/quick-action cards) has been removed.
  const { isHidden, hide, toggle, showAll, hiddenCount } = useDashboardVisibility('dashboard.hidden.security', SECURITY_DASHBOARD_SECTIONS);
  const deskPeriod = useDashboardPeriod('dashboard.period.security', 'today');
  const { collapsed: summaryCollapsed, toggle: toggleSummary } = useSummaryCollapsed('security.summaryCollapsed');
  const [activeTab, setActiveTab] = React.useState(initialTab || 'patrols');

  return (
    <div className={fullPage ? 'px-3 pt-1 pb-3' : 'p-3 sm:p-4 md:p-6'}>
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${
          fullPage ? 'mb-2' : 'mb-3 sm:mb-4 md:mb-6'
        }`}
      >
        <h2
          className={`min-w-0 flex-1 font-bold text-ghana-black ${
            fullPage ? 'text-lg sm:text-xl' : 'text-lg sm:text-xl md:text-2xl'
          }`}
        >
          <span className="sm:hidden">🚨 Security</span>
          <span className="hidden sm:inline">🚨 Security Operations</span>
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <SummaryToggle collapsed={summaryCollapsed} onToggle={toggleSummary} />
          <CustomizeViewControl
            sections={SECURITY_DASHBOARD_SECTIONS}
            isHidden={isHidden}
            toggle={toggle}
            showAll={showAll}
            hiddenCount={hiddenCount}
            period={deskPeriod.period}
            onPeriodChange={deskPeriod.setPeriod}
            defaultPeriod={deskPeriod.defaultPeriod}
          />
          {!fullPage && (
            <ModuleExpandButton
              href={activeTab === 'reports' ? '/security/reports' : '/security/ops'}
              label={activeTab === 'reports' ? 'Open reports full page' : 'Open security full page'}
            />
          )}
        </div>
      </div>
      {!fullPage && <DeptMessenger from="security" mode="drawer" />}

      <SecurityComplianceDashboard
        fullPage={fullPage}
        initialTab={initialTab}
        onTabChange={setActiveTab}
        summaryCollapsed={summaryCollapsed}
      />

      {!fullPage && (!isHidden('recentActivities') || !isHidden('notices')) && (
      <div className="mt-4 sm:mt-6 md:mt-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          {!isHidden('recentActivities') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex items-center justify-between gap-2 px-3 py-2 sm:pb-3">
              <h3 className="min-w-0 text-base font-semibold text-ghana-black sm:text-xl">📋 Recent Activities</h3>
              <HideCardButton onHide={() => hide('recentActivities')} label="Recent Activities" />
            </CardHeader>
            <CardBody className="px-3 py-2 sm:p-3">
              <RecentActivities area="security" />
            </CardBody>
          </Card>
          )}

          {!isHidden('notices') && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex items-center justify-between gap-2 px-3 py-2 sm:pb-3">
              <h3 className="min-w-0 text-base font-semibold text-ghana-black sm:text-xl">🔔 Security Notices</h3>
              <HideCardButton onHide={() => hide('notices')} label="Security Notices" />
            </CardHeader>
            <CardBody className="px-3 py-2 sm:p-3">
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
