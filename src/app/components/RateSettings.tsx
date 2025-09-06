'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button
} from "@heroui/react";

export default function RateSettings() {
  const [pricingRules, setPricingRules] = useState({
    minStayRequirement: 1,
    maxStayLimit: 30,
    earlyBirdDiscount: 10,
    lastMinuteSurcharge: 15,
    weekendPremium: 20,
    holidayMultiplier: 1.5
  });

  const [seasonalSettings, setSeasonalSettings] = useState({
    enableSeasonalRates: true,
    peakSeasonMultiplier: 1.3,
    offPeakMultiplier: 0.8,
    shoulderSeasonMultiplier: 1.1
  });

  const [groupDiscounts, setGroupDiscounts] = useState({
    enableGroupDiscounts: true,
    minGroupSize: 5,
    groupDiscountPercentage: 10,
    largeGroupSize: 20,
    largeGroupDiscount: 20
  });

  const [displaySettings, setDisplaySettings] = useState({
    showBreakdown: true,
    includeTaxesInDisplay: false,
    showSeasonalAdjustments: true,
    currencySymbol: '₵',
    defaultCurrency: 'GHS'
  });

  // NEW: Flexible rule definitions
  const [flexibleRules, setFlexibleRules] = useState({
    earlyBirdDefinition: {
      type: 'days_before', // 'days_before', 'weeks_before', 'months_before', 'custom_date'
      value: 30,
      customDate: '',
      description: 'Book 30+ days in advance for early bird discount'
    },
    lastMinuteDefinition: {
      type: 'days_before', // 'days_before', 'hours_before', 'same_day'
      value: 3,
      customDate: '',
      description: 'Book within 3 days for last minute surcharge'
    },
    minimumStayLogic: {
      type: 'fixed', // 'fixed', 'day_of_week', 'seasonal', 'event_based', 'dynamic'
      value: 1,
      dayOfWeek: 'saturday', // for weekend minimums
      seasonalPeriod: 'peak', // for seasonal minimums
      eventBased: 'conference', // for event-based minimums
      description: 'Minimum 1 night stay required'
    },
    maximumStayLogic: {
      type: 'fixed', // 'fixed', 'seasonal', 'event_based', 'dynamic'
      value: 30,
      seasonalPeriod: 'peak',
      eventBased: 'conference',
      description: 'Maximum 30 nights stay allowed'
    }
  });

  // NEW: Custom seasonal periods
  const [customSeasons, setCustomSeasons] = useState([
    {
      id: 'peak_summer',
      name: 'Peak Summer',
      startDate: '2024-06-01',
      endDate: '2024-08-31',
      multiplier: 1.4,
      description: 'High season summer months',
      isActive: true
    },
    {
      id: 'off_peak_winter',
      name: 'Off-Peak Winter',
      startDate: '2024-12-01',
      endDate: '2025-02-28',
      multiplier: 0.7,
      description: 'Low season winter months',
      isActive: true
    },
    {
      id: 'shoulder_spring',
      name: 'Shoulder Spring',
      startDate: '2024-03-01',
      endDate: '2024-05-31',
      multiplier: 1.1,
      description: 'Moderate season spring months',
      isActive: true
    }
  ]);

  // NEW: Dynamic pricing rules
  const [dynamicPricingRules, setDynamicPricingRules] = useState([
    {
      id: 'weekend_premium',
      name: 'Weekend Premium',
      type: 'day_of_week', // 'day_of_week', 'date_range', 'event_based', 'occupancy_based'
      conditions: {
        days: ['friday', 'saturday'],
        dateRange: null,
        eventType: null,
        minOccupancy: null
      },
      adjustment: {
        type: 'percentage', // 'percentage', 'fixed_amount', 'multiplier'
        value: 20,
        description: '20% premium for weekend stays'
      },
      isActive: true
    },
    {
      id: 'holiday_surcharge',
      name: 'Holiday Surcharge',
      type: 'date_range',
      conditions: {
        days: null,
        dateRange: {
          start: '2024-12-24',
          end: '2025-01-02'
        },
        eventType: null,
        minOccupancy: null
      },
      adjustment: {
        type: 'multiplier',
        value: 1.5,
        description: '1.5x rate for holiday period'
      },
      isActive: true
    },
    {
      id: 'low_occupancy_discount',
      name: 'Low Occupancy Discount',
      type: 'occupancy_based',
      conditions: {
        days: null,
        dateRange: null,
        eventType: null,
        minOccupancy: 0.3 // 30% occupancy threshold
      },
      adjustment: {
        type: 'percentage',
        value: -15, // negative = discount
        description: '15% discount when occupancy below 30%'
      },
      isActive: true
    }
  ]);

  const handleSaveSettings = () => {
    console.log('Saving flexible rate settings:', { 
      pricingRules, 
      seasonalSettings, 
      groupDiscounts, 
      displaySettings,
      flexibleRules,
      customSeasons,
      dynamicPricingRules
    });
  };

  const addCustomSeason = () => {
    const newSeason = {
      id: `season_${Date.now()}`,
      name: 'New Season',
      startDate: '',
      endDate: '',
      multiplier: 1.0,
      description: 'Custom seasonal period',
      isActive: true
    };
    setCustomSeasons([...customSeasons, newSeason]);
  };

  const addDynamicRule = () => {
    const newRule = {
      id: `rule_${Date.now()}`,
      name: 'New Rule',
      type: 'day_of_week',
      conditions: {
        days: [],
        dateRange: null,
        eventType: null,
        minOccupancy: 0.3
      },
      adjustment: {
        type: 'percentage',
        value: 0,
        description: 'Custom pricing rule'
      },
      isActive: true
    };
    setDynamicPricingRules([...dynamicPricingRules, newRule]);
  };

  // Safe input handling functions
  const safeParseInt = (value: string, defaultValue: number = 0): number => {
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const safeParseFloat = (value: string, defaultValue: number = 0): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const handleEarlyBirdValueChange = (value: string) => {
    const safeValue = safeParseInt(value, 30);
    setFlexibleRules({
      ...flexibleRules,
      earlyBirdDefinition: {
        ...flexibleRules.earlyBirdDefinition,
        value: safeValue
      }
    });
  };

  const handleLastMinuteValueChange = (value: string) => {
    const safeValue = safeParseInt(value, 3);
    setFlexibleRules({
      ...flexibleRules,
      lastMinuteDefinition: {
        ...flexibleRules.lastMinuteDefinition,
        value: safeValue
      }
    });
  };

  const handleMinStayValueChange = (value: string) => {
    const safeValue = safeParseInt(value, 1);
    setFlexibleRules({
      ...flexibleRules,
      minimumStayLogic: {
        ...flexibleRules.minimumStayLogic,
        value: safeValue
      }
    });
  };

  const handleMaxStayValueChange = (value: string) => {
    const safeValue = safeParseInt(value, 30);
    setFlexibleRules({
      ...flexibleRules,
      maximumStayLogic: {
        ...flexibleRules.maximumStayLogic,
        value: safeValue
      }
    });
  };

  const handleSeasonMultiplierChange = (index: number, value: string) => {
    const safeValue = safeParseFloat(value, 1.0);
    const newSeasons = [...customSeasons];
    newSeasons[index].multiplier = safeValue;
    setCustomSeasons(newSeasons);
  };

  const handleRuleValueChange = (index: number, value: string) => {
    const safeValue = safeParseFloat(value, 0);
    const newRules = [...dynamicPricingRules];
    newRules[index].adjustment.value = safeValue;
    setDynamicPricingRules(newRules);
  };

  return (
    <div className="space-y-6">
      {/* Flexible Rule Definitions */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Flexible Rule Definitions</h3>
          <p className="text-sm text-gray-600">Define your own business rules and conditions</p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Early Bird Definition */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Early Bird Definition
              </label>
              <select
                value={flexibleRules.earlyBirdDefinition.type}
                onChange={(e) => setFlexibleRules({
                  ...flexibleRules,
                  earlyBirdDefinition: {
                    ...flexibleRules.earlyBirdDefinition,
                    type: e.target.value
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="days_before">Days Before Arrival</option>
                <option value="weeks_before">Weeks Before Arrival</option>
                <option value="months_before">Months Before Arrival</option>
                <option value="custom_date">Custom Date</option>
              </select>
              <input
                type="number"
                min="1"
                value={flexibleRules.earlyBirdDefinition.value}
                onChange={(e) => handleEarlyBirdValueChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Value"
              />
              <input
                type="text"
                value={flexibleRules.earlyBirdDefinition.description}
                onChange={(e) => setFlexibleRules({
                  ...flexibleRules,
                  earlyBirdDefinition: {
                    ...flexibleRules.earlyBirdDefinition,
                    description: e.target.value
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Description"
              />
            </div>

            {/* Last Minute Definition */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Last Minute Definition
              </label>
              <select
                value={flexibleRules.lastMinuteDefinition.type}
                onChange={(e) => setFlexibleRules({
                  ...flexibleRules,
                  lastMinuteDefinition: {
                    ...flexibleRules.lastMinuteDefinition,
                    type: e.target.value
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="days_before">Days Before Arrival</option>
                <option value="hours_before">Hours Before Arrival</option>
                <option value="same_day">Same Day</option>
                <option value="custom_date">Custom Date</option>
              </select>
              <input
                type="number"
                min="1"
                value={flexibleRules.lastMinuteDefinition.value}
                onChange={(e) => handleLastMinuteValueChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Value"
              />
              <input
                type="text"
                value={flexibleRules.lastMinuteDefinition.description}
                onChange={(e) => setFlexibleRules({
                  ...flexibleRules,
                  lastMinuteDefinition: {
                    ...flexibleRules.lastMinuteDefinition,
                    description: e.target.value
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Description"
              />
            </div>

            {/* Minimum Stay Logic */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Minimum Stay Logic
              </label>
              <select
                value={flexibleRules.minimumStayLogic.type}
                onChange={(e) => setFlexibleRules({
                  ...flexibleRules,
                  minimumStayLogic: {
                    ...flexibleRules.minimumStayLogic,
                    type: e.target.value
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="fixed">Fixed Nights</option>
                <option value="day_of_week">Day of Week Based</option>
                <option value="seasonal">Seasonal Based</option>
                <option value="event_based">Event Based</option>
                <option value="dynamic">Dynamic (AI/ML)</option>
              </select>
              <input
                type="number"
                min="1"
                value={flexibleRules.minimumStayLogic.value}
                onChange={(e) => handleMinStayValueChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Value"
              />
            </div>

            {/* Maximum Stay Logic */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Maximum Stay Logic
              </label>
              <select
                value={flexibleRules.maximumStayLogic.type}
                onChange={(e) => setFlexibleRules({
                  ...flexibleRules,
                  maximumStayLogic: {
                    ...flexibleRules.maximumStayLogic,
                    type: e.target.value
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="fixed">Fixed Nights</option>
                <option value="seasonal">Seasonal Based</option>
                <option value="event_based">Event Based</option>
                <option value="dynamic">Dynamic (AI/ML)</option>
              </select>
              <input
                type="number"
                min="1"
                value={flexibleRules.maximumStayLogic.value}
                onChange={(e) => handleMaxStayValueChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Value"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Custom Seasonal Periods */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Custom Seasonal Periods</h3>
              <p className="text-sm text-gray-600">Define your own seasonal periods with custom multipliers</p>
            </div>
            <Button 
              color="primary" 
              size="sm"
              onPress={addCustomSeason}
            >
              Add Season
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {customSeasons.map((season, index) => (
              <div key={season.id} className="p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input
                    type="text"
                    value={season.name}
                    onChange={(e) => {
                      const newSeasons = [...customSeasons];
                      newSeasons[index].name = e.target.value;
                      setCustomSeasons(newSeasons);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Season Name"
                  />
                  <input
                    type="date"
                    value={season.startDate}
                    onChange={(e) => {
                      const newSeasons = [...customSeasons];
                      newSeasons[index].startDate = e.target.value;
                      setCustomSeasons(newSeasons);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={season.endDate}
                    onChange={(e) => {
                      const newSeasons = [...customSeasons];
                      newSeasons[index].endDate = e.target.value;
                      setCustomSeasons(newSeasons);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={season.multiplier}
                    onChange={(e) => handleSeasonMultiplierChange(index, e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Multiplier"
                  />
                </div>
                <input
                  type="text"
                  value={season.description}
                  onChange={(e) => {
                    const newSeasons = [...customSeasons];
                    newSeasons[index].description = e.target.value;
                    setCustomSeasons(newSeasons);
                  }}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description"
                />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Dynamic Pricing Rules */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Dynamic Pricing Rules</h3>
              <p className="text-sm text-gray-600">Create complex pricing rules with multiple conditions</p>
            </div>
            <Button 
              color="primary" 
              size="sm"
              onPress={addDynamicRule}
            >
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {dynamicPricingRules.map((rule, index) => (
              <div key={rule.id} className="p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(e) => {
                      const newRules = [...dynamicPricingRules];
                      newRules[index].name = e.target.value;
                      setDynamicPricingRules(newRules);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Rule Name"
                  />
                  <select
                    value={rule.type}
                    onChange={(e) => {
                      const newRules = [...dynamicPricingRules];
                      newRules[index].type = e.target.value;
                      setDynamicPricingRules(newRules);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="day_of_week">Day of Week</option>
                    <option value="date_range">Date Range</option>
                    <option value="event_based">Event Based</option>
                    <option value="occupancy_based">Occupancy Based</option>
                    <option value="weather_based">Weather Based</option>
                    <option value="demand_based">Demand Based</option>
                  </select>
                  <select
                    value={rule.adjustment.type}
                    onChange={(e) => {
                      const newRules = [...dynamicPricingRules];
                      newRules[index].adjustment.type = e.target.value;
                      setDynamicPricingRules(newRules);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed_amount">Fixed Amount</option>
                    <option value="multiplier">Multiplier</option>
                  </select>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={rule.adjustment.value}
                  onChange={(e) => handleRuleValueChange(index, e.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Adjustment Value"
                />
                <input
                  type="text"
                  value={rule.adjustment.description}
                  onChange={(e) => {
                    const newRules = [...dynamicPricingRules];
                    newRules[index].adjustment.description = e.target.value;
                    setDynamicPricingRules(newRules);
                  }}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description"
                />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          color="primary" 
          size="lg"
          onPress={handleSaveSettings}
        >
          Save Rate Settings
        </Button>
      </div>
    </div>
  );
}
