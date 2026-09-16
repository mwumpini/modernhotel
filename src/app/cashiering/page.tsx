'use client';

import React from 'react';
import PageLayout from '../components/PageLayout';
import CashierShiftPanel from '../components/CashierShiftPanel';

export default function CashieringPage() {
  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-2">
            <h1 className="text-3xl font-bold text-gray-900">💵 Cashiering</h1>
            <p className="text-gray-600">Open/close till shifts and reconcile cash against real payments processed</p>
          </div>
          <CashierShiftPanel />
        </div>
      </div>
    </PageLayout>
  );
}
