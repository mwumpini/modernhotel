/** Fixed list so the sign-in screen can show the question without storing the wording on the account. */
export const RECOVERY_QUESTIONS = [
  { id: 'school', text: 'What was the name of your first school?' },
  { id: 'city', text: 'In which city were you born?' },
  { id: 'pet', text: 'What was the name of your first pet?' },
  { id: 'nickname', text: 'What was your childhood nickname?' },
  { id: 'friend', text: 'What is the first name of your closest childhood friend?' },
  { id: 'street', text: 'What is the name of the street you grew up on?' },
] as const;

const QUESTION_TEXT = new Map(RECOVERY_QUESTIONS.map((question) => [question.id, question.text]));

export function recoveryQuestionText(id: string): string | null {
  return QUESTION_TEXT.get(id as (typeof RECOVERY_QUESTIONS)[number]['id']) ?? null;
}

export function normalizeRecoveryAnswer(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Who can set a password when the questions cannot. */
export function recoveryFallbackMessage(who: 'admin' | 'operator' | 'operator-account' | 'either', locked = false): string {
  const next = who === 'operator'
    ? 'Ask the operator to reset this sign-in. They do that on the hotel’s Overview tab.'
    : who === 'admin'
      ? 'Ask an admin at this hotel to set a new password in Users.'
      : who === 'operator-account'
        ? 'Ask the person who set up the operator account.'
        : 'Ask an admin at this hotel to set a new password. If you are the first admin and nobody else can sign in, ask the operator.';
  return locked ? `Too many wrong answers. ${next}` : next;
}
