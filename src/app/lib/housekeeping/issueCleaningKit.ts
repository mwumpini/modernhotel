import { prisma } from '@/app/lib/database/client';
import { Prisma } from '@prisma/client';
import { issueDepartmentStock, returnDepartmentStock } from '@/app/lib/inventory/repository';
import { ensureDefaultRolesForTenant, permissionGrants } from '@/app/lib/settings/roleRepository';
import {
  cleaningIssueLabel,
  decideCleaningIssue,
  parseCleaningKits,
  parseKitLines,
  type CleaningIssueKind,
  type CleaningKits,
  type KitLine,
} from './cleaningKits';

const CHECKOUT_WINDOW_MS = 48 * 60 * 60 * 1000;
export const UNDO_WINDOW_MS = 10 * 60 * 1000;

export async function canManageHousekeepingSupplies(tenantId: string, roleCode: string | undefined): Promise<boolean> {
  if (!tenantId || !roleCode) return false;
  await ensureDefaultRolesForTenant(tenantId);
  const role = await prisma.role.findUnique({ where: { tenantId_code: { tenantId, code: roleCode } } });
  if (!role || !role.isActive) return false;
  const permissions = Array.isArray(role.permissions)
    ? (role.permissions as unknown[]).filter((p): p is string => typeof p === 'string')
    : [];
  return permissions.some((p) => permissionGrants(p, 'housekeeping.manage-supplies'));
}

async function readKits(tenantId: string): Promise<CleaningKits> {
  const settings = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { roomSettings: true },
  });
  const roomSettings = (settings?.roomSettings as Record<string, unknown>) || {};
  return parseCleaningKits(roomSettings.cleaningKits);
}

async function roomMatch(tenantId: string, roomNumber: string): Promise<{ ids: string[]; roomTypeId: string }> {
  const ids = new Set<string>();
  if (roomNumber) ids.add(roomNumber);
  let roomTypeId = '';
  const settings = await prisma.systemSettings.findUnique({
    where: { tenantId },
    select: { roomSettings: true },
  });
  const rooms = (settings?.roomSettings as { rooms?: unknown })?.rooms;
  if (Array.isArray(rooms)) {
    for (const room of rooms) {
      if (!room || typeof room !== 'object') continue;
      const row = room as { id?: unknown; number?: unknown; typeId?: unknown };
      const number = row.number != null ? String(row.number) : '';
      const id = row.id != null ? String(row.id) : '';
      if (number === roomNumber || id === roomNumber) {
        if (number) ids.add(number);
        if (id) ids.add(id);
        if (!roomTypeId && row.typeId) roomTypeId = String(row.typeId);
      }
    }
  }
  return { ids: [...ids], roomTypeId };
}

export async function previewCleaningIssue(tenantId: string, task: {
  id: string;
  roomNumber: string | null;
  taskType: string;
  createdAt: Date;
  details: unknown;
}) {
  const details = detailsOf(task.details);
  const match = await roomMatch(tenantId, task.roomNumber || '');
  const roomTypeId = String(details.roomTypeId || match.roomTypeId || '');
  const kits = await readKits(tenantId);
  const stay = await stayFacts(tenantId, match.ids, task.createdAt);
  const decision = decideCleaningIssue({
    taskId: task.id,
    taskType: task.taskType,
    roomTypeId,
    openedBy: String(details.openedBy || 'attendant'),
    kits,
    checkoutReservationId: stay.checkoutReservationId,
    inHouseReservationId: stay.inHouseReservationId,
    stayoverDate: stayoverDate(),
  });
  const names = await itemNames(tenantId, decision.lines.map((line) => line.itemId));
  return {
    kind: decision.kind as CleaningIssueKind,
    label: cleaningIssueLabel(decision.kind),
    lines: decision.lines.map((line) => ({
      itemId: line.itemId,
      itemName: names.get(line.itemId) || line.itemId,
      quantity: line.quantity,
    })),
    suppliesIssued: !!details.suppliesIssued,
    alreadyTaken: Array.isArray(details.suppliesUsed) ? details.suppliesUsed : [],
    extraRequest: details.extraRequest || null,
  };
}

