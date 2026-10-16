import { helpTopics, type HelpNavSection, type HelpTopic } from '../../help/helpContent';
import { operationsModules, operationsTopics } from '../../help/operationsContent';
import { processFlowModules, processFlows } from '../../help/processFlowsContent';

export type HelpMatch = {
  title: string;
  text: string;
  section?: HelpTopic['section'];
  href?: string;
  settingsTab?: HelpTopic['settingsTab'];
  complianceTab?: HelpTopic['complianceTab'];
};

/** Which side-menu module an operations chapter or a process flow belongs to. */
const MODULE_SECTION: Record<string, HelpNavSection> = {
  'ops-frontdesk': 'frontdesk',
  'ops-inventory': 'inventory',
  'ops-hr': 'hr',
  'ops-accounting': 'accounting-management',
  'ops-compliance': 'compliance',
  'ops-settings': 'settings',
  'flows-exec': 'dashboard',
  'flows-frontdesk': 'frontdesk',
  'flows-events': 'events-conferences-standalone',
  'flows-restaurant': 'food-beverage',
  'flows-housekeeping': 'housekeeping',
  'flows-inventory': 'inventory',
  'flows-hr': 'hr',
  'flows-accounting': 'accounting-management',
  'flows-compliance': 'compliance',
};

function sectionFor(id: string): HelpNavSection | undefined {
  for (const mod of [...operationsModules, ...processFlowModules]) {
    if (mod.topicIds.includes(id)) return MODULE_SECTION[mod.id];
  }
  return undefined;
}

/** Help steps, plus the rules and worked examples in each module's operations chapter and process flow. */
function corpus(): HelpTopic[] {
  const fromModule = (topic: HelpTopic, href: string): HelpTopic => ({
    ...topic,
    section: topic.section || sectionFor(topic.id),
    href,
  });
  return [
    ...helpTopics,
    ...operationsTopics.map((topic) => fromModule(topic, `/help/operations#topic-${topic.id}`)),
    ...processFlows.map((topic) => fromModule(topic, `/help/process-flows#topic-${topic.id}`)),
  ];
}

const DESK_SECTION: Record<string, NonNullable<HelpTopic['section']>> = {
  frontdesk: 'frontdesk',
  housekeeping: 'housekeeping',
  inventory: 'inventory',
  security: 'security',
  hr: 'hr',
  accounting: 'accounting-management',
  'f&b': 'food-beverage',
  events: 'events-conferences-standalone',
  master: 'dashboard',
  gm: 'dashboard',
};

const STOP = new Set([
  'the', 'and', 'for', 'how', 'do', 'does', 'can', 'what', 'where', 'which', 'when', 'why',
  'this', 'desk', 'use', 'help', 'with', 'from', 'that', 'are', 'you', 'your', 'change',
  'set', 'open', 'show', 'please', 'want', 'need', 'know', 'find', 'get', 'into', 'out',
  'there', 'here', 'our', 'have', 'has', 'was', 'were', 'will', 'would', 'should', 'could',
  'about', 'some', 'any', 'all', 'one', 'way', 'make', 'still', 'just', 'now', 'today',
]);

/** Staff words → the words the help topics use. */
const SYNONYMS: Record<string, string> = {
  cancel: 'void', cancell: 'void', reverse: 'void', revers: 'void', undo: 'void', reversal: 'void',
  remove: 'delete', erase: 'delete',
  modify: 'edit', amend: 'edit', correct: 'edit', fix: 'edit', update: 'edit',
  pay: 'payment', paid: 'payment',
  vendor: 'supplier', client: 'customer',
  checkin: 'check', checkout: 'check',
  pwd: 'password',
};

export function isHelpQuestion(prompt: string): boolean {
  // "How many rooms are dirty?" is a count, not a how-to.
  if (/\bhow\s+(many|much)\b/i.test(prompt)) return false;
  return /\b(how|where|which|help|configure|configuration|setup|set up|shortcut|f12|f1|what is|what's|show me|steps|can i|can't|cannot|why)\b/i.test(prompt);
}

/** Light stemming so invoices/invoice and voiding/voided/void meet. */
function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ied')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/'s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 || /^\d+$/.test(word))
    .map((word) => stem(SYNONYMS[word] || word))
    .map((word) => SYNONYMS[word] || word);
}

function queryWords(query: string): string[] {
  const raw = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));
  return [...new Set(tokens(raw.join(' ')))].filter((w) => !STOP.has(w));
}

