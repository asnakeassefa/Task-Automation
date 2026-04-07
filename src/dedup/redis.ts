import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { config } from '../config/index.js';

const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

const TTL_SECONDS = 2592000; // 30 days

function dedupKey(messageId: string): string {
  const hash = createHash('sha256').update(messageId).digest('hex');
  return `processed:${hash}`;
}

export async function alreadyProcessed(messageId: string): Promise<boolean> {
  if (!messageId) return false;
  const exists = await redis.exists(dedupKey(messageId));
  return exists === 1;
}

export async function markProcessed(messageId: string): Promise<void> {
  if (!messageId) return;
  await redis.set(dedupKey(messageId), '1', 'EX', TTL_SECONDS);
}

export async function closeDedup(): Promise<void> {
  await redis.quit();
}
