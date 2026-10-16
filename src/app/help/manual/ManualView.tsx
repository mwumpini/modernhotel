'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandLogo from '../../components/BrandLogo';
import {
  helpTopics,
  configurationGuide,
  groupHelpTopics,
  keyboardShortcuts,
} from '../helpContent';
import { groupOperationsTopics, operationsManual } from '../operationsContent';
import { groupProcessFlows, processFlowsManual } from '../processFlowsContent';

/**
 * The whole Help as one printable manual, opened from the Help page. Its own buttons save a
 * file to share or print / save as PDF (?print=1 still opens the print window straight away). Built from helpContent.ts, so it never falls out of date with Help.
 */
const shortcuts = keyboardShortcuts;

const anchor = (id: string) => `topic-${id}`;

/** Picture as a data: URL, so a downloaded copy shows it with no internet or sign-in. */
async function inlineImage(src: string): Promise<string> {
  try {
    const blob = await (await fetch(src)).blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(src);
      reader.readAsDataURL(blob);
    });
  } catch {
    return src;
  }
}

/**
 * One self-contained .html file of the manual (styles and pictures inside), to send on
 * WhatsApp or email. It opens in any browser, offline, and can still be printed to PDF.
 */
async function downloadManualFile(root: HTMLElement, docTitle: string, fileStem: string) {
  const copy = root.cloneNode(true) as HTMLElement;
  copy.querySelector('.bar')?.remove();
  const images = Array.from(copy.querySelectorAll('img'));
  await Promise.all(images.map(async (img) => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('data:')) img.setAttribute('src', await inlineImage(new URL(src, window.location.href).href));
    img.removeAttribute('srcset');
  }));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${docTitle}</title></head><body style="margin:0">${copy.outerHTML}</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileStem}-${new Date().toLocaleDateString('en-CA')}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * The printable/downloadable manual. "user" is the whole Help (desk by desk); "operations"
 * is the Operations Manual: what every policy and rule means, with worked examples.
 */
