/**
 * Grid classes for a dashboard's "Operations Overview" cards: the row is shared out between the cards that are
 * actually shown, so three cards fill the width instead of leaving a fourth, empty column. Four or more keep four
 * columns and wrap. (Full class names, so Tailwind can see them.)
 */
export function overviewGridClass(cardCount: number): string {
  const wide = cardCount <= 1 ? 'lg:grid-cols-1' : cardCount === 2 ? 'lg:grid-cols-2' : cardCount === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  return `grid grid-cols-1 md:grid-cols-2 ${wide} gap-6 mt-4`;
}
