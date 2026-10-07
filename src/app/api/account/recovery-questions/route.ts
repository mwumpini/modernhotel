import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/app/lib/database/client';
import { requireAuth } from '@/app/lib/api/auth-guard';
import {
  hashRecoveryAnswers,
  normalizeRecoveryAnswer,
  publicRecoveryQuestions,
  recoveryQuestionText,
} from '@/app/lib/auth/recoveryQuestions';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  const userId = (auth.session as { user?: { id?: string } }).user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized — please log in' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  return NextResponse.json({ questions: publicRecoveryQuestions(user?.preferences) });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  const userId = (auth.session as { user?: { id?: string } }).user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized — please log in' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || '');
  const incoming = Array.isArray(body.questions) ? body.questions : [];
  const pairs: { id: string; answer: string }[] = incoming.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const id = String((item as { id?: unknown }).id || '');
    const answer = String((item as { answer?: unknown }).answer || '');
    return [{ id, answer }];
  });
  if (pairs.length < 2 || new Set(pairs.map((pair) => pair.id)).size !== pairs.length) {
    return NextResponse.json({ error: 'Choose at least two different secret questions.' }, { status: 400 });
  }
  if (pairs.some((pair) => !recoveryQuestionText(pair.id) || normalizeRecoveryAnswer(pair.answer).length < 2)) {
    return NextResponse.json({ error: 'Each answer needs at least 2 characters.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.password || !(await bcrypt.compare(currentPassword, user.password))) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
  }

  const prefs = user.preferences && typeof user.preferences === 'object' && !Array.isArray(user.preferences)
    ? (user.preferences as Record<string, unknown>)
    : {};
  const { recoveryFails: _fails, ...rest } = prefs;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      preferences: {
        ...rest,
        recoveryQuestions: await hashRecoveryAnswers(pairs),
      },
    },
  });
  return NextResponse.json({ questions: pairs.map((pair) => ({ id: pair.id, text: recoveryQuestionText(pair.id) })) });
}
