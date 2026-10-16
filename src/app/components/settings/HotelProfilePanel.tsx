'use client';

import React from 'react';
import { Button, Input, Select, SelectItem } from '@heroui/react';
import {
  BadgeCheck, BookOpen, Scissors, Building2, CalendarDays, Camera, Clock, Globe, Hash, ImagePlus, Mail, MapPin,
  Percent, Phone, ReceiptText, ShieldAlert, Sparkles, Trash2, type LucideIcon,
} from 'lucide-react';
import { formatDocumentNumber, useSettingsStore } from '../../lib/settings/store';
import { DATE_FORMATS, TIME_FORMATS, formatHotelDate, formatHotelTime } from '../../lib/settings/hotelDates';
import { logAudit } from '../../lib/analytics/auditLogStore';
import { trimLogo } from '../../lib/settings/trimLogo';

/** Largest logo kept: it is stored in the hotel's settings and printed on every document. */
const MAX_LOGO_BYTES = 500 * 1024;

const LOGO_POSITIONS = [
  { key: 'left', label: 'Left of the name' },
  { key: 'center', label: 'Above the name' },
  { key: 'right', label: 'Right of the name' },
] as const;

const LOGO_SIZES = [
  { key: 'sm', label: 'S', preview: 'h-6' },
  { key: 'md', label: 'M', preview: 'h-9' },
  { key: 'lg', label: 'L', preview: 'h-12' },
  { key: 'xl', label: 'XL', preview: 'h-14' },
] as const;

const CLASSIFICATIONS = ['1-Star', '2-Star', '3-Star', '4-Star', '5-Star', 'Boutique', 'Aparthotel', 'Resort', 'Other'] as const;

const TIMEZONES = [
  'Africa/Accra', 'Africa/Abidjan', 'Africa/Lagos', 'Africa/Lome', 'Africa/Nairobi', 'Africa/Johannesburg',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'America/New_York', 'Asia/Dubai',
];

type Draft = {
  logoUrl: string;
  logoPosition: string;
  logoSize: string;
  tradingName: string;
  legalName: string;
  tagline: string;
  classification: string;
  taxId: string;
  registrationNumber: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
};

const FIELD_NAMES: Record<keyof Draft, string> = {
  logoUrl: 'logo', logoPosition: 'logo position', logoSize: 'logo size', tradingName: 'trading name', legalName: 'legal name', tagline: 'tagline', classification: 'classification',
  taxId: 'TIN', registrationNumber: 'registration number', line1: 'address', line2: 'address line 2', city: 'city',
  state: 'region', postalCode: 'postal code', phone: 'phone', email: 'email', website: 'website',
  timezone: 'timezone', dateFormat: 'date format', timeFormat: 'time format',
};

/** What a complete profile has: the things a guest, GRA, or a supplier reads on a document. */
const COMPLETENESS: Array<keyof Draft> = ['logoUrl', 'tradingName', 'legalName', 'taxId', 'registrationNumber', 'line1', 'city', 'phone', 'email', 'website'];

function readDraft(s: ReturnType<typeof useSettingsStore.getState>): Draft {
  const c = s.companySettings;
  const local = s.countryCompliance?.[s.defaultCountry || 'GH']?.localization;
  return {
    logoUrl: c?.logoUrl || '',
    logoPosition: s.saasSettings?.customBranding?.logoPosition || 'left',
    logoSize: s.saasSettings?.customBranding?.logoSize || 'md',
    tradingName: c?.tradingName || s.hotelSettings?.hotelName || '',
    legalName: c?.legalName || '',
    tagline: c?.tagline || '',
    classification: s.hotelSettings?.classification || '3-Star',
    taxId: c?.taxId || '',
    registrationNumber: c?.registrationNumber || '',
    line1: c?.address?.line1 || '',
    line2: c?.address?.line2 || '',
    city: c?.address?.city || '',
    state: c?.address?.state || '',
    postalCode: c?.address?.postalCode || '',
    phone: c?.contact?.phone || '',
    email: c?.contact?.email || '',
    website: c?.contact?.website || '',
    timezone: s.tenant?.metadata?.timezone || 'Africa/Accra',
    dateFormat: local?.dateFormat || 'DD/MM/YYYY',
    timeFormat: local?.timeFormat || 'HH:mm',
  };
}

/** Opens another Settings tab, optionally scrolling to a section inside it. */
function openSettingsTab(tab: string, sectionId?: string) {
  try {
    localStorage.setItem('settings.tab', tab);
    window.dispatchEvent(new Event('settings-navigate'));
    if (sectionId) setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  } catch { /* ignore */ }
}

