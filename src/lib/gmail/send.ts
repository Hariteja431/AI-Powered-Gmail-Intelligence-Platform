import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth';
import { decrypt } from '../encryption';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function sendReply(userId: string, threadId: string, replyBody: string) {
  const { data: user } = await supabase
    .from('users')
    .select('email, google_access_token, google_refresh_token')
    .eq('id', userId)
    .single();

  if (!user) throw new Error('User not found');

  const { data: thread } = await supabase
    .from('threads')
    .select('gmail_thread_id')
    .eq('id', threadId)
    .single();

  if (!thread) throw new Error('Thread not found');

  const { data: messages } = await supabase
    .from('messages')
    .select('gmail_message_id, from_email, to_emails, subject, in_reply_to, references_header')
    .eq('thread_id', threadId)
    .order('internal_date', { ascending: false })
    .limit(1);

  if (!messages || messages.length === 0) throw new Error('No messages in thread');
  const lastMsg = messages[0];

  const accessToken = decrypt(user.google_access_token);
  const refreshToken = user.google_refresh_token ? decrypt(user.google_refresh_token) : undefined;
  const auth = getAuthenticatedClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  const to = lastMsg.from_email; 
  const subject = lastMsg.subject?.toLowerCase().startsWith('re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`;

  // Fetch actual SMTP Message-ID to construct valid thread headers
  const msgMeta = await gmail.users.messages.get({
    userId: 'me',
    id: lastMsg.gmail_message_id,
    format: 'metadata',
    metadataHeaders: ['Message-ID']
  });
  const messageIdHeader = msgMeta.data.payload?.headers?.find(h => h.name?.toLowerCase() === 'message-id')?.value || '';

  const inReplyTo = messageIdHeader;
  const existingReferences = lastMsg.references_header ? lastMsg.references_header.join(' ') : '';
  const references = `${existingReferences} ${messageIdHeader}`.trim();

  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references ? [`References: ${references}`] : []),
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    replyBody
  ];

  const raw = Buffer.from(emailLines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: thread.gmail_thread_id
    }
  });

  return res.data;
}
