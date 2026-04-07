import { Worker, type Job } from 'bullmq';
import { config } from '../config/index.js';
import type { RawEmailPayload } from '../parser/emailParser.js';
import { buildExtractionPrompt } from '../ai/prompts.js';
import { extractTaskFromEmail } from '../ai/geminiClient.js';
import { validateExtractedTask } from '../validator/taskSchema.js';
import { createAsanaTask } from '../asana/client.js';
import { alreadyProcessed, markProcessed } from '../dedup/redis.js';

async function processEmailJob(job: Job<RawEmailPayload>): Promise<void> {
  const email = job.data;
  const label = email.subject || email.messageId;

  if (await alreadyProcessed(email.messageId)) {
    console.log(`[worker] Skipped (duplicate): "${label}"`);
    return;
  }

  console.log(`[worker] Processing: "${label}"`);

  const prompt = buildExtractionPrompt(email);
  const rawOutput = await extractTaskFromEmail(prompt);
  const extracted = validateExtractedTask(rawOutput);

  console.log(`[worker] Gemini extracted task: "${extracted.task_name}" (actionable=${extracted.is_actionable})`);

  if (!extracted.is_actionable) {
    console.log(`[worker] Skipped: not actionable`);
    await markProcessed(email.messageId);
    return;
  }

  const result = await createAsanaTask(extracted);
  const assigneeLabel = result.assignee
    ? `${result.assignee.name} (${result.assignee.email})`
    : 'unassigned';

  console.log(`[worker] Task created in Asana: ${result.permalink_url} (assigned to ${assigneeLabel})`);

  await markProcessed(email.messageId);
}

let worker: Worker<RawEmailPayload> | null = null;

export function startWorker(): void {
  worker = new Worker<RawEmailPayload>('email-tasks', processEmailJob, {
    connection: { url: config.redisUrl },
    concurrency: 1,
  });

  worker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job?.id} failed: ${err.message}`);
  });

  console.log('[worker] Worker listening on queue: email-tasks');
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[worker] Worker stopped');
  }
}
