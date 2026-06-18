import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { chunkText, generateEmbeddings } from '@/lib/ai/embeddings';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 20; // Number of messages to process per request
const MAX_CHUNKS_PER_NIM_CALL = 50; // NVIDIA API limits batch size

export async function POST() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 1. Find messages for this user that DO NOT have chunks yet
    // Fetch all message IDs efficiently
    const { data: allMsgIds } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', userId);

    const { data: existingChunkIds } = await supabase
      .from('email_chunks')
      .select('message_id')
      .eq('user_id', userId);

    const embeddedMessageIds = new Set(existingChunkIds?.map(c => c.message_id) || []);
    const unembeddedIds = allMsgIds?.map(m => m.id).filter(id => !embeddedMessageIds.has(id)) || [];

    if (unembeddedIds.length === 0) {
      return NextResponse.json({ message: 'All messages are already embedded.', count: 0, hasMore: false });
    }

    const idsToFetch = unembeddedIds.slice(0, BATCH_SIZE);
    
    const { data: messagesToEmbed } = await supabase
      .from('messages')
      .select('id, body_plain, subject, from_name, from_email, internal_date')
      .in('id', idsToFetch);

    if (!messagesToEmbed || messagesToEmbed.length === 0) {
      return NextResponse.json({ message: 'Failed to fetch message details.', count: 0, hasMore: false });
    }

    // 2. Chunk the text
    const allChunks: { message_id: string; chunk_text: string; metadata: any }[] = [];
    
    for (const msg of messagesToEmbed) {
      const textToChunk = msg.body_plain || msg.subject || '';
      if (!textToChunk) continue;

      const chunks = chunkText(textToChunk, 512);
      for (let i = 0; i < chunks.length; i++) {
        // Build metadata context for the embedding engine
        const contextPrefix = `Date: ${new Date(msg.internal_date).toISOString()}\nFrom: ${msg.from_name || ''} <${msg.from_email}>\nSubject: ${msg.subject}\n\n`;
        allChunks.push({
          message_id: msg.id,
          chunk_text: contextPrefix + chunks[i],
          metadata: {
            subject: msg.subject,
            from: msg.from_email,
            date: msg.internal_date,
            chunk_index: i
          }
        });
      }
    }

    if (allChunks.length === 0) {
      return NextResponse.json({ message: 'No valid text to embed', count: 0, hasMore: true });
    }

    // 3. Batch generate embeddings using NVIDIA NIM
    let insertedCount = 0;
    
    for (let i = 0; i < allChunks.length; i += MAX_CHUNKS_PER_NIM_CALL) {
      const batch = allChunks.slice(i, i + MAX_CHUNKS_PER_NIM_CALL);
      const texts = batch.map(c => c.chunk_text);
      
      const embeddings = await generateEmbeddings(texts, 'passage');

      const recordsToInsert = batch.map((c, idx) => ({
        user_id: userId,
        message_id: c.message_id,
        chunk_text: c.chunk_text,
        embedding: embeddings[idx],
        metadata: c.metadata
      }));

      const { error } = await supabase.from('email_chunks').insert(recordsToInsert);
      if (error) throw error;
      
      insertedCount += recordsToInsert.length;
    }

    return NextResponse.json({ 
      message: `Successfully embedded ${insertedCount} chunks from ${messagesToEmbed.length} messages.`,
      count: messagesToEmbed.length,
      hasMore: true
    });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