export default function ManualView({ variant }: { variant: 'user' | 'operations' | 'flows' }) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const isUser = variant === 'user';
  const groups = isUser ? groupHelpTopics(helpTopics) : variant === 'operations' ? groupOperationsTopics() : groupProcessFlows();
  const docName = isUser ? 'User Manual' : variant === 'operations' ? 'Operations Manual' : 'Process Flows';
  const docTitle = `AGM Sync ${docName}`;
  const fileStem = `AGM-Sync-${docName.replace(/ /g, '-')}`;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('print') !== '1') return;
    // Wait for the screenshots so they are in the PDF.
    const images = Array.from(document.images);
    Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; }))))
      .then(() => setTimeout(() => window.print(), 300));
  }, []);

  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="manual" ref={rootRef}>
      <style>{`
        .manual { --ink:#1d2330; --muted:#5b6475; --line:#e3e6ec; --accent:#1f6feb; --soft:#f4f6fa; --warn:#fff6db;
          color:var(--ink); background:#fff; font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; min-height:100vh; }
        .manual .bar { position:sticky; top:0; z-index:5; display:flex; gap:10px; align-items:center; justify-content:space-between;
          padding:10px 16px; background:#fff; border-bottom:1px solid var(--line); }
        .manual .bar a, .manual .bar button { font:inherit; font-size:14px; padding:7px 14px; border-radius:10px; border:1px solid var(--line);
          background:#fff; color:var(--ink); text-decoration:none; cursor:pointer; }
        .manual .bar button { background:var(--accent); border-color:var(--accent); color:#fff; }
        .manual .bar button.secondary { background:#fff; color:var(--accent); }
        .manual .bar button:disabled { opacity:.6; cursor:wait; }
        .manual main { max-width:820px; margin:0 auto; padding:24px 16px 60px; }
        .manual .cover { padding:60px 0 40px; border-bottom:4px solid var(--accent); margin-bottom:24px; }
        .manual .cover h1 { font-size:34px; margin:0 0 8px; }
        .manual .cover p { color:var(--muted); margin:4px 0; }
        .manual h2 { font-size:24px; margin:36px 0 12px; padding-top:8px; border-top:3px solid var(--accent); }
        .manual h3 { font-size:19px; margin:0 0 6px; }
        .manual .topic { border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin:14px 0; }
        .manual .topic p.desc { color:var(--muted); margin:0 0 8px; }
        .manual ol { list-style:decimal; padding-left:22px; margin:8px 0; } .manual li { margin:4px 0; }
        .manual img { display:block; max-width:100%; height:auto; border:1px solid var(--line); border-radius:8px; margin:10px 0 4px; }
        .manual .caption { font-size:12px; color:var(--muted); }
        .manual table.rules { width:100%; border-collapse:collapse; margin:8px 0; font-size:14px; }
        .manual table.rules th { text-align:left; vertical-align:top; width:32%; padding:6px 8px; border-bottom:1px solid #e5e7eb; font-weight:600; }
        .manual table.rules td { padding:6px 8px; border-bottom:1px solid #e5e7eb; }
        .manual .example { background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:8px 12px; margin-top:8px; font-size:14px; break-inside:avoid; }
        .manual .example ul { margin:4px 0 0 18px; padding:0; }
        .manual table.flow { font-size:13px; }
        .manual table.flow td.n { width:28px; text-align:center; font-weight:600; color:var(--accent); }
        .manual table.flow th:nth-child(2), .manual table.flow td:nth-child(2) { width:13%; }
        .manual table.flow th:nth-child(3), .manual table.flow td:nth-child(3) { width:17%; }
        .manual .note { background:var(--warn); border-radius:8px; padding:8px 12px; margin-top:8px; font-size:14px; }
        .manual .toc { padding-left:20px; } .manual .toc > li { break-inside:avoid; margin:10px 0; }
        .manual .toc ol { margin:2px 0 0; padding-left:18px; } .manual .toc > li > a { font-weight:600; }
        .manual .toc a { color:var(--accent); text-decoration:none; }
        .manual table { border-collapse:collapse; width:100%; font-size:14px; margin:8px 0; }
        .manual th, .manual td { border:1px solid var(--line); padding:6px 8px; text-align:left; vertical-align:top; }
        .manual th { background:var(--soft); }
        .manual kbd { border:1px solid var(--line); border-radius:4px; padding:0 5px; font-family:ui-monospace,monospace; font-size:13px; background:var(--soft); }
        @media (max-width:600px) { .manual .cover h1 { font-size:26px; } }
        @media print {
          @page { size:A4; margin:16mm 14mm; }
          /* The app-wide print rule hides everything outside #report-print-area; the manual is all content. */
          .manual, .manual * { visibility: visible !important; }
          .manual .bar { display:none; }
          .manual main { max-width:none; padding:0; }
          .manual h2 { break-before:page; }
          .manual .topic { break-inside:avoid; }
          .manual .topic:has(table.flow) { break-inside:auto; }
          .manual table.flow tr { break-inside:avoid; }
          .manual a { color:inherit; }
        }
      `}</style>

      <div className="bar">
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/">← Back to the app</Link>
          <Link href="/help">← Back to Help</Link>
        </span>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={async () => {
              if (!rootRef.current) return;
              setSaving(true);
              try { await downloadManualFile(rootRef.current, docTitle, fileStem); } finally { setSaving(false); }
            }}
          >
            {saving ? 'Preparing…' : 'Download file (to share)'}
          </button>
          <button type="button" onClick={() => window.print()}>Print / Save as PDF</button>
        </span>
      </div>

      <main>
        <section className="cover">
          <BrandLogo size="lg" syncClass="text-slate-900" className="mb-6" />
          <h1>{docName}</h1>
          {isUser ? (
            <p>The desks in side-menu order: Executive Management, then Front Office (Desk, Rooms, Billing, Clients, Night, and Reports), then Events, Restaurant, Kitchen, Housekeeping, Stores, Security, HR, Accounting, Compliance, and System Settings.</p>
          ) : (
            <p>{variant === 'operations' ? operationsManual.intro : processFlowsManual.intro}</p>
          )}
          <p>Generated {today}. The Help page in the app always has the latest version.</p>
        </section>

        <h2 style={{ breakBefore: 'auto', borderTop: 'none' }}>Contents</h2>
        <ol className="toc">
          {groups.map((g) => (
            <li key={g.id}>
              <a href={`#module-${g.id}`}>{g.title}</a>
              <ol>
                {g.id === 'settings' && (
                  <li><a href="#where-to-configure">{configurationGuide.title}</a></li>
                )}
                {g.topics.map((t) => (
                  <li key={t.id}><a href={`#${anchor(t.id)}`}>{t.title}</a></li>
                ))}
              </ol>
            </li>
          ))}
          {isUser && <li><a href="#shortcuts">Keyboard shortcuts</a></li>}
        </ol>

        {groups.map((g) => (
          <section key={g.id}>
            <h2 id={`module-${g.id}`}>{g.title}</h2>
            <p>{g.intro}</p>
            {g.id === 'settings' && (
              <>
                <h3 id="where-to-configure">{configurationGuide.title}</h3>
                <p>{configurationGuide.intro}</p>
                <table>
                  <thead><tr><th>Area</th><th>Set it here</th><th>Not here</th></tr></thead>
                  <tbody>
                    {configurationGuide.areas.map((a) => (
                      <tr key={a.name}><td>{a.name}</td><td>{a.owns}</td><td>{a.notHere}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {g.topics.map((t) => (
              <article key={t.id} id={anchor(t.id)} className="topic">
                <h3>{t.title}</h3>
                <p className="desc">{t.description}</p>
                {t.steps && t.steps.length > 0 && (
                  <ol>{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                )}
                {t.flow && t.flow.length > 0 && (
                  <table className="flow">
                    <thead><tr><th>#</th><th>Who</th><th>Where</th><th>What they do</th><th>What the system does</th></tr></thead>
                    <tbody>{t.flow.map((f, i) => (
                      <tr key={i}><td className="n">{i + 1}</td><td>{f.who}</td><td>{f.where}</td><td>{f.action}</td><td>{f.result}</td></tr>
                    ))}</tbody>
                  </table>
                )}
                {t.image && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.image} alt={t.imageAlt || t.title} loading="eager" />
                    {t.imageAlt && <div className="caption">{t.imageAlt}</div>}
                  </>
                )}
                {t.rules && t.rules.length > 0 && (
                  <table className="rules"><tbody>{t.rules.map((r) => <tr key={r.name}><th>{r.name}</th><td>{r.meaning}</td></tr>)}</tbody></table>
                )}
                {t.examples && t.examples.map((ex) => (
                  <div key={ex.title} className="example"><strong>Example: {ex.title}</strong><ul>{ex.lines.map((l, i) => <li key={i}>{l}</li>)}</ul></div>
                ))}
                {t.notHere && <div className="note"><strong>Not here:</strong> {t.notHere}</div>}
              </article>
            ))}
          </section>
        ))}

        {isUser && (
          <>
            <h2 id="shortcuts">Keyboard shortcuts</h2>
            <table>
              <thead><tr><th>Keys</th><th>What it does</th></tr></thead>
              <tbody>
                {shortcuts.map((s) => <tr key={s.keys}><td><kbd>{s.keys}</kbd></td><td>{s.action}</td></tr>)}
              </tbody>
            </table>
          </>
        )}
      </main>
    </div>
  );
}
