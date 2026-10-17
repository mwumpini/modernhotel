'use client';

import React from 'react';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { getZonedClockParts } from '../lib/frontoffice/propertyTime';
import { resolvePropertyTimezone } from '../lib/frontoffice/propertyTimeClient';
import { isWakeUpDue } from '../lib/frontoffice/wakeUpDue';
import type { WakeUpCall } from '../lib/frontoffice/types';

function roomLabel(call: WakeUpCall) {
  return call.roomNumber && call.roomNumber !== 'TBD' ? `Room ${call.roomNumber}` : 'No room';
}

function beep(ctx: AudioContext) {
  const tone = (frequency: number, at: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.24);
  };
  const start = ctx.currentTime;
  tone(880, start);
  tone(660, start + 0.28);
}

export default function WakeUpWatcher() {
  const [due, setDue] = React.useState<WakeUpCall[]>([]);
  const [quiet, setQuiet] = React.useState<Set<string>>(() => new Set());

  const refresh = React.useCallback(() => {
    const clock = getZonedClockParts(new Date(), resolvePropertyTimezone());
    setDue(frontOfficeStore.wakeUpCalls.filter((call) => isWakeUpDue(call, clock)));
  }, []);

  React.useEffect(() => {
    refresh();
    const unsub = frontOfficeStore.subscribe(refresh);
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [refresh]);

  const alarming = due.some((call) => call.alert === 'alarm' && !quiet.has(call.id));

  React.useEffect(() => {
    if (!alarming || typeof window === 'undefined') return;
    const ctx = new AudioContext();
    const play = () => {
      if (ctx.state === 'suspended') void ctx.resume();
      if (ctx.state !== 'running') return;
      beep(ctx);
    };
    play();
    const timer = window.setInterval(play, 4000);
    const unlock = () => { void ctx.resume().then(play); };
    window.addEventListener('pointerdown', unlock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', unlock);
      void ctx.close();
    };
  }, [alarming]);

  if (due.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[9998] flex justify-center px-3">
      <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2">
        {due.map((call) => (
          <div key={call.id} role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 shadow-lg">
            <div className="text-sm font-semibold text-amber-950">
              Wake-up · {roomLabel(call)} · {call.time.slice(0, 5)}
            </div>
            <p className="text-sm text-amber-900">
              {call.guestName}
              {call.notes ? ` · ${call.notes}` : ''}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-md bg-ghana-green px-2.5 py-1 text-xs font-semibold text-white"
                onClick={() => frontOfficeStore.completeWakeUpCall(call.id)}
              >
                Done
              </button>
              {call.alert === 'alarm' && !quiet.has(call.id) && (
                <button
                  type="button"
                  className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-amber-950"
                  onClick={() => setQuiet((current) => new Set(current).add(call.id))}
                >
                  Quiet
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
