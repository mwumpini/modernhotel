import { NextRequest } from 'next/server';
import { requireAuth } from '@/app/lib/api/auth-guard';
import { localMamaniReply } from '../../../lib/ai/mamaniReply';
import { findHelp, isHelpQuestion } from '../../../lib/ai/helpSearch';

function asLines(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v || '').trim()).filter(Boolean).slice(0, limit);
}

async function streamTextFromOpenAI(messages: Array<{ role: 'user'|'assistant'|'system'; content: string }>) {
  // Any provider that speaks the OpenAI chat format (Google Gemini, Groq, OpenAI).
  // AI_* names first; the older OPENAI_* names still work. A trailing slash is fine.
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) throw new Error('Missing AI_API_KEY');

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.2,
      max_tokens: 400
    })
  });
  if (!resp.ok || !resp.body) throw new Error('OpenAI response error');
  return plainTextFromSse(resp.body as ReadableStream<Uint8Array>);
}

/** OpenAI streams `data: {json}` lines; the chat window wants just the words. */
function plainTextFromSse(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const emit = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    const data = line.trim();
    if (!data.startsWith('data:')) return;
    const payload = data.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    try {
      const text = JSON.parse(payload)?.choices?.[0]?.delta?.content;
      if (typeof text === 'string' && text) controller.enqueue(encoder.encode(text));
    } catch {
      // A partial or non-JSON line carries no reply text.
    }
  };
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) emit(line, controller);
      },
      flush(controller) {
        if (buffer) emit(buffer, controller);
      },
    }),
  );
}

export async function POST(req: NextRequest) {
  // Signed-in staff only: this route can spend the OpenAI key.
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const prompt = String(body?.prompt || '');
    const desk = String(body?.desk || 'this desk');
    const snapshot = asLines(body?.snapshot, 6);
    const notices = asLines(body?.notices, 5);
    const help = isHelpQuestion(prompt) ? findHelp(prompt, String(body?.deskKey || '')) : [];
    const system = [
      `You are Ask Mamani, the assistant for the ${desk} desk of a Ghana hotel. You also answer how-to questions from the hotel Help topics.`,
      'Reply in at most 4 short sentences.',
      'For a how-to question, use only the help excerpts. Do not invent screens. Include the Not here note when one is listed.',
      'Use only the counts and notices below for operations questions. If a number is not listed, say you do not have it.',
      'When asked to draft a notice, return only the notice text, ready for a person to send.',
      'You cannot change records, post notices, or send messages.',
      snapshot.length ? `Desk snapshot:\n- ${snapshot.join('\n- ')}` : 'Desk snapshot: live counts are not loaded.',
      notices.length ? `Latest notices:\n- ${notices.join('\n- ')}` : 'Latest notices: none.',
      help.length ? `Help excerpts:\n- ${help.map((h) => h.text).join('\n- ')}` : 'Help excerpts: none for this question.',
    ].join('\n');
    const messages = [
      { role: 'system', content: system },
      ...(Array.isArray(body?.context) ? body.context : []).map((c: any) => ({ role: c.role, content: c.content })),
      { role: 'user', content: prompt }
    ];

    try {
      const stream = await streamTextFromOpenAI(messages as any);
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Mamani-Source': 'ai' } });
    } catch (e) {
      const fallback = localMamaniReply(prompt, { label: desk, snapshot, notices, help: help.map((h) => h.text) });
      return new Response(fallback, { headers: { 'Content-Type': 'text/plain' } });
    }
  } catch (e: any) {
    return new Response(`Error: ${e.message || 'unknown'}`, { status: 400 });
  }
}


