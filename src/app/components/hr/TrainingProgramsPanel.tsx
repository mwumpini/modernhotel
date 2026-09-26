'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Checkbox, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs } from '@heroui/react';
import { useTrainingStore } from '@/app/lib/hr/trainingStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useSectionExport } from '@/app/lib/export/useSectionExport';
import { notifySuccess } from '@/app/lib/notifications/notify';
import ExportButtons from '@/app/components/ExportButtons';
import type { ExportFormat } from '@/app/lib/frontoffice/reportExportFormat';

const CATEGORIES: Record<string, string> = {
  technical: 'Technical',
  soft_skills: 'Soft Skills',
  compliance: 'Compliance',
  leadership: 'Leadership',
  safety: 'Safety',
  other: 'Other',
};
const categoryLabel = (c: string) => CATEGORIES[c] || c;

const fmtDate = (d: unknown) => {
  const date = d ? new Date(d as any) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB') : '';
};
const fmtDateRange = (start: unknown, end: unknown) => {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (!s && !e) return '—';
  return !e || s === e ? s || e : `${s} – ${e}`;
};
const fmtMoney = (n: number) => `₵${(n || 0).toFixed(2)}`;

const EMPTY_PROGRAM = { title: '', category: 'technical', duration: '', cost: '', startDate: '', endDate: '', mandatory: false };
const today = () => new Date().toISOString().slice(0, 10);

