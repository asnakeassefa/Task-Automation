import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { config } from '../config/index.js';

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

const TTL_SECONDS = 2592000; // 30 days

export interface FallbackContext {
  subject: string;
  from: string;
  date: string;
}

function resolveKey(messageId: string, fallback?: FallbackContext): string | null {
  if (messageId) {
    return `processed:${createHash('sha256').update(messageId).digest('hex')}`;
  }
  if (fallback && (fallback.subject || fallback.from || fallback.date)) {
    const composite = `${fallback.subject}|${fallback.from}|${fallback.date}`;
    return `processed:${createHash('sha256').update(composite).digest('hex')}`;
  }
  return null;
}

export async function alreadyProcessed(messageId: string, fallback?: FallbackContext): Promise<boolean> {
  const key = resolveKey(messageId, fallback);
  if (!key) return false;
  const exists = await redis.exists(key);
  return exists === 1;
}

export async function markProcessed(messageId: string, fallback?: FallbackContext): Promise<void> {
  const key = resolveKey(messageId, fallback);
  if (!key) return;
  await redis.set(key, '1', 'EX', TTL_SECONDS);
}

export async function closeDedup(): Promise<void> {
  await redis.quit();
}
