/**
 * HR lifecycle arithmetic — hire figures through leave days, Ghana payroll, and the ledger.
 * Run: npx tsx --env-file=.env.local scripts/test-hr-lifecycle.ts
 */
import { countLeaveDays, isPublicHoliday } from '../src/app/lib/hr/leaveDates';
import { useEmployeeStore } from '../src/app/lib/hr/employeeStore';
import { useLeaveAttendanceStore } from '../src/app/lib/hr/leaveAttendanceStore';
import { usePayrollStore } from '../src/app/lib/hr/payrollStore';
import { useComplianceStore } from '../src/app/lib/compliance/store';
import { getSeedTaxes } from '../src/app/lib/compliance/config';
import UniversalPayrollBuilder from '../src/app/lib/payroll/builder';
import { approvedOvertimeFor, buildPayrollJournal, calculateEmployeeMonth, impliedHourlyRate, prepareBuilderForRun, runMonthlyPayroll, STANDARD_MONTHLY_HOURS } from '../src/app/lib/payroll/monthlyRun';

const results: { step: string; ok: boolean; detail?: string }[] = [];
const near = (a: number, b: number) => Math.abs(a - b) < 0.02;

function pass(step: string, detail?: string) {
  results.push({ step, ok: true, detail });
  console.log(`OK  ${step}${detail ? ` — ${detail}` : ''}`);
}
function fail(step: string, detail?: string) {
  results.push({ step, ok: false, detail });
  console.error(`FAIL ${step}${detail ? ` — ${detail}` : ''}`);
}
function check(step: string, ok: boolean, detail?: string) {
  if (ok) pass(step, detail);
  else fail(step, detail);
}

function expectedPaye(taxable: number) {
  const bands: Array<[number | null, number]> = [
    [490, 0],
    [110, 5],
    [130, 10],
    [3166.67, 17.5],
    [16000, 25],
    [30520, 30],
    [null, 35],
  ];
  let remaining = taxable;
  let total = 0;
  for (const [width, rate] of bands) {
    if (remaining <= 0) break;
    const slice = width == null ? remaining : Math.min(remaining, width);
    total += slice * (rate / 100);
    remaining -= slice;
  }
  return Math.round(total * 100) / 100;
}

