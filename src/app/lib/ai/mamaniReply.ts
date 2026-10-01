import { isHelpQuestion } from './helpSearch';

/** Short reply used when the model is unavailable. Uses only the brief already built on the desk. */
export function localMamaniReply(
  prompt: string,
  brief: { label: string; snapshot: string[]; notices: string[]; help?: string[] },
): string {
  const drafting = /^\s*draft\b/i.test(prompt) || /\breminder\b/i.test(prompt);
  if (!drafting && isHelpQuestion(prompt)) {
    if (brief.help?.length) return brief.help.join('\n\n');
    return 'I do not have a help topic for that. Open Full Help for the rest of the screens.';
  }
  const facts = brief.snapshot.length
    ? brief.snapshot.join(' ')
    : `Live counts are not loaded on the ${brief.label} desk yet.`;
  const latest = brief.notices[0] ? ` Latest notice: ${brief.notices[0]}.` : '';
  if (drafting) {
    return `${facts}${latest} Review this and send it from Messenger when it is right.`;
  }
  return `${facts}${latest} I can draft a notice from this. You send it from Messenger.`;
}
