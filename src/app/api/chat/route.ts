import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { generateEmbeddings } from '@/lib/ai/embeddings';
import { generateContentWithFallback } from '@/lib/ai/gemini';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { query, history, threadContext } = await request.json();

    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 });

    let contextText = '';
    let sources: any[] = [];

    if (threadContext) {
      contextText = `--- Currently Open Email Thread ---\n${threadContext}\n-------------------`;
    } else {
      // 1. Generate embedding for the query
      const embeddings = await generateEmbeddings([query], 'query');
      const queryEmbedding = embeddings[0];

      // 2. Retrieve relevant chunks via RPC
      const { data: chunks, error: rpcError } = await supabase.rpc('match_email_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.2,
        match_count: 50,
        p_user_id: userId
      });

      if (rpcError) throw rpcError;

      // 3. Format prompt with context
      contextText = chunks?.map((chunk: any) => {
        return `--- Email snippet from ${chunk.metadata?.date ? new Date(chunk.metadata.date).toLocaleString() : 'Unknown'} ---\nSubject: ${chunk.metadata?.subject || 'Unknown'}\nFrom: ${chunk.metadata?.from || 'Unknown'}\nText: ${chunk.chunk_text}\n-------------------`;
      }).join('\n\n') || '';

      sources = chunks?.map((c: any) => ({ ...c.metadata, message_id: c.message_id })) || [];
    }

    const historyText = history && history.length > 0 
      ? history.map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
      : 'No previous conversation.';

    const prompt = `
You are an intelligent email assistant. Answer the user's question using ONLY the provided email context below. 
If the context does not contain the answer, politely say that you don't have enough information from the synced emails.
Always be concise, professional, and cite the emails you use (e.g., "According to the email from X on Date...").

Previous Conversation History:
${historyText}

Email Context:
${contextText || 'No relevant emails found.'}

User's Current Question: "${query}"
`;

    // 4. Generate AI Answer using Fallback wrapper
    const response = await generateContentWithFallback([
      { role: 'user', parts: [{ text: prompt }] }
    ]);

    const answer = response.response.text();

    // 5. Enhance sources with thread_id for frontend clickability
    if (!threadContext && sources.length > 0) {
      const messageIds = [...new Set(sources.map((s: any) => s.message_id))];
      const { data: messages } = await supabase
        .from('messages')
        .select('id, thread_id')
        .in('id', messageIds);
        
      if (messages) {
        const messageToThreadMap = new Map(messages.map(m => [m.id, m.thread_id]));
        sources = sources.map((s: any) => ({
          ...s,
          thread_id: messageToThreadMap.get(s.message_id)
        }));
      }
    }

    return NextResponse.json({ 
      answer,
      sources
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
