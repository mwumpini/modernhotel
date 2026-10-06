'use client';

import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Input, 
  Select, 
  SelectItem, 
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter
} from "@heroui/react";
import { MagnifyingGlassIcon, FunnelIcon, PrinterIcon, ArrowDownTrayIcon, EyeIcon } from '@heroicons/react/24/outline';

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  user: string;
  department: string;
  action: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'login' | 'data' | 'system' | 'security' | 'financial' | 'guest' | 'booking' | 'maintenance';
  affectedResource?: string;
  oldValue?: string;
  newValue?: string;
  sessionId: string;
}

interface FilterOptions {
  search: string;
  department: string;
  category: string;
  severity: string;
  startDate: string;
  endDate: string;
  user: string;
}

export default function ActivityLog() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLogEntry[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    department: '',
    category: '',
    severity: '',
    startDate: '',
    endDate: '',
    user: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage] = useState(25);
  const [selectedLog, setSelectedLog] = useState<ActivityLogEntry | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Sample activity log data
  useEffect(() => {
    const sampleLogs: ActivityLogEntry[] = [
      {
        id: 'LOG-001',
        timestamp: '2024-01-15T10:30:00Z',
        user: 'admin@ghanahotel.com',
        department: 'frontdesk',
        action: 'Guest Check-in',
        details: 'Checked in guest John Doe to Room 205',
        ipAddress: '192.168.1.100',
        userAgent: 'Chrome/120.0.0.0',
        severity: 'medium',
        category: 'guest',
        affectedResource: 'Room 205',
        oldValue: 'Available',
        newValue: 'Occupied',
        sessionId: 'SESS-001'
      },
      {
        id: 'LOG-002',
        timestamp: '2024-01-15T10:25:00Z',
        user: 'manager@ghanahotel.com',
        department: 'housekeeping',
        action: 'Room Status Update',
        details: 'Updated Room 103 status from Cleaning to Available',
        ipAddress: '192.168.1.101',
        userAgent: 'Firefox/121.0.0.0',
        severity: 'low',
        category: 'maintenance',
        affectedResource: 'Room 103',
        oldValue: 'Cleaning',
        newValue: 'Available',
        sessionId: 'SESS-002'
      },
      {
        id: 'LOG-003',
        timestamp: '2024-01-15T10:20:00Z',
        user: 'cashier@ghanahotel.com',
        department: 'f&b',
        action: 'Payment Processing',
        details: 'Processed payment of ₵450 for Room Service Order #RS-001',
        ipAddress: '192.168.1.102',
        userAgent: 'Safari/17.2.0.0',
        severity: 'high',
        category: 'financial',
        affectedResource: 'Order RS-001',
        oldValue: 'Pending Payment',
        newValue: 'Paid',
        sessionId: 'SESS-003'
      },
      {
        id: 'LOG-004',
        timestamp: '2024-01-15T10:15:00Z',
        user: 'security@ghanahotel.com',
        department: 'security',
        action: 'Security Alert',
        details: 'Unauthorized access attempt detected at Room 205',
        ipAddress: '192.168.1.103',
        userAgent: 'Chrome/120.0.0.0',
        severity: 'critical',
        category: 'security',
        affectedResource: 'Room 205',
        sessionId: 'SESS-004'
      },
      {
        id: 'LOG-005',
        timestamp: '2024-01-15T10:10:00Z',
        user: 'admin@ghanahotel.com',
        department: 'system',
        action: 'User Login',
        details: 'Successful login from IP 192.168.1.100',
        ipAddress: '192.168.1.100',
        userAgent: 'Chrome/120.0.0.0',
        severity: 'low',
        category: 'login',
        sessionId: 'SESS-005'
      },
      {
        id: 'LOG-006',
        timestamp: '2024-01-15T10:05:00Z',
        user: 'hr@ghanahotel.com',
        department: 'hr',
        action: 'Staff Record Update',
        details: 'Updated employee Kwame Asante salary information',
        ipAddress: '192.168.1.104',
        userAgent: 'Edge/120.0.0.0',
        severity: 'medium',
        category: 'data',
        affectedResource: 'Employee: Kwame Asante',
        oldValue: 'Salary: ₵2,500',
        newValue: 'Salary: ₵2,800',
        sessionId: 'SESS-006'
      },
      {
        id: 'LOG-007',
        timestamp: '2024-01-15T10:00:00Z',
        user: 'accounting@ghanahotel.com',
        department: 'accounting',
        action: 'Invoice Generation',
        details: 'Generated invoice #INV-001 for Room 205',
        ipAddress: '192.168.1.105',
        userAgent: 'Chrome/120.0.0.0',
        severity: 'medium',
        category: 'financial',
        affectedResource: 'Invoice INV-001',
        sessionId: 'SESS-007'
      },
      {
        id: 'LOG-008',
        timestamp: '2024-01-15T09:55:00Z',
        user: 'frontdesk@ghanahotel.com',
        department: 'frontdesk',
        action: 'Booking Creation',
        details: 'Created new booking for Sarah Johnson - Deluxe Room',
        ipAddress: '192.168.1.106',
        userAgent: 'Firefox/121.0.0.0',
        severity: 'low',
        category: 'booking',
        affectedResource: 'Booking #BK-001',
        sessionId: 'SESS-008'
      }
    ];
    
    setLogs(sampleLogs);
    setFilteredLogs(sampleLogs);
  }, []);

  // Filter logs based on current filters
  useEffect(() => {
    const filtered = logs.filter(log => {
      const matchesSearch = !filters.search || 
        log.action.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.details.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.user.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.department.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesDepartment = !filters.department || log.department === filters.department;
      const matchesCategory = !filters.category || log.category === filters.category;
      const matchesSeverity = !filters.severity || log.severity === filters.severity;
      const matchesUser = !filters.user || log.user.includes(filters.user);
      
      let matchesDate = true;
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        const logDate = new Date(log.timestamp);
        matchesDate = logDate >= startDate;
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate + 'T23:59:59');
        const logDate = new Date(log.timestamp);
        matchesDate = matchesDate && logDate <= endDate;
      }
      
      return matchesSearch && matchesDepartment && matchesCategory && 
             matchesSeverity && matchesUser && matchesDate;
    });
    
    setFilteredLogs(filtered);
    setCurrentPage(1);
  }, [logs, filters]);

  // Get current logs for pagination
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      department: '',
      category: '',
      severity: '',
      startDate: '',
      endDate: '',
      user: ''
    });
  };

  const viewLogDetails = (log: ActivityLogEntry) => {
    setSelectedLog(log);
    onOpen();
  };

  const printLogs = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>AGM Sync - Activity Log Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
              .header { text-align: center; margin-bottom: 20px; }
              .filters { margin-bottom: 15px; padding: 10px; border: 1px solid #ccc; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 11px; }
              th { background-color: #f2f2f2; }
              .severity-critical { color: #d32f2f; font-weight: bold; }
              .severity-high { color: #f57c00; font-weight: bold; }
              .severity-medium { color: #1976d2; font-weight: bold; }
              .severity-low { color: #388e3c; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>AGM Sync</h1>
              <h2>Activity Log Report</h2>
              <p>Generated: ${new Date().toLocaleString()}</p>
            </div>
            
            <div class="filters">
              <h3>Filters Applied:</h3>
              <p>Search: ${filters.search || 'All'}</p>
              <p>Department: ${filters.department || 'All'}</p>
              <p>Category: ${filters.category || 'All'}</p>
              <p>Severity: ${filters.severity || 'All'}</p>
              <p>Date Range: ${filters.startDate || 'All'} to ${filters.endDate || 'All'}</p>
              <p>User: ${filters.user || 'All'}</p>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Department</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Severity</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                ${filteredLogs.map(log => `
                  <tr>
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                    <td>${log.user}</td>
                    <td>${log.department}</td>
                    <td>${log.action}</td>
                    <td>${log.details}</td>
                    <td class="severity-${log.severity}">${log.severity}</td>
                    <td>${log.category}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="margin-top: 20px; text-align: center; color: #666; font-size: 11px;">
              <p>Total Records: ${filteredLogs.length}</p>
              <p>Report generated by AGM Sync</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Department', 'Action', 'Details', 'Severity', 'Category', 'IP Address', 'Session ID'],
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.user,
        log.department,
        log.action,
        log.details,
        log.severity,
        log.category,
        log.ipAddress,
        log.sessionId
      ])
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Activity Log</h1>
            <p className="text-sm text-gray-600">System activity monitoring</p>
          </div>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="light"
              onClick={printLogs}
            >
              <PrinterIcon className="h-4 w-4 mr-1" />
              Print
            </Button>
            <Button
              size="sm"
              variant="light"
              onClick={exportLogs}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button
              size="sm"
              color="warning"
              variant="flat"
              onClick={async () => {
                const { confirmDelete } = await import('./DangerConfirm');
                if (!(await confirmDelete('all activity logs', 'They will be downloaded first, then permanently removed.'))) return;
                exportLogs();
                setTimeout(() => {
                  setLogs([]);
                  setFilteredLogs([]);
                  alert('Logs cleared.');
                }, 1000);
              }}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Log Management */}
      <div className="bg-white border p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">Log Management</h3>
          <div className="text-xs text-gray-500">
            {logs.length} entries • {(logs.length * 0.5).toFixed(1)} KB
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="light"
            onClick={async () => {
              const { confirmChoice } = await import('./DangerConfirm');
              const ok = await confirmChoice('Clean old logs', 'Logs older than 30 days will be downloaded, then removed.', 'Clean old');
              if (!ok) return;
              exportLogs();
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              const oldLogs = logs.filter(log => new Date(log.timestamp) < thirtyDaysAgo);
              if (oldLogs.length > 0) {
                setLogs(logs.filter(log => new Date(log.timestamp) >= thirtyDaysAgo));
                setFilteredLogs(filteredLogs.filter(log => new Date(log.timestamp) >= thirtyDaysAgo));
                alert(`Cleared ${oldLogs.length} old entries.`);
              }
            }}
          >
            <ArrowDownTrayIcon className="h-3 w-3 mr-1" />
            Clean Old
          </Button>
          
          <Button
            size="sm"
            variant="light"
            color="danger"
            onClick={async () => {
              const { confirmDelete } = await import('./DangerConfirm');
              if (!(await confirmDelete('all activity logs', 'Every log on this screen will be permanently removed.'))) return;
              setLogs([]);
              setFilteredLogs([]);
              alert('All logs cleared.');
            }}
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <Input
            size="sm"
            placeholder="Search..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            startContent={<MagnifyingGlassIcon className="h-3 w-3 text-gray-400" />}
          />
          
          <Select
            size="sm"
            placeholder="Dept"
            value={filters.department}
            onChange={(e) => handleFilterChange('department', e.target.value)}
          >
            <SelectItem key="">All</SelectItem>
            <SelectItem key="frontdesk">Frontdesk</SelectItem>
            <SelectItem key="housekeeping">Housekeeping</SelectItem>
            <SelectItem key="f&b">F&B</SelectItem>
            <SelectItem key="security">Security</SelectItem>
            <SelectItem key="hr">HR</SelectItem>
            <SelectItem key="accounting">Accounting</SelectItem>
            <SelectItem key="system">System</SelectItem>
          </Select>
          
          <Select
            size="sm"
            placeholder="Category"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <SelectItem key="">All</SelectItem>
            <SelectItem key="login">Login</SelectItem>
            <SelectItem key="data">Data</SelectItem>
            <SelectItem key="system">System</SelectItem>
            <SelectItem key="security">Security</SelectItem>
            <SelectItem key="financial">Financial</SelectItem>
            <SelectItem key="guest">Guest</SelectItem>
            <SelectItem key="booking">Booking</SelectItem>
            <SelectItem key="maintenance">Maintenance</SelectItem>
          </Select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <Select
            size="sm"
            placeholder="Severity"
            value={filters.severity}
            onChange={(e) => handleFilterChange('severity', e.target.value)}
          >
            <SelectItem key="">All</SelectItem>
            <SelectItem key="critical">Critical</SelectItem>
            <SelectItem key="high">High</SelectItem>
            <SelectItem key="medium">Medium</SelectItem>
            <SelectItem key="low">Low</SelectItem>
          </Select>
          
          <Input
            size="sm"
            type="date"
            placeholder="From"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
          
          <Input
            size="sm"
            type="date"
            placeholder="To"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
          
          <Input
            size="sm"
            placeholder="User"
            value={filters.user}
            onChange={(e) => handleFilterChange('user', e.target.value)}
          />
        </div>
        
        <div className="flex justify-between items-center">
          <Button
            size="sm"
            variant="light"
            onClick={clearFilters}
          >
            <FunnelIcon className="h-3 w-3 mr-1" />
            Clear
          </Button>
          
          <div className="text-xs text-gray-500">
            {filteredLogs.length} of {logs.length} records
          </div>
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="bg-white border">
        <div className="p-3 border-b">
          <h3 className="text-sm font-medium text-gray-900">Activity Log Entries</h3>
        </div>
        
        <Table aria-label="Activity logs table" className="min-w-full">
          <TableHeader>
            <TableColumn className="text-xs">TIME</TableColumn>
            <TableColumn className="text-xs">USER</TableColumn>
            <TableColumn className="text-xs">DEPT</TableColumn>
            <TableColumn className="text-xs">ACTION</TableColumn>
            <TableColumn className="text-xs">DETAILS</TableColumn>
            <TableColumn className="text-xs">LEVEL</TableColumn>
            <TableColumn className="text-xs">VIEW</TableColumn>
          </TableHeader>
          <TableBody>
            {currentLogs.map((log) => (
              <TableRow key={log.id} className="hover:bg-gray-50">
                <TableCell className="py-2">
                  <div className="text-xs">
                    <div className="font-medium text-gray-900">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </TableCell>
                
                <TableCell className="py-2">
                  <div className="text-xs">
                    <div className="font-medium text-gray-900 truncate max-w-24">
                      {log.user.split('@')[0]}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {log.ipAddress}
                    </div>
                  </div>
                </TableCell>
                
                <TableCell className="py-2">
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                    {log.department}
                  </span>
                </TableCell>
                
                <TableCell className="py-2">
                  <div className="text-xs font-medium text-gray-900">
                    {log.action}
                  </div>
                </TableCell>
                
                <TableCell className="py-2">
                  <div className="text-xs text-gray-700 max-w-32 truncate">
                    {log.details}
                  </div>
                </TableCell>
                
                <TableCell className="py-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    log.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    log.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                    log.severity === 'medium' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {log.severity}
                  </span>
                </TableCell>
                
                <TableCell className="py-2">
                  <Button
                    size="sm"
                    variant="light"
                    onClick={() => viewLogDetails(log)}
                  >
                    <EyeIcon className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {/* Pagination */}
        {filteredLogs.length > logsPerPage && (
          <div className="flex justify-center p-3 border-t">
            <Pagination
              total={Math.ceil(filteredLogs.length / logsPerPage)}
              page={currentPage}
              onChange={setCurrentPage}
              showControls
              size="sm"
              color="primary"
            />
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader className="text-sm">Log Details</ModalHeader>
          <ModalBody>
            {selectedLog && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-gray-600">ID:</label>
                    <p className="font-mono">{selectedLog.id}</p>
                  </div>
                  <div>
                    <label className="text-gray-600">Time:</label>
                    <p>{new Date(selectedLog.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-gray-600">User:</label>
                    <p>{selectedLog.user}</p>
                  </div>
                  <div>
                    <label className="text-gray-600">Dept:</label>
                    <p>{selectedLog.department}</p>
                  </div>
                </div>
                
                <div className="text-xs">
                  <label className="text-gray-600">Action:</label>
                  <p className="font-medium">{selectedLog.action}</p>
                </div>
                
                <div className="text-xs">
                  <label className="text-gray-600">Details:</label>
                  <p className="bg-gray-50 p-2 rounded">{selectedLog.details}</p>
                </div>
                
                {selectedLog.affectedResource && (
                  <div className="text-xs">
                    <label className="text-gray-600">Resource:</label>
                    <p>{selectedLog.affectedResource}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-gray-600">IP:</label>
                    <p className="font-mono">{selectedLog.ipAddress}</p>
                  </div>
                  <div>
                    <label className="text-gray-600">Session:</label>
                    <p className="font-mono">{selectedLog.sessionId}</p>
                  </div>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="light" onPress={onClose}>Close</Button>
            <Button
              size="sm"
              color="primary"
              onPress={() => {
                printLogs();
                onClose();
              }}
            >
              <PrinterIcon className="h-3 w-3 mr-1" />
              Print
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
