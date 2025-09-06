# Corporate Rate Management System

## 🎯 Overview

The Corporate Rate Management System is a comprehensive solution designed to handle the complex rate scenarios that hotels face when dealing with corporate clients, events, and conferences. This system addresses the real-world challenges you described:

- **Multiple Rate Tiers**: Different organizations get different base rates
- **Dynamic Event Pricing**: Workshop vs. accommodation-only rates
- **Flexible Package Combinations**: Conference packages, accommodation, dinner, etc.
- **Multi-rate Strategies**: Percentage-based, flat-rate, and hybrid approaches
- **Temporal Flexibility**: Different pricing for pre-conference, during, and post-conference

## 🏗️ Architecture

### Core Components

1. **Corporate Client Management** (`CorporateClient`)
   - Organization details and contact information
   - Billing and payment preferences
   - Contract terms and status
   - Multiple rate agreements

2. **Rate Agreement Engine** (`CorporateRateAgreement`)
   - Flexible rate strategies (percentage, flat-rate, hybrid, negotiated)
   - Event-specific pricing rules
   - Service add-on management
   - Seasonal adjustments and restrictions

3. **Rate Calculation Engine** (`CorporateRateStore`)
   - Intelligent rate selection based on priority
   - Multi-factor discount calculations
   - Tax integration (Ghana-specific: VAT, NHIL, GETFund)
   - Real-time cost breakdowns

## 💰 Rate Strategies Explained

### 1. Percentage-Based Rates
**Example**: SNV Ghana gets 80% of standard rates
```typescript
rateStrategy: 'percentage',
percentageRates: {
  standardRoom: 80,    // 80% of 600 = 480 GHS
  deluxeRoom: 75,      // 75% of 800 = 600 GHS
  suiteRoom: 70,       // 70% of 1200 = 840 GHS
  presidentialRoom: 65 // 65% of 2500 = 1625 GHS
}
```

### 2. Flat Rates
**Example**: Ghana Health Service pays fixed rates regardless of standard pricing
```typescript
rateStrategy: 'flat_rate',
flatRates: {
  standardRoom: 550,   // Fixed 550 GHS
  deluxeRoom: 750,     // Fixed 750 GHS
  suiteRoom: 1100,     // Fixed 1100 GHS
  presidentialRoom: 2200 // Fixed 2200 GHS
}
```

### 3. Hybrid Rates
**Example**: SNV Workshop Rate combines percentage + flat adjustment
```typescript
rateStrategy: 'hybrid',
hybridRates: {
  standardRoom: { 
    percentage: 70,     // 70% of standard
    flatAdjustment: -50 // Minus 50 GHS
  }
  // Result: (600 * 0.7) - 50 = 370 GHS
}
```

### 4. Negotiated Rates
**Example**: Special case-by-case pricing for VIP clients
```typescript
rateStrategy: 'negotiated',
negotiatedRates: {
  'rt-standard': 450,  // Custom rate for standard room
  'rt-deluxe': 650     // Custom rate for deluxe room
}
```

## 🎪 Event-Specific Pricing

### Conference vs. Workshop vs. Training

The system automatically applies different pricing based on event type:

```typescript
eventRates: {
  conference: {
    accommodationDiscount: 20,        // Additional 20% off accommodation
    packagePricing: 'discounted',     // Conference packages get discounts
    packageDiscount: 30              // 30% off conference packages
  },
  workshop: {
    accommodationDiscount: 15,        // 15% off accommodation
    packagePricing: 'included',       // Workshop packages included in rate
    packageDiscount: 25              // 25% off if separate
  },
  training: {
    accommodationDiscount: 12,        // 12% off accommodation
    packagePricing: 'discounted',     // Training packages discounted
    packageDiscount: 20              // 20% off training packages
  }
}
```

### Service Add-ons

Flexible service pricing that can be included, discounted, or standard:

```typescript
serviceRates: {
  dinner: 'included',           // Dinner included in rate
  shuttle: 'discounted',        // Shuttle service discounted
  shuttleDiscount: 30,          // 30% off shuttle
  equipment: 'standard'         // Equipment at standard rates
}
```

## 📅 Temporal Flexibility

### Seasonal Adjustments
```typescript
seasonalAdjustments: [
  {
    name: 'Peak Season',
    startDate: '2024-06-01',
    endDate: '2024-09-30',
    multiplier: 1.1,  // 10% increase during peak season
    description: 'Peak tourism season adjustment'
  }
]
```

### Day-of-Week Restrictions
```typescript
dayOfWeekRestrictions: {
  monday: true,    // Available Monday
  tuesday: true,   // Available Tuesday
  wednesday: true, // Available Wednesday
  thursday: true,  // Available Thursday
  friday: true,    // Available Friday
  saturday: false, // Not available Saturday
  sunday: false    // Not available Sunday
}
```

