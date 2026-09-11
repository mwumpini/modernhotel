'use client';

import { create } from 'zustand';
import { getClientTenantSubdomain } from '../api/clientTenant';
import type { BlockTemplate } from '../print/blocks';
import type { PrintType } from '../print/templates';

// Best-effort background sync of just the no-show policy fields to the server
// (see /api/settings/room-management) so server-side jobs like the night-audit
// cron can apply the same policy configured here — the rest of roomManagement
// stays client-only for now.
function syncNoShowPolicyToApi(rm: { noShowPolicyEnabled?: boolean; noShowChargeType?: string; noShowChargeValue?: number }) {
  if (typeof window === 'undefined') return;
  const t = getClientTenantSubdomain();
  if (!t) return;
  fetch('/api/settings/room-management', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-subdomain': t },
    body: JSON.stringify({
      noShowPolicyEnabled: rm.noShowPolicyEnabled,
      noShowChargeType: rm.noShowChargeType,
      noShowChargeValue: rm.noShowChargeValue,
    }),
  }).catch((e) => console.warn('[Settings] Failed to sync no-show policy:', e));
}

// Background sync of a Role to the server-side mirror (see /api/settings/roles)
// so API routes can actually enforce permissions via requirePermission() in
// auth-guard.ts, instead of the permission catalog existing only in this
// browser's localStorage. Fire-and-forget: the Settings UI's own state is
// already updated synchronously by the caller before this runs.
function syncRoleToApi(role: { id: string; name: string; description?: string; permissions: string[]; isActive: boolean }) {
  if (typeof window === 'undefined') return;
  const t = getClientTenantSubdomain();
  if (!t) return;
  fetch('/api/settings/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-subdomain': t },
    body: JSON.stringify({
      code: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isActive: role.isActive,
    }),
  }).catch((e) => console.warn('[Settings] Failed to sync role:', e));
}

function deleteRoleFromApi(roleId: string) {
  if (typeof window === 'undefined') return;
  const t = getClientTenantSubdomain();
  if (!t) return;
  fetch(`/api/settings/roles/${encodeURIComponent(roleId)}`, {
    method: 'DELETE',
    headers: { 'x-tenant-subdomain': t },
  }).catch((e) => console.warn('[Settings] Failed to delete role:', e));
}

// Deletes the real account behind a Settings > User Management row, if there
// is one (see /api/users — GET is what merges real accounts into `users` on
// load in the first place; ids that don't correspond to a real account, like
// this file's own local demo defaults, just 404 harmlessly here). The server
// independently re-checks settings.delete and refuses to delete the caller's
// own account or the tenant's last administrator, so this can't be bypassed
// by a stale/hidden Delete button either.
async function deleteUserFromApi(userId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const t = getClientTenantSubdomain();
  if (!t) return null;
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { 'x-tenant-subdomain': t },
    });
    if (res.ok) return null;
    if (res.status === 404) return null; // not a real account — nothing to reject
    const data = await res.json().catch(() => null);
    return data?.error || 'Failed to delete user';
  } catch (e) {
    console.warn('[Settings] Failed to delete user:', e);
    return 'Failed to delete user';
  }
}

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
  // Purpose-driven usage (activity/flow): e.g., 'checkout', 'conference', 'restaurant', 'accommodation', 'folio', 'quotation'
  purpose?: string;
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
  // Numbering
  prefix?: string;
  suffix?: string;
  nextNumber?: number;
  numberFormat?: string;
  
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

// Generic numbering pattern used across modules
export interface NumberingPattern {
  prefix: string;
  suffix?: string;
  nextNumber: number;
  numberFormat: string;
}

// System-wide, module-scoped numbering settings
export interface ModuleNumberingSettings {
  frontOffice: {
    folio: NumberingPattern;
    housekeepingTicket: NumberingPattern;
  };
  foodBeverage: {
    order: NumberingPattern;
    kitchenOrderTicket: NumberingPattern;
  };
  inventory: {
    requisition: NumberingPattern;
    stockTransfer: NumberingPattern;
    goodsReceipt: NumberingPattern;
  };
  accounting: {
    creditNote: NumberingPattern;
    debitNote: NumberingPattern;
  };
  events: {
    eventBooking: NumberingPattern;
    quotation: NumberingPattern;
  };
  maintenance: {
    workOrder: NumberingPattern;
    inspection: NumberingPattern;
  };
  security: {
    incidentReport: NumberingPattern;
    accessPass: NumberingPattern;
  };
  hr: {
    employeeId: NumberingPattern;
    timesheet: NumberingPattern;
  };
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
  // Initial setup
  initialSetupCompleted?: boolean;

