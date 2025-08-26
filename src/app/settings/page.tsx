'use client';

import React from 'react';
import PageLayout from '../components/PageLayout';
import { Card, CardBody, CardHeader, Button } from '@heroui/react';

export default function SettingsPage() {
  return (
    <PageLayout>
      <div className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">⚙️ Settings</h1>
            <p className="text-gray-600">Configure system settings and preferences</p>
          </div>

          {/* Content */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">System Configuration</h2>
            </CardHeader>
            <CardBody>
              <p className="text-gray-600 mb-4">
                This page will contain system configuration and settings management.
              </p>
              <Button color="primary" variant="flat">
                🔧 Configure
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
