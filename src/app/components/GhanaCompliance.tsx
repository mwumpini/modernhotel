'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Progress, 
  Badge, 
  Input,
  Textarea,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tabs,
  Tab
} from "@heroui/react";

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  description: string;
  isActive: boolean;
  lastUpdated: string;
}

interface ComplianceReport {
  id: string;
  type: 'VAT' | 'NHIL' | 'Tourism' | 'SSNIT' | 'PAYE';
  period: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  amount: number;
  currency: string;
  submittedDate?: string;
  notes?: string;
}

interface GhanaCardVerification {
  id: string;
  cardNumber: string;
  guestName: string;
  verificationStatus: 'pending' | 'verified' | 'failed';
  verificationDate: string;
  notes?: string;
}

export default function GhanaCompliance() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedTab, setSelectedTab] = useState("tax-rates");
  const [complianceScore, setComplianceScore] = useState(87);

  const taxRates: TaxRate[] = [
    {
      id: '1',
      name: 'Value Added Tax (VAT)',
      rate: 12.5,
      description: 'Standard VAT rate for goods and services',
      isActive: true,
      lastUpdated: '2024-01-15'
    },
    {
      id: '2',
      name: 'National Health Insurance Levy (NHIL)',
      rate: 2.5,
      description: 'NHIL for healthcare funding',
      isActive: true,
      lastUpdated: '2024-01-15'
    },
    {
      id: '3',
      name: 'Tourism Levy',
      rate: 1.0,
      description: 'Tourism development levy',
      isActive: true,
      lastUpdated: '2024-01-15'
    },
    {
      id: '4',
      name: 'Withholding Tax (WHT)',
      rate: 15.0,
      description: 'Withholding tax on services',
      isActive: true,
      lastUpdated: '2024-01-15'
    },
    {
      id: '5',
      name: 'PAYE',
      rate: 0.0,
      description: 'Pay As You Earn - calculated based on income bands',
      isActive: true,
      lastUpdated: '2024-01-15'
    }
  ];

  const complianceReports: ComplianceReport[] = [
    {
      id: '1',
      type: 'VAT',
      period: 'January 2024',
      dueDate: '2024-02-20',
      status: 'submitted',
      amount: 45678.50,
      currency: 'GHS',
      submittedDate: '2024-02-15'
    },
    {
      id: '2',
      type: 'NHIL',
      period: 'January 2024',
      dueDate: '2024-02-20',
      status: 'submitted',
      amount: 9135.70,
      currency: 'GHS',
      submittedDate: '2024-02-15'
    },
    {
      id: '3',
      type: 'Tourism',
      period: 'January 2024',
      dueDate: '2024-02-20',
      status: 'submitted',
      amount: 3654.28,
      currency: 'GHS',
      submittedDate: '2024-02-15'
    },
    {
      id: '4',
      type: 'SSNIT',
      period: 'January 2024',
      dueDate: '2024-02-15',
      status: 'submitted',
      amount: 12345.00,
      currency: 'GHS',
      submittedDate: '2024-02-10'
    },
    {
      id: '5',
      type: 'PAYE',
      period: 'January 2024',
      dueDate: '2024-02-15',
      status: 'pending',
      amount: 23456.00,
      currency: 'GHS'
    }
  ];

  const ghanaCardVerifications: GhanaCardVerification[] = [
    {
      id: '1',
      cardNumber: 'GHA-123456789-0',
      guestName: 'Kwame Asante',
      verificationStatus: 'verified',
      verificationDate: '2024-01-15',
      notes: 'Valid Ghana Card verified through GRA API'
    },
    {
      id: '2',
      cardNumber: 'GHA-987654321-0',
      guestName: 'Ama Osei',
      verificationStatus: 'verified',
      verificationDate: '2024-01-16',
      notes: 'Valid Ghana Card verified through GRA API'
    },
    {
      id: '3',
      cardNumber: 'GHA-456789123-0',
      guestName: 'Kofi Mensah',
      verificationStatus: 'pending',
      verificationDate: '2024-01-17'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'success';
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      default: return 'default';
    }
  };

  const getVerificationColor = (status: string) => {
    switch (status) {
      case 'verified': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      default: return 'default';
    }
  };

  const calculateComplianceScore = () => {
    const totalReports = complianceReports.length;
    const submittedReports = complianceReports.filter(r => r.status === 'submitted' || r.status === 'approved').length;
    const pendingReports = complianceReports.filter(r => r.status === 'pending').length;
    
    let score = (submittedReports / totalReports) * 80;
    if (pendingReports > 0) {
      score += (pendingReports / totalReports) * 20;
    }
    
    return Math.round(score);
  };

  useEffect(() => {
    setComplianceScore(calculateComplianceScore());
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ghana-black">🇬🇭 Ghana Compliance Center</h1>
              <p className="text-gray-600 mt-2">Complete regulatory compliance management for Ghanaian hospitality</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Compliance Score</div>
              <div className="text-3xl font-bold text-ghana-green">{complianceScore}%</div>
              <Progress 
                value={complianceScore} 
                className="w-24 mt-2"
                color={complianceScore >= 80 ? 'success' : complianceScore >= 60 ? 'warning' : 'danger'}
              />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-xl flex items-center justify-center mr-4">
                  <span className="text-2xl">🧾</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tax Reports</p>
                  <p className="text-2xl font-bold text-ghana-black">
                    {complianceReports.filter(r => r.type === 'VAT' || r.type === 'NHIL' || r.type === 'Tourism').length}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-gradient-to-br from-ghana-red to-ghana-gold rounded-xl flex items-center justify-center mr-4">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">HR Compliance</p>
                  <p className="text-2xl font-bold text-ghana-black">
                    {complianceReports.filter(r => r.type === 'SSNIT' || r.type === 'PAYE').length}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-ghana-gold rounded-xl flex items-center justify-center mr-4">
                  <span className="text-2xl">🆔</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Ghana Cards</p>
                  <p className="text-2xl font-bold text-ghana-black">
                    {ghanaCardVerifications.length}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-gradient-to-br from-ghana-green to-ghana-red rounded-xl flex items-center justify-center mr-4">
                  <span className="text-2xl">💰</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Tax Due</p>
                  <p className="text-2xl font-bold text-ghana-black">
                    ₵{complianceReports.reduce((acc, r) => acc + r.amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card className="border-0 shadow-lg">
          <CardBody className="p-0">
            <Tabs 
              selectedKey={selectedTab} 
              onSelectionChange={(key) => setSelectedTab(key as string)}
              className="w-full"
              classNames={{
                tabList: "gap-6 w-full relative rounded-none p-6 border-b border-divider",
                cursor: "w-full bg-ghana-green",
                tab: "max-w-fit px-0 h-12",
                tabContent: "group-data-[selected=true]:text-ghana-green"
              }}
            >
              <Tab key="tax-rates" title="🧾 Tax Rates & Rules">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-ghana-black">Tax Rates Configuration</h2>
                    <Button 
                      color="primary" 
                      className="bg-ghana-green text-white"
                      onPress={onOpen}
                    >
                      + Add Tax Rate
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {taxRates.map((tax) => (
                      <Card key={tax.id} className="border border-gray-200">
                        <CardBody className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-xl flex items-center justify-center">
                                <span className="text-xl font-bold text-white">{tax.rate}%</span>
                              </div>
                              <div>
                                <h3 className="font-semibold text-ghana-black">{tax.name}</h3>
                                <p className="text-sm text-gray-600">{tax.description}</p>
                                <p className="text-xs text-gray-500">Last updated: {tax.lastUpdated}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Badge 
                                color={tax.isActive ? 'success' : 'default'} 
                                variant="flat"
                              >
                                {tax.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              <Button size="sm" variant="light">Edit</Button>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>
              </Tab>

              <Tab key="compliance-reports" title="📊 Compliance Reports">
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-ghana-black mb-6">Compliance Reports Status</h2>
                  
                  <Table aria-label="Compliance reports table">
                    <TableHeader>
                      <TableColumn>Type</TableColumn>
                      <TableColumn>Period</TableColumn>
                      <TableColumn>Due Date</TableColumn>
                      <TableColumn>Amount</TableColumn>
                      <TableColumn>Status</TableColumn>
                      <TableColumn>Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {complianceReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {report.type === 'VAT' ? '🧾' : 
                                 report.type === 'NHIL' ? '🏥' :
                                 report.type === 'Tourism' ? '🏖️' :
                                 report.type === 'SSNIT' ? '👥' : '💰'}
                              </span>
                              <span className="font-medium">{report.type}</span>
                            </div>
                          </TableCell>
                          <TableCell>{report.period}</TableCell>
                          <TableCell>{report.dueDate}</TableCell>
                          <TableCell>
                            <span className="font-mono font-bold text-ghana-green">
                              ₵{report.amount.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              color={getStatusColor(report.status)} 
                              variant="flat"
                            >
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {report.status === 'pending' && (
                                <Button size="sm" color="success">Submit</Button>
                              )}
                              <Button size="sm" variant="light">View</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Tab>

              <Tab key="ghana-card" title="🆔 Ghana Card Verification">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-ghana-black">Ghana Card Verification</h2>
                    <Button 
                      color="primary" 
                      className="bg-ghana-green text-white"
                    >
                      🔍 Verify New Card
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {ghanaCardVerifications.map((verification) => (
                      <Card key={verification.id} className="border border-gray-200">
                        <CardBody className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-xl flex items-center justify-center">
                                <span className="text-xl">🆔</span>
                              </div>
                              <div>
                                <h3 className="font-semibold text-ghana-black">{verification.guestName}</h3>
                                <p className="text-sm text-gray-600 font-mono">{verification.cardNumber}</p>
                                <p className="text-xs text-gray-500">Verified: {verification.verificationDate}</p>
                                {verification.notes && (
                                  <p className="text-xs text-gray-600 mt-1">{verification.notes}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Badge 
                                color={getVerificationColor(verification.verificationStatus)} 
                                variant="flat"
                              >
                                {verification.verificationStatus}
                              </Badge>
                              <Button size="sm" variant="light">Re-verify</Button>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>
              </Tab>

              <Tab key="mobile-money" title="📱 Mobile Money Integration">
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-ghana-black mb-6">Mobile Money Reconciliation</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border border-gray-200">
                      <CardHeader>
                        <h3 className="text-lg font-semibold text-ghana-black">MTN Mobile Money</h3>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span>API Status:</span>
                            <Badge color="success" variant="flat">Connected</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Last Sync:</span>
                            <span className="text-sm text-gray-600">2 minutes ago</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Today's Transactions:</span>
                            <span className="font-bold text-ghana-green">₵12,450</span>
                          </div>
                          <Button size="sm" color="primary" className="w-full">Reconcile Now</Button>
                        </div>
                      </CardBody>
                    </Card>

                    <Card className="border border-gray-200">
                      <CardHeader>
                        <h3 className="text-lg font-semibold text-ghana-black">Vodafone Cash</h3>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span>API Status:</span>
                            <Badge color="success" variant="flat">Connected</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Last Sync:</span>
                            <span className="text-sm text-gray-600">5 minutes ago</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Today's Transactions:</span>
                            <span className="font-bold text-ghana-green">₵8,920</span>
                          </div>
                          <Button size="sm" color="primary" className="w-full">Reconcile Now</Button>
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-ghana-black mb-4">Reconciliation Summary</h3>
                    <div className="bg-gradient-to-r from-ghana-green/10 to-ghana-gold/10 rounded-xl p-6 border border-ghana-green/20">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-sm text-gray-600">Total Mobile Money</p>
                          <p className="text-2xl font-bold text-ghana-green">₵21,370</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Reconciled</p>
                          <p className="text-2xl font-bold text-ghana-gold">₵21,370</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Discrepancies</p>
                          <p className="text-2xl font-bold text-ghana-red">₵0</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Tab>

              <Tab key="settings" title="⚙️ Compliance Settings">
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-ghana-black mb-6">Compliance Configuration</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border border-gray-200">
                      <CardHeader>
                        <h3 className="text-lg font-semibold text-ghana-black">GRA Integration</h3>
                      </CardHeader>
                      <CardBody className="space-y-4">
                        <Input
                          label="GRA API Key"
                          placeholder="Enter your GRA API key"
                          type="password"
                          variant="bordered"
                        />
                        <Input
                          label="GRA Business ID"
                          placeholder="Enter your business registration number"
                          variant="bordered"
                        />
                        <Select label="Tax Period" placeholder="Select tax period">
                          <SelectItem key="monthly">Monthly</SelectItem>
                          <SelectItem key="quarterly">Quarterly</SelectItem>
                        </Select>
                        <Button color="success" className="w-full">Test Connection</Button>
                      </CardBody>
                    </Card>

                    <Card className="border border-gray-200">
                      <CardHeader>
                        <h3 className="text-lg font-semibold text-ghana-black">SSNIT Integration</h3>
                      </CardHeader>
                      <CardBody className="space-y-4">
                        <Input
                          label="SSNIT Employer Number"
                          placeholder="Enter SSNIT employer number"
                          variant="bordered"
                        />
                        <Input
                          label="SSNIT API Key"
                          placeholder="Enter SSNIT API key"
                          type="password"
                          variant="bordered"
                        />
                        <Select label="Contribution Period" placeholder="Select period">
                          <SelectItem key="monthly">Monthly</SelectItem>
                        </Select>
                        <Button color="success" className="w-full">Test Connection</Button>
                      </CardBody>
                    </Card>
                  </div>

                  <div className="mt-6">
                    <Card className="border border-gray-200">
                      <CardHeader>
                        <h3 className="text-lg font-semibold text-ghana-black">Automated Compliance</h3>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium">Auto-submit VAT returns</p>
                              <p className="text-sm text-gray-600">Automatically submit VAT returns to GRA</p>
                            </div>
                            <Button size="sm" color="success">Enable</Button>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <p className="font-medium">Auto-submit SSNIT returns</p>
                            <Button size="sm" color="success">Enable</Button>
                          </div>
                          
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <p className="font-medium">Auto-calculate PAYE</p>
                            <Button size="sm" color="success">Enable</Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