### Volume and Group Discounts
```typescript
volumeDiscounts: [
  {
    minNights: 7,
    discountPercentage: 5,     // 5% off for 7+ nights
    description: 'Weekly stay discount'
  },
  {
    minNights: 30,
    discountPercentage: 15,    // 15% off for 30+ nights
    description: 'Monthly stay discount'
  }
],
groupDiscounts: [
  {
    minAttendees: 10,
    discountPercentage: 5,     // 5% off for 10+ attendees
    description: 'Group booking discount'
  },
  {
    minAttendees: 20,
    discountPercentage: 10,    // 10% off for 20+ attendees
    description: 'Large group discount'
  }
]
```

## 🚀 Getting Started

### 1. Access the System
```tsx
import CorporateRateManagement from './components/CorporateRateManagement';

// In your admin panel or settings
<CorporateRateManagement onClose={() => setShowCorporateRates(false)} />
```

### 2. Create Your First Corporate Client
```tsx
const snvGhana = corporateRateStore.createCorporateClient({
  organizationName: 'SNV Ghana',
  industry: 'International Development',
  contactPerson: {
    name: 'Kwame Asante',
    position: 'Country Director',
    phone: '+233 24 123 4567',
    email: 'k.asante@snv.org'
  },
  billingInfo: {
    address: 'Plot 4, Ring Road Central, Accra',
    city: 'Accra',
    country: 'Ghana',
    paymentTerms: 'Net 30',
    preferredPaymentMethod: 'corporate_billing'
  },
  contractDetails: {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: 'active'
  }
});
```

### 3. Create Rate Agreements
```tsx
const snvWorkshopRate = corporateRateStore.createRateAgreement({
  name: 'SNV Ghana - Workshop Rate',
  description: 'Special rates for workshop participants',
  isActive: true,
  priority: 2,
  rateStrategy: 'hybrid',
  hybridRates: {
    standardRoom: { percentage: 70, flatAdjustment: -50 },
    deluxeRoom: { percentage: 65, flatAdjustment: -75 }
  },
  eventRates: {
    workshop: {
      accommodationDiscount: 15,
      packagePricing: 'included',
      packageDiscount: 25
    }
  },
  serviceRates: {
    dinner: 'included',
    shuttle: 'included',
    equipment: 'included'
  }
});
```

### 4. Calculate Rates
```tsx
const rateCalculation = corporateRateStore.calculateCorporateRate(
  'corp_snv_ghana',           // Client ID
  roomTypes,                   // Array of room types
  'workshop',                  // Event type
  25,                          // Number of attendees
  '2024-03-15',               // Start date
  '2024-03-17',               // End date
  'package_id',                // Optional package ID
  eventPackage                 // Optional event package
);

console.log('Total Cost:', rateCalculation.totalCost);
console.log('Accommodation:', rateCalculation.accommodation.finalCost);
console.log('Package:', rateCalculation.package.finalCost);
console.log('Services:', rateCalculation.services.total);
console.log('Taxes:', rateCalculation.taxes);
```

## 💡 Real-World Examples

### Example 1: SNV Ghana Workshop
- **Event**: 3-day workshop with 25 participants
- **Accommodation**: 2 nights, standard rooms
- **Rate Strategy**: Hybrid (70% of standard + 50 GHS off)
- **Result**: 
  - Standard rate: 600 GHS
  - Applied rate: (600 × 0.7) - 50 = 370 GHS
  - Total accommodation: 370 × 25 × 2 = 18,500 GHS
  - Workshop package: Included
  - Dinner: Included
  - Shuttle: Included

### Example 2: Ghana Health Service Conference
- **Event**: 2-day conference with 50 participants
- **Accommodation**: 1 night, standard rooms
- **Rate Strategy**: Flat rate
- **Result**:
  - Standard rate: 550 GHS (fixed)
  - Total accommodation: 550 × 50 × 1 = 27,500 GHS
  - Conference package: 30% discount
  - Dinner: 25% discount
  - Shuttle: 30% discount

## 🔄 Integration Points

### Front Office Integration
```tsx
// In your reservation system
const corporateRate = corporateRateStore.calculateCorporateRate(
  reservation.corporateClientId,
  [reservation.roomType],
  reservation.eventType,
  reservation.attendees,
  reservation.arrival,
  reservation.departure
);

// Apply the calculated rate
reservation.appliedRate = corporateRate.accommodation.finalCost;
reservation.rateType = 'corporate';
```

