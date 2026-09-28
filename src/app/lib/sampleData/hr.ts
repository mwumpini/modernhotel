import { SampleCtx, prisma, seedRows, sampleIds, bySampleId, dayOffset, dayString, atTime } from './common'

const DEPARTMENTS = [
  { key: 'fo', name: 'Front Office', code: 'FO', description: 'Reception, reservations and guest relations', budget: 90000 },
  { key: 'hk', name: 'Housekeeping', code: 'HK', description: 'Room cleaning, laundry and public areas', budget: 60000 },
  { key: 'fb', name: 'Food & Beverage', code: 'FB', description: 'Restaurant and bar service', budget: 75000 },
  { key: 'kit', name: 'Kitchen', code: 'KIT', description: 'Food preparation and kitchen stores', budget: 80000 },
  { key: 'acc', name: 'Accounts & Administration', code: 'ACC', description: 'Accounting, payroll and administration', budget: 50000 },
]

const POSITIONS = [
  { key: 'recep', dept: 'fo', title: 'Front Desk Receptionist', code: 'FO-REC', baseSalary: 2200 },
  { key: 'fosup', dept: 'fo', title: 'Front Office Supervisor', code: 'FO-SUP', baseSalary: 3500 },
  { key: 'maid', dept: 'hk', title: 'Housekeeper', code: 'HK-ROOM', baseSalary: 1800 },
  { key: 'hksup', dept: 'hk', title: 'Housekeeping Supervisor', code: 'HK-SUP', baseSalary: 2800 },
  { key: 'waiter', dept: 'fb', title: 'Waiter / Waitress', code: 'FB-SRV', baseSalary: 1700 },
  { key: 'barman', dept: 'fb', title: 'Bartender', code: 'FB-BAR', baseSalary: 2000 },
  { key: 'chef', dept: 'kit', title: 'Head Chef', code: 'KIT-CHF', baseSalary: 4500 },
  { key: 'cook', dept: 'kit', title: 'Cook', code: 'KIT-COK', baseSalary: 2200 },
  { key: 'clerk', dept: 'acc', title: 'Accounts Clerk', code: 'ACC-CLK', baseSalary: 2800 },
]

// key, first, last, gender, position, allowances, hired (days ago), born (years ago), health certificate expiry (days from today)
const STAFF: Array<[string, string, string, 'female' | 'male', string, number, number, number, number | null]> = [
  ['akosua', 'Akosua', 'Mensah', 'female', 'recep', 300, 900, 28, null],
  ['kwabena', 'Kwabena', 'Owusu', 'male', 'fosup', 500, 1800, 36, null],
  ['ama', 'Ama', 'Serwaa', 'female', 'maid', 200, 500, 31, null],
  ['yaw', 'Yaw', 'Boateng', 'male', 'hksup', 350, 1500, 40, null],
  ['efua', 'Efua', 'Quaye', 'female', 'waiter', 200, 400, 25, 18],
  ['kofi', 'Kofi', 'Adjei', 'male', 'barman', 250, 700, 30, 300],
  ['nanayaa', 'Nana Yaa', 'Asare', 'female', 'chef', 600, 2100, 38, 45],
  ['kojo', 'Kojo', 'Antwi', 'male', 'cook', 250, 600, 29, 40],
  ['abena', 'Abena', 'Danso', 'female', 'clerk', 350, 1200, 34, null],
  ['ibrahim', 'Ibrahim', 'Mahama', 'male', 'recep', 300, 300, 27, null],
]

