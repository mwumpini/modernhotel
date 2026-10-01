import { helpTopics, type HelpTopic } from '../../help/helpContent';

export type HelpMatch = {
  title: string;
  text: string;
  section?: HelpTopic['section'];
  href?: string;
  settingsTab?: HelpTopic['settingsTab'];
  complianceTab?: HelpTopic['complianceTab'];
};

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
  'the', 'and', 'for', 'how', 'do', 'does', 'can', 'what', 'where', 'which',
  'this', 'desk', 'use', 'help', 'with', 'from', 'that', 'are', 'you', 'change',
  'set', 'open', 'show', 'please',
]);

export function isHelpQuestion(prompt: string): boolean {
  return /\b(how|where|which|help|configure|configuration|setup|set up|shortcut|f12|f1|what is|what's|show me)\b/i.test(prompt);
}

function wordsOf(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

function scoreTopic(topic: HelpTopic, words: string[]): number {
  const title = topic.title.toLowerCase();
  const description = topic.description.toLowerCase();
  const keywords = topic.keywords.map((k) => k.toLowerCase());
  const steps = (topic.steps || []).join(' ').toLowerCase();
  let score = 0;
  for (const word of words) {
    if (title.includes(word)) score += 4;
    if (keywords.some((k) => k.includes(word))) score += 3;
    if (description.includes(word)) score += 1;
    if (steps.includes(word)) score += 1;
  }
  return score;
}

function toMatch(topic: HelpTopic): HelpMatch {
  const steps = (topic.steps || []).slice(0, 3).map((step, i) => `${i + 1}. ${step}`).join(' ');
  const notHere = topic.notHere ? ` Not here: ${topic.notHere}` : '';
  return {
    title: topic.title,
    text: `${topic.title}. ${topic.description}${steps ? ` ${steps}` : ''}${notHere}`,
    section: topic.section,
    href: topic.href,
    settingsTab: topic.settingsTab,
    complianceTab: topic.complianceTab,
  };
}

/** Top help topics for a question. An empty how-to ("how do I use this desk?") uses the open desk. */
export function findHelp(query: string, desk?: string): HelpMatch[] {
  const words = wordsOf(query);
  const section = desk ? DESK_SECTION[desk] : undefined;
  if (!words.length) {
    const topic = section ? helpTopics.find((t) => t.section === section) : undefined;
    return topic ? [toMatch(topic)] : [];
  }
  return helpTopics
    .map((topic) => ({
      topic,
      score: scoreTopic(topic, words) + (section && topic.section === section ? 2 : 0),
    }))
    .filter((row) => row.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 1)
    .map((row) => toMatch(row.topic));
}
