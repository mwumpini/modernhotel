'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Chip, Checkbox } from '@heroui/react';
import { useTrainingStore } from '@/app/lib/hr/trainingStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';

export default function TrainingProgramsPanel() {
  const programs = useTrainingStore((s) => s.programs);
  const enrollments = useTrainingStore((s) => s.enrollments);
  const addProgram = useTrainingStore((s) => s.addProgram);
  const enroll = useTrainingStore((s) => s.enroll);
  const hydrateFromApi = useTrainingStore((s) => s.hydrateFromApi);
  const employees = useEmployeeStore((s) => s.employees);

  React.useEffect(() => {
    hydrateFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pForm, setPForm] = React.useState<any>({ title: '', code: '', category: 'technical', duration: 8, cost: 0, startDate: '', endDate: '', location: '', instructor: '', mandatory: false });
  const [eForm, setEForm] = React.useState<any>({ trainingProgramId: '', employeeId: employees[0]?.id || '', enrollmentDate: new Date().toISOString().slice(0,10) });

  const createProgram = () => {
    if (!pForm.title) return;
    addProgram({ title: pForm.title, code: pForm.code || `TP${programs.length+1}`, description: '', category: pForm.category, duration: Number(pForm.duration||0), cost: Number(pForm.cost||0), maxParticipants: 0, instructor: pForm.instructor || '', location: pForm.location || '', startDate: pForm.startDate ? new Date(pForm.startDate) : new Date(), endDate: pForm.endDate ? new Date(pForm.endDate) : new Date(), status: 'scheduled', mandatory: !!pForm.mandatory, materials: [], objectives: [], prerequisites: [] } as any);
  };

  const doEnroll = () => {
    if (!eForm.trainingProgramId || !eForm.employeeId) return;
    // Cost defaults to the program's own real cost, not a hardcoded 0 -- SalaryAnalyticsPanel
    // sums enrollment cost for "Total Training Cost" / "Training Cost by Department", so a
    // flat 0 here silently zeroed out those KPIs regardless of what training actually cost.
    const program = programs.find((p) => p.id === eForm.trainingProgramId);
    enroll({ trainingProgramId: eForm.trainingProgramId, employeeId: eForm.employeeId, enrollmentDate: new Date(eForm.enrollmentDate), status: 'enrolled', cost: program?.cost || 0 } as any);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Training Programs</div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
            <Input label="Title" value={pForm.title} onChange={(e) => setPForm({ ...pForm, title: e.target.value })} variant="bordered" />
            <Input label="Code" value={pForm.code} onChange={(e) => setPForm({ ...pForm, code: e.target.value })} variant="bordered" />
            <Select label="Category" selectedKeys={[pForm.category]} onSelectionChange={(k) => setPForm({ ...pForm, category: Array.from(k)[0] as string })} variant="bordered">
              <SelectItem key="technical">Technical</SelectItem>
              <SelectItem key="soft_skills">Soft Skills</SelectItem>
              <SelectItem key="compliance">Compliance</SelectItem>
              <SelectItem key="leadership">Leadership</SelectItem>
              <SelectItem key="safety">Safety</SelectItem>
            </Select>
            <Input label="Duration (hrs)" type="number" value={String(pForm.duration)} onChange={(e) => setPForm({ ...pForm, duration: e.target.value })} variant="bordered" />
            <Input label="Cost (GHS)" type="number" value={String(pForm.cost)} onChange={(e) => setPForm({ ...pForm, cost: e.target.value })} variant="bordered" />
            <Input label="Start" type="date" value={pForm.startDate} onChange={(e) => setPForm({ ...pForm, startDate: e.target.value })} variant="bordered" />
            <Input label="End" type="date" value={pForm.endDate} onChange={(e) => setPForm({ ...pForm, endDate: e.target.value })} variant="bordered" />
            <div className="md:col-span-6 flex items-center gap-4">
              <Checkbox isSelected={!!pForm.mandatory} onValueChange={(v) => setPForm({ ...pForm, mandatory: v })}>
                Mandatory (e.g. food safety, fire safety)
              </Checkbox>
              <Button color="primary" onPress={createProgram} isDisabled={!pForm.title}>Add Program</Button>
            </div>
          </div>

          <Table aria-label="programs">
            <TableHeader>
              <TableColumn>TITLE</TableColumn>
              <TableColumn>CODE</TableColumn>
              <TableColumn>CATEGORY</TableColumn>
              <TableColumn>DURATION</TableColumn>
              <TableColumn>COST</TableColumn>
              <TableColumn>DATES</TableColumn>
            </TableHeader>
            <TableBody>
              {programs.map((p) => (
                <TableRow key={p.id}><TableCell>{p.title}</TableCell><TableCell>{p.code}</TableCell><TableCell>{p.category}</TableCell><TableCell>{p.duration}h</TableCell><TableCell>₵{(p.cost || 0).toFixed(2)}</TableCell><TableCell>{new Date(p.startDate).toLocaleDateString()} - {new Date(p.endDate).toLocaleDateString()}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-6">
            <div className="font-medium mb-2">Enrollments</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <Select label="Program" selectedKeys={[eForm.trainingProgramId]} onSelectionChange={(k) => setEForm({ ...eForm, trainingProgramId: Array.from(k)[0] as string })} variant="bordered" items={programs.map(p => ({ id: p.id, title: p.title }))}>
                {(item: any) => <SelectItem key={item.id}>{item.title}</SelectItem>}
              </Select>
              <Select label="Employee" selectedKeys={[eForm.employeeId]} onSelectionChange={(k) => setEForm({ ...eForm, employeeId: Array.from(k)[0] as string })} variant="bordered" items={employees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}>
                {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
              </Select>
              <Input label="Enrollment Date" type="date" value={eForm.enrollmentDate} onChange={(e) => setEForm({ ...eForm, enrollmentDate: e.target.value })} variant="bordered" />
              <div className="flex items-end"><Button color="primary" onPress={doEnroll} isDisabled={!eForm.trainingProgramId || !eForm.employeeId}>Enroll</Button></div>
            </div>

            <Table aria-label="enrollments">
              <TableHeader>
                <TableColumn>EMPLOYEE</TableColumn>
                <TableColumn>PROGRAM</TableColumn>
                <TableColumn>STATUS</TableColumn>
              </TableHeader>
              <TableBody>
                {enrollments.map((e) => {
                  const emp = employees.find(x => x.id === e.employeeId);
                  const prog = programs.find(p => p.id === e.trainingProgramId);
                  return (
                    <TableRow key={e.id}><TableCell>{emp ? `${emp.firstName} ${emp.lastName}` : e.employeeId}</TableCell><TableCell>{prog?.title || e.trainingProgramId}</TableCell><TableCell><Chip size="sm" variant="flat" color={e.status === 'completed' ? 'success' : e.status === 'in_progress' ? 'primary' : 'default'}>{e.status}</Chip></TableCell></TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


