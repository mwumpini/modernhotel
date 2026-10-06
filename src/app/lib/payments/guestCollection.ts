/**
 * Guest card and mobile-money collection.
 *
 * The desk records cash, card, and mobile money by hand. A Ghana payments
 * service (Hubtel or Paystack) can be connected later by implementing
 * GuestCollector and calling registerGuestCollector. Until then, collectGuestPayment
 * records the payment the way the desk already does.
 */

export type GuestPaymentService = 'none' | 'hubtel' | 'paystack'

export const GUEST_PAYMENT_SERVICES: { id: GuestPaymentService; label: string }[] = [
  { id: 'none', label: 'Not connected' },
  { id: 'hubtel', label: 'Hubtel' },
  { id: 'paystack', label: 'Paystack' },
]

export interface GuestCollectionSettings {
  service: GuestPaymentService
}

export interface GuestCollectionRequest {
  reservationId: string
  amount: number
  currency: string
  method: 'Card' | 'Mobile Money'
  phone?: string
  reference: string
}

export interface GuestCollectionResult {
  /** recorded: staff already have the money. prompt: the guest approves on their phone. */
  mode: 'recorded' | 'prompt'
  status: 'completed' | 'pending' | 'failed'
  service: GuestPaymentService
  externalId?: string
  message?: string
}

export interface GuestCollector {
  service: Exclude<GuestPaymentService, 'none'>
  collect(request: GuestCollectionRequest): Promise<GuestCollectionResult>
}

const collectors = new Map<GuestCollector['service'], GuestCollector>()

export function registerGuestCollector(collector: GuestCollector) {
  collectors.set(collector.service, collector)
}

export function guestPaymentServiceLabel(service: GuestPaymentService | undefined): string {
  return GUEST_PAYMENT_SERVICES.find((item) => item.id === service)?.label ?? 'Not connected'
}

export function normalizeGuestPaymentService(value: unknown): GuestPaymentService {
  if (value === 'hubtel' || value === 'paystack') return value
  return 'none'
}

/** True when this build can send a prompt for that service. */
export function guestCollectionConnected(service: GuestPaymentService | undefined): boolean {
  const id = normalizeGuestPaymentService(service)
  return id !== 'none' && collectors.has(id)
}

/**
 * What the folio stores today. A connected service will switch card and
 * mobile-money payments to mode "prompt" from the screen that sends it.
 */
export function recordedCollection(service: GuestPaymentService | undefined): Pick<GuestCollectionResult, 'mode' | 'service'> {
  return { mode: 'recorded', service: normalizeGuestPaymentService(service) }
}

export async function collectGuestPayment(
  request: GuestCollectionRequest,
  service: GuestPaymentService | undefined,
): Promise<GuestCollectionResult> {
  const id = normalizeGuestPaymentService(service)
  const collector = id === 'none' ? undefined : collectors.get(id)
  if (!collector) {
    return {
      mode: 'recorded',
      status: 'completed',
      service: 'none',
      message: 'Record this payment on the desk. Phone approval is not connected.',
    }
  }
  return collector.collect(request)
}
