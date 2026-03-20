# HR & Audit Fix Implementation Plan

**Priority**: 🔴 CRITICAL  
**Estimated Time**: 40-60 hours  
**Dependencies**: Database schema updates, API routes

---

## PHASE 1: Database Schema Updates (8 hours)

### 1.1 Add HR Models to Prisma Schema

**File**: `prisma/schema.prisma`

```prisma
// Employee Model
model Employee {
  id              String   @id @default(cuid())
  tenantId        String
  employeeNumber  String
  userId          String?  @unique // Link to User account
  firstName       String
  lastName        String
  email           String
  phone           String
  dateOfBirth     DateTime
  hireDate        DateTime
  terminationDate DateTime?
  departmentId    String
  positionId      String
  managerId       String?
  status          String   @default("active") // active, inactive, terminated, suspended, on_leave
  employmentType  String   // full_time, part_time, contract, temporary, intern
  salary          Float
  basicSalary     Float?
  allowances      Float?
  hourlyRate      Float?
  overtimeRate    Float?
  compensationType String? // monthly, hourly
  paymentFrequency String? // monthly, biweekly, weekly
  
  // Ghana Compliance
  ssnitEnrolled   Boolean  @default(false)
  tier2Enrolled   Boolean  @default(false)
  tier3Enrolled   Boolean  @default(false)
  incomeTaxDeductible Boolean @default(true)
  taxWithholding  Json?
  governmentIds   Json?
  
  // Bank & Contact
  bankAccount     Json
  emergencyContact Json
  address         Json
  
  // Metadata
  documents       Json     @default("[]")
  qualifications  Json?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  department      Department @relation(fields: [departmentId], references: [id])
  position        Position @relation(fields: [positionId], references: [id])
  payrollRecords  PayrollRecord[]
  leaveRequests   LeaveRequest[]
  attendances     Attendance[]
  shifts          Shift[]
  changes         EmployeeChange[]
  
  @@unique([tenantId, employeeNumber])
  @@index([tenantId, status])
  @@index([tenantId, departmentId])
  @@map("employees")
}

model Department {
  id            String   @id @default(cuid())
  tenantId      String
  name          String
  description   String?
  managerId     String?
  location      String?
  budget        Float?
  employeeCount Int      @default(0)
  status        String   @default("active")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  employees     Employee[]
  positions     Position[]
  
  @@unique([tenantId, name])
  @@map("departments")
}

model Position {
  id            String   @id @default(cuid())
  tenantId      String
  departmentId String
  title         String
  description   String?
  baseSalary    Float?
  requirements  Json?
  status        String   @default("active")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  department    Department @relation(fields: [departmentId], references: [id])
  employees     Employee[]
  
  @@unique([tenantId, departmentId, title])
  @@map("positions")
}

// Payroll Models
model PayrollPeriod {
  id            String   @id @default(cuid())
  tenantId      String
  periodNumber  String
  startDate     DateTime
  endDate       DateTime
  status        String   // draft, processing, approved, paid
  totalGrossPay Float    @default(0)
  totalNetPay   Float    @default(0)
  totalDeductions Float   @default(0)
  totalTaxes    Float    @default(0)
  employeeCount Int      @default(0)
  processedAt   DateTime?
  processedBy   String?
  approvedAt    DateTime?
  approvedBy    String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  records       PayrollRecord[]
  
  @@unique([tenantId, periodNumber])
  @@map("payroll_periods")
}

model PayrollRecord {
  id              String   @id @default(cuid())
  tenantId        String
  payrollPeriodId String
  employeeId      String
  basicSalary     Float
  allowances      Float    @default(0)
  overtimePay     Float    @default(0)
  bonuses         Float    @default(0)
  grossPay        Float
  deductions      Json     // { tax, socialSecurity, healthInsurance, pension, other }
  netPay          Float
  bankAccount     String
  paymentMethod   String
  status          String   // draft, approved, paid
  paidAt          DateTime?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  period          PayrollPeriod @relation(fields: [payrollPeriodId], references: [id])
  employee        Employee @relation(fields: [employeeId], references: [id])
  
  @@index([tenantId, employeeId])
  @@index([tenantId, status])
  @@map("payroll_records")
}

// Leave & Attendance
model LeaveRequest {
  id            String   @id @default(cuid())
  tenantId      String
  employeeId   String
  leaveType     String   // annual, sick, personal, maternity, etc.
  startDate     DateTime
  endDate       DateTime
  totalDays     Int
  reason        String?
  status        String   @default("pending") // pending, approved, rejected
  requestedBy   String
  requestedAt   DateTime @default(now())
  approvedBy   String?
  approvedAt   DateTime?
  rejectionReason String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  employee      Employee @relation(fields: [employeeId], references: [id])
  
  @@index([tenantId, employeeId])
  @@index([tenantId, status])
  @@map("leave_requests")
}

model Attendance {
  id            String   @id @default(cuid())
  tenantId      String
  employeeId    String
  date          DateTime
  checkInTime   DateTime?
  checkOutTime  DateTime?
  totalHours    Float    @default(0)
  overtimeHours Float   @default(0)
  breakTime     Float    @default(0)
  status        String   // present, absent, late, early_leave
  shift         String?
  location      String?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  employee      Employee @relation(fields: [employeeId], references: [id])
  
  @@unique([tenantId, employeeId, date])
  @@index([tenantId, employeeId])
  @@map("attendances")
}

model Shift {
  id            String   @id @default(cuid())
  tenantId      String
  employeeId    String
  date          DateTime
  startTime     String   // HH:mm
  endTime       String   // HH:mm
  location      String?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  employee      Employee @relation(fields: [employeeId], references: [id])
  
  @@index([tenantId, employeeId, date])
  @@map("shifts")
}

// Employee Change Tracking
model EmployeeChange {
  id            String   @id @default(cuid())
  tenantId      String
  employeeId    String
  employeeName  String?
  type          String   // promotion, transfer, salary_change, status_change, etc.
  field         String?
  previousValue String?
  newValue      String?
  changedBy     String?
  notes         String?
  timestamp     DateTime @default(now())
  
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  employee      Employee @relation(fields: [employeeId], references: [id])
  
  @@index([tenantId, employeeId])
  @@index([tenantId, timestamp])
  @@map("employee_changes")
}

// Update Tenant model
model Tenant {
  // ... existing fields ...
  employees     Employee[]
  departments   Department[]
  positions     Position[]
  payrollPeriods PayrollPeriod[]
  payrollRecords PayrollRecord[]
  leaveRequests LeaveRequest[]
  attendances   Attendance[]
  shifts       Shift[]
  employeeChanges EmployeeChange[]
}
```

