/**
 * For screens that reload on a timer: a reload that started before the latest save may bring
 * back the old values, so it is skipped (the next reload shows the saved ones). Call mark()
 * before and after each save.
 */
export function createSaveGuard() {
  let lastSave = 0;
  return {
    mark() { lastSave = Date.now(); },
    started() { return Date.now(); },
    isStale(startedAt: number) { return lastSave >= startedAt; },
  };
}
