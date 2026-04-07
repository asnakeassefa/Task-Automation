import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import { config } from '../config/index.js';
import { parseEmail } from '../parser/emailParser.js';
import { enqueueEmailJob } from '../queue/producer.js';

let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;

async function pollOnce(): Promise<void> {
  if (running) return;
  running = true;

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: config.gmailUser,
      pass: config.gmailAppPassword,
    },
    logger: false,
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    try {
      const searchResult = await client.search({ seen: false });
      const uids = searchResult || [];

      if (uids.length === 0) {
        console.log('[poller] No new emails');
        return;
      }

      console.log(`[poller] Found ${uids.length} unseen email(s), processing...`);

      for (const uid of uids) {
        const message = await client.fetchOne(uid, { source: true });
        if (!message || !message.source) continue;
        const parsed: ParsedMail = await simpleParser(message.source) as ParsedMail;

        const to = parsed.to;
        const toText = to
          ? (Array.isArray(to) ? to.map((a) => a.text).join(', ') : to.text)
          : undefined;

        const email = parseEmail({
          messageId: parsed.messageId || undefined,
          subject: parsed.subject || undefined,
          from: parsed.from?.text || undefined,
          fromEmail: parsed.from?.value?.[0]?.address || undefined,
          to: toText,
          date: parsed.date?.toISOString() || undefined,
          textBody: parsed.text || undefined,
          htmlBody: parsed.html || undefined,
        });

        await enqueueEmailJob(email);
        console.log(`[poller] Enqueued: "${email.subject}"`);

        await client.messageFlagsAdd(uid, ['\\Seen']);
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error(`[poller] Error: ${err instanceof Error ? err.message : err}`);
  } finally {
    running = false;
  }
}

export async function startPoller(): Promise<void> {
  console.log(`[poller] Connecting as ${config.gmailUser}, polling every ${config.gmailPollIntervalMs / 1000}s...`);

  await pollOnce();

  intervalId = setInterval(pollOnce, config.gmailPollIntervalMs);
}

export function stopPoller(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[poller] Poller stopped');
  }
}