type IndexedTopic = {
  topic: HelpTopic;
  title: Set<string>;
  keywords: Set<string>;
  body: Set<string>;
  all: Set<string>;
};

let index: { topics: IndexedTopic[]; df: Map<string, number> } | null = null;

function topicDetail(topic: HelpTopic): string {
  const rules = (topic.rules || []).map((rule) => `${rule.name}: ${rule.meaning}`).join(' ');
  const examples = (topic.examples || [])
    .map((example) => `${example.title}. ${example.lines.join(' ')}`)
    .join(' ');
  const flow = (topic.flow || [])
    .map((step) => `${step.who} at ${step.where}: ${step.action} ${step.result}`)
    .join(' ');
  return [rules, examples, flow].filter(Boolean).join(' ');
}

function getIndex() {
  if (index) return index;
  const topics = corpus().map((topic) => {
    const title = new Set(tokens(topic.title));
    const keywords = new Set(tokens(topic.keywords.join(' ')));
    const body = new Set(tokens(`${topic.description} ${(topic.steps || []).join(' ')} ${topic.notHere || ''} ${topicDetail(topic)}`));
    const all = new Set([...title, ...keywords, ...body]);
    return { topic, title, keywords, body, all };
  });
  const df = new Map<string, number>();
  for (const t of topics) for (const w of t.all) df.set(w, (df.get(w) || 0) + 1);
  index = { topics, df };
  return index;
}

function toMatch(topic: HelpTopic): HelpMatch {
  const steps = (topic.steps || []).slice(0, 4).map((step, i) => `${i + 1}. ${step}`).join(' ');
  const rules = (topic.rules || []).slice(0, 6).map((rule) => `${rule.name}: ${rule.meaning}`).join(' ');
  const example = topic.examples?.[0];
  const exampleText = example ? `Example, ${example.title}: ${example.lines.slice(0, 3).join(' ')}` : '';
  const flow = (topic.flow || []).slice(0, 5).map((step) => `${step.who} at ${step.where}: ${step.action} Result: ${step.result}`).join(' ');
  const notHere = topic.notHere ? ` Not here: ${topic.notHere}` : '';
  const detail = [steps, rules, exampleText, flow].filter(Boolean).join(' ');
  return {
    title: topic.title,
    text: `${topic.title}. ${topic.description}${detail ? ` ${detail}` : ''}${notHere}`,
    section: topic.section,
    href: topic.href,
    settingsTab: topic.settingsTab,
    complianceTab: topic.complianceTab,
  };
}

/**
 * Best help topics for a question.
 * Whole words only, rare words count more than common ones, and a topic must
 * cover most of the question's meaningful words — one shared word ("invoice")
 * is not enough to answer "how do I void an invoice?".
 * An empty how-to ("how do I use this desk?") returns the open desk's topic.
 */
export function findHelp(query: string, desk?: string): HelpMatch[] {
  const { topics, df } = getIndex();
  const section = desk ? DESK_SECTION[desk] : undefined;
  // Words no topic uses ("tomorrow", a guest's name) say nothing about which topic fits.
  const asked = queryWords(query);
  const words = asked.filter((w) => df.has(w));
  if (asked.length && !words.length) return [];
  if (!words.length) {
    const topic = section ? helpTopics.find((t) => t.section === section) : undefined;
    return topic ? [toMatch(topic)] : [];
  }

  const n = topics.length;
  const weight = (w: string) => Math.log(1 + n / (df.get(w) || n));
  const totalWeight = words.reduce((sum, w) => sum + weight(w), 0);

  const ranked = topics
    .map((t) => {
      let score = 0;
      let covered = 0;
      for (const w of words) {
        const field = t.title.has(w) ? 3 : t.keywords.has(w) ? 2.5 : t.body.has(w) ? 1 : 0;
        if (!field) continue;
        score += field * weight(w);
        covered += weight(w);
      }
      if (section && t.topic.section === section) score *= 1.15;
      return { topic: t.topic, score, coverage: covered / totalWeight };
    })
    .filter((row) => row.score > 0 && row.coverage >= (words.length === 1 ? 1 : 0.6))
    .sort((a, b) => b.score - a.score || b.coverage - a.coverage);

  if (!ranked.length) return [];
  const best = ranked[0];
  const picks = [best];
  // A close runner-up helps when a question spans two screens.
  if (ranked[1] && ranked[1].score >= best.score * 0.8) picks.push(ranked[1]);
  return picks.map((row) => toMatch(row.topic));
}
