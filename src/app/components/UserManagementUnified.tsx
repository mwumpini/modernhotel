'use client';

import React, { useState, useEffect } from 'react';
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
  Divider,
  Tabs,
  Tab,
  Badge,
  Checkbox,
  Accordion,
  AccordionItem
} from "@heroui/react";
import { useSettingsStore } from '../lib/settings/store';
import { applyTheme, type AppTheme } from '../lib/theme/applyTheme';
import type { UserPreferences } from '../lib/settings/store';
import { PERMISSION_MODULES, FULL_SYSTEM_ACCESS } from '../lib/settings/permissionCatalog';

export default function UserManagementUnified() {
  const { users, roles, addUser, updateUser, deleteUser, currentUser, updateUserProfile, updateUserPreferences, updateUserSecurity, changePassword, addRole, updateRole, deleteRole } = useSettingsStore();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string; email: string; firstName: string; lastName: string; roleId: string; isActive: boolean; profile?: { phone?: string; address?: string; department?: string; position?: string; employeeId?: string; bio?: string } } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTab, setSelectedTab] = useState("overview");

  useEffect(() => {
    try {
      const sub = localStorage.getItem('settings.usersSubTab');
      if (sub) {
        setSelectedTab(sub);
        localStorage.removeItem('settings.usersSubTab');
      }
    } catch {}
  }, []);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ id: string; name: string; description: string; permissions: string[]; isActive: boolean } | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: ['dashboard.view'] as string[],
    isActive: true,
  });

  // Log component initialization
  useEffect(() => {
    console.log('🔧 [UserManagementUnified] Component initialized with:', { 
      totalUsers: users.length, 
      totalRoles: roles.length, 
      currentUser: currentUser?.username 
    });
  }, [users.length, roles.length, currentUser]);
  
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

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [profileForm, setProfileForm] = useState({
    firstName: currentUser?.firstName || '',
    lastName: currentUser?.lastName || '',
    email: currentUser?.email || '',
    phone: currentUser?.profile?.phone || '',
    address: currentUser?.profile?.address || '',
    department: currentUser?.profile?.department || '',
    position: currentUser?.profile?.position || '',
    bio: currentUser?.profile?.bio || '',
  });

  // Get user preferences from current user, with fallback defaults
  const userPreferences = currentUser?.preferences || {
    theme: 'light' as const,
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
      fontSize: 'medium' as const,
      highContrast: false,
      reduceMotion: false,
    },
  };

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
  const resetRoleForm = () => {
    setRoleForm({ name: '', description: '', permissions: ['dashboard.view'], isActive: true });
  };

  const handleCreateUser = () => {
    console.log('🔧 [UserManagementUnified] Creating new user - opening modal');
    setIsEditing(false);
    setSelectedUser(null);
    resetForm();
    onOpen();
  };

  const handleEditUser = (user: { id: string; username: string; email: string; firstName: string; lastName: string; roleId: string; isActive: boolean; profile?: { phone?: string; address?: string; department?: string; position?: string; employeeId?: string; bio?: string } }) => {
    console.log('🔧 [UserManagementUnified] Editing user:', { userId: user.id, username: user.username, role: user.roleId });
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
      console.log('🔧 [UserManagementUnified] Updating user:', { 
        userId: selectedUser.id, 
        username: userForm.username, 
        role: userForm.roleId,
        department: userForm.department,
        isActive: userForm.isActive 
      });
      updateUser(selectedUser.id, {
        username: userForm.username,
        email: userForm.email,
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        roleId: userForm.roleId,
        isActive: userForm.isActive,
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
      console.log('🔧 [UserManagementUnified] Creating new user:', { 
        username: userForm.username, 
        email: userForm.email, 
        role: userForm.roleId,
        department: userForm.department 
      });
      const defaultUserPreferences = {
        theme: 'light' as const,
        language: 'en',
        timezone: 'Africa/Accra',
        dateFormat: 'DD/MM/YYYY',
        currency: 'GHS',
        notifications: { email: true, push: true, sms: false, sound: true },
        dashboard: { defaultView: 'overview', quickActions: ['new-reservation', 'check-in', 'pos-terminal'], widgets: ['recent-activity', 'quick-stats', 'calendar'] },
        accessibility: { fontSize: 'medium' as const, highContrast: false, reduceMotion: false },
      };
      addUser({
        username: userForm.username,
        email: userForm.email,
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        roleId: userForm.roleId,
        isActive: userForm.isActive,
        preferences: defaultUserPreferences,
        profile: {
          phone: userForm.phone,
          address: userForm.address,
          department: userForm.department,
          position: userForm.position,
          employeeId: userForm.employeeId,
          bio: userForm.bio,
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

  const handleDeleteUser = (userId: string) => {
    console.log('🔧 [UserManagementUnified] Attempting to delete user:', { userId });
    if (window.confirm('Are you sure you want to delete this user?')) {
      console.log('🔧 [UserManagementUnified] User deletion confirmed, proceeding with delete');
      deleteUser(userId);
    } else {
      console.log('🔧 [UserManagementUnified] User deletion cancelled by user');
    }
  };

  const savePreferences = () => {
    console.log('🔧 [UserManagementUnified] Saving user preferences:', { 
      theme: userPreferences.theme,
      language: userPreferences.language,
      timezone: userPreferences.timezone,
      currency: userPreferences.currency 
    });
    // Settings are automatically saved via the store
    // Apply theme immediately
    applyTheme(userPreferences.theme as AppTheme);
  };

  const handleSaveProfile = () => {
    if (!currentUser) return;
    console.log('🔧 [UserManagementUnified] Saving profile for current user:', { userId: currentUser.id });
    updateUser(currentUser.id, {
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      email: profileForm.email,
    });
    updateUserProfile(currentUser.id, {
      phone: profileForm.phone,
      address: profileForm.address,
      department: profileForm.department,
      position: profileForm.position,
      bio: profileForm.bio,
    });
  };

  const handleToggleTwoFactor = (value: boolean) => {
    if (!currentUser) return;
    console.log('🔧 [UserManagementUnified] Toggling 2FA:', { userId: currentUser.id, value });
    updateUserSecurity(currentUser.id, { twoFactorEnabled: value });
  };

  const handleChangePassword = () => {
    if (!currentUser) return;
    if (!passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword) {
      console.warn('🔧 [UserManagementUnified] Passwords do not match or are empty');
      return;
    }
    console.log('🔧 [UserManagementUnified] Changing password for user:', { userId: currentUser.id });
    changePassword(currentUser.id, passwordForm.newPassword);
    setIsChangingPassword(false);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const updatePreference = (path: string, value: string | boolean | string[]) => {
    if (currentUser) {
      console.log('🔧 [UserManagementUnified] Updating preference:', { path, value, userId: currentUser.id });
      
      // Parse the path and update the specific preference
      const pathParts = path.split('.');
      const preferenceUpdates: Record<string, unknown> = {};
      let current: Record<string, unknown> = preferenceUpdates;
      
      // Build the nested object structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        current[pathParts[i]] = {};
        current = current[pathParts[i]] as Record<string, unknown>;
      }
      current[pathParts[pathParts.length - 1]] = value;
      
      // Update user preferences
      updateUserPreferences(currentUser.id, preferenceUpdates as Partial<UserPreferences>);
      
      // Apply theme immediately if it's a theme change
      if (path === 'theme') {
        console.log('🔧 [UserManagementUnified] Applying theme immediately:', value);
        applyTheme(value as AppTheme);
      }
      
      // Force a re-render by updating the component state
      setSelectedTab(selectedTab);
    } else {
      console.warn('🔧 [UserManagementUnified] Cannot update preference - no current user');
    }
  };

  const availableQuickActions = [
    { key: 'new-reservation', label: 'New Reservation', icon: '📅' },
    { key: 'check-in', label: 'Check-in Guest', icon: '✅' },
    { key: 'pos-terminal', label: 'POS Terminal', icon: '💳' },
    { key: 'housekeeping', label: 'Housekeeping', icon: '🧹' },
    { key: 'security', label: 'Security', icon: '🛡️' },
    { key: 'reports', label: 'Reports', icon: '📊' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  const availableWidgets = [
    { key: 'recent-activity', label: 'Recent Activity', icon: '📋' },
    { key: 'quick-stats', label: 'Quick Stats', icon: '📈' },
    { key: 'calendar', label: 'Calendar', icon: '📅' },
    { key: 'notifications', label: 'Notifications', icon: '🔔' },
    { key: 'weather', label: 'Weather', icon: '🌤️' },
    { key: 'tasks', label: 'Tasks', icon: '✅' },
  ];

  // Calculate metrics for overview
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.isActive).length;
  const totalRoles = roles.length;
  const systemRoles = roles.filter(r => r.permissions?.includes('*'));
  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || roleId;

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card className="border-0 shadow-lg">
        <CardBody className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-ghana-black">{totalUsers}</p>
              <p className="text-sm text-green-600">+{activeUsers} active</p>
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
              <p className="text-2xl font-bold text-ghana-black">{activeUsers}</p>
              <p className="text-sm text-green-600">{totalUsers > 0 ? Math.round((activeUsers/totalUsers)*100) : 0}% of total</p>
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
              <p className="text-sm text-blue-600">{systemRoles.length} system roles</p>
            </div>
            <div className="text-3xl">🔑</div>
          </div>
        </CardBody>
      </Card>
      
      <Card className="border-0 shadow-lg">
        <CardBody className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Current User</p>
              <p className="text-lg font-bold text-ghana-black">{currentUser?.firstName} {currentUser?.lastName}</p>
              <p className="text-sm text-gray-600">{roles.find(r => r.id === currentUser?.roleId)?.name || currentUser?.roleId}</p>
            </div>
            <div className="text-3xl">👤</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderUserManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-ghana-black">User Management</h3>
        <Button color="primary" onPress={handleCreateUser}>
          + Add New User
        </Button>
      </div>
      
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Table aria-label="Users table">
            <TableHeader>
              <TableColumn>USER</TableColumn>
              <TableColumn>ROLE</TableColumn>
              <TableColumn>DEPARTMENT</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar 
                        name={`${user.firstName} ${user.lastName}`}
                        className="bg-gradient-to-br from-ghana-green to-ghana-gold text-white"
                      />
                      <div>
                        <p className="font-semibold">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip color="primary" variant="flat" size="sm">
                      {getRoleName(user.roleId)}
                    </Chip>
                  </TableCell>
                  <TableCell>{user.profile?.department || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip 
                      color={user.isActive ? "success" : "danger"} 
                      variant="flat" 
                      size="sm"
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="flat" onPress={() => handleEditUser(user)}>
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        color="danger" 
                        variant="flat" 
                        onPress={() => handleDeleteUser(user.id)}
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
    </div>
  );

  const handleCreateRole = () => {
    console.log('🔧 [UserManagementUnified] Creating new role - opening modal');
    setIsEditingRole(false);
    setSelectedRole(null);
    resetRoleForm();
    setIsRoleModalOpen(true);
  };

  const handleEditRole = (role: { id: string; name: string; description: string; permissions?: string[]; isActive: boolean }) => {
    console.log('🔧 [UserManagementUnified] Editing role:', { roleId: role.id, name: role.name });
    setIsEditingRole(true);
    setSelectedRole(role as any);
    setRoleForm({
      name: role.name,
      description: role.description,
      permissions: role.permissions || [],
      isActive: role.isActive,
    });
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = () => {
    const permissions = roleForm.permissions;
    if (isEditingRole && selectedRole) {
      updateRole(selectedRole.id, {
        name: roleForm.name,
        description: roleForm.description,
        permissions,
        isActive: roleForm.isActive,
      });
      console.log('🔧 [UserManagementUnified] Updated role:', { roleId: selectedRole.id });
    } else {
      addRole({
        name: roleForm.name,
        description: roleForm.description,
        permissions,
        isActive: roleForm.isActive,
      });
      console.log('🔧 [UserManagementUnified] Created role:', { name: roleForm.name });
    }
    setIsRoleModalOpen(false);
  };

  // Full System Access ('*') supersedes everything — module/action checkboxes
  // are shown checked-and-disabled under it rather than storing redundant ids.
  const hasFullSystemAccess = roleForm.permissions.includes(FULL_SYSTEM_ACCESS);

  const toggleFullSystemAccess = (checked: boolean) => {
    setRoleForm({ ...roleForm, permissions: checked ? [FULL_SYSTEM_ACCESS] : [] });
  };

  const moduleActionIds = (mod: typeof PERMISSION_MODULES[number]) =>
    [mod.view, mod.create, mod.edit, mod.delete, ...mod.extra]
      .filter((a): a is { id: string; label: string } => !!a)
      .map(a => a.id);

  const isModuleFullAccess = (fullAccessId: string) =>
    hasFullSystemAccess || roleForm.permissions.includes(fullAccessId);

  const toggleModuleFullAccess = (mod: typeof PERMISSION_MODULES[number], checked: boolean) => {
    if (hasFullSystemAccess) return;
    setRoleForm(prev => {
      const withoutModule = prev.permissions.filter(
        p => p !== mod.fullAccessId && !moduleActionIds(mod).includes(p)
      );
      return { ...prev, permissions: checked ? [...withoutModule, mod.fullAccessId] : withoutModule };
    });
  };

  const isActionChecked = (mod: typeof PERMISSION_MODULES[number], actionId: string) =>
    isModuleFullAccess(mod.fullAccessId) || roleForm.permissions.includes(actionId);

  const toggleAction = (actionId: string, checked: boolean) => {
    if (hasFullSystemAccess) return;
    setRoleForm(prev => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, actionId]
        : prev.permissions.filter(p => p !== actionId),
    }));
  };

  const countSelectedExtras = (mod: typeof PERMISSION_MODULES[number]) =>
    isModuleFullAccess(mod.fullAccessId)
      ? mod.extra.length
      : mod.extra.filter(a => isActionChecked(mod, a.id)).length;

  const handleDeleteRole = (roleId: string) => {
    if (window.confirm('Delete this role? Users assigned to it will remain with the role id.')) {
      console.log('🔧 [UserManagementUnified] Deleting role:', { roleId });
      deleteRole(roleId);
    }
  };

  const renderRoleManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-ghana-black">Role Management</h3>
        <Button color="primary" onPress={handleCreateRole}>
          + Add New Role
        </Button>
      </div>
      
      <Card className="border-0 shadow-lg">
        <CardBody className="p-0">
          <Table aria-label="Roles table">
            <TableHeader>
              <TableColumn>ROLE NAME</TableColumn>
              <TableColumn>DESCRIPTION</TableColumn>
              <TableColumn>USERS</TableColumn>
              <TableColumn>TYPE</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {roles.map((role) => {
                const assignedUsers = users.filter(u => u.roleId === role.id).length;
                const isSystem = (role.permissions || []).includes('*');
                return (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-gradient-to-br from-ghana-green to-ghana-gold rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm">🔑</span>
                        </div>
                        <div>
                          <p className="font-semibold">{role.name}</p>
                          <p className="text-sm text-gray-500">{role.description}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{role.description}</TableCell>
                    <TableCell>
                      <Chip color="primary" variant="flat" size="sm">
                        {assignedUsers} users
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        color={isSystem ? "warning" : (role.isActive ? "success" : "default")} 
                        variant="flat" 
                        size="sm"
                      >
                        {isSystem ? 'System' : (role.isActive ? 'Active' : 'Inactive')}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="flat" onPress={() => handleEditRole(role)}>
                          Edit
                        </Button>
                        <Button size="sm" color="danger" variant="flat" onPress={() => handleDeleteRole(role.id)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );

  const renderUserPreferences = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-ghana-black">User Preferences & Settings</h3>
        <Button color="primary" onPress={savePreferences}>
          Save Preferences
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <h4 className="text-lg font-semibold text-ghana-black">👤 Profile Settings</h4>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={profileForm.firstName}
                onChange={(e) => setProfileForm({...profileForm, firstName: e.target.value})}
                placeholder="Enter first name"
              />
              <Input
                label="Last Name"
                value={profileForm.lastName}
                onChange={(e) => setProfileForm({...profileForm, lastName: e.target.value})}
                placeholder="Enter last name"
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
              placeholder="Enter email"
            />
            <Input
              label="Phone"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
              placeholder="Enter phone number"
            />
            <Input
              label="Department"
              value={profileForm.department}
              onChange={(e) => setProfileForm({...profileForm, department: e.target.value})}
              placeholder="Enter department"
            />
            <Input
              label="Position"
              value={profileForm.position}
              onChange={(e) => setProfileForm({...profileForm, position: e.target.value})}
              placeholder="Enter position"
            />
            <Textarea
              label="Bio"
              value={profileForm.bio}
              onChange={(e) => setProfileForm({...profileForm, bio: e.target.value})}
              placeholder="Tell us about yourself"
            />
            <div className="flex justify-end pt-2">
              <Button color="primary" onPress={handleSaveProfile}>Save Profile</Button>
            </div>
          </CardBody>
        </Card>

        {/* Theme & Display */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <h4 className="text-lg font-semibold text-ghana-black">🎨 Theme & Display</h4>
          </CardHeader>
          <CardBody className="space-y-4">
                         <Select
               label="Theme"
               selectedKeys={[userPreferences.theme]}
               onChange={(e) => updatePreference('theme', e.target.value)}
               description={`Current: ${userPreferences.theme === 'auto' ? 'System preference' : userPreferences.theme}`}
             >
               <SelectItem key="light">🌞 Light</SelectItem>
               <SelectItem key="dark">🌙 Dark</SelectItem>
               <SelectItem key="auto">🔄 Auto (System)</SelectItem>
             </Select>
            
            <Select
              label="Language"
              selectedKeys={[userPreferences.language]}
              onChange={(e) => updatePreference('language', e.target.value)}
            >
              <SelectItem key="en">English</SelectItem>
              <SelectItem key="tw">Twi</SelectItem>
              <SelectItem key="ga">Ga</SelectItem>
            </Select>
            
            <Select
              label="Timezone"
              selectedKeys={[userPreferences.timezone]}
              onChange={(e) => updatePreference('timezone', e.target.value)}
            >
              <SelectItem key="Africa/Accra">Ghana (GMT+0)</SelectItem>
              <SelectItem key="UTC">UTC</SelectItem>
            </Select>
            
            <Select
              label="Currency"
              selectedKeys={[userPreferences.currency]}
              onChange={(e) => updatePreference('currency', e.target.value)}
            >
              <SelectItem key="GHS">Ghana Cedi (₵)</SelectItem>
              <SelectItem key="USD">US Dollar ($)</SelectItem>
              <SelectItem key="EUR">Euro (€)</SelectItem>
            </Select>
          </CardBody>
        </Card>
      </div>

      {/* Notifications */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <h4 className="text-lg font-semibold text-ghana-black">🔔 Notification Preferences</h4>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email Notifications</span>
                <Switch 
                  isSelected={userPreferences.notifications.email}
                  onValueChange={(value) => updatePreference('notifications.email', value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Push Notifications</span>
                <Switch 
                  isSelected={userPreferences.notifications.push}
                  onValueChange={(value) => updatePreference('notifications.push', value)}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">SMS Notifications</span>
                <Switch 
                  isSelected={userPreferences.notifications.sms}
                  onValueChange={(value) => updatePreference('notifications.sms', value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Sound Notifications</span>
                <Switch 
                  isSelected={userPreferences.notifications.sound}
                  onValueChange={(value) => updatePreference('notifications.sound', value)}
                />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Security Settings */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <h4 className="text-lg font-semibold text-ghana-black">🛡️ Security</h4>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Two-Factor Authentication (2FA)</span>
            <Switch 
              isSelected={!!currentUser?.security?.twoFactorEnabled}
              onValueChange={handleToggleTwoFactor}
            />
          </div>
          <Divider />
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Current Password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              />
              <Input
                label="New Password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
              <Input
                label="Confirm Password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              />
            </div>
            <div className="flex justify-end">
              <Button color="primary" onPress={handleChangePassword}>Change Password</Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Dashboard Customization */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <h4 className="text-lg font-semibold text-ghana-black">📊 Dashboard Customization</h4>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="text-md font-medium mb-3">Quick Actions</h5>
              <div className="space-y-2">
                {availableQuickActions.map((action) => (
                  <div key={action.key} className="flex items-center space-x-2">
                    <Switch 
                      isSelected={userPreferences.dashboard.quickActions.includes(action.key)}
                      onValueChange={(value) => {
                        const current = userPreferences.dashboard.quickActions;
                        if (value) {
                          updatePreference('dashboard.quickActions', [...current, action.key]);
                        } else {
                          updatePreference('dashboard.quickActions', current.filter(k => k !== action.key));
                        }
                      }}
                    />
                    <span className="text-sm">{action.icon} {action.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h5 className="text-md font-medium mb-3">Dashboard Widgets</h5>
              <div className="space-y-2">
                {availableWidgets.map((widget) => (
                  <div key={widget.key} className="flex items-center space-x-2">
                    <Switch 
                      isSelected={userPreferences.dashboard.widgets.includes(widget.key)}
                      onValueChange={(value) => {
                        const current = userPreferences.dashboard.widgets;
                        if (value) {
                          updatePreference('dashboard.widgets', [...current, widget.key]);
                        } else {
                          updatePreference('dashboard.widgets', current.filter(k => k !== widget.key));
                        }
                      }}
                    />
                    <span className="text-sm">{widget.icon} {widget.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">👥 User Management & Preferences</h1>
          <p className="text-gray-600">Complete user lifecycle management with Ghana compliance, role-based access control, and personalized preferences</p>
        </div>
                 <div className="flex items-center space-x-2">
           <Badge color="success">System Online</Badge>
           <Badge color="primary">SaaS Ready</Badge>
           <Badge 
             color={userPreferences.theme === 'dark' ? 'secondary' : 'default'}
             className="flex items-center space-x-1"
           >
             {userPreferences.theme === 'light' && '🌞'}
             {userPreferences.theme === 'dark' && '🌙'}
             {userPreferences.theme === 'auto' && '🔄'}
             {userPreferences.theme}
           </Badge>
         </div>
      </div>

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={(key) => {
          const newTab = key as string;
          console.log('🔧 [UserManagementUnified] Tab changed from', selectedTab, 'to', newTab);
          setSelectedTab(newTab);
        }}
        className="w-full"
      >
        <Tab key="overview" title="Overview" />
        <Tab key="users" title="User Management" />
        <Tab key="roles" title="Role Management" />
        <Tab key="preferences" title="User Preferences" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'users' && renderUserManagement()}
        {selectedTab === 'roles' && renderRoleManagement()}
        {selectedTab === 'preferences' && renderUserPreferences()}
      </div>

      {/* User Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isEditing ? 'Edit User' : 'Create New User'}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Username"
                value={userForm.username}
                onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                placeholder="Enter username"
              />
              <Input
                label="Email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                placeholder="Enter email"
              />
              <Input
                label="First Name"
                value={userForm.firstName}
                onChange={(e) => setUserForm({...userForm, firstName: e.target.value})}
                placeholder="Enter first name"
              />
              <Input
                label="Last Name"
                value={userForm.lastName}
                onChange={(e) => setUserForm({...userForm, lastName: e.target.value})}
                placeholder="Enter last name"
              />
              <Select
                label="Role"
                selectedKeys={userForm.roleId ? [userForm.roleId] : []}
                onChange={(e) => setUserForm({...userForm, roleId: e.target.value})}
              >
                {roles.map((role) => (
                  <SelectItem key={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </Select>
              <Input
                label="Employee ID"
                value={userForm.employeeId}
                onChange={(e) => setUserForm({...userForm, employeeId: e.target.value})}
                placeholder="Enter employee ID"
              />
              <Input
                label="Department"
                value={userForm.department}
                onChange={(e) => setUserForm({...userForm, department: e.target.value})}
                placeholder="Enter department"
              />
              <Input
                label="Position"
                value={userForm.position}
                onChange={(e) => setUserForm({...userForm, position: e.target.value})}
                placeholder="Enter position"
              />
              <Input
                label="Phone"
                value={userForm.phone}
                onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                placeholder="Enter phone number"
              />
              <Input
                label="Address"
                value={userForm.address}
                onChange={(e) => setUserForm({...userForm, address: e.target.value})}
                placeholder="Enter address"
              />
            </div>
            <Textarea
              label="Bio"
              value={userForm.bio}
              onChange={(e) => setUserForm({...userForm, bio: e.target.value})}
              placeholder="Tell us about this user"
              className="mt-4"
            />
            <div className="mt-4">
              <Switch
                isSelected={userForm.isActive}
                onValueChange={(value) => setUserForm({...userForm, isActive: value})}
              >
                Active User
              </Switch>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleSaveUser}>
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Role Modal */}
      <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            {isEditingRole ? 'Edit Role' : 'Create New Role'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Role Name"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                placeholder="e.g., Front Desk Supervisor"
              />
              <Textarea
                label="Description"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                placeholder="Describe the role"
              />

              <div className="border rounded-lg p-3 bg-default-50">
                <Checkbox
                  isSelected={hasFullSystemAccess}
                  onValueChange={toggleFullSystemAccess}
                >
                  <span className="font-semibold">Full System Access</span>
                  <span className="text-default-500 text-sm ml-1">— every module, current and future (System Administrator)</span>
                </Checkbox>
              </div>

              <div>
                <div className="text-sm font-medium text-default-600 mb-2">Permissions by module</div>
                <div className={`overflow-x-auto border rounded-lg ${hasFullSystemAccess ? 'opacity-50 pointer-events-none' : ''}`}>
                  <table className="w-full text-sm">
                    <thead className="bg-default-100">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Module</th>
                        <th className="text-center px-2 py-2 font-medium">Full</th>
                        <th className="text-center px-2 py-2 font-medium">View</th>
                        <th className="text-center px-2 py-2 font-medium">Create</th>
                        <th className="text-center px-2 py-2 font-medium">Edit</th>
                        <th className="text-center px-2 py-2 font-medium">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_MODULES.map((mod) => {
                        const fullAccess = isModuleFullAccess(mod.fullAccessId);
                        return (
                          <tr key={mod.key} className="border-t border-default-200">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="mr-1">{mod.icon}</span>{mod.label}
                            </td>
                            <td className="text-center px-2 py-2">
                              <Checkbox
                                aria-label={`${mod.label} — full access`}
                                isSelected={fullAccess}
                                onValueChange={(v) => toggleModuleFullAccess(mod, v)}
                              />
                            </td>
                            {(['view', 'create', 'edit', 'delete'] as const).map((col) => {
                              const action = mod[col];
                              return (
                                <td key={col} className="text-center px-2 py-2">
                                  {action ? (
                                    <Checkbox
                                      aria-label={action.label}
                                      isSelected={isActionChecked(mod, action.id)}
                                      isDisabled={fullAccess}
                                      onValueChange={(v) => toggleAction(action.id, v)}
                                    />
                                  ) : (
                                    <span className="text-default-300">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {PERMISSION_MODULES.some((m) => m.extra.length > 0) && (
                  <div className={`mt-3 ${hasFullSystemAccess ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="text-sm font-medium text-default-600 mb-2">
                      Specific actions <span className="text-default-400 font-normal">— granted on top of View/Create/Edit/Delete above</span>
                    </div>
                    <Accordion variant="bordered" itemClasses={{ title: 'text-sm' }}>
                      {PERMISSION_MODULES.filter((m) => m.extra.length > 0).map((mod) => {
                        const selected = countSelectedExtras(mod);
                        return (
                          <AccordionItem
                            key={mod.key}
                            title={
                              <span>
                                <span className="mr-1">{mod.icon}</span>
                                {mod.label}
                                <span className="text-default-400 ml-2 text-xs">
                                  {selected > 0 ? `${selected}/${mod.extra.length} selected` : `${mod.extra.length} actions`}
                                </span>
                              </span>
                            }
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pb-2">
                              {mod.extra.map((action) => (
                                <Checkbox
                                  key={action.id}
                                  size="sm"
                                  isSelected={isActionChecked(mod, action.id)}
                                  isDisabled={isModuleFullAccess(mod.fullAccessId)}
                                  onValueChange={(v) => toggleAction(action.id, v)}
                                >
                                  {action.label}
                                </Checkbox>
                              ))}
                            </div>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>
                )}
              </div>

              <div>
                <Switch
                  isSelected={roleForm.isActive}
                  onValueChange={(v) => setRoleForm({ ...roleForm, isActive: v })}
                >
                  Active Role
                </Switch>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsRoleModalOpen(false)}>Cancel</Button>
            <Button color="primary" onPress={handleSaveRole}>{isEditingRole ? 'Update' : 'Create'}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
