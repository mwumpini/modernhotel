'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Progress, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { useOnboardingStore } from '@/app/lib/hr/onboardingStore';

export default function NewHiresPanel() {
  const employees = useEmployeeStore((s) => s.employees);
  const getDepartment = useEmployeeStore((s) => s.getDepartment);
  const getPosition = useEmployeeStore((s) => s.getPosition);

  const checklists = useOnboardingStore((s) => s.checklists);
  const startOnboarding = useOnboardingStore((s) => s.startOnboarding);
  const toggleTask = useOnboardingStore((s) => s.toggleTask);

  const [days, setDays] = React.useState(30);
  const [q, setQ] = React.useState('');
  const [activeEmployeeId, setActiveEmployeeId] = React.useState<string | null>(null);

  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const hires = employees
    .filter((e) => new Date(e.hireDate).getTime() >= since)
    .filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(q.toLowerCase()) || e.employeeNumber.toLowerCase().includes(q.toLowerCase()));

  const openChecklist = (id: string) => {
    if (!checklists[id]) startOnboarding(id);
    setActiveEmployeeId(id);
  };

  const activeEmployee = activeEmployeeId ? employees.find((e) => e.id === activeEmployeeId) : undefined;
  const activeChecklist = activeEmployeeId ? checklists[activeEmployeeId] : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">New Hires</div>
          <div className="flex items-center gap-2">
            <Input size="sm" placeholder="Search name/number" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-56" />
            <Select size="sm" selectedKeys={[String(days)]} onSelectionChange={(k) => setDays(parseInt(Array.from(k)[0] as string, 10))} className="w-32" variant="bordered" aria-label="Period">
              <SelectItem key="7">7 days</SelectItem>
              <SelectItem key="14">14 days</SelectItem>
              <SelectItem key="30">30 days</SelectItem>
              <SelectItem key="60">60 days</SelectItem>
              <SelectItem key="90">90 days</SelectItem>
            </Select>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="new-hires">
            <TableHeader>
              <TableColumn>NUMBER</TableColumn>
              <TableColumn>NAME</TableColumn>
              <TableColumn>HIRED</TableColumn>
              <TableColumn>DEPARTMENT</TableColumn>
              <TableColumn>POSITION</TableColumn>
              <TableColumn>{' '}</TableColumn>
            </TableHeader>
            <TableBody>
              {hires.map((e) => {
                const dept = getDepartment(e.departmentId);
                const pos = getPosition(e.positionId);
                const checklist = checklists[e.id];
                const done = checklist ? checklist.tasks.filter((t) => t.completed).length : 0;
                const total = checklist ? checklist.tasks.length : 0;
                const complete = checklist && done === total && total > 0;
                return (
                  <TableRow key={e.id}>
                    <TableCell>{e.employeeNumber}</TableCell>
                    <TableCell>{e.firstName} {e.lastName}</TableCell>
                    <TableCell>{new Date(e.hireDate).toLocaleDateString()}</TableCell>
                    <TableCell>{dept?.name || '-'}</TableCell>
                    <TableCell>{pos?.title || '-'}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        color={complete ? 'success' : 'primary'}
                        variant={complete ? 'flat' : 'solid'}
                        onPress={() => openChecklist(e.id)}
                      >
                        {complete ? '✓ Onboarded' : checklist ? `Onboarding: ${done}/${total}` : 'Start Onboarding'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Modal isOpen={!!activeEmployeeId} onOpenChange={(open) => !open && setActiveEmployeeId(null)} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                Onboarding — {activeEmployee ? `${activeEmployee.firstName} ${activeEmployee.lastName}` : ''}
              </ModalHeader>
              <ModalBody>
                {activeChecklist && (
                  <div className="space-y-4">
                    <Progress
                      aria-label="Onboarding progress"
                      value={activeChecklist.tasks.length ? (activeChecklist.tasks.filter((t) => t.completed).length / activeChecklist.tasks.length) * 100 : 0}
                      color={activeChecklist.tasks.every((t) => t.completed) ? 'success' : 'primary'}
                    />
                    <div className="space-y-2">
                      {activeChecklist.tasks.map((t) => (
                        <label key={t.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={t.completed}
                            onChange={() => toggleTask(activeChecklist.employeeId, t.key)}
                            className="w-4 h-4"
                          />
                          <span className={t.completed ? 'line-through text-gray-400' : ''}>{t.label}</span>
                          {t.completed && t.completedAt && (
                            <Chip size="sm" variant="flat" color="success" className="ml-auto">
                              {new Date(t.completedAt).toLocaleDateString()}
                            </Chip>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setActiveEmployeeId(null)}>Close</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
