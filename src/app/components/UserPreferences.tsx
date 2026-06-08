'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Tabs, 
  Tab,
  Button,
  Input,
  Select,
  SelectItem,
  Switch,
  Divider,
  Avatar,
  Textarea
} from "@heroui/react";
import { useSettingsStore } from '../lib/settings/store';
import { applyTheme, type AppTheme } from '../lib/theme/applyTheme';

export default function UserPreferences() {
  const [selectedTab, setSelectedTab] = useState("profile");
  const { currentUser, updateNestedSetting, updateUserProfile, updateUserSecurity, changePassword } = useSettingsStore();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
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

  const savePreferences = () => {
    // Settings are automatically saved via the store
    // Apply theme immediately
    applyTheme(userPreferences.theme as AppTheme);
  };

  const updatePreference = (path: string, value: any) => {
    if (currentUser) {
      updateNestedSetting(`currentUser.preferences.${path}`, value);
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ghana-black">User Preferences</h1>
              <p className="text-gray-600 mt-2">Customize your experience and dashboard layout</p>
            </div>
            <div className="flex items-center space-x-4">
              <Avatar 
                name={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "User"} 
                size="lg"
                className="bg-ghana-green text-white"
              />
              <div>
                <p className="font-medium text-ghana-black">
                  {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Current User"}
                </p>
                <p className="text-sm text-gray-600">
                  {currentUser?.email || "user@ghana-hotel.com"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Preferences Tabs */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <Tabs 
              selectedKey={selectedTab} 
              onSelectionChange={(key) => setSelectedTab(key as string)}
              className="w-full"
            >
              <Tab key="profile" title="Profile" />
              <Tab key="security" title="Security" />
              <Tab key="appearance" title="Appearance" />
              <Tab key="notifications" title="Notifications" />
              <Tab key="dashboard" title="Dashboard" />
              <Tab key="accessibility" title="Accessibility" />
              <Tab key="regional" title="Regional" />
            </Tabs>
          </CardHeader>
          <CardBody>
            {selectedTab === "profile" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">Profile Information</h3>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Personal Information</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="First Name"
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      />
                      <Input
                        label="Last Name"
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                      />
                    </div>
                    
                    <Input
                      label="Email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    />
                    
                    <Input
                      label="Phone"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                    
                    <Textarea
                      label="Address"
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    />
                  </CardBody>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Professional Information</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Department"
                        value={profileForm.department}
                        onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                      />
                      <Input
                        label="Position"
                        value={profileForm.position}
                        onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
                      />
                    </div>
                    
                    <Textarea
                      label="Bio"
                      placeholder="Tell us about yourself..."
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    />
                  </CardBody>
                </Card>

                <div className="flex justify-end">
                  <Button 
                    color="primary" 
                    className="bg-ghana-green text-white"
                    onClick={() => {
                      if (currentUser) {
                        updateUserProfile(currentUser.id, {
                          phone: profileForm.phone,
                          address: profileForm.address,
                          department: profileForm.department,
                          position: profileForm.position,
                          bio: profileForm.bio,
                        });
                      }
                    }}
                  >
                    Update Profile
                  </Button>
                </div>
              </div>
            )}

            {selectedTab === "security" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">Security Settings</h3>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Change Password</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
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
                      label="Confirm New Password"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    />
                    
                    <div className="flex justify-end">
                      <Button 
                        color="primary" 
                        className="bg-ghana-green text-white"
                        onClick={() => {
                          if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                            alert('New passwords do not match!');
                            return;
                          }
                          if (currentUser) {
                            changePassword(currentUser.id, passwordForm.newPassword);
                            setPasswordForm({
                              currentPassword: '',
                              newPassword: '',
                              confirmPassword: '',
                            });
                            alert('Password changed successfully!');
                          }
                        }}
                      >
                        Change Password
                      </Button>
                    </div>
                  </CardBody>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Account Security</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-ghana-black">Two-Factor Authentication</h5>
                        <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                      </div>
                      <Switch 
                        isSelected={currentUser?.security?.twoFactorEnabled || false}
                        onValueChange={(value) => {
                          if (currentUser) {
                            updateUserSecurity(currentUser.id, { twoFactorEnabled: value });
                          }
                        }}
                      />
                    </div>
                    
                    <Divider />
                    
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        <strong>Last Password Change:</strong> {currentUser?.security?.passwordLastChanged ? 
                          new Date(currentUser.security.passwordLastChanged).toLocaleDateString() : 'Never'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Password Expires:</strong> {currentUser?.security?.passwordExpiryDate ? 
                          new Date(currentUser.security.passwordExpiryDate).toLocaleDateString() : 'Never'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Failed Login Attempts:</strong> {currentUser?.security?.failedLoginAttempts || 0}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {selectedTab === "appearance" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">Appearance Settings</h3>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Theme & Display</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <Select
                         label="Theme"
                         selectedKeys={[userPreferences.theme]}
                         onSelectionChange={(keys) => {
                           const theme = Array.from(keys)[0] as AppTheme;
                           updatePreference('theme', theme);
                           applyTheme(theme);
                         }}
                       >
                        <SelectItem key="light">Light Theme</SelectItem>
                        <SelectItem key="dark">Dark Theme</SelectItem>
                        <SelectItem key="auto">Auto (System)</SelectItem>
                      </Select>
                      
                      <Select
                        label="Font Size"
                        selectedKeys={[userPreferences.accessibility.fontSize]}
                        onSelectionChange={(keys) => {
                          const fontSize = Array.from(keys)[0] as string;
                          updatePreference('accessibility.fontSize', fontSize);
                        }}
                      >
                        <SelectItem key="small">Small</SelectItem>
                        <SelectItem key="medium">Medium</SelectItem>
                        <SelectItem key="large">Large</SelectItem>
                      </Select>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-ghana-black">High Contrast Mode</h5>
                        <p className="text-sm text-gray-600">Increase contrast for better visibility</p>
                      </div>
                      <Switch 
                        isSelected={userPreferences.accessibility.highContrast}
                        onValueChange={(value) => updatePreference('accessibility.highContrast', value)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-ghana-black">Reduce Motion</h5>
                        <p className="text-sm text-gray-600">Minimize animations and transitions</p>
                      </div>
                      <Switch 
                        isSelected={userPreferences.accessibility.reduceMotion}
                        onValueChange={(value) => updatePreference('accessibility.reduceMotion', value)}
                      />
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {selectedTab === "notifications" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">Notification Preferences</h3>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Notification Channels</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-ghana-black">Email Notifications</h5>
                        <p className="text-sm text-gray-600">Receive notifications via email</p>
                      </div>
                      <Switch 
                        isSelected={userPreferences.notifications.email}
                        onValueChange={(value) => updatePreference('notifications.email', value)}
                      />
                    </div>
                    
                    <Divider />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-ghana-black">Push Notifications</h5>
                        <p className="text-sm text-gray-600">Browser push notifications</p>
                      </div>
                      <Switch 
                        isSelected={userPreferences.notifications.push}
                        onValueChange={(value) => updatePreference('notifications.push', value)}
                      />
                    </div>
                    
                    <Divider />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-ghana-black">SMS Notifications</h5>
                        <p className="text-sm text-gray-600">Text message alerts</p>
                      </div>
                      <Switch 
                        isSelected={userPreferences.notifications.sms}
                        onValueChange={(value) => updatePreference('notifications.sms', value)}
                      />
                    </div>
                    
                    <Divider />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-ghana-black">Sound Alerts</h5>
                        <p className="text-sm text-gray-600">Play sounds for notifications</p>
                      </div>
                      <Switch 
                        isSelected={userPreferences.notifications.sound}
                        onValueChange={(value) => updatePreference('notifications.sound', value)}
                      />
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {selectedTab === "dashboard" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">Dashboard Customization</h3>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Default View</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <Select
                      label="Default Dashboard View"
                      selectedKeys={[userPreferences.dashboard.defaultView]}
                      onSelectionChange={(keys) => {
                        const view = Array.from(keys)[0] as string;
                        updatePreference('dashboard.defaultView', view);
                      }}
                    >
                      <SelectItem key="overview">Overview</SelectItem>
                      <SelectItem key="frontdesk">Front Desk</SelectItem>
                      <SelectItem key="housekeeping">Housekeeping</SelectItem>
                      <SelectItem key="f&b">Food & Beverage</SelectItem>
                      <SelectItem key="security">Security</SelectItem>
                      <SelectItem key="reports">Reports</SelectItem>
                    </Select>
                  </CardBody>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Quick Actions</h4>
                    <p className="text-sm text-gray-600">Select which quick actions to show on your dashboard</p>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableQuickActions.map((action) => (
                        <div key={action.key} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <span className="text-xl">{action.icon}</span>
                          <span className="flex-1 text-sm font-medium">{action.label}</span>
                                                     <Switch 
                             size="sm"
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
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Dashboard Widgets</h4>
                    <p className="text-sm text-gray-600">Choose which widgets to display on your dashboard</p>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableWidgets.map((widget) => (
                        <div key={widget.key} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <span className="text-xl">{widget.icon}</span>
                          <span className="flex-1 text-sm font-medium">{widget.label}</span>
                                                     <Switch 
                             size="sm"
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
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {selectedTab === "accessibility" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">Accessibility Settings</h3>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Visual Accessibility</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <Select
                         label="Font Size"
                         selectedKeys={[userPreferences.accessibility.fontSize]}
                         onSelectionChange={(keys) => {
                           const fontSize = Array.from(keys)[0] as string;
                           updatePreference('accessibility.fontSize', fontSize);
                         }}
                       >
                        <SelectItem key="small">Small (12px)</SelectItem>
                        <SelectItem key="medium">Medium (14px)</SelectItem>
                        <SelectItem key="large">Large (16px)</SelectItem>
                      </Select>
                      
                                             <Select
                         label="Color Scheme"
                         selectedKeys={[userPreferences.accessibility.highContrast ? 'high' : 'normal']}
                         onSelectionChange={(keys) => {
                           const scheme = Array.from(keys)[0] as string;
                           updatePreference('accessibility.highContrast', scheme === 'high');
                         }}
                       >
                        <SelectItem key="normal">Normal Contrast</SelectItem>
                        <SelectItem key="high">High Contrast</SelectItem>
                      </Select>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-ghana-black">Reduce Motion</h5>
                        <p className="text-sm text-gray-600">Minimize animations and transitions</p>
                      </div>
                                             <Switch 
                         isSelected={userPreferences.accessibility.reduceMotion}
                         onValueChange={(value) => updatePreference('accessibility.reduceMotion', value)}
                       />
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {selectedTab === "regional" && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-ghana-black">Regional Settings</h3>
                
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <h4 className="text-lg font-semibold text-ghana-black">Localization</h4>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <Select
                         label="Language"
                         selectedKeys={[userPreferences.language]}
                         onSelectionChange={(keys) => {
                           const language = Array.from(keys)[0] as string;
                           updatePreference('language', language);
                         }}
                       >
                        <SelectItem key="en">English</SelectItem>
                        <SelectItem key="fr">French</SelectItem>
                        <SelectItem key="es">Spanish</SelectItem>
                        <SelectItem key="ar">Arabic</SelectItem>
                      </Select>
                      
                                             <Select
                         label="Timezone"
                         selectedKeys={[userPreferences.timezone]}
                         onSelectionChange={(keys) => {
                           const timezone = Array.from(keys)[0] as string;
                           updatePreference('timezone', timezone);
                         }}
                       >
                        <SelectItem key="Africa/Accra">Africa/Accra (GMT+0)</SelectItem>
                        <SelectItem key="Africa/Lagos">Africa/Lagos (GMT+1)</SelectItem>
                        <SelectItem key="Europe/London">Europe/London (GMT+0/+1)</SelectItem>
                        <SelectItem key="America/New_York">America/New_York (GMT-5/-4)</SelectItem>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <Select
                         label="Date Format"
                         selectedKeys={[userPreferences.dateFormat]}
                         onSelectionChange={(keys) => {
                           const format = Array.from(keys)[0] as string;
                           updatePreference('dateFormat', format);
                         }}
                       >
                        <SelectItem key="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem key="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem key="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </Select>
                      
                                             <Select
                         label="Currency"
                         selectedKeys={[userPreferences.currency]}
                         onSelectionChange={(keys) => {
                           const currency = Array.from(keys)[0] as string;
                           updatePreference('currency', currency);
                         }}
                       >
                        <SelectItem key="GHS">GHS (Ghana Cedi)</SelectItem>
                        <SelectItem key="USD">USD (US Dollar)</SelectItem>
                        <SelectItem key="EUR">EUR (Euro)</SelectItem>
                        <SelectItem key="GBP">GBP (British Pound)</SelectItem>
                      </Select>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end mt-6">
              <Button 
                color="primary" 
                className="bg-ghana-green text-white"
                onClick={savePreferences}
              >
                Save Preferences
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
