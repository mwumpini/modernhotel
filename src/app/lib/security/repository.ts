import { prisma } from '../database/client'
import { recordBelongsToOtherTenant } from './tenantGuard'

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

/** Ownership-checked upsert-by-client-id — see tablesRepository.ts for the full rationale. */
async function ownershipCheckedUpsert<T>(
  model: { findUnique: (args: any) => Promise<any>; create: (args: any) => Promise<T>; update: (args: any) => Promise<T> },
  id: string,
  tenantId: string,
  data: Record<string, any>,
  createExtra: Record<string, any> = {},
): Promise<T> {
  const existing = await model.findUnique({ where: { id } })
  if (recordBelongsToOtherTenant(existing?.tenantId, tenantId)) {
    throw new Error('Record belongs to a different tenant')
  }
  if (existing) {
    return model.update({ where: { id }, data })
  }
  return model.create({ data: { id, tenantId, ...createExtra, ...data } })
}

// ── Incidents ────────────────────────────────────────────────────────────────

function toStoreIncident(row: any) {
  return {
    id: row.id,
    incidentNumber: row.incidentNumber,
    type: row.type,
    severity: row.severity,
    status: row.status,
    location: row.location,
    floor: row.floor ?? undefined,
    room: row.room ?? undefined,
    description: row.description,
    reportedBy: row.reportedBy,
    reportedAt: new Date(row.reportedAt).toISOString(),
    assignedTo: row.assignedTo ?? undefined,
    assignedAt: row.assignedAt ? new Date(row.assignedAt).toISOString() : undefined,
    resolvedAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : undefined,
    resolution: row.resolution ?? undefined,
    witnesses: row.witnesses ?? undefined,
    cost: row.cost != null ? Number(row.cost) : undefined,
    policeReport: row.policeReport,
    insuranceClaim: row.insuranceClaim,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

export async function listIncidents(tenantId: string) {
  const rows = await prisma.securityIncident.findMany({ where: { tenantId }, orderBy: { reportedAt: 'desc' } })
  return rows.map(toStoreIncident)
}

export async function upsertIncident(tenantId: string, id: string, incident: Record<string, any>) {
  const data = stripUndefined({
    incidentNumber: incident.incidentNumber,
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    location: incident.location,
    floor: incident.floor,
    room: incident.room,
    description: incident.description,
    reportedBy: incident.reportedBy,
    reportedAt: incident.reportedAt ? new Date(incident.reportedAt) : undefined,
    assignedTo: incident.assignedTo,
    assignedAt: incident.assignedAt ? new Date(incident.assignedAt) : undefined,
    resolvedAt: incident.resolvedAt ? new Date(incident.resolvedAt) : undefined,
    resolution: incident.resolution,
    witnesses: incident.witnesses,
    cost: incident.cost,
    policeReport: incident.policeReport,
    insuranceClaim: incident.insuranceClaim,
    notes: incident.notes,
  })
  const row = await ownershipCheckedUpsert(prisma.securityIncident, id, tenantId, data, {
    incidentNumber: incident.incidentNumber,
    type: incident.type,
    location: incident.location,
    description: incident.description,
    reportedBy: incident.reportedBy,
  })
  return toStoreIncident(row)
}

// ── Visitors ─────────────────────────────────────────────────────────────────

function toStoreVisitor(row: any) {
  return {
    id: row.id,
    visitorNumber: row.visitorNumber,
    name: row.name,
    phone: row.phone ?? undefined,
    idType: row.idType ?? undefined,
    idNumber: row.idNumber ?? undefined,
    purpose: row.purpose,
    hostName: row.hostName ?? undefined,
    hostRoom: row.hostRoom ?? undefined,
    checkInTime: new Date(row.checkInTime).toISOString(),
    checkOutTime: row.checkOutTime ? new Date(row.checkOutTime).toISOString() : undefined,
    expectedHours: row.expectedHours ?? undefined,
    status: row.status,
    vehicleNumber: row.vehicleNumber ?? undefined,
    escortRequired: row.escortRequired,
    escortName: row.escortName ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

export async function listVisitors(tenantId: string) {
  const rows = await prisma.securityVisitor.findMany({ where: { tenantId }, orderBy: { checkInTime: 'desc' } })
  return rows.map(toStoreVisitor)
}

export async function upsertVisitor(tenantId: string, id: string, visitor: Record<string, any>) {
  const data = stripUndefined({
    visitorNumber: visitor.visitorNumber,
    name: visitor.name,
    phone: visitor.phone,
    idType: visitor.idType,
    idNumber: visitor.idNumber,
    purpose: visitor.purpose,
    hostName: visitor.hostName,
    hostRoom: visitor.hostRoom,
    checkInTime: visitor.checkInTime ? new Date(visitor.checkInTime) : undefined,
    checkOutTime: visitor.checkOutTime ? new Date(visitor.checkOutTime) : undefined,
    expectedHours: visitor.expectedHours,
    status: visitor.status,
    vehicleNumber: visitor.vehicleNumber,
    escortRequired: visitor.escortRequired,
    escortName: visitor.escortName,
    approvedBy: visitor.approvedBy,
    notes: visitor.notes,
  })
  const row = await ownershipCheckedUpsert(prisma.securityVisitor, id, tenantId, data, {
    visitorNumber: visitor.visitorNumber,
    name: visitor.name,
    purpose: visitor.purpose,
  })
  return toStoreVisitor(row)
}

// ── Patrol logs ──────────────────────────────────────────────────────────────

function toStorePatrol(row: any) {
  return {
    id: row.id,
    patrolNumber: row.patrolNumber,
    officerId: row.officerId ?? undefined,
    officerName: row.officerName,
    route: row.route,
    startTime: new Date(row.startTime).toISOString(),
    endTime: row.endTime ? new Date(row.endTime).toISOString() : undefined,
    status: row.status,
    checkpoints: row.checkpoints ?? [],
    notes: row.notes ?? undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

export async function listPatrolLogs(tenantId: string) {
  const rows = await prisma.securityPatrolLog.findMany({ where: { tenantId }, orderBy: { startTime: 'desc' } })
  return rows.map(toStorePatrol)
}

export async function upsertPatrolLog(tenantId: string, id: string, patrol: Record<string, any>) {
  const data = stripUndefined({
    patrolNumber: patrol.patrolNumber,
    officerId: patrol.officerId,
    officerName: patrol.officerName,
    route: patrol.route,
    startTime: patrol.startTime ? new Date(patrol.startTime) : undefined,
    endTime: patrol.endTime ? new Date(patrol.endTime) : undefined,
    status: patrol.status,
    checkpoints: patrol.checkpoints,
    notes: patrol.notes,
  })
  const row = await ownershipCheckedUpsert(prisma.securityPatrolLog, id, tenantId, data, {
    patrolNumber: patrol.patrolNumber,
    officerName: patrol.officerName,
    route: patrol.route,
  })
  return toStorePatrol(row)
}

// ── Compliance requirements ─────────────────────────────────────────────────

function toStoreCompliance(row: any) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    frequency: row.frequency,
    lastCompletedAt: row.lastCompletedAt ? new Date(row.lastCompletedAt).toISOString() : undefined,
    nextDueDate: new Date(row.nextDueDate).toISOString(),
    responsiblePerson: row.responsiblePerson ?? undefined,
    penaltyAmount: row.penaltyAmount != null ? Number(row.penaltyAmount) : undefined,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

export async function listComplianceRequirements(tenantId: string) {
  const rows = await prisma.securityComplianceRequirement.findMany({ where: { tenantId }, orderBy: { nextDueDate: 'asc' } })
  return rows.map(toStoreCompliance)
}

export async function upsertComplianceRequirement(tenantId: string, id: string, req: Record<string, any>) {
  const data = stripUndefined({
    title: req.title,
    category: req.category,
    frequency: req.frequency,
    lastCompletedAt: req.lastCompletedAt ? new Date(req.lastCompletedAt) : undefined,
    nextDueDate: req.nextDueDate ? new Date(req.nextDueDate) : undefined,
    responsiblePerson: req.responsiblePerson,
    penaltyAmount: req.penaltyAmount,
    notes: req.notes,
  })
  const row = await ownershipCheckedUpsert(prisma.securityComplianceRequirement, id, tenantId, data, {
    title: req.title,
    category: req.category,
    frequency: req.frequency,
    nextDueDate: req.nextDueDate ? new Date(req.nextDueDate) : new Date(),
  })
  return toStoreCompliance(row)
}

// ── Security personnel (outsourced/contracted guards without a User account) ─

function toStorePersonnel(row: any) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    agency: row.agency ?? undefined,
    role: row.role ?? undefined,
    isActive: row.isActive,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

export async function listSecurityPersonnel(tenantId: string) {
  const rows = await prisma.securityPersonnel.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  return rows.map(toStorePersonnel)
}

export async function upsertSecurityPersonnel(tenantId: string, id: string, person: Record<string, any>) {
  const data = stripUndefined({
    name: person.name,
    phone: person.phone,
    agency: person.agency,
    role: person.role,
    isActive: person.isActive,
    notes: person.notes,
  })
  const row = await ownershipCheckedUpsert(prisma.securityPersonnel, id, tenantId, data, {
    name: person.name,
  })
  return toStorePersonnel(row)
}

// ── Checkpoint locations (reusable list for building a patrol route) ────────

function toStoreCheckpointLocation(row: any) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

export async function listCheckpointLocations(tenantId: string) {
  const rows = await prisma.securityCheckpointLocation.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  return rows.map(toStoreCheckpointLocation)
}

export async function upsertCheckpointLocation(tenantId: string, id: string, loc: Record<string, any>) {
  const data = stripUndefined({
    name: loc.name,
    isActive: loc.isActive,
  })
  const row = await ownershipCheckedUpsert(prisma.securityCheckpointLocation, id, tenantId, data, {
    name: loc.name,
  })
  return toStoreCheckpointLocation(row)
}

// ── Patrol routes (reusable list, same idea as checkpoint locations) ────────

function toStorePatrolRoute(row: any) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

export async function listPatrolRoutes(tenantId: string) {
  const rows = await prisma.securityPatrolRoute.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  return rows.map(toStorePatrolRoute)
}

export async function upsertPatrolRoute(tenantId: string, id: string, route: Record<string, any>) {
  const data = stripUndefined({
    name: route.name,
    isActive: route.isActive,
  })
  const row = await ownershipCheckedUpsert(prisma.securityPatrolRoute, id, tenantId, data, {
    name: route.name,
  })
  return toStorePatrolRoute(row)
}

// ── Duty shifts (check-in/check-out attendance for staff or contracted personnel) ─

function toStoreShift(row: any) {
  return {
    id: row.id,
    personKey: row.personKey,
    personName: row.personName,
    checkInTime: new Date(row.checkInTime).toISOString(),
    checkOutTime: row.checkOutTime ? new Date(row.checkOutTime).toISOString() : undefined,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

export async function listShifts(tenantId: string) {
  const rows = await prisma.securityShift.findMany({ where: { tenantId }, orderBy: { checkInTime: 'desc' } })
  return rows.map(toStoreShift)
}

export async function upsertShift(tenantId: string, id: string, shift: Record<string, any>) {
  const data = stripUndefined({
    personKey: shift.personKey,
    personName: shift.personName,
    checkInTime: shift.checkInTime ? new Date(shift.checkInTime) : undefined,
    checkOutTime: shift.checkOutTime ? new Date(shift.checkOutTime) : undefined,
    status: shift.status,
    notes: shift.notes,
  })
  const row = await ownershipCheckedUpsert(prisma.securityShift, id, tenantId, data, {
    personKey: shift.personKey,
    personName: shift.personName,
  })
  return toStoreShift(row)
}
