import { runSync } from '@/lib/gmail/sync';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  let userId: string | null = null;
  
  if (authHeader === `Bearer ${process.env.TOKEN_ENCRYPTION_KEY}`) {
    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      // Ignore
    }
  } else {
    const cookieStore = await cookies();
    userId = cookieStore.get('user_id')?.value || null;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSync(userId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
