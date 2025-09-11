'use client';

import { create } from 'zustand';

export interface CountryCompliance {
  countryCode: string;
  countryName: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  
  // Tax Configuration
  taxRates: {
    vat?: number;
    gst?: number;
    salesTax?: number;
    nhil?: number;
    tourismLevy?: number;
    ssnit?: number;
    [key: string]: number | undefined;
  };
  
  // Business Information
  businessInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    taxId?: string;
    vatNumber?: string;
    registrationNumber?: string;
  };
  
  // Compliance Features
  compliance: {
    eInvoicing: boolean;
    taxReports: boolean;
    governmentIntegration: boolean;
    digitalSignature: boolean;
    auditTrail: boolean;
    [key: string]: boolean;
  };
  
  // Payment Methods
  paymentMethods: {
    mobileMoney: boolean;
    bankTransfer: boolean;
    creditCard: boolean;
    cash: boolean;
    digitalWallet: boolean;
    [key: string]: boolean;
  };
  
  // Localization
  localization: {
    language: string;
    dateFormat: string;
    timeFormat: string;
    numberFormat: string;
    currencyPosition: 'before' | 'after';
    decimalSeparator: string;
    thousandsSeparator: string;
  };
}

// Business Entity Configuration Interfaces
export interface InvoiceSettings {
  // Numbering
  prefix: string;
  suffix: string;
  nextNumber: number;
  numberFormat: string; // e.g., "INV-{YEAR}-{NUMBER}"
  
  // Terms
  defaultPaymentTerms: number; // days
  latePaymentPenalty: number; // percentage
  earlyPaymentDiscount: number; // percentage
  
  // Content
  showTaxBreakdown: boolean;
  showPaymentInstructions: boolean;
  showBankDetails: boolean;
  footerText: string;
  
  // Styling
  logoUrl?: string;
  primaryColor: string;
  fontFamily: string;
  fontSize: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'receipt' | 'invoice' | 'payment-order' | 'purchase-order' | 'proforma' | 'quotation' | 'contract' | 'report';
  category: 'financial' | 'operational' | 'legal' | 'marketing';
  description: string;
  preview: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  variables: TemplateVariable[];
  styling: TemplateStyling;
  compliance: ComplianceSettings;
  html: string;
  css: string;
}

export interface TemplateVariable {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  required: boolean;
  defaultValue?: string;
  options?: string[];
  validation?: string;
}

export interface TemplateStyling {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  fontSize: string;
  logoPosition: 'top-left' | 'top-center' | 'top-right';
  headerStyle: 'minimal' | 'professional' | 'luxury' | 'modern';
  footerStyle: 'simple' | 'detailed' | 'none';
}

export interface ComplianceSettings {
  ghanaVAT: boolean;
  ghanaNHIL: boolean;
  ghanaTourismLevy: boolean;
  ssnit: boolean;
  incomeTax: boolean;
  customFields: Record<string, boolean>;
}

export interface ReceiptSettings {
  // Header
  businessName: string;
  tagline?: string;
  logoUrl?: string;
  
  // Content
  showTaxBreakdown: boolean;
  showPaymentMethod: boolean;
  showCashierName: boolean;
  showTransactionId: boolean;
  
  // Footer
  footerText: string;
  socialMedia?: string[];
  website?: string;
  
  // Styling
  primaryColor: string;
  fontFamily: string;
  fontSize: string;
}

export interface PurchaseOrderSettings {
  // Numbering
  prefix: string;
  suffix: string;
  nextNumber: number;
  numberFormat: string;
  
  // Approval
  requireApproval: boolean;
  approvalThreshold: number; // amount above which approval is required
  approvers: string[]; // user IDs
  
  // Terms
  defaultPaymentTerms: number;
  defaultDeliveryTerms: string;
  
  // Content
  showTaxBreakdown: boolean;
  showDeliveryAddress: boolean;
  termsAndConditions: string;
  
  // Styling
  logoUrl?: string;
  primaryColor: string;
  fontFamily: string;
}

export interface ProformaInvoiceSettings {
  // Numbering
  prefix: string;
  suffix: string;
  nextNumber: number;
  numberFormat: string;
  
  // Validity
  validityDays: number;
  showValidityPeriod: boolean;
  
  // Content
  showTaxBreakdown: boolean;
  showPaymentInstructions: boolean;
  termsAndConditions: string;
  
  // Styling
  logoUrl?: string;
  primaryColor: string;
  fontFamily: string;
}

export interface ItemSettings {
  // Categories
  defaultCategories: string[];
  allowCustomCategories: boolean;
  
  // Pricing
  showCostPrice: boolean;
  showProfitMargin: boolean;
  defaultMarkup: number; // percentage
  
  // Inventory
  trackInventory: boolean;
  lowStockThreshold: number;
  reorderPoint: number;
  
  // Units
  defaultUnit: string;
  allowedUnits: string[];
  
  // Barcodes
  generateBarcodes: boolean;
  barcodePrefix: string;
  barcodeFormat: 'EAN13' | 'CODE128' | 'QR';
}

export interface ClientSettings {
  // Numbering
  prefix: string;
  suffix: string;
  nextNumber: number;
  numberFormat: string;
  
  // Categories
  defaultCategories: string[];
  allowCustomCategories: boolean;
  
  // Credit
  allowCredit: boolean;
  defaultCreditLimit: number;
  creditTerms: number; // days
  
  // Communication
  sendInvoices: boolean;
  sendReceipts: boolean;
  sendStatements: boolean;
  
  // Required Fields
  requiredFields: string[];
  optionalFields: string[];
}

export interface ReservationSettings {
  // Numbering
  prefix: string;
  suffix: string;
  nextNumber: number;
  numberFormat: string; // e.g., "RES-{YEAR}-{NUMBER}" or "RES{NUMBER}"
}

export interface DocumentTemplateSettings {
  // Template Management
  templates: DocumentTemplate[];
  activeTemplates: Record<string, string>; // documentType -> templateId
  defaultTemplates: Record<string, string>; // documentType -> templateId
  
  // Template Categories
  categories: {
    id: string;
    name: string;
    description: string;
    color: string;
  }[];
  
  // Template Variables
  globalVariables: TemplateVariable[];
  
  // Template Styling
  defaultStyling: TemplateStyling;
  
  // Compliance Settings
  complianceSettings: ComplianceSettings;
  
  // Legacy Template Support (for backward compatibility)
  invoiceTemplates: {
    id: string;
    name: string;
    isDefault: boolean;
    html: string;
    css: string;
  }[];
  
  // Receipt Templates
  receiptTemplates: {
    id: string;
    name: string;
    isDefault: boolean;
    html: string;
    css: string;
  }[];
  
  // PO Templates
  poTemplates: {
    id: string;
    name: string;
    isDefault: boolean;
    html: string;
    css: string;
  }[];
  
  // Proforma Templates
  proformaTemplates: {
    id: string;
    name: string;
    isDefault: boolean;
    html: string;
    css: string;
  }[];
}

export interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
  preferences: UserPreferences;
  // Additional profile fields
  profile: {
    avatar?: string;
    phone?: string;
    address?: string;
    department?: string;
    position?: string;
    employeeId?: string;
    hireDate?: string;
    emergencyContact?: {
      name: string;
      phone: string;
      relationship: string;
    };
    bio?: string;
    skills?: string[];
    certifications?: string[];
  };
  security: {
    passwordLastChanged?: string;
    passwordExpiryDate?: string;
    failedLoginAttempts: number;
    lastFailedLogin?: string;
    accountLocked: boolean;
    lockoutExpiry?: string;
    twoFactorEnabled: boolean;
    twoFactorSecret?: string;
  };
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    sound: boolean;
  };
  dashboard: {
    defaultView: string;
    quickActions: string[];
    widgets: string[];
  };
  accessibility: {
    fontSize: 'small' | 'medium' | 'large';
    highContrast: boolean;
    reduceMotion: boolean;
  };
}

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  domain?: string;
  plan: 'starter' | 'professional' | 'enterprise' | 'custom';
  status: 'active' | 'suspended' | 'trial' | 'expired';
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  maxUsers: number;
  maxRooms: number;
  maxProperties: number;
  features: string[];
  createdAt: string;
  updatedAt: string;
  metadata: {
    industry: string;
    size: 'small' | 'medium' | 'large' | 'enterprise';
    region: string;
    timezone: string;
    currency: string;
    language: string;
  };
}

export interface SystemSettings {
  // SaaS Platform Settings
  tenantId: string;
  tenant: Tenant;
  
  // General System Settings
  systemName: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  
  // Multi-Country Support
  defaultCountry: string;
  supportedCountries: string[];
  countryCompliance: Record<string, CountryCompliance>;
  
  // User Authorization
  users: User[];
  roles: UserRole[];
  currentUser?: User;
  
