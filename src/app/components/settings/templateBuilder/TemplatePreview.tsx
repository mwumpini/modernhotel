'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { BlockTemplate } from '../../../lib/print/blocks';
import type { PrintData } from '../../../lib/print/templates';
import { renderBlockTemplate } from '../../../lib/print/blockRenderer';

interface TemplatePreviewProps {
  template: BlockTemplate;
  sampleData: PrintData;
  className?: string;
}

/** A4 (210mm) at 96dpi. The sheet uses the pane width up to this, so it stays on screen. */
const A4_WIDTH = 794;
const A4_RATIO = 297 / 210;

/** Live preview pane — debounced so rapid edits (e.g. typing a heading) don't
 *  re-render the iframe on every keystroke. The sheet is as wide as the pane,
 *  up to A4, and at least one A4 page tall. */
export default function TemplatePreview({ template, sampleData, className }: TemplatePreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [html, setHtml] = useState(() => renderBlockTemplate(template, sampleData));

  useEffect(() => {
    const handle = setTimeout(() => {
      setHtml(renderBlockTemplate(template, sampleData));
    }, 250);
    return () => clearTimeout(handle);
  }, [template, sampleData]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) setPaneWidth(prev => (Math.abs(prev - width) < 1 ? prev : width));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const pageWidth = paneWidth > 0 ? Math.min(paneWidth, A4_WIDTH) : A4_WIDTH;
  const a4Height = Math.round(pageWidth * A4_RATIO);
  const pageHeight = Math.max(a4Height, contentHeight);

  const measurePage = () => {
    const doc = iframeRef.current?.contentDocument;
    const next = doc?.documentElement?.scrollHeight || 0;
    if (next > 0) setContentHeight(prev => (Math.abs(prev - next) < 2 ? prev : next));
  };

  useEffect(() => {
    const frame = requestAnimationFrame(measurePage);
    return () => cancelAnimationFrame(frame);
  }, [paneWidth, html]);

  return (
    <div
      ref={frameRef}
      className={`w-full min-w-0 max-w-full overflow-hidden rounded-lg border bg-white ${className || ''}`}
      style={{ height: pageHeight }}
    >
      <iframe
        ref={iframeRef}
        title="Template preview"
        srcDoc={html}
        sandbox="allow-same-origin"
        className="block max-w-full border-0 bg-white"
        onLoad={measurePage}
        style={{ width: paneWidth > 0 ? pageWidth : '100%', height: pageHeight }}
      />
    </div>
  );
}
