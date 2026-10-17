'use client';

import React from 'react';

export type HotelAddressMode = 'cloud' | 'local' | '';

export function useHotelAddress(): { address: string; mode: HotelAddressMode } {
  const [address, setAddress] = React.useState('');
  const [mode, setMode] = React.useState<HotelAddressMode>('');

  React.useEffect(() => {
    const hostname = window.location.hostname;
    const cloud = hostname === 'agmsync.com' || hostname.endsWith('.agmsync.com');
    if (cloud) {
      setAddress(window.location.origin);
      setMode('cloud');
      return;
    }
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      setAddress(window.location.origin);
      setMode('local');
      return;
    }
    let cancelled = false;
    fetch('/api/hotel-address')
      .then((response) => response.json())
      .then((data: { url?: string; mode?: HotelAddressMode }) => {
        if (cancelled) return;
        setAddress(data.url || window.location.origin);
        setMode(data.mode === 'cloud' ? 'cloud' : 'local');
      })
      .catch(() => {
        if (cancelled) return;
        setAddress(window.location.origin);
        setMode('local');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { address, mode };
}
