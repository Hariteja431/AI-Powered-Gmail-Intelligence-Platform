import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateDailyDigest } from '@/lib/ai/summarize';
import { generateNewsletterDigest } from '@/lib/ai/newsletters';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { type } = await request.json();
    let digest = '';
    
    if (type === 'newsletters') {
      digest = await generateNewsletterDigest(userId);
    } else {
      digest = await generateDailyDigest(userId);
    }

    return NextResponse.json({ digest });
  } catch (error: any) {
    console.error('Digest error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
