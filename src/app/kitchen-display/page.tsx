'use client';

import dynamic from 'next/dynamic';

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
  return <KitchenDisplaySystem />;
}
