'use client';

import React, { useMemo, useState } from 'react';
import { Input, Select, SelectItem, Button, Divider, Switch, Textarea, Chip } from '@heroui/react';
import { frontOfficeStore } from '../lib/frontoffice/store';

export interface GuestFormValues {
  isBusiness: boolean;
  // Individual
  surname?: string;
  firstName?: string;
  otherNames?: string;
  phone?: string;
  email?: string;
  dob?: string;
  gender?: 'male'|'female'|'other';
  nationality?: string;

  // Business
  companyName?: string;
  companyAddress?: string;
  contactPerson?: string;
  companyPhone?: string;
  companyEmail?: string;
  billingInstruction?: 'guest'|'company'|'split';

  // Identification
  idType?: 'passport'|'ghanacard'|'voter'|'driver';
  idNumber?: string;
  idIssueDate?: string;
  idExpiryDate?: string;
  idPlaceOfIssue?: string;

  // Travel
  visitPurpose?: 'business'|'tourism'|'conference'|'transit'|'other';
  travelingFrom?: string;
  nextDestination?: string;
  transportMode?: 'air'|'road'|'sea';
  transportNo?: string;

  // Booking prefs (optional capture)
  preferredRoomType?: string;
  preferredFloor?: string;
  accessibility?: 'none'|'wheelchair'|'ground'|'lift';
  allergies?: string;
  requestedServices?: string;
  marketingSource?: string;
  notes?: string;
  referralGuestId?: string;
  referralName?: string;
  socialPlatform?: 'facebook'|'instagram'|'tiktok'|'twitter'|'youtube'|'linkedin'|'whatsapp';
  socialHandle?: string;
  campaignCode?: string;
}

interface GuestFormProps {
  initial?: Partial<GuestFormValues>;
  onSubmit: (values: GuestFormValues) => void;
  onCancel?: () => void;
}

