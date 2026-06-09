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
import {
  helpTopics,
  moduleQuickLinks,
  configurationGuide,
  helpMaintainerGuide,
  helpCategoryLabels,
  type HelpTopic,
  type HelpTopicCategory,
} from './helpContent';

const shortcuts = [
  { keys: 'F1 / F12', action: 'Open this Help page (when not typing in a field)' },
  { keys: 'Esc', action: 'From this page: return to the main dashboard' },
  { keys: 'Ctrl + M', action: 'Open department messenger (when not typing in a field)' },
  { keys: 'Ctrl + Enter', action: 'F&B POS: send order' },
  { keys: 'Ctrl + P', action: 'F&B POS: open payment' },
];

const CATEGORY_ORDER: HelpTopicCategory[] = ['configuration', 'operations', 'finance', 'general'];

function goToAppSection(router: ReturnType<typeof useRouter>, topic: Pick<HelpTopic, 'section' | 'settingsTab' | 'complianceTab' | 'href'>) {
  if (topic.href) {
    router.push(topic.href);
    return;
  }
  if (!topic.section) return;
  try {
    localStorage.setItem('nav.section', topic.section);
    if (topic.settingsTab) {
      localStorage.setItem('settings.tab', topic.settingsTab);
    }
    if (topic.complianceTab) {
      localStorage.setItem('compliance.tab', topic.complianceTab);
    }
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
    <li className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="font-medium text-slate-900">{topic.title}</p>
      <p className="mt-1 text-sm text-slate-600">{topic.description}</p>

      {topic.steps && topic.steps.length > 0 && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {topic.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}

      {topic.notHere && (
        <p className="mt-3 text-sm text-amber-900/90 rounded-md bg-amber-50 border border-amber-100 px-3 py-2">
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
    return helpTopics.filter((t) => {
      const blob = `${t.title} ${t.description} ${t.keywords.join(' ')} ${t.notHere ?? ''} ${(t.steps ?? []).join(' ')}`.toLowerCase();
      return blob.includes(normalized);
    });
  }, [normalized]);

  const groupedTopics = React.useMemo(() => {
    const groups = new Map<HelpTopicCategory, HelpTopic[]>();
    for (const cat of CATEGORY_ORDER) {
      groups.set(cat, []);
    }
    for (const t of filteredTopics) {
      groups.get(t.category)?.push(t);
    }
    return CATEGORY_ORDER.map((cat) => ({ category: cat, topics: groups.get(cat) ?? [] })).filter(
      (g) => g.topics.length > 0
    );
  }, [filteredTopics]);

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
              Search topics below or press{' '}
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs shadow-sm">F1</kbd>{' '}
              /{' '}
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs shadow-sm">F12</kbd>{' '}
              from the app.
            </p>
          </div>
          <Button color="primary" variant="flat" onPress={() => router.push('/')}>
            Back to dashboard
          </Button>
        </div>

        <Input
          label="Search help"
          placeholder="e.g. VAT, rate plan, numbering, setup, users…"
          value={query}
          onValueChange={setQuery}
          variant="bordered"
          classNames={{ inputWrapper: 'bg-white shadow-sm' }}
        />

        {!normalized && (
          <Card shadow="sm" className="border border-slate-200/80">
            <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-2">
              <p className="text-lg font-medium text-slate-900">{configurationGuide.title}</p>
              <p className="text-sm text-slate-500">{configurationGuide.intro}</p>
            </CardHeader>
            <CardBody className="space-y-4 px-6 pb-6">
              {configurationGuide.areas.map((area) => (
                <div key={area.name} className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
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
                    {'href' in area && area.href ? (
                      <Button size="sm" variant="flat" color="primary" as={Link} href={area.href}>
                        Open
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        onPress={() => goToAppSection(router, { section: area.section })}
                      >
                        Open in app
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

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
                onPress={() => goToAppSection(router, { section: m.section })}
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
          </CardBody>
        </Card>

        {groupedTopics.map(({ category, topics }) => (
          <Card key={category} shadow="sm" className="border border-slate-200/80">
            <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-2">
              <p className="text-lg font-medium text-slate-900">{helpCategoryLabels[category]}</p>
              {normalized && (
                <p className="text-sm text-slate-500">{topics.length} matching topic(s)</p>
              )}
            </CardHeader>
            <CardBody className="px-6 pb-6">
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

        <Card shadow="sm" className="border border-slate-200/80 bg-slate-50/50">
          <CardHeader className="flex flex-col items-start gap-1 px-6 pt-6 pb-2">
            <p className="text-lg font-medium text-slate-900">{helpMaintainerGuide.title}</p>
            <p className="text-sm text-slate-500">
              Edit <code className="text-xs bg-white px-1 py-0.5 rounded border">{helpMaintainerGuide.file}</code>{' '}
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

        <Card shadow="sm" className="border border-amber-200/80 bg-amber-50/40">
          <CardBody className="px-6 py-5 text-sm text-amber-950">
            <p className="font-medium text-amber-900">Developers</p>
            <p className="mt-2 text-amber-900/90">
              F1 and F12 open this Help page, so the browser may not use those keys for DevTools. Use{' '}
              <kbd className="rounded border border-amber-300 bg-white px-1.5 py-0.5 font-mono text-xs">Ctrl+Shift+I</kbd>{' '}
              or the browser menu instead.
            </p>
          </CardBody>
        </Card>

        <Divider className="bg-slate-200" />
        <p className="text-center text-xs text-slate-500">
          Ghana Hotel Management System — Esc (outside a field) returns to the dashboard.
        </p>
      </div>
    </div>
  );
}
