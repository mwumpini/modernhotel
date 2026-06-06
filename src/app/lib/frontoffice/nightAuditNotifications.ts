'use client';

import { announcementStore } from '../analytics/announcementStore';
import { useSettingsStore } from '../settings/store';

const NIGHT_MANAGER_ROLE_ID = 'night_manager';

/** In-app alert for users assigned the night_manager role. */
export function notifyNightManagers(message: string, level: 'urgent' | 'normal' = 'urgent'): void {
  const { users } = useSettingsStore.getState();
  const mentions = users
    .filter((u) => u.isActive && u.roleId === NIGHT_MANAGER_ROLE_ID)
    .map((u) => u.username || u.email)
    .filter(Boolean);

  announcementStore.publish({
    level,
    message,
    departments: ['frontdesk', 'gm'],
    from: 'night_audit',
    userMentions: mentions.length > 0 ? mentions : undefined,
  });
}

export { NIGHT_MANAGER_ROLE_ID };