### 1.2 Update User Model

```prisma
model User {
  // ... existing fields ...
  employeeId    String?  @unique
  employee      Employee? @relation(fields: [employeeId], references: [id], onDelete: SetNull)
}
```

### 1.3 Run Migration

```bash
npx prisma migrate dev --name add_hr_models
```

---

## PHASE 2: Staff ID Validation System (6 hours)

### 2.1 Create Validation Utility

**File**: `src/app/lib/hr/validation.ts`

```typescript
import { prisma } from '@/app/lib/database/client';

export interface StaffValidationResult {
  isValid: boolean;
  employee?: {
    id: string;
    employeeNumber: string;
    name: string;
    status: string;
    departmentId: string;
    departmentName?: string;
    positionId: string;
    positionName?: string;
  };
  error?: string;
}

/**
 * Validate staff ID against HR records
 * Checks: existence, active status, department permissions
 */
export async function validateStaffId(
  tenantId: string,
  staffId: string,
  requiredDepartment?: string,
  requiredStatus: string[] = ['active']
): Promise<StaffValidationResult> {
  try {
    // Find employee by ID or employee number
    const employee = await prisma.employee.findFirst({
      where: {
        tenantId,
        OR: [
          { id: staffId },
          { employeeNumber: staffId }
        ]
      },
      include: {
        department: true,
        position: true
      }
    });

    if (!employee) {
      return {
        isValid: false,
        error: `Employee not found: ${staffId}`
      };
    }

    // Check status
    if (!requiredStatus.includes(employee.status)) {
      return {
        isValid: false,
        error: `Employee status '${employee.status}' not allowed. Required: ${requiredStatus.join(', ')}`,
        employee: {
          id: employee.id,
          employeeNumber: employee.employeeNumber,
          name: `${employee.firstName} ${employee.lastName}`,
          status: employee.status,
          departmentId: employee.departmentId,
          departmentName: employee.department?.name,
          positionId: employee.positionId,
          positionName: employee.position?.title
        }
      };
    }

    // Check department if required
    if (requiredDepartment && employee.departmentId !== requiredDepartment) {
      return {
        isValid: false,
        error: `Employee not in required department. Current: ${employee.department?.name}, Required: ${requiredDepartment}`,
        employee: {
          id: employee.id,
          employeeNumber: employee.employeeNumber,
          name: `${employee.firstName} ${employee.lastName}`,
          status: employee.status,
          departmentId: employee.departmentId,
          departmentName: employee.department?.name,
          positionId: employee.positionId,
          positionName: employee.position?.title
        }
      };
    }

    return {
      isValid: true,
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: `${employee.firstName} ${employee.lastName}`,
        status: employee.status,
        departmentId: employee.departmentId,
        departmentName: employee.department?.name,
        positionId: employee.positionId,
        positionName: employee.position?.title
      }
    };
  } catch (error) {
    console.error('[HR][Validation] Error validating staff ID:', error);
    return {
      isValid: false,
      error: 'Validation error occurred'
    };
  }
}

/**
 * Validate staff ID and throw if invalid
 */
export async function requireValidStaffId(
  tenantId: string,
  staffId: string,
  requiredDepartment?: string,
  requiredStatus: string[] = ['active']
): Promise<StaffValidationResult['employee']> {
  const result = await validateStaffId(tenantId, staffId, requiredDepartment, requiredStatus);
  
  if (!result.isValid) {
    throw new Error(result.error || 'Invalid staff ID');
  }
  
  return result.employee!;
}
```

