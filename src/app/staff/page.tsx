'use client';

import React from 'react';
import BrandLogo from '../components/BrandLogo';
import { useHotelAddress } from '../lib/useHotelAddress';

export default function StaffIconPage() {
  const { address, mode } = useHotelAddress();
  const [copied, setCopied] = React.useState(false);
  const steps = [
    {
      title: 'Android',
      lines: [`Open ${address || 'the hotel address'} in Chrome.`, 'Tap the menu, then Add to Home screen.', 'The AGM Sync icon opens the hotel page.'],
    },
    {
      title: 'iPhone and iPad',
      lines: [`Open ${address || 'the hotel address'} in Safari.`, 'Tap Share, then Add to Home Screen.', 'The AGM Sync icon opens the hotel page.'],
    },
    {
      title: 'Windows',
      lines: [`Open ${address || 'the hotel address'} in Chrome or Edge.`, 'Open the menu and choose Create shortcut, or Apps then Install.', 'The AGM Sync icon opens the hotel page.'],
    },
    {
      title: 'Mac',
      lines: [`Open ${address || 'the hotel address'}.`, 'In Safari, choose File then Add to Dock. In Chrome, choose Create shortcut.', 'The AGM Sync icon opens the hotel page.'],
    },
  ];

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B5F64] via-[#0E7C80] to-[#E9A23B] px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <BrandLogo size="md" />
        <h1 className="mt-6 text-xl font-semibold text-ghana-black">Save an icon</h1>
        {mode === 'cloud' ? (
          <p className="mt-2 text-sm text-gray-600">
            This is the cloud hotel. Save <a href={address} className="font-semibold text-[#0E7C80]">{address}</a> the same way you save any webpage. Every device that opens it shares the cloud records.
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            This computer is the hotel server. Phones, tablets, and other computers on this same Wi-Fi open <a href={address || undefined} className="font-semibold text-[#0E7C80]">{address || 'the address below'}</a>. They share this computer’s records. The cloud site is a separate copy.
          </p>
        )}
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-ghana-black">{address || 'Finding the address…'}</span>
          <button type="button" className="shrink-0 text-sm font-semibold text-[#0E7C80]" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="mt-6 space-y-4">
          {steps.map((step) => (
            <section key={step.title}>
              <h2 className="text-sm font-semibold text-ghana-black">{step.title}</h2>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-gray-600">
                {step.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
