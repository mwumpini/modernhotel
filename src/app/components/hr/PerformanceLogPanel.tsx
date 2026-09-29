'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Checkbox, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
import { useEmployeeStore } from '@/app/lib/hr/employeeStore';
import { usePerformanceLogStore } from '@/app/lib/hr/performanceLogStore';
import { LOG_CATEGORIES, SCORES, SCORE_GUIDE, categoryLabel, fmtScore, lastDaysFrom, summarize, type PerformanceLogEntry } from '@/app/lib/hr/performanceLog';
import { dayKey, todayKey } from '@/app/lib/hr/leaveDates';
import { useCurrentUserName } from '@/app/lib/auth/useCurrentUserName';
import { useSectionExport } from '@/app/lib/export/useSectionExport';
import { notifySuccess } from '@/app/lib/notifications/notify';
import ExportButtons from '@/app/components/ExportButtons';
import ScoreChip from './ScoreChip';
import AttachmentUpload from '@/app/components/shared/AttachmentUpload';
import type { ExportFormat } from '@/app/lib/frontoffice/reportExportFormat';
import { printDetailSheet } from '@/app/lib/print/simpleReport';
import { SortLabel, deskResizableTableClassNames, rowClassNames, useResizableColumns } from '../frontoffice/columnResize';
import { DetailGrid, DetailField } from '../frontoffice/detailView';
import { useDeskPagination } from '../dashboard/deskTableUi';

type LogSortKey = 'date' | 'staff' | 'score' | 'category' | 'note' | 'recordedBy' | 'status';

const logColumnWidths: Record<LogSortKey, number> = {
  date: 120,
  staff: 160,
  score: 72,
  category: 140,
  note: 280,
  recordedBy: 130,
  status: 120,
};

const PERIODS: Record<string, { label: string; days?: number }> = {
  '30': { label: 'Last 30 days', days: 30 },
  '90': { label: 'Last 90 days', days: 90 },
  '365': { label: 'Last 12 months', days: 365 },
  all: { label: 'All time' },
};

const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

const EMPTY_FORM = { employeeId: '', date: '', score: 0, category: 'other', note: '', attachments: [] as string[] };

