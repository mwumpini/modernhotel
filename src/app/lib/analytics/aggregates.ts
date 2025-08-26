'use client';

import { analyticsEventStore } from './store';
import type { AnyDomainEvent } from './types';

function filterByType(events: AnyDomainEvent[], type: AnyDomainEvent['type']) {
  return events.filter(e => e.type === type);
}

export function getFrontdeskKPIs() {
  const events = analyticsEventStore.getEvents();
  const bookings = filterByType(events, 'Booking.Created').length;
  const checkins = filterByType(events, 'CheckIn.Completed').length;
  const checkouts = filterByType(events, 'CheckOut.Completed').length;
  return { bookings, checkins, checkouts };
}

export function getHousekeepingKPIs() {
  const events = analyticsEventStore.getEvents();
  const cleaned = filterByType(events, 'Room.Cleaned').length;
  return { cleaned };
}

export function getFBKPIs() {
  const events = analyticsEventStore.getEvents();
  const orders = filterByType(events, 'FB.OrderPlaced').length;
  return { orders };
}

export function getSecurityKPIs() {
  const events = analyticsEventStore.getEvents();
  const incidents = filterByType(events, 'Security.IncidentReported').length;
  return { incidents };
}

export function getHRPayrollKPIs() {
  const events = analyticsEventStore.getEvents();
  const payrollRuns = filterByType(events, 'Payroll.RunCompleted').length;
  return { payrollRuns };
}

export function getFinanceKPIs() {
  const events = analyticsEventStore.getEvents();
  const invoices = filterByType(events, 'Invoice.Posted').length;
  const payments = filterByType(events, 'Payment.Received').length;
  return { invoices, payments };
}


