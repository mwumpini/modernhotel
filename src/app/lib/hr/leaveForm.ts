import type { LeaveRequest } from './models';
import { useEmployeeStore } from './employeeStore';
import { useLeaveAttendanceStore } from './leaveAttendanceStore';
import { useSettingsStore } from '../settings/store';
import { buildOrgProfile } from '../print/buildOrgProfile';
import { openHtmlPrintWindow } from '../print/engine';
import type { PrintOrgInfo } from '../print/templates';
import { addDays, dayKey } from './leaveDates';

/** One layout, two outputs: the same model is rendered as HTML for printing and as a PDF for
 * download, so the two can never drift apart. */
type Field = { label: string; value: string; wide?: boolean; tall?: boolean };
interface FormModel {
  org: PrintOrgInfo;
  ref: string;
  applicant: string;
  startKey: string;
  sections: Array<{ title: string; fields: Field[] }>;
  signatures: Array<{ role: string; name: string }>;
  footer: string;
}

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function buildModel(request: LeaveRequest, printedBy: string): FormModel {
  const emp = useEmployeeStore.getState();
  const employee = emp.employees.find((e) => e.id === request.employeeId);
  const cover = request.coveringEmployeeId ? emp.employees.find((e) => e.id === request.coveringEmployeeId) : undefined;
  const nameOf = (e?: { firstName: string; lastName: string }) => (e ? `${e.firstName} ${e.lastName}` : '');
  const roleLine = (e?: { departmentId: string; positionId: string }) =>
    e ? [emp.getPosition(e.positionId)?.title, emp.getDepartment(e.departmentId)?.name].filter(Boolean).join(', ') : '';

  const balance = useLeaveAttendanceStore.getState().getLeaveBalance(request.employeeId, request.leaveType, new Date(request.startDate).getUTCFullYear());
  const startKey = dayKey(request.startDate);
  const decided = request.status === 'approved' || request.status === 'rejected';

  return {
    org: buildOrgProfile(useSettingsStore.getState()),
    ref: `LV-${request.id.replace(/^lr_/, '').slice(-8)}`,
    applicant: nameOf(employee) || request.employeeId,
    startKey,
    sections: [
      {
        title: 'Applicant',
        fields: [
          { label: 'Name', value: nameOf(employee) || request.employeeId },
          { label: 'Staff No.', value: employee?.employeeNumber || '' },
          { label: 'Department', value: emp.getDepartment(employee?.departmentId || '')?.name || '' },
          { label: 'Position', value: emp.getPosition(employee?.positionId || '')?.title || '' },
          { label: 'Date employed', value: employee?.hireDate ? fmtDate(employee.hireDate) : '' },
        ],
      },
      {
        title: 'Leave requested',
        fields: [
          { label: 'Type of leave', value: `${cap(request.leaveType)} leave` },
          { label: 'Days requested', value: String(request.totalDays) },
          { label: 'From', value: fmtDate(request.startDate) },
          { label: 'To', value: fmtDate(request.endDate) },
          { label: 'Resumes work on', value: fmtDate(addDays(dayKey(request.endDate), 1)) },
          { label: 'Balance', value: balance.entitlement > 0 ? `${balance.remaining} of ${balance.entitlement} days left (${balance.used} taken)` : 'Not applicable' },
          { label: 'Reason', value: request.reason || '', wide: true, tall: true },
        ],
      },
      {
        title: 'Interim cover (relief officer)',
        fields: [
          { label: 'Covering staff', value: nameOf(cover) || 'None arranged' },
          { label: 'Position', value: roleLine(cover) },
          { label: 'Handover notes', value: request.handoverNotes || '', wide: true, tall: true },
        ],
      },
      {
        title: 'Decision',
        fields: [
          { label: 'Status', value: cap(request.status) },
          { label: decided ? `${cap(request.status)} by` : 'Decided by', value: decided ? request.approvedBy || '' : '' },
          { label: 'Date', value: decided && request.approvedAt ? fmtDate(request.approvedAt) : '' },
          ...(request.status === 'rejected' && request.rejectionReason ? [{ label: 'Reason', value: request.rejectionReason }] : []),
        ],
      },
    ],
    signatures: [
      { role: 'Applicant', name: nameOf(employee) },
      { role: 'Relief officer (accepts handover)', name: nameOf(cover) },
      { role: 'Head of Department', name: '' },
      { role: 'HR Manager / General Manager', name: decided ? request.approvedBy || '' : '' },
    ],
    footer: `Printed ${new Date().toLocaleString('en-GB')} by ${printedBy}`,
  };
}

