import { Worker, type Job } from 'bullmq';
import { config } from '../config/index.js';
import type { RawEmailPayload } from '../parser/emailParser.js';
import { buildExtractionPrompt } from '../ai/prompts.js';
import { extractTaskFromEmail } from '../ai/geminiClient.js';
import { validateExtractedTask } from '../validator/taskSchema.js';
import { createAsanaTask } from '../asana/client.js';
import { alreadyProcessed, markProcessed } from '../dedup/redis.js';
import { logger } from '../logger.js';

const log = logger.child({ component: 'worker' });

async function processEmailJob(job: Job<RawEmailPayload>): Promise<void> {
  const email = job.data;
  const label = email.subject || email.messageId;
  const fallback = { subject: email.subject, from: email.from, date: email.date };

  if (await alreadyProcessed(email.messageId, fallback)) {
    log.info({ subject: label, jobId: job.id }, `Skipped (duplicate): "${label}"`);
    return;
  }

  log.info({ subject: label, jobId: job.id }, `Processing: "${label}"`);

  const prompt = buildExtractionPrompt(email);
  const rawOutput = await extractTaskFromEmail(prompt);
  const extracted = validateExtractedTask(rawOutput);

  log.info({ taskName: extracted.task_name, isActionable: extracted.is_actionable }, `Gemini extracted: "${extracted.task_name}" (actionable=${extracted.is_actionable})`);

  if (!extracted.is_actionable) {
    log.info({ subject: label }, 'Skipped: not actionable');
    await markProcessed(email.messageId, fallback);
    return;
  }

  const result = await createAsanaTask(extracted);
  const assigneeLabel = result.assignee
    ? `${result.assignee.name} (${result.assignee.email})`
    : 'unassigned';

  log.info(
    { gid: result.gid, url: result.permalink_url, assignee: assigneeLabel },
    `Task created in Asana: ${result.permalink_url} (assigned to ${assigneeLabel})`,
  );

  await markProcessed(email.messageId, fallback);
}

let worker: Worker<RawEmailPayload> | null = null;

export function startWorker(): void {
  worker = new Worker<RawEmailPayload>('email-tasks', processEmailJob, {
    connection: { url: config.redisUrl },
    concurrency: 1,
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err }, `Job ${job?.id} failed`);
  });

  log.info('Worker listening on queue: email-tasks');
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    log.info('Worker stopped');
  }
}