export async function loadHr(ctx: SampleCtx) {
  const { p, tenantId } = ctx
  const dept = (key: string) => `${p}dept_${key}`
  const pos = (key: string) => `${p}pos_${key}`
  const emp = (key: string) => `${p}emp_${key}`

  await seedRows(prisma.hrDepartment, DEPARTMENTS.map((d) => ({
    id: dept(d.key), tenantId, name: d.name, code: d.code, description: d.description, budget: d.budget, location: 'Main building', isActive: true, status: 'active',
  })))

  await seedRows(prisma.hrPosition, POSITIONS.map((x) => ({
    id: pos(x.key), tenantId, title: x.title, code: x.code, departmentId: dept(x.dept), description: `${x.title} — sample position`,
    baseSalary: x.baseSalary, minSalary: Math.round(x.baseSalary * 0.85), maxSalary: Math.round(x.baseSalary * 1.3), isActive: true, status: 'active',
  })))

  const yearsAgo = (years: number) => new Date(Date.UTC(ctx.today.getUTCFullYear() - years, 5, 15))
  await seedRows(prisma.hrEmployee, STAFF.map(([key, first, last, gender, position, allowances, hiredDaysAgo, age, healthCert], i) => {
    const posRow = POSITIONS.find((x) => x.key === position)!
    return {
      id: emp(key), tenantId, employeeNumber: `SMP-${String(i + 1).padStart(3, '0')}`,
      firstName: first, lastName: last, gender, nationality: 'Ghanaian', maritalStatus: i % 2 ? 'married' : 'single',
      email: `${first.toLowerCase().replace(/\s+/g, '')}.${last.toLowerCase()}@sample.hotel`, phone: `+233 24 555 ${String(100 + i).padStart(4, '0')}`,
      dateOfBirth: yearsAgo(age), hireDate: dayOffset(ctx, -hiredDaysAgo),
      departmentId: dept(posRow.dept), positionId: pos(position), workLocation: 'Main building',
      employmentType: 'full_time', status: 'active', residencyStatus: 'resident', employmentClass: 'permanent',
      incomeTaxDeductible: true, ssnitEnrolled: true, tier2Enrolled: true, tier3Enrolled: false,
      compensationType: 'salary', paymentFrequency: 'monthly', salary: posRow.baseSalary, basicSalary: posRow.baseSalary, allowances,
      details: {
        bankAccount: { accountNumber: `01230456${String(i).padStart(2, '0')}`, bankName: 'GCB Bank', branchCode: 'Accra Main' },
        emergencyContact: { name: 'Sample Contact', relationship: 'family', phone: '+233 20 000 0000' },
        ...(healthCert !== null ? { healthCertificateExpiryDate: dayString(ctx, healthCert) } : {}),
      },
    }
  }))

  // Leave: an approved one with a relief officer, a sick day, one waiting for a decision, one turned down.
  const leave = (id: string, employee: string, leaveType: string, from: number, to: number, totalDays: number, status: string, extra: Record<string, any> = {}) => ({
    id: `${p}leave_${id}`, tenantId, employeeId: emp(employee), leaveType, startDate: dayOffset(ctx, from), endDate: dayOffset(ctx, to), totalDays, status,
    requestedAt: dayOffset(ctx, from - 10), ...extra,
  })
  await seedRows(prisma.hrLeaveRequest, [
    leave('1', 'akosua', 'annual', 7, 11, 5, 'approved', { reason: 'Family visit', approvedBy: 'Sample Manager', approvedAt: dayOffset(ctx, -2), coveringEmployeeId: emp('ibrahim'), handoverNotes: 'Cover the morning desk; the arrivals list is printed daily.' }),
    leave('2', 'kofi', 'sick', -1, 0, 2, 'approved', { reason: 'Unwell', approvedBy: 'Sample Manager', approvedAt: dayOffset(ctx, -1) }),
    leave('3', 'efua', 'annual', 20, 24, 5, 'pending', { reason: 'Travel' }),
    leave('4', 'kojo', 'personal', -14, -13, 2, 'rejected', { reason: 'Personal errand', rejectionReason: 'Kitchen was short-staffed that week.' }),
  ])

  // Attendance for the last five days for six staff — one late morning, one absence.
  const attendanceStaff = ['akosua', 'ibrahim', 'ama', 'efua', 'kofi', 'kojo']
  const attendance: Array<Record<string, any>> = []
  for (let back = 1; back <= 5; back++) {
    attendanceStaff.forEach((key, i) => {
      const absent = key === 'kojo' && back === 3
      const late = key === 'efua' && back === 2
      const inMin = late ? 35 : 50 + ((i + back) % 5)
      attendance.push({
        id: `${p}att_${key}_${back}`, tenantId, employeeId: emp(key), date: dayOffset(ctx, -back),
        checkInTime: absent ? null : atTime(ctx, -back, 6, inMin), checkOutTime: absent ? null : atTime(ctx, -back, 15, 5),
        totalHours: absent ? 0 : 8, overtimeHours: 0, breakTime: 1, status: absent ? 'absent' : late ? 'late' : 'present', shift: 'morning', location: 'Main building',
      })
    })
  }
  await seedRows(prisma.hrAttendance, attendance)

  // This week's roster.
  const roster: Array<Record<string, any>> = []
  for (let d = 0; d < 7; d++) {
    attendanceStaff.forEach((key) => {
      const night = key === 'ibrahim'
      roster.push({ id: `${p}shift_${key}_${d}`, tenantId, employeeId: emp(key), date: dayString(ctx, d), startTime: night ? '22:00' : '07:00', endTime: night ? '06:00' : '15:00', location: 'Main building' })
    })
  }
  await seedRows(prisma.hrShift, roster)

  // Training: a mandatory food-safety course coming up, and a completed guest-service course.
  await seedRows(prisma.hrTrainingProgram, [
    { id: `${p}trn_food`, tenantId, title: 'Food Safety & Hygiene', code: 'SMP-FSH', description: 'Mandatory safe food handling for kitchen and restaurant staff', category: 'compliance', duration: 8, cost: 0, maxParticipants: 12, instructor: 'Environmental Health Officer', location: 'Conference room', startDate: dayOffset(ctx, 10), endDate: dayOffset(ctx, 10), status: 'scheduled', mandatory: true },
    { id: `${p}trn_guest`, tenantId, title: 'Guest Service Excellence', code: 'SMP-GSE', description: 'Handling guests, complaints and first impressions', category: 'soft_skills', duration: 6, cost: 450, maxParticipants: 15, instructor: 'External trainer', location: 'Conference room', startDate: dayOffset(ctx, -30), endDate: dayOffset(ctx, -30), status: 'completed', mandatory: false },
  ])
  const record = (id: string, program: string, employee: string, status: string, extra: Record<string, any> = {}) => ({
    id: `${p}trnrec_${id}`, tenantId, trainingProgramId: `${p}trn_${program}`, employeeId: emp(employee), enrollmentDate: dayOffset(ctx, -35), status, ...extra,
  })
  await seedRows(prisma.hrTrainingRecord, [
    record('1', 'food', 'efua', 'enrolled'), record('2', 'food', 'kofi', 'enrolled'), record('3', 'food', 'nanayaa', 'enrolled'), record('4', 'food', 'kojo', 'enrolled'),
    record('5', 'guest', 'akosua', 'completed', { completionDate: dayOffset(ctx, -30), score: 92, cost: 450 }),
    record('6', 'guest', 'ibrahim', 'completed', { completionDate: dayOffset(ctx, -30), score: 85, cost: 450 }),
  ])

  // Performance log: good and not-so-good moments.
  const log = (id: string, employee: string, offset: number, score: number, category: string, note: string) => ({
    id: `${p}perf_${id}`, tenantId, employeeId: emp(employee), date: dayOffset(ctx, offset), score, category, note, recordedByName: 'Sample Manager', status: 'active',
  })
  await seedRows(prisma.hrPerformanceLog, [
    log('1', 'akosua', -6, 4, 'guest_service', 'Calmly resolved a double-booking complaint and the guest left a compliment.'),
    log('2', 'nanayaa', -12, 5, 'hygiene_safety', 'Kitchen passed the surprise hygiene inspection with no findings.'),
    log('3', 'kojo', -3, -2, 'punctuality', 'Arrived 40 minutes late on a busy breakfast shift without notice.'),
    log('4', 'ibrahim', -8, 3, 'cash_handling', 'Reconciled the night float to the pesewa and flagged a short payment.'),
  ])
}

