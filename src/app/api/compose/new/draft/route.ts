import { NextResponse } from 'next/server';
import { draftNewEmail } from '@/lib/ai/compose';

export async function POST(req: Request) {
  try {
    const { instruction } = await req.json();

    if (!instruction) {
      return NextResponse.json({ error: 'Instruction is required' }, { status: 400 });
    }

    const result = await draftNewEmail(instruction);

    return NextResponse.json({ to: result.to, draft: result.body, subject: result.subject });
  } catch (error: any) {
    console.error('Error drafting new email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
