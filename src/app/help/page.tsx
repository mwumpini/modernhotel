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
import ModuleBackButton from '../components/ModuleBackButton';
import {
  helpTopics,
  configurationGuide,
  helpMaintainerGuide,
  groupHelpTopics,
  keyboardShortcuts,
  type HelpTopic,
} from './helpContent';

const shortcuts = keyboardShortcuts;

function goToAppSection(router: ReturnType<typeof useRouter>, topic: Pick<HelpTopic, 'section' | 'settingsTab' | 'complianceTab' | 'href' | 'accountingTab' | 'hrTab' | 'securityTab' | 'eventsTab' | 'kitchenTab' | 'fbTab' | 'inventoryOpsTab' | 'inventoryPoView'>) {
  if (topic.href) {
    router.push(topic.href);
    return;
  }
  if (!topic.section) return;
  try {
    localStorage.setItem('nav.section', topic.section);
    if (topic.settingsTab) localStorage.setItem('settings.tab', topic.settingsTab);
    if (topic.complianceTab) localStorage.setItem('compliance.tab', topic.complianceTab);
    if (topic.accountingTab) localStorage.setItem('accounting.tab', topic.accountingTab);
    if (topic.hrTab) localStorage.setItem('hr.tab', topic.hrTab);
    if (topic.securityTab) localStorage.setItem('security.tab', topic.securityTab);
    if (topic.eventsTab) localStorage.setItem('events.tab', topic.eventsTab);
    if (topic.kitchenTab) localStorage.setItem('kitchen.tab', topic.kitchenTab);
    if (topic.fbTab) localStorage.setItem('fb.tab', topic.fbTab);
    if (topic.inventoryOpsTab) localStorage.setItem('inventory.opsTab', topic.inventoryOpsTab);
    if (topic.inventoryPoView) localStorage.setItem('inventory.poView', topic.inventoryPoView);
  } catch {
    /* ignore */
  }
  router.push('/');
}

