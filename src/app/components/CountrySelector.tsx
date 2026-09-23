'use client';

import React, { useEffect } from 'react';
import { Select, SelectItem } from "@heroui/react";
import { useComplianceStore } from '@/app/lib/compliance/store';
import { resolveSupportedComplianceCountries } from '@/app/lib/compliance/resolveCountry';
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
    <div className="flex items-center gap-2">
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
        placeholder="Country"
        isLoading={isLoading}
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
    </div>
  );
}
