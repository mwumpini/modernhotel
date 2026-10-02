'use client';

import React from 'react';
import {
  Card, CardBody, CardHeader, Button, Input, Textarea, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Chip, Tabs, Tab, Pagination,
} from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import type { Department, Position } from '@/app/lib/hr/models';
import { formatGhs, formatMoney } from '@/app/lib/format/currency';
import { printDetailSheet } from '@/app/lib/print/simpleReport';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailGrid, DetailField } from '../frontoffice/detailView';
import { useDeskPagination } from '../dashboard/deskTableUi';
import { deskBookTabsClassNames, deskBookTabPanelClassName } from '../dashboard/deskTabsUi';

const emptyDepartmentForm = {
  name: '', code: '', description: '', location: '', budget: '', managerId: '',
};
const emptyPositionForm = {
  title: '', code: '', departmentId: '', description: '', minSalary: '', maxSalary: '', baseSalary: '',
};

type DeptSortKey = 'name' | 'code' | 'location' | 'budget' | 'staff' | 'status';
type PosSortKey = 'title' | 'department' | 'salary' | 'staff' | 'status';

const deptColWidths: Record<DeptSortKey, number> = {
  name: 200,
  code: 80,
  location: 120,
  budget: 110,
  staff: 72,
  status: 100,
};

const posColWidths: Record<PosSortKey, number> = {
  title: 180,
  department: 140,
  salary: 160,
  staff: 72,
  status: 100,
};