### Event Management Integration
```tsx
// In your event booking system
const eventRate = corporateRateStore.calculateCorporateRate(
  event.corporateClientId,
  event.roomTypes,
  event.eventType,
  event.attendees,
  event.startDate,
  event.endDate,
  event.packageId,
  event.package
);

// Update event costs
event.totalCost = eventRate.totalCost;
event.costBreakdown = eventRate.breakdown;
```

### Billing Integration
```tsx
// In your billing system
const invoice = {
  accommodation: corporateRate.accommodation.finalCost,
  package: corporateRate.package.finalCost,
  services: corporateRate.services.total,
  taxes: corporateRate.taxes,
  total: corporateRate.totalCost,
  corporateDiscount: corporateRate.accommodation.corporateDiscount + corporateRate.package.corporateDiscount
};
```

## 📊 Monitoring and Analytics

### Rate Performance Tracking
```tsx
// Track rate agreement performance
trackEvent('CorporateRate.Calculation', {
  clientId: 'corp_snv_ghana',
  agreementId: 'ra_snv_workshop',
  eventType: 'workshop',
  attendees: 25,
  totalCost: 18500,
  savings: 7500, // Compared to standard rates
  appliedDiscount: 28.8 // Percentage discount
});
```

### Client Profitability Analysis
```tsx
// Analyze client profitability
const clientAnalysis = {
  totalRevenue: 18500,
  standardRevenue: 26000, // What they would pay at standard rates
  discountGiven: 7500,
  discountPercentage: 28.8,
  profitMargin: 0.65, // Assuming 65% profit margin
  netProfit: 12025
};
```

## 🎯 Best Practices

### 1. Rate Agreement Priority
- Use priority numbers to handle overlapping agreements
- Higher priority agreements override lower ones
- Example: Workshop rates (priority 2) override accommodation-only rates (priority 1)

### 2. Seasonal Planning
- Plan seasonal adjustments based on Ghana tourism patterns
- Peak season: June-September (multiplier: 1.1-1.2)
- Low season: April-May (multiplier: 0.8-0.9)

### 3. Package Flexibility
- Design packages that can be included, discounted, or separate
- Allow clients to mix and match services
- Provide clear inclusions/exclusions lists

### 4. Rate Validation
- Always validate rate calculations before applying
- Check for blackout dates and restrictions
- Verify client contract status and validity

## 🔧 Customization

### Adding New Rate Strategies
```tsx
// Extend the rate strategy types
type RateStrategy = 'percentage' | 'flat_rate' | 'hybrid' | 'negotiated' | 'dynamic';

// Add dynamic pricing based on demand
if (rateStrategy === 'dynamic') {
  const demandLevel = getDemandLevel(startDate);
  const demandMultiplier = getDemandMultiplier(demandLevel);
  appliedRate = baseRate * demandMultiplier;
}
```

### Custom Tax Calculations
```tsx
// Override tax calculation for specific clients
private calculateTaxes(subtotal: number, clientId?: string): number {
  if (clientId === 'corp_government') {
    // Government clients might have different tax treatment
    return subtotal * 0.10; // 10% total tax
  }
  
  // Standard Ghana tax rates
  return subtotal * 0.175; // 17.5% total tax
}
```

## 🚨 Troubleshooting

### Common Issues

1. **No Applicable Rate Agreement Found**
   - Check if client has active rate agreements
   - Verify agreement dates and restrictions
   - Ensure agreement covers the event type

2. **Rate Calculation Errors**
   - Validate all required fields
   - Check for date format issues
   - Ensure room types exist in the system

3. **Unexpected Discounts**
   - Review rate agreement priority
   - Check for overlapping seasonal adjustments
   - Verify volume and group discount rules

### Debug Mode
```tsx
// Enable detailed logging
const debugCalculation = corporateRateStore.calculateCorporateRate(
  clientId,
  roomTypes,
  eventType,
  attendees,
  startDate,
  endDate
);

console.log('Rate Calculation Debug:', {
  applicableAgreements: debugCalculation.applicableAgreements,
  primaryAgreement: debugCalculation.primaryAgreement,
  calculationSteps: debugCalculation.calculationSteps
});
```

## 🔮 Future Enhancements

### Planned Features
1. **AI-Powered Rate Optimization**
   - Machine learning for demand prediction
   - Dynamic pricing recommendations
   - Competitor rate analysis

2. **Advanced Package Builder**
   - Drag-and-drop package creation
   - Real-time package pricing
   - Package performance analytics

3. **Multi-Currency Support**
   - USD, EUR, GBP support
   - Real-time exchange rates
   - Currency-specific pricing

4. **Advanced Analytics**
   - Revenue forecasting
   - Client profitability analysis
   - Rate optimization suggestions

This system provides the flexibility and sophistication needed to handle the complex rate scenarios you described, while maintaining simplicity for day-to-day operations. It's designed to grow with your business and adapt to changing market conditions.
