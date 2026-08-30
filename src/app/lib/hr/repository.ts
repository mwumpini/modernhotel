import { prisma } from '../database/client'

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

const toDate = (v: any): Date | undefined => (v == null ? undefined : new Date(v))

/**
 * Ownership-checked upsert: `prisma.model.upsert({ where: { id } })` has no tenant filter
 * (id is the sole unique key), so a naive upsert would silently overwrite another tenant's
 * row on a client-supplied id collision. Check first, then create-or-update explicitly —
 * same pattern used for PurchaseOrder/BankReconciliation earlier this session.
 */
async function ownershipCheckedUpsert<T>(
  model: { findUnique: (args: any) => Promise<any>; create: (args: any) => Promise<T>; update: (args: any) => Promise<T> },
  id: string,
  tenantId: string,
  data: Record<string, any>,
  createExtra: Record<string, any> = {},
): Promise<T> {
  const existing = await model.findUnique({ where: { id } })
  if (existing && existing.tenantId !== tenantId) {
    throw new Error('Record belongs to a different tenant')
  }
  if (existing) {
    return model.update({ where: { id }, data })
  }
  return model.create({ data: { id, tenantId, ...createExtra, ...data } })
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

function toStoreEmployee(row: any) {
  const details = (row.details || {}) as Record<string, any>
  return {
    id: row.id,
    employeeNumber: row.employeeNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    gender: row.gender ?? undefined,
    nationality: row.nationality ?? undefined,
    maritalStatus: row.maritalStatus ?? undefined,
    dateOfBirth: row.dateOfBirth,
    hireDate: row.hireDate,
    terminationDate: row.terminationDate ?? undefined,
    departmentId: row.departmentId ?? '',
    positionId: row.positionId ?? '',
    managerId: row.managerId ?? undefined,
    workLocation: row.workLocation ?? undefined,
    employmentType: row.employmentType,
    status: row.status,
    residencyStatus: row.residencyStatus ?? undefined,
    employmentClass: row.employmentClass ?? undefined,
    secondEmployment: row.secondEmployment,
    incomeTaxDeductible: row.incomeTaxDeductible,
    ssnitEnrolled: row.ssnitEnrolled,
    tier2Enrolled: row.tier2Enrolled,
    tier3Enrolled: row.tier3Enrolled,
    tier3ContributionPct: Number(row.tier3ContributionPct || 0),
    salary: Number(row.salary || 0),
    hourlyRate: row.hourlyRate != null ? Number(row.hourlyRate) : undefined,
    overtimeRate: row.overtimeRate != null ? Number(row.overtimeRate) : undefined,
    compensationType: row.compensationType ?? undefined,
    basicSalary: row.basicSalary != null ? Number(row.basicSalary) : undefined,
    allowances: row.allowances != null ? Number(row.allowances) : undefined,
    paymentFrequency: row.paymentFrequency ?? undefined,
    ssnitNumber: row.ssnitNumber ?? undefined,
    ghanaCardNumber: row.ghanaCardNumber ?? undefined,
    contractEndDate: row.contractEndDate ?? undefined,
    workPermitExpiryDate: row.workPermitExpiryDate ?? undefined,
    photo: row.photo ?? undefined,
    vehicleBenefit: Number(row.vehicleBenefit || 0),
    housingBenefit: Number(row.housingBenefit || 0),
    otherNonCashBenefits: Number(row.otherNonCashBenefits || 0),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // Long-tail nested fields
    taxWithholding: details.taxWithholding,
    leaveEntitlements: details.leaveEntitlements,
    governmentIds: details.governmentIds,
    bankAccount: details.bankAccount || { accountNumber: '', bankName: '', branchCode: '' },
    emergencyContact: details.emergencyContact || { name: '', relationship: '', phone: '' },
    nextOfKin: details.nextOfKin,
    address: details.address || { street: '', city: '', state: '', postalCode: '', country: 'Ghana' },
    documents: details.documents || [],
    qualifications: details.qualifications || [],
    acknowledgments: details.acknowledgments || [],
    probation: details.probation,
  }
}

function splitEmployeeData(e: Partial<Record<string, any>>) {
  const {
    taxWithholding, leaveEntitlements, governmentIds, bankAccount, emergencyContact,
    nextOfKin, address, documents, qualifications, acknowledgments, probation,
    ...columns
  } = e

  const details = stripUndefined({
    taxWithholding, leaveEntitlements, governmentIds, bankAccount, emergencyContact,
    nextOfKin, address, documents, qualifications, acknowledgments, probation,
  })

  const data: Record<string, any> = stripUndefined({
    ...columns,
    dateOfBirth: toDate(columns.dateOfBirth),
    hireDate: toDate(columns.hireDate),
    terminationDate: toDate(columns.terminationDate),
    contractEndDate: toDate(columns.contractEndDate),
    workPermitExpiryDate: toDate(columns.workPermitExpiryDate),
  })
  if (Object.keys(details).length) data.details = details
  return data
}

export async function listHrEmployees(tenantId: string) {
  const rows = await prisma.hrEmployee.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
  return rows.map(toStoreEmployee)
}

export async function upsertHrEmployee(tenantId: string, id: string, employee: Record<string, any>) {
  const data = splitEmployeeData(employee)
  const row = await ownershipCheckedUpsert(prisma.hrEmployee, id, tenantId, data, {
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    dateOfBirth: toDate(employee.dateOfBirth) || new Date(),
    hireDate: toDate(employee.hireDate) || new Date(),
  })
  return toStoreEmployee(row)
}

export async function deleteHrEmployee(tenantId: string, id: string) {
  const existing = await prisma.hrEmployee.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.hrEmployee.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

function toStoreDepartment(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    description: row.description ?? '',
    managerId: row.managerId ?? undefined,
    parentDepartmentId: row.parentDepartmentId ?? undefined,
    budget: Number(row.budget || 0),
    location: row.location ?? '',
    isActive: row.isActive,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listHrDepartments(tenantId: string) {
  const rows = await prisma.hrDepartment.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  return rows.map(toStoreDepartment)
}

export async function upsertHrDepartment(tenantId: string, id: string, department: Record<string, any>) {
  const data = stripUndefined(department)
  const row = await ownershipCheckedUpsert(prisma.hrDepartment, id, tenantId, data, {
    name: department.name,
  })
  return toStoreDepartment(row)
}

export async function deleteHrDepartment(tenantId: string, id: string) {
  const existing = await prisma.hrDepartment.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.hrDepartment.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

function toStorePosition(row: any) {
  return {
    id: row.id,
    title: row.title,
    code: row.code ?? undefined,
    departmentId: row.departmentId,
    description: row.description ?? '',
    requirements: row.requirements || [],
    responsibilities: row.responsibilities || [],
    minSalary: row.minSalary != null ? Number(row.minSalary) : undefined,
    maxSalary: row.maxSalary != null ? Number(row.maxSalary) : undefined,
    baseSalary: row.baseSalary != null ? Number(row.baseSalary) : undefined,
    isActive: row.isActive,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listHrPositions(tenantId: string) {
  const rows = await prisma.hrPosition.findMany({ where: { tenantId }, orderBy: { title: 'asc' } })
  return rows.map(toStorePosition)
}

export async function upsertHrPosition(tenantId: string, id: string, position: Record<string, any>) {
  const data = stripUndefined(position)
  const row = await ownershipCheckedUpsert(prisma.hrPosition, id, tenantId, data, {
    title: position.title,
    departmentId: position.departmentId,
  })
  return toStorePosition(row)
}

export async function deleteHrPosition(tenantId: string, id: string) {
  const existing = await prisma.hrPosition.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.hrPosition.delete({ where: { id } })
  return true
}

// ---------------------------------------------------------------------------
// Payroll periods / records
// ---------------------------------------------------------------------------

function toStorePayrollPeriod(row: any) {
  return {
    id: row.id,
    periodNumber: row.periodNumber,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    totalGrossPay: Number(row.totalGrossPay || 0),
    totalNetPay: Number(row.totalNetPay || 0),
    totalDeductions: Number(row.totalDeductions || 0),
    totalTaxes: Number(row.totalTaxes || 0),
    employeeCount: row.employeeCount || 0,
    processedBy: row.processedBy ?? undefined,
    processedAt: row.processedAt ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    approvedAt: row.approvedAt ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listHrPayrollPeriods(tenantId: string) {
  const rows = await prisma.hrPayrollPeriod.findMany({ where: { tenantId }, orderBy: { startDate: 'desc' } })
  return rows.map(toStorePayrollPeriod)
}

export async function upsertHrPayrollPeriod(tenantId: string, id: string, period: Record<string, any>) {
  const data = stripUndefined({
    ...period,
    startDate: toDate(period.startDate),
    endDate: toDate(period.endDate),
    processedAt: toDate(period.processedAt),
    approvedAt: toDate(period.approvedAt),
  })
  const row = await ownershipCheckedUpsert(prisma.hrPayrollPeriod, id, tenantId, data, {
    periodNumber: period.periodNumber,
    startDate: toDate(period.startDate) || new Date(),
    endDate: toDate(period.endDate) || new Date(),
  })
  return toStorePayrollPeriod(row)
}

function toStorePayrollRecord(row: any) {
  return {
    id: row.id,
    payrollPeriodId: row.payrollPeriodId,
    employeeId: row.employeeId,
    employeeNumber: row.employeeNumber,
    employeeName: row.employeeName,
    department: row.department ?? undefined,
    position: row.position ?? undefined,
    basicSalary: Number(row.basicSalary || 0),
    allowances: Number(row.allowances || 0),
    overtimePay: Number(row.overtimePay || 0),
    bonuses: Number(row.bonuses || 0),
    grossPay: Number(row.grossPay || 0),
    deductions: row.deductions || { tax: 0, socialSecurity: 0, healthInsurance: 0, pension: 0, other: 0 },
    netPay: Number(row.netPay || 0),
    bankAccount: row.bankAccount ?? undefined,
    paymentMethod: row.paymentMethod,
    status: row.status,
    paidAt: row.paidAt ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listHrPayrollRecords(tenantId: string) {
  const rows = await prisma.hrPayrollRecord.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
  return rows.map(toStorePayrollRecord)
}

export async function upsertHrPayrollRecord(tenantId: string, id: string, record: Record<string, any>) {
  const data = stripUndefined({ ...record, paidAt: toDate(record.paidAt) })
  const row = await ownershipCheckedUpsert(prisma.hrPayrollRecord, id, tenantId, data, {
    payrollPeriodId: record.payrollPeriodId,
    employeeId: record.employeeId,
    employeeNumber: record.employeeNumber,
    employeeName: record.employeeName,
    deductions: record.deductions || {},
  })
  return toStorePayrollRecord(row)
}

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

function toStoreLeaveRequest(row: any) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    leaveType: row.leaveType,
    startDate: row.startDate,
    endDate: row.endDate,
    totalDays: Number(row.totalDays || 0),
    reason: row.reason ?? '',
    status: row.status,
    requestedBy: row.requestedBy ?? undefined,
    requestedAt: row.requestedAt,
    approvedBy: row.approvedBy ?? undefined,
    approvedAt: row.approvedAt ?? undefined,
    rejectionReason: row.rejectionReason ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listHrLeaveRequests(tenantId: string) {
  const rows = await prisma.hrLeaveRequest.findMany({ where: { tenantId }, orderBy: { requestedAt: 'desc' } })
  return rows.map(toStoreLeaveRequest)
}

export async function upsertHrLeaveRequest(tenantId: string, id: string, leave: Record<string, any>) {
  const data = stripUndefined({
    ...leave,
    startDate: toDate(leave.startDate),
    endDate: toDate(leave.endDate),
    requestedAt: toDate(leave.requestedAt),
    approvedAt: toDate(leave.approvedAt),
  })
  const row = await ownershipCheckedUpsert(prisma.hrLeaveRequest, id, tenantId, data, {
    employeeId: leave.employeeId,
    leaveType: leave.leaveType,
    startDate: toDate(leave.startDate) || new Date(),
    endDate: toDate(leave.endDate) || new Date(),
  })
  return toStoreLeaveRequest(row)
}

// ---------------------------------------------------------------------------
// Training programs / records
// ---------------------------------------------------------------------------

function toStoreTrainingProgram(row: any) {
  return {
    id: row.id,
    title: row.title,
    code: row.code ?? '',
    description: row.description ?? '',
    category: row.category,
    duration: Number(row.duration || 0),
    cost: Number(row.cost || 0),
    maxParticipants: row.maxParticipants ?? undefined,
    instructor: row.instructor ?? '',
    location: row.location ?? '',
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    status: row.status,
    mandatory: row.mandatory,
    materials: row.materials || [],
    objectives: row.objectives || [],
    prerequisites: row.prerequisites || [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listHrTrainingPrograms(tenantId: string) {
  const rows = await prisma.hrTrainingProgram.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
  return rows.map(toStoreTrainingProgram)
}

export async function upsertHrTrainingProgram(tenantId: string, id: string, program: Record<string, any>) {
  const data = stripUndefined({
    ...program,
    startDate: toDate(program.startDate),
    endDate: toDate(program.endDate),
  })
  const row = await ownershipCheckedUpsert(prisma.hrTrainingProgram, id, tenantId, data, {
    title: program.title,
  })
  return toStoreTrainingProgram(row)
}

export async function deleteHrTrainingProgram(tenantId: string, id: string) {
  const existing = await prisma.hrTrainingProgram.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.hrTrainingProgram.delete({ where: { id } })
  return true
}

function toStoreTrainingRecord(row: any) {
  return {
    id: row.id,
    trainingProgramId: row.trainingProgramId,
    employeeId: row.employeeId,
    enrollmentDate: row.enrollmentDate,
    completionDate: row.completionDate ?? undefined,
    status: row.status,
    score: row.score != null ? Number(row.score) : undefined,
    certificate: row.certificate ?? undefined,
    feedback: row.feedback ?? undefined,
    cost: Number(row.cost || 0),
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listHrTrainingRecords(tenantId: string) {
  const rows = await prisma.hrTrainingRecord.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
  return rows.map(toStoreTrainingRecord)
}

export async function upsertHrTrainingRecord(tenantId: string, id: string, record: Record<string, any>) {
  const data = stripUndefined({
    ...record,
    enrollmentDate: toDate(record.enrollmentDate),
    completionDate: toDate(record.completionDate),
  })
  const row = await ownershipCheckedUpsert(prisma.hrTrainingRecord, id, tenantId, data, {
    trainingProgramId: record.trainingProgramId,
    employeeId: record.employeeId,
  })
  return toStoreTrainingRecord(row)
}

export async function deleteHrTrainingRecord(tenantId: string, id: string) {
  const existing = await prisma.hrTrainingRecord.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.hrTrainingRecord.delete({ where: { id } })
  return true
}
