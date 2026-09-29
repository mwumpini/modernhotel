/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Employee } from './models';
import { formatGhs } from '../format/currency';

type ProfilePdfInput = {
  employee: Employee;
  departmentName?: string;
  positionTitle?: string;
  managerName?: string;
  hotelName?: string;
};

function money(n?: number | null) {
  return formatGhs(n);
}

function day(value?: Date | string | null) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function pretty(value?: string | null) {
  if (!value) return '—';
  return String(value).replace(/_/g, ' ');
}

type Field = { label: string; value: string; wide?: boolean };

function pairFields(fields: Field[]) {
  const rows: Field[][] = [];
  let i = 0;
  while (i < fields.length) {
    if (fields[i].wide) {
      rows.push([fields[i]]);
      i += 1;
    } else if (i + 1 < fields.length && !fields[i + 1].wide) {
      rows.push([fields[i], fields[i + 1]]);
      i += 2;
    } else {
      rows.push([fields[i]]);
      i += 1;
    }
  }
  return rows;
}

/** Real downloadable staff-profile PDF (jsPDF + autotable) — not window.print. */
export async function downloadEmployeeProfilePdf(input: ProfilePdfInput) {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  const doc: any = new jsPDF();
  const margin = 15;
  let y = 16;
  const e = input.employee;
  const fullName = `${e.firstName} ${e.lastName}`.trim();
  const hotel = input.hotelName || 'Hotel';

  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  doc.text(hotel, margin, y);
  doc.setFont(undefined, 'normal');
  y += 7;
  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  doc.line(margin, y, 210 - margin, y);
  y += 8;
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('STAFF PROFILE', 105, y, { align: 'center' });
  doc.setFont(undefined, 'normal');
  y += 6;
  doc.setFontSize(11);
  doc.text(fullName, 105, y, { align: 'center' });
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`${e.employeeNumber}  ·  ${pretty(e.status)}`, 105, y, { align: 'center' });
  doc.setTextColor(0);
  y += 2;

  const label = (content: string) => ({ content, styles: { fontStyle: 'bold', fillColor: [242, 242, 242] } });
  const lastY = () => doc.lastAutoTable.finalY;

  const sections: Array<{ title: string; fields: Field[] }> = [
    {
      title: 'Personal',
      fields: [
        { label: 'Email', value: e.email || '—' },
        { label: 'Phone', value: e.phone || '—' },
        { label: 'Date of birth', value: day(e.dateOfBirth) },
        { label: 'Gender', value: pretty(e.gender) },
        { label: 'Nationality', value: e.nationality || '—' },
        { label: 'Marital status', value: pretty(e.maritalStatus) },
      ],
    },
    {
      title: 'Employment',
      fields: [
        { label: 'Hire date', value: day(e.hireDate) },
        { label: 'Department', value: input.departmentName || '—' },
        { label: 'Position', value: input.positionTitle || '—' },
        { label: 'Manager', value: input.managerName || '—' },
        { label: 'Employment type', value: pretty(e.employmentType) },
        { label: 'Work location', value: e.workLocation || '—' },
        { label: 'Residency', value: pretty(e.residencyStatus) },
        { label: 'Class', value: pretty(e.employmentClass) },
        { label: 'Second employment', value: e.secondEmployment ? 'Yes' : 'No' },
        { label: 'Contract end', value: day(e.contractEndDate) },
      ],
    },
    {
      title: 'Compensation',
      fields: [
        { label: 'Type', value: pretty(e.compensationType || (e.hourlyRate ? 'hourly' : 'monthly')) },
        { label: 'Basic salary', value: money(e.basicSalary ?? e.salary) },
        { label: 'Allowances', value: money(e.allowances) },
        { label: 'Hourly rate', value: e.hourlyRate != null ? money(e.hourlyRate) : '—' },
        { label: 'Payment frequency', value: pretty(e.paymentFrequency) },
        { label: 'Vehicle benefit', value: money(e.vehicleBenefit) },
        { label: 'Housing benefit', value: money(e.housingBenefit) },
        { label: 'Other non-cash', value: money(e.otherNonCashBenefits) },
      ],
    },
    {
      title: 'IDs & compliance',
      fields: [
        { label: 'TIN', value: e.taxWithholding?.tin || '—' },
        { label: 'National ID', value: e.governmentIds?.nationalId || '—' },
        { label: 'Ghana Card', value: e.ghanaCardNumber || '—' },
        { label: 'SSNIT number', value: e.ssnitNumber || '—' },
        { label: 'SSNIT (Tier 1)', value: e.ssnitEnrolled ? 'Enrolled' : 'Not enrolled' },
        { label: 'Tier 2', value: e.tier2Enrolled ? 'Enrolled' : 'Not enrolled' },
        { label: 'Tier 3', value: e.tier3Enrolled ? `Enrolled (${e.tier3ContributionPct ?? 0}%)` : 'Not enrolled' },
        { label: 'Work permit expiry', value: day(e.workPermitExpiryDate) },
      ],
    },
    {
      title: 'Contact & bank',
      fields: [
        {
          label: 'Address',
          wide: true,
          value: [e.address?.street, e.address?.city, e.address?.state, e.address?.postalCode, e.address?.country].filter(Boolean).join(', ') || '—',
        },
        {
          label: 'Emergency contact',
          wide: true,
          value: e.emergencyContact?.name
            ? `${e.emergencyContact.name} (${pretty(e.emergencyContact.relationship)}) · ${e.emergencyContact.phone}`
            : '—',
        },
        {
          label: 'Next of kin',
          wide: true,
          value: e.nextOfKin?.name
            ? `${e.nextOfKin.name} (${pretty(e.nextOfKin.relationship)}) · ${e.nextOfKin.phone}`
            : '—',
        },
        { label: 'Bank', value: e.bankAccount?.bankName || '—' },
        { label: 'Account', value: e.bankAccount?.accountNumber || '—' },
        { label: 'Branch', value: e.bankAccount?.branchCode || '—' },
      ],
    },
  ];

  if (e.notes) {
    sections.push({ title: 'Notes', fields: [{ label: 'Notes', value: e.notes, wide: true }] });
  }

  for (const s of sections) {
    y += 6;
    if (y > 270) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(9.5);
    doc.setFont(undefined, 'bold');
    doc.text(s.title.toUpperCase(), margin, y);
    doc.setFont(undefined, 'normal');
    const body = pairFields(s.fields).map((row) => {
      if (row.length === 1 && row[0].wide) {
        return [label(row[0].label), { content: row[0].value, colSpan: 3 }];
      }
      return [
        label(row[0].label), row[0].value,
        ...(row[1] ? [label(row[1].label), row[1].value] : [label(''), '']),
      ];
    });
    (autoTable as any)(doc, {
      body,
      startY: y + 2,
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2.5, lineColor: [150, 150, 150], lineWidth: 0.2, textColor: 20 },
      columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 54 }, 2: { cellWidth: 36 }, 3: { cellWidth: 54 } },
    });
    y = lastY();
  }

  y += 8;
  if (y > 280) {
    doc.addPage();
    y = 16;
  }
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);

  const safeName = fullName.replace(/[^\w\-]+/g, '_') || 'Employee';
  doc.save(`Staff_Profile_${e.employeeNumber || safeName}.pdf`);
}
