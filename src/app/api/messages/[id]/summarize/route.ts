import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateContentWithFallback } from '@/lib/ai/gemini';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const messageId = (await params).id;

    const { data: message } = await supabase
      .from('messages')
      .select('body_plain, email_summary')
      .eq('id', messageId)
      .single();

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.email_summary) {
      return NextResponse.json({ summary: message.email_summary });
    }

    if (!message.body_plain) {
      return NextResponse.json({ error: 'Message has no text body to summarize' }, { status: 400 });
    }

    const prompt = `Summarize the following email message concisely in 1-2 sentences. Do not use conversational filler, just provide the summary.\n\nEmail body:\n${message.body_plain.substring(0, 10000)}`;
    
    const response = await generateContentWithFallback([{ role: 'user', parts: [{ text: prompt }] }]);
    const summary = response.response.text().trim();

    await supabase
      .from('messages')
      .update({ email_summary: summary })
      .eq('id', messageId);

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Error summarizing message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