### 2.2 Update Transaction Functions

**File**: `src/app/lib/accounting/integration.ts`

```typescript
import { validateStaffId } from '@/app/lib/hr/validation';

export function capturePayment(
  transaction: PaymentTransaction,
  source: DepartmentSource
): { receiptId: string; journalEntryId: string } | null {
  // Validate staff ID before processing
  const tenantId = getTenantId(); // Get from context
  const validation = await validateStaffId(tenantId, transaction.staffId || '');
  
  if (!validation.isValid) {
    console.error('[Accounting] Invalid staff ID:', validation.error);
    throw new Error(`Invalid staff ID: ${validation.error}`);
  }
  
  // Map department requirements
  const departmentMap: Record<DepartmentSource, string> = {
    front_office: 'Front Office',
    restaurant: 'Food & Beverage',
    bar: 'Food & Beverage',
    room_service: 'Food & Beverage',
    conference: 'Events',
    spa: 'Spa',
    other: ''
  };
  
  const requiredDept = departmentMap[source];
  if (requiredDept) {
    const deptValidation = await validateStaffId(
      tenantId, 
      transaction.staffId!, 
      requiredDept
    );
    
    if (!deptValidation.isValid) {
      throw new Error(`Staff not authorized for ${source}: ${deptValidation.error}`);
    }
  }
  
  // ... rest of function
}
```

---

## PHASE 3: Database-Backed HR Stores (12 hours)

### 3.1 Create HR API Routes

**File**: `src/app/api/hr/employees/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/database/client';
import { getTenantFromRequest, createAuditLog } from '@/app/lib/api/tenant';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantFromRequest(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant required' }, { status: 400 });
    }

    const employees = await prisma.employee.findMany({
      where: { tenantId },
      include: {
        department: true,
        position: true,
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('[HR][API] Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const tenantId = getTenantFromRequest(request);
    const userId = session?.user?.id || null;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant required' }, { status: 400 });
    }

    const body = await request.json();
    const { employeeNumber, ...employeeData } = body;

    // Check duplicate employee number
    const existing = await prisma.employee.findUnique({
      where: {
        tenantId_employeeNumber: {
          tenantId,
          employeeNumber
        }
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Employee number already exists' },
        { status: 400 }
      );
    }

    // Create employee
    const employee = await prisma.employee.create({
      data: {
        tenantId,
        employeeNumber,
        ...employeeData
      },
      include: {
        department: true,
        position: true
      }
    });

    // Audit log
    await createAuditLog(
      tenantId,
      userId,
      'employee_created',
      'employee',
      employee.id,
      undefined,
      employee,
      request
    );

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('[HR][API] Error creating employee:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}
```

