'use client';

import React from 'react';
import { Button, Card, CardBody, CardHeader, Checkbox, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from '@heroui/react';
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
  const [responseText, setResponseText] = React.useState('');
  const [voiding, setVoiding] = React.useState(false);
  const [voidReason, setVoidReason] = React.useState('');

  const nameOf = (id: string) => { const e = employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };
  const current = employees.filter((e) => e.status !== 'terminated' && e.status !== 'inactive');

  const fromKey = PERIODS[period].days ? lastDaysFrom(PERIODS[period].days!) : undefined;
  const rows = entries
    .filter((e) => (showVoided || e.status === 'active')
      && (staff === 'all' || e.employeeId === staff)
      && (category === 'all' || e.category === category)
      && (kind === 'all' || (kind === 'good' ? e.score > 0 : e.score < 0))
      && (!fromKey || dayKey(e.date) >= fromKey))
    .sort((a, b) => dayKey(b.date).localeCompare(dayKey(a.date)) || b.createdAt.getTime() - a.createdAt.getTime());
  const summary = summarize(rows);

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
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButtons onDownload={download} />
          <Button size="sm" color="primary" onPress={() => { setForm({ ...EMPTY_FORM, employeeId: staff !== 'all' ? staff : '', date: today }); setAddOpen(true); }}>+ Record entry</Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Select size="sm" aria-label="Staff" className="w-48" variant="bordered" selectedKeys={[staff]} onSelectionChange={(k) => setStaff(Array.from(k)[0] as string)}
            items={[{ id: 'all', name: 'All staff' }, ...current.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))]}>
            {(item: any) => <SelectItem key={item.id}>{item.name}</SelectItem>}
          </Select>
          <Select size="sm" aria-label="Category" className="w-48" variant="bordered" selectedKeys={[category]} onSelectionChange={(k) => setCategory(Array.from(k)[0] as string)}>
            {[<SelectItem key="all">All categories</SelectItem>, ...Object.entries(LOG_CATEGORIES).map(([k, l]) => <SelectItem key={k}>{l}</SelectItem>)]}
          </Select>
          <Select size="sm" aria-label="Type" className="w-40" variant="bordered" selectedKeys={[kind]} onSelectionChange={(k) => setKind(Array.from(k)[0] as string)}>
            <SelectItem key="all">Good and bad</SelectItem>
            <SelectItem key="good">Good only</SelectItem>
            <SelectItem key="bad">Concerns only</SelectItem>
          </Select>
          <Select size="sm" aria-label="Period" className="w-40" variant="bordered" selectedKeys={[period]} onSelectionChange={(k) => setPeriod(Array.from(k)[0] as string)}>
            {Object.entries(PERIODS).map(([k, p]) => <SelectItem key={k}>{p.label}</SelectItem>)}
          </Select>
          <Checkbox size="sm" isSelected={showVoided} onValueChange={setShowVoided}>Show voided</Checkbox>
          <div className="flex gap-2 ml-auto">
            <Chip variant="flat" color={summary.net > 0 ? 'success' : summary.net < 0 ? 'danger' : 'default'}>Net {summary.net > 0 ? `+${summary.net}` : summary.net}</Chip>
            <Chip variant="flat" color="success">{summary.positives} good</Chip>
            <Chip variant="flat" color="danger">{summary.negatives} concerns</Chip>
          </div>
        </div>

        <Table aria-label="performance-log" className="overflow-x-auto">
          <TableHeader>
            <TableColumn>DATE</TableColumn>
            <TableColumn>STAFF</TableColumn>
            <TableColumn>SCORE</TableColumn>
            <TableColumn>CATEGORY</TableColumn>
            <TableColumn>WHAT HAPPENED</TableColumn>
            <TableColumn>RECORDED BY</TableColumn>
            <TableColumn>STATUS</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No entries for these filters — record the first one with “+ Record entry”.">
            {rows.map((e) => (
              <TableRow key={e.id} className={`cursor-pointer hover:bg-gray-50 ${e.status === 'voided' ? 'opacity-50' : ''}`} onClick={() => openDetail(e)}>
                <TableCell>{fmtDate(e.date)}</TableCell>
                <TableCell className="font-medium">{nameOf(e.employeeId)}</TableCell>
                <TableCell><ScoreChip score={e.score} /></TableCell>
                <TableCell>{categoryLabel(e.category)}</TableCell>
                <TableCell><span className="line-clamp-2 max-w-md" title={e.note}>{e.note}</span></TableCell>
                <TableCell>{e.recordedByName || '—'}</TableCell>
                <TableCell>
                  {e.status === 'voided'
                    ? <Chip size="sm" variant="flat">Voided</Chip>
                    : e.employeeResponse ? <Chip size="sm" variant="flat" color="primary">Staff responded</Chip> : <Chip size="sm" variant="flat" color="default">Recorded</Chip>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
              <ModalBody>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-gray-500">Date</p><p className="font-medium">{fmtDate(detail.date)}</p></div>
                  <div><p className="text-gray-500">Category</p><p className="font-medium">{categoryLabel(detail.category)}</p></div>
                  <div><p className="text-gray-500">Recorded by</p><p className="font-medium">{detail.recordedByName || '—'}</p></div>
                </div>
                <div><p className="text-sm text-gray-500">What happened</p><p className="whitespace-pre-wrap">{detail.note}</p></div>
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
              <ModalFooter className="justify-between">
                <div>
                  {detail.status === 'active' && !voiding && <Button variant="flat" color="danger" onPress={() => setVoiding(true)}>Void entry</Button>}
                  {voiding && <Button color="danger" isDisabled={!voidReason.trim()} onPress={() => { voidEntry(detail.id, voidReason, userName); setDetailId(null); }}>Confirm void</Button>}
                </div>
                <div className="flex gap-2">
                  <Button variant="flat" onPress={() => setDetailId(null)}>Close</Button>
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