export default function DepartmentsPositionsPanel() {
  const {
    departments, positions, employees, hydrateFromApi,
    addDepartment, updateDepartment, deleteDepartment,
    addPosition, updatePosition, deletePosition,
    getEmployeesByDepartment, getEmployeesByPosition,
  } = useEmployeeStore();

  React.useEffect(() => {
    hydrateFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tab, setTab] = React.useState<'departments' | 'positions'>('departments');

  const [deptQ, setDeptQ] = React.useState('');
  const [deptStatus, setDeptStatus] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [deptSortKey, setDeptSortKey] = React.useState<DeptSortKey>('name');
  const [deptSortDir, setDeptSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [viewDept, setViewDept] = React.useState<Department | null>(null);

  const [posQ, setPosQ] = React.useState('');
  const [posDept, setPosDept] = React.useState('all');
  const [posStatus, setPosStatus] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [posSortKey, setPosSortKey] = React.useState<PosSortKey>('title');
  const [posSortDir, setPosSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [viewPos, setViewPos] = React.useState<Position | null>(null);

  const deptCols = useResizableColumns<DeptSortKey>(deptColWidths);
  const posCols = useResizableColumns<PosSortKey>(posColWidths);

  const deptModal = useDisclosure();
  const [editingDept, setEditingDept] = React.useState<Department | null>(null);
  const [deptForm, setDeptForm] = React.useState(emptyDepartmentForm);

  const posModal = useDisclosure();
  const [editingPos, setEditingPos] = React.useState<Position | null>(null);
  const [posForm, setPosForm] = React.useState(emptyPositionForm);

  const openNewDepartment = () => {
    setEditingDept(null);
    setDeptForm(emptyDepartmentForm);
    deptModal.onOpen();
  };
  const openEditDepartment = (d: Department) => {
    setEditingDept(d);
    setDeptForm({
      name: d.name, code: d.code || '', description: d.description || '',
      location: d.location || '', budget: d.budget ? String(d.budget) : '', managerId: d.managerId || '',
    });
    deptModal.onOpen();
  };
  const saveDepartment = () => {
    if (!deptForm.name.trim()) return;
    const payload = {
      name: deptForm.name.trim(),
      code: deptForm.code.trim() || undefined,
      description: deptForm.description.trim(),
      location: deptForm.location.trim(),
      budget: Number(deptForm.budget) || 0,
      managerId: deptForm.managerId || undefined,
      isActive: true,
      status: 'active' as const,
    };
    if (editingDept) updateDepartment(editingDept.id, payload);
    else addDepartment(payload);
    deptModal.onClose();
  };
  const toggleDepartmentActive = (d: Department) => {
    const nextActive = d.status === 'inactive';
    updateDepartment(d.id, { isActive: nextActive, status: nextActive ? 'active' : 'inactive' });
  };
  const removeDepartment = async (d: Department) => {
    const staffCount = getEmployeesByDepartment(d.id).length;
    const posCount = positions.filter((p) => p.departmentId === d.id).length;
    const warning = staffCount > 0 || posCount > 0
      ? ` It still has ${staffCount} staff and ${posCount} position(s) referencing it — deleting it won't remove those, but they'll point at a department that no longer exists.`
      : '';
    const { confirmDelete } = await import('../DangerConfirm');
    if (!(await confirmDelete(d.name, `This department will be permanently removed.${warning}`))) return;
    deleteDepartment(d.id);
    if (viewDept?.id === d.id) setViewDept(null);
  };

  const openNewPosition = () => {
    setEditingPos(null);
    setPosForm(emptyPositionForm);
    posModal.onOpen();
  };
  const openEditPosition = (p: Position) => {
    setEditingPos(p);
    setPosForm({
      title: p.title, code: p.code || '', departmentId: p.departmentId,
      description: p.description || '',
      minSalary: p.minSalary ? String(p.minSalary) : '',
      maxSalary: p.maxSalary ? String(p.maxSalary) : '',
      baseSalary: p.baseSalary ? String(p.baseSalary) : '',
    });
    posModal.onOpen();
  };
  const savePosition = () => {
    if (!posForm.title.trim() || !posForm.departmentId) return;
    const payload = {
      title: posForm.title.trim(),
      code: posForm.code.trim() || undefined,
      departmentId: posForm.departmentId,
      description: posForm.description.trim(),
      requirements: [] as string[],
      minSalary: posForm.minSalary ? Number(posForm.minSalary) : undefined,
      maxSalary: posForm.maxSalary ? Number(posForm.maxSalary) : undefined,
      baseSalary: posForm.baseSalary ? Number(posForm.baseSalary) : undefined,
      isActive: true,
      status: 'active' as const,
    };
    if (editingPos) updatePosition(editingPos.id, payload);
    else addPosition(payload);
    posModal.onClose();
  };
  const togglePositionActive = (p: Position) => {
    const nextActive = p.status === 'inactive';
    updatePosition(p.id, { isActive: nextActive, status: nextActive ? 'active' : 'inactive' });
  };
  const removePosition = async (p: Position) => {
    const staffCount = getEmployeesByPosition(p.id).length;
    const warning = staffCount > 0
      ? ` ${staffCount} staff member(s) currently hold this position — deleting it won't remove them, but they'll point at a position that no longer exists.`
      : '';
    const { confirmDelete } = await import('../DangerConfirm');
    if (!(await confirmDelete(p.title, `This position will be permanently removed.${warning}`))) return;
    deletePosition(p.id);
    if (viewPos?.id === p.id) setViewPos(null);
  };

  const departmentName = (id: string) => departments.find((d) => d.id === id)?.name || 'Unknown';
  const managerName = (id?: string) => {
    if (!id) return '—';
    const e = employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };

  const filteredDepartments = React.useMemo(() => {
    const rows = departments.filter((d) => {
      if (deptStatus === 'active' && d.status === 'inactive') return false;
      if (deptStatus === 'inactive' && d.status !== 'inactive') return false;
      if (deptQ.trim()) {
        const q = deptQ.trim().toLowerCase();
        if (!d.name.toLowerCase().includes(q) && !(d.code || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const value = (d: Department): string | number => {
      switch (deptSortKey) {
        case 'name': return d.name.toLowerCase();
        case 'code': return (d.code || '').toLowerCase();
        case 'location': return (d.location || '').toLowerCase();
        case 'budget': return Number(d.budget || 0);
        case 'staff': return getEmployeesByDepartment(d.id).length;
        case 'status': return d.status || '';
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
    return deptSortDir === 'asc' ? sorted : sorted.reverse();
  }, [departments, deptQ, deptStatus, deptSortKey, deptSortDir, getEmployeesByDepartment]);

  const filteredPositions = React.useMemo(() => {
    const rows = positions.filter((p) => {
      if (posDept !== 'all' && p.departmentId !== posDept) return false;
      if (posStatus === 'active' && p.status === 'inactive') return false;
      if (posStatus === 'inactive' && p.status !== 'inactive') return false;
      if (posQ.trim()) {
        const q = posQ.trim().toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !(p.code || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const value = (p: Position): string | number => {
      switch (posSortKey) {
        case 'title': return p.title.toLowerCase();
        case 'department': return departmentName(p.departmentId).toLowerCase();
        case 'salary': return Number(p.minSalary || p.maxSalary || 0);
        case 'staff': return getEmployeesByPosition(p.id).length;
        case 'status': return p.status || '';
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
    return posSortDir === 'asc' ? sorted : sorted.reverse();
  }, [positions, posQ, posDept, posStatus, posSortKey, posSortDir, getEmployeesByPosition, departments]);

  const { page: deptPage, setPage: setDeptPage, pages: deptPages, paged: pagedDepartments } = useDeskPagination(filteredDepartments, [deptQ, deptStatus, deptSortKey, deptSortDir]);
  const { page: posPage, setPage: setPosPage, pages: posPages, paged: pagedPositions } = useDeskPagination(filteredPositions, [posQ, posDept, posStatus, posSortKey, posSortDir]);

  const onDeptSort = (key: DeptSortKey) => {
    if (deptSortKey === key) setDeptSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setDeptSortKey(key);
      setDeptSortDir('asc');
    }
  };
  const onPosSort = (key: PosSortKey) => {
    if (posSortKey === key) setPosSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setPosSortKey(key);
      setPosSortDir('asc');
    }
  };

  const deptColumn = (key: DeptSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={deptCols.style(key)}>
      <SortLabel active={deptSortKey === key} dir={deptSortDir} align={align} onPress={() => onDeptSort(key)}>{label}</SortLabel>
      {deptCols.sizer(key, label)}
    </TableColumn>
  );
  const posColumn = (key: PosSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={posCols.style(key)}>
      <SortLabel active={posSortKey === key} dir={posSortDir} align={align} onPress={() => onPosSort(key)}>{label}</SortLabel>
      {posCols.sizer(key, label)}
    </TableColumn>
  );

  const salaryRangeText = (p: Position) => {
    if (!p.minSalary && !p.maxSalary) return '—';
    return `${formatMoney(p.minSalary || 0)} – ${formatMoney(p.maxSalary || 0)}`;
  };

  const liveDept = viewDept ? departments.find((d) => d.id === viewDept.id) || viewDept : null;
  const livePos = viewPos ? positions.find((p) => p.id === viewPos.id) || viewPos : null;

  return (
    <Card className="shadow-sm border border-slate-200">
      <CardHeader className="px-3 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold text-gray-800">Departments &amp; Positions</div>
        <div className="text-xs text-gray-500">Populates Department/Position dropdowns on New Staff and User Management</div>
      </CardHeader>
      <CardBody className="p-0">
        <Tabs size="sm" variant="solid" className="w-full" classNames={deskBookTabsClassNames} selectedKey={tab} onSelectionChange={(k) => setTab(k as 'departments' | 'positions')} aria-label="Departments and positions">
          <Tab key="departments" title={`Departments (${departments.length})`}>
            <div className={`${deskBookTabPanelClassName} !px-0`}>
            <div className="flex justify-between gap-2 flex-wrap mb-2 mt-0 px-3">
              <div className="flex flex-wrap gap-2">
                <Input size="sm" placeholder="Search name or code" value={deptQ} onChange={(e) => setDeptQ(e.target.value)} variant="bordered" className="w-48" />
                <Select size="sm" selectedKeys={[deptStatus]} onSelectionChange={(k) => setDeptStatus(Array.from(k)[0] as 'all' | 'active' | 'inactive')} className="w-36" variant="bordered" aria-label="Status">
                  <SelectItem key="all">All status</SelectItem>
                  <SelectItem key="active">Active</SelectItem>
                  <SelectItem key="inactive">Inactive</SelectItem>
                </Select>
              </div>
              <Button color="primary" size="sm" onPress={openNewDepartment}>+ Add Department</Button>
            </div>
            <div ref={deptCols.frameRef} style={deptCols.frameStyle}>
              <Table aria-label="Departments table" removeWrapper classNames={deskResizableTableClassNames()}>
                <TableHeader>
                  {deptColumn('name', 'Name')}
                  {deptColumn('code', 'Code')}
                  {deptColumn('location', 'Location')}
                  {deptColumn('budget', 'Budget', 'right')}
                  {deptColumn('staff', 'Staff', 'center')}
                  {deptColumn('status', 'Status')}
                </TableHeader>
                <TableBody emptyContent="No departments match these filters.">
                  {pagedDepartments.map((d) => (
                    <TableRow key={d.id} className={rowClassNames(viewDept?.id === d.id)} onClick={() => setViewDept(d)}>
                      <TableCell className="font-semibold text-ghana-black">
                        <span className="block truncate" title={d.name}>{d.name}</span>
                        {d.description && <span className="block truncate text-xs font-normal text-gray-500" title={d.description}>{d.description}</span>}
                      </TableCell>
                      <TableCell>{d.code || '—'}</TableCell>
                      <TableCell><span className="block truncate">{d.location || '—'}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{d.budget ? formatMoney(d.budget) : '—'}</TableCell>
                      <TableCell className="text-center tabular-nums">{getEmployeesByDepartment(d.id).length}</TableCell>
                      <TableCell>
                        <Chip size="sm" color={d.status === 'inactive' ? 'default' : 'success'} variant="flat">
                          {d.status === 'inactive' ? 'inactive' : 'active'}
                        </Chip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex justify-end">
              <Pagination page={deptPage} total={deptPages} onChange={setDeptPage} showControls size="sm" />
            </div>
            </div>
          </Tab>

          <Tab key="positions" title={`Positions (${positions.length})`}>
            <div className={`${deskBookTabPanelClassName} !px-0`}>
            <div className="flex justify-between gap-2 flex-wrap mb-2 mt-0 px-3">
              <div className="flex flex-wrap gap-2">
                <Input size="sm" placeholder="Search title or code" value={posQ} onChange={(e) => setPosQ(e.target.value)} variant="bordered" className="w-48" />
                <Select size="sm" selectedKeys={[posDept]} onSelectionChange={(k) => setPosDept(Array.from(k)[0] as string)} className="w-44" variant="bordered" aria-label="Department" items={[{ id: 'all', name: 'All departments' }, ...departments.map((d) => ({ id: d.id, name: d.name }))]}>
                  {(item: { id: string; name: string }) => <SelectItem key={item.id}>{item.name}</SelectItem>}
                </Select>
                <Select size="sm" selectedKeys={[posStatus]} onSelectionChange={(k) => setPosStatus(Array.from(k)[0] as 'all' | 'active' | 'inactive')} className="w-36" variant="bordered" aria-label="Status">
                  <SelectItem key="all">All status</SelectItem>
                  <SelectItem key="active">Active</SelectItem>
                  <SelectItem key="inactive">Inactive</SelectItem>
                </Select>
              </div>
              <Button color="primary" size="sm" onPress={openNewPosition} isDisabled={departments.length === 0}>+ Add Position</Button>
            </div>
            {departments.length === 0 && (
              <p className="text-sm text-gray-500 mb-3">Add a department first — every position belongs to one.</p>
            )}
            <div ref={posCols.frameRef} style={posCols.frameStyle}>
              <Table aria-label="Positions table" removeWrapper classNames={deskResizableTableClassNames()}>
                <TableHeader>
                  {posColumn('title', 'Title')}
                  {posColumn('department', 'Department')}
                  {posColumn('salary', 'Salary range', 'right')}
                  {posColumn('staff', 'Staff', 'center')}
                  {posColumn('status', 'Status')}
                </TableHeader>
                <TableBody emptyContent="No positions match these filters.">
                  {pagedPositions.map((p) => (
                    <TableRow key={p.id} className={rowClassNames(viewPos?.id === p.id)} onClick={() => setViewPos(p)}>
                      <TableCell className="font-semibold text-ghana-black">
                        <span className="block truncate" title={p.title}>{p.title}</span>
                        {p.code && <span className="block truncate text-xs font-normal text-gray-500">{p.code}</span>}
                      </TableCell>
                      <TableCell><span className="block truncate">{departmentName(p.departmentId)}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{salaryRangeText(p)}</TableCell>
                      <TableCell className="text-center tabular-nums">{getEmployeesByPosition(p.id).length}</TableCell>
                      <TableCell>
                        <Chip size="sm" color={p.status === 'inactive' ? 'default' : 'success'} variant="flat">
                          {p.status === 'inactive' ? 'inactive' : 'active'}
                        </Chip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex justify-end">
              <Pagination page={posPage} total={posPages} onChange={setPosPage} showControls size="sm" />
            </div>
            </div>
          </Tab>
        </Tabs>
      </CardBody>

      <Modal isOpen={deptModal.isOpen} onClose={deptModal.onClose} size="lg">
        <ModalContent>
          <ModalHeader>{editingDept ? 'Edit Department' : 'Add Department'}</ModalHeader>
          <ModalBody className="gap-3">
            <Input label="Name" isRequired value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
            <Input label="Code" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} placeholder="e.g. HK, F&B" />
            <Textarea label="Description" value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} />
            <Input label="Location" value={deptForm.location} onChange={(e) => setDeptForm({ ...deptForm, location: e.target.value })} />
            <Input label="Budget (₵)" type="number" value={deptForm.budget} onChange={(e) => setDeptForm({ ...deptForm, budget: e.target.value })} />
            <Select
              label="Manager"
              selectedKeys={deptForm.managerId ? [deptForm.managerId] : []}
              onSelectionChange={(k) => setDeptForm({ ...deptForm, managerId: Array.from(k)[0] as string || '' })}
            >
              {employees.map((e) => <SelectItem key={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={deptModal.onClose}>Cancel</Button>
            <Button color="primary" onPress={saveDepartment} isDisabled={!deptForm.name.trim()}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={posModal.isOpen} onClose={posModal.onClose} size="lg">
        <ModalContent>
          <ModalHeader>{editingPos ? 'Edit Position' : 'Add Position'}</ModalHeader>
          <ModalBody className="gap-3">
            <Input label="Title" isRequired value={posForm.title} onChange={(e) => setPosForm({ ...posForm, title: e.target.value })} />
            <Input label="Code" value={posForm.code} onChange={(e) => setPosForm({ ...posForm, code: e.target.value })} />
            <Select
              label="Department"
              isRequired
              selectedKeys={posForm.departmentId ? [posForm.departmentId] : []}
              onSelectionChange={(k) => setPosForm({ ...posForm, departmentId: Array.from(k)[0] as string || '' })}
            >
              {departments.map((d) => <SelectItem key={d.id}>{d.name}</SelectItem>)}
            </Select>
            <Textarea label="Description" value={posForm.description} onChange={(e) => setPosForm({ ...posForm, description: e.target.value })} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="Min Salary" type="number" value={posForm.minSalary} onChange={(e) => setPosForm({ ...posForm, minSalary: e.target.value })} />
              <Input label="Base Salary" type="number" value={posForm.baseSalary} onChange={(e) => setPosForm({ ...posForm, baseSalary: e.target.value })} />
              <Input label="Max Salary" type="number" value={posForm.maxSalary} onChange={(e) => setPosForm({ ...posForm, maxSalary: e.target.value })} />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={posModal.onClose}>Cancel</Button>
            <Button color="primary" onPress={savePosition} isDisabled={!posForm.title.trim() || !posForm.departmentId}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!liveDept} onOpenChange={(open) => !open && setViewDept(null)} size="2xl">
        <ModalContent>
          {() => liveDept && (
            <>
              <ModalHeader>{liveDept.name}</ModalHeader>
              <ModalBody>
                <DetailGrid>
                  <DetailField label="Code" value={liveDept.code || '—'} />
                  <DetailField label="Status" value={<Chip size="sm" variant="flat" color={liveDept.status === 'inactive' ? 'default' : 'success'}>{liveDept.status === 'inactive' ? 'inactive' : 'active'}</Chip>} />
                  <DetailField label="Location" value={liveDept.location || '—'} />
                  <DetailField label="Budget" value={liveDept.budget ? formatGhs(liveDept.budget) : '—'} />
                  <DetailField label="Manager" value={managerName(liveDept.managerId)} />
                  <DetailField label="Staff count" value={String(getEmployeesByDepartment(liveDept.id).length)} />
                  <DetailField label="Description" value={liveDept.description || '—'} full />
                </DetailGrid>
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setViewDept(null)}>Close</Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="bordered"
                    onPress={() => printDetailSheet(
                      liveDept.name,
                      [
                        { label: 'Code', value: liveDept.code || '—' },
                        { label: 'Status', value: liveDept.status === 'inactive' ? 'inactive' : 'active' },
                        { label: 'Location', value: liveDept.location || '—' },
                        { label: 'Budget', value: liveDept.budget ? formatGhs(liveDept.budget) : '—' },
                        { label: 'Manager', value: managerName(liveDept.managerId) },
                        { label: 'Staff count', value: String(getEmployeesByDepartment(liveDept.id).length) },
                        { label: 'Description', value: liveDept.description || '—' },
                      ],
                    )}
                  >
                    Print
                  </Button>
                  <Button size="sm" variant="flat" onPress={() => { openEditDepartment(liveDept); setViewDept(null); }}>Edit</Button>
                  <Button size="sm" variant="flat" onPress={() => toggleDepartmentActive(liveDept)}>
                    {liveDept.status === 'inactive' ? 'Activate' : 'Deactivate'}
                  </Button>
                  <Button size="sm" color="danger" variant="flat" onPress={() => removeDepartment(liveDept)}>Delete</Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={!!livePos} onOpenChange={(open) => !open && setViewPos(null)} size="2xl">
        <ModalContent>
          {() => livePos && (
            <>
              <ModalHeader>{livePos.title}</ModalHeader>
              <ModalBody>
                <DetailGrid>
                  <DetailField label="Code" value={livePos.code || '—'} />
                  <DetailField label="Department" value={departmentName(livePos.departmentId)} />
                  <DetailField label="Status" value={<Chip size="sm" variant="flat" color={livePos.status === 'inactive' ? 'default' : 'success'}>{livePos.status === 'inactive' ? 'inactive' : 'active'}</Chip>} />
                  <DetailField label="Staff count" value={String(getEmployeesByPosition(livePos.id).length)} />
                  <DetailField label="Salary range" value={livePos.minSalary || livePos.maxSalary ? `${formatGhs(livePos.minSalary)} – ${formatGhs(livePos.maxSalary)}` : '—'} />
                  <DetailField label="Base salary" value={livePos.baseSalary ? formatGhs(livePos.baseSalary) : '—'} />
                  <DetailField label="Description" value={livePos.description || '—'} full />
                </DetailGrid>
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setViewPos(null)}>Close</Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="bordered"
                    onPress={() => printDetailSheet(
                      livePos.title,
                      [
                        { label: 'Code', value: livePos.code || '—' },
                        { label: 'Department', value: departmentName(livePos.departmentId) },
                        { label: 'Status', value: livePos.status === 'inactive' ? 'inactive' : 'active' },
                        { label: 'Staff count', value: String(getEmployeesByPosition(livePos.id).length) },
                        { label: 'Salary range', value: livePos.minSalary || livePos.maxSalary ? `${formatGhs(livePos.minSalary)} – ${formatGhs(livePos.maxSalary)}` : '—' },
                        { label: 'Base salary', value: livePos.baseSalary ? formatGhs(livePos.baseSalary) : '—' },
                        { label: 'Description', value: livePos.description || '—' },
                      ],
                    )}
                  >
                    Print
                  </Button>
                  <Button size="sm" variant="flat" onPress={() => { openEditPosition(livePos); setViewPos(null); }}>Edit</Button>
                  <Button size="sm" variant="flat" onPress={() => togglePositionActive(livePos)}>
                    {livePos.status === 'inactive' ? 'Activate' : 'Deactivate'}
                  </Button>
                  <Button size="sm" color="danger" variant="flat" onPress={() => removePosition(livePos)}>Delete</Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Card>
  );
}
