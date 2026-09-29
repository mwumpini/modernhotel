'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { getClientTenantSubdomain } from '../../lib/api/clientTenant';

/** Where the POS / menu screens load a menu item's photo from (see /api/fb/menu/image). */
export function menuImageSrc(id: string, version?: number): string {
  const t = encodeURIComponent(getClientTenantSubdomain() || '');
  return `/api/fb/menu/image?t=${t}&id=${encodeURIComponent(id)}${version ? `&v=${version}` : ''}`;
}

/** Shrinks a picked photo to a small JPEG (≤ 480px on the long side) so it stays light for every terminal. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Not an image'));
      el.src = url;
    });
    const scale = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#fff'; // transparent PNGs become white, not black, as JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Photo field for the menu item form.
 * value: undefined = keep what is saved, '' = remove the photo, a data URL = new photo.
 */
export default function MenuPhotoPicker({
  savedSrc,
  value,
  onChange,
}: {
  savedSrc?: string | null;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState('');
  const shown = value === undefined ? savedSrc || null : value || null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const data = await shrinkPhoto(file);
      if (data.length > 380_000) { setError('That photo is too large even after shrinking. Try another one.'); return; }
      onChange(data);
    } catch {
      setError('That file is not a photo we can read. Use a JPEG or PNG.');
    }
  };

  return (
    <div className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-xs text-slate-400">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- small data/API image, not worth next/image here
          <img src={shown} alt="Menu item photo" className="h-full w-full object-cover" />
        ) : 'No photo'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ghana-black">Photo (optional)</p>
        <p className="text-xs text-slate-500">Shown on the POS when &ldquo;show menu photos&rdquo; is on in Settings → Security.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          <Button size="sm" variant="flat" onPress={() => inputRef.current?.click()}>{shown ? 'Change photo' : 'Add photo'}</Button>
          {shown && <Button size="sm" variant="light" color="danger" onPress={() => onChange('')}>Remove</Button>}
        </div>
        {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
      </div>
    </div>
  );
}
