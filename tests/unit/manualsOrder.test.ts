import { describe, expect, it } from 'vitest';
import { helpModules } from '@/app/help/helpContent';
import { operationsModules, operationsTopics } from '@/app/help/operationsContent';
import { processFlowModules, processFlows } from '@/app/help/processFlowsContent';

// The side menu, top to bottom: Executive Management, Front Office, Events, … System Settings.
const menuOrder = helpModules.map((m) => m.title);

// The one chapter allowed before the modules: how to open the system at all.
const OPENING = 'Opening AGM Sync';

const checkDocument = (allChapters: { title: string; topicIds: string[] }[], topics: { id: string }[]) => {
  const chapters = allChapters[0]?.title === OPENING ? allChapters.slice(1) : allChapters;
  const positions = chapters.map((c) => menuOrder.indexOf(c.title));
  expect(positions.every((p) => p >= 0), `every chapter is a side-menu module: ${chapters.map((c) => c.title).join(', ')}`).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  const listed = allChapters.flatMap((c) => c.topicIds);
  expect(new Set(listed).size).toBe(listed.length);
  expect([...listed].sort()).toEqual(topics.map((t) => t.id).sort());
};

describe('Manuals follow the side menu, top to bottom', () => {
  it('Operations Manual chapters are in module order and include every topic once', () => {
    checkDocument(operationsModules, operationsTopics);
  });

  it('Process Flows chapters are in module order and include every flow once', () => {
    checkDocument(processFlowModules, processFlows);
  });
});
