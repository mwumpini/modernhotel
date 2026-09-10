'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea, Checkbox } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useEmployeeChangesStore } from '@/app/lib/hr/employeeChangesStore';
import { usePayrollStore } from '@/app/lib/hr/payrollStore';
import { useTrainingStore } from '@/app/lib/hr/trainingStore';
import { useComplianceStore } from '@/app/lib/compliance/store';
import { useSettingsStore } from '@/app/lib/settings/store';

export default function EmployeeRecordsPanel() {
  const employees = useEmployeeStore((s) => s.employees);
  const departments = useEmployeeStore((s) => s.departments);
  const positions = useEmployeeStore((s) => s.positions);
  const addEmployee = useEmployeeStore((s) => s.addEmployee);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);
  const getDepartment = useEmployeeStore((s) => s.getDepartment);
  const getPosition = useEmployeeStore((s) => s.getPosition);

  const logChange = useEmployeeChangesStore((s) => s.logChange);
  const payrollRecords = usePayrollStore((s) => s.payrollRecords);
  const trainingPrograms = useTrainingStore((s) => s.programs);
  const trainingEnrollments = useTrainingStore((s) => s.enrollments);
  const taxRules = useComplianceStore((s) => s.taxRules);

  // Tier 1/2/3 are separate, independently-renameable rules (different institutions) — the
  // column labels and pre-run estimate rates below read the live rule so a rename in
  // Settings → Tax Rate Builder (or a rate change) shows up here without a code change.
  const findGhRule = (tag: string) =>
    taxRules.find((r) => r.countryCode === 'GH' && r.domain === 'payroll' && (r.appliesTo || []).includes(tag));
  const tier1Rule = findGhRule('TIER1');
  const tier2Rule = findGhRule('TIER2');
  const tier3Rule = findGhRule('TIER3_RELIEF_CAP');
  const tier1Label = tier1Rule?.name || 'Tier 1';
  const tier2Label = tier2Rule?.name || 'Tier 2';
  const tier3Label = tier3Rule?.name || 'Tier 3';

  React.useEffect(() => {
    // This panel can be reached directly (HR & Payroll → Employee Management → Employee
    // Records) without ever visiting Compliance & Reports first, which is otherwise the
    // only place the compliance store gets hydrated — without this, taxRules is silently
    // empty and every Tier 1/2/3 label/rate below falls back to defaults instead of the
    // live (possibly renamed/rate-changed) rule.
    void useComplianceStore.getState().syncCountryFromSetup();
  }, []);

  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [deptFilter, setDeptFilter] = React.useState<string>('all');
  const [isOpen, setIsOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<number>(1); // 1: Basic, 2: Employment, 3: Docs

  // Column visibility controls
  const allColumnKeys = [
  'idNo','staffNo','name','department','position','residencyClass','status','type',
  'secondEmployment','basicSalary','socialSecurity','tier2','tier3','allowances',
  'vehicleBenefit','housingBenefit','otherNonCash','incomeTax','actions'
  ];
  const [showColumns, setShowColumns] = React.useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(new Set(allColumnKeys));
  const toggleColumn = (key: string, checked: boolean) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  };

  const [form, setForm] = React.useState<any>({
    // Basic
    employeeNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    nationality: 'Ghana',
    maritalStatus: '',
    dateOfBirth: '',
    hireDate: new Date().toISOString().slice(0, 10),
    photo: null as string | null, // Base64 or data URL
    // Employment
    departmentId: departments[0]?.id || '',
    positionId: positions[0]?.id || '',
    managerId: '',
    status: 'active',
    employmentType: 'full_time',
    workLocation: '',
    residencyStatus: 'resident',
    employmentClass: 'regular',
    secondEmployment: 'no',
    payeEnrolled: 'yes',
    ssnitEnrolled: 'yes',
    tier3Enrolled: 'no',
    tier3ContributionPct: 0,
    // Compensation
    compensationType: 'monthly',
    basicSalary: 0,
    allowances: 0,
    salary: 0,
    hourlyRate: '',
    overtimeRate: '',
    paymentFrequency: 'monthly',
    taxWithholding: { tin: '', filingStatus: 'single', allowances: 0 },
    governmentIds: { nationalId: '', ssn: '', passport: '', workPermit: '' },
    ssnitNumber: '',
    ghanaCardNumber: '',
    contractEndDate: '',
    workPermitExpiryDate: '',
    nextOfKin: { name: '', relationship: '', phone: '', address: '' },
    probation: { startDate: '', endDate: '', status: 'active' },
    // Bank
    bankAccount: { accountNumber: '', bankName: '', branchCode: '' },
    // Emergency
    emergencyContact: { name: '', relationship: '', phone: '', email: '' },
    // Address
    address: { street: '', city: '', state: '', postalCode: '', country: 'Ghana' },
    // Notes
    notes: '',
    documents: [] as string[],
		qualifications: [] as any[],
		otherBenefits: [] as Array<{ name: string; amount: number; employerPct: number; employeePct: number; taxable: 'yes' | 'no' }>,
		vehicleBenefit: 0,
		housingBenefit: 0,
		otherNonCashBenefits: 0
  });

  const filtered = employees.filter((e) => {
    const statusOk = statusFilter === 'all' || e.status === statusFilter;
    const deptOk = deptFilter === 'all' || e.departmentId === deptFilter;
    return statusOk && deptOk;
  });

  const openCreate = () => {
    setIsEditing(false);
    setEditingId(null);
    setStep(1);
		setForm({
      employeeNumber: useSettingsStore.getState().peekNextModuleNumber('hr', 'employeeId'),
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      gender: '',
      nationality: 'Ghana',
      maritalStatus: '',
      dateOfBirth: '',
      hireDate: new Date().toISOString().slice(0, 10),
      photo: null,
      departmentId: departments[0]?.id || '',
      positionId: positions[0]?.id || '',
      managerId: '',
      status: 'active',
      employmentType: 'full_time',
      workLocation: '',
      residencyStatus: 'resident',
      employmentClass: 'regular',
      secondEmployment: 'no',
      ssnitEnrolled: 'yes',
      tier2Enrolled: 'yes',
      tier3Enrolled: 'no',
    tier3ContributionPct: 0,
      compensationType: 'monthly',
      basicSalary: 0,
      allowances: 0,
      salary: 0,
      hourlyRate: '',
      overtimeRate: '',
      paymentFrequency: 'monthly',
      taxWithholding: { tin: '', filingStatus: 'single', allowances: 0 },
      governmentIds: { nationalId: '', ssn: '', passport: '', workPermit: '' },
    ssnitNumber: '',
    ghanaCardNumber: '',
    contractEndDate: '',
    workPermitExpiryDate: '',
    nextOfKin: { name: '', relationship: '', phone: '', address: '' },
    probation: { startDate: '', endDate: '', status: 'active' },
      bankAccount: { accountNumber: '', bankName: '', branchCode: '' },
      emergencyContact: { name: '', relationship: '', phone: '', email: '' },
      address: { street: '', city: '', state: '', postalCode: '', country: 'Ghana' },
      notes: '',
      documents: [],
			qualifications: [],
			otherBenefits: [],
			vehicleBenefit: 0,
			housingBenefit: 0,
			otherNonCashBenefits: 0
    });
    setIsOpen(true);
  };

  const openEdit = (id: string) => {
    const e = employees.find((x) => x.id === id);
    if (!e) return;
    setIsEditing(true);
    setEditingId(id);
    setStep(1);
		setForm({
      employeeNumber: e.employeeNumber,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      phone: e.phone,
      gender: (e as any).gender || '',
      nationality: (e as any).nationality || 'Ghana',
      maritalStatus: (e as any).maritalStatus || '',
      dateOfBirth: e.dateOfBirth ? new Date(e.dateOfBirth).toISOString().slice(0, 10) : '',
      hireDate: new Date(e.hireDate).toISOString().slice(0, 10),
      photo: (e as any).photo || null,
      departmentId: e.departmentId,
      positionId: e.positionId,
      managerId: e.managerId || '',
      status: e.status,
      employmentType: e.employmentType,
      workLocation: (e as any).workLocation || '',
      residencyStatus: (e as any).residencyStatus || 'resident',
      employmentClass: (e as any).employmentClass || 'regular',
      secondEmployment: (e as any).secondEmployment ? 'yes' : 'no',
      payeEnrolled: (e as any).payeEnrolled !== false ? 'yes' : 'no',
      ssnitEnrolled: (e as any).ssnitEnrolled ? 'yes' : 'no',
      tier2Enrolled: (e as any).tier2Enrolled ? 'yes' : 'no',
      tier3Enrolled: (e as any).tier3Enrolled ? 'yes' : 'no',
      tier3ContributionPct: (e as any).tier3ContributionPct ?? 0,
      compensationType: (e as any).compensationType || ((e as any).hourlyRate ? 'hourly' : 'monthly'),
      basicSalary: (e as any).basicSalary ?? (e as any).salary ?? (e as any).baseSalary ?? 0,
      allowances: (e as any).allowances ?? 0,
      salary: (e as any).salary ?? (e as any).baseSalary ?? 0,
      hourlyRate: (e as any).hourlyRate ?? '',
      overtimeRate: (e as any).overtimeRate ?? '',
      paymentFrequency: (e as any).paymentFrequency || 'monthly',
      taxWithholding: (e as any).taxWithholding || { tin: '', filingStatus: 'single', allowances: 0 },
      governmentIds: (e as any).governmentIds || { nationalId: '', ssn: '', passport: '', workPermit: '' },
      ssnitNumber: (e as any).ssnitNumber || '',
      ghanaCardNumber: (e as any).ghanaCardNumber || '',
      contractEndDate: (e as any).contractEndDate ? new Date((e as any).contractEndDate).toISOString().slice(0, 10) : '',
      workPermitExpiryDate: (e as any).workPermitExpiryDate ? new Date((e as any).workPermitExpiryDate).toISOString().slice(0, 10) : '',
      nextOfKin: (e as any).nextOfKin || { name: '', relationship: '', phone: '', address: '' },
      probation: (e as any).probation
        ? {
            startDate: new Date((e as any).probation.startDate).toISOString().slice(0, 10),
            endDate: new Date((e as any).probation.endDate).toISOString().slice(0, 10),
            status: (e as any).probation.status,
          }
        : { startDate: '', endDate: '', status: 'active' },
      bankAccount: { accountNumber: e.bankAccount?.accountNumber || '', bankName: e.bankAccount?.bankName || '', branchCode: e.bankAccount?.branchCode || '' },
      emergencyContact: { name: e.emergencyContact?.name || '', relationship: e.emergencyContact?.relationship || '', phone: e.emergencyContact?.phone || '', email: e.emergencyContact?.email || '' },
      address: { street: e.address?.street || '', city: e.address?.city || '', state: e.address?.state || '', postalCode: e.address?.postalCode || '', country: e.address?.country || 'Ghana' },
      notes: e.notes || '',
      documents: (e as any).documents || [],
			qualifications: (e as any).qualifications || [],
			qualificationsText: ((e as any).qualifications || []).map((q: any) => q.title).filter(Boolean).join('\n'),
			otherBenefits: (e as any).otherBenefits || [],
			vehicleBenefit: (e as any).vehicleBenefit ?? 0,
			housingBenefit: (e as any).housingBenefit ?? 0,
			otherNonCashBenefits: (e as any).otherNonCashBenefits ?? 0
    });
    setIsOpen(true);
  };

  // Autosave draft
  React.useEffect(() => {
    try { localStorage.setItem('hr.addEmployee.draft', JSON.stringify({ form, isEditing, editingId, step })); } catch {}
  }, [form, isEditing, editingId, step]);

  React.useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem('hr.addEmployee.draft');
      if (saved && !isEditing) {
        const parsed = JSON.parse(saved);
        if (parsed?.form) setForm(parsed.form);
        if (parsed?.step) setStep(parsed.step);
      }
    } catch {}
  }, [isOpen, isEditing]);

  const save = () => {
    // Validation with user feedback
    const missingFields: string[] = [];
    
    if (!form.employeeNumber || form.employeeNumber.trim() === '') {
      missingFields.push('Staff No.');
    }
    if (!form.firstName || form.firstName.trim() === '') {
      missingFields.push('First Name');
    }
    if (!form.lastName || form.lastName.trim() === '') {
      missingFields.push('Last Name');
    }
    if (!form.email || form.email.trim() === '') {
      missingFields.push('Email');
    }
    if (!form.departmentId) {
      missingFields.push('Department');
    }
    if (!form.positionId) {
      missingFields.push('Position');
    }
    if (!form.hireDate) {
      missingFields.push('Hire Date');
    }
    
    if (missingFields.length > 0) {
      const errorMessage = `Please fill in the following required fields:\n\n${missingFields.join('\n')}`;
      console.log('[HR][Records] validation failed', { form, missingFields });
      alert(errorMessage);
      // Navigate to step 1 if missing basic info fields
      if (missingFields.some(f => ['Staff No.', 'First Name', 'Last Name', 'Email'].includes(f))) {
        setStep(1);
      }
      // Navigate to step 2 if missing employment fields
      else if (missingFields.some(f => ['Department', 'Position', 'Hire Date'].includes(f))) {
        setStep(2);
      }
      return;
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.email && !emailRegex.test(form.email.trim())) {
      alert('Please enter a valid email address');
      setStep(1);
      return;
    }
    
    console.log('[HR][Records] validation passed, saving employee', { form });
    // The qualifications free-text box is the only UI for this field; convert non-empty
    // lines into the structured shape the data model expects. If the box is empty, keep
    // whatever was already loaded into form.qualifications (untouched on create/edit-open)
    // so leaving it blank never wipes out existing structured data.
    const qualificationsTextLines = String((form as any).qualificationsText || '')
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean);
    const resolvedQualifications = qualificationsTextLines.length > 0
      ? qualificationsTextLines.map((title: string) => ({ type: 'education' as const, title }))
      : form.qualifications;
    if (isEditing && editingId) {
      const before = employees.find((x) => x.id === editingId);
      console.log('[HR][Records] updateEmployee', { id: editingId, form });
      updateEmployee(editingId, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        gender: form.gender || undefined,
        nationality: form.nationality || undefined,
        maritalStatus: form.maritalStatus || undefined,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth) : undefined,
        hireDate: new Date(form.hireDate),
        departmentId: form.departmentId,
        positionId: form.positionId,
        managerId: form.managerId || undefined,
        workLocation: form.workLocation || undefined,
        residencyStatus: form.residencyStatus,
        employmentClass: form.employmentClass,
        secondEmployment: form.secondEmployment === 'yes',
        ssnitEnrolled: form.ssnitEnrolled === 'yes',
        tier2Enrolled: form.tier2Enrolled === 'yes',
        tier3Enrolled: form.tier3Enrolled === 'yes',
        tier3ContributionPct: form.tier3Enrolled === 'yes' ? Number(form.tier3ContributionPct || 0) : undefined,
        status: form.status,
        employmentType: form.employmentType,
        compensationType: form.compensationType,
        basicSalary: form.compensationType === 'monthly' ? Number(form.basicSalary || 0) : undefined,
        allowances: form.compensationType === 'monthly' ? Number(form.allowances || 0) : undefined,
        salary: form.compensationType === 'monthly' ? Number((Number(form.basicSalary || 0) + Number(form.allowances || 0)).toFixed(2)) : 0,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        overtimeRate: form.overtimeRate ? Number(form.overtimeRate) : undefined,
        paymentFrequency: form.paymentFrequency,
        taxWithholding: form.taxWithholding,
        governmentIds: form.governmentIds,
        ssnitNumber: form.ssnitNumber || undefined,
        ghanaCardNumber: form.ghanaCardNumber || undefined,
        contractEndDate: form.contractEndDate ? new Date(form.contractEndDate) : undefined,
        workPermitExpiryDate: form.workPermitExpiryDate ? new Date(form.workPermitExpiryDate) : undefined,
        nextOfKin: (form.nextOfKin?.name ? form.nextOfKin : undefined),
        probation: (form.probation?.startDate && form.probation?.endDate)
          ? { startDate: new Date(form.probation.startDate), endDate: new Date(form.probation.endDate), status: form.probation.status }
          : undefined,
        bankAccount: {
          accountNumber: form.bankAccount.accountNumber,
          bankName: form.bankAccount.bankName,
          branchCode: form.bankAccount.branchCode
        },
        emergencyContact: {
          name: form.emergencyContact.name,
          relationship: form.emergencyContact.relationship,
          phone: form.emergencyContact.phone,
          email: form.emergencyContact.email || undefined
        },
        address: {
          street: form.address.street,
          city: form.address.city,
          state: form.address.state,
          postalCode: form.address.postalCode,
          country: form.address.country
        },
        notes: form.notes || undefined,
        documents: form.documents,
        qualifications: resolvedQualifications,
        photo: form.photo || undefined,
        vehicleBenefit: Number(form.vehicleBenefit || 0),
        housingBenefit: Number(form.housingBenefit || 0),
        otherNonCashBenefits: Number(form.otherNonCashBenefits || 0)
      } as any);

      if (before) {
        const diffs: Array<{ field: string; prev: any; next: any; type: string }> = [];
        if (before.departmentId !== form.departmentId) diffs.push({ field: 'departmentId', prev: before.departmentId, next: form.departmentId, type: 'department_change' });
        if (before.positionId !== form.positionId) diffs.push({ field: 'positionId', prev: before.positionId, next: form.positionId, type: 'position_change' });
        const prevSalary = (before as any).salary ?? (before as any).baseSalary;
        if (prevSalary !== Number(form.salary)) diffs.push({ field: 'salary', prev: prevSalary, next: Number(form.salary), type: 'salary_change' });
        if (before.status !== form.status) diffs.push({ field: 'status', prev: before.status, next: form.status, type: 'status_change' });

        diffs.forEach((d) =>
          logChange({
            employeeId: before.id,
            employeeName: `${before.firstName} ${before.lastName}`,
            type: d.type as any,
            field: d.field,
            previousValue: d.prev,
            newValue: d.next,
            timestamp: new Date()
          })
        );
      }
      console.log('[HR][Records] Employee updated successfully', editingId);
      alert(`Employee "${form.firstName} ${form.lastName}" has been updated successfully!`);
      setIsOpen(false);
      return;
    } else {
      console.log('[HR][Records] addEmployee', { form });
      useSettingsStore.getState().getNextModuleNumber('hr', 'employeeId');
      const created = addEmployee({
        employeeNumber: form.employeeNumber,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        gender: form.gender || undefined,
        nationality: form.nationality || undefined,
        maritalStatus: form.maritalStatus || undefined,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth) : new Date('1990-01-01'),
        hireDate: new Date(form.hireDate),
        departmentId: form.departmentId,
        positionId: form.positionId,
        managerId: form.managerId || undefined,
        employmentType: form.employmentType,
        status: form.status,
        workLocation: form.workLocation || undefined,
        residencyStatus: form.residencyStatus,
        employmentClass: form.employmentClass,
        secondEmployment: form.secondEmployment === 'yes',
        ssnitEnrolled: form.ssnitEnrolled === 'yes',
        tier2Enrolled: form.tier2Enrolled === 'yes',
        tier3Enrolled: form.tier3Enrolled === 'yes',
        tier3ContributionPct: form.tier3Enrolled === 'yes' ? Number(form.tier3ContributionPct || 0) : undefined,
        compensationType: form.compensationType,
        basicSalary: form.compensationType === 'monthly' ? Number(form.basicSalary || 0) : undefined,
        allowances: form.compensationType === 'monthly' ? Number(form.allowances || 0) : undefined,
        salary: form.compensationType === 'monthly' ? Number((Number(form.basicSalary || 0) + Number(form.allowances || 0)).toFixed(2)) : 0,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        overtimeRate: form.overtimeRate ? Number(form.overtimeRate) : undefined,
        paymentFrequency: form.paymentFrequency,
        taxWithholding: form.taxWithholding,
        governmentIds: form.governmentIds,
        ssnitNumber: form.ssnitNumber || undefined,
        ghanaCardNumber: form.ghanaCardNumber || undefined,
        contractEndDate: form.contractEndDate ? new Date(form.contractEndDate) : undefined,
        workPermitExpiryDate: form.workPermitExpiryDate ? new Date(form.workPermitExpiryDate) : undefined,
        nextOfKin: (form.nextOfKin?.name ? form.nextOfKin : undefined),
        probation: (form.probation?.startDate && form.probation?.endDate)
          ? { startDate: new Date(form.probation.startDate), endDate: new Date(form.probation.endDate), status: form.probation.status }
          : undefined,
        bankAccount: { accountNumber: form.bankAccount.accountNumber, bankName: form.bankAccount.bankName, branchCode: form.bankAccount.branchCode },
        emergencyContact: { name: form.emergencyContact.name, relationship: form.emergencyContact.relationship, phone: form.emergencyContact.phone, email: form.emergencyContact.email || undefined },
        address: { street: form.address.street, city: form.address.city, state: form.address.state, postalCode: form.address.postalCode, country: form.address.country },
        documents: form.documents,
        qualifications: resolvedQualifications,
        photo: form.photo || undefined,
        vehicleBenefit: Number(form.vehicleBenefit || 0),
        housingBenefit: Number(form.housingBenefit || 0),
        otherNonCashBenefits: Number(form.otherNonCashBenefits || 0)
      } as any);
      // Optionally log profile creation
      try {
        const name = `${form.firstName} ${form.lastName}`.trim();
        logChange({ employeeId: (created as any)?.id || 'new', employeeName: name, type: 'profile_update', field: 'created', previousValue: null, newValue: 'created', timestamp: new Date() });
      } catch {}
      console.log('[HR][Records] Employee created successfully', created);
      alert(`Employee "${form.firstName} ${form.lastName}" has been created successfully!`);
    }
    setIsOpen(false);
    // Reset form after successful save
    setForm({
      employeeNumber: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      gender: '',
      nationality: 'Ghana',
      maritalStatus: '',
      dateOfBirth: '',
      hireDate: new Date().toISOString().slice(0, 10),
      photo: null,
      departmentId: departments[0]?.id || '',
      positionId: positions[0]?.id || '',
      managerId: '',
      status: 'active',
      employmentType: 'full_time',
      workLocation: '',
      residencyStatus: 'resident',
      employmentClass: 'regular',
      secondEmployment: 'no',
      ssnitEnrolled: 'yes',
      tier2Enrolled: 'yes',
      tier3Enrolled: 'no',
    tier3ContributionPct: 0,
      compensationType: 'monthly',
      basicSalary: 0,
      allowances: 0,
      salary: 0,
      hourlyRate: '',
      overtimeRate: '',
      paymentFrequency: 'monthly',
      taxWithholding: { tin: '', filingStatus: 'single', allowances: 0 },
      governmentIds: { nationalId: '', ssn: '', passport: '', workPermit: '' },
    ssnitNumber: '',
    ghanaCardNumber: '',
    contractEndDate: '',
    workPermitExpiryDate: '',
    nextOfKin: { name: '', relationship: '', phone: '', address: '' },
    probation: { startDate: '', endDate: '', status: 'active' },
      bankAccount: { accountNumber: '', bankName: '', branchCode: '' },
      emergencyContact: { name: '', relationship: '', phone: '', email: '' },
      address: { street: '', city: '', state: '', postalCode: '', country: 'Ghana' },
      notes: '',
      documents: [],
      qualifications: [],
      otherBenefits: [],
      vehicleBenefit: 0,
      housingBenefit: 0,
      otherNonCashBenefits: 0
    });
    setStep(1);
  };

  const downloadPDF = async () => {
    try {
      console.log('[HR][Employee] Generating PDF for employee form');
      
      // Dynamic import of jsPDF if available, otherwise use browser print
      let jsPDF: any;
      try {
        jsPDF = (await import('jspdf')).default;
      } catch (e) {
        console.log('[HR][Employee] jsPDF not available, using browser print');
        // Fallback to browser print-to-PDF
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          alert('Please allow pop-ups to download PDF');
          return;
        }
        
        const deptName = departments.find(d => d.id === form.departmentId)?.name || 'N/A';
        const posName = positions.find(p => p.id === form.positionId)?.title || 'N/A';
        const managerName = form.managerId ? employees.find(e => e.id === form.managerId)?.firstName + ' ' + employees.find(e => e.id === form.managerId)?.lastName : 'N/A';
        
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Employee Form - ${form.firstName} ${form.lastName}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; border-bottom: 2px solid #000; padding-bottom: 10px; }
              .section { margin: 20px 0; }
              .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; background: #f0f0f0; padding: 8px; }
              .row { display: flex; margin: 5px 0; }
              .label { font-weight: bold; width: 200px; }
              .value { flex: 1; }
              .photo { width: 100px; height: 100px; border: 1px solid #000; margin: 10px 0; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <h1>Employee Information Form</h1>
            ${form.photo ? `<div class="photo"><img src="${form.photo}" style="width: 100%; height: 100%; object-fit: cover;" /></div>` : ''}
            
            <div class="section">
              <div class="section-title">Personal Information</div>
              <div class="row"><span class="label">Staff No.:</span><span class="value">${form.employeeNumber || 'N/A'}</span></div>
              <div class="row"><span class="label">Full Name:</span><span class="value">${form.firstName || ''} ${form.lastName || ''}</span></div>
              <div class="row"><span class="label">Email:</span><span class="value">${form.email || 'N/A'}</span></div>
              <div class="row"><span class="label">Phone:</span><span class="value">${form.phone || 'N/A'}</span></div>
              <div class="row"><span class="label">Date of Birth:</span><span class="value">${form.dateOfBirth || 'N/A'}</span></div>
              <div class="row"><span class="label">Gender:</span><span class="value">${form.gender || 'N/A'}</span></div>
              <div class="row"><span class="label">Nationality:</span><span class="value">${form.nationality || 'N/A'}</span></div>
              <div class="row"><span class="label">Marital Status:</span><span class="value">${form.maritalStatus || 'N/A'}</span></div>
            </div>
            
            <div class="section">
              <div class="section-title">Employment Details</div>
              <div class="row"><span class="label">Hire Date:</span><span class="value">${form.hireDate || 'N/A'}</span></div>
              <div class="row"><span class="label">Department:</span><span class="value">${deptName}</span></div>
              <div class="row"><span class="label">Position:</span><span class="value">${posName}</span></div>
              <div class="row"><span class="label">Manager:</span><span class="value">${managerName}</span></div>
              <div class="row"><span class="label">Status:</span><span class="value">${form.status || 'N/A'}</span></div>
              <div class="row"><span class="label">Employment Type:</span><span class="value">${form.employmentType || 'N/A'}</span></div>
              <div class="row"><span class="label">Work Location:</span><span class="value">${form.workLocation || 'N/A'}</span></div>
            </div>
            
            <div class="section">
              <div class="section-title">Compensation</div>
              <div class="row"><span class="label">Type:</span><span class="value">${form.compensationType || 'N/A'}</span></div>
              ${form.compensationType === 'monthly' ? `
                <div class="row"><span class="label">Basic Salary:</span><span class="value">GHS ${form.basicSalary || 0}</span></div>
                <div class="row"><span class="label">Allowances:</span><span class="value">GHS ${form.allowances || 0}</span></div>
              ` : `
                <div class="row"><span class="label">Hourly Rate:</span><span class="value">GHS ${form.hourlyRate || 'N/A'}</span></div>
                <div class="row"><span class="label">Overtime Rate:</span><span class="value">GHS ${form.overtimeRate || 'N/A'}</span></div>
              `}
              <div class="row"><span class="label">Payment Frequency:</span><span class="value">${form.paymentFrequency || 'N/A'}</span></div>
            </div>
            
            <div class="section">
              <div class="section-title">Bank Details</div>
              <div class="row"><span class="label">Account Number:</span><span class="value">${form.bankAccount?.accountNumber || 'N/A'}</span></div>
              <div class="row"><span class="label">Bank Name:</span><span class="value">${form.bankAccount?.bankName || 'N/A'}</span></div>
              <div class="row"><span class="label">Branch Code:</span><span class="value">${form.bankAccount?.branchCode || 'N/A'}</span></div>
            </div>
            
            <div class="section">
              <div class="section-title">Emergency Contact</div>
              <div class="row"><span class="label">Name:</span><span class="value">${form.emergencyContact?.name || 'N/A'}</span></div>
              <div class="row"><span class="label">Relationship:</span><span class="value">${form.emergencyContact?.relationship || 'N/A'}</span></div>
              <div class="row"><span class="label">Phone:</span><span class="value">${form.emergencyContact?.phone || 'N/A'}</span></div>
              <div class="row"><span class="label">Email:</span><span class="value">${form.emergencyContact?.email || 'N/A'}</span></div>
            </div>
            
            <div class="section">
              <div class="section-title">Address</div>
              <div class="row"><span class="label">Street:</span><span class="value">${form.address?.street || 'N/A'}</span></div>
              <div class="row"><span class="label">City:</span><span class="value">${form.address?.city || 'N/A'}</span></div>
              <div class="row"><span class="label">State/Region:</span><span class="value">${form.address?.state || 'N/A'}</span></div>
              <div class="row"><span class="label">Postal Code:</span><span class="value">${form.address?.postalCode || 'N/A'}</span></div>
              <div class="row"><span class="label">Country:</span><span class="value">${form.address?.country || 'N/A'}</span></div>
            </div>
            
            ${form.notes ? `<div class="section"><div class="section-title">Notes</div><div>${form.notes}</div></div>` : ''}
            
            <div style="margin-top: 30px; font-size: 12px; color: #666;">
              Generated on ${new Date().toLocaleString()}
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 250);
        return;
      }
      
      // Use jsPDF if available
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;
      
      // Title
      doc.setFontSize(18);
      doc.text('Employee Information Form', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;
      
      // Photo if available
      if (form.photo) {
        try {
          doc.addImage(form.photo, 'JPEG', pageWidth - 40, yPos - 10, 25, 25);
        } catch (e) {
          console.log('[HR][Employee] Could not add photo to PDF', e);
        }
      }
      
      const deptName = departments.find(d => d.id === form.departmentId)?.name || 'N/A';
      const posName = positions.find(p => p.id === form.positionId)?.title || 'N/A';
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Personal Information', 14, yPos += 10);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      
      const fields = [
        ['Staff No.', form.employeeNumber || 'N/A'],
        ['Full Name', `${form.firstName || ''} ${form.lastName || ''}`],
        ['Email', form.email || 'N/A'],
        ['Phone', form.phone || 'N/A'],
        ['Date of Birth', form.dateOfBirth || 'N/A'],
        ['Gender', form.gender || 'N/A'],
        ['Nationality', form.nationality || 'N/A'],
        ['Marital Status', form.maritalStatus || 'N/A']
      ];
      
      fields.forEach(([label, value]) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 14, yPos += 6);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 60, yPos);
      });
      
      yPos += 10;
      doc.setFont(undefined, 'bold');
      doc.text('Employment Details', 14, yPos += 8);
      doc.setFont(undefined, 'normal');
      
      const empFields = [
        ['Hire Date', form.hireDate || 'N/A'],
        ['Department', deptName],
        ['Position', posName],
        ['Status', form.status || 'N/A'],
        ['Employment Type', form.employmentType || 'N/A'],
        ['Work Location', form.workLocation || 'N/A']
      ];
      
      empFields.forEach(([label, value]) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 14, yPos += 6);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 60, yPos);
      });
      
      yPos += 10;
      doc.setFont(undefined, 'bold');
      doc.text('Compensation', 14, yPos += 8);
      doc.setFont(undefined, 'normal');
      
      doc.setFont(undefined, 'bold');
      doc.text('Type:', 14, yPos += 6);
      doc.setFont(undefined, 'normal');
      doc.text(form.compensationType || 'N/A', 60, yPos);
      
      if (form.compensationType === 'monthly') {
        doc.setFont(undefined, 'bold');
        doc.text('Basic Salary:', 14, yPos += 6);
        doc.setFont(undefined, 'normal');
        doc.text(`GHS ${form.basicSalary || 0}`, 60, yPos);
        doc.setFont(undefined, 'bold');
        doc.text('Allowances:', 14, yPos += 6);
        doc.setFont(undefined, 'normal');
        doc.text(`GHS ${form.allowances || 0}`, 60, yPos);
      } else {
        doc.setFont(undefined, 'bold');
        doc.text('Hourly Rate:', 14, yPos += 6);
        doc.setFont(undefined, 'normal');
        doc.text(`GHS ${form.hourlyRate || 'N/A'}`, 60, yPos);
      }
      
      const fileName = `Employee_Form_${form.employeeNumber || form.firstName}_${form.lastName || 'New'}.pdf`;
      doc.save(fileName);
      console.log('[HR][Employee] PDF downloaded successfully', fileName);
      
    } catch (error) {
      console.error('[HR][Employee] Error generating PDF', error);
      alert('Error generating PDF. Please try again or use browser print (Ctrl+P).');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Employee Records</div>
          <div className="flex items-center gap-2">
            <Select
              size="sm"
              selectedKeys={[deptFilter]}
              onSelectionChange={(k) => setDeptFilter(Array.from(k)[0] as string)}
              className="w-48"
              variant="bordered"
              aria-label="Department"
              items={[{ id: 'all', name: 'All Departments' }, ...departments.map((d) => ({ id: d.id, name: d.name }))]}
            >
              {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
            </Select>
            <Select size="sm" selectedKeys={[statusFilter]} onSelectionChange={(k) => setStatusFilter(Array.from(k)[0] as string)} className="w-40" variant="bordered" aria-label="Status">
              <SelectItem key="all">All Status</SelectItem>
              <SelectItem key="active">Active</SelectItem>
              <SelectItem key="inactive">Inactive</SelectItem>
              <SelectItem key="on_leave">On Leave</SelectItem>
              <SelectItem key="terminated">Terminated</SelectItem>
            </Select>
            <Button variant="flat" onPress={() => setShowColumns(true)}>Columns</Button>
            <Button color="primary" onPress={openCreate}>+ Add Employee</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="employees" className="overflow-x-auto">
            <TableHeader>
              <TableColumn className={visibleColumns.has('idNo') ? '' : 'hidden'}>ID NO.</TableColumn>
              <TableColumn className={visibleColumns.has('staffNo') ? '' : 'hidden'}>STAFF NO.</TableColumn>
              <TableColumn className={visibleColumns.has('name') ? '' : 'hidden'}>NAME</TableColumn>
              <TableColumn className={visibleColumns.has('department') ? '' : 'hidden'}>DEPARTMENT</TableColumn>
              <TableColumn className={visibleColumns.has('position') ? '' : 'hidden'}>POSITION</TableColumn>
              <TableColumn className={visibleColumns.has('residencyClass') ? '' : 'hidden'}>RESIDENCY / CLASS</TableColumn>
              <TableColumn className={visibleColumns.has('status') ? '' : 'hidden'}>STATUS</TableColumn>
              <TableColumn className={visibleColumns.has('type') ? '' : 'hidden'}>TYPE</TableColumn>
              <TableColumn className={visibleColumns.has('secondEmployment') ? '' : 'hidden'}>SECOND EMPLOY</TableColumn>
              <TableColumn className={visibleColumns.has('basicSalary') ? '' : 'hidden'}>BASIC SALARY</TableColumn>
              <TableColumn className={visibleColumns.has('socialSecurity') ? '' : 'hidden'}>{tier1Label}</TableColumn>
              <TableColumn className={visibleColumns.has('tier2') ? '' : 'hidden'}>{tier2Label}</TableColumn>
              <TableColumn className={visibleColumns.has('tier3') ? '' : 'hidden'}>{tier3Label}</TableColumn>
              <TableColumn className={visibleColumns.has('allowances') ? '' : 'hidden'}>ALLOWANCES</TableColumn>
              <TableColumn className={visibleColumns.has('vehicleBenefit') ? '' : 'hidden'}>VEHICLE BENEFIT</TableColumn>
              <TableColumn className={visibleColumns.has('housingBenefit') ? '' : 'hidden'}>HOUSING BENEFIT</TableColumn>
              <TableColumn className={visibleColumns.has('otherNonCash') ? '' : 'hidden'}>OTHER NON-CASH BENEFITS</TableColumn>
              <TableColumn className={visibleColumns.has('incomeTax') ? '' : 'hidden'}>INCOME TAX</TableColumn>
              <TableColumn className={visibleColumns.has('actions') ? '' : 'hidden'}>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const dept = getDepartment(e.departmentId);
                const pos = getPosition(e.positionId);
                const salary = (e as any).salary ?? (e as any).baseSalary ?? 0;
                const basicSalary = (e as any).basicSalary ?? salary;
                const allowances = (e as any).allowances ?? 0;
                const grossPay = basicSalary + allowances;
                
                // Get latest payroll record for this employee to fetch actual deductions
                const latestPayrollRecord = payrollRecords
                  .filter(r => r.employeeId === e.id && r.status === 'paid')
                  .sort((a, b) => (b.paidAt?.getTime() || 0) - (a.paidAt?.getTime() || 0))[0];
                
                // Calculate or fetch deduction amounts
                const fmtCurrency = (n: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(n || 0);

                // Tier 1's base is basic salary only (allowances/bonus/overtime excluded),
                // so the pre-run estimate uses basicSalary and the live employee rate from
                // Settings → Tax Rate Builder rather than a hardcoded percentage. Computed
                // before the income tax estimate below, which needs it (Tier 1 is pre-tax).
                const ssnitEnrolled = (e as any).ssnitEnrolled === true;
                const ssnitAmount = latestPayrollRecord?.deductions?.socialSecurity || 0;
                const ssnitDisplayAmount = ssnitEnrolled
                  ? (ssnitAmount > 0 ? ssnitAmount : (basicSalary * ((tier1Rule?.rate ?? 5.5) / 100)))
                  : 0;

                // Income tax (PAYE) estimate: same "use the real live rule, not a guessed flat
                // rate" standard as the SSNIT/Tier2 estimates -- previously a flat 10% of gross
                // regardless of income level. Runs the same live PAYE rule through the same
                // compliance engine used everywhere else, on taxable pay net of the pre-tax
                // Tier 1 contribution.
                const incomeTaxEnrolled = (e as any).payeEnrolled !== false;
                const incomeTaxAmount = latestPayrollRecord?.deductions?.tax || 0;
                const payeTaxableEstimate = Math.max(0, grossPay - ssnitDisplayAmount);
                const payeEstimate = useComplianceStore
                  .getState()
                  .calculateTax(payeTaxableEstimate, 'PAYE', { domain: 'payroll', operation: 'internal' })
                  .taxes.reduce((s, t) => s + t.amount, 0);
                const incomeTaxDisplayAmount = incomeTaxEnrolled
                  ? (incomeTaxAmount > 0 ? incomeTaxAmount : payeEstimate)
                  : 0;

                // Tier 2 is its own separate, fully-employer-funded rule (0% employee rate
                // by default) — deductions.pension carries the real amount from the payroll
                // engine once a record exists (see PayrollBuilderPanel.tsx).
                const tier2Enrolled = (e as any).tier2Enrolled === true;
                const tier2Amount = latestPayrollRecord?.deductions?.pension || 0;
                const tier2DisplayAmount = tier2Enrolled
                  ? (tier2Amount > 0 ? tier2Amount : (basicSalary * ((tier2Rule?.rate ?? 0) / 100)))
                  : 0;

                // Tier 3 — a real, employee-elected voluntary deduction. Before any payroll
                // run exists there's no historical record, so estimate from the employee's
                // own configured contribution rate instead of guessing a flat percentage.
                const tier3Enrolled = (e as any).tier3Enrolled === true;
                const tier3Pct = Number((e as any).tier3ContributionPct || 0);
                const tier3DisplayAmount = tier3Enrolled ? grossPay * (tier3Pct / 100) : 0;
                
                return (
                  <TableRow key={e.id}>
                    <TableCell className={visibleColumns.has('idNo') ? '' : 'hidden'}>{(e as any).governmentIds?.nationalId || '-'}</TableCell>
                    <TableCell className={visibleColumns.has('staffNo') ? '' : 'hidden'}>{e.employeeNumber}</TableCell>
                    <TableCell className={visibleColumns.has('name') ? '' : 'hidden'}>{e.firstName} {e.lastName}</TableCell>
                    <TableCell className={visibleColumns.has('department') ? '' : 'hidden'}>{dept?.name || '-'}</TableCell>
                    <TableCell className={visibleColumns.has('position') ? '' : 'hidden'}>{pos?.title || '-'}</TableCell>
                    <TableCell className={visibleColumns.has('residencyClass') ? '' : 'hidden'}>{((e as any).residencyStatus || 'resident').replace('_', ' ')} / {((e as any).employmentClass || 'regular').replace('_', ' ')}</TableCell>
                    <TableCell className={visibleColumns.has('status') ? '' : 'hidden'}><Chip size="sm" variant="flat" color={e.status === 'active' ? 'success' : e.status === 'on_leave' ? 'warning' : 'default'}>{e.status}</Chip></TableCell>
                    <TableCell className={visibleColumns.has('type') ? '' : 'hidden'}>{e.employmentType}</TableCell>
                    <TableCell className={visibleColumns.has('secondEmployment') ? '' : 'hidden'}>{(e as any).secondEmployment ? 'Y' : 'N'}</TableCell>
                    <TableCell className={visibleColumns.has('basicSalary') ? '' : 'hidden'}>{(e as any).basicSalary ?? salary}</TableCell>
                    <TableCell className={visibleColumns.has('socialSecurity') ? '' : 'hidden'}>{fmtCurrency(ssnitDisplayAmount)}</TableCell>
                    <TableCell className={visibleColumns.has('tier2') ? '' : 'hidden'}>{fmtCurrency(tier2DisplayAmount)}</TableCell>
                    <TableCell className={visibleColumns.has('tier3') ? '' : 'hidden'}>{fmtCurrency(tier3DisplayAmount)}</TableCell>
                    <TableCell className={visibleColumns.has('allowances') ? '' : 'hidden'}>{(e as any).allowances ?? 0}</TableCell>
                    <TableCell className={visibleColumns.has('vehicleBenefit') ? '' : 'hidden'}>{fmtCurrency((e as any).vehicleBenefit ?? 0)}</TableCell>
                    <TableCell className={visibleColumns.has('housingBenefit') ? '' : 'hidden'}>{fmtCurrency((e as any).housingBenefit ?? 0)}</TableCell>
                    <TableCell className={visibleColumns.has('otherNonCash') ? '' : 'hidden'}>{fmtCurrency((e as any).otherNonCashBenefits ?? 0)}</TableCell>
                    <TableCell className={visibleColumns.has('incomeTax') ? '' : 'hidden'}>{fmtCurrency(incomeTaxDisplayAmount)}</TableCell>
                    <TableCell className={visibleColumns.has('actions') ? '' : 'hidden'}>
                      <Button size="sm" variant="flat" onPress={() => openEdit(e.id)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Column visibility modal */}
      <Modal isOpen={showColumns} onOpenChange={setShowColumns} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Show / Hide Columns</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    { key: 'idNo', label: 'ID No.' },
                    { key: 'staffNo', label: 'Staff No.' },
                    { key: 'name', label: 'Name' },
                    { key: 'department', label: 'Department' },
                    { key: 'position', label: 'Position' },
                    { key: 'residencyClass', label: 'Residency / Class' },
                    { key: 'status', label: 'Status' },
                    { key: 'type', label: 'Type' },
                    { key: 'secondEmployment', label: 'Second Employ' },
                    { key: 'basicSalary', label: 'Basic Salary' },
                    { key: 'socialSecurity', label: 'Social Security' },
                    { key: 'tier2', label: 'Tier 2' },
                    { key: 'tier3', label: 'Tier 3' },
                    { key: 'allowances', label: 'Allowances' },
                    { key: 'vehicleBenefit', label: 'Vehicle Benefit' },
                    { key: 'housingBenefit', label: 'Housing Benefit' },
                    { key: 'otherNonCash', label: 'Other Non-Cash Benefits' },
                    { key: 'incomeTax', label: 'Income Tax' },
                    { key: 'actions', label: 'Actions' },
                  ].map(col => (
                    <Checkbox
                      key={col.key}
                      isSelected={visibleColumns.has(col.key)}
                      onValueChange={(checked) => toggleColumn(col.key, checked)}
                    >
                      {col.label}
                    </Checkbox>
                  ))}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setShowColumns(false)}>Close</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen} size="5xl" scrollBehavior="inside">
        <ModalContent className="max-w-6xl w-full max-h-[90vh]">
          {() => (
            <>
              <ModalHeader>{isEditing ? 'Edit Employee' : 'Add Employee'}</ModalHeader>
              <ModalBody className="overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-3">
                  {/* Stepper */}
                  <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-4 text-sm">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className={`px-3 md:px-4 py-2 rounded-md transition-all duration-200 font-medium cursor-pointer ${
                        step === 1
                          ? 'bg-ghana-gold text-black shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      1. Basic Info
                    </button>
                    <div className="hidden md:block text-gray-400">→</div>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className={`px-3 md:px-4 py-2 rounded-md transition-all duration-200 font-medium cursor-pointer ${
                        step === 2
                          ? 'bg-ghana-gold text-black shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      2. Employment
                    </button>
                    <div className="hidden md:block text-gray-400">→</div>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className={`px-3 md:px-4 py-2 rounded-md transition-all duration-200 font-medium cursor-pointer ${
                        step === 3
                          ? 'bg-ghana-gold text-black shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      3. Docs & Compliance
                    </button>
                  </div>

                  {step === 1 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Personal Info</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input label="Staff No." value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} variant="bordered" />
                      <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} variant="bordered" />
                      <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} variant="bordered" />
                      <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} variant="bordered" />
                      <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} variant="bordered" />
                      <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} variant="bordered" />
                      <Select label="Gender" selectedKeys={[form.gender || 'unspecified']} onSelectionChange={(k) => setForm({ ...form, gender: (Array.from(k)[0] as string) === 'unspecified' ? '' : (Array.from(k)[0] as string) })} variant="bordered">
                        <SelectItem key="unspecified">Unspecified</SelectItem>
                        <SelectItem key="male">Male</SelectItem>
                        <SelectItem key="female">Female</SelectItem>
                        <SelectItem key="other">Other</SelectItem>
                      </Select>
                      <Input label="Nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} variant="bordered" />
                      <Select label="Marital Status" selectedKeys={[form.maritalStatus || 'unspecified']} onSelectionChange={(k) => setForm({ ...form, maritalStatus: (Array.from(k)[0] as string) === 'unspecified' ? '' : (Array.from(k)[0] as string) })} variant="bordered">
                        <SelectItem key="unspecified">Unspecified</SelectItem>
                        <SelectItem key="single">Single</SelectItem>
                        <SelectItem key="married">Married</SelectItem>
                        <SelectItem key="divorced">Divorced</SelectItem>
                        <SelectItem key="widowed">Widowed</SelectItem>
                      </Select>
                    </div>
                  </div>
                  )}

                  {step === 1 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Passport Photo</div>
                    <div className="flex flex-col md:flex-row items-start gap-4">
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const result = event.target?.result as string;
                                setForm({ ...form, photo: result });
                                console.log('[HR][Employee] Photo uploaded successfully');
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          variant="bordered"
                        />
                        <div className="text-xs text-gray-500 mt-1">Recommended: 2x2 inches (passport size), JPG or PNG</div>
                      </div>
                      {form.photo && (
                        <div className="flex-shrink-0">
                          <div className="w-24 h-24 border-2 border-gray-300 rounded-lg overflow-hidden">
                            <img src={form.photo} alt="Passport Photo" className="w-full h-full object-cover" />
                          </div>
                          <Button
                            size="sm"
                            variant="flat"
                            color="danger"
                            className="mt-2 w-full"
                            onPress={() => {
                              setForm({ ...form, photo: null });
                              console.log('[HR][Employee] Photo removed');
                            }}
                          >
                            Remove Photo
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {step === 2 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Employment</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input label="Hire Date" type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} variant="bordered" />
                      <Select label="Department" selectedKeys={[form.departmentId]} onSelectionChange={(k) => setForm({ ...form, departmentId: Array.from(k)[0] as string })} variant="bordered">
                        {departments.map((d) => <SelectItem key={d.id}>{d.name}</SelectItem>)}
                      </Select>
                      <Select label="Position" selectedKeys={[form.positionId]} onSelectionChange={(k) => setForm({ ...form, positionId: Array.from(k)[0] as string })} variant="bordered">
                        {positions.filter((p) => p.departmentId === form.departmentId).map((p) => <SelectItem key={p.id}>{p.title}</SelectItem>)}
                      </Select>
                      <Select
                        label="Manager"
                        selectedKeys={[form.managerId || 'none']}
                        onSelectionChange={(k) => setForm({ ...form, managerId: (Array.from(k)[0] as string) === 'none' ? '' : (Array.from(k)[0] as string) })}
                        variant="bordered"
                        items={[{ id: 'none', label: 'None' }, ...employees.map((e) => ({ id: e.id, label: `${e.firstName} ${e.lastName}` }))]}
                      >
                        {(item: any) => <SelectItem key={item.id}>{item.label}</SelectItem>}
                      </Select>
                      <Input label="Work Location" value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })} variant="bordered" />
                      <Select label="Status" selectedKeys={[form.status]} onSelectionChange={(k) => setForm({ ...form, status: Array.from(k)[0] as string })} variant="bordered">
                        <SelectItem key="active">Active</SelectItem>
                        <SelectItem key="inactive">Inactive</SelectItem>
                        <SelectItem key="on_leave">On Leave</SelectItem>
                        <SelectItem key="terminated">Terminated</SelectItem>
                      </Select>
                      <Select label="Employment Type" selectedKeys={[form.employmentType]} onSelectionChange={(k) => setForm({ ...form, employmentType: Array.from(k)[0] as string })} variant="bordered">
                        <SelectItem key="full_time">Full Time</SelectItem>
                        <SelectItem key="part_time">Part Time</SelectItem>
                        <SelectItem key="contract">Contract</SelectItem>
                        <SelectItem key="temporary">Temporary</SelectItem>
                        <SelectItem key="intern">Intern</SelectItem>
                      </Select>
                      <Select label="Residency Status" selectedKeys={[form.residencyStatus]} onSelectionChange={(k) => setForm({ ...form, residencyStatus: Array.from(k)[0] as string })} variant="bordered">
                        <SelectItem key="resident">Resident</SelectItem>
                        <SelectItem key="non_resident">Non Resident</SelectItem>
                      </Select>
                      <Select label="Employment Class" selectedKeys={[form.employmentClass]} onSelectionChange={(k) => setForm({ ...form, employmentClass: Array.from(k)[0] as string })} variant="bordered">
                        <SelectItem key="regular">Regular</SelectItem>
                        <SelectItem key="part_time">Part-time</SelectItem>
                        <SelectItem key="casual">Casual</SelectItem>
                      </Select>
                      <Select label="Secondary Employment" selectedKeys={[form.secondEmployment]} onSelectionChange={(k) => setForm({ ...form, secondEmployment: Array.from(k)[0] as string })} variant="bordered">
                        <SelectItem key="no">No</SelectItem>
                        <SelectItem key="yes">Yes</SelectItem>
                      </Select>
                      <Select label="Income Tax (PAYE/Withholding)" selectedKeys={[form.payeEnrolled]} onSelectionChange={(k) => setForm({ ...form, payeEnrolled: Array.from(k)[0] as string })} variant="bordered">
                        <SelectItem key="yes">Yes</SelectItem>
                        <SelectItem key="no">No</SelectItem>
                      </Select>
                      <Select label="Social Security (Tier 1)" selectedKeys={[form.ssnitEnrolled]} onSelectionChange={(k) => setForm({ ...form, ssnitEnrolled: Array.from(k)[0] as string })} variant="bordered">
                        <SelectItem key="yes">Yes</SelectItem>
                        <SelectItem key="no">No</SelectItem>
                      </Select>
                      <Select label="Tier 2 Pension" selectedKeys={[form.tier2Enrolled]} onSelectionChange={(k) => setForm({ ...form, tier2Enrolled: Array.from(k)[0] as string })} variant="bordered">
                        <SelectItem key="yes">Yes</SelectItem>
                        <SelectItem key="no">No</SelectItem>
                      </Select>
                      <Select label="Third Tier Pension" selectedKeys={[form.tier3Enrolled]} onSelectionChange={(k) => setForm({ ...form, tier3Enrolled: Array.from(k)[0] as string })} variant="bordered">
                        <SelectItem key="no">No</SelectItem>
                        <SelectItem key="yes">Yes</SelectItem>
                      </Select>
                      {form.tier3Enrolled === 'yes' && (
                        <Input
                          type="number"
                          label="Tier 3 Contribution (% of gross)"
                          value={String(form.tier3ContributionPct ?? 0)}
                          onValueChange={(v) => setForm({ ...form, tier3ContributionPct: Number(v || 0) })}
                          variant="bordered"
                          description="Voluntary — tax-relieved up to the statutory cap"
                        />
                      )}
                    </div>
                  </div>
                  )}

                  {step === 2 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Compensation</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Select label="Compensation Type" selectedKeys={[form.compensationType]} onSelectionChange={(k) => setForm({ ...form, compensationType: Array.from(k)[0] as string })} variant="bordered">
                        <SelectItem key="monthly">Monthly</SelectItem>
                        <SelectItem key="hourly">Hourly</SelectItem>
                      </Select>
                      {form.compensationType === 'monthly' && (
                        <>
                          <Input label="Basic Salary" type="number" value={String(form.basicSalary)} onChange={(e) => setForm({ ...form, basicSalary: parseFloat(e.target.value || '0') })} variant="bordered" />
                          <Input label="Allowances" type="number" value={String(form.allowances)} onChange={(e) => setForm({ ...form, allowances: parseFloat(e.target.value || '0') })} variant="bordered" />
                        </>
                      )}
                      {form.compensationType === 'hourly' && (
                        <>
                          <Input label="Hourly Rate" type="number" value={String(form.hourlyRate)} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} variant="bordered" />
                          <Input label="Overtime Rate" type="number" value={String(form.overtimeRate)} onChange={(e) => setForm({ ...form, overtimeRate: e.target.value })} variant="bordered" />
                        </>
                      )}
                      <Select label="Payment Frequency" selectedKeys={[form.paymentFrequency]} onSelectionChange={(k) => setForm({ ...form, paymentFrequency: Array.from(k)[0] as string })} variant="bordered">
                        <SelectItem key="monthly">Monthly</SelectItem>
                        <SelectItem key="biweekly">Biweekly</SelectItem>
                        <SelectItem key="weekly">Weekly</SelectItem>
                      </Select>
                    </div>
				<div className="mt-4">
					<div className="text-sm font-medium mb-2">Other Benefits</div>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						<Input label="Vehicle Benefit" type="number" value={String(form.vehicleBenefit)} onChange={(e) => setForm({ ...form, vehicleBenefit: parseFloat(e.target.value || '0') })} variant="bordered" />
						<Input label="Housing Benefit" type="number" value={String(form.housingBenefit)} onChange={(e) => setForm({ ...form, housingBenefit: parseFloat(e.target.value || '0') })} variant="bordered" />
						<Input label="Other Non-Cash Benefits" type="number" value={String(form.otherNonCashBenefits)} onChange={(e) => setForm({ ...form, otherNonCashBenefits: parseFloat(e.target.value || '0') })} variant="bordered" />
					</div>
				</div>
                  </div>
                  )}

                  {step === 2 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Bank Account</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input label="Account Number" value={form.bankAccount.accountNumber} onChange={(e) => setForm({ ...form, bankAccount: { ...form.bankAccount, accountNumber: e.target.value } })} variant="bordered" />
                      <Input label="Bank Name" value={form.bankAccount.bankName} onChange={(e) => setForm({ ...form, bankAccount: { ...form.bankAccount, bankName: e.target.value } })} variant="bordered" />
                      <Input label="Branch Code" value={form.bankAccount.branchCode} onChange={(e) => setForm({ ...form, bankAccount: { ...form.bankAccount, branchCode: e.target.value } })} variant="bordered" />
                    </div>
                  </div>
                  )}

                  {step === 1 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Emergency Contact</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Input label="Name" value={form.emergencyContact.name} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value } })} variant="bordered" />
                      <Input label="Relationship" value={form.emergencyContact.relationship} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, relationship: e.target.value } })} variant="bordered" />
                      <Input label="Phone" value={form.emergencyContact.phone} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: e.target.value } })} variant="bordered" />
                      <Input label="Email" value={form.emergencyContact.email} onChange={(e) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, email: e.target.value } })} variant="bordered" />
                    </div>
                  </div>
                  )}

                  {step === 1 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Address</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Input label="Street" value={form.address.street} onChange={(e) => setForm({ ...form, address: { ...form.address, street: e.target.value } })} variant="bordered" />
                      <Input label="City" value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} variant="bordered" />
                      <Input label="State/Region" value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} variant="bordered" />
                      <Input label="Postal Code" value={form.address.postalCode} onChange={(e) => setForm({ ...form, address: { ...form.address, postalCode: e.target.value } })} variant="bordered" />
                      <Input label="Country" value={form.address.country} onChange={(e) => setForm({ ...form, address: { ...form.address, country: e.target.value } })} variant="bordered" />
                    </div>
                  </div>
                  )}

                  {step === 3 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Tax & IDs</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Input label="TIN" value={form.taxWithholding.tin} onChange={(e) => setForm({ ...form, taxWithholding: { ...form.taxWithholding, tin: e.target.value } })} variant="bordered" />
                      <Select label="Filing Status" selectedKeys={[form.taxWithholding.filingStatus]} onSelectionChange={(k) => setForm({ ...form, taxWithholding: { ...form.taxWithholding, filingStatus: Array.from(k)[0] as string } })} variant="bordered">
                        <SelectItem key="single">Single</SelectItem>
                        <SelectItem key="married">Married</SelectItem>
                        <SelectItem key="head_of_household">Head of Household</SelectItem>
                      </Select>
                      <Input label="Allowances" type="number" value={String(form.taxWithholding.allowances)} onChange={(e) => setForm({ ...form, taxWithholding: { ...form.taxWithholding, allowances: parseInt(e.target.value || '0', 10) } })} variant="bordered" />
                      <Input label="National ID" value={form.governmentIds.nationalId} onChange={(e) => setForm({ ...form, governmentIds: { ...form.governmentIds, nationalId: e.target.value } })} variant="bordered" />
                      <Input label="SSN" value={form.governmentIds.ssn} onChange={(e) => setForm({ ...form, governmentIds: { ...form.governmentIds, ssn: e.target.value } })} variant="bordered" />
                      <Input label="Passport" value={form.governmentIds.passport} onChange={(e) => setForm({ ...form, governmentIds: { ...form.governmentIds, passport: e.target.value } })} variant="bordered" />
                      {form.nationality && form.nationality !== 'Ghana' && (
                        <Input label="Work Permit" value={form.governmentIds.workPermit} onChange={(e) => setForm({ ...form, governmentIds: { ...form.governmentIds, workPermit: e.target.value } })} variant="bordered" />
                      )}
                      <Input label="SSNIT Number" value={form.ssnitNumber} onChange={(e) => setForm({ ...form, ssnitNumber: e.target.value })} variant="bordered" description="Required to actually file a SSNIT return" />
                      <Input label="Ghana Card Number" value={form.ghanaCardNumber} onChange={(e) => setForm({ ...form, ghanaCardNumber: e.target.value })} variant="bordered" placeholder="GHA-XXXXXXXXX-X" />
                      {form.employmentType === 'contract' && (
                        <Input label="Contract End Date" type="date" value={form.contractEndDate} onChange={(e) => setForm({ ...form, contractEndDate: e.target.value })} variant="bordered" />
                      )}
                      {form.nationality && form.nationality !== 'Ghana' && (
                        <Input label="Work Permit Expiry" type="date" value={form.workPermitExpiryDate} onChange={(e) => setForm({ ...form, workPermitExpiryDate: e.target.value })} variant="bordered" />
                      )}
                    </div>
                  </div>
                  )}

                  {step === 3 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Next of Kin</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Input label="Name" value={form.nextOfKin.name} onChange={(e) => setForm({ ...form, nextOfKin: { ...form.nextOfKin, name: e.target.value } })} variant="bordered" />
                      <Input label="Relationship" value={form.nextOfKin.relationship} onChange={(e) => setForm({ ...form, nextOfKin: { ...form.nextOfKin, relationship: e.target.value } })} variant="bordered" />
                      <Input label="Phone" value={form.nextOfKin.phone} onChange={(e) => setForm({ ...form, nextOfKin: { ...form.nextOfKin, phone: e.target.value } })} variant="bordered" />
                      <Input label="Address" value={form.nextOfKin.address} onChange={(e) => setForm({ ...form, nextOfKin: { ...form.nextOfKin, address: e.target.value } })} variant="bordered" />
                    </div>
                  </div>
                  )}

                  {step === 3 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Probation</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input label="Start Date" type="date" value={form.probation.startDate} onChange={(e) => setForm({ ...form, probation: { ...form.probation, startDate: e.target.value } })} variant="bordered" />
                      <Input label="End Date" type="date" value={form.probation.endDate} onChange={(e) => setForm({ ...form, probation: { ...form.probation, endDate: e.target.value } })} variant="bordered" />
                      <Select label="Status" selectedKeys={[form.probation.status]} onSelectionChange={(k) => setForm({ ...form, probation: { ...form.probation, status: Array.from(k)[0] as string } })} variant="bordered">
                        <SelectItem key="active">Active</SelectItem>
                        <SelectItem key="confirmed">Confirmed</SelectItem>
                        <SelectItem key="extended">Extended</SelectItem>
                        <SelectItem key="failed">Failed</SelectItem>
                      </Select>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Leave dates blank if the employee isn't on probation.</div>
                  </div>
                  )}

                  {step === 3 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Documents & Qualifications</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input label="Upload Documents" type="file" multiple onChange={(e) => {
                        const files = Array.from((e.target as HTMLInputElement).files || []).map((f) => f.name);
                        setForm({ ...form, documents: [...(form.documents || []), ...files] });
                      }} variant="bordered" />
                      <Textarea label="Qualifications (free text)" value={(form.qualificationsText || '') as any} onChange={(e) => setForm({ ...form, qualificationsText: (e.target as any).value })} variant="bordered" minRows={2} />
                    </div>
                    {(form.documents || []).length > 0 && (
                      <div className="text-xs text-gray-600">Files: {(form.documents || []).join(', ')}</div>
                    )}
                  </div>
                  )}

                  {step === 3 && isEditing && editingId && (() => {
                    const empEnrollments = trainingEnrollments.filter((r) => r.employeeId === editingId);
                    const totalCost = empEnrollments.reduce((sum, r) => sum + (r.cost || 0), 0);
                    const completed = empEnrollments.filter((r) => r.status === 'completed').length;
                    const inProgress = empEnrollments.filter((r) => r.status === 'in_progress' || r.status === 'enrolled').length;
                    const mandatoryProgramIds = new Set(trainingPrograms.filter((p) => p.mandatory).map((p) => p.id));
                    const completedProgramIds = new Set(empEnrollments.filter((r) => r.status === 'completed').map((r) => r.trainingProgramId));
                    const outstandingMandatory = trainingPrograms.filter((p) => mandatoryProgramIds.has(p.id) && !completedProgramIds.has(p.id));
                    return (
                      <div>
                        <div className="text-sm font-medium mb-2">Training & Development</div>
                        <div className="flex gap-4 mb-3 text-sm">
                          <div>Total training cost: <span className="font-semibold">{totalCost.toFixed(2)}</span></div>
                          <div>Completed: <span className="font-semibold">{completed}</span></div>
                          <div>In progress: <span className="font-semibold">{inProgress}</span></div>
                        </div>
                        {outstandingMandatory.length > 0 && (
                          <div className="text-xs text-red-600 mb-2">
                            ⚠ Mandatory training not yet completed: {outstandingMandatory.map((p) => p.title).join(', ')}
                          </div>
                        )}
                        {empEnrollments.length > 0 ? (
                          <div className="space-y-1 text-xs text-gray-700">
                            {empEnrollments.map((r) => {
                              const program = trainingPrograms.find((p) => p.id === r.trainingProgramId);
                              return (
                                <div key={r.id} className="flex justify-between border-b border-gray-100 py-1">
                                  <span>{program?.title || r.trainingProgramId}{program?.mandatory ? ' (mandatory)' : ''}</span>
                                  <span className="capitalize">{r.status}</span>
                                  <span>{(r.cost || 0).toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">No training records for this employee.</div>
                        )}
                      </div>
                    );
                  })()}

                  {step === 3 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Notes</div>
                    <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: (e.target as any).value })} variant="bordered" minRows={2} />
                  </div>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <div className="flex items-center gap-2 w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="flat" onPress={() => setIsOpen(false)}>Cancel</Button>
                    <Button variant="flat" color="secondary" onPress={downloadPDF}>
                      📄 Download PDF
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {step > 1 && <Button variant="flat" onPress={() => setStep(step - 1)}>Back</Button>}
                    {step < 3 && <Button color="primary" variant="flat" onPress={() => setStep(step + 1)}>Next</Button>}
                    {step === 3 && (
                      <Button 
                        color="primary" 
                        onPress={() => {
                          console.log('[HR][Records] Create/Save button clicked', { 
                            step, 
                            isEditing, 
                            form: {
                              employeeNumber: form.employeeNumber,
                              firstName: form.firstName,
                              lastName: form.lastName,
                              email: form.email,
                              departmentId: form.departmentId,
                              positionId: form.positionId,
                              hireDate: form.hireDate
                            }
                          });
                          save();
                        }}
                      >
                        {isEditing ? 'Save Changes' : 'Create'}
                      </Button>
                    )}
                  </div>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}


