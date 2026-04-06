export interface RawEmailPayload {
  messageId: string;
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  date: string;
  textBody: string;
  htmlBody?: string;
}

interface RawEmailInput {
  messageId?: string;
  subject?: string;
  from?: string;
  fromEmail?: string;
  to?: string;
  date?: string;
  textBody?: string;
  htmlBody?: string;
}

export function parseEmail(raw: RawEmailInput): RawEmailPayload {
  return {
    messageId: raw.messageId ?? `generated-${Date.now()}`,
    subject: raw.subject ?? '(no subject)',
    from: raw.from ?? 'Unknown',
    fromEmail: raw.fromEmail ?? extractEmailAddress(raw.from),
    to: raw.to ?? '',
    date: raw.date ?? new Date().toISOString(),
    textBody: raw.textBody ?? '',
    htmlBody: raw.htmlBody,
  };
}

function extractEmailAddress(from?: string): string {
  if (!from) return 'unknown@unknown.com';
  const match = from.match(/<(.+?)>/);
  return match ? match[1] : from;
}
