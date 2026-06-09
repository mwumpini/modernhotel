'use client';

import React, { useEffect } from 'react';
import { Select, SelectItem } from "@heroui/react";
import { useComplianceStore } from '@/app/lib/compliance/store';
import { resolveSupportedComplianceCountries } from '@/app/lib/compliance/resolveCountry';
import { getComplianceCountry } from '@/app/lib/compliance/config';
import { useSettingsStore } from '@/app/lib/settings/store';

export default function CountrySelector() {
  const { country, setCountry, isLoading } = useComplianceStore();
  const defaultCountry = useSettingsStore((s) => s.defaultCountry);
  const supportedCountries = useSettingsStore((s) => s.supportedCountries);

  const countryOptions = React.useMemo(
    () => resolveSupportedComplianceCountries(),
    [defaultCountry, supportedCountries]
  );

  useEffect(() => {
    void useComplianceStore.getState().syncCountryFromSetup();
  }, [defaultCountry]);

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
        className="w-52"
        isDisabled={isLoading}
        variant="bordered"
        size="sm"
        aria-label="Compliance country"
      >
        {countryOptions.map((countryOption) => (
          <SelectItem key={countryOption.code} textValue={countryOption.name}>
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
      {!isLoading && getComplianceCountry(country) && (
        <span className="text-xs text-gray-500 hidden lg:inline">
          from Setup
        </span>
      )}
    </div>
  );
}