### 3.2 Update Employee Store to Use API

**File**: `src/app/lib/hr/employeeStore.ts`

```typescript
import { create } from 'zustand';

interface EmployeeStore {
  employees: Employee[];
  isLoading: boolean;
  error: string | null;
  
  // Fetch from API
  fetchEmployees: () => Promise<void>;
  addEmployee: (employee: Omit<Employee, 'id'>) => Promise<Employee>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
}

export const useEmployeeStore = create<EmployeeStore>((set, get) => ({
  employees: [],
  isLoading: false,
  error: null,

  fetchEmployees: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/hr/employees');
      const data = await response.json();
      if (response.ok) {
        set({ employees: data.employees, isLoading: false });
      } else {
        set({ error: data.error, isLoading: false });
      }
    } catch (error) {
      set({ error: 'Failed to fetch employees', isLoading: false });
    }
  },

  addEmployee: async (employee) => {
    try {
      const response = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee)
      });
      const data = await response.json();
      if (response.ok) {
        set((state) => ({
          employees: [...state.employees, data.employee]
        }));
        return data.employee;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('[HR][Store] Error adding employee:', error);
      throw error;
    }
  },

  // ... similar for updateEmployee, deleteEmployee
}));
```

---

## PHASE 4: Audit Log Integration (8 hours)

### 4.1 Replace In-Memory Audit Logger

**File**: `src/app/lib/audit/auditLogger.ts`

```typescript
import { prisma } from '@/app/lib/database/client';
import { getTenantId } from '@/app/lib/api/tenant';

export class AuditLogger {
  private static instance: AuditLogger;

  private constructor() {}

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  public async log(entry: AuditLogEntry): Promise<void> {
    try {
      const tenantId = getTenantId(); // Get from context
      
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: entry.userId || null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId || null,
          oldValues: entry.details?.oldValues ? JSON.stringify(entry.details.oldValues) : null,
          newValues: entry.details?.newValues ? JSON.stringify(entry.details.newValues) : null,
          ipAddress: entry.ipAddress || null,
          userAgent: entry.userAgent || null
        }
      });

      // Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('📋 Audit Log:', entry);
      }
    } catch (error) {
      console.error('[Audit] Error creating audit log:', error);
      // Don't throw - audit logging should not break operations
    }
  }

  public async getLogs(entity?: string, entityId?: string): Promise<AuditLogEntry[]> {
    try {
      const tenantId = getTenantId();
      const logs = await prisma.auditLog.findMany({
        where: {
          tenantId,
          ...(entity && { entity }),
          ...(entityId && { entityId })
        },
        orderBy: { createdAt: 'desc' },
        take: 1000 // Limit for performance
      });

      return logs.map(log => ({
        action: log.action,
        entity: log.entity,
        entityId: log.entityId || undefined,
        userId: log.userId || undefined,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        timestamp: log.createdAt.toISOString(),
        id: log.id,
        details: {
          oldValues: log.oldValues ? JSON.parse(log.oldValues) : undefined,
          newValues: log.newValues ? JSON.parse(log.newValues) : undefined
        }
      }));
    } catch (error) {
      console.error('[Audit] Error fetching logs:', error);
      return [];
    }
  }
}
```

### 4.2 Add HR Audit Logging

**File**: `src/app/lib/hr/audit.ts`

```typescript
import { auditLogger } from '@/app/lib/audit/auditLogger';

export async function logEmployeeAction(
  action: string,
  employeeId: string,
  oldValues?: any,
  newValues?: any,
  userId?: string
) {
  await auditLogger.log({
    action,
    entity: 'employee',
    entityId: employeeId,
    userId,
    details: { oldValues, newValues }
  });
}

export async function logPayrollAction(
  action: string,
  payrollPeriodId: string,
  details?: any,
  userId?: string
) {
  await auditLogger.log({
    action,
    entity: 'payroll_period',
    entityId: payrollPeriodId,
    userId,
    details
  });
}
```

---

## PHASE 5: Payroll-Accounting Integration (10 hours)

