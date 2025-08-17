'use client';

import React from 'react';
import { Card, CardBody, Button, Badge, Avatar } from "@heroui/react";

interface DashboardWrapperProps {
  title: string;
  subtitle: string;
  icon: string;
  children: React.ReactNode;
  quickActions?: Array<{
    title: string;
    icon: string;
    color: string;
    href: string;
  }>;
  stats?: Array<{
    label: string;
    value: string;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
    icon: string;
  }>;
}

export default function DashboardWrapper({ 
  title, 
  subtitle, 
  icon, 
  children, 
  quickActions = [],
  stats = []
}: DashboardWrapperProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Modern Header */}
      <div className="relative overflow-hidden bg-white border-b border-gray-100">
        <div className="absolute inset-0 bg-gradient-to-r from-ghana-green/5 via-ghana-gold/5 to-ghana-red/5"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="h-20 w-20 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-3xl flex items-center justify-center shadow-2xl">
                <span className="text-4xl">{icon}</span>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-ghana-black to-ghana-green bg-clip-text text-transparent">
                  {title}
                </h1>
                <p className="text-xl text-gray-600 mt-2">{subtitle}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Current Time</p>
                <p className="text-2xl font-mono font-bold text-ghana-green">
                  {new Date().toLocaleTimeString('en-GH')}
                </p>
              </div>
              <Avatar
                name="Admin User"
                className="h-12 w-12 bg-gradient-to-br from-ghana-green to-ghana-gold text-white text-lg font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      {stats.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <CardBody className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                      <p className="text-3xl font-bold text-ghana-black mt-1">{stat.value}</p>
                      <div className="flex items-center mt-2">
                        <Badge 
                          color={stat.changeType === 'positive' ? 'success' : stat.changeType === 'negative' ? 'danger' : 'default'} 
                          variant="flat"
                          size="sm"
                        >
                          {stat.change}
                        </Badge>
                        <span className="text-sm text-gray-500 ml-2">from yesterday</span>
                      </div>
                    </div>
                    <div className="text-4xl opacity-80">{stat.icon}</div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-ghana-black mb-4">🚀 Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  as="a"
                  href={action.href}
                  variant="flat"
                  className={`${action.color} text-white hover:opacity-90 transition-all duration-200 transform hover:scale-105 h-20 flex flex-col items-center justify-center space-y-2`}
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-sm font-medium">{action.title}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {children}
      </div>
    </div>
  );
}
