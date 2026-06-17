import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { draftReply } from '@/lib/ai/compose';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { threadId, instruction } = await request.json();
    const draft = await draftReply(threadId, instruction);
    return NextResponse.json({ draft });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
