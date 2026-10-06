'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  helpTopics,
  configurationGuide,
  helpCategoryLabels,
  keyboardShortcuts,
  type HelpTopicCategory,
} from '../helpContent';

/**
 * The whole Help as one printable manual. "Download manual" on the Help page opens this with
 * ?print=1, which brings up the print window: choose "Save as PDF" to keep a copy to read
 * beside the app. Built from helpContent.ts, so it never falls out of date with Help.
 */
const CATEGORY_ORDER: HelpTopicCategory[] = ['start', 'operations', 'configuration', 'finance', 'general'];

const shortcuts = keyboardShortcuts;

const anchor = (id: string) => `topic-${id}`;

export default function HelpManualPage() {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    topics: helpTopics.filter((t) => t.category === category && t.id !== 'help-maintain'),
  })).filter((g) => g.topics.length > 0);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('print') !== '1') return;
    // Wait for the screenshots so they are in the PDF.
    const images = Array.from(document.images);
    Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; }))))
      .then(() => setTimeout(() => window.print(), 300));
  }, []);

  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="manual">
      <style>{`
        .manual { --ink:#1d2330; --muted:#5b6475; --line:#e3e6ec; --accent:#1f6feb; --soft:#f4f6fa; --warn:#fff6db;
          color:var(--ink); background:#fff; font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; min-height:100vh; }
        .manual .bar { position:sticky; top:0; z-index:5; display:flex; gap:10px; align-items:center; justify-content:space-between;
          padding:10px 16px; background:#fff; border-bottom:1px solid var(--line); }
        .manual .bar a, .manual .bar button { font:inherit; font-size:14px; padding:7px 14px; border-radius:10px; border:1px solid var(--line);
          background:#fff; color:var(--ink); text-decoration:none; cursor:pointer; }
        .manual .bar button { background:var(--accent); border-color:var(--accent); color:#fff; }
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
        .manual .note { background:var(--warn); border-radius:8px; padding:8px 12px; margin-top:8px; font-size:14px; }
        .manual .toc { columns:2; column-gap:28px; padding-left:20px; } .manual .toc li { break-inside:avoid; }
        .manual .toc a { color:var(--accent); text-decoration:none; }
        .manual table { border-collapse:collapse; width:100%; font-size:14px; margin:8px 0; }
        .manual th, .manual td { border:1px solid var(--line); padding:6px 8px; text-align:left; vertical-align:top; }
        .manual th { background:var(--soft); }
        .manual kbd { border:1px solid var(--line); border-radius:4px; padding:0 5px; font-family:ui-monospace,monospace; font-size:13px; background:var(--soft); }
        @media (max-width:600px) { .manual .toc { columns:1; } .manual .cover h1 { font-size:26px; } }
        @media print {
          @page { size:A4; margin:16mm 14mm; }
          .manual .bar { display:none; }
          .manual main { max-width:none; padding:0; }
          .manual h2 { break-before:page; }
          .manual .topic { break-inside:avoid; }
          .manual a { color:inherit; }
        }
      `}</style>

      <div className="bar">
        <Link href="/help">← Back to Help</Link>
        <button type="button" onClick={() => window.print()}>Download / print (Save as PDF)</button>
      </div>

      <main>
        <section className="cover">
          <h1>Hotel Management System: User Manual</h1>
          <p>Step-by-step guide to every desk: front office, restaurant, kitchen, housekeeping, stores, events, security, HR and payroll, accounting and tax.</p>
          <p>Generated {today}. The Help page in the app always has the latest version.</p>
        </section>

        <h2 style={{ breakBefore: 'auto', borderTop: 'none' }}>Contents</h2>
        <ol className="toc">
          <li><a href="#where-to-configure">{configurationGuide.title}</a></li>
          {groups.map((g) => (
            <React.Fragment key={g.category}>
              {g.topics.map((t) => (
                <li key={t.id}><a href={`#${anchor(t.id)}`}>{t.title}</a></li>
              ))}
            </React.Fragment>
          ))}
          <li><a href="#shortcuts">Keyboard shortcuts</a></li>
        </ol>

        <h2 id="where-to-configure">{configurationGuide.title}</h2>
        <p>{configurationGuide.intro}</p>
        <table>
          <thead><tr><th>Area</th><th>Set it here</th><th>Not here</th></tr></thead>
          <tbody>
            {configurationGuide.areas.map((a) => (
              <tr key={a.name}><td>{a.name}</td><td>{a.owns}</td><td>{a.notHere}</td></tr>
            ))}
          </tbody>
        </table>

        {groups.map((g) => (
          <section key={g.category}>
            <h2>{helpCategoryLabels[g.category]}</h2>
            {g.topics.map((t) => (
              <article key={t.id} id={anchor(t.id)} className="topic">
                <h3>{t.title}</h3>
                <p className="desc">{t.description}</p>
                {t.steps && t.steps.length > 0 && (
                  <ol>{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                )}
                {t.image && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.image} alt={t.imageAlt || t.title} loading="eager" />
                    {t.imageAlt && <div className="caption">{t.imageAlt}</div>}
                  </>
                )}
                {t.notHere && <div className="note"><strong>Not here:</strong> {t.notHere}</div>}
              </article>
            ))}
          </section>
        ))}

        <h2 id="shortcuts">Keyboard shortcuts</h2>
        <table>
          <thead><tr><th>Keys</th><th>What it does</th></tr></thead>
          <tbody>
            {shortcuts.map((s) => <tr key={s.keys}><td><kbd>{s.keys}</kbd></td><td>{s.action}</td></tr>)}
          </tbody>
        </table>
      </main>
    </div>
  );
}