export async function issueKitForTask(params: {
  tenantId: string;
  taskId: string;
  performedBy?: string;
  extras: { itemId: string; quantity: number }[];
}) {
  const task = await prisma.housekeepingTask.findFirst({
    where: { id: params.taskId, tenantId: params.tenantId },
  });
  if (!task) return { error: 'not_found' as const };
  if (task.status === 'cancelled' || task.status === 'void') return { error: 'closed' as const };

  const details = detailsOf(task.details);
  const preview = await previewCleaningIssue(params.tenantId, task);
  if (details.suppliesIssued) {
    if (task.status === 'completed' || task.status === 'verified') {
      return { error: 'already_issued' as const, preview };
    }
    const extraLines = await nameLines(params.tenantId, parseKitLines(params.extras));
    const now = new Date().toISOString();
    const nextDetails: Record<string, unknown> = { ...details };
    if (extraLines.length > 0 && (!details.extraRequest || details.extraRequest.status === 'rejected')) {
      nextDetails.extraRequest = {
        status: 'pending',
        items: extraLines,
        requestedAt: now,
        requestedBy: params.performedBy || '',
      };
    }
    const updated = await prisma.housekeepingTask.update({
      where: { id: task.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        details: nextDetails as Prisma.InputJsonValue,
      },
    });
    return { error: null, task: updated, issued: [], warnings: [], kind: preview.kind, label: preview.label };
  }

  const names = await itemNames(params.tenantId, preview.lines.map((line) => line.itemId));
  let kitReferenceId = '';
  let warnings: { itemName: string; needed: number; onHand: number }[] = [];
  let issued = preview.lines.map((line) => ({ itemId: line.itemId, itemName: line.itemName, quantity: 0 }));

  if (preview.lines.length > 0) {
    const match = await roomMatch(params.tenantId, task.roomNumber || '');
    const roomTypeId = String(details.roomTypeId || match.roomTypeId || '');
    const kits = await readKits(params.tenantId);
    const stay = await stayFacts(params.tenantId, match.ids, task.createdAt);
    const decision = decideCleaningIssue({
      taskId: task.id,
      taskType: task.taskType,
      roomTypeId,
      openedBy: String(details.openedBy || 'attendant'),
      kits,
      checkoutReservationId: stay.checkoutReservationId,
      inHouseReservationId: stay.inHouseReservationId,
      stayoverDate: stayoverDate(),
    });
    if (decision.referenceId && decision.lines.length > 0) {
      kitReferenceId = decision.referenceId;
      const result = await issueDepartmentStock({
        tenantId: params.tenantId,
        department: 'housekeeping',
        items: decision.lines,
        referenceType: 'housekeeping-kit',
        referenceId: decision.referenceId,
        notes: `Room kit for ${task.roomNumber || 'task'} (${decision.kind})`,
        performedBy: params.performedBy,
        mode: 'best_effort',
      });
      if (result.error) return { error: result.error };
      warnings = result.warnings.map((row) => ({ itemName: row.itemName, needed: row.needed, onHand: row.onHand }));
      const issuedById = new Map(result.issued.map((row) => [row.itemId, row.quantity]));
      issued = decision.lines.map((line) => ({
        itemId: line.itemId,
        itemName: names.get(line.itemId) || line.itemId,
        quantity: issuedById.get(line.itemId) || 0,
      })).filter((line) => line.quantity > 0);
    }
  }
  issued = issued.filter((line) => line.quantity > 0);

  const extraLines = await nameLines(params.tenantId, parseKitLines(params.extras));
  const now = new Date().toISOString();
  const nextDetails: Record<string, unknown> = {
    ...details,
    suppliesUsed: issued,
    suppliesIssued: true,
    ...(kitReferenceId ? { kitReferenceId } : {}),
  };
  if (extraLines.length > 0) {
    nextDetails.extraRequest = {
      status: 'pending',
      items: extraLines,
      requestedAt: now,
      requestedBy: params.performedBy || '',
    };
  }

  const updated = await prisma.housekeepingTask.update({
    where: { id: task.id },
    data: {
      status: 'completed',
      completedAt: task.completedAt || new Date(),
      details: nextDetails as Prisma.InputJsonValue,
    },
  });

  return { error: null, task: updated, issued, warnings, kind: preview.kind, label: preview.label };
}

