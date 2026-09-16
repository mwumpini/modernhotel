'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Select,
  SelectItem,
  Switch,
  Divider,
  Chip,
  Spinner
} from '@heroui/react';
import { useSettingsStore, syncSetupStatusToApi } from '../lib/settings/store';

export default function SetupWizardPage() {
  const router = useRouter();
  const { status } = useSession();
  const settings = useSettingsStore();

  // This page had no auth check at all — reachable by URL without logging in
  // first. Login must come before setup, both because the wizard writes as
  // this user and because an unauthenticated visitor has no tenant to set up.
  React.useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);
  const updateSetting = useSettingsStore(s => s.updateSetting);
  const updateNestedSetting = useSettingsStore(s => s.updateNestedSetting);
  const updateCountryCompliance = useSettingsStore(s => s.updateCountryCompliance);
  const addCountry = useSettingsStore(s => s.addCountry);
  const saveSettings = useSettingsStore(s => s.saveSettings);

  const [step, setStep] = React.useState(1);

  // Country presets for defaults (extensible)
  const COUNTRY_PRESETS: Record<string, {
    name: string;
    currency: string;
    currencySymbol: string;
    timezone: string;
    localization: { language: string; dateFormat: string; timeFormat: string };
    taxes: { vat?: number; nhil?: number; tourismLevy?: number };
    priceDisplayFormat?: 'symbol' | 'code' | 'both';
    roundingRule?: 'nearest' | 'up' | 'down';
    defaultTaxScheme?: string;
  }> = {
    GH: {
      name: 'Ghana',
      currency: 'GHS',
      currencySymbol: '₵',
      timezone: 'Africa/Accra',
      localization: { language: 'en', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm' },
      taxes: { vat: 20, nhil: 2.5, tourismLevy: 1.0 },
      priceDisplayFormat: 'symbol',
      roundingRule: 'nearest',
      defaultTaxScheme: 'Ghana Standard (NHIL+GETFund+Tourism+VAT)'
    },
    NG: {
      name: 'Nigeria',
      currency: 'NGN',
      currencySymbol: '₦',
      timezone: 'Africa/Lagos',
      localization: { language: 'en', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm' },
      taxes: { vat: 7.5 },
      priceDisplayFormat: 'symbol',
      roundingRule: 'nearest'
    },
    KE: {
      name: 'Kenya',
      currency: 'KES',
      currencySymbol: 'Ksh',
      timezone: 'Africa/Nairobi',
      localization: { language: 'en', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm' },
      taxes: { vat: 16 },
      priceDisplayFormat: 'symbol',
      roundingRule: 'nearest'
    },
    GB: {
      name: 'United Kingdom',
      currency: 'GBP',
      currencySymbol: '£',
      timezone: 'Europe/London',
      localization: { language: 'en', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm' },
      taxes: { vat: 20 },
      priceDisplayFormat: 'symbol',
      roundingRule: 'nearest'
    },
    US: {
      name: 'United States',
      currency: 'USD',
      currencySymbol: '$',
      timezone: 'America/New_York',
      localization: { language: 'en', dateFormat: 'MM/DD/YYYY', timeFormat: 'hh:mm A' },
      taxes: { },
      priceDisplayFormat: 'symbol',
      roundingRule: 'nearest'
    }
  };

  // Tax Schemes per country (linked to compliance tax rates)
  const TAX_SCHEMES: Record<string, Array<{ key: string; name: string; rates: { vat?: number; nhil?: number; tourismLevy?: number } }>> = {
    GH: [
      { key: 'GH_STANDARD', name: 'Ghana Standard (NHIL+GETFund+Tourism+VAT)', rates: { vat: 20, nhil: 2.5, tourismLevy: 1.0 } },
      { key: 'GH_VAT_ONLY', name: 'Ghana VAT Only', rates: { vat: 20 } },
      { key: 'GH_ZERO', name: 'Zero-Rated', rates: { vat: 0, nhil: 0, tourismLevy: 0 } },
    ],
    NG: [
      { key: 'NG_VAT', name: 'Nigeria VAT', rates: { vat: 7.5 } },
      { key: 'NG_ZERO', name: 'Zero-Rated', rates: { vat: 0 } },
    ],
    KE: [
      { key: 'KE_VAT', name: 'Kenya VAT', rates: { vat: 16 } },
      { key: 'KE_ZERO', name: 'Zero-Rated', rates: { vat: 0 } },
    ],
    GB: [
      { key: 'GB_VAT', name: 'UK VAT', rates: { vat: 20 } },
      { key: 'GB_ZERO', name: 'Zero-Rated', rates: { vat: 0 } },
    ],
    US: [
      { key: 'US_NONE', name: 'No Federal VAT', rates: { } },
    ],
  };

  const [company, setCompany] = React.useState<any>(() => ({
    legalName: settings.companySettings?.legalName || '',
    tradingName: settings.companySettings?.tradingName || '',
    tagline: settings.companySettings?.tagline || '',
    registrationNumber: settings.companySettings?.registrationNumber || '',
    taxId: settings.companySettings?.taxId || '',
    address: {
      line1: settings.companySettings?.address.line1 || '',
      line2: settings.companySettings?.address.line2 || '',
      city: settings.companySettings?.address.city || '',
      state: settings.companySettings?.address.state || '',
      postalCode: settings.companySettings?.address.postalCode || '',
      country: settings.companySettings?.address.country || (settings.defaultCountry || 'GH'),
    },
    contact: {
      phone: settings.companySettings?.contact.phone || '',
      email: settings.companySettings?.contact.email || '',
      website: settings.companySettings?.contact.website || '',
    },
    defaultCurrency: settings.companySettings?.defaultCurrency || settings.financialSettings.defaultCurrency || 'GHS',
    financialYearStartDate: settings.companySettings?.financialYearStartDate || `${new Date().getFullYear()}-01-01`,
    addressFormatTemplate: settings.companySettings?.addressFormatTemplate || '{line1}\n{city}, {country}',
    priceDisplayFormat: settings.companySettings?.priceDisplayFormat || 'symbol',
    defaultTaxScheme: settings.companySettings?.defaultTaxScheme || 'Ghana Standard',
    baseCurrencyLocked: settings.companySettings?.baseCurrencyLocked || false,
    roundingRule: settings.companySettings?.roundingRule || 'nearest',
    classification: settings.hotelSettings.classification || '3-Star',
    logoAlignment: (settings as any)?.saasSettings?.customBranding?.logoPosition || 'left',
  }));

  const [regional, setRegional] = React.useState(() => ({
    country: settings.defaultCountry || 'GH',
    timezone: settings.tenant.metadata.timezone || 'Africa/Accra',
    dateFormat: settings.countryCompliance[settings.defaultCountry || 'GH']?.localization?.dateFormat || 'DD/MM/YYYY',
    timeFormat: settings.countryCompliance[settings.defaultCountry || 'GH']?.localization?.timeFormat || 'HH:mm',
    language: settings.tenant.metadata.language || 'en',
    addressFormatTemplate: settings.companySettings?.addressFormatTemplate || '{line1}\n{city}, {country}',
  }));

  const [financial, setFinancial] = React.useState(() => ({
    defaultCurrency: settings.financialSettings.defaultCurrency || 'GHS',
    taxInclusive: settings.financialSettings.taxInclusive,
    roundToNearest: settings.financialSettings.roundToNearest,
    roundingRule: settings.financialSettings.roundingRule || 'nearest',
    priceDisplayFormat: settings.financialSettings.priceDisplayFormat || 'symbol',
    vat: settings.countryCompliance[settings.defaultCountry || 'GH']?.taxRates?.vat ?? 15,
    nhil: settings.countryCompliance[settings.defaultCountry || 'GH']?.taxRates?.nhil ?? 2.5,
    tourismLevy: settings.countryCompliance[settings.defaultCountry || 'GH']?.taxRates?.tourismLevy ?? 1.0,
  }));

  // Move hotel classification into Company step
  // (Other property fields removed from wizard per request)

  const [numbering, setNumbering] = React.useState(() => ({
    invoicePrefix: settings.invoiceSettings.prefix,
    invoiceFormat: settings.invoiceSettings.numberFormat,
    invoiceNext: settings.invoiceSettings.nextNumber,
    receiptPrefix: settings.receiptSettings.prefix || 'RCP',
    receiptFormat: settings.receiptSettings.numberFormat || 'RCP-{YEAR}-{NUMBER}',
    receiptNext: settings.receiptSettings.nextNumber || 1,
    reservationPrefix: settings.reservationSettings.prefix,
    reservationFormat: settings.reservationSettings.numberFormat,
    reservationNext: settings.reservationSettings.nextNumber,
    clientPrefix: settings.clientSettings.prefix,
    clientFormat: settings.clientSettings.numberFormat,
    clientNext: settings.clientSettings.nextNumber,
  }));

  // New: module-scoped numbering
  const [moduleNumbering, setModuleNumbering] = React.useState<any>(() => ((settings as any).moduleNumbering) || {
    frontOffice: {
      folio: { prefix: 'FOL', suffix: '', nextNumber: 1, numberFormat: 'FOL-{YEAR}-{NUMBER}' },
      housekeepingTicket: { prefix: 'HK', suffix: '', nextNumber: 1, numberFormat: 'HK-{NUMBER}' },
    },
    foodBeverage: {
      order: { prefix: 'ORD', suffix: '', nextNumber: 1, numberFormat: 'ORD-{NUMBER}' },
      kitchenOrderTicket: { prefix: 'KOT', suffix: '', nextNumber: 1, numberFormat: 'KOT-{NUMBER}' },
    },
    inventory: {
      requisition: { prefix: 'REQ', suffix: '', nextNumber: 1, numberFormat: 'REQ-{NUMBER}' },
      stockTransfer: { prefix: 'ST', suffix: '', nextNumber: 1, numberFormat: 'ST-{NUMBER}' },
      goodsReceipt: { prefix: 'GRN', suffix: '', nextNumber: 1, numberFormat: 'GRN-{NUMBER}' },
    },
    accounting: {
      creditNote: { prefix: 'CN', suffix: '', nextNumber: 1, numberFormat: 'CN-{YEAR}-{NUMBER}' },
      debitNote: { prefix: 'DN', suffix: '', nextNumber: 1, numberFormat: 'DN-{YEAR}-{NUMBER}' },
    },
    events: {
      eventBooking: { prefix: 'EVT', suffix: '', nextNumber: 1, numberFormat: 'EVT-{YEAR}-{NUMBER}' },
      quotation: { prefix: 'QT', suffix: '', nextNumber: 1, numberFormat: 'QT-{YEAR}-{NUMBER}' },
    },
    maintenance: {
      workOrder: { prefix: 'WO', suffix: '', nextNumber: 1, numberFormat: 'WO-{YEAR}-{NUMBER}' },
      inspection: { prefix: 'INSP', suffix: '', nextNumber: 1, numberFormat: 'INSP-{NUMBER}' },
    },
    security: {
      incidentReport: { prefix: 'INC', suffix: '', nextNumber: 1, numberFormat: 'INC-{YEAR}-{NUMBER}' },
      accessPass: { prefix: 'PASS', suffix: '', nextNumber: 1, numberFormat: 'PASS-{NUMBER}' },
    },
    hr: {
      employeeId: { prefix: 'EMP', suffix: '', nextNumber: 1, numberFormat: 'EMP{NUMBER}' },
      timesheet: { prefix: 'TS', suffix: '', nextNumber: 1, numberFormat: 'TS-{YEAR}-{NUMBER}' },
    },
  });

  const [security, setSecurity] = React.useState(() => ({
    minLength: settings.security.passwordPolicy.minLength,
    requireUppercase: settings.security.passwordPolicy.requireUppercase,
    requireLowercase: settings.security.passwordPolicy.requireLowercase,
    requireNumbers: settings.security.passwordPolicy.requireNumbers,
    requireSpecialChars: settings.security.passwordPolicy.requireSpecialChars,
    expiryDays: settings.security.passwordPolicy.expiryDays,
    dataRetentionDays: settings.complianceSettings.dataRetentionDays,
  }));

  const TOTAL_STEPS = 4;
  const [stepError, setStepError] = React.useState<string | null>(null);

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!company.legalName || !company.legalName.trim()) return 'Company Legal Name is required.';
      if (!company.contact.email || !company.contact.email.trim()) return 'Email is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.contact.email.trim())) return 'Enter a valid email address.';
      if (!company.defaultCurrency || !company.defaultCurrency.trim()) return 'Default Currency is required.';
      return null;
    }
    if (s === 2) {
      if (!numbering.invoiceFormat || !numbering.invoiceFormat.includes('{NUMBER}')) return 'Invoice Format must include {NUMBER}.';
      if (!numbering.receiptFormat || !numbering.receiptFormat.includes('{NUMBER}')) return 'Receipt Format must include {NUMBER}.';
      if (!Number.isFinite(numbering.invoiceNext) || numbering.invoiceNext < 1) return 'Invoice Next must be at least 1.';
      if (!Number.isFinite(numbering.receiptNext) || numbering.receiptNext < 1) return 'Receipt Next must be at least 1.';
      return null;
    }
    if (s === 3) {
      if (!Number.isFinite(security.minLength) || security.minLength < 6) return 'Password Min Length must be at least 6.';
      if (!Number.isFinite(security.expiryDays) || security.expiryDays < 1) return 'Password Expiry Days must be at least 1.';
      if (!Number.isFinite(security.dataRetentionDays) || security.dataRetentionDays < 1) return 'Data Retention Days must be at least 1.';
      return null;
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) { setStepError(err); return; }
    setStepError(null);
    setStep(prev => Math.min(prev + 1, TOTAL_STEPS));
  };
  const goBack = () => { setStepError(null); setStep(prev => Math.max(prev - 1, 1)); };

  // Auto-detect country from IP on first load (non-blocking). Skipped entirely if the
  // user has already manually picked a country before the fetch resolves, so a slow
  // geo-IP response can't stomp on a deliberate choice made in the meantime.
  const autoDetectRef = React.useRef(false);
  const userChangedCountryRef = React.useRef(false);
  React.useEffect(() => {
    if (autoDetectRef.current) return;
    autoDetectRef.current = true;
    (async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) return;
        if (userChangedCountryRef.current) return;
        const data: any = await res.json();
        if (userChangedCountryRef.current) return;
        const detected = String(data?.country_code || '').toUpperCase();
        const supported = Object.keys(COUNTRY_PRESETS);
        if (supported.includes(detected) && detected !== regional.country) {
          handleCountryChange(detected);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCountryChange = (code: string, userInitiated = false) => {
    if (userInitiated) userChangedCountryRef.current = true;
    const preset = COUNTRY_PRESETS[code];
    if (!preset) return;
    // Update Company
    setCompany((prev: any) => ({
      ...prev,
      defaultCurrency: preset.currency,
      priceDisplayFormat: preset.priceDisplayFormat || prev.priceDisplayFormat,
      roundingRule: preset.roundingRule || prev.roundingRule,
      defaultTaxScheme: (preset.defaultTaxScheme ?? ''),
      address: { ...prev.address, country: code }
    }));
    // Update Regional
    setRegional((prev: any) => ({
      ...prev,
      country: code,
      timezone: preset.timezone,
      dateFormat: preset.localization.dateFormat,
      timeFormat: preset.localization.timeFormat,
      language: preset.localization.language
    }));
    // Update Financial
    setFinancial((prev: any) => ({
      ...prev,
      defaultCurrency: preset.currency,
      priceDisplayFormat: preset.priceDisplayFormat || prev.priceDisplayFormat,
      roundingRule: preset.roundingRule || prev.roundingRule,
      vat: preset.taxes.vat ?? 0,
      nhil: preset.taxes.nhil ?? 0,
      tourismLevy: preset.taxes.tourismLevy ?? 0
    }));

    // Align default tax scheme from preset if available
    const schemes = TAX_SCHEMES[code] || [];
    const defaultSchemeName = preset.defaultTaxScheme;
    const defaultScheme = schemes.find(s => s.name === defaultSchemeName) || schemes[0];
    if (defaultScheme) {
      setCompany((prev: any) => ({ ...prev, defaultTaxScheme: defaultScheme.name }));
      setFinancial((prev: any) => ({
        ...prev,
        vat: defaultScheme.rates.vat ?? 0,
        nhil: defaultScheme.rates.nhil ?? 0,
        tourismLevy: defaultScheme.rates.tourismLevy ?? 0,
      }));
    }
    try { console.log('[Setup] Country selected:', code, preset); } catch {}
  };

  const handleTaxSchemeChange = (schemeKey: string) => {
    const schemes = TAX_SCHEMES[regional.country] || [];
    const scheme = schemes.find(s => s.key === schemeKey);
    if (!scheme) return;
    setCompany((prev: any) => ({ ...prev, defaultTaxScheme: scheme.name }));
    setFinancial((prev: any) => ({
      ...prev,
      vat: scheme.rates.vat ?? 0,
      nhil: scheme.rates.nhil ?? 0,
      tourismLevy: scheme.rates.tourismLevy ?? 0,
    }));
  };

  const handleComplete = () => {
    for (const s of [1, 2, 3]) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        setStepError(err);
        return;
      }
    }
    try {
      // Company settings
      updateSetting('companySettings', {
        ...company,
        addressFormatTemplate: company.addressFormatTemplate,
        defaultCurrency: company.defaultCurrency,
        baseCurrencyLocked: true,
      } as any);

      // Regional
      updateSetting('defaultCountry', regional.country as any);
      updateNestedSetting('tenant.metadata.timezone', regional.timezone);
      updateNestedSetting('tenant.metadata.language', regional.language);
      // Ensure country exists, then update localization/tax/timezone
      if (!settings.countryCompliance[regional.country]) {
        const preset = COUNTRY_PRESETS[regional.country];
        addCountry(regional.country, {
          countryCode: regional.country,
          countryName: preset?.name || regional.country,
          currency: company.defaultCurrency,
          currencySymbol: preset?.currencySymbol || '',
          timezone: regional.timezone,
          dateFormat: regional.dateFormat,
          numberFormat: '#,##0.00',
          taxRates: {},
          businessInfo: { name: company.tradingName, address: company.address.line1, phone: company.contact.phone, email: company.contact.email },
          compliance: { eInvoicing: true, taxReports: true, governmentIntegration: false, digitalSignature: false, auditTrail: true },
          paymentMethods: { mobileMoney: true, bankTransfer: true, creditCard: false, cash: true, digitalWallet: false },
          localization: { language: regional.language, dateFormat: regional.dateFormat, timeFormat: regional.timeFormat, numberFormat: '#,##0.00', currencyPosition: 'before', decimalSeparator: '.', thousandsSeparator: ',' }
        } as any);
      }
      updateCountryCompliance(regional.country, {
        timezone: regional.timezone,
        localization: {
          language: regional.language,
          dateFormat: regional.dateFormat,
          timeFormat: regional.timeFormat,
          numberFormat: '#,##0.00',
          currencyPosition: company.priceDisplayFormat === 'symbol' ? 'before' : 'after',
          decimalSeparator: '.',
          thousandsSeparator: ',',
        }
      } as any);

      // Financial & Tax
      updateNestedSetting('financialSettings.defaultCurrency', financial.defaultCurrency);
      updateNestedSetting('financialSettings.taxInclusive', financial.taxInclusive);
      updateNestedSetting('financialSettings.roundToNearest', financial.roundToNearest);
      updateNestedSetting('financialSettings.roundingRule', financial.roundingRule);
      updateNestedSetting('financialSettings.priceDisplayFormat', financial.priceDisplayFormat);
      updateCountryCompliance(regional.country, { taxRates: { vat: Number(financial.vat), nhil: Number(financial.nhil), tourismLevy: Number(financial.tourismLevy) } } as any);

      // Hotel Classification (moved to Company step)
      if (company.classification) {
        updateNestedSetting('hotelSettings.classification', company.classification as any);
      }

      // Branding Logo
      if (company.logoUrl) {
        updateNestedSetting('saasSettings.customBranding.logoUrl', company.logoUrl as any);
      }
      if (company.logoAlignment) {
        updateNestedSetting('saasSettings.customBranding.logoPosition', company.logoAlignment as any);
      }

      // Numbering & Formats
      updateNestedSetting('invoiceSettings.prefix', numbering.invoicePrefix);
      updateNestedSetting('invoiceSettings.numberFormat', numbering.invoiceFormat);
      updateNestedSetting('invoiceSettings.nextNumber', Number(numbering.invoiceNext));
      updateNestedSetting('receiptSettings.prefix', numbering.receiptPrefix);
      updateNestedSetting('receiptSettings.numberFormat', numbering.receiptFormat);
      updateNestedSetting('receiptSettings.nextNumber', Number(numbering.receiptNext));
      updateNestedSetting('reservationSettings.prefix', numbering.reservationPrefix);
      updateNestedSetting('reservationSettings.numberFormat', numbering.reservationFormat);
      updateNestedSetting('reservationSettings.nextNumber', Number(numbering.reservationNext));
      updateNestedSetting('clientSettings.prefix', numbering.clientPrefix);
      updateNestedSetting('clientSettings.numberFormat', numbering.clientFormat);
      updateNestedSetting('clientSettings.nextNumber', Number(numbering.clientNext));
      updateSetting('moduleNumbering', moduleNumbering as any);

      // User & Security
      updateNestedSetting('security.passwordPolicy', {
        minLength: Number(security.minLength),
        requireUppercase: security.requireUppercase,
        requireLowercase: security.requireLowercase,
        requireNumbers: security.requireNumbers,
        requireSpecialChars: security.requireSpecialChars,
        expiryDays: Number(security.expiryDays),
      });
      updateNestedSetting('complianceSettings.dataRetentionDays', Number(security.dataRetentionDays));

      // Finalize
      updateSetting('initialSetupCompleted', true as any);
      saveSettings();
      // Push completion to the server immediately rather than waiting for a
      // future page load to notice the mismatch (see /api/settings/setup-status)
      // — otherwise another device only learns setup is done once this browser
      // happens to reload the app again.
      syncSetupStatusToApi();
      router.replace('/');
    } catch (e) {
      console.error(e);
    }
  };

  const StepHeader = () => (
    <div className="flex items-center gap-2 mb-4">
      <Chip color="primary" variant="flat">Step {step} / {TOTAL_STEPS}</Chip>
      <span className="text-sm text-gray-600">System Setup</span>
    </div>
  );

  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6 relative">
        <Button
          isIconOnly
          variant="light"
          className="!absolute right-0 -top-2"
          aria-label="Close setup wizard"
          onPress={() => { try { localStorage.setItem('nav.section', 'settings'); } catch {}; router.replace('/'); }}
        >
          ×
        </Button>
        <StepHeader />

        {stepError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {stepError}
          </div>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Company Profile & Localization</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Country"
                  selectedKeys={[regional.country]}
                  onSelectionChange={(keys) => {
                    const code = Array.from(keys)[0] as string;
                    handleCountryChange(code, true);
                  }}
                >
                  <SelectItem key="GH">Ghana</SelectItem>
                  <SelectItem key="NG">Nigeria</SelectItem>
                  <SelectItem key="KE">Kenya</SelectItem>
                  <SelectItem key="GB">United Kingdom</SelectItem>
                  <SelectItem key="US">United States</SelectItem>
                </Select>
                <Select label="Hotel Classification" selectedKeys={[company.classification || (settings.hotelSettings.classification || '3-Star')]} onSelectionChange={(keys) => {
                  const cls = Array.from(keys)[0] as string;
                  setCompany({ ...company, classification: cls });
                }}>
                  <SelectItem key="1-Star">1-Star</SelectItem>
                  <SelectItem key="2-Star">2-Star</SelectItem>
                  <SelectItem key="3-Star">3-Star</SelectItem>
                  <SelectItem key="4-Star">4-Star</SelectItem>
                  <SelectItem key="5-Star">5-Star</SelectItem>
                  <SelectItem key="Boutique">Boutique</SelectItem>
                  <SelectItem key="Resort">Resort</SelectItem>
                </Select>
                <Input label="Company Legal Name" value={company.legalName} onChange={e => setCompany((v: any) => ({ ...v, legalName: e.target.value }))} />
                <Input label="Trading Name" value={company.tradingName} onChange={e => setCompany((v: any) => ({ ...v, tradingName: e.target.value }))} />
                <Input label="Tagline" placeholder="e.g., Excellence in Hospitality" value={company.tagline} onChange={e => setCompany((v: any) => ({ ...v, tagline: e.target.value }))} />
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-gray-600">Company Logo (upload)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      try {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const dataUrl = String(reader.result || '');
                          setCompany((v: any) => ({ ...v, logoUrl: dataUrl }));
                          console.log('[Setup] Company logo loaded');
                        };
                        reader.readAsDataURL(file);
                      } catch {}
                    }}
                  />
                </div>
                <Input label="Registration Number" value={company.registrationNumber} onChange={e => setCompany((v: any) => ({ ...v, registrationNumber: e.target.value }))} />
                <Input label="Tax ID (TIN/VAT)" value={company.taxId} onChange={e => setCompany((v: any) => ({ ...v, taxId: e.target.value }))} />
                <Input label="Phone" value={company.contact.phone} onChange={e => setCompany((v: any) => ({ ...v, contact: { ...v.contact, phone: e.target.value } }))} />
                <Input label="Email" value={company.contact.email} onChange={e => setCompany((v: any) => ({ ...v, contact: { ...v.contact, email: e.target.value } }))} />
                <Input label="Website" value={company.contact.website} onChange={e => setCompany((v: any) => ({ ...v, contact: { ...v.contact, website: e.target.value } }))} />
                <Input label="Default Currency" value={company.defaultCurrency} onChange={e => setCompany((v: any) => ({ ...v, defaultCurrency: e.target.value }))} />
                <Input type="date" label="Financial Year Start Date" value={company.financialYearStartDate} onChange={e => setCompany((v: any) => ({ ...v, financialYearStartDate: e.target.value }))} />
              </div>
              <Divider />
              {company.logoUrl && (
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">Logo Preview:</div>
                  <img src={company.logoUrl} alt="Company Logo" className="h-12 w-auto rounded border" />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Address Line 1" value={company.address.line1} onChange={e => setCompany((v: any) => ({ ...v, address: { ...v.address, line1: e.target.value } }))} />
                <Input label="Address Line 2" value={company.address.line2} onChange={e => setCompany((v: any) => ({ ...v, address: { ...v.address, line2: e.target.value } }))} />
                <Input label="City" value={company.address.city} onChange={e => setCompany((v: any) => ({ ...v, address: { ...v.address, city: e.target.value } }))} />
                <Input label="Region/State" value={company.address.state} onChange={e => setCompany((v: any) => ({ ...v, address: { ...v.address, state: e.target.value } }))} />
                <Input label="Postal Code" value={company.address.postalCode} onChange={e => setCompany((v: any) => ({ ...v, address: { ...v.address, postalCode: e.target.value } }))} />
                <Input label="Country" value={company.address.country} onChange={e => setCompany((v: any) => ({ ...v, address: { ...v.address, country: e.target.value } }))} />
              </div>
              <Divider />
              <div className="flex items-center gap-4">
                <Select label="Price Display Format" selectedKeys={[company.priceDisplayFormat]} onSelectionChange={keys => { const val = Array.from(keys)[0] as any; setCompany((v: any) => ({ ...v, priceDisplayFormat: val })); setFinancial((v: any) => ({ ...v, priceDisplayFormat: val })); }}>
                  <SelectItem key="symbol">{(() => { const p = COUNTRY_PRESETS[regional.country]; const sym = p?.currencySymbol || ''; return `${sym}100.00`; })()}</SelectItem>
                  <SelectItem key="code">{(() => { const p = COUNTRY_PRESETS[regional.country]; const code = p?.currency || company.defaultCurrency || ''; return `${code} 100.00`; })()}</SelectItem>
                  <SelectItem key="both">{(() => { const p = COUNTRY_PRESETS[regional.country]; const sym = p?.currencySymbol || ''; const code = p?.currency || company.defaultCurrency || ''; return `${sym} (${code}) 100.00`; })()}</SelectItem>
                </Select>
                <Select label="Logo Alignment" selectedKeys={[company.logoAlignment]} onSelectionChange={(keys) => setCompany((v: any) => ({ ...v, logoAlignment: Array.from(keys)[0] as string }))}>
                  <SelectItem key="left">Left</SelectItem>
                  <SelectItem key="center">Center</SelectItem>
                  <SelectItem key="right">Right</SelectItem>
                </Select>
                <Select label="Rounding Rule" selectedKeys={[company.roundingRule]} onSelectionChange={keys => { const val = Array.from(keys)[0] as any; setCompany((v: any) => ({ ...v, roundingRule: val })); setFinancial((v: any) => ({ ...v, roundingRule: val })); }}>
                  <SelectItem key="nearest">Nearest</SelectItem>
                  <SelectItem key="up">Round Up</SelectItem>
                  <SelectItem key="down">Round Down</SelectItem>
                </Select>
                <Select
                  label="Default Tax Scheme"
                  selectedKeys={[
                    (() => {
                      const schemes = TAX_SCHEMES[regional.country] || [];
                      const found = schemes.find(s => s.name === (company.defaultTaxScheme || ''));
                      return found?.key || (schemes[0]?.key || '');
                    })()
                  ]}
                  onSelectionChange={keys => handleTaxSchemeChange(Array.from(keys)[0] as string)}
                >
                  {(TAX_SCHEMES[regional.country] || []).map(s => (
                    <SelectItem key={s.key}>{s.name}</SelectItem>
                  ))}
                </Select>
              </div>
            </CardBody>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <div>
                <h2 className="text-xl font-semibold">Document Numbering</h2>
                <p className="text-sm text-gray-600">Just the essentials to start issuing documents. Every other series uses a sensible default you can change anytime in Settings → Numbering.</p>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Invoice Prefix" value={numbering.invoicePrefix} onChange={e => setNumbering(v => ({ ...v, invoicePrefix: e.target.value }))} />
                <Input label="Invoice Format" value={numbering.invoiceFormat} onChange={e => setNumbering(v => ({ ...v, invoiceFormat: e.target.value }))} />
                <Input type="number" label="Invoice Next" value={String(numbering.invoiceNext)} onChange={e => setNumbering(v => ({ ...v, invoiceNext: Number(e.target.value) }))} />
                <Input label="Receipt Prefix" value={numbering.receiptPrefix} onChange={e => setNumbering(v => ({ ...v, receiptPrefix: e.target.value }))} />
                <Input label="Receipt Format" value={numbering.receiptFormat} onChange={e => setNumbering(v => ({ ...v, receiptFormat: e.target.value }))} />
                <Input type="number" label="Receipt Next" value={String(numbering.receiptNext)} onChange={e => setNumbering(v => ({ ...v, receiptNext: Number(e.target.value) }))} />
              </div>
              <p className="text-xs text-gray-500">Tokens: {'{YEAR}'} inserts the current year, {'{NUMBER}'} the running sequence.</p>
            </CardBody>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">User & Security</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input type="number" label="Password Min Length" value={String(security.minLength)} onChange={e => setSecurity(v => ({ ...v, minLength: Number(e.target.value) }))} />
                <Input type="number" label="Password Expiry Days" value={String(security.expiryDays)} onChange={e => setSecurity(v => ({ ...v, expiryDays: Number(e.target.value) }))} />
                <Input type="number" label="Data Retention Days" value={String(security.dataRetentionDays)} onChange={e => setSecurity(v => ({ ...v, dataRetentionDays: Number(e.target.value) }))} />
                <Switch isSelected={security.requireUppercase} onValueChange={v => setSecurity(s => ({ ...s, requireUppercase: v }))}>Require Uppercase</Switch>
                <Switch isSelected={security.requireLowercase} onValueChange={v => setSecurity(s => ({ ...s, requireLowercase: v }))}>Require Lowercase</Switch>
                <Switch isSelected={security.requireNumbers} onValueChange={v => setSecurity(s => ({ ...s, requireNumbers: v }))}>Require Numbers</Switch>
                <Switch isSelected={security.requireSpecialChars} onValueChange={v => setSecurity(s => ({ ...s, requireSpecialChars: v }))}>Require Special</Switch>
              </div>
            </CardBody>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Review & Complete</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-gray-700">Review your settings, then click Complete to finish initial setup. You can change everything below later in Settings.</p>
              <ul className="list-disc pl-6 text-sm text-gray-700 space-y-1">
                <li>Company: {company.legalName || '(not set)'}{company.tradingName ? ` (${company.tradingName})` : ''}</li>
                <li>Contact: {company.contact.email || '(not set)'}{company.contact.phone ? ` • ${company.contact.phone}` : ''}</li>
                <li>Country: {COUNTRY_PRESETS[regional.country]?.name || regional.country} • Currency: {financial.defaultCurrency} • Timezone: {regional.timezone}</li>
                <li>Classification: {company.classification || settings.hotelSettings.classification}</li>
                <li>Tax Scheme: {company.defaultTaxScheme || '(none)'} — VAT {financial.vat}%{financial.nhil ? `, NHIL ${financial.nhil}%` : ''}{financial.tourismLevy ? `, Tourism Levy ${financial.tourismLevy}%` : ''}</li>
                <li>Financial Year Start: {company.financialYearStartDate}</li>
                <li>Invoice: {numbering.invoicePrefix} ({numbering.invoiceFormat}) • Receipt: {numbering.receiptPrefix} ({numbering.receiptFormat})</li>
                <li>Password Policy: min {security.minLength} chars, expires every {security.expiryDays} days{security.requireUppercase || security.requireNumbers || security.requireSpecialChars ? ' (with complexity rules)' : ''}</li>
                <li>Data Retention: {security.dataRetentionDays} days</li>
              </ul>
            </CardBody>
          </Card>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="flat" onPress={goBack} isDisabled={step === 1}>Back</Button>
          {step < TOTAL_STEPS ? (
            <Button color="primary" onPress={goNext}>Next</Button>
          ) : (
            <Button color="success" onPress={handleComplete}>Complete Setup</Button>
          )}
        </div>
      </div>
    </div>
  );
}


