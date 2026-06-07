'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Chip } from '@heroui/react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface KDSOrder {
  id: string
  orderNumber: string
  venue: string
  tableNumber?: string | null
  roomNumber?: string | null
  covers?: number
  status: string
  notes?: string | null
  serverName?: string | null
  createdAt: string
  servedAt?: string | null
  items: KDSItem[]
  // computed
  elapsedMin?: number
  urgency?: 'normal' | 'warning' | 'critical'
}

interface KDSItem {
  id: string
  name: string
  category?: string | null
  quantity: number
  notes?: string | null
  route?: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────
const POLL_MS = 15_000          // refresh every 15 seconds
const WARNING_MIN = 12          // yellow after 12 minutes
const CRITICAL_MIN = 20         // red after 20 minutes

const STATUS_LABEL: Record<string, string> = {
  pending:    'New',
  preparing:  'Preparing',
  ready:      'Ready',
  served:     'Served',
  billed:     'Billed',
  cancelled:  'Cancelled',
}

const STATUS_COLOR: Record<string, string> = {
  pending:    'bg-yellow-100 border-yellow-400 text-yellow-900',
  preparing:  'bg-blue-100 border-blue-400 text-blue-900',
  ready:      'bg-green-100 border-green-500 text-green-900',
  served:     'bg-gray-100 border-gray-300 text-gray-500',
  cancelled:  'bg-red-50 border-red-300 text-red-500',
}

const URGENCY_BADGE: Record<string, string> = {
  normal:   'bg-green-100 text-green-800',
  warning:  'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800 animate-pulse',
}

const ACTIVE_STATUSES = ['pending', 'preparing', 'ready']

// ── Helpers ───────────────────────────────────────────────────────────────────
function elapsedMinutes(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

function urgency(min: number): KDSOrder['urgency'] {
  if (min >= CRITICAL_MIN) return 'critical'
  if (min >= WARNING_MIN) return 'warning'
  return 'normal'
}

function subdomain() {
  if (typeof window === 'undefined') return 'default'
  return window.location.hostname.split('.')[0] || 'default'
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function KitchenDisplayPage() {
  const [orders, setOrders] = useState<KDSOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [venueFilter, setVenueFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [updating, setUpdating] = useState<string | null>(null)

  // ── Fetch orders ─────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (venueFilter !== 'all') params.set('venue', venueFilter)

      const res = await fetch(`/api/fb/orders?${params}`, {
        headers: { 'x-tenant-id': subdomain() },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      const enriched: KDSOrder[] = (data.orders || []).map((o: any) => {
        const min = elapsedMinutes(o.createdAt)
        return {
          ...o,
          elapsedMin: min,
          urgency: urgency(min),
        }
      })

      // Apply status filter
      const filtered = statusFilter === 'active'
        ? enriched.filter(o => ACTIVE_STATUSES.includes(o.status))
        : enriched

      // Sort: pending first, then preparing, then ready, then by age desc
      const ORDER_PRIORITY: Record<string, number> = { pending: 0, preparing: 1, ready: 2, served: 3, billed: 4, cancelled: 5 }
      filtered.sort((a, b) => {
        const dp = (ORDER_PRIORITY[a.status] ?? 9) - (ORDER_PRIORITY[b.status] ?? 9)
        if (dp !== 0) return dp
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() // oldest first within same status
      })

      setOrders(filtered)
      setLastRefresh(new Date())
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [venueFilter, statusFilter])

  // Initial load
  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Poll every 15 seconds
  useEffect(() => {
    const id = setInterval(fetchOrders, POLL_MS)
    return () => clearInterval(id)
  }, [fetchOrders])

  // ── Transition order status ───────────────────────────────────────────────
  const transition = useCallback(async (orderId: string, newStatus: string) => {
    setUpdating(orderId)
    try {
      const res = await fetch(`/api/fb/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': subdomain(),
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(`Cannot update: ${err.error}`)
        return
      }
      // Optimistic update
      setOrders(prev => prev.map(o => o.id === orderId
        ? { ...o, status: newStatus, ...(newStatus === 'served' ? { servedAt: new Date().toISOString() } : {}) }
        : o
      ))
    } catch (err) {
      console.error('[KDS] transition error', err)
    } finally {
      setUpdating(null)
    }
  }, [])

  // ── Next action button per status ────────────────────────────────────────
  function nextAction(order: KDSOrder) {
    switch (order.status) {
      case 'pending':
        return { label: '▶ Start Preparing', next: 'preparing', color: 'bg-blue-600 hover:bg-blue-700 text-white' }
      case 'preparing':
        return { label: '✓ Mark Ready', next: 'ready', color: 'bg-green-600 hover:bg-green-700 text-white' }
      case 'ready':
        return { label: '🍽 Served', next: 'served', color: 'bg-purple-600 hover:bg-purple-700 text-white' }
      default:
        return null
    }
  }

  // ── Venue list from orders ────────────────────────────────────────────────
  const venues = ['all', ...Array.from(new Set(orders.map(o => o.venue).filter(Boolean)))]

  // ── Column buckets ───────────────────────────────────────────────────────
  const byStatus = (s: string) => orders.filter(o => o.status === s)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🍳 Kitchen Display System</h1>
          {lastRefresh && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last refresh: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 15 s
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Venue filter */}
          <div className="flex gap-1">
            {venues.map(v => (
              <button
                key={v}
                onClick={() => setVenueFilter(v)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  venueFilter === v ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {v === 'all' ? 'All Venues' : v.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-1">
            {(['active', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  statusFilter === s ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {s === 'active' ? 'Active Only' : 'All Orders'}
              </button>
            ))}
          </div>

          {/* Manual refresh */}
          <button
            onClick={fetchOrders}
            className="px-3 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-300"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-600 rounded text-red-300 text-sm">
          ⚠ API error: {error}. Retrying in 15 s…
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-20 text-gray-400 animate-pulse">Loading orders…</div>
      )}

      {/* Kanban columns */}
      {!loading && statusFilter === 'active' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['pending', 'preparing', 'ready'] as const).map(col => (
            <div key={col} className="flex flex-col gap-3">
              {/* Column header */}
              <div className={`rounded-lg p-3 flex items-center justify-between ${
                col === 'pending' ? 'bg-yellow-900/60 border border-yellow-600'
                : col === 'preparing' ? 'bg-blue-900/60 border border-blue-600'
                : 'bg-green-900/60 border border-green-600'
              }`}>
                <span className="font-bold text-lg">{STATUS_LABEL[col]}</span>
                <span className="text-2xl font-mono font-bold">{byStatus(col).length}</span>
              </div>

              {/* Cards */}
              {byStatus(col).length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">No {STATUS_LABEL[col].toLowerCase()} orders</div>
              )}
              {byStatus(col).map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isUpdating={updating === order.id}
                  onTransition={transition}
                  nextAction={nextAction(order)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Flat list for "All Orders" */}
      {!loading && statusFilter === 'all' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {orders.length === 0 && (
            <div className="col-span-full text-center py-20 text-gray-500">No orders found.</div>
          )}
          {orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              isUpdating={updating === order.id}
              onTransition={transition}
              nextAction={nextAction(order)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({
  order,
  isUpdating,
  onTransition,
  nextAction,
}: {
  order: KDSOrder
  isUpdating: boolean
  onTransition: (id: string, status: string) => void
  nextAction: { label: string; next: string; color: string } | null
}) {
  const urgencyClass = order.urgency ? URGENCY_BADGE[order.urgency] : URGENCY_BADGE.normal
  const cardBorder = STATUS_COLOR[order.status] ?? 'bg-gray-800 border-gray-600 text-white'

  return (
    <div className={`rounded-xl border-2 p-4 shadow-lg flex flex-col gap-3 ${cardBorder}`}>
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="font-bold text-base">{order.orderNumber}</div>
          <div className="text-xs opacity-70 capitalize">{order.venue.replace('_', ' ')}</div>
        </div>
        <div className="text-right">
          {order.tableNumber && <div className="text-sm font-semibold">Table {order.tableNumber}</div>}
          {order.roomNumber && <div className="text-sm font-semibold">Room {order.roomNumber}</div>}
          {order.covers && <div className="text-xs opacity-60">{order.covers} cover{order.covers !== 1 ? 's' : ''}</div>}
        </div>
      </div>

      {/* Elapsed + urgency */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${urgencyClass}`}>
          ⏱ {order.elapsedMin}m ago
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-semibold">
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
        {order.serverName && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
            👤 {order.serverName}
          </span>
        )}
      </div>

      {/* Items */}
      <ul className="space-y-1">
        {order.items.map(item => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span className="font-bold min-w-[1.5rem]">{item.quantity}×</span>
            <div>
              <span className="font-medium">{item.name}</span>
              {item.notes && <span className="ml-1 text-xs opacity-60 italic">({item.notes})</span>}
              {item.route === 'bar' && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1 rounded">BAR</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Order notes */}
      {order.notes && (
        <div className="text-xs opacity-70 italic border-t border-current/20 pt-2">
          📝 {order.notes}
        </div>
      )}

      {/* Action button */}
      {nextAction && (
        <button
          disabled={isUpdating}
          onClick={() => onTransition(order.id, nextAction.next)}
          className={`w-full py-2 rounded-lg font-semibold text-sm transition-opacity ${nextAction.color} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isUpdating ? 'Updating…' : nextAction.label}
        </button>
      )}
    </div>
  )
}
