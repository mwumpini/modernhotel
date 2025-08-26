'use client';

import React from 'react';
import { Select, SelectItem } from "@heroui/react";
import { useComplianceStore } from '@/app/lib/compliance/store';

const countries = [
  { code: 'GH', name: '🇬🇭 Ghana', flag: '🇬🇭' },
  { code: 'ZW', name: '🇿🇼 Zimbabwe', flag: '🇿🇼' },
  { code: 'US', name: '🇺🇸 United States', flag: '🇺🇸' }
];

export default function CountrySelector() {
  const { country, setCountry, isLoading } = useComplianceStore();

  const handleCountryChange = async (value: string) => {
    if (value && value !== country) {
      await setCountry(value);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm font-medium text-gray-700">Country:</span>
      <Select
        selectedKeys={[country]}
        onSelectionChange={(keys) => {
          const selectedKey = Array.from(keys)[0] as string;
          handleCountryChange(selectedKey);
        }}
        className="w-48"
        isDisabled={isLoading}
        variant="bordered"
        size="sm"
      >
        {countries.map((countryOption) => (
          <SelectItem key={countryOption.code}>
            <div className="flex items-center space-x-2">
              <span className="text-lg">{countryOption.flag}</span>
              <span>{countryOption.name}</span>
            </div>
          </SelectItem>
        ))}
      </Select>
      {isLoading && (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ghana-green"></div>
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      )}
    </div>
  );
}
