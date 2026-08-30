'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Tabs, Tab } from "@heroui/react";
import OfflineIndicator from './OfflineIndicator';
import FrontOfficeBackButton from './FrontOfficeBackButton';
import FrontofficeReservations from './FrontofficeReservations';
import FrontofficeRoomGrid from './FrontofficeRoomGrid';
import { frontOfficeStore } from '../lib/frontoffice/store';
import { housekeepingStore } from '../lib/housekeeping/store';

export default function FrontofficeRoomsBookings() {
  const [selectedTab, setSelectedTab] = useState("reservations");
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubFo = frontOfficeStore.subscribe(() => setTick((t) => t + 1));
    const unsubHk = housekeepingStore.subscribe(() => setTick((t) => t + 1));
    return () => { unsubFo(); unsubHk(); };
  }, []);

  const available = housekeepingStore.getRoomsByStatus('vacant').length;
  const occupied = housekeepingStore.getRoomsByStatus('occupied').length;
  const maintenance =
    housekeepingStore.getRoomsByStatus('maintenance').length +
    housekeepingStore.getRoomsByStatus('out-of-order').length;
  const todayIso = new Date().toISOString().slice(0, 10);
  const todaysCheckIns = frontOfficeStore.reservations.filter(
    (r) => r.arrival.slice(0, 10) === todayIso && (r.status === 'checked-in' || r.status === 'confirmed')
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <FrontOfficeBackButton />
              <h1 className="text-3xl font-bold text-ghana-black">🏠 Rooms & Bookings</h1>
              <p className="text-gray-600 mt-2">Complete room management and booking system</p>
            </div>
            <OfflineIndicator />
          </div>
        </div>

        {/* Room Status Overview */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3">
            <h2 className="text-xl font-semibold text-ghana-black">🏨 Room Status Overview</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-3xl mb-2">🟢</div>
                <p className="text-2xl font-bold text-green-600">{available}</p>
                <p className="text-sm text-green-700">Available</p>
              </div>

              <div className="text-center p-2 bg-red-50 rounded-lg border border-red-200">
                <div className="text-3xl mb-2">🔴</div>
                <p className="text-2xl font-bold text-red-600">{occupied}</p>
                <p className="text-sm text-red-700">Occupied</p>
              </div>

              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-3xl mb-2">🟡</div>
                <p className="text-2xl font-bold text-yellow-600">{maintenance}</p>
                <p className="text-sm text-yellow-700">Maintenance</p>
              </div>

              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-3xl mb-2">🔵</div>
                <p className="text-2xl font-bold text-blue-600">{todaysCheckIns}</p>
                <p className="text-sm text-blue-700">Today's Check-ins</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Main Content Tabs */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="pb-3">
            <Tabs
              selectedKey={selectedTab}
              onSelectionChange={(key) => setSelectedTab(key as string)}
              className="w-full"
            >
              <Tab key="reservations" title="📋 Reservations" />
              <Tab key="grid" title="🗂️ Room Grid" />
            </Tabs>
          </CardHeader>
          <CardBody>
            {selectedTab === 'reservations' && (
              <div>
                <FrontofficeReservations />
              </div>
            )}

            {selectedTab === 'grid' && (
              <div>
                <FrontofficeRoomGrid />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
