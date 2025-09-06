# Event & Conference Rate Management System

## Overview

The Event & Conference Rate Management System extends your existing rate management architecture to handle complex event pricing, package management, and resource allocation. This system provides a centralized rate management solution that Front Office, Events, and F&B can all fetch from, maintaining consistency across your hotel operations.

## 🏗️ Architecture Integration

### Existing System Extension
- **No rebuilding required** - extends your current rate management foundation
- **Seamless integration** with existing seasonal rates and day-of-week pricing
- **Reactive updates** across all connected components
- **Centralized data** in the settings store for consistency

### Key Components
1. **Event Rate Plans** - Special rate plans for conferences and events
2. **Event Resources** - Venues, equipment, and services
3. **Event Packages** - Bundled offerings with pricing
4. **Event Bookings** - Integrated booking management

## 🎯 Core Features

### 1. Event-Specific Rate Plans
- **Rate Type**: `event_conference` flag for special event pricing
- **Package Pricing**: Per-person, per-day conference facility costs
- **Event Types**: Conference, training, wedding, corporate meetings
- **Attendee Limits**: Min/max attendee restrictions
- **Advance Booking**: Configurable advance booking requirements

### 2. Resource Management
- **Venues**: Conference halls, meeting rooms, outdoor spaces
- **Equipment**: AV systems, projectors, sound equipment
- **Services**: Catering, setup, cleanup, transportation
- **Availability**: Day-of-week and time-based availability
- **Seasonal Pricing**: Dynamic pricing based on dates

### 3. Package Management
- **Bundled Services**: Combine multiple resources into packages
- **Category-Based**: Conference, training, wedding, corporate, social
- **Attendee Scaling**: Pricing that scales with group size
- **Inclusions/Exclusions**: Clear definition of what's included
- **Terms & Conditions**: Customizable booking terms

### 4. Integrated Rate Calculation
- **Seasonal Adjustments**: Applies existing seasonal rate logic
- **Event Discounts**: Automatic discounts for event bookings
- **Package Costs**: Adds conference facility costs
- **Tax Integration**: Uses existing compliance settings
- **Real-time Calculation**: Live pricing updates

## 🚀 Getting Started

### 1. Access Event Rate Management
```tsx
import EventRateManagement from './components/EventRateManagement';

// In your settings or admin panel
<EventRateManagement onClose={() => setShowEventRates(false)} />
```

### 2. Create Your First Event Rate Plan
```tsx
const newEventRatePlan = {
  name: 'Corporate Conference Rate',
  rateType: 'event_conference',
  basePrice: 500,
  eventSpecific: {
    isEventRate: true,
    eventTypes: ['conference', 'corporate_meeting'],
    packagePrice: 250, // Per person per day
    includesVenue: true,
    includesCatering: true,
    minAttendees: 20,
    maxAttendees: 100
  }
};

settings.addRatePlan(newEventRatePlan);
```

### 3. Add Event Resources
```tsx
const conferenceHall = {
  name: 'Oforwaa Conference Hall',
  type: 'venue',
  capacity: 150,
  basePrice: 5000, // Per day
  availability: {
    monday: true,
    tuesday: true,
    // ... other days
    startTime: '08:00',
    endTime: '22:00'
  }
};

settings.addEventResource(conferenceHall);
```

### 4. Create Event Packages
```tsx
const goldPackage = {
  name: 'Gold Conference Package',
  category: 'conference',
  basePrice: 350, // Per person per day
  minAttendees: 20,
  maxAttendees: 100,
  inclusions: [
    'Conference venue',
    'AV equipment',
    'Tea break service',
    'Buffet lunch'
  ]
};

settings.addEventPackage(goldPackage);
```

## 💰 Rate Calculation Examples

### Basic Event Rate Calculation
```tsx
const calculation = frontOffice.calculateEventRate(
  'rp_event_conference', // Rate plan ID
  'conference',           // Event type
  50,                     // Attendees
  2,                      // Duration (days)
  '2024-06-15',          // Start date
  'package_gold'          // Package ID (optional)
);

// Result:
{
  roomRate: 425,          // After seasonal + event discounts
  packageCost: 17500,     // Package cost for 50 people × 2 days
  totalCost: 21750,       // Total including taxes
  breakdown: {
    baseRoomRate: 500,
    seasonalAdjustment: 0.25,    // High season +25%
    eventDiscount: 0.15,         // Event discount -15%
    packagePrice: 17500,
    taxes: 2175                   // VAT 12.5%
  }
}
```

### Seasonal Rate Integration
Your existing seasonal rates automatically apply to event rates:
1. **Base Rate**: GH₵ 500
2. **High Season**: +25% (GH₵ 125) = GH₵ 625
3. **Event Discount**: -15% (GH₵ 93.75) = GH₵ 531.25
4. **Package Cost**: GH₵ 250 × 50 people × 2 days = GH₵ 25,000
5. **Total**: GH₵ 25,531.25 + taxes