/** Put the room back to cleaning. Stock stays where the finish left it. */
export async function undoFinishedTask(params: { tenantId: string; taskId: string }) {
  const task = await prisma.housekeepingTask.findFirst({
    where: { id: params.taskId, tenantId: params.tenantId },
  });
  if (!task) return { error: 'not_found' as const };
  if (task.status !== 'completed') return { error: 'not_finished' as const };
  const finishedAt = task.completedAt?.getTime() || 0;
  if (!finishedAt || Date.now() - finishedAt > UNDO_WINDOW_MS) return { error: 'too_late' as const };

  const updated = await prisma.housekeepingTask.update({
    where: { id: task.id },
    data: { status: 'in-progress', completedAt: null },
  });
  return { error: null, task: updated };
}

/** Supervisor puts back the exact kit, or an extra they already approved. A waiting request is cancelled with the kit. */
export async function returnTaskStock(params: {
  tenantId: string;
  taskId: string;
  part: 'kit' | 'extra';
  performedBy?: string;
}) {
  const task = await prisma.housekeepingTask.findFirst({
    where: { id: params.taskId, tenantId: params.tenantId },
  });
  if (!task) return { error: 'not_found' as const };
  const details = detailsOf(task.details);

  if (params.part === 'extra') {
    const request = details.extraRequest;
    if (details.extraReturned) return { error: 'already_returned' as const };
    if (!request || request.status !== 'approved' || !Array.isArray(request.items) || request.items.length === 0) {
      return { error: 'no_approved_extra' as const };
    }
    const result = await returnDepartmentStock({
      tenantId: params.tenantId,
      department: 'housekeeping',
      items: request.items.map((item) => ({ itemId: item.itemId, quantity: item.quantity })),
      referenceType: 'housekeeping-extra-return',
      referenceId: `${task.id}:extra`,
      notes: `Approved extra returned for ${task.roomNumber || 'task'}`,
      performedBy: params.performedBy,
    });
    if (result.error) return { error: result.error };
    await prisma.housekeepingTask.update({
      where: { id: task.id },
      data: { details: { ...details, extraReturned: true } as Prisma.InputJsonValue },
    });
    return { error: null, returned: result.returned, cancelledRequest: false };
  }

  if (details.kitReturned) return { error: 'already_returned' as const };
  const lines = (Array.isArray(details.suppliesUsed) ? details.suppliesUsed : []).filter((line) => line.quantity > 0);
  if (lines.length === 0) return { error: 'nothing_taken' as const };
  const referenceId = String(details.kitReferenceId || task.id);
  const result = await returnDepartmentStock({
    tenantId: params.tenantId,
    department: 'housekeeping',
    items: lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
    referenceType: 'housekeeping-kit-return',
    referenceId,
    notes: `Room kit returned for ${task.roomNumber || 'task'}`,
    performedBy: params.performedBy,
  });
  if (result.error) return { error: result.error };

  const nextDetails: Record<string, unknown> = { ...details, kitReturned: true };
  let cancelledRequest = false;
  if (details.extraRequest?.status === 'pending') {
    nextDetails.extraRequest = {
      ...details.extraRequest,
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: params.performedBy || '',
    };
    cancelledRequest = true;
  }
  await prisma.housekeepingTask.update({
    where: { id: task.id },
    data: { details: nextDetails as Prisma.InputJsonValue },
  });
  return { error: null, returned: result.returned, cancelledRequest };
}