  // Company Settings
  companySettings?: {
    legalName: string;
    tradingName: string;
    tagline?: string;
    registrationNumber?: string;
    taxId?: string; // TIN/VAT
    logoUrl?: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state?: string;
      postalCode?: string;
      country: string;
    };
    contact: {
      phone: string;
      email: string;
      website?: string;
    };
    defaultCurrency: string;
    financialYearStartDate: string; // ISO (YYYY-MM-DD)
    addressFormatTemplate: string; // e.g., "{line1}\n{city}, {country}"
    priceDisplayFormat: 'symbol' | 'code' | 'both';
    defaultTaxScheme?: string; // e.g., Ghana Standard
    baseCurrencyLocked: boolean;
    roundingRule: 'nearest' | 'up' | 'down';
  };
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
  sessionRoleId: string | null;

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
  
  // System-wide Numbering grouped by modules
  moduleNumbering: ModuleNumberingSettings;
  
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
    hotelName?: string;
    classification?: '1-Star' | '2-Star' | '3-Star' | '4-Star' | '5-Star' | 'Boutique' | 'Aparthotel' | 'Resort' | 'Other';
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
    roundingRule?: 'nearest' | 'up' | 'down';
    priceDisplayFormat?: 'symbol' | 'code' | 'both';
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
    logoPosition?: 'left' | 'center' | 'right';
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
  
  // Default Rate Plan mapping per Room Type (roomTypeId -> ratePlanId)
  defaultRatePlanByRoomType?: Record<string, string>;
  
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

  // Checkout policy: who can use Pay Later
  payLaterPolicy?: 'both' | 'corporate' | 'individual';
  // Operations Policies
  requireCorporateReference?: boolean;
  defaultCreditTermsDays?: number;
  lateCheckoutFeeEnabled?: boolean;
  lateCheckoutGraceMinutes?: number;
  lateCheckoutFeeType?: 'flat' | 'percent_of_nightly';
  lateCheckoutFeeValue?: number;
  earlyCheckoutPolicyEnabled?: boolean;
  earlyCheckoutRefundType?: 'none' | 'nightly_prorate' | 'percent_penalty';
  earlyCheckoutPenaltyPercent?: number; // applies when refundType is percent_penalty
  earlyCheckoutCutoffHour?: number; // e.g., 11 means 11:00 local time same-day rule
  earlyCheckoutAdvancedEnabled?: boolean;

  // Standard times
  standardCheckInHour?: number; // 0-23
  standardCheckOutHour?: number; // 0-23

  // No-Show Policy
  noShowPolicyEnabled?: boolean;
  noShowChargeType?: 'first_night' | 'percent_reservation' | 'flat';
  noShowChargeValue?: number;
  noShowCutoffHour?: number; // hour after scheduled arrival to mark no-show

  /** Post first night room charge at check-in (default false — night audit posts nightly). */
  postFirstNightAtCheckin?: boolean;
  /** Auto-run night audit at 1:00am (default true). */
  nightAuditAutoRun?: boolean;

  // Cancellation Policy
  cancellationPolicyEnabled?: boolean;
  freeCancellationHours?: number; // hours before arrival
  lateCancellationFeeType?: 'first_night' | 'percent_reservation' | 'flat';
  lateCancellationFeeValue?: number;

  // Deposit/Guarantee Policy
  depositPolicyEnabled?: boolean;
  depositType?: 'percent' | 'flat';
  depositValue?: number;
  requireDepositToConfirm?: boolean;

  // Invoicing reminders
  invoiceReminderScheduleDays?: number[]; // e.g., [7,14,30]
  
  // Rate Plans
  ratePlans: Array<{
    id: string;
    name: string;
    roomTypeId: string;
    basePrice: number;
    isActive: boolean;
    marketSegment: string;
    /** What's included in the nightly rate — drives the Guest Count & Meal Plan Report. */
    mealPlan?: 'room_only' | 'bed_breakfast' | 'half_board' | 'full_board';

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

export interface DocBuilderSettings {
  templates: BlockTemplate[];
}

interface SettingsStore extends SystemSettings {
  // Printing defaults (house style) — value is a legacy printTemplates key, or a
  // docBuilder custom template id (prefixed 'custom-', never collides with legacy keys).
  printing: {
    receipt: string; invoice: string; proforma: string; 'payment-voucher': string;
    'accommodation-proforma': string; 'accommodation-invoice': string; 'accommodation-receipt': string;
    'event-proforma': string; 'event-invoice': string; 'event-receipt': string;
    'registration-card': string;
    payslip: string;
  };
  // No-code document template builder — tenant-created templates, all document types.
  docBuilder: DocBuilderSettings;
  addDocBuilderTemplate: (template: BlockTemplate) => void;
  updateDocBuilderTemplate: (id: string, updates: Partial<BlockTemplate>) => void;
  deleteDocBuilderTemplate: (id: string) => void;
  getDocBuilderTemplate: (id: string) => BlockTemplate | undefined;
  getDocBuilderTemplatesByType: (docType: PrintType) => BlockTemplate[];
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
  /** Resolves to an error message if the server refused the delete (see /api/users/[id]), null on success. */
  deleteUser: (userId: string) => Promise<string | null>;
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
  /** Raises a numbering series' nextNumber to stay ahead of IDs that already exist
   *  (e.g. pulled from the server on hydration) — never lowers it. These counters
   *  only ever live in this browser's localStorage, so a second browser/session/
   *  storage reset can otherwise hand out a number already used elsewhere. */
  reconcileNumberFloor: (series: 'reservation' | 'client' | 'invoice', existingIds: (string | undefined)[]) => void;
  /** Generic generator for any of the 16 moduleNumbering series (folio, KOT, requisition,
   *  work order, incident report, employee ID, etc.) — the single source every real call
   *  site should use instead of minting its own Date.now()/array-length-based id. */
  getNextModuleNumber: <C extends keyof ModuleNumberingSettings>(
    category: C,
    series: keyof ModuleNumberingSettings[C]
  ) => string;
  /** Read-only preview of what getNextModuleNumber would return, without consuming the counter. */
  peekNextModuleNumber: <C extends keyof ModuleNumberingSettings>(
    category: C,
    series: keyof ModuleNumberingSettings[C]
  ) => string;

  // Authorization
  /** setSessionRole syncs sessionRoleId (declared on SystemSettings) from the NextAuth session — e.g. 'admin', 'manager', 'staff', 'night_manager'. */
  setSessionRole: (roleId: string | null) => void;
  hasPermission: (permission: string) => boolean;
  /** True if the current role holds '*', '<modulePrefix>.*', or any '<modulePrefix>.xxx' leaf permission — used for nav-level module gating. */
  hasModuleAccess: (modulePrefix: string) => boolean;
  getUserPermissions: () => string[];
  
  // Subscribers
  subscribers: Set<() => void>;
  subscribe: (callback: () => void) => () => void;
  publish: () => void;

  /** True once loadSettings() has run at least once this page load. Module-scope
   *  singletons (e.g. frontOfficeStore) construct — and can trigger a save — before
   *  the useEffect that hydrates this store from localStorage ever runs; saving that
   *  early would persist still-default state over whatever was really saved last
   *  time. saveSettings() no-ops until this flips true. */
  hydrated: boolean;

  // Printing defaults management
  updatePrintingTemplates: (tpl: Partial<SettingsStore['printing']>) => void;

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
    vat: 15,
    nhil: 2.5,
    getfundLevy: 2.5,
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

/** Shared formatter for every document-numbering series in the app — substitutes
 *  {YEAR}/{NUMBER}/{PREFIX}/{SUFFIX} tokens so editing a series' Prefix/Suffix field in
 *  Settings actually changes the numbers it produces, not just its Format field. */
function formatDocumentNumber(
  pattern: { prefix?: string; suffix?: string; nextNumber: number; numberFormat: string },
  padLength = 4
): string {
  const year = new Date().getFullYear();
  const padded = pattern.nextNumber.toString().padStart(padLength, '0');
  return (pattern.numberFormat || '{PREFIX}-{NUMBER}')
    .replace('{YEAR}', year.toString())
    .replace('{NUMBER}', padded)
    .replace('{PREFIX}', pattern.prefix || '')
    .replace('{SUFFIX}', pattern.suffix || '');
}

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
      'events-conferences.*',
      'housekeeping.*',
      'f&b.*',
      'inventory.*',
      'security.*',
      'hr.*',
      'accounting.*',
      'compliance.*',
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
  {
    id: 'night_manager',
    name: 'Night Manager',
    description: 'Night audit and end-of-day front office operations',
    permissions: [
      'dashboard.view',
      'frontdesk.*',
      'housekeeping.view',
      'f&b.*',
      'reports.view',
      'settings.view',
    ],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const defaultSettings: SystemSettings = {
  initialSetupCompleted: false,

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
    },
    {
      id: 'night_mgr_001',
      username: 'nightmgr',
      email: 'night@demohotel.com',
      firstName: 'Night',
      lastName: 'Manager',
      roleId: 'night_manager',
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
        notifications: { email: true, push: true, sms: false, sound: true },
        dashboard: {
          defaultView: 'overview',
          quickActions: ['check-in', 'night-audit', 'reports'],
          widgets: ['recent-activity', 'notifications'],
        },
        accessibility: { fontSize: 'medium', highContrast: false, reduceMotion: false },
      },
      profile: {
        phone: '+233 30 555 0101',
        address: 'Accra, Ghana',
        department: 'Front Office',
        position: 'Night Manager',
        employeeId: 'EMP-NM01',
        hireDate: '2024-01-01',
      },
      security: {
        passwordLastChanged: new Date().toISOString(),
        failedLoginAttempts: 0,
        accountLocked: false,
        twoFactorEnabled: false,
      },
    },
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
  sessionRoleId: null,

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
    numberFormat: '{PREFIX}-{YEAR}-{NUMBER}',
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
    prefix: 'RCP',
    suffix: '',
    nextNumber: 1,
    numberFormat: '{PREFIX}-{YEAR}-{NUMBER}',
    businessName: 'Demo Hotel Ltd',
    tagline: 'Excellence in Hospitality',
    showTaxBreakdown: true,
    showPaymentMethod: true,
    showCashierName: true,
    showTransactionId: true,
    footerText: 'Thank you for choosing us. Visit again soon!',
    socialMedia: ['Facebook', 'Instagram', 'Twitter'],
    website: 'www.demohotel.com',
    primaryColor: '#059669',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
  },
  
  purchaseOrderSettings: {
    prefix: 'PO',
    suffix: '',
    nextNumber: 1001,
    numberFormat: '{PREFIX}-{YEAR}-{NUMBER}',
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
    numberFormat: '{PREFIX}-{YEAR}-{NUMBER}',
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
    numberFormat: '{PREFIX}{NUMBER}',
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
    numberFormat: '{PREFIX}-{YEAR}-{NUMBER}'
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

  // Module-scoped numbering defaults (additional to existing invoice/receipt/reservation/client)
  moduleNumbering: {
    frontOffice: {
      folio: { prefix: 'FOL', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
      housekeepingTicket: { prefix: 'HK', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
    },
    foodBeverage: {
      order: { prefix: 'ORD', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
      kitchenOrderTicket: { prefix: 'KOT', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
    },
    inventory: {
      requisition: { prefix: 'REQ', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
      stockTransfer: { prefix: 'ST', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
      goodsReceipt: { prefix: 'GRN', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
    },
    accounting: {
      creditNote: { prefix: 'CN', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
      debitNote: { prefix: 'DN', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
    },
    events: {
      eventBooking: { prefix: 'EVT', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
      quotation: { prefix: 'QT', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
    },
    maintenance: {
      workOrder: { prefix: 'WO', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
      inspection: { prefix: 'INSP', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
    },
    security: {
      incidentReport: { prefix: 'INC', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
      accessPass: { prefix: 'PASS', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{NUMBER}' },
    },
    hr: {
      employeeId: { prefix: 'EMP', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}{NUMBER}' },
      timesheet: { prefix: 'TS', suffix: '', nextNumber: 1, numberFormat: '{PREFIX}-{YEAR}-{NUMBER}' },
    },
  },

  // Operations Policies
  // (stored separately via updateNestedSetting; kept here for backward compatibility no-op)
  
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
    hotelName: 'Demo Hotel',
    classification: '3-Star',
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
    roundingRule: 'nearest',
    priceDisplayFormat: 'symbol',
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
      companyName: 'Demo Hotel Ltd',
      supportEmail: 'support@ghana-hotel.com',
      supportPhone: '+233 20 123 4567',
      logoPosition: 'left',
    },
  },

  // Company Settings (new)
  companySettings: {
    legalName: 'Demo Hotel Ltd',
    tradingName: 'Demo Hotel',
    tagline: '',
    registrationNumber: '',
    taxId: '',
    logoUrl: '',
    address: {
      line1: 'Accra',
      city: 'Accra',
      country: 'GH',
    },
    contact: {
      phone: '+233 20 123 4567',
      email: 'info@demohotel.com',
      website: 'www.demohotel.com',
    },
    defaultCurrency: 'GHS',
    financialYearStartDate: '2025-01-01',
    addressFormatTemplate: '{line1}\n{city}, {country}',
    priceDisplayFormat: 'symbol',
    defaultTaxScheme: 'Ghana Standard',
    baseCurrencyLocked: false,
    roundingRule: 'nearest',
  },
};

const DEFAULT_PRINTING: SettingsStore['printing'] = {
  receipt: 'simple-receipt', invoice: 'corporate-invoice', proforma: 'conference-proforma-grid', 'payment-voucher': '',
  'accommodation-proforma': 'builtin-accommodation-proforma-standard',
  'accommodation-invoice': 'builtin-accommodation-invoice-standard',
  'accommodation-receipt': 'builtin-accommodation-receipt-standard',
  'event-proforma': 'builtin-event-proforma-daily-schedule',
  'event-invoice': 'builtin-event-invoice-standard',
  'event-receipt': 'builtin-event-receipt-standard',
  'registration-card': 'builtin-registration-card-standard',
  payslip: 'builtin-payslip-grid',
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...defaultSettings,
  subscribers: new Set(),
  hydrated: false,
  printing: DEFAULT_PRINTING,
  docBuilder: { templates: [] },
  addDocBuilderTemplate: (template) => {
    set(state => ({ docBuilder: { ...state.docBuilder, templates: [...state.docBuilder.templates, template] } }));
    get().saveSettings();
  },
  updateDocBuilderTemplate: (id, updates) => {
    set(state => ({
      docBuilder: {
        ...state.docBuilder,
        templates: state.docBuilder.templates.map(t =>
          t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
        ),
      },
    }));
    get().saveSettings();
  },
  deleteDocBuilderTemplate: (id) => {
    set(state => ({ docBuilder: { ...state.docBuilder, templates: state.docBuilder.templates.filter(t => t.id !== id) } }));
    get().saveSettings();
  },
  getDocBuilderTemplate: (id) => get().docBuilder.templates.find(t => t.id === id),
  getDocBuilderTemplatesByType: (docType) => get().docBuilder.templates.filter(t => t.docType === docType),

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
        // Defensive: strip `subscribers` even if it's present in already-persisted data
        // from before saveSettings() excluded it — a raw merge here would otherwise
        // replace the real Set with whatever JSON.stringify turned it into (`{}`),
        // permanently breaking publish() until the browser's storage is cleared.
        delete (parsed as any).subscribers;
        set(parsed);

        // Self-heal: `set(parsed)` above replaces `printing` wholesale (Zustand's
        // `set` only shallow-merges at the top level), so a settings save made
        // before the accommodation-*/event-* document types existed would resolve
        // those keys to undefined instead of falling back to a working built-in.
        if (parsed.printing) {
          set(state => ({ printing: { ...DEFAULT_PRINTING, ...state.printing } }));
        }
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
      
      // Load users and roles. Falls back to the seeded defaults both when the key is
      // missing AND when it parses to an empty array — a browser that hit the old
      // `: []` fallback (instead of `: defaultSettings.users`) on its very first load
      // would have since persisted that empty array back via saveSettings(), so a
      // present-but-empty "system.users" is itself a symptom of the bug this fixes,
      // not a real "admin deleted every user" state.
      const storedUsers = localStorage.getItem('system.users') ? JSON.parse(localStorage.getItem('system.users')!) : [];
      const users = storedUsers.length > 0 ? storedUsers : defaultSettings.users;
      const roles = localStorage.getItem('system.roles') ? JSON.parse(localStorage.getItem('system.roles')!) : defaultRoles;
      set({ users, roles });
      
      // Load current user — unlike users/roles above, deliberately don't fall back to
      // `undefined` when nothing's stored yet (every fresh browser, before this tenant
      // ever saves one). hasModuleAccess() treats a missing currentUser.roleId as "no
      // access to anything," so overwriting the safe hardcoded admin default here blanks
      // out the entire nav sidebar for every first-time visitor until a real session
      // role loads. Leaving the existing value alone when there's nothing to restore
      // keeps that default intact.
      const storedCurrentUser = localStorage.getItem('system.currentUser');
      if (storedCurrentUser) {
        set({ currentUser: JSON.parse(storedCurrentUser) });
      }

      // Pull the server's no-show policy (the one slice of roomManagement that's
      // also read server-side, by the night-audit cron) so it's authoritative
      // across devices/browsers rather than only ever reflecting this browser's
      // localStorage.
      const t = typeof window !== 'undefined' ? getClientTenantSubdomain() : '';
      if (t) {
        fetch('/api/settings/room-management', { headers: { 'x-tenant-subdomain': t } })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.policy) {
              set({ roomManagement: { ...get().roomManagement, ...data.policy } });
            }
          })
          .catch((e) => console.warn('[Settings] Failed to hydrate no-show policy:', e));

        // Pull the server-side Role mirror (see /api/settings/roles) so API routes'
        // requirePermission() checks and this browser's role editor stay in sync —
        // merge by id (server `code` <-> client UserRole.id) rather than replacing
        // wholesale, so a role created in this tab moments ago isn't dropped if the
        // GET resolves before its own POST finishes.
        fetch('/api/settings/roles', { headers: { 'x-tenant-subdomain': t } })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!Array.isArray(data?.roles)) return;
            const byId = new Map(get().roles.map((r) => [r.id, r]));
            for (const r of data.roles) {
              byId.set(r.code, {
                id: r.code,
                name: r.name,
                description: r.description || '',
                permissions: Array.isArray(r.permissions) ? r.permissions : [],
                isActive: r.isActive,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
              });
            }
            set({ roles: Array.from(byId.values()) });
          })
          .catch((e) => console.warn('[Settings] Failed to hydrate roles:', e));

        // Pull the real, NextAuth-authenticated accounts (see /api/users) and
        // replace this file's local demo `users` entirely — those ids ('admin_001'
        // etc.) never correspond to a real account, so once real ones are
        // available they're the only list worth showing (and the only one
        // Delete can act on for real — see deleteUserFromApi above).
        fetch('/api/users', { headers: { 'x-tenant-subdomain': t } })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!Array.isArray(data?.users) || data.users.length === 0) return;
            const mapped: User[] = data.users.map((u: any) => {
              const [firstName, ...rest] = String(u.name || u.email).split(' ');
              return {
                id: u.id,
                username: u.email,
                email: u.email,
                firstName: firstName || u.email,
                lastName: rest.join(' '),
                roleId: u.role,
                isActive: u.isActive,
                lastLogin: u.lastLoginAt || undefined,
                createdAt: u.createdAt,
                updatedAt: u.updatedAt,
                preferences: defaultSettings.users[0].preferences,
                profile: { avatar: '', phone: '', address: '', department: '', position: '', employeeId: '' },
                security: {
                  failedLoginAttempts: 0,
                  accountLocked: false,
                  twoFactorEnabled: false,
                },
              };
            });
            set({ users: mapped });
          })
          .catch((e) => console.warn('[Settings] Failed to hydrate users:', e));
      }

    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      set({ hydrated: true });
    }
  },

  saveSettings: () => {
    if (typeof window === 'undefined') return;
    // Guard against saving before loadSettings() has run at least once this page
    // load (see the `hydrated` field doc comment) — a save this early would
    // persist still-default state over whatever was really saved last time.
    // Anything mutated in memory before hydration gets replaced wholesale by
    // loadSettings()'s set(parsed) the moment it does run, so skipping the write
    // here loses nothing real.
    if (!get().hydrated) return;
    try {
      const state = get();

      // Persist every data field except the handful saved separately under their own keys
      // below (avoids duplicating them) — action functions don't need to be excluded by
      // name since JSON.stringify silently drops function-valued properties. This used to
      // be a hand-picked whitelist of ~14 fields that silently left ~20 other settings
      // sections (invoice/PO/proforma numbering, document templates, printing defaults,
      // module toggles, systemPreferences, and more) never actually written to storage —
      // every `update*` action for those appeared to succeed but the change was lost on
      // the next reload. Serializing everything else here means a new settings field never
      // has to be remembered to add to this list again.
      //
      // `subscribers` is the one field that DOES need excluding by name: unlike a function,
      // a Set doesn't vanish under JSON.stringify — it serializes as `{}` (no own enumerable
      // keys). loadSettings() then does a raw `set(parsed)`, so that `{}` overwrote the real
      // Set on next load, and every later `publish()` crashed with
      // "subscribers.forEach is not a function" — silently breaking any action that
      // publishes after saving (e.g. creating a reservation).
      const {
        roomManagement, posSettings, countryCompliance, users, roles, currentUser, sessionRoleId, subscribers,
        ...rest
      } = state as any;
      localStorage.setItem('system.settings', JSON.stringify(rest));

      // Save room management settings
      localStorage.setItem('room.management', JSON.stringify(state.roomManagement));
      syncNoShowPolicyToApi(state.roomManagement);

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

  // Room Management - Default Rate Plan Mapping Helpers
  setDefaultRatePlanForRoomType: (roomTypeId: string, ratePlanId: string) => {
    const state = get();
    const existing = state.roomManagement.defaultRatePlanByRoomType || {};
    const updated = { ...existing, [roomTypeId]: ratePlanId };
    const newRoomManagement = { ...state.roomManagement, defaultRatePlanByRoomType: updated } as RoomManagementSettings;
    set({ roomManagement: newRoomManagement });
    get().saveSettings();
    get().publish();
  },
  getDefaultRatePlanForRoomType: (roomTypeId: string) => {
    const state = get();
    return (state.roomManagement.defaultRatePlanByRoomType || {})[roomTypeId];
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
  
  deleteUser: async (userId) => {
    const error = await deleteUserFromApi(userId);
    if (error) return error;
    const state = get();
    const newUsers = state.users.filter(user => user.id !== userId);
    set({ users: newUsers });
    get().saveSettings();
    get().publish();
    return null;
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
    syncRoleToApi(newRole);
  },

  updateRole: (roleId, updates) => {
    const state = get();
    let updated: UserRole | undefined;
    const newRoles = state.roles.map(role => {
      if (role.id !== roleId) return role;
      updated = { ...role, ...updates, updatedAt: new Date().toISOString() };
      return updated;
    });
    set({ roles: newRoles });
    get().saveSettings();
    get().publish();
    if (updated) syncRoleToApi(updated);
  },

  deleteRole: (roleId) => {
    const state = get();
    const newRoles = state.roles.filter(role => role.id !== roleId);
    set({ roles: newRoles });
    get().saveSettings();
    get().publish();
    deleteRoleFromApi(roleId);
  },
  
  // Authorization
  setSessionRole: (roleId) => {
    set({ sessionRoleId: roleId });
  },

  hasPermission: (permission) => {
    const state = get();
    const roleId = state.sessionRoleId ?? state.currentUser?.roleId;
    if (!roleId) return false;

    const userRole = state.roles.find(role => role.id === roleId);
    if (!userRole || !userRole.isActive) return false;

    return userRole.permissions.some(granted => {
      if (granted === '*' || granted === permission) return true;
      if (granted.endsWith('.*')) {
        return permission.startsWith(granted.slice(0, -1));
      }
      return false;
    });
  },

  getUserPermissions: () => {
    const state = get();
    const roleId = state.sessionRoleId ?? state.currentUser?.roleId;
    if (!roleId) return [];

    const userRole = state.roles.find(role => role.id === roleId);
    return userRole?.permissions || [];
  },

  hasModuleAccess: (modulePrefix) => {
    const state = get();
    const roleId = state.sessionRoleId ?? state.currentUser?.roleId;
    if (!roleId) return false;

    const userRole = state.roles.find(role => role.id === roleId);
    if (!userRole || !userRole.isActive) return false;

    return userRole.permissions.some(p => p === '*' || p === `${modulePrefix}.*` || p.startsWith(`${modulePrefix}.`));
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

  updatePrintingTemplates: (tpl) => {
    const state = get();
    const printing = { ...state.printing, ...tpl };
    set({ printing });
    try { localStorage.setItem('printing.defaults', JSON.stringify(printing)); } catch {}
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
  
  // Document Number Generation — every generator below now consistently supports
  // {PREFIX}/{SUFFIX} tokens (previously only the receipt generator did), so editing a
  // series' Prefix/Suffix field actually changes the numbers it produces. A numberFormat
  // that doesn't reference {PREFIX}/{SUFFIX} at all (e.g. an already-customized value saved
  // before this fix) is left exactly as it was — nothing is silently rewritten.
  getNextInvoiceNumber: () => {
    const state = get();
    const settings = state.invoiceSettings;
    const result = formatDocumentNumber(settings, 4);
    state.updateInvoiceSettings({ nextNumber: settings.nextNumber + 1 });
    return result;
  },

  getNextReceiptNumber: () => {
    const state = get();
    const settings = state.receiptSettings;
    if (!settings?.numberFormat) return `RCP-${Date.now().toString().slice(-6)}`;
    const nextNumber = settings.nextNumber || 1;
    const result = formatDocumentNumber({ prefix: settings.prefix, suffix: settings.suffix, numberFormat: settings.numberFormat, nextNumber }, 4);
    set({ receiptSettings: { ...settings, nextNumber: nextNumber + 1 } as any });
    return result;
  },

  getNextPurchaseOrderNumber: () => {
    const state = get();
    const settings = state.purchaseOrderSettings;
    const result = formatDocumentNumber(settings, 4);
    state.updatePurchaseOrderSettings({ nextNumber: settings.nextNumber + 1 });
    return result;
  },

  getNextProformaInvoiceNumber: () => {
    const state = get();
    const settings = state.proformaInvoiceSettings;
    const result = formatDocumentNumber(settings, 4);
    state.updateProformaInvoiceSettings({ nextNumber: settings.nextNumber + 1 });
    return result;
  },

  getNextClientNumber: () => {
    const state = get();
    const settings = state.clientSettings;
    const result = formatDocumentNumber(settings, 3);
    state.updateClientSettings({ nextNumber: settings.nextNumber + 1 });
    return result;
  },

  getNextReservationNumber: () => {
    const state = get();
    const settings = state.reservationSettings;
    const result = formatDocumentNumber(settings, 5);
    state.updateReservationSettings({ nextNumber: settings.nextNumber + 1 });
    return result;
  },

  reconcileNumberFloor: (series, existingIds) => {
    let maxUsed = 0;
    for (const id of existingIds) {
      if (!id) continue;
      const m = /(\d+)$/.exec(id);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > maxUsed) maxUsed = n;
    }
    const floor = maxUsed + 1;
    const state = get();
    if (series === 'reservation' && floor > state.reservationSettings.nextNumber) {
      state.updateReservationSettings({ nextNumber: floor });
    } else if (series === 'client' && floor > state.clientSettings.nextNumber) {
      state.updateClientSettings({ nextNumber: floor });
    } else if (series === 'invoice' && floor > state.invoiceSettings.nextNumber) {
      state.updateInvoiceSettings({ nextNumber: floor });
    }
  },

  getNextModuleNumber: (category, series) => {
    const state = get();
    const pattern = (state.moduleNumbering as any)?.[category]?.[series];
    if (!pattern) return `${category.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const result = formatDocumentNumber(pattern, 4);
    const nextModuleNumbering = {
      ...state.moduleNumbering,
      [category]: {
        ...(state.moduleNumbering as any)[category],
        [series]: { ...pattern, nextNumber: pattern.nextNumber + 1 },
      },
    };
    set({ moduleNumbering: nextModuleNumbering as any });
    state.saveSettings();
    return result;
  },

  peekNextModuleNumber: (category, series) => {
    const state = get();
    const pattern = (state.moduleNumbering as any)?.[category]?.[series];
    if (!pattern) return `${category.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    return formatDocumentNumber(pattern, 4);
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
    payLaterPolicy: 'both',
    requireCorporateReference: false,
    defaultCreditTermsDays: 30,
    lateCheckoutFeeEnabled: false,
    lateCheckoutGraceMinutes: 0,
    lateCheckoutFeeType: 'flat',
    lateCheckoutFeeValue: 0,
    earlyCheckoutPolicyEnabled: true,
    earlyCheckoutRefundType: 'nightly_prorate',
    earlyCheckoutPenaltyPercent: 0,
    earlyCheckoutCutoffHour: 11,
    earlyCheckoutAdvancedEnabled: false,
    standardCheckInHour: 14,
    standardCheckOutHour: 11,
    noShowPolicyEnabled: false,
    noShowChargeType: 'first_night',
    noShowChargeValue: 0,
    noShowCutoffHour: 23,
    postFirstNightAtCheckin: true,
    nightAuditAutoRun: true,
    cancellationPolicyEnabled: false,
    freeCancellationHours: 24,
    lateCancellationFeeType: 'first_night',
    lateCancellationFeeValue: 0,
    depositPolicyEnabled: false,
    depositType: 'percent',
    depositValue: 0,
    requireDepositToConfirm: false,
    invoiceReminderScheduleDays: [7, 14, 30],
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

// Settings load from localStorage on the client only — NOT called here at
// module-evaluation time. Doing it here used to run synchronously the moment
// this module was imported, which happens before React's first client render.
// Since the server has no localStorage, that first client render (the one
// React reconciles against the server-rendered HTML) already reflected the
// user's real persisted role/settings while the server HTML reflected only
// defaults — a hydration mismatch on every load. Loading settings now happens
// once, post-mount, from Navigation.tsx's own useEffect instead, so the first
// client render matches the server before anything persisted is applied.
