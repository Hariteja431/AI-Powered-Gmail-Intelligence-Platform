const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length > 0) acc[key.trim()] = rest.join('=').trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Check if we have chunks
  const { count, error } = await supabase.from('email_chunks').select('id', { count: 'exact', head: true });
  console.log('Total chunks:', count);
  if (error) console.error(error);

  // If there are chunks, let's look at one and do a fake similarity search
  const { data: chunks } = await supabase.from('email_chunks').select('embedding, user_id').limit(1);
  if (chunks && chunks.length > 0) {
    const chunk = chunks[0];
    const { data: matches, error: rpcError } = await supabase.rpc('match_email_chunks', {
      query_embedding: chunk.embedding,
      match_threshold: 0.0,
      match_count: 5,
      p_user_id: chunk.user_id
    });
    console.log('Match error:', rpcError);
    console.log('Matches:', matches?.length);
    if (matches && matches.length > 0) {
      matches.forEach(m => console.log('Similarity:', m.similarity, m.chunk_text.substring(0, 30)));
    }
  } else {
    console.log('No chunks found to test matching.');
  }
}

check();
