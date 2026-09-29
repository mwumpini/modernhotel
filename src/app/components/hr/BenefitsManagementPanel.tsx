'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Input, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Tabs, Tab } from '@heroui/react';
import { useBenefitsStore } from '@/app/lib/hr/benefitsStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { formatMoney } from '@/app/lib/format/currency';
import { printDetailSheet } from '@/app/lib/print/simpleReport';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailGrid, DetailField } from '../frontoffice/detailView';
import { useDeskPagination } from '../dashboard/deskTableUi';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from '../dashboard/deskTabsUi';

type PkgSort = 'name' | 'type' | 'coverage' | 'cost';
type EnrSort = 'employee' | 'package' | 'status' | 'cost';

export default function BenefitsManagementPanel() {
  const packages = useBenefitsStore((s) => s.packages);
  const enrollments = useBenefitsStore((s) => s.enrollments);
  const addPackage = useBenefitsStore((s) => s.addPackage);
  const deletePackage = useBenefitsStore((s) => s.deletePackage);
  const enrollEmployee = useBenefitsStore((s) => s.enrollEmployee);
  const cancelEnrollment = useBenefitsStore((s) => s.cancelEnrollment);
  const getSummary = useBenefitsStore((s) => s.getSummary);
  const employees = useEmployeeStore((s) => s.employees);

  const [isPkgOpen, setIsPkgOpen] = React.useState(false);
  const [isEnrollOpen, setIsEnrollOpen] = React.useState(false);
  const [pkgForm, setPkgForm] = React.useState<any>({ name: '', type: 'health', coverage: '', cost: 0, employeeContribution: 0, employerContribution: 0, isActive: true, effectiveDate: new Date().toISOString().slice(0, 10) });
  const [enrForm, setEnrForm] = React.useState<any>({ employeeId: employees[0]?.id || '', benefitsPackageId: packages[0]?.id || '', enrollmentDate: new Date().toISOString().slice(0, 10), dependents: 0 });
  const [pkgQ, setPkgQ] = React.useState('');
  const [enrQ, setEnrQ] = React.useState('');
  const [pkgSort, setPkgSort] = React.useState<{ key: PkgSort; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [enrSort, setEnrSort] = React.useState<{ key: EnrSort; dir: 'asc' | 'desc' }>({ key: 'employee', dir: 'asc' });
  const [viewPkg, setViewPkg] = React.useState<(typeof packages)[number] | null>(null);
  const [viewEnr, setViewEnr] = React.useState<(typeof enrollments)[number] | null>(null);

  const pkgCols = useResizableColumns<PkgSort>({ name: 160, type: 110, coverage: 140, cost: 100 });
  const enrCols = useResizableColumns<EnrSort>({ employee: 160, package: 160, status: 110, cost: 100 });
  const summary = getSummary();

  const toggle = <K extends string>(prev: { key: K; dir: 'asc' | 'desc' }, key: K) =>
    prev.key === key ? { key, dir: (prev.dir === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' } : { key, dir: 'asc' as const };

  const pkgRows = React.useMemo(() => {
    const rows = packages.filter((p) => !pkgQ.trim() || p.name.toLowerCase().includes(pkgQ.trim().toLowerCase()) || p.type.toLowerCase().includes(pkgQ.trim().toLowerCase()));
    const value = (p: (typeof rows)[number]): string | number => {
      if (pkgSort.key === 'cost') return Number(p.cost || 0);
      return String((p as any)[pkgSort.key] || '').toLowerCase();
    };
    const sorted = [...rows].sort((a, b) => (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0));
    return pkgSort.dir === 'asc' ? sorted : sorted.reverse();
  }, [packages, pkgQ, pkgSort]);

  const enrRows = React.useMemo(() => {
    const rows = enrollments.filter((e) => {
      const emp = employees.find((x) => x.id === e.employeeId);
      const pkg = packages.find((p) => p.id === e.benefitsPackageId);
      const name = emp ? `${emp.firstName} ${emp.lastName}` : e.employeeId;
      const hay = `${name} ${pkg?.name || ''} ${e.status}`.toLowerCase();
      return !enrQ.trim() || hay.includes(enrQ.trim().toLowerCase());
    });
    const value = (e: (typeof rows)[number]): string | number => {
      const emp = employees.find((x) => x.id === e.employeeId);
      const pkg = packages.find((p) => p.id === e.benefitsPackageId);
      switch (enrSort.key) {
        case 'employee': return emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : e.employeeId;
        case 'package': return (pkg?.name || '').toLowerCase();
        case 'status': return e.status || '';
        case 'cost': return Number(e.employeeContribution || 0) + Number(e.employerContribution || 0);
        default: return '';
      }
    };
    const sorted = [...rows].sort((a, b) => (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0));
    return enrSort.dir === 'asc' ? sorted : sorted.reverse();
  }, [enrollments, employees, packages, enrQ, enrSort]);

  const { page: pkgPage, setPage: setPkgPage, pages: pkgPages, paged: pkgPaged } = useDeskPagination(pkgRows, [pkgQ, pkgSort]);
  const { page: enrPage, setPage: setEnrPage, pages: enrPages, paged: enrPaged } = useDeskPagination(enrRows, [enrQ, enrSort]);

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
      effectiveDate: new Date(pkgForm.effectiveDate),
    });
    setIsPkgOpen(false);
  };

  const doEnroll = () => {
    const pkg = packages.find((p) => p.id === enrForm.benefitsPackageId);
    if (!enrForm.employeeId || !pkg) return;
    enrollEmployee({
      employeeId: enrForm.employeeId,
      benefitsPackageId: pkg.id,
      enrollmentDate: new Date(enrForm.enrollmentDate),
      effectiveDate: new Date(enrForm.enrollmentDate),
      status: 'active',
      dependents: Number(enrForm.dependents) || 0,
      totalCost: Number(pkg.cost) || 0,
      employeeContribution: Number(pkg.employeeContribution) || 0,
      employerContribution: Number(pkg.employerContribution) || 0,
    } as any);
    setIsEnrollOpen(false);
  };

  return (
    <div className="space-y-3">
      <Card className="shadow-sm">
        <CardHeader className="px-3 py-2 justify-between flex-wrap gap-2">
          <div className="text-sm font-semibold text-gray-800">Benefits</div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <div>Active packages: <span className="font-medium">{summary.activePackages}</span></div>
            <div>Active enrollments: <span className="font-medium">{summary.activeEnrollments}</span></div>
            <div>Monthly cost: <span className="font-medium">{formatMoney(summary.monthlyCost)}</span></div>
          </div>
        </CardHeader>
      </Card>

      <Tabs aria-label="Benefits sections" size="sm" variant="solid" className="w-full" classNames={deskBookTabsClassNames}>
        <Tab key="packages" title="Packages">
          <div className={deskBookTabPanelClassName}>
          <Card className="shadow-sm">
            <CardHeader className="px-3 py-2 justify-between gap-2 flex-wrap">
              <div className="text-sm font-semibold text-gray-800">Packages</div>
              <div className="flex items-center gap-2">
                <Input size="sm" placeholder="Search packages" value={pkgQ} onChange={(e) => setPkgQ(e.target.value)} variant="bordered" className="w-44" />
                <Button size="sm" color="primary" onPress={() => setIsPkgOpen(true)}>+ Add Package</Button>
              </div>
            </CardHeader>
            <CardBody>
              <div ref={pkgCols.frameRef} style={pkgCols.frameStyle}>
              <Table aria-label="benefit-packages" removeWrapper classNames={deskResizableTableClassNames()}>
                <TableHeader>
                  {([
                    ['name', 'Name'],
                    ['type', 'Type'],
                    ['coverage', 'Coverage'],
                    ['cost', 'Cost'],
                  ] as [PkgSort, string][]).map(([key, label]) => (
                    <TableColumn key={key} className="relative" style={pkgCols.style(key)}>
                      <SortLabel active={pkgSort.key === key} dir={pkgSort.dir} align={key === 'cost' ? 'right' : 'left'} onPress={() => setPkgSort((p) => toggle(p, key))}>{label}</SortLabel>
                      {pkgCols.sizer(key, label)}
                    </TableColumn>
                  ))}
                </TableHeader>
                <TableBody emptyContent="No packages yet.">
                  {pkgPaged.map((p) => (
                    <TableRow key={p.id} className={rowClassNames(viewPkg?.id === p.id)} onClick={() => setViewPkg(p)}>
                      <TableCell className="font-semibold text-ghana-black"><span className="block truncate">{p.name}</span></TableCell>
                      <TableCell className="capitalize">{p.type}</TableCell>
                      <TableCell><span className="block truncate">{p.coverage || '—'}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(p.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              <div className="mt-3 flex justify-end">
                <Pagination page={pkgPage} total={pkgPages} onChange={setPkgPage} showControls size="sm" />
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
              <div className="flex items-center gap-2">
                <Input size="sm" placeholder="Search enrollments" value={enrQ} onChange={(e) => setEnrQ(e.target.value)} variant="bordered" className="w-44" />
                <Button size="sm" color="primary" onPress={() => setIsEnrollOpen(true)}>+ Enroll</Button>
              </div>
            </CardHeader>
            <CardBody>
              <div ref={enrCols.frameRef} style={enrCols.frameStyle}>
              <Table aria-label="benefit-enrollments" removeWrapper classNames={deskResizableTableClassNames()}>
                <TableHeader>
                  {([
                    ['employee', 'Employee'],
                    ['package', 'Package'],
                    ['status', 'Status'],
                    ['cost', 'Cost'],
                  ] as [EnrSort, string][]).map(([key, label]) => (
                    <TableColumn key={key} className="relative" style={enrCols.style(key)}>
                      <SortLabel active={enrSort.key === key} dir={enrSort.dir} align={key === 'cost' ? 'right' : 'left'} onPress={() => setEnrSort((p) => toggle(p, key))}>{label}</SortLabel>
                      {enrCols.sizer(key, label)}
                    </TableColumn>
                  ))}
                </TableHeader>
                <TableBody emptyContent="No enrollments yet.">
                  {enrPaged.map((e) => {
                    const emp = employees.find((x) => x.id === e.employeeId);
                    const pkg = packages.find((p) => p.id === e.benefitsPackageId);
                    const name = emp ? `${emp.firstName} ${emp.lastName}` : e.employeeId;
                    return (
                      <TableRow key={e.id} className={rowClassNames(viewEnr?.id === e.id)} onClick={() => setViewEnr(e)}>
                        <TableCell className="font-semibold text-ghana-black"><span className="block truncate">{name}</span></TableCell>
                        <TableCell><span className="block truncate">{pkg?.name || e.benefitsPackageId}</span></TableCell>
                        <TableCell><Chip size="sm" variant="flat" color={e.status === 'active' ? 'success' : 'default'}>{e.status}</Chip></TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(Number(e.employeeContribution || 0) + Number(e.employerContribution || 0))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
              <div className="mt-3 flex justify-end">
                <Pagination page={enrPage} total={enrPages} onChange={setEnrPage} showControls size="sm" />
              </div>
            </CardBody>
          </Card>
          </div>
        </Tab>
      </Tabs>

      <Modal isOpen={isPkgOpen} onOpenChange={setIsPkgOpen} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>New benefits package</ModalHeader>
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
                  <Input label="Employee contribution" type="number" value={String(pkgForm.employeeContribution)} onChange={(e) => setPkgForm({ ...pkgForm, employeeContribution: parseFloat(e.target.value || '0') })} variant="bordered" />
                  <Input label="Employer contribution" type="number" value={String(pkgForm.employerContribution)} onChange={(e) => setPkgForm({ ...pkgForm, employerContribution: parseFloat(e.target.value || '0') })} variant="bordered" />
                  <Input label="Effective date" type="date" value={pkgForm.effectiveDate} onChange={(e) => setPkgForm({ ...pkgForm, effectiveDate: e.target.value })} variant="bordered" />
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

      <Modal isOpen={isEnrollOpen} onOpenChange={setIsEnrollOpen} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Enroll employee</ModalHeader>
              <ModalBody className="space-y-3">
                <Select label="Employee" selectedKeys={enrForm.employeeId ? [enrForm.employeeId] : []} onSelectionChange={(k) => setEnrForm({ ...enrForm, employeeId: (Array.from(k)[0] as string) || '' })} variant="bordered">
                  {employees.map((e) => <SelectItem key={e.id} textValue={`${e.firstName} ${e.lastName}`}>{e.firstName} {e.lastName}</SelectItem>)}
                </Select>
                <Select label="Package" selectedKeys={enrForm.benefitsPackageId ? [enrForm.benefitsPackageId] : []} onSelectionChange={(k) => setEnrForm({ ...enrForm, benefitsPackageId: (Array.from(k)[0] as string) || '' })} variant="bordered">
                  {packages.map((p) => <SelectItem key={p.id} textValue={p.name}>{p.name}</SelectItem>)}
                </Select>
                <Input label="Enrollment date" type="date" value={enrForm.enrollmentDate} onChange={(e) => setEnrForm({ ...enrForm, enrollmentDate: e.target.value })} variant="bordered" />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setIsEnrollOpen(false)}>Cancel</Button>
                <Button color="primary" onPress={doEnroll} isDisabled={!enrForm.employeeId || !enrForm.benefitsPackageId}>Enroll</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={!!viewPkg} onOpenChange={(open) => !open && setViewPkg(null)} size="lg">
        <ModalContent>
          {() => viewPkg && (
            <>
              <ModalHeader>{viewPkg.name}</ModalHeader>
              <ModalBody>
                <DetailGrid>
                  <DetailField label="Type" value={<span className="capitalize">{viewPkg.type}</span>} />
                  <DetailField label="Coverage" value={viewPkg.coverage || '—'} />
                  <DetailField label="Cost" value={formatMoney(viewPkg.cost)} />
                  <DetailField label="Employee contribution" value={formatMoney(viewPkg.employeeContribution)} />
                  <DetailField label="Employer contribution" value={formatMoney(viewPkg.employerContribution)} />
                  <DetailField label="Effective" value={viewPkg.effectiveDate ? new Date(viewPkg.effectiveDate).toLocaleDateString() : '—'} />
                </DetailGrid>
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setViewPkg(null)}>Close</Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="bordered"
                    onPress={() => printDetailSheet(viewPkg.name, [
                      { label: 'Type', value: viewPkg.type },
                      { label: 'Coverage', value: viewPkg.coverage || '—' },
                      { label: 'Cost', value: formatMoney(viewPkg.cost) },
                      { label: 'Employee contribution', value: formatMoney(viewPkg.employeeContribution) },
                      { label: 'Employer contribution', value: formatMoney(viewPkg.employerContribution) },
                      { label: 'Effective', value: viewPkg.effectiveDate ? new Date(viewPkg.effectiveDate).toLocaleDateString() : '—' },
                    ])}
                  >
                    Print
                  </Button>
                  <Button color="danger" variant="flat" onPress={() => { deletePackage(viewPkg.id); setViewPkg(null); }}>Delete</Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={!!viewEnr} onOpenChange={(open) => !open && setViewEnr(null)} size="lg">
        <ModalContent>
          {() => {
            if (!viewEnr) return null;
            const emp = employees.find((x) => x.id === viewEnr.employeeId);
            const pkg = packages.find((p) => p.id === viewEnr.benefitsPackageId);
            return (
              <>
                <ModalHeader>Enrollment</ModalHeader>
                <ModalBody>
                  <DetailGrid>
                    <DetailField label="Employee" value={emp ? `${emp.firstName} ${emp.lastName}` : viewEnr.employeeId} />
                    <DetailField label="Package" value={pkg?.name || viewEnr.benefitsPackageId} />
                    <DetailField label="Status" value={viewEnr.status} />
                    <DetailField label="Cost" value={formatMoney(Number(viewEnr.employeeContribution || 0) + Number(viewEnr.employerContribution || 0))} />
                    <DetailField label="Enrolled" value={viewEnr.enrollmentDate ? new Date(viewEnr.enrollmentDate).toLocaleDateString() : '—'} />
                  </DetailGrid>
                </ModalBody>
                <ModalFooter className="flex flex-wrap justify-between gap-2">
                  <Button variant="flat" onPress={() => setViewEnr(null)}>Close</Button>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="bordered"
                      onPress={() => printDetailSheet('Enrollment', [
                        { label: 'Employee', value: emp ? `${emp.firstName} ${emp.lastName}` : viewEnr.employeeId },
                        { label: 'Package', value: pkg?.name || viewEnr.benefitsPackageId },
                        { label: 'Status', value: viewEnr.status },
                        { label: 'Cost', value: formatMoney(Number(viewEnr.employeeContribution || 0) + Number(viewEnr.employerContribution || 0)) },
                        { label: 'Enrolled', value: viewEnr.enrollmentDate ? new Date(viewEnr.enrollmentDate).toLocaleDateString() : '—' },
                      ])}
                    >
                      Print
                    </Button>
                    {viewEnr.status === 'active' && (
                      <Button color="danger" variant="flat" onPress={() => { cancelEnrollment(viewEnr.id); setViewEnr(null); }}>Cancel enrollment</Button>
                    )}
                  </div>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}