export default function GuestForm({ initial, onSubmit, onCancel }: GuestFormProps) {
  const [isBusiness, setIsBusiness] = useState<boolean>(Boolean(initial?.isBusiness));
  const [values, setValues] = useState<GuestFormValues>({ isBusiness: Boolean(initial?.isBusiness), ...initial });

  const set = (patch: Partial<GuestFormValues>) => setValues(prev => ({ ...prev, ...patch }));

  const fullName = useMemo(() => {
    if (isBusiness) return values.companyName || '';
    return [values.firstName, values.otherNames, values.surname].filter(Boolean).join(' ').trim();
  }, [isBusiness, values.firstName, values.otherNames, values.surname, values.companyName]);

  const isValid = useMemo(() => {
    if (!fullName) return false;
    if (!isBusiness && !values.phone) return false;
    if (isBusiness && !values.companyPhone) return false;
    return true;
  }, [fullName, isBusiness, values.phone, values.companyPhone]);

  return (
    <div className="w-full p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Guest Registration</h2>
          <p className="text-sm text-gray-600 mt-1">
            Client ID: <span className="font-mono font-semibold text-blue-600">{frontOfficeStore.getNextClientNumber()}</span>
          </p>
        </div>
        <Chip size="sm" color={isValid ? 'success' : 'warning'}>{isValid ? 'Ready' : 'Incomplete'}</Chip>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span className="font-medium">Individual</span>
        <Switch checked={isBusiness} onChange={(e) => { setIsBusiness(e.target.checked); set({ isBusiness: e.target.checked }); }} />
        <span className="font-medium">Business</span>
      </div>

      {!isBusiness ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Input label="Surname" value={values.surname || ''} onChange={(e)=> set({ surname: e.target.value })} required />
          <Input label="First Name" value={values.firstName || ''} onChange={(e)=> set({ firstName: e.target.value })} required />
          <Input label="Other Names" value={values.otherNames || ''} onChange={(e)=> set({ otherNames: e.target.value })} />
          <Input label="Phone Number" value={values.phone || ''} onChange={(e)=> set({ phone: e.target.value })} required placeholder="e.g. 024xxxxxxx" />
          <Input label="Email Address" value={values.email || ''} onChange={(e)=> set({ email: e.target.value })} type="email" />
          <Input label="Date of Birth" value={values.dob || ''} onChange={(e)=> set({ dob: e.target.value })} type="date" />
          <Select label="Gender" selectedKeys={values.gender ? [values.gender] : []} onSelectionChange={(k)=> set({ gender: Array.from(k as Set<string>)[0] as 'male' | 'female' | 'other' })}>
            <SelectItem key="male">Male</SelectItem>
            <SelectItem key="female">Female</SelectItem>
            <SelectItem key="other">Other</SelectItem>
          </Select>
          <Input label="Nationality" value={values.nationality || ''} onChange={(e)=> set({ nationality: e.target.value })} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Input label="Company Name" value={values.companyName || ''} onChange={(e)=> set({ companyName: e.target.value })} required />
          <Input label="Company Address" value={values.companyAddress || ''} onChange={(e)=> set({ companyAddress: e.target.value })} />
          <Input label="Contact Person" value={values.contactPerson || ''} onChange={(e)=> set({ contactPerson: e.target.value })} />
          <Input label="Company Phone" value={values.companyPhone || ''} onChange={(e)=> set({ companyPhone: e.target.value })} required />
          <Input label="Company Email" value={values.companyEmail || ''} onChange={(e)=> set({ companyEmail: e.target.value })} type="email" />
          <Select label="Billing Instructions" selectedKeys={values.billingInstruction ? [values.billingInstruction] : []} onSelectionChange={(k)=> set({ billingInstruction: Array.from(k as Set<string>)[0] as 'guest' | 'company' | 'split' })}>
            <SelectItem key="guest">Guest Pays</SelectItem>
            <SelectItem key="company">Company Pays</SelectItem>
            <SelectItem key="split">Split Billing</SelectItem>
          </Select>
        </div>
      )}

      <Divider className="my-6" />

      <h3 className="text-xl font-semibold mb-4">Identification</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Select label="ID Type" selectedKeys={values.idType ? [values.idType] : []} onSelectionChange={(k)=> set({ idType: Array.from(k as Set<string>)[0] as 'passport' | 'ghanacard' | 'voter' | 'driver' })}>
          <SelectItem key="passport">Passport</SelectItem>
          <SelectItem key="ghanacard">Ghana Card</SelectItem>
          <SelectItem key="voter">Voter&apos;s ID</SelectItem>
          <SelectItem key="driver">Driver&apos;s License</SelectItem>
        </Select>
        <Input label="ID Number" value={values.idNumber || ''} onChange={(e)=> set({ idNumber: e.target.value })} required />
        <Input label="Date of Issue" value={values.idIssueDate || ''} onChange={(e)=> set({ idIssueDate: e.target.value })} type="date" />
        <Input label="Expiry Date" value={values.idExpiryDate || ''} onChange={(e)=> set({ idExpiryDate: e.target.value })} type="date" />
        <Input label="Place of Issue" value={values.idPlaceOfIssue || ''} onChange={(e)=> set({ idPlaceOfIssue: e.target.value })} />
      </div>

      <Divider className="my-6" />

      <h3 className="text-xl font-semibold mb-4">Travel Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Select label="Purpose of Visit" selectedKeys={values.visitPurpose ? [values.visitPurpose] : []} onSelectionChange={(k)=> set({ visitPurpose: Array.from(k as Set<string>)[0] as any })}>
          <SelectItem key="business">Business</SelectItem>
          <SelectItem key="tourism">Tourism</SelectItem>
          <SelectItem key="conference">Conference</SelectItem>
          <SelectItem key="transit">Transit</SelectItem>
          <SelectItem key="other">Other</SelectItem>
        </Select>
        <Input label="Traveling From" value={values.travelingFrom || ''} onChange={(e)=> set({ travelingFrom: e.target.value })} />
        <Input label="Next Destination" value={values.nextDestination || ''} onChange={(e)=> set({ nextDestination: e.target.value })} />
        <Select label="Mode of Transport" selectedKeys={values.transportMode ? [values.transportMode] : []} onSelectionChange={(k)=> set({ transportMode: Array.from(k as Set<string>)[0] as any })}>
          <SelectItem key="air">Air</SelectItem>
          <SelectItem key="road">Road</SelectItem>
          <SelectItem key="sea">Sea</SelectItem>
        </Select>
        <Input label="Vehicle/Flight Number" value={values.transportNo || ''} onChange={(e)=> set({ transportNo: e.target.value })} />
      </div>

      <Divider className="my-6" />

      <h3 className="text-xl font-semibold mb-4">Special Requests</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Textarea label="Allergies / Medical Notes" value={values.allergies || ''} onChange={(e)=> set({ allergies: e.target.value })} placeholder="List any allergies or medical conditions" />
        <Textarea label="Services Requested" value={values.requestedServices || ''} onChange={(e)=> set({ requestedServices: e.target.value })} placeholder="e.g. Airport pickup, Laundry, Extra bed" />
        <Select label="Accessibility Needs" selectedKeys={values.accessibility ? [values.accessibility] : []} onSelectionChange={(k)=> set({ accessibility: Array.from(k as Set<string>)[0] as any })}>
          <SelectItem key="none">None</SelectItem>
          <SelectItem key="wheelchair">Wheelchair Accessible Room</SelectItem>
          <SelectItem key="ground">Ground Floor Preferred</SelectItem>
          <SelectItem key="lift">Near Lift</SelectItem>
        </Select>
        <Input label="Preferred Floor" value={values.preferredFloor || ''} onChange={(e)=> set({ preferredFloor: e.target.value })} type="number" min={0} placeholder="Enter floor number if any" />
      </div>

      <Divider className="my-6" />

      <h3 className="text-xl font-semibold mb-4">Marketing Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="How did you hear about us?" selectedKeys={values.marketingSource ? [values.marketingSource] : []} onSelectionChange={(k)=> set({ marketingSource: Array.from(k as Set<string>)[0] })}>
          <SelectItem key="walkin">Walk-in</SelectItem>
          <SelectItem key="friend">Friend / Family</SelectItem>
          <SelectItem key="referral">Customer Referral</SelectItem>
          <SelectItem key="online">Online Search</SelectItem>
          <SelectItem key="booking">Booking.com</SelectItem>
          <SelectItem key="social">Social Media</SelectItem>
          <SelectItem key="corporate">Corporate Booking</SelectItem>
          <SelectItem key="other">Other</SelectItem>
        </Select>
        {(values.marketingSource === 'referral') && (
          <Input label="Referrer Name or Guest ID" value={values.referralName || values.referralGuestId || ''} onChange={(e)=> set({ referralName: e.target.value })} placeholder="Search name or paste Guest ID" />
        )}
        {(values.marketingSource === 'social') && (
          <Select label="Social Platform" selectedKeys={values.socialPlatform ? [values.socialPlatform] : []} onSelectionChange={(k)=> set({ socialPlatform: Array.from(k as Set<string>)[0] as any })}>
            <SelectItem key="facebook">Facebook</SelectItem>
            <SelectItem key="instagram">Instagram</SelectItem>
            <SelectItem key="tiktok">TikTok</SelectItem>
            <SelectItem key="twitter">Twitter/X</SelectItem>
            <SelectItem key="youtube">YouTube</SelectItem>
            <SelectItem key="linkedin">LinkedIn</SelectItem>
            <SelectItem key="whatsapp">WhatsApp</SelectItem>
          </Select>
        )}
        {(values.marketingSource === 'social') && (
          <Input label="Social Handle / Link" value={values.socialHandle || ''} onChange={(e)=> set({ socialHandle: e.target.value })} placeholder="@user or https://..." />
        )}
        <Input label="Campaign Code (optional)" value={values.campaignCode || ''} onChange={(e)=> set({ campaignCode: e.target.value })} placeholder="e.g. EAS-APRIL-15" />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        {onCancel && (
          <Button variant="light" onClick={onCancel}>Cancel</Button>
        )}
        <Button color="primary" className="bg-ghana-green text-white" isDisabled={!isValid} onClick={() => onSubmit({ ...values, isBusiness })}>
          Submit Registration
        </Button>
      </div>
    </div>
  );
}


