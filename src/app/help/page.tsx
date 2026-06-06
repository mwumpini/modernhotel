'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Input,
} from '@heroui/react';
import { openMessengerFromShell } from '../lib/openMessenger';
import { helpTopics, moduleQuickLinks, type HelpNavSection } from './helpContent';

const shortcuts = [
  { keys: 'F1 / F12', action: 'Open this Help page (when not typing in a field)' },
  { keys: 'Esc', action: 'From this page: return to the main dashboard' },
  { keys: 'Ctrl + M', action: 'Open department messenger (when not typing in a field)' },
  { keys: 'Ctrl + Enter', action: 'F&B POS: send order' },
  { keys: 'Ctrl + P', action: 'F&B POS: open payment' },
];

function goToAppSection(router: ReturnType<typeof useRouter>, section: HelpNavSection) {
  try {
    localStorage.setItem('nav.section', section);
  } catch {
    /* ignore */
  }
  router.push('/');
}

export default function HelpPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = React.useState('');

  const normalized = query.trim().toLowerCase();
  const filteredTopics = React.useMemo(() => {
    if (!normalized) return helpTopics;
    return helpTopics.filter((t) => {
      const blob = `${t.title} ${t.description} ${t.keywords.join(' ')}`.toLowerCase();
      return blob.includes(normalized);
    });
  }, [normalized]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      router.push('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Help</h1>
            <p className="mt-1 text-sm text-slate-600">
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs shadow-sm">F1</kbd>{' '}
              or{' '}
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs shadow-sm">F12</kbd>{' '}
              opens this page when focus is not in a text field.
            </p>
          </div>
          <Button color="primary" variant="flat" onPress={() => router.push('/')}>
            Back to dashboard
          </Button>
        </div>

        <Input
          label="Search help"
          placeholder="e.g. VAT, POS, housekeeping, setup…"
          value={query}
          onValueChange={setQuery}
          variant="bordered"
          classNames={{ inputWrapper: 'bg-white shadow-sm' }}
        />

        <Card shadow="sm" className="border border-slate-200/80">
          <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-2">
            <p className="text-lg font-medium text-slate-900">Jump to module</p>
            <p className="text-sm text-slate-500">Opens the main app and selects that area in the sidebar.</p>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2 px-6 pb-6">
            {moduleQuickLinks.map((m) => (
              <Button
                key={m.section}
                size="sm"
                variant="flat"
                className="border border-slate-200 bg-white"
                onPress={() => goToAppSection(router, m.section)}
              >
                {m.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="flat"
              className="border border-dashed border-slate-300 bg-white"
              onPress={() => openMessengerFromShell(router, pathname)}
            >
              Messenger
            </Button>
            <Button size="sm" variant="light" as={Link} href="/setup">
              Setup wizard
            </Button>
            <Button size="sm" variant="light" as={Link} href="/analytics">
              Analytics
            </Button>
          </CardBody>
        </Card>

        <Card shadow="sm" className="border border-slate-200/80">
          <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-2">
            <p className="text-lg font-medium text-slate-900">
              Topics {normalized ? `(${filteredTopics.length})` : ''}
            </p>
          </CardHeader>
          <CardBody className="space-y-3 px-6 pb-6">
            {filteredTopics.length === 0 ? (
              <p className="text-sm text-slate-500">No topics match your search.</p>
            ) : (
              <ul className="space-y-3">
                {filteredTopics.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-sm"
                  >
                    <p className="font-medium text-slate-900">{t.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{t.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {t.section ? (
                        <Button size="sm" color="primary" variant="flat" onPress={() => goToAppSection(router, t.section!)}>
                          Open in app
                        </Button>
                      ) : null}
                      {t.href ? (
                        <Button size="sm" variant="bordered" as={Link} href={t.href}>
                          Open page
                        </Button>
                      ) : null}
                      {t.id === 'messenger' ? (
                        <Button size="sm" variant="bordered" onPress={() => openMessengerFromShell(router, pathname)}>
                          Open messenger
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card shadow="sm" className="border border-slate-200/80">
          <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-2">
            <p className="text-lg font-medium text-slate-900">Keyboard shortcuts</p>
            <p className="text-sm text-slate-500">Module-specific shortcuts apply only in that module.</p>
          </CardHeader>
          <CardBody className="space-y-0 divide-y divide-slate-100 px-6 pb-6">
            {shortcuts.map((row) => (
              <div key={row.keys} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:gap-4">
                <kbd className="shrink-0 rounded border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs">
                  {row.keys}
                </kbd>
                <span className="text-sm text-slate-700">{row.action}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card shadow="sm" className="border border-amber-200/80 bg-amber-50/40">
          <CardBody className="px-6 py-5 text-sm text-amber-950">
            <p className="font-medium text-amber-900">Developers</p>
            <p className="mt-2 text-amber-900/90">
              <strong>F1</strong> and <strong>F12</strong> are handled for in-app help, so the browser may not open
              DevTools on those keys. Use{' '}
              <kbd className="rounded border border-amber-300 bg-white px-1.5 py-0.5 font-mono text-xs">Ctrl+Shift+I</kbd>{' '}
              (Chrome / Edge) or the browser menu for developer tools.
            </p>
          </CardBody>
        </Card>

        <Divider className="bg-slate-200" />
        <p className="text-center text-xs text-slate-500">
          Ghana Hotel Management System — press Esc (outside a field) to return to the dashboard.
        </p>
      </div>
    </div>
  );
}