/** Two fields per row; a wide field takes the whole row. */
function pairFields(fields: Field[]): Field[][] {
  const rows: Field[][] = [];
  let pending: Field | null = null;
  for (const f of fields) {
    if (f.wide) {
      if (pending) { rows.push([pending]); pending = null; }
      rows.push([f]);
    } else if (pending) {
      rows.push([pending, f]);
      pending = null;
    } else {
      pending = f;
    }
  }
  if (pending) rows.push([pending]);
  return rows;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderHtml(m: FormModel): string {
  const contact = [m.org.address, m.org.phone, m.org.email].filter(Boolean).join('  |  ');
  const sections = m.sections.map((s) => `
    <h3>${esc(s.title)}</h3>
    <table class="grid">
      <colgroup><col style="width:17%"><col style="width:33%"><col style="width:17%"><col style="width:33%"></colgroup>
      ${pairFields(s.fields).map((row) => row.length === 1 && row[0].wide
        ? `<tr><td class="l">${esc(row[0].label)}</td><td colspan="3" class="${row[0].tall ? 'tall' : ''}">${esc(row[0].value)}</td></tr>`
        : `<tr>${row.map((f) => `<td class="l">${esc(f.label)}</td><td>${esc(f.value)}</td>`).join('')}${row.length === 1 ? '<td class="l"></td><td></td>' : ''}</tr>`).join('')}
    </table>`).join('');
  const signatures = `
    <h3>Signatures</h3>
    <table class="grid sig">
      <colgroup><col style="width:30%"><col style="width:26%"><col style="width:28%"><col style="width:16%"></colgroup>
      <tr><th>Role</th><th>Name</th><th>Signature</th><th>Date</th></tr>
      ${m.signatures.map((r) => `<tr><td class="l">${esc(r.role)}</td><td>${esc(r.name)}</td><td></td><td></td></tr>`).join('')}
    </table>`;
  return `<html><head><title>Leave Application - ${esc(m.applicant)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; }
  h1 { font-size: 18px; margin: 0; }
  .contact { color: #555; font-size: 11px; margin: 2px 0 10px; }
  .title { text-align: center; font-size: 15px; letter-spacing: 1px; margin: 10px 0 2px; border-top: 2px solid #111; padding-top: 8px; }
  .ref { text-align: center; color: #555; font-size: 11px; margin-bottom: 6px; }
  h3 { font-size: 12px; margin: 12px 0 4px; text-transform: uppercase; }
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.grid td, table.grid th { border: 1px solid #999; padding: 6px 8px; vertical-align: top; text-align: left; }
  td.l { background: #f2f2f2; font-weight: bold; }
  td.tall { height: 56px; }
  table.sig td { height: 34px; }
  table.sig th { background: #f2f2f2; }
  .footer { margin-top: 14px; font-size: 10px; color: #777; }
</style></head><body>
  <h1>${esc(m.org.name)}</h1>
  ${contact ? `<div class="contact">${esc(contact)}</div>` : ''}
  <div class="title">LEAVE APPLICATION FORM</div>
  <div class="ref">Ref: ${esc(m.ref)}</div>
  ${sections}${signatures}
  <div class="footer">${esc(m.footer)}</div>
</body></html>`;
}

async function renderPdf(m: FormModel): Promise<Blob> {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  const doc: any = new jsPDF();
  const margin = 15;
  let y = 16;

  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  doc.text(m.org.name, margin, y);
  doc.setFont(undefined, 'normal');
  y += 5;
  const contact = [m.org.address, m.org.phone, m.org.email].filter(Boolean).join('  |  ');
  if (contact) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(contact, margin, y);
    doc.setTextColor(0);
    y += 5;
  }
  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  doc.line(margin, y, 210 - margin, y);
  y += 8;
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('LEAVE APPLICATION FORM', 105, y, { align: 'center' });
  doc.setFont(undefined, 'normal');
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Ref: ${m.ref}`, 105, y, { align: 'center' });
  doc.setTextColor(0);
  y += 3;

  const label = (content: string) => ({ content, styles: { fontStyle: 'bold', fillColor: [242, 242, 242] } });
  const lastY = () => doc.lastAutoTable.finalY;

  for (const s of m.sections) {
    y += 5;
    doc.setFontSize(9.5);
    doc.setFont(undefined, 'bold');
    doc.text(s.title.toUpperCase(), margin, y);
    doc.setFont(undefined, 'normal');
    const body = pairFields(s.fields).map((row) => {
      if (row.length === 1 && row[0].wide) {
        return [label(row[0].label), { content: row[0].value, colSpan: 3, styles: { minCellHeight: row[0].tall ? 22 : 0 } }];
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
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 58 }, 2: { cellWidth: 32 }, 3: { cellWidth: 58 } },
    });
    y = lastY();
  }

  y += 6;
  doc.setFontSize(9.5);
  doc.setFont(undefined, 'bold');
  doc.text('SIGNATURES', margin, y);
  doc.setFont(undefined, 'normal');
  (autoTable as any)(doc, {
    head: [['Role', 'Name', 'Signature', 'Date']],
    body: m.signatures.map((r) => [label(r.role), r.name, '', '']),
    startY: y + 2,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2.5, minCellHeight: 14, lineColor: [150, 150, 150], lineWidth: 0.2, textColor: 20 },
    headStyles: { fillColor: [242, 242, 242], textColor: 20, minCellHeight: 8 },
    columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 45 }, 2: { cellWidth: 55 }, 3: { cellWidth: 30 } },
  });
  y = lastY() + 8;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(m.footer, margin, y);

  return doc.output('blob');
}

export function printLeaveForm(request: LeaveRequest, printedBy: string) {
  return openHtmlPrintWindow(renderHtml(buildModel(request, printedBy)));
}

export async function downloadLeaveForm(request: LeaveRequest, printedBy: string) {
  const model = buildModel(request, printedBy);
  const url = URL.createObjectURL(await renderPdf(model));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Leave_Application_${model.applicant.replace(/\s+/g, '_')}_${model.startKey}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