function TopicCard({
  topic,
  router,
  pathname,
}: {
  topic: HelpTopic;
  router: ReturnType<typeof useRouter>;
  pathname: string;
}) {
  return (
    <li className="rounded-lg border border-slate-200/80 bg-[var(--card-background)] p-4 shadow-sm">
      <p className="font-medium text-slate-900">{topic.title}</p>
      <p className="mt-1 text-sm text-slate-600">{topic.description}</p>

      {topic.image && (
        <img
          src={topic.image}
          alt={topic.imageAlt || topic.title}
          className="mt-3 w-full rounded-md border border-slate-200 bg-slate-50"
        />
      )}

      {topic.steps && topic.steps.length > 0 && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {topic.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}

      {topic.rules && topic.rules.length > 0 && (
        <dl className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
          {topic.rules.map((r) => (
            <div key={r.name} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
              <dt className="font-medium text-slate-900">{r.name}</dt>
              <dd className="text-slate-700">{r.meaning}</dd>
            </div>
          ))}
        </dl>
      )}

      {topic.examples && topic.examples.length > 0 && topic.examples.map((ex) => (
        <div key={ex.title} className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-300/40 dark:bg-[color-mix(in_srgb,#10b981_14%,var(--card-background))] dark:text-emerald-100">
          <p className="font-medium">Example: {ex.title}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {ex.lines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      ))}

      {topic.notHere && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-300/40 dark:bg-[color-mix(in_srgb,#f59e0b_18%,var(--card-background))] dark:text-amber-100">
          <span className="font-medium">Not here: </span>
          {topic.notHere}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {topic.section || topic.href ? (
          <Button size="sm" color="primary" variant="flat" onPress={() => goToAppSection(router, topic)}>
            Open in app
          </Button>
        ) : null}
        {topic.href && !topic.section ? (
          <Button size="sm" variant="bordered" as={Link} href={topic.href}>
            Open page
          </Button>
        ) : null}
        {topic.id === 'messenger' ? (
          <Button size="sm" variant="bordered" onPress={() => openMessengerFromShell(router, pathname)}>
            Open messenger
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export default function HelpPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = React.useState('');

  const normalized = query.trim().toLowerCase();
  const filteredTopics = React.useMemo(() => {
    if (!normalized) return helpTopics;
    const terms = normalized.split(/\s+/).filter((term) => term.length > 1);
    return helpTopics.filter((t) => {
      const blob = `${t.title} ${t.description} ${t.keywords.join(' ')} ${t.notHere ?? ''} ${(t.steps ?? []).join(' ')} ${(t.rules ?? []).map((r) => `${r.name} ${r.meaning}`).join(' ')} ${(t.examples ?? []).map((e) => `${e.title} ${e.lines.join(' ')}`).join(' ')}`.toLowerCase();
      return terms.every((term) => blob.includes(term));
    });
  }, [normalized]);

  const groupedTopics = React.useMemo(() => groupHelpTopics(filteredTopics), [filteredTopics]);

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
    <div className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-4xl space-y-6">
        <ModuleBackButton label="dashboard" onPress={() => router.push('/')} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Help</h1>
            <p className="mt-1 text-sm text-slate-600">
              Topics follow the side menu, from Executive Management through Front Office and each later desk, up to System Settings. Press{' '}
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs shadow-sm">F1</kbd>{' '}
              /{' '}
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs shadow-sm">F12</kbd>{' '}
              from a desk to open Ask Mamani. This page opens when that desk has no assistant.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button color="primary" variant="solid" onPress={() => router.push('/help/manual')}>
              Open manual
            </Button>
            <Button color="secondary" variant="solid" onPress={() => router.push('/help/operations')}>
              Open operations manual
            </Button>
            <Button color="success" variant="solid" onPress={() => router.push('/help/process-flows')}>
              Open process flows
            </Button>
          </div>
        </div>

        <Input
          label="Search help"
          placeholder="e.g. VAT, rate plan, numbering, setup, users…"
          value={query}
          onValueChange={setQuery}
          variant="bordered"
          classNames={{ inputWrapper: 'bg-[var(--input-background)] shadow-sm' }}
        />

        {groupedTopics.map(({ id, title, intro, topics }) => (
          <Card key={id} shadow="sm" className="border border-slate-200/80">
            <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-2">
              <p className="text-lg font-medium text-slate-900">{title}</p>
              {!normalized && <p className="text-sm text-slate-500">{intro}</p>}
              {normalized && (
                <p className="text-sm text-slate-500">{topics.length} matching topic(s)</p>
              )}
            </CardHeader>
            <CardBody className="px-6 pb-6">
              {id === 'settings' && !normalized && (
                <div className="mb-4 space-y-3">
                  <p className="font-medium text-slate-900">{configurationGuide.title}</p>
                  <p className="text-sm text-slate-500">{configurationGuide.intro}</p>
                  {configurationGuide.areas.map((area) => (
                    <div key={area.name} className="rounded-lg border border-[var(--card-border)] bg-[var(--surface)] p-4">
                      <p className="font-medium text-slate-900">{area.name}</p>
                      <p className="mt-1 text-sm text-slate-700">
                        <span className="font-medium text-slate-800">Use for: </span>
                        {area.owns}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        <span className="font-medium text-slate-700">Not for: </span>
                        {area.notHere}
                      </p>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => goToAppSection(router, { section: area.section })}
                        >
                          Open in app
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <ul className="space-y-3">
                {topics.map((t) => (
                  <TopicCard key={t.id} topic={t} router={router} pathname={pathname} />
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}

        {filteredTopics.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">No topics match your search.</p>
        )}

        <Card shadow="sm" className="border border-slate-200/80">
          <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-2">
            <p className="text-lg font-medium text-slate-900">Keyboard shortcuts</p>
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

        <Card shadow="sm" className="border border-slate-200/80 bg-[var(--surface)]">
          <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-2">
            <p className="text-lg font-medium text-slate-900">{helpMaintainerGuide.title}</p>
            <p className="text-sm text-slate-500">
              Edit <code className="rounded border border-[var(--card-border)] bg-[var(--card-background)] px-1 py-0.5 text-xs">{helpMaintainerGuide.file}</code>{' '}
              when screens move or new features ship.
            </p>
          </CardHeader>
          <CardBody className="px-6 pb-6">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
              {helpMaintainerGuide.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <Card shadow="sm" className="border border-amber-200/80 bg-amber-50/40 dark:border-amber-300/40 dark:bg-[color-mix(in_srgb,#f59e0b_18%,var(--card-background))]">
          <CardBody className="px-6 py-5 text-sm text-amber-950 dark:text-amber-100">
            <p className="font-medium text-amber-900 dark:text-amber-100">Developers</p>
            <p className="mt-2 text-amber-900/90 dark:text-amber-100">
              On a desk, F1 and F12 open Ask Mamani, so the browser may not use those keys for DevTools. Use{' '}
              <kbd className="rounded border border-amber-300 bg-[var(--card-background)] px-1.5 py-0.5 font-mono text-xs">Ctrl+Shift+I</kbd>{' '}
              or the browser menu instead.
            </p>
          </CardBody>
        </Card>

        <Divider className="bg-slate-200" />
        <p className="text-center text-xs text-slate-500">
          AGM Sync — Esc (outside a field) returns to the dashboard.
        </p>
      </div>
    </div>
  );
}
