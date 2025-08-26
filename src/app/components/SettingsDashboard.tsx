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
  Textarea,
  Tabs,
  Tab,
  Chip
} from "@heroui/react";
import { useSettingsStore } from '../lib/settings/store';

interface RoomType {
  id: string;
  name: string;
  baseRate: number;
  capacity: number;
  amenities: string[];
  isActive: boolean;
  category: string;
  description: string;
  images: string[];
  policies: {
    cancellation: string;
    deposit: boolean;
    smoking: boolean;
    pets: boolean;
  };
}

export default function SettingsDashboard() {
  const [selectedTab, setSelectedTab] = useState("general");
  const [showBulkRoomModal, setShowBulkRoomModal] = useState(false);
  const [showBulkRateModal, setShowBulkRateModal] = useState(false);
  const [showBulkAmenityModal, setShowBulkAmenityModal] = useState(false);
  const [showEditRoomTypeModal, setShowEditRoomTypeModal] = useState(false);
  const [showRoomGridModal, setShowRoomGridModal] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
  const [selectedRoomStatus, setSelectedRoomStatus] = useState('all');
  const [bulkRoomData, setBulkRoomData] = useState({
    roomTypeId: '',
    count: 1,
    startNumber: 1,
    floor: '1'
  });
  const [bulkRateData, setBulkRateData] = useState({
    roomTypeIds: [] as string[],
    multiplier: 1.0,
    reason: ''
  });
  const [bulkAmenityData, setBulkAmenityData] = useState({
    roomTypeIds: [] as string[],
    amenities: [] as string[],
    action: 'add' // 'add' or 'remove'
  });
  const [globalAmenities, setGlobalAmenities] = useState([
    { name: 'Air Conditioning', enabled: true },
    { name: 'Television', enabled: true },
    { name: 'Safe Deposit Box', enabled: false },
    { name: 'Kitchenette', enabled: false },
    { name: 'WiFi Internet', enabled: true },
    { name: 'Mini Refrigerator', enabled: true },
    { name: 'Balcony/Terrace', enabled: false },
    { name: 'Room Service', enabled: true }
  ]);
  const [globalRates, setGlobalRates] = useState({
    peakSeasonMultiplier: 1.5,
    offSeasonMultiplier: 0.8,
    weekendMultiplier: 1.2,
    earlyCheckinFee: 50,
    lateCheckoutFee: 75,
    extraBedFee: 100,
    peakSeasonStart: '',
    peakSeasonEnd: '',
    offSeasonStart: '',
    offSeasonEnd: ''
  });
  
  const settings = useSettingsStore();

  // Load saved global settings on component mount
  React.useEffect(() => {
    const savedRates = localStorage.getItem('globalRates');
    if (savedRates) {
      try {
        setGlobalRates(JSON.parse(savedRates));
      } catch {
        console.log('Could not load saved rates');
      }
    }
    
    const savedAmenities = localStorage.getItem('globalAmenities');
    if (savedAmenities) {
      try {
        setGlobalAmenities(JSON.parse(savedAmenities));
      } catch {
        console.log('Could not load saved amenities');
      }
    }
  }, []);

  const handleSave = () => {
    settings.saveSettings();
  };

  // Render functions for all settings categories
  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">System Information</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="System Name" 
              value={settings.systemName}
              onChange={(e) => settings.updateSetting('systemName', e.target.value)}
            />
            <Input 
              label="Version" 
              value={settings.version}
              readOnly
            />
            <Input 
              label="Environment" 
              value={settings.environment}
              readOnly
            />
            <Input 
              label="Default Country" 
              value={settings.defaultCountry}
              onChange={(e) => settings.updateSetting('defaultCountry', e.target.value)}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderHotelSettings = () => (
    <div className="space-y-6">
      {/* Basic Hotel Settings */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Hotel Settings</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Check-in Time" 
              type="time"
              value={settings.hotelSettings.checkInTime}
              onChange={(e) => settings.updateHotelSettings({ checkInTime: e.target.value })}
            />
            <Input 
              label="Check-out Time" 
              type="time"
              value={settings.hotelSettings.checkOutTime}
              onChange={(e) => settings.updateHotelSettings({ checkOutTime: e.target.value })}
            />
            <Input 
              label="Late Check-out Fee (₵)" 
              type="number"
              value={settings.hotelSettings.lateCheckOutFee.toString()}
              onChange={(e) => settings.updateHotelSettings({ lateCheckOutFee: parseInt(e.target.value) })}
            />
            <Input 
              label="Early Check-in Fee (₵)" 
              type="number"
              value={settings.hotelSettings.earlyCheckInFee.toString()}
              onChange={(e) => settings.updateHotelSettings({ earlyCheckInFee: parseInt(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Switch 
              isSelected={settings.hotelSettings.petPolicy}
              onValueChange={(checked) => settings.updateHotelSettings({ petPolicy: checked })}
            >
              Allow Pets
            </Switch>
            <Switch 
              isSelected={settings.hotelSettings.smokingPolicy}
              onValueChange={(checked) => settings.updateHotelSettings({ smokingPolicy: checked })}
            >
              Allow Smoking
            </Switch>
            <Switch 
              isSelected={settings.hotelSettings.parkingAvailable}
              onValueChange={(checked) => settings.updateHotelSettings({ parkingAvailable: checked })}
            >
              Parking Available
            </Switch>
            <Switch 
              isSelected={settings.hotelSettings.airportShuttle}
              onValueChange={(checked) => settings.updateHotelSettings({ airportShuttle: checked })}
            >
              Airport Shuttle
            </Switch>
          </div>
          <Textarea 
            label="Cancellation Policy" 
            value={settings.hotelSettings.cancellationPolicy}
            onChange={(e) => settings.updateHotelSettings({ cancellationPolicy: e.target.value })}
          />
          <Textarea 
            label="No-Show Policy" 
            value={settings.hotelSettings.noShowPolicy}
            onChange={(e) => settings.updateHotelSettings({ noShowPolicy: e.target.value })}
          />
        </CardBody>
      </Card>

      {/* Room Management Section */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">🏨 Room Management</h3>
          <p className="text-sm text-gray-600">Configure room types, amenities, and pricing</p>
        </CardHeader>
        <CardBody>
          <div className="space-y-8">
            {/* Room Types Management */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-800 text-lg">Room Types & Categories</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search room types..."
                    size="sm"
                    className="w-64"
                    startContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-small">🔍</span>
                      </div>
                    }
                  />
                  <Button 
                    color="primary" 
                    variant="flat" 
                    size="sm"
                    onPress={() => {
                      const newType = {
                        id: `type-${Date.now()}`,
                        name: 'New Room Type',
                        baseRate: 0,
                        capacity: 2,
                        amenities: [],
                        isActive: true,
                        category: 'standard',
                        description: '',
                        images: [],
                        policies: {
                          cancellation: 'flexible',
                          deposit: false,
                          smoking: false,
                          pets: false
                        }
                      };
                      settings.addRoomType(newType);
                    }}
                  >
                    ➕ Add Room Type
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {settings.roomManagement.roomTypes.map((type) => (
                  <div key={type.id} className="border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-4 border-b bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h5 className="font-semibold text-gray-800">{type.name}</h5>
                          <p className="text-sm text-gray-600">
                            {type.category?.toUpperCase()} • {type.capacity} {type.capacity === 1 ? 'Adult' : 'Adults'} • ₵{type.baseRate}/night
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            color="secondary" 
                            variant="flat"
                            onPress={() => {
                              setSelectedRoomType(type);
                              setShowRoomGridModal(true);
                            }}
                          >
                            #{settings.roomManagement.rooms?.filter(r => r.typeId === type.id).length || 0} Rooms
                          </Button>
                          <Button 
                            size="sm" 
                            color="primary" 
                            variant="light"
                            onPress={() => {
                              setEditingRoomType(type);
                              setShowEditRoomTypeModal(true);
                            }}
                          >
                            ✏️
                          </Button>
                          <Button 
                            size="sm" 
                            color="danger" 
                            variant="light"
                            onPress={() => {
                              const updatedTypes = settings.roomManagement.roomTypes.filter(t => t.id !== type.id);
                              settings.updateRoomManagement({ roomTypes: updatedTypes });
                            }}
                          >
                            🗑️
                          </Button>
                        </div>
                      </div>
                      
                      {/* Amenities Display */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {type.amenities.slice(0, 3).map((amenity, amenityIndex) => (
                          <Chip 
                            key={amenityIndex} 
                            size="sm" 
                            variant="flat"
                            color="primary"
                          >
                            {amenity}
                          </Chip>
                        ))}
                        {type.amenities.length > 3 && (
                          <Chip size="sm" variant="flat" color="secondary">
                            +{type.amenities.length - 3} more
                          </Chip>
                        )}
                      </div>
                      
                      {/* Availability Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {settings.roomManagement.rooms?.filter(r => r.typeId === type.id && r.status === 'clean').length || 0}/
                            {settings.roomManagement.rooms?.filter(r => r.typeId === type.id).length || 0} Available
                          </span>
                          <span className="text-green-600 font-medium">
                            {settings.roomManagement.rooms?.filter(r => r.typeId === type.id && r.status === 'clean').length || 0} Available
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${settings.roomManagement.rooms?.filter(r => r.typeId === type.id).length > 0 
                                ? (settings.roomManagement.rooms?.filter(r => r.typeId === type.id && r.status === 'clean').length / 
                                   settings.roomManagement.rooms?.filter(r => r.typeId === type.id).length) * 100 
                                : 0}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Room Amenities */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 text-lg">Room Amenities</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {globalAmenities.slice(0, 4).map((amenity, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Switch
                        isSelected={amenity.enabled}
                        onValueChange={(checked) => {
                          const updatedAmenities = [...globalAmenities];
                          updatedAmenities[index].enabled = checked;
                          setGlobalAmenities(updatedAmenities);
                        }}
                        size="sm"
                      />
                      <span className="text-sm font-medium">{amenity.name}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {globalAmenities.slice(4).map((amenity, index) => (
                    <div key={index + 4} className="flex items-center gap-2">
                      <Switch
                        isSelected={amenity.enabled}
                        onValueChange={(checked) => {
                          const updatedAmenities = [...globalAmenities];
                          updatedAmenities[index + 4].enabled = checked;
                          setGlobalAmenities(updatedAmenities);
                        }}
                        size="sm"
                      />
                      <span className="text-sm font-medium">{amenity.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button 
                color="secondary" 
                variant="flat" 
                size="sm"
                onPress={() => {
                  // Apply amenities to all room types
                  const enabledAmenities = globalAmenities.filter(a => a.enabled).map(a => a.name);
                  settings.roomManagement.roomTypes.forEach(roomType => {
                    settings.updateRoomType(roomType.id, { amenities: enabledAmenities });
                  });
                  // Save to localStorage
                  localStorage.setItem('globalAmenities', JSON.stringify(globalAmenities));
                  alert('Amenities updated across all room types!');
                }}
              >
                Update Amenities
              </Button>
            </div>

            {/* Rate Configuration */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 text-lg">Rate Configuration</h4>
              
              {/* Seasonal Date Configuration */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h5 className="font-semibold text-blue-800 mb-3">📅 Seasonal Date Configuration</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h6 className="font-medium text-blue-700">Peak Season</h6>
                    <Input
                      label="Start Date"
                      type="date"
                      value={globalRates.peakSeasonStart || ''}
                      onChange={(e) => setGlobalRates({...globalRates, peakSeasonStart: e.target.value})}
                      size="sm"
                      startContent={
                        <div className="pointer-events-none flex items-center">
                          <span className="text-default-400 text-small">📅</span>
                        </div>
                      }
                    />
                    <Input
                      label="End Date"
                      type="date"
                      value={globalRates.peakSeasonEnd || ''}
                      onChange={(e) => setGlobalRates({...globalRates, peakSeasonEnd: e.target.value})}
                      size="sm"
                      startContent={
                        <div className="pointer-events-none flex items-center">
                          <span className="text-default-400 text-small">📅</span>
                        </div>
                      }
                    />
                  </div>
                  <div className="space-y-3">
                    <h6 className="font-medium text-blue-700">Off-Peak Season</h6>
                    <Input
                      label="Start Date"
                      type="date"
                      value={globalRates.offSeasonStart || ''}
                      onChange={(e) => setGlobalRates({...globalRates, offSeasonStart: e.target.value})}
                      size="sm"
                      startContent={
                        <div className="pointer-events-none flex items-center">
                          <span className="text-default-400 text-small">📅</span>
                        </div>
                      }
                    />
                    <Input
                      label="End Date"
                      type="date"
                      value={globalRates.offSeasonEnd || ''}
                      onChange={(e) => setGlobalRates({...globalRates, offSeasonEnd: e.target.value})}
                      size="sm"
                      startContent={
                        <div className="pointer-events-none flex items-center">
                          <span className="text-default-400 text-small">📅</span>
                        </div>
                      }
                    />
                  </div>
                </div>
                <div className="mt-3 text-sm text-blue-600">
                  💡 <strong>Tip:</strong> Set your peak season dates (e.g., December-March for winter tourism) and off-peak dates (e.g., April-November for low season). The system will automatically apply the appropriate multipliers.
                </div>
                
                {/* Current Season Indicator */}
                <div className="mt-4 p-3 bg-white rounded border">
                  <h6 className="font-medium text-gray-700 mb-2">🌍 Current Season Status</h6>
                  <div className="text-sm">
                    {(() => {
                      const today = new Date();
                      const currentDate = today.toISOString().split('T')[0];
                      
                      if (globalRates.peakSeasonStart && globalRates.peakSeasonEnd) {
                        if (currentDate >= globalRates.peakSeasonStart && currentDate <= globalRates.peakSeasonEnd) {
                          return (
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                              <span className="text-red-700 font-medium">PEAK SEASON ACTIVE</span>
                              <span className="text-gray-600">(×{globalRates.peakSeasonMultiplier} rates)</span>
                            </div>
                          );
                        }
                      }
                      
                      if (globalRates.offSeasonStart && globalRates.offSeasonEnd) {
                        if (currentDate >= globalRates.offSeasonStart && currentDate <= globalRates.offSeasonEnd) {
                          return (
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                              <span className="text-blue-700 font-medium">OFF-PEAK SEASON ACTIVE</span>
                              <span className="text-gray-600">(×{globalRates.offSeasonMultiplier} rates)</span>
                            </div>
                          );
                        }
                      }
                      
                      return (
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                          <span className="text-gray-600">REGULAR SEASON</span>
                          <span className="text-gray-500">(standard rates)</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Preset Date Suggestions */}
                <div className="mt-4">
                  <h6 className="font-medium text-blue-700 mb-2">🚀 Quick Setup Presets</h6>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      onPress={() => {
                        // Ghana Tourism Pattern: Peak Dec-Mar (Christmas, New Year, Harmattan), Off-Peak Apr-Nov
                        setGlobalRates({
                          ...globalRates,
                          peakSeasonStart: `${new Date().getFullYear()}-12-01`,
                          peakSeasonEnd: `${new Date().getFullYear() + 1}-03-31`,
                          offSeasonStart: `${new Date().getFullYear()}-04-01`,
                          offSeasonEnd: `${new Date().getFullYear()}-11-30`
                        });
                      }}
                    >
                      🇬🇭 Ghana Tourism Pattern
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color="secondary"
                      onPress={() => {
                        // European Summer Pattern: Peak Jun-Aug, Off-Peak Dec-Feb
                        setGlobalRates({
                          ...globalRates,
                          peakSeasonStart: `${new Date().getFullYear()}-06-01`,
                          peakSeasonEnd: `${new Date().getFullYear()}-08-31`,
                          offSeasonStart: `${new Date().getFullYear()}-12-01`,
                          offSeasonEnd: `${new Date().getFullYear() + 1}-02-28`
                        });
                      }}
                    >
                      🌍 European Summer Pattern
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color="success"
                      onPress={() => {
                        // Year-round Pattern: Peak Jan-Dec (no seasonal variation)
                        setGlobalRates({
                          ...globalRates,
                          peakSeasonStart: '',
                          peakSeasonEnd: '',
                          offSeasonStart: '',
                          offSeasonEnd: ''
                        });
                      }}
                    >
                      📅 Year-round (No Seasons)
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Input
                    label="Peak Season Multiplier"
                    type="number"
                    step="0.1"
                    value={globalRates.peakSeasonMultiplier.toString()}
                    onChange={(e) => setGlobalRates({...globalRates, peakSeasonMultiplier: Number(e.target.value)})}
                    size="sm"
                    startContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-small">×</span>
                      </div>
                    }
                  />
                  <Input
                    label="Off Season Multiplier"
                    type="number"
                    step="0.1"
                    value={globalRates.offSeasonMultiplier.toString()}
                    onChange={(e) => setGlobalRates({...globalRates, offSeasonMultiplier: Number(e.target.value)})}
                    size="sm"
                    startContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-small">×</span>
                      </div>
                    }
                  />
                  <Input
                    label="Weekend Rate Multiplier"
                    type="number"
                    step="0.1"
                    value={globalRates.weekendMultiplier.toString()}
                    onChange={(e) => setGlobalRates({...globalRates, weekendMultiplier: Number(e.target.value)})}
                    size="sm"
                    startContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-small">×</span>
                      </div>
                    }
                  />
                </div>
                <div className="space-y-4">
                  <Input
                    label="Early Check-in Fee (₵)"
                    type="number"
                    value={globalRates.earlyCheckinFee.toString()}
                    onChange={(e) => setGlobalRates({...globalRates, earlyCheckinFee: Number(e.target.value)})}
                    size="sm"
                    startContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-small">₵</span>
                      </div>
                    }
                  />
                  <Input
                    label="Late Check-out Fee (₵)"
                    type="number"
                    value={globalRates.lateCheckoutFee.toString()}
                    onChange={(e) => setGlobalRates({...globalRates, lateCheckoutFee: Number(e.target.value)})}
                    size="sm"
                    startContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-small">₵</span>
                      </div>
                    }
                  />
                  <Input
                    label="Extra Bed Fee (₵)"
                    type="number"
                    value={globalRates.extraBedFee.toString()}
                    onChange={(e) => setGlobalRates({...globalRates, extraBedFee: Number(e.target.value)})}
                    size="sm"
                    startContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-small">₵</span>
                      </div>
                    }
                  />
                </div>
              </div>
              <Button 
                color="secondary" 
                variant="flat" 
                size="sm"
                onPress={() => {
                  // Save rate settings to store or localStorage
                  localStorage.setItem('globalRates', JSON.stringify(globalRates));
                  alert('Rate settings saved successfully!');
                }}
              >
                Save Rate Settings
              </Button>
            </div>

            {/* Bulk Actions */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 text-lg">Bulk Actions</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  color="primary" 
                  variant="flat" 
                  size="sm"
                  className="h-20 flex flex-col gap-2"
                  onPress={() => setShowBulkRoomModal(true)}
                >
                  <span className="text-2xl">🏗️</span>
                  <span className="text-sm">Bulk Room Creation</span>
                </Button>
                <Button 
                  color="success" 
                  variant="flat" 
                  size="sm"
                  className="h-20 flex flex-col gap-2"
                  onPress={() => setShowBulkRateModal(true)}
                >
                  <span className="text-2xl">💰</span>
                  <span className="text-sm">Bulk Rate Update</span>
                </Button>
                <Button 
                  color="warning" 
                  variant="flat" 
                  size="sm"
                  className="h-20 flex flex-col gap-2"
                  onPress={() => setShowBulkAmenityModal(true)}
                >
                  <span className="text-2xl">🔧</span>
                  <span className="text-sm">Bulk Amenity Update</span>
                </Button>
              </div>
            </div>

            {/* Room Statuses Management */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 text-lg">📊 Room Statuses</h4>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">Configure room status types and their properties</p>
                <Button 
                  color="primary" 
                  variant="flat" 
                  size="sm"
                  onPress={() => {
                    const newStatus = {
                      id: `status-${Date.now()}`,
                      name: 'New Status',
                      color: 'default',
                      description: 'Status description',
                      isActive: true,
                      canBook: false,
                      requiresAction: false
                    };
                    settings.addRoomStatus(newStatus);
                  }}
                >
                  ➕ Add Status
                </Button>
              </div>
              
              <div className="space-y-4">
                {settings.roomManagement.roomStatuses.map((status) => (
                  <div key={status.id} className="p-4 border rounded-lg bg-green-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      <Input
                        label="Status Name"
                        value={status.name}
                        onChange={(e) => {
                          settings.updateRoomStatus(status.id, { name: e.target.value });
                        }}
                        placeholder="e.g., Clean"
                        size="sm"
                      />
                      <Select
                        label="Color"
                        selectedKeys={[status.color]}
                        onChange={(e) => {
                          settings.updateRoomStatus(status.id, { color: e.target.value });
                        }}
                        size="sm"
                      >
                        <SelectItem key="default">Default</SelectItem>
                        <SelectItem key="primary">Primary</SelectItem>
                        <SelectItem key="secondary">Secondary</SelectItem>
                        <SelectItem key="success">Success</SelectItem>
                        <SelectItem key="warning">Warning</SelectItem>
                        <SelectItem key="danger">Danger</SelectItem>
                      </Select>
                      <Input
                        label="Description"
                        value={status.description}
                        onChange={(e) => {
                          settings.updateRoomStatus(status.id, { description: e.target.value });
                        }}
                        placeholder="Status description..."
                        size="sm"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          isSelected={status.isActive}
                          onValueChange={(checked) => {
                            settings.updateRoomStatus(status.id, { isActive: checked });
                          }}
                          size="sm"
                        />
                        <span className="text-sm font-medium">Active</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          isSelected={status.canBook}
                          onValueChange={(checked) => {
                            settings.updateRoomStatus(status.id, { canBook: checked });
                          }}
                          size="sm"
                        />
                        <span className="text-sm font-medium">Can Book</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          isSelected={status.requiresAction}
                          onValueChange={(checked) => {
                            settings.updateRoomStatus(status.id, { requiresAction: checked });
                          }}
                          size="sm"
                        />
                        <span className="text-sm font-medium">Requires Action</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button 
                        color="danger" 
                        variant="flat" 
                        size="sm"
                        onPress={() => {
                          const updatedStatuses = settings.roomManagement.roomStatuses.filter(s => s.id !== status.id);
                          settings.updateRoomManagement({ roomStatuses: updatedStatuses });
                        }}
                      >
                        🗑️ Delete Status
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderFinancialSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Financial Settings</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input 
            label="Default Currency" 
            value={settings.financialSettings.defaultCurrency}
            onChange={(e) => settings.updateFinancialSettings({ defaultCurrency: e.target.value })}
          />
          <Input 
            label="Round to Nearest" 
            type="number"
            step="0.01"
            value={settings.financialSettings.roundToNearest.toString()}
            onChange={(e) => settings.updateFinancialSettings({ roundToNearest: parseFloat(e.target.value) })}
          />
          <Switch 
            isSelected={settings.financialSettings.enableDiscounts}
            onValueChange={(checked) => settings.updateFinancialSettings({ enableDiscounts: checked })}
          >
            Enable Discounts
          </Switch>
          <Input 
            label="Max Discount (%)" 
            type="number"
            value={settings.financialSettings.maxDiscountPercentage.toString()}
            onChange={(e) => settings.updateFinancialSettings({ maxDiscountPercentage: parseInt(e.target.value) })}
          />
        </div>
      </CardBody>
    </Card>
  );

  const renderCommunicationSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Communication Settings</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Switch 
            isSelected={settings.communicationSettings.smsEnabled}
            onValueChange={(checked) => settings.updateCommunicationSettings({ smsEnabled: checked })}
          >
            SMS Enabled
          </Switch>
          <Switch 
            isSelected={settings.communicationSettings.emailEnabled}
            onValueChange={(checked) => settings.updateCommunicationSettings({ emailEnabled: checked })}
          >
            Email Enabled
          </Switch>
          <Switch 
            isSelected={settings.communicationSettings.autoSendConfirmations}
            onValueChange={(checked) => settings.updateCommunicationSettings({ autoSendConfirmations: checked })}
          >
            Auto-send Confirmations
          </Switch>
          <Switch 
            isSelected={settings.communicationSettings.autoSendReminders}
            onValueChange={(checked) => settings.updateCommunicationSettings({ autoSendReminders: checked })}
          >
            Auto-send Reminders
          </Switch>
        </div>
      </CardBody>
    </Card>
  );

  const renderReportingSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Reporting Settings</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select 
            label="Default Report Format"
            selectedKeys={[settings.reportingSettings.defaultReportFormat]}
            onSelectionChange={(keys) => settings.updateReportingSettings({ defaultReportFormat: Array.from(keys)[0] as 'pdf' | 'excel' | 'csv' })}
          >
            <SelectItem key="pdf">PDF</SelectItem>
            <SelectItem key="excel">Excel</SelectItem>
            <SelectItem key="csv">CSV</SelectItem>
          </Select>
          <Select 
            label="Report Schedule"
            selectedKeys={[settings.reportingSettings.reportSchedule]}
            onSelectionChange={(keys) => settings.updateReportingSettings({ reportSchedule: Array.from(keys)[0] as 'daily' | 'weekly' | 'monthly' })}
          >
            <SelectItem key="daily">Daily</SelectItem>
            <SelectItem key="weekly">Weekly</SelectItem>
            <SelectItem key="monthly">Monthly</SelectItem>
          </Select>
          <Switch 
            isSelected={settings.reportingSettings.includeCharts}
            onValueChange={(checked) => settings.updateReportingSettings({ includeCharts: checked })}
          >
            Include Charts
          </Switch>
          <Switch 
            isSelected={settings.reportingSettings.enableEmailReports}
            onValueChange={(checked) => settings.updateReportingSettings({ enableEmailReports: checked })}
          >
            Enable Email Reports
          </Switch>
        </div>
      </CardBody>
    </Card>
  );

  const renderMaintenanceSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Maintenance Settings</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Switch 
            isSelected={settings.maintenanceSettings.enableMaintenanceRequests}
            onValueChange={(checked) => settings.updateMaintenanceSettings({ enableMaintenanceRequests: checked })}
          >
            Enable Maintenance Requests
          </Switch>
          <Switch 
            isSelected={settings.maintenanceSettings.autoAssignMaintenance}
            onValueChange={(checked) => settings.updateMaintenanceSettings({ autoAssignMaintenance: checked })}
          >
            Auto-assign Maintenance
          </Switch>
          <Input 
            label="Maintenance Approval Threshold (₵)" 
            type="number"
            value={settings.maintenanceSettings.maintenanceApprovalThreshold.toString()}
            onChange={(e) => settings.updateMaintenanceSettings({ maintenanceApprovalThreshold: parseInt(e.target.value) })}
          />
        </div>
      </CardBody>
    </Card>
  );

  const renderInventorySettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Inventory Settings</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Switch 
            isSelected={settings.inventorySettings.enableLowStockAlerts}
            onValueChange={(checked) => settings.updateInventorySettings({ enableLowStockAlerts: checked })}
          >
            Enable Low Stock Alerts
          </Switch>
          <Switch 
            isSelected={settings.inventorySettings.enableExpiryAlerts}
            onValueChange={(checked) => settings.updateInventorySettings({ enableExpiryAlerts: checked })}
          >
            Enable Expiry Alerts
          </Switch>
          <Input 
            label="Reorder Point" 
            type="number"
            value={settings.inventorySettings.reorderPoint.toString()}
            onChange={(e) => settings.updateInventorySettings({ reorderPoint: parseInt(e.target.value) })}
          />
          <Input 
            label="Max Reorder Quantity" 
            type="number"
            value={settings.inventorySettings.maxReorderQuantity.toString()}
            onChange={(e) => settings.updateInventorySettings({ maxReorderQuantity: parseInt(e.target.value) })}
          />
        </div>
      </CardBody>
    </Card>
  );

  const renderStaffSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Staff Settings</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Switch 
            isSelected={settings.staffSettings.enableTimeTracking}
            onValueChange={(checked) => settings.updateStaffSettings({ enableTimeTracking: checked })}
          >
            Enable Time Tracking
          </Switch>
          <Switch 
            isSelected={settings.staffSettings.enableOvertime}
            onValueChange={(checked) => settings.updateStaffSettings({ enableOvertime: checked })}
          >
            Enable Overtime
          </Switch>
          <Input 
            label="Max Overtime Hours" 
            type="number"
            value={settings.staffSettings.maxOvertimeHours.toString()}
            onChange={(e) => settings.updateStaffSettings({ maxOvertimeHours: parseInt(e.target.value) })}
          />
          <Input 
            label="Default Leave Days" 
            type="number"
            value={settings.staffSettings.defaultLeaveDays.toString()}
            onChange={(e) => settings.updateStaffSettings({ defaultLeaveDays: parseInt(e.target.value) })}
          />
        </div>
      </CardBody>
    </Card>
  );

  const renderGuestServicesSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Guest Services Settings</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Switch 
            isSelected={settings.guestServicesSettings.enableConcierge}
            onValueChange={(checked) => settings.updateGuestServicesSettings({ enableConcierge: checked })}
          >
            Enable Concierge
          </Switch>
          <Switch 
            isSelected={settings.guestServicesSettings.enableRoomService}
            onValueChange={(checked) => settings.updateGuestServicesSettings({ enableRoomService: checked })}
          >
            Enable Room Service
          </Switch>
          <Switch 
            isSelected={settings.guestServicesSettings.enableLaundry}
            onValueChange={(checked) => settings.updateGuestServicesSettings({ enableLaundry: checked })}
          >
            Enable Laundry
          </Switch>
          <Switch 
            isSelected={settings.guestServicesSettings.enableGym}
            onValueChange={(checked) => settings.updateGuestServicesSettings({ enableGym: checked })}
          >
            Enable Gym
          </Switch>
          <Switch 
            isSelected={settings.guestServicesSettings.enablePool}
            onValueChange={(checked) => settings.updateGuestServicesSettings({ enablePool: checked })}
          >
            Enable Pool
          </Switch>
          <Switch 
            isSelected={settings.guestServicesSettings.enableBusinessCenter}
            onValueChange={(checked) => settings.updateGuestServicesSettings({ enableBusinessCenter: checked })}
          >
            Enable Business Center
          </Switch>
        </div>
      </CardBody>
    </Card>
  );

  const renderComplianceSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Compliance & Legal Settings</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Switch 
            isSelected={settings.complianceSettings.enableDataProtection}
            onValueChange={(checked) => settings.updateComplianceSettings({ enableDataProtection: checked })}
          >
            Enable Data Protection
          </Switch>
          <Switch 
            isSelected={settings.complianceSettings.enableAuditTrail}
            onValueChange={(checked) => settings.updateComplianceSettings({ enableAuditTrail: checked })}
          >
            Enable Audit Trail
          </Switch>
          <Switch 
            isSelected={settings.complianceSettings.enableDataEncryption}
            onValueChange={(checked) => settings.updateComplianceSettings({ enableDataEncryption: checked })}
          >
            Enable Data Encryption
          </Switch>
          <Input 
            label="Data Retention (days)" 
            type="number"
            value={settings.complianceSettings.dataRetentionDays.toString()}
            onChange={(e) => settings.updateComplianceSettings({ dataRetentionDays: parseInt(e.target.value) })}
          />
        </div>
      </CardBody>
    </Card>
  );

  const renderSaasSettings = () => (
    <div className="space-y-6">
      {/* Tenant Information */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Tenant Information</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Tenant Name" 
              value={settings.tenant.name}
              readOnly
            />
            <Input 
              label="Subdomain" 
              value={settings.tenant.subdomain}
              readOnly
            />
            <Input 
              label="Plan" 
              value={settings.tenant.plan}
              readOnly
            />
            <Input 
              label="Status" 
              value={settings.tenant.status}
              readOnly
            />
          </div>
        </CardBody>
      </Card>

      {/* Multi-Property Settings */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Multi-Property Configuration</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Switch 
              isSelected={settings.saasSettings.enableMultiProperty}
              onValueChange={(checked) => settings.updateSaasSettings({ enableMultiProperty: checked })}
            >
              Enable Multi-Property Support
            </Switch>
            <Switch 
              isSelected={settings.saasSettings.propertySwitching}
              onValueChange={(checked) => settings.updateSaasSettings({ propertySwitching: checked })}
            >
              Allow Property Switching
            </Switch>
            <Input 
              label="Maximum Properties" 
              type="number"
              value={settings.saasSettings.maxProperties.toString()}
              onChange={(e) => settings.updateSaasSettings({ maxProperties: parseInt(e.target.value) })}
            />
          </div>
        </CardBody>
      </Card>

      {/* API & Integration Settings */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">API & Integration Settings</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Switch 
              isSelected={settings.saasSettings.enableAPI}
              onValueChange={(checked) => settings.updateSaasSettings({ enableAPI: checked })}
            >
              Enable API Access
            </Switch>
            <Input 
              label="API Rate Limit (requests/hour)" 
              type="number"
              value={settings.saasSettings.apiRateLimit.toString()}
              onChange={(e) => settings.updateSaasSettings({ apiRateLimit: parseInt(e.target.value) })}
            />
            <Switch 
              isSelected={settings.saasSettings.thirdPartyIntegrations.channelManagers}
              onValueChange={(checked) => settings.updateSaasSettings({ 
                thirdPartyIntegrations: { 
                  ...settings.saasSettings.thirdPartyIntegrations, 
                  channelManagers: checked 
                } 
              })}
            >
              Enable Channel Managers
            </Switch>
            <Switch 
              isSelected={settings.saasSettings.thirdPartyIntegrations.paymentGateways}
              onValueChange={(checked) => settings.updateSaasSettings({ 
                thirdPartyIntegrations: { 
                  ...settings.saasSettings.thirdPartyIntegrations, 
                  paymentGateways: checked 
                } 
              })}
            >
              Enable Payment Gateways
            </Switch>
          </div>
        </CardBody>
      </Card>

      {/* White-Label Settings */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">White-Label Configuration</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Switch 
              isSelected={settings.saasSettings.enableWhiteLabel}
              onValueChange={(checked) => settings.updateSaasSettings({ enableWhiteLabel: checked })}
            >
              Enable White-Label
            </Switch>
            <Input 
              label="Company Name" 
              value={settings.saasSettings.customBranding.companyName}
              onChange={(e) => settings.updateSaasSettings({ 
                customBranding: { 
                  ...settings.saasSettings.customBranding, 
                  companyName: e.target.value 
                } 
              })}
            />
            <Input 
              label="Support Email" 
              value={settings.saasSettings.customBranding.supportEmail}
              onChange={(e) => settings.updateSaasSettings({ 
                customBranding: { 
                  ...settings.saasSettings.customBranding, 
                  supportEmail: e.target.value 
                } 
              })}
            />
            <Input 
              label="Support Phone" 
              value={settings.saasSettings.customBranding.supportPhone}
              onChange={(e) => settings.updateSaasSettings({ 
                customBranding: { 
                  ...settings.saasSettings.customBranding, 
                  supportPhone: e.target.value 
                } 
              })}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );

  // Placeholder functions for business entity settings (to be implemented)
  const renderInvoiceSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Invoice Settings</h3>
      </CardHeader>
      <CardBody>
        <div className="text-center py-8 text-gray-500">
          <p>Invoice settings configuration will be implemented here</p>
        </div>
      </CardBody>
    </Card>
  );

  const renderReceiptSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Receipt Settings</h3>
      </CardHeader>
      <CardBody>
        <div className="text-center py-8 text-gray-500">
          <p>Receipt settings configuration will be implemented here</p>
        </div>
      </CardBody>
    </Card>
  );

  const renderPurchaseOrderSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Purchase Order Settings</h3>
      </CardHeader>
      <CardBody>
        <div className="text-center py-8 text-gray-500">
          <p>Purchase Order settings configuration will be implemented here</p>
        </div>
      </CardBody>
    </Card>
  );

  const renderItemSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Item Settings</h3>
      </CardHeader>
      <CardBody>
        <div className="text-center py-8 text-gray-500">
          <p>Item settings configuration will be implemented here</p>
        </div>
      </CardBody>
    </Card>
  );

  const renderClientSettings = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Client Settings</h3>
      </CardHeader>
      <CardBody>
        <div className="text-center py-8 text-gray-500">
          <p>Client settings configuration will be implemented here</p>
        </div>
      </CardBody>
    </Card>
  );

  const renderDocumentTemplates = () => (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Document Templates</h3>
      </CardHeader>
      <CardBody>
        <div className="text-center py-8 text-gray-500">
          <p>Document template configuration will be implemented here</p>
        </div>
      </CardBody>
    </Card>
  );

  const renderModuleSettings = () => (
    <div className="space-y-6">
      {/* Module Activation */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">⚙️ Module Configuration</h3>
          <p className="text-sm text-gray-600">Enable or disable modules based on your hotel&apos;s needs</p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Core Modules (Always Active)</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm">Front Office</span>
                  <Switch isSelected={true} isDisabled />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm">Room Management</span>
                  <Switch isSelected={true} isDisabled />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm">Basic Settings</span>
                  <Switch isSelected={true} isDisabled />
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Optional Modules</h4>
              <div className="space-y-3">
                {Object.entries(settings.moduleSettings).map(([module, isEnabled]) => {
                  if (module === 'frontOffice') return null; // Skip core modules
                  return (
                    <div key={module} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="text-sm capitalize">{module.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <Switch 
                        isSelected={isEnabled}
                        onValueChange={() => settings.toggleModule(module as keyof typeof settings.moduleSettings)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Module Dependencies */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">🔗 Module Dependencies</h3>
          <p className="text-sm text-gray-600">Understand how modules work together</p>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">Front Office + Housekeeping</h4>
              <p className="text-sm text-blue-600">When a guest checks out, room status automatically changes to &quot;Dirty&quot; and creates a cleaning task.</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">Room Management + Maintenance</h4>
              <p className="text-sm text-green-600">When a room is marked for maintenance, it&apos;s automatically blocked from booking and maintenance tasks are created.</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2">F&B + Inventory</h4>
              <p className="text-sm text-purple-600">Sales automatically update inventory levels and create reorder alerts when stock is low.</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Pricing Information */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">💰 Module Pricing</h3>
          <p className="text-sm text-gray-600">Understand costs for each module</p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-semibold mb-2">Basic Package</h4>
              <p className="text-2xl font-bold text-ghana-green">₵500/month</p>
              <p className="text-sm text-gray-600">Front Office + Room Management</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-semibold mb-2">Standard Package</h4>
              <p className="text-2xl font-bold text-ghana-green">₵800/month</p>
              <p className="text-sm text-gray-600">Basic + Housekeeping + Maintenance</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border">
              <h4 className="font-semibold mb-2">Premium Package</h4>
              <p className="text-2xl font-bold text-ghana-green">₵1,200/month</p>
              <p className="text-sm text-gray-600">All modules included</p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ghana-black">⚙️ System Settings</h1>
              <p className="text-gray-600 mt-2">Configure business entity settings and system preferences</p>
            </div>
            <Button color="primary" variant="flat" onPress={handleSave}>
              💾 Save All Settings
            </Button>
          </div>
        </div>

        {/* Settings Tabs */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <Tabs 
              selectedKey={selectedTab} 
              onSelectionChange={(key) => setSelectedTab(key as string)}
              className="w-full"
            >
              <Tab key="general" title="🏢 General" />
              <Tab key="hotel" title="🏨 Hotel" />
              <Tab key="financial" title="💰 Financial" />
              <Tab key="communication" title="📞 Communication" />
              <Tab key="reporting" title="📊 Reporting" />
              <Tab key="maintenance" title="🔧 Maintenance" />
              <Tab key="inventory" title="📦 Inventory" />
              <Tab key="staff" title="👷 Staff" />
              <Tab key="guest-services" title="🎯 Guest Services" />
              <Tab key="compliance" title="⚖️ Compliance" />
              <Tab key="saas" title="☁️ SaaS Platform" />
              <Tab key="invoices" title="📄 Invoices" />
              <Tab key="receipts" title="🧾 Receipts" />
              <Tab key="purchase-orders" title="📋 Purchase Orders" />
              <Tab key="items" title="📦 Items" />
              <Tab key="clients" title="👥 Clients" />
              <Tab key="templates" title="🎨 Templates" />
              <Tab key="modules" title="⚙️ Module Configuration" />
            </Tabs>
          </CardHeader>
          <CardBody>
            {selectedTab === 'general' && renderGeneralSettings()}
            {selectedTab === 'hotel' && renderHotelSettings()}
            {selectedTab === 'financial' && renderFinancialSettings()}
            {selectedTab === 'communication' && renderCommunicationSettings()}
            {selectedTab === 'reporting' && renderReportingSettings()}
            {selectedTab === 'maintenance' && renderMaintenanceSettings()}
            {selectedTab === 'inventory' && renderInventorySettings()}
            {selectedTab === 'staff' && renderStaffSettings()}
            {selectedTab === 'guest-services' && renderGuestServicesSettings()}
            {selectedTab === 'compliance' && renderComplianceSettings()}
            {selectedTab === 'saas' && renderSaasSettings()}
            {selectedTab === 'invoices' && renderInvoiceSettings()}
            {selectedTab === 'receipts' && renderReceiptSettings()}
            {selectedTab === 'purchase-orders' && renderPurchaseOrderSettings()}
            {selectedTab === 'items' && renderItemSettings()}
            {selectedTab === 'clients' && renderClientSettings()}
            {selectedTab === 'templates' && renderDocumentTemplates()}
            {selectedTab === 'modules' && renderModuleSettings()}
          </CardBody>
        </Card>
      </div>

      {/* Bulk Room Creation Modal */}
      {showBulkRoomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4">🏗️ Bulk Room Creation</h3>
            <div className="space-y-4">
              <Select
                label="Room Type"
                selectedKeys={[bulkRoomData.roomTypeId]}
                onChange={(e) => setBulkRoomData({...bulkRoomData, roomTypeId: e.target.value})}
                size="sm"
              >
                {settings.roomManagement.roomTypes.map((type) => (
                  <SelectItem key={type.id}>{type.name}</SelectItem>
                ))}
              </Select>
              <Input
                label="Number of Rooms"
                type="number"
                value={bulkRoomData.count.toString()}
                onChange={(e) => setBulkRoomData({...bulkRoomData, count: Number(e.target.value)})}
                size="sm"
                min="1"
                max="50"
              />
              <Input
                label="Starting Room Number"
                type="number"
                value={bulkRoomData.startNumber.toString()}
                onChange={(e) => setBulkRoomData({...bulkRoomData, startNumber: Number(e.target.value)})}
                size="sm"
                min="1"
              />
              <Input
                label="Floor"
                value={bulkRoomData.floor}
                onChange={(e) => setBulkRoomData({...bulkRoomData, floor: e.target.value})}
                size="sm"
              />
            </div>
            <div className="flex gap-2 mt-6">
              <Button 
                color="primary" 
                variant="flat" 
                size="sm"
                onPress={() => {
                  if (bulkRoomData.roomTypeId && bulkRoomData.count > 0) {
                    for (let i = 0; i < bulkRoomData.count; i++) {
                      const roomNumber = bulkRoomData.startNumber + i;
                      const newRoom = {
                        id: `room-${Date.now()}-${i}`,
                        number: roomNumber.toString(),
                        typeId: bulkRoomData.roomTypeId,
                        floor: bulkRoomData.floor,
                        status: 'clean',
                        isActive: true,
                        notes: '',
                        features: [],
                        maintenance: {
                          lastInspection: new Date().toISOString(),
                          nextInspection: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                          issues: []
                        }
                      };
                      settings.addRoom(newRoom);
                    }
                    alert(`Successfully created ${bulkRoomData.count} rooms!`);
                    setShowBulkRoomModal(false);
                    setBulkRoomData({ roomTypeId: '', count: 1, startNumber: 1, floor: '1' });
                  } else {
                    alert('Please fill in all required fields');
                  }
                }}
              >
                Create Rooms
              </Button>
              <Button 
                color="secondary" 
                variant="flat" 
                size="sm"
                onPress={() => setShowBulkRoomModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Rate Update Modal */}
      {showBulkRateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4">💰 Bulk Rate Update</h3>
            <div className="space-y-4">
              <Select
                label="Room Types (Multiple)"
                selectionMode="multiple"
                selectedKeys={bulkRateData.roomTypeIds}
                onSelectionChange={(keys) => setBulkRateData({...bulkRateData, roomTypeIds: Array.from(keys) as string[]})}
                size="sm"
              >
                {settings.roomManagement.roomTypes.map((type) => (
                  <SelectItem key={type.id}>{type.name}</SelectItem>
                ))}
              </Select>
              <Input
                label="Rate Multiplier"
                type="number"
                step="0.1"
                value={bulkRateData.multiplier.toString()}
                onChange={(e) => setBulkRateData({...bulkRateData, multiplier: Number(e.target.value)})}
                size="sm"
                startContent={
                  <div className="pointer-events-none flex items-center">
                    <span className="text-default-400 text-small">×</span>
                  </div>
                }
              />
              <Input
                label="Reason for Update"
                value={bulkRateData.reason}
                onChange={(e) => setBulkRateData({...bulkRateData, reason: e.target.value})}
                size="sm"
                placeholder="e.g., Peak season adjustment"
              />
            </div>
            <div className="flex gap-2 mt-6">
              <Button 
                color="success" 
                variant="flat" 
                size="sm"
                onPress={() => {
                  if (bulkRateData.roomTypeIds.length > 0) {
                    bulkRateData.roomTypeIds.forEach(typeId => {
                      const roomType = settings.roomManagement.roomTypes.find(t => t.id === typeId);
                      if (roomType) {
                        const newRate = roomType.baseRate * bulkRateData.multiplier;
                        settings.updateRoomType(typeId, { baseRate: newRate });
                      }
                    });
                    alert(`Successfully updated rates for ${bulkRateData.roomTypeIds.length} room types!`);
                    setShowBulkRateModal(false);
                    setBulkRateData({ roomTypeIds: [], multiplier: 1.0, reason: '' });
                  } else {
                    alert('Please select at least one room type');
                  }
                }}
              >
                Update Rates
              </Button>
              <Button 
                color="secondary" 
                variant="flat" 
                size="sm"
                onPress={() => setShowBulkRateModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Amenity Update Modal */}
      {showBulkAmenityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4">🔧 Bulk Amenity Update</h3>
            <div className="space-y-4">
              <Select
                label="Room Types (Multiple)"
                selectionMode="multiple"
                selectedKeys={bulkAmenityData.roomTypeIds}
                onSelectionChange={(keys) => setBulkAmenityData({...bulkAmenityData, roomTypeIds: Array.from(keys) as string[]})}
                size="sm"
              >
                {settings.roomManagement.roomTypes.map((type) => (
                  <SelectItem key={type.id}>{type.name}</SelectItem>
                ))}
              </Select>
              <Select
                label="Action"
                selectedKeys={[bulkAmenityData.action]}
                onChange={(e) => setBulkAmenityData({...bulkAmenityData, action: e.target.value})}
                size="sm"
              >
                <SelectItem key="add">Add Amenities</SelectItem>
                <SelectItem key="remove">Remove Amenities</SelectItem>
              </Select>
              <Input
                label="Amenities (comma-separated)"
                value={bulkAmenityData.amenities.join(', ')}
                onChange={(e) => setBulkAmenityData({...bulkAmenityData, amenities: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
                size="sm"
                placeholder="e.g., WiFi, AC, Balcony"
              />
            </div>
            <div className="flex gap-2 mt-6">
              <Button 
                color="warning" 
                variant="flat" 
                size="sm"
                onPress={() => {
                  if (bulkAmenityData.roomTypeIds.length > 0 && bulkAmenityData.amenities.length > 0) {
                    bulkAmenityData.roomTypeIds.forEach(typeId => {
                      const roomType = settings.roomManagement.roomTypes.find(t => t.id === typeId);
                      if (roomType) {
                        let updatedAmenities;
                        if (bulkAmenityData.action === 'add') {
                          updatedAmenities = [...new Set([...roomType.amenities, ...bulkAmenityData.amenities])];
                        } else {
                          updatedAmenities = roomType.amenities.filter(a => !bulkAmenityData.amenities.includes(a));
                        }
                        settings.updateRoomType(typeId, { amenities: updatedAmenities });
                      }
                    });
                    alert(`Successfully ${bulkAmenityData.action === 'add' ? 'added' : 'removed'} amenities for ${bulkAmenityData.roomTypeIds.length} room types!`);
                    setShowBulkAmenityModal(false);
                    setBulkAmenityData({ roomTypeIds: [], amenities: [], action: 'add' });
                  } else {
                    alert('Please select room types and enter amenities');
                  }
                }}
              >
                Update Amenities
              </Button>
              <Button 
                color="secondary" 
                variant="flat" 
                size="sm"
                onPress={() => setShowBulkAmenityModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Room Type Modal */}
      {showEditRoomTypeModal && editingRoomType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4">✏️ Edit Room Type</h3>
            <div className="space-y-4">
              <Input
                label="Room Type Name"
                value={editingRoomType.name}
                onChange={(e) => setEditingRoomType({...editingRoomType, name: e.target.value})}
                size="sm"
              />
              <Input
                label="Base Rate (₵)"
                type="number"
                value={editingRoomType.baseRate.toString()}
                onChange={(e) => setEditingRoomType({...editingRoomType, baseRate: Number(e.target.value)})}
                size="sm"
                startContent={
                  <div className="pointer-events-none flex items-center">
                    <span className="text-default-400 text-small">₵</span>
                  </div>
                }
              />
              <Input
                label="Capacity"
                type="number"
                value={editingRoomType.capacity.toString()}
                onChange={(e) => setEditingRoomType({...editingRoomType, capacity: Number(e.target.value)})}
                size="sm"
                startContent={
                  <div className="pointer-events-none flex items-center">
                    <span className="text-default-400 text-small">👥</span>
                  </div>
                }
              />
              <Select
                label="Category"
                selectedKeys={[editingRoomType.category || 'standard']}
                onChange={(e) => setEditingRoomType({...editingRoomType, category: e.target.value})}
                size="sm"
              >
                <SelectItem key="budget">Budget</SelectItem>
                <SelectItem key="standard">Standard</SelectItem>
                <SelectItem key="deluxe">Deluxe</SelectItem>
                <SelectItem key="suite">Suite</SelectItem>
                <SelectItem key="luxury">Luxury</SelectItem>
              </Select>
            </div>
            <div className="flex gap-2 mt-6">
              <Button 
                color="primary" 
                variant="flat" 
                size="sm"
                onPress={() => {
                  settings.updateRoomType(editingRoomType.id, editingRoomType);
                  alert('Room type updated successfully!');
                  setShowEditRoomTypeModal(false);
                  setEditingRoomType(null);
                }}
              >
                Save Changes
              </Button>
              <Button 
                color="secondary" 
                variant="flat" 
                size="sm"
                onPress={() => {
                  setShowEditRoomTypeModal(false);
                  setEditingRoomType(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Room Grid Modal */}
      {showRoomGridModal && selectedRoomType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-11/12 max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-semibold text-gray-800">{selectedRoomType.name} - Room Management</h3>
                <p className="text-gray-600 mt-1">
                  Manage individual rooms for this room type • 
                  {settings.roomManagement.rooms
                    ?.filter(room => room.typeId === selectedRoomType.id)
                    .filter(room => selectedRoomStatus === 'all' || room.status === selectedRoomStatus)
                    .length || 0} rooms shown
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Select
                  label="All Status"
                  selectedKeys={[selectedRoomStatus]}
                  onChange={(e) => setSelectedRoomStatus(e.target.value)}
                  size="sm"
                  className="w-40"
                >
                  <SelectItem key="all">All Status</SelectItem>
                  <SelectItem key="clean">Clean</SelectItem>
                  <SelectItem key="occupied">Occupied</SelectItem>
                  <SelectItem key="dirty">Dirty</SelectItem>
                  <SelectItem key="maintenance">Maintenance</SelectItem>
                </Select>
                <Button 
                  color="primary" 
                  variant="flat" 
                  size="sm"
                  onPress={() => setShowRoomGridModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Room Grid */}
            <div className="grid grid-cols-12 gap-1">
              {settings.roomManagement.rooms
                ?.filter(room => room.typeId === selectedRoomType.id)
                .filter(room => selectedRoomStatus === 'all' || room.status === selectedRoomStatus)
                .map((room) => (
                  <div 
                    key={room.id} 
                    className={`relative p-1 border-2 rounded-lg text-center cursor-pointer transition-all hover:shadow-md ${
                      room.status === 'clean' ? 'border-green-500 bg-green-50' :
                      room.status === 'occupied' ? 'border-red-500 bg-red-50' :
                      room.status === 'dirty' ? 'border-yellow-500 bg-yellow-50' :
                      room.status === 'maintenance' ? 'border-orange-500 bg-orange-50' :
                      'border-gray-300 bg-gray-50'
                    }`}
                  >
                    {/* Delete Button */}
                    <button
                      className="absolute -top-0.5 -left-0.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete room ${room.number}?`)) {
                          settings.deleteRoom(room.id);
                        }
                      }}
                    >
                      ×
                    </button>
                    
                    {/* Room Number */}
                    <div className="text-xs font-bold text-gray-800 mb-1 mt-2">
                      {room.number}
                    </div>
                    
                    {/* Status */}
                    <div className={`text-xs font-medium capitalize ${
                      room.status === 'clean' ? 'text-green-700' :
                      room.status === 'occupied' ? 'text-red-700' :
                      room.status === 'dirty' ? 'text-yellow-700' :
                      room.status === 'maintenance' ? 'text-orange-700' :
                      'text-gray-600'
                    }`}>
                      {room.status}
                    </div>
                    
                    {/* Static Amenities Label */}
                    <div className="mt-1">
                      <div className="text-xs text-gray-500 mb-1">Amenities:</div>
                      <div className="flex justify-center gap-1">
                        <button className="w-4 h-4 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-xs transition-colors">
                          +
                        </button>
                        <button className="w-4 h-4 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-xs transition-colors">
                          ▼
                        </button>
                      </div>
                    </div>
                    
                    {/* Action Menu */}
                    <div className="absolute bottom-1 right-1">
                      <button className="w-3 h-3 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-xs transition-colors">
                        ▼
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Empty State */}
            {(!settings.roomManagement.rooms || 
              settings.roomManagement.rooms.filter(r => r.typeId === selectedRoomType.id).length === 0) && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🏨</div>
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Rooms Created Yet</h3>
                <p className="text-sm text-gray-500 mb-4">
                  This room type doesn&apos;t have any rooms yet. Use the bulk room creation feature to add rooms.
                </p>
                <Button 
                  color="primary" 
                  variant="flat" 
                  size="sm"
                  onPress={() => {
                    setShowRoomGridModal(false);
                    setShowBulkRoomModal(true);
                    setBulkRoomData(prev => ({...prev, roomTypeId: selectedRoomType.id}));
                  }}
                >
                  Create Rooms
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