export async function reviewExtraRequest(params: {
  tenantId: string;
  taskId: string;
  action: 'approve' | 'reject';
  performedBy?: string;
}) {
  const task = await prisma.housekeepingTask.findFirst({
    where: { id: params.taskId, tenantId: params.tenantId },
  });
  if (!task) return { error: 'not_found' as const };
  const details = detailsOf(task.details);
  const request = details.extraRequest;
  if (!request || request.status !== 'pending' || !Array.isArray(request.items) || request.items.length === 0) {
    return { error: 'no_request' as const };
  }

  const next = { ...request, reviewedAt: new Date().toISOString(), reviewedBy: params.performedBy || '' };
  if (params.action === 'reject') {
    next.status = 'rejected';
    await prisma.housekeepingTask.update({
      where: { id: task.id },
      data: { details: { ...details, extraRequest: next } as Prisma.InputJsonValue },
    });
    return { error: null, status: 'rejected' as const };
  }

  const result = await issueDepartmentStock({
    tenantId: params.tenantId,
    department: 'housekeeping',
    items: request.items.map((item) => ({ itemId: item.itemId, quantity: item.quantity })),
    referenceType: 'housekeeping-extra',
    referenceId: `${task.id}:extra`,
    notes: `Extra supplies approved for ${task.roomNumber || 'task'}`,
    performedBy: params.performedBy,
    mode: 'strict',
  });
  if (result.error === 'insufficient') {
    return { error: 'insufficient' as const, itemName: result.itemName, onHand: result.onHand };
  }
  if (result.error) return { error: result.error };

  next.status = 'approved';
  const used = Array.isArray(details.suppliesUsed) ? details.suppliesUsed : [];
  await prisma.housekeepingTask.update({
    where: { id: task.id },
    data: {
      details: {
        ...details,
        extraRequest: next,
        suppliesUsed: [...used, ...request.items],
      } as Prisma.InputJsonValue,
    },
  });
  return { error: null, status: 'approved' as const };
}

async function stayFacts(tenantId: string, roomIds: string[], taskCreatedAt: Date) {
  if (roomIds.length === 0) return { checkoutReservationId: null, inHouseReservationId: null };
  const since = new Date(Date.now() - CHECKOUT_WINDOW_MS);
  const [inHouse, checkout] = await Promise.all([
    prisma.reservation.findFirst({
      where: { tenantId, roomId: { in: roomIds }, status: 'checked-in' },
      orderBy: { checkedInAt: 'desc' },
      select: { id: true },
    }),
    prisma.reservation.findFirst({
      where: {
        tenantId,
        roomId: { in: roomIds },
        status: 'checked-out',
        checkedOutAt: { gte: since, lte: new Date(taskCreatedAt.getTime() + 2 * 60 * 60 * 1000) },
      },
      orderBy: { checkedOutAt: 'desc' },
      select: { id: true, checkedOutAt: true },
    }),
  ]);
  const checkoutOk = checkout?.checkedOutAt
    && taskCreatedAt.getTime() >= checkout.checkedOutAt.getTime() - 2 * 60 * 60 * 1000;
  return {
    checkoutReservationId: checkoutOk ? checkout.id : null,
    inHouseReservationId: inHouse?.id || null,
  };
}

function stayoverDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function detailsOf(raw: unknown): {
  roomTypeId?: string;
  openedBy?: string;
  suppliesIssued?: boolean;
  suppliesUsed?: { itemId: string; itemName: string; quantity: number }[];
  extraRequest?: {
    status: 'pending' | 'approved' | 'rejected';
    items: { itemId: string; itemName: string; quantity: number }[];
    requestedAt?: string;
    requestedBy?: string;
    reviewedAt?: string;
    reviewedBy?: string;
  } | null;
  [key: string]: unknown;
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...(raw as Record<string, unknown>) };
}

async function itemNames(tenantId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map<string, string>();
  const items = await prisma.inventoryItem.findMany({
    where: { tenantId, id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(items.map((item) => [item.id, item.name]));
}

async function nameLines(tenantId: string, lines: KitLine[]) {
  const names = await itemNames(tenantId, lines.map((line) => line.itemId));
  return lines
    .filter((line) => names.has(line.itemId))
    .map((line) => ({ itemId: line.itemId, itemName: names.get(line.itemId) || line.itemId, quantity: line.quantity }));
}
