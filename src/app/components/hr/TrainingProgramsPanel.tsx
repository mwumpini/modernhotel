'use client';

import React from 'react';
import {
  Button, Card, CardBody, CardHeader, Checkbox, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
  Pagination, Select, SelectItem, Tab, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tabs,
} from '@heroui/react';
import { useTrainingStore } from '@/app/lib/hr/trainingStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useSectionExport } from '@/app/lib/export/useSectionExport';
import { notifySuccess } from '@/app/lib/notifications/notify';
import ExportButtons from '@/app/components/ExportButtons';
import type { ExportFormat } from '@/app/lib/frontoffice/reportExportFormat';
import type { TrainingProgram, TrainingRecord } from '@/app/lib/hr/models';
import { formatGhs, formatMoney } from '@/app/lib/format/currency';
import { printDetailSheet } from '@/app/lib/print/simpleReport';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailGrid, DetailField } from '../frontoffice/detailView';
import { useDeskPagination } from '../dashboard/deskTableUi';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from '../dashboard/deskTabsUi';

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

const EMPTY_PROGRAM = { title: '', category: 'technical', duration: '', cost: '', startDate: '', endDate: '', mandatory: false };
const today = () => new Date().toISOString().slice(0, 10);

type ProgramSortKey = 'title' | 'category' | 'duration' | 'cost' | 'dates' | 'staff' | 'completed';
type EnrollSortKey = 'employee' | 'program' | 'enrolled' | 'cost' | 'status';

const programColWidths: Record<ProgramSortKey, number> = {
  title: 200,
  category: 120,
  duration: 88,
  cost: 96,
  dates: 140,
  staff: 72,
  completed: 96,
};

