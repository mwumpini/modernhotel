import { SampleCtx, prisma, seedRows, bySampleId, dayOffset, atTime } from './common'

// key, name, agency, role
const GUARDS: Array<[string, string, string | null, string]> = [
  ['kwaku', 'Kwaku Ansah', 'Sentinel Security Services', 'Guard'],
  ['musah', 'Musah Alhassan', 'Sentinel Security Services', 'Guard'],
  ['felix', 'Felix Tetteh', null, 'Supervisor'],
  ['comfort', 'Comfort Addo', 'Sentinel Security Services', 'Guard'],
]
const CHECKPOINTS = ['Main gate', 'Car park', 'Lobby', 'Pool area', 'Kitchen back door', 'Generator house', 'Staff entrance']
const ROUTES = ['Perimeter walk', 'Guest floors', 'Back of house']

export async function loadSecurity(ctx: SampleCtx) {
  const { p, tenantId } = ctx
  const guard = (key: string) => GUARDS.find((g) => g[0] === key)!

  await seedRows(prisma.securityPersonnel, GUARDS.map(([key, name, agency, role]) => ({ id: `${p}sec_${key}`, tenantId, name, agency, role, phone: '+233 24 700 5000', isActive: true })))
  // Checkpoints and routes are names the hotel picks from; add only the ones it doesn't have.
  const haveCheckpoints = new Set((await prisma.securityCheckpointLocation.findMany({ where: { tenantId }, select: { name: true } })).map((c) => c.name))
  await seedRows(prisma.securityCheckpointLocation, CHECKPOINTS.filter((n) => !haveCheckpoints.has(n)).map((name, i) => ({ id: `${p}chk_${i + 1}`, tenantId, name, isActive: true })))
  const haveRoutes = new Set((await prisma.securityPatrolRoute.findMany({ where: { tenantId }, select: { name: true } })).map((r) => r.name))
  await seedRows(prisma.securityPatrolRoute, ROUTES.filter((n) => !haveRoutes.has(n)).map((name, i) => ({ id: `${p}route_${i + 1}`, tenantId, name, isActive: true })))

  // Who is on duty now, and last night's shift handed over.
  await seedRows(prisma.securityShift, [
    { id: `${p}secshift_1`, tenantId, personKey: `person:${p}sec_kwaku`, personName: guard('kwaku')[1], checkInTime: atTime(ctx, 0, 6, 0), status: 'on_duty' },
    { id: `${p}secshift_2`, tenantId, personKey: `person:${p}sec_felix`, personName: guard('felix')[1], checkInTime: atTime(ctx, 0, 6, 10), status: 'on_duty' },
    { id: `${p}secshift_3`, tenantId, personKey: `person:${p}sec_musah`, personName: guard('musah')[1], checkInTime: atTime(ctx, -1, 18, 0), checkOutTime: atTime(ctx, 0, 6, 5), status: 'completed', notes: 'Quiet night. Gate log handed to day shift.' },
  ])

  const checkpoint = (location: string, day: number, h: number, m: number, status = 'completed', notes = '') => ({
    id: location.toLowerCase().replace(/\W+/g, '-'), location, scheduledTime: atTime(ctx, day, h, m).toISOString(), actualTime: status === 'missed' ? null : atTime(ctx, day, h, m + 3).toISOString(), status, notes,
  })
  await seedRows(prisma.securityPatrolLog, [
    { id: `${p}patrol_1`, tenantId, patrolNumber: 'SMP-PTL-001', officerId: `${p}sec_musah`, officerName: guard('musah')[1], route: 'Perimeter walk', startTime: atTime(ctx, -1, 22, 0), endTime: atTime(ctx, -1, 22, 40), status: 'completed',
      checkpoints: [checkpoint('Main gate', -1, 22, 0), checkpoint('Car park', -1, 22, 10), checkpoint('Generator house', -1, 22, 20), checkpoint('Staff entrance', -1, 22, 30)] },
    { id: `${p}patrol_2`, tenantId, patrolNumber: 'SMP-PTL-002', officerId: `${p}sec_musah`, officerName: guard('musah')[1], route: 'Back of house', startTime: atTime(ctx, 0, 2, 0), endTime: atTime(ctx, 0, 2, 35), status: 'interrupted', notes: 'Called to the lobby for a noise complaint.',
      checkpoints: [checkpoint('Kitchen back door', 0, 2, 0, 'completed', 'Door locked'), checkpoint('Generator house', 0, 2, 15, 'missed'), checkpoint('Staff entrance', 0, 2, 30, 'missed')] },
    { id: `${p}patrol_3`, tenantId, patrolNumber: 'SMP-PTL-003', officerId: `${p}sec_kwaku`, officerName: guard('kwaku')[1], route: 'Guest floors', startTime: new Date(Date.now() - 20 * 60_000), status: 'active',
      checkpoints: [checkpoint('Lobby', 0, new Date().getUTCHours(), 0), { ...checkpoint('Pool area', 0, new Date().getUTCHours(), 20), status: 'pending', actualTime: null }] },
  ])

  await seedRows(prisma.securityIncident, [
    { id: `${p}inc_1`, tenantId, incidentNumber: 'SMP-INC-001', type: 'theft', severity: 'medium', status: 'investigating', location: 'Guest room', floor: '2', room: '201', description: 'Guest reports a phone charger and power bank missing from the room after service.', reportedBy: 'Front desk', reportedAt: atTime(ctx, -1, 16, 30), assignedTo: guard('felix')[1], assignedAt: atTime(ctx, -1, 16, 45), witnesses: ['Room attendant on duty'], notes: 'Housekeeping cart log requested.' },
    { id: `${p}inc_2`, tenantId, incidentNumber: 'SMP-INC-002', type: 'suspicious_activity', severity: 'low', status: 'resolved', location: 'Car park', description: 'Unregistered vehicle parked overnight near the generator house.', reportedBy: guard('musah')[1], reportedAt: atTime(ctx, -3, 23, 10), resolvedAt: atTime(ctx, -2, 8, 0), resolution: 'Vehicle belonged to a wedding guest; details added to the visitor log.' },
    { id: `${p}inc_3`, tenantId, incidentNumber: 'SMP-INC-003', type: 'medical_emergency', severity: 'high', status: 'closed', location: 'Pool area', description: 'Guest slipped on the pool deck and cut their knee.', reportedBy: 'Pool attendant', reportedAt: atTime(ctx, -6, 15, 20), resolvedAt: atTime(ctx, -6, 15, 50), resolution: 'First aid given; guest declined hospital. Wet-floor signs added.', cost: 120, insuranceClaim: false },
    { id: `${p}inc_4`, tenantId, incidentNumber: 'SMP-INC-004', type: 'fire_alarm', severity: 'critical', status: 'reported', location: 'Kitchen', description: 'Smoke detector triggered by the grill extractor — building partly evacuated for 10 minutes.', reportedBy: 'Head Chef', reportedAt: new Date(Date.now() - 45 * 60_000), policeReport: false },
  ])

  await seedRows(prisma.securityVisitor, [
    { id: `${p}vis_1`, tenantId, visitorNumber: 'SMP-VIS-001', name: 'Emmanuel Asante', phone: '+233 24 610 0001', idType: 'ghana-card', idNumber: 'GHA-000000001-1', purpose: 'Meeting a guest', hostName: 'Sarah Thompson', hostRoom: '201', checkInTime: new Date(Date.now() - 50 * 60_000), expectedHours: 2, status: 'checked_in' },
    { id: `${p}vis_2`, tenantId, visitorNumber: 'SMP-VIS-002', name: 'Rita Boakye (supplier)', phone: '+233 20 610 0002', idType: 'drivers-license', idNumber: 'DL-000002', purpose: 'Produce delivery', hostName: 'Kitchen', checkInTime: atTime(ctx, 0, 7, 20), checkOutTime: atTime(ctx, 0, 7, 55), status: 'checked_out', vehicleNumber: 'GR 1234-20' },
    { id: `${p}vis_3`, tenantId, visitorNumber: 'SMP-VIS-003', name: 'Kojo Amankwah', idType: 'passport', idNumber: 'G0000003', purpose: 'Contractor — air conditioning repair', hostName: 'Maintenance', checkInTime: atTime(ctx, 0, 8, 30), expectedHours: 1, status: 'overdue', escortRequired: true, escortName: guard('kwaku')[1] },
  ])

  await seedRows(prisma.securityComplianceRequirement, [
    { id: `${p}secreq_1`, tenantId, title: 'Fire extinguisher servicing', category: 'fire_safety', frequency: 'annually', lastCompletedAt: dayOffset(ctx, -340), nextDueDate: dayOffset(ctx, 25), responsiblePerson: 'Felix Tetteh', penaltyAmount: 2000 },
    { id: `${p}secreq_2`, tenantId, title: 'Ghana National Fire Service certificate', category: 'licensing', frequency: 'annually', lastCompletedAt: dayOffset(ctx, -380), nextDueDate: dayOffset(ctx, -15), responsiblePerson: 'General Manager', penaltyAmount: 5000, notes: 'Overdue — inspection booked.' },
    { id: `${p}secreq_3`, tenantId, title: 'Food handlers\' medical screening', category: 'health_hygiene', frequency: 'quarterly', lastCompletedAt: dayOffset(ctx, -80), nextDueDate: dayOffset(ctx, 10), responsiblePerson: 'Nana Yaa Asare' },
    { id: `${p}secreq_4`, tenantId, title: 'Fire drill', category: 'fire_safety', frequency: 'quarterly', lastCompletedAt: dayOffset(ctx, -30), nextDueDate: dayOffset(ctx, 60), responsiblePerson: 'Felix Tetteh' },
  ])
}

export async function removeSecurity(ctx: SampleCtx) {
  const where = bySampleId(ctx)
  await prisma.securityComplianceRequirement.deleteMany({ where })
  await prisma.securityVisitor.deleteMany({ where })
  await prisma.securityIncident.deleteMany({ where })
  await prisma.securityPatrolLog.deleteMany({ where })
  await prisma.securityShift.deleteMany({ where })
  await prisma.securityPatrolRoute.deleteMany({ where })
  await prisma.securityCheckpointLocation.deleteMany({ where })
  await prisma.securityPersonnel.deleteMany({ where })
}

export async function countSecurity(ctx: SampleCtx) {
  return { securityIncidents: await prisma.securityIncident.count({ where: bySampleId(ctx) }) }
}
