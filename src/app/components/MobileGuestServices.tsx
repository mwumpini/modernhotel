'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button, 
  Badge, 
  Input, 
  Select, 
  SelectItem, 
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tabs,
  Tab,
  Switch
} from '@heroui/react';
import { trackEvent } from '../lib/analytics/trackEvent';

interface MobileService {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'available' | 'coming-soon' | 'maintenance';
  category: 'checkin' | 'services' | 'amenities' | 'communication';
}

interface ServiceRequest {
  id: string;
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  requestedAt: string;
  estimatedTime?: string;
  assignedTo?: string;
}

interface GuestFeedback {
  id: string;
  category: 'cleanliness' | 'service' | 'amenities' | 'value' | 'overall';
  rating: number;
  comment: string;
  submittedAt: string;
  respondedTo: boolean;
}

export default function MobileGuestServices() {
  const [selectedService, setSelectedService] = useState<MobileService | null>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [guestFeedback, setGuestFeedback] = useState<GuestFeedback[]>([]);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isServiceRequestOpen, setIsServiceRequestOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isDigitalKeyOpen, setIsDigitalKeyOpen] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Mobile services data
  const mobileServices: MobileService[] = [
    {
      id: 'ms-1',
      name: 'Mobile Check-in',
      description: 'Complete check-in process before arrival',
      icon: '📱',
      status: 'available',
      category: 'checkin'
    },
    {
      id: 'ms-2',
      name: 'Digital Room Key',
      description: 'Access your room with your smartphone',
      icon: '🔑',
      status: 'available',
      category: 'checkin'
    },
    {
      id: 'ms-3',
      name: 'Service Requests',
      description: 'Request housekeeping, maintenance, or amenities',
      icon: '🛎️',
      status: 'available',
      category: 'services'
    },
    {
      id: 'ms-4',
      name: 'Bill Viewing',
      description: 'View and download your current bill',
      icon: '🧾',
      status: 'available',
      category: 'services'
    },
    {
      id: 'ms-5',
      name: 'Feedback Submission',
      description: 'Rate your stay and provide feedback',
      icon: '⭐',
      status: 'available',
      category: 'communication'
    },
    {
      id: 'ms-6',
      name: 'Concierge Chat',
      description: 'Chat with concierge for instant assistance',
      icon: '💬',
      status: 'coming-soon',
      category: 'communication'
    },
    {
      id: 'ms-7',
      name: 'Room Controls',
      description: 'Control lighting, temperature, and entertainment',
      icon: '🎛️',
      status: 'coming-soon',
      category: 'amenities'
    },
    {
      id: 'ms-8',
      name: 'Food Ordering',
      description: 'Order room service and restaurant meals',
      icon: '🍽️',
      status: 'maintenance',
      category: 'amenities'
    }
  ];

  const handleServiceClick = (service: MobileService) => {
    setSelectedService(service);
    
    switch (service.id) {
      case 'ms-1':
        setIsCheckInOpen(true);
        break;
      case 'ms-2':
        setIsDigitalKeyOpen(true);
        break;
      case 'ms-3':
        setIsServiceRequestOpen(true);
        break;
      case 'ms-5':
        setIsFeedbackOpen(true);
        break;
      default:
        onOpen();
        break;
    }

    trackEvent('MobileService.Accessed', { 
      serviceId: service.id, 
      serviceName: service.name 
    });
  };

  const handleMobileCheckIn = (checkInData: any) => {
    // Process mobile check-in
    trackEvent('MobileService.CheckIn.Completed', checkInData);
    setIsCheckInOpen(false);
  };

  const handleServiceRequest = (requestData: any) => {
    const newRequest: ServiceRequest = {
      id: `sr-${Date.now()}`,
      type: requestData.type,
      description: requestData.description,
      priority: requestData.priority,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    setServiceRequests(prev => [...prev, newRequest]);
    trackEvent('MobileService.Request.Created', { 
      requestId: newRequest.id, 
      type: requestData.type 
    });
    setIsServiceRequestOpen(false);
  };

  const handleFeedbackSubmission = (feedbackData: any) => {
    const newFeedback: GuestFeedback = {
      id: `fb-${Date.now()}`,
      category: feedbackData.category,
      rating: feedbackData.rating,
      comment: feedbackData.comment,
      submittedAt: new Date().toISOString(),
      respondedTo: false
    };

    setGuestFeedback(prev => [...prev, newFeedback]);
    trackEvent('MobileService.Feedback.Submitted', { 
      feedbackId: newFeedback.id, 
      category: feedbackData.category,
      rating: feedbackData.rating
    });
    setIsFeedbackOpen(false);
  };

  const renderMobileCheckIn = () => (
    <Modal isOpen={isCheckInOpen} onClose={() => setIsCheckInOpen(false)} size="2xl">
      <ModalContent>
        <ModalHeader>
          <h3 className="text-xl font-semibold text-ghana-black">📱 Mobile Check-in</h3>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🚀</div>
              <h4 className="text-lg font-semibold text-ghana-black mb-2">
                Complete Your Check-in
              </h4>
              <p className="text-gray-600">
                Complete your check-in process before arrival for a seamless experience
              </p>
            </div>
            
            <div className="space-y-4">
              <Input
                label="Reservation Number"
                placeholder="Enter your reservation number"
                className="w-full"
              />
              <Input
                label="Guest Name"
                placeholder="Enter your full name"
                className="w-full"
              />
              <Input
                label="Phone Number"
                placeholder="Enter your phone number"
                className="w-full"
              />
              <Input
                label="Email"
                type="email"
                placeholder="Enter your email address"
                className="w-full"
              />
              
              <div className="space-y-3">
                <h5 className="font-medium text-ghana-black">Arrival Preferences</h5>
                <div className="flex items-center space-x-3">
                  <Switch defaultSelected />
                  <span className="text-sm">Early check-in (if available)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch defaultSelected />
                  <span className="text-sm">Receive SMS notifications</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Switch />
                  <span className="text-sm">Express check-in (skip front desk)</span>
                </div>
              </div>

              <Textarea
                label="Special Requests"
                placeholder="Any special requests or preferences..."
                rows={3}
                className="w-full"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="flat" onPress={() => setIsCheckInOpen(false)}>
            Cancel
          </Button>
          <Button color="primary" onPress={() => handleMobileCheckIn({})}>
            Complete Check-in
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  const renderDigitalKey = () => (
    <Modal isOpen={isDigitalKeyOpen} onClose={() => setIsDigitalKeyOpen(false)} size="2xl">
      <ModalContent>
        <ModalHeader>
          <h3 className="text-xl font-semibold text-ghana-black">🔑 Digital Room Key</h3>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">🔐</div>
              <h4 className="text-lg font-semibold text-ghana-black mb-2">
                Your Digital Key is Ready
              </h4>
              <p className="text-gray-600 mb-6">
                Access your room using your smartphone. The key will be activated at check-in time.
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h5 className="font-medium text-blue-800 mb-2">How to Use Your Digital Key</h5>
              <div className="space-y-2 text-sm text-blue-700">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Hold your phone near the door lock</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Wait for the green light and beep</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Turn the handle to enter</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="text-2xl mb-2">📱</div>
                <div className="text-sm font-medium text-ghana-black">Mobile App</div>
                <div className="text-xs text-gray-500">Download our mobile app</div>
              </div>
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="text-2xl mb-2">🌐</div>
                <div className="text-sm font-medium text-ghana-black">Web Access</div>
                <div className="text-xs text-gray-500">Access via web browser</div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h5 className="font-medium text-yellow-800 mb-2">Security Features</h5>
              <div className="text-sm text-yellow-700">
                <p>• Encrypted Bluetooth communication</p>
                <p>• Automatic deactivation at checkout</p>
                <p>• Real-time access logging</p>
                <p>• Emergency override available</p>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onPress={() => setIsDigitalKeyOpen(false)}>
            Got It
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  const renderServiceRequest = () => (
    <Modal isOpen={isServiceRequestOpen} onClose={() => setIsServiceRequestOpen(false)} size="2xl">
      <ModalContent>
        <ModalHeader>
          <h3 className="text-xl font-semibold text-ghana-black">🛎️ Service Request</h3>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">📋</div>
              <h4 className="text-lg font-semibold text-ghana-black mb-2">
                Request a Service
              </h4>
              <p className="text-gray-600">
                We're here to help! Submit your request and we'll respond promptly.
              </p>
            </div>
            
            <div className="space-y-4">
              <Select
                label="Service Type"
                placeholder="Select the type of service you need"
                className="w-full"
              >
                <SelectItem key="housekeeping">Housekeeping</SelectItem>
                <SelectItem key="maintenance">Maintenance</SelectItem>
                <SelectItem key="amenities">Additional Amenities</SelectItem>
                <SelectItem key="transport">Transportation</SelectItem>
                <SelectItem key="concierge">Concierge Services</SelectItem>
                <SelectItem key="other">Other</SelectItem>
              </Select>

              <Select
                label="Priority Level"
                placeholder="How urgent is your request?"
                className="w-full"
              >
                <SelectItem key="low">Low - When convenient</SelectItem>
                <SelectItem key="medium">Medium - Soon</SelectItem>
                <SelectItem key="high">High - As soon as possible</SelectItem>
                <SelectItem key="urgent">Urgent - Immediately</SelectItem>
              </Select>

              <Textarea
                label="Description"
                placeholder="Please describe your request in detail..."
                rows={4}
                className="w-full"
              />

              <Input
                label="Preferred Time"
                type="time"
                placeholder="When would you prefer the service?"
                className="w-full"
              />

              <div className="flex items-center space-x-3">
                <Switch defaultSelected />
                <span className="text-sm">Send SMS notifications about service updates</span>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="flat" onPress={() => setIsServiceRequestOpen(false)}>
            Cancel
          </Button>
          <Button color="primary" onPress={() => handleServiceRequest({})}>
            Submit Request
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  const renderFeedback = () => (
    <Modal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} size="2xl">
      <ModalContent>
        <ModalHeader>
          <h3 className="text-xl font-semibold text-ghana-black">⭐ Guest Feedback</h3>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h4 className="text-lg font-semibold text-ghana-black mb-2">
                Share Your Experience
              </h4>
              <p className="text-gray-600">
                Your feedback helps us improve and provide better service to all our guests.
              </p>
            </div>

            <div className="space-y-4">
              <Select
                label="Feedback Category"
                placeholder="Select the category for your feedback"
                className="w-full"
              >
                <SelectItem key="cleanliness">Cleanliness & Housekeeping</SelectItem>
                <SelectItem key="service">Staff Service & Hospitality</SelectItem>
                <SelectItem key="amenities">Facilities & Amenities</SelectItem>
                <SelectItem key="value">Value for Money</SelectItem>
                <SelectItem key="overall">Overall Experience</SelectItem>
              </Select>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Rating
                </label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button
                      key={star}
                      variant="light"
                      className="text-2xl p-2"
                      onPress={() => {
                        // Handle rating selection
                      }}
                    >
                      ⭐
                    </Button>
                  ))}
                </div>
              </div>

              <Textarea
                label="Your Comments"
                placeholder="Tell us about your experience, suggestions, or concerns..."
                rows={4}
                className="w-full"
              />

              <div className="flex items-center space-x-3">
                <Switch />
                <span className="text-sm">I would like to be contacted about my feedback</span>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="flat" onPress={() => setIsFeedbackOpen(false)}>
            Cancel
          </Button>
          <Button color="primary" onPress={() => handleFeedbackSubmission({})}>
            Submit Feedback
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  const renderServiceRequests = () => (
    <div className="space-y-4">
      {serviceRequests.length > 0 ? (
        serviceRequests.map((request) => (
          <Card key={request.id} className="border-0 shadow-lg">
            <CardBody className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h5 className="font-semibold text-ghana-black">{request.type}</h5>
                    <Badge 
                      color={
                        request.priority === 'urgent' ? 'danger' : 
                        request.priority === 'high' ? 'warning' : 
                        request.priority === 'medium' ? 'secondary' : 'success'
                      }
                      variant="flat"
                      size="sm"
                    >
                      {request.priority}
                    </Badge>
                    <Badge 
                      color={
                        request.status === 'completed' ? 'success' : 
                        request.status === 'in-progress' ? 'primary' : 
                        request.status === 'cancelled' ? 'danger' : 'warning'
                      }
                      variant="flat"
                      size="sm"
                    >
                      {request.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{request.description}</p>
                  <p className="text-xs text-gray-500">
                    Requested: {new Date(request.requestedAt).toLocaleString()}
                  </p>
                  {request.estimatedTime && (
                    <p className="text-xs text-blue-600">
                      Estimated completion: {request.estimatedTime}
                    </p>
                  )}
                </div>
                <div className="flex flex-col space-y-2">
                  {request.status === 'pending' && (
                    <Button size="sm" color="danger" variant="flat">
                      Cancel
                    </Button>
                  )}
                  {request.status === 'in-progress' && (
                    <Button size="sm" color="primary" variant="flat">
                      Track
                    </Button>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        ))
      ) : (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-4">📋</div>
          <p>No service requests yet</p>
          <p className="text-sm">Submit your first request to get started</p>
        </div>
      )}
    </div>
  );

  const renderFeedbackHistory = () => (
    <div className="space-y-4">
      {guestFeedback.length > 0 ? (
        guestFeedback.map((feedback) => (
          <Card key={feedback.id} className="border-0 shadow-lg">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <h5 className="font-semibold text-ghana-black capitalize">{feedback.category}</h5>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={i < feedback.rating ? 'text-yellow-400' : 'text-gray-300'}>
                        ⭐
                      </span>
                    ))}
                  </div>
                </div>
                <Badge 
                  color={feedback.respondedTo ? 'success' : 'warning'}
                  variant="flat"
                  size="sm"
                >
                  {feedback.respondedTo ? 'Responded' : 'Pending Response'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-2">{feedback.comment}</p>
              <p className="text-xs text-gray-500">
                Submitted: {new Date(feedback.submittedAt).toLocaleString()}
              </p>
            </CardBody>
          </Card>
        ))
      ) : (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-4">💬</div>
          <p>No feedback submitted yet</p>
          <p className="text-sm">Share your experience to help us improve</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ghana-black">📱 Mobile Guest Services</h1>
          <p className="text-gray-600">Access hotel services directly from your mobile device</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge color="success">Mobile Ready</Badge>
          <Badge color="primary">24/7 Access</Badge>
        </div>
      </div>

      {/* Mobile Services Grid */}
      <Card className="border-0 shadow-lg mb-6">
        <CardHeader className="pb-3">
          <h3 className="text-lg font-semibold text-ghana-black">🚀 Available Services</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mobileServices.map((service) => (
              <Button
                key={service.id}
                variant="flat"
                className={`h-32 flex flex-col items-center justify-center space-y-2 p-4 ${
                  service.status === 'available' ? 'bg-blue-50 hover:bg-blue-100' :
                  service.status === 'coming-soon' ? 'bg-yellow-50 hover:bg-yellow-100' :
                  'bg-gray-50 hover:bg-gray-100'
                }`}
                onPress={() => handleServiceClick(service)}
                disabled={service.status === 'maintenance'}
              >
                <div className="text-3xl">{service.icon}</div>
                <div className="text-xs font-medium text-center">{service.name}</div>
                <div className="text-xs text-center text-gray-500">{service.description}</div>
                <Badge 
                  color={
                    service.status === 'available' ? 'success' : 
                    service.status === 'coming-soon' ? 'warning' : 'danger'
                  }
                  variant="flat"
                  size="sm"
                >
                  {service.status}
                </Badge>
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Service Requests & Feedback Tabs */}
      <Tabs 
        selectedKey="requests" 
        className="w-full"
        color="primary"
        variant="underlined"
      >
        <Tab key="requests" title="📋 Service Requests" />
        <Tab key="feedback" title="⭐ Feedback History" />
      </Tabs>

      <div className="mt-6">
        <Tab key="requests" title="📋 Service Requests">
          {renderServiceRequests()}
        </Tab>
        <Tab key="feedback" title="⭐ Feedback History">
          {renderFeedbackHistory()}
        </Tab>
      </div>

      {/* Service Detail Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            <h3 className="text-xl font-semibold text-ghana-black">
              {selectedService?.name}
            </h3>
          </ModalHeader>
          <ModalBody>
            {selectedService && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-6xl mb-4">{selectedService.icon}</div>
                  <h4 className="text-xl font-semibold text-ghana-black mb-2">
                    {selectedService.name}
                  </h4>
                  <p className="text-gray-600 mb-4">{selectedService.description}</p>
                  <Badge 
                    color={
                      selectedService.status === 'available' ? 'success' : 
                      selectedService.status === 'coming-soon' ? 'warning' : 'danger'
                    }
                    variant="flat"
                  >
                    {selectedService.status}
                  </Badge>
                </div>
                
                {selectedService.status === 'coming-soon' && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h5 className="font-medium text-blue-800 mb-2">Coming Soon!</h5>
                    <p className="text-sm text-blue-700">
                      This feature is currently in development and will be available soon. 
                      We'll notify you when it's ready!
                    </p>
                  </div>
                )}
                
                {selectedService.status === 'maintenance' && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h5 className="font-medium text-yellow-800 mb-2">Under Maintenance</h5>
                    <p className="text-sm text-yellow-700">
                      This service is temporarily unavailable due to maintenance. 
                      Please check back later or contact the front desk for assistance.
                    </p>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onPress={onClose}>
              Got It
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Render all modals */}
      {renderMobileCheckIn()}
      {renderDigitalKey()}
      {renderServiceRequest()}
      {renderFeedback()}
    </div>
  );
}
