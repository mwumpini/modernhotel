'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'sidebar.stickies';
const MAX_NOTES = 5;

type Note = { id: string; text: string };

function readNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((note) => note && typeof note.text === 'string' && note.text.trim())
      .slice(0, MAX_NOTES)
      .map((note) => ({ id: String(note.id || Date.now()), text: String(note.text).trim() }));
  } catch {
    return [];
  }
}

/** Personal notes in the side menu. Saved in this browser only. */
export default function SidebarSticky() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setNotes(readNotes());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
      /* ignore */
    }
  }, [notes, ready]);

  const add = () => {
    const text = draft.trim();
    if (!text || notes.length >= MAX_NOTES) return;
    setNotes((prev) => [{ id: `${Date.now()}`, text }, ...prev].slice(0, MAX_NOTES));
    setDraft('');
  };

  const full = notes.length >= MAX_NOTES;

  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-semibold text-ghana-black">Notes</p>
      <textarea
        value={draft}
        rows={2}
        maxLength={180}
        disabled={full}
        placeholder={full ? 'Clear a note to add another' : 'A reminder for yourself…'}
        aria-label="New note"
        className="w-full resize-none rounded-md border border-amber-200 bg-[#fff8dc] px-2 py-1.5 text-xs text-ghana-black outline-none placeholder:text-amber-900/40 focus:border-amber-400 disabled:opacity-60"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            add();
          }
        }}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-400">{notes.length}/{MAX_NOTES}</span>
        <button
          type="button"
          onClick={add}
          disabled={full || !draft.trim()}
          className="rounded-md bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-ghana-black disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {notes.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-1 rounded-md border border-amber-200 bg-[#fff4c2] px-2 py-1.5 shadow-sm">
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs text-ghana-black">{note.text}</p>
              <button
                type="button"
                aria-label="Clear note"
                onClick={() => setNotes((prev) => prev.filter((item) => item.id !== note.id))}
                className="shrink-0 text-xs leading-none text-amber-900/50 hover:text-ghana-black"
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
