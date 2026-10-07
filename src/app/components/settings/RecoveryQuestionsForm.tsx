'use client';

import React, { useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem } from '@heroui/react';
import { RECOVERY_QUESTIONS } from '@/app/lib/auth/recoveryQuestionList';

type Row = { id: string; answer: string };

const emptyRow = (): Row => ({ id: '', answer: '' });

export default function RecoveryQuestionsForm() {
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    void fetch('/api/account/recovery-questions', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancel || !Array.isArray(data.questions)) return;
        setSavedCount(data.questions.length);
        if (data.questions.length >= 2) {
          setRows(data.questions.map((question: { id?: string }) => ({ id: question.id || '', answer: '' })));
        }
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, []);

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const save = async () => {
    setError('');
    setNotice('');
    if (rows.length < 2) {
      setError('Choose at least two different secret questions.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/account/recovery-questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          questions: rows.map((row) => ({ id: row.id, answer: row.answer })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save the secret questions.');
        return;
      }
      setSavedCount(rows.length);
      setRows((current) => current.map((row) => ({ ...row, answer: '' })));
      setCurrentPassword('');
      setNotice('Secret questions saved. They can reset this password from the sign-in screen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="px-3 py-2">
        <h4 className="text-base font-semibold text-ghana-black">Secret questions</h4>
      </CardHeader>
      <CardBody className="space-y-3 px-3 py-2">
        <p className="text-sm text-default-500">
          {savedCount >= 2
            ? `${savedCount} questions are saved. Enter them again, with your current password, to replace the answers.`
            : 'Save at least two questions so a forgotten password can be reset from the sign-in screen. Without them, an admin at the hotel sets the password. The first admin asks the operator.'}
        </p>
        {notice && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <Select
                label={`Question ${index + 1}`}
                selectedKeys={row.id ? [row.id] : []}
                onChange={(e) => updateRow(index, { id: e.target.value })}
              >
                {RECOVERY_QUESTIONS.map((question) => (
                  <SelectItem key={question.id}>{question.text}</SelectItem>
                ))}
              </Select>
              <Input label="Answer" value={row.answer} onChange={(e) => updateRow(index, { answer: e.target.value })} autoCapitalize="none" />
              <Button
                type="button"
                variant="light"
                isDisabled={rows.length <= 2}
                onPress={() => setRows((current) => current.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Button
            type="button"
            variant="bordered"
            isDisabled={rows.length >= RECOVERY_QUESTIONS.length}
            onPress={() => setRows((current) => [...current, emptyRow()])}
          >
            Add another question
          </Button>
          <Input className="max-w-xs" label="Current password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button color="primary" isLoading={busy} onPress={save}>Save questions</Button>
        </div>
      </CardBody>
    </Card>
  );
}
