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
  Textarea,
  Chip,
  Divider
} from "@heroui/react";
import { frontOfficeStore } from '../../lib/frontoffice/store';
import { GuestProfile, StayReason, Nationality, IdType } from '../../lib/frontoffice/types';

interface SelfCheckinFormData {
  confirmArrival: boolean;
  specialRequests?: string;
  vehicleInfo?: string;
  emergencyContact?: string;
}

export default function SelfCheckinPage({ params }: { params: { token: string } }) {
  const [guest, setGuest] = useState<GuestProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [formData, setFormData] = useState<SelfCheckinFormData>({
    confirmArrival: false,
    specialRequests: '',
    vehicleInfo: '',
    emergencyContact: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      try {
        const guestProfile = frontOfficeStore.getGuestBySelfCheckinToken(params.token);
        if (guestProfile) {
          setGuest(guestProfile);
          setIsValidToken(true);
        } else {
          setIsValidToken(false);
        }
      } catch (error) {
        console.error('Error validating token:', error);
        setIsValidToken(false);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [params.token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guest) return;

    setIsSubmitting(true);
    try {
      // Process self-checkin using the token
      const result = frontOfficeStore.processSelfCheckin(params.token, {
        specialRequests: formData.specialRequests,
        vehicleInfo: formData.vehicleInfo,
        emergencyContact: formData.emergencyContact
      });
      
      console.log('Self-checkin processed:', result);

      setSuccess(true);
    } catch (error) {
      console.error('Error processing self-checkin:', error);
      alert('Failed to process check-in. Please try again or contact the front desk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating your reservation link...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken || !guest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardBody className="text-center p-8">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid or Expired Link</h1>
            <p className="text-gray-600 mb-6">
              This self-check-in link is invalid or has expired. Please contact the hotel directly to check in.
            </p>
            <Button color="primary" variant="flat" className="w-full">
              Contact Hotel
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardBody className="text-center p-8">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-green-900 mb-4">Check-in Complete!</h1>
            <p className="text-gray-600 mb-6">
              Welcome to our hotel! Your check-in has been processed successfully. You can now proceed to your room.
            </p>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6">
              <p className="text-sm text-green-800">
                <strong>Room Number:</strong> Will be assigned at check-in
              </p>
              <p className="text-sm text-green-800">
                <strong>Check-in Time:</strong> {new Date().toLocaleTimeString()}
              </p>
            </div>
            <Button color="success" variant="flat" className="w-full">
              Get Room Access
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Self-Check-in Portal</h1>
          <p className="text-gray-600">Welcome! Please confirm your arrival and provide any special requests</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Guest Information Card */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <h2 className="text-xl font-semibold text-gray-900">👤 Guest Information</h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <Input
                    value={guest.name}
                    isReadOnly
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <Input
                    value={guest.phone || 'Not provided'}
                    isReadOnly
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <Input
                    value={guest.email || 'Not provided'}
                    isReadOnly
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                  <Input
                    value={guest.nationality}
                    isReadOnly
                    className="bg-gray-50"
                  />
                </div>
                <Divider />
                <div className="text-xs text-gray-500">
                  <p>This information is pre-filled from your guest profile.</p>
                  <p>Contact the hotel if any details need updating.</p>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Reservation Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-gray-900">✅ Check-in Confirmation</h2>
              </CardHeader>
              <CardBody>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Arrival Confirmation */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="confirmArrival"
                        checked={formData.confirmArrival}
                        onChange={(e) => setFormData({...formData, confirmArrival: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded"
                        required
                      />
                      <label htmlFor="confirmArrival" className="text-sm font-medium text-blue-900">
                        I confirm that I have arrived at the hotel and am ready to check in
                      </label>
                    </div>
                  </div>

                  {/* Special Requests */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests</label>
                    <Textarea
                      value={formData.specialRequests}
                      onChange={(e) => setFormData({...formData, specialRequests: e.target.value})}
                      placeholder="Any special requests, preferences, or notes for your stay"
                      rows={3}
                    />
                  </div>

                  {/* Vehicle Information */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Information (Optional)</label>
                    <Input
                      value={formData.vehicleInfo}
                      onChange={(e) => setFormData({...formData, vehicleInfo: e.target.value})}
                      placeholder="Vehicle make, model, color, or plate number"
                    />
                  </div>

                  {/* Emergency Contact */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact (Optional)</label>
                    <Input
                      value={formData.emergencyContact}
                      onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                      placeholder="Emergency contact name and phone number"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <Button
                      type="submit"
                      color="primary"
                      size="lg"
                      className="w-full"
                      isLoading={isSubmitting}
                      disabled={!formData.confirmArrival}
                    >
                      {isSubmitting ? 'Processing Check-in...' : 'Complete Check-in'}
                    </Button>
                  </div>

                  {/* Terms */}
                  <div className="text-xs text-gray-500 text-center">
                    <p>By submitting this form, you confirm your arrival and agree to the hotel&apos;s terms and conditions.</p>
                    <p>Your room access will be provided upon successful check-in.</p>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