const enrollColWidths: Record<EnrollSortKey, number> = {
  employee: 160,
  program: 180,
  enrolled: 110,
  cost: 96,
  status: 110,
};

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

  const [pQ, setPQ] = React.useState('');
  const [pCat, setPCat] = React.useState('all');
  const [pMandatory, setPMandatory] = React.useState<'all' | 'yes' | 'no'>('all');
  const [pSortKey, setPSortKey] = React.useState<ProgramSortKey>('title');
  const [pSortDir, setPSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [viewProgram, setViewProgram] = React.useState<TrainingProgram | null>(null);

  const [eQ, setEQ] = React.useState('');
  const [eProgram, setEProgram] = React.useState('all');
  const [eStatus, setEStatus] = React.useState('all');
  const [eSortKey, setESortKey] = React.useState<EnrollSortKey>('enrolled');
  const [eSortDir, setESortDir] = React.useState<'asc' | 'desc'>('desc');
  const [viewEnroll, setViewEnroll] = React.useState<TrainingRecord | null>(null);

  const programCols = useResizableColumns<ProgramSortKey>(programColWidths);
  const enrollCols = useResizableColumns<EnrollSortKey>(enrollColWidths);

  const employeeName = (id: string) => {
    const emp = employees.find((x) => x.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : id;
  };

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

  const filteredPrograms = React.useMemo(() => {
    const rows = programs.filter((p) => {
      if (pCat !== 'all' && p.category !== pCat) return false;
      if (pMandatory === 'yes' && !p.mandatory) return false;
      if (pMandatory === 'no' && p.mandatory) return false;
      if (pQ.trim() && !p.title.toLowerCase().includes(pQ.trim().toLowerCase())) return false;
      return true;
    });
    const value = (p: TrainingProgram): string | number => {
      const stats = staffByProgram[p.id];
      switch (pSortKey) {
        case 'title': return p.title.toLowerCase();
        case 'category': return categoryLabel(p.category);
        case 'duration': return Number(p.duration || 0);
        case 'cost': return Number(p.cost || 0);
        case 'dates': return new Date(p.startDate as any).getTime();
        case 'staff': return stats?.staff ?? 0;
        case 'completed': return stats?.completed ?? 0;
        default: return '';
      }
    };
    const sorted = [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return pSortDir === 'asc' ? sorted : sorted.reverse();
  }, [programs, pQ, pCat, pMandatory, pSortKey, pSortDir, staffByProgram]);

  const filteredEnrollments = React.useMemo(() => {
    const rows = enrollments.filter((e) => {
      if (eProgram !== 'all' && e.trainingProgramId !== eProgram) return false;
      if (eStatus !== 'all' && e.status !== eStatus) return false;
      if (eQ.trim()) {
        const name = employeeName(e.employeeId).toLowerCase();
        const prog = programs.find((p) => p.id === e.trainingProgramId)?.title.toLowerCase() || '';
        if (!name.includes(eQ.trim().toLowerCase()) && !prog.includes(eQ.trim().toLowerCase())) return false;
      }
      return true;
    });
    const value = (e: TrainingRecord): string | number => {
      switch (eSortKey) {
        case 'employee': return employeeName(e.employeeId).toLowerCase();
        case 'program': return (programs.find((p) => p.id === e.trainingProgramId)?.title || '').toLowerCase();
        case 'enrolled': return new Date(e.enrollmentDate as any).getTime();
        case 'cost': return Number(e.cost || 0);
        case 'status': return e.status || '';
        default: return '';
      }
    };
    const sorted = [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return eSortDir === 'asc' ? sorted : sorted.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, eQ, eProgram, eStatus, eSortKey, eSortDir, programs, employees]);

  const { page: programPage, setPage: setProgramPage, pages: programPages, paged: pagedPrograms } = useDeskPagination(filteredPrograms, [pQ, pCat, pMandatory, pSortKey, pSortDir]);
  const { page: enrollPage, setPage: setEnrollPage, pages: enrollPages, paged: pagedEnrollments } = useDeskPagination(filteredEnrollments, [eQ, eProgram, eStatus, eSortKey, eSortDir]);

  const onProgramSort = (key: ProgramSortKey) => {
    if (pSortKey === key) setPSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setPSortKey(key);
      setPSortDir('asc');
    }
  };
  const onEnrollSort = (key: EnrollSortKey) => {
    if (eSortKey === key) setESortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setESortKey(key);
      setESortDir('asc');
    }
  };

  const programColumn = (key: ProgramSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={programCols.style(key)}>
      <SortLabel active={pSortKey === key} dir={pSortDir} align={align} onPress={() => onProgramSort(key)}>{label}</SortLabel>
      {programCols.sizer(key, label)}
    </TableColumn>
  );
  const enrollColumn = (key: EnrollSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={enrollCols.style(key)}>
      <SortLabel active={eSortKey === key} dir={eSortDir} align={align} onPress={() => onEnrollSort(key)}>{label}</SortLabel>
      {enrollCols.sizer(key, label)}
    </TableColumn>
  );

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
  const liveProgram = viewProgram ? programs.find((p) => p.id === viewProgram.id) || viewProgram : null;
  const liveEnroll = viewEnroll ? enrollments.find((e) => e.id === viewEnroll.id) || viewEnroll : null;
  const enrollStatusColor = (s: string) => (s === 'completed' ? 'success' : s === 'in_progress' ? 'primary' : 'default') as 'success' | 'primary' | 'default';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip size="sm" variant="flat">{programs.length} programs</Chip>
        <Chip size="sm" variant="flat" color="primary">{totalStaff} staff enrolled</Chip>
        <Chip size="sm" variant="flat" color="success">{enrollments.filter((e) => e.status === 'completed').length} completed</Chip>
      </div>

      <Tabs aria-label="Training views" size="sm" variant="solid" className="w-full" classNames={deskBookTabsClassNames} selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
        <Tab key="programs" title="Programs">
          <div className={deskBookTabPanelClassName}>
          <Card className="shadow-sm">
            <CardHeader className="px-3 py-2 justify-between gap-2 flex-wrap">
              <div className="text-sm font-semibold text-gray-800">Training Programs</div>
              <div className="flex items-center gap-2 flex-wrap">
                <Input size="sm" placeholder="Search program" value={pQ} onChange={(e) => setPQ(e.target.value)} variant="bordered" className="w-44" />
                <Select
                  size="sm"
                  selectedKeys={[pCat]}
                  onSelectionChange={(k) => setPCat(Array.from(k)[0] as string)}
                  className="w-40"
                  variant="bordered"
                  aria-label="Category"
                  items={[{ id: 'all', label: 'All categories' }, ...Object.entries(CATEGORIES).map(([id, label]) => ({ id, label }))]}
                >
                  {(item: { id: string; label: string }) => <SelectItem key={item.id}>{item.label}</SelectItem>}
                </Select>
                <Select size="sm" selectedKeys={[pMandatory]} onSelectionChange={(k) => setPMandatory(Array.from(k)[0] as 'all' | 'yes' | 'no')} className="w-36" variant="bordered" aria-label="Mandatory">
                  <SelectItem key="all">All</SelectItem>
                  <SelectItem key="yes">Mandatory</SelectItem>
                  <SelectItem key="no">Optional</SelectItem>
                </Select>
                <ExportButtons onDownload={exportPrograms} />
                <Button size="sm" color="primary" onPress={() => setProgramOpen(true)}>+ Add Program</Button>
              </div>
            </CardHeader>
            <CardBody>
              <div ref={programCols.frameRef} style={programCols.frameStyle}>
                <Table aria-label="programs" removeWrapper classNames={deskResizableTableClassNames()}>
                  <TableHeader>
                    {programColumn('title', 'Program')}
                    {programColumn('category', 'Category')}
                    {programColumn('duration', 'Duration', 'center')}
                    {programColumn('cost', 'Cost', 'right')}
                    {programColumn('dates', 'Dates')}
                    {programColumn('staff', 'Staff', 'center')}
                    {programColumn('completed', 'Completed', 'center')}
                  </TableHeader>
                  <TableBody emptyContent="No training programs match these filters.">
                    {pagedPrograms.map((p) => (
                      <TableRow
                        key={p.id}
                        className={rowClassNames(viewProgram?.id === p.id)}
                        onClick={() => setViewProgram(p)}
                      >
                        <TableCell className="font-semibold text-ghana-black">
                          <span className="block truncate" title={p.title}>
                            {p.title}
                            {p.mandatory && <Chip size="sm" variant="flat" color="warning" className="ml-2">Mandatory</Chip>}
                          </span>
                        </TableCell>
                        <TableCell>{categoryLabel(p.category)}</TableCell>
                        <TableCell className="text-center">{p.duration ? `${p.duration}h` : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(p.cost || 0)}</TableCell>
                        <TableCell>{fmtDateRange(p.startDate, p.endDate)}</TableCell>
                        <TableCell className="text-center tabular-nums">{staffByProgram[p.id]?.staff ?? 0}</TableCell>
                        <TableCell className="text-center tabular-nums">{staffByProgram[p.id]?.completed ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex justify-end">
                <Pagination page={programPage} total={programPages} onChange={setProgramPage} showControls size="sm" />
              </div>
            </CardBody>
          </Card>
          </div>
        </Tab>

        <Tab key="enrollments" title="Enrollments">
          <div className={deskBookTabPanelClassName}>
          <Card className="shadow-sm">
            <CardHeader className="px-3 py-2 justify-between gap-2 flex-wrap">
              <div className="text-sm font-semibold text-gray-800">Enrollments</div>
              <div className="flex items-center gap-2 flex-wrap">
                <Input size="sm" placeholder="Search employee or program" value={eQ} onChange={(e) => setEQ(e.target.value)} variant="bordered" className="w-52" />
                <Select size="sm" selectedKeys={[eProgram]} onSelectionChange={(k) => setEProgram(Array.from(k)[0] as string)} className="w-48" variant="bordered" aria-label="Program" items={[{ id: 'all', title: 'All programs' }, ...programs.map((p) => ({ id: p.id, title: p.title }))]}>
                  {(item: { id: string; title: string }) => <SelectItem key={item.id}>{item.title}</SelectItem>}
                </Select>
                <Select size="sm" selectedKeys={[eStatus]} onSelectionChange={(k) => setEStatus(Array.from(k)[0] as string)} className="w-36" variant="bordered" aria-label="Status">
                  <SelectItem key="all">All status</SelectItem>
                  <SelectItem key="enrolled">Enrolled</SelectItem>
                  <SelectItem key="in_progress">In progress</SelectItem>
                  <SelectItem key="completed">Completed</SelectItem>
                  <SelectItem key="dropped">Dropped</SelectItem>
                  <SelectItem key="failed">Failed</SelectItem>
                </Select>
                <ExportButtons onDownload={exportEnrollments} />
                <Button size="sm" color="primary" onPress={() => openEnroll()} isDisabled={programs.length === 0}>+ Enroll Staff</Button>
              </div>
            </CardHeader>
            <CardBody>
              <div ref={enrollCols.frameRef} style={enrollCols.frameStyle}>
                <Table aria-label="enrollments" removeWrapper classNames={deskResizableTableClassNames()}>
                  <TableHeader>
                    {enrollColumn('employee', 'Employee')}
                    {enrollColumn('program', 'Program')}
                    {enrollColumn('enrolled', 'Enrolled on')}
                    {enrollColumn('cost', 'Cost', 'right')}
                    {enrollColumn('status', 'Status')}
                  </TableHeader>
                  <TableBody emptyContent="No enrollments match these filters.">
                    {pagedEnrollments.map((e) => (
                      <TableRow
                        key={e.id}
                        className={rowClassNames(viewEnroll?.id === e.id)}
                        onClick={() => setViewEnroll(e)}
                      >
                        <TableCell className="font-semibold text-ghana-black">
                          <span className="block truncate" title={employeeName(e.employeeId)}>{employeeName(e.employeeId)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="block truncate">{programs.find((p) => p.id === e.trainingProgramId)?.title || e.trainingProgramId}</span>
                        </TableCell>
                        <TableCell>{fmtDate(e.enrollmentDate) || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(e.cost || 0)}</TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" color={enrollStatusColor(e.status)}>{e.status}</Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex justify-end">
                <Pagination page={enrollPage} total={enrollPages} onChange={setEnrollPage} showControls size="sm" />
              </div>
            </CardBody>
          </Card>
          </div>
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

      <Modal isOpen={!!liveProgram} onOpenChange={(open) => !open && setViewProgram(null)} size="2xl">
        <ModalContent>
          {() => liveProgram && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span>{liveProgram.title}</span>
                <span className="text-sm font-normal text-gray-500">{categoryLabel(liveProgram.category)}</span>
              </ModalHeader>
              <ModalBody>
                <DetailGrid>
                  <DetailField label="Mandatory" value={liveProgram.mandatory ? 'Yes' : 'No'} />
                  <DetailField label="Duration" value={liveProgram.duration ? `${liveProgram.duration} hours` : '—'} />
                  <DetailField label="Cost per staff" value={formatGhs(liveProgram.cost)} />
                  <DetailField label="Dates" value={fmtDateRange(liveProgram.startDate, liveProgram.endDate)} />
                  <DetailField label="Staff enrolled" value={String(staffByProgram[liveProgram.id]?.staff ?? 0)} />
                  <DetailField label="Completed" value={String(staffByProgram[liveProgram.id]?.completed ?? 0)} />
                  <DetailField label="Status" value={liveProgram.status} />
                </DetailGrid>
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setViewProgram(null)}>Close</Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="bordered"
                    onPress={() => printDetailSheet(
                      liveProgram.title,
                      [
                        { label: 'Mandatory', value: liveProgram.mandatory ? 'Yes' : 'No' },
                        { label: 'Duration', value: liveProgram.duration ? `${liveProgram.duration} hours` : '—' },
                        { label: 'Cost per staff', value: formatGhs(liveProgram.cost) },
                        { label: 'Dates', value: fmtDateRange(liveProgram.startDate, liveProgram.endDate) },
                        { label: 'Staff enrolled', value: String(staffByProgram[liveProgram.id]?.staff ?? 0) },
                        { label: 'Completed', value: String(staffByProgram[liveProgram.id]?.completed ?? 0) },
                        { label: 'Status', value: liveProgram.status },
                      ],
                      categoryLabel(liveProgram.category),
                    )}
                  >
                    Print
                  </Button>
                  <Button color="primary" variant="flat" onPress={() => { openEnroll(liveProgram.id); setViewProgram(null); }}>Enroll staff</Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={!!liveEnroll} onOpenChange={(open) => !open && setViewEnroll(null)} size="lg">
        <ModalContent>
          {() => liveEnroll && (
            <>
              <ModalHeader>Enrollment</ModalHeader>
              <ModalBody>
                <DetailGrid>
                  <DetailField label="Employee" value={employeeName(liveEnroll.employeeId)} />
                  <DetailField label="Program" value={programs.find((p) => p.id === liveEnroll.trainingProgramId)?.title || liveEnroll.trainingProgramId} />
                  <DetailField label="Enrolled on" value={fmtDate(liveEnroll.enrollmentDate) || '—'} />
                  <DetailField label="Cost" value={formatGhs(liveEnroll.cost)} />
                  <DetailField label="Status" value={<Chip size="sm" variant="flat" color={enrollStatusColor(liveEnroll.status)}>{liveEnroll.status}</Chip>} />
                </DetailGrid>
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setViewEnroll(null)}>Close</Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="bordered"
                    onPress={() => printDetailSheet(
                      'Enrollment',
                      [
                        { label: 'Employee', value: employeeName(liveEnroll.employeeId) },
                        { label: 'Program', value: programs.find((p) => p.id === liveEnroll.trainingProgramId)?.title || liveEnroll.trainingProgramId },
                        { label: 'Enrolled on', value: fmtDate(liveEnroll.enrollmentDate) || '—' },
                        { label: 'Cost', value: formatGhs(liveEnroll.cost) },
                        { label: 'Status', value: liveEnroll.status },
                      ],
                    )}
                  >
                    Print
                  </Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
