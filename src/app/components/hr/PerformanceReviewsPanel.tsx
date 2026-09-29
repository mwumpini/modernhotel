'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import { usePerformanceStore } from '@/app/lib/hr/performanceStore';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { usePerformanceLogStore } from '@/app/lib/hr/performanceLogStore';
import { categoryLabel, fmtScore, reviewPeriodRange, summarize, type LogCategory } from '@/app/lib/hr/performanceLog';
import { dayKey } from '@/app/lib/hr/leaveDates';
import { useCurrentUserName } from '@/app/lib/auth/useCurrentUserName';
import type { PerformanceReview } from '@/app/lib/hr/models';
import { printDetailSheet } from '@/app/lib/print/simpleReport';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailGrid, DetailField } from '../frontoffice/detailView';
import { useDeskPagination } from '../dashboard/deskTableUi';
import ScoreChip from './ScoreChip';

type ReviewSortKey = 'employee' | 'period' | 'date' | 'reviewer' | 'rating' | 'status';

const reviewColumnWidths: Record<ReviewSortKey, number> = {
  employee: 160,
  period: 100,
  date: 110,
  reviewer: 140,
  rating: 80,
  status: 120,
};

type CategoryKey = keyof PerformanceReview['categories'];

/** The eight things a review rates. `logCategories` are the Performance Log categories that
 * are evidence for it, shown beside the rating — they inform it, they don't set it. */
const REVIEW_CATEGORIES: Array<{ key: CategoryKey; label: string; logCategories: LogCategory[] }> = [
  { key: 'jobKnowledge', label: 'Job knowledge', logCategories: [] },
  { key: 'qualityOfWork', label: 'Quality of work', logCategories: ['guest_service', 'hygiene_safety'] },
  { key: 'quantityOfWork', label: 'Quantity of work', logCategories: [] },
  { key: 'teamwork', label: 'Teamwork', logCategories: ['teamwork'] },
  { key: 'communication', label: 'Communication', logCategories: [] },
  { key: 'initiative', label: 'Initiative', logCategories: ['initiative'] },
  { key: 'attendance', label: 'Attendance & punctuality', logCategories: ['punctuality'] },
  { key: 'reliability', label: 'Reliability & conduct', logCategories: ['cash_handling', 'conduct'] },
];
const RATING_LABELS: Record<number, string> = { 1: 'Poor', 2: 'Needs improvement', 3: 'Meets expectations', 4: 'Exceeds expectations', 5: 'Outstanding' };
const average = (nums: number[]) => (nums.length ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10 : 0);