async function arithmetic() {
  const week = countLeaveDays('2026-09-21', '2026-09-27', 'annual');
  check('leave.weekdays', week === 4, `Mon–Sun annual = ${week}, expected 4 after Founder's Day`);
  check('leave.holiday-moved', !isPublicHoliday('2026-01-07') && isPublicHoliday('2026-01-09'), 'Constitution Day 2026 observed Friday 9 Jan');
  check('leave.republic-day', isPublicHoliday('2026-07-03') && !isPublicHoliday('2026-07-01'), 'Republic Day 2026 observed Friday 3 Jul');
  check('leave.boxing-day', isPublicHoliday('2026-12-28') && !isPublicHoliday('2026-12-26'), 'Boxing Day 2026 observed Monday 28 Dec');
  check('leave.farmers-day', isPublicHoliday('2026-12-04'), 'Farmers Day 2026');
  const span = countLeaveDays('2026-09-25', '2026-09-28', 'annual');
  check('leave.weekend-gap', span === 2, `Fri–Mon annual = ${span}, expected 2`);
  const maternity = countLeaveDays('2026-09-21', '2026-09-27', 'maternity');
  check('leave.calendar', maternity === 7, `maternity calendar = ${maternity}, expected 7`);

  const hourly = impliedHourlyRate(3000);
  const expectedHourly = Math.round((3000 / STANDARD_MONTHLY_HOURS) * 100) / 100;
  check('overtime.implied-hourly', hourly === expectedHourly, `${hourly}`);

  useComplianceStore.setState({
    country: 'GH',
    taxRules: getSeedTaxes().filter((t) => t.countryCode === 'GH') as never,
  });
  useEmployeeStore.setState({
    employees: [],
    departments: [{ id: 'dept-audit', name: 'Front Office', code: 'FO', description: '', budget: 0, location: 'Accra', isActive: true, status: 'active', createdAt: new Date(), updatedAt: new Date() }],
    positions: [{ id: 'pos-audit', title: 'Receptionist', departmentId: 'dept-audit', description: '', level: 'staff', salaryRange: { min: 0, max: 0, currency: 'GHS' }, requirements: [], responsibilities: [], isActive: true, createdAt: new Date(), updatedAt: new Date() } as never],
    selectedEmployee: null,
  });
  usePayrollStore.setState({ payrollPeriods: [], payrollRecords: [] });

  const employee = {
    id: 'emp-audit',
    employeeNumber: 'AUD-1',
    firstName: 'Ama',
    lastName: 'Mensah',
    email: 'ama@audit.test',
    status: 'active',
    departmentId: 'dept-audit',
    positionId: 'pos-audit',
    basicSalary: 3000,
    allowances: 200,
    employmentType: 'full_time',
    tier3Enrolled: true,
    tier3ContributionPct: 5,
  };

  const builder = new UniversalPayrollBuilder();
  const runtimeId = prepareBuilderForRun(builder, 'GH');
  const month = 8;
  const year = 2031;
  const otHours = 2;
  const run = runMonthlyPayroll({
    builder,
    runtimeId,
    employees: [employee],
    periods: [],
    month,
    year,
    overtimeOverrides: { 'emp-audit': otHours },
    userName: 'HR audit',
    complianceCountry: 'GH',
  });
  if (!run.ok) {
    fail('payroll.run', run.error);
    return;
  }
  pass('payroll.run', run.periodId);

  const record = usePayrollStore.getState().payrollRecords.find((r) => r.employeeId === 'emp-audit');
  const period = usePayrollStore.getState().payrollPeriods.find((p) => p.id === run.periodId);
  if (!record || !period) {
    fail('payroll.record', 'missing record or period');
    return;
  }

  const otPay = Math.round(otHours * hourly * 1.5 * 100) / 100;
  const gross = Math.round((3000 + 200 + otPay) * 100) / 100;
  const tier1 = Math.round(3000 * 0.055 * 100) / 100;
  const tier1Employer = Math.round(3000 * 0.08 * 100) / 100;
  const tier2Employer = Math.round(3000 * 0.05 * 100) / 100;
  const tier3 = Math.round(Math.min((3000 + 200) * 0.05, 3000 * 0.165) * 100) / 100;
  const taxable = Math.round((gross - tier1 - tier3) * 100) / 100;
  const paye = expectedPaye(taxable);
  const net = Math.round((gross - tier1 - tier3 - paye) * 100) / 100;

  check('payroll.no-phantom-transport', near(record.grossPay, gross), `gross ${record.grossPay} expected ${gross}`);
  check('payroll.overtime', near(record.overtimePay, otPay), `ot ${record.overtimePay} expected ${otPay}`);
  check('payroll.tier1', near(record.deductions.socialSecurity, tier1), `tier1 ${record.deductions.socialSecurity} expected ${tier1}`);
  check('payroll.tier3', near(record.deductions.tier3 || 0, tier3), `tier3 ${record.deductions.tier3} expected ${tier3}`);
  check('payroll.paye', near(record.deductions.tax, paye), `paye ${record.deductions.tax} expected ${paye} on taxable ${taxable}`);
  check('payroll.net', near(record.netPay, net), `net ${record.netPay} expected ${net}`);
  check('payroll.allowance-in-gross', near(record.allowances, 200) && record.grossPay > record.basicSalary, `allowance ${record.allowances}`);

  const journal = buildPayrollJournal(period, [record]);
  if (!journal) {
    fail('journal.built', 'no entry');
    return;
  }
  check('journal.balances', near(journal.totalDebit, journal.totalCredit), `Dr ${journal.totalDebit} Cr ${journal.totalCredit}`);
  const credit = (code: string) => journal.lines.find((l) => l.accountCode === code)?.credit || 0;
  const debit = (code: string) => journal.lines.find((l) => l.accountCode === code)?.debit || 0;
  check('journal.net-is-payslip', near(credit('2300'), record.netPay), `accrued ${credit('2300')} net ${record.netPay}`);
  check('journal.tier1', near(credit('2220'), tier1 + tier1Employer), `2220 ${credit('2220')}`);
  check('journal.tier2', near(credit('2225'), tier2Employer), `2225 ${credit('2225')}`);
  check('journal.tier3', near(credit('2221'), tier3), `2221 ${credit('2221')}`);
  check('journal.paye', near(credit('2210'), paye), `2210 ${credit('2210')}`);
  check('journal.employer-expense', near(debit('5221'), tier1Employer + tier2Employer), `5221 ${debit('5221')}`);
}

