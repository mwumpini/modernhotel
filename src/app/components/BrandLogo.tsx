import React from 'react';
import { Poppins } from 'next/font/google';

/** AGM Sync brand: teal tile (linked roof, gold door) + "AGM Sync" in heavy Poppins. */
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '800'], display: 'swap' });

export const BRAND_NAME = 'AGM Sync';
export const BRAND_TAGLINE = 'Your property, simply connected.';

export function BrandMark({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90" className={className} role="img" aria-label={BRAND_NAME}>
      <rect width="90" height="90" rx="20" fill="#0B5F64" />
      <g strokeWidth="11" strokeLinecap="round" fill="none">
        <line x1="45" y1="20" x2="24" y2="57" stroke="#FFFFFF" />
        <line x1="16" y1="71" x2="63" y2="71" stroke="#BFE3E0" />
        <line x1="74" y1="71" x2="51" y2="32" stroke="#E6F4F2" />
      </g>
      <rect x="40" y="53" width="11" height="18" rx="5.5" fill="#E9A23B" />
    </svg>
  );
}

/** "AGM" in teal, "Sync" in the page's text colour, so it reads on light and dark screens. */
export function BrandWordmark({ className = '', syncClass = 'text-foreground' }: { className?: string; syncClass?: string }) {
  return (
    <span className={`${poppins.className} font-extrabold leading-none tracking-tight ${className}`}>
      <span style={{ color: '#0E7C80' }}>AGM</span>
      <span className={syncClass}> Sync</span>
    </span>
  );
}

export default function BrandLogo({
  size = 'md',
  tagline = true,
  stacked = false,
  className = '',
  syncClass,
}: {
  size?: 'sm' | 'md' | 'lg';
  tagline?: boolean;
  stacked?: boolean;
  className?: string;
  /** For a surface that stays white in dark mode (the login card). */
  syncClass?: string;
}) {
  const mark = { sm: 40, md: 52, lg: 72 }[size];
  const word = { sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl' }[size];
  const tag = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }[size];
  return (
    <div className={`flex ${stacked ? 'flex-col items-center text-center gap-3' : 'items-center gap-3'} ${className}`}>
      <BrandMark size={mark} className="shrink-0" />
      <div className="min-w-0">
        <BrandWordmark className={word} syncClass={syncClass} />
        {tagline && <p className={`${poppins.className} ${tag} mt-1 text-default-500`}>{BRAND_TAGLINE}</p>}
      </div>
    </div>
  );
}
