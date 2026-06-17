import { generateContentWithFallback } from './gemini';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function draftReply(threadId: string, instruction: string) {
  const { data: messages } = await supabase
    .from('messages')
    .select('from_name, from_email, internal_date, body_plain')
    .eq('thread_id', threadId)
    .order('internal_date', { ascending: true });

  if (!messages || messages.length === 0) throw new Error('No messages found for this thread');

  const prompt = `
You are an expert AI email assistant writing on behalf of the user. 
Here is the email thread history in chronological order:
${messages.map((m, i) => `Message ${i + 1} from ${m.from_name || m.from_email}:\n${m.body_plain?.substring(0, 1000) || ''}`).join('\n\n')}

User's instruction for the reply: "${instruction}"

Draft a complete, professional, and well-structured email reply based on the instruction.
Include an appropriate greeting (e.g., "Hi [Name],") based on the previous messages, well-formatted paragraphs, and a professional sign-off.
DO NOT include email headers, Subject lines, or any Markdown formatting. Just output the plain text body of the email ready to be sent.
  `;

  const response = await generateContentWithFallback([{ role: 'user', parts: [{ text: prompt }] }]);
  return response.response.text();
}
