'use client';

import { openHROverview } from '../lib/api/appNavigation';

export default function HRBackButton({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      className={`mb-3 -ml-2 px-4 py-2 rounded-xl text-ghana-green font-semibold hover:bg-gray-100 ${className}`}
      onClick={openHROverview}
    >
      ← Back to HR
    </button>
  );
}
