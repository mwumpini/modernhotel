'use client';

import React, { useState, useEffect } from 'react';
import HeadingInfo from './HeadingInfo';
import { 
  Card, 
  CardBody, 
  Button, 
  Progress, 
  Badge,
  useDisclosure
} from "@heroui/react";

interface NightAuditStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  isAutomated: boolean;
  requiresApproval: boolean;
  estimatedTime: number;
  actualTime?: number;
  notes?: string;
}

export default function NightAudit() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [currentStep, setCurrentStep] = useState(0);
  const [auditSteps, setAuditSteps] = useState<NightAuditStep[]>([
    {
      id: 'pre-audit',
      title: '🕐 Pre-Audit Preparation',
      description: 'System readiness check, backup verification, user session cleanup',
      status: 'pending',
      isAutomated: true,
      requiresApproval: false,
      estimatedTime: 5
    },
    {
      id: 'revenue-reconciliation',
      title: '💰 Revenue Reconciliation',
      description: 'Daily revenue totals, payment method reconciliation, mobile money verification',
      status: 'pending',
      isAutomated: true,
      requiresApproval: true,
      estimatedTime: 15
    },
    {
      id: 'room-status-update',
      title: '🏠 Room Status Update',
      description: 'Occupancy verification, housekeeping status sync, maintenance alerts',
      status: 'pending',
      isAutomated: true,
      requiresApproval: false,
      estimatedTime: 10
    },
    {
      id: 'guest-accounting',
      title: '📊 Guest Accounting',
      description: 'Folio balancing, credit limit checks, deposit reconciliation',
      status: 'pending',
      isAutomated: true,
      requiresApproval: true,
      estimatedTime: 20
    },
    {
      id: 'tax-calculations',
      title: '🧾 Ghana Tax Calculations',
      description: 'VAT, NHIL, GETFund, Tourism Levy, withholding tax',
      status: 'pending',
      isAutomated: true,
      requiresApproval: true,
      estimatedTime: 12
    },
    {
      id: 'inventory-update',
      title: '📦 Inventory & F&B Update',
      description: 'Stock levels, COGS calculation, waste tracking, reorder alerts',
      status: 'pending',
      isAutomated: true,
      requiresApproval: false,
      estimatedTime: 18
    },
    {
      id: 'compliance-checks',
      title: '✅ Ghana Compliance Checks',
      description: 'GRA requirements, SSNIT validation, tourism levy compliance',
      status: 'pending',
      isAutomated: true,
      requiresApproval: true,
      estimatedTime: 15
    },
    {
      id: 'financial-reports',
      title: '📈 Financial Reports Generation',
      description: 'Daily P&L, balance sheet update, cash flow statement',
      status: 'pending',
      isAutomated: true,
      requiresApproval: true,
      estimatedTime: 25
    },
    {
      id: 'backup-archive',
      title: '💾 Backup & Archive',
      description: 'Daily backup, audit trail archive, compliance document storage',
      status: 'pending',
      isAutomated: true,
      requiresApproval: false,
      estimatedTime: 8
    },
    {
      id: 'post-audit',
      title: '🔍 Post-Audit Verification',
      description: 'System integrity check, error log review, performance metrics',
      status: 'pending',
      isAutomated: true,
      requiresApproval: false,
      estimatedTime: 10
    }
  ]);

  const [auditProgress, setAuditProgress] = useState(0);
  const [isAuditRunning, setIsAuditRunning] = useState(false);
  const [auditStartTime, setAuditStartTime] = useState<Date | null>(null);
  const [totalTime, setTotalTime] = useState(0);

  useEffect(() => {
    if (isAuditRunning) {
      const interval = setInterval(() => {
        setTotalTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isAuditRunning]);

  const startNightAudit = async () => {
    setIsAuditRunning(true);
    setAuditStartTime(new Date());
    setTotalTime(0);
    
    // Simulate automated night audit process
    for (let i = 0; i < auditSteps.length; i++) {
      setCurrentStep(i);
      
      // Update step status to in-progress
      setAuditSteps(prev => prev.map((step, index) => 
        index === i ? { ...step, status: 'in-progress' } : step
      ));
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update step status to completed
      setAuditSteps(prev => prev.map((step, index) => 
        index === i ? { ...step, status: 'completed', actualTime: auditSteps[i].estimatedTime } : step
      ));
      
      // Update progress
      setAuditProgress(((i + 1) / auditSteps.length) * 100);
    }
    
    setIsAuditRunning(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in-progress': return 'primary';
      case 'error': return 'danger';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in-progress': return '🔄';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-3xl font-bold text-ghana-black">🌙 Night Audit Automation</h1>
                <HeadingInfo label="About night audit">Complete automated end-of-day processing for Ghanaian compliance</HeadingInfo>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Current Time</p>
              <p className="text-2xl font-mono font-bold text-ghana-green">
                {new Date().toLocaleTimeString('en-GH')}
              </p>
            </div>
          </div>
        </div>

        {/* Audit Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <h3 className="text-lg font-semibold text-ghana-black mb-4">🎯 Audit Control</h3>
              <div className="space-y-4">
                <Button
                  color="success"
                  size="lg"
                  className="w-full bg-gradient-to-r from-ghana-green to-ghana-gold text-white"
                  onClick={startNightAudit}
                  disabled={isAuditRunning}
                >
                  {isAuditRunning ? '🔄 Running...' : '🚀 Start Night Audit'}
                </Button>
                
                {isAuditRunning && (
                  <div className="text-center">
                    <Progress 
                      value={auditProgress} 
                      className="mb-2"
                      color="success"
                    />
                    <p className="text-sm text-gray-600">{auditProgress.toFixed(1)}% Complete</p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <h3 className="text-lg font-semibold text-ghana-black mb-4">⏱️ Time Tracking</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Time:</span>
                  <span className="font-mono font-bold text-ghana-green">
                    {formatTime(totalTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estimated Total:</span>
                  <span className="font-mono font-bold text-ghana-gold">
                    {auditSteps.reduce((acc, step) => acc + step.estimatedTime, 0)}m
                  </span>
                </div>
                {auditStartTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Started:</span>
                    <span className="text-sm text-gray-500">
                      {auditStartTime.toLocaleTimeString('en-GH')}
                    </span>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <h3 className="text-lg font-semibold text-ghana-black mb-4">📊 Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Steps:</span>
                  <Badge color="primary" variant="flat">{auditSteps.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Automated:</span>
                  <Badge color="success" variant="flat">
                    {auditSteps.filter(s => s.isAutomated).length}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Manual Review:</span>
                  <Badge color="warning" variant="flat">
                    {auditSteps.filter(s => s.requiresApproval).length}
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Audit Steps */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-ghana-black mb-6">📋 Night Audit Steps</h2>
          
          <div className="space-y-4">
            {auditSteps.map((step, index) => (
              <Card 
                key={step.id} 
                className={`border-2 transition-all duration-300 ${
                  step.status === 'in-progress' ? 'border-ghana-green shadow-lg' :
                  step.status === 'completed' ? 'border-ghana-gold bg-green-50' :
                  'border-gray-200'
                }`}
              >
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">{getStatusIcon(step.status)}</div>
                      <div>
                        <h3 className="font-semibold text-ghana-black">{step.title}</h3>
                        <p className="text-sm text-gray-600">{step.description}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <Badge 
                            color={getStatusColor(step.status)} 
                            variant="flat"
                            size="sm"
                          >
                            {step.status.replace('-', ' ')}
                          </Badge>
                          {step.isAutomated && (
                            <Badge color="success" variant="flat" size="sm">🤖 Auto</Badge>
                          )}
                          {step.requiresApproval && (
                            <Badge color="warning" variant="flat" size="sm">👁️ Review</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Estimated</div>
                      <div className="font-mono font-bold text-ghana-gold">
                        {step.estimatedTime}m
                      </div>
                      {step.actualTime && (
                        <>
                          <div className="text-sm text-gray-500">Actual</div>
                          <div className="font-mono font-bold text-ghana-green">
                            {step.actualTime}m
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {step.status === 'completed' && step.notes && (
                    <div className="mt-3 p-3 bg-green-100 rounded-lg">
                      <p className="text-sm text-green-800">{step.notes}</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        {/* Ghana Compliance Summary */}
        <div className="mt-6 bg-gradient-to-r from-ghana-green/10 to-ghana-gold/10 rounded-2xl border border-ghana-green/20 p-6">
          <h2 className="text-2xl font-bold text-ghana-black mb-4">🇬🇭 Ghana Compliance Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-semibold text-ghana-black mb-2">🧾 Tax Compliance</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• VAT calculation & reporting</li>
                <li>• NHIL (2.5%) processing</li>
                <li>• Tourism Levy collection</li>
                <li>• Withholding tax management</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-semibold text-ghana-black mb-2">🏦 Financial Reporting</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• GRA-compliant receipts</li>
                <li>• Ghana GAAP standards</li>
                <li>• Mobile money reconciliation</li>
                <li>• Multi-currency handling</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-semibold text-ghana-black mb-2">👥 HR Compliance</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• SSNIT contributions</li>
                <li>• PAYE calculations</li>
                <li>• Ghana Card verification</li>
                <li>• Work permit validation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
