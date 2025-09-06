'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader } from "@heroui/react";

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-0 shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-20 w-20 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-full flex items-center justify-center">
            <span className="text-4xl">🏨</span>
          </div>
          <h1 className="text-2xl font-bold text-ghana-black">Ghana Hotel Management</h1>
          <p className="text-gray-600">You&apos;re currently offline</p>
        </CardHeader>
        
        <CardBody className="text-center space-y-6">
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium text-red-600">No Internet Connection</span>
              </div>
              <p className="text-sm text-red-700">
                Please check your internet connection and try again.
              </p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-600">Offline Features Available</span>
              </div>
              <p className="text-sm text-green-700">
                Essential data is cached for offline use. You can still access basic functions.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              color="primary"
              className="w-full bg-ghana-green text-white"
              onClick={handleRetry}
              size="lg"
            >
              🔄 Retry Connection
            </Button>
            
            <Button
              variant="light"
              className="w-full"
              onClick={handleGoHome}
              size="lg"
            >
              🏠 Go to Homepage
            </Button>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>• Check your Wi-Fi or mobile data connection</p>
            <p>• Try refreshing the page</p>
            <p>• Contact your IT administrator if the problem persists</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
