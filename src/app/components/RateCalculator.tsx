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
  Divider,
  Chip
} from "@heroui/react";
import { CalculatorIcon } from '@heroicons/react/24/outline';
import { corporateRateStore } from '../lib/frontoffice/corporateRateStore';
import { enhancedFrontOfficeStore } from '../lib/frontoffice/enhancedStore';

export default function RateCalculator() {
  const [calculationData, setCalculationData] = useState({
    clientType: 'standard', // 'standard' | 'corporate'
    corporateClientId: '',
    roomTypeId: '',
    eventType: 'accommodation_only',
    attendees: 1,
    startDate: '',
    endDate: ''
  });
  
  const [calculationResult, setCalculationResult] = useState(null);

  const handleCalculate = () => {
    if (calculationData.clientType === 'corporate' && calculationData.corporateClientId) {
      // Use corporate rate calculation
      try {
        const roomType = enhancedFrontOfficeStore.roomTypes.find(rt => rt.id === calculationData.roomTypeId);
        if (!roomType) return;
        
        const result = corporateRateStore.calculateCorporateRate(
          calculationData.corporateClientId,
          [roomType],
          calculationData.eventType,
          calculationData.attendees,
          calculationData.startDate,
          calculationData.endDate
        );
        
        setCalculationResult(result);
      } catch (error) {
        console.error('Corporate rate calculation failed:', error);
      }
    } else {
      // Use standard rate calculation
      const roomType = enhancedFrontOfficeStore.roomTypes.find(rt => rt.id === calculationData.roomTypeId);
      if (!roomType) return;
      
      const start = new Date(calculationData.startDate);
      const end = new Date(calculationData.endDate);
      const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      const standardResult = {
        accommodation: {
          baseCost: roomType.baseRate * nights * calculationData.attendees,
          finalCost: roomType.baseRate * nights * calculationData.attendees,
          rateType: 'standard'
        },
        totalCost: roomType.baseRate * nights * calculationData.attendees
      };
      
      setCalculationResult(standardResult);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Rate Calculation</h3>
            <p className="text-sm text-gray-600">Calculate rates for any client type and event</p>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <Select
                label="Client Type"
                value={calculationData.clientType}
                onChange={(e) => setCalculationData({...calculationData, clientType: e.target.value})}
              >
                <SelectItem key="standard" value="standard">Standard Client</SelectItem>
                <SelectItem key="corporate" value="corporate">Corporate Client</SelectItem>
              </Select>
              
              {calculationData.clientType === 'corporate' && (
                <Select
                  label="Corporate Client"
                  value={calculationData.corporateClientId}
                  onChange={(e) => setCalculationData({...calculationData, corporateClientId: e.target.value})}
                >
                  {corporateRateStore.corporateClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.organizationName}
                    </SelectItem>
                  ))}
                </Select>
              )}
              
              <Select
                label="Room Type"
                value={calculationData.roomTypeId}
                onChange={(e) => setCalculationData({...calculationData, roomTypeId: e.target.value})}
              >
                {enhancedFrontOfficeStore.roomTypes.map((roomType) => (
                  <SelectItem key={roomType.id} value={roomType.id}>
                    {roomType.name} (Base: GHS {roomType.baseRate})
                  </SelectItem>
                ))}
              </Select>
              
              <Select
                label="Event Type"
                value={calculationData.eventType}
                onChange={(e) => setCalculationData({...calculationData, eventType: e.target.value})}
              >
                <SelectItem key="accommodation_only" value="accommodation_only">Accommodation Only</SelectItem>
                <SelectItem key="conference" value="conference">Conference</SelectItem>
                <SelectItem key="workshop" value="workshop">Workshop</SelectItem>
                <SelectItem key="training" value="training">Training</SelectItem>
              </Select>
              
              <Input
                label="Number of Attendees"
                type="number"
                min="1"
                value={calculationData.attendees.toString()}
                onChange={(e) => setCalculationData({...calculationData, attendees: parseInt(e.target.value)})}
              />
              
              <Input
                label="Start Date"
                type="date"
                value={calculationData.startDate}
                onChange={(e) => setCalculationData({...calculationData, startDate: e.target.value})}
              />
              
              <Input
                label="End Date"
                type="date"
                value={calculationData.endDate}
                onChange={(e) => setCalculationData({...calculationData, endDate: e.target.value})}
              />
              
              <Button 
                color="primary" 
                onPress={handleCalculate}
                isDisabled={!calculationData.roomTypeId || !calculationData.startDate || !calculationData.endDate}
                startContent={<CalculatorIcon className="w-4 h-4" />}
                className="w-full"
              >
                Calculate Rate
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Results Display */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Calculation Results</h3>
            <p className="text-sm text-gray-600">See detailed breakdown of your rate calculation</p>
          </CardHeader>
          <CardBody>
            {calculationResult ? (
              <div className="space-y-4">
                <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-3xl font-bold text-green-600">
                    GHS {calculationResult.totalCost?.toFixed(2) || calculationResult.accommodation?.finalCost?.toFixed(2)}
                  </div>
                  <div className="text-sm text-green-600">Total Cost</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {calculationResult.accommodation?.rateType === 'corporate' ? 'Corporate Rate Applied' : 'Standard Rate Applied'}
                  </div>
                </div>
                
                <Divider />
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Accommodation:</span>
                    <span className="font-mono">GHS {calculationResult.accommodation?.finalCost?.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Rate Type:</span>
                    <Chip 
                      size="sm" 
                      color={calculationResult.accommodation?.rateType === 'corporate' ? 'primary' : 'default'}
                      variant="flat"
                    >
                      {calculationResult.accommodation?.rateType?.toUpperCase()}
                    </Chip>
                  </div>
                  
                  {calculationResult.accommodation?.corporateDiscount && (
                    <div className="flex justify-between items-center text-sm text-green-600">
                      <span>Corporate Discount:</span>
                      <span>-GHS {calculationResult.accommodation.corporateDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {calculationResult.accommodation?.seasonalAdjustment && (
                    <div className="flex justify-between items-center text-sm text-blue-600">
                      <span>Seasonal Adjustment:</span>
                      <span>GHS {calculationResult.accommodation.seasonalAdjustment.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                {calculationResult.package && (
                  <>
                    <Divider />
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Package:</span>
                        <span className="font-mono">GHS {calculationResult.package.finalCost.toFixed(2)}</span>
                      </div>
                      
                      {calculationResult.package.corporateDiscount && (
                        <div className="flex justify-between items-center text-sm text-green-600">
                          <span>Package Discount:</span>
                          <span>-GHS {calculationResult.package.corporateDiscount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {calculationResult.services && calculationResult.services.total > 0 && (
                  <>
                    <Divider />
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Services:</span>
                        <span className="font-mono">GHS {calculationResult.services.total.toFixed(2)}</span>
                      </div>
                      
                      {calculationResult.services.dinner > 0 && (
                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>Dinner:</span>
                          <span>GHS {calculationResult.services.dinner.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {calculationResult.services.shuttle > 0 && (
                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>Shuttle:</span>
                          <span>GHS {calculationResult.services.shuttle.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {calculationResult.services.equipment > 0 && (
                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>Equipment:</span>
                          <span>GHS {calculationResult.services.equipment.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {calculationResult.taxes && calculationResult.taxes > 0 && (
                  <>
                    <Divider />
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Taxes:</span>
                      <span className="font-mono text-orange-600">GHS {calculationResult.taxes.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <CalculatorIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Ready to Calculate</p>
                <p className="text-sm">Fill in the details on the left and click Calculate to see results</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
