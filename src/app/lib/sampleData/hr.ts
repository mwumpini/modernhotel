import { SampleCtx, prisma, seedRows, sampleIds, bySampleId, dayOffset, dayString, atTime } from './common'
import { postEntries, hasChartOfAccounts } from './ledger'

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
  ['selasi', 'Selasi', 'Agbeko', 'female', 'waiter', 200, 6, 23, 60],
]

/** Ghana PAYE on a month's chargeable income (resident bands). */
function monthlyPaye(chargeable: number): number {
  const bands: Array<[number, number]> = [[588, 0], [80, 0.05], [100, 0.1], [2900, 0.175], [16000, 0.25], [30332, 0.3], [Infinity, 0.35]]
  let left = chargeable, tax = 0
  for (const [width, rate] of bands) {
    const slice = Math.min(left, width)
    if (slice <= 0) break
    tax += slice * rate
    left -= slice
  }
  return Math.round(tax * 100) / 100
}

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

  // Attendance for the last five days for six staff — one late morning, one absence, and one long
  // shift whose overtime waits for approval (shown in the Approvals inbox when Settings requires it).
  const attendanceStaff = ['akosua', 'ibrahim', 'ama', 'efua', 'kofi', 'kojo']
  const attendance: Array<Record<string, any>> = []
  for (let back = 1; back <= 5; back++) {
    attendanceStaff.forEach((key, i) => {
      const absent = key === 'kojo' && back === 3
      const late = key === 'efua' && back === 2
      const overtime = key === 'kofi' && back === 1 ? 3 : 0
      const inMin = late ? 35 : 50 + ((i + back) % 5)
      attendance.push({
        id: `${p}att_${key}_${back}`, tenantId, employeeId: emp(key), date: dayOffset(ctx, -back),
        checkInTime: absent ? null : atTime(ctx, -back, 6, inMin), checkOutTime: absent ? null : atTime(ctx, -back, 15 + overtime, 5),
        totalHours: absent ? 0 : 8 + overtime, overtimeHours: overtime, breakTime: 1, status: absent ? 'absent' : late ? 'late' : 'present', shift: 'morning', location: 'Main building',
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

  // Quarterly reviews: one signed off, one waiting on the employee.
  const ratings = (n: number) => ({ jobKnowledge: n, qualityOfWork: n, quantityOfWork: n, teamwork: n, communication: n, initiative: n, attendance: n, reliability: n })
  await seedRows(prisma.hrPerformanceReview, [
    { id: `${p}rev_1`, tenantId, employeeId: emp('akosua'), reviewPeriod: 'Last quarter', reviewDate: dayOffset(ctx, -12), reviewerName: 'Kwabena Owusu', overallRating: 4.5, categories: { ...ratings(5), quantityOfWork: 4, initiative: 4 }, strengths: ['Calm with difficult guests', 'Accurate cash handling'], areasForImprovement: ['Upselling room upgrades'], goals: ['Lead the arrivals desk on weekends'], comments: 'A dependable member of the desk team.', employeeComments: 'Thank you — keen to train new staff.', status: 'completed', nextReviewDate: dayOffset(ctx, 78) },
    { id: `${p}rev_2`, tenantId, employeeId: emp('kojo'), reviewPeriod: 'Last quarter', reviewDate: dayOffset(ctx, -4), reviewerName: 'Nana Yaa Asare', overallRating: 2.8, categories: { ...ratings(3), attendance: 2, reliability: 2 }, strengths: ['Good knife skills'], areasForImprovement: ['Punctuality on early shifts', 'Following the prep list'], goals: ['No late arrivals next quarter'], comments: 'Skills are there; timekeeping must improve.', status: 'submitted', nextReviewDate: dayOffset(ctx, 86) },
  ])

  // A promotion and a pay rise in the change history.
  await seedRows(prisma.hrEmployeeChange, [
    { id: `${p}chg_1`, tenantId, employeeId: emp('yaw'), employeeName: 'Yaw Boateng', type: 'promotion', field: 'position', previousValue: 'Housekeeper', newValue: 'Housekeeping Supervisor', changedBy: 'Sample Manager', notes: 'Promoted after a strong year running the second floor.', timestamp: dayOffset(ctx, -200) },
    { id: `${p}chg_2`, tenantId, employeeId: emp('ibrahim'), employeeName: 'Ibrahim Mahama', type: 'salary_change', field: 'allowances', previousValue: 200, newValue: 300, changedBy: 'Sample Manager', notes: 'Night-shift allowance added.', timestamp: dayOffset(ctx, -60) },
  ])

  // The newest hire is half-way through onboarding.
  const steps: Array<[string, string, boolean]> = [
    ['contract', 'Signed employment contract collected', true], ['id_documents', 'ID documents collected (Ghana Card / passport)', true], ['ssnit_tin', 'SSNIT number and TIN recorded', true],
    ['bank_details', 'Bank account details on file', false], ['equipment', 'Uniform / equipment issued', true], ['system_access', 'System access granted (login, email)', false], ['orientation', 'Orientation / induction completed', false],
  ]
  await seedRows(prisma.hrOnboardingChecklist, [{ id: `${p}onb_selasi`, tenantId, employeeId: emp('selasi'), tasks: steps.map(([key, label, completed]) => ({ key, label, completed })), startedAt: dayOffset(ctx, -6) }])

  // Benefits: medical cover and staff meals.
  await seedRows(prisma.hrBenefitsPackage, [
    { id: `${p}ben_med`, tenantId, name: 'Staff Medical Cover', description: 'Private health insurance — outpatient and inpatient', type: 'health', coverage: 'Employee only', cost: 150, employeeContribution: 50, employerContribution: 100, isActive: true, effectiveDate: dayOffset(ctx, -365) },
    { id: `${p}ben_pens`, tenantId, name: 'Tier 3 Provident Fund', description: 'Voluntary savings matched by the hotel', type: 'retirement', coverage: 'Employee', cost: 200, employeeContribution: 100, employerContribution: 100, isActive: true, effectiveDate: dayOffset(ctx, -365) },
  ])
  await seedRows(prisma.hrEmployeeBenefits, ['kwabena', 'yaw', 'nanayaa', 'abena', 'akosua'].map((key, i) => ({
    id: `${p}enrol_${key}`, tenantId, employeeId: emp(key), benefitsPackageId: `${p}ben_med`, enrollmentDate: dayOffset(ctx, -300 + i * 20), effectiveDate: dayOffset(ctx, -300 + i * 20), status: 'active', dependents: i % 3, totalCost: 150, employeeContribution: 50, employerContribution: 100,
  })))

  // A staff loan being paid back.
  await seedRows(prisma.hrStaffDebt, [{ id: `${p}debt_kojo`, tenantId, employeeId: emp('kojo'), type: 'loan', originalAmount: 1200, remainingBalance: 1000, monthlyInstallment: 200, reason: 'School fees advance', issuedDate: dayOffset(ctx, -45), status: 'active' }])
  await seedRows(prisma.hrStaffDebtRepayment, [{ id: `${p}debtpay_kojo_1`, tenantId, debtId: `${p}debt_kojo`, amount: 200, paidAt: dayOffset(ctx, -15), notes: 'Paid in cash at the accounts office' }])

  await loadPayroll(ctx)
}

/**
 * A past month's payroll, run and paid, with its journal — this month is left for the tester to run.
 * Uses last month, or the latest of the three before it that the hotel hasn't run itself (a month can only be run once).
 */
async function loadPayroll(ctx: SampleCtx) {
  const { p, tenantId } = ctx
  const periodId = `${p}payroll_last`
  const emp = (key: string) => `${p}emp_${key}`
  const y = ctx.today.getUTCFullYear(), m = ctx.today.getUTCMonth() // this month, 0-based
  const monthNumber = (back: number) => {
    const d = new Date(Date.UTC(y, m - back, 1))
    return `PP-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const taken = new Set((await prisma.hrPayrollPeriod.findMany({ where: { tenantId, NOT: { id: periodId } }, select: { periodNumber: true } })).map((x) => x.periodNumber))
  const back = [1, 2, 3].find((b) => !taken.has(monthNumber(b)))
  if (back === undefined) return // the hotel has run all recent months itself
  const start = new Date(Date.UTC(y, m - back, 1)), end = new Date(Date.UTC(y, m - back + 1, 0))
  const periodNumber = monthNumber(back)

  const staff = STAFF.filter(([, , , , , , hired]) => dayOffset(ctx, -hired) <= end)
  const round2 = (n: number) => Math.round(n * 100) / 100
  const records = staff.map(([key, first, last, , position, allowances], i) => {
    const posRow = POSITIONS.find((x) => x.key === position)!
    const basic = posRow.baseSalary
    const gross = basic + allowances
    const ssnit = round2(basic * 0.055)
    const tax = monthlyPaye(gross - ssnit)
    const net = round2(gross - ssnit - tax)
    return {
      id: `${periodId}_${key}`, tenantId, payrollPeriodId: periodId, employeeId: emp(key), employeeNumber: `SMP-${String(STAFF.findIndex((s) => s[0] === key) + 1).padStart(3, '0')}`,
      employeeName: `${first} ${last}`, department: DEPARTMENTS.find((d) => d.key === posRow.dept)!.name, position: posRow.title,
      basicSalary: basic, allowances, overtimePay: 0, bonuses: 0, grossPay: gross, deductions: { tax, socialSecurity: ssnit, pension: 0, tier3: 0, healthInsurance: 0, other: 0 }, netPay: net,
      bankAccount: `01230456${String(i).padStart(2, '0')}`, paymentMethod: 'bank_transfer', status: 'paid', paidAt: end, notes: JSON.stringify({ source: 'Sample payroll', debtRepayments: [] }),
    }
  })
  const sum = (pick: (r: (typeof records)[number]) => number) => round2(records.reduce((s, r) => s + pick(r), 0))
  const gross = sum((r) => r.grossPay), net = sum((r) => r.netPay), paye = sum((r) => r.deductions.tax), ssnit = sum((r) => r.deductions.socialSecurity)
  const basicTotal = sum((r) => r.basicSalary)
  const tier1Employer = round2(basicTotal * 0.08), tier2Employer = round2(basicTotal * 0.05)
  const payday = new Date(end.getTime() + 12 * 3_600_000)

  await seedRows(prisma.hrPayrollPeriod, [{
    id: periodId, tenantId, periodNumber, startDate: start, endDate: end, status: 'paid', totalGrossPay: gross, totalNetPay: net, totalDeductions: ssnit, totalTaxes: paye, employeeCount: records.length,
    processedBy: 'Sample Manager', processedAt: new Date(end.getTime() - 2 * 86_400_000), approvedBy: 'Sample Manager', approvedAt: new Date(end.getTime() - 86_400_000),
    notes: JSON.stringify({ employerContribution: round2(tier1Employer + tier2Employer), tier1Employer, tier2Employer }),
  }])
  await seedRows(prisma.hrPayrollRecord, records)

  if (!(await hasChartOfAccounts(ctx))) return
  await postEntries(ctx, [
    {
      id: `${p}je_payroll`, entryNumber: `SMP-JE-PR-${periodNumber}`, date: end, reference: periodNumber, description: `Payroll run — ${periodNumber} (${records.length} employees)`, sourceModule: 'payroll', sourceTransactionId: periodId,
      lines: [
        { account: '5210', description: `Gross pay — ${periodNumber}`, debit: gross },
        { account: '5221', description: `Employer statutory contributions — ${periodNumber}`, debit: round2(tier1Employer + tier2Employer) },
        { account: '2210', description: `PAYE withheld — ${periodNumber}`, credit: paye },
        { account: '2220', description: `Tier 1 due (employee + employer) — ${periodNumber}`, credit: round2(ssnit + tier1Employer) },
        { account: '2225', description: `Tier 2 occupational pension — ${periodNumber}`, credit: tier2Employer },
        { account: '2300', description: `Net pay accrued — ${periodNumber}`, credit: net },
      ],
    },
    {
      id: `${p}je_payroll_paid`, entryNumber: `SMP-JE-PRPAY-${periodNumber}`, date: payday, reference: periodNumber, description: `Salaries paid — ${periodNumber}`, sourceModule: 'payroll', sourceTransactionId: periodId,
      lines: [{ account: '2300', description: `Net pay settled — ${periodNumber}`, debit: net }, { account: '1120', description: `Salary transfers — ${periodNumber}`, credit: net }],
    },
  ])
}

export async function removeHr(ctx: SampleCtx) {
  const employeeIds = await sampleIds(prisma.hrEmployee, ctx)
  if (employeeIds.length > 0) {
    const forEmployees = { tenantId: ctx.tenantId, employeeId: { in: employeeIds } }
    await prisma.hrPerformanceLog.deleteMany({ where: forEmployees })
    await prisma.hrPerformanceReview.deleteMany({ where: forEmployees })
    await prisma.hrEmployeeChange.deleteMany({ where: forEmployees })
    await prisma.hrOnboardingChecklist.deleteMany({ where: forEmployees })
    await prisma.hrEmployeeBenefits.deleteMany({ where: forEmployees })
    await prisma.hrStaffDebt.deleteMany({ where: forEmployees }) // repayments go with their debt
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
  await prisma.hrPayrollPeriod.deleteMany({ where: bySampleId(ctx) }) // the sample month; its records go with it
  await prisma.hrBenefitsPackage.deleteMany({ where: bySampleId(ctx) })
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
