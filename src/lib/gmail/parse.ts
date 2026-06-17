import { gmail_v1 } from 'googleapis';

export function decodeBase64Url(data: string | null | undefined): string {
  if (!data) return '';
  return Buffer.from(data, 'base64url').toString('utf-8');
}

export function extractEmailContent(payload: gmail_v1.Schema$MessagePart | undefined) {
  let bodyPlain = '';
  let bodyHtml = '';

  if (!payload) return { bodyPlain, bodyHtml };

  function parseParts(part: gmail_v1.Schema$MessagePart) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyPlain += decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml += decodeBase64Url(part.body.data);
    } else if (part.parts) {
      for (const p of part.parts) {
        parseParts(p);
      }
    }
  }

  parseParts(payload);

  if (!bodyPlain && !bodyHtml && payload.body?.data) {
    if (payload.mimeType === 'text/html') {
      bodyHtml = decodeBase64Url(payload.body.data);
    } else {
      bodyPlain = decodeBase64Url(payload.body.data);
    }
  }

  return { bodyPlain, bodyHtml };
}

export function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!headers) return '';
  const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

export function parseMessage(message: gmail_v1.Schema$Message) {
  const headers = message.payload?.headers;
  
  const fromHeader = getHeader(headers, 'From');
  const emailMatch = fromHeader.match(/<(.+?)>/);
  const fromEmail = emailMatch ? emailMatch[1] : fromHeader;
  const fromName = emailMatch ? fromHeader.replace(/<.+?>/, '').trim() : '';

  const toHeader = getHeader(headers, 'To');
  const toEmails = toHeader ? toHeader.split(',').map(e => e.trim()) : [];

  const subject = getHeader(headers, 'Subject');
  const inReplyTo = getHeader(headers, 'In-Reply-To');
  
  const references = getHeader(headers, 'References');
  const referencesHeader = references ? references.split(/\s+/) : [];

  const { bodyPlain, bodyHtml } = extractEmailContent(message.payload);

  return {
    gmail_message_id: message.id,
    gmail_thread_id: message.threadId,
    from_email: fromEmail.replace(/["']/g, ''),
    from_name: fromName.replace(/["']/g, ''),
    to_emails: toEmails,
    subject,
    body_plain: bodyPlain,
    body_html: bodyHtml,
    snippet: message.snippet,
    internal_date: new Date(parseInt(message.internalDate || '0')).toISOString(),
    in_reply_to: inReplyTo,
    references_header: referencesHeader,
    label_ids: message.labelIds || [],
  };
}
