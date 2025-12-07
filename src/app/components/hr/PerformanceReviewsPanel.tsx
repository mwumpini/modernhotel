'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { usePerformanceStore } from '@/app/lib/hr/performanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';

export default function PerformanceReviewsPanel() {
  const reviews = usePerformanceStore((s) => s.reviews);
  const addReview = usePerformanceStore((s) => s.addReview);
  const updateReview = usePerformanceStore((s) => s.updateReview);
  const deleteReview = usePerformanceStore((s) => s.deleteReview);
  const employees = useEmployeeStore((s) => s.employees);

  const [status, setStatus] = React.useState<string>('all');
  const [q, setQ] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [form, setForm] = React.useState<any>({
    employeeId: employees[0]?.id || '',
    reviewPeriod: '2025-Q1',
    reviewDate: new Date().toISOString().slice(0, 10),
    reviewerId: 'hr_mgr',
    reviewerName: 'HR Manager',
    overallRating: 3,
    comments: '',
    status: 'draft'
  });

  const filtered = reviews.filter((r) => (status === 'all' || r.status === status) && (() => {
    const e = employees.find((x) => x.id === r.employeeId);
    const name = e ? `${e.firstName} ${e.lastName}` : r.employeeId;
    return name.toLowerCase().includes(q.toLowerCase());
  })());

  const create = () => {
    console.log('[HR][Reviews] add');
    addReview({
      employeeId: form.employeeId,
      reviewPeriod: form.reviewPeriod,
      reviewDate: new Date(form.reviewDate),
      reviewerId: form.reviewerId,
      reviewerName: form.reviewerName,
      overallRating: Number(form.overallRating),
      categories: {
        jobKnowledge: Number(form.overallRating),
        qualityOfWork: Number(form.overallRating),
        quantityOfWork: Number(form.overallRating),
        teamwork: Number(form.overallRating),
        communication: Number(form.overallRating),
        initiative: Number(form.overallRating),
        attendance: Number(form.overallRating),
        reliability: Number(form.overallRating)
      },
      strengths: [],
      areasForImprovement: [],
      goals: [],
      comments: form.comments,
      status: form.status,
      nextReviewDate: new Date(new Date(form.reviewDate).getTime() + 90 * 24 * 60 * 60 * 1000)
    });
    setIsOpen(false);
  };

  const statusColor = (
    s: string
  ): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' => {
    switch (s) {
      case 'draft': return 'default';
      case 'submitted': return 'primary';
      case 'reviewed': return 'secondary';
      case 'acknowledged': return 'warning';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="justify-between">
          <div className="font-medium">Performance Reviews</div>
          <div className="flex items-center gap-2">
            <Input size="sm" placeholder="Search employee" value={q} onChange={(e) => setQ(e.target.value)} variant="bordered" className="w-56" />
            <Select size="sm" selectedKeys={[status]} onSelectionChange={(k) => setStatus(Array.from(k)[0] as string)} className="w-40" variant="bordered" aria-label="Status">
              <SelectItem key="all">All</SelectItem>
              <SelectItem key="draft">Draft</SelectItem>
              <SelectItem key="submitted">Submitted</SelectItem>
              <SelectItem key="reviewed">Reviewed</SelectItem>
              <SelectItem key="acknowledged">Acknowledged</SelectItem>
              <SelectItem key="completed">Completed</SelectItem>
            </Select>
            <Button color="primary" onPress={() => setIsOpen(true)}>+ New Review</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="performance-reviews">
            <TableHeader>
              <TableColumn>EMPLOYEE</TableColumn>
              <TableColumn>PERIOD</TableColumn>
              <TableColumn>DATE</TableColumn>
              <TableColumn>REVIEWER</TableColumn>
              <TableColumn>RATING</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn></TableColumn>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const e = employees.find((x) => x.id === r.employeeId);
                const name = e ? `${e.firstName} ${e.lastName}` : r.employeeId;
                return (
                  <TableRow key={r.id}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{r.reviewPeriod}</TableCell>
                    <TableCell>{new Date(r.reviewDate).toLocaleDateString()}</TableCell>
                    <TableCell>{r.reviewerName}</TableCell>
                    <TableCell>{r.overallRating}</TableCell>
                    <TableCell><Chip size="sm" variant="flat" color={statusColor(r.status)}>{r.status}</Chip></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="flat" onPress={() => updateReview(r.id, { status: 'submitted' })}>Submit</Button>
                        <Button size="sm" variant="flat" onPress={() => updateReview(r.id, { status: 'completed' })}>Complete</Button>
                        <Button size="sm" variant="flat" color="danger" onPress={() => deleteReview(r.id)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen} size="lg">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>New Performance Review</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select label="Employee" selectedKeys={[form.employeeId]} onSelectionChange={(k) => setForm({ ...form, employeeId: Array.from(k)[0] as string })} variant="bordered">
                    {employees.map((e) => <SelectItem key={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
                  </Select>
                  <Input label="Review Period" value={form.reviewPeriod} onChange={(e) => setForm({ ...form, reviewPeriod: e.target.value })} variant="bordered" />
                  <Input label="Review Date" type="date" value={form.reviewDate} onChange={(e) => setForm({ ...form, reviewDate: e.target.value })} variant="bordered" />
                  <Input label="Reviewer" value={form.reviewerName} onChange={(e) => setForm({ ...form, reviewerName: e.target.value })} variant="bordered" />
                  <Input label="Overall Rating (1-5)" type="number" value={String(form.overallRating)} onChange={(e) => setForm({ ...form, overallRating: parseFloat(e.target.value || '0') })} variant="bordered" />
                  <Select label="Status" selectedKeys={[form.status]} onSelectionChange={(k) => setForm({ ...form, status: Array.from(k)[0] as string })} variant="bordered">
                    <SelectItem key="draft">Draft</SelectItem>
                    <SelectItem key="submitted">Submitted</SelectItem>
                    <SelectItem key="reviewed">Reviewed</SelectItem>
                    <SelectItem key="acknowledged">Acknowledged</SelectItem>
                    <SelectItem key="completed">Completed</SelectItem>
                  </Select>
                  <div className="md:col-span-2">
                    <Input label="Comments" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} variant="bordered" />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setIsOpen(false)}>Cancel</Button>
                <Button color="primary" onPress={create}>Create</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}


