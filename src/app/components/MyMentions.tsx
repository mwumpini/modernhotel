'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { announcementStore } from '../lib/analytics/announcementStore';
import { useSettingsStore } from '../lib/settings/store';

export default function MyMentions() {
  const settings = useSettingsStore();
  const userId = (settings as any)?.currentUser?.username || (settings as any)?.currentUser?.email || (typeof window !== 'undefined' ? localStorage.getItem('app.username') : '') || 'guest';

  const [messages, setMessages] = React.useState(() => announcementStore.getForUser(userId));

  React.useEffect(() => {
    const rerender = () => setMessages(announcementStore.getForUser(userId));
    announcementStore.subscribe(rerender);
  }, [userId]);

  const chipColor = (level: string) => level === 'urgent' ? 'danger' : level === 'normal' ? 'warning' : 'primary';

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-1"><h3 className="font-semibold text-ghana-black">My Mentions</h3></CardHeader>
      <CardBody className="pt-2 space-y-2 text-sm">
        {messages.map(m => (
          <div key={m.id} className="p-2 bg-gray-50 rounded flex items-start justify-between">
            <div>
              <div className="text-xs text-gray-500">{new Date(m.at).toLocaleTimeString()} • From {m.from?.toUpperCase() || 'SYSTEM'}</div>
              <div className="mt-0.5">{m.message}</div>
            </div>
            <Chip size="sm" variant="flat" color={chipColor(m.level)}>{m.level}</Chip>
          </div>
        ))}
        {messages.length === 0 && <div className="text-gray-500">No mentions</div>}
      </CardBody>
    </Card>
  );
}