  // Security Settings
  security: {
    sessionTimeout: number; // minutes
    twoFactorAuth: boolean;
    ipWhitelist: string[];
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      expiryDays: number;
    };
    loginAttempts: {
      maxAttempts: number;
      lockoutDuration: number; // minutes
    };
  };
  
  // POS Settings
  posSettings: {
    managerPin: string;
    printMethod: 'browser' | 'bridge';
    bridgeUrl: string;
    routeReceipts: string;
    routeKOTs: string;
    requireManagerApproval: boolean;
    allowVoidAfterMinutes: number;
  };
  
  // Business Entity Settings
  invoiceSettings: InvoiceSettings;
  receiptSettings: ReceiptSettings;
  purchaseOrderSettings: PurchaseOrderSettings;
  proformaInvoiceSettings: ProformaInvoiceSettings;
  itemSettings: ItemSettings;
  clientSettings: ClientSettings;
  reservationSettings: ReservationSettings;
  documentTemplates: DocumentTemplateSettings;
  
  // Integration Settings
  integrations: {
    paymentGateways: {
      stripe?: boolean;
      paypal?: boolean;
      mobileMoney?: boolean;
      bankIntegration?: boolean;
    };
    accounting: {
      quickbooks?: boolean;
      xero?: boolean;
      sage?: boolean;
    };
    channelManagers: {
      booking?: boolean;
      expedia?: boolean;
      airbnb?: boolean;
    };
  };
  
  // Backup Settings
  backup: {
    autoBackup: boolean;
    backupFrequency: 'daily' | 'weekly' | 'monthly';
    lastBackup: string;
    nextBackup: string;
    retentionDays: number;
    cloudBackup: boolean;
  };
  
  // Additional System Settings
  systemPreferences: {
    autoLogout: boolean;
    logRetentionDays: number;
    maxFileUploadSize: number; // MB
    allowedFileTypes: string[];
    enableAuditLog: boolean;
    enableNotifications: boolean;
    enableMaintenanceMode: boolean;
  };
  
  // Hotel-Specific Settings
  hotelSettings: {
    checkInTime: string; // e.g., "14:00"
    checkOutTime: string; // e.g., "11:00"
    lateCheckOutFee: number;
    earlyCheckInFee: number;
    cancellationPolicy: string;
    noShowPolicy: string;
    petPolicy: boolean;
    smokingPolicy: boolean;
    wifiPassword?: string;
    parkingAvailable: boolean;
    parkingFee: number;
    airportShuttle: boolean;
    shuttleFee: number;
  };
  
  // Room Management Settings
  roomSettings: {
    autoAssignRooms: boolean;
    allowRoomChanges: boolean;
    maxRoomChanges: number;
    housekeepingStartTime: string;
    housekeepingEndTime: string;
    maintenanceNotificationEmail: string;
    lowInventoryThreshold: number;
    highInventoryThreshold: number;
  };
  
  // Financial Settings
  financialSettings: {
    defaultCurrency: string;
    supportedCurrencies: string[];
    exchangeRateUpdateFrequency: 'daily' | 'weekly' | 'monthly';
    taxInclusive: boolean;
    roundToNearest: number;
    enableDiscounts: boolean;
    maxDiscountPercentage: number;
    requireApprovalForDiscounts: boolean;
    discountApprovalThreshold: number;
  };
  
  // Communication Settings
  communicationSettings: {
    smsEnabled: boolean;
    emailEnabled: boolean;
    pushNotifications: boolean;
    autoSendConfirmations: boolean;
    autoSendReminders: boolean;
    reminderHoursBefore: number;
    confirmationTemplate: string;
    reminderTemplate: string;
    smsProvider?: string;
    emailProvider?: string;
  };
  
  // Reporting Settings
  reportingSettings: {
    defaultReportFormat: 'pdf' | 'excel' | 'csv';
    autoGenerateReports: boolean;
    reportSchedule: 'daily' | 'weekly' | 'monthly';
    reportTime: string; // e.g., "09:00"
    includeCharts: boolean;
    includeDataTables: boolean;
    maxReportRows: number;
    enableEmailReports: boolean;
    reportRecipients: string[];
  };
  
  // Maintenance Settings
  maintenanceSettings: {
    enableMaintenanceRequests: boolean;
    autoAssignMaintenance: boolean;
    maintenancePriorityLevels: string[];
    requireMaintenanceApproval: boolean;
    maintenanceApprovalThreshold: number;
    enablePreventiveMaintenance: boolean;
    maintenanceReminderDays: number;
  };
  
  // Inventory Settings
  inventorySettings: {
    enableLowStockAlerts: boolean;
    enableExpiryAlerts: boolean;
    expiryAlertDays: number;
    autoReorder: boolean;
    reorderPoint: number;
    maxReorderQuantity: number;
    enableBarcodeScanning: boolean;
    enableRFID: boolean;
    inventoryCountFrequency: 'weekly' | 'monthly' | 'quarterly';
  };
  
  // Staff Settings
  staffSettings: {
    enableTimeTracking: boolean;
    enableOvertime: boolean;
    maxOvertimeHours: number;
    enableLeaveManagement: boolean;
    defaultLeaveDays: number;
    enableShiftScheduling: boolean;
    shiftChangeNotificationHours: number;
    enablePerformanceReviews: boolean;
    reviewFrequency: 'monthly' | 'quarterly' | 'yearly';
  };
  
  // Guest Services Settings
  guestServicesSettings: {
    enableConcierge: boolean;
    enableRoomService: boolean;
    enableLaundry: boolean;
    enableSpa: boolean;
    enableGym: boolean;
    enablePool: boolean;
    enableBusinessCenter: boolean;
    enableChildcare: boolean;
    enablePetServices: boolean;
    enableTransportation: boolean;
  };
  
  // Compliance & Legal Settings
  complianceSettings: {
    enableDataProtection: boolean;
    enableGDPR: boolean;
    enableCCPA: boolean;
    dataRetentionDays: number;
    enableAuditTrail: boolean;
    enableDataEncryption: boolean;
    enableBackupEncryption: boolean;
    enableAccessLogs: boolean;
    enableChangeLogs: boolean;
    complianceOfficerEmail: string;
  };
  
  // SaaS Platform Settings
  saasSettings: {
    // Multi-Property Support
    enableMultiProperty: boolean;
    maxProperties: number;
    propertySwitching: boolean;
    
    // API & Integration
    enableAPI: boolean;
    apiRateLimit: number;
    webhookEndpoints: string[];
    thirdPartyIntegrations: {
      channelManagers: boolean;
      paymentGateways: boolean;
      accountingSoftware: boolean;
      crmSystems: boolean;
    };
    
    // Data & Backup
    dataRetentionPolicy: '30days' | '90days' | '1year' | '7years' | 'unlimited';
    autoBackupFrequency: 'hourly' | 'daily' | 'weekly';
    backupRetention: number;
    enableDataExport: boolean;
    
    // Performance & Scaling
    enableCaching: boolean;
    maxConcurrentUsers: number;
    enableCDN: boolean;
    enableLoadBalancing: boolean;
    
    // White-Label Options
    enableWhiteLabel: boolean;
    customBranding: {
      logoUrl?: string;
      primaryColor: string;
      secondaryColor: string;
      fontFamily: string;
      companyName: string;
      supportEmail: string;
      supportPhone: string;
    };
  };
}

export interface ModuleSettings {
  frontOffice: boolean;
  housekeeping: boolean;
  foodBeverage: boolean;
  inventory: boolean;
  accounting: boolean;
  hr: boolean;
  security: boolean;
  compliance: boolean;
  maintenance: boolean;
  analytics: boolean;
}

export interface RoomManagementSettings {
  // Room Configuration
  roomNumberingFormat: 'sequential' | 'floor-based' | 'custom';
  customNumberingPrefix?: string;
  floorSeparator: string;
  
  // Room Types
  roomTypes: Array<{
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
  }>;
  
  // Individual Rooms
  rooms: Array<{
    id: string;
    number: string;
    typeId: string;
    floor: string;
    status: string;
    isActive: boolean;
    notes: string;
    features: string[];
    maintenance: {
      lastInspection: string;
      nextInspection: string;
      issues: string[];
    };
  }>;
  
  // Room Statuses
  roomStatuses: Array<{
    id: string;
    name: string;
    color: string;
    description: string;
    isActive: boolean;
    canBook: boolean;
    requiresAction: boolean;
  }>;
  
  // Rate Plans
  ratePlans: Array<{
    id: string;
    name: string;
    roomTypeId: string;
    basePrice: number;
    isActive: boolean;
    marketSegment: string;
    
    // NEW: Event & Conference Rate Management
    rateType: 'standard' | 'corporate' | 'event_conference' | 'package' | 'fixed_price';
    eventSpecific?: {
      isEventRate: boolean;
      eventTypes: string[]; // ['conference', 'training', 'wedding', 'corporate_meeting']
      packagePrice?: number; // Per person per day for conference facilities
      includesVenue: boolean;
      includesCatering: boolean;
      includesEquipment: boolean;
      minAttendees: number;
      maxAttendees: number;
      advanceBookingDays: number;
      cancellationPolicy: string;
      depositPercentage: number;
    };
    
    restrictions: {
      minStay: number;
      maxStay: number;
      advanceBooking: number;
      cancellationPolicy: string;
    };
    seasonalRates: Array<{
      id: string;
      name: string;
      startDate: string;
      endDate: string;
      multiplier: number;
      description: string;
    }>;
    dayOfWeekRates: {
      monday: number;
      tuesday: number;
      wednesday: number;
      thursday: number;
      friday: number;
      saturday: number;
      sunday: number;
    };
  }>;
  
  // NEW: Event Resources Management
  eventResources: Array<{
    id: string;
    name: string;
    type: 'venue' | 'equipment' | 'service' | 'package';
    category: string;
    description: string;
    capacity?: number;
    basePrice: number;
    isActive: boolean;
    availability: {
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
      startTime: string;
      endTime: string;
    };
    seasonalPricing: Array<{
      id: string;
      name: string;
      startDate: string;
      endDate: string;
      multiplier: number;
      description: string;
    }>;
    includedInPackages: string[]; // Package IDs that include this resource
    setupTime: number; // Minutes required for setup
    cleanupTime: number; // Minutes required for cleanup
    notes: string;
  }>;
  
  // Service Charges Management
  serviceCharges: Array<{
    id: string;
    name: string;
    category: string;
    icon: string;
    basePrice: number;
    isActive: boolean;
    description: string;
    requiresApproval: boolean;
    maxDiscountPercent: number;
    taxIncluded: boolean;
            unit: 'per_item' | 'per_hour' | 'per_day' | 'per_person' | 'per_order' | 'per_session' | 'per_trip' | 'fixed';
    seasonalPricing: Array<{
      id: string;
      name: string;
      startDate: string;
      endDate: string;
      multiplier: number;
      description: string;
    }>;
  }>;

  // NEW: Event Packages Management
  eventPackages: Array<{
    id: string;
    name: string;
    description: string;
    category: 'conference' | 'training' | 'wedding' | 'corporate' | 'social';
    isActive: boolean;
    basePrice: number; // Per person per day
    minAttendees: number;
    maxAttendees: number;
    duration: number; // Days
    resources: Array<{
      resourceId: string;
      quantity: number;
      priceOverride?: number; // Override base price if different
    }>;
    inclusions: string[]; // What's included in the package
    exclusions: string[]; // What's NOT included
    terms: string;
    cancellationPolicy: string;
    depositPercentage: number;
    seasonalPricing: Array<{
      id: string;
      name: string;
      startDate: string;
      endDate: string;
      multiplier: number;
      description: string;
    }>;
  }>;
  
  // Status Change Rules
  statusChangeRules: Array<{
    fromStatus: string;
    toStatus: string;
    allowedRoles: string[];
    requiresApproval: boolean;
    autoActions: string[];
  }>;
  
  // Housekeeping Integration
  housekeepingEnabled: boolean;
  cleaningSchedules: {
    dailyCleaning: boolean;
    turnoverCleaning: boolean;
    deepCleaning: boolean;
    maintenanceCleaning: boolean;
  };
  
