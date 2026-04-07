import { Queue } from 'bullmq';
import { config } from '../config/index.js';
import type { RawEmailPayload } from '../parser/emailParser.js';

const emailQueue = new Queue('email-tasks', {
  connection: { url: config.redisUrl },
});

export async function enqueueEmailJob(payload: RawEmailPayload): Promise<void> {
  await emailQueue.add('process-email', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: false,
  });
}

export async function closeProducer(): Promise<void> {
  await emailQueue.close();
}
