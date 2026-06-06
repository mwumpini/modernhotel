// HR & Payroll Data Models

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  nationality?: string;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed' | 'other';
  dateOfBirth: Date;
  hireDate: Date;
  terminationDate?: Date;
  departmentId: string;
  positionId: string;
  managerId?: string;
  workLocation?: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'intern';
  status: 'active' | 'inactive' | 'terminated' | 'suspended' | 'on_leave';
  residencyStatus?: 'resident' | 'non_resident';
  employmentClass?: 'regular' | 'part_time' | 'casual';
  secondEmployment?: boolean;
  incomeTaxDeductible?: boolean; // PAYE/Withholding Tax - generic for all countries
  ssnitEnrolled?: boolean; // Tier 1
  tier2Enrolled?: boolean; // Tier 2
  tier3Enrolled?: boolean; // Tier 3
  salary: number;
  hourlyRate?: number;
  overtimeRate?: number;
  // Ghana payroll: support monthly vs hourly, with basic and allowances
  compensationType?: 'monthly' | 'hourly';
  basicSalary?: number; // core basic for PAYE
  allowances?: number; // total regular allowances (non-overtime)
  paymentFrequency?: 'monthly' | 'biweekly' | 'weekly';
  taxWithholding?: {
    tin?: string;
    filingStatus?: 'single' | 'married' | 'head_of_household' | string;
    allowances?: number;
  };
  governmentIds?: {
    nationalId?: string;
    ssn?: string;
    passport?: string;
    workPermit?: string;
  };
  bankAccount: {
    accountNumber: string;
    bankName: string;
    branchCode: string;
  };
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  documents: string[]; // Document IDs or filenames
  qualifications?: Array<{
    type: 'education' | 'certification' | 'experience';
    title: string;
    institution?: string;
    year?: number;
  }>;
  acknowledgments?: Array<{ code: string; title: string; date: Date }>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  description: string;
  managerId?: string;
  parentDepartmentId?: string;
  budget: number;
  location: string;
  isActive?: boolean;
  employeeCount?: number;
  status?: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Position {
  id: string;
  title: string;
  code?: string;
  departmentId: string;
  description: string;
  requirements: string[];
  responsibilities?: string[];
  minSalary?: number;
  maxSalary?: number;
  baseSalary?: number;
  isActive?: boolean;
  status?: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollPeriod {
  id: string;
  periodNumber: string;
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'processing' | 'approved' | 'paid' | 'closed';
  totalGrossPay: number;
  totalNetPay: number;
  totalDeductions: number;
  totalTaxes: number;
  employeeCount: number;
  processedBy?: string;
  processedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollRecord {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  department: string;
  position: string;
  basicSalary: number;
  allowances: number;
  overtimePay: number;
  bonuses: number;
  grossPay: number;
  deductions: {
    tax: number;
    socialSecurity: number;
    healthInsurance: number;
    pension: number;
    other: number;
  };
  netPay: number;
  bankAccount: string;
  paymentMethod: 'bank_transfer' | 'check' | 'cash';
  status: 'pending' | 'processed' | 'paid' | 'failed';
  paidAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  totalHours: number;
  overtimeHours: number;
  breakTime: number;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday';
  shift: 'morning' | 'afternoon' | 'night' | 'flexible';
  location: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: 'annual' | 'sick' | 'personal' | 'maternity' | 'paternity' | 'bereavement' | 'other';
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedBy: string;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  reviewPeriod: string;
  reviewDate: Date;
  reviewerId: string;
  reviewerName: string;
  overallRating: number; // 1-5 scale
  categories: {
    jobKnowledge: number;
    qualityOfWork: number;
    quantityOfWork: number;
    teamwork: number;
    communication: number;
    initiative: number;
    attendance: number;
    reliability: number;
  };
  strengths: string[];
  areasForImprovement: string[];
  goals: string[];
  comments: string;
  employeeComments?: string;
  status: 'draft' | 'submitted' | 'reviewed' | 'acknowledged' | 'completed';
  nextReviewDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingProgram {
  id: string;
  title: string;
  code: string;
  description: string;
  category: 'technical' | 'soft_skills' | 'compliance' | 'leadership' | 'safety' | 'other';
  duration: number; // in hours
  cost: number;
  maxParticipants: number;
  instructor: string;
  location: string;
  startDate: Date;
  endDate: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  materials: string[];
  objectives: string[];
  prerequisites: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingRecord {
  id: string;
  trainingProgramId: string;
  employeeId: string;
  enrollmentDate: Date;
  completionDate?: Date;
  status: 'enrolled' | 'in_progress' | 'completed' | 'dropped' | 'failed';
  score?: number;
  certificate?: string;
  feedback?: string;
  cost: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Recruitment {
  id: string;
  positionId: string;
  positionTitle: string;
  department: string;
  jobDescription: string;
  requirements: string[];
  responsibilities: string[];
  salaryRange: {
    min: number;
    max: number;
  };
  status: 'draft' | 'published' | 'reviewing' | 'closed' | 'filled';
  publishedDate?: Date;
  closingDate?: Date;
  applications: number;
  shortlisted: number;
  interviewed: number;
  hired: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobApplication {
  id: string;
  recruitmentId: string;
  applicantName: string;
  email: string;
  phone: string;
  resume: string;
  coverLetter?: string;
  status: 'received' | 'reviewing' | 'shortlisted' | 'interviewed' | 'offered' | 'hired' | 'rejected';
  receivedDate: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  interviewDate?: Date;
  interviewNotes?: string;
  offerDate?: Date;
  offerAmount?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HRReport {
  id: string;
  reportNumber: string;
  type: 'payroll' | 'attendance' | 'performance' | 'training' | 'recruitment' | 'turnover' | 'diversity' | 'compliance';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  generatedAt: Date;
  summary: string;
  details: any;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface HRAnalytics {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  date: Date;
  totalEmployees: number;
  activeEmployees: number;
  newHires: number;
  terminations: number;
  turnoverRate: number;
  averageSalary: number;
  totalPayroll: number;
  averageAttendance: number;
  leaveUtilization: number;
  trainingCompletion: number;
  performanceAverage: number;
  diversityMetrics: {
    genderDistribution: Record<string, number>;
    ageDistribution: Record<string, number>;
    departmentDistribution: Record<string, number>;
  };
  trends: Array<{
    date: Date;
    employees: number;
    payroll: number;
    attendance: number;
    performance: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostAnalysis {
  id: string;
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  totalCost: number;
  salaryCosts: number;
  benefitsCosts: number;
  trainingCosts: number;
  recruitmentCosts: number;
  overheadCosts: number;
  costBreakdown: Record<string, number>;
  costPerEmployee: number;
  budgetVariance: number;
  recommendations: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BenefitsPackage {
  id: string;
  name: string;
  description: string;
  type: 'health' | 'dental' | 'vision' | 'life' | 'disability' | 'retirement' | 'other';
  coverage: string;
  cost: number;
  employeeContribution: number;
  employerContribution: number;
  isActive: boolean;
  effectiveDate: Date;
  expiryDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeBenefits {
  id: string;
  employeeId: string;
  benefitsPackageId: string;
  enrollmentDate: Date;
  effectiveDate: Date;
  endDate?: Date;
  status: 'active' | 'inactive' | 'terminated';
  dependents: number;
  totalCost: number;
  employeeContribution: number;
  employerContribution: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
