'use client';

import React, { useState } from 'react';
import { Button, Input } from '@heroui/react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

type Question = { id: string; text: string };

const fieldClass = {
  input: 'text-ghana-black',
  label: 'text-ghana-black font-medium',
  inputWrapper: 'border-ghana-green focus-within:border-ghana-gold',
};

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <Input
      type={visible ? 'text' : 'password'}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      variant="bordered"
      classNames={fieldClass}
      endContent={
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="text-gray-500 hover:text-ghana-black"
          onClick={onToggle}
        >
          {visible ? <EyeSlashIcon className="h-5 w-5" aria-hidden /> : <EyeIcon className="h-5 w-5" aria-hidden />}
        </button>
      }
    />
  );
}

export default function ForgotPasswordPanel({
  tenantId,
  login,
  onClose,
}: {
  tenantId: string;
  login: string;
  onClose: () => void;
}) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', tenantId, login }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.fallback) {
        setQuestions(null);
        setMessage(data.message || 'Ask an admin at this hotel to set a new password.');
        return;
      }
      if (!res.ok || !Array.isArray(data.questions)) {
        setError(data.error || 'Could not look up this sign-in.');
        return;
      }
      setQuestions(data.questions);
      setAnswers({});
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!questions) return;
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          tenantId,
          login,
          answers: questions.map((question) => ({ id: question.id, answer: answers[question.id] || '' })),
          password,
          confirm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setDone(true);
        setMessage('Password updated. Sign in with the new password.');
        return;
      }
      if (data.fallback) {
        setQuestions(null);
        setMessage(data.message || 'Ask an admin at this hotel to set a new password.');
        return;
      }
      setError(data.error || 'Could not reset the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div>
        <p className="text-sm font-semibold text-ghana-black">Reset password</p>
        <p className="mt-1 text-xs text-gray-600">
          Uses the Tenant ID and email or username above. Answer the secret questions you saved, then choose a new password.
        </p>
      </div>

      {message && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-ghana-black">{message}</p>}
      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {!questions && !done && (
        <Button type="button" className="w-full bg-ghana-green text-white" isLoading={busy} onPress={start}>
          Continue
        </Button>
      )}

      {questions && !done && (
        <div className="space-y-3">
          {questions.map((question) => (
            <Input
              key={question.id}
              label={question.text}
              value={answers[question.id] || ''}
              onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: e.target.value }))}
              variant="bordered"
              classNames={fieldClass}
              autoCapitalize="none"
            />
          ))}
          <PasswordField label="New password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
          <Button type="button" className="w-full bg-ghana-green text-white" isLoading={busy} onPress={() => { void reset(); }}>
            Set new password
          </Button>
        </div>
      )}

      <button type="button" className="text-sm text-ghana-green hover:text-ghana-gold" onClick={onClose}>
        Back to sign in
      </button>
    </div>
  );
}
