'use client';

import { confirmChoice } from '@/app/components/DangerConfirm';
import { DEFAULT_EMAIL_NOTE } from '../print/blocks';
import { mailNote } from './mailNote';

/** Asks before anything is sent. Cancel sends nothing. */
export async function confirmDocumentSend(to: string, documentName: string) {
  const what = documentName.replace(/-/g, ' ');
  return confirmChoice(
    'Send this email?',
    `You are about to send the ${what} to ${to}.`,
    'Send',
  );
}

/** The short note in the inbox. The document itself goes out as a PDF. */
export function documentIntro(name: string, documentName: string, hotel: string) {
  return mailNote({ name, documentName, facility: hotel });
}

function loadHtml2Pdf(): Promise<(...args: unknown[]) => any> {
  const host = window as Window & { html2pdf?: (...args: unknown[]) => any };
  if (host.html2pdf) return Promise.resolve(host.html2pdf);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => (host.html2pdf ? resolve(host.html2pdf) : reject(new Error('Could not prepare the PDF.')));
    script.onerror = () => reject(new Error('Could not prepare the PDF.'));
    document.body.appendChild(script);
  });
}

function sheetCss(styles: string, narrow: boolean) {
  const aimed = styles
    .replace(/:root/g, '#pdf-sheet')
    .replace(/(^|[\s,{>~+])html(?=[\s,{.:#[>~+]|$)/g, '$1#pdf-sheet')
    .replace(/(^|[\s,{>~+])body(?=[\s,{.:#[>~+]|$)/g, '$1#pdf-sheet');
  const page = narrow
    ? '#pdf-sheet{height:auto!important;overflow:visible!important;background:#fff;width:72mm!important;max-width:72mm!important;padding:2mm 0 4mm!important;min-height:0!important;margin:0!important;box-sizing:border-box!important}'
    : '#pdf-sheet{height:auto!important;overflow:visible!important;background:#fff;box-sizing:border-box!important;width:210mm!important;max-width:210mm!important;min-height:297mm!important;margin:0!important;padding:12mm!important}';
  return `${aimed}\n${page}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** The print layout of a document, as a PDF. Email and download both use this. */
export async function documentPdfBase64(html: string): Promise<string> {
  const parsed = new DOMParser().parseFromString(
    html.replace(/<script>\s*window\.print\(\)\s*<\/script>/gi, ''),
    'text/html',
  );
  const styles = [...parsed.querySelectorAll('style')].map((node) => node.textContent || '').join('\n');
  const narrow = /max-width:\s*320px/.test(styles);
  // Templates stamp this while printing the page. A cleared note stays off the PDF.
  const marker = parsed.getElementById('agm-email-note');
  const emailNote = (marker ? marker.textContent || '' : DEFAULT_EMAIL_NOTE).trim();
  marker?.remove();
  const emailLine = emailNote
    ? `<p style="margin:16px 0 0;font-size:11px;color:#555;font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(emailNote)}</p>`
    : '';
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;pointer-events:none';
  const sheet = document.createElement('div');
  sheet.id = 'pdf-sheet';
  // The painter copies this node out of the page. The template styles have to
  // travel inside it, or the PDF is the bare text instead of the print.
  // The node itself must stay in normal flow: a fixed position is copied too,
  // and the copy then has no height.
  sheet.innerHTML = `<style>${sheetCss(styles, narrow)}</style>${parsed.body?.innerHTML || ''}${emailLine}`;
  holder.appendChild(sheet);
  document.body.appendChild(holder);
  try {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    const html2pdf = await loadHtml2Pdf();
    const dataUri = await html2pdf().set({
      margin: 0,
      filename: 'document.pdf',
      pagebreak: { mode: [] as string[] },
      jsPDF: {
        unit: 'pt',
        format: narrow ? [226, Math.max(400, Math.ceil(sheet.scrollHeight * 0.75))] : 'a4',
        orientation: 'portrait' as const,
      },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    }).from(sheet).outputPdf('datauristring');
    const encoded = String(dataUri).split(',')[1] || '';
    if (!encoded.startsWith('JVBERi')) throw new Error('Could not prepare the PDF.');
    return encoded;
  } finally {
    holder.remove();
  }
}

/** Staff pressed Send. The inbox gets a short note, and the printed document is the PDF. */
export async function sendDocumentEmail(input: {
  to: string;
  subject: string;
  intro: string;
  documentHtml: string;
  filename: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const pdf = await documentPdfBase64(input.documentHtml);
    const response = await fetch('/api/email/send-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: input.to,
        subject: input.subject,
        html: input.intro,
        filename: input.filename,
        pdf,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error || 'Could not send the email.' };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not send the email.' };
  }
}