### 5.1 Create Payroll Processing with Accounting

**File**: `src/app/lib/hr/payrollProcessing.ts`

```typescript
import { prisma } from '@/app/lib/database/client';
import { useAccountingStore } from '@/app/lib/accounting/store';
import { logPayrollAction } from './audit';

export async function processPayrollWithAccounting(
  tenantId: string,
  periodId: string,
  processedBy: string
) {
  // 1. Get payroll period and records
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: {
      records: {
        include: {
          employee: {
            include: { department: true }
          }
        }
      }
    }
  });

  if (!period) throw new Error('Payroll period not found');

  // 2. Create accounting journal entry
  const accountingStore = useAccountingStore.getState();
  
  // Group by department for cost center allocation
  const byDepartment: Record<string, { gross: number; net: number; tax: number }> = {};
  
  period.records.forEach(record => {
    const dept = record.employee.department?.name || 'General';
    if (!byDepartment[dept]) {
      byDepartment[dept] = { gross: 0, net: 0, tax: 0 };
    }
    byDepartment[dept].gross += record.grossPay;
    byDepartment[dept].net += record.netPay;
    byDepartment[dept].tax += record.deductions.tax || 0;
  });

  // Create journal entry
  const journalEntry = accountingStore.createJournalEntry({
    date: new Date(),
    reference: `PAYROLL-${period.periodNumber}`,
    description: `Payroll for ${period.periodNumber}`,
    lines: [
      // Debit: Payroll Expense (by department)
      ...Object.entries(byDepartment).map(([dept, amounts]) => ({
        accountCode: '5000', // Payroll Expense
        accountName: 'Payroll Expense',
        debit: amounts.net,
        credit: 0,
        costCenter: dept,
        details: `Payroll - ${dept}`
      })),
      // Credit: Payroll Payable
      {
        accountCode: '2100', // Payroll Payable
        accountName: 'Payroll Payable',
        debit: 0,
        credit: period.totalNetPay,
        details: `Payroll Payable - ${period.periodNumber}`
      },
      // Credit: Tax Payable
      {
        accountCode: '2200', // Tax Payable
        accountName: 'Tax Payable',
        debit: 0,
        credit: period.totalTaxes,
        details: `PAYE - ${period.periodNumber}`
      }
    ],
    staffId: processedBy
  });

  // 3. Update payroll period status
  await prisma.payrollPeriod.update({
    where: { id: periodId },
    data: {
      status: 'processing',
      processedAt: new Date(),
      processedBy
    }
  });

  // 4. Audit log
  await logPayrollAction('payroll_processed', periodId, {
    journalEntryId: journalEntry.id,
    totalNetPay: period.totalNetPay,
    totalTaxes: period.totalTaxes
  }, processedBy);

  return { journalEntryId: journalEntry.id };
}
```

---

## PHASE 6: Testing & Validation (6 hours)

### 6.1 Test Cases

1. **Staff ID Validation**
   - ✅ Valid active employee
   - ✅ Terminated employee (should fail)
   - ✅ Invalid ID (should fail)
   - ✅ Department mismatch (should fail)

2. **HR Data Persistence**
   - ✅ Create employee, refresh page, verify still exists
   - ✅ Update employee, verify change persisted
   - ✅ Delete employee, verify removed

3. **Audit Logging**
   - ✅ Employee creation logged
   - ✅ Salary change logged
   - ✅ Payroll processing logged
   - ✅ Leave approval logged

4. **Payroll-Accounting Integration**
   - ✅ Journal entry created on payroll processing
   - ✅ Cost centers allocated correctly
   - ✅ Tax payable recorded

---

## IMPLEMENTATION CHECKLIST

- [ ] Phase 1: Database schema updates
- [ ] Phase 2: Staff ID validation system
- [ ] Phase 3: Database-backed HR stores
- [ ] Phase 4: Audit log integration
- [ ] Phase 5: Payroll-accounting integration
- [ ] Phase 6: Testing & validation
- [ ] Update all transaction functions to use validation
- [ ] Add authorization checks
- [ ] Link attendance to payroll
- [ ] Department-based access control
- [ ] Employee status enforcement

---

**Estimated Total Time**: 40-60 hours  
**Priority**: 🔴 CRITICAL - Fix immediately
