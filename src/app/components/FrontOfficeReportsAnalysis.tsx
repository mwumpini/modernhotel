'use client';

import React, { useState, useMemo } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Chip, Progress, Select, SelectItem, Input, DatePicker, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Textarea, Divider, Spinner, Alert, Avatar, Tooltip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem
} from '@heroui/react';
import { useReportingStore } from '../lib/frontoffice/reportingStore';
import { useSettingsStore } from '../lib/settings/store';

export default function FrontOfficeReportsAnalysis() {
  const [selectedTab, setSelectedTab] = useState('daily-operations');
  const [selectedReport, setSelectedReport] = useState('arrivals');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedReportData, setSelectedReportData] = useState<any>(null);
  const [reportNotes, setReportNotes] = useState('');

  const settings = useSettingsStore();
  const reportingStore = useReportingStore();

  // Generate reports with detailed logging using the reporting store
  const generateArrivalsReport = useMemo(() => {
    return reportingStore.generateArrivalsReport(selectedDate);
  }, [selectedDate, reportingStore]);

  const generateDeparturesReport = useMemo(() => {
    return reportingStore.generateDeparturesReport(selectedDate);
  }, [selectedDate, reportingStore]);

  const generateRoomStatusReport = useMemo(() => {
    return reportingStore.generateRoomStatusReport(selectedDate);
  }, [selectedDate, reportingStore]);

  const generateInHouseGuestReport = useMemo(() => {
    return reportingStore.generateInHouseGuestReport(selectedDate);
  }, [selectedDate, reportingStore]);

  const generateDailyFlashReport = useMemo(() => {
    return reportingStore.generateDailyFlashReport(selectedDate);
  }, [selectedDate, reportingStore]);

  const handleExportReport = async (reportData: any, format: 'pdf' | 'excel' | 'csv') => {
    setIsGenerating(true);
    
    try {
      const filename = `${selectedReport}_report_${selectedDate}.${format}`;
      const fileUrl = await reportingStore.exportReport(reportData, format, filename);
      
      // Download the file
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(fileUrl);
      
      console.log(`[REPORTS] Successfully exported ${selectedReport} report`);
    } catch (error) {
      console.error(`[REPORTS] Error exporting report:`, error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintReport = () => {
    const reportData = getCurrentReportData();
    reportingStore.printReport(reportData, selectedReport);
  };

  const getCurrentReportData = () => {
    switch (selectedReport) {
      case 'arrivals':
        return generateArrivalsReport;
      case 'departures':
        return generateDeparturesReport;
      case 'room-status':
        return generateRoomStatusReport;
      case 'in-house':
        return generateInHouseGuestReport;
      case 'daily-flash':
        return generateDailyFlashReport;
      case 'discount-request':
        return reportingStore.generateDiscountRequestReport(startDate, endDate);
      case 'complimentary-room':
        return reportingStore.generateComplimentaryRoomReport(startDate, endDate);
      case 'pricing-analytics':
        return reportingStore.generatePricingAnalyticsReport(startDate, endDate);
      default:
        return generateArrivalsReport;
    }
  };

  const renderReportTable = () => {
    const data = getCurrentReportData();
    
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">No data available for the selected report and date.</p>
        </div>
      );
    }

    // Get column headers from the first item
    const columns = Object.keys(data[0] || {});
    
    return (
      <Table aria-label={`${selectedReport} report table`}>
        <TableHeader>
          {columns.map((column) => (
            <TableColumn key={column}>
              {column.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            </TableColumn>
          ))}
        </TableHeader>
        <TableBody>
          {data.map((row: any, index: number) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column}>
                  {typeof row[column] === 'boolean' 
                    ? (row[column] ? 'Yes' : 'No')
                    : Array.isArray(row[column])
                    ? row[column].join(', ')
                    : row[column]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ghana-black mb-2">📈 Reports & Analysis</h1>
        <p className="text-gray-600">
          Comprehensive reporting system for hotel operations and performance analysis
        </p>
      </div>

      {/* Date and Report Selection */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Report Date
          </label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex items-end space-x-2">
          <Button 
            color="primary" 
            variant="flat"
            onClick={() => {
              console.log(`[REPORTS] Manually triggered report generation for ${selectedReport}`);
            }}
          >
            🔄 Refresh
          </Button>
          <Dropdown>
            <DropdownTrigger>
              <Button variant="bordered">
                📥 Export
              </Button>
            </DropdownTrigger>
            <DropdownMenu 
              selectedKeys={[exportFormat]} 
              onSelectionChange={(keys) => setExportFormat(Array.from(keys)[0] as 'pdf' | 'excel' | 'csv')}
            >
              <DropdownItem key="pdf">PDF</DropdownItem>
              <DropdownItem key="excel">Excel</DropdownItem>
              <DropdownItem key="csv">CSV</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="mb-6"
      >
        <Tab key="daily-operations" title="Daily Operations">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Daily Operations Reports</h2>
              <div className="flex space-x-2">
                <Select
                  selectedKeys={[selectedReport]}
                  onSelectionChange={(keys) => setSelectedReport(Array.from(keys)[0] as string)}
                  className="w-48"
                >
                  <SelectItem key="arrivals">Arrivals Report</SelectItem>
                  <SelectItem key="departures">Departures Report</SelectItem>
                  <SelectItem key="room-status">Room Status Report</SelectItem>
                  <SelectItem key="in-house">In-House Guest List</SelectItem>
                  <SelectItem key="high-balance">High Balance Report</SelectItem>
                  <SelectItem key="wake-up-calls">Wake-up Call Sheet</SelectItem>
                </Select>
                <Button 
                  color="primary" 
                  variant="flat"
                  onClick={() => handleExportReport(getCurrentReportData(), exportFormat)}
                  isLoading={isGenerating}
                >
                  {isGenerating ? 'Exporting...' : 'Export Report'}
                </Button>
                <Button 
                  variant="bordered"
                  onClick={handlePrintReport}
                >
                  🖨️ Print
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">
                  {selectedReport.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <p className="text-sm text-gray-600">
                  Generated on {new Date().toLocaleString('en-GH')} by {settings.currentUser?.id || 'System'}
                </p>
              </CardHeader>
              <CardBody>
                {renderReportTable()}
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="financial-auditing" title="Financial & Auditing">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Financial & Auditing Reports</h2>
              <div className="flex space-x-2">
                <Select
                  selectedKeys={[selectedReport]}
                  onSelectionChange={(keys) => setSelectedReport(Array.from(keys)[0] as string)}
                  className="w-48"
                >
                  <SelectItem key="daily-transactions">Daily Transaction Report</SelectItem>
                  <SelectItem key="cashier-report">Cashier's Report</SelectItem>
                  <SelectItem key="credit-card-reconciliation">Credit Card Reconciliation</SelectItem>
                  <SelectItem key="guest-ledger">Guest Ledger Report</SelectItem>
                </Select>
                <Button 
                  color="primary" 
                  variant="flat"
                  onClick={() => handleExportReport(getCurrentReportData(), exportFormat)}
                  isLoading={isGenerating}
                >
                  {isGenerating ? 'Exporting...' : 'Export Report'}
                </Button>
                <Button 
                  variant="bordered"
                  onClick={handlePrintReport}
                >
                  🖨️ Print
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">
                  {selectedReport.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <p className="text-sm text-gray-600">
                  Generated on {new Date().toLocaleString('en-GH')} by {settings.currentUser?.id || 'System'}
                </p>
              </CardHeader>
              <CardBody>
                {renderReportTable()}
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="management-strategy" title="Management & Strategy">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Management & Strategy Reports</h2>
              <div className="flex space-x-2">
                <Select
                  selectedKeys={[selectedReport]}
                  onSelectionChange={(keys) => setSelectedReport(Array.from(keys)[0] as string)}
                  className="w-48"
                >
                  <SelectItem key="daily-flash">Daily Flash Report</SelectItem>
                  <SelectItem key="occupancy">Daily Occupancy Report</SelectItem>
                  <SelectItem key="pace">Pace Report</SelectItem>
                  <SelectItem key="no-shows">No-Show Report</SelectItem>
                  <SelectItem key="source-business">Source of Business Report</SelectItem>
                  <SelectItem key="market-segmentation">Market Segmentation Report</SelectItem>
                  <SelectItem key="discount-request">Discount Request Report</SelectItem>
                  <SelectItem key="complimentary-room">Complimentary Room Report</SelectItem>
                  <SelectItem key="pricing-analytics">Pricing Analytics Report</SelectItem>
                </Select>
                <Button 
                  color="primary" 
                  variant="flat"
                  onClick={() => handleExportReport(getCurrentReportData(), exportFormat)}
                  isLoading={isGenerating}
                >
                  {isGenerating ? 'Exporting...' : 'Export Report'}
                </Button>
                <Button 
                  variant="bordered"
                  onClick={handlePrintReport}
                >
                  🖨️ Print
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">
                  {selectedReport.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <p className="text-sm text-gray-600">
                  Generated on {new Date().toLocaleString('en-GH')} by {settings.currentUser?.id || 'System'}
                </p>
              </CardHeader>
              <CardBody>
                {renderReportTable()}
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="other-departments" title="Other Departments">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Other Departments Reports</h2>
              <div className="flex space-x-2">
                <Select
                  selectedKeys={[selectedReport]}
                  onSelectionChange={(keys) => setSelectedReport(Array.from(keys)[0] as string)}
                  className="w-48"
                >
                  <SelectItem key="guest-count-meal-plan">Guest Count & Meal Plan Report</SelectItem>
                  <SelectItem key="vip">VIP Report</SelectItem>
                  <SelectItem key="guest-history">Guest History Report</SelectItem>
                </Select>
                <Button 
                  color="primary" 
                  variant="flat"
                  onClick={() => handleExportReport(getCurrentReportData(), exportFormat)}
                  isLoading={isGenerating}
                >
                  {isGenerating ? 'Exporting...' : 'Export Report'}
                </Button>
                <Button 
                  variant="bordered"
                  onClick={handlePrintReport}
                >
                  🖨️ Print
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">
                  {selectedReport.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <p className="text-sm text-gray-600">
                  Generated on {new Date().toLocaleString('en-GH')} by {settings.currentUser?.id || 'System'}
                </p>
              </CardHeader>
              <CardBody>
                {renderReportTable()}
              </CardBody>
            </Card>
          </div>
        </Tab>
      </Tabs>

      {/* Report Notes Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>Add Report Notes</ModalHeader>
          <ModalBody>
            <Textarea
              label="Report Notes"
              placeholder="Add any additional notes or observations about this report..."
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              minRows={4}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" onPress={() => {
              console.log(`[REPORTS] Added notes to ${selectedReport} report:`, reportNotes);
              onClose();
            }}>
              Save Notes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
