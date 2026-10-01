'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSettingsStore } from '../lib/settings/store';

const KitchenDisplaySystem = dynamic(
  () => import('../components/KitchenDisplaySystem'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-3">
        <div className="text-5xl">🍳</div>
        <p className="text-lg font-semibold animate-pulse">Starting kitchen screen…</p>
      </div>
    ),
  }
);

export default function KitchenDisplayPage() {
  const kitchenOn = useSettingsStore((s) => s.moduleSettings.kitchenTerminal !== false);
  if (!kitchenOn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-950 px-6 text-center text-white">
        <p className="text-lg font-semibold">Kitchen terminal is off</p>
        <p className="max-w-md text-sm text-gray-300">Turn it on under Settings → Modules. Orders are taken on the POS, and tickets are printed from the order panel.</p>
        <Link href="/" className="text-sm font-semibold text-white underline">Back to the hotel</Link>
      </div>
    );
  }
  return <KitchenDisplaySystem />;
}
