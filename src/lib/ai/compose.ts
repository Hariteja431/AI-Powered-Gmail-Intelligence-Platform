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

export async function draftNewEmail(instruction: string) {
  const prompt = `
You are an expert AI email assistant writing on behalf of the user. 
User's instruction for the new email: "${instruction}"

Draft a complete, professional, and well-structured new email based on the instruction.
Include an appropriate greeting, well-formatted paragraphs, and a professional sign-off.
Also, if the user explicitly mentions a recipient email address (e.g., "Send an email to john@example.com"), extract it.

Provide your response in JSON format exactly like this:
{
  "to": "extracted email address, or empty string if none provided",
  "subject": "A compelling and relevant subject line",
  "body": "The plain text body of the email ready to be sent"
}
Make sure it is valid JSON and DO NOT wrap it in markdown code blocks. Just raw JSON.
  `;

  const response = await generateContentWithFallback([{ role: 'user', parts: [{ text: prompt }] }]);
  let text = response.response.text();
  text = text.replace(/^```json\s*/g, '').replace(/^```\s*/g, '').replace(/\s*```$/g, '').trim();
  return JSON.parse(text);
}
