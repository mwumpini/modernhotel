'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Card, CardHeader, CardBody, Input, Autocomplete, AutocompleteItem, Button } from '@heroui/react';
import { useSettingsStore } from '../../lib/settings/store';
import { COUNTRIES } from '../../lib/countries';
import { trackEvent } from '../../lib/analytics/trackEvent';

export default function ClientSettingsPanel() {
  const settings = useSettingsStore();
  const [localPrefix, setLocalPrefix] = useState(settings.clientSettings.prefix || 'C');
  const [localSuffix, setLocalSuffix] = useState(settings.clientSettings.suffix || '');
  const [localNumberFormat, setLocalNumberFormat] = useState(settings.clientSettings.numberFormat || 'C{NUMBER}');
  const [localNextNumber, setLocalNextNumber] = useState<number>(settings.clientSettings.nextNumber || 1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const padFromFormat = (format: string) => {
    const match = format.match(/\{NUMBER:(0+)\}/);
    if (match && match[1]) return match[1].length;
    // Default to 3 like current store implementation
    return 3;
  };

  const formatId = (type: 'individual' | 'corporate') => {
    const width = padFromFormat(localNumberFormat);
    const formattedNumber = String(localNextNumber).padStart(width, '0');
    const typePrefix = type === 'corporate' ? 'CORP' : 'IND';
    // Support commonly used tokens; non-present tokens are no-ops
    let out = localNumberFormat
      .replace('{PREFIX}', localPrefix)
      .replace('{SUFFIX}', localSuffix)
      .replace('{TYPE_PREFIX}', typePrefix)
      .replace('{NUMBER}', formattedNumber)
      .replace(`{NUMBER:${'0'.repeat(width)}}`, formattedNumber);
    // Fallback if format lacks prefix/suffix tokens
    if (!out.includes(localPrefix) && localPrefix) {
      out = `${localPrefix}${typePrefix ? '-' + typePrefix : ''}${out}`;
    }
    if (localSuffix && !out.endsWith(localSuffix)) {
      out = `${out}${localSuffix}`;
    }
    return out;
  };

  const countryOptions = useMemo(() => COUNTRIES, []);

  const handleSaveIds = () => {
    settings.updateClientSettings({
      prefix: localPrefix,
      suffix: localSuffix,
      nextNumber: localNextNumber,
      numberFormat: localNumberFormat,
    });
    trackEvent('Settings.Updated', { section: 'clientSettings.id' });
  };

  const handleCountryChange = (code: string) => {
    settings.updateSetting('defaultCountry', code);
    trackEvent('Settings.Updated', { section: 'clientSettings.defaultCountry', code });
  };

  const handleExport = () => {
    const payload = {
      clientSettings: {
        prefix: localPrefix,
        suffix: localSuffix,
        nextNumber: localNextNumber,
        numberFormat: localNumberFormat,
      },
      defaultCountry: settings.defaultCountry,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-settings-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    trackEvent('Settings.Exported', { section: 'clientSettings' });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const json = JSON.parse(text);
      if (json.clientSettings) {
        const cs = json.clientSettings as Partial<typeof settings.clientSettings>;
        settings.updateClientSettings({
          prefix: cs.prefix ?? settings.clientSettings.prefix,
          suffix: cs.suffix ?? settings.clientSettings.suffix,
          nextNumber: typeof cs.nextNumber === 'number' ? cs.nextNumber : settings.clientSettings.nextNumber,
          numberFormat: cs.numberFormat ?? settings.clientSettings.numberFormat,
        });
        setLocalPrefix(cs.prefix ?? settings.clientSettings.prefix);
        setLocalSuffix(cs.suffix ?? settings.clientSettings.suffix);
        setLocalNumberFormat(cs.numberFormat ?? settings.clientSettings.numberFormat);
        setLocalNextNumber(typeof cs.nextNumber === 'number' ? cs.nextNumber : settings.clientSettings.nextNumber);
      }
      if (json.defaultCountry && typeof json.defaultCountry === 'string') {
        settings.updateSetting('defaultCountry', json.defaultCountry);
      }
      trackEvent('Settings.Imported', { section: 'clientSettings' });
      // Reset input for subsequent imports of same file
      e.target.value = '';
    } catch (err) {
      console.error('Import error', err);
      trackEvent('Settings.Error', { section: 'clientSettings', error: 'import_failed' });
      alert('Failed to import settings. Please check the JSON format.');
    }
  };

  const handleResetDefaults = () => {
    // Reset only ID-related fields to safe defaults used across the app
    const defaults = {
      prefix: 'C',
      suffix: '',
      nextNumber: 1,
      numberFormat: 'C{NUMBER}',
    };
    settings.updateClientSettings(defaults);
    setLocalPrefix(defaults.prefix);
    setLocalSuffix(defaults.suffix);
    setLocalNumberFormat(defaults.numberFormat);
    setLocalNextNumber(defaults.nextNumber);
    trackEvent('Settings.Reset', { section: 'clientSettings.id' });
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <h3 className="text-lg font-semibold">Client ID Configuration</h3>
            <div className="text-sm text-gray-500">
              Tokens: <code className="px-1">{`{PREFIX}`}</code> <code className="px-1">{`{TYPE_PREFIX}`}</code> <code className="px-1">{`{NUMBER}`}</code> <code className="px-1">{`{NUMBER:000000}`}</code> <code className="px-1">{`{SUFFIX}`}</code>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
            <Button variant="flat" onPress={handleExport}>Export</Button>
            <Button variant="flat" onPress={handleImportClick}>Import</Button>
            <Button color="danger" variant="flat" onPress={handleResetDefaults}>Reset to Defaults</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              label="Prefix"
              placeholder="C"
              value={localPrefix}
              onChange={(e) => setLocalPrefix(e.target.value.toUpperCase())}
            />
            <Input
              label="Suffix"
              placeholder=""
              value={localSuffix}
              onChange={(e) => setLocalSuffix(e.target.value.toUpperCase())}
            />
            <Input
              label="Number Format"
              description="Use {NUMBER} or {NUMBER:000000}"
              placeholder="{PREFIX}-{TYPE_PREFIX}-{NUMBER:000000}"
              value={localNumberFormat}
              onChange={(e) => setLocalNumberFormat(e.target.value)}
            />
            <Input
              type="number"
              label="Next Number"
              value={String(localNextNumber)}
              onChange={(e) => setLocalNextNumber(Number(e.target.value || 1))}
              min={1}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Preview (Individual)</div>
              <div className="px-3 py-2 rounded bg-gray-50 text-ghana-black font-mono">{formatId('individual')}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Preview (Corporate)</div>
              <div className="px-3 py-2 rounded bg-gray-50 text-ghana-black font-mono">{formatId('corporate')}</div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button color="primary" onPress={handleSaveIds}>Save ID Settings</Button>
          </div>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <h3 className="text-lg font-semibold">Default Compliance Country</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Autocomplete
              label="Default Country"
              placeholder="Select country"
              defaultSelectedKey={settings.defaultCountry}
              selectedKey={settings.defaultCountry}
              onSelectionChange={(key) => {
                if (typeof key === 'string') handleCountryChange(key);
                if (key && typeof key === 'object') {
                  const val = Array.from(key as Set<string>)[0];
                  if (val) handleCountryChange(val);
                }
              }}
            >
              {countryOptions.map((c) => (
                <AutocompleteItem key={c.code} textValue={`${c.name} (${c.code})`}>
                  {c.name} ({c.code})
                </AutocompleteItem>
              ))}
            </Autocomplete>
            <div className="text-sm text-gray-500 self-end">
              This sets the default nationality and local/foreigner logic in client forms.
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


