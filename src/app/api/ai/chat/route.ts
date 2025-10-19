import { NextRequest } from 'next/server';

export const runtime = 'edge';

async function streamTextFromOpenAI(messages: Array<{ role: 'user'|'assistant'|'system'; content: string }>) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

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
  return resp.body as ReadableStream<Uint8Array>;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, context } = await req.json();
    const system = `You are a hotel operations AI assistant. Be concise and practical. Use Ghana hotel context. If asked to draft a notice, return a short, clear message.`;
    const messages = [
      { role: 'system', content: system },
      ...(Array.isArray(context) ? context : []).map((c: any) => ({ role: c.role, content: c.content })),
      { role: 'user', content: String(prompt || '') }
    ];

    try {
      const stream = await streamTextFromOpenAI(messages as any);
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
    } catch (e) {
      // Fallback: simple local response
      const fallback = 'AI is temporarily unavailable. Consider drafting a short notice and selecting the relevant department.';
      return new Response(fallback, { headers: { 'Content-Type': 'text/plain' } });
    }
  } catch (e: any) {
    return new Response(`Error: ${e.message || 'unknown'}`, { status: 400 });
  }
}


