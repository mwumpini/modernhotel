'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../lib/settings/store';
import { enhancedFrontOfficeStore } from '../lib/frontoffice/enhancedStore';
import { EventResource, EventPackage } from '../lib/frontoffice/types';

interface EventRateManagementProps {
  onClose?: () => void;
}

export default function EventRateManagement({ onClose }: EventRateManagementProps) {
  const [activeTab, setActiveTab] = useState<'rates' | 'resources' | 'packages' | 'bookings'>('rates');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formType, setFormType] = useState<'rate' | 'resource' | 'package'>('rate');
  
  const settings = useSettingsStore();
  const frontOffice = enhancedFrontOfficeStore;
  
  const [ratePlans, setRatePlans] = useState(settings.roomManagement.ratePlans);
  const [eventResources, setEventResources] = useState(settings.roomManagement.eventResources);
  const [eventPackages, setEventPackages] = useState(settings.roomManagement.eventPackages);

  useEffect(() => {
    // Sync with settings store
    try {
      setRatePlans(settings.roomManagement.ratePlans);
      setEventResources(settings.roomManagement.eventResources);
      setEventPackages(settings.roomManagement.eventPackages);
    } catch (error) {
      console.error('Error syncing with stores:', error);
    }
  }, [settings.roomManagement]);

  // Check if stores are properly initialized
  if (!settings || !frontOffice) {
    console.error('Stores not initialized:', { settings, frontOffice });
    return <div>Loading stores...</div>;
  }

  const createEventRatePlan = () => {
    const newRatePlan = {
      id: `rp_event_${Date.now()}`,
      name: 'Event Conference Rate',
      roomTypeId: 'rt-standard', // Default to standard room
      basePrice: 500,
      isActive: true,
      marketSegment: 'event_conference',
      rateType: 'event_conference' as const,
      eventSpecific: {
        isEventRate: true,
        eventTypes: ['conference', 'training', 'corporate_meeting'],
        packagePrice: 250, // Per person per day
        includesVenue: true,
        includesCatering: true,
        includesEquipment: true,
        minAttendees: 10,
        maxAttendees: 100,
        advanceBookingDays: 30,
        cancellationPolicy: '50% refund if cancelled 7 days before',
        depositPercentage: 25
      },
      restrictions: {
        minStay: 1,
        maxStay: 7,
        advanceBooking: 30,
        cancellationPolicy: 'Event conference cancellation policy'
      },
      seasonalRates: [],
      dayOfWeekRates: {
        monday: 1,
        tuesday: 1,
        wednesday: 1,
        thursday: 1,
        friday: 1,
        saturday: 1.2, // Weekend premium
        sunday: 1.2
      }
    };

    settings.addRatePlan(newRatePlan);
    setShowCreateForm(false);
  };

  const createEventResource = () => {
    const newResource: EventResource = {
      id: `resource_${Date.now()}`,
      name: 'Oforwaa Conference Hall',
      type: 'venue',
      category: 'conference_venue',
      description: 'Main conference hall with modern AV equipment',
      capacity: 150,
      basePrice: 5000, // Per day
      isActive: true,
      availability: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
        startTime: '08:00',
        endTime: '22:00'
      },
      seasonalPricing: [],
      includedInPackages: [],
      setupTime: 60,
      cleanupTime: 45,
      notes: 'Includes projector, sound system, and basic setup'
    };

    settings.addEventResource(newResource);
    setShowCreateForm(false);
  };

  const createEventPackage = () => {
    const newPackage: EventPackage = {
      id: `package_${Date.now()}`,
      name: 'Gold Conference Package',
      description: 'Premium conference package with full amenities',
      category: 'conference',
      isActive: true,
      basePrice: 350, // Per person per day
      minAttendees: 20,
      maxAttendees: 100,
      duration: 1,
      resources: [
        {
          resourceId: 'resource_1', // Will be updated with actual resource ID
          quantity: 1,
          priceOverride: 4000 // Discounted venue price
        }
      ],
      inclusions: [
        'Conference venue',
        'AV equipment',
        'Tea break service',
        'Buffet lunch',
        'Basic setup and cleanup'
      ],
      exclusions: [
        'Accommodation',
        'Transportation',
        'Additional equipment'
      ],
      terms: 'Payment 50% upfront, balance 7 days before event',
      cancellationPolicy: 'Full refund if cancelled 14 days before',
      depositPercentage: 50,
      seasonalPricing: []
    };

    settings.addEventPackage(newPackage);
    setShowCreateForm(false);
  };

  const calculateEventRate = (ratePlanId: string, attendees: number, duration: number) => {
    try {
      const calculation = frontOffice.calculateEventRate(
        ratePlanId,
        'conference',
        attendees,
        duration,
        new Date().toISOString()
      );
      return calculation;
    } catch (error) {
      console.error('Error calculating event rate:', error);
      return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Event & Conference Rate Management</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'rates', label: 'Event Rate Plans', count: ratePlans.filter(rp => rp.rateType === 'event_conference').length },
            { id: 'resources', label: 'Event Resources', count: eventResources.length },
            { id: 'packages', label: 'Event Packages', count: eventPackages.length },
            { id: 'bookings', label: 'Event Bookings', count: frontOffice.eventBookings.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs font-medium">
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content Tabs */}
      <div className="min-h-[500px]">
        {/* Event Rate Plans Tab */}
        {activeTab === 'rates' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Event Conference Rate Plans</h3>
              <button
                onClick={() => {
                  setFormType('rate');
                  setShowCreateForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Create Event Rate Plan
              </button>
            </div>
            
            <div className="grid gap-4">
              {ratePlans
                .filter(rp => rp.rateType === 'event_conference')
                .map((ratePlan) => (
                  <div key={ratePlan.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-lg">{ratePlan.name}</h4>
                        <p className="text-gray-600">Base Price: GH₵{ratePlan.basePrice}</p>
                        {ratePlan.eventSpecific && (
                          <div className="mt-2 text-sm text-gray-500">
                            <p>Package Price: GH₵{ratePlan.eventSpecific.packagePrice}/person/day</p>
                            <p>Min Attendees: {ratePlan.eventSpecific.minAttendees}</p>
                            <p>Max Attendees: {ratePlan.eventSpecific.maxAttendees}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          ratePlan.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {ratePlan.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Rate Calculator */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-md">
                      <h5 className="font-medium mb-2">Rate Calculator</h5>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Attendees</label>
                          <input
                            type="number"
                            min="1"
                            defaultValue="20"
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                            onChange={(e) => {
                              const attendees = parseInt(e.target.value) || 0;
                              const duration = 1;
                              const calculation = calculateEventRate(ratePlan.id, attendees, duration);
                              // You can display this calculation in the UI
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Duration (Days)</label>
                          <input
                            type="number"
                            min="1"
                            defaultValue="1"
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="flex items-end">
                          <button className="w-full bg-gray-600 text-white px-3 py-2 rounded-md text-sm hover:bg-gray-700">
                            Calculate Rate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Event Resources Tab */}
        {activeTab === 'resources' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Event Resources</h3>
              <button
                onClick={() => {
                  setFormType('resource');
                  setShowCreateForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Add Event Resource
              </button>
            </div>
            
            <div className="grid gap-4">
              {eventResources.map((resource) => (
                <div key={resource.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-lg">{resource.name}</h4>
                      <p className="text-gray-600">{resource.description}</p>
                      <div className="mt-2 text-sm text-gray-500">
                        <p>Type: {resource.type}</p>
                        <p>Category: {resource.category}</p>
                        {resource.capacity && <p>Capacity: {resource.capacity} people</p>}
                        <p>Base Price: GH₵{resource.basePrice}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        resource.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {resource.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Packages Tab */}
        {activeTab === 'packages' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Event Packages</h3>
              <button
                onClick={() => {
                  setFormType('package');
                  setShowCreateForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Create Event Package
              </button>
            </div>
            
            <div className="grid gap-4">
              {eventPackages.map((pkg) => (
                <div key={pkg.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-lg">{pkg.name}</h4>
                      <p className="text-gray-600">{pkg.description}</p>
                      <div className="mt-2 text-sm text-gray-500">
                        <p>Category: {pkg.category}</p>
                        <p>Base Price: GH₵{pkg.basePrice}/person/day</p>
                        <p>Attendees: {pkg.minAttendees} - {pkg.maxAttendees}</p>
                        <p>Duration: {pkg.duration} day(s)</p>
                      </div>
                      <div className="mt-3">
                        <h6 className="font-medium text-sm">Inclusions:</h6>
                        <ul className="text-sm text-gray-600 list-disc list-inside">
                          {pkg.inclusions.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        pkg.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {pkg.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Bookings Tab */}
        {activeTab === 'bookings' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Event Bookings</h3>
            <div className="grid gap-4">
              {frontOffice.eventBookings.map((booking) => (
                <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-lg">{booking.eventName}</h4>
                      <p className="text-gray-600">{booking.eventType} Event</p>
                      <div className="mt-2 text-sm text-gray-500">
                        <p>Date: {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}</p>
                        <p>Attendees: {booking.attendees}</p>
                        <p>Total Cost: GH₵{booking.totalCost}</p>
                        <p>Client: {booking.clientName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {booking.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Create {formType === 'rate' ? 'Event Rate Plan' : 
                       formType === 'resource' ? 'Event Resource' : 'Event Package'}
            </h3>
            
            <div className="space-y-4">
              <p className="text-gray-600">
                This will create a new {formType === 'rate' ? 'event conference rate plan' : 
                                   formType === 'resource' ? 'event resource' : 'event package'} 
                with default settings that you can customize later.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    if (formType === 'rate') createEventRatePlan();
                    else if (formType === 'resource') createEventResource();
                    else createEventPackage();
                  }}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
