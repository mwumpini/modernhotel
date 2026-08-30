'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { fetchFbOrders, fetchKitchenStaff, patchFbOrder, patchFbOrderStatus, openKitchenOverview, type FbOrderDto } from '../lib/fb/api'
import { logKitchenStatusChange } from '../lib/fb/kitchenEvents'

// ── Types ─────────────────────────────────────────────────────────────────────
type KDSOrder = FbOrderDto

interface KDSItem {
  id: string
  name: string
  category?: string | null
  quantity: number
  notes?: string | null
  route?: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────
const POLL_MS      = 8_000  // 8 s — fast enough for kitchen without hammering DB
const TICK_MS      = 10_000 // local elapsed-timer re-render every 10 s (no API call)
const WARNING_MIN  = 10     // amber at 10 min
const CRITICAL_MIN = 18     // red at 18 min

const ACTIVE_STATUSES = ['pending', 'preparing', 'ready']

// Per-status: column header, card background, action button
const STATUS_THEME: Record<string, {
  colHeader: string   // column header bar
  cardBg: string      // card background — bold color so readable at 2m distance
  cardBorder: string  // card border accent
  label: string
}> = {
  pending: {
    colHeader: 'bg-amber-500 text-gray-950',
    cardBg:    'bg-amber-950 border-amber-500',
    cardBorder:'border-amber-500',
    label:     'NEW ORDERS',
  },
  preparing: {
    colHeader: 'bg-blue-600 text-white',
    cardBg:    'bg-blue-950 border-blue-500',
    cardBorder:'border-blue-500',
    label:     'COOKING',
  },
  ready: {
    colHeader: 'bg-emerald-500 text-gray-950',
    cardBg:    'bg-emerald-950 border-emerald-400',
    cardBorder:'border-emerald-400',
    label:     'READY TO SERVE',
  },
}

const NON_ACTIVE_BADGE: Record<string, string> = {
  served:    'bg-purple-800 text-purple-200',
  billed:    'bg-gray-700 text-gray-300',
  cancelled: 'bg-red-950 text-red-400',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function elapsedMin(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

function orderTiming(order: KDSOrder): { min: number; label: 'wait' | 'cook' } {
  if (order.status === 'pending') {
    return { min: elapsedMin(order.createdAt), label: 'wait' }
  }
  const cookStart = order.preparingAt || order.createdAt
  // Freeze the timer once the order reaches a terminal state — otherwise a served,
  // billed, or cancelled order's "cook" time keeps growing forever in the "All" view,
  // misrepresenting how long it actually took (matches the correct servedAt-based
  // freeze already used for the stats calculation above).
  const isTerminal = order.status === 'served' || order.status === 'billed' || order.status === 'cancelled'
  const endIso = isTerminal ? (order.servedAt || order.createdAt) : undefined
  const elapsed = endIso
    ? Math.floor((new Date(endIso).getTime() - new Date(cookStart).getTime()) / 60_000)
    : elapsedMin(cookStart)
  return { min: Math.max(0, elapsed), label: 'cook' }
}

function timerStyle(min: number, urgent?: boolean): { pill: string; ring: string } {
  if (urgent || min >= CRITICAL_MIN)
    return { pill: 'bg-red-600 text-white font-black animate-pulse', ring: 'ring-2 ring-red-500 animate-pulse' }
  if (min >= WARNING_MIN)
    return { pill: 'bg-amber-400 text-gray-950 font-bold', ring: 'ring-2 ring-amber-400' }
  return { pill: 'bg-gray-700 text-gray-300 font-semibold', ring: '' }
}

// Shared AudioContext — reused across beeps; created on first user interaction
let _audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return _audioCtx
  } catch { return null }
}

// Unlock the audio context on any user gesture (click / keydown)
// Must be called once before the polling timer can play sound
function unlockAudio() {
  const ctx = getAudioCtx()
  if (ctx && ctx.state === 'suspended') ctx.resume()
}

function playBeep() {
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    // Resume if still suspended (browser autoplay policy)
    const play = () => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.45)
      // Second shorter beep 0.55 s later — gives a "ding-ding" feel
      const osc2  = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2); gain2.connect(ctx.destination)
      osc2.frequency.value = 1100
      gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.55)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85)
      osc2.start(ctx.currentTime + 0.55); osc2.stop(ctx.currentTime + 0.85)
    }
    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => {})
    } else {
      play()
    }
  } catch { /* browser may block entirely */ }
}

