'use client';

/**
 * Accounting ↔ Front Office folio adapter
 *
 * DEPRECATED PATH REMOVED: src/app/lib/folio/repository.ts (Prisma folio layer).
 * Do not recreate a second folio store — the operational folio lives in
 * frontOfficeStore. GL posting reads folio data at checkout (simpleFlow.ts /
 * invoice.ts) and no-show (postNoShowPenaltyToLedger). Server persistence uses
 * frontoffice/helpers/api.ts upsertFolioViaApi.
 */

import { frontOfficeStore } from '../frontoffice/store';
import type { Folio } from '../frontoffice/types';

export function getOperationalFolioForReservation(reservationId: string): Folio | undefined {
  return frontOfficeStore.folios.find((f) => f.reservationId === reservationId);
}

export function getOperationalFolioById(folioId: string): Folio | undefined {
  return frontOfficeStore.getFolioById(folioId);
}

export function listOpenOperationalFolios(): Folio[] {
  return frontOfficeStore.folios.filter((f) => f.status !== 'closed');
}
