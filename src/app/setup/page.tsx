'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Select,
  SelectItem,
  Switch,
  Textarea,
  Divider,
  Chip
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';

export default function SetupWizardPage() {
  const router = useRouter();
  const settings = useSettingsStore();
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
      taxes: { vat: 12.5, nhil: 2.5, tourismLevy: 1.0 },
      priceDisplayFormat: 'symbol',
      roundingRule: 'nearest',
      defaultTaxScheme: 'Ghana Standard'
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
      { key: 'GH_STANDARD', name: 'Ghana Standard', rates: { vat: 12.5, nhil: 2.5, tourismLevy: 1.0 } },
      { key: 'GH_VAT_ONLY', name: 'Ghana VAT Only', rates: { vat: 12.5 } },
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
    financialYearStartDate: settings.companySettings?.financialYearStartDate || '2025-01-01',
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
    vat: settings.countryCompliance[settings.defaultCountry || 'GH']?.taxRates?.vat ?? 12.5,
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

  const goNext = () => setStep(prev => Math.min(prev + 1, 5));
  const goBack = () => setStep(prev => Math.max(prev - 1, 1));

  // Auto-detect country from IP on first load (non-blocking)
  const autoDetectRef = React.useRef(false);
  React.useEffect(() => {
    if (autoDetectRef.current) return;
    autoDetectRef.current = true;
    (async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) return;
        const data: any = await res.json();
        const detected = String(data?.country_code || '').toUpperCase();
        const supported = Object.keys(COUNTRY_PRESETS);
        if (supported.includes(detected) && detected !== regional.country) {
          handleCountryChange(detected);
        }
      } catch {}
    })();
  }, []);

  const handleCountryChange = (code: string) => {
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
        addCountry(regional.country, {
          countryCode: regional.country,
          countryName: regional.country,
          currency: company.defaultCurrency,
          currencySymbol: '₵',
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
      router.replace('/');
    } catch (e) {
      console.error(e);
    }
  };

  const StepHeader = () => (
    <div className="flex items-center gap-2 mb-4">
      <Chip color="primary" variant="flat">Step {step} / 5</Chip>
      <span className="text-sm text-gray-600">System Setup</span>
    </div>
  );

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

        {step === 1 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Company & Legal Structure</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Country"
                  selectedKeys={[regional.country]}
                  onSelectionChange={(keys) => {
                    const code = Array.from(keys)[0] as string;
                    handleCountryChange(code);
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
                <Input label="Company Logo URL" value={company.logoUrl || ''} onChange={e => setCompany((v: any) => ({ ...v, logoUrl: e.target.value }))} />
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
              <h2 className="text-xl font-semibold">Regional & Localization</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Country Code" value={regional.country} onChange={e => setRegional((v: any) => ({ ...v, country: e.target.value }))} />
                <Input label="Timezone" value={regional.timezone} onChange={e => setRegional((v: any) => ({ ...v, timezone: e.target.value }))} />
                <Input label="Date Format" value={regional.dateFormat} onChange={e => setRegional((v: any) => ({ ...v, dateFormat: e.target.value }))} />
                <Input label="Time Format" value={regional.timeFormat} onChange={e => setRegional((v: any) => ({ ...v, timeFormat: e.target.value }))} />
                <Input label="Language" value={regional.language} onChange={e => setRegional((v: any) => ({ ...v, language: e.target.value }))} />
              </div>
              <Textarea label="Address Format Template" value={regional.addressFormatTemplate} onChange={e => setRegional((v: any) => ({ ...v, addressFormatTemplate: e.target.value }))} />
            </CardBody>
          </Card>
        )}

        {/* Step 3 removed per request: Financial & Taxation moved to Company step via presets & selectors */}

        {/* Step 4 removed per request; Hotel classification moved to Company step */}

        {step === 3 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">System-Wide Numbering & Formats</h2>
            </CardHeader>
            <CardBody className="space-y-8">
              {/* Accounting & Finance */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Accounting & Finance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Invoice Prefix" value={numbering.invoicePrefix} onChange={e => setNumbering(v => ({ ...v, invoicePrefix: e.target.value }))} />
                <Input label="Invoice Format" value={numbering.invoiceFormat} onChange={e => setNumbering(v => ({ ...v, invoiceFormat: e.target.value }))} />
                <Input type="number" label="Invoice Next" value={String(numbering.invoiceNext)} onChange={e => setNumbering(v => ({ ...v, invoiceNext: Number(e.target.value) }))} />

                <Input label="Receipt Prefix" value={numbering.receiptPrefix} onChange={e => setNumbering(v => ({ ...v, receiptPrefix: e.target.value }))} />
                <Input label="Receipt Format" value={numbering.receiptFormat} onChange={e => setNumbering(v => ({ ...v, receiptFormat: e.target.value }))} />
                <Input type="number" label="Receipt Next" value={String(numbering.receiptNext)} onChange={e => setNumbering(v => ({ ...v, receiptNext: Number(e.target.value) }))} />
                <Input label="Credit Note Prefix" value={moduleNumbering.accounting.creditNote.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, accounting: { ...m.accounting, creditNote: { ...m.accounting.creditNote, prefix: e.target.value } } }))} />
                <Input label="Credit Note Format" value={moduleNumbering.accounting.creditNote.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, accounting: { ...m.accounting, creditNote: { ...m.accounting.creditNote, numberFormat: e.target.value } } }))} />
                <Input type="number" label="Credit Note Next" value={String(moduleNumbering.accounting.creditNote.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, accounting: { ...m.accounting, creditNote: { ...m.accounting.creditNote, nextNumber: Number(e.target.value) } } }))} />
                  <Input label="Debit Note Prefix" value={moduleNumbering.accounting.debitNote.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, accounting: { ...m.accounting, debitNote: { ...m.accounting.debitNote, prefix: e.target.value } } }))} />
                  <Input label="Debit Note Format" value={moduleNumbering.accounting.debitNote.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, accounting: { ...m.accounting, debitNote: { ...m.accounting.debitNote, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="Debit Note Next" value={String(moduleNumbering.accounting.debitNote.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, accounting: { ...m.accounting, debitNote: { ...m.accounting.debitNote, nextNumber: Number(e.target.value) } } }))} />
                </div>
              </div>

              {/* Front Office */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Front Office</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Reservation Prefix" value={numbering.reservationPrefix} onChange={e => setNumbering(v => ({ ...v, reservationPrefix: e.target.value }))} />
                  <Input label="Reservation Format" value={numbering.reservationFormat} onChange={e => setNumbering(v => ({ ...v, reservationFormat: e.target.value }))} />
                  <Input type="number" label="Reservation Next" value={String(numbering.reservationNext)} onChange={e => setNumbering(v => ({ ...v, reservationNext: Number(e.target.value) }))} />
                  <Input label="Folio Prefix" value={moduleNumbering.frontOffice.folio.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, frontOffice: { ...m.frontOffice, folio: { ...m.frontOffice.folio, prefix: e.target.value } } }))} />
                  <Input label="Folio Format" value={moduleNumbering.frontOffice.folio.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, frontOffice: { ...m.frontOffice, folio: { ...m.frontOffice.folio, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="Folio Next" value={String(moduleNumbering.frontOffice.folio.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, frontOffice: { ...m.frontOffice, folio: { ...m.frontOffice.folio, nextNumber: Number(e.target.value) } } }))} />
                  <Input label="Goods Receipt Prefix" value={moduleNumbering.inventory.goodsReceipt.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, inventory: { ...m.inventory, goodsReceipt: { ...m.inventory.goodsReceipt, prefix: e.target.value } } }))} />
                  <Input label="Goods Receipt Format" value={moduleNumbering.inventory.goodsReceipt.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, inventory: { ...m.inventory, goodsReceipt: { ...m.inventory.goodsReceipt, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="Goods Receipt Next" value={String(moduleNumbering.inventory.goodsReceipt.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, inventory: { ...m.inventory, goodsReceipt: { ...m.inventory.goodsReceipt, nextNumber: Number(e.target.value) } } }))} />
                </div>
              </div>

              {/* Guest Profiles */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Guest Profiles</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Guest Profile Prefix" value={numbering.clientPrefix} onChange={e => setNumbering(v => ({ ...v, clientPrefix: e.target.value }))} />
                  <Input label="Guest Profile Format" value={numbering.clientFormat} onChange={e => setNumbering(v => ({ ...v, clientFormat: e.target.value }))} />
                  <Input type="number" label="Guest Profile Next" value={String(numbering.clientNext)} onChange={e => setNumbering(v => ({ ...v, clientNext: Number(e.target.value) }))} />
                  <Input label="Timesheet Prefix" value={moduleNumbering.hr.timesheet.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, hr: { ...m.hr, timesheet: { ...m.hr.timesheet, prefix: e.target.value } } }))} />
                  <Input label="Timesheet Format" value={moduleNumbering.hr.timesheet.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, hr: { ...m.hr, timesheet: { ...m.hr.timesheet, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="Timesheet Next" value={String(moduleNumbering.hr.timesheet.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, hr: { ...m.hr, timesheet: { ...m.hr.timesheet, nextNumber: Number(e.target.value) } } }))} />
                </div>
              </div>

              {/* Food & Beverage */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Food & Beverage</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Order Prefix" value={moduleNumbering.foodBeverage.order.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, foodBeverage: { ...m.foodBeverage, order: { ...m.foodBeverage.order, prefix: e.target.value } } }))} />
                  <Input label="Order Format" value={moduleNumbering.foodBeverage.order.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, foodBeverage: { ...m.foodBeverage, order: { ...m.foodBeverage.order, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="Order Next" value={String(moduleNumbering.foodBeverage.order.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, foodBeverage: { ...m.foodBeverage, order: { ...m.foodBeverage.order, nextNumber: Number(e.target.value) } } }))} />
                  <Input label="KOT Prefix" value={moduleNumbering.foodBeverage.kitchenOrderTicket.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, foodBeverage: { ...m.foodBeverage, kitchenOrderTicket: { ...m.foodBeverage.kitchenOrderTicket, prefix: e.target.value } } }))} />
                  <Input label="KOT Format" value={moduleNumbering.foodBeverage.kitchenOrderTicket.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, foodBeverage: { ...m.foodBeverage, kitchenOrderTicket: { ...m.foodBeverage.kitchenOrderTicket, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="KOT Next" value={String(moduleNumbering.foodBeverage.kitchenOrderTicket.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, foodBeverage: { ...m.foodBeverage, kitchenOrderTicket: { ...m.foodBeverage.kitchenOrderTicket, nextNumber: Number(e.target.value) } } }))} />
                </div>
              </div>

              {/* Inventory & Stores */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Inventory & Stores</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Requisition Prefix" value={moduleNumbering.inventory.requisition.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, inventory: { ...m.inventory, requisition: { ...m.inventory.requisition, prefix: e.target.value } } }))} />
                  <Input label="Requisition Format" value={moduleNumbering.inventory.requisition.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, inventory: { ...m.inventory, requisition: { ...m.inventory.requisition, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="Requisition Next" value={String(moduleNumbering.inventory.requisition.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, inventory: { ...m.inventory, requisition: { ...m.inventory.requisition, nextNumber: Number(e.target.value) } } }))} />
                  <Input label="Stock Transfer Prefix" value={moduleNumbering.inventory.stockTransfer.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, inventory: { ...m.inventory, stockTransfer: { ...m.inventory.stockTransfer, prefix: e.target.value } } }))} />
                  <Input label="Stock Transfer Format" value={moduleNumbering.inventory.stockTransfer.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, inventory: { ...m.inventory, stockTransfer: { ...m.inventory.stockTransfer, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="Stock Transfer Next" value={String(moduleNumbering.inventory.stockTransfer.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, inventory: { ...m.inventory, stockTransfer: { ...m.inventory.stockTransfer, nextNumber: Number(e.target.value) } } }))} />
                </div>
              </div>

              {/* Events & Conferences */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Events & Conferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Event Booking Prefix" value={moduleNumbering.events.eventBooking.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, events: { ...m.events, eventBooking: { ...m.events.eventBooking, prefix: e.target.value } } }))} />
                  <Input label="Event Booking Format" value={moduleNumbering.events.eventBooking.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, events: { ...m.events, eventBooking: { ...m.events.eventBooking, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="Event Booking Next" value={String(moduleNumbering.events.eventBooking.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, events: { ...m.events, eventBooking: { ...m.events.eventBooking, nextNumber: Number(e.target.value) } } }))} />
                </div>
              </div>

              {/* Maintenance */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Maintenance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Work Order Prefix" value={moduleNumbering.maintenance.workOrder.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, maintenance: { ...m.maintenance, workOrder: { ...m.maintenance.workOrder, prefix: e.target.value } } }))} />
                  <Input label="Work Order Format" value={moduleNumbering.maintenance.workOrder.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, maintenance: { ...m.maintenance, workOrder: { ...m.maintenance.workOrder, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="Work Order Next" value={String(moduleNumbering.maintenance.workOrder.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, maintenance: { ...m.maintenance, workOrder: { ...m.maintenance.workOrder, nextNumber: Number(e.target.value) } } }))} />
                </div>
              </div>

              {/* Security & Compliance */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Security & Compliance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Incident Report Prefix" value={moduleNumbering.security.incidentReport.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, security: { ...m.security, incidentReport: { ...m.security.incidentReport, prefix: e.target.value } } }))} />
                  <Input label="Incident Report Format" value={moduleNumbering.security.incidentReport.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, security: { ...m.security, incidentReport: { ...m.security.incidentReport, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="Incident Report Next" value={String(moduleNumbering.security.incidentReport.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, security: { ...m.security, incidentReport: { ...m.security.incidentReport, nextNumber: Number(e.target.value) } } }))} />
                </div>
              </div>

              {/* Human Resources */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Human Resources</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Employee ID Prefix" value={moduleNumbering.hr.employeeId.prefix} onChange={e => setModuleNumbering((m: any) => ({ ...m, hr: { ...m.hr, employeeId: { ...m.hr.employeeId, prefix: e.target.value } } }))} />
                  <Input label="Employee ID Format" value={moduleNumbering.hr.employeeId.numberFormat} onChange={e => setModuleNumbering((m: any) => ({ ...m, hr: { ...m.hr, employeeId: { ...m.hr.employeeId, numberFormat: e.target.value } } }))} />
                  <Input type="number" label="Employee ID Next" value={String(moduleNumbering.hr.employeeId.nextNumber)} onChange={e => setModuleNumbering((m: any) => ({ ...m, hr: { ...m.hr, employeeId: { ...m.hr.employeeId, nextNumber: Number(e.target.value) } } }))} />
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {step === 4 && (
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

        {step === 5 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Review & Complete</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-gray-700">Review your settings, then click Complete to finish initial setup. You can change most items later in Settings.</p>
              <ul className="list-disc pl-6 text-sm text-gray-700">
                <li>Company: {company.legalName} ({company.tradingName})</li>
                <li>Country: {regional.country} • Currency: {financial.defaultCurrency}</li>
                <li>Classification: {company.classification || settings.hotelSettings.classification}</li>
                <li>Invoice Prefix: {numbering.invoicePrefix} • Receipt Prefix: {numbering.receiptPrefix}</li>
              </ul>
            </CardBody>
          </Card>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="flat" onPress={goBack} isDisabled={step === 1}>Back</Button>
          {step < 5 ? (
            <Button color="primary" onPress={goNext}>Next</Button>
          ) : (
            <Button color="success" onPress={handleComplete}>Complete Setup</Button>
          )}
        </div>
      </div>
    </div>
  );
}


