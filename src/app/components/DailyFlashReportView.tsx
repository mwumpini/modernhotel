'use client';

import React from 'react';

export type DailyFlashReport = {
  date: string;
  occupancy: {
    totalRooms: number;
    occupiedRooms: number;
    occupancyRate: number;
    availableRooms: number;
    outOfOrderRooms?: number;
    guestsInHouse: number;
  };
  movement: {
    arrivals: number;
    guaranteedArrivals: number;
    departures: number;
    stayOvers: number;
    noShows: number;
  };
  revenue: {
    roomRevenue: number;
    foodBeverageRevenue: number;
    otherRevenue: number;
    totalRevenue: number;
    averageDailyRate: number;
    revenuePerAvailableRoom: number;
  };
  collections: {
    totalPayments: number;
    cashOnHand: number;
    /** What in-house guests owe as of the end of the date, from their folios. */
    inHouseBalanceDue: number;
  };
  exceptions: {
    highBalanceFolios: number;
  };
  arrivals?: { total: number; guaranteed?: number; walkIns?: number };
};

function money(value: number) {
  return `GH₵ ${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatBusinessDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function Metric({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 font-semibold tabular-nums text-slate-950 ${emphasize ? 'text-2xl' : 'text-lg'}`}>{value}</div>
    </div>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-6 py-1.5 text-sm ${strong ? 'border-t border-slate-200 pt-2 font-semibold' : 'text-slate-700'}`}>
      <span>{label}</span>
      <span className="tabular-nums text-slate-950">{value}</span>
    </div>
  );
}

export default function DailyFlashReportView({ flash }: { flash: DailyFlashReport }) {
  const { occupancy, movement, revenue, collections, exceptions } = flash;
  const ooo = occupancy.outOfOrderRooms;

  return (
    <div className="w-full space-y-5">
      <div className="flex items-end justify-between border-b border-slate-200 pb-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Manager flash</div>
          <div className="mt-1 text-2xl font-bold text-slate-950">{formatBusinessDate(flash.date)}</div>
        </div>
        <div className="text-right text-sm text-slate-600">
          {occupancy.occupiedRooms} of {occupancy.totalRooms} rooms sold
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Occupancy" value={`${occupancy.occupancyRate.toFixed(1)}%`} emphasize />
        <Metric label="ADR" value={money(revenue.averageDailyRate)} />
        <Metric label="RevPAR" value={money(revenue.revenuePerAvailableRoom)} />
        <Metric label="Room revenue" value={money(revenue.roomRevenue)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Rooms</h3>
          <Line label="Occupied" value={String(occupancy.occupiedRooms)} />
          <Line label="Available" value={String(occupancy.availableRooms)} />
          {ooo !== undefined && <Line label="Out of order" value={String(ooo)} />}
          <Line label="Guests in-house" value={String(occupancy.guestsInHouse)} />
          <Line label="Total rooms" value={String(occupancy.totalRooms)} strong />
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Movement</h3>
          <Line label="Arrivals" value={String(movement.arrivals)} />
          <Line label="Guaranteed arrivals" value={String(movement.guaranteedArrivals)} />
          {flash.arrivals?.walkIns !== undefined && <Line label="Walk-ins" value={String(flash.arrivals.walkIns)} />}
          <Line label="Departures" value={String(movement.departures)} />
          <Line label="Stay-overs" value={String(movement.stayOvers)} />
          <Line label="No-shows" value={String(movement.noShows)} strong />
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue</h3>
          <Line label="Rooms" value={money(revenue.roomRevenue)} />
          {revenue.foodBeverageRevenue > 0 && <Line label="Food & beverage" value={money(revenue.foodBeverageRevenue)} />}
          {revenue.otherRevenue > 0 && <Line label="Other" value={money(revenue.otherRevenue)} />}
          <Line label="Total revenue" value={money(revenue.totalRevenue)} strong />
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Collections</h3>
          <Line label="Payments received" value={money(collections.totalPayments)} />
          <Line label="Cash collected" value={money(collections.cashOnHand)} />
          <Line label="In-house balance due" value={money(collections.inHouseBalanceDue)} strong />
          {exceptions.highBalanceFolios > 0 && (
            <Line label="High-balance folios" value={String(exceptions.highBalanceFolios)} />
          )}
        </section>
      </div>
    </div>
  );
}