export async function removeHr(ctx: SampleCtx) {
  const employeeIds = await sampleIds(prisma.hrEmployee, ctx)
  if (employeeIds.length > 0) {
    const forEmployees = { tenantId: ctx.tenantId, employeeId: { in: employeeIds } }
    await prisma.hrPerformanceLog.deleteMany({ where: forEmployees })
    await prisma.hrTrainingRecord.deleteMany({ where: forEmployees })
    await prisma.hrLeaveRequest.deleteMany({ where: forEmployees })
    await prisma.hrAttendance.deleteMany({ where: forEmployees })
    await prisma.hrShift.deleteMany({ where: forEmployees })
    const touched = await prisma.hrPayrollRecord.findMany({ where: forEmployees, select: { payrollPeriodId: true } })
    await prisma.hrPayrollRecord.deleteMany({ where: forEmployees })
    // A payroll month prepared from sample staff that has nothing left in it (and was never approved) goes too.
    for (const periodId of Array.from(new Set(touched.map((r) => r.payrollPeriodId)))) {
      const remaining = await prisma.hrPayrollRecord.count({ where: { payrollPeriodId: periodId } })
      if (remaining === 0) await prisma.hrPayrollPeriod.deleteMany({ where: { id: periodId, tenantId: ctx.tenantId, status: { in: ['processing', 'draft'] } } })
    }
  }
  await prisma.hrTrainingProgram.deleteMany({ where: bySampleId(ctx) })
  await prisma.hrEmployee.deleteMany({ where: bySampleId(ctx) })
  await prisma.hrPosition.deleteMany({ where: bySampleId(ctx) })
  await prisma.hrDepartment.deleteMany({ where: bySampleId(ctx) })
}

export async function countHr(ctx: SampleCtx) {
  return {
    staff: await prisma.hrEmployee.count({ where: bySampleId(ctx) }),
    departments: await prisma.hrDepartment.count({ where: bySampleId(ctx) }),
  }
}
