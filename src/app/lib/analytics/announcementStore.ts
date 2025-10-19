'use client';

export type DepartmentKey = 'all' | 'master' | 'gm' | 'frontdesk' | 'housekeeping' | 'inventory' | 'security' | 'hr' | 'accounting' | 'f&b' | 'events';

export interface Announcement {
  id: string;
  at: string; // ISO
  level: 'urgent' | 'normal' | 'info';
  message: string;
  departments: DepartmentKey[]; // includes 'all' to broadcast
  from?: string;
  seenBy?: string[]; // dept keys or user ids that have seen it
  mentions?: DepartmentKey[]; // highlighted target departments
  userMentions?: string[]; // user ids or usernames
  parentId?: string; // reply to another announcement
}

class AnnouncementStore {
  private messages: Announcement[] = [];
  private listeners: Array<() => void> = [];

  publish(msg: Omit<Announcement, 'id' | 'at'> & Partial<Pick<Announcement, 'at'>>) {
    const at = msg.at || new Date().toISOString();
    const id = `ANN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`;
    const full: Announcement = { id, at, seenBy: [], ...msg } as Announcement;
    this.messages.unshift(full);
    this.listeners.forEach(l => l());
  }

  getForDepartment(dept: DepartmentKey, limit = 10) {
    return this.messages.filter(m => m.departments.includes('all') || m.departments.includes(dept)).slice(0, limit);
  }
  getForUser(userIdOrName: string, limit = 10) {
    return this.messages.filter(m => (m.userMentions || []).includes(userIdOrName)).slice(0, limit);
  }

  all() { return [...this.messages]; }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
  }

  markSeen(messageId: string, who: string) {
    const m = this.messages.find(x => x.id === messageId);
    if (!m) return;
    m.seenBy = Array.from(new Set([...(m.seenBy || []), who]));
    this.listeners.forEach(l => l());
  }
}

export const announcementStore = new AnnouncementStore();


