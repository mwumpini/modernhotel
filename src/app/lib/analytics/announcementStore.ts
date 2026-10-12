'use client';

import { loadRecords, saveRecord } from '../api/tenantRecords';

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

const MAX_NOTICES = 200;

class AnnouncementStore {
  private messages: Announcement[] = [];
  private listeners: Array<() => void> = [];
  private hydrateStarted = false;
  private loaded = false;

  // Kept on the server so a refresh (or another computer in the hotel) still sees them.
  private hydrate() {
    if (this.hydrateStarted || typeof window === 'undefined') return;
    this.hydrateStarted = true;
    void loadRecords<Announcement>('desk.notice').then((server) => {
      if (server) {
        const byId = new Map(server.map((m) => [m.id, m]));
        for (const m of this.messages) byId.set(m.id, m);
        this.messages = Array.from(byId.values()).sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_NOTICES);
      }
      this.loaded = true;
      this.listeners.forEach((l) => l());
    });
  }

  private remember(message: Announcement) {
    void saveRecord('desk.notice', message.id, message);
  }

  publish(msg: Omit<Announcement, 'id' | 'at'> & Partial<Pick<Announcement, 'at'>>) {
    this.hydrate();
    const at = msg.at || new Date().toISOString();
    const id = `ANN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`;
    const full: Announcement = { id, at, seenBy: [], ...msg } as Announcement;
    this.messages.unshift(full);
    if (this.messages.length > MAX_NOTICES) this.messages.length = MAX_NOTICES;
    this.remember(full);
    this.listeners.forEach(l => l());
  }

  getForDepartment(dept: DepartmentKey, limit = 10) {
    this.hydrate();
    return this.messages.filter(m => m.departments.includes('all') || m.departments.includes(dept)).slice(0, limit);
  }
  getForUser(userIdOrName: string, limit = 10) {
    this.hydrate();
    return this.messages.filter(m => (m.userMentions || []).includes(userIdOrName)).slice(0, limit);
  }

  all() {
    this.hydrate();
    return [...this.messages];
  }

  subscribe(listener: () => void) {
    this.hydrate();
    this.listeners.push(listener);
    if (this.loaded) listener();
  }

  markSeen(messageId: string, who: string) {
    const m = this.messages.find(x => x.id === messageId);
    if (!m) return;
    m.seenBy = Array.from(new Set([...(m.seenBy || []), who]));
    this.remember(m);
    this.listeners.forEach(l => l());
  }
}

export const announcementStore = new AnnouncementStore();


