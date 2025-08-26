'use client';

import React from 'react';
import DepartmentActivityLog from '../DepartmentActivityLog';

export default function AccountingViewActivitiesPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">📋 Accounting Activities</h1>
        <p className="text-gray-600 mt-2">
          View and analyze all accounting-related activities and operations
        </p>
      </div>

      <DepartmentActivityLog 
        area="accounting" 
        title="Accounting - View Activities"
        showCategory={true}
        showAlias={true}
      />
    </div>
  );
}