export default function PerformanceLogPanel() {
  const entries = usePerformanceLogStore((s) => s.entries);
  const addEntry = usePerformanceLogStore((s) => s.addEntry);
  const respond = usePerformanceLogStore((s) => s.respond);
  const voidEntry = usePerformanceLogStore((s) => s.voidEntry);
  const hydrate = usePerformanceLogStore((s) => s.hydrateFromApi);
  const employees = useEmployeeStore((s) => s.employees);
  const userName = useCurrentUserName();
  const exportSection = useSectionExport();

  React.useEffect(() => { void hydrate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const [staff, setStaff] = React.useState('all');
  const [category, setCategory] = React.useState('all');
  const [kind, setKind] = React.useState('all');
  const [period, setPeriod] = React.useState('90');
  const [showVoided, setShowVoided] = React.useState(false);

  const [addOpen, setAddOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [sortKey, setSortKey] = React.useState<LogSortKey>('date');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const cols = useResizableColumns<LogSortKey>(logColumnWidths);
  const [responseText, setResponseText] = React.useState('');
  const [voiding, setVoiding] = React.useState(false);
  const [voidReason, setVoidReason] = React.useState('');

  const nameOf = (id: string) => { const e = employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };
  const current = employees.filter((e) => e.status !== 'terminated' && e.status !== 'inactive');

  const fromKey = PERIODS[period].days ? lastDaysFrom(PERIODS[period].days!) : undefined;
  const rows = React.useMemo(() => {
    const filtered = entries.filter((e) => (showVoided || e.status === 'active')
      && (staff === 'all' || e.employeeId === staff)
      && (category === 'all' || e.category === category)
      && (kind === 'all' || (kind === 'good' ? e.score > 0 : e.score < 0))
      && (!fromKey || dayKey(e.date) >= fromKey));
    const value = (e: PerformanceLogEntry): string | number => {
      switch (sortKey) {
        case 'date': return dayKey(e.date);
        case 'staff': return nameOf(e.employeeId).toLowerCase();
        case 'score': return e.score;
        case 'category': return categoryLabel(e.category);
        case 'note': return (e.note || '').toLowerCase();
        case 'recordedBy': return (e.recordedByName || '').toLowerCase();
        case 'status': return e.status;
        default: return '';
      }
    };
    const sorted = [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1;
      if (av > bv) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [entries, showVoided, staff, category, kind, fromKey, sortKey, sortDir, employees]);
  const { page, setPage, pages, paged } = useDeskPagination(rows, [showVoided, staff, category, kind, period, sortKey, sortDir]);
  const summary = summarize(rows);

  const onSort = (key: LogSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc'); }
  };

  const column = (key: LogSortKey, label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <TableColumn key={key} className="relative" style={cols.style(key)}>
      <SortLabel active={sortKey === key} dir={sortDir} align={align} onPress={() => onSort(key)}>{label}</SortLabel>
      {cols.sizer(key, label)}
    </TableColumn>
  );

  const today = todayKey();
  const formValid = !!form.employeeId && !!form.date && form.score !== 0 && form.note.trim().length > 0 && form.date <= today;

  const save = () => {
    if (!formValid) return;
    addEntry({ ...form, note: form.note.trim(), recordedByName: userName });
    notifySuccess(`${form.score > 0 ? 'Commendation' : 'Concern'} recorded for ${nameOf(form.employeeId)}`, 'Performance log');
    setAddOpen(false);
  };

  const detail: PerformanceLogEntry | undefined = entries.find((e) => e.id === detailId);
  const openDetail = (e: PerformanceLogEntry) => { setDetailId(e.id); setResponseText(e.employeeResponse || ''); setVoiding(false); setVoidReason(''); };

  const download = (format: ExportFormat) =>
    exportSection(format, 'Performance Log', {
      title: `Performance Log — ${PERIODS[period].label}`,
      columns: ['Date', 'Staff', 'Score', 'Category', 'What happened', 'Recorded by', 'Status', 'Staff response'],
      rows: rows.map((e) => [fmtDate(e.date), nameOf(e.employeeId), fmtScore(e.score), categoryLabel(e.category), e.note, e.recordedByName || '', e.status === 'voided' ? `Voided: ${e.voidedReason || ''}` : 'Active', e.employeeResponse || '']),
    });

  return (
    <Card>
      <CardHeader className="justify-between gap-2 flex-wrap">
        <div>
          <div className="font-medium">Performance Log</div>
          <div className="text-xs text-gray-500">Record good and bad moments as they happen — scored −5 to −1 or +1 to +5 ({SCORE_GUIDE}).</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select size="sm" aria-label="Staff" className="w-44" variant="bordered" selectedKeys={[staff]} onSelectionChange={(k) => setStaff(Array.from(k)[0] as string)}
            items={[{ id: 'all', name: 'All staff' }, ...current.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))]}>
            {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
          </Select>
          <Select size="sm" aria-label="Category" className="w-44" variant="bordered" selectedKeys={[category]} onSelectionChange={(k) => setCategory(Array.from(k)[0] as string)}>
            {[<SelectItem key="all">All categories</SelectItem>, ...Object.entries(LOG_CATEGORIES).map(([k, l]) => <SelectItem key={k}>{l}</SelectItem>)]}
          </Select>
          <Select size="sm" aria-label="Type" className="w-36" variant="bordered" selectedKeys={[kind]} onSelectionChange={(k) => setKind(Array.from(k)[0] as string)}>
            <SelectItem key="all">Good and bad</SelectItem>
            <SelectItem key="good">Good only</SelectItem>
            <SelectItem key="bad">Concerns only</SelectItem>
          </Select>
          <Select size="sm" aria-label="Period" className="w-36" variant="bordered" selectedKeys={[period]} onSelectionChange={(k) => setPeriod(Array.from(k)[0] as string)}>
            {Object.entries(PERIODS).map(([k, p]) => <SelectItem key={k}>{p.label}</SelectItem>)}
          </Select>
          <Checkbox size="sm" isSelected={showVoided} onValueChange={setShowVoided}>Show voided</Checkbox>
          <Chip variant="flat" color={summary.net > 0 ? 'success' : summary.net < 0 ? 'danger' : 'default'}>Net {summary.net > 0 ? `+${summary.net}` : summary.net}</Chip>
          <ExportButtons onDownload={download} />
          <Button size="sm" color="primary" onPress={() => { setForm({ ...EMPTY_FORM, employeeId: staff !== 'all' ? staff : '', date: today }); setAddOpen(true); }}>+ Record entry</Button>
        </div>
      </CardHeader>
      <CardBody>
        <div ref={cols.frameRef} style={cols.frameStyle}>
          <Table aria-label="performance-log" removeWrapper classNames={deskResizableTableClassNames()}>
            <TableHeader>
              {column('date', 'Date')}
              {column('staff', 'Staff')}
              {column('score', 'Score', 'center')}
              {column('category', 'Category')}
              {column('note', 'What happened')}
              {column('recordedBy', 'Recorded by')}
              {column('status', 'Status')}
            </TableHeader>
            <TableBody emptyContent="No entries for these filters — record the first one with “+ Record entry”.">
              {paged.map((e) => (
                <TableRow
                  key={e.id}
                  className={`${rowClassNames(detailId === e.id)} ${e.status === 'voided' ? 'opacity-50' : ''}`}
                  onClick={() => openDetail(e)}
                >
                  <TableCell>{fmtDate(e.date)}</TableCell>
                  <TableCell className="font-semibold text-ghana-black">
                    <span className="block truncate" title={nameOf(e.employeeId)}>{nameOf(e.employeeId)}</span>
                  </TableCell>
                  <TableCell className="text-center"><ScoreChip score={e.score} /></TableCell>
                  <TableCell>{categoryLabel(e.category)}</TableCell>
                  <TableCell>
                    <span className="block truncate" title={e.note}>{e.note}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block truncate" title={e.recordedByName || '—'}>{e.recordedByName || '—'}</span>
                  </TableCell>
                  <TableCell>
                    {e.status === 'voided'
                      ? <Chip size="sm" variant="flat">Voided</Chip>
                      : e.employeeResponse ? <Chip size="sm" variant="flat" color="primary">Staff responded</Chip> : <Chip size="sm" variant="flat" color="default">Recorded</Chip>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex justify-end">
          <Pagination page={page} total={pages} onChange={setPage} showControls size="sm" />
        </div>
      </CardBody>

      <Modal isOpen={addOpen} onOpenChange={setAddOpen} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Record a performance entry</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select label="Staff" isRequired selectedKeys={form.employeeId ? [form.employeeId] : []} onSelectionChange={(k) => setForm({ ...form, employeeId: (Array.from(k)[0] as string) || '' })} variant="bordered"
                    items={current.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}>
                    {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
                  </Select>
                  <Input label="Date it happened" type="date" isRequired max={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} variant="bordered" />
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Score <span className="text-red-500">*</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    {SCORES.map((n) => (
                      <Button key={n} size="sm" radius="sm" variant={form.score === n ? 'solid' : 'flat'} color={n > 0 ? 'success' : 'danger'} className="min-w-12" onPress={() => setForm({ ...form, score: n })}>
                        {fmtScore(n)}
                      </Button>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{SCORE_GUIDE}. Red = a concern, green = a commendation.</div>
                </div>
                <Select label="Category" selectedKeys={[form.category]} onSelectionChange={(k) => setForm({ ...form, category: Array.from(k)[0] as string })} variant="bordered">
                  {Object.entries(LOG_CATEGORIES).map(([k, l]) => <SelectItem key={k}>{l}</SelectItem>)}
                </Select>
                <Textarea label="What happened" isRequired minRows={3} placeholder="Be specific: what was done or said, where, and who was affected." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} variant="bordered" />
                <AttachmentUpload label="Evidence (photo, report — optional)" attachments={form.attachments} onChange={(next) => setForm({ ...form, attachments: next })} />
                {form.score < 0 && <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">The staff member will be able to see this entry and add their side. Entries can be voided with a reason but never deleted.</div>}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setAddOpen(false)}>Cancel</Button>
                <Button color="primary" onPress={save} isDisabled={!formValid}>Save entry</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={!!detail} onOpenChange={(open) => { if (!open) setDetailId(null); }} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {() => detail && (
            <>
              <ModalHeader className="flex items-center gap-2">{nameOf(detail.employeeId)} <ScoreChip score={detail.score} />{detail.status === 'voided' && <Chip size="sm" variant="flat">Voided</Chip>}</ModalHeader>
              <ModalBody className="space-y-4">
                <DetailGrid>
                  <DetailField label="Date" value={fmtDate(detail.date)} />
                  <DetailField label="Category" value={categoryLabel(detail.category)} />
                  <DetailField label="Recorded by" value={detail.recordedByName || '—'} />
                  <DetailField label="Score" value={<ScoreChip score={detail.score} />} />
                </DetailGrid>
                <DetailField label="What happened" value={detail.note} full />
                {detail.attachments.length > 0 && (
                  <div className="text-sm"><p className="text-gray-500">Evidence</p>
                    <ul className="list-disc ml-5">{detail.attachments.map((u) => <li key={u}><a className="text-blue-600 underline" href={u} target="_blank" rel="noreferrer">{decodeURIComponent(u.split('/').pop() || u)}</a></li>)}</ul>
                  </div>
                )}
                {detail.status === 'voided' ? (
                  <div className="text-sm bg-gray-50 border rounded p-2">Voided by {detail.voidedBy || '—'}{detail.voidedAt ? ` on ${fmtDate(detail.voidedAt)}` : ''}: {detail.voidedReason}</div>
                ) : (
                  <Textarea label="Staff member's response" minRows={2} placeholder="Their side of what happened (optional)" value={responseText} onChange={(e) => setResponseText(e.target.value)} variant="bordered"
                    description={detail.respondedAt ? `Last saved ${fmtDate(detail.respondedAt)}` : undefined} />
                )}
                {voiding && (
                  <Input label="Why is this entry being voided?" isRequired value={voidReason} onChange={(e) => setVoidReason(e.target.value)} variant="bordered" autoFocus />
                )}
              </ModalBody>
              <ModalFooter className="flex flex-wrap justify-between gap-2">
                <Button variant="flat" onPress={() => setDetailId(null)}>Close</Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="bordered"
                    onPress={() => printDetailSheet(
                      nameOf(detail.employeeId),
                      [
                        { label: 'Date', value: fmtDate(detail.date) },
                        { label: 'Category', value: categoryLabel(detail.category) },
                        { label: 'Recorded by', value: detail.recordedByName || '—' },
                        { label: 'Score', value: fmtScore(detail.score) },
                        { label: 'What happened', value: detail.note },
                        ...(detail.status === 'voided'
                          ? [{ label: 'Voided', value: `by ${detail.voidedBy || '—'}${detail.voidedAt ? ` on ${fmtDate(detail.voidedAt)}` : ''}: ${detail.voidedReason || ''}` }]
                          : [{ label: "Staff member's response", value: detail.employeeResponse || responseText || '—' }]),
                      ],
                      detail.status === 'voided' ? 'Voided' : undefined,
                    )}
                  >
                    Print
                  </Button>
                  {detail.status === 'active' && !voiding && <Button variant="flat" color="danger" onPress={() => setVoiding(true)}>Void entry</Button>}
                  {voiding && <Button color="danger" isDisabled={!voidReason.trim()} onPress={() => { voidEntry(detail.id, voidReason, userName); setDetailId(null); }}>Confirm void</Button>}
                  {detail.status === 'active' && !voiding && (
                    <Button color="primary" isDisabled={responseText.trim() === (detail.employeeResponse || '') || !responseText.trim()} onPress={() => { respond(detail.id, responseText); }}>Save response</Button>
                  )}
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Card>
  );
}