  // Maintenance Integration
  maintenanceEnabled: boolean;
  maintenanceCategories: string[];
  autoOOOSetup: boolean;
  
  // Room Assignment Rules
  assignmentRules: {
    allowOverbooking: boolean;
    maxOverbookingPercentage: number;
    priorityRooms: string[];
    restrictedRooms: string[];
  };
}

interface SettingsStore extends SystemSettings {
  // Actions
  updateSetting: <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => void;
  updateNestedSetting: (path: string, value: any) => void;
  loadSettings: () => void;
  saveSettings: () => void;
  resetToDefaults: () => void;
  
  // Country Management
  addCountry: (countryCode: string, compliance: CountryCompliance) => void;
  updateCountryCompliance: (countryCode: string, compliance: Partial<CountryCompliance>) => void;
  removeCountry: (countryCode: string) => void;
  getCurrentCountryCompliance: () => CountryCompliance | undefined;
  
  // User Management
  addUser: (user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deleteUser: (userId: string) => void;
  setCurrentUser: (user: User) => void;
  
  // User Profile Management
  updateUserProfile: (userId: string, profileUpdates: Partial<User['profile']>) => void;
  updateUserPreferences: (userId: string, preferenceUpdates: Partial<UserPreferences>) => void;
  updateUserSecurity: (userId: string, securityUpdates: Partial<User['security']>) => void;
  changePassword: (userId: string, newPassword: string) => void;
  
  // Role Management
  addRole: (role: Omit<UserRole, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRole: (roleId: string, updates: Partial<UserRole>) => void;
  deleteRole: (roleId: string) => void;
  
  // Business Entity Settings Management
  updateInvoiceSettings: (settings: Partial<InvoiceSettings>) => void;
  updateReceiptSettings: (settings: Partial<ReceiptSettings>) => void;
  updatePurchaseOrderSettings: (settings: Partial<PurchaseOrderSettings>) => void;
  updateProformaInvoiceSettings: (settings: Partial<ProformaInvoiceSettings>) => void;
  updateItemSettings: (settings: Partial<ItemSettings>) => void;
  updateClientSettings: (settings: Partial<ClientSettings>) => void;
  updateReservationSettings: (settings: Partial<ReservationSettings>) => void;
  updateDocumentTemplates: (settings: Partial<DocumentTemplateSettings>) => void;
  
  // Additional Settings Management
  updateSystemPreferences: (settings: Partial<SystemSettings['systemPreferences']>) => void;
  updateHotelSettings: (settings: Partial<SystemSettings['hotelSettings']>) => void;
  updateRoomSettings: (settings: Partial<SystemSettings['roomSettings']>) => void;
  updateFinancialSettings: (settings: Partial<SystemSettings['financialSettings']>) => void;
  updateCommunicationSettings: (settings: Partial<SystemSettings['communicationSettings']>) => void;
  updateReportingSettings: (settings: Partial<SystemSettings['reportingSettings']>) => void;
  updateMaintenanceSettings: (settings: Partial<SystemSettings['maintenanceSettings']>) => void;
  updateInventorySettings: (settings: Partial<SystemSettings['inventorySettings']>) => void;
  updateStaffSettings: (settings: Partial<SystemSettings['staffSettings']>) => void;
  updateGuestServicesSettings: (settings: Partial<SystemSettings['guestServicesSettings']>) => void;
  updateComplianceSettings: (settings: Partial<SystemSettings['complianceSettings']>) => void;
  updateSaasSettings: (settings: Partial<SystemSettings['saasSettings']>) => void;
  
  // Document Number Generation
  getNextInvoiceNumber: () => string;
  getNextReceiptNumber: () => string;
  getNextPurchaseOrderNumber: () => string;
  getNextProformaInvoiceNumber: () => string;
  getNextClientNumber: () => string;
  getNextReservationNumber: () => string;
  
  // Authorization
  hasPermission: (permission: string) => boolean;
  getUserPermissions: () => string[];
  
  // Subscribers
  subscribers: Set<() => void>;
  subscribe: (callback: () => void) => () => void;
  publish: () => void;

  // Module Settings (SaaS)
  moduleSettings: ModuleSettings;
  
  // Room Management
  roomManagement: RoomManagementSettings;
  
  // Module Management Methods
  toggleModule: (module: keyof ModuleSettings) => void;
  updateModuleSettings: (settings: Partial<ModuleSettings>) => void;
  
  // Room Management Methods
  updateRoomManagement: (settings: Partial<RoomManagementSettings>) => void;
  
  addRoomType: (roomType: RoomManagementSettings['roomTypes'][0]) => void;
  updateRoomType: (id: string, updates: Partial<RoomManagementSettings['roomTypes'][0]>) => void;
  deleteRoomType: (id: string) => void;
  addRoomStatus: (status: RoomManagementSettings['roomStatuses'][0]) => void;
  updateRoomStatus: (id: string, updates: Partial<RoomManagementSettings['roomStatuses'][0]>) => void;
  addRoom: (room: RoomManagementSettings['rooms'][0]) => void;
  updateRoom: (id: string, updates: Partial<RoomManagementSettings['rooms'][0]>) => void;
  deleteRoom: (id: string) => void;
  
  // Rate Plan Management
  addRatePlan: (ratePlan: RoomManagementSettings['ratePlans'][0]) => void;
  updateRatePlan: (id: string, updates: Partial<RoomManagementSettings['ratePlans'][0]>) => void;
  deleteRatePlan: (id: string) => void;
  addSeasonalRate: (ratePlanId: string, seasonalRate: RoomManagementSettings['ratePlans'][0]['seasonalRates'][0]) => void;
  updateSeasonalRate: (ratePlanId: string, seasonalRateId: string, updates: Partial<RoomManagementSettings['ratePlans'][0]['seasonalRates'][0]>) => void;
  deleteSeasonalRate: (ratePlanId: string, seasonalRateId: string) => void;
  
  // NEW: Event Resources Management
  addEventResource: (resource: RoomManagementSettings['eventResources'][0]) => void;
  updateEventResource: (id: string, updates: Partial<RoomManagementSettings['eventResources'][0]>) => void;
  deleteEventResource: (id: string) => void;
  addEventResourceSeasonalPricing: (resourceId: string, pricing: RoomManagementSettings['eventResources'][0]['seasonalPricing'][0]) => void;
  updateEventResourceSeasonalPricing: (resourceId: string, pricingId: string, updates: Partial<RoomManagementSettings['eventResources'][0]['seasonalPricing'][0]>) => void;
  deleteEventResourceSeasonalPricing: (resourceId: string, pricingId: string) => void;
  
  // NEW: Event Packages Management
  addEventPackage: (pkg: RoomManagementSettings['eventPackages'][0]) => void;
  updateEventPackage: (id: string, updates: Partial<RoomManagementSettings['eventPackages'][0]>) => void;
  deleteEventPackage: (id: string) => void;
  addEventPackageSeasonalPricing: (packageId: string, pricing: RoomManagementSettings['eventPackages'][0]['seasonalPricing'][0]) => void;
  updateEventPackageSeasonalPricing: (packageId: string, pricingId: string, updates: Partial<RoomManagementSettings['eventPackages'][0]['seasonalPricing'][0]>) => void;
  deleteEventPackageSeasonalPricing: (packageId: string, pricingId: string) => void;
  
  // Service Charges Management
  addServiceCharge: (charge: RoomManagementSettings['serviceCharges'][0]) => void;
  updateServiceCharge: (id: string, updates: Partial<RoomManagementSettings['serviceCharges'][0]>) => void;
  deleteServiceCharge: (id: string) => void;
  addServiceChargeSeasonalPricing: (chargeId: string, pricing: RoomManagementSettings['serviceCharges'][0]['seasonalPricing'][0]) => void;
  updateServiceChargeSeasonalPricing: (chargeId: string, pricingId: string, updates: Partial<RoomManagementSettings['serviceCharges'][0]['seasonalPricing'][0]>) => void;
  deleteServiceChargeSeasonalPricing: (chargeId: string, pricingId: string) => void;
  
  // Template Management Methods
  addTemplate: (template: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTemplate: (id: string, updates: Partial<DocumentTemplate>) => void;
  deleteTemplate: (id: string) => void;
  activateTemplate: (id: string) => void;
  deactivateTemplate: (id: string) => void;
  setDefaultTemplate: (documentType: string, templateId: string) => void;
  getTemplate: (id: string) => DocumentTemplate | undefined;
  getTemplatesByType: (type: DocumentTemplate['type']) => DocumentTemplate[];
  getActiveTemplate: (documentType: string) => DocumentTemplate | undefined;
  getDefaultTemplate: (documentType: string) => DocumentTemplate | undefined;
}

// Default Ghana compliance configuration
const defaultGhanaCompliance: CountryCompliance = {
  countryCode: 'GH',
  countryName: 'Ghana',
  currency: 'GHS',
  currencySymbol: '₵',
  timezone: 'Africa/Accra',
  dateFormat: 'DD/MM/YYYY',
  numberFormat: '#,##0.00',
  
  taxRates: {
    vat: 12.5,
    nhil: 2.5,
    tourismLevy: 1.0,
    ssnit: 5.5,
  },
  
  businessInfo: {
    name: 'Ghana Hotel Management',
    address: '',
    phone: '',
    email: '',
    website: '',
    taxId: '',
    vatNumber: '',
    registrationNumber: '',
  },
  
  compliance: {
    eInvoicing: true,
    taxReports: true,
    governmentIntegration: false,
    digitalSignature: false,
    auditTrail: true,
  },
  
  paymentMethods: {
    mobileMoney: true,
    bankTransfer: true,
    creditCard: false,
    cash: true,
    digitalWallet: false,
  },
  
  localization: {
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    numberFormat: '#,##0.00',
    currencyPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
};

// Default roles
const defaultRoles: UserRole[] = [
  {
    id: 'admin',
    name: 'System Administrator',
    description: 'Full system access and control',
    permissions: ['*'],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'manager',
    name: 'Hotel Manager',
    description: 'Hotel operations management',
    permissions: [
      'dashboard.view',
      'frontdesk.*',
      'housekeeping.*',
      'f&b.*',
      'reports.view',
      'settings.view',
    ],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'staff',
    name: 'Staff Member',
    description: 'Basic operational access',
    permissions: [
      'dashboard.view',
      'frontdesk.checkin',
      'frontdesk.checkout',
      'housekeeping.view',
      'f&b.pos',
    ],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const defaultSettings: SystemSettings = {
  // SaaS Platform Settings
  tenantId: 'demo-tenant-001',
  tenant: {
    id: 'demo-tenant-001',
    name: 'Demo Hotel Chain',
    subdomain: 'demo',
    domain: 'demo.ghana-hotel.com',
    plan: 'professional',
    status: 'active',
    trialEndsAt: '2024-12-31T23:59:59Z',
    subscriptionEndsAt: '2025-12-31T23:59:59Z',
    maxUsers: 25,
    maxRooms: 100,
    maxProperties: 3,
    features: ['multi-property', 'api-access', 'white-label', 'advanced-analytics'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    metadata: {
      industry: 'hospitality',
      size: 'medium',
      region: 'West Africa',
      timezone: 'Africa/Accra',
      currency: 'GHS',
      language: 'en',
    },
  },
  
  systemName: 'Hotel Management System',
  version: '2.1.0',
  environment: 'production',
  
  defaultCountry: 'GH',
  supportedCountries: ['GH'],
  countryCompliance: {
    'GH': defaultGhanaCompliance,
  },
  
  users: [
    {
      id: 'admin_001',
      username: 'admin',
      email: 'admin@ghana-hotel.com',
      firstName: 'System',
      lastName: 'Administrator',
      roleId: 'admin',
      isActive: true,
      lastLogin: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: {
        theme: 'light',
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
          quickActions: ['new-reservation', 'check-in', 'pos-terminal', 'reports'],
          widgets: ['recent-activity', 'quick-stats', 'calendar', 'notifications'],
        },
        accessibility: {
          fontSize: 'medium',
          highContrast: false,
          reduceMotion: false,
        },
      },
      profile: {
        avatar: '',
        phone: '+233 20 123 4567',
        address: 'Accra, Ghana',
        department: 'IT',
        position: 'System Administrator',
        employeeId: 'EMP001',
        hireDate: '2024-01-01',
        emergencyContact: {
          name: 'John Doe',
          phone: '+233 24 987 6543',
          relationship: 'Spouse',
        },
        bio: 'System administrator with 5+ years of experience in hotel management systems.',
        skills: ['System Administration', 'Database Management', 'Network Security'],
        certifications: ['CompTIA A+', 'Microsoft Certified Professional'],
      },
      security: {
        passwordLastChanged: new Date().toISOString(),
        passwordExpiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        failedLoginAttempts: 0,
        accountLocked: false,
        twoFactorEnabled: false,
      },
    }
  ],
  roles: defaultRoles,
  currentUser: {
    id: 'admin_001',
    username: 'admin',
    email: 'admin@ghana-hotel.com',
    firstName: 'System',
    lastName: 'Administrator',
    roleId: 'admin',
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: {
      theme: 'light',
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
        quickActions: ['new-reservation', 'check-in', 'pos-terminal', 'reports'],
        widgets: ['recent-activity', 'quick-stats', 'calendar', 'notifications'],
      },
      accessibility: {
        fontSize: 'medium',
        highContrast: false,
        reduceMotion: false,
      },
    },
    profile: {
      avatar: '',
      phone: '+233 20 123 4567',
      address: 'Accra, Ghana',
      department: 'IT',
      position: 'System Administrator',
      employeeId: 'EMP001',
      hireDate: '2024-01-01',
      emergencyContact: {
        name: 'John Doe',
        phone: '+233 24 987 6543',
        relationship: 'Spouse',
      },
      bio: 'System administrator with 5+ years of experience in hotel management systems.',
      skills: ['System Administration', 'Database Management', 'Network Security'],
      certifications: ['CompTIA A+', 'Microsoft Certified Professional'],
    },
    security: {
      passwordLastChanged: new Date().toISOString(),
      passwordExpiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      failedLoginAttempts: 0,
      accountLocked: false,
      twoFactorEnabled: false,
    },
  },
  
  security: {
    sessionTimeout: 30,
    twoFactorAuth: true,
    ipWhitelist: [],
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      expiryDays: 90,
    },
    loginAttempts: {
      maxAttempts: 5,
      lockoutDuration: 15,
    },
  },
  
  posSettings: {
    managerPin: '1234',
    printMethod: 'browser',
    bridgeUrl: 'http://localhost:7777',
    routeReceipts: '',
    routeKOTs: '',
    requireManagerApproval: true,
    allowVoidAfterMinutes: 30,
  },
  
  // Business Entity Settings with Defaults
  invoiceSettings: {
    prefix: 'INV',
    suffix: '',
    nextNumber: 1001,
    numberFormat: 'INV-{YEAR}-{NUMBER}',
    defaultPaymentTerms: 30,
    latePaymentPenalty: 5.0,
    earlyPaymentDiscount: 2.0,
    showTaxBreakdown: true,
    showPaymentInstructions: true,
    showBankDetails: true,
    footerText: 'Thank you for your business. Please pay within {TERMS} days.',
    primaryColor: '#2563eb',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
  },
  
  receiptSettings: {
    businessName: 'Ghana Hotel Management',
    tagline: 'Excellence in Hospitality',
    showTaxBreakdown: true,
    showPaymentMethod: true,
    showCashierName: true,
    showTransactionId: true,
    footerText: 'Thank you for choosing us. Visit again soon!',
    socialMedia: ['Facebook', 'Instagram', 'Twitter'],
    website: 'www.ghanahotel.com',
    primaryColor: '#059669',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
  },
  
  purchaseOrderSettings: {
    prefix: 'PO',
    suffix: '',
    nextNumber: 1001,
    numberFormat: 'PO-{YEAR}-{NUMBER}',
    requireApproval: true,
    approvalThreshold: 10000,
    approvers: ['admin_001'],
    defaultPaymentTerms: 30,
    defaultDeliveryTerms: 'FOB Destination',
    showTaxBreakdown: true,
    showDeliveryAddress: true,
    termsAndConditions: 'All orders subject to our standard terms and conditions.',
    primaryColor: '#dc2626',
    fontFamily: 'Arial, sans-serif',
  },
  
  proformaInvoiceSettings: {
    prefix: 'PRO',
    suffix: '',
    nextNumber: 1001,
    numberFormat: 'PRO-{YEAR}-{NUMBER}',
    validityDays: 30,
    showValidityPeriod: true,
    showTaxBreakdown: true,
    showPaymentInstructions: true,
    termsAndConditions: 'This is a proforma invoice and does not constitute a tax document.',
    primaryColor: '#7c3aed',
    fontFamily: 'Arial, sans-serif',
  },
  
  itemSettings: {
    defaultCategories: ['Food & Beverage', 'Housekeeping', 'Maintenance', 'Office Supplies', 'Amenities'],
    allowCustomCategories: true,
    showCostPrice: false,
    showProfitMargin: false,
    defaultMarkup: 30.0,
    trackInventory: true,
    lowStockThreshold: 10,
    reorderPoint: 5,
    defaultUnit: 'piece',
    allowedUnits: ['piece', 'kg', 'liter', 'box', 'pack', 'roll', 'meter'],
    generateBarcodes: true,
    barcodePrefix: 'GH',
    barcodeFormat: 'EAN13',
  },
  
  clientSettings: {
    prefix: 'C',
    suffix: '',
    nextNumber: 1,
    numberFormat: 'C{NUMBER}',
    defaultCategories: ['Individual', 'Business', 'VIP', 'Corporate', 'Travel Agent'],
    allowCustomCategories: true,
    allowCredit: true,
    defaultCreditLimit: 5000,
    creditTerms: 30,
    sendInvoices: true,
    sendReceipts: false,
    sendStatements: true,
    requiredFields: ['name', 'phone', 'email'],
    optionalFields: ['address', 'nationality', 'ghanaCard', 'passport', 'companyName'],
  },
  reservationSettings: {
    prefix: 'RES',
    suffix: '',
    nextNumber: 1,
    numberFormat: 'RES-{YEAR}-{NUMBER}'
  },
  
  documentTemplates: {
    // Template Management
    templates: [
      {
        id: 'ghana-standard-receipt',
        name: 'Ghana Standard Receipt',
        type: 'receipt',
        category: 'financial',
        description: 'Professional receipt template with Ghana VAT compliance',
        preview: 'ghana-standard-receipt',
        isActive: true,
        isDefault: true,
        createdAt: '2024-01-15',
        updatedAt: '2024-01-15',
        variables: [
          { key: 'hotelName', label: 'Hotel Name', type: 'text', required: true },
          { key: 'guestName', label: 'Guest Name', type: 'text', required: true },
          { key: 'amount', label: 'Amount', type: 'number', required: true },
          { key: 'vat', label: 'VAT Amount', type: 'number', required: true },
          { key: 'date', label: 'Date', type: 'date', required: true }
        ],
        styling: {
          primaryColor: '#1e40af',
          secondaryColor: '#64748b',
          fontFamily: 'Inter',
          fontSize: '14px',
          logoPosition: 'top-left',
          headerStyle: 'professional',
          footerStyle: 'detailed'
        },
        compliance: {
          ghanaVAT: true,
          ghanaNHIL: true,
          ghanaTourismLevy: true,
          ssnit: false,
          incomeTax: false,
          customFields: {}
        },
        html: '<div class="receipt">...</div>',
        css: '.receipt { font-family: Arial; }'
      }
    ],
    activeTemplates: {
      'receipt': 'ghana-standard-receipt',
      'invoice': 'ghana-standard-receipt',
      'purchase-order': 'ghana-standard-receipt'
    },
    defaultTemplates: {
      'receipt': 'ghana-standard-receipt',
      'invoice': 'ghana-standard-receipt',
      'purchase-order': 'ghana-standard-receipt'
    },
    
    // Template Categories
    categories: [
      { id: 'financial', name: 'Financial', description: 'Financial documents', color: '#059669' },
      { id: 'operational', name: 'Operational', description: 'Operational documents', color: '#dc2626' },
      { id: 'legal', name: 'Legal', description: 'Legal documents', color: '#7c3aed' },
      { id: 'marketing', name: 'Marketing', description: 'Marketing documents', color: '#f59e0b' }
    ],
    
    // Template Variables
    globalVariables: [
      { key: 'hotelName', label: 'Hotel Name', type: 'text', required: true },
      { key: 'currentDate', label: 'Current Date', type: 'date', required: true },
      { key: 'userName', label: 'User Name', type: 'text', required: true }
    ],
    
    // Template Styling
    defaultStyling: {
      primaryColor: '#1e40af',
      secondaryColor: '#64748b',
      fontFamily: 'Inter',
      fontSize: '14px',
      logoPosition: 'top-left',
      headerStyle: 'professional',
      footerStyle: 'detailed'
    },
    
    // Compliance Settings
    complianceSettings: {
      ghanaVAT: true,
      ghanaNHIL: true,
      ghanaTourismLevy: true,
      ssnit: false,
      incomeTax: false,
      customFields: {}
    },
    
    // Legacy Template Support (for backward compatibility)
    invoiceTemplates: [
      {
        id: 'default-invoice',
        name: 'Default Invoice',
        isDefault: true,
        html: '<div class="invoice">...</div>',
        css: '.invoice { font-family: Arial; }',
      }
    ],
    receiptTemplates: [
      {
        id: 'default-receipt',
        name: 'Default Receipt',
        isDefault: true,
        html: '<div class="receipt">...</div>',
        css: '.receipt { font-family: Arial; }',
      }
    ],
    poTemplates: [
      {
        id: 'default-po',
        name: 'Default Purchase Order',
        isDefault: true,
        html: '<div class="po">...</div>',
        css: '.po { font-family: Arial; }',
      }
    ],
    proformaTemplates: [
      {
        id: 'default-proforma',
        name: 'Default Proforma Invoice',
        isDefault: true,
        html: '<div class="proforma">...</div>',
        css: '.proforma { font-family: Arial; }',
      }
    ],
  },
  
  integrations: {
    paymentGateways: {
      mobileMoney: true,
      bankIntegration: false,
    },
    accounting: {},
    channelManagers: {},
  },
  
  backup: {
    autoBackup: true,
    backupFrequency: 'daily',
    lastBackup: '2024-01-15 02:00:00',
    nextBackup: '2024-01-16 02:00:00',
    retentionDays: 30,
    cloudBackup: false,
  },
  
  // Additional System Settings
  systemPreferences: {
    autoLogout: true,
    logRetentionDays: 365,
    maxFileUploadSize: 10,
    allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
    enableAuditLog: true,
    enableNotifications: true,
    enableMaintenanceMode: false,
  },
  
  // Hotel-Specific Settings
  hotelSettings: {
    checkInTime: '14:00',
    checkOutTime: '11:00',
    lateCheckOutFee: 50,
    earlyCheckInFee: 30,
    cancellationPolicy: 'Free cancellation up to 24 hours before arrival',
    noShowPolicy: 'Full charge for no-show reservations',
    petPolicy: false,
    smokingPolicy: false,
    wifiPassword: 'ghana2024',
    parkingAvailable: true,
    parkingFee: 20,
    airportShuttle: true,
    shuttleFee: 100,
  },
  
  // Room Management Settings
  roomSettings: {
    autoAssignRooms: true,
    allowRoomChanges: true,
    maxRoomChanges: 2,
    housekeepingStartTime: '08:00',
    housekeepingEndTime: '17:00',
    maintenanceNotificationEmail: 'maintenance@ghana-hotel.com',
    lowInventoryThreshold: 5,
    highInventoryThreshold: 100,
  },
  
  // Financial Settings
  financialSettings: {
    defaultCurrency: 'GHS',
    supportedCurrencies: ['GHS', 'USD', 'EUR', 'GBP'],
    exchangeRateUpdateFrequency: 'daily',
    taxInclusive: false,
    roundToNearest: 0.50,
    enableDiscounts: true,
    maxDiscountPercentage: 25,
    requireApprovalForDiscounts: true,
    discountApprovalThreshold: 15,
  },
  
  // Communication Settings
  communicationSettings: {
    smsEnabled: true,
    emailEnabled: true,
    pushNotifications: true,
    autoSendConfirmations: true,
    autoSendReminders: true,
    reminderHoursBefore: 24,
    confirmationTemplate: 'Your reservation is confirmed for {dates}',
    reminderTemplate: 'Reminder: Your stay begins tomorrow at {checkInTime}',
    smsProvider: 'Twilio',
    emailProvider: 'SendGrid',
  },
  
  // Reporting Settings
  reportingSettings: {
    defaultReportFormat: 'pdf',
    autoGenerateReports: true,
    reportSchedule: 'daily',
    reportTime: '09:00',
    includeCharts: true,
    includeDataTables: true,
    maxReportRows: 10000,
    enableEmailReports: true,
    reportRecipients: ['manager@ghana-hotel.com', 'accounting@ghana-hotel.com'],
  },
  
  // Maintenance Settings
  maintenanceSettings: {
    enableMaintenanceRequests: true,
    autoAssignMaintenance: true,
    maintenancePriorityLevels: ['Low', 'Medium', 'High', 'Critical'],
    requireMaintenanceApproval: true,
    maintenanceApprovalThreshold: 5000,
    enablePreventiveMaintenance: true,
    maintenanceReminderDays: 7,
  },
  
  // Inventory Settings
  inventorySettings: {
    enableLowStockAlerts: true,
    enableExpiryAlerts: true,
    expiryAlertDays: 30,
    autoReorder: false,
    reorderPoint: 10,
    maxReorderQuantity: 100,
    enableBarcodeScanning: true,
    enableRFID: false,
    inventoryCountFrequency: 'monthly',
  },
  
  // Staff Settings
  staffSettings: {
    enableTimeTracking: true,
    enableOvertime: true,
    maxOvertimeHours: 12,
    enableLeaveManagement: true,
    defaultLeaveDays: 21,
    enableShiftScheduling: true,
    shiftChangeNotificationHours: 24,
    enablePerformanceReviews: true,
    reviewFrequency: 'quarterly',
  },
  
  // Guest Services Settings
  guestServicesSettings: {
    enableConcierge: true,
    enableRoomService: true,
    enableLaundry: true,
    enableSpa: false,
    enableGym: true,
    enablePool: true,
    enableBusinessCenter: true,
    enableChildcare: false,
    enablePetServices: false,
    enableTransportation: true,
  },
  
  // Compliance & Legal Settings
  complianceSettings: {
    enableDataProtection: true,
    enableGDPR: false,
    enableCCPA: false,
    dataRetentionDays: 2555, // 7 years
    enableAuditTrail: true,
    enableDataEncryption: true,
    enableBackupEncryption: true,
    enableAccessLogs: true,
    enableChangeLogs: true,
    complianceOfficerEmail: 'compliance@ghana-hotel.com',
  },
  
  // SaaS Platform Settings
  saasSettings: {
    // Multi-Property Support
    enableMultiProperty: false,
    maxProperties: 1,
    propertySwitching: false,
    
    // API & Integration
    enableAPI: false,
    apiRateLimit: 1000,
    webhookEndpoints: [],
    thirdPartyIntegrations: {
      channelManagers: false,
      paymentGateways: false,
      accountingSoftware: false,
      crmSystems: false,
    },
    
    // Data & Backup
    dataRetentionPolicy: '7years',
    autoBackupFrequency: 'daily',
    backupRetention: 30,
    enableDataExport: false,
    
    // Performance & Scaling
    enableCaching: true,
    maxConcurrentUsers: 50,
    enableCDN: false,
    enableLoadBalancing: false,
    
    // White-Label Options
    enableWhiteLabel: false,
    customBranding: {
      logoUrl: '',
      primaryColor: '#2563eb',
      secondaryColor: '#64748b',
      fontFamily: 'Inter, sans-serif',
      companyName: 'Ghana Hotel Management',
      supportEmail: 'support@ghana-hotel.com',
      supportPhone: '+233 20 123 4567',
    },
  },
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...defaultSettings,
  subscribers: new Set(),
  
  updateSetting: (key, value) => {
    set({ [key]: value });
    get().saveSettings();
    get().publish();
  },
  
  updateNestedSetting: (path, value) => {
    const keys = path.split('.');
    const current = { ...get() };
    let target: any = current;
    
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]];
    }
    
    target[keys[keys.length - 1]] = value;
    set(current);
    get().saveSettings();
    get().publish();
  },
  
  loadSettings: () => {
    try {
      // Load system settings
      const systemSettings = localStorage.getItem('system.settings');
      if (systemSettings) {
        const parsed = JSON.parse(systemSettings);
        set(parsed);
      }
      
      // Load room management settings
      const roomManagement = localStorage.getItem('room.management');
      if (roomManagement) {
        const parsed = JSON.parse(roomManagement);
        set({ roomManagement: { ...get().roomManagement, ...parsed } });
      }
      
      // Load POS settings
      const posSettings = {
        managerPin: localStorage.getItem('manager.pin') || defaultSettings.posSettings.managerPin,
        printMethod: (localStorage.getItem('print.method') as 'browser' | 'bridge') || defaultSettings.posSettings.printMethod,
        bridgeUrl: localStorage.getItem('print.bridgeUrl') || defaultSettings.posSettings.bridgeUrl,
        routeReceipts: localStorage.getItem('print.route.receipt') || defaultSettings.posSettings.routeReceipts,
        routeKOTs: localStorage.getItem('print.route.kot') || defaultSettings.posSettings.routeKOTs,
        requireManagerApproval: defaultSettings.posSettings.requireManagerApproval,
        allowVoidAfterMinutes: defaultSettings.posSettings.allowVoidAfterMinutes,
      };
      set({ posSettings });
      
      // Load country compliance settings
      const countryCompliance = { ...defaultSettings.countryCompliance };
      const savedCompliance = localStorage.getItem('country.compliance');
      if (savedCompliance) {
        const parsed = JSON.parse(savedCompliance);
        Object.assign(countryCompliance, parsed);
      }
      set({ countryCompliance });
      
      // Load users and roles
      const users = localStorage.getItem('system.users') ? JSON.parse(localStorage.getItem('system.users')!) : [];
      const roles = localStorage.getItem('system.roles') ? JSON.parse(localStorage.getItem('system.roles')!) : defaultRoles;
      set({ users, roles });
      
      // Load current user
      const currentUser = localStorage.getItem('system.currentUser') ? JSON.parse(localStorage.getItem('system.currentUser')!) : undefined;
      set({ currentUser });
      
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  },
  
  saveSettings: () => {
    try {
      const state = get();
      
      // Save system settings
      localStorage.setItem('system.settings', JSON.stringify({
        systemName: state.systemName,
        version: state.version,
        environment: state.environment,
        defaultCountry: state.defaultCountry,
        supportedCountries: state.supportedCountries,
        security: state.security,
        integrations: state.integrations,
        backup: state.backup,
      }));
      
      // Save room management settings
      localStorage.setItem('room.management', JSON.stringify(state.roomManagement));
      
      // Save POS settings
      localStorage.setItem('manager.pin', state.posSettings.managerPin);
      localStorage.setItem('print.method', state.posSettings.printMethod);
      localStorage.setItem('print.bridgeUrl', state.posSettings.bridgeUrl);
      localStorage.setItem('print.route.receipt', state.posSettings.routeReceipts);
      localStorage.setItem('print.route.kot', state.posSettings.routeKOTs);
      
      // Save country compliance
      localStorage.setItem('country.compliance', JSON.stringify(state.countryCompliance));
      
      // Save users and roles
      localStorage.setItem('system.users', JSON.stringify(state.users));
      localStorage.setItem('system.roles', JSON.stringify(state.roles));
      
      // Save current user
      if (state.currentUser) {
        localStorage.setItem('system.currentUser', JSON.stringify(state.currentUser));
      }
      
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  },
  
  resetToDefaults: () => {
    set(defaultSettings);
    get().saveSettings();
    get().publish();
  },
  
  // Country Management
  addCountry: (countryCode, compliance) => {
    const state = get();
    const newCountryCompliance = { ...state.countryCompliance, [countryCode]: compliance };
    const newSupportedCountries = [...state.supportedCountries, countryCode];
    set({ 
      countryCompliance: newCountryCompliance,
      supportedCountries: newSupportedCountries
    });
    get().saveSettings();
    get().publish();
  },
  
  updateCountryCompliance: (countryCode, compliance) => {
    const state = get();
    const currentCompliance = state.countryCompliance[countryCode];
    if (currentCompliance) {
      const updatedCompliance = { ...currentCompliance, ...compliance };
      const newCountryCompliance = { ...state.countryCompliance, [countryCode]: updatedCompliance };
      set({ countryCompliance: newCountryCompliance });
      get().saveSettings();
      get().publish();
    }
  },
  
  removeCountry: (countryCode) => {
    const state = get();
    const newCountryCompliance = { ...state.countryCompliance };
    delete newCountryCompliance[countryCode];
    const newSupportedCountries = state.supportedCountries.filter(c => c !== countryCode);
    set({ 
      countryCompliance: newCountryCompliance,
      supportedCountries: newSupportedCountries
    });
    get().saveSettings();
    get().publish();
  },
  
  getCurrentCountryCompliance: () => {
    const state = get();
    return state.countryCompliance[state.defaultCountry];
  },

  // Module Management Methods
  toggleModule: (module: keyof ModuleSettings) => {
    const state = get();
    const current = state.moduleSettings;
    const newModuleSettings = { ...current, [module]: !current[module] } as ModuleSettings;
    set({ moduleSettings: newModuleSettings });
    get().saveSettings();
    get().publish();
  },

  updateModuleSettings: (settings: Partial<ModuleSettings>) => {
    const state = get();
    const newModuleSettings = { ...state.moduleSettings, ...settings };
    set({ moduleSettings: newModuleSettings });
    get().saveSettings();
    get().publish();
  },

  // Room Management Methods
  updateRoomManagement: (settings: Partial<RoomManagementSettings>) => {
    const state = get();
    const newRoomManagement = { ...state.roomManagement, ...settings };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  addRoomType: (roomType: RoomManagementSettings['roomTypes'][0]) => {
    const state = get();
    const newRoomTypes = [...state.roomManagement.roomTypes, roomType];
    const newRoomManagement = { ...state.roomManagement, roomTypes: newRoomTypes };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  updateRoomType: (id: string, updates: Partial<RoomManagementSettings['roomTypes'][0]>) => {
    const state = get();
    const newRoomTypes = state.roomManagement.roomTypes.map(rt => 
      rt.id === id ? { ...rt, ...updates } : rt
    );
    const newRoomManagement = { ...state.roomManagement, roomTypes: newRoomTypes };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  deleteRoomType: (id: string) => {
    const state = get();
    const newRoomTypes = state.roomManagement.roomTypes.filter(rt => rt.id !== id);
    const newRoomManagement = { ...state.roomManagement, roomTypes: newRoomTypes };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  addRoomStatus: (status: RoomManagementSettings['roomStatuses'][0]) => {
    const state = get();
    const newRoomStatuses = [...state.roomManagement.roomStatuses, status];
    const newRoomManagement = { ...state.roomManagement, roomStatuses: newRoomStatuses };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  updateRoomStatus: (id: string, updates: Partial<RoomManagementSettings['roomStatuses'][0]>) => {
    const state = get();
    const newRoomStatuses = state.roomManagement.roomStatuses.map(rs => 
      rs.id === id ? { ...rs, ...updates } : rs
    );
    const newRoomManagement = { ...state.roomManagement, roomStatuses: newRoomStatuses };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  addRoom: (room: RoomManagementSettings['rooms'][0]) => {
    const state = get();
    const newRooms = [...state.roomManagement.rooms, room];
    const newRoomManagement = { ...state.roomManagement, rooms: newRooms };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  updateRoom: (id: string, updates: Partial<RoomManagementSettings['rooms'][0]>) => {
    const state = get();
    const newRooms = state.roomManagement.rooms.map(r => 
      r.id === id ? { ...r, ...updates } : r
    );
    const newRoomManagement = { ...state.roomManagement, rooms: newRooms };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  deleteRoom: (id: string) => {
    const state = get();
    const newRooms = state.roomManagement.rooms.filter(r => r.id !== id);
    const newRoomManagement = { ...state.roomManagement, rooms: newRooms };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  // Rate Plan Management
  addRatePlan: (ratePlan: RoomManagementSettings['ratePlans'][0]) => {
    const state = get();
    const newRatePlans = [...state.roomManagement.ratePlans, ratePlan];
    const newRoomManagement = { ...state.roomManagement, ratePlans: newRatePlans };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  updateRatePlan: (id: string, updates: Partial<RoomManagementSettings['ratePlans'][0]>) => {
    const state = get();
    const newRatePlans = state.roomManagement.ratePlans.map(rp => 
      rp.id === id ? { ...rp, ...updates } : rp
    );
    const newRoomManagement = { ...state.roomManagement, ratePlans: newRatePlans };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  deleteRatePlan: (id: string) => {
    const state = get();
    const newRatePlans = state.roomManagement.ratePlans.filter(rp => rp.id !== id);
    const newRoomManagement = { ...state.roomManagement, ratePlans: newRatePlans };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  addSeasonalRate: (ratePlanId: string, seasonalRate: RoomManagementSettings['ratePlans'][0]['seasonalRates'][0]) => {
    const state = get();
    const newRatePlans = state.roomManagement.ratePlans.map(rp => 
      rp.id === ratePlanId 
        ? { ...rp, seasonalRates: [...rp.seasonalRates, seasonalRate] }
        : rp
    );
    const newRoomManagement = { ...state.roomManagement, ratePlans: newRatePlans };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  updateSeasonalRate: (ratePlanId: string, seasonalRateId: string, updates: Partial<RoomManagementSettings['ratePlans'][0]['seasonalRates'][0]>) => {
    const state = get();
    const newRatePlans = state.roomManagement.ratePlans.map(rp => 
      rp.id === ratePlanId 
        ? { 
            ...rp, 
            seasonalRates: rp.seasonalRates.map(sr => 
              sr.id === seasonalRateId ? { ...sr, ...updates } : sr
            )
          }
        : rp
    );
    const newRoomManagement = { ...state.roomManagement, ratePlans: newRatePlans };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  deleteSeasonalRate: (ratePlanId: string, seasonalRateId: string) => {
    const state = get();
    const newRatePlans = state.roomManagement.ratePlans.map(rp => 
      rp.id === ratePlanId 
        ? { ...rp, seasonalRates: rp.seasonalRates.filter(sr => sr.id !== seasonalRateId) }
        : rp
    );
    const newRoomManagement = { ...state.roomManagement, ratePlans: newRatePlans };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },
  
  // NEW: Event Resources Management
  addEventResource: (resource: RoomManagementSettings['eventResources'][0]) => {
    const state = get();
    const newResources = [...state.roomManagement.eventResources, resource];
    const newRoomManagement = { ...state.roomManagement, eventResources: newResources };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  updateEventResource: (id: string, updates: Partial<RoomManagementSettings['eventResources'][0]>) => {
    const state = get();
    const newResources = state.roomManagement.eventResources.map(r => 
      r.id === id ? { ...r, ...updates } : r
    );
    const newRoomManagement = { ...state.roomManagement, eventResources: newResources };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  deleteEventResource: (id: string) => {
    const state = get();
    const newResources = state.roomManagement.eventResources.filter(r => r.id !== id);
    const newRoomManagement = { ...state.roomManagement, eventResources: newResources };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  addEventResourceSeasonalPricing: (resourceId: string, pricing: RoomManagementSettings['eventResources'][0]['seasonalPricing'][0]) => {
    const state = get();
    const newResources = state.roomManagement.eventResources.map(r => 
      r.id === resourceId 
        ? { ...r, seasonalPricing: [...r.seasonalPricing, pricing] }
        : r
    );
    const newRoomManagement = { ...state.roomManagement, eventResources: newResources };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  updateEventResourceSeasonalPricing: (resourceId: string, pricingId: string, updates: Partial<RoomManagementSettings['eventResources'][0]['seasonalPricing'][0]>) => {
    const state = get();
    const newResources = state.roomManagement.eventResources.map(r => 
      r.id === resourceId 
        ? { 
            ...r, 
            seasonalPricing: r.seasonalPricing.map(sp => 
              sp.id === pricingId ? { ...sp, ...updates } : sp
            )
          }
        : r
    );
    const newRoomManagement = { ...state.roomManagement, eventResources: newResources };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  deleteEventResourceSeasonalPricing: (resourceId: string, pricingId: string) => {
    const state = get();
    const newResources = state.roomManagement.eventResources.map(r => 
      r.id === resourceId 
        ? { ...r, seasonalPricing: r.seasonalPricing.filter(sp => sp.id !== pricingId) }
        : r
    );
    const newRoomManagement = { ...state.roomManagement, eventResources: newResources };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },
  
  // NEW: Event Packages Management
  addEventPackage: (pkg: RoomManagementSettings['eventPackages'][0]) => {
    const state = get();
    const newPackages = [...state.roomManagement.eventPackages, pkg];
    const newRoomManagement = { ...state.roomManagement, eventPackages: newPackages };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  updateEventPackage: (id: string, updates: Partial<RoomManagementSettings['eventPackages'][0]>) => {
    const state = get();
    const newPackages = state.roomManagement.eventPackages.map(p => 
      p.id === id ? { ...p, ...updates } : p
    );
    const newRoomManagement = { ...state.roomManagement, eventPackages: newPackages };
    get().saveSettings();
    get().publish();
  },

  deleteEventPackage: (id: string) => {
    const state = get();
    const newPackages = state.roomManagement.eventPackages.filter(p => p.id !== id);
    const newRoomManagement = { ...state.roomManagement, eventPackages: newPackages };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  addEventPackageSeasonalPricing: (packageId: string, pricing: RoomManagementSettings['eventPackages'][0]['seasonalPricing'][0]) => {
    const state = get();
    const newPackages = state.roomManagement.eventPackages.map(p => 
      p.id === packageId 
        ? { ...p, seasonalPricing: [...p.seasonalPricing, pricing] }
        : p
    );
    const newRoomManagement = { ...state.roomManagement, eventPackages: newPackages };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  updateEventPackageSeasonalPricing: (packageId: string, pricingId: string, updates: Partial<RoomManagementSettings['eventPackages'][0]['seasonalPricing'][0]>) => {
    const state = get();
    const newPackages = state.roomManagement.eventPackages.map(p => 
      p.id === packageId 
        ? { 
            ...p, 
            seasonalPricing: p.seasonalPricing.map(sp => 
              sp.id === pricingId ? { ...sp, ...updates } : sp
            )
          }
        : p
    );
    const newRoomManagement = { ...state.roomManagement, eventPackages: newPackages };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  deleteEventPackageSeasonalPricing: (packageId: string, pricingId: string) => {
    const state = get();
    const newPackages = state.roomManagement.eventPackages.map(p => 
      p.id === packageId 
        ? { ...p, seasonalPricing: p.seasonalPricing.filter(sp => sp.id !== pricingId) }
        : p
    );
    const newRoomManagement = { ...state.roomManagement, eventPackages: newPackages };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },
  
  // Service Charges Management
  addServiceCharge: (charge: RoomManagementSettings['serviceCharges'][0]) => {
    const state = get();
    const newCharges = [...state.roomManagement.serviceCharges, charge];
    const newRoomManagement = { ...state.roomManagement, serviceCharges: newCharges };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  updateServiceCharge: (id: string, updates: Partial<RoomManagementSettings['serviceCharges'][0]>) => {
    const state = get();
    const newCharges = state.roomManagement.serviceCharges.map(c => 
      c.id === id ? { ...c, ...updates } : c
    );
    const newRoomManagement = { ...state.roomManagement, serviceCharges: newCharges };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  deleteServiceCharge: (id: string) => {
    const state = get();
    const newCharges = state.roomManagement.serviceCharges.filter(c => c.id !== id);
    const newRoomManagement = { ...state.roomManagement, serviceCharges: newCharges };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  addServiceChargeSeasonalPricing: (chargeId: string, pricing: RoomManagementSettings['serviceCharges'][0]['seasonalPricing'][0]) => {
    const state = get();
    const newCharges = state.roomManagement.serviceCharges.map(c => 
      c.id === chargeId 
        ? { ...c, seasonalPricing: [...c.seasonalPricing, pricing] }
        : c
    );
    const newRoomManagement = { ...state.roomManagement, serviceCharges: newCharges };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  updateServiceChargeSeasonalPricing: (chargeId: string, pricingId: string, updates: Partial<RoomManagementSettings['serviceCharges'][0]['seasonalPricing'][0]>) => {
    const state = get();
    const newCharges = state.roomManagement.serviceCharges.map(c => 
      c.id === chargeId 
        ? { 
            ...c, 
            seasonalPricing: c.seasonalPricing.map(sp => 
              sp.id === pricingId ? { ...sp, ...updates } : sp
            )
          }
        : c
    );
    const newRoomManagement = { ...state.roomManagement, serviceCharges: newCharges };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },

  deleteServiceChargeSeasonalPricing: (chargeId: string, pricingId: string) => {
    const state = get();
    const newCharges = state.roomManagement.serviceCharges.map(c => 
      c.id === chargeId 
        ? { ...c, seasonalPricing: c.seasonalPricing.filter(sp => sp.id !== pricingId) }
        : c
    );
    const newRoomManagement = { ...state.roomManagement, serviceCharges: newCharges };
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },
  
  // Template Management Methods
  addTemplate: (template: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const state = get();
    const newTemplate: DocumentTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newTemplates = [...state.documentTemplates.templates, newTemplate];
    const newDocumentTemplates = { ...state.documentTemplates, templates: newTemplates };
    set({ documentTemplates: newDocumentTemplates });
    get().saveSettings();
    get().publish();
  },

  updateTemplate: (id: string, updates: Partial<DocumentTemplate>) => {
    const state = get();
    const newTemplates = state.documentTemplates.templates.map(t => 
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    const newDocumentTemplates = { ...state.documentTemplates, templates: newTemplates };
    set({ documentTemplates: newDocumentTemplates });
    get().saveSettings();
    get().publish();
  },

  deleteTemplate: (id: string) => {
    const state = get();
    const newTemplates = state.documentTemplates.templates.filter(t => t.id !== id);
    const newDocumentTemplates = { ...state.documentTemplates, templates: newTemplates };
    set({ documentTemplates: newDocumentTemplates });
    get().saveSettings();
    get().publish();
  },

  activateTemplate: (id: string) => {
    const state = get();
    const newTemplates = state.documentTemplates.templates.map(t => ({
      ...t,
      isActive: t.id === id,
      updatedAt: new Date().toISOString()
    }));
    const newDocumentTemplates = { ...state.documentTemplates, templates: newTemplates };
    set({ documentTemplates: newDocumentTemplates });
    get().saveSettings();
    get().publish();
  },

  deactivateTemplate: (id: string) => {
    const state = get();
    const newTemplates = state.documentTemplates.templates.map(t => 
      t.id === id ? { ...t, isActive: false, updatedAt: new Date().toISOString() } : t
    );
    const newDocumentTemplates = { ...state.documentTemplates, templates: newTemplates };
    set({ documentTemplates: newDocumentTemplates });
    get().saveSettings();
    get().publish();
  },

  setDefaultTemplate: (documentType: string, templateId: string) => {
    const state = get();
    const newTemplates = state.documentTemplates.templates.map(t => ({
      ...t,
      isDefault: t.type === documentType && t.id === templateId,
      updatedAt: new Date().toISOString()
    }));
    const newDocumentTemplates = { ...state.documentTemplates, templates: newTemplates };
    set({ documentTemplates: newDocumentTemplates });
    get().saveSettings();
    get().publish();
  },

  getTemplate: (id: string) => {
    const state = get();
    return state.documentTemplates.templates.find(t => t.id === id);
  },

  getTemplatesByType: (type: DocumentTemplate['type']) => {
    const state = get();
    return state.documentTemplates.templates.filter(t => t.type === type);
  },

  getActiveTemplate: (documentType: string) => {
    const state = get();
    return state.documentTemplates.templates.find(t => t.type === documentType && t.isActive);
  },

  getDefaultTemplate: (documentType: string) => {
    const state = get();
    return state.documentTemplates.templates.find(t => t.type === documentType && t.isDefault);
  },
  
    // User Management
  addUser: (user) => {
    const state = get();
    const newUser: User = {
      ...user,
      id: `user_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      profile: {
        avatar: '',
        phone: '',
        address: '',
        department: '',
        position: '',
        employeeId: '',
        hireDate: '',
        emergencyContact: {
          name: '',
          phone: '',
          relationship: '',
        },
        bio: '',
        skills: [],
        certifications: [],
      },
      security: {
        failedLoginAttempts: 0,
        accountLocked: false,
        twoFactorEnabled: false,
      },
    };
    const newUsers = [...state.users, newUser];
    set({ users: newUsers });
    get().saveSettings();
    get().publish();
  },

  // Profile Management
  updateUserProfile: (userId: string, profileUpdates: Partial<User['profile']>) => {
    const state = get();
    const newUsers = state.users.map(user => 
      user.id === userId 
        ? { 
            ...user, 
            profile: { ...user.profile, ...profileUpdates },
            updatedAt: new Date().toISOString() 
          }
        : user
    );
    set({ users: newUsers });
    
    // Update current user if it's the same user
    if (state.currentUser?.id === userId) {
      const updatedCurrentUser = newUsers.find(u => u.id === userId);
      if (updatedCurrentUser) {
        set({ currentUser: updatedCurrentUser });
      }
    }
    
    get().saveSettings();
    get().publish();
  },

  updateUserPreferences: (userId: string, preferenceUpdates: Partial<UserPreferences>) => {
    const state = get();
    const newUsers = state.users.map(user => 
      user.id === userId 
        ? { 
            ...user, 
            preferences: { ...user.preferences, ...preferenceUpdates },
            updatedAt: new Date().toISOString() 
          }
        : user
    );
    set({ users: newUsers });
    
    // Update current user if it's the same user
    if (state.currentUser?.id === userId) {
      const updatedCurrentUser = newUsers.find(u => u.id === userId);
      if (updatedCurrentUser) {
        set({ currentUser: updatedCurrentUser });
      }
    }
    
    get().saveSettings();
    get().publish();
  },

  updateUserSecurity: (userId: string, securityUpdates: Partial<User['security']>) => {
    const state = get();
    const newUsers = state.users.map(user => 
      user.id === userId 
        ? { 
            ...user, 
            security: { ...user.security, ...securityUpdates },
            updatedAt: new Date().toISOString() 
          }
        : user
    );
    set({ users: newUsers });
    
    // Update current user if it's the same user
    if (state.currentUser?.id === userId) {
      const updatedCurrentUser = newUsers.find(u => u.id === userId);
      if (updatedCurrentUser) {
        set({ currentUser: updatedCurrentUser });
      }
    }
    
    get().saveSettings();
    get().publish();
  },

  changePassword: (userId: string, newPassword: string) => {
    const state = get();
    const newUsers = state.users.map(user => 
      user.id === userId 
        ? { 
            ...user, 
            security: { 
              ...user.security, 
              passwordLastChanged: new Date().toISOString(),
              passwordExpiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
              failedLoginAttempts: 0,
              accountLocked: false,
            },
            updatedAt: new Date().toISOString() 
          }
        : user
    );
    set({ users: newUsers });
    
    // Update current user if it's the same user
    if (state.currentUser?.id === userId) {
      const updatedCurrentUser = newUsers.find(u => u.id === userId);
      if (updatedCurrentUser) {
        set({ currentUser: updatedCurrentUser });
      }
    }
    
    get().saveSettings();
    get().publish();
  },
  
  updateUser: (userId, updates) => {
    const state = get();
    const newUsers = state.users.map(user => 
      user.id === userId 
        ? { ...user, ...updates, updatedAt: new Date().toISOString() }
        : user
    );
    set({ users: newUsers });
    get().saveSettings();
    get().publish();
  },
  
  deleteUser: (userId) => {
    const state = get();
    const newUsers = state.users.filter(user => user.id !== userId);
    set({ users: newUsers });
    get().saveSettings();
    get().publish();
  },
  
  setCurrentUser: (user) => {
    set({ currentUser: user });
    get().saveSettings();
    get().publish();
  },
  
  // Role Management
  addRole: (role) => {
    const state = get();
    const newRole: UserRole = {
      ...role,
      id: `role_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newRoles = [...state.roles, newRole];
    set({ roles: newRoles });
    get().saveSettings();
    get().publish();
  },
  
  updateRole: (roleId, updates) => {
    const state = get();
    const newRoles = state.roles.map(role => 
      role.id === roleId 
        ? { ...role, ...updates, updatedAt: new Date().toISOString() }
        : role
    );
    set({ roles: newRoles });
    get().saveSettings();
    get().publish();
  },
  
  deleteRole: (roleId) => {
    const state = get();
    const newRoles = state.roles.filter(role => role.id !== roleId);
    set({ roles: newRoles });
    get().saveSettings();
    get().publish();
  },
  
  // Authorization
  hasPermission: (permission) => {
    const state = get();
    if (!state.currentUser) return false;
    
    const userRole = state.roles.find(role => role.id === state.currentUser!.roleId);
    if (!userRole) return false;
    
    return userRole.permissions.includes('*') || userRole.permissions.includes(permission);
  },
  
  getUserPermissions: () => {
    const state = get();
    if (!state.currentUser) return [];
    
    const userRole = state.roles.find(role => role.id === state.currentUser!.roleId);
    return userRole?.permissions || [];
  },
  
  subscribe: (callback) => {
    get().subscribers.add(callback);
    return () => {
      get().subscribers.delete(callback);
    };
  },
  
  publish: () => {
    get().subscribers.forEach(callback => callback());
  },
  
  // Business Entity Settings Management
  updateInvoiceSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.invoiceSettings, ...settings };
    set({ invoiceSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateReceiptSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.receiptSettings, ...settings };
    set({ receiptSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updatePurchaseOrderSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.purchaseOrderSettings, ...settings };
    set({ purchaseOrderSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateProformaInvoiceSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.proformaInvoiceSettings, ...settings };
    set({ proformaInvoiceSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },

  updateReservationSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.reservationSettings, ...settings } as any;
    set({ reservationSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateItemSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.itemSettings, ...settings };
    set({ itemSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateClientSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.clientSettings, ...settings };
    set({ clientSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateDocumentTemplates: (settings) => {
    const state = get();
    const updatedSettings = { ...state.documentTemplates, ...settings };
    set({ documentTemplates: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  // Document Number Generation
  getNextInvoiceNumber: () => {
    const state = get();
    const settings = state.invoiceSettings;
    const year = new Date().getFullYear();
    const number = settings.nextNumber;
    
    // Update the next number
    state.updateInvoiceSettings({ nextNumber: number + 1 });
    
    // Format the number according to the pattern
    return settings.numberFormat
      .replace('{YEAR}', year.toString())
      .replace('{NUMBER}', number.toString().padStart(4, '0'));
  },
  
  getNextReceiptNumber: () => {
    const state = get();
    const settings = state.receiptSettings;
    // Receipts typically don't have sequential numbering, but we can implement if needed
    return `RCP-${Date.now().toString().slice(-6)}`;
  },
  
  getNextPurchaseOrderNumber: () => {
    const state = get();
    const settings = state.purchaseOrderSettings;
    const year = new Date().getFullYear();
    const number = settings.nextNumber;
    
    // Update the next number
    state.updatePurchaseOrderSettings({ nextNumber: number + 1 });
    
    // Format the number according to the pattern
    return settings.numberFormat
      .replace('{YEAR}', year.toString())
      .replace('{NUMBER}', number.toString().padStart(4, '0'));
  },
  
  getNextProformaInvoiceNumber: () => {
    const state = get();
    const settings = state.proformaInvoiceSettings;
    const year = new Date().getFullYear();
    const number = settings.nextNumber;
    
    // Update the next number
    state.updateProformaInvoiceSettings({ nextNumber: number + 1 });
    
    // Format the number according to the pattern
    return settings.numberFormat
      .replace('{YEAR}', year.toString())
      .replace('{NUMBER}', number.toString().padStart(4, '0'));
  },
  
  getNextClientNumber: () => {
    const state = get();
    const settings = state.clientSettings;
    const number = settings.nextNumber;
    
    // Update the next number
    state.updateClientSettings({ nextNumber: number + 1 });
    
    // Format the number according to the pattern
    return settings.numberFormat
      .replace('{NUMBER}', number.toString().padStart(3, '0'));
  },

  getNextReservationNumber: () => {
    const state = get();
    const settings = state.reservationSettings;
    const year = new Date().getFullYear();
    const number = settings.nextNumber;
    state.updateReservationSettings({ nextNumber: number + 1 });
    return settings.numberFormat
      .replace('{YEAR}', year.toString())
      .replace('{NUMBER}', number.toString().padStart(5, '0'));
  },
  
  // Additional Settings Management Methods
  updateSystemPreferences: (settings) => {
    const state = get();
    const updatedSettings = { ...state.systemPreferences, ...settings };
    set({ systemPreferences: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateHotelSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.hotelSettings, ...settings };
    set({ hotelSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateRoomSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.roomSettings, ...settings };
    set({ roomSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateFinancialSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.financialSettings, ...settings };
    set({ financialSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateCommunicationSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.communicationSettings, ...settings };
    set({ communicationSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateReportingSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.reportingSettings, ...settings };
    set({ reportingSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateMaintenanceSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.maintenanceSettings, ...settings };
    set({ maintenanceSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateInventorySettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.inventorySettings, ...settings };
    set({ inventorySettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateStaffSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.staffSettings, ...settings };
    set({ staffSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateGuestServicesSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.guestServicesSettings, ...settings };
    set({ guestServicesSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateComplianceSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.complianceSettings, ...settings };
    set({ complianceSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },
  
  updateSaasSettings: (settings) => {
    const state = get();
    const updatedSettings = { ...state.saasSettings, ...settings };
    set({ saasSettings: updatedSettings });
    get().saveSettings();
    get().publish();
  },

  // Module Settings (SaaS)
  moduleSettings: {
    frontOffice: true, // Core module - always enabled
    housekeeping: true,
    foodBeverage: true,
    inventory: true,
    accounting: true,
    hr: true,
    security: true,
    compliance: true,
    maintenance: true,
    analytics: true,
  },
  
  // Room Management - Clean Slate Configuration
  // All sample data has been removed. Configure your rooms from scratch.
  roomManagement: {
    roomNumberingFormat: 'sequential',
    floorSeparator: '-',
    roomTypes: [],
    rooms: [],
    roomStatuses: [],
    ratePlans: [],
    statusChangeRules: [],
    housekeepingEnabled: false,
    cleaningSchedules: {
      dailyCleaning: false,
      turnoverCleaning: false,
      deepCleaning: false,
      maintenanceCleaning: false,
    },
    maintenanceEnabled: false,
    maintenanceCategories: [],
    autoOOOSetup: false,
    assignmentRules: {
      allowOverbooking: false,
      maxOverbookingPercentage: 0,
      priorityRooms: [],
      restrictedRooms: [],
    },
    // NEW: Event Resources & Packages
    eventResources: [],
    eventPackages: [],
    
    // Service Charges Management
    serviceCharges: [
      {
        id: 'swimming-pool',
        name: 'Swimming Pool Access',
        category: 'Recreation',
        icon: '🏊',
        basePrice: 50.00,
        isActive: true,
        description: 'Daily access to swimming pool facilities',
        requiresApproval: false,
        maxDiscountPercent: 20,
        taxIncluded: true,
        unit: 'per_person',
        seasonalPricing: []
      },
      {
        id: 'laundry-service',
        name: 'Laundry Service',
        category: 'Housekeeping',
        icon: '👕',
        basePrice: 25.00,
        isActive: true,
        description: 'Professional laundry and dry cleaning service',
        requiresApproval: false,
        maxDiscountPercent: 15,
        taxIncluded: true,
        unit: 'per_item',
        seasonalPricing: []
      },
      {
        id: 'room-service',
        name: 'Room Service',
        category: 'Food & Beverage',
        icon: '🍽️',
        basePrice: 15.00,
        isActive: true,
        description: 'In-room dining service charge',
        requiresApproval: false,
        maxDiscountPercent: 10,
        taxIncluded: true,
        unit: 'per_order',
        seasonalPricing: []
      },
      {
        id: 'spa-services',
        name: 'Spa & Wellness',
        category: 'Wellness',
        icon: '🧘',
        basePrice: 120.00,
        isActive: true,
        description: 'Spa treatments and wellness services',
        requiresApproval: true,
        maxDiscountPercent: 25,
        taxIncluded: true,
        unit: 'per_session',
        seasonalPricing: []
      },
      {
        id: 'conference-room',
        name: 'Conference Room Rental',
        category: 'Business',
        icon: '🏢',
        basePrice: 200.00,
        isActive: true,
        description: 'Conference room and meeting facilities',
        requiresApproval: true,
        maxDiscountPercent: 30,
        taxIncluded: true,
        unit: 'per_hour',
        seasonalPricing: []
      },
      {
        id: 'airport-transfer',
        name: 'Airport Transfer',
        category: 'Transportation',
        icon: '✈️',
        basePrice: 80.00,
        isActive: true,
        description: 'Airport pickup and drop-off service',
        requiresApproval: false,
        maxDiscountPercent: 15,
        taxIncluded: true,
        unit: 'per_trip',
        seasonalPricing: []
      }
    ]
  }
}));

// Initialize settings on store creation
if (typeof window !== 'undefined') {
  useSettingsStore.getState().loadSettings();
}
