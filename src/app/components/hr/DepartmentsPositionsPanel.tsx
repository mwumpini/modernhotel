'use client';

import React from 'react';
import {
  Card, CardBody, CardHeader, Button, Input, Textarea, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Chip, Tabs, Tab,
} from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import type { Department, Position } from '@/app/lib/hr/models';

const emptyDepartmentForm = {
  name: '', code: '', description: '', location: '', budget: '', managerId: '',
};
const emptyPositionForm = {
  title: '', code: '', departmentId: '', description: '', minSalary: '', maxSalary: '', baseSalary: '',
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

  // --- Departments ---
  const deptModal = useDisclosure();
  const [editingDept, setEditingDept] = React.useState<Department | null>(null);
  const [deptForm, setDeptForm] = React.useState(emptyDepartmentForm);

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
  const removeDepartment = (d: Department) => {
    const staffCount = getEmployeesByDepartment(d.id).length;
    const posCount = positions.filter((p) => p.departmentId === d.id).length;
    const warning = staffCount > 0 || posCount > 0
      ? ` It still has ${staffCount} staff and ${posCount} position(s) referencing it — deleting it won't remove those, but they'll point at a department that no longer exists.`
      : '';
    if (!window.confirm(`Delete "${d.name}"?${warning}`)) return;
    deleteDepartment(d.id);
  };

  // --- Positions ---
  const posModal = useDisclosure();
  const [editingPos, setEditingPos] = React.useState<Position | null>(null);
  const [posForm, setPosForm] = React.useState(emptyPositionForm);

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
  const removePosition = (p: Position) => {
    const staffCount = getEmployeesByPosition(p.id).length;
    const warning = staffCount > 0
      ? ` ${staffCount} staff member(s) currently hold this position — deleting it won't remove them, but they'll point at a position that no longer exists.`
      : '';
    if (!window.confirm(`Delete "${p.title}"?${warning}`)) return;
    deletePosition(p.id);
  };

  const departmentName = (id: string) => departments.find((d) => d.id === id)?.name || 'Unknown';

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="font-semibold text-lg">Departments &amp; Positions</div>
        <div className="text-xs text-gray-500">Populates the Department/Position dropdowns on New Staff and Settings → User Management</div>
      </CardHeader>
      <CardBody>
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(k as 'departments' | 'positions')}>
          <Tab key="departments" title={`Departments (${departments.length})`}>
            <div className="flex justify-end mb-3 mt-3">
              <Button color="primary" size="sm" onPress={openNewDepartment}>+ Add Department</Button>
            </div>
            <Table aria-label="Departments table" removeWrapper>
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                <TableColumn>CODE</TableColumn>
                <TableColumn>LOCATION</TableColumn>
                <TableColumn>BUDGET</TableColumn>
                <TableColumn>STAFF</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No departments yet — add one to start populating the New Staff form.">
                {departments.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-gray-500">{d.description}</div>
                    </TableCell>
                    <TableCell>{d.code || '—'}</TableCell>
                    <TableCell>{d.location || '—'}</TableCell>
                    <TableCell>{d.budget ? `₵${d.budget.toLocaleString()}` : '—'}</TableCell>
                    <TableCell>{getEmployeesByDepartment(d.id).length}</TableCell>
                    <TableCell>
                      <Chip size="sm" color={d.status === 'inactive' ? 'default' : 'success'} variant="flat">
                        {d.status === 'inactive' ? 'inactive' : 'active'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="flat" onPress={() => openEditDepartment(d)}>Edit</Button>
                        <Button size="sm" variant="flat" onPress={() => toggleDepartmentActive(d)}>
                          {d.status === 'inactive' ? 'Activate' : 'Deactivate'}
                        </Button>
                        <Button size="sm" color="danger" variant="flat" onPress={() => removeDepartment(d)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Tab>

          <Tab key="positions" title={`Positions (${positions.length})`}>
            <div className="flex justify-end mb-3 mt-3">
              <Button color="primary" size="sm" onPress={openNewPosition} isDisabled={departments.length === 0}>+ Add Position</Button>
            </div>
            {departments.length === 0 && (
              <p className="text-sm text-gray-500 mb-3">Add a department first — every position belongs to one.</p>
            )}
            <Table aria-label="Positions table" removeWrapper>
              <TableHeader>
                <TableColumn>TITLE</TableColumn>
                <TableColumn>DEPARTMENT</TableColumn>
                <TableColumn>SALARY RANGE</TableColumn>
                <TableColumn>STAFF</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No positions yet — add one to start populating the New Staff form.">
                {positions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-gray-500">{p.code || ''}</div>
                    </TableCell>
                    <TableCell>{departmentName(p.departmentId)}</TableCell>
                    <TableCell>
                      {p.minSalary || p.maxSalary
                        ? `₵${(p.minSalary || 0).toLocaleString()} – ₵${(p.maxSalary || 0).toLocaleString()}`
                        : '—'}
                    </TableCell>
                    <TableCell>{getEmployeesByPosition(p.id).length}</TableCell>
                    <TableCell>
                      <Chip size="sm" color={p.status === 'inactive' ? 'default' : 'success'} variant="flat">
                        {p.status === 'inactive' ? 'inactive' : 'active'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="flat" onPress={() => openEditPosition(p)}>Edit</Button>
                        <Button size="sm" variant="flat" onPress={() => togglePositionActive(p)}>
                          {p.status === 'inactive' ? 'Activate' : 'Deactivate'}
                        </Button>
                        <Button size="sm" color="danger" variant="flat" onPress={() => removePosition(p)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Tab>
        </Tabs>
      </CardBody>

      {/* Department modal */}
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

      {/* Position modal */}
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
    </Card>
  );
}
