'use client';

/**
 * Demo seeding logic extracted from the front office store.
 * Keeps long constant data out of the class file while preserving behavior.
 */

import type { Reservation } from '../types';

type StoreLike = any;

export function initializeSampleReservations(self: StoreLike) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  self.reservations = [
    {
      id: 'R-001',
      resId: 'RES-001',
      guestId: 'guest-001',
      guestName: 'John Mensah',
      guestPhone: '+233 24 123 4567',
      guestEmail: 'john.mensah@email.com',
      roomTypeId: 'rt-standard',
      roomId: '101',
      arrival: today.toISOString().split('T')[0],
      departure: tomorrow.toISOString().split('T')[0],
      status: 'confirmed',
      source: 'DIRECTINN',
      adults: 2,
      children: 0,
      paymentMethod: 'Cash',
      remarksToGuest: 'High floor preferred',
      stayReason: 'leisure',
      billingPersonName: 'John Mensah',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'R-002',
      resId: 'RES-002',
      guestId: 'guest-002',
      guestName: 'Ama Osei',
      guestPhone: '+233 26 987 6543',
      guestEmail: 'ama.osei@email.com',
      roomTypeId: 'rt-deluxe',
      roomId: '201',
      arrival: today.toISOString().split('T')[0],
      departure: dayAfter.toISOString().split('T')[0],
      status: 'checked-in',
      source: 'BOOKING.COM',
      adults: 1,
      children: 1,
      paymentMethod: 'Credit Card',
      remarksToGuest: 'Extra bed needed',
      stayReason: 'business',
      billingPersonName: 'Ama Osei',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'R-003',
      resId: 'RES-003',
      guestId: 'guest-003',
      guestName: 'Kwame Asante',
      guestPhone: '+233 20 555 1234',
      guestEmail: 'kwame.asante@email.com',
      roomTypeId: 'rt-suite',
      roomId: '301',
      arrival: tomorrow.toISOString().split('T')[0],
      departure: threeDaysLater.toISOString().split('T')[0],
      status: 'confirmed',
      source: 'WALK IN',
      adults: 2,
      children: 2,
      paymentMethod: 'Bank Transfer',
      remarksToGuest: 'Anniversary celebration',
      stayReason: 'leisure',
      billingPersonName: 'Kwame Asante',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
  ] as Reservation[];

  const twoDaysAgo = new Date(today); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const seedReservations: Reservation[] = [
    {
      id: 'R-004',
      resId: 'RES-004',
      guestId: 'guest-demo-004',
      guestName: 'Kofi Boateng',
      guestPhone: '+233 20 111 2222',
      guestEmail: 'kofi.boateng@example.com',
      roomTypeId: 'rt-standard',
      roomId: '102',
      arrival: twoDaysAgo.toISOString().split('T')[0],
      departure: today.toISOString().split('T')[0],
      status: 'checked-in',
      source: 'DIRECTINN',
      adults: 1,
      children: 0,
      paymentMethod: 'Card',
      remarksToGuest: 'Near elevator',
      stayReason: 'leisure',
      billingPersonName: 'Self',
      createdAt: twoDaysAgo.toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'R-005',
      resId: 'RES-005',
      guestId: 'guest-demo-005',
      guestName: 'Abena Serwaa',
      guestPhone: '+233 24 333 4444',
      guestEmail: 'abena.serwaa@example.com',
      roomTypeId: 'rt-deluxe',
      roomId: '202',
      arrival: yesterday.toISOString().split('T')[0],
      departure: today.toISOString().split('T')[0],
      status: 'checked-in',
      source: 'BOOKING.COM',
      adults: 1,
      children: 0,
      paymentMethod: 'Corporate Account',
      remarksToGuest: 'Corporate stay',
      stayReason: 'business',
      billingPersonName: 'Ghana Telecom Ltd',
      createdAt: yesterday.toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'R-006',
      resId: 'RES-006',
      guestId: 'guest-demo-006',
      guestName: 'Yaw Owusu',
      guestPhone: '+233 27 555 6666',
      guestEmail: 'yaw.owusu@example.com',
      roomTypeId: 'rt-standard',
      roomId: '103',
      arrival: twoDaysAgo.toISOString().split('T')[0],
      departure: today.toISOString().split('T')[0],
      status: 'checked-in',
      source: 'WALK IN',
      adults: 2,
      children: 0,
      paymentMethod: 'Cash',
      remarksToGuest: 'Late checkout if possible',
      stayReason: 'leisure',
      billingPersonName: 'Self',
      createdAt: twoDaysAgo.toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  self.reservations = [...self.reservations, ...seedReservations];
}


