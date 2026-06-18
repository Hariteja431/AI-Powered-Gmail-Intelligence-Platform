import { generateContentWithFallback } from './gemini';
import { createClient } from '@supabase/supabase-js';
import { chunkArray, withRetry } from '../utils/retry';

const CATEGORIES = [
  'Newsletters',
  'Job/Recruitment',
  'Finance',
  'Notifications',
  'Personal',
  'Work/Professional',
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function categorizeThreads(userId: string) {
  const { data: threads, error } = await supabase
    .from('threads')
    .select('id, gmail_thread_id, subject, snippet')
    .eq('user_id', userId)
    .is('category', null)
    .limit(300); 

  if (error || !threads || threads.length === 0) {
    return { success: true, count: 0 };
  }

  const batches = chunkArray(threads, 10);
  let categorizedCount = 0;

  for (const batch of batches) {
    const prompt = `
You are an expert email categorizer. Your task is to classify a batch of email threads into ONE of the following precise categories:
${CATEGORIES.map(c => `- ${c}`).join('\n')}

I will provide a JSON array of threads, each with an 'id', 'subject', and 'snippet'.
Return ONLY a valid JSON array of objects with 'id' and 'category'. Do not use markdown code fences, just output raw JSON.

Input Threads:
${JSON.stringify(batch, null, 2)}
    `;

    try {
      const response = await withRetry(() => generateContentWithFallback(
        [{ role: 'user', parts: [{ text: prompt }] }],
        { responseMimeType: 'application/json' }
      ), 3, 2000);

      let text = response.response.text();
      // Robust JSON extraction
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        text = match[0];
      }

      const results = JSON.parse(text) as { id: string, category: string }[];
      
      const validCategories = new Set(CATEGORIES);
      
      // Update one by one so one failure doesn't halt the rest
      for (const res of results) {
        try {
          if (!validCategories.has(res.category)) {
            res.category = 'Notifications'; // Fallback
          }
          await supabase
            .from('threads')
            .update({ category: res.category })
            .eq('id', res.id);
            
          categorizedCount++;
        } catch (updateErr) {
          console.error(`Error updating thread ${res.id}:`, updateErr);
        }
      }
    } catch (err) {
      console.error('Categorization error for batch:', err);
      // Fallback: If AI fails entirely, mark batch as Uncategorized so they don't block the queue
      for (const t of batch) {
        try {
          await supabase.from('threads').update({ category: 'Uncategorized' }).eq('id', t.id);
          categorizedCount++;
        } catch (e) {}
      }
    }
  }

  return { success: true, count: categorizedCount };
}