## 🔗 Integration Points

### Front Office Integration
```tsx
// When creating a reservation with stay reason 'conference'
const reservation = {
  stayReason: 'conference',
  ratePlanId: 'rp_event_conference',
  // ... other reservation data
};

// The system automatically applies event rates
const eventRate = frontOffice.calculateEventRate(
  reservation.ratePlanId,
  'conference',
  reservation.attendees || 1,
  reservation.duration || 1,
  reservation.arrival
);
```

### F&B Integration
```tsx
// F&B can fetch event packages to see what's included
const conferencePackages = frontOffice.getEventPackagesByCategory('conference');

// Check if catering is included in a package
const package = conferencePackages.find(p => p.id === packageId);
const includesCatering = package?.inclusions.includes('Buffet lunch');
```

### Events Module Integration
```tsx
// Create event booking with integrated rate management
const eventBooking = frontOffice.createEventBooking({
  eventName: 'Tech Conference 2024',
  eventType: 'conference',
  startDate: '2024-06-15',
  endDate: '2024-06-16',
  attendees: 50,
  packageId: 'package_gold',
  ratePlanId: 'rp_event_conference',
  // ... other booking data
});

// Total cost automatically calculated and includes:
// - Room rates with event discounts
// - Package costs with seasonal adjustments
// - Taxes based on compliance settings
```

## 📊 Management Interface

### Tab-Based Organization
1. **Event Rate Plans**: Manage conference-specific rate plans
2. **Event Resources**: Manage venues, equipment, and services
3. **Event Packages**: Manage bundled offerings
4. **Event Bookings**: View and manage event bookings

### Quick Actions
- **Create Default Templates**: One-click creation of common configurations
- **Rate Calculator**: Real-time pricing for different scenarios
- **Resource Availability**: Check resource availability for dates
- **Package Comparison**: Compare different package offerings

## 🔧 Configuration Options

### Rate Plan Settings
- **Event Types**: Configure which event types this rate applies to
- **Package Pricing**: Set per-person, per-day facility costs
- **Inclusions**: Define what's included (venue, catering, equipment)
- **Attendee Limits**: Set minimum and maximum group sizes
- **Advance Booking**: Configure how far in advance bookings are required

### Resource Settings
- **Availability**: Set which days and times resources are available
- **Capacity**: Define maximum capacity for venues
- **Setup/Cleanup**: Configure time requirements
- **Seasonal Pricing**: Add date-based price adjustments

### Package Settings
- **Resource Bundling**: Combine multiple resources into packages
- **Pricing Overrides**: Override individual resource prices in packages
- **Terms & Conditions**: Set booking terms and cancellation policies
- **Deposit Requirements**: Configure deposit percentages

## 📈 Business Benefits

### Revenue Optimization
- **Dynamic Pricing**: Seasonal and demand-based pricing
- **Package Upselling**: Bundle services for higher margins
- **Attendee Scaling**: Volume discounts for larger groups
- **Resource Utilization**: Maximize venue and equipment usage

### Operational Efficiency
- **Centralized Management**: Single source of truth for all rates
- **Automated Calculations**: No manual rate calculations needed
- **Consistent Pricing**: Same rates across all systems
- **Real-time Updates**: Immediate price updates across all modules

### Customer Experience
- **Transparent Pricing**: Clear breakdown of costs
- **Flexible Packages**: Customizable offerings for different needs
- **Professional Quoting**: Professional rate quotes for events
- **Easy Booking**: Streamlined booking process

## 🚨 Important Notes

### Data Consistency
- All event rate data is stored in the central settings store
- Changes automatically propagate to all connected components
- No duplicate data or synchronization issues

### Backward Compatibility
- Existing rate plans continue to work unchanged
- New event-specific fields are optional
- Gradual migration to event rates is supported

### Performance
- Rate calculations are optimized for real-time use
- Caching mechanisms prevent unnecessary recalculations
- Efficient queries for resource availability

## 🔮 Future Enhancements

### Planned Features
- **Dynamic Package Builder**: Drag-and-drop package creation
- **Revenue Analytics**: Event-specific revenue reporting
- **Resource Scheduling**: Advanced booking calendar
- **Multi-currency Support**: International event pricing
- **API Integration**: External booking system integration

### Customization Options
- **Custom Rate Formulas**: Advanced pricing rules
- **Workflow Automation**: Automated approval processes
- **Reporting Templates**: Custom event reports
- **Integration Hooks**: Custom business logic integration

## 📞 Support & Documentation

For technical support or questions about the Event Rate Management System:
- Check the component documentation in `src/app/components/EventRateManagement.tsx`
- Review the store implementation in `src/app/lib/settings/store.ts`
- Examine the types in `src/app/lib/frontoffice/types.ts`

The system is designed to be extensible and can be customized for your specific business requirements.
