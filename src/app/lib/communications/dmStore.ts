'use client';

import { create } from 'zustand';

export interface DMMessage {
  id: string;
  at: string; // ISO
  fromUserId: string;
  toUserId: string;
  content: string;
  readAt?: string;
}

interface DMStore {
  messages: DMMessage[];
  send: (fromUserId: string, toUserId: string, content: string) => void;
  getThread: (userA: string, userB: string, limit?: number) => DMMessage[];
  markRead: (forUserId: string, fromUserId: string) => void;
  // typing indicators
  setTyping: (fromUserId: string, toUserId: string, isTyping: boolean) => void;
  isTyping: (fromUserId: string, toUserId: string) => boolean;
}

// Internal typing state with expiry
type TypingKey = `${string}|${string}`;
const typingMap: Map<TypingKey, number> = new Map();

export const dmStore = create<DMStore>((set, get) => ({
  messages: [],
  send: (fromUserId, toUserId, content) => {
    const msg: DMMessage = {
      id: `DM-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*100)}`,
      at: new Date().toISOString(),
      fromUserId,
      toUserId,
      content
    };
    set((state) => ({ messages: [msg, ...state.messages] }));
  },
  getThread: (userA, userB, limit = 50) => {
    const all = get().messages;
    return all
      .filter(m => (m.fromUserId === userA && m.toUserId === userB) || (m.fromUserId === userB && m.toUserId === userA))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .slice(-limit);
  },
  markRead: (forUserId, fromUserId) => {
    const now = new Date().toISOString();
    set((state) => ({
      messages: state.messages.map(m => (m.toUserId === forUserId && m.fromUserId === fromUserId && !m.readAt) ? { ...m, readAt: now } : m)
    }));
  },
  setTyping: (fromUserId, toUserId, isTyping) => {
    const key: TypingKey = `${fromUserId}|${toUserId}`;
    if (isTyping) {
      // expire after 3s
      const until = Date.now() + 3000;
      typingMap.set(key, until);
    } else {
      typingMap.delete(key);
    }
    // trigger state update to notify subscribers
    set((state) => ({ messages: state.messages }));
  },
  isTyping: (fromUserId, toUserId) => {
    const key: TypingKey = `${fromUserId}|${toUserId}`;
    const until = typingMap.get(key) || 0;
    if (!until) return false;
    if (Date.now() > until) {
      typingMap.delete(key);
      return false;
    }
    return true;
  }
}));


