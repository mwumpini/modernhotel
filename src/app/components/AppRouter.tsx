'use client';

import React, { useState } from 'react';
import Dashboard from './Dashboard';
import FrontdeskDashboard from './FrontdeskDashboard';
import HousekeepingDashboard from './HousekeepingDashboard';
import FoodBeverageDashboard from './FoodBeverageDashboard';
import SecurityDashboard from './SecurityDashboard';
import NightAudit from './NightAudit';
import GhanaCompliance from './GhanaCompliance';

type Route = 'dashboard' | 'frontdesk' | 'housekeeping' | 'f&b' | 'security' | 'night-audit' | 'compliance';

export default function AppRouter() {
  const [currentRoute, setCurrentRoute] = useState<Route>('dashboard');

  const renderComponent = () => {
    switch (currentRoute) {
      case 'frontdesk':
        return <FrontdeskDashboard />;
      case 'housekeeping':
        return <HousekeepingDashboard />;
      case 'f&b':
        return <FoodBeverageDashboard />;
      case 'security':
        return <SecurityDashboard />;
      case 'night-audit':
        return <NightAudit />;
      case 'compliance':
        return <GhanaCompliance />;
      default:
        return <Dashboard />;
    }
  };

  // This component will be used to handle routing between dashboards
  // In a real app, you'd use Next.js routing or React Router
  return (
    <div>
      {renderComponent()}
    </div>
  );
}
