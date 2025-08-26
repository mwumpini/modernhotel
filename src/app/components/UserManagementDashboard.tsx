'use client';

import React, { useState } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Tabs, Tab, Chip, Avatar
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { trackEvent } from '../lib/analytics/trackEvent';

interface User {
  id: string;
  employeeId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  lastLogin?: string;
  permissions: string[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

interface Department {
  id: string;
  name: string;
  code: string;
  manager: string;
  userCount: number;
  isActive: boolean;
}

export default function UserManagementDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const settings = useSettingsStore();

  // Sample data
  const users: User[] = [
    {
      id: '1',
      employeeId: 'EMP-001',
      username: 'kwame.manager',
      email: 'kwame.manager@demohotel.com',
      firstName: 'Kwame',
      lastName: 'Addo',
      role: 'General Manager',
      department: 'Management',
      status: 'active',
      lastLogin: '2024-01-16T14:30:00Z',
      permissions: ['all']
    },
    {
      id: '2',
      employeeId: 'EMP-002',
      username: 'ama.frontdesk',
      email: 'ama.frontdesk@demohotel.com',
      firstName: 'Ama',
      lastName: 'Osei',
      role: 'Front Desk Supervisor',
      department: 'Front Office',
      status: 'active',
      lastLogin: '2024-01-16T12:15:00Z',
      permissions: ['front-office', 'guest-management', 'reservations', 'billing']
    }
  ];

  const roles: Role[] = [
    {
      id: '1',
      name: 'General Manager',
      description: 'Full system access and management capabilities',
      permissions: ['all'],
      isSystem: true,
      userCount: 1
    },
    {
      id: '2',
      name: 'Department Manager',
      description: 'Department-specific management with reporting access',
      permissions: ['department-management', 'reports', 'user-management'],
      isSystem: false,
      userCount: 3
    }
  ];

  const departments: Department[] = [
    {
      id: '1',
      name: 'Management',
      code: 'MGMT',
      manager: 'Kwame Addo',
      userCount: 3,
      isActive: true
    },
    {
      id: '2',
      name: 'Front Office',
      code: 'FO',
      manager: 'Ama Osei',
      userCount: 12,
      isActive: true
    }
  ];

  // Calculate metrics
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'active').length;
  const totalRoles = roles.length;
  const systemRoles = roles.filter(r => r.isSystem).length;

  const renderOverview = () => (
    <div className="space-y-6">
      {/* User Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-ghana-black">{totalUsers}</p>
                <p className="text-sm text-blue-600">System users</p>
              </div>
              <div className="text-3xl">👥</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-ghana-green">{activeUsers}</p>
                <p className="text-sm text-green-600">Currently active</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Roles</p>
                <p className="text-2xl font-bold text-ghana-black">{totalRoles}</p>
                <p className="text-sm text-purple-600">{totalRoles - systemRoles} custom</p>
              </div>
              <div className="text-3xl">🔐</div>
            </div>
          </CardBody>
        </Card>
        
        <Card className="border-0 shadow-lg">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Departments</p>
                <p className="text-2xl font-bold text-ghana-black">{departments.length}</p>
                <p className="text-sm text-orange-600">Active departments</p>
              </div>
              <div className="text-3xl">🏢</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <h3 className="text-xl font-semibold text-ghana-black">🚀 Quick Actions</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="flat"
              className="bg-ghana-green text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">👤</span>
              <span className="text-sm font-medium">Add User</span>
            </Button>
            <Button
              variant="flat"
              className="bg-blue-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">🔐</span>
              <span className="text-sm font-medium">Create Role</span>
            </Button>
            <Button
              variant="flat"
              className="bg-ghana-gold text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📋</span>
              <span className="text-sm font-medium">Bulk Import</span>
            </Button>
            <Button
              variant="flat"
              className="bg-purple-500 text-white h-20 flex flex-col items-center justify-center space-y-2"
              size="lg"
            >
              <span className="text-2xl">📊</span>
              <span className="text-sm font-medium">Access Report</span>
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderUserManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">👥 User Management</h3>
            <Button
              color="primary"
              className="bg-ghana-green text-white"
              variant="flat"
            >
              ➕ Add User
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Users table">
            <TableHeader>
              <TableColumn>Employee ID</TableColumn>
              <TableColumn>User</TableColumn>
              <TableColumn>Role</TableColumn>
              <TableColumn>Department</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Last Login</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono font-semibold">{user.employeeId}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar 
                        name={`${user.firstName} ${user.lastName}`} 
                        size="sm"
                        className="bg-blue-500 text-white"
                      />
                      <div>
                        <div className="font-semibold">{user.firstName} {user.lastName}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      color={
                        user.role === 'General Manager' ? 'danger' :
                        user.role.includes('Manager') ? 'warning' :
                        'default'
                      } 
                      size="sm" 
                      variant="flat"
                    >
                      {user.role}
                    </Chip>
                  </TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        user.status === 'active' ? 'success' :
                        user.status === 'inactive' ? 'warning' :
                        user.status === 'suspended' ? 'danger' :
                        'default'
                      } 
                      size="sm"
                    >
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.lastLogin ? (
                      <div className="text-sm">
                        <div>{new Date(user.lastLogin).toLocaleDateString()}</div>
                        <div className="text-gray-500">{new Date(user.lastLogin).toLocaleTimeString()}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        Edit
                      </Button>
                      <Button size="sm" variant="flat" color="secondary">
                        View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderRoleManagement = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ghana-black">🔐 Role Management</h3>
            <Button
              color="primary"
              className="bg-blue-500 text-white"
              variant="flat"
            >
              ➕ Create Role
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Roles table">
            <TableHeader>
              <TableColumn>Role Name</TableColumn>
              <TableColumn>Description</TableColumn>
              <TableColumn>Permissions</TableColumn>
              <TableColumn>Type</TableColumn>
              <TableColumn>Users</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-semibold">{role.name}</TableCell>
                  <TableCell className="max-w-xs">{role.description}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 3).map((permission) => (
                        <Chip key={permission} color="primary" size="sm" variant="flat">
                          {permission}
                        </Chip>
                      ))}
                      {role.permissions.length > 3 && (
                        <Chip color="default" size="sm" variant="flat">
                          +{role.permissions.length - 3} more
                        </Chip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={role.isSystem ? 'danger' : 'success'} 
                      size="sm"
                    >
                      {role.isSystem ? 'System' : 'Custom'}
                    </Badge>
                  </TableCell>
                  <TableCell>{role.userCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="flat" color="primary">
                        Edit
                      </Button>
                      <Button size="sm" variant="flat" color="secondary">
                        View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">👥 User Management & Access Control</h1>
          <p className="text-gray-600">Complete user lifecycle management with Ghana compliance and role-based access control</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">System Online</Badge>
          <Badge color="primary">SaaS Ready</Badge>
        </div>
      </div>

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => setSelectedTab(key as string)}
        className="w-full"
      >
        <Tab key="overview" title="Overview" />
        <Tab key="users" title="User Management" />
        <Tab key="roles" title="Role Management" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'users' && renderUserManagement()}
        {selectedTab === 'roles' && renderRoleManagement()}
      </div>
    </div>
  );
}
