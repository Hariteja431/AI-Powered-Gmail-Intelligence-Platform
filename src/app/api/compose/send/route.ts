import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sendReply } from '@/lib/gmail/send';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { threadId, body } = await request.json();
    const result = await sendReply(userId, threadId, body);
    return NextResponse.json({ result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
