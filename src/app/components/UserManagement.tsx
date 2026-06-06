'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button,
  Input,
  Select,
  SelectItem,
  Switch,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Avatar,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Textarea,
  Divider
} from "@heroui/react";
import { useSettingsStore } from '../lib/settings/store';

export default function UserManagement() {
  const { users, roles, addUser, updateUser, deleteUser } = useSettingsStore();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    roleId: '',
    isActive: true,
    phone: '',
    address: '',
    department: '',
    position: '',
    employeeId: '',
    bio: '',
  });

  const resetForm = () => {
    setUserForm({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      roleId: '',
      isActive: true,
      phone: '',
      address: '',
      department: '',
      position: '',
      employeeId: '',
      bio: '',
    });
  };

  const handleCreateUser = () => {
    setIsEditing(false);
    setSelectedUser(null);
    resetForm();
    onOpen();
  };

  const handleEditUser = (user: any) => {
    setIsEditing(true);
    setSelectedUser(user);
    setUserForm({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      isActive: user.isActive,
      phone: user.profile?.phone || '',
      address: user.profile?.address || '',
      department: user.profile?.department || '',
      position: user.profile?.position || '',
      employeeId: user.profile?.employeeId || '',
      bio: user.profile?.bio || '',
    });
    onOpen();
  };

  const handleSaveUser = () => {
    if (isEditing && selectedUser) {
      // Update existing user
      updateUser(selectedUser.id, {
        username: userForm.username,
        email: userForm.email,
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        roleId: userForm.roleId,
        isActive: userForm.isActive,
      });
      
             // Update profile through updateUser
       updateUser(selectedUser.id, {
         profile: {
           phone: userForm.phone,
           address: userForm.address,
           department: userForm.department,
           position: userForm.position,
           employeeId: userForm.employeeId,
           bio: userForm.bio,
         }
       });
    } else {
             // Create new user
       addUser({
         username: userForm.username,
         email: userForm.email,
         firstName: userForm.firstName,
         lastName: userForm.lastName,
         roleId: userForm.roleId,
         isActive: userForm.isActive,
         preferences: {
           theme: 'light',
           language: 'en',
           timezone: 'Africa/Accra',
           dateFormat: 'DD/MM/YYYY',
           currency: 'GHS',
           notifications: {
             email: true,
             push: true,
             sms: false,
             sound: true,
           },
           dashboard: {
             defaultView: 'overview',
             quickActions: ['new-reservation', 'check-in', 'pos-terminal'],
             widgets: ['recent-activity', 'quick-stats', 'calendar'],
           },
           accessibility: {
             fontSize: 'medium',
             highContrast: false,
             reduceMotion: false,
           },
         },
         profile: {
           avatar: '',
           phone: userForm.phone,
           address: userForm.address,
           department: userForm.department,
           position: userForm.position,
           employeeId: userForm.employeeId,
           hireDate: '',
           emergencyContact: {
             name: '',
             phone: '',
             relationship: '',
           },
           bio: userForm.bio,
           skills: [],
           certifications: [],
         },
         security: {
           failedLoginAttempts: 0,
           accountLocked: false,
           twoFactorEnabled: false,
         },
       });
    }
    
    onClose();
    resetForm();
  };

  const getRoleName = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    return role?.name || 'Unknown Role';
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'success' : 'danger';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ghana-black">User Management</h1>
              <p className="text-gray-600 mt-2">Manage system users and their permissions</p>
            </div>
            <Button 
              color="primary" 
              className="bg-ghana-green text-white"
              onClick={handleCreateUser}
            >
              Create New User
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <h2 className="text-xl font-semibold text-ghana-black">System Users</h2>
          </CardHeader>
          <CardBody>
            <Table aria-label="Users table">
              <TableHeader>
                <TableColumn>USER</TableColumn>
                <TableColumn>ROLE</TableColumn>
                <TableColumn>DEPARTMENT</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>LAST LOGIN</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar 
                          name={`${user.firstName} ${user.lastName}`}
                          className="bg-ghana-green text-white"
                        />
                        <div>
                          <p className="font-medium text-ghana-black">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip color="primary" variant="flat">
                        {getRoleName(user.roleId)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {user.profile?.department || 'Not specified'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Chip color={getStatusColor(user.isActive)} variant="flat">
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {user.lastLogin ? 
                          new Date(user.lastLogin).toLocaleDateString() : 
                          'Never'
                        }
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="flat"
                          onClick={() => handleEditUser(user)}
                        >
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          color="danger" 
                          variant="flat"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this user?')) {
                              deleteUser(user.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        {/* Create/Edit User Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="3xl">
          <ModalContent>
            <ModalHeader>
              {isEditing ? 'Edit User' : 'Create New User'}
            </ModalHeader>
            <ModalBody>
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-ghana-black mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Username"
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    />
                    <Input
                      label="First Name"
                      value={userForm.firstName}
                      onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                    />
                    <Input
                      label="Last Name"
                      value={userForm.lastName}
                      onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                    />
                                         <Select
                       label="Role"
                       selectedKeys={[userForm.roleId]}
                       onSelectionChange={(keys) => {
                         const roleId = Array.from(keys)[0] as string;
                         setUserForm({ ...userForm, roleId });
                       }}
                     >
                       {roles.map((role) => (
                         <SelectItem key={role.id}>
                           {role.name}
                         </SelectItem>
                       ))}
                     </Select>
                    <div className="flex items-center space-x-2">
                      <Switch 
                        isSelected={userForm.isActive}
                        onValueChange={(value) => setUserForm({ ...userForm, isActive: value })}
                      />
                      <span className="text-sm">Active Account</span>
                    </div>
                  </div>
                </div>

                <Divider />

                {/* Profile Information */}
                <div>
                  <h3 className="text-lg font-semibold text-ghana-black mb-4">Profile Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Phone"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    />
                    <Input
                      label="Employee ID"
                      value={userForm.employeeId}
                      onChange={(e) => setUserForm({ ...userForm, employeeId: e.target.value })}
                    />
                    <Input
                      label="Department"
                      value={userForm.department}
                      onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                    />
                    <Input
                      label="Position"
                      value={userForm.position}
                      onChange={(e) => setUserForm({ ...userForm, position: e.target.value })}
                    />
                  </div>
                  
                  <div className="mt-4">
                    <Textarea
                      label="Address"
                      value={userForm.address}
                      onChange={(e) => setUserForm({ ...userForm, address: e.target.value })}
                    />
                  </div>
                  
                  <div className="mt-4">
                    <Textarea
                      label="Bio"
                      placeholder="Tell us about this user..."
                      value={userForm.bio}
                      onChange={(e) => setUserForm({ ...userForm, bio: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose}>
                Cancel
              </Button>
              <Button 
                color="primary" 
                className="bg-ghana-green text-white"
                onPress={handleSaveUser}
              >
                {isEditing ? 'Update User' : 'Create User'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
