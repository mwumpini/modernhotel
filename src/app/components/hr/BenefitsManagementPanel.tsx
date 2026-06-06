'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useBenefitsStore } from '@/app/lib/hr/benefitsStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';

export default function BenefitsManagementPanel() {
  const packages = useBenefitsStore((s) => s.packages);
  const enrollments = useBenefitsStore((s) => s.enrollments);
  const addPackage = useBenefitsStore((s) => s.addPackage);
  const updatePackage = useBenefitsStore((s) => s.updatePackage);
  const deletePackage = useBenefitsStore((s) => s.deletePackage);
  const enrollEmployee = useBenefitsStore((s) => s.enrollEmployee);
  const cancelEnrollment = useBenefitsStore((s) => s.cancelEnrollment);
  const getSummary = useBenefitsStore((s) => s.getSummary);

  const employees = useEmployeeStore((s) => s.employees);

  const [isPkgOpen, setIsPkgOpen] = React.useState(false);
  const [pkgForm, setPkgForm] = React.useState<any>({ name: '', type: 'health', coverage: '', cost: 0, employeeContribution: 0, employerContribution: 0, isActive: true, effectiveDate: new Date().toISOString().slice(0, 10) });
  const [enrForm, setEnrForm] = React.useState<any>({ employeeId: employees[0]?.id || '', benefitsPackageId: packages[0]?.id || '', enrollmentDate: new Date().toISOString().slice(0, 10), status: 'active', dependents: 0, employeeContribution: 0, employerContribution: 0, cost: 0 });

  const summary = getSummary();

  const savePackage = () => {
    addPackage({
      name: pkgForm.name,
      description: '',
      type: pkgForm.type,
      coverage: pkgForm.coverage,
      cost: Number(pkgForm.cost),
      employeeContribution: Number(pkgForm.employeeContribution),
      employerContribution: Number(pkgForm.employerContribution),
      isActive: !!pkgForm.isActive,
      effectiveDate: new Date(pkgForm.effectiveDate)
    });
    setIsPkgOpen(false);
  };

  const doEnroll = () => {
    enrollEmployee({
      employeeId: enrForm.employeeId,
      benefitsPackageId: enrForm.benefitsPackageId,
      enrollmentDate: new Date(enrForm.enrollmentDate),
      effectiveDate: new Date(enrForm.enrollmentDate),
      status: enrForm.status,
      dependents: Number(enrForm.dependents),
      totalCost: Number(enrForm.cost) || 0,
      employeeContribution: Number(enrForm.employeeContribution) || 0,
      employerContribution: Number(enrForm.employerContribution) || 0
    } as any);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Benefits Management</div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div>Active Packages: <span className="font-medium">{summary.activePackages}</span></div>
            <div>Active Enrollments: <span className="font-medium">{summary.activeEnrollments}</span></div>
            <div>Monthly Cost: <span className="font-medium">{summary.monthlyCost.toFixed(2)}</span></div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="justify-between">
                <div className="font-medium">Packages</div>
                <Button size="sm" color="primary" onPress={() => setIsPkgOpen(true)}>+ Add Package</Button>
              </CardHeader>
              <CardBody>
                <Table aria-label="benefit-packages">
                  <TableHeader>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>TYPE</TableColumn>
                    <TableColumn>COVERAGE</TableColumn>
                    <TableColumn>COST</TableColumn>
                    <TableColumn>{' '}</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {packages.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{p.type}</TableCell>
                        <TableCell>{p.coverage}</TableCell>
                        <TableCell>{p.cost}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="flat" color="danger" onPress={() => deletePackage(p.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="justify-between">
                <div className="font-medium">Enrollments</div>
                <div className="flex items-center gap-2">
                  <Select size="sm" selectedKeys={[enrForm.employeeId]} onSelectionChange={(k) => setEnrForm({ ...enrForm, employeeId: Array.from(k)[0] as string })} className="w-48" variant="bordered" aria-label="Employee">
                    {employees.map((e) => <SelectItem key={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
                  </Select>
                  <Select size="sm" selectedKeys={[enrForm.benefitsPackageId]} onSelectionChange={(k) => setEnrForm({ ...enrForm, benefitsPackageId: Array.from(k)[0] as string })} className="w-48" variant="bordered" aria-label="Package">
                    {packages.map((p) => <SelectItem key={p.id}>{p.name}</SelectItem>)}
                  </Select>
                <Button size="sm" color="primary" onPress={doEnroll} isDisabled={!enrForm.employeeId || !enrForm.benefitsPackageId}>Enroll</Button>
                </div>
              </CardHeader>
              <CardBody>
                <Table aria-label="benefit-enrollments">
                  <TableHeader>
                    <TableColumn>EMPLOYEE</TableColumn>
                    <TableColumn>PACKAGE</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>COST</TableColumn>
                    <TableColumn>{' '}</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {enrollments.map((e) => {
                      const emp = employees.find((x) => x.id === e.employeeId);
                      const pkg = packages.find((p) => p.id === e.benefitsPackageId);
                      return (
                        <TableRow key={e.id}>
                          <TableCell>{emp ? `${emp.firstName} ${emp.lastName}` : e.employeeId}</TableCell>
                          <TableCell>{pkg?.name || e.benefitsPackageId}</TableCell>
                          <TableCell>{e.status}</TableCell>
                          <TableCell>{(e.employeeContribution + e.employerContribution).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="flat" color="danger" onPress={() => cancelEnrollment(e.id)}>Cancel</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={isPkgOpen} onOpenChange={setIsPkgOpen} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>New Benefits Package</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input label="Name" value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} variant="bordered" />
                  <Select label="Type" selectedKeys={[pkgForm.type]} onSelectionChange={(k) => setPkgForm({ ...pkgForm, type: Array.from(k)[0] as string })} variant="bordered">
                    <SelectItem key="health">Health</SelectItem>
                    <SelectItem key="dental">Dental</SelectItem>
                    <SelectItem key="vision">Vision</SelectItem>
                    <SelectItem key="life">Life</SelectItem>
                    <SelectItem key="disability">Disability</SelectItem>
                    <SelectItem key="retirement">Retirement</SelectItem>
                    <SelectItem key="other">Other</SelectItem>
                  </Select>
                  <Input label="Coverage" value={pkgForm.coverage} onChange={(e) => setPkgForm({ ...pkgForm, coverage: e.target.value })} variant="bordered" />
                  <Input label="Cost" type="number" value={String(pkgForm.cost)} onChange={(e) => setPkgForm({ ...pkgForm, cost: parseFloat(e.target.value || '0') })} variant="bordered" />
                  <Input label="Employee Contribution" type="number" value={String(pkgForm.employeeContribution)} onChange={(e) => setPkgForm({ ...pkgForm, employeeContribution: parseFloat(e.target.value || '0') })} variant="bordered" />
                  <Input label="Employer Contribution" type="number" value={String(pkgForm.employerContribution)} onChange={(e) => setPkgForm({ ...pkgForm, employerContribution: parseFloat(e.target.value || '0') })} variant="bordered" />
                  <Input label="Effective Date" type="date" value={pkgForm.effectiveDate} onChange={(e) => setPkgForm({ ...pkgForm, effectiveDate: e.target.value })} variant="bordered" />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setIsPkgOpen(false)}>Cancel</Button>
                <Button color="primary" onPress={savePackage}>Create</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}


