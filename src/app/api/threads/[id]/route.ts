import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { summarizeThread } from '@/lib/ai/summarize';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Await params as per Next.js 15+ App Router rules for dynamic segments
  const resolvedParams = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: thread } = await supabase
    .from('threads')
    .select('*')
    .eq('id', resolvedParams.id)
    .eq('user_id', userId)
    .single();

  if (!thread) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', resolvedParams.id)
    .order('internal_date', { ascending: true });

  return NextResponse.json({ thread, messages });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  try {
    const summary = await summarizeThread(resolvedParams.id);
    return NextResponse.json({ summary });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
