import { NextRequest, NextResponse } from 'next/server';
import { addCompanyExpense, listCompanyExpenses } from '@/app/lib/platform/operator';
import { requireOperator } from '@/app/lib/platform/requireOperator';

export async function GET() {
  const gate = await requireOperator();
  if (gate.error) return gate.error;
  const expenses = await listCompanyExpenses();
  return NextResponse.json({ expenses });
}

export async function POST(request: NextRequest) {
  const gate = await requireOperator();
  if (gate.error) return gate.error;
  const body = await request.json().catch(() => ({}));
  const result = await addCompanyExpense({
    paidOn: String(body.paidOn || ''),
    amount: body.amount,
    kind: String(body.kind || ''),
    detail: String(body.detail || ''),
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ expenses: result.expenses }, { status: 201 });
}
