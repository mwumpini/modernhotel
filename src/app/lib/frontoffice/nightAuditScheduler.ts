'use client';

import {
  hasCompletedNightAuditForDate,
  isNightAuditScheduleWindow,
  markAutoRunAttempted,
  wasAutoRunAttemptedToday,
  type NightAuditResult,
} from './nightAudit';
import { notifyNightManagers } from './nightAuditNotifications';
import { frontOfficeStore } from './store';
import { useSettingsStore } from '../settings/store';
import { formatPropertyClockStamp } from './propertyTime';
import { resolvePropertyTimezone } from './propertyTimeClient';

export type AutoNightAuditOutcome =
  | { action: 'skipped'; reason: string }
  | { action: 'ran'; result: NightAuditResult };

const LOG_PREFIX = '[NightAuditScheduler]';

function formatSchedulerStamp(now: Date): string {
  return formatPropertyClockStamp(now, resolvePropertyTimezone());
}

function logScheduler(message: string, level: 'log' | 'error' = 'log'): void {
  const line = `${LOG_PREFIX} Night audit scheduler fired — ${message}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}

/**
 * Attempt scheduled night audit when enabled and not already completed for business date.
 */
export async function tryScheduledNightAudit(now = new Date()): Promise<AutoNightAuditOutcome> {
  const stamp = formatSchedulerStamp(now);
  const rm = useSettingsStore.getState().roomManagement;

  if (!rm?.nightAuditAutoRun) {
    logScheduler(`${stamp} — skipped — auto-run disabled in settings`);
    return { action: 'skipped', reason: 'auto_run_disabled' };
  }

  const businessDate = frontOfficeStore.getBusinessDate();
  if (hasCompletedNightAuditForDate(frontOfficeStore, businessDate)) {
    logScheduler(`${stamp} — already run, skipping (business date ${businessDate})`);
    return { action: 'skipped', reason: 'already_completed' };
  }

  const started = performance.now();
  const result = await frontOfficeStore.executeNightAudit();
  const elapsedSec = ((performance.now() - started) / 1000).toFixed(1);

  if (result.status === 'completed') {
    markAutoRunAttempted(now);
    logScheduler(`${stamp} — running now — completed in ${elapsedSec}s`);
  } else {
    const err = result.error || 'Unknown error';
    logScheduler(`${stamp} — running now — FAILED: ${err}`, 'error');
    notifyNightManagers(
      `Night audit failed for ${result.businessDate}: ${err}. Please run manually from Night Audit.`,
      'urgent',
    );
  }

  return { action: 'ran', result };
}

/** Called every minute from NightAuditScheduler — runs once in the 1:00am window. */
export async function tickNightAuditScheduler(now = new Date()): Promise<AutoNightAuditOutcome | null> {
  if (!isNightAuditScheduleWindow(now)) return null;

  const stamp = formatSchedulerStamp(now);

  if (wasAutoRunAttemptedToday(now)) {
    logScheduler(`${stamp} — already run, skipping`);
    return { action: 'skipped', reason: 'auto_run_already_attempted_today' };
  }

  return await tryScheduledNightAudit(now);
}
