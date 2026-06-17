import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { getAuthenticatedClient } from './oauth';
import { decrypt } from '../encryption';
import { parseMessage } from './parse';
import { chunkArray, withRetry } from '../utils/retry';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function runSync(userId: string) {
  console.log(`Starting sync for user ${userId}`);

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('google_access_token, google_refresh_token')
    .eq('id', userId)
    .single();

  if (userError || !user) throw new Error('User not found or no tokens');

  const accessToken = decrypt(user.google_access_token);
  const refreshToken = user.google_refresh_token ? decrypt(user.google_refresh_token) : undefined;

  const auth = getAuthenticatedClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth });

  let { data: syncState } = await supabase
    .from('sync_state')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!syncState) {
    const { data } = await supabase
      .from('sync_state')
      .insert({ user_id: userId, status: 'syncing' })
      .select()
      .single();
    syncState = data;
  } else {
    await supabase.from('sync_state').update({ status: 'syncing' }).eq('user_id', userId);
  }

  try {
    let historyId = syncState.last_history_id;
    let newHistoryId: string | undefined | null = null;
    let messagesToFetch: string[] = [];

    if (!historyId) {
      console.log('Performing initial sync...');
      const res = await withRetry(() => gmail.users.messages.list({
        userId: 'me',
        maxResults: 300,
      }));
      
      const msgs = res.data.messages || [];
      messagesToFetch = msgs.map(m => m.id!).filter(Boolean);
      
      const profileRes = await withRetry(() => gmail.users.getProfile({ userId: 'me' }));
      newHistoryId = profileRes.data.historyId;
    } else {
      console.log(`Performing incremental sync from historyId ${historyId}...`);
      let pageToken: string | undefined = undefined;
      
      do {
        const res = await withRetry(() => gmail.users.history.list({
          userId: 'me',
          startHistoryId: historyId,
          pageToken,
        }));
        
        newHistoryId = res.data.historyId; 
        const historyRecords = res.data.history || [];
        
        for (const record of historyRecords) {
          if (record.messagesAdded) {
            for (const msgAdded of record.messagesAdded) {
              if (msgAdded.message?.id) {
                messagesToFetch.push(msgAdded.message.id);
              }
            }
          }
        }
        pageToken = res.data.nextPageToken || undefined;
      } while (pageToken);
      
      messagesToFetch = [...new Set(messagesToFetch)];
    }

    console.log(`Found ${messagesToFetch.length} messages to fetch/sync.`);

    const chunks = chunkArray(messagesToFetch, 10);
    
    for (const chunk of chunks) {
      const fullMessages = await Promise.all(
        chunk.map(msgId => 
          withRetry(() => gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' }))
        )
      );

      const parsedMessages = fullMessages.map(res => parseMessage(res.data));

      const threadsToUpsert = parsedMessages.map(pm => ({
        user_id: userId,
        gmail_thread_id: pm.gmail_thread_id,
        subject: pm.subject,
        snippet: pm.snippet,
        last_message_at: pm.internal_date,
      }));

      for (const t of threadsToUpsert) {
        await supabase
          .from('threads')
          .upsert(t, { onConflict: 'gmail_thread_id' });
      }

      const threadIds = parsedMessages.map(pm => pm.gmail_thread_id!);
      const { data: dbThreads } = await supabase
        .from('threads')
        .select('id, gmail_thread_id')
        .in('gmail_thread_id', threadIds);

      const threadMap = new Map(dbThreads?.map(t => [t.gmail_thread_id, t.id]));

      const messagesToUpsert = parsedMessages.map(pm => ({
        user_id: userId,
        thread_id: threadMap.get(pm.gmail_thread_id!),
        gmail_message_id: pm.gmail_message_id,
        from_email: pm.from_email,
        from_name: pm.from_name,
        to_emails: pm.to_emails,
        subject: pm.subject,
        body_plain: pm.body_plain,
        body_html: pm.body_html,
        snippet: pm.snippet,
        internal_date: pm.internal_date,
        in_reply_to: pm.in_reply_to,
        references_header: pm.references_header,
        label_ids: pm.label_ids,
      })).filter(m => m.thread_id);

      if (messagesToUpsert.length > 0) {
        await supabase
          .from('messages')
          .upsert(messagesToUpsert, { onConflict: 'gmail_message_id' });
      }
    }

    await supabase
      .from('sync_state')
      .update({
        last_history_id: newHistoryId || historyId,
        last_synced_at: new Date().toISOString(),
        status: 'idle',
      })
      .eq('user_id', userId);
      
    if (newHistoryId) {
      await supabase.from('users').update({ history_id: newHistoryId }).eq('id', userId);
    }

    return { success: true, count: messagesToFetch.length };
  } catch (error: any) {
    console.error('Sync Error:', error);
    await supabase.from('sync_state').update({ status: 'error' }).eq('user_id', userId);
    throw error;
  }
}
