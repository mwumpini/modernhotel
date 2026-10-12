'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { loadRecords, saveRecord } from '../lib/api/tenantRecords';

const LOCAL_KEY = 'sidebar.stickies';
const MAX_NOTES = 5;

type Note = { id: string; text: string };
type StickyData = { id: string; notes: Note[]; draft: string; updatedAt: string };

function normalize(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((note) => note && typeof note.text === 'string' && note.text.trim())
    .slice(0, MAX_NOTES)
    .map((note) => ({ id: String(note.id || Date.now()), text: String(note.text).trim() }));
}

function readLocal(): StickyData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { id: '', notes: [], draft: '', updatedAt: '' };
    const parsed = JSON.parse(raw);
    // Older copies were just the list of notes, with nothing typed still in the box.
    if (Array.isArray(parsed)) return { id: '', notes: normalize(parsed), draft: '', updatedAt: '' };
    return {
      id: '',
      notes: normalize(parsed?.notes),
      draft: typeof parsed?.draft === 'string' ? parsed.draft : '',
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return { id: '', notes: [], draft: '', updatedAt: '' };
  }
}

function writeLocal(notes: Note[], draft: string, updatedAt: string) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ notes, draft, updatedAt }));
  } catch {
    /* this browser may be blocking storage; the server copy still applies */
  }
}

/** Personal notes in the side menu. The typed text and the saved notes both survive a refresh. */
export default function SidebarSticky() {
  const { data: session } = useSession();
  const userId = session?.user?.id || '';
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [ready, setReady] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const updatedAtRef = useRef('');

  useEffect(() => {
    const local = readLocal();
    setNotes(local.notes);
    setDraft(local.draft);
    setUpdatedAt(local.updatedAt);
    updatedAtRef.current = local.updatedAt;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setServerReady(false);
    void loadRecords<StickyData>('setting.stickies').then((rows) => {
      if (cancelled) return;
      const mine = (rows || []).find((row) => row.id === userId);
      const localAt = updatedAtRef.current;
      if (mine && (mine.updatedAt || '') > localAt) {
        const nextNotes = normalize(mine.notes);
        const nextDraft = typeof mine.draft === 'string' ? mine.draft : '';
        setNotes(nextNotes);
        setDraft(nextDraft);
        setUpdatedAt(mine.updatedAt);
        updatedAtRef.current = mine.updatedAt;
        writeLocal(nextNotes, nextDraft, mine.updatedAt);
      }
      setServerReady(true);
    });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!ready) return;
    writeLocal(notes, draft, updatedAt);
    if (!userId || !serverReady) return;
    const handle = window.setTimeout(() => {
      void saveRecord('setting.stickies', userId, { id: userId, notes, draft, updatedAt });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [notes, draft, updatedAt, ready, userId, serverReady]);

  const stamp = () => {
    const at = new Date().toISOString();
    updatedAtRef.current = at;
    setUpdatedAt(at);
    return at;
  };

  const add = () => {
    const text = draft.trim();
    if (!text || notes.length >= MAX_NOTES) return;
    setNotes((prev) => [{ id: `${Date.now()}`, text }, ...prev].slice(0, MAX_NOTES));
    setDraft('');
    stamp();
  };

  const full = notes.length >= MAX_NOTES;

  return (
    <div className="mt-6">
      {/* Hex text colors stay dark on cream even when dark theme remaps text-ghana-black / gray utilities. */}
      <p className="mb-2 text-xs font-semibold text-[#1a1200]">Notes</p>
      <textarea
        value={draft}
        rows={2}
        maxLength={180}
        disabled={full}
        placeholder={full ? 'Clear a note to add another' : 'A reminder for yourself…'}
        aria-label="New note"
        className="w-full resize-none rounded-md border border-amber-300 bg-[#fff8dc] px-2 py-1.5 text-xs text-[#1a1200] outline-none placeholder:text-[#5c4a1a]/70 focus:border-amber-500 disabled:opacity-60"
        onChange={(event) => {
          setDraft(event.target.value);
          stamp();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            add();
          }
        }}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-[#5c4a1a]/75">{notes.length}/{MAX_NOTES}</span>
        <button
          type="button"
          onClick={add}
          disabled={full || !draft.trim()}
          className="rounded-md bg-amber-300 px-2 py-0.5 text-[11px] font-semibold text-[#1a1200] disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {notes.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-1 rounded-md border border-amber-300 bg-[#fff4c2] px-2 py-1.5 shadow-sm">
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs text-[#1a1200]">{note.text}</p>
              <button
                type="button"
                aria-label="Clear note"
                onClick={() => {
                  setNotes((prev) => prev.filter((item) => item.id !== note.id));
                  stamp();
                }}
                className="shrink-0 text-xs leading-none text-[#5c4a1a]/70 hover:text-[#1a1200]"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
