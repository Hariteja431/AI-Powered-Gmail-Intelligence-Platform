import { generateContentWithFallback } from './gemini';
import { createClient } from '@supabase/supabase-js';
import { withRetry } from '../utils/retry';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function summarizeThread(threadId: string) {
  const { data: messages } = await supabase
    .from('messages')
    .select('from_name, from_email, internal_date, body_plain')
    .eq('thread_id', threadId)
    .order('internal_date', { ascending: true });

  if (!messages || messages.length === 0) return null;

  const prompt = `
You are an AI assistant helping to summarize an email thread. 

Here are the messages in chronological order:
${messages.map((m, i) => `Message ${i + 1} from ${m.from_name || m.from_email} on ${new Date(m.internal_date).toLocaleString()}:\n${m.body_plain?.substring(0, 1000) || ''}`).join('\n\n')}

Provide a concise, 2-3 sentence summary of the entire thread. Focus on the main action items, decisions, or key information.
  `;

  const response = await withRetry(() => generateContentWithFallback(
    [{ role: 'user', parts: [{ text: prompt }] }]
  ), 3, 2000);
  return response.response.text();
}

export async function generateDailyDigest(userId: string) {
  const { data: threads } = await supabase
    .from('threads')
    .select('subject, category, snippet, last_message_at')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
    .limit(20);

  if (!threads || threads.length === 0) return 'No recent threads to summarize.';

  const prompt = `
You are a helpful executive assistant. I have ${threads.length} recent emails.
Please provide a "Daily Digest" briefing. Group them logically (e.g., Action Needed, News, Updates).
Be concise but informative. Format as Markdown.

Emails:
${JSON.stringify(threads, null, 2)}
  `;

  const response = await withRetry(() => generateContentWithFallback(
    [{ role: 'user', parts: [{ text: prompt }] }]
  ), 3, 2000);
  return response.response.text();
}