type KitchenDisplaySystemProps = {
  /** When true, fits inside the F&B dashboard tab instead of full-screen */
  embedded?: boolean
}

// ── Main KDS ──────────────────────────────────────────────────────────────────
export default function KitchenDisplaySystem({ embedded = false }: KitchenDisplaySystemProps) {
  const [orders,         setOrders]         = useState<KDSOrder[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [lastRefresh,    setLastRefresh]    = useState<Date | null>(null)
  const [,               forceRender]       = useState(0)
  const [venueFilter,    setVenueFilter]    = useState('all')
  const [stationFilter,  setStationFilter]  = useState<'all' | 'kitchen' | 'bar'>('all')
  const [statusFilter,   setStatusFilter]   = useState<'active' | 'all'>('active')
  const [updating,       setUpdating]       = useState<string | null>(null)
  const [soundEnabled,   setSoundEnabled]   = useState(true)
  const [undoStack,      setUndoStack]      = useState<{ id: string; from: string; to: string; label: string }[]>([])
  const [confirmCancel,  setConfirmCancel]  = useState<string | null>(null)
  const [staff,            setStaff]            = useState<{ id: string; name: string }[]>([])
  const [stats,          setStats]          = useState({ pending: 0, preparing: 0, ready: 0, avgMinToday: 0, completedToday: 0, kitchenActive: 0, barActive: 0, allActive: 0 })
  // Refs — always current inside polling closure without triggering re-creation
  const soundRef        = useRef(soundEnabled)
  soundRef.current      = soundEnabled
  const stationRef      = useRef(stationFilter)         // for sound detection inside closure
  stationRef.current    = stationFilter
  const lastOrderIdsRef = useRef<Set<string>>(new Set())
  const allVenuesRef    = useRef<string[]>([])

  // Unlock AudioContext on first user interaction — required by browser autoplay policy
  useEffect(() => {
    const unlock = () => { unlockAudio(); window.removeEventListener('click', unlock); window.removeEventListener('keydown', unlock) }
    window.addEventListener('click',   unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => { window.removeEventListener('click', unlock); window.removeEventListener('keydown', unlock) }
  }, [])

  useEffect(() => {
    fetchKitchenStaff().then(setStaff).catch(() => setStaff([]))
  }, [])

  // ── Fetch & process orders ────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const all: KDSOrder[] = await fetchFbOrders(
        venueFilter !== 'all' ? { venue: venueFilter } : undefined
      )

      // Sound alert — only beep for orders relevant to this station's display
      // e.g. bar display should NOT beep when a kitchen-only food order arrives
      const station = stationRef.current
      const relevantActive = all.filter(o => {
        if (!ACTIVE_STATUSES.includes(o.status)) return false
        if (station === 'all') return true
        return o.items.some(it => (it.route ?? 'kitchen') === station)
      })
      const incomingIds = new Set(relevantActive.map(o => o.id))
      if (lastOrderIdsRef.current.size > 0 && [...incomingIds].some(id => !lastOrderIdsRef.current.has(id))) {
        if (soundRef.current) playBeep()
      }
      lastOrderIdsRef.current = incomingIds

      // Store raw venues from unfiltered data so venue pills stay stable across station changes
      allVenuesRef.current = Array.from(new Set(all.map(o => o.venue).filter(Boolean)))

      // Station filter — slice items to station, drop orders with nothing left
      const stationFiltered = stationFilter === 'all'
        ? all
        : all
            .map(o => ({ ...o, items: o.items.filter(it => (it.route ?? 'kitchen') === stationFilter) }))
            .filter(o => o.items.length > 0)

      // Status filter
      const filtered = statusFilter === 'active'
        ? stationFiltered.filter(o => ACTIVE_STATUSES.includes(o.status))
        : stationFiltered

      // Sort: urgent → status priority → oldest first within same status
      const SPRIO: Record<string, number> = { pending: 0, preparing: 1, ready: 2, served: 3, billed: 4, cancelled: 5 }
      filtered.sort((a, b) => {
        const ua = (a.urgent || a.priority === 'urgent') ? 0 : 1
        const ub = (b.urgent || b.priority === 'urgent') ? 0 : 1
        if (ua !== ub) return ua - ub
        const dp = (SPRIO[a.status] ?? 9) - (SPRIO[b.status] ?? 9)
        if (dp !== 0) return dp
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })

      setOrders(filtered)
      setLastRefresh(new Date())
      setError(null)

      // Stats — today's throughput
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const todayOrders  = all.filter(o => new Date(o.createdAt) >= todayStart)
      const servedToday  = todayOrders.filter(o => o.status === 'served' || o.status === 'billed')
      const avgMin = servedToday.length > 0
        ? Math.round(servedToday.reduce((s, o) => {
            const start = o.preparingAt ? new Date(o.preparingAt).getTime() : new Date(o.createdAt).getTime()
            const end = o.servedAt ? new Date(o.servedAt).getTime() : Date.now()
            return s + (end - start) / 60_000
          }, 0) / servedToday.length)
        : 0
      const activeAll = all.filter(o => ACTIVE_STATUSES.includes(o.status))
      setStats({
        pending:        all.filter(o => o.status === 'pending').length,
        preparing:      all.filter(o => o.status === 'preparing').length,
        ready:          all.filter(o => o.status === 'ready').length,
        completedToday: servedToday.length,
        avgMinToday:    avgMin,
        kitchenActive:  activeAll.filter(o => o.items.some(it => (it.route ?? 'kitchen') === 'kitchen')).length,
        barActive:      activeAll.filter(o => o.items.some(it => it.route === 'bar')).length,
        allActive:      activeAll.length,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [venueFilter, stationFilter, statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => {
    const id = setInterval(fetchOrders, POLL_MS)
    return () => clearInterval(id)
  }, [fetchOrders])

  // Tick elapsed timers locally — no API call
  useEffect(() => {
    const id = setInterval(() => forceRender(n => n + 1), TICK_MS)
    return () => clearInterval(id)
  }, [])

  // ── Transition ────────────────────────────────────────────────────────────
  const assignCook = useCallback(async (orderId: string, cookId: string, cookName: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order || (order.assignedToId === cookId && order.assignedToName === cookName)) return
    setUpdating(orderId)
    try {
      const updated = await patchFbOrder(orderId, { assignedToId: cookId, assignedToName: cookName })
      setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)))
      logKitchenStatusChange({
        order: updated,
        fromStatus: order.status,
        toStatus: order.status,
        cookId,
        cookName,
      })
    } catch (err: any) {
      alert(`Cannot assign cook: ${err?.message || 'unknown error'}`)
    } finally {
      setUpdating(null)
    }
  }, [orders])

  const transition = useCallback(async (orderId: string, newStatus: string, fromStatus: string, label: string) => {
    const order = orders.find(o => o.id === orderId)
    if (newStatus === 'preparing' && !order?.assignedToId) {
      alert('Assign a cook before starting this order.')
      return
    }

    setUpdating(orderId)
    try {
      const extra: Record<string, unknown> = {}
      if (order?.assignedToId) {
        extra.assignedToId = order.assignedToId
        extra.assignedToName = order.assignedToName
      }
      const updated = await patchFbOrderStatus(orderId, newStatus, extra)

      logKitchenStatusChange({
        order: updated,
        fromStatus,
        toStatus: newStatus,
        cookId: updated.assignedToId ?? undefined,
        cookName: updated.assignedToName ?? undefined,
      })

      setOrders(prev => prev
        .map(o => o.id === orderId ? updated : o)
        .filter(o => statusFilter !== 'active' || ACTIVE_STATUSES.includes(o.id === orderId ? newStatus : o.status))
      )
      setUndoStack(prev => [{ id: orderId, from: fromStatus, to: newStatus, label }, ...prev].slice(0, 3))
    } catch (err: any) {
      console.error('[KDS]', err)
      alert(`Cannot update: ${err?.message || 'unknown error'}`)
    }
    finally { setUpdating(null) }
  }, [statusFilter, orders])

  // ── Cancel ────────────────────────────────────────────────────────────────
  const cancelOrder = async (orderId: string) => {
    setUpdating(orderId); setConfirmCancel(null)
    const order = orders.find(o => o.id === orderId)
    try {
      const updated = await patchFbOrderStatus(orderId, 'cancelled')
      if (order) {
        logKitchenStatusChange({
          order: updated,
          fromStatus: order.status,
          toStatus: 'cancelled',
          cookId: order.assignedToId ?? undefined,
          cookName: order.assignedToName ?? undefined,
        })
      }
      setOrders(prev => prev.filter(o => o.id !== orderId))
    } catch (err: any) {
      console.error('[KDS] cancel', err)
      alert(`Cannot cancel: ${err?.message || 'unknown error'}`)
    }
    finally { setUpdating(null) }
  }

  function nextAction(order: KDSOrder) {
    switch (order.status) {
      case 'pending':   return { label: '▶  Start Cooking', next: 'preparing', cls: 'bg-blue-600 hover:bg-blue-500 text-white' }
      case 'preparing': return { label: '✓  Mark Ready',    next: 'ready',     cls: 'bg-emerald-600 hover:bg-emerald-500 text-white' }
      case 'ready':     return { label: '🍽  Served',       next: 'served',    cls: 'bg-purple-600 hover:bg-purple-500 text-white' }
      default: return null
    }
  }

  const byStatus = (s: string) => orders.filter(o => o.status === s)
  // Use raw ref — stable regardless of which station/status filter is active
  const venues = ['all', ...allVenuesRef.current]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={
        embedded
          ? 'min-h-[720px] bg-gray-950 text-white rounded-xl overflow-hidden border border-gray-800'
          : 'min-h-screen bg-gray-950 text-white'
      }
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
    >

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b-2 border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">

          {/* Brand + clock */}
          <div className="flex items-center gap-4">
            {!embedded && (
              <button
                type="button"
                onClick={openKitchenOverview}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 text-xs font-bold text-gray-200 transition-colors shrink-0"
                title="Back to Kitchen Operations overview"
              >
                ← Overview
              </button>
            )}
            <div>
              <div className="text-lg font-black tracking-widest uppercase text-white">🍳 Kitchen</div>
              {lastRefresh && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  synced {lastRefresh.toLocaleTimeString()} · every {POLL_MS / 1000}s
                </div>
              )}
            </div>
            {/* Clock — client-only to avoid SSR hydration mismatch */}
            <LiveClock />
          </div>

          {/* Stats chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatChip label="New"     n={stats.pending}        bg="bg-amber-700"   />
            <StatChip label="Cooking" n={stats.preparing}      bg="bg-blue-700"    />
            <StatChip label="Ready"   n={stats.ready}          bg="bg-emerald-700" />
            <StatChip label="Done ✓"  n={stats.completedToday} bg="bg-gray-700"    />
            {stats.avgMinToday > 0 && (
              <StatChip label={`~${stats.avgMinToday}m avg`} n="" bg="bg-indigo-800" />
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(v => !v)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-colors border ${
                soundEnabled
                  ? 'bg-emerald-800 border-emerald-600 text-emerald-200'
                  : 'bg-gray-800 border-gray-600 text-gray-500'
              }`}
            >
              {soundEnabled ? '🔔 ON' : '🔕 OFF'}
            </button>
            <button
              onClick={fetchOrders}
              className="px-3 py-1.5 rounded text-xs font-bold bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-colors"
            >
              ↻ Sync
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-5 mt-3 flex-wrap">
          {/* VIEW — Active (Kanban) vs All (flat list) */}
          <FilterPills
            label="VIEW"
            options={[
              { v: 'active', label: 'Active', count: stats.allActive },
              { v: 'all',    label: 'All',    count: undefined },
            ]}
            value={statusFilter} onChange={v => setStatusFilter(v as any)}
            activeClass="bg-blue-600 text-white"
          />
          {/* STATION — filters which items (and therefore orders) are shown */}
          <FilterPills
            label="STATION"
            options={[
              { v: 'all',     label: '🏠 All',     count: stats.allActive },
              { v: 'kitchen', label: '🍳 Kitchen',  count: stats.kitchenActive },
              { v: 'bar',     label: '🍺 Bar',      count: stats.barActive },
            ]}
            value={stationFilter} onChange={v => setStationFilter(v as any)}
            activeClass="bg-orange-600 text-white"
          />
          {/* VENUE — only shown when multiple venues exist (restaurant, bar, pool_bar, room_service…) */}
          {venues.length > 1 && (
            <FilterPills
              label="VENUE"
              options={venues.map(v => ({ v, label: v === 'all' ? 'All' : v.replace(/_/g, ' '), count: undefined }))}
              value={venueFilter} onChange={setVenueFilter}
              activeClass="bg-purple-600 text-white"
            />
          )}
        </div>
      </div>

      {/* ── Undo strip ───────────────────────────────────────────────────── */}
      {undoStack.length > 0 && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-1.5 flex items-center gap-3 text-xs">
          <span className="text-gray-500 uppercase tracking-wide">Last bumped:</span>
          {undoStack.map(e => (
            <span key={e.id + e.to} className="flex items-center gap-1">
              <span className="text-gray-300">{e.label}</span>
              <span className="text-gray-600">→ {e.to}</span>
              <button
                onClick={() => alert('Server state machine is one-directional. Use order detail to correct status.')}
                className="text-amber-400 hover:text-amber-300 underline ml-1"
              >undo?</button>
            </span>
          ))}
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-2.5 bg-red-950 border border-red-700 rounded text-red-300 text-xs">
          ⚠ {error} — retrying in {POLL_MS / 1000}s
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-32 text-gray-600 text-sm animate-pulse">
          Loading kitchen orders…
        </div>
      )}

      {/* ── Cancel confirm overlay ───────────────────────────────────────── */}
      {confirmCancel && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border-2 border-red-600 rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl">
            <div className="text-4xl mb-3">⚠️</div>
            <div className="text-lg font-black text-white mb-1">Cancel this order?</div>
            <div className="text-xs text-gray-400 mb-5 leading-relaxed">
              This removes the order from the kitchen queue and marks it cancelled.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmCancel(null)}
                className="flex-1 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-bold">
                Keep It
              </button>
              <button onClick={() => cancelOrder(confirmCancel)}
                className="flex-1 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-sm font-black">
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="p-4">

          {/* Active Kanban — 3 bold colored columns */}
          {statusFilter === 'active' && (
            <>
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-gray-700">
                  <div className="text-6xl mb-4">✅</div>
                  <div className="text-2xl font-black">Kitchen Clear</div>
                  <div className="text-sm mt-2">No active orders right now</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['pending', 'preparing', 'ready'] as const).map(col => (
                    <KanbanColumn
                      key={col}
                      status={col}
                      orders={byStatus(col)}
                      updating={updating}
                      staff={staff}
                      onTransition={transition}
                      onAssignCook={assignCook}
                      onCancel={id => setConfirmCancel(id)}
                      nextAction={nextAction}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* All orders — paginated flat grid */}
          {statusFilter === 'all' && (
            <AllOrdersGrid
              orders={orders}
              updating={updating}
              staff={staff}
              onTransition={transition}
              onAssignCook={assignCook}
              onCancel={id => setConfirmCancel(id)}
              nextAction={nextAction}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Live clock — client-only, avoids SSR hydration mismatch ──────────────────
function LiveClock() {
  // null on first render (matches SSR); populated after mount via useEffect
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setTime(fmt())
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span
      className="text-3xl font-black tabular-nums text-amber-400 tracking-widest"
      suppressHydrationWarning  // belt-and-suspenders: value is null on SSR anyway
    >
      {time ?? ''}
    </span>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ label, n, bg }: { label: string; n: string | number; bg: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-white/10 ${bg}`}>
      <span className="text-white/70">{label}</span>
      {n !== '' && <span className="font-black text-white text-sm">{n}</span>}
    </div>
  )
}

// ── Filter pills ──────────────────────────────────────────────────────────────
function FilterPills({ label, options, value, onChange, activeClass }: {
  label: string
  options: { v: string; label: string; count?: number }[]
  value: string
  onChange: (v: string) => void
  activeClass: string
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-gray-600 uppercase tracking-widest mr-1">{label}</span>
      {options.map(o => {
        const isActive = value === o.v
        return (
          <button key={o.v} onClick={() => onChange(o.v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
              isActive ? activeClass : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300'
            }`}
          >
            {o.label}
            {/* Live count badge — proves filter is wired to real data */}
            {o.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0 rounded-full font-black tabular-nums ${
                isActive ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Kanban column ─────────────────────────────────────────────────────────────
function KanbanColumn({ status, orders, updating, staff, onTransition, onAssignCook, onCancel, nextAction }: {
  status: string
  orders: KDSOrder[]
  updating: string | null
  staff: { id: string; name: string }[]
  onTransition: (id: string, next: string, from: string, label: string) => void
  onAssignCook: (orderId: string, cookId: string, cookName: string) => void
  onCancel: (id: string) => void
  nextAction: (o: KDSOrder) => { label: string; next: string; cls: string } | null
}) {
  const theme = STATUS_THEME[status]
  if (!theme) return null
  return (
    <div className="flex flex-col gap-3">
      {/* Column header — bold, high-contrast, readable across kitchen */}
      <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${theme.colHeader}`}>
        <span className="font-black text-sm tracking-widest">{theme.label}</span>
        <span className="text-4xl font-black tabular-nums leading-none">{orders.length}</span>
      </div>

      {orders.length === 0 && (
        <div className="text-center text-gray-700 text-xs py-10">— clear —</div>
      )}

      {orders.map(order => (
        <OrderCard
          key={order.id}
          order={order}
          isUpdating={updating === order.id}
          staff={staff}
          onTransition={onTransition}
          onAssignCook={onAssignCook}
          onCancel={onCancel}
          nextAction={nextAction(order)}
        />
      ))}
    </div>
  )
}

// ── All-orders paginated grid ─────────────────────────────────────────────────
function AllOrdersGrid({ orders, updating, staff, onTransition, onAssignCook, onCancel, nextAction }: {
  orders: KDSOrder[]
  updating: string | null
  staff: { id: string; name: string }[]
  onTransition: (id: string, next: string, from: string, label: string) => void
  onAssignCook: (orderId: string, cookId: string, cookName: string) => void
  onCancel: (id: string) => void
  nextAction: (o: KDSOrder) => { label: string; next: string; cls: string } | null
}) {
  const [page, setPage] = useState(0)
  const PAGE = 24
  const totalPages = Math.ceil(orders.length / PAGE)
  const slice = orders.slice(page * PAGE, (page + 1) * PAGE)

  if (orders.length === 0) return (
    <div className="flex flex-col items-center py-24 text-gray-700">
      <div className="text-4xl mb-2">📋</div>
      <div className="font-bold">No orders found</div>
    </div>
  )

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {slice.map(order => (
          <OrderCard key={order.id} order={order}
            isUpdating={updating === order.id}
            staff={staff}
            onTransition={onTransition}
            onAssignCook={onAssignCook}
            onCancel={onCancel}
            nextAction={nextAction(order)}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-lg bg-gray-800 disabled:opacity-30 text-sm font-bold border border-gray-700">
            ← Prev
          </button>
          <span className="text-sm text-gray-400">Page {page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-lg bg-gray-800 disabled:opacity-30 text-sm font-bold border border-gray-700">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({ order, isUpdating, staff, onTransition, onAssignCook, onCancel, nextAction }: {
  order: KDSOrder
  isUpdating: boolean
  staff: { id: string; name: string }[]
  onTransition: (id: string, next: string, from: string, label: string) => void
  onAssignCook: (orderId: string, cookId: string, cookName: string) => void
  onCancel: (id: string) => void
  nextAction: { label: string; next: string; cls: string } | null
}) {
  const { min, label: timeLabel } = orderTiming(order)
  const isUrgent = order.urgent || order.priority === 'urgent'
  const timer   = timerStyle(min, isUrgent)
  const theme   = STATUS_THEME[order.status]
  const showCookPicker = ACTIVE_STATUSES.includes(order.status) && order.status !== 'ready'

  const kitchenItems = order.items.filter(i => (i.route ?? 'kitchen') === 'kitchen')
  const barItems     = order.items.filter(i => i.route === 'bar')

  return (
    <div className={`rounded-xl border-2 p-4 flex flex-col gap-3 transition-all
      ${theme ? theme.cardBg : 'bg-gray-900 border-gray-700'}
      ${timer.ring}
    `}>

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            {isUrgent && <span className="text-red-400 text-base animate-pulse">🚨</span>}
            <span className="font-black text-lg tracking-tight leading-none">{order.orderNumber}</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5 capitalize">
            {order.venue.replace(/_/g, ' ')}
            {order.serverName && <span className="text-gray-600"> · {order.serverName}</span>}
          </div>
        </div>
        <div className="text-right shrink-0 leading-tight">
          {order.tableNumber && (
            <div className="text-base font-black text-white">T{order.tableNumber}</div>
          )}
          {order.roomNumber && (
            <div className="text-base font-black text-amber-300">Rm {order.roomNumber}</div>
          )}
          {(order.covers ?? 0) > 1 && (
            <div className="text-[10px] text-gray-600">{order.covers} covers</div>
          )}
        </div>
      </div>

      {/* Timer + status badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-xs px-2.5 py-0.5 rounded-full ${timer.pill}`}>
          ⏱ {timeLabel === 'wait' ? 'wait' : 'cook'} {min}m
        </span>
        {order.assignedToName && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900 text-indigo-200 font-bold">
            👨‍🍳 {order.assignedToName}
          </span>
        )}
        {!ACTIVE_STATUSES.includes(order.status) && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${NON_ACTIVE_BADGE[order.status] ?? 'bg-gray-700'}`}>
            {order.status}
          </span>
        )}
        {isUrgent && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-700 text-white font-black animate-pulse uppercase">
            urgent
          </span>
        )}
      </div>

      {/* Kitchen items */}
      {kitchenItems.length > 0 && (
        <div className="space-y-1">
          {kitchenItems.map(item => <ItemRow key={item.id} item={item} />)}
        </div>
      )}

      {/* Bar items — visually separated */}
      {barItems.length > 0 && (
        <div className="border-t border-blue-800/50 pt-2">
          <div className="text-[9px] text-blue-400 uppercase font-black tracking-widest mb-1">Bar</div>
          <div className="space-y-1">
            {barItems.map(item => <ItemRow key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* Chef notes */}
      {order.notes && (
        <div className="text-xs text-amber-300 italic border-t border-amber-900/40 pt-2 leading-relaxed">
          📝 {order.notes}
        </div>
      )}

      {showCookPicker && (
        <div className="border-t border-gray-700/60 pt-2">
          <label className="text-[9px] text-gray-500 uppercase tracking-widest block mb-1">Assign cook</label>
          <select
            disabled={isUpdating}
            value={order.assignedToId || ''}
            onChange={e => {
              const cook = staff.find(s => s.id === e.target.value)
              if (cook) onAssignCook(order.id, cook.id, cook.name)
            }}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-xs font-bold text-white"
          >
            <option value="">— select cook —</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {staff.length === 0 && (
            <p className="text-[10px] text-gray-500 mt-1">No kitchen staff in tenant — add users to assign cooks.</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {(nextAction || ACTIVE_STATUSES.includes(order.status)) && (
        <div className="flex gap-2 mt-1">
          {nextAction && (
            <button
              disabled={isUpdating}
              onClick={() => onTransition(order.id, nextAction.next, order.status, order.orderNumber)}
              className={`flex-1 py-3 rounded-xl font-black text-sm transition-all active:scale-95 ${nextAction.cls}
                ${isUpdating ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {isUpdating ? '…' : nextAction.label}
            </button>
          )}
          {/* Cancel button */}
          {ACTIVE_STATUSES.includes(order.status) && (
            <button
              disabled={isUpdating}
              onClick={() => onCancel(order.id)}
              title="Cancel order"
              className="px-3 py-3 rounded-xl bg-red-950 hover:bg-red-900 text-red-400 hover:text-red-300 text-sm font-black transition-colors border border-red-900 disabled:opacity-40"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Item row ──────────────────────────────────────────────────────────────────
function ItemRow({ item }: { item: KDSItem }) {
  return (
    <div className="flex items-start gap-2">
      {/* Large quantity — must be readable from 2m */}
      <span className="text-xl font-black text-white tabular-nums min-w-[2rem] leading-tight">
        {item.quantity}×
      </span>
      <div className="flex-1 min-w-0 pt-0.5">
        <span className="text-base font-bold text-white leading-tight">{item.name}</span>
        {item.notes && (
          <div className="text-xs text-gray-400 italic mt-0.5">↳ {item.notes}</div>
        )}
      </div>
    </div>
  )
}