export default function TrainingProgramsPanel() {
  const programs = useTrainingStore((s) => s.programs);
  const enrollments = useTrainingStore((s) => s.enrollments);
  const addProgram = useTrainingStore((s) => s.addProgram);
  const enroll = useTrainingStore((s) => s.enroll);
  const hydrateFromApi = useTrainingStore((s) => s.hydrateFromApi);
  const employees = useEmployeeStore((s) => s.employees);
  const exportSection = useSectionExport();

  React.useEffect(() => {
    hydrateFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tab, setTab] = React.useState<string>('programs');
  const [programOpen, setProgramOpen] = React.useState(false);
  const [pForm, setPForm] = React.useState(EMPTY_PROGRAM);
  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const [eForm, setEForm] = React.useState({ programId: '', employeeIds: [] as string[], date: today() });

  const employeeName = (id: string) => {
    const emp = employees.find((x) => x.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : id;
  };

  // A dropped/failed enrollment no longer counts as staff on the programme.
  const isActive = (status: string) => status !== 'dropped' && status !== 'failed';
  const staffByProgram = React.useMemo(() => {
    const map: Record<string, { staff: number; completed: number }> = {};
    for (const e of enrollments) {
      const row = (map[e.trainingProgramId] ||= { staff: 0, completed: 0 });
      if (isActive(e.status)) row.staff += 1;
      if (e.status === 'completed') row.completed += 1;
    }
    return map;
  }, [enrollments]);

  const endBeforeStart = !!pForm.startDate && !!pForm.endDate && pForm.endDate < pForm.startDate;

  const createProgram = () => {
    if (!pForm.title.trim() || endBeforeStart) return;
    addProgram({
      title: pForm.title.trim(),
      code: '',
      description: '',
      category: pForm.category,
      duration: Number(pForm.duration || 0),
      cost: Number(pForm.cost || 0),
      maxParticipants: 0,
      instructor: '',
      location: '',
      startDate: pForm.startDate ? new Date(pForm.startDate) : new Date(),
      endDate: pForm.endDate ? new Date(pForm.endDate) : pForm.startDate ? new Date(pForm.startDate) : new Date(),
      status: 'scheduled',
      mandatory: pForm.mandatory,
      materials: [],
      objectives: [],
      prerequisites: [],
    } as any);
    notifySuccess(`${pForm.title.trim()} added`, 'Training program added');
    setPForm(EMPTY_PROGRAM);
    setProgramOpen(false);
  };

  const openEnroll = (programId = '') => {
    setEForm({ programId, employeeIds: [], date: today() });
    setEnrollOpen(true);
  };

  const doEnroll = () => {
    const program = programs.find((p) => p.id === eForm.programId);
    if (!program || eForm.employeeIds.length === 0) return;
    const already = new Set(enrollments.filter((e) => e.trainingProgramId === program.id && isActive(e.status)).map((e) => e.employeeId));
    const toEnroll = eForm.employeeIds.filter((id) => !already.has(id));
    // Cost defaults to the program's own real cost -- SalaryAnalyticsPanel sums enrollment
    // cost for "Total Training Cost" / "Training Cost by Department", so a flat 0 here would
    // silently zero those KPIs regardless of what training actually cost.
    toEnroll.forEach((employeeId) =>
      enroll({ trainingProgramId: program.id, employeeId, enrollmentDate: new Date(eForm.date), status: 'enrolled', cost: program.cost || 0 } as any),
    );
    const skipped = eForm.employeeIds.length - toEnroll.length;
    notifySuccess(
      `${toEnroll.length} staff enrolled in ${program.title}${skipped ? ` (${skipped} already enrolled)` : ''}`,
      'Enrolled',
    );
    setEnrollOpen(false);
  };

  const exportPrograms = (format: ExportFormat) =>
    exportSection(format, 'Training Programs', {
      title: 'Training Programs',
      columns: ['Program', 'Category', 'Mandatory', 'Duration (hrs)', 'Cost (GHS)', 'Start', 'End', 'Staff', 'Completed'],
      rows: programs.map((p) => [
        p.title,
        categoryLabel(p.category),
        p.mandatory ? 'Yes' : 'No',
        p.duration || 0,
        Number((p.cost || 0).toFixed(2)),
        fmtDate(p.startDate),
        fmtDate(p.endDate),
        staffByProgram[p.id]?.staff ?? 0,
        staffByProgram[p.id]?.completed ?? 0,
      ]),
    });

  const exportEnrollments = (format: ExportFormat) =>
    exportSection(format, 'Training Enrollments', {
      title: 'Training Enrollments',
      columns: ['Employee', 'Program', 'Enrolled On', 'Cost (GHS)', 'Status'],
      rows: enrollments.map((e) => [
        employeeName(e.employeeId),
        programs.find((p) => p.id === e.trainingProgramId)?.title || e.trainingProgramId,
        fmtDate(e.enrollmentDate),
        Number((e.cost || 0).toFixed(2)),
        e.status,
      ]),
    });

  const totalStaff = new Set(enrollments.filter((e) => isActive(e.status)).map((e) => e.employeeId)).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip variant="flat">{programs.length} programs</Chip>
        <Chip variant="flat" color="primary">{totalStaff} staff enrolled</Chip>
        <Chip variant="flat" color="success">{enrollments.filter((e) => e.status === 'completed').length} completed</Chip>
      </div>

      <Tabs aria-label="Training views" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
        <Tab key="programs" title="🎓 Programs">
          <Card>
            <CardHeader className="justify-between gap-2 flex-wrap">
              <div className="font-medium">Training Programs</div>
              <div className="flex items-center gap-2 flex-wrap">
                <ExportButtons onDownload={exportPrograms} />
                <Button size="sm" color="primary" onPress={() => setProgramOpen(true)}>+ Add Program</Button>
              </div>
            </CardHeader>
            <CardBody>
              <Table aria-label="programs" className="overflow-x-auto">
                <TableHeader>
                  <TableColumn>PROGRAM</TableColumn>
                  <TableColumn>CATEGORY</TableColumn>
                  <TableColumn>DURATION</TableColumn>
                  <TableColumn>COST</TableColumn>
                  <TableColumn>DATES</TableColumn>
                  <TableColumn>STAFF</TableColumn>
                  <TableColumn>COMPLETED</TableColumn>
                  <TableColumn>ACTIONS</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No training programs yet — add one to get started.">
                  {programs.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.title}</span>
                          {p.mandatory && <Chip size="sm" variant="flat" color="warning">Mandatory</Chip>}
                        </div>
                      </TableCell>
                      <TableCell>{categoryLabel(p.category)}</TableCell>
                      <TableCell>{p.duration ? `${p.duration}h` : '—'}</TableCell>
                      <TableCell>{fmtMoney(p.cost)}</TableCell>
                      <TableCell>{fmtDateRange(p.startDate, p.endDate)}</TableCell>
                      <TableCell>{staffByProgram[p.id]?.staff ?? 0}</TableCell>
                      <TableCell>{staffByProgram[p.id]?.completed ?? 0}</TableCell>
                      <TableCell><Button size="sm" variant="flat" onPress={() => openEnroll(p.id)}>Enroll staff</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </Tab>

        <Tab key="enrollments" title="👥 Enrollments">
          <Card>
            <CardHeader className="justify-between gap-2 flex-wrap">
              <div className="font-medium">Enrollments</div>
              <div className="flex items-center gap-2 flex-wrap">
                <ExportButtons onDownload={exportEnrollments} />
                <Button size="sm" color="primary" onPress={() => openEnroll()} isDisabled={programs.length === 0}>+ Enroll Staff</Button>
              </div>
            </CardHeader>
            <CardBody>
              <Table aria-label="enrollments" className="overflow-x-auto">
                <TableHeader>
                  <TableColumn>EMPLOYEE</TableColumn>
                  <TableColumn>PROGRAM</TableColumn>
                  <TableColumn>ENROLLED ON</TableColumn>
                  <TableColumn>COST</TableColumn>
                  <TableColumn>STATUS</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No staff enrolled yet.">
                  {enrollments.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{employeeName(e.employeeId)}</TableCell>
                      <TableCell>{programs.find((p) => p.id === e.trainingProgramId)?.title || e.trainingProgramId}</TableCell>
                      <TableCell>{fmtDate(e.enrollmentDate) || '—'}</TableCell>
                      <TableCell>{fmtMoney(e.cost)}</TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat" color={e.status === 'completed' ? 'success' : e.status === 'in_progress' ? 'primary' : 'default'}>{e.status}</Chip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </Tab>
      </Tabs>

      <Modal isOpen={programOpen} onOpenChange={setProgramOpen} size="2xl">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Add Training Program</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input className="md:col-span-2" label="Title" isRequired value={pForm.title} onChange={(e) => setPForm({ ...pForm, title: e.target.value })} variant="bordered" />
                  <Select label="Category" selectedKeys={[pForm.category]} onSelectionChange={(k) => setPForm({ ...pForm, category: Array.from(k)[0] as string })} variant="bordered">
                    {Object.entries(CATEGORIES).map(([key, label]) => <SelectItem key={key}>{label}</SelectItem>)}
                  </Select>
                  <Input label="Duration (hrs)" type="number" min={0} placeholder="8" value={pForm.duration} onChange={(e) => setPForm({ ...pForm, duration: e.target.value })} variant="bordered" />
                  <Input label="Cost per staff (GHS)" type="number" min={0} placeholder="0.00" value={pForm.cost} onChange={(e) => setPForm({ ...pForm, cost: e.target.value })} variant="bordered" />
                  <div />
                  <Input label="Start" type="date" value={pForm.startDate} onChange={(e) => setPForm({ ...pForm, startDate: e.target.value })} variant="bordered" />
                  <Input label="End" type="date" value={pForm.endDate} onChange={(e) => setPForm({ ...pForm, endDate: e.target.value })} variant="bordered" isInvalid={endBeforeStart} errorMessage={endBeforeStart ? 'End is before start' : undefined} />
                  <Checkbox className="md:col-span-2" isSelected={pForm.mandatory} onValueChange={(v) => setPForm({ ...pForm, mandatory: v })}>
                    Mandatory (e.g. food safety, fire safety)
                  </Checkbox>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setProgramOpen(false)}>Cancel</Button>
                <Button color="primary" onPress={createProgram} isDisabled={!pForm.title.trim() || endBeforeStart}>Add Program</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={enrollOpen} onOpenChange={setEnrollOpen} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Enroll Staff</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 gap-3">
                  <Select label="Program" selectedKeys={eForm.programId ? [eForm.programId] : []} onSelectionChange={(k) => setEForm({ ...eForm, programId: (Array.from(k)[0] as string) || '' })} variant="bordered" items={programs.map((p) => ({ id: p.id, title: p.title }))}>
                    {(item: any) => <SelectItem key={item.id} textValue={item.title}>{item.title}</SelectItem>}
                  </Select>
                  <Select label="Staff" selectionMode="multiple" selectedKeys={new Set(eForm.employeeIds)} onSelectionChange={(k) => setEForm({ ...eForm, employeeIds: Array.from(k as Set<string>) })} variant="bordered" items={employees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}>
                    {(item: any) => <SelectItem key={item.id} textValue={item.name}>{item.name}</SelectItem>}
                  </Select>
                  <Input label="Enrollment date" type="date" value={eForm.date} onChange={(e) => setEForm({ ...eForm, date: e.target.value })} variant="bordered" />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setEnrollOpen(false)}>Cancel</Button>
                <Button color="primary" onPress={doEnroll} isDisabled={!eForm.programId || eForm.employeeIds.length === 0}>
                  Enroll{eForm.employeeIds.length > 0 ? ` (${eForm.employeeIds.length})` : ''}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