const today = () => new Date().toISOString().slice(0, 10);
const currentQuarter = () => { const d = new Date(); return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`; };

type FormState = {
  employeeId: string;
  reviewPeriod: string;
  reviewDate: string;
  reviewerName: string;
  ratings: Partial<Record<CategoryKey, number>>;
  comments: string;
  status: PerformanceReview['status'];
};

export default function PerformanceReviewsPanel() {
  const reviews = usePerformanceStore((s) => s.reviews);
  const addReview = usePerformanceStore((s) => s.addReview);
  const updateReview = usePerformanceStore((s) => s.updateReview);
  const deleteReview = usePerformanceStore((s) => s.deleteReview);
  const employees = useEmployeeStore((s) => s.employees);
  const logEntries = usePerformanceLogStore((s) => s.entries);
  const hydrateLog = usePerformanceLogStore((s) => s.hydrateFromApi);
  const userName = useCurrentUserName();
  React.useEffect(() => { void hydrateLog(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const [status, setStatus] = React.useState<string>('all');
  const [q, setQ] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<PerformanceReview | null>(null);
  const [sortKey, setSortKey] = React.useState<ReviewSortKey>('date');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const cols = useResizableColumns<ReviewSortKey>(reviewColumnWidths);
  const [form, setForm] = React.useState<FormState>({ employeeId: '', reviewPeriod: '', reviewDate: '', reviewerName: '', ratings: {}, comments: '', status: 'draft' });

  const current = employees.filter((e) => e.status !== 'terminated' && e.status !== 'inactive');
  const nameOf = (id: string) => { const e = employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };

  // Defaults are worked out when the form opens (current quarter, the logged-in reviewer, the
  // staff list as it is now) rather than frozen when the page first rendered.
  const openNew = () => {
    setForm({ employeeId: current[0]?.id || '', reviewPeriod: currentQuarter(), reviewDate: today(), reviewerName: userName, ratings: {}, comments: '', status: 'draft' });
    setIsOpen(true);
  };

  // If staff were still loading when the form opened, pick the first one as soon as they arrive.
  React.useEffect(() => {
    if (isOpen && !form.employeeId && current.length > 0) setForm((f) => ({ ...f, employeeId: current[0].id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, current.length]);

  const filtered = React.useMemo(() => {
    const rows = reviews.filter((r) => (status === 'all' || r.status === status) && nameOf(r.employeeId).toLowerCase().includes(q.toLowerCase()));
    const value = (r: PerformanceReview): string | number => {
      switch (sortKey) {
        case 'employee': return nameOf(r.employeeId).toLowerCase();
        case 'period': return r.reviewPeriod || '';
        case 'date': return new Date(r.reviewDate).getTime();
        case 'reviewer': return (r.reviewerName || '').toLowerCase();
        case 'rating': return Number(r.overallRating || 0);
        case 'status': return r.status || '';
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
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [reviews, status, q, sortKey, sortDir, employees]);

  const { page, setPage, pages, paged } = useDeskPagination(filtered, [status, q, sortKey, sortDir]);

  const onSort = (key: ReviewSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const column = (key: ReviewSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const allRated = REVIEW_CATEGORIES.every((c) => !!form.ratings[c.key]);
  const overall = average(REVIEW_CATEGORIES.map((c) => form.ratings[c.key] || 0).filter(Boolean));

  const create = () => {
    if (!form.employeeId || !allRated) return;
    const categories = Object.fromEntries(REVIEW_CATEGORIES.map((c) => [c.key, form.ratings[c.key] as number])) as PerformanceReview['categories'];
    addReview({
      employeeId: form.employeeId,
      reviewPeriod: form.reviewPeriod,
      reviewDate: new Date(form.reviewDate),
      reviewerId: form.reviewerName,
      reviewerName: form.reviewerName,
      overallRating: overall,
      categories,
      strengths: [],
      areasForImprovement: [],
      goals: [],
      comments: form.comments,
      status: form.status,
      nextReviewDate: new Date(new Date(form.reviewDate).getTime() + 90 * 24 * 60 * 60 * 1000),
    });
    setIsOpen(false);
  };

  // What the Performance Log recorded for this person over the review period — the evidence
  // the ratings should rest on.
  const range = reviewPeriodRange(form.reviewPeriod || '', form.reviewDate || today());
  const periodEntries = logEntries
    .filter((e) => e.employeeId === form.employeeId && e.status === 'active' && dayKey(e.date) >= range.from && dayKey(e.date) <= range.to);
  const periodSummary = summarize(periodEntries);
  const highlights = [...periodEntries].sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 5);
  const addLogToComments = () => {
    const lines = highlights.map((e) => `${fmtScore(e.score)} ${categoryLabel(e.category)}: ${e.note}`);
    const text = `Performance log ${range.from} to ${range.to}: net ${fmtScore(periodSummary.net)} (${periodSummary.positives} good, ${periodSummary.negatives} concerns).${lines.length ? ' Highlights — ' + lines.join('; ') : ''}`;
    setForm({ ...form, comments: form.comments ? `${form.comments}\n${text}` : text });
  };
  const evidenceFor = (logCategories: LogCategory[]) => summarize(periodEntries.filter((e) => logCategories.includes(e.category as LogCategory)));

  const viewed = viewing ? reviews.find((r) => r.id === viewing.id) || viewing : null;

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
            <Button color="primary" onPress={openNew}>+ New Review</Button>
          </div>
        </CardHeader>
        <CardBody>
          <div ref={cols.frameRef} style={cols.frameStyle}>
            <Table aria-label="performance-reviews" removeWrapper classNames={deskResizableTableClassNames()}>
              <TableHeader>
                {column('employee', 'Employee')}
                {column('period', 'Period')}
                {column('date', 'Date')}
                {column('reviewer', 'Reviewer')}
                {column('rating', 'Rating', 'center')}
                {column('status', 'Status')}
              </TableHeader>
              <TableBody emptyContent="No reviews match these filters.">
                {paged.map((r) => (
                  <TableRow
                    key={r.id}
                    className={rowClassNames(viewing?.id === r.id)}
                    onClick={() => setViewing(r)}
                  >
                    <TableCell className="font-semibold text-ghana-black">
                      <span className="block truncate" title={nameOf(r.employeeId)}>{nameOf(r.employeeId)}</span>
                    </TableCell>
                    <TableCell>{r.reviewPeriod}</TableCell>
                    <TableCell>{new Date(r.reviewDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className="block truncate" title={r.reviewerName}>{r.reviewerName}</span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{r.overallRating}</TableCell>
                    <TableCell><Chip size="sm" variant="flat" color={statusColor(r.status)}>{r.status}</Chip></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex justify-end">
            <Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen} size="3xl" scrollBehavior="inside">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>New Performance Review</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select label="Employee" selectedKeys={form.employeeId ? [form.employeeId] : []} onSelectionChange={(k) => setForm({ ...form, employeeId: (Array.from(k)[0] as string) || '' })} variant="bordered">
                    {current.map((e) => <SelectItem key={e.id} textValue={`${e.firstName} ${e.lastName}`}>{`${e.firstName} ${e.lastName}`}</SelectItem>)}
                  </Select>
                  <Input label="Review Period" description="e.g. 2026-Q3" value={form.reviewPeriod} onChange={(e) => setForm({ ...form, reviewPeriod: e.target.value })} variant="bordered" />
                  <Input label="Review Date" type="date" value={form.reviewDate} onChange={(e) => setForm({ ...form, reviewDate: e.target.value })} variant="bordered" />
                  <Input label="Reviewer" value={form.reviewerName} onChange={(e) => setForm({ ...form, reviewerName: e.target.value })} variant="bordered" />
                  <Select label="Status" selectedKeys={[form.status]} onSelectionChange={(k) => setForm({ ...form, status: Array.from(k)[0] as PerformanceReview['status'] })} variant="bordered">
                    <SelectItem key="draft">Draft</SelectItem>
                    <SelectItem key="submitted">Submitted</SelectItem>
                    <SelectItem key="reviewed">Reviewed</SelectItem>
                    <SelectItem key="acknowledged">Acknowledged</SelectItem>
                    <SelectItem key="completed">Completed</SelectItem>
                  </Select>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-medium">From the Performance Log ({range.from} to {range.to})</div>
                    {periodEntries.length > 0 && <Button size="sm" variant="flat" onPress={addLogToComments}>Add summary to comments</Button>}
                  </div>
                  {periodEntries.length === 0 ? (
                    <div className="text-xs text-gray-500 mt-1">Nothing recorded for this person in this period.</div>
                  ) : (
                    <>
                      <div className="mt-1">Net <span className={`font-semibold ${periodSummary.net > 0 ? 'text-green-700' : periodSummary.net < 0 ? 'text-red-600' : ''}`}>{fmtScore(periodSummary.net)}</span> · {periodSummary.positives} good · {periodSummary.negatives} concerns</div>
                      <div className="mt-2 space-y-1">
                        {highlights.map((e) => (
                          <div key={e.id} className="flex items-center gap-2 text-xs">
                            <ScoreChip score={e.score} />
                            <span className="w-28 shrink-0 text-gray-600">{categoryLabel(e.category)}</span>
                            <span className="truncate" title={e.note}>{e.note}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Ratings <span className="text-gray-500 font-normal">— 1 Poor · 3 Meets expectations · 5 Outstanding</span></div>
                    <div className="text-sm">Overall: <span className="font-semibold">{allRated ? `${overall} / 5` : '—'}</span> <span className="text-xs text-gray-500">(average of the eight)</span></div>
                  </div>
                  <div className="space-y-1.5">
                    {REVIEW_CATEGORIES.map((c) => {
                      const ev = c.logCategories.length ? evidenceFor(c.logCategories) : null;
                      const value = form.ratings[c.key];
                      return (
                        <div key={c.key} className="flex items-center gap-3 flex-wrap">
                          <div className="w-52 text-sm">{c.label}</div>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Button key={n} size="sm" radius="sm" className="min-w-9" variant={value === n ? 'solid' : 'flat'} color={value === n ? 'primary' : 'default'}
                                onPress={() => setForm({ ...form, ratings: { ...form.ratings, [c.key]: n } })}>{n}</Button>
                            ))}
                          </div>
                          <div className="text-xs text-gray-500 w-36">{value ? RATING_LABELS[value] : 'Not rated'}</div>
                          {ev && ev.count > 0 && (
                            <Chip size="sm" variant="flat" color={ev.net > 0 ? 'success' : ev.net < 0 ? 'danger' : 'default'} title="Performance Log entries for this area, in this period">
                              log {fmtScore(ev.net)} ({ev.count})
                            </Chip>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Textarea label="Comments" minRows={2} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} variant="bordered" />
              </ModalBody>
              <ModalFooter className="justify-between">
                <div className="text-xs text-gray-500">{allRated ? '' : 'Rate all eight areas to create the review.'}</div>
                <div className="flex gap-2">
                  <Button variant="flat" onPress={() => setIsOpen(false)}>Cancel</Button>
                  <Button color="primary" onPress={create} isDisabled={!form.employeeId || !allRated}>Create</Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={!!viewed} onOpenChange={(open) => { if (!open) setViewing(null); }} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {() => viewed && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span>{nameOf(viewed.employeeId)}</span>
                <span className="text-sm font-normal text-gray-500">{viewed.reviewPeriod} · {viewed.status}</span>
              </ModalHeader>
              <ModalBody className="space-y-4">
                <DetailGrid>
                  <DetailField label="Reviewer" value={viewed.reviewerName} />
                  <DetailField label="Date" value={new Date(viewed.reviewDate).toLocaleDateString('en-GB')} />
                  <DetailField label="Overall" value={`${viewed.overallRating} / 5`} />
                  <DetailField label="Status" value={<Chip size="sm" variant="flat" color={statusColor(viewed.status)}>{viewed.status}</Chip>} />
                </DetailGrid>
                <div className="space-y-1.5">
                  {REVIEW_CATEGORIES.map((c) => {
                    const v = viewed.categories?.[c.key] ?? 0;
                    return (
                      <div key={c.key} className="flex items-center gap-3 text-sm">
                        <div className="w-52 shrink-0">{c.label}</div>
                        <div className="flex-1 h-2 rounded bg-gray-100"><div className="h-2 rounded bg-blue-500" style={{ width: `${(v / 5) * 100}%` }} /></div>
                        <div className="w-8 text-right font-medium tabular-nums">{v}</div>
                      </div>
                    );
                  })}
                </div>
                {viewed.comments && <DetailField label="Comments" value={viewed.comments} full />}
                <p className="text-xs text-gray-500">Reviews saved before this update recorded one rating for all eight areas, so their breakdown is not meaningful.</p>
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setViewing(null)}>Close</Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="bordered"
                    onPress={() => printDetailSheet(
                      nameOf(viewed.employeeId),
                      [
                        { label: 'Reviewer', value: viewed.reviewerName },
                        { label: 'Date', value: new Date(viewed.reviewDate).toLocaleDateString('en-GB') },
                        { label: 'Overall', value: `${viewed.overallRating} / 5` },
                        { label: 'Status', value: viewed.status },
                        ...REVIEW_CATEGORIES.map((c) => ({
                          label: c.label,
                          value: String(viewed.categories?.[c.key] ?? 0),
                        })),
                        { label: 'Comments', value: viewed.comments || '—' },
                      ],
                      `${viewed.reviewPeriod} · ${viewed.status}`,
                    )}
                  >
                    Print
                  </Button>
                  <Button variant="flat" onPress={() => updateReview(viewed.id, { status: 'submitted' })}>Submit</Button>
                  <Button variant="flat" onPress={() => updateReview(viewed.id, { status: 'completed' })}>Complete</Button>
                  <Button variant="flat" color="danger" onPress={() => { deleteReview(viewed.id); setViewing(null); }}>Delete</Button>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