function openComplianceTax() {
  try {
    localStorage.setItem('compliance.tab', 'tax');
    window.dispatchEvent(new CustomEvent('compliance.openTab', { detail: { tab: 'tax' } }));
    window.dispatchEvent(new CustomEvent('app.navigate', { detail: { section: 'compliance' } }));
  } catch { /* ignore */ }
}

function Section({ icon: Icon, title, hint, tone, children }: { icon: LucideIcon; title: string; hint: string; tone: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-ghana-black">{title}</h4>
          <p className="text-xs text-gray-500">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function LinkedTile({ icon: Icon, title, value, sub, onOpen }: { icon: LucideIcon; title: string; value: string; sub?: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-sm"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-teal-50 group-hover:text-teal-700">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] uppercase tracking-wide text-gray-500">{title}</span>
        <span className="block truncate text-sm font-medium text-ghana-black">{value}</span>
        {sub && <span className="block truncate text-[11px] text-gray-500">{sub}</span>}
      </span>
      <span className="text-xs font-medium text-teal-700 opacity-0 transition-opacity group-hover:opacity-100">Edit →</span>
    </button>
  );
}

/**
 * The hotel's own details after setup: name, logo, TIN, address, contacts, and how dates
 * read. Every field writes the same setting the setup wizard wrote, so documents, the
 * front desk clock, and reports all change together. Numbering, the accounting year,
 * check-in times, and taxes keep their own homes and are linked from here.
 */
export default function HotelProfilePanel() {
  const settings = useSettingsStore();
  const canEdit = settings.hasPermission('settings.manage-company') || settings.hasPermission('settings.edit');
  const saved = React.useMemo(() => readDraft(settings), [settings]);
  const [draft, setDraft] = React.useState<Draft>(saved);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const changed = (Object.keys(saved) as Array<keyof Draft>).filter((k) => saved[k] !== draft[k]);
  const dirty = changed.length > 0;

  // Pick up changes saved elsewhere (another desk, the wizard) while nothing is being edited here.
  React.useEffect(() => { if (!dirty) setDraft(saved); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 4000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const onLogo = (file?: File) => {
    if (!file || !canEdit) return;
    if (!file.type.startsWith('image/')) { alert('Choose an image file (PNG or JPG).'); return; }
    if (file.size > MAX_LOGO_BYTES) { alert('That image is over 500 KB. Use a smaller logo.'); return; }
    const reader = new FileReader();
    // Empty margins are cut on upload so the artwork, not its background, fills the space.
    reader.onload = () => { if (typeof reader.result === 'string') void trimLogo(reader.result).then((url) => set('logoUrl', url)); };
    reader.readAsDataURL(file);
  };

  const emailBad = !!draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email);
  const nameMissing = !draft.tradingName.trim();

  const save = () => {
    if (!canEdit || !dirty) return;
    if (nameMissing) { alert('The hotel needs a trading name.'); return; }
    if (emailBad) { alert('Check the email address.'); return; }
    const s = useSettingsStore.getState();
    const prev = s.companySettings;
    s.updateSetting('companySettings', {
      ...(prev as NonNullable<typeof prev>),
      tradingName: draft.tradingName.trim(),
      legalName: draft.legalName.trim(),
      tagline: draft.tagline.trim(),
      taxId: draft.taxId.trim(),
      registrationNumber: draft.registrationNumber.trim(),
      logoUrl: draft.logoUrl,
      address: {
        ...(prev?.address || { country: s.defaultCountry || 'GH' }),
        line1: draft.line1.trim(), line2: draft.line2.trim(), city: draft.city.trim(),
        state: draft.state.trim(), postalCode: draft.postalCode.trim(),
        country: prev?.address?.country || s.defaultCountry || 'GH',
      },
      contact: { phone: draft.phone.trim(), email: draft.email.trim(), website: draft.website.trim() },
    });
    if (saved.tradingName !== draft.tradingName) s.updateNestedSetting('hotelSettings.hotelName', draft.tradingName.trim());
    if (saved.classification !== draft.classification) s.updateNestedSetting('hotelSettings.classification', draft.classification);
    if (saved.logoUrl !== draft.logoUrl) s.updateNestedSetting('saasSettings.customBranding.logoUrl', draft.logoUrl);
    if (saved.logoSize !== draft.logoSize) s.updateNestedSetting('saasSettings.customBranding.logoSize', draft.logoSize);
    if (saved.logoPosition !== draft.logoPosition) s.updateNestedSetting('saasSettings.customBranding.logoPosition', draft.logoPosition);
    if (saved.timezone !== draft.timezone) s.updateNestedSetting('tenant.metadata.timezone', draft.timezone);
    if (saved.dateFormat !== draft.dateFormat || saved.timeFormat !== draft.timeFormat) {
      const country = s.defaultCountry || 'GH';
      const current = s.countryCompliance?.[country];
      if (current) {
        s.updateCountryCompliance(country, {
          dateFormat: draft.dateFormat,
          localization: { ...current.localization, dateFormat: draft.dateFormat, timeFormat: draft.timeFormat },
        });
      }
    }
    logAudit({
      area: 'settings', action: 'update', entity: 'Hotel profile', severity: changed.includes('taxId') || changed.includes('legalName') ? 'high' : 'medium',
      user: s.currentUser?.email || s.currentUser?.username,
      details: `Changed ${changed.map((k) => FIELD_NAMES[k]).join(', ')}`,
    });
    setSavedAt(Date.now());
  };

  const filled = COMPLETENESS.filter((k) => !!String(draft[k] || '').trim()).length;
  const percent = Math.round((filled / COMPLETENESS.length) * 100);
  const now = new Date();

  // Linked settings, read live from where they are edited.
  const inv = settings.invoiceSettings;
  const rcp = settings.receiptSettings;
  const yearStart = settings.companySettings?.financialYearStartDate || '';
  const yearLabel = yearStart ? formatHotelDate(yearStart, 'DD MMM YYYY').slice(0, 6) : '1 Jan';
  const checkIn = settings.hotelSettings?.checkInTime || '14:00';
  const checkOut = settings.hotelSettings?.checkOutTime || '11:00';
  const currency = settings.companySettings?.defaultCurrency || settings.financialSettings?.defaultCurrency || 'GHS';

  const addressLine = [draft.line1, draft.line2, draft.city, draft.state].filter(Boolean).join(', ');
  const contactLine = [draft.phone && `Tel: ${draft.phone}`, draft.email, draft.website].filter(Boolean).join(' • ');

  return (
    <div className="mt-2 space-y-3 pb-16">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-600 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload hotel logo"
            onClick={() => canEdit && fileRef.current?.click()}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && canEdit) fileRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); onLogo(e.dataTransfer.files?.[0]); }}
            className={`group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-xl ring-4 transition-all ${dragging ? 'scale-105 ring-amber-300' : 'ring-white/30'} ${canEdit ? 'cursor-pointer' : ''}`}
          >
            {draft.logoUrl
              ? <img src={draft.logoUrl} alt="Hotel logo" className="h-full w-full object-contain p-2" />
              : <ImagePlus className="h-8 w-8 text-teal-700/60" />}
            {canEdit && (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-4 w-4" />{draft.logoUrl ? 'Change' : 'Add logo'}
              </span>
            )}
          </div>
          {canEdit && draft.logoUrl && (
            <button type="button" onClick={() => set('logoUrl', '')} className="absolute left-5 top-[124px] inline-flex items-center gap-1 text-[11px] text-white/75 hover:text-white">
              <Trash2 className="h-3 w-3" />Remove
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = ''; }} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-2xl font-bold tracking-tight">{draft.tradingName || 'Your hotel'}</h3>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur">{draft.classification}</span>
            </div>
            <p className="mt-0.5 text-sm text-white/80">{draft.tagline || draft.legalName || 'Add a tagline guests will remember'}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {draft.taxId
                ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/25 px-2.5 py-1"><BadgeCheck className="h-3.5 w-3.5" />TIN {draft.taxId}</span>
                : <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/30 px-2.5 py-1"><ShieldAlert className="h-3.5 w-3.5" />No TIN yet: GRA invoices need it</span>}
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1"><Globe className="h-3.5 w-3.5" />{draft.timezone}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1"><CalendarDays className="h-3.5 w-3.5" />{formatHotelDate(now, draft.dateFormat)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#FCD34D" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${percent * 0.974} 100`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{percent}%</span>
            </div>
            <div className="text-xs leading-tight text-white/85">
              <div className="font-semibold text-white">Profile</div>
              {filled}/{COMPLETENESS.length} details
            </div>
          </div>
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          You can view the hotel profile. Changing it needs the “Edit the company profile” permission.
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <Section icon={Building2} title="Identity" hint="The name on every bill, and how the hotel describes itself." tone="bg-teal-50 text-teal-700">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input size="sm" label="Trading name" isRequired isDisabled={!canEdit} value={draft.tradingName} onValueChange={(v) => set('tradingName', v)} isInvalid={nameMissing} errorMessage={nameMissing ? 'Needed on every document' : undefined} />
              <Input size="sm" label="Legal name" description="As registered with the Registrar-General" isDisabled={!canEdit} value={draft.legalName} onValueChange={(v) => set('legalName', v)} />
              <Input size="sm" label="Tagline" placeholder="Service next to none" isDisabled={!canEdit} value={draft.tagline} onValueChange={(v) => set('tagline', v)} />
              <Select size="sm" label="Classification" isDisabled={!canEdit} selectedKeys={[draft.classification]} onSelectionChange={(keys) => { const k = Array.from(keys)[0]; if (k) set('classification', String(k)); }}>
                {CLASSIFICATIONS.map((c) => <SelectItem key={c}>{c}</SelectItem>)}
              </Select>
              <Select size="sm" label="Logo on documents" description="Where the logo prints on the letterhead" isDisabled={!canEdit} selectedKeys={[draft.logoPosition]} onSelectionChange={(keys) => { const k = Array.from(keys)[0]; if (k) set('logoPosition', String(k)); }}>
                {LOGO_POSITIONS.map((p) => <SelectItem key={p.key}>{p.label}</SelectItem>)}
              </Select>
              <div className="sm:col-span-2">
                <div className="mb-1 text-xs text-gray-600">Logo size on documents</div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
                    {LOGO_SIZES.map((z) => (
                      <button
                        key={z.key}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => set('logoSize', z.key)}
                        className={`min-w-9 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${draft.logoSize === z.key ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        {z.label}
                      </button>
                    ))}
                  </div>
                  {canEdit && draft.logoUrl && (
                    <Button size="sm" variant="flat" startContent={<Scissors className="h-3.5 w-3.5" />} onPress={() => { void trimLogo(draft.logoUrl).then((url) => set('logoUrl', url)); }}>
                      Trim empty edges
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section icon={ReceiptText} title="Tax & registration" hint="GRA needs the TIN printed on every VAT invoice and receipt." tone="bg-amber-50 text-amber-700">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input size="sm" label="TIN (Taxpayer Identification Number)" placeholder="C0012345678" isDisabled={!canEdit} value={draft.taxId} onValueChange={(v) => set('taxId', v.toUpperCase())} />
              <Input size="sm" label="Business registration number" placeholder="CS123456789" isDisabled={!canEdit} value={draft.registrationNumber} onValueChange={(v) => set('registrationNumber', v)} />
            </div>
          </Section>

          <Section icon={MapPin} title="Address & contact" hint="Printed under the name on invoices, receipts and quotations." tone="bg-rose-50 text-rose-700">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input size="sm" label="Address" placeholder="P. O. Box UP 688, KNUST" isDisabled={!canEdit} value={draft.line1} onValueChange={(v) => set('line1', v)} />
              <Input size="sm" label="Address line 2" placeholder="GPS: AK-819-7260" isDisabled={!canEdit} value={draft.line2} onValueChange={(v) => set('line2', v)} />
              <Input size="sm" label="City / town" isDisabled={!canEdit} value={draft.city} onValueChange={(v) => set('city', v)} />
              <Input size="sm" label="Region" isDisabled={!canEdit} value={draft.state} onValueChange={(v) => set('state', v)} />
              <Input size="sm" label="Phone" startContent={<Phone className="h-3.5 w-3.5 text-gray-400" />} isDisabled={!canEdit} value={draft.phone} onValueChange={(v) => set('phone', v)} />
              <Input size="sm" label="Email" type="email" startContent={<Mail className="h-3.5 w-3.5 text-gray-400" />} isDisabled={!canEdit} value={draft.email} onValueChange={(v) => set('email', v)} isInvalid={emailBad} errorMessage={emailBad ? 'Check this email' : undefined} />
              <Input size="sm" label="Website" startContent={<Globe className="h-3.5 w-3.5 text-gray-400" />} isDisabled={!canEdit} value={draft.website} onValueChange={(v) => set('website', v)} className="sm:col-span-2" />
            </div>
          </Section>

          <Section icon={Clock} title="Time & dates" hint="The hotel's clock and how every date prints: bills, reports, night audit." tone="bg-indigo-50 text-indigo-700">
            <div className="grid gap-3 sm:grid-cols-3">
              <Select size="sm" label="Timezone" isDisabled={!canEdit} selectedKeys={[draft.timezone]} onSelectionChange={(keys) => { const k = Array.from(keys)[0]; if (k) set('timezone', String(k)); }}>
                {Array.from(new Set([draft.timezone, ...TIMEZONES])).map((tz) => <SelectItem key={tz}>{tz.replace('_', ' ')}</SelectItem>)}
              </Select>
              <Select size="sm" label="Date format" isDisabled={!canEdit} selectedKeys={[draft.dateFormat]} onSelectionChange={(keys) => { const k = Array.from(keys)[0]; if (k) set('dateFormat', String(k)); }}>
                {DATE_FORMATS.map((f) => <SelectItem key={f.key} textValue={f.label}>{formatHotelDate(now, f.key)}</SelectItem>)}
              </Select>
              <Select size="sm" label="Time format" isDisabled={!canEdit} selectedKeys={[draft.timeFormat]} onSelectionChange={(keys) => { const k = Array.from(keys)[0]; if (k) set('timeFormat', String(k)); }}>
                {TIME_FORMATS.map((f) => <SelectItem key={f.key}>{f.label}</SelectItem>)}
              </Select>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Right now at the hotel: <strong className="text-gray-700">{formatHotelDate(now, draft.dateFormat)} · {formatHotelTime(now, draft.timeFormat)}</strong>. The books stay in {currency}. Other currencies are switched on under Operational Policies.
            </p>
          </Section>
        </div>

        {/* Right rail */}
        <div className="space-y-3 xl:sticky xl:top-3 xl:self-start">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> How documents will print
            </div>
            <div className="rounded-lg border border-dashed border-gray-300 bg-[#fdfcf9] p-3 text-center font-serif">
              <div className={`flex items-center gap-2 ${draft.logoPosition === 'center' ? 'flex-col' : draft.logoPosition === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
                {draft.logoUrl && <img src={draft.logoUrl} alt="" className={`${LOGO_SIZES.find((z) => z.key === draft.logoSize)?.preview || 'h-9'} max-w-[120px] shrink-0 object-contain`} />}
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold uppercase underline underline-offset-2">{draft.tradingName || 'Hotel name'}</div>
                  {addressLine && <div className="text-[11px] leading-tight text-gray-700">{addressLine}</div>}
                  {contactLine && <div className="text-[11px] leading-tight text-gray-700">{contactLine}</div>}
                  {draft.taxId && <div className="text-[11px] leading-tight text-gray-700">TIN: {draft.taxId}</div>}
                </div>
              </div>
              <div className="mt-2 text-xs font-bold underline">CHECK OUT BILL</div>
              <div className="mt-1 text-right text-[10px] text-gray-500">{formatHotelDate(now, draft.dateFormat)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-3 shadow-sm">
            <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Set elsewhere, used everywhere</div>
            <div className="space-y-2">
              <LinkedTile icon={Hash} title="Invoice numbers" value={formatDocumentNumber(inv)} sub={`Receipts ${formatDocumentNumber({ ...rcp, nextNumber: rcp.nextNumber || 1, numberFormat: rcp.numberFormat || "{PREFIX}{NUMBER}" })}`} onOpen={() => openSettingsTab('numbering')} />
              <LinkedTile icon={BookOpen} title="Accounting year" value={`Starts ${yearLabel}`} onOpen={() => openSettingsTab('policies', 'policy-year')} />
              <LinkedTile icon={Clock} title="Check-in · checkout" value={`${checkIn} · ${checkOut}`} onOpen={() => openSettingsTab('policies', 'policy-checkin')} />
              <LinkedTile icon={Percent} title="Taxes" value="NHIL/GETFund · VAT · Tourism Levy" sub="Rates and order: Compliance → Tax engine" onOpen={openComplianceTax} />
            </div>
          </div>
        </div>
      </div>

      {(dirty || savedAt) && canEdit && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-gray-200 bg-white/95 py-1.5 pl-4 pr-1.5 shadow-xl backdrop-blur">
            {dirty ? (
              <>
                <span className="text-xs text-gray-600">{changed.length} unsaved change{changed.length === 1 ? '' : 's'}</span>
                <Button size="sm" variant="light" onPress={() => setDraft(saved)}>Discard</Button>
                <Button size="sm" className="rounded-full bg-teal-700 text-white" onPress={save}>Save profile</Button>
              </>
            ) : (
              <span className="flex items-center gap-1.5 py-1 pr-3 text-xs font-medium text-emerald-700"><BadgeCheck className="h-4 w-4" />Saved. New documents use it now.</span>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