async function persistence() {
  const { prisma } = await import('../src/app/lib/database/client');
  const repo = await import('../src/app/lib/hr/repository');
  const tenant = await prisma.tenant.findFirst({ where: { subdomain: 'demo' } });
  if (!tenant) {
    fail('persist.tenant', 'demo tenant missing');
    return;
  }
  const stamp = Date.now().toString().slice(-6);
  const employeeId = `hr-audit-${stamp}`;
  const deptId = `hr-dept-${stamp}`;
  const positionId = `hr-pos-${stamp}`;
  const leaveId = `hr-leave-${stamp}`;
  const attendanceId = `hr-att-${stamp}`;
  const periodId = `hr-pp-${stamp}`;
  const recordId = `hr-pr-${stamp}`;
  const packageId = `hr-ben-${stamp}`;
  const enrollId = `hr-enr-${stamp}`;
  const programId = `hr-tp-${stamp}`;
  const trainingId = `hr-tr-${stamp}`;
  const reviewId = `hr-rv-${stamp}`;
  const changeId = `hr-ch-${stamp}`;
  const journalId = `JE-PAYROLL-${periodId}`;
  try {
    const stored = await prisma.hrPayrollRecord.findMany({
      select: { employeeName: true, basicSalary: true, allowances: true, overtimePay: true, bonuses: true, grossPay: true, netPay: true, deductions: true },
    });
    const untied = stored.filter((row) => {
      const gross = Number(row.grossPay);
      const parts = Number(row.basicSalary) + Number(row.allowances) + Number(row.overtimePay) + Number(row.bonuses);
      const d = (row.deductions || {}) as { tax?: number; socialSecurity?: number; pension?: number; tier3?: number; other?: number; healthInsurance?: number };
      const net = Number(row.netPay);
      const expectedNet = Math.round((gross - Number(d.tax || 0) - Number(d.socialSecurity || 0) - Number(d.pension || 0) - Number(d.tier3 || 0) - Number(d.other || 0) - Number(d.healthInsurance || 0)) * 100) / 100;
      return Math.abs(parts - gross) > 0.02 || Math.abs(expectedNet - net) > 0.02;
    });
    check('stored.payslips-tie', untied.length === 0, untied.length ? untied.map((r) => r.employeeName).join(', ') : `${stored.length} payslips`);

    await repo.upsertHrDepartment(tenant.id, deptId, { name: `Audit Desk ${stamp}`, code: `AD${stamp}`, description: 'Cert', budget: 0, location: 'Accra', isActive: true, status: 'active' });
    await repo.upsertHrPosition(tenant.id, positionId, { title: 'Auditor', departmentId: deptId, description: 'Cert', isActive: true, status: 'active' });
    const dept = (await repo.listHrDepartments(tenant.id)).find((d) => d.id === deptId);
    const position = (await repo.listHrPositions(tenant.id)).find((p) => p.id === positionId);
    check('persist.department', !!dept && dept.name.startsWith('Audit Desk'), dept?.name);
    check('persist.position', position?.departmentId === deptId && position.title === 'Auditor', position?.title);

    await repo.upsertHrEmployee(tenant.id, employeeId, {
      employeeNumber: `AUD-${stamp}`,
      firstName: 'Kojo',
      lastName: 'Audit',
      email: `kojo.${stamp}@audit.test`,
      phone: '0240000000',
      dateOfBirth: '1992-04-01',
      hireDate: '2026-09-01',
      departmentId: deptId,
      positionId,
      status: 'active',
      employmentType: 'full_time',
      basicSalary: 2500,
      allowances: 100,
      salary: 2600,
      compensationType: 'monthly',
      ssnitEnrolled: true,
      tier2Enrolled: true,
    });
    const found = (await repo.listHrEmployees(tenant.id)).find((e) => e.id === employeeId);
    check('persist.employee', !!found && found.firstName === 'Kojo' && Number(found.basicSalary) === 2500 && found.departmentId === deptId, found?.employeeNumber);

    await repo.createHrEmployeeChange(tenant.id, changeId, {
      employeeId,
      employeeName: 'Kojo Audit',
      type: 'profile_update',
      field: 'created',
      previousValue: null,
      newValue: 'created',
      timestamp: new Date().toISOString(),
    });
    const change = (await repo.listHrEmployeeChanges(tenant.id)).find((c) => c.id === changeId);
    check('persist.change-log', change?.employeeId === employeeId && change.employeeId !== 'new', change?.employeeId);

    const leaveDays = countLeaveDays('2026-09-21', '2026-09-25', 'annual');
    await repo.upsertHrLeaveRequest(tenant.id, leaveId, {
      employeeId,
      leaveType: 'annual',
      startDate: '2026-09-21',
      endDate: '2026-09-25',
      totalDays: leaveDays,
      status: 'approved',
      reason: 'HR audit',
    });
    const leave = (await repo.listHrLeaveRequests(tenant.id)).find((l) => l.id === leaveId);
    check('persist.leave', !!leave && Number(leave.totalDays) === 4 && leaveDays === 4, `days ${leave?.totalDays}`);

    await repo.upsertHrAttendance(tenant.id, attendanceId, {
      employeeId,
      date: '2032-03-10',
      checkInTime: '2032-03-10T08:00:00.000Z',
      checkOutTime: '2032-03-10T18:00:00.000Z',
      totalHours: 10,
      overtimeHours: 2,
      status: 'present',
      approvedAt: '2032-03-10T18:05:00.000Z',
    });
    const attendance = (await repo.listHrAttendances(tenant.id)).find((a) => a.id === attendanceId);
    check('persist.attendance', !!attendance && Number(attendance.overtimeHours) === 2, `ot ${attendance?.overtimeHours}`);

    useEmployeeStore.setState({
      employees: found ? [found] : [],
      departments: dept ? [dept] : [],
      positions: position ? [position] : [],
      selectedEmployee: null,
    });
    useLeaveAttendanceStore.setState({
      leaveRequests: [],
      shifts: [],
      attendances: attendance
        ? [{ ...attendance, date: new Date(attendance.date), approvedAt: attendance.approvedAt ? new Date(attendance.approvedAt) : undefined } as never]
        : [],
    });
    const builder = new UniversalPayrollBuilder();
    const runtimeId = prepareBuilderForRun(builder, 'GH');
    const hours = approvedOvertimeFor(employeeId, 3, 2032);
    const quoted = calculateEmployeeMonth({ builder, runtimeId, month: 3, year: 2032 }, found, hours);
    check('persist.overtime-flows', hours === 2 && near(quoted.fields.overtimePay, Math.round(2 * impliedHourlyRate(2500) * 1.5 * 100) / 100), `hours ${hours} ot ${quoted.fields.overtimePay}`);

    await repo.upsertHrPayrollPeriod(tenant.id, periodId, {
      periodNumber: `PP-2032-03-${stamp}`,
      startDate: '2032-03-01',
      endDate: '2032-03-31',
      status: 'processing',
      totalGrossPay: quoted.fields.grossPay,
      totalNetPay: quoted.fields.netPay,
      totalDeductions: quoted.deductionsSum,
      totalTaxes: quoted.fields.deductions.tax,
      employeeCount: 1,
      notes: JSON.stringify({
        employerContribution: Math.round((quoted.tier1Employer + quoted.tier2Employer) * 100) / 100,
        tier1Employer: Math.round(quoted.tier1Employer * 100) / 100,
        tier2Employer: Math.round(quoted.tier2Employer * 100) / 100,
      }),
    });
    await repo.upsertHrPayrollRecord(tenant.id, recordId, {
      payrollPeriodId: periodId,
      ...quoted.fields,
      status: 'processed',
    });
    const savedRecord = (await repo.listHrPayrollRecords(tenant.id)).find((r) => r.id === recordId);
    const savedPeriod = (await repo.listHrPayrollPeriods(tenant.id)).find((p) => p.id === periodId);
    const withheld = savedRecord
      ? savedRecord.deductions.tax + savedRecord.deductions.socialSecurity + savedRecord.deductions.pension + (savedRecord.deductions.tier3 || 0) + savedRecord.deductions.other
      : 0;
    check(
      'persist.payroll',
      !!savedRecord && !!savedPeriod && near(savedRecord.grossPay, quoted.fields.grossPay) && near(savedRecord.netPay, Math.round((savedRecord.grossPay - withheld) * 100) / 100),
      `gross ${savedRecord?.grossPay} net ${savedRecord?.netPay}`,
    );
    const journal = savedPeriod && savedRecord ? buildPayrollJournal(savedPeriod, [savedRecord]) : undefined;
    if (journal) {
      await prisma.journalEntry.create({
        data: {
          id: journal.id,
          tenantId: tenant.id,
          entryNumber: journal.entryNumber,
          date: new Date(),
          reference: journal.reference,
          description: journal.description,
          totalDebit: journal.totalDebit,
          totalCredit: journal.totalCredit,
          currency: 'GHS',
          status: 'Draft',
          sourceModule: 'payroll',
          sourceTransactionId: periodId,
          lines: {
            create: journal.lines.map((line) => ({
              id: line.id,
              tenantId: tenant.id,
              accountCode: line.accountCode,
              description: line.description,
              debit: line.debit,
              credit: line.credit,
              currency: 'GHS',
              reference: line.reference,
            })),
          },
        },
      });
    }
    const lines = await prisma.journalEntryLine.findMany({ where: { journalEntryId: journalId } });
    const dr = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
    const cr = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
    const accrued = lines.find((l) => l.accountCode === '2300')?.credit || 0;
    check('persist.journal', lines.length > 0 && near(dr, cr) && near(accrued, savedRecord?.netPay || 0), `Dr ${dr} Cr ${cr} accrued ${accrued}`);

    await repo.upsertHrBenefitsPackage(tenant.id, packageId, {
      name: `Audit medical ${stamp}`,
      type: 'health',
      cost: 120,
      employeeContribution: 40,
      employerContribution: 80,
      isActive: true,
      effectiveDate: '2032-03-01',
    });
    await repo.upsertHrEmployeeBenefits(tenant.id, enrollId, {
      employeeId,
      benefitsPackageId: packageId,
      enrollmentDate: '2032-03-01',
      effectiveDate: '2032-03-01',
      status: 'active',
      dependents: 0,
      totalCost: 120,
      employeeContribution: 40,
      employerContribution: 80,
    });
    const enrollment = (await repo.listHrEmployeeBenefits(tenant.id)).find((e) => e.id === enrollId);
    check(
      'persist.benefits',
      !!enrollment && near(enrollment.employeeContribution + enrollment.employerContribution, enrollment.totalCost),
      `cost ${enrollment?.totalCost}`,
    );

    await repo.upsertHrTrainingProgram(tenant.id, programId, { title: `Food safety ${stamp}`, category: 'compliance', duration: 4, cost: 150, status: 'scheduled', mandatory: true });
    await repo.upsertHrTrainingRecord(tenant.id, trainingId, {
      trainingProgramId: programId,
      employeeId,
      enrollmentDate: '2032-03-02',
      status: 'completed',
      score: 88,
      cost: 150,
    });
    const training = (await repo.listHrTrainingRecords(tenant.id)).find((r) => r.id === trainingId);
    check('persist.training', training?.employeeId === employeeId && Number(training.score) === 88 && Number(training.cost) === 150, `score ${training?.score}`);

    await repo.upsertHrPerformanceReview(tenant.id, reviewId, {
      employeeId,
      reviewPeriod: '2032-Q1',
      reviewDate: '2032-03-20',
      reviewerName: 'HR audit',
      overallRating: 4,
      status: 'completed',
      categories: { jobKnowledge: 4, qualityOfWork: 4, quantityOfWork: 4, teamwork: 4, communication: 4, initiative: 4, attendance: 4, reliability: 4 },
    });
    const review = (await repo.listHrPerformanceReviews(tenant.id)).find((r) => r.id === reviewId);
    check('persist.performance', review?.employeeId === employeeId && Number(review.overallRating) === 4, `rating ${review?.overallRating}`);
  } catch (error) {
    fail('persist', error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: journalId } }).catch(() => undefined);
    await prisma.journalEntry.deleteMany({ where: { id: journalId } }).catch(() => undefined);
    await prisma.hrPayrollRecord.deleteMany({ where: { id: recordId } }).catch(() => undefined);
    await prisma.hrPayrollPeriod.deleteMany({ where: { id: periodId } }).catch(() => undefined);
    await prisma.hrPerformanceReview.deleteMany({ where: { id: reviewId } }).catch(() => undefined);
    await prisma.hrTrainingRecord.deleteMany({ where: { id: trainingId } }).catch(() => undefined);
    await prisma.hrTrainingProgram.deleteMany({ where: { id: programId } }).catch(() => undefined);
    await prisma.hrEmployeeBenefits.deleteMany({ where: { id: enrollId } }).catch(() => undefined);
    await prisma.hrBenefitsPackage.deleteMany({ where: { id: packageId } }).catch(() => undefined);
    await prisma.hrEmployeeChange.deleteMany({ where: { id: changeId } }).catch(() => undefined);
    await prisma.hrAttendance.deleteMany({ where: { id: attendanceId } }).catch(() => undefined);
    await prisma.hrLeaveRequest.deleteMany({ where: { id: leaveId } }).catch(() => undefined);
    await prisma.hrEmployee.deleteMany({ where: { id: employeeId } }).catch(() => undefined);
    await prisma.hrPosition.deleteMany({ where: { id: positionId } }).catch(() => undefined);
    await prisma.hrDepartment.deleteMany({ where: { id: deptId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

async function main() {
  await arithmetic();
  await persistence();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
